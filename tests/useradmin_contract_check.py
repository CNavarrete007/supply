#!/usr/bin/env python3
"""Cuenta useradmin · el contrato de permisos que usa la API (UserAccessRepository::GRANTS y COLUMN_GRANTS) debe ser idéntico al
que concede docker/supply-useradmin/provision.py (leído por AST, sin ejecutarlo). Además: solo UPDATE por columna en users y
auth_sessions (nunca nombres, correos ni estatus) y ningún permiso fuera de SELECT/INSERT/UPDATE/DELETE. Estático.
Uso: python3 tests/useradmin_contract_check.py
"""
import ast, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
prov, cols = {}, {}
for node in ast.parse(open(os.path.join(ROOT, 'docker', 'supply-useradmin', 'provision.py'), encoding='utf8').read()).body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        name = node.targets[0].id
        if name.endswith('_TABLES'): prov[name[:-7]] = set(ast.literal_eval(node.value))
        if name == 'UPDATE_COLUMNS': cols = {k: set(v) for k, v in ast.literal_eval(node.value).items()}
expected = {(t, p) for p, ts in prov.items() for t in ts}
expected_cols = {(t, c) for t, cs in cols.items() for c in cs}
php = open(os.path.join(ROOT, 'backend', 'app', 'Libraries', 'UserAccessRepository.php'), encoding='utf8').read()
g = re.search(r'public const GRANTS = \[(.*?)\n    \];', php, re.S); c = re.search(r'public const COLUMN_GRANTS = \[(.*?)\n    \];', php, re.S)
grants = {(t, p) for p, ts in re.findall(r"'(SELECT|INSERT|UPDATE|DELETE)' => \[([^\]]*)\]", g.group(1)) for t in re.findall(r"'([a-z_]+)'", ts)} if g else set()
col_grants = {(t, x) for t, xs in re.findall(r"'([a-z_]+)' => \[([^\]]*)\]", c.group(1)) for x in re.findall(r"'([a-z_]+)'", xs)} if c else set()
check('provision.py: 11 permisos de tabla y 7 de columna', len(expected) == 11 and len(expected_cols) == 7, f'{len(expected)} {len(expected_cols)}')
check('GRANTS del PHP = permisos de tabla de provision.py', grants == expected, f'{sorted(expected ^ grants)}')
check('COLUMN_GRANTS del PHP = permisos de columna de provision.py', col_grants == expected_cols, f'{sorted(expected_cols ^ col_grants)}')
check('users solo por columna: password_hash, credential_state, access_enabled, updated_at, row_version', cols.get('users') == {'password_hash', 'credential_state', 'access_enabled', 'updated_at', 'row_version'} and ('users', 'UPDATE') not in expected)
check('sin UPDATE de tabla en users/people/roles ni DELETE fuera de user_roles', not ({('users', 'UPDATE'), ('people', 'UPDATE'), ('roles', 'UPDATE')} & expected) and prov.get('DELETE') == {'user_roles'})
check('sin privilegios fuera de SELECT/INSERT/UPDATE/DELETE', set(prov) <= {'SELECT', 'INSERT', 'UPDATE', 'DELETE'})
w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nContrato useradmin: {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
