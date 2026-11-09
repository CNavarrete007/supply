<?php

declare(strict_types=1);
namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use RuntimeException;
use Throwable;

/**
 * R3C3: two-person, append-only verification of commercial evidence and existing
 * successor versions. NEVER creates, issues, approves or edits commercial documents,
 * nor releases the R3B downstream-dependencies barrier.
 */
final class RequisitionCommercialExecutionRepository
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
        $file=(string)getenv('RECOVERY_DB_PASSWORD_FILE');
        if($user!=='supplyflow_recovery_local'||$file!=='/run/secrets/recovery_db_password'||!is_readable($file))
            throw new RuntimeException('RECOVERY_NOT_PROVISIONED');
        $secret=trim((string)file_get_contents($file));
        if(!preg_match('/^[a-f0-9]{64}$/D',$secret))throw new RuntimeException('RECOVERY_CREDENTIAL_INVALID');
        mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
        try{$this->db=new mysqli('db',$user,$secret,'supplyflow_dev',3306);SessionContract::initialize($this->db,'supplyflow_dev');}
        finally{unset($secret);}
    }
    public function __destruct(){if($this->owns&&isset($this->db))$this->db->close();}
    private static function now():string{return gmdate('Y-m-d H:i:s');}
    private static function json(mixed $x):string{return json_encode($x,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}
    private static function uuid():string
    {
        $v=bin2hex(random_bytes(16));$v[12]='4';$v[16]=dechex((hexdec($v[16])&3)|8);
        return substr($v,0,8).'-'.substr($v,8,4).'-'.substr($v,12,4).'-'.substr($v,16,4).'-'.substr($v,20);
    }
    private function rows(string $sql,array $params=[]):array
    {
        $s=$this->db->prepare($sql);
        try{if($params)$s->bind_param(str_repeat('s',count($params)),...$params);$s->execute();return $s->get_result()->fetch_all(MYSQLI_ASSOC);}
        finally{$s->close();}
    }
    private function one(string $sql,array $params=[]):?array{return $this->rows($sql,$params)[0]??null;}
    private function run(string $sql,array $params=[]):int
    {
        $s=$this->db->prepare($sql);
        try{if($params)$s->bind_param(str_repeat('s',count($params)),...$params);$s->execute();return $s->affected_rows;}
        finally{$s->close();}
    }
    private function insert(string $table,array $fields):int
    {
        $this->run('INSERT INTO `'.$table.'` (`'.implode('`,`',array_keys($fields)).'`) VALUES ('.implode(',',array_fill(0,count($fields),'?')).')',array_values($fields));
        return (int)$this->db->insert_id;
    }
    /** Scope to a fresh RF1 requisition, independent admin, same organization. */
    private function change(int $org,int $actor,string $public,bool $lock):?array
    {
        return $this->one(<<<'SQL'
            SELECT cr.id AS change_db_id,cr.requisition_id AS req_db_id,cr.status_code,
                   cr.previous_revision_number,cr.folio,ce.created_by AS requester_id,
                   ce.row_version AS change_version,re.row_version AS requisition_version,
                   r.current_revision_number,ce.public_id AS change_public_id,re.public_id AS requisition_public_id
            FROM requisition_change_requests cr
            JOIN business_entities ce ON ce.id=cr.id AND ce.organization_id=cr.organization_id
                AND ce.entity_kind='requisition_change_request'
            JOIN requisitions r ON r.id=cr.requisition_id AND r.organization_id=cr.organization_id
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id AND re.entity_kind='requisition'
            WHERE cr.organization_id=? AND ce.public_id=? AND ce.created_by<>?
                AND ce.archived_at IS NULL AND re.archived_at IS NULL AND re.imported_at IS NULL
                AND EXISTS (SELECT 1 FROM requisition_revision_snapshots rs
                    WHERE rs.organization_id=r.organization_id AND rs.requisition_id=r.id
                      AND rs.provenance='system' AND rs.snapshot_schema_version=2
                      AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1')
            SQL.($lock?' FOR UPDATE':''),[$org,$public,$actor]);
    }
    private function assessment(int $org,int $change):?array
    {
        return $this->one('SELECT id,assessment_version,requisition_version,inventory_sha256,assessment_json,actor_user_id
            FROM requisition_change_commercial_assessments
            WHERE organization_id=? AND change_request_id=? ORDER BY assessment_version DESC LIMIT 1 FOR UPDATE',[$org,$change]);
    }
    private function context(array $change,?array $assessment,array $inventory,array $input,int $expected):void
    {
        if($change['status_code']!=='pending_review')
            throw new RequisitionChangeConflict('DECISION_FINAL','La solicitud ya fue resuelta.');
        if((int)$change['current_revision_number']!==(int)$change['previous_revision_number'] ||
            (int)$change['change_version']!==$expected ||
            (int)$change['requisition_version']!==$input['requisition_version'])
            throw new RequisitionChangeStale('La solicitud o requisición cambió.');
        if($assessment===null || !$inventory['has_downstream_dependencies'])
            throw new RequisitionChangeConflict('ASSESSMENT_REQUIRED','Se requiere evaluación comercial R3C2 vigente.');
        if((int)$assessment['assessment_version']!==$input['assessment_version'] ||
            (int)$assessment['requisition_version']!==$input['requisition_version'] ||
            !hash_equals((string)$assessment['inventory_sha256'],hex2bin($input['inventory_sha256'])) ||
            !hash_equals($inventory['inventory_sha256'],$input['inventory_sha256']))
            throw new RequisitionChangeStale('La evaluación o el inventario comercial está desactualizado.');
    }
    /** Fixed SQL allowlist; no table name supplied directly to SQL. */
    private function document(int $org,int $req,string $kind,string $public):?array
    {
        $sql=match($kind){
            'rfqs'=>"SELECT d.*,e.row_version AS _entity_version FROM rfqs d JOIN business_entities e ON e.id=d.id AND e.organization_id=d.organization_id AND e.entity_kind='rfq' WHERE d.organization_id=? AND d.requisition_id=? AND e.public_id=? AND e.imported_at IS NULL AND e.archived_at IS NULL",
            'supplier_quotes'=>"SELECT d.*,e.row_version AS _entity_version FROM supplier_quotes d JOIN business_entities e ON e.id=d.id AND e.organization_id=d.organization_id AND e.entity_kind='supplier_quote' WHERE d.organization_id=? AND d.requisition_id=? AND e.public_id=? AND e.imported_at IS NULL AND e.archived_at IS NULL",
            'customer_quote_versions'=>"SELECT d.*,e.row_version AS _entity_version FROM customer_quote_versions d JOIN business_entities e ON e.id=d.id AND e.organization_id=d.organization_id AND e.entity_kind='customer_quote_version' WHERE d.organization_id=? AND d.requisition_id=? AND e.public_id=? AND e.imported_at IS NULL AND e.archived_at IS NULL",
            'purchase_orders'=>"SELECT d.*,e.row_version AS _entity_version FROM purchase_orders d JOIN business_entities e ON e.id=d.id AND e.organization_id=d.organization_id AND e.entity_kind='purchase_order' WHERE d.organization_id=? AND e.public_id=? AND e.imported_at IS NULL AND e.archived_at IS NULL AND EXISTS (SELECT 1 FROM purchase_order_requisitions por WHERE por.organization_id=d.organization_id AND por.purchase_order_id=d.id AND por.requisition_id=?)",
            default=>throw new RuntimeException('UNEXPECTED_DOCUMENT_KIND'),
        };
        // PO query binds org, public ID, requisition ID; all other types org, req, public ID.
        $args=$kind==='purchase_orders'?[$org,$public,$req]:[$org,$req,$public];
        $r=$this->one($sql,$args);
        if(!$r)return null;
        return ['row'=>$r,'sha'=>self::rowSha($r)];
    }
    public static function rowSha(array $row):string
    {
        foreach($row as &$value){
            if(is_string($value)&&preg_match('//u',$value)!==1)
                $value=['binary_sha256'=>hash('sha256',$value),'bytes'=>strlen($value)];
        }unset($value);
        return hash('sha256',self::json($row));
    }
    public static function assertSuccessor(string $action,array $original,?array $next,int $changeId):void
    {
        if(!in_array($action,RequisitionCommercialExecutionInput::SUCCESSORS,true)){
            if($next!==null)throw new RequisitionChangeConflict('INVALID_SUCCESSOR','La acción no admite sucesora.');
            return;
        }
        if($next===null)throw new RequisitionChangeConflict('SUCCESSOR_NOT_FOUND','No se identificó una versión sucesora válida.');
        if((int)$next['id']===(int)$original['id'] ||
            (int)$next['version_number']!==(int)$original['version_number']+1 ||
            (int)($next['change_request_id']??0)!==$changeId)
            throw new RequisitionChangeConflict('SUCCESSOR_NOT_LINKED','La nueva versión no corresponde a esta solicitud.');
        if($action==='replacement_quote_verified'){
            if((int)$next['customer_quote_id']!==(int)$original['customer_quote_id'] ||
                (int)($next['supersedes_version_id']??0)!==(int)$original['id'] ||
                $next['issued_at']===null || $next['locked_at']===null || $next['approved_content_sha256']===null)
                throw new RequisitionChangeConflict('SUCCESSOR_NOT_ISSUED','La cotización sucesora no está emitida y vinculada.');
        }elseif($action==='formal_amendment_verified'){
            if((string)$next['series_public_id']!==(string)$original['series_public_id'] ||
                (int)($next['supersedes_purchase_order_id']??0)!==(int)$original['id'] ||
                (int)$next['supplier_id']!==(int)$original['supplier_id'] ||
                $next['authorized_at']===null || $next['locked_at']===null || $next['approved_content_sha256']===null)
                throw new RequisitionChangeConflict('SUCCESSOR_NOT_AUTHORIZED','La OC sucesora no tiene autorización válida registrada.');
        }
    }
    /** Evidence MUST already be a scanned-clean private file, linked to source/successor/change. */
    private function evidence(int $org,string $public,int $changeId,int $originalId,?int $nextId):?array
    {
        return $this->one(<<<'SQL'
            SELECT f.id,f.sha256,f.public_id FROM files f
            WHERE f.organization_id=? AND f.public_id=? AND f.scan_status='clean'
              AND EXISTS(SELECT 1 FROM entity_files ef WHERE ef.organization_id=f.organization_id AND ef.file_id=f.id
                AND ef.entity_id IN (?,?,?))
            SQL,[$org,$public,$changeId,$originalId,$nextId??0]);
    }
    private function claim(int $org,int $actor,string $endpoint,string $key,string $hash):?array
    {
        $kh=hash('sha256',$key,true);
        $old=$this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys
             WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE',[$org,$actor,$endpoint,$kh]);
        if($old){
            if(!hash_equals($hash,(string)$old['request_sha256']))
                throw new RequisitionChangeConflict('IDEMPOTENCY_CONFLICT','La clave corresponde a otra operación.');
            if($old['state_code']!=='done'||$old['response_json']===null)
                throw new RequisitionChangeConflict('OPERATION_PENDING','Consulta el expediente antes de repetir.');
            $out=json_decode((string)$old['response_json'],true,512,JSON_THROW_ON_ERROR);
            $out['replayed']=true;return $out;
        }
        $this->insert('idempotency_keys',['organization_id'=>$org,'actor_user_id'=>$actor,'endpoint_code'=>$endpoint,
            'key_sha256'=>$kh,'request_sha256'=>$hash,'state_code'=>'pending','created_at'=>self::now(),
            'expires_at'=>gmdate('Y-m-d H:i:s',time()+86400)]);
        return null;
    }
    private function finish(int $org,int $actor,string $endpoint,string $key,array $result,int $http):void
    {
        if($this->run("UPDATE idempotency_keys SET state_code='done',response_status=?,response_json=?
                WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?",
                [$http,self::json($result),$org,$actor,$endpoint,hash('sha256',$key,true)])!==1)
            throw new RuntimeException('IDEMPOTENCY_FINISH_FAILED');
    }
    private function audit(int $org,int $actor,int $change,string $action,array $details):void
    {
        $this->insert('audit_events',['organization_id'=>$org,'public_id'=>self::uuid(),
            'subject_entity_id'=>$change,'actor_user_id'=>$actor,
            'module_code'=>'requisitions','action_code'=>$action,'result_code'=>'success',
            'occurred_at'=>self::now(),'recorded_at'=>self::now(),'changes_json'=>self::json($details),'source_kind'=>'system']);
    }
    private function locked(callable $op,int $org):mixed
    {
        $name='supplyflow.rf1.org.'.$org;
        $got=$this->one('SELECT GET_LOCK(?,10) AS acquired',[$name]);
        if((int)($got['acquired']??0)!==1)throw new RequisitionChangeConflict('BUSY','El expediente está ocupado.');
        $tx=false;
        try{
            $this->db->begin_transaction();$tx=true;
            $result=$op();$this->db->commit();$tx=false;return $result;
        }catch(Throwable $e){if($tx){try{$this->db->rollback();}catch(Throwable){}}throw $e;}
        finally{try{$this->one('SELECT RELEASE_LOCK(?) AS released',[$name]);}catch(Throwable){}}
    }
    private function baseline(int $org,int $actor,string $public,int $version,array $input):array
    {
        $change=$this->change($org,$actor,$public,true);
        if($change===null)throw new RequisitionChangeConflict('NOT_REVIEWABLE','Solicitud fuera de alcance.');
        $assessment=$this->assessment($org,(int)$change['change_db_id']);
        $inventory=RequisitionCommercialInventory::read($this->db,$org,(int)$change['req_db_id']);
        $this->context($change,$assessment,$inventory,$input,$version);
        return [$change,$assessment,$inventory];
    }
    public function listing(int $org,int $actor,string $public):?array
    {
        // GET is intentionally read-only; no assessment lock or computed approval flags.
        $change=$this->change($org,$actor,$public,false);
        if($change===null)return null;
        $rows=$this->rows(<<<'SQL'
            SELECT x.public_id,x.assessment_version,x.document_kind,x.action_code,x.reference_text,x.reason_text,
                   x.recorded_at,b.public_id AS document_public_id,
                   s.public_id AS successor_public_id,f.public_id AS evidence_public_id,
                   rv.decision_code,rv.reason_text AS review_reason,rv.decided_at
            FROM requisition_change_commercial_executions x
            JOIN business_entities b ON b.id=x.document_entity_id AND b.organization_id=x.organization_id
            LEFT JOIN business_entities s ON s.id=x.successor_entity_id AND s.organization_id=x.organization_id
            JOIN files f ON f.id=x.evidence_file_id AND f.organization_id=x.organization_id
            LEFT JOIN requisition_change_commercial_execution_reviews rv
                ON rv.execution_id=x.id AND rv.organization_id=x.organization_id
            WHERE x.organization_id=? AND x.change_request_id=? ORDER BY x.id DESC LIMIT 101
            SQL,[$org,$change['change_db_id']]);
        $truncated=count($rows)>100;if($truncated)$rows=array_slice($rows,0,100);
        return ['change_id'=>$public,'status'=>$change['status_code'],'change_version'=>(int)$change['change_version'],
            'requisition_version'=>(int)$change['requisition_version'],
            'items'=>array_map(static function(array $r):array {
                return ['id'=>$r['public_id'],'assessment_version'=>(int)$r['assessment_version'],
                    'document_kind'=>$r['document_kind'],'document_id'=>$r['document_public_id'],
                    'action'=>$r['action_code'],'successor_id'=>$r['successor_public_id'],
                    'evidence_file_id'=>$r['evidence_public_id'],'reference'=>$r['reference_text'],
                    'reason'=>$r['reason_text'],'recorded_at'=>$r['recorded_at'],
                    'state'=>$r['decision_code']??'awaiting_independent_review',
                    'review_reason'=>$r['review_reason'],'reviewed_at'=>$r['decided_at'],
                    'evidence_reviewed'=>$r['decision_code']!==null];
            },$rows),'limit'=>100,'truncated'=>$truncated,
            'commercial_reconciliation_complete'=>false,
            'revision_applied'=>false,'commercial_documents_modified'=>false,
            'notice'=>'Constancias internas y revisiones de evidencia; no equivalen a confirmación de terceros, emisión comercial o autorización de cambios.'];
    }
    public function record(int $org,int $actor,string $public,int $version,array $input,string $key):array
    {
        $endpoint='requisition.r3c3.record.'.$public;
        $hash=hash('sha256',self::json(['expected'=>$version,'data'=>$input]),true);
        return $this->locked(function()use($org,$actor,$public,$version,$input,$key,$endpoint,$hash):array {
            if($replay=$this->claim($org,$actor,$endpoint,$key,$hash))return $replay;
            [$change,$assessment]=$this->baseline($org,$actor,$public,$version,$input);
            $treatments=json_decode((string)$assessment['assessment_json'],true,512,JSON_THROW_ON_ERROR);
            RequisitionCommercialExecutionInput::checkTreatment($treatments,$input['document_kind'],$input['action']);
            $kind=$input['document_kind'];$req=(int)$change['req_db_id'];
            $source=$this->document($org,$req,$kind,$input['document_id']);
            if($source===null)throw new RequisitionChangeConflict('SOURCE_NOT_FOUND','Documento comercial no disponible en la requisición.');
            $next=$input['successor_id']!==null?$this->document($org,$req,$kind,$input['successor_id']):null;
            self::assertSuccessor($input['action'],$source['row'],$next['row']??null,(int)$change['change_db_id']);
            $evidence=$this->evidence($org,$input['evidence_file_id'],(int)$change['change_db_id'],
                (int)$source['row']['id'],$next!==null?(int)$next['row']['id']:null);
            if($evidence===null)throw new RequisitionChangeConflict('EVIDENCE_UNAVAILABLE','La evidencia debe estar limpia y ligada a este expediente o documento.');
            if($this->one('SELECT id FROM requisition_change_commercial_executions
                WHERE organization_id=? AND change_request_id=? AND assessment_id=? AND document_entity_id=? AND action_code=? LIMIT 1 FOR UPDATE',
                [$org,$change['change_db_id'],$assessment['id'],$source['row']['id'],$input['action']]))
                throw new RequisitionChangeConflict('EVIDENCE_ALREADY_RECORDED','Ya existe una constancia de esta acción en la evaluación.');
            $id=self::uuid();
            $this->insert('requisition_change_commercial_executions',[
                'organization_id'=>$org,'change_request_id'=>$change['change_db_id'],
                'requisition_id'=>$req,'assessment_id'=>$assessment['id'],'public_id'=>$id,
                'assessment_version'=>$input['assessment_version'],'inventory_sha256'=>hex2bin($input['inventory_sha256']),
                'document_kind'=>$kind,'document_entity_id'=>$source['row']['id'],
                'action_code'=>$input['action'],'successor_entity_id'=>$next['row']['id']??null,
                'source_sha256'=>hex2bin($source['sha']),'successor_sha256'=>$next!==null?hex2bin($next['sha']):null,
                'evidence_file_id'=>$evidence['id'],'evidence_sha256'=>$evidence['sha256'],
                'reference_text'=>$input['reference'],'reason_text'=>$input['reason'],
                'recorded_by'=>$actor,'recorded_at'=>self::now()]);
            $this->audit($org,$actor,(int)$change['change_db_id'],'requisition.r3c3.evidence.recorded',[
                'execution_id'=>$id,'assessment_version'=>$input['assessment_version'],'document_kind'=>$kind,
                'document_id'=>$input['document_id'],'action'=>$input['action'],'source_sha256'=>$source['sha'],
                'evidence_sha256'=>bin2hex($evidence['sha256']),'result'=>'awaiting_independent_review']);
            $result=['id'=>$id,'change_id'=>$public,'status'=>'awaiting_independent_review',
                'documents_modified'=>false,'revision_applied'=>false,'commercial_reconciliation_complete'=>false,'replayed'=>false];
            $this->finish($org,$actor,$endpoint,$key,$result,201);
            return $result;
        },$org);
    }
    public function review(int $org,int $actor,string $public,string $executionPublic,int $version,array $input,string $key):array
    {
        $endpoint='requisition.r3c3.review.'.$executionPublic;
        $hash=hash('sha256',self::json(['expected'=>$version,'data'=>$input,'change'=>$public]),true);
        return $this->locked(function()use($org,$actor,$public,$executionPublic,$version,$input,$key,$endpoint,$hash):array {
            if($replay=$this->claim($org,$actor,$endpoint,$key,$hash))return $replay;
            [$change,$assessment]=$this->baseline($org,$actor,$public,$version,$input);
            $execution=$this->one('SELECT * FROM requisition_change_commercial_executions
                WHERE organization_id=? AND change_request_id=? AND public_id=? FOR UPDATE',
                [$org,$change['change_db_id'],$executionPublic]);
            if($execution===null)throw new RequisitionChangeConflict('EXECUTION_NOT_FOUND','Constancia no encontrada.');
            if((int)$execution['recorded_by']===$actor || (int)$execution['recorded_by']===(int)$change['requester_id'])
                throw new RequisitionChangeConflict('INDEPENDENT_REVIEW_REQUIRED','La revisión requiere un administrador distinto al solicitante y registrador.');
            if((int)$execution['assessment_id']!==(int)$assessment['id'] ||
                (int)$execution['assessment_version']!==$input['assessment_version'] ||
                !hash_equals((string)$execution['inventory_sha256'],hex2bin($input['inventory_sha256'])))
                throw new RequisitionChangeStale('La constancia pertenece a otra evaluación comercial.');
            if($this->one('SELECT id FROM requisition_change_commercial_execution_reviews
                WHERE organization_id=? AND execution_id=? LIMIT 1 FOR UPDATE',[$org,$execution['id']]))
                throw new RequisitionChangeConflict('REVIEW_FINAL','La constancia ya fue revisada.');
            // Independent review is never allowed on a stale document or evidence hash.
            $sourcePublic=$this->one('SELECT public_id FROM business_entities WHERE id=? AND organization_id=?',
                [$execution['document_entity_id'],$org]);
            if($sourcePublic===null)throw new RequisitionChangeStale('El documento original no está disponible.');
            $source=$this->document($org,(int)$change['req_db_id'],(string)$execution['document_kind'],$sourcePublic['public_id']);
            if($source===null||!hash_equals((string)$execution['source_sha256'],hex2bin($source['sha'])))
                throw new RequisitionChangeStale('Cambió el contenido del documento original.');
            $next=null;
            if($execution['successor_entity_id']!==null){
                $successorPublic=$this->one('SELECT public_id FROM business_entities WHERE id=? AND organization_id=?',
                    [$execution['successor_entity_id'],$org]);
                $next=$successorPublic?$this->document($org,(int)$change['req_db_id'],
                    (string)$execution['document_kind'],$successorPublic['public_id']):null;
                if($next===null||!hash_equals((string)$execution['successor_sha256'],hex2bin($next['sha'])))
                    throw new RequisitionChangeStale('La versión sucesora cambió.');
            }
            self::assertSuccessor((string)$execution['action_code'],$source['row'],$next['row']??null,(int)$change['change_db_id']);
            $evidencePublic=$this->one('SELECT public_id FROM files WHERE id=? AND organization_id=?',
                [$execution['evidence_file_id'],$org]);
            $proof=$evidencePublic?$this->evidence($org,$evidencePublic['public_id'],
                (int)$change['change_db_id'],(int)$source['row']['id'],$next['row']['id']??null):null;
            if($proof===null||!hash_equals((string)$execution['evidence_sha256'],(string)$proof['sha256']))
                throw new RequisitionChangeStale('La evidencia ya no satisface las condiciones de integridad.');
            $this->insert('requisition_change_commercial_execution_reviews',[
                'organization_id'=>$org,'execution_id'=>$execution['id'],
                'decision_code'=>$input['decision'],'reason_text'=>$input['reason'],
                'actor_user_id'=>$actor,'decided_at'=>self::now()]);
            $this->audit($org,$actor,(int)$change['change_db_id'],'requisition.r3c3.evidence.reviewed',[
                'execution_id'=>$executionPublic,'assessment_version'=>$input['assessment_version'],
                'decision'=>$input['decision'],'reason'=>$input['reason'],
                'evidence_sha256'=>bin2hex($execution['evidence_sha256']),
                'notice'=>'Independent evidence review only, not a third-party signature or financial authorization']);
            $result=['id'=>$executionPublic,'change_id'=>$public,'status'=>$input['decision'],
                'documents_modified'=>false,'revision_applied'=>false,'commercial_reconciliation_complete'=>false,'replayed'=>false];
            $this->finish($org,$actor,$endpoint,$key,$result,200);
            return $result;
        },$org);
    }
}
