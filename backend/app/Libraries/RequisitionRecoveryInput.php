<?php

declare(strict_types=1);
namespace App\Libraries;

use DateTimeImmutable;
use InvalidArgumentException;

/** RF1: field contract derived from the supplied Apps Script, not the v0.7 draft form. */
final class RequisitionRecoveryInput
{
    public const FORMAL = 'Requisición formal del cliente';
    public const SOURCES = [self::FORMAL,'Correo del cliente','Solicitud verbal / llamada','WhatsApp / mensaje','Portal del cliente','PO directa del cliente','Emergencia / autorización verbal','Otro'];
    public const FILE_LIMIT = 8388608; // Local pilot transport limit; NOT a legacy business rule.

    public static function uuid(string $value): bool
    {
        return preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/Di', $value) === 1;
    }
    private static function keys(array $value, array $allowed): void
    {
        foreach (array_keys($value) as $key) if (!in_array($key, $allowed, true)) throw new InvalidArgumentException('Campo no admitido: '.$key);
    }
    private static function text(mixed $value, int $max, bool $required = false): ?string
    {
        if (($value === null || $value === '') && !$required) return null;
        if (!is_string($value) || !preg_match('//u', $value)) throw new InvalidArgumentException('Texto inválido.');
        $v = trim($value);
        if (($required && $v === '') || preg_match_all('/./us', $v) > $max || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', $v)) throw new InvalidArgumentException('Texto requerido o demasiado largo.');
        return $v === '' ? null : $v;
    }
    public static function date(mixed $value, bool $required = true): ?string
    {
        if (($value === null || $value === '') && !$required) return null;
        if (!is_string($value) || !preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D', $value)) throw new InvalidArgumentException('Fecha inválida.');
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$d || $d->format('Y-m-d') !== $value || substr($value,0,4) < '1000') throw new InvalidArgumentException('Fecha inválida.');
        return $value;
    }
    public static function decimal(mixed $v, bool $optional = false): ?string
    {
        if (($v === null || $v === '') && $optional) return null;
        if (!is_string($v) || !preg_match('/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/D',$v)) throw new InvalidArgumentException('Utiliza un número sin separadores y con hasta seis decimales.');
        if (!$optional && preg_match('/^0(?:\.0+)?$/D',$v)) throw new InvalidArgumentException('La cantidad debe ser mayor a cero.');
        return $v;
    }
    public static function payload(mixed $v): array
    {
        if (!is_array($v) || array_is_list($v)) throw new InvalidArgumentException('Se requiere una requisición.');
        self::keys($v,['folio','client_id','request_date','need_date','project','contract','client_reference','priority','delivery_place','requester_name','requester_email','budget','currency','description','notes','items','source','document']);
        $client = self::text($v['client_id']??null,36,true);
        if (!self::uuid($client)) throw new InvalidArgumentException('Selecciona un cliente válido para guardar la requisición.');
        $email = self::text($v['requester_email']??null,254,true);
        if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/uD', $email)) throw new InvalidArgumentException('Captura un correo válido del solicitante.');
        $priority=$v['priority']??'normal';$currency=$v['currency']??'MXN';
        if (!in_array($priority,['normal','high','urgent'],true) || !in_array($currency,['MXN','USD','EUR'],true)) throw new InvalidArgumentException('Prioridad o moneda no válida.');
        $source=$v['source']??null;
        if (!is_array($source) || array_is_list($source)) throw new InvalidArgumentException('Captura el origen documental de la solicitud.');
        self::keys($source,['type','date','reference','notes','requirement','due_date','owner']);
        $type=$source['type']??null;
        if (!in_array($type,self::SOURCES,true)) throw new InvalidArgumentException('Tipo de entrada no válido.');
        $provisional=$type!==self::FORMAL;
        $requirement=$source['requirement']??'formal';
        if (!in_array($requirement,['formal','alternative','contract'],true)) throw new InvalidArgumentException('Regularización requerida no válida.');
        $source=[
            'type'=>$type, 'date'=>self::date($source['date']??null),
            'reference'=>self::text($source['reference']??null,255,$provisional),
            'notes'=>self::text($source['notes']??null,16000),
            'requirement'=>$provisional?$requirement:'none',
            'due_date'=>$provisional?self::date($source['due_date']??null,$requirement!=='contract'):null,
            'owner'=>$provisional?self::text($source['owner']??null,255):null,
        ];
        $items=$v['items']??null;
        if (!is_array($items) || !array_is_list($items) || count($items)<1 || count($items)>1000) throw new InvalidArgumentException('Agrega al menos una partida. Límite técnico de este piloto: 1000.');
        $lines=[];$seen=[];
        foreach($items as $item){
            if(!is_array($item)||array_is_list($item))throw new InvalidArgumentException('Partida inválida.');
            self::keys($item,['id','description','quantity','unit','category']);
            $id=self::text($item['id']??null,36);
            if($id!==null&&(!self::uuid($id)||isset($seen[$id])))throw new InvalidArgumentException('Identificador de partida inválido o duplicado.');
            if($id!==null)$seen[$id]=true;
            $lines[]=['id'=>$id,'description'=>self::text($item['description']??null,16000,true),'quantity'=>self::decimal($item['quantity']??null),'unit'=>self::text($item['unit']??null,128,true),'category'=>self::text($item['category']??null,255,true)];
        }
        $document=$v['document']??null;
        if($document!==null){
            if(!is_array($document)||array_is_list($document))throw new InvalidArgumentException('Archivo inválido.');
            if(isset($document['id'])){
                self::keys($document,['id']);if(!self::uuid((string)$document['id']))throw new InvalidArgumentException('Archivo inválido.');
            }else{
                self::keys($document,['name','data']);
                $name=self::text($document['name']??null,500,true);
                if(!is_string($document['data']??null)||strlen($document['data'])>ceil(self::FILE_LIMIT/3)*4)throw new InvalidArgumentException('El límite técnico local del adjunto es 8 MiB.');
                $bytes=base64_decode($document['data'],true);
                if($bytes===false||strlen($bytes)<1||strlen($bytes)>self::FILE_LIMIT)throw new InvalidArgumentException('No se pudo leer el archivo.');
                $mime=(new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
                if(!in_array($mime,['application/pdf','image/png','image/jpeg','image/webp'],true))throw new InvalidArgumentException('Adjunta un PDF o una imagen PNG, JPEG o WebP.');
                if($mime==='application/pdf'&&!str_starts_with($bytes,'%PDF-'))throw new InvalidArgumentException('PDF inválido.');
                if($mime!=='application/pdf'&&@getimagesizefromstring($bytes)===false)throw new InvalidArgumentException('Imagen inválida.');
                $document=['name'=>$name,'mime'=>$mime,'sha256'=>hash('sha256',$bytes),'size'=>strlen($bytes),'bytes'=>$bytes];
            }
        }
        return ['folio'=>self::text($v['folio']??null,128,true),'client_id'=>$client,
            'request_date'=>self::date($v['request_date']??null),'need_date'=>self::date($v['need_date']??null),
            'project'=>self::text($v['project']??null,255,true),'contract'=>self::text($v['contract']??null,255,true),
            'client_reference'=>self::text($v['client_reference']??null,255),'priority'=>$priority,
            'delivery_place'=>self::text($v['delivery_place']??null,16000,true),
            'requester_name'=>self::text($v['requester_name']??null,255,true),'requester_email'=>$email,
            'budget'=>self::decimal($v['budget']??null,true),'currency'=>$currency,
            'description'=>self::text($v['description']??null,16000),'notes'=>self::text($v['notes']??null,16000),
            'source'=>$source,'items'=>$lines,'document'=>$document];
    }
    public static function snapshot(array $data): array
    {
        if(isset($data['document']['bytes']))unset($data['document']['bytes']);
        return $data;
    }
    public static function cleanFolioPart(string $text): string
    {
        if(class_exists(\Normalizer::class))$text=preg_replace('/[\x{0300}-\x{036f}]/u','',\Normalizer::normalize($text,\Normalizer::FORM_D))??$text;
        $text=strtr($text,['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n','ü'=>'u','Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N','Ü'=>'U']);
        return trim((string)preg_replace('/[^A-Z0-9]+/','-',strtoupper(trim($text))),'-');
    }
}
