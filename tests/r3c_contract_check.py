from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
read=lambda name:(ROOT/name).read_text(encoding='utf-8')
checks={
 'route': "api/v1/recovery/changes/(:segment)/impact" in read('backend/app/Config/Routes.php'),
 'controller method': 'public function impact(string $id)' in read('backend/app/Controllers/RequisitionChangeController.php'),
 'reviewer scope reused': 'self::scope()' in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'fixed dependency allowlist': 'private const DEPENDENCY_TABLES=' in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'read only impact': 'informational_only' in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'downstream blocking retained': 'DOWNSTREAM_RECONCILIATION_REQUIRED' in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'snapshot conflict blocking retained': 'SNAPSHOT_NUMBER_OCCUPIED' in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'approval still second admin': 'ce.created_by<>?' in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'R3C additions not autoapprove': "'status_code'=>'pending_review'" in read('backend/app/Libraries/RequisitionChangeRepository.php'),
 'new id server generated': '$newPublic=self::uuid();' in read('backend/app/Libraries/RequisitionChangeRepository.php'),
 'new item initially unattached': "'item_id'=>null" in read('backend/app/Libraries/RequisitionChangeRepository.php'),
 'new source category verified': "CATEGORY_UNAVAILABLE" in read('backend/app/Libraries/RequisitionChangeRepository.php'),
 'item insert transactional': "'created_by_change_request_id'=>$id" in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'item proposal linked': "UPDATE requisition_change_items SET requisition_item_id=?" in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'existing line numbers preserved': "max($lastLine,(int)$existing['line_number'])" in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'idempotency remains': 'IDEMPOTENCY_COMMIT_FAILED' in read('backend/app/Libraries/RequisitionChangeRepository.php'),
 'R2 snapshot namespace guarded': 'SNAPSHOT_NUMBER_OCCUPIED' in read('backend/app/Libraries/RequisitionChangeDecisionRepository.php'),
 'migration separate': (ROOT/'migrations/manual/R3C1_requisition_change_add_check.sql').exists(),
}
source=read('backend/app/Libraries/RequisitionChangeDecisionRepository.php')
checks['no downstream writes']=not re.search(r'\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+`?(?:rfqs|customer_quotes|customer_quote_versions|supplier_quotes|purchase_orders|purchase_order_requisitions|delivery_items|sourcing_plans)\b',source,re.I)
schema=read('docker/supply-db/sql/01_schema.sql')
checks['schema original check']= "CONSTRAINT ck_reqchangeitems_target CHECK" in schema
checks['schema new row provenance']= "created_by_change_request_id BIGINT UNSIGNED NULL" in schema
checks['schema item FK']= "fk_reqchangeitems_item" in schema
mig=read('migrations/manual/R3C1_requisition_change_add_check.sql')
checks['migration replaces exact check']='DROP CONSTRAINT ck_reqchangeitems_target' in mig and 'ADD CONSTRAINT ck_reqchangeitems_target CHECK' in mig
checks['migration does not disable constraints']='foreign_key_checks = 0' not in mig.lower() and 'check_constraint_checks = 0' not in mig.lower()
for k,v in checks.items():
 if not v: raise AssertionError('FAILED '+k)
print(f'R3C STATIC CONTRACT: {len(checks)}/{len(checks)} PASS')
