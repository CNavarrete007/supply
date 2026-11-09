#!/usr/bin/env python3
"""One-purpose localhost-only bootstrap. No business-record upserts or imports."""
from __future__ import annotations
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import uuid

FOUNDATION = Path('/foundation/db_tools.py')
SCHEMA_HASH = '2592455e38491b644b0f2c734eadf3aa33db5ccdc57dbfa54229f616be4056e5'
FINGERPRINT = 'd01df78964032449733773e52b0564f6e92f2e5c5ff3c3f5de40550052baea5e'
SOURCE_HASH = 'cd9a8d0eb37b7c461cc1a269f7eb554d89fd76040963d539e4c3f6fbd8754619'
ORG_DB = 'supplyflow_dev'
ADMIN_EMAIL = 'carlos.navarrete@grupogerez.com'
USERNAME = 'supplyflow_auth_local'
ROOT_SECRET = Path('/run/supply-secrets/mariadb-root.txt')
AUTH_SECRET = Path('/run/supply-secrets/auth-db-password.txt')
ALLOWED_TABLES = ('users', 'people', 'roles', 'user_roles', 'permissions', 'role_permissions', 'user_permissions', 'auth_sessions')

class Halt(Exception): pass

# A static stage label, never SQL text, used for safe diagnostics.
PROVISION_STAGE = 'preflight'

def require(ok: bool, message: str) -> None:
    if not ok: raise Halt(message)

def module():
    require(FOUNDATION.is_file(), 'No existe la capa de base de datos validada.')
    spec = importlib.util.spec_from_file_location('foundation', str(FOUNDATION))
    assert spec and spec.loader
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    m.SOCKET = Path('/run/mysqld/mysqld.sock')
    return m

def secret(path: Path) -> str:
    require(path.is_file(), 'Falta una credencial local protegida.')
    val = path.read_text(encoding='utf-8').rstrip('\r\n')
    require(bool(re.fullmatch(r'[a-f0-9]{64}', val)), 'La credencial tiene formato no esperado.')
    return val

def one(db, conn, sql: str, args=()):
    rows = db.query(conn, sql, args)
    require(len(rows) == 1, 'Cantidad inesperada de registros. Se detiene.')
    return rows[0]

def preflight(db, conn):
    db.query(conn, 'USE `' + ORG_DB + '`')
    require(str(db.scalar(conn, 'SELECT VERSION()')).startswith('11.8.9-'), 'Version MariaDB diferente.')
    require(int(db.scalar(conn, 'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_TYPE=\'BASE TABLE\'', (ORG_DB,))) == 74, 'El esquema no contiene 74 tablas.')
    # Minimal imported-data preflight. The full import verifier is the source of truth.
    require(int(db.scalar(conn, 'SELECT COUNT(*) FROM users')) == 17, 'El sistema no contiene los 17 usuarios importados.')
    require(int(db.scalar(conn, 'SELECT COUNT(*) FROM people')) == 17, 'Perfiles de usuarios no conciliados.')
    people = db.query(conn, 'SELECT u.id,u.organization_id,u.person_id,u.login_email,u.credential_state,u.status_code,u.access_enabled,p.active AS person_active FROM users u JOIN people p ON p.id=u.person_id AND p.organization_id=u.organization_id WHERE u.normalized_login_email=%s', (ADMIN_EMAIL,))
    require(len(people) == 1, 'La cuenta Master Admin no se encontro de forma unica.')
    u = people[0]
    require(u['status_code'] == 'active' and int(u['person_active']) == 1, 'La cuenta principal esta inactiva.')
    require(u['credential_state'] in ('reset_required','local_validated'), 'Estado de credenciales inesperado.')
    return u

def provision(db, conn, password: str):
    global PROVISION_STAGE
    PROVISION_STAGE = 'inspect_auth_account'
    grantee = "'supplyflow_auth_local'@'%'"
    others = db.query(conn, 'SELECT Host FROM mysql.global_priv WHERE User=%s', (USERNAME,))
    require(not others or (len(others) == 1 and others[0]['Host'] == '%'), 'Existe una cuenta auth con otros hosts.')
    if not others:
        PROVISION_STAGE = 'create_auth_account'
        db.query(conn, 'CREATE USER %s@%s IDENTIFIED VIA mysql_native_password USING PASSWORD(%s)', (USERNAME, '%', password))
    PROVISION_STAGE = 'verify_auth_account'
    verify_user = one(db, conn, "SELECT COALESCE(JSON_VALUE(Priv,'$.plugin'),'') AS plugin, COALESCE(JSON_VALUE(Priv,'$.authentication_string'),'')=PASSWORD(%s) AS matches FROM mysql.global_priv WHERE User=%s AND Host=%s", (password, USERNAME, '%'))
    require(verify_user['plugin'] == 'mysql_native_password' and int(verify_user['matches']) == 1, 'Cuenta auth existente con credencial diferente; no se modificara.')
    expected_tables = {(name,'SELECT') for name in ALLOWED_TABLES} | {('auth_sessions','INSERT'),('audit_events','INSERT')}
    expected_columns = {('auth_sessions','revoked_at','UPDATE'),('auth_sessions','revocation_reason','UPDATE')}
    def actual_privileges():
        global_rows = db.query(conn, 'SELECT PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
        require(all(r['PRIVILEGE_TYPE'] == 'USAGE' for r in global_rows), 'Cuenta auth con privilegios globales extra.')
        scope = db.query(conn, 'SELECT TABLE_SCHEMA FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
        require(not scope, 'Cuenta auth con privilegios generales de esquema.')
        tabs = db.query(conn, 'SELECT TABLE_SCHEMA,TABLE_NAME,PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
        cols = db.query(conn, 'SELECT TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME,PRIVILEGE_TYPE FROM information_schema.COLUMN_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
        require(all(r['TABLE_SCHEMA'] in (ORG_DB, r'supplyflow\_dev') for r in tabs + cols), 'La cuenta auth tiene acceso a otro esquema.')
        table_set = {(r['TABLE_NAME'],r['PRIVILEGE_TYPE']) for r in tabs}
        col_set = {(r['TABLE_NAME'],r['COLUMN_NAME'],r['PRIVILEGE_TYPE']) for r in cols}
        require(table_set <= expected_tables and col_set <= expected_columns, 'La cuenta auth tiene privilegios inesperados.')
        return table_set, col_set
    PROVISION_STAGE = 'inspect_auth_grants'
    table_set, col_set = actual_privileges()
    for table, privilege in sorted(expected_tables - table_set):
        PROVISION_STAGE = 'grant_table_privileges'
        db.query(conn, 'GRANT ' + privilege + ' ON `supplyflow_dev`.`' + table + '` TO %s@%s', (USERNAME, '%'))
    for table, column, privilege in sorted(expected_columns - col_set):
        PROVISION_STAGE = 'grant_column_privileges'
        db.query(conn, 'GRANT UPDATE (`' + column + '`) ON `supplyflow_dev`.`' + table + '` TO %s@%s', (USERNAME, '%'))
    PROVISION_STAGE = 'verify_auth_grants'
    table_set, col_set = actual_privileges()
    require(table_set == expected_tables and col_set == expected_columns, 'Los permisos auth no coinciden con el contrato de minimo privilegio.')
    PROVISION_STAGE = 'provision_complete'
    return 'EXISTING_VERIFIED' if others else 'ACCOUNT_CREATED'

def activate(db, conn, account: dict, passhash: str):
    require(re.fullmatch(r'\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+', passhash) is not None, 'Se requiere un hash Argon2id valido.')
    conn.begin()
    try:
        u = one(db, conn, 'SELECT id,organization_id,credential_state,password_hash FROM users WHERE id=%s FOR UPDATE', (account['id'],))
        require(u['credential_state'] == 'reset_required' and u['password_hash'] is None, 'MASTER_ALREADY_ACTIVE: el alta no puede ejecutarse dos veces.')
        existing_local = int(db.scalar(conn, "SELECT COUNT(*) FROM users WHERE credential_state='local_validated'"))
        require(existing_local == 0, 'Ya existen usuarios activados; se requiere una revision del estado.')
        role = db.query(conn, 'SELECT id FROM roles WHERE organization_id=%s AND code=%s', (u['organization_id'], 'master_admin'))
        if role:
            role_id = int(role[0]['id'])
        else:
            db.query(conn, "INSERT INTO roles (organization_id,code,name,description,is_system) VALUES (%s,'master_admin','Master Admin','Administrador principal; activacion local controlada.',TRUE)", (u['organization_id'],))
            role_id = int(db.scalar(conn, 'SELECT LAST_INSERT_ID()'))
        for code,desc in [('users.read','Consultar usuarios'),('roles.read','Consultar roles')]:
            db.query(conn, 'INSERT IGNORE INTO permissions (code,description) VALUES (%s,%s)', (code,desc))
            pid = int(db.scalar(conn, 'SELECT id FROM permissions WHERE code=%s', (code,)))
            db.query(conn, 'INSERT IGNORE INTO role_permissions (organization_id,role_id,permission_id) VALUES (%s,%s,%s)', (u['organization_id'], role_id, pid))
        db.query(conn, 'INSERT IGNORE INTO user_roles (organization_id,user_id,role_id) VALUES (%s,%s,%s)', (u['organization_id'], u['id'], role_id))
        db.query(conn, "UPDATE users SET password_hash=%s, credential_state='local_validated',access_enabled=TRUE, updated_at=UTC_TIMESTAMP(6), row_version=row_version+1 WHERE id=%s AND credential_state='reset_required'", (passhash, u['id']))
        require(int(db.scalar(conn, 'SELECT ROW_COUNT()')) == 1, 'No se pudo activar la cuenta prevista.')
        db.query(conn, "INSERT INTO audit_events (organization_id,public_id,subject_user_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,detail_text,source_kind) VALUES (%s,%s,%s,%s,'auth','master.activation','success',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),'Activacion local en Docker','system')", (u['organization_id'], str(uuid.uuid4()),u['id'],u['id']))
        require(int(db.scalar(conn, 'SELECT COUNT(*) FROM users WHERE credential_state=\'reset_required\'')) == 16, 'Las otras cuentas importadas fueron alteradas.')
        conn.commit()
        return 'MASTER_ACTIVATED'
    except BaseException:
        conn.rollback()
        raise

def verify(db, conn, account):
    main = one(db, conn, "SELECT u.credential_state, u.access_enabled, u.password_hash, COUNT(r.id) AS master_roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id AND r.code='master_admin' WHERE u.id=%s GROUP BY u.id", (account['id'],))
    require(main['credential_state'] == 'local_validated' and int(main['access_enabled']) == 1, 'Cuenta principal sin activar.')
    require(str(main['password_hash']).startswith('$argon2id$'), 'Hash de cuenta principal invalido.')
    require(int(main['master_roles']) == 1, 'La cuenta principal no tiene el rol Master Admin.')
    require(int(db.scalar(conn, "SELECT COUNT(*) FROM users WHERE credential_state='reset_required'")) == 16, 'Otras credenciales cambiaron inesperadamente.')
    require(int(db.scalar(conn, 'SELECT COUNT(*) FROM users')) == 17, 'El numero de usuarios cambio.')
    return 'MASTER_VERIFIED'

def main():
    operation = sys.argv[1] if len(sys.argv) > 1 else ''
    report = {'tool': 'SupplyFlow Auth v0.3', 'operation': operation, 'result': 'FAIL', 'time_utc': datetime.now(timezone.utc).isoformat()}
    conn = None
    try:
        require(operation in ('inspect','provision','activate','verify'), 'Operacion no admitida.')
        db = module()
        root = secret(ROOT_SECRET)
        conn = db.connect(root)
        require(int(db.scalar(conn, 'SELECT GET_LOCK(%s,10)', ('supplyflow_auth_bootstrap_v03',))) == 1, 'Otra operacion auth en progreso.')
        account = preflight(db, conn)
        report['database'] = ORG_DB
        report['users'] = 17
        report['master_email'] = ADMIN_EMAIL
        if operation == 'provision':
            report['status'] = provision(db, conn, secret(AUTH_SECRET))
        elif operation == 'activate':
            passhash = sys.stdin.readline(512).strip()
            report['status'] = activate(db, conn, account, passhash)
        elif operation == 'verify':
            provision(db, conn, secret(AUTH_SECRET))  # verifies the existing isolated SQL account
            report['status'] = verify(db, conn, account)
        else:
            report['status'] = 'PREFLIGHT_OK'
        report['result'] = 'PASS'
    except Exception as exc:
        report['error_type'] = type(exc).__name__
        report['error'] = str(exc) if isinstance(exc, Halt) else 'AUTH_OPERATION_FAILED'
        if not isinstance(exc, Halt):
            report['error_stage'] = PROVISION_STAGE
            code = exc.args[0] if getattr(exc, 'args', None) else None
            if isinstance(code, int) and 1000 <= code <= 9999:
                report['sql_errno'] = code
    finally:
        if conn is not None:
            try: conn.close()
            except Exception: pass
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report['result']=='PASS' else 1

if __name__ == '__main__':
    raise SystemExit(main())
