#!/usr/bin/env python3
"""SupplyFlow v0.7: provision a least-privilege write account on local MariaDB socket.
No schema, business-record or historical data mutation; SQL login only.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
import pymysql

USER = 'supplyflow_reqwrite_local'
HOST = '%'
DB = 'supplyflow_dev'
GRANT_DB = DB  # Table-level grants use the exact database name, not a LIKE-style grant pattern
SECRETS = Path('/run/supply-secrets')
SELECT_TABLES = {
    'clients', 'currencies', 'business_entities', 'requisitions', 'requisition_items',
    'idempotency_keys', 'document_sequences', 'rfqs', 'supplier_quotes',
    'customer_quote_versions', 'purchase_order_requisitions', 'requisition_reviews',
    'requisition_change_requests',
}
INSERT_TABLES = {
    'business_entities', 'requisitions', 'requisition_items', 'requisition_revision_snapshots',
    'audit_events', 'workflow_events', 'idempotency_keys', 'document_sequences',
}
UPDATE_TABLES = {
    'business_entities', 'requisitions', 'requisition_items', 'idempotency_keys', 'document_sequences',
}
DELETE_TABLES = {'requisition_items'}
EXPECTED = {(table, privilege) for privilege, tables in
            [('SELECT', SELECT_TABLES), ('INSERT', INSERT_TABLES),
             ('UPDATE', UPDATE_TABLES), ('DELETE', DELETE_TABLES)] for table in tables}

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
    report = {'kit': 'SupplyFlow Requisitions v0.7', 'action': sys.argv[1] if len(sys.argv) > 1 else '',
              'result': 'FAIL', 'time_utc': datetime.now(timezone.utc).isoformat()}
    conn = None
    try:
        require(report['action'] in ('provision', 'verify'), 'ACTION_UNKNOWN')
        root = (SECRETS / 'mariadb-root.txt').read_text(encoding='utf8').strip()
        password = (SECRETS / 'reqwrite-db-password.txt').read_text(encoding='utf8').strip()
        require(bool(re.fullmatch(r'[0-9a-f]{64}', password)), 'PASSWORD_FILE_INVALID')
        conn = pymysql.connect(unix_socket='/run/mysqld/mysqld.sock', user='root', password=root,
                               charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor, autocommit=True)
        version = query(conn, 'SELECT VERSION() AS v')[0]['v']
        require(version.startswith('11.8.9-MariaDB'), 'WRONG_DB_VERSION')
        schema = query(conn, "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=%s AND table_type='BASE TABLE'", (DB,))[0]['n']
        require(int(schema) == 74, 'WRONG_SCHEMA')
        require(int(query(conn, 'SELECT COUNT(*) AS n FROM supplyflow_dev.users')[0]['n']) >= 17, 'USERS_IMPORT_MISSING')
        locked = query(conn, 'SELECT GET_LOCK(%s,10) AS got', ('supplyflow_reqwrite_provision_v07',))[0]['got']
        require(locked == 1, 'PROVISION_LOCKED')
        exists = query(conn, 'SELECT Host FROM mysql.global_priv WHERE User=%s', (USER,))
        require(not exists or (len(exists) == 1 and exists[0]['Host'] == HOST), 'UNEXPECTED_SQL_ACCOUNT')
        if not exists:
            require(report['action'] == 'provision', 'SQL_ACCOUNT_MISSING')
            query(conn, 'CREATE USER %s@%s IDENTIFIED VIA mysql_native_password USING PASSWORD(%s)', (USER,HOST,password))
        auth = query(conn, "SELECT JSON_VALUE(Priv,'$.plugin') AS plugin,JSON_VALUE(Priv,'$.authentication_string')=PASSWORD(%s) AS matches FROM mysql.global_priv WHERE User=%s AND Host=%s", (password, USER,HOST))
        require(len(auth)==1 and auth[0]['plugin']=='mysql_native_password' and int(auth[0]['matches'])==1,
                'SQL_CREDENTIAL_MISMATCH')
        grantee = "'"+USER+"'@'%'"
        require(all(x['PRIVILEGE_TYPE']=='USAGE' for x in query(conn, 'SELECT PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=%s',(grantee,))), 'GLOBAL_PRIVILEGES_FORBIDDEN')
        require(not query(conn, 'SELECT * FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=%s',(grantee,)), 'SCHEMA_PRIVILEGES_FORBIDDEN')
        def privileges():
            rows = query(conn, 'SELECT TABLE_SCHEMA,TABLE_NAME,PRIVILEGE_TYPE,IS_GRANTABLE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=%s',(grantee,))
            require(all(row['TABLE_SCHEMA'] in (DB,GRANT_DB) and row['IS_GRANTABLE']=='NO' for row in rows), 'OTHER_DB_PRIVILEGES_FORBIDDEN')
            require(not query(conn,'SELECT * FROM information_schema.COLUMN_PRIVILEGES WHERE GRANTEE=%s',(grantee,)), 'COLUMN_PRIVILEGES_FORBIDDEN')
            actual = {(row['TABLE_NAME'],row['PRIVILEGE_TYPE']) for row in rows}
            require(actual <= EXPECTED, 'UNEXPECTED_TABLE_PRIVILEGES')
            return actual
        current = privileges()
        if report['action'] == 'provision':
            for table, priv in sorted(EXPECTED-current):
                query(conn, f'GRANT {priv} ON `{GRANT_DB}`.`{table}` TO %s@%s', (USER,HOST))
        require(privileges() == EXPECTED, 'PRIVILEGES_INCOMPLETE')
        report.update(result='PASS', status='REQWRITE_PROVISIONED', account=USER, grants=len(EXPECTED),
                      database=DB, source_rows_changed=False, account_status='EXISTING_VERIFIED' if exists else 'CREATED')
    except Blocked as error:
        report.update(error_code=str(error))
    except Exception as error:
        report.update(error_code='SQL_PROVISION_FAILED', error_type=type(error).__name__, sql_errno=getattr(error,'args',[None])[0] if isinstance(error,pymysql.MySQLError) else None)
    finally:
        if conn:
            try: query(conn, 'SELECT RELEASE_LOCK(%s)', ('supplyflow_reqwrite_provision_v07',))
            except Exception: pass
            conn.close()
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report['result']=='PASS' else 1

if __name__ == '__main__':
    sys.exit(main())
