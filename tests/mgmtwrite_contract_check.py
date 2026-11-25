#!/usr/bin/env python3
"""Cuenta mgmtwrite (Gestión del Contratista) · el contrato de permisos del diagnóstico de la API
(ContractorMgmtWriteRepository::GRANTS y ::COLUMN_GRANTS) debe ser idéntico al que concede docker/supply-mgmtwrite/provision.py
(leído por AST, sin ejecutarlo). Estático: no se conecta a nada.
Uso: python3 tests/mgmtwrite_contract_check.py
"""
import ast, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
prov, cols = {}, {}
for node in ast.parse(open(os.path.join(ROOT, 'docker', 'supply-mgmtwrite', 'provision.py'), encoding='utf8').read()).body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        name = node.targets[0].id
        if name.endswith('_TABLES'):
            prov[name[:-7]] = set() if isinstance(node.value, ast.Call) else set(ast.literal_eval(node.value))
        if name == 'UPDATE_COLUMNS':
            cols = {t: set(c) for t, c in ast.literal_eval(node.value).items()}
expected = {(t, p) for p, ts in prov.items() for t in ts}
expected_cols = {(t, c) for t, cs in cols.items() for c in cs}
php = open(os.path.join(ROOT, 'backend', 'app', 'Libraries', 'ContractorMgmtWriteRepository.php'), encoding='utf8').read()
g = re.search(r'public const GRANTS = \[(.*?)\n    \];', php, re.S); c = re.search(r'public const COLUMN_GRANTS = \[(.*?)\n    \];', php, re.S)
check('GRANTS y COLUMN_GRANTS existen en el PHP', g and c)
grants = {(t, p) for p, ts in re.findall(r"'(SELECT|INSERT|UPDATE|DELETE)' => \[([^\]]*)\]", g.group(1)) for t in re.findall(r"'([a-z_]+)'", ts)} if g else set()
gcols = {(t, x) for t, xs in re.findall(r"'([a-z_]+)' => \[([^\]]*)\]", c.group(1)) for x in re.findall(r"'([a-z_]+)'", xs)} if c else set()
check('provision.py concede 20 permisos de tabla y 13 de columna', len(expected) == 20 and len(expected_cols) == 13, f'{len(expected)} / {len(expected_cols)}')
check('GRANTS del PHP = permisos de tabla de provision.py', grants == expected, f'faltan en PHP: {sorted(expected - grants)} · sobran: {sorted(grants - expected)}')
check('COLUMN_GRANTS del PHP = UPDATE por columna de provision.py', gcols == expected_cols, f'faltan en PHP: {sorted(expected_cols - gcols)} · sobran: {sorted(gcols - expected_cols)}')
check('sin DELETE ni privilegios fuera de SELECT/INSERT/UPDATE', not prov.get('DELETE') and set(prov) <= {'SELECT', 'INSERT', 'UPDATE', 'DELETE'}, str(prov.get('DELETE')))
check('UPDATE de tabla completa solo en idempotency_keys', prov.get('UPDATE') == {'idempotency_keys'}, str(prov.get('UPDATE')))
w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nContrato mgmtwrite: {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
