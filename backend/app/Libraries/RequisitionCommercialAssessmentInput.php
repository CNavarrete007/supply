<?php

declare(strict_types=1);
namespace App\Libraries;

use InvalidArgumentException;

/** R3C2: proposed treatment only, not a supplier/client/PO decision. */
final class RequisitionCommercialAssessmentInput
{
    public const ACTIONS = [
        'obtain_confirmation', 'prepare_requote', 'prepare_formal_amendment',
        'preserve_with_review', 'escalate_manual_review',
    ];
    private static function object(mixed $v):array
    {
        if (!is_array($v) || array_is_list($v)) throw new InvalidArgumentException('Se requiere un objeto JSON.');
        return $v;
    }
    private static function keys(array $v,array $allowed):void
    {
        foreach(array_keys($v) as $k)if(!in_array($k,$allowed,true))
            throw new InvalidArgumentException('Campo no admitido en el plan de conciliación.');
    }
    private static function text(mixed $v,int $max,bool $required=true):?string
    {
        if(!$required && $v===null)return null;
        if(!is_string($v)||preg_match('//u',$v)!==1
            || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$v)===1)
            throw new InvalidArgumentException('Texto inválido.');
        $v=trim($v);
        if(($required&&$v==='')||preg_match_all('/./us',$v)>$max)
            throw new InvalidArgumentException('Texto obligatorio o fuera de límites.');
        return $v===''?null:$v;
    }
    public static function payload(mixed $data):array
    {
        $p=self::object($data);
        self::keys($p,['assessment_version','requisition_version','inventory_sha256','reason','treatments','acknowledge_not_approval']);
        $v=$p['assessment_version']??null;
        $rv=$p['requisition_version']??null;
        if(!is_int($v)||$v<0||$v>999999998||!is_int($rv)||$rv<1||$rv>999999999)
            throw new InvalidArgumentException('Versiones del expediente inválidas.');
        $hash=$p['inventory_sha256']??null;
        if(!is_string($hash)||!preg_match('/^[a-f0-9]{64}$/D',$hash))
            throw new InvalidArgumentException('Se requiere el hash vigente del inventario comercial.');
        if(($p['acknowledge_not_approval']??null)!==true)
            throw new InvalidArgumentException('Se debe reconocer que el plan no autoriza documentos ni aplica revisiones.');
        $treatments=self::object($p['treatments']??null);
        if(count($treatments)<1||count($treatments)>20)
            throw new InvalidArgumentException('Se requiere al menos un tratamiento de impacto.');
        $result=[];
        foreach($treatments as $table=>$item){
            if(!is_string($table)||!preg_match('/^[a-z_]{3,64}$/D',$table))
                throw new InvalidArgumentException('Tipo de dependencia no admitido.');
            $item=self::object($item);self::keys($item,['action','reason','reference']);
            $action=$item['action']??null;
            if(!in_array($action,self::ACTIONS,true))throw new InvalidArgumentException('Tratamiento comercial inválido.');
            $reference=self::text($item['reference']??null,255,false);
            if($action==='preserve_with_review' && $reference===null)
                throw new InvalidArgumentException('Conservar un documento exige una referencia de revisión.');
            $result[$table]=['action'=>$action,'reason'=>self::text($item['reason']??null,2000),'reference'=>$reference];
        }
        ksort($result,SORT_STRING);
        return ['assessment_version'=>$v,'requisition_version'=>$rv,'inventory_sha256'=>$hash,
            'reason'=>self::text($p['reason']??null,4000),'treatments'=>$result,'acknowledge_not_approval'=>true];
    }
    public static function matchInventory(array $payload,array $inventory):void
    {
        if(!hash_equals($inventory['inventory_sha256'],$payload['inventory_sha256']))
            throw new RequisitionChangeStale('El inventario comercial cambió; consulta y evalúa de nuevo.');
        $present=[];
        foreach($inventory['dependencies'] as $table=>$summary){
            if((int)$summary['count']>0)$present[]=$table;
        }
        sort($present,SORT_STRING);
        $given=array_keys($payload['treatments']);sort($given,SORT_STRING);
        if($present!==$given)
            throw new InvalidArgumentException('Registra un tratamiento para cada tipo de dependencia presente, sin agregar otros.');
    }
}
