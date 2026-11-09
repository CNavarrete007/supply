#!/usr/bin/env python3
"""SupplyFlow INT03 · Cuentas SQL de mínimo privilegio para una base YA migrada (77 tablas).

Uso (dentro del servicio Compose `int03-accounts-tools`, perfil `int03-tools`):
  inspect    Solo lectura: esquema, R3, cuentas y permisos actuales vs. contrato.
  provision  Crea SOLO las cuentas que faltan y otorga SOLO permisos faltantes del contrato.
  verify     Solo lectura: exige contrato exacto (api esquema SELECT, auth 10+2, reqwrite 27, recovery 52).

Garantías:
- Nunca crea/borra tablas, nunca modifica filas de negocio, nunca ejecuta migraciones,
  nunca usa REVOKE/DROP USER y nunca cambia la contraseña de una cuenta existente.
- Se detiene si la base no tiene exactamente 77 tablas con R3C1-HF2/R3C2/R3C3, si una cuenta
  existe con otra contraseña, host distinto o permisos fuera del contrato.
- Las contraseñas se leen de /run/supply-secrets y nunca se imprimen.
- Sustituye, para bases 77/52, a auth_tool.py (exige 74 tablas y 17 usuarios importados)
  y a docker/supply-recovery/provision.py (contrato histórico 38/74). Esos NO deben usarse aquí.
"""
from __future__ import annotations

import ast
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

DB = 'supplyflow_dev'
SCHEMA_GRANT = r'supplyflow\_dev'
HOST = '%'
TABLES_EXPECTED = 77
DOCKER = Path('/docker')
SECRETS = Path('/run/supply-secrets')
SOCKET = '/run/mysqld/mysqld.sock'
LOCK = 'supplyflow_int03_accounts'

AUTH_TABLES = ('users', 'people', 'roles', 'user_roles', 'permissions', 'role_permissions', 'user_permissions', 'auth_sessions')
AUTH_EXTRA = {('auth_sessions', 'INSERT'), ('audit_events', 'INSERT')}
AUTH_COLUMNS = {('auth_sessions', 'revoked_at', 'UPDATE'), ('auth_sessions', 'revocation_reason', 'UPDATE')}
# R3 contract documented in R3A/R3B/R3C2/R3C3_NOTAS.md (RF1 38 -> 52).
R3_EXTRA = {
    ('requisition_change_requests', 'INSERT'), ('requisition_change_requests', 'UPDATE'),
    ('requisition_change_items', 'INSERT'), ('requisition_change_items', 'SELECT'),            # R3A
    ('requisition_change_items', 'UPDATE'), ('sourcing_plans', 'SELECT'),
    ('customer_quotes', 'SELECT'), ('delivery_items', 'SELECT'),                                 # R3B
    ('requisition_change_commercial_assessments', 'SELECT'),
    ('requisition_change_commercial_assessments', 'INSERT'),                                     # R3C2
    ('requisition_change_commercial_executions', 'SELECT'),
    ('requisition_change_commercial_executions', 'INSERT'),
    ('requisition_change_commercial_execution_reviews', 'SELECT'),
    ('requisition_change_commercial_execution_reviews', 'INSERT'),                               # R3C3
}
R3_TABLES = ('requisition_change_commercial_assessments', 'requisition_change_commercial_executions',
             'requisition_change_commercial_execution_reviews')


class Blocked(Exception):
    pass


def require(ok: bool, code: str) -> None:
    if not ok:
        raise Blocked(code)


def sets_from(path: Path) -> set[tuple[str, str]]:
    """Read *_TABLES literals from a versioned provisioner WITHOUT importing or executing it."""
    tree = ast.parse(path.read_text(encoding='utf8'))
    found: dict[str, set[str]] = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name.endswith('_TABLES') and isinstance(node.value, (ast.Set, ast.Tuple)):
                found[name] = set(ast.literal_eval(node.value))
    return {(t, p) for p in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') for t in found.get(p + '_TABLES', set())}


def contract(docker: Path = DOCKER) -> dict[str, dict]:
    rf1 = sets_from(docker / 'supply-recovery/provision.py')
    require(len(rf1) == 38, 'RF1_CONTRACT_CHANGED')
    recovery = rf1 | R3_EXTRA
    require(len(recovery) == 52, 'RECOVERY_CONTRACT_NOT_52')
    reqwrite = sets_from(docker / 'supply-reqwrite/provision.py')
    require(len(reqwrite) == 27, 'REQWRITE_CONTRACT_CHANGED')
    return {
        'supplyflow_api_local': {'secret': 'api-db-password.txt', 'schema': {'SELECT'}, 'tables': set(), 'columns': set()},
        'supplyflow_auth_local': {'secret': 'auth-db-password.txt', 'schema': set(),
                                  'tables': {(t, 'SELECT') for t in AUTH_TABLES} | AUTH_EXTRA, 'columns': AUTH_COLUMNS},
        'supplyflow_reqwrite_local': {'secret': 'reqwrite-db-password.txt', 'schema': set(), 'tables': reqwrite, 'columns': set()},
        'supplyflow_recovery_local': {'secret': 'recovery-db-password.txt', 'schema': set(), 'tables': recovery, 'columns': set()},
    }


def secret(name: str) -> str:
    path = SECRETS / name
    require(path.is_file(), 'SECRET_MISSING:' + name)
    value = path.read_text(encoding='utf-8-sig').strip()
    require(re.fullmatch(r'[a-f0-9]{64}', value) is not None, 'SECRET_FORMAT:' + name)
    return value


class Db:
    def __init__(self, password: str):
        import pymysql  # lazy: the contract can be imported by tests without the driver
        self.conn = pymysql.connect(unix_socket=SOCKET, user='root', password=password, charset='utf8mb4',
                                    autocommit=True, cursorclass=pymysql.cursors.DictCursor, connect_timeout=10)

    def rows(self, sql: str, args=None) -> list[dict]:
        with self.conn.cursor() as cur:
            cur.execute(sql, args)
            return list(cur.fetchall())

    def scalar(self, sql: str, args=None):
        row = self.rows(sql, args)
        return next(iter(row[0].values())) if row else None


def schema_state(db: Db) -> dict:
    tables = int(db.scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_TYPE='BASE TABLE'", (DB,)) or 0)
    r3 = {t: bool(db.scalar('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=%s AND TABLE_NAME=%s', (DB, t))) for t in R3_TABLES}
    clause = db.scalar("SELECT CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=%s AND CONSTRAINT_NAME='ck_reqchangeitems_resolution'", (DB,)) or ''
    hf2 = "'add'" in clause and 'snapshot_schema_version' in clause
    counts = {}
    if tables:
        for t in ('organizations', 'users', 'clients', 'requisitions', 'requisition_items', 'files'):
            counts[t] = int(db.scalar(f'SELECT COUNT(*) FROM `{DB}`.`{t}`') or 0)
    return {'version': db.scalar('SELECT VERSION()'), 'tables': tables, 'r3_tables': r3, 'r3c1_hf2_check': hf2, 'row_counts': counts}


def account_state(db: Db, user: str) -> dict:
    grantee = f"'{user}'@'{HOST}'"
    hosts = [r['Host'] for r in db.rows('SELECT Host FROM mysql.global_priv WHERE User=%s', (user,))]
    glob = {r['PRIVILEGE_TYPE'] for r in db.rows('SELECT PRIVILEGE_TYPE FROM information_schema.USER_PRIVILEGES WHERE GRANTEE=%s', (grantee,))}
    schema = db.rows('SELECT TABLE_SCHEMA,PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
    tables = db.rows('SELECT TABLE_SCHEMA,TABLE_NAME,PRIVILEGE_TYPE FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
    cols = db.rows('SELECT TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME,PRIVILEGE_TYPE FROM information_schema.COLUMN_PRIVILEGES WHERE GRANTEE=%s', (grantee,))
    return {
        'hosts': hosts, 'global': glob - {'USAGE'},
        'schema': {r['PRIVILEGE_TYPE'] for r in schema if r['TABLE_SCHEMA'] == SCHEMA_GRANT},
        'foreign': [r for r in schema if r['TABLE_SCHEMA'] != SCHEMA_GRANT] + [r for r in tables + cols if r['TABLE_SCHEMA'] != DB],
        'tables': {(r['TABLE_NAME'], r['PRIVILEGE_TYPE']) for r in tables if r['TABLE_SCHEMA'] == DB},
        'columns': {(r['TABLE_NAME'], r['COLUMN_NAME'], r['PRIVILEGE_TYPE']) for r in cols if r['TABLE_SCHEMA'] == DB},
    }


def assess(state: dict, spec: dict) -> list[str]:
    problems = []
    if state['hosts'] and state['hosts'] != [HOST]:
        problems.append('UNEXPECTED_HOSTS')
    if state['global']:
        problems.append('GLOBAL_PRIVILEGES')
    if state['foreign']:
        problems.append('OTHER_SCHEMA_PRIVILEGES')
    if not state['schema'] <= spec['schema'] or not state['tables'] <= spec['tables'] or not state['columns'] <= spec['columns']:
        problems.append('PRIVILEGES_OUTSIDE_CONTRACT')
    return problems


def summary(state: dict, spec: dict) -> dict:
    return {'exists': bool(state['hosts']), 'table_grants': len(state['tables']), 'expected_table_grants': len(spec['tables']),
            'column_grants': len(state['columns']), 'expected_column_grants': len(spec['columns']),
            'schema_grants': sorted(state['schema']), 'expected_schema_grants': sorted(spec['schema']),
            'missing': len(spec['tables'] - state['tables']) + len(spec['columns'] - state['columns']) + len(spec['schema'] - state['schema']),
            'problems': assess(state, spec)}


def provision(db: Db, spec_all: dict) -> dict:
    out = {}
    for user, spec in spec_all.items():
        password = secret(spec['secret'])
        state = account_state(db, user)
        problems = assess(state, spec)
        require(not problems, f'{user}:' + ','.join(problems))
        if state['hosts']:
            same = int(db.scalar("SELECT COALESCE(JSON_VALUE(Priv,'$.authentication_string'),'')=PASSWORD(%s) FROM mysql.global_priv WHERE User=%s AND Host=%s",
                                 (password, user, HOST)) or 0)
            require(same == 1, f'{user}:EXISTING_PASSWORD_DIFFERS')
            action = 'EXISTING_VERIFIED'
        else:
            db.rows('CREATE USER %s@%s IDENTIFIED VIA mysql_native_password USING PASSWORD(%s)', (user, HOST, password))
            action = 'CREATED'
        for priv in sorted(spec['schema'] - state['schema']):
            db.rows(f'GRANT {priv} ON `{SCHEMA_GRANT}`.* TO %s@%s', (user, HOST))
        for table, priv in sorted(spec['tables'] - state['tables']):
            db.rows(f'GRANT {priv} ON `{DB}`.`{table}` TO %s@%s', (user, HOST))
        for table, column, priv in sorted(spec['columns'] - state['columns']):
            db.rows(f'GRANT {priv} (`{column}`) ON `{DB}`.`{table}` TO %s@%s', (user, HOST))
        out[user] = action
    return out


def verify_exact(db: Db, spec_all: dict) -> dict:
    out = {}
    for user, spec in spec_all.items():
        state = account_state(db, user)
        s = summary(state, spec)
        exact = s['exists'] and not s['problems'] and state['tables'] == spec['tables'] and state['columns'] == spec['columns'] and state['schema'] == spec['schema']
        out[user] = s
        require(exact, f'{user}:CONTRACT_MISMATCH')
    return out


def main() -> int:
    op = sys.argv[1] if len(sys.argv) > 1 else ''
    report: dict = {'tool': 'SupplyFlow INT03 accounts', 'operation': op, 'result': 'BLOCKED',
                    'time_utc': datetime.now(timezone.utc).isoformat()}
    db = None
    try:
        require(op in ('inspect', 'provision', 'verify'), 'OPERATION_NOT_ALLOWED')
        spec_all = contract()
        db = Db(secret('mariadb-root.txt'))
        require(int(db.scalar('SELECT GET_LOCK(%s,10)', (LOCK,)) or 0) == 1, 'LOCK_BUSY')
        require(str(db.scalar('SELECT VERSION()')).startswith('11.8.9-'), 'MARIADB_VERSION_NOT_11.8.9')
        schema = schema_state(db)
        report['schema'] = schema
        if op == 'inspect':
            report['accounts'] = {u: summary(account_state(db, u), s) for u, s in spec_all.items()}
            report['status'] = 'INSPECTED'
            report['result'] = 'PASS'
        else:
            require(schema['tables'] == TABLES_EXPECTED, f"SCHEMA_TABLES_{schema['tables']}_NOT_77")
            require(all(schema['r3_tables'].values()), 'R3_TABLES_MISSING')
            require(schema['r3c1_hf2_check'], 'R3C1_HF2_CHECK_MISSING')
            if op == 'provision':
                report['provision'] = provision(db, spec_all)
                db.rows('FLUSH PRIVILEGES')
            report['accounts'] = verify_exact(db, spec_all)
            report['status'] = 'CONTRACT_77_52_VERIFIED'
            report['result'] = 'PASS'
    except Blocked as exc:
        report['error'] = str(exc)
    except Exception as exc:  # never echo SQL text or secrets
        report['error'] = 'INT03_ACCOUNTS_FAILED'
        report['error_type'] = type(exc).__name__
        code = exc.args[0] if getattr(exc, 'args', None) else None
        if isinstance(code, int):
            report['sql_errno'] = code
    finally:
        if db is not None:
            try:
                db.conn.close()
            except Exception:
                pass
    print(json.dumps(report, ensure_ascii=False, indent=1, default=sorted))
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
