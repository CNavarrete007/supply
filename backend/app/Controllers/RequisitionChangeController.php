<?php

declare(strict_types=1);
namespace App\Controllers;

use App\Libraries\RequisitionChangeInput;
use App\Libraries\RequisitionChangeRepository;
use App\Libraries\RequisitionChangeDecisionRepository;
use App\Libraries\RequisitionChangeDecisionInput;
use App\Libraries\RequisitionCommercialAssessmentRepository;
use App\Libraries\RequisitionCommercialAssessmentInput;
use App\Libraries\RequisitionCommercialExecutionInput;
use App\Libraries\RequisitionCommercialExecutionRepository;
use App\Libraries\RequisitionRecoveryInput;
use App\Libraries\RequisitionChangeConflict;
use App\Libraries\RequisitionChangeStale;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use InvalidArgumentException;
use Throwable;

/** R3A intake, R3B review/application, R3C add-lines and read-only impact. */
final class RequisitionChangeController extends BaseController
{
    private array $actor=[];
    private function reply(int $code,array $data):ResponseInterface
    {
        return $this->response->setStatusCode($code)->setHeader('Cache-Control','private, no-store')
            ->setHeader('X-Content-Type-Options','nosniff')->setJSON($data);
    }
    private function fail(int $code,string $key,string $message):ResponseInterface
    {
        return $this->reply($code,['error'=>['code'=>$key,'message'=>$message]]);
    }
    private function authorize():?ResponseInterface
    {
        try{$user=(new SupplyAuthRepository())->currentUser($_COOKIE['sf_session']??null);}
        catch(Throwable){return $this->fail(503,'AUTH_UNAVAILABLE','No se puede validar la sesión.');}
        if(!$user)return $this->fail(401,'NOT_AUTHENTICATED','Inicia sesión.');
        if(!in_array('master_admin',array_column($user['roles']??[],'code'),true))
            return $this->fail(403,'FORBIDDEN','No tienes autorización para cambios de requisiciones.');
        $this->actor=$user;return null;
    }
    private function csrf():bool
    {
        $cookie=$_COOKIE['sf_csrf']??'';$header=$this->request->getHeaderLine('X-SF-CSRF');
        $origin=$this->request->getHeaderLine('Origin');
        if($origin!==''){
            $p=parse_url($origin);
            if(!is_array($p)||!isset($p['host'])||!in_array($p['scheme']??'',['http','https'],true))return false;
            if(strtolower($p['host'].(isset($p['port'])?':'.$p['port']:''))!==strtolower($this->request->getHeaderLine('Host')))return false;
        }
        return is_string($cookie)&&preg_match('/^[a-f0-9]{64}$/D',$cookie)
            &&preg_match('/^[a-f0-9]{64}$/D',$header)&&hash_equals($cookie,$header);
    }
    private function error(Throwable $e):ResponseInterface
    {
        if($e instanceof InvalidArgumentException)return $this->fail(422,'INVALID_CHANGE',$e->getMessage());
        if($e instanceof RequisitionChangeStale)return $this->fail(412,'STALE_VERSION',$e->getMessage());
        if($e instanceof RequisitionChangeConflict)return $this->fail(409,$e->errorCode,$e->getMessage());
        log_message('error','SupplyFlow R3 change failed: '.get_class($e));
        return $this->fail(503,'CHANGE_UNAVAILABLE','No se pudo confirmar la operación. Consulta su estado antes de repetir.');
    }
    private function body():array
    {
        if(!str_starts_with(strtolower($this->request->getHeaderLine('Content-Type')),'application/json'))
            throw new RequisitionChangeHttpError(415,'JSON_REQUIRED','Se requiere JSON.');
        if(strlen((string)$this->request->getBody())>131072)
            throw new RequisitionChangeHttpError(413,'PAYLOAD_TOO_LARGE','Solicitud demasiado grande.');
        try{$data=json_decode((string)$this->request->getBody(),true,512,JSON_THROW_ON_ERROR);}
        catch(\JsonException){throw new InvalidArgumentException('JSON malformado.');}
        if(!is_array($data)||array_is_list($data)) throw new InvalidArgumentException('JSON inválido.');
        return $data;
    }
    private function writeHeaders():array
    {
        if(!$this->csrf())throw new RequisitionChangeHttpError(403,'CSRF_INVALID','Solicitud no autorizada.');
        $key=$this->request->getHeaderLine('Idempotency-Key');
        if(!RequisitionRecoveryInput::uuid($key))throw new RequisitionChangeHttpError(422,'IDEMPOTENCY_REQUIRED','Se necesita Idempotency-Key UUID.');
        if(!preg_match('/^"([1-9][0-9]{0,8})"$/D',$this->request->getHeaderLine('If-Match'),$m))
            throw new RequisitionChangeHttpError(428,'VERSION_REQUIRED','Se necesita If-Match con la versión vigente.');
        return [strtolower($key),(int)$m[1]];
    }
    private function execute(callable $fn):ResponseInterface
    {
        try{return $fn();}
        catch(RequisitionChangeHttpError $e){return $this->fail($e->status,$e->errorCode,$e->getMessage());}
        catch(Throwable $e){return $this->error($e);}
    }
    public function index():ResponseInterface
    {
        if($f=$this->authorize())return $f;
        return $this->execute(function(){
            $for=$this->request->getGet('requisition_id');
            if($for!==null&&(!is_string($for)||!RequisitionRecoveryInput::uuid($for)))
                return $this->fail(422,'INVALID_FILTER','Identificador de requisición inválido.');
            return $this->reply(200,(new RequisitionChangeRepository())->listing((int)$this->actor['organization_id'],(int)$this->actor['id'],$for));
        });
    }
    public function detail(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            $data=(new RequisitionChangeRepository())->detail((int)$this->actor['organization_id'],(int)$this->actor['id'],$id);
            return $data?$this->reply(200,$data):$this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        });
    }
    public function create(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Requisición no encontrada.');
        return $this->execute(function()use($id){
            [$key,$version]=$this->writeHeaders();
            $input=RequisitionChangeInput::payload($this->body());
            $data=(new RequisitionChangeRepository())->create((int)$this->actor['organization_id'],(int)$this->actor['id'],$id,$version,$input,$key);
            return $this->reply($data['replayed']?200:201,$data);
        });
    }
    public function withdraw(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            [$key,$version]=$this->writeHeaders();
            $input=RequisitionChangeInput::withdraw($this->body());
            $data=(new RequisitionChangeRepository())->withdraw((int)$this->actor['organization_id'],(int)$this->actor['id'],$id,$version,$input,$key);
            return $this->reply(200,$data);
        });
    }
    /** R3B: only separate Master Admin reviewers, not the proposal requester. */
    public function reviewQueue():ResponseInterface
    {
        if($f=$this->authorize())return $f;
        return $this->execute(function(){
            return $this->reply(200,(new RequisitionChangeDecisionRepository())->queue(
                (int)$this->actor['organization_id'],(int)$this->actor['id']));
        });
    }
    public function reviewDetail(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            $value=(new RequisitionChangeDecisionRepository())->inspect(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id);
            return $value?$this->reply(200,$value):$this->fail(404,'NOT_FOUND','Cambio no disponible para revisión.');
        });
    }
    /** R3C: read-only commercial impact for a different authorized reviewer. */
    public function impact(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            $value=(new RequisitionChangeDecisionRepository())->impact(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id);
            return $value?$this->reply(200,$value):$this->fail(404,'NOT_FOUND','Cambio no disponible para revisión.');
        });
    }
    /** R3C2: independent reviewer, read-only commercial dossier. */
    public function commercialReconciliation(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            $value=(new RequisitionCommercialAssessmentRepository())->dossier(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id);
            return $value?$this->reply(200,$value):$this->fail(404,'NOT_FOUND','Cambio no disponible para conciliación.');
        });
    }
    /** R3C2: append-only documented plan. This NEVER approves or changes commercial documents. */
    public function recordCommercialReconciliation(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            [$key,$version]=$this->writeHeaders();
            $input=RequisitionCommercialAssessmentInput::payload($this->body());
            $data=(new RequisitionCommercialAssessmentRepository())->record(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id,$version,$input,$key);
            return $this->reply($data['replayed']?200:201,$data);
        });
    }

    /** R3C3: read-only, per-document evidence and independent-review history. */
    public function commercialExecutions(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            $data=(new RequisitionCommercialExecutionRepository())->listing(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id);
            return $data?$this->reply(200,$data):$this->fail(404,'NOT_FOUND','Cambio no disponible.');
        });
    }
    /** R3C3: register evidence only; NOT a document issuance, approval, or change application. */
    public function recordCommercialExecution(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            [$key,$version]=$this->writeHeaders();
            $payload=RequisitionCommercialExecutionInput::record($this->body());
            $out=(new RequisitionCommercialExecutionRepository())->record(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id,$version,$payload,$key);
            return $this->reply($out['replayed']?200:201,$out);
        });
    }
    /** R3C3: distinct admin reviews integrity and linkage of evidence, not commercial authority. */
    public function reviewCommercialExecution(string $id,string $execution):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id)||!RequisitionRecoveryInput::uuid($execution))
            return $this->fail(404,'NOT_FOUND','Constancia no encontrada.');
        return $this->execute(function()use($id,$execution){
            [$key,$version]=$this->writeHeaders();
            $payload=RequisitionCommercialExecutionInput::review($this->body());
            $out=(new RequisitionCommercialExecutionRepository())->review(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id,$execution,$version,$payload,$key);
            return $this->reply(200,$out);
        });
    }

    public function decide(string $id):ResponseInterface
    {
        if($f=$this->authorize())return $f;
        if(!RequisitionRecoveryInput::uuid($id))return $this->fail(404,'NOT_FOUND','Cambio no encontrado.');
        return $this->execute(function()use($id){
            [$key,$version]=$this->writeHeaders();
            $payload=RequisitionChangeDecisionInput::payload($this->body());
            $result=(new RequisitionChangeDecisionRepository())->decide(
                (int)$this->actor['organization_id'],(int)$this->actor['id'],$id,$version,$payload,$key);
            return $this->reply(200,$result);
        });
    }

}
final class RequisitionChangeHttpError extends \RuntimeException
{
    public function __construct(public readonly int $status,public readonly string $errorCode,string $message)
    {parent::__construct($message);}
}
