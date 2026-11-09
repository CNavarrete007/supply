<?php

declare(strict_types=1);
namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use RuntimeException;
use Throwable;

/**
 * R3C2: append-only commercial treatment assessments.
 * No grant, document lifecycle transition or requisition revision is performed.
 */
final class RequisitionCommercialAssessmentRepository
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
    private static function json(mixed $v):string{return json_encode($v,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}
    private static function uuid():string{$v=bin2hex(random_bytes(16));$v[12]='4';$v[16]=dechex((hexdec($v[16])&3)|8);return substr($v,0,8).'-'.substr($v,8,4).'-'.substr($v,12,4).'-'.substr($v,16,4).'-'.substr($v,20);}
    private function rows(string $sql,array $args=[]):array
    {
        $stmt=$this->db->prepare($sql);
        try{if($args)$stmt->bind_param(str_repeat('s',count($args)),...$args);$stmt->execute();return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);}
        finally{$stmt->close();}
    }
    private function one(string $sql,array $args=[]):?array{return $this->rows($sql,$args)[0]??null;}
    private function run(string $sql,array $args=[]):int
    {
        $stmt=$this->db->prepare($sql);
        try{if($args)$stmt->bind_param(str_repeat('s',count($args)),...$args);$stmt->execute();return $stmt->affected_rows;}
        finally{$stmt->close();}
    }
    private function insert(string $table,array $fields):int
    {
        $columns=array_keys($fields);
        $this->run('INSERT INTO `'.$table.'` (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($fields),'?')).')',array_values($fields));
        return (int)$this->db->insert_id;
    }
    /** Organization-bound, RF1-created, non-imported; no self-review. */
    private function change(int $org,int $reviewer,string $public,bool $lock):?array
    {
        return $this->one(<<<'SQL'
            SELECT cr.id AS change_db_id,cr.requisition_id AS req_db_id,cr.folio,cr.status_code,
                   cr.previous_revision_number,cr.new_revision_number,
                   r.current_revision_number,re.row_version AS requisition_version,
                   ce.row_version AS change_version,ce.public_id AS change_public_id,
                   re.public_id AS requisition_public_id
            FROM requisition_change_requests cr
            JOIN business_entities ce ON ce.id=cr.id AND ce.organization_id=cr.organization_id
                AND ce.entity_kind='requisition_change_request'
            JOIN requisitions r ON r.id=cr.requisition_id AND r.organization_id=cr.organization_id
            JOIN business_entities re ON re.id=r.id AND re.organization_id=r.organization_id
                AND re.entity_kind='requisition'
            WHERE cr.organization_id=? AND ce.public_id=? AND ce.created_by<>?
              AND ce.archived_at IS NULL AND re.archived_at IS NULL AND re.imported_at IS NULL
              AND EXISTS(SELECT 1 FROM requisition_revision_snapshots rs
                WHERE rs.organization_id=r.organization_id AND rs.requisition_id=r.id
                  AND rs.provenance='system' AND rs.snapshot_schema_version=2
                  AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1')
            SQL.($lock?' FOR UPDATE':''),[$org,$public,$reviewer]);
    }
    private function latest(int $org,int $id,bool $lock):?array
    {
        return $this->one('SELECT assessment_version,requisition_version,HEX(inventory_sha256) AS inventory_hash,
                    assessment_json,reason_text,recorded_at
                    FROM requisition_change_commercial_assessments
                    WHERE organization_id=? AND change_request_id=? ORDER BY assessment_version DESC LIMIT 1'.($lock?' FOR UPDATE':''),[$org,$id]);
    }
    private static function formattedAssessment(?array $row,string $currentHash,int $reqVersion):?array
    {
        if($row===null)return null;
        return ['assessment_version'=>(int)$row['assessment_version'],'requisition_version'=>(int)$row['requisition_version'],
            'inventory_sha256'=>strtolower((string)$row['inventory_hash']),
            'recorded_at'=>$row['recorded_at'],'reason'=>$row['reason_text'],
            'treatments'=>json_decode((string)$row['assessment_json'],true,512,JSON_THROW_ON_ERROR)['treatments'],
            'still_matches_inventory'=>hash_equals(strtolower((string)$row['inventory_hash']),$currentHash)
                && (int)$row['requisition_version']===$reqVersion,
            'state'=>'assessment_recorded_followup_required','documents_authorized'=>false];
    }
    /** Informative GET. It does not reserve linked documents or permissions. */
    public function dossier(int $org,int $reviewer,string $public):?array
    {
        $change=$this->change($org,$reviewer,$public,false);
        if($change===null)return null;
        $inventory=RequisitionCommercialInventory::read($this->db,$org,(int)$change['req_db_id']);
        $latest=$this->latest($org,(int)$change['change_db_id'],false);
        $hasBlocker=$inventory['has_downstream_dependencies'];
        $pending=$change['status_code']==='pending_review';
        return ['change_id'=>$change['change_public_id'],'requisition_id'=>$change['requisition_public_id'],
            'folio'=>$change['folio'],'change_version'=>(int)$change['change_version'],
            'requisition_version'=>(int)$change['requisition_version'],
            'status'=>$change['status_code'],'previous_revision_number'=>(int)$change['previous_revision_number'],
            'proposed_revision_number'=>(int)$change['new_revision_number'],
            ...$inventory,'latest_assessment'=>self::formattedAssessment($latest,$inventory['inventory_sha256'],(int)$change['requisition_version']),
            'can_record_assessment'=>$pending&&$hasBlocker,
            'assessment_next_version'=>$latest?(int)$latest['assessment_version']+1:1,
            'commercial_reconciliation_complete'=>false,
            'notice'=>'El inventario y los tratamientos son informativos. No autorizan ni modifican RFQ, cotizaciones, OC, entregas, facturas o la requisición.'];
    }
    private function claim(int $org,int $reviewer,string $endpoint,string $key,string $hash):?array
    {
        $keyHash=hash('sha256',$key,true);
        $old=$this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys
            WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE',[$org,$reviewer,$endpoint,$keyHash]);
        if($old){
            if(!hash_equals($hash,(string)$old['request_sha256']))
                throw new RequisitionChangeConflict('IDEMPOTENCY_CONFLICT','Clave utilizada para otra evaluación.');
            if($old['state_code']!=='done'||$old['response_json']===null)
                throw new RequisitionChangeConflict('OPERATION_PENDING','Consulta el expediente antes de reintentar.');
            $response=json_decode($old['response_json'],true,512,JSON_THROW_ON_ERROR);
            $response['replayed']=true;return $response;
        }
        $this->insert('idempotency_keys',['organization_id'=>$org,'actor_user_id'=>$reviewer,'endpoint_code'=>$endpoint,
            'key_sha256'=>$keyHash,'request_sha256'=>$hash,'state_code'=>'pending',
            'created_at'=>self::now(),'expires_at'=>gmdate('Y-m-d H:i:s',time()+86400)]);
        return null;
    }
    private function finish(int $org,int $reviewer,string $endpoint,string $key,array $out):void
    {
        if($this->run("UPDATE idempotency_keys SET state_code='done',response_status=201,response_json=?
                WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?",
                [self::json($out),$org,$reviewer,$endpoint,hash('sha256',$key,true)])!==1)
            throw new RuntimeException('IDEMPOTENCY_FINISH_FAILED');
    }
    /** Append-only assessment, not commercial execution, authorization, or revision application. */
    public function record(int $org,int $reviewer,string $public,int $expectedChangeVersion,array $input,string $key):array
    {
        $endpoint='requisition.r3c2.assessment.'.$public;
        $hash=hash('sha256',self::json(['expected'=>$expectedChangeVersion,'data'=>$input]),true);
        $lock='supplyflow.rf1.org.'.$org;
        $got=$this->one('SELECT GET_LOCK(?,10) AS acquired',[$lock]);
        if((int)($got['acquired']??0)!==1)
            throw new RequisitionChangeConflict('BUSY','El expediente está ocupado.');
        $tx=false;
        try{
            $this->db->begin_transaction();$tx=true;
            if($again=$this->claim($org,$reviewer,$endpoint,$key,$hash)){
                $this->db->commit();$tx=false;return $again;
            }
            $change=$this->change($org,$reviewer,$public,true);
            if($change===null)throw new RequisitionChangeConflict('NOT_REVIEWABLE','Cambio no disponible para conciliación.');
            if($change['status_code']!=='pending_review')
                throw new RequisitionChangeConflict('DECISION_FINAL','La solicitud ya fue resuelta.');
            if((int)$change['change_version']!==$expectedChangeVersion ||
               (int)$change['requisition_version']!==$input['requisition_version'] ||
               (int)$change['current_revision_number']!==(int)$change['previous_revision_number'])
                throw new RequisitionChangeStale('La solicitud o requisición cambió.');
            $old=$this->latest($org,(int)$change['change_db_id'],true);
            $oldVersion=$old?(int)$old['assessment_version']:0;
            if($input['assessment_version']!==$oldVersion)
                throw new RequisitionChangeStale('La evaluación comercial tiene una versión posterior.');
            $inventory=RequisitionCommercialInventory::read($this->db,$org,(int)$change['req_db_id']);
            if(!$inventory['has_downstream_dependencies'])
                throw new RequisitionChangeConflict('NO_COMMERCIAL_IMPACT','No existen dependencias comerciales a conciliar.');
            RequisitionCommercialAssessmentInput::matchInventory($input,$inventory);
            $next=$oldVersion+1;
            $this->insert('requisition_change_commercial_assessments',[
                'organization_id'=>$org,'change_request_id'=>$change['change_db_id'],
                'requisition_id'=>$change['req_db_id'],'assessment_version'=>$next,
                'requisition_version'=>$input['requisition_version'],
                'inventory_sha256'=>hex2bin($inventory['inventory_sha256']),
                'inventory_json'=>self::json($inventory['dependencies']),
                'assessment_json'=>self::json(['treatments'=>$input['treatments'],'schema_version'=>1]),
                'reason_text'=>$input['reason'],'actor_user_id'=>$reviewer,'recorded_at'=>self::now()]);
            $this->insert('audit_events',['organization_id'=>$org,'public_id'=>self::uuid(),
                'subject_entity_id'=>$change['change_db_id'],'actor_user_id'=>$reviewer,
                'module_code'=>'requisitions','action_code'=>'requisition.r3c2.assessment.recorded','result_code'=>'success',
                'occurred_at'=>self::now(),'recorded_at'=>self::now(),
                'changes_json'=>self::json(['change_id'=>$public,'assessment_version'=>$next,
                    'inventory_sha256'=>$inventory['inventory_sha256'],'treatment_types'=>array_keys($input['treatments']),
                    'note'=>'Assessment only: no approval, document amendment or application']),
                'source_kind'=>'system']);
            $result=['change_id'=>$public,'assessment_version'=>$next,
                'inventory_sha256'=>$inventory['inventory_sha256'],'status'=>'assessment_recorded_followup_required',
                'commercial_reconciliation_complete'=>false,'documents_modified'=>false,
                'revision_applied'=>false,'replayed'=>false];
            $this->finish($org,$reviewer,$endpoint,$key,$result);
            $this->db->commit();$tx=false;return $result;
        }catch(Throwable $e){if($tx){try{$this->db->rollback();}catch(Throwable){}}throw $e;}
        finally{try{$this->one('SELECT RELEASE_LOCK(?) AS released',[$lock]);}catch(Throwable){}}
    }
}
