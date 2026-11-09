#!/usr/bin/env python3
"""Offline checker against uploaded MariaDB v0.3 schema inventory; no DB access."""
import json, pathlib, re, sys
here=pathlib.Path(__file__).resolve()
delta=here.parents[1]
schema=json.loads((here.parents[1]/'docker/supply-db/schema_inventory_v03.json').read_text())
tables={t['name']:set(t['columns']) for t in schema['tables']}
repo=(delta/'backend/app/Libraries/RequisitionChangeRepository.php').read_text()
required={
 'business_entities':{'organization_id','public_id','entity_kind','created_at','updated_at','created_by','updated_by','row_version'},
 'requisition_change_requests':{'id','organization_id','requisition_id','folio','previous_revision_number','new_revision_number','request_date','requested_by_snapshot','source_label','change_type','reference_text','reason','impact_text','requires_sourcing','requires_supplier_confirmation','status_code'},
 'requisition_change_items':{'organization_id','requisition_id','change_request_id','change_ordinal','target_kind','requisition_item_id','field_code','change_kind','requires_sourcing','before_snapshot','after_snapshot','snapshot_schema_version','resolution_status'},
 'audit_events':{'organization_id','public_id','subject_entity_id','actor_user_id','module_code','action_code','result_code','occurred_at','recorded_at','changes_json','source_kind'},
 'idempotency_keys':{'organization_id','actor_user_id','endpoint_code','key_sha256','request_sha256','state_code','created_at','expires_at','response_status','response_json'},
 'requisitions':{'id','organization_id','folio','current_revision_number','need_date','delivery_place'},
 'requisition_items':{'id','public_id','description','quantity','unit_label','category_label_snapshot','line_status'},
 'requisition_revision_snapshots':{'organization_id','requisition_id','provenance','snapshot_schema_version','snapshot_json'},
 'categories':{'organization_id','name','active'},
}
for table,columns in required.items():
    missing=columns-tables.get(table,set())
    if missing:sys.exit(f'FAIL {table}: {sorted(missing)}')
for name in ('RequisitionChangeController','RequisitionChangeInput','RequisitionChangeRepository',
             'RequisitionChangeConflict','RequisitionChangeStale'):
    matches=list((delta/'backend/app').rglob(f'{name}.php'))
    if len(matches)!=1:sys.exit(f'FAIL file {name}')
routes=(delta/'backend/app/Config/Routes.php').read_text()
for route in ('changes', 'changes/(:segment)', 'requisitions/(:segment)/changes', 'changes/(:segment)/withdraw'):
    if route not in routes:sys.exit('FAIL missing route '+route)
if 'UPDATE `requisitions`' in repo or "'requisitions',[" in repo or "'requisition_items',[" in repo:
    sys.exit('FAIL commercial table modifications detected')
print('R3A STATIC SCHEMA/ROUTES/IMMUTABILITY CHECK: PASS (9 schema tables, 4 routes)')
