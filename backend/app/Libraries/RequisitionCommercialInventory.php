<?php

declare(strict_types=1);
namespace App\Libraries;

use mysqli;

/**
 * Read-only R3C2 document inventory. Hashes complete selected SQL rows (including
 * financial status/versions), but publishes ONLY counts + digests, no private data.
 * A digest is a point-in-time assessment, NOT a lock or commercial approval.
 */
final class RequisitionCommercialInventory
{
    public const TABLES=[
        'sourcing_plans','rfqs','supplier_quotes','customer_quotes',
        'customer_quote_versions','requisition_reviews','awards','invoices',
        'service_orders','purchase_order_requisitions','delivery_items',
        'purchase_orders','goods_receipts',
    ];
    private const ROW_LIMIT=200;
    private const MAX_BYTES=16777216;
    private static function serializeRows(array $rows):string
    {
        foreach($rows as &$r){
            foreach($r as &$value){
                if(is_string($value) && preg_match('//u',$value)!==1)
                    $value=['binary_sha256'=>hash('sha256',$value),'bytes'=>strlen($value)];
            }unset($value);
        }unset($r);
        return json_encode($rows,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    }
    private static function sql(string $table):string
    {
        if($table==='purchase_orders')return <<<'SQL'
            SELECT po.* FROM purchase_orders po
            JOIN purchase_order_requisitions por ON por.purchase_order_id=po.id AND por.organization_id=po.organization_id
            WHERE por.organization_id=? AND por.requisition_id=? ORDER BY po.id LIMIT 201
            SQL;
        if($table==='goods_receipts')return <<<'SQL'
            SELECT gr.* FROM goods_receipts gr
            JOIN purchase_order_requisitions por ON por.purchase_order_id=gr.purchase_order_id AND por.organization_id=gr.organization_id
            WHERE por.organization_id=? AND por.requisition_id=? ORDER BY gr.id LIMIT 201
            SQL;
        if(!in_array($table,self::TABLES,true))throw new \LogicException('Unexpected dependency table.');
        $order=$table==='purchase_order_requisitions'?'purchase_order_id,requisition_id':'id';
        return 'SELECT * FROM `'.$table.'` WHERE organization_id=? AND requisition_id=? ORDER BY '.$order.' LIMIT 201';
    }
    public static function read(mysqli $db,int $org,int $req):array
    {
        $dependencies=[];$totalBytes=0;
        foreach(self::TABLES as $table){
            $stmt=$db->prepare(self::sql($table));
            try{
                $stmt->bind_param('ii',$org,$req);
                $stmt->execute();$rows=$stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            }finally{$stmt->close();}
            if(count($rows)>self::ROW_LIMIT)
                throw new RequisitionChangeConflict('IMPACT_TOO_LARGE','Inventario comercial demasiado grande para conciliación automática.');
            $normalized=self::serializeRows($rows);$totalBytes+=strlen($normalized);
            if($totalBytes>self::MAX_BYTES)
                throw new RequisitionChangeConflict('IMPACT_TOO_LARGE','Inventario comercial excede el límite del expediente.');
            $dependencies[$table]=['count'=>count($rows),'content_sha256'=>hash('sha256',$normalized)];
        }
        $fingerprint=hash('sha256',json_encode($dependencies,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES));
        $has=false;foreach($dependencies as $summary)if($summary['count']>0){$has=true;break;}
        return ['dependencies'=>$dependencies,'inventory_sha256'=>$fingerprint,
            'has_downstream_dependencies'=>$has,'informational_only'=>true,
            'commercial_documents_modified'=>false,'can_apply_revision'=>false];
    }
}
