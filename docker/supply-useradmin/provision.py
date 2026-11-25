#!/usr/bin/env python3
"""SupplyFlow · Usuarios y roles: provision a least-privilege account for ACCESS MANAGEMENT on the local MariaDB socket.
Creates/verifies ONLY the SQL login supplyflow_useradmin_local and its grants (25 nov 2026): assign/reset a temporary credential,
grant/remove the Master Admin role and revoke the target's sessions, with idempotency and audit. Column-level UPDATE on `users`
(password_hash, credential_state, access_enabled, updated_at, row_version) and `auth_sessions` (revoked_at, revocation_reason):
it cannot change names, e-mails, status or any other table. It does not modify the schema, business records or any other account
(api/auth/reqwrite/recovery keep their 77/52 contract; catalogwrite keeps its own).
Usage (profile useradmin-tools): provision | verify
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
import pymysql

USER = 'supplyflow_useradmin_local'
HOST = '%'
DB = 'supplyflow_dev'
SECRETS = Path('/run/supply-secrets')
SECRET_FILE = 'useradmin-db-password.txt'
LOCK_NAME = 'supplyflow_useradmin_provision_v1'
TABLES_EXPECTED = 77
SELECT_TABLES = {'users', 'people', 'roles', 'user_roles', 'auth_sessions', 'idempotency_keys'}
INSERT_TABLES = {'user_roles', 'audit_events', 'idempotency_keys'}
UPDATE_TABLES = {'idempotency_keys'}
DELETE_TABLES = {'user_roles'}
UPDATE_COLUMNS = {
    'users': {'password_hash', 'credential_state', 'access_enabled', 'updated_at', 'row_version'},
    'auth_sessions': {'revoked_at', 'revocation_reason'},
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
    report = {'kit': 'SupplyFlow User admin v1', 'action': sys.argv[1] if len(sys.argv) > 1 else '',
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
        require(int(query(conn, "SELECT COUNT(*) AS n FROM supplyflow_dev.roles WHERE code='master_admin'")[0]['n']) >= 1, 'MASTER_ADMIN_ROLE_MISSING')
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
        report.update(result='PASS', status='USERADMIN_PROVISIONED', account=USER, grants=len(EXPECTED), column_grants=len(EXPECTED_COLUMNS),
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
