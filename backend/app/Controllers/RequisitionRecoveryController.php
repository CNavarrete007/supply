<?php

declare(strict_types=1);
namespace App\Controllers;
use App\Libraries\RequisitionRecoveryInput;
use App\Libraries\RequisitionRegularizationInput;
use App\Libraries\RequisitionRecoveryRepository;
use App\Libraries\RecoveryConflict;
use App\Libraries\RecoveryStale;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use InvalidArgumentException;
use Throwable;

/** Local RF1 pilot: preserve the current authenticated Master Admin boundary. */
final class RequisitionRecoveryController extends BaseController
{
    private array $actor=[];
    private function reply(int $code,array $body):ResponseInterface{return $this->response->setStatusCode($code)->setHeader('Cache-Control','private, no-store')->setHeader('X-Content-Type-Options','nosniff')->setJSON($body);}
    private function fail(int $code,string $error,string $message):ResponseInterface{return $this->reply($code,['error'=>['code'=>$error,'message'=>$message]]);}
    private function authorize():?ResponseInterface
    {
        try{$user=(new SupplyAuthRepository())->currentUser($_COOKIE['sf_session']??null);}catch(Throwable){return $this->fail(503,'AUTH_UNAVAILABLE','No es posible validar la sesión.');}
        if(!$user)return $this->fail(401,'NOT_AUTHENTICATED','Inicia sesión para continuar.');
        if(!in_array('master_admin',array_column($user['roles']??[],'code'),true))return $this->fail(403,'FORBIDDEN','No cuentas con permisos para esta operación.');
        $this->actor=$user;return null;
    }
    private function error(Throwable $e):ResponseInterface
    {
        if($e instanceof InvalidArgumentException)return $this->fail(422,'INVALID_REQUISITION',$e->getMessage());
        if($e instanceof RecoveryStale)return $this->fail(412,'STALE_VERSION',$e->getMessage());
        if($e instanceof RecoveryConflict)return $this->fail(409,$e->errorCode,$e->getMessage());
        log_message('error','SupplyFlow RF1 failed: '.get_class($e).' code '.(string)$e->getCode());
        return $this->fail(503,'RECOVERY_UNAVAILABLE','No se pudo completar la operación. No se confirmó un guardado.');
    }
    private function csrf():bool
    {
        $cookie=$_COOKIE['sf_csrf']??'';$header=$this->request->getHeaderLine('X-SF-CSRF');$origin=$this->request->getHeaderLine('Origin');
        if($origin!==''){
            $p=parse_url($origin);
            if(!is_array($p)||!isset($p['host'])||!in_array($p['scheme']??'',['http','https'],true))return false;
            if(strtolower($p['host'].(isset($p['port'])?':'.$p['port']:''))!==strtolower($this->request->getHeaderLine('Host')))return false;
        }
        return is_string($cookie)&&preg_match('/^[a-f0-9]{64}$/D',$cookie)&&preg_match('/^[a-f0-9]{64}$/D',$header)&&hash_equals($cookie,$header);
    }
    public function catalogs():ResponseInterface
    {
        if($f=$this->authorize())return $f;
        try{return $this->reply(200,(new RequisitionRecoveryRepository())->catalogs((int)$this->actor['organization_id']));}catch(Throwable $e){return $this->error($e);}
    }
    public function matrix():ResponseInterface
    {
        if($f=$this->authorize())return $f;
        try{return $this->reply(200,(new RequisitionRecoveryRepository())->matrix((int)$this->actor['organization_id'],(int)$this->actor['id']));}catch(Throwable $e){return $this->error($e);}
    }
    public function folio():ResponseInterface
    {
        if($f=$this->authorize())return $f;
        $client=$this->request->getGet('client_id');$date=$this->request->getGet('date');$mode=$this->request->getGet('mode');
        if(!is_string($client)||($mode!=='provisional'&&!RequisitionRecoveryInput::uuid($client))||!is_string($date)||!in_array($mode,['formal','provisional'],true))return $this->fail(422,'INVALID_REQUEST','Selecciona cliente, fecha y tipo de entrada.');
        try{return $this->reply(200,(new RequisitionRecoveryRepository())->folio((int)$this->actor['organization_id'],$client,$date,$mode==='provisional'));}catch(Throwable $e){return $this->error($e);}
    }
    public function detail(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','No se encontró la requisición seleccionada.');
        try{$data=(new RequisitionRecoveryRepository())->detail((int)$this->actor['organization_id'],(int)$this->actor['id'],$id);return $data?$this->reply(200,$data):$this->fail(404,'NOT_FOUND','No se encontró la requisición seleccionada.');}catch(Throwable $e){return $this->error($e);}
    }
    public function document(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','No se encontró el archivo.');
        try{
            $file=(new RequisitionRecoveryRepository())->document((int)$this->actor['organization_id'],$id);
            if(!$file)return $this->fail(404,'NOT_FOUND','Esta requisición no tiene archivo adjunto.');
            $mime=in_array($file['detected_mime'],['application/pdf','image/jpeg','image/png','image/webp'],true)?$file['detected_mime']:'application/octet-stream';
            $name=basename(str_replace('\\','/',(string)$file['original_filename']));$name=preg_replace('/[\x00-\x1f\x7f]/','',$name)?:'requisicion';
            return $this->response->setStatusCode(200)->setHeader('Content-Type',$mime)->setHeader('Cache-Control','private, no-store')
                ->setHeader('X-Content-Type-Options','nosniff')->setHeader('Content-Security-Policy',"sandbox; default-src 'none'; frame-ancestors 'self'")
                ->setHeader('Content-Disposition',"inline; filename=\"requisicion\"; filename*=UTF-8''".rawurlencode($name))->setBody((string)file_get_contents($file['path']));
        }catch(Throwable $e){return $this->error($e);}
    }
    public function regularization(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Requisición no encontrada.');
        try{$data=(new RequisitionRecoveryRepository())->regularization((int)$this->actor['organization_id'],$id);
            return $data?$this->reply(200,$data):$this->fail(404,'NOT_FOUND','Requisición no encontrada.');}
        catch(Throwable $e){return $this->error($e);}
    }
    public function regularizationDocument(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Requisición no encontrada.');
        try{
            $file=(new RequisitionRecoveryRepository())->regularizationDocument((int)$this->actor['organization_id'],$id);
            if(!$file)return $this->fail(404,'NOT_FOUND','Evidencia no encontrada.');
            $mime=in_array($file['detected_mime'],['application/pdf','image/jpeg','image/png','image/webp'],true)?$file['detected_mime']:'application/octet-stream';
            $name=basename(str_replace('\\','/',(string)$file['original_filename']));
            $name=preg_replace('/[\x00-\x1f\x7f]/','',$name)?:'evidencia';
            return $this->response->setStatusCode(200)->setHeader('Content-Type',$mime)
                ->setHeader('Cache-Control','private, no-store')->setHeader('X-Content-Type-Options','nosniff')
                ->setHeader('Content-Security-Policy',"sandbox; default-src 'none'; frame-ancestors 'self'")
                ->setHeader('Content-Disposition',"attachment; filename=\"evidencia\"; filename*=UTF-8''".rawurlencode($name))
                ->setBody((string)file_get_contents($file['path']));
        }catch(Throwable $e){return $this->error($e);}
    }
    public function regularize(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!$this->csrf())return $this->fail(403,'CSRF_INVALID','Solicitud no autorizada.');
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Requisición no encontrada.');
        if(!str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')),'application/json'))return $this->fail(415,'JSON_REQUIRED','Se requiere JSON.');
        if(strlen((string)$this->request->getBody())>12582912)return $this->fail(413,'PAYLOAD_TOO_LARGE','El límite técnico de evidencia es 8 MiB.');
        $key=$this->request->getHeaderLine('Idempotency-Key');
        if(!RequisitionRecoveryInput::uuid($key))return $this->fail(422,'IDEMPOTENCY_REQUIRED','Falta identificador de solicitud.');
        if(!preg_match('/^"([1-9][0-9]{0,8})"$/D',$this->request->getHeaderLine('If-Match'),$m))
            return $this->fail(428,'VERSION_REQUIRED','Se necesita la versión vigente.');
        try{
            $data=RequisitionRegularizationInput::payload($this->request->getJSON(true));
            $out=(new RequisitionRecoveryRepository())->regularize((int)$this->actor['organization_id'],(int)$this->actor['id'],$id,(int)$m[1],$data,strtolower($key));
            return $this->reply(200,$out);
        }catch(Throwable $e){return $this->error($e);}
    }
    public function create():ResponseInterface{return $this->write(null);}
    public function update(string $id):ResponseInterface{return $this->write($id);}
    private function write(?string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!$this->csrf())return $this->fail(403,'CSRF_INVALID','Solicitud no autorizada.');
        if($id!==null&&!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Requisición no encontrada.');
        if(!str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')),'application/json'))return $this->fail(415,'JSON_REQUIRED','Se requiere JSON.');
        if(strlen((string)$this->request->getBody())>12582912)return $this->fail(413,'PAYLOAD_TOO_LARGE','El límite técnico local del archivo es 8 MiB.');
        $key=$this->request->getHeaderLine('Idempotency-Key');
        if(!RequisitionRecoveryInput::uuid($key))return $this->fail(422,'IDEMPOTENCY_REQUIRED','Falta la identificación de la solicitud.');
        $version=null;
        if($id!==null){if(!preg_match('/^"([1-9][0-9]{0,8})"$/D',$this->request->getHeaderLine('If-Match'),$m))return $this->fail(428,'VERSION_REQUIRED','Se necesita la versión vigente.');$version=(int)$m[1];}
        try{
            $input=RequisitionRecoveryInput::payload($this->request->getJSON(true));
            $data=(new RequisitionRecoveryRepository())->save((int)$this->actor['organization_id'],(int)$this->actor['id'],$id,$version,$input,strtolower($key));
            return $this->reply($id===null&&!$data['replayed']?201:200,$data);
        }catch(Throwable $e){return $this->error($e);}
    }
}
