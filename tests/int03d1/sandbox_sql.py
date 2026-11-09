#!/usr/bin/env python3
"""INT03-D1 · SOLO SANDBOX SINTETICO. Genera SQL (stdout) para una MariaDB VACIA y desechable.

- NO usar contra la base comercial ni contra la PC original. El script de shell que lo
  invoca solo apunta al contenedor aislado `sfsandbox-db` y aborta si la base ya tiene datos.
- Lee los contratos de privilegios directamente de los aprovisionadores versionados
  (sin importarlos ni ejecutarlos) y agrega los 14 permisos R3 documentados en
  R3A/R3B/R3C2/R3C3_NOTAS.md => 52 permisos para `supplyflow_recovery_local`.
- Todos los datos son ficticios (dominio .invalid). Las contraseñas llegan por entorno.
"""
from __future__ import annotations
import ast
import json
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = 'supplyflow_dev'


def sets_from(path: Path) -> dict[str, set[str]]:
    tree = ast.parse(path.read_text(encoding='utf8'))
    out: dict[str, set[str]] = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name.endswith('_TABLES') and isinstance(node.value, (ast.Set, ast.Tuple)):
                out[name] = set(ast.literal_eval(node.value))
    return out


def table_grants(sets: dict[str, set[str]]) -> set[tuple[str, str]]:
    return {(t, p) for p in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') for t in sets.get(p + '_TABLES', set())}


# R3 contract documented in the R3 notes (38 -> 52). Kept here, not in the RF1 provisioner,
# because the provisioner of 38/74 is historical and must not be executed on a 77/52 database.
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


def recovery_contract() -> set[tuple[str, str]]:
    base = table_grants(sets_from(ROOT / 'docker/supply-recovery/provision.py'))
    assert len(base) == 38, f'RF1 contract changed: {len(base)}'
    full = base | R3_EXTRA
    assert len(full) == 52, f'R3 contract mismatch: {len(full)}'
    return full


def q(value: str) -> str:
    return "'" + value.replace('\\', '\\\\').replace("'", "''") + "'"


def accounts(secrets: Path) -> list[str]:
    pw = {k: (secrets / f'{k}.txt').read_text().strip() for k in
          ('api-db-password', 'auth-db-password', 'reqwrite-db-password', 'recovery-db-password')}
    sql = []
    def user(name, secret):
        sql.append(f"CREATE USER {q(name)}@'%' IDENTIFIED VIA mysql_native_password USING PASSWORD({q(secret)});")
    user('supplyflow_api_local', pw['api-db-password'])
    sql.append(f"GRANT SELECT ON `supplyflow\\_dev`.* TO 'supplyflow_api_local'@'%';")
    user('supplyflow_auth_local', pw['auth-db-password'])
    for t in ('users', 'people', 'roles', 'user_roles', 'permissions', 'role_permissions', 'user_permissions', 'auth_sessions'):
        sql.append(f"GRANT SELECT ON `{DB}`.`{t}` TO 'supplyflow_auth_local'@'%';")
    sql += [f"GRANT INSERT ON `{DB}`.`auth_sessions` TO 'supplyflow_auth_local'@'%';",
            f"GRANT INSERT ON `{DB}`.`audit_events` TO 'supplyflow_auth_local'@'%';",
            f"GRANT UPDATE (`revoked_at`,`revocation_reason`) ON `{DB}`.`auth_sessions` TO 'supplyflow_auth_local'@'%';"]
    user('supplyflow_reqwrite_local', pw['reqwrite-db-password'])
    for t, p in sorted(table_grants(sets_from(ROOT / 'docker/supply-reqwrite/provision.py'))):
        sql.append(f"GRANT {p} ON `{DB}`.`{t}` TO 'supplyflow_reqwrite_local'@'%';")
    user('supplyflow_recovery_local', pw['recovery-db-password'])
    for t, p in sorted(recovery_contract()):
        sql.append(f"GRANT {p} ON `{DB}`.`{t}` TO 'supplyflow_recovery_local'@'%';")
    return sql


def seed(hashes: dict[str, str]) -> list[str]:
    now = 'UTC_TIMESTAMP(6)'
    org_pid = str(uuid.UUID(int=0x5f0000000000400080000000000000a1))
    s = [f"USE `{DB}`;", "START TRANSACTION;",
         f"INSERT INTO organizations (public_id,legal_name,status_code,created_at,updated_at) VALUES ({q(org_pid)},'Organización Sintética QA','active',{now},{now});",
         "SET @org=LAST_INSERT_ID();",
         "INSERT INTO currencies (code,name,minor_units,active) VALUES ('MXN','Peso mexicano',2,1),('USD','Dólar estadounidense',2,1),('EUR','Euro',2,1);",
         "INSERT INTO roles (organization_id,code,name,description,is_system) VALUES (@org,'master_admin','Master Admin','Sintético QA',1);",
         "SET @master=LAST_INSERT_ID();",
         "INSERT INTO roles (organization_id,code,name,description,is_system) VALUES (@org,'buyer','Comprador','Sintético QA sin permisos RF1',0);",
         "SET @buyer=LAST_INSERT_ID();"]
    users = [('qa.admin.a@supplyflow.invalid', 'QA Admin A', '@master'),
             ('qa.admin.b@supplyflow.invalid', 'QA Admin B', '@master'),
             ('qa.buyer@supplyflow.invalid', 'QA Comprador', '@buyer')]
    for i, (email, name, role) in enumerate(users, 1):
        s += [f"INSERT INTO people (organization_id,public_id,display_name,email,active,created_at,updated_at) VALUES (@org,{q(str(uuid.uuid4()))},{q(name)},{q(email)},1,{now},{now});",
              "SET @p=LAST_INSERT_ID();",
              f"INSERT INTO users (organization_id,person_id,public_id,login_email,normalized_login_email,password_hash,credential_state,status_code,access_enabled,created_at,updated_at) VALUES (@org,@p,{q(str(uuid.uuid4()))},{q(email)},{q(email)},{q(hashes[email])},'local_validated','active',1,{now},{now});",
              f"INSERT INTO user_roles (organization_id,user_id,role_id) VALUES (@org,LAST_INSERT_ID(),{role});"]
    for code, name, project, contract in [('QA01', 'Cliente Sintético Uno', 'PRY-QA-01', 'CTO-QA-01'),
                                          ('QA02', 'Cliente Sintético Dos', 'PRY-QA-02', 'CTO-QA-02')]:
        s += [f"INSERT INTO business_entities (organization_id,public_id,entity_kind,created_at,updated_at,row_version) VALUES (@org,{q(str(uuid.uuid4()))},'client',{now},{now},1);",
              f"INSERT INTO clients (id,organization_id,code,legal_name,default_project_reference,default_contract_reference,status_code) VALUES (LAST_INSERT_ID(),@org,{q(code)},{q(name)},{q(project)},{q(contract)},'active');"]
    for code, name in [('MAT', 'Materiales'), ('SRV', 'Servicios'), ('EQP', 'Equipos')]:
        s.append(f"INSERT INTO categories (organization_id,code,name,active) VALUES (@org,{q(code)},{q(name)},1);")
    s.append("COMMIT;")
    return s


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in ('accounts', 'seed'):
        print('uso: sandbox_sql.py accounts <dir-secretos> | seed <hashes.json>', file=sys.stderr)
        return 2
    lines = accounts(Path(sys.argv[2])) if sys.argv[1] == 'accounts' else seed(json.loads(Path(sys.argv[2]).read_text()))
    print('\n'.join(lines))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
