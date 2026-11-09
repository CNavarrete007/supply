from pathlib import Path
r=Path(__file__).resolve().parents[1]
app=r/'backend/app'
controller=(app/'Controllers/RequisitionChangeController.php').read_text()
routes=(app/'Config/Routes.php').read_text()
repo=(app/'Libraries/RequisitionCommercialExecutionRepository.php').read_text()
valid=(app/'Libraries/RequisitionCommercialExecutionInput.php').read_text()
ddl=(r/'migrations/manual/R3C3_commercial_execution_evidence.sql').read_text()
checks={
 'GET execution history route': "get('api/v1/recovery/changes/(:segment)/commercial-executions'" in routes,
 'POST evidence route': "post('api/v1/recovery/changes/(:segment)/commercial-executions'" in routes,
 'POST independent review route': "post('api/v1/recovery/changes/(:segment)/commercial-executions/(:segment)/review'" in routes,
 'route before generic': routes.index('/commercial-executions')<routes.index("$routes->get('api/v1/recovery/changes/(:segment)',"),
 'GET auth': 'function commercialExecutions' in controller and 'if($f=$this->authorize())return $f;' in controller,
 'record input': 'RequisitionCommercialExecutionInput::record($this->body())' in controller,
 'review input': 'RequisitionCommercialExecutionInput::review($this->body())' in controller,
 'record headers': controller.count('$this->writeHeaders()')>=5,
 'bound session': "'sf_session'" in controller,
 'CSRF': 'X-SF-CSRF' in controller,
 'org scope': 'ce.created_by<>?' in repo and 're.imported_at IS NULL' in repo,
 'assessment version': 'ASSESSMENT_REQUIRED' in repo and 'assessment_version' in repo,
 'inventory fingerprint': 'RequisitionCommercialInventory::read' in repo and 'inventory_sha256' in repo,
 'evidence clean': "f.scan_status='clean'" in repo,
 'evidence scoped': 'entity_files ef' in repo and 'ef.entity_id IN (?,?,?)' in repo,
 'document kinds fixed': all(f"'{x}'=>\"SELECT" in repo for x in ['rfqs','supplier_quotes','customer_quote_versions','purchase_orders']),
 'successor issued quote': "next['issued_at']" in repo and "next['approved_content_sha256']" in repo,
 'successor approved PO': "next['authorized_at']" in repo and "next['supersedes_purchase_order_id']" in repo,
 'no imported commercial documents': repo.count('e.imported_at IS NULL')>=4,
 'independent reviewer': "execution['recorded_by']===$actor" in repo,
 'append only ledger': 'INSERT INTO' in repo and 'UPDATE requisition_change_commercial_executions' not in repo,
 'no direct financial writes': not any(f"INSERT INTO `{x}`" in repo or f"UPDATE `{x}`" in repo for x in ['purchase_orders','customer_quote_versions','supplier_quotes']),
 'legacy R3B blocker unchanged': 'DOWNSTREAM_RECONCILIATION_REQUIRED' in (app/'Libraries/RequisitionChangeDecisionRepository.php').read_text(),
 'never release blocker': "'commercial_reconciliation_complete'=>false" in repo,
 'txn rollback': '$this->db->rollback()' in repo,
 'org advisory lock': 'supplyflow.rf1.org.' in repo,
 'idempotency': 'IDEMPOTENCY_CONFLICT' in repo and 'idempotency_keys' in repo,
 'audited': 'requisition.r3c3.evidence.reviewed' in repo and 'requisition.r3c3.evidence.recorded' in repo,
 'DDL append-only executions': 'CREATE TABLE requisition_change_commercial_executions' in ddl,
 'DDL action allowlist': 'ck_r3c3_exec_action' in ddl and 'ck_r3c3_exec_kind' in ddl,
 'no internal user IDs exposed': "'recorded_by_user_id'" not in repo and "'reviewed_by_user_id'" not in repo,
 'DDL append-only reviews': 'CREATE TABLE requisition_change_commercial_execution_reviews' in ddl,
 'DDL one review only': 'UNIQUE KEY uq_r3c3_review_once' in ddl,
 'DDL evidence FK': 'fk_r3c3_exec_file' in ddl,
 'DDL scoped assessment FK': 'fk_r3c3_exec_assessment FOREIGN KEY(assessment_id,organization_id,change_request_id,requisition_id)' in ddl,
 'DDL adds assessment composite unique': 'ADD UNIQUE KEY uq_r3c3_assessment_scope' in ddl,
 'DDL org FK': 'fk_r3c3_exec_change' in ddl and 'fk_r3c3_exec_document' in ddl,
 'no automatic DDL or GRANT': 'GRANT ' not in ddl.upper() and 'CREATE USER ' not in ddl.upper(),
 'no broad action': len(__import__('re').findall(r"'\w+'=>'",valid))>=1,
}
failed=[k for k,v in checks.items() if not v]
print('R3C3 contracts:',len(checks)-len(failed),'/',len(checks),'PASS' if not failed else 'FAIL')
for x in failed:print('FAIL',x)
if failed:raise SystemExit(1)
