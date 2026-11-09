<?php

declare(strict_types=1);
namespace App\Libraries;

/** Pure application planner for persisted R3A and R3C before/after snapshots. */
final class RequisitionChangeApplication
{
    private static function decimal(mixed $value): string
    {
        if(!is_string($value)||!preg_match('/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/D',$value))
            throw new RequisitionChangeConflict('BAD_SNAPSHOT','Cantidad histórica inválida.');
        return str_contains($value,'.') ? (rtrim(rtrim($value,'0'),'.')?:'0') : $value;
    }
    private static function validText(mixed $s,int $max): bool
    {
        return is_string($s)&&trim($s)!==''&&preg_match('//u',$s)===1&&preg_match_all('/./us',$s)<=$max
            &&preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$s)!==1;
    }
    /** @return array{header:array, items:array, before:array, active_after:int} */
    public static function plan(array $header,array $items,array $changes):array
    {
        if(count($changes)===0||count($changes)>102)throw new RequisitionChangeConflict('BAD_SNAPSHOT','Sin cambios válidos.');
        $by=[];$active=0;
        foreach($items as $item){
            $id=strtolower((string)($item['public_id']??''));
            if(!RequisitionRecoveryInput::uuid($id)||isset($by[$id]))throw new RequisitionChangeConflict('BAD_SNAPSHOT','Partidas inconsistentes.');
            $by[$id]=$item;
            if(($item['line_status']??null)==='active')$active++;
        }
        $diffHeader=[];$diffItems=[];$seen=[];$before=[];
        foreach($changes as $change){
            $schema=(int)($change['snapshot_schema_version']??0);
            $isAdd=($change['target_kind']??null)==='item' && ($change['change_kind']??null)==='add';
            if(($schema!==1 && $schema!==2) || ($schema===2)!==$isAdd || ($change['resolution_status']??null)!=='proposed')
                throw new RequisitionChangeConflict('BAD_SNAPSHOT','El cambio no es una propuesta R3A/R3C intacta.');
            $prior=json_decode((string)($change['before_snapshot']??''),true);
            $next=json_decode((string)($change['after_snapshot']??''),true);
            if(!is_array($prior)||!is_array($next)||array_is_list($prior)||array_is_list($next))
                throw new RequisitionChangeConflict('BAD_SNAPSHOT','Diferencias dañadas.');
            if($change['target_kind']==='header'){
                $field=$change['field_code'];
                if(!in_array($field,['need_date','delivery_place'],true)||isset($seen['h:'.$field])||($change['change_kind']??null)!=='modify'
                    ||!array_key_exists('value',$prior)||!array_key_exists('value',$next))
                    throw new RequisitionChangeConflict('BAD_SNAPSHOT','Campo de cabecera inesperado.');
                if(($header[$field]??null)!==$prior['value'])throw new RequisitionChangeStale('La cabecera ya no coincide con la propuesta.');
                if($field==='need_date'){
                    try{RequisitionRecoveryInput::date($next['value']);}catch(\InvalidArgumentException){throw new RequisitionChangeConflict('BAD_SNAPSHOT','Fecha de propuesta inválida.');}
                }elseif(!self::validText($next['value'],16000))throw new RequisitionChangeConflict('BAD_SNAPSHOT','Lugar inválido.');
                if($prior['value']===$next['value'])throw new RequisitionChangeConflict('BAD_SNAPSHOT','El cambio no contiene diferencias.');
                $seen['h:'.$field]=true;$diffHeader[$field]=$next['value'];$before[]=['kind'=>'header','field'=>$field,'value'=>$prior['value']];
            }elseif($change['target_kind']==='item'){
                if($isAdd){
                    if(($change['requisition_item_id']??null)!==null || ($change['field_code']??null)!==null ||
                        count($prior)!==1 || ($prior['status']??null)!=='not_created' || count($next)!==5 ||
                        !isset($next['id'],$next['description'],$next['quantity'],$next['unit'],$next['category']) ||
                        !RequisitionRecoveryInput::uuid((string)$next['id']) ||
                        !self::validText($next['description'],16000) || !self::validText($next['unit'],128) ||
                        !self::validText($next['category'],255) || ($change['requires_sourcing']??null)===null ||
                        (int)$change['requires_sourcing']!==1)
                        throw new RequisitionChangeConflict('BAD_SNAPSHOT','Propuesta de alta inválida.');
                    $pub=strtolower($next['id']);
                    if(isset($seen['new:'.$pub])||isset($by[$pub]))
                        throw new RequisitionChangeConflict('BAD_SNAPSHOT','Identificador nuevo duplicado.');
                    $qty=(string)$next['quantity'];
                    if(self::decimal($qty)==='0')throw new RequisitionChangeConflict('BAD_SNAPSHOT','Cantidad de alta debe ser positiva.');
                    $changeItemId=$change['id']??null;
                    if(!ctype_digit((string)$changeItemId) || (int)$changeItemId<1)
                        throw new RequisitionChangeConflict('BAD_SNAPSHOT','Falta la identidad persistida de la propuesta de alta.');
                    $seen['new:'.$pub]=true;
                    $diffItems[]=['db_id'=>null,'change_item_id'=>(int)$changeItemId,
                        'public_id'=>$pub,'action'=>'add',
                        'patch'=>['description'=>$next['description'],'quantity'=>$qty,
                            'unit_label'=>$next['unit'],'category_label_snapshot'=>$next['category']],
                        'original'=>null];
                    $before[]=['kind'=>'item','item'=>$prior];
                    $active++;
                    continue;
                }
                $itemId=(string)($change['requisition_item_id']??'');
                $line=null;foreach($by as $found){if((string)$found['id']===$itemId){$line=$found;break;}}
                if(!$line || ($line['line_status']??null)!=='active' || isset($seen['i:'.$itemId]))
                    throw new RequisitionChangeStale('Una partida cambió o fue retirada.');
                $pub=strtolower((string)$line['public_id']);
                if(strtolower((string)($prior['id']??''))!==$pub || strtolower((string)($next['id']??''))!==$pub ||
                    ($prior['description']??null)!==$line['description'] ||
                    ($prior['unit']??null)!==$line['unit_label'] ||
                    ($prior['category']??null)!==$line['category_label_snapshot'] ||
                    self::decimal((string)($prior['quantity']??''))!==self::decimal((string)$line['quantity']))
                    throw new RequisitionChangeStale('El contenido actual de la partida no coincide con el historial de la solicitud.');
                $action=$change['change_kind']??null;
                if($action==='cancel'){
                    if(($next['status']??null)!=='cancelled'||count($next)!==2)
                        throw new RequisitionChangeConflict('BAD_SNAPSHOT','Cancelación incoherente.');
                    $active--; $patch=['line_status'=>'cancelled'];
                }elseif($action==='modify'){
                    if(!self::validText($next['description']??null,16000)||!self::validText($next['unit']??null,128)
                        ||!self::validText($next['category']??null,255))
                        throw new RequisitionChangeConflict('BAD_SNAPSHOT','Partida inválida.');
                    $qty=(string)($next['quantity']??'');
                    if(self::decimal($qty)==='0')throw new RequisitionChangeConflict('BAD_SNAPSHOT','Cantidad debe ser positiva.');
                    $patch=['description'=>$next['description'],'quantity'=>$qty,'unit_label'=>$next['unit'],
                        'category_label_snapshot'=>$next['category']];
                    if($patch['description']===$line['description']&&self::decimal($qty)===self::decimal((string)$line['quantity'])
                        &&$patch['unit_label']===$line['unit_label']&&$patch['category_label_snapshot']===$line['category_label_snapshot'])
                        throw new RequisitionChangeConflict('BAD_SNAPSHOT','Cambio sin diferencias.');
                }else throw new RequisitionChangeConflict('BAD_SNAPSHOT','Acción de partida no admitida.');
                $seen['i:'.$itemId]=true;
                $diffItems[]=['db_id'=>$itemId,'public_id'=>$pub,'action'=>$action,'patch'=>$patch,'original'=>$line];
                $before[]=['kind'=>'item','item'=>$prior];
            }else throw new RequisitionChangeConflict('BAD_SNAPSHOT','Tipo de modificación no admitido.');
        }
        if($active<1)throw new RequisitionChangeConflict('LAST_LINE','No es posible cancelar todas las partidas activas.');
        return ['header'=>$diffHeader,'items'=>$diffItems,'before'=>$before,'active_after'=>$active];
    }
}
