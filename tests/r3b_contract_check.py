#!/usr/bin/env python3
"""R3B static contract safety checks. Does not open DB or run network operations."""
import json
import pathlib
import re
import sys

root=pathlib.Path(__file__).resolve().parents[1]
schema=json.loads((root/'docker/supply-db/schema_inventory_v03.json').read_text())
tables={x['name']:set(x['columns']) for x in schema['tables']}
required={
 'requisition_change_requests': {'id','organization_id','requisition_id','status_code','previous_revision_number','new_revision_number','requires_sourcing','requires_supplier_confirmation','folio'},
 'requisition_change_items': {'organization_id','requisition_id','change_request_id','requisition_item_id','before_snapshot','after_snapshot','resolution_status','snapshot_schema_version'},
 'requisition_revision_snapshots': {'organization_id','requisition_id','revision_number','snapshot_schema_version','snapshot_json','snapshot_sha256','created_by_change_request_id','reason_text','recorded_at','provenance'},
 'requisitions': {'id','organization_id','current_revision_number','need_date','delivery_place','change_status','latest_change_request_id'},
 'requisition_items': {'id','organization_id','requisition_id','public_id','description','quantity','unit_id','unit_label','category_id','category_label_snapshot','line_status','cancelled_at','cancelled_by_change_request_id'},
 'business_entities': {'id','organization_id','row_version','updated_at','updated_by','created_by','archived_at','imported_at'},
 'idempotency_keys': {'organization_id','actor_user_id','endpoint_code','key_sha256','request_sha256','response_status','response_json','state_code','expires_at'},
 'audit_events': {'organization_id','public_id','subject_entity_id','actor_user_id','module_code','action_code','occurred_at','recorded_at','changes_json'},
 'sourcing_plans': {'organization_id','requisition_id'},
 'rfqs': {'organization_id','requisition_id'},
 'supplier_quotes': {'organization_id','requisition_id'},
 'customer_quote_versions': {'organization_id','requisition_id'},
 'customer_quotes': {'organization_id','requisition_id'},
 'delivery_items': {'organization_id','requisition_id'},
 'requisition_reviews': {'organization_id','requisition_id'},
 'awards': {'organization_id','requisition_id'},
 'invoices': {'organization_id','requisition_id'},
 'service_orders': {'organization_id','requisition_id'},
 'purchase_order_requisitions': {'organization_id','requisition_id'},
 'categories': {'organization_id','name','active','id'},
}
for name, cols in required.items():
    missing=cols-tables.get(name,set())
    if missing:sys.exit(f'FAIL schema {name}: {sorted(missing)}')
repo=(root/'backend/app/Libraries/RequisitionChangeDecisionRepository.php').read_text()
controller=(root/'backend/app/Controllers/RequisitionChangeController.php').read_text()
route=(root/'backend/app/Config/Routes.php').read_text()
checks={
 'different reviewer': 'ce.created_by<>?' in repo,
 'auth required': "master_admin" in controller and "writeHeaders()" in controller,
 'immutable imports': 're.imported_at IS NULL' in repo,
 'RF1 provenance only': "supplyflow_recovery_rf1" in repo,
 'database transaction': all(v in repo for v in ['begin_transaction()','commit()','rollback()']),
 'idempotency': all(v in repo for v in ['IDEMPOTENCY_CONFLICT','idempotency_keys','request_sha256']),
 'lock': 'GET_LOCK' in repo and 'RELEASE_LOCK' in repo,
 'no downstream': all(f"'{table}'" in repo for table in ['sourcing_plans','rfqs','supplier_quotes','customer_quotes','customer_quote_versions','requisition_reviews','awards','invoices','service_orders','purchase_order_requisitions','delivery_items']),
 'snapshot collision guard': 'SNAPSHOT_NUMBER_OCCUPIED' in repo,
 'snapshot SHA': 'snapshot_sha256' in repo and "hash('sha256',$snapshot,true)" in repo,
 'not reusing orphan approvals': "status_code='pending_review'" in repo,
 'no PO update': "'purchase_orders',[" not in repo and "'supplier_quotes',[" not in repo,
 'no source insert': "$this->insert('requisition_change_requests'" not in repo,
 'audit': 'requisition.r3.change.applied' in repo and 'requisition.r3.change.rejected' in repo,
 'review methods': all(f'function {m}(' in controller for m in ['reviewQueue','reviewDetail','decide']),
 'no autoRoute': '$routes->setAutoRoute(false)' in route,
 'review queue route before generic': route.index("changes/review-queue")<route.index("changes/(:segment)',"),
 'decision route': 'changes/(:segment)/decision' in route,
 'blocked last-line delete': 'LAST_LINE' in (root/'backend/app/Libraries/RequisitionChangeApplication.php').read_text(),
 'withdrawn/rejected editable': "status_code NOT IN ('withdrawn','rejected')" in (root/'backend/app/Libraries/RequisitionRecoveryRepository.php').read_text(),
 'new request only pending blocks': "status_code='pending_review' LIMIT 1" in (root/'backend/app/Libraries/RequisitionChangeRepository.php').read_text(),
}
for key, val in checks.items():
    if not val:sys.exit('FAIL '+key)
print(f'R3B STATIC CONTRACT: PASS ({len(required)} schema tables, {len(checks)} checks)')
