<?php

declare(strict_types=1);
namespace App\Libraries;

use InvalidArgumentException;

/** R3C3: strict evidence-attestation input. No quotation/PO issuance via this interface. */
final class RequisitionCommercialExecutionInput
{
    public const ACTIONS = [
        'rfqs'=>['supplier_contact_documented'=>'obtain_confirmation'],
        'supplier_quotes'=>['supplier_confirmation_documented'=>'obtain_confirmation'],
        'customer_quote_versions'=>[
            'client_confirmation_documented'=>'obtain_confirmation',
            'replacement_quote_verified'=>'prepare_requote',
        ],
        'purchase_orders'=>['formal_amendment_verified'=>'prepare_formal_amendment'],
    ];
    public const SUCCESSORS=['replacement_quote_verified','formal_amendment_verified'];

    private static function obj(mixed $value):array
    {
        if(!is_array($value)||array_is_list($value))throw new InvalidArgumentException('Se requiere un objeto JSON.');
        return $value;
    }
    private static function keys(array $data,array $allowed):void
    {
        foreach(array_keys($data) as $key)if(!in_array($key,$allowed,true))
            throw new InvalidArgumentException('Campo no admitido en evidencia comercial.');
    }
    private static function text(mixed $value,int $max):string
    {
        if(!is_string($value)||preg_match('//u',$value)!==1||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$value)===1)
            throw new InvalidArgumentException('Texto comercial inválido.');
        $s=trim($value);
        if($s===''||preg_match_all('/./us',$s)>$max)throw new InvalidArgumentException('Texto comercial obligatorio o demasiado largo.');
        return $s;
    }
    private static function uuid(mixed $value):string
    {
        if(!is_string($value)||!RequisitionRecoveryInput::uuid($value))
            throw new InvalidArgumentException('Identificador público UUID inválido.');
        return strtolower($value);
    }
    private static function context(array $data):array
    {
        $av=$data['assessment_version']??null;$rv=$data['requisition_version']??null;
        $sha=$data['inventory_sha256']??null;
        if(!is_int($av)||$av<1||$av>999999998||!is_int($rv)||$rv<1||$rv>999999999)
            throw new InvalidArgumentException('Versiones de conciliación inválidas.');
        if(!is_string($sha)||preg_match('/^[a-f0-9]{64}$/D',$sha)!==1)
            throw new InvalidArgumentException('Huella de inventario inválida.');
        return ['assessment_version'=>$av,'requisition_version'=>$rv,'inventory_sha256'=>$sha];
    }
    public static function record(mixed $data):array
    {
        $p=self::obj($data);
        self::keys($p,['assessment_version','requisition_version','inventory_sha256','document_kind',
            'document_id','action','successor_id','evidence_file_id','reference','reason','acknowledge_no_document_mutation']);
        $kind=$p['document_kind']??null;$action=$p['action']??null;
        if(!is_string($kind)||!isset(self::ACTIONS[$kind])||!is_string($action)||!isset(self::ACTIONS[$kind][$action]))
            throw new InvalidArgumentException('Acción comercial y tipo de documento incompatibles.');
        $hasSuccessor=in_array($action,self::SUCCESSORS,true);
        $successor=$p['successor_id']??null;
        if($hasSuccessor && $successor===null)throw new InvalidArgumentException('La nueva versión requiere identificador de sucesora.');
        if(!$hasSuccessor && $successor!==null)throw new InvalidArgumentException('Esta acción no admite documento sucesor.');
        if(($p['acknowledge_no_document_mutation']??null)!==true)
            throw new InvalidArgumentException('Debe reconocerse que no se emiten ni modifican documentos comerciales.');
        $document=self::uuid($p['document_id']??null);
        $next=$successor!==null?self::uuid($successor):null;
        if($next!==null && $document===$next)throw new InvalidArgumentException('Documento sucesor idéntico al original.');
        return [...self::context($p),'document_kind'=>$kind,'document_id'=>$document,'action'=>$action,
            'successor_id'=>$next,'evidence_file_id'=>self::uuid($p['evidence_file_id']??null),
            'reference'=>self::text($p['reference']??null,255),'reason'=>self::text($p['reason']??null,2000),
            'acknowledge_no_document_mutation'=>true];
    }
    public static function review(mixed $data):array
    {
        $p=self::obj($data);
        self::keys($p,['assessment_version','requisition_version','inventory_sha256','decision','reason',
            'acknowledge_evidence_only']);
        $decision=$p['decision']??null;
        if(!in_array($decision,['verified','rejected'],true))
            throw new InvalidArgumentException('Decisión de evidencia inválida.');
        if(($p['acknowledge_evidence_only']??null)!==true)
            throw new InvalidArgumentException('La decisión no puede aprobar documentos comerciales ni la requisición.');
        return [...self::context($p),'decision'=>$decision,'reason'=>self::text($p['reason']??null,2000),
            'acknowledge_evidence_only'=>true];
    }
    public static function checkTreatment(array $assessment,string $kind,string $action):void
    {
        $expected=self::ACTIONS[$kind][$action]??null;
        if($expected===null||($assessment['treatments'][$kind]['action']??null)!==$expected)
            throw new RequisitionChangeConflict('TREATMENT_MISMATCH','La acción no corresponde al tratamiento vigente de R3C2.');
    }
}
