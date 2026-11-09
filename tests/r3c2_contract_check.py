#!/usr/bin/env python3
"""Static tests only; no DB connection or automatic migrations."""
from pathlib import Path
import re
P=Path(__file__).resolve().parents[1]
read=lambda x:(P/x).read_text()
ctl=read('backend/app/Controllers/RequisitionChangeController.php')
repo=read('backend/app/Libraries/RequisitionCommercialAssessmentRepository.php')
inv=read('backend/app/Libraries/RequisitionCommercialInventory.php')
input_=read('backend/app/Libraries/RequisitionCommercialAssessmentInput.php')
routes=read('backend/app/Config/Routes.php')
decide=read('backend/app/Libraries/RequisitionChangeDecisionRepository.php')
ddl=read('migrations/manual/R3C2_commercial_assessment_ledger.sql')
schema=read('docker/supply-db/sql/01_schema.sql')
checks={
 'get route': "get('api/v1/recovery/changes/(:segment)/commercial-reconciliation'" in routes,
 'post route': "post('api/v1/recovery/changes/(:segment)/commercial-reconciliation'" in routes,
 'new get requires role': 'public function commercialReconciliation' in ctl and 'if($f=$this->authorize())return $f;' in ctl,
 'new post uses csrf and idempotency': 'public function recordCommercialReconciliation' in ctl and '[$key,$version]=$this->writeHeaders();' in ctl,
 'strict content type existing': "application/json" in ctl,
 'request scope RF1': "'supplyflow_recovery_rf1'" in repo and 're.imported_at IS NULL' in repo,
 'requester excluded': 'ce.created_by<>?' in repo,
 'foreign org scope': 'cr.organization_id=?' in repo,
 'tx and lock': 'begin_transaction()' in repo and 'GET_LOCK(?,10)' in repo and 'FOR UPDATE' in repo,
 'tx rollback': '$this->db->rollback()' in repo,
 'idempotency': "request_sha256" in repo and "IDEMPOTENCY_CONFLICT" in repo and "response_json" in repo,
 'precondition version': "change_version']!==$expectedChangeVersion" in repo and "requisition_version']!==$input['requisition_version']" in repo,
 'inventory hash binding': 'matchInventory($input,$inventory)' in repo,
 'audit': 'requisition.r3c2.assessment.recorded' in repo,
 'append-only treatment': "insert('requisition_change_commercial_assessments'" in repo and not re.search(r"(?:UPDATE|DELETE FROM|TRUNCATE).*requisition_change_commercial_assessments",repo,re.I),
 'cannot apply revision': "'revision_applied'=>false" in repo and "'commercial_reconciliation_complete'=>false" in repo,
 'R3B still blocks downstream': '$this->assertNoDownstream($org,$req);' in decide,
 'R3B dependent blocking unchanged': 'DOWNSTREAM_RECONCILIATION_REQUIRED' in decide,
 'schema references valid': all('CREATE TABLE '+t+' (' in schema for t in ['requisition_change_requests','purchase_orders','purchase_order_requisitions','goods_receipts']),
 'manual ddl (not auto)': 'NOT EXECUTED / NOT AUTO-RUN' in ddl and 'CREATE TABLE requisition_change_commercial_assessments' in ddl,
 'ddl actor FK': 'fk_r3c2_assessment_actor' in ddl and 'REFERENCES users' in ddl,
 'ddl change composite FK': 'fk_r3c2_assessment_change' in ddl and 'REFERENCES requisition_change_requests' in ddl,
 'ddl immutable versions': 'UNIQUE KEY uq_r3c2_assessment_version' in ddl,
 'inventory bounded': 'ROW_LIMIT=200' in inv and 'MAX_BYTES=16777216' in inv,
 'PO join': 'JOIN purchase_order_requisitions por' in inv,
 'missing tables cause hard failure': 'IMPACT_TOO_LARGE' in inv,
 'no user table identifiers': "in_array($table,self::TABLES,true)" in inv,
 'input no auto apply': "'acknowledge_not_approval'" in input_ and 'force_apply' not in input_,
}
for key,ok in checks.items(): print(('PASS' if ok else 'FAIL'),key)
assert all(checks.values()),'R3C2 contract failed'
print(f'R3C2 CONTRACT: {len(checks)}/{len(checks)} PASS')
