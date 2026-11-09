<?php

declare(strict_types=1);
namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use RuntimeException;
use Throwable;

/** R3B/R3C: independent review; apply only when every downstream dependency is absent. */
final class RequisitionChangeDecisionRepository
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
        $secret=trim((string)file_get_contents($path));
        if(!preg_match('/^[a-f0-9]{64}$/D',$secret))throw new RuntimeException('RECOVERY_CREDENTIAL_INVALID');
        mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
        try{$this->db=new mysqli('db',$user,$secret,'supplyflow_dev',3306);SessionContract::initialize($this->db,'supplyflow_dev');}
        finally{unset($secret);}
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
    private static function json(mixed $v):string{return json_encode($v,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}
    /** Only non-imported, genuinely RF1-created requisitions, in this org. Reviewer must differ from requester. */
    private static function scope():string{return <<<'SQL'
        FROM requisition_change_requests cr
        JOIN business_entities ce ON ce.id=cr.id AND ce.organization_id=cr.organization_id AND ce.entity_kind='requisition_change_request'
        JOIN requisitions r ON r.id=cr.requisition_id AND r.organization_id=cr.organization_id
        JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind='requisition'
        WHERE cr.organization_id=? AND ce.created_by<>? AND ce.archived_at IS NULL
          AND re.archived_at IS NULL AND re.imported_at IS NULL
          AND EXISTS(SELECT 1 FROM requisition_revision_snapshots rs WHERE rs.organization_id=r.organization_id
            AND rs.requisition_id=r.id AND rs.provenance='system' AND rs.snapshot_schema_version=2
            AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1')
        SQL;}
    private static function fields():string{return <<<'SQL'
        cr.id AS change_db_id,cr.requisition_id AS req_db_id,cr.folio AS change_folio,
        cr.status_code,cr.previous_revision_number,cr.new_revision_number,
        cr.requires_sourcing,cr.requires_supplier_confirmation,cr.reason AS request_reason,
        cr.request_date,cr.change_type,cr.impact_text,
        ce.public_id AS id,ce.created_by AS requester_user_id,ce.row_version AS version,
        re.public_id AS requisition_id,re.row_version AS requisition_version,
        r.folio AS requisition_folio,r.current_revision_number,r.need_date,r.delivery_place
        SQL;}
    public function queue(int $org,int $reviewer):array
    {
        $rows=$this->rows('SELECT '.self::fields().' '.self::scope()." AND cr.status_code='pending_review' ORDER BY cr.id LIMIT 101",[$org,$reviewer]);
        $more=count($rows)>100;if($more)$rows=array_slice($rows,0,100);
        foreach($rows as &$r){unset($r['change_db_id'],$r['req_db_id']);$r=self::format($r);}unset($r);
        return ['items'=>$rows,'returned'=>count($rows),'truncated'=>$more,'limit'=>100];
    }
    private static function format(array $r):array
    {
        foreach(['version','requisition_version','requester_user_id','previous_revision_number','new_revision_number','current_revision_number'] as $k)
            $r[$k]=(int)$r[$k];
        foreach(['requires_sourcing','requires_supplier_confirmation'] as $k)$r[$k]=(bool)$r[$k];
        return $r;
    }
    public function inspect(int $org,int $reviewer,string $public):?array
    {
        $r=$this->one('SELECT '.self::fields().' '.self::scope().' AND ce.public_id=?',[$org,$reviewer,$public]);
        if(!$r)return null;
        $items=$this->rows('SELECT change_ordinal,target_kind,field_code,change_kind,requires_sourcing,before_snapshot,after_snapshot,resolution_status
             FROM requisition_change_items WHERE organization_id=? AND change_request_id=? ORDER BY change_ordinal',[$org,$r['change_db_id']]);
        foreach($items as &$i){
            $i['change_ordinal']=(int)$i['change_ordinal'];$i['requires_sourcing']=(bool)$i['requires_sourcing'];
            foreach(['before_snapshot','after_snapshot'] as $field)$i[$field]=json_decode((string)$i[$field],true,512,JSON_THROW_ON_ERROR);
        }unset($i);
        unset($r['change_db_id'],$r['req_db_id']);
        return [...self::format($r),'changes'=>$items,'reviewer_can_decide'=>$r['status_code']==='pending_review'];
    }
    private function claim(int $org,int $actor,string $endpoint,string $key,string $hash):?array
    {
        $keyHash=hash('sha256',$key,true);
        $found=$this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys
           WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE',[$org,$actor,$endpoint,$keyHash]);
        if($found){
            if(!hash_equals($hash,$found['request_sha256']))throw new RequisitionChangeConflict('IDEMPOTENCY_CONFLICT','Clave utilizada para otra decisión.');
            if($found['state_code']!=='done'||$found['response_json']===null)throw new RequisitionChangeConflict('OPERATION_PENDING','Consulta el estado antes de reintentar.');
            $res=json_decode($found['response_json'],true,512,JSON_THROW_ON_ERROR);$res['replayed']=true;return $res;
        }
        $this->insert('idempotency_keys',['organization_id'=>$org,'actor_user_id'=>$actor,'endpoint_code'=>$endpoint,
            'key_sha256'=>$keyHash,'request_sha256'=>$hash,'state_code'=>'pending','created_at'=>self::now(),
            'expires_at'=>gmdate('Y-m-d H:i:s',time()+86400)]);
        return null;
    }
    private function finish(int $org,int $actor,string $endpoint,string $key,array $result):void
    {
        if($this->run("UPDATE idempotency_keys SET state_code='done',response_status=200,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?",
            [self::json($result),$org,$actor,$endpoint,hash('sha256',$key,true)])!==1)throw new RuntimeException('IDEMPOTENCY_FINISH_FAILED');
    }
    private function audit(int $org,int $actor,int $subject,string $action,array $details):void
    {
        $this->insert('audit_events',['organization_id'=>$org,'public_id'=>self::uuid(),'subject_entity_id'=>$subject,
            'actor_user_id'=>$actor,'module_code'=>'requisitions','action_code'=>$action,'result_code'=>'success',
            'occurred_at'=>self::now(),'recorded_at'=>self::now(),'changes_json'=>self::json($details),'source_kind'=>'system']);
    }
    /** A fixed allowlist, not table names supplied by a caller. No financial document is mutated. */
    private const DEPENDENCY_TABLES=[
        'sourcing_plans','rfqs','supplier_quotes','customer_quotes','customer_quote_versions',
        'requisition_reviews','awards','invoices','service_orders',
        'purchase_order_requisitions','delivery_items'
    ];
    private function downstreamPresence(int $org,int $req):array
    {
        $presence=[];
        foreach(self::DEPENDENCY_TABLES as $table){
            $presence[$table]=$this->one('SELECT 1 AS found FROM `'.$table.'` WHERE organization_id=? AND requisition_id=? LIMIT 1',
                [$org,$req])!==null;
        }
        return $presence;
    }
    /** Fail closed whenever a commercial dependency exists, including procurement planning. */
    private function assertNoDownstream(int $org,int $req):void
    {
        if(in_array(true,$this->downstreamPresence($org,$req),true))
            throw new RequisitionChangeConflict('DOWNSTREAM_RECONCILIATION_REQUIRED',
                'La requisición tiene documentos o planes dependientes. Se requiere conciliación comercial antes de aplicar.');
    }
    /** Informative snapshot; decisive checks run again under transaction lock in decide(). */
    public function impact(int $org,int $reviewer,string $public):?array
    {
        $r=$this->one('SELECT '.self::fields().' '.self::scope().' AND ce.public_id=?',[$org,$reviewer,$public]);
        if(!$r)return null;
        $presence=$this->downstreamPresence($org,(int)$r['req_db_id']);
        $occupied=$this->one('SELECT 1 AS found FROM requisition_revision_snapshots WHERE organization_id=? AND requisition_id=? AND revision_number=? LIMIT 1',
            [$org,$r['req_db_id'],$r['new_revision_number']])!==null;
        $revisionCurrent=(int)$r['current_revision_number']===(int)$r['previous_revision_number']
            && (int)$r['new_revision_number']===(int)$r['previous_revision_number']+1;
        $pending=$r['status_code']==='pending_review';
        $ready=$pending && $revisionCurrent && !$occupied && !in_array(true,$presence,true);
        return ['change_id'=>$r['id'],'requisition_id'=>$r['requisition_id'],
            'change_version'=>(int)$r['version'],'requisition_version'=>(int)$r['requisition_version'],
            'previous_revision_number'=>(int)$r['previous_revision_number'],
            'proposed_revision_number'=>(int)$r['new_revision_number'],
            'status'=>$r['status_code'],'dependencies'=>$presence,
            'has_downstream_dependencies'=>in_array(true,$presence,true),
            'snapshot_number_occupied'=>$occupied,'revision_number_current'=>$revisionCurrent,
            'indicated_apply_ready'=>$ready,'informational_only'=>true,
            'commercial_reconciliation_supported'=>false,
            'notice'=>'La consulta no reserva recursos. La decisión revalida todos los bloqueos en transacción; no modifica cotizaciones ni órdenes de compra.'];
    }
    private function items(int $org,int $req,bool $lock):array
    {
        return $this->rows('SELECT id,public_id,line_number,description,quantity,unit_id,unit_label,category_id,category_label_snapshot,line_status,cancelled_at
            FROM requisition_items WHERE organization_id=? AND requisition_id=? ORDER BY id'.($lock?' FOR UPDATE':''),[$org,$req]);
    }
    /** Independent review. A successful approval is the actual revision, never an implicit supplier/PO approval. */
    public function decide(int $org,int $reviewer,string $public,int $expected,array $decision,string $key):array
    {
        $endpoint='requisition.r3b.decision.'.$public;
        $hash=hash('sha256',self::json(['change_version'=>$expected,'decision'=>$decision]),true);
        $lock='supplyflow.rf1.org.'.$org;
        $got=$this->one('SELECT GET_LOCK(?,10) AS acquired',[$lock]);
        if((int)($got['acquired']??0)!==1)throw new RequisitionChangeConflict('BUSY','La revisión está ocupada.');
        $active=false;
        try{
            $this->db->begin_transaction();$active=true;
            if($again=$this->claim($org,$reviewer,$endpoint,$key,$hash)){$this->db->commit();$active=false;return $again;}
            $r=$this->one('SELECT '.self::fields().' '.self::scope().' AND ce.public_id=? FOR UPDATE',[$org,$reviewer,$public]);
            if(!$r)throw new RequisitionChangeConflict('NOT_REVIEWABLE','El cambio no existe o pertenece al propio solicitante.');
            if((int)$r['version']!==$expected)throw new RequisitionChangeStale('La solicitud cambió desde su consulta.');
            if($r['status_code']!=='pending_review')throw new RequisitionChangeConflict('DECISION_FINAL','Esta solicitud ya tiene una decisión.');
            $id=(int)$r['change_db_id'];$req=(int)$r['req_db_id'];
            $reqRow=$this->one('SELECT r.id,r.current_revision_number,r.need_date,r.delivery_place,re.row_version
                FROM requisitions r JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind=\'requisition\'
                WHERE r.organization_id=? AND r.id=? AND re.archived_at IS NULL AND re.imported_at IS NULL FOR UPDATE',[$org,$req]);
            if(!$reqRow)throw new RequisitionChangeConflict('NOT_REVIEWABLE','Requisición no disponible.');
            if($decision['decision']==='approve'){
                if((int)$reqRow['row_version']!==$decision['requisition_version'])
                    throw new RequisitionChangeStale('La requisición cambió durante la revisión.');
                if((int)$reqRow['current_revision_number']!==(int)$r['previous_revision_number']||
                   (int)$r['new_revision_number']!==(int)$r['previous_revision_number']+1)
                    throw new RequisitionChangeStale('El número de revisión propuesta ya no es actual.');
                // Only one unresolved request can be approved; older applied/rejected requests are historical.
                $other=$this->one("SELECT id FROM requisition_change_requests WHERE organization_id=? AND requisition_id=? AND id<>? AND status_code='pending_review' LIMIT 1",[$org,$req,$id]);
                if($other)throw new RequisitionChangeConflict('OTHER_PENDING','Existe otra solicitud pendiente.');
                $this->assertNoDownstream($org,$req);
                // R2 stores regularization snapshots in this SAME unique (requisition_id,revision_number) space.
                if($this->one('SELECT id FROM requisition_revision_snapshots WHERE organization_id=? AND requisition_id=? AND revision_number=? LIMIT 1',
                    [$org,$req,$r['new_revision_number']]))
                    throw new RequisitionChangeConflict('SNAPSHOT_NUMBER_OCCUPIED','El historial ya utiliza ese número de revisión. Requiere conciliación R2/R3 antes de aplicar.');
                $original=$this->items($org,$req,true);
                $changes=$this->rows('SELECT id,requisition_item_id,target_kind,field_code,change_kind,requires_sourcing,before_snapshot,after_snapshot,
                    snapshot_schema_version,resolution_status FROM requisition_change_items WHERE organization_id=? AND requisition_id=? AND change_request_id=? ORDER BY change_ordinal FOR UPDATE',[$org,$req,$id]);
                $plan=RequisitionChangeApplication::plan($reqRow,$original,$changes);
                $before=['need_date'=>$reqRow['need_date'],'delivery_place'=>$reqRow['delivery_place'],'items'=>$original];
                if($plan['header']&&$this->update('requisitions',$plan['header'],'id=? AND organization_id=?',[$req,$org])!==1)
                    throw new RequisitionChangeConflict('HEADER_WRITE_FAILED','No se pudo guardar la cabecera.');
                $lastLine=0;
                foreach($original as $existing){$lastLine=max($lastLine,(int)$existing['line_number']);}
                foreach($plan['items'] as $change){
                    $patch=$change['patch'];
                    if($change['action']==='add'){
                        if($lastLine>=4294967295)throw new RequisitionChangeConflict('LINE_NUMBER_LIMIT','No se pueden agregar más partidas.');
                        $category=$this->one('SELECT id FROM categories WHERE organization_id=? AND name=? AND active=1 ORDER BY id LIMIT 1',
                            [$org,$patch['category_label_snapshot']]);
                        if(!$category)throw new RequisitionChangeConflict('CATEGORY_UNAVAILABLE','La categoría propuesta ya no está disponible.');
                        $lastLine++;
                        $createdId=$this->insert('requisition_items',[
                            'organization_id'=>$org,'requisition_id'=>$req,'public_id'=>$change['public_id'],
                            'line_number'=>$lastLine,'display_order'=>$lastLine,
                            'description'=>$patch['description'],'quantity'=>$patch['quantity'],
                            'unit_id'=>null,'unit_label'=>$patch['unit_label'],
                            'category_id'=>$category['id'],'category_label_snapshot'=>$patch['category_label_snapshot'],
                            'line_status'=>'active','created_by_change_request_id'=>$id]);
                        if($this->run("UPDATE requisition_change_items SET requisition_item_id=?
                            WHERE id=? AND organization_id=? AND requisition_id=? AND change_request_id=?
                            AND change_kind='add' AND requisition_item_id IS NULL AND resolution_status='proposed'",
                            [$createdId,$change['change_item_id'],$org,$req,$id])!==1)
                            throw new RequisitionChangeStale('No se pudo vincular la propuesta con la partida creada.');
                        continue;
                    }
                    if($change['action']==='cancel'){
                        $patch['cancelled_at']=self::now();$patch['cancelled_by_change_request_id']=$id;
                    }else{
                        if($patch['unit_label']!==$change['original']['unit_label'])$patch['unit_id']=null;
                        if($patch['category_label_snapshot']!==$change['original']['category_label_snapshot']){
                            $category=$this->one('SELECT id FROM categories WHERE organization_id=? AND name=? AND active=1 ORDER BY id LIMIT 1',
                                [$org,$patch['category_label_snapshot']]);
                            if(!$category)throw new RequisitionChangeConflict('CATEGORY_UNAVAILABLE','La categoría propuesta ya no está disponible.');
                            $patch['category_id']=$category['id'];
                        }
                    }
                    if($this->update('requisition_items',$patch,'id=? AND organization_id=? AND requisition_id=? AND line_status=?',
                        [$change['db_id'],$org,$req,'active'])!==1)
                        throw new RequisitionChangeStale('Una partida cambió durante la aplicación.');
                }
                if($this->update('requisitions',['current_revision_number'=>(int)$r['new_revision_number'],
                        'latest_change_request_id'=>$id,'change_status'=>'applied'],
                    'id=? AND organization_id=? AND current_revision_number=?',[$req,$org,$r['previous_revision_number']])!==1)
                    throw new RequisitionChangeStale('La revisión comercial cambió durante la aplicación.');
                $nextReqVersion=(int)$reqRow['row_version']+1;
                if($this->update('business_entities',['row_version'=>$nextReqVersion,'updated_at'=>self::now(),'updated_by'=>$reviewer],
                    'id=? AND organization_id=? AND row_version=?',[$req,$org,$reqRow['row_version']])!==1)
                    throw new RequisitionChangeStale('La requisición cambió durante la aplicación.');
                $after=['need_date'=>$plan['header']['need_date']??$reqRow['need_date'],
                    'delivery_place'=>$plan['header']['delivery_place']??$reqRow['delivery_place'],
                    'items'=>$this->items($org,$req,false)];
                $snapshot=self::json(['origin'=>'supplyflow_r3b_applied','schema_version'=>4,
                    'change_request_id'=>$public,'change_folio'=>$r['change_folio'],
                    'previous_revision_number'=>(int)$r['previous_revision_number'],
                    'revision_number'=>(int)$r['new_revision_number'],'reviewer_id'=>$reviewer,'reason'=>$decision['reason'],
                    'before'=>$before,'after'=>$after,
                    'supplier_confirmation_pending'=>(bool)$r['requires_supplier_confirmation'],
                    'sourcing_reassessment_pending'=>(bool)$r['requires_sourcing']]);
                $this->insert('requisition_revision_snapshots',['organization_id'=>$org,'requisition_id'=>$req,
                    'revision_number'=>$r['new_revision_number'],'snapshot_schema_version'=>4,'snapshot_json'=>$snapshot,
                    'snapshot_sha256'=>hash('sha256',$snapshot,true),'reason_text'=>'Cambio '.$r['change_folio'].': '.$decision['reason'],
                    'created_by_change_request_id'=>$id,'recorded_at'=>self::now(),'provenance'=>'system']);
                $this->run("UPDATE requisition_change_items SET resolution_status='applied'
                    WHERE organization_id=? AND requisition_id=? AND change_request_id=? AND resolution_status='proposed'",[$org,$req,$id]);
                $status='applied';$afterRevision=(int)$r['new_revision_number'];
                $this->audit($org,$reviewer,$req,'requisition.r3.change.applied',[
                    'change_id'=>$public,'folio'=>$r['change_folio'],'from_revision'=>(int)$r['previous_revision_number'],
                    'to_revision'=>$afterRevision,'before_version'=>$reqRow['row_version'],'after_version'=>$nextReqVersion,
                    'snapshot_sha256'=>hash('sha256',$snapshot),'reason'=>$decision['reason']]);
            }else{
                $this->run("UPDATE requisition_change_items SET resolution_status='rejected'
                    WHERE organization_id=? AND requisition_id=? AND change_request_id=? AND resolution_status='proposed'",[$org,$req,$id]);
                $status='rejected';$afterRevision=null;$nextReqVersion=(int)$reqRow['row_version'];
                $this->audit($org,$reviewer,$id,'requisition.r3.change.rejected',[
                    'change_id'=>$public,'folio'=>$r['change_folio'],'reason'=>$decision['reason'],'requester_user_id'=>$r['requester_user_id']]);
            }
            if($this->update('requisition_change_requests',['status_code'=>$status],
                'id=? AND organization_id=? AND status_code=?',[$id,$org,'pending_review'])!==1)
                throw new RequisitionChangeStale('La solicitud cambió mientras se resolvía.');
            $newVersion=$expected+1;
            if($this->update('business_entities',['row_version'=>$newVersion,'updated_at'=>self::now(),'updated_by'=>$reviewer],
                'id=? AND organization_id=? AND row_version=?',[$id,$org,$expected])!==1)
                throw new RequisitionChangeStale('La solicitud cambió durante la revisión.');
            $result=['id'=>$public,'folio'=>$r['change_folio'],'version'=>$newVersion,'status'=>$status,
                'applied'=>$status==='applied','requisition_id'=>$r['requisition_id'],
                'requisition_version'=>$nextReqVersion,'revision_number'=>$afterRevision,
                'requires_sourcing'=>(bool)$r['requires_sourcing'],
                'supplier_confirmation_pending'=>$status==='applied'&&(bool)$r['requires_supplier_confirmation'],
                'replayed'=>false];
            $this->finish($org,$reviewer,$endpoint,$key,$result);
            $this->db->commit();$active=false;return $result;
        }catch(Throwable $e){if($active){try{$this->db->rollback();}catch(Throwable){}}throw $e;}
        finally{try{$this->one('SELECT RELEASE_LOCK(?) AS released',[$lock]);}catch(Throwable){}}
    }
}
