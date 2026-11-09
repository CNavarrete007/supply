<?php

declare(strict_types=1);
namespace App\Libraries;

use App\Database\SessionContract;
use mysqli;
use RuntimeException;
use Throwable;

/** RF1 local pilot. No imported record is ever writable through this repository. */
final class RequisitionRecoveryRepository
{
    private mysqli $db;
    private bool $owns;
    private string $root;
    public const SOURCE_HASH='cd9a8d0eb37b7c461cc1a269f7eb554d89fd76040963d539e4c3f6fbd8754619';
    public const ORIGIN='supplyflow_recovery_rf1';
    public const STAGES=['Requisición recibida','Validación interna','Solicitud de cotización','Comparativo y autorización','Orden de compra','Recepción','Entrega y aceptación','Factura'];
    public const PROGRESS=[10,22,36,50,64,76,90,100];

    public function __construct(?mysqli $testConnection=null, ?string $testRoot=null)
    {
        $this->owns=$testConnection===null;
        if($testConnection!==null){
            if(PHP_SAPI!=='cli')throw new RuntimeException('TEST_CONNECTION_FORBIDDEN');
            $this->db=$testConnection;$this->root=$testRoot??sys_get_temp_dir().'/rf1-test';return;
        }
        $user=(string)getenv('RECOVERY_DB_USERNAME');$path=(string)getenv('RECOVERY_DB_PASSWORD_FILE');
        if($user!=='supplyflow_recovery_local'||$path!=='/run/secrets/recovery_db_password'||!is_readable($path))throw new RuntimeException('RECOVERY_NOT_PROVISIONED');
        $password=trim((string)file_get_contents($path));
        if(!preg_match('/^[a-f0-9]{64}$/D',$password))throw new RuntimeException('RECOVERY_CREDENTIAL_INVALID');
        mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
        try{$this->db=new mysqli('db',$user,$password,'supplyflow_dev',3306);SessionContract::initialize($this->db,'supplyflow_dev');}finally{unset($password);}
        $this->root=WRITEPATH.'supplyflow_rf1/files';
    }
    public function __destruct(){if($this->owns&&isset($this->db))$this->db->close();}
    private function rows(string $sql,array $args=[]):array
    {
        $s=$this->db->prepare($sql);
        try{if($args)$s->bind_param(str_repeat('s',count($args)),...$args);$s->execute();return $s->get_result()->fetch_all(MYSQLI_ASSOC);}finally{$s->close();}
    }
    private function one(string $sql,array $args=[]):?array{return $this->rows($sql,$args)[0]??null;}
    private function run(string $sql,array $args=[]):int
    {
        $s=$this->db->prepare($sql);
        try{if($args)$s->bind_param(str_repeat('s',count($args)),...$args);$s->execute();return $s->affected_rows;}finally{$s->close();}
    }
    /** All tables/keys are literal server-owned values. Payload never supplies SQL identifiers. */
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
    private static function base():string{return <<<'SQL'
        FROM requisitions r
        JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id AND e.entity_kind='requisition'
        JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id
        JOIN business_entities ce ON ce.id=c.id AND ce.organization_id=c.organization_id
        SQL;}
    private static function header():string{return <<<'SQL'
        e.public_id AS id,e.row_version AS version,e.created_at,e.updated_at,e.created_by,e.imported_at,
        r.id AS db_id,r.folio,ce.public_id AS client_id,c.legal_name AS client,c.code AS client_code,
        c.tax_identifier AS client_tax,c.status_code AS client_status,
        r.request_date,r.need_date,r.priority_code AS priority,r.currency_code AS currency,
        r.project_reference_snapshot AS project,r.contract_reference_snapshot AS contract,r.client_reference,
        r.requester_name,r.requester_email,r.delivery_place,r.budget_amount AS budget,r.description,r.notes,
        r.request_source_type,r.request_source_date,r.request_source_reference,r.request_source_notes,
        r.provisional_folio,r.provisional_created_at,r.is_provisional,r.regularization_requirement,r.regularization_due_date,r.regularization_owner_snapshot,
        r.regularization_status,r.current_revision_number,r.history_based,r.latest_change_request_id,
        (SELECT COUNT(*) FROM requisition_items i WHERE i.organization_id=r.organization_id AND i.requisition_id=r.id) AS line_count,
        EXISTS(SELECT 1 FROM requisition_revision_snapshots rs WHERE rs.organization_id=r.organization_id AND rs.requisition_id=r.id AND rs.provenance='system' AND rs.snapshot_schema_version=2 AND JSON_UNQUOTE(JSON_EXTRACT(rs.snapshot_json,'$.origin'))='supplyflow_recovery_rf1') AS rf1_owned
        SQL;}
    public function catalogs(int $org):array
    {
        $clients=$this->rows(<<<'SQL'
            SELECT e.public_id AS id,c.code,c.legal_name AS name,c.brand_name,c.tax_identifier AS tax_id,
                   c.default_project_reference AS project,c.default_contract_reference AS contract,c.status_code AS status,
                   (SELECT pc.display_name FROM party_contacts pc WHERE pc.organization_id=c.organization_id AND pc.owner_entity_id=c.id ORDER BY pc.is_primary DESC,pc.source_ordinal,pc.id LIMIT 1) AS contact,
                   (SELECT cc.value FROM party_contact_channels cc WHERE cc.organization_id=c.organization_id AND cc.owner_entity_id=c.id AND cc.channel_type='email' ORDER BY cc.is_primary DESC,cc.source_ordinal,cc.id LIMIT 1) AS email
            FROM clients c JOIN business_entities e ON e.id=c.id AND e.organization_id=c.organization_id
            WHERE c.organization_id=? AND e.archived_at IS NULL ORDER BY c.legal_name,c.id
            SQL,[$org]);
        $categories=$this->rows('SELECT code,name,description,active FROM categories WHERE organization_id=? ORDER BY name,id',[$org]);
        foreach($categories as &$cat)$cat['active']=(bool)$cat['active'];unset($cat);
        $settings=$this->one("SELECT settings_json FROM organization_settings WHERE organization_id=? AND settings_group='legacy_purchasing'",[$org]);
        $config=json_decode($settings['settings_json']??'{}',true)?:[];
        return ['clients'=>$clients,'categories'=>$categories,'req_prefix'=>$config['reqPrefix']??'REQ','stages'=>self::STAGES,'file_max_bytes'=>RequisitionRecoveryInput::FILE_LIMIT];
    }
    public function folio(int $org,string $client,string $date,bool $provisional):array
    {
        RequisitionRecoveryInput::date($date);
        $c=$this->one('SELECT c.id,c.code,c.legal_name FROM clients c JOIN business_entities e ON e.id=c.id AND e.organization_id=c.organization_id WHERE c.organization_id=? AND e.public_id=? AND e.archived_at IS NULL',[$org,$client]);
        if(!$c&&!$provisional)throw new RecoveryConflict('CLIENT_REQUIRED','Primero selecciona un cliente.');
        $settings=$this->one("SELECT settings_json FROM organization_settings WHERE organization_id=? AND settings_group='legacy_purchasing'",[$org]);
        $config=json_decode($settings['settings_json']??'{}',true)?:[];
        $code=RequisitionRecoveryInput::cleanFolioPart((string)($c['code']??''));
        if(!$provisional&&$code==='')throw new RecoveryConflict('CLIENT_CODE_REQUIRED','El cliente seleccionado no tiene un número válido para generar el folio.');
        $prefix=$provisional?'SOL-PROV-'.substr($date,0,4).'-':$code.'-'.(RequisitionRecoveryInput::cleanFolioPart((string)($config['reqPrefix']??'REQ'))?:'REQ').'-'.substr($date,0,4).'-';
        $rows=$this->rows('SELECT folio,client_id FROM requisitions WHERE organization_id=?',[$org]);$max=0;$taken=[];
        foreach($rows as $row){$f=strtoupper((string)$row['folio']);$taken[$f]=true;if(($provisional||(int)$row['client_id']===(int)$c['id'])&&str_starts_with($f,$prefix)){$tail=substr($f,strlen($prefix));if(ctype_digit($tail))$max=max($max,(int)$tail);}}
        do{$max++;$value=$prefix.str_pad((string)$max,4,'0',STR_PAD_LEFT);}while(isset($taken[strtoupper($value)]));
        if(strlen($value)>128)throw new RecoveryConflict('FOLIO_TOO_LONG','El folio excede la longitud disponible.');
        return ['folio'=>$value,'client'=>$c['legal_name']??null]; // Suggestion; uniqueness rechecked under lock on save.
    }
    private function associations(int $org):array
    {
        $maps=[];
        foreach(['rfqs','supplier_quotes','customer_quote_versions','requisition_reviews','awards','invoices','requisition_change_requests','service_orders'] as $t){
            // A withdrawn R3A proposal does not keep an otherwise editable RF1 draft locked forever.
            $condition=$t==='requisition_change_requests'?" AND status_code NOT IN ('withdrawn','rejected')":'';
            $list=$this->rows('SELECT * FROM `'.$t.'` WHERE organization_id=?'.$condition,[$org]);
            foreach($list as $row)$maps[$t][(int)$row['requisition_id']][]=$row;
        }
        $pos=$this->rows(<<<'SQL'
            SELECT pr.requisition_id,p.id,p.legacy_status,p.operational_status,
              gr.id AS receipt_id,gr.legacy_received_percent,JSON_UNQUOTE(JSON_EXTRACT(gr.legacy_delivery_snapshot,'$.clientAccept')) AS client_accept
            FROM purchase_order_requisitions pr JOIN purchase_orders p ON p.id=pr.purchase_order_id AND p.organization_id=pr.organization_id
            LEFT JOIN goods_receipts gr ON gr.id=(SELECT MIN(gr0.id) FROM goods_receipts gr0 WHERE gr0.purchase_order_id=p.id AND gr0.organization_id=p.organization_id)
            WHERE pr.organization_id=? AND LOWER(COALESCE(p.legacy_status,p.operational_status,'')) NOT IN ('cancelada','sustituida','cancelled','superseded')
            ORDER BY p.id,gr.id
            SQL,[$org]);
        foreach($pos as $row)$maps['pos'][(int)$row['requisition_id']][]=$row;
        return $maps;
    }
    /** Original eight-stage matrix policy. Complex history/change flows are not inferred. */
    public static function stage(array $row,array $m):?int
    {
        if(!empty($row['history_based'])||!empty($row['latest_change_request_id']))return null;
        $id=(int)$row['db_id'];$pos=$m['pos'][$id]??[];$s=0;
        foreach($m['invoices'][$id]??[] as $inv){if(!in_array(strtolower((string)($inv['legacy_status']??$inv['status_code']??'')),['cancelada','cancelled'],true))return 7;}
        if($pos){
            $hasReceipt=false;$allAccepted=true;
            foreach($pos as $p){$hasReceipt=$hasReceipt||!empty($p['receipt_id']);$allAccepted=$allAccepted&&!empty($p['receipt_id'])&&(float)$p['legacy_received_percent']>=100&&str_contains((string)$p['client_accept'],'Aceptado');}
            if($allAccepted)return 6;if($hasReceipt)return 5;return 4;
        }
        foreach($m['supplier_quotes'][$id]??[] as $q)if(preg_match('/Seleccionada|Preseleccionada|Adjudicada/i',(string)($q['legacy_status']??'')))$s=3;
        if(!empty($m['awards'][$id]))$s=3;
        if($s<2&&(!empty($m['supplier_quotes'][$id])||!empty($m['rfqs'][$id])))$s=2;
        if($s<1&&!empty($m['requisition_reviews'][$id]))$s=1;
        if(!empty($m['customer_quote_versions'][$id]))$s=3;
        return $s;
    }
    public function matrix(int $org,int $actor):array
    {
        $rows=$this->rows('SELECT '.self::header().' '.self::base().' WHERE r.organization_id=? AND e.archived_at IS NULL ORDER BY e.id DESC',[$org]);
        $maps=$this->associations($org);
        // Include cancelled/superseded links in write protection even though stage calculation excludes those POs.
        foreach($this->rows('SELECT requisition_id FROM purchase_order_requisitions WHERE organization_id=?',[$org]) as $linked)$maps['all_po_links'][(int)$linked['requisition_id']][]=true;
        $docs=$this->rows("SELECT ef.entity_id,f.public_id AS id,ef.original_filename AS name FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE ef.organization_id=? AND ef.file_role='documentFile' ORDER BY ef.id",[$org]);
        $byDoc=[];foreach($docs as $doc)$byDoc[(int)$doc['entity_id']]=['id'=>$doc['id'],'name'=>$doc['name']];
        foreach($rows as &$r){
            $dbId=(int)$r['db_id'];$stage=self::stage($r,$maps);$qa=$r['request_source_type']==='supplyflow_v07_draft';
            $owned=$r['imported_at']===null&&(bool)$r['rf1_owned'];
            $dependencies=false;foreach($maps as $group)if(!empty($group[$dbId]))$dependencies=true;
            $r['editable']=(($owned||$qa)&&(int)$r['created_by']===$actor&&!$dependencies&&!preg_match('/^Regularizada/u',(string)$r['regularization_status']));
            $r['edit_mode']=$qa?'qa_compat':'rf1';
            $r['restriction']=$r['editable']?null:($r['imported_at']!==null?'Histórico importado: edición pendiente de conciliación.':($dependencies?'Requiere Control de cambios.':'Sin autorización de edición en este piloto.'));
            $r['stage_index']=$stage;$r['stage']=$stage===null?'Pendiente de equivalencia de etapas':self::STAGES[$stage];$r['progress']=$stage===null?null:self::PROGRESS[$stage];
            $r['document']=$byDoc[$dbId]??null;$r['version']=(int)$r['version'];$r['line_count']=(int)$r['line_count'];$r['is_provisional']=(bool)$r['is_provisional'];
            unset($r['db_id'],$r['created_by'],$r['rf1_owned'],$r['imported_at'],$r['latest_change_request_id']);
        }unset($r);
        return ['items'=>$rows,'total'=>count($rows),'stage_policy'=>'apps-script-eight-stage-matrix','read_only_history'=>true];
    }
    private function canEdit(array $r,int $actor):bool{return $r['imported_at']===null&&($r['rf1_owned']||$r['request_source_type']==='supplyflow_v07_draft')&&(int)$r['created_by']===$actor;}
    private function assertNoDependencies(int $org,int $id):void
    {
        foreach(['rfqs','supplier_quotes','customer_quote_versions','purchase_order_requisitions','requisition_reviews','requisition_change_requests','awards','service_orders','invoices'] as $t){
            $condition=$t==='requisition_change_requests'?" AND status_code NOT IN ('withdrawn','rejected')":'';
            if($this->one('SELECT 1 AS found FROM `'.$t.'` WHERE organization_id=? AND requisition_id=?'.$condition.' LIMIT 1',[$org,$id]))throw new RecoveryConflict('CONTROLLED_CHANGE_REQUIRED','Requisición protegida por trazabilidad. Requiere Control de cambios.');
        }
    }
    public function detail(int $org,int $actor,string $public):?array
    {
        $r=$this->one('SELECT '.self::header().' '.self::base().' WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL',[$org,$public]);
        if(!$r)return null;$id=(int)$r['db_id'];$r['editable']=$this->canEdit($r,$actor)&&!preg_match('/^Regularizada/u',(string)$r['regularization_status']);
        if($r['editable'])try{$this->assertNoDependencies($org,$id);}catch(RecoveryConflict){$r['editable']=false;}
        $r['edit_mode']=$r['request_source_type']==='supplyflow_v07_draft'?'qa_compat':'rf1';
        $r['version']=(int)$r['version'];$r['line_count']=(int)$r['line_count'];
        $type=$r['request_source_type'];if(!in_array($type,RequisitionRecoveryInput::SOURCES,true))$type=$r['is_provisional']?'Otro':RequisitionRecoveryInput::FORMAL;
        $r['source']=['type'=>$type,'date'=>$r['request_source_date']??$r['request_date'],'reference'=>$r['request_source_reference']??'','notes'=>$r['request_source_notes']??'',
            'requirement'=>in_array($r['regularization_requirement'],['formal','alternative','contract'],true)?$r['regularization_requirement']:'formal','due_date'=>$r['regularization_due_date'],'owner'=>$r['regularization_owner_snapshot']??''];
        $r['items']=$this->rows('SELECT public_id AS id,description,quantity,unit_label AS unit,category_label_snapshot AS category FROM requisition_items WHERE organization_id=? AND requisition_id=? ORDER BY line_number,id',[$org,$id]);
        $d=$this->one("SELECT f.public_id AS id,ef.original_filename AS name,f.size_bytes AS size,f.detected_mime AS mime FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE ef.organization_id=? AND ef.entity_id=? AND ef.file_role='documentFile' ORDER BY ef.id DESC LIMIT 1",[$org,$id]);
        $r['document']=$d;$r['regularization_details']=$this->regularization($org,$public);unset($r['db_id'],$r['created_by'],$r['rf1_owned'],$r['imported_at'],$r['latest_change_request_id']);return $r;
    }
    public function document(int $org,string $public):?array
    {
        $r=$this->one(<<<'SQL'
            SELECT f.scan_status,f.storage_backend,f.storage_key,f.detected_mime,f.size_bytes,HEX(f.sha256) AS sha256,ef.original_filename
            FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN entity_files ef ON ef.entity_id=r.id AND ef.organization_id=r.organization_id AND ef.file_role='documentFile'
            JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id
            WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL ORDER BY ef.id DESC LIMIT 1
            SQL,[$org,$public]);
        if(!$r)return null;
        if($r['scan_status']==='quarantined')throw new RecoveryConflict('DOCUMENT_QUARANTINED','Archivo no disponible para consulta.');
        $path='';
        if($r['storage_backend']==='supplyflow_rf1_private'&&preg_match('/^[1-9][0-9]*\/[a-f0-9]{64}$/D',$r['storage_key']))$path=$this->root.'/'.$r['storage_key'];
        if($r['storage_backend']==='supplyflow_local_private_v1'&&preg_match('~^imports/'.self::SOURCE_HASH.'/files/([a-f0-9]{64}\.(?:pdf|png|jpg|bin))$~D',$r['storage_key'],$m))$path='/run/supply-import-files/'.$m[1];
        if($path===''||!is_file($path)||is_link($path)||filesize($path)!==(int)$r['size_bytes']||!hash_equals(strtolower($r['sha256']),hash_file('sha256',$path)))throw new RecoveryConflict('DOCUMENT_UNAVAILABLE','El archivo no está disponible o no coincide con su huella.');
        $r['path']=$path;return $r;
    }
    private function setDocument(int $org,int $actor,int $id,int $version,?array $doc):?array
    {
        $old=$this->one("SELECT ef.file_id,f.public_id AS id,ef.original_filename AS name FROM entity_files ef JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id WHERE ef.organization_id=? AND ef.entity_id=? AND ef.file_role='documentFile' ORDER BY ef.id DESC LIMIT 1",[$org,$id]);
        if(isset($doc['id'])){if(!$old||$old['id']!==$doc['id'])throw new RecoveryConflict('DOCUMENT_MISMATCH','El archivo no pertenece a esta requisición.');return ['id'=>$old['id'],'name'=>$old['name']];}
        if($old)$this->run("UPDATE entity_files SET file_role='documentFile.history' WHERE organization_id=? AND entity_id=? AND file_role='documentFile'",[$org,$id]);
        if($doc===null)return null;
        $file=$this->one('SELECT id,public_id,scan_status,storage_backend,storage_key FROM files WHERE organization_id=? AND sha256=? AND size_bytes=?',[$org,hex2bin($doc['sha256']),$doc['size']]);
        if($file&&$file['scan_status']==='quarantined')throw new RecoveryConflict('DOCUMENT_QUARANTINED','Archivo no disponible para consulta.');
        if($file&&!in_array($file['storage_backend'],['supplyflow_rf1_private','supplyflow_local_private_v1'],true))throw new RecoveryConflict('FILE_STORAGE_UNKNOWN','Ese archivo requiere conciliación de almacenamiento.');
        if(!$file){
            $key=$org.'/'.$doc['sha256'];$path=$this->root.'/'.$key;$dir=dirname($path);
            if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('PRIVATE_STORAGE_UNAVAILABLE');
            if(is_link($path))throw new RuntimeException('PRIVATE_STORAGE_INVALID');
            if(!is_file($path)){
                $tmp=tempnam($dir,'.upload-');if($tmp===false)throw new RuntimeException('PRIVATE_STORAGE_UNAVAILABLE');
                try{if(file_put_contents($tmp,$doc['bytes'],LOCK_EX)!==$doc['size']||!chmod($tmp,0600)||!rename($tmp,$path))throw new RuntimeException('PRIVATE_STORAGE_WRITE_FAILED');}finally{if(is_file($tmp))unlink($tmp);}
            }
            if(!hash_equals($doc['sha256'],hash_file('sha256',$path)))throw new RuntimeException('PRIVATE_STORAGE_INTEGRITY_FAILED');
            $public=self::uuid();$fid=$this->insert('files',['organization_id'=>$org,'public_id'=>$public,'storage_backend'=>'supplyflow_rf1_private','storage_key'=>$key,'detected_mime'=>$doc['mime'],'size_bytes'=>$doc['size'],'sha256'=>hex2bin($doc['sha256']),'scan_status'=>'pending','retention_class'=>'requisition_rf1','created_by'=>$actor,'created_at'=>self::now()]);
            $file=['id'=>$fid,'public_id'=>$public];
        }
        $this->insert('entity_files',['organization_id'=>$org,'entity_id'=>$id,'file_id'=>$file['id'],'association_key'=>'rf1-document-v'.$version,'file_role'=>'documentFile','original_filename'=>$doc['name'],'declared_mime'=>$doc['mime'],'declared_size_bytes'=>$doc['size'],'created_at'=>self::now()]);
        return ['id'=>$file['public_id'],'name'=>$doc['name'],'sha256'=>$doc['sha256'],'size'=>$doc['size']];
    }
    /**
     * Preserves the same requisition and all downstream RFQ/PO/receipt links.
     * A system snapshot stores fields not present in the legacy v0.3 columns.
     */
    public function regularize(int $org,int $actor,string $public,int $expected,array $input,string $key):array
    {
        $endpoint='requisition.rf1.regularize.'.$public;
        $hash=hash('sha256',self::json(['version'=>$expected,'data'=>RequisitionRegularizationInput::snapshot($input)]),true);
        $lock='supplyflow.rf1.org.'.$org;
        $got=$this->one('SELECT GET_LOCK(?,10) AS acquired',[$lock]);
        if((int)($got['acquired']??0)!==1)throw new RecoveryConflict('BUSY','La operación está ocupada.');
        $inTransaction=false;
        try{
            $this->db->begin_transaction();$inTransaction=true;
            if($again=$this->claim($org,$actor,$endpoint,$key,$hash)){
                $this->db->commit();$inTransaction=false;return $again;
            }
            $row=$this->one('SELECT '.self::header().' '.self::base().' WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL FOR UPDATE',[$org,$public]);
            if(!$row||$row['imported_at']!==null||!(bool)$row['rf1_owned']||(int)$row['created_by']!==$actor)
                throw new RecoveryConflict('READ_ONLY_RECORD','Este expediente aún no está habilitado para regularización.');
            if((int)$row['version']!==$expected)throw new RecoveryStale('El expediente cambió desde que fue consultado.');
            if(!(bool)$row['is_provisional']||preg_match('/^Regularizada/u',(string)$row['regularization_status']))
                throw new RecoveryConflict('NOT_PENDING_REGULARIZATION','El expediente no tiene una regularización pendiente.');
            $id=(int)$row['db_id'];$version=$expected+1;
            $evidence=$input['evidence']===null?null:$this->storeRegularizationEvidence($org,$actor,$id,$version,$input['evidence']);
            $status=$input['method']==='formal'?'Regularizada · Requisición formal':'Regularizada · Evidencia alternativa';
            // These are the only commercial columns updated: never replace the folio,
            // requester, lines, source, revision number, or downstream documents.
            $this->update('requisitions',['regularization_status'=>$status],
                'id=? AND organization_id=? AND (regularization_status IS NULL OR regularization_status NOT LIKE ?)',
                [$id,$org,'Regularizada%']);
            if($this->update('business_entities',[
                    'row_version'=>$version,'updated_at'=>self::now(),'updated_by'=>$actor
                ],'id=? AND organization_id=? AND row_version=?',[$id,$org,$expected])!==1)
                throw new RecoveryStale('El expediente cambió durante la regularización.');
            $metadata=RequisitionRegularizationInput::snapshot($input);
            $metadata['evidence']=$evidence;
            $metadata['status']=$status;
            $metadata['regularized_by']=$actor;
            $metadata['regularized_at_utc']=gmdate('c');
            $snapshot=self::json(['origin'=>'supplyflow_rf1_regularization','version'=>$version,'data'=>$metadata]);
            $this->insert('requisition_revision_snapshots',[
                'organization_id'=>$org,'requisition_id'=>$id,'revision_number'=>$version-1,
                'snapshot_schema_version'=>3,'snapshot_json'=>$snapshot,
                'snapshot_sha256'=>hash('sha256',$snapshot,true),'reason_text'=>'Regularización documental de solicitud provisional',
                'recorded_at'=>self::now(),'provenance'=>'system'
            ]);
            $this->insert('audit_events',[
                'organization_id'=>$org,'public_id'=>self::uuid(),'subject_entity_id'=>$id,
                'actor_user_id'=>$actor,'module_code'=>'requisitions','action_code'=>'requisition.rf1.regularize',
                'result_code'=>'success','occurred_at'=>self::now(),'recorded_at'=>self::now(),
                'changes_json'=>self::json(['previous_status'=>$row['regularization_status'],'new_status'=>$status,
                    'method'=>$input['method'],'reference'=>$input['reference'],'evidence_sha256'=>$evidence['sha256']??null,
                    'row_version'=>$version]),'source_kind'=>'system'
            ]);
            $result=['id'=>$public,'folio'=>$row['folio'],'version'=>$version,'status'=>$status,
                'regularization'=>$metadata,'replayed'=>false];
            $this->run("UPDATE idempotency_keys SET state_code='done',response_status=200,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?",
                [self::json($result),$org,$actor,$endpoint,hash('sha256',$key,true)]);
            $this->db->commit();$inTransaction=false;return $result;
        }catch(Throwable $e){if($inTransaction){try{$this->db->rollback();}catch(Throwable){}}throw $e;}
        finally{try{$this->one('SELECT RELEASE_LOCK(?) AS released',[$lock]);}catch(Throwable){}}
    }

    private function storeRegularizationEvidence(int $org,int $actor,int $id,int $version,array $doc):array
    {
        $file=$this->one('SELECT id,public_id,scan_status,storage_backend,storage_key FROM files WHERE organization_id=? AND sha256=? AND size_bytes=?',
            [$org,hex2bin($doc['sha256']),$doc['size']]);
        if($file&&($file['scan_status']==='quarantined'||!in_array($file['storage_backend'],['supplyflow_rf1_private','supplyflow_local_private_v1'],true)))
            throw new RecoveryConflict('EVIDENCE_UNAVAILABLE','La evidencia no está disponible.');
        if($file){
            $existingPath='';
            if($file['storage_backend']==='supplyflow_rf1_private'&&preg_match('/^[1-9][0-9]*\/[a-f0-9]{64}$/D',$file['storage_key']))
                $existingPath=$this->root.'/'.$file['storage_key'];
            if($file['storage_backend']==='supplyflow_local_private_v1'&&preg_match('~^imports/'.self::SOURCE_HASH.'/files/([a-f0-9]{64}\.(?:pdf|png|jpg|bin))$~D',$file['storage_key'],$m))
                $existingPath='/run/supply-import-files/'.$m[1];
            if($existingPath===''||!is_file($existingPath)||is_link($existingPath)||filesize($existingPath)!==$doc['size']||
                !hash_equals($doc['sha256'],hash_file('sha256',$existingPath)))
                throw new RecoveryConflict('EVIDENCE_UNAVAILABLE','La evidencia existente no puede verificarse.');
        }
        if(!$file){
            $key=$org.'/'.$doc['sha256'];$path=$this->root.'/'.$key;$dir=dirname($path);
            if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('PRIVATE_STORAGE_UNAVAILABLE');
            if(is_link($path))throw new RuntimeException('PRIVATE_STORAGE_INVALID');
            if(!is_file($path)){
                $tmp=tempnam($dir,'.reg-');if($tmp===false)throw new RuntimeException('PRIVATE_STORAGE_UNAVAILABLE');
                try{if(file_put_contents($tmp,$doc['bytes'],LOCK_EX)!==$doc['size']||!chmod($tmp,0600)||!rename($tmp,$path))
                    throw new RuntimeException('PRIVATE_STORAGE_WRITE_FAILED');}
                finally{if(is_file($tmp))unlink($tmp);}
            }
            if(!hash_equals($doc['sha256'],hash_file('sha256',$path)))throw new RuntimeException('PRIVATE_STORAGE_INTEGRITY_FAILED');
            $idFile=self::uuid();
            $fid=$this->insert('files',[
                'organization_id'=>$org,'public_id'=>$idFile,'storage_backend'=>'supplyflow_rf1_private',
                'storage_key'=>$key,'detected_mime'=>$doc['mime'],'size_bytes'=>$doc['size'],
                'sha256'=>hex2bin($doc['sha256']),'scan_status'=>'pending','retention_class'=>'requisition_rf1',
                'created_by'=>$actor,'created_at'=>self::now()
            ]);
            $file=['id'=>$fid,'public_id'=>$idFile];
        }
        $this->insert('entity_files',[
            'organization_id'=>$org,'entity_id'=>$id,'file_id'=>$file['id'],
            'association_key'=>'rf1-regularization-v'.$version,'file_role'=>'regularizationEvidence',
            'original_filename'=>$doc['name'],'declared_mime'=>$doc['mime'],
            'declared_size_bytes'=>$doc['size'],'created_at'=>self::now()
        ]);
        return ['id'=>$file['public_id'],'name'=>$doc['name'],'mime'=>$doc['mime'],
            'size'=>$doc['size'],'sha256'=>$doc['sha256']];
    }

    public function regularization(int $org,string $public):?array
    {
        $row=$this->one(<<<'SQL'
            SELECT r.id AS db_id,r.is_provisional,r.regularization_status,e.row_version
            FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL
            SQL,[$org,$public]);
        if(!$row)return null;
        $s=$this->one("SELECT snapshot_json FROM requisition_revision_snapshots WHERE organization_id=? AND requisition_id=? AND snapshot_schema_version=3 AND provenance='system' AND JSON_UNQUOTE(JSON_EXTRACT(snapshot_json, '$.origin'))='supplyflow_rf1_regularization' ORDER BY id DESC LIMIT 1",
            [$org,$row['db_id']]);
        $data=$s?json_decode($s['snapshot_json'],true,512,JSON_THROW_ON_ERROR):null;
        if($data&&($data['origin']??null)!=='supplyflow_rf1_regularization')throw new RuntimeException('REGULARIZATION_SNAPSHOT_INVALID');
        return ['is_provisional'=>(bool)$row['is_provisional'],'status'=>$row['regularization_status'],
            'version'=>(int)$row['row_version'],'regularization'=>$data['data']??null];
    }

    public function regularizationDocument(int $org,string $public):?array
    {
        $r=$this->one(<<<'SQL'
            SELECT f.scan_status,f.storage_backend,f.storage_key,f.detected_mime,f.size_bytes,HEX(f.sha256) AS sha256,ef.original_filename
            FROM requisitions r JOIN business_entities e ON e.id=r.id AND e.organization_id=r.organization_id
            JOIN entity_files ef ON ef.entity_id=r.id AND ef.organization_id=r.organization_id AND ef.file_role='regularizationEvidence'
            JOIN files f ON f.id=ef.file_id AND f.organization_id=ef.organization_id
            WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL ORDER BY ef.id DESC LIMIT 1
            SQL,[$org,$public]);
        if(!$r)return null;
        if($r['scan_status']==='quarantined')throw new RecoveryConflict('DOCUMENT_QUARANTINED','Archivo no disponible.');
        $path='';
        if($r['storage_backend']==='supplyflow_rf1_private'&&preg_match('/^[1-9][0-9]*\/[a-f0-9]{64}$/D',$r['storage_key']))$path=$this->root.'/'.$r['storage_key'];
        if($r['storage_backend']==='supplyflow_local_private_v1'&&preg_match('~^imports/'.self::SOURCE_HASH.'/files/([a-f0-9]{64}\.(?:pdf|png|jpg|bin))$~D',$r['storage_key'],$m))$path='/run/supply-import-files/'.$m[1];
        if($path===''||!is_file($path)||is_link($path)||filesize($path)!==(int)$r['size_bytes']||!hash_equals(strtolower($r['sha256']),hash_file('sha256',$path)))
            throw new RecoveryConflict('DOCUMENT_UNAVAILABLE','La evidencia no está disponible o fue alterada.');
        $r['path']=$path;return $r;
    }

    private function claim(int $org,int $actor,string $ep,string $key,string $hash):?array
    {
        $old=$this->one('SELECT request_sha256,state_code,response_json FROM idempotency_keys WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=? FOR UPDATE',[$org,$actor,$ep,hash('sha256',$key,true)]);
        if($old){if(!hash_equals($hash,$old['request_sha256']))throw new RecoveryConflict('IDEMPOTENCY_CONFLICT','La clave ya fue utilizada con otro contenido.');if($old['state_code']!=='done')throw new RecoveryConflict('OPERATION_PENDING','La operación está pendiente.');$result=json_decode($old['response_json'],true,512,JSON_THROW_ON_ERROR);$result['replayed']=true;return $result;}
        $this->insert('idempotency_keys',['organization_id'=>$org,'actor_user_id'=>$actor,'endpoint_code'=>$ep,'key_sha256'=>hash('sha256',$key,true),'request_sha256'=>$hash,'state_code'=>'processing','created_at'=>self::now(),'expires_at'=>gmdate('Y-m-d H:i:s',time()+30*86400)]);return null;
    }
    public function save(int $org,int $actor,?string $public,?int $expected,array $input,string $key):array
    {
        $ep=$public?'requisition.rf1.update.'.$public:'requisition.rf1.create';
        $hash=hash('sha256',self::json(['version'=>$expected,'data'=>RequisitionRecoveryInput::snapshot($input)]),true);
        $lock='supplyflow.rf1.org.'.$org;$got=$this->one('SELECT GET_LOCK(?,10) AS acquired',[$lock]);
        if((int)($got['acquired']??0)!==1)throw new RecoveryConflict('BUSY','La operación está ocupada. Reintenta el mismo guardado.');
        $inTransaction=false;
        try{
            $this->db->begin_transaction();$inTransaction=true;
            if($again=$this->claim($org,$actor,$ep,$key,$hash)){$this->db->commit();return $again;}
            $before=null;$old=null;$id=0;$newVersion=1;
            if($public!==null){
                $old=$this->one('SELECT '.self::header().' '.self::base().' WHERE r.organization_id=? AND e.public_id=? AND e.archived_at IS NULL FOR UPDATE',[$org,$public]);
                if(!$old||!$this->canEdit($old,$actor)||$old['request_source_type']==='supplyflow_v07_draft')throw new RecoveryConflict('READ_ONLY_RECORD','El registro no es editable con este contrato. El histórico y el borrador de QA no se convierten.');
                if((int)$old['version']!==$expected)throw new RecoveryStale('La requisición cambió desde que se abrió.');
                $id=(int)$old['db_id'];$this->assertNoDependencies($org,$id);$before=$this->detail($org,$actor,$public);$newVersion=(int)$old['version']+1;
            }
            $client=$this->one('SELECT c.id,c.code,c.legal_name,c.status_code FROM clients c JOIN business_entities e ON e.id=c.id AND e.organization_id=c.organization_id WHERE c.organization_id=? AND e.public_id=? AND e.archived_at IS NULL FOR UPDATE',[$org,$input['client_id']]);
            if(!$client||($client['status_code']!=='active'&&(!$old||$old['client_id']!==$input['client_id'])))throw new RecoveryConflict('CLIENT_UNAVAILABLE','Selecciona un cliente válido. Al editar se conserva el cliente original aunque esté inactivo.');
            if(!$this->one('SELECT code FROM currencies WHERE code=? AND active=1',[$input['currency']]))throw new RecoveryConflict('CURRENCY_UNAVAILABLE','La moneda no está activa.');
            if($this->one('SELECT id FROM requisitions WHERE organization_id=? AND BINARY UPPER(folio)=BINARY UPPER(?) AND id<>? LIMIT 1',[$org,$input['folio'],$id]))throw new RecoveryConflict('DUPLICATE_FOLIO','Ya existe una requisición con ese folio. Captura uno diferente o vuelve a generarlo.');
            if($public===null){$public=self::uuid();$id=$this->insert('business_entities',['organization_id'=>$org,'public_id'=>$public,'entity_kind'=>'requisition','created_at'=>self::now(),'updated_at'=>self::now(),'created_by'=>$actor,'updated_by'=>$actor,'row_version'=>1]);}
            $src=$input['source'];$prov=$src['type']!==RequisitionRecoveryInput::FORMAL;
            $status=$prov?(['formal'=>'Pendiente de requisición formal','alternative'=>'Pendiente validar evidencia alternativa','contract'=>'Pendiente validar base contractual'][$src['requirement']]):'Formal desde origen';
            $values=['client_id'=>$client['id'],'folio'=>$input['folio'],'client_reference'=>$input['client_reference'],'request_date'=>$input['request_date'],'need_date'=>$input['need_date'],'priority_code'=>$input['priority'],'route_code'=>'supply',
                'client_snapshot'=>self::json(['code'=>$client['code'],'legal_name'=>$client['legal_name']]),'project_reference_snapshot'=>$input['project'],'contract_reference_snapshot'=>$input['contract'],'requester_name'=>$input['requester_name'],'requester_email'=>$input['requester_email'],'delivery_place'=>$input['delivery_place'],'budget_amount'=>$input['budget'],'currency_code'=>$input['currency'],'description'=>$input['description'],'notes'=>$input['notes'],
                'request_source_type'=>$src['type'],'request_source_date'=>$src['date'],'request_source_reference'=>$src['reference'],'request_source_notes'=>$src['notes'],'is_provisional'=>(int)$prov,'formal_at_origin'=>(int)!$prov,'provisional_folio'=>$prov?($old['provisional_folio']??$input['folio']):null,'provisional_created_at'=>$prov?($old['provisional_created_at']??self::now()):null,
                'regularization_requirement'=>$src['requirement'],'regularization_due_date'=>$src['due_date'],'regularization_owner_snapshot'=>$src['owner'],'regularization_status'=>$status,'current_revision_number'=>$old['current_revision_number']??0];
            if($old){
                // A different endpoint must implement regularization; do not erase its evidence by a normal edit.
                if(preg_match('/^Regularizada/u',(string)$old['regularization_status']))throw new RecoveryConflict('REGULARIZED_RECORD','La requisición regularizada requiere el flujo de cambios controlados.');
                $this->update('requisitions',$values,'id=? AND organization_id=?',[$id,$org]);
            }else{$values['id']=$id;$values['organization_id']=$org;$values['provisional_created_at']=$prov?self::now():null;$this->insert('requisitions',$values);}
            $existing=$this->rows('SELECT id,public_id,line_number,category_id,category_label_snapshot FROM requisition_items WHERE organization_id=? AND requisition_id=? ORDER BY id FOR UPDATE',[$org,$id]);
            $by=[];$max=0;foreach($existing as $line){$by[$line['public_id']]=$line;$max=max($max,(int)$line['line_number']);}
            // Vacate ALL ordinals first. Reordering/removing/inserting must never collide with a remaining old line.
            if($existing)$this->run('UPDATE requisition_items SET line_number=line_number+? WHERE organization_id=? AND requisition_id=?',[$max+count($existing)+1001,$org,$id]);
            $kept=[];$lines=[];
            foreach($input['items'] as $n=>$line){
                $cat=$this->one('SELECT id,active FROM categories WHERE organization_id=? AND name=? ORDER BY active DESC,id LIMIT 1',[$org,$line['category']]);
                if(!$cat||(!(bool)$cat['active']&&(!isset($by[$line['id']??''])||$by[$line['id']]['category_label_snapshot']!==$line['category'])))throw new RecoveryConflict('CATEGORY_UNKNOWN','La categoría no existe en el catálogo. Su administración continúa pendiente de migración.');
                $row=['line_number'=>$n+1,'display_order'=>$n+1,'description'=>$line['description'],'quantity'=>$line['quantity'],'unit_label'=>$line['unit'],'category_label_snapshot'=>$line['category'],'category_id'=>$cat['id'],'line_status'=>'active'];
                if($line['id']!==null){if(!isset($by[$line['id']]))throw new RecoveryConflict('LINE_MISMATCH','La partida no pertenece a esta requisición.');$kept[$line['id']]=true;$this->update('requisition_items',$row,'id=? AND organization_id=? AND requisition_id=?',[$by[$line['id']]['id'],$org,$id]);}
                else{$line['id']=self::uuid();$row['public_id']=$line['id'];$row['organization_id']=$org;$row['requisition_id']=$id;$this->insert('requisition_items',$row);}
                $lines[]=$line;
            }
            foreach($by as $p=>$line)if(!isset($kept[$p]))$this->run('DELETE FROM requisition_items WHERE id=? AND organization_id=? AND requisition_id=?',[$line['id'],$org,$id]);
            $document=$this->setDocument($org,$actor,$id,$newVersion,$input['document']);
            if($old&&$this->update('business_entities',['row_version'=>$newVersion,'updated_at'=>self::now(),'updated_by'=>$actor],'id=? AND organization_id=? AND row_version=?',[$id,$org,$expected])!==1)throw new RecoveryStale('La requisición cambió desde que se abrió.');
            $snap=RequisitionRecoveryInput::snapshot($input);$snap['items']=$lines;$snap['document']=$document;
            $snapshot=self::json(['origin'=>self::ORIGIN,'version'=>$newVersion,'data'=>$snap]);
            $this->insert('requisition_revision_snapshots',['organization_id'=>$org,'requisition_id'=>$id,'revision_number'=>$newVersion-1,'snapshot_schema_version'=>2,'snapshot_json'=>$snapshot,'snapshot_sha256'=>hash('sha256',$snapshot,true),'reason_text'=>$old?'Requisición actualizada':'Requisición creada','recorded_at'=>self::now(),'provenance'=>'system']);
            $this->insert('audit_events',['organization_id'=>$org,'public_id'=>self::uuid(),'subject_entity_id'=>$id,'actor_user_id'=>$actor,'module_code'=>'requisitions','action_code'=>$old?'requisition.rf1.update':'requisition.rf1.create','result_code'=>'success','occurred_at'=>self::now(),'recorded_at'=>self::now(),'changes_json'=>self::json(['before'=>$before,'after'=>$snap,'row_version'=>$newVersion]),'source_kind'=>'system']);
            $out=['id'=>$public,'folio'=>$input['folio'],'version'=>$newVersion,'line_count'=>count($lines),'replayed'=>false,'source_type'=>$src['type']];
            $this->run("UPDATE idempotency_keys SET state_code='done',response_status=200,response_json=? WHERE organization_id=? AND actor_user_id=? AND endpoint_code=? AND key_sha256=?",[self::json($out),$org,$actor,$ep,hash('sha256',$key,true)]);
            $this->db->commit();return $out;
        }catch(Throwable $e){if($inTransaction){try{$this->db->rollback();}catch(Throwable){}}throw $e;}
        finally{try{$this->one('SELECT RELEASE_LOCK(?) AS released',[$lock]);}catch(Throwable){/* Do not hide a primary exception. Connection close also releases it. */}}
    }
}
final class RecoveryConflict extends RuntimeException
{
    public function __construct(public readonly string $errorCode,string $message){parent::__construct($message);}
}
final class RecoveryStale extends RuntimeException{}
