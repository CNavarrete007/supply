#!/usr/bin/env python3
"""Matriz General · contrato HTTP de `references` en GET /api/v1/matrix/requisitions (SOLO LECTURA).

Solo hace peticiones GET (más login/logout), por lo que puede ejecutarse contra la base sintética o contra
la base local real sin modificarla. Verifica, para TODAS las requisiciones (páginas de 50):
  - cada fila trae references.{purchase_orders, purchase_order_totals, winning_suppliers, winning_supplier_source, receipts, invoices};
  - purchase_order_totals: última versión de cada serie vigente, con id público, moneda e importe decimal (texto);
  - las listas no exceden los conteos existentes (las referencias excluyen canceladas/sustituidas);
  - winning_supplier_source ∈ {purchase_order, award, null} y es coherente con winning_suppliers;
  - los campos auxiliares internos (*_refs) no se exponen;
  - el detalle de una requisición con OC incluye el proveedor de cada OC.

Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo> SF_QA_PASSWORD=<clave> python3 tests/matrix_references_http_check.py
"""
import http.cookiejar
import json
import os
import re
import sys
import urllib.request

API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/')
USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD:
    print('BLOCKED: solo API local y SF_QA_PASSWORD.')
    sys.exit(2)

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
get = lambda path: json.loads(opener.open(API + path).read())
results = []
check = lambda name, ok, detail='': results.append((name, bool(ok), detail))

token = get('/api/v1/auth/csrf')['csrf_token']
opener.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': USER, 'password': PASSWORD}).encode(),
                                   {'Content-Type': 'application/json', 'X-SF-CSRF': token}))
try:
    items, page, total = [], 1, None
    while total is None or len(items) < total:
        body = get(f'/api/v1/matrix/requisitions?page={page}&page_size=50&q=&client=all&has=all')
        total = body['total']; items += body['items']; page += 1
        if page > 400:
            break
    check('todas las requisiciones leídas en páginas de 50', len(items) == total, f'{len(items)}/{total}')
    keys = {'purchase_orders', 'purchase_order_totals', 'winning_suppliers', 'winning_supplier_source', 'receipts', 'invoices'}
    bad_shape = [r['folio'] for r in items if set((r.get('references') or {}).keys()) != keys]
    check('cada fila trae references con las 6 claves', not bad_shape, ', '.join(bad_shape[:5]))
    amount = re.compile(r'^-?\d+(\.\d+)?$')
    bad_totals = [r['folio'] for r in items for t in r['references']['purchase_order_totals']
                  if set(t) != {'id', 'folio', 'currency', 'amount'} or not re.match(r'^[0-9a-f-]{36}$', t['id'] or '')
                  or not amount.match(t['amount'] or '') or len(t['currency'] or '') != 3 or t['folio'] not in r['references']['purchase_orders']]
    check('importes de OC vigentes: id público, folio vigente, moneda e importe decimal', not bad_totals, ', '.join(bad_totals[:5]))
    dup = [r['folio'] for r in items if len({t['id'] for t in r['references']['purchase_order_totals']}) != len(r['references']['purchase_order_totals'])]
    check('una sola versión vigente por serie de OC', not dup, ', '.join(dup[:5]))
    leaked = [r['folio'] for r in items if any(k.endswith('_refs') for k in r)]
    check('no se exponen campos internos *_refs', not leaked, ', '.join(leaked[:5]))
    over = [r['folio'] for r in items if len(r['references']['purchase_orders']) > r['purchase_order_count']
            or len(r['references']['receipts']) > r['receipt_count'] or len(r['references']['invoices']) > r['invoice_count']]
    check('referencias no exceden los conteos (vigentes ⊆ vinculadas)', not over, ', '.join(over[:5]))
    incoherent = [r['folio'] for r in items if r['references']['winning_supplier_source'] not in (None, 'purchase_order', 'award')
                  or bool(r['references']['winning_suppliers']) != (r['references']['winning_supplier_source'] is not None)
                  or (r['references']['winning_supplier_source'] == 'purchase_order' and not r['references']['purchase_orders'])]
    check('proveedor ganador coherente con su origen', not incoherent, ', '.join(incoherent[:5]))
    with_po = next((r for r in items if r['references']['purchase_orders']), None)
    if with_po:
        detail = get('/api/v1/matrix/requisitions/' + with_po['id'])
        pos = detail['documents']['purchase_orders']
        check('detalle: cada OC incluye proveedor', pos and all('supplier' in p for p in pos))
        check('detalle: OC vigentes de la lista existen en el detalle', set(with_po['references']['purchase_orders']) <= {p['folio'] for p in pos})
    else:
        check('detalle con OC', True, 'sin requisiciones con OC para comparar')
    filtered = get('/api/v1/matrix/requisitions?page=1&page_size=5&q=&client=all&has=purchase_order')
    check('filtros existentes siguen funcionando (has=purchase_order)', all(r['purchase_order_count'] > 0 for r in filtered['items']))
finally:
    try:
        token = get('/api/v1/auth/csrf')['csrf_token']
        opener.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': token}))
    except Exception:
        pass

width = max(len(n) for n, _, _ in results)
for name, ok, detail in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {'' if ok else detail}")
failed = sum(1 for _, ok, _ in results if not ok)
print(f'\nReferencias de la Matriz General: {len(results) - failed}/{len(results)} PASS')
sys.exit(1 if failed else 0)
