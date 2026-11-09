<?php

declare(strict_types=1);
namespace App\Libraries;

use InvalidArgumentException;

/** R3A/R3C intake validation; never applies commercial changes here. */
final class RequisitionChangeInput
{
    public const SOURCES = [
        'Correo del cliente', 'PO / OC modificada del cliente', 'Orden de Servicio revisada',
        'Portal del cliente', 'Minuta', 'Llamada confirmada por escrito', 'Otro'
    ];
    public const TYPES = [
        'Cambio de cantidad', 'Eliminación de partida', 'Agregar partida',
        'Cambio de especificación', 'Cambio de fecha requerida',
        'Cambio de lugar de entrega', 'Cambio de alcance', 'Otro'
    ];

    private static function keys(array $data, array $allowed): void
    {
        foreach (array_keys($data) as $key) {
            if (!in_array($key, $allowed, true)) {
                throw new InvalidArgumentException('Campo de cambio no admitido: '.$key);
            }
        }
    }
    private static function object(mixed $value, string $message): array
    {
        if (!is_array($value) || array_is_list($value)) throw new InvalidArgumentException($message);
        return $value;
    }
    private static function text(mixed $value, int $max, bool $required = false): ?string
    {
        if (($value === null || $value === '') && !$required) return null;
        if (!is_string($value) || !preg_match('//u', $value)) throw new InvalidArgumentException('Texto inválido.');
        $v = trim($value);
        if (($required && $v === '') || preg_match_all('/./us', $v)>$max || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', $v)) {
            throw new InvalidArgumentException('Texto requerido o fuera de límites.');
        }
        return $v === '' ? null : $v;
    }
    public static function withdraw(mixed $value): array
    {
        $v = self::object($value,'Se requiere motivo de retiro.');
        self::keys($v,['reason']);
        return ['reason'=>self::text($v['reason']??null,16000,true)];
    }
    public static function payload(mixed $value): array
    {
        $v = self::object($value,'Se requiere una solicitud de modificación.');
        self::keys($v,['date','requested_by','source','change_type','reference','reason','header','items']);
        if (!in_array($v['source']??null,self::SOURCES,true)) throw new InvalidArgumentException('Origen del cambio no válido.');
        if (!in_array($v['change_type']??null,self::TYPES,true)) throw new InvalidArgumentException('Tipo de cambio no válido.');
        $rawHeader=$v['header']??[];
        $header=$rawHeader===[]?[]:self::object($rawHeader,'Datos generales de cambio inválidos.');
        self::keys($header,['need_date','delivery_place']);
        $normalizedHeader=[];
        if(array_key_exists('need_date',$header)) $normalizedHeader['need_date']=RequisitionRecoveryInput::date($header['need_date']);
        if(array_key_exists('delivery_place',$header)) $normalizedHeader['delivery_place']=self::text($header['delivery_place'],16000,true);
        $items=$v['items']??[];
        if(!is_array($items)||!array_is_list($items)||count($items)>100) throw new InvalidArgumentException('Se admiten hasta 100 partidas por solicitud.');
        $normalizedItems=[];$seen=[];$additions=0;
        foreach($items as $i=>$item){
            $it=self::object($item,'Partida de modificación inválida.');
            self::keys($it,['action','id','description','quantity','unit','category']);
            $action=$it['action']??null;
            if(!in_array($action,['modify','cancel','add'],true)) throw new InvalidArgumentException('Acción de partida no admitida.');
            if($action==='add'){
                if(count($it)!==5 || array_key_exists('id',$it))
                    throw new InvalidArgumentException('Una partida nueva debe indicar action, descripción, cantidad, unidad y categoría, sin id.');
                if(++$additions>20)throw new InvalidArgumentException('Máximo 20 partidas nuevas por solicitud.');
                $normalizedItems[]=['action'=>'add',
                    'description'=>self::text($it['description']??null,16000,true),
                    'quantity'=>RequisitionRecoveryInput::decimal($it['quantity']??null),
                    'unit'=>self::text($it['unit']??null,128,true),
                    'category'=>self::text($it['category']??null,255,true)];
                continue;
            }
            $id=$it['id']??null;
            if(!is_string($id)||!RequisitionRecoveryInput::uuid($id)||isset($seen[strtolower($id)])) throw new InvalidArgumentException('Identificador de partida inválido o duplicado.');
            $seen[strtolower($id)]=true;
            if($action==='cancel'){
                if(count($it)!==2)throw new InvalidArgumentException('Para cancelar una partida solo indica action e id.');
                $normalizedItems[]=['action'=>'cancel','id'=>strtolower($id)];
            }else{
                if(count($it)!==6)throw new InvalidArgumentException('Una modificación debe incluir descripción, cantidad, unidad y categoría.');
                $normalizedItems[]=['action'=>'modify','id'=>strtolower($id),
                    'description'=>self::text($it['description']??null,16000,true),
                    'quantity'=>RequisitionRecoveryInput::decimal($it['quantity']??null),
                    'unit'=>self::text($it['unit']??null,128,true),
                    'category'=>self::text($it['category']??null,255,true)];
            }
        }
        if(!$normalizedHeader&&!$normalizedItems)throw new InvalidArgumentException('Indica al menos un cambio real.');
        if($v['change_type']==='Agregar partida' && $additions===0)
            throw new InvalidArgumentException('El tipo Agregar partida requiere al menos una alta.');
        if($additions>0&&!in_array($v['change_type'],['Agregar partida','Cambio de alcance'],true))
            throw new InvalidArgumentException('Para agregar partidas selecciona Agregar partida o Cambio de alcance.');
        return ['date'=>RequisitionRecoveryInput::date($v['date']??null),
            'requested_by'=>self::text($v['requested_by']??null,255,true),
            'source'=>$v['source'],'change_type'=>$v['change_type'],
            'reference'=>self::text($v['reference']??null,255),
            'reason'=>self::text($v['reason']??null,16000,true),
            'header'=>$normalizedHeader,'items'=>$normalizedItems];
    }
}
