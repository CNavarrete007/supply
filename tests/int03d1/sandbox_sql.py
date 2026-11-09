#!/usr/bin/env python3
"""INT03-D1 · SOLO SANDBOX SINTETICO. Genera SQL (stdout) para una MariaDB VACIA y desechable.

- NO usar contra la base comercial ni contra la PC original. El script de shell que lo
  invoca solo apunta al contenedor aislado `sfsandbox-db` y aborta si la base ya tiene datos.
- El contrato de cuentas se toma de docker/supply-int03/accounts.py (fuente única):
  api SELECT de esquema, auth 10+2, reqwrite 27 y recovery 52 (RF1 38 + R3 14).
- Todos los datos son ficticios (dominio .invalid). Las contraseñas llegan por entorno.
"""
from __future__ import annotations
import importlib.util
import json
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = 'supplyflow_dev'


def _accounts_tool():
    spec = importlib.util.spec_from_file_location('int03_accounts', ROOT / 'docker/supply-int03/accounts.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def contract() -> dict:
    """Single source of truth: docker/supply-int03/accounts.py (api, auth 10+2, reqwrite 27, recovery 52)."""
    return _accounts_tool().contract(ROOT / 'docker')


def q(value: str) -> str:
    return "'" + value.replace('\\', '\\\\').replace("'", "''") + "'"


def accounts(secrets: Path) -> list[str]:
    sql = []
    for user, spec in contract().items():
        pw = (secrets / spec['secret']).read_text().strip()
        sql.append(f"CREATE USER {q(user)}@'%' IDENTIFIED VIA mysql_native_password USING PASSWORD({q(pw)});")
        for priv in sorted(spec['schema']):
            sql.append(f"GRANT {priv} ON `supplyflow\\_dev`.* TO {q(user)}@'%';")
        for t, p in sorted(spec['tables']):
            sql.append(f"GRANT {p} ON `{DB}`.`{t}` TO {q(user)}@'%';")
        for t, c, p in sorted(spec['columns']):
            sql.append(f"GRANT {p} (`{c}`) ON `{DB}`.`{t}` TO {q(user)}@'%';")
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
