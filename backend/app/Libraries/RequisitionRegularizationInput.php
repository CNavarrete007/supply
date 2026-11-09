<?php

declare(strict_types=1);
namespace App\Libraries;

use InvalidArgumentException;

/**
 * Contract for the legacy "Sin requisición / Regularización" workflow.
 * This increment only accepts PDF/JPEG/PNG/WebP evidence, matching the
 * existing RF1 private storage validator. DOC/DOCX require a separate vetted
 * document-scanning/storage contract before they can be enabled.
 */
final class RequisitionRegularizationInput
{
    public const METHODS=['formal','po','email','portal','contract','management','emergency','other'];

    private static function text(mixed $value,int $max,bool $required):?string
    {
        if(($value===null||$value==='')&&!$required)return null;
        if(!is_string($value)||!preg_match('//u',$value))throw new InvalidArgumentException('Texto inválido.');
        $value=trim($value);
        if(($required&&$value==='')||preg_match_all('/./us',$value)>$max||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value))
            throw new InvalidArgumentException('Referencia u observaciones inválidas.');
        return $value===''?null:$value;
    }

    public static function payload(mixed $data):array
    {
        if(!is_array($data)||array_is_list($data))throw new InvalidArgumentException('Se requiere información de regularización.');
        foreach(array_keys($data) as $key)if(!in_array($key,['method','date','reference','notes','evidence'],true))
            throw new InvalidArgumentException('Campo no admitido: '.$key);
        $method=$data['method']??null;
        if(!in_array($method,self::METHODS,true))throw new InvalidArgumentException('Método de regularización inválido.');
        $date=RequisitionRecoveryInput::date($data['date']??null);
        $reference=self::text($data['reference']??null,255,true);
        $notes=self::text($data['notes']??null,16000,false);
        $evidence=$data['evidence']??null;
        if($evidence===null){
            if($method!=='contract')throw new InvalidArgumentException('Adjunta evidencia para cerrar la regularización.');
        }else{
            if(!is_array($evidence)||array_is_list($evidence)||count($evidence)!==2||!array_key_exists('name',$evidence)||!array_key_exists('data',$evidence))
                throw new InvalidArgumentException('Evidencia inválida: utiliza name y data.');
            $name=self::text($evidence['name'],500,true);
            $encoded=$evidence['data'];
            if(!is_string($encoded)||strlen($encoded)>ceil(RequisitionRecoveryInput::FILE_LIMIT/3)*4+4)
                throw new InvalidArgumentException('Archivo demasiado grande.');
            $bytes=base64_decode($encoded,true);
            if($bytes===false||strlen($bytes)<1||strlen($bytes)>RequisitionRecoveryInput::FILE_LIMIT)
                throw new InvalidArgumentException('Evidencia vacía o demasiado grande.');
            $mime=(new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
            if(!in_array($mime,['application/pdf','image/png','image/jpeg','image/webp'],true))
                throw new InvalidArgumentException('Este incremento admite PDF, PNG, JPEG o WebP.');
            if($mime==='application/pdf'&&!str_starts_with($bytes,'%PDF-'))
                throw new InvalidArgumentException('PDF inválido.');
            if($mime!=='application/pdf'&&@getimagesizefromstring($bytes)===false)
                throw new InvalidArgumentException('Imagen inválida.');
            $evidence=['name'=>$name,'mime'=>$mime,'size'=>strlen($bytes),'sha256'=>hash('sha256',$bytes),'bytes'=>$bytes];
        }
        return ['method'=>$method,'date'=>$date,'reference'=>$reference,'notes'=>$notes,'evidence'=>$evidence];
    }

    public static function snapshot(array $data):array
    {
        if(isset($data['evidence']['bytes']))unset($data['evidence']['bytes']);
        return $data;
    }
}
