#!/usr/bin/env python3
"""INT03 · Contrato de cuentas 77/52 (sin base de datos). Uso: python3 -I tests/int03_accounts_contract_check.py"""
import ast
import importlib.util
import re
from pathlib import Path

r = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('acc', r / 'docker/supply-int03/accounts.py')
acc = importlib.util.module_from_spec(spec); spec.loader.exec_module(acc)
c = acc.contract(r / 'docker')
ddl = (r / 'docker/supply-db/sql/01_schema.sql').read_text() + ''.join(p.read_text() for p in sorted((r / 'migrations/manual').glob('*.sql')))
schema_tables = set(re.findall(r'CREATE TABLE `?([a-z_0-9]+)`?', ddl))
compose = (r / 'compose.supply-recovery.yml').read_text()
checks = {
    'recovery 52': len(c['supplyflow_recovery_local']['tables']) == 52,
    'reqwrite 27': len(c['supplyflow_reqwrite_local']['tables']) == 27,
    'auth 10+2': len(c['supplyflow_auth_local']['tables']) == 10 and len(c['supplyflow_auth_local']['columns']) == 2,
    'api schema SELECT': c['supplyflow_api_local']['schema'] == {'SELECT'} and not c['supplyflow_api_local']['tables'],
    'schema 77 tables': len(schema_tables) == 77,
    'all granted tables exist': all(t in schema_tables for s in c.values() for t, _ in s['tables']),
    'only SELECT/INSERT/UPDATE/DELETE': all(p in {'SELECT', 'INSERT', 'UPDATE', 'DELETE'} for s in c.values() for _, p in s['tables']),
    'no REVOKE/DROP in tool SQL': not any(re.search(r'REVOKE|DROP USER|DROP DATABASE|DROP TABLE|DELETE FROM|UPDATE `|TRUNCATE', n.value)
        for n in ast.walk(ast.parse((r / 'docker/supply-int03/accounts.py').read_text())) if isinstance(n, ast.Constant) and isinstance(n.value, str) and not n.value.startswith('SupplyFlow INT03 ·')),
    'restore never drops': not re.search(r'DROP |rm -', (r / 'docker/supply-int03/restore.sh').read_text()),
    'tools isolated (network none)': compose.count('network_mode: none') >= 4,
    'tools behind profile': compose.count('profiles: ["int03-tools"]') == 3,
}
for name, ok in checks.items():
    print(('PASS' if ok else 'FAIL'), name)
print(f"INT03 contract: {sum(checks.values())}/{len(checks)} PASS")
raise SystemExit(0 if all(checks.values()) else 1)
