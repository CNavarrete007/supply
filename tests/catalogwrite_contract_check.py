#!/usr/bin/env python3
"""Cuenta catalogwrite · el contrato de permisos que usa el diagnóstico de la API (CatalogWriteBase::GRANTS) debe ser idéntico al
que concede docker/supply-catalogwrite/provision.py (leído por AST, sin ejecutarlo). Estático: no se conecta a nada.
Uso: python3 tests/catalogwrite_contract_check.py
"""
import ast, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))

prov = {}
for node in ast.parse(open(os.path.join(ROOT, 'docker', 'supply-catalogwrite', 'provision.py'), encoding='utf8').read()).body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and node.targets[0].id.endswith('_TABLES'):
        prov[node.targets[0].id[:-7]] = set(ast.literal_eval(node.value))
expected = {(t, p) for p, ts in prov.items() for t in ts}

php = open(os.path.join(ROOT, 'backend', 'app', 'Libraries', 'CatalogWriteBase.php'), encoding='utf8').read()
block = re.search(r'public const GRANTS = \[(.*?)\n    \];', php, re.S)
check('CatalogWriteBase::GRANTS existe', block)
grants = set()
if block:
    for priv, tables in re.findall(r"'(SELECT|INSERT|UPDATE|DELETE)' => \[([^\]]*)\]", block.group(1)):
        grants |= {(t, priv) for t in re.findall(r"'([a-z_]+)'", tables)}
check('provision.py concede 33 permisos', len(expected) == 33, str(len(expected)))
check('GRANTS del PHP = permisos de provision.py', grants == expected,
      f'faltan en PHP: {sorted(expected - grants)} · sobran en PHP: {sorted(grants - expected)}')
check('sin privilegios fuera de SELECT/INSERT/UPDATE/DELETE', set(prov) <= {'SELECT', 'INSERT', 'UPDATE', 'DELETE'}, str(set(prov)))

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nContrato catalogwrite: {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
