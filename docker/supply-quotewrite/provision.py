#!/usr/bin/env python3
"""SupplyFlow · Cotizaciones: provision a least-privilege account to RECORD RFQs AND SUPPLIER QUOTES (internal record; nothing is
e-mailed, authorized or awarded) on the local MariaDB socket. Creates/verifies ONLY the SQL login supplyflow_quotewrite_local and its
grants (26 nov 2026):
- RFQ (card 2): record the RFQ (rfqs + rfq_items, folio RFQ-AAAA-NNNN, Borrador or Enviada) for a validated requisition, and mark
  a draft recorded in SupplyFlow as sent (column-level UPDATE only on rfqs.status_code and rfqs.legacy_status). Reads the latest
  contractor validation, suppliers and the purchasing contact (users/people/user_roles/roles).
- Supplier quote (card 4): record the quote a supplier sent against a sent RFQ (supplier_quotes + supplier_quote_items, folio
  COT-AAAA-NNNN) with its private PDF, and correct a quote recorded in SupplyFlow while it is not awarded (column-level UPDATE on the
  editable columns, business_entities version columns and entity_files.file_role for the replaced PDF).
- Client quote (card 6): record the client quote as an INTERNAL DRAFT (customer_quotes + customer_quote_versions + customer_quote_items)
  and edit that draft (column-level UPDATE on its data/amount columns only: no document/approval/decision status, issued_at or
  locked_at, so it cannot issue, authorize, lock or send a client quote).
No DELETE. It cannot change RFQ lines, issue or authorize client quotes, register client decisions, award or create POs, and it does not modify
the schema, business records or any other account (77/52, catalogwrite, useradmin and mgmtwrite keep their own).
Usage (profile quotewrite-tools): provision | verify
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
import pymysql

USER = 'supplyflow_quotewrite_local'
HOST = '%'
DB = 'supplyflow_dev'
SECRETS = Path('/run/supply-secrets')
SECRET_FILE = 'quotewrite-db-password.txt'
LOCK_NAME = 'supplyflow_quotewrite_provision_v1'
TABLES_EXPECTED = 77
SELECT_TABLES = {'business_entities', 'requisitions', 'requisition_items', 'requisition_reviews', 'rfqs', 'rfq_items', 'suppliers',
                 'supplier_quotes', 'supplier_quote_items', 'awards', 'currencies', 'files', 'entity_files', 'idempotency_keys',
                 'users', 'people', 'user_roles', 'roles', 'customer_quote_versions', 'customer_quote_items', 'approval_policy_versions'}
INSERT_TABLES = {'business_entities', 'rfqs', 'rfq_items', 'supplier_quotes', 'supplier_quote_items', 'files', 'entity_files',
                 'workflow_events', 'audit_events', 'idempotency_keys', 'customer_quotes', 'customer_quote_versions', 'customer_quote_items'}
UPDATE_TABLES = {'idempotency_keys'}
DELETE_TABLES = set()
UPDATE_COLUMNS = {
    'supplier_quotes': {'supplier_reference', 'quote_date', 'valid_until', 'currency_code', 'subtotal_amount', 'tax_rate_pct', 'tax_amount',
                        'total_amount', 'lead_days', 'payment_terms', 'technical_score', 'document_score', 'notes'},
    'supplier_quote_items': {'offered', 'quantity', 'unit_price', 'line_subtotal'},
    'business_entities': {'updated_at', 'updated_by', 'row_version'},
    'entity_files': {'file_role'},
    'rfqs': {'status_code', 'legacy_status'},
    # Card 6 internal draft of the client quote: data and amounts only; never status, issue, lock or authorization columns.
    'customer_quote_versions': {'approval_evaluation_snapshot', 'approval_policy_snapshot', 'approval_policy_version_id', 'currency_code', 'delivery_place', 'discount_amount', 'discount_kind', 'discount_rate_pct', 'eur_mxn_rate', 'exchange_rate_date', 'exchange_rate_label_snapshot', 'exchange_rate_source', 'exclusions_text', 'inclusions_text', 'lead_time_text', 'notes', 'payment_terms', 'people_snapshots', 'prepared_by', 'quote_date', 'service_fee_base_amount', 'service_fee_comments', 'service_fee_enabled', 'service_fee_rate_pct', 'service_fee_subtotal_amount', 'service_fee_tax_amount', 'service_fee_tax_rate_pct', 'service_fee_total_amount', 'service_fee_unit_price', 'subtotal_amount', 'tax_amount', 'tax_rate_pct', 'third_party_tax_amount', 'third_party_taxable_amount', 'third_party_total_amount', 'total_amount', 'usd_mxn_rate', 'valid_until', 'warranty_text'},
    'customer_quote_items': {'award_id', 'brand_model', 'charge_pct', 'cost_amount', 'cost_source_text', 'exchange_rate', 'exchange_rate_date', 'exchange_rate_source', 'extra_amount', 'line_subtotal', 'original_cost_amount', 'original_cost_currency', 'quantity', 'unit_price'},
}
EXPECTED = {(table, privilege) for privilege, tables in
            [('SELECT', SELECT_TABLES), ('INSERT', INSERT_TABLES), ('UPDATE', UPDATE_TABLES), ('DELETE', DELETE_TABLES)] for table in tables}
EXPECTED_COLUMNS = {(table, column, 'UPDATE') for table, columns in UPDATE_COLUMNS.items() for column in columns}

class Blocked(Exception):
    pass

def require(value: bool, code: str):
    if not value:
        raise Blocked(code)

def query(conn, sql, args=None):
    with conn.cursor() as cursor:
        cursor.execute(sql, args)
        return cursor.fetchall()

def main():
    report = {'kit': 'SupplyFlow Quote write v1', 'action': sys.argv[1] if len(sys.argv) > 1 else '',
              'result': 'FAIL', 'time_utc': datetime.now(timezone.utc).isoformat()}
    conn = None
    try:
        require(report['action'] in ('provision', 'verify'), 'ACTION_UNKNOWN')
        root = (SECRETS / 'mariadb-root.txt').read_text(encoding='utf8').strip()
        password = (SECRETS / SECRET_FILE).read_text(encoding='utf8').strip()
        require(bool(re.fullmatch(r'[0-9a-f]{64}', password)), 'PASSWORD_FILE_INVALID')
        conn = pymysql.connect(unix_socket='/run/mysqld/mysqld.sock', user='root', password=root,
                               charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor, autocommit=True)
        version = query(conn, 'SELECT VERSION() AS v')[0]['v']
        require(version.startswith('11.8.9-MariaDB'), 'WRONG_DB_VERSION')
        schema = query(conn, "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=%s AND table_type='BASE TABLE'", (DB,))[0]['n']
        require(int(schema) == TABLES_EXPECTED, 'WRONG_SCHEMA')
        locked = query(conn, 'SELECT GET_LOCK(%s,10) AS got', (LOCK_NAME,))[0]['got']
        require(locked == 1, 'PROVISION_LOCKED')
        exists = query(conn, 'SELECT Host FROM mysql.global_priv WHERE User=%s', (USER,))
        require(not exists or (len(exists) == 1 and exists[0]['Host'] == HOST), 'UNEXPECTED_SQL_ACCOUNT')
        if not exists:
            require(report['action'] == 'provision', 'SQL_ACCOUNT_MISSING')
            query(conn, 'CREATE USER %s@%s IDENTIFIED VIA mysql_native_password USING PASSWORD(%s)', (USER, HOST, password))
        auth = query(conn, "SELECT JSON_VALUE(Priv,'$.plugin') AS plugin,JSON_VALUE(Priv,'$.authentication_string')=PASSWORD(%s) AS matches FROM mysql.global_priv WHERE User=%s AND Host=%s", (password, USER, HOST))
        require(len(auth) == 1 and auth[0]['plugin'] == 'mysql_native_password' and int(auth[0]['matches']) == 1, 'SQL_CREDENTIAL_MISMATCH')
        grantee = "'" + USER + "'@'%'"
        require(all(x['PRIVILEGE_TYPE'] == 'USAGE' for x in query(conn, 'SELECT PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=%s', (grantee,))), 'GLOBAL_PRIVILEGES_FORBIDDEN')
        require(not query(conn, 'SELECT * FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=%s', (grantee,)), 'SCHEMA_PRIVILEGES_FORBIDDEN')
        def privileges():
            rows = query(conn, 'SELECT TABLE_SCHEMA,TABLE_NAME,PRIVILEGE_TYPE,IS_GRANTABLE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
            cols = query(conn, 'SELECT TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME,PRIVILEGE_TYPE,IS_GRANTABLE FROM information_schema.COLUMN_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
            require(all(r['TABLE_SCHEMA'] == DB and r['IS_GRANTABLE'] == 'NO' for r in rows + cols), 'OTHER_DB_PRIVILEGES_FORBIDDEN')
            actual = {(r['TABLE_NAME'], r['PRIVILEGE_TYPE']) for r in rows}
            actual_cols = {(r['TABLE_NAME'], r['COLUMN_NAME'], r['PRIVILEGE_TYPE']) for r in cols}
            require(actual <= EXPECTED, 'UNEXPECTED_TABLE_PRIVILEGES')
            require(actual_cols <= EXPECTED_COLUMNS, 'UNEXPECTED_COLUMN_PRIVILEGES')
            return actual, actual_cols
        current, current_cols = privileges()
        if report['action'] == 'provision':
            for table, priv in sorted(EXPECTED - current):
                query(conn, f'GRANT {priv} ON `{DB}`.`{table}` TO %s@%s', (USER, HOST))
            for table, column, priv in sorted(EXPECTED_COLUMNS - current_cols):
                query(conn, f'GRANT {priv} (`{column}`) ON `{DB}`.`{table}` TO %s@%s', (USER, HOST))
        current, current_cols = privileges()
        require(current == EXPECTED and current_cols == EXPECTED_COLUMNS, 'PRIVILEGES_INCOMPLETE')
        report.update(result='PASS', status='QUOTEWRITE_PROVISIONED', account=USER, grants=len(EXPECTED), column_grants=len(EXPECTED_COLUMNS),
                      database=DB, source_rows_changed=False, account_status='EXISTING_VERIFIED' if exists else 'CREATED')
    except Blocked as error:
        report.update(error_code=str(error))
    except Exception as error:
        report.update(error_code='SQL_PROVISION_FAILED', error_type=type(error).__name__, sql_errno=getattr(error, 'args', [None])[0] if isinstance(error, pymysql.MySQLError) else None)
    finally:
        if conn:
            try: query(conn, 'SELECT RELEASE_LOCK(%s)', (LOCK_NAME,))
            except Exception: pass
            conn.close()
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report['result'] == 'PASS' else 1

if __name__ == '__main__':
    sys.exit(main())
