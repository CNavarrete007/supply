<?php

declare(strict_types=1);
namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use RuntimeException;
use Throwable;

/**
 * R3A/R3C change-request intake only. Never updates requisition headers, items,
 * customer quotes, RFQs, POs, receipts or invoice business state.
 */
final class RequisitionChangeRepository
{
    private mysqli $db;
    private bool $owns;

    public function __construct(?mysqli $testConnection=null)
    {
        $this->owns=$testConnection===null;
        if($testConnection!==null){
            if(PHP_SAPI!=='cli')throw new RuntimeException('TEST_CONNECTION_FORBIDDEN');
            $this->db=$testConnection;return;
        }
        $user=(string)getenv('RECOVERY_DB_USERNAME');
        $path=(string)getenv('RECOVERY_DB_PASSWORD_FILE');
        if($user!=='supplyflow_recovery_local'||$path!=='/run/secrets/recovery_db_password'||!is_readable($path))
            throw new RuntimeException('RECOVERY_NOT_PROVISIONED');
        $password=trim((string)file_get_contents($path));
        if(!preg_match('/^[a-f0-9]{64}$/D',$password))throw new RuntimeException('RECOVERY_CREDENTIAL_INVALID');
        mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
        try{$this->db=new mysqli('db',$user,$password,'supplyflow_dev',3306);SessionContract::initialize($this->db,'supplyflow_dev');}
        finally{unset($password);}
    }
    public function __destruct(){if($this->owns&&isset($this->db))$this->db->close();}
    private function rows(string $sql,array $args=[]):array
    {
        $s=$this->db->prepare($sql);
        try{if($args)$s->bind_param(str_repeat('s',count($args)),...$args);$s->execute();return $s->get_result()->fetch_all(MYSQLI_ASSOC);}
        finally{$s->close();}
    }
    private function one(string $sql,array $args=[]):?array{return $this->rows($sql,$args)[0]??null;}
    private function run(string $sql,array $args=[]):int
    {
        $s=$this->db->prepare($sql);
        try{if($args)$s->bind_param(str_repeat('s',count($args)),...$args);$s->execute();return $s->affected_rows;}
        finally{$s->close();}
    }
    private function insert(string $table,array $values):int
    {
        $this->run('INSERT INTO `'.$table.'` (`'.implode('`,`',array_keys($values)).'`) VALUES ('.implode(',',array_fill(0,count($values),'?')).')',array_values($values));
        return (int)$this->db->insert_id;
    }
    private function update(string $table,array $values,string $where,array $args):int
    {
        return $this->run('UPDATE `'.$table.'` SET '.implode(',',array_map(static fn($k)=>'`'.$k.'`=?',array_keys($values))).' WHERE '.$where,[...array_values($values),...$args]);
    }
    private static function uuid():string{$v=bin2hex(random_bytes(16));$v[12]='4';$v[16]=dechex((hexdec($v[16])&3)|8);return substr($v,0,8).'-'.substr($v,8,4).'-'.substr($v,12,4).'-'.substr($v,16,4).'-'.substr($v,20);}
    private static function now():string{return gmdate('Y-m-d H:i:s');}
    private static function json(mixed $value):string{return json_encode($value,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}
    private static function normDecimal(string $v):string{return str_contains($v,'.')?(rtrim(rtrim($v,'0'),'.')?:'0'):$v;}

    /** Read only RF1-owned, non-imported records created by this Master Admin. */
    private static function ownedJoin():string{return <<<'SQL'
        FROM requisition_change_requests cr
        JOIN business_entities ce ON ce.id=cr.id AND ce.organization_id=cr.organization_id AND ce.entity_kind='requisition_change_request'
        JOIN requisitions r ON r.id=cr.requisition_id AND r.organization_id=cr.organization_id
        JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind='requisition'
        WHERE cr.organization_id=? AND re.imported_at IS NULL AND re.created_by=? AND ce.archived_at IS NULL AND re.archived_at IS NULL
          AND EXISTS(SELECT 1 FROM requisition_revision_snapshots rs WHERE rs.organization_id=r.organization_id
            AND rs.requisition_id=r.id AND rs.provenance='system' AND rs.snapshot_schema_version=2
            AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1')
        SQL;}
    private static function listingHeader():string{return <<<'SQL'
        ce.public_id AS id,ce.row_version AS version,ce.created_at,ce.updated_at,
        re.public_id AS requisition_id,r.folio AS requisition_folio,cr.folio,
        cr.previous_revision_number,cr.new_revision_number,cr.request_date,
        cr.requested_by_snapshot,cr.source_label,cr.change_type,cr.reference_text,
        cr.reason,cr.impact_text,cr.requires_sourcing,cr.requires_supplier_confirmation,cr.status_code
        SQL;}
    private static function format(array $row):array
    {
        foreach(['version','previous_revision_number','new_revision_number'] as $k)$row[$k]=(int)$row[$k];
        foreach(['requires_sourcing','requires_supplier_confirmation'] as $k)$row[$k]=(bool)$row[$k];
        return $row;
    }
    public function listing(int $org,int $actor,?string $requisitionPublic=null):array
    {
        $sql='SELECT '.self::listingHeader().' '.self::ownedJoin();$args=[$org,$actor];
        if($requisitionPublic!==null){$sql.=' AND re.public_id=?';$args[]=$requisitionPublic;}
        $sql.=' ORDER BY cr.id DESC LIMIT 251';
        $rows=$this->rows($sql,$args);$truncated=count($rows)>250;
        if($truncated)$rows=array_slice($rows,0,250);
        return ['items'=>array_map(self::format(...),$rows),'returned'=>count($rows),'truncated'=>$truncated,'limit'=>250,'scope'=>'rf1_owned'];
    }
    public function detail(int $org,int $actor,string $public):?array
    {
        $r=$this->one('SELECT cr.id AS db_id,'.self::listingHeader().' '.self::ownedJoin().' AND ce.public_id=?',[$org,$actor,$public]);
        if(!$r)return null;
        $items=$this->rows('SELECT change_ordinal,target_kind,field_code,change_kind,requires_sourcing,before_snapshot,after_snapshot,resolution_status
            FROM requisition_change_items WHERE organization_id=? AND change_request_id=? ORDER BY change_ordinal',[$org,$r['db_id']]);
        foreach($items as &$it){
            $it['change_ordinal']=(int)$it['change_ordinal'];$it['requires_sourcing']=(bool)$it['requires_sourcing'];
            foreach(['before_snapshot','after_snapshot'] as $col)$it[$col]=$it[$col]===null?null:json_decode($it[$col],true,512,JSON_THROW_ON_ERROR);
        }unset($it);
        unset($r['db_id']);return [...self::format($r),'changes'=>$items];
    }
    private function claim(int $org,int $actor,string $endpoint,string $key,string $hash):?array
    {
        $found=$this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys
            WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE',
            [$org,$actor,$endpoint,hash('sha256',$key,true)]);
        if($found){
            if(!hash_equals($hash,$found['request_sha256']))throw new RequisitionChangeConflict('IDEMPOTENCY_CONFLICT','La clave ya fue utilizada para otra solicitud.');
            if($found['state_code']!=='done'||$found['response_json']===null)throw new RequisitionChangeConflict('OPERATION_PENDING','Consulta la solicitud antes de reintentar.');
            $out=json_decode($found['response_json'],true,512,JSON_THROW_ON_ERROR);$out['replayed']=true;return $out;
        }
        $this->insert('idempotency_keys',['organization_id'=>$org,'actor_user_id'=>$actor,'endpoint_code'=>$endpoint,
            'key_sha256'=>hash('sha256',$key,true),'request_sha256'=>$hash,'state_code'=>'pending',
            'created_at'=>self::now(),'expires_at'=>gmdate('Y-m-d H:i:s',time()+86400)]);
        return null;
    }
    private function finished(int $org,int $actor,string $endpoint,string $key,array $response,int $code):void
    {
        if($this->run("UPDATE idempotency_keys SET state_code='done',response_status=?,response_json=?
            WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?",
            [$code,self::json($response),$org,$actor,$endpoint,hash('sha256',$key,true)])!==1)
            throw new RuntimeException('IDEMPOTENCY_COMMIT_FAILED');
    }
    private function audit(int $org,int $actor,int $subject,string $action,array $details):void
    {
        $this->insert('audit_events',['organization_id'=>$org,'public_id'=>self::uuid(),'subject_entity_id'=>$subject,
            'actor_user_id'=>$actor,'module_code'=>'requisitions','action_code'=>$action,'result_code'=>'success',
            'occurred_at'=>self::now(),'recorded_at'=>self::now(),'changes_json'=>self::json($details),'source_kind'=>'system']);
    }
    /** Creates a pending proposal and before/after diffs. Does NOT change requisition or its revision number. */
    public function create(int $org,int $actor,string $reqPublic,int $expected,array $input,string $key):array
    {
        $endpoint='requisition.r3.create.'.$reqPublic;
        $hash=hash('sha256',self::json(['expected'=>$expected,'data'=>$input]),true);
        $lock='supplyflow.rf1.org.'.$org;
        $got=$this->one('SELECT GET_LOCK(?,10) AS acquired',[$lock]);
        if((int)($got['acquired']??0)!==1)throw new RequisitionChangeConflict('BUSY','La solicitud está ocupada.');
        $active=false;
        try{
            $this->db->begin_transaction();$active=true;
            if($again=$this->claim($org,$actor,$endpoint,$key,$hash)){$this->db->commit();$active=false;return $again;}
            $r=$this->one(<<<'SQL'
                SELECT r.id AS db_id,r.folio,r.current_revision_number,e.row_version,e.imported_at,e.created_by,
                  EXISTS(SELECT 1 FROM requisition_revision_snapshots rs WHERE rs.organization_id=r.organization_id AND rs.requisition_id=r.id
                      AND rs.provenance='system' AND rs.snapshot_schema_version=2
                      AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1') AS rf1_owned,
                  r.need_date,r.delivery_place
                FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id AND e.entity_kind='requisition'
                WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL FOR UPDATE
                SQL,[$org,$reqPublic]);
            if(!$r||$r['imported_at']!==null||!(bool)$r['rf1_owned']||(int)$r['created_by']!==$actor)
                throw new RequisitionChangeConflict('READ_ONLY_RECORD','Solo se permiten solicitudes sobre requisiciones RF1 propias, no importadas.');
            if((int)$r['row_version']!==$expected)throw new RequisitionChangeStale('La requisición cambió desde que fue consultada.');
            $reqId=(int)$r['db_id'];
            if($this->one("SELECT id FROM requisition_change_requests WHERE organization_id=? AND requisition_id=? AND status_code='pending_review' LIMIT 1",[$org,$reqId]))
                throw new RequisitionChangeConflict('CHANGE_ALREADY_EXISTS','El expediente ya tiene un cambio registrado que requiere conciliación.');
            $items=$this->rows('SELECT id,public_id,description,quantity,unit_label,category_label_snapshot,line_status
                FROM requisition_items WHERE organization_id=? AND requisition_id=? ORDER BY id FOR UPDATE',[$org,$reqId]);
            $by=[];foreach($items as $it)$by[strtolower($it['public_id'])]=$it;
            $diff=[];$sourcing=false;$supplier=false;
            foreach($input['header'] as $field=>$new){
                $before=$r[$field];
                if((string)$before===(string)$new)continue;
                $diff[]=['target_kind'=>'header','item_id'=>null,'field_code'=>$field,'change_kind'=>'modify',
                    'requires_sourcing'=>false,'before'=>['value'=>$before],'after'=>['value'=>$new]];
                if($field==='need_date'||$field==='delivery_place')$supplier=true;
            }
            foreach($input['items'] as $line){
                if($line['action']==='add'){
                    $category=$this->one('SELECT id FROM categories WHERE organization_id=? AND name=? AND active=1 ORDER BY id LIMIT 1',
                        [$org,$line['category']]);
                    if(!$category)throw new RequisitionChangeConflict('CATEGORY_UNAVAILABLE','La categoría nueva no existe o no está activa.');
                    $newPublic=self::uuid();
                    $sourcing=true;$supplier=true;
                    $diff[]=['target_kind'=>'item','item_id'=>null,'field_code'=>null,
                        'change_kind'=>'add','requires_sourcing'=>true,'schema_version'=>2,
                        'before'=>['status'=>'not_created'],
                        'after'=>['id'=>$newPublic,'description'=>$line['description'],
                            'quantity'=>$line['quantity'],'unit'=>$line['unit'],'category'=>$line['category']]];
                    continue;
                }
                $old=$by[$line['id']]??null;
                if(!$old||$old['line_status']!=='active')throw new RequisitionChangeConflict('LINE_MISMATCH','La partida no está vigente en esta requisición.');
                $before=['id'=>$old['public_id'],'description'=>$old['description'],
                    'quantity'=>(string)$old['quantity'],'unit'=>$old['unit_label'],'category'=>$old['category_label_snapshot']];
                if($line['action']==='cancel'){
                    $after=['id'=>$old['public_id'],'status'=>'cancelled'];
                    $need=true;$supplier=true;
                }else{
                    $after=['id'=>$old['public_id'],'description'=>$line['description'],'quantity'=>$line['quantity'],
                        'unit'=>$line['unit'],'category'=>$line['category']];
                    if($before['category']!==$after['category']){
                        $cat=$this->one('SELECT id FROM categories WHERE organization_id=? AND name=? AND active=1 LIMIT 1',[$org,$after['category']]);
                        if(!$cat)throw new RequisitionChangeConflict('CATEGORY_UNAVAILABLE','La categoría propuesta no existe o no está activa.');
                    }
                    if($before['description']===$after['description'] &&
                        self::normDecimal($before['quantity'])===self::normDecimal($after['quantity']) &&
                        $before['unit']===$after['unit'] && $before['category']===$after['category'])continue;
                    $need=$before['description']!==$after['description'] ||
                        $before['unit']!==$after['unit'] ||$before['category']!==$after['category'] ||
                        (float)$after['quantity']>(float)$before['quantity'];
                    $supplier=true;
                }
                $sourcing=$sourcing||$need;
                $diff[]=['target_kind'=>'item','item_id'=>$old['id'],'field_code'=>null,
                    'change_kind'=>$line['action'],'requires_sourcing'=>$need,'before'=>$before,'after'=>$after];
            }
            if(!$diff)throw new RequisitionChangeConflict('NO_CHANGES','No se detectaron diferencias respecto al expediente vigente.');
            // Only one actor-scoped, organization-locked request may claim a folio.
            $year=substr($input['date'],0,4);$prefix='CR-'.$year.'-';$max=0;
            foreach($this->rows('SELECT folio FROM requisition_change_requests WHERE organization_id=? AND folio LIKE ?',[$org,$prefix.'%']) as $existing){
                $f=$existing['folio'];if(str_starts_with($f,$prefix)&&ctype_digit(substr($f,strlen($prefix))))
                    $max=max($max,(int)substr($f,strlen($prefix)));
            }
            $folio=$prefix.str_pad((string)($max+1),4,'0',STR_PAD_LEFT);
            if(strlen($folio)>128)throw new RequisitionChangeConflict('FOLIO_LIMIT','No hay disponibilidad para otro folio de cambio.');
            $changePublic=self::uuid();
            $changeId=$this->insert('business_entities',['organization_id'=>$org,'public_id'=>$changePublic,
                'entity_kind'=>'requisition_change_request','created_at'=>self::now(),'updated_at'=>self::now(),
                'created_by'=>$actor,'updated_by'=>$actor,'row_version'=>1]);
            $prev=(int)$r['current_revision_number'];
            $impact=$sourcing?'Reabastecimiento por evaluar':($supplier?'Confirmación del proveedor por evaluar':'Revisión documental sin cambio de abastecimiento');
            $this->insert('requisition_change_requests',['id'=>$changeId,'organization_id'=>$org,'requisition_id'=>$reqId,
                'folio'=>$folio,'previous_revision_number'=>$prev,'new_revision_number'=>$prev+1,
                'request_date'=>$input['date'],'requested_by_snapshot'=>$input['requested_by'],
                'source_label'=>$input['source'],'change_type'=>$input['change_type'],
                'reference_text'=>$input['reference'],'reason'=>$input['reason'],'impact_text'=>$impact,
                'requires_sourcing'=>(int)$sourcing,'requires_supplier_confirmation'=>(int)$supplier,
                'status_code'=>'pending_review']);
            foreach($diff as $index=>$d){
                $this->insert('requisition_change_items',['organization_id'=>$org,'requisition_id'=>$reqId,
                    'change_request_id'=>$changeId,'change_ordinal'=>$index+1,'target_kind'=>$d['target_kind'],
                    'requisition_item_id'=>$d['item_id'],'field_code'=>$d['field_code'],'change_kind'=>$d['change_kind'],
                    'requires_sourcing'=>(int)$d['requires_sourcing'],'before_snapshot'=>self::json($d['before']),
                    'after_snapshot'=>self::json($d['after']),'snapshot_schema_version'=>$d['schema_version']??1,'resolution_status'=>'proposed']);
            }
            $this->audit($org,$actor,$changeId,'requisition.r3.change.request',[
                'requisition'=>$reqPublic,'folio'=>$folio,'base_version'=>$expected,
                'current_revision'=>$prev,'proposed_revision'=>$prev+1,'changes'=>count($diff),
                'requires_sourcing'=>$sourcing,'requires_supplier_confirmation'=>$supplier]);
            $out=['id'=>$changePublic,'requisition_id'=>$reqPublic,'requisition_folio'=>$r['folio'],
                'folio'=>$folio,'version'=>1,'base_requisition_version'=>$expected,
                'previous_revision_number'=>$prev,'proposed_revision_number'=>$prev+1,
                'status'=>'pending_review','change_count'=>count($diff),'requires_sourcing'=>$sourcing,
                'requires_supplier_confirmation'=>$supplier,'applied'=>false,'replayed'=>false];
            $this->finished($org,$actor,$endpoint,$key,$out,201);
            $this->db->commit();$active=false;return $out;
        }catch(Throwable $e){if($active){try{$this->db->rollback();}catch(Throwable){}}throw $e;}
        finally{try{$this->one('SELECT RELEASE_LOCK(?) AS released',[$lock]);}catch(Throwable){}}
    }
    /** A withdrawn request remains in the audit trail; no changes to original requisition. */
    public function withdraw(int $org,int $actor,string $public,int $expected,array $input,string $key):array
    {
        $endpoint='requisition.r3.withdraw.'.$public;
        $hash=hash('sha256',self::json(['expected'=>$expected,'data'=>$input]),true);
        $lock='supplyflow.rf1.org.'.$org;
        $got=$this->one('SELECT GET_LOCK(?,10) AS acquired',[$lock]);
        if((int)($got['acquired']??0)!==1)throw new RequisitionChangeConflict('BUSY','El cambio está ocupado.');
        $active=false;
        try{
            $this->db->begin_transaction();$active=true;
            if($again=$this->claim($org,$actor,$endpoint,$key,$hash)){$this->db->commit();$active=false;return $again;}
            $r=$this->one('SELECT cr.id,cr.folio,cr.status_code,ce.row_version
                '.self::ownedJoin().' AND ce.public_id=? FOR UPDATE',[$org,$actor,$public]);
            if(!$r)throw new RequisitionChangeConflict('CHANGE_NOT_FOUND','El cambio no está disponible.');
            if((int)$r['row_version']!==$expected)throw new RequisitionChangeStale('El cambio ya tiene una nueva versión.');
            if($r['status_code']!=='pending_review')throw new RequisitionChangeConflict('NOT_PENDING','Solo se puede retirar una solicitud pendiente.');
            if($this->update('requisition_change_requests',['status_code'=>'withdrawn','impact_text'=>'Retirada por el solicitante'],
                'id=? AND organization_id=? AND status_code=?',[$r['id'],$org,'pending_review'])!==1)
                throw new RequisitionChangeConflict('CHANGE_CONFLICT','La solicitud cambió durante el retiro.');
            if($this->update('business_entities',['row_version'=>$expected+1,'updated_at'=>self::now(),'updated_by'=>$actor],
                'id=? AND organization_id=? AND row_version=?',[$r['id'],$org,$expected])!==1)
                throw new RequisitionChangeStale('La solicitud cambió durante el retiro.');
            $this->audit($org,$actor,(int)$r['id'],'requisition.r3.change.withdraw',[
                'folio'=>$r['folio'],'previous_status'=>'pending_review','new_status'=>'withdrawn','reason'=>$input['reason']]);
            $out=['id'=>$public,'folio'=>$r['folio'],'version'=>$expected+1,'status'=>'withdrawn','applied'=>false,'replayed'=>false];
            $this->finished($org,$actor,$endpoint,$key,$out,200);
            $this->db->commit();$active=false;return $out;
        }catch(Throwable $e){if($active){try{$this->db->rollback();}catch(Throwable){}}throw $e;}
        finally{try{$this->one('SELECT RELEASE_LOCK(?) AS released',[$lock]);}catch(Throwable){}}
    }
}
