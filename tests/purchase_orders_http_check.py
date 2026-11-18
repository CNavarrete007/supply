#!/usr/bin/env python3
"""Órdenes de Compra · contrato HTTP de /api/v1/purchase-orders[/issuance|/tasks|/{id}] (SOLO LECTURA; apto para la base real).
Verifica 401/403/422, versión vigente única por serie, coherencia del resumen, detalle y que no exista ninguna ruta de escritura.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/purchase_orders_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/purchase-orders'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
def session(email=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op
def status(op, path, method='GET'):
    try: return op.open(urllib.request.Request(API + path, method=method, data=b'{}' if method != 'GET' else None, headers={'Content-Type': 'application/json'})).status
    except urllib.error.HTTPError as e: return e.code
def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']; op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass
EPS = [R, R + '/issuance', R + '/tasks']
anon = session(); check('sin sesión: 401', all(status(anon, p) == 401 for p in EPS))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', all(status(o, p) == 403 for p in EPS)); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', all(status(adm, p) == 200 for p in EPS))
    for bad in ['?x=1', '?page_size=51', '?sort=price', '?scope=x', '?buyer=abc', '?status=%27or', '/issuance?a=1', '/tasks?a=1']:
        check(f'422 con parámetro inválido ({bad})', status(adm, R + bad) == 422)
    check('sin rutas de escritura (POST/PUT/DELETE ≠ 2xx)', all(status(adm, R + s, m) >= 400 for s in ['', '/00000000-0000-4000-8000-000000000000'] for m in ['POST', 'PUT', 'DELETE']))
    cur, page, total = [], 1, None
    while total is None or len(cur) < total:
        d = get(f'{R}?page={page}&page_size=50'); total = d['total']; cur += d['items']; page += 1
        if page > 400: break
    check('versión vigente: una por serie', len({p['series_id'] for p in cur}) == len(cur) == d['summary']['counters']['total'])
    allv = get(f'{R}?page_size=50&scope=all')
    check('scope=all incluye versiones anteriores', allv['total'] >= total)
    s = d['summary']; c = s['counters']
    check('resumen: estatus y compradores coherentes', sum(x['count'] for x in s['statuses']) == c['total'] and sum(b['count'] for b in s['buyers']) + c['without_buyer'] == c['total'] and all(0 <= b['received'] <= b['count'] for b in s['buyers']))
    check('montos por moneda excluyen canceladas/sustituidas', sum(m['orders'] for m in s['money']) == len([p for p in cur if (p['legacy_status'] or p['operational_status'] or '').lower() not in ('cancelada', 'sustituida', 'cancelled', 'superseded')]))
    check('detalle con UUID inexistente: 404', status(adm, R + '/00000000-0000-4000-8000-000000000000') == 404)
    if cur:
        det = get(f"{R}/{cur[0]['id']}")
        check('detalle: partidas, versiones de la serie y documentos', {'item', 'items', 'versions', 'receipts', 'invoices', 'modification_requests'} <= set(det) and len(det['versions']) == cur[0]['versions'] and det['item']['folio'] == cur[0]['folio'])
    iss = get(R + '/issuance'); check('emisión: forma', isinstance(iss['items'], list) and isinstance(iss['losing_quotes'], int))
    reqs, lines = iss['requisitions'], iss['lines']
    check('emisión: requisiciones con forma y tipos', isinstance(reqs, list) and all(set(r) == {'id', 'folio', 'client_reference', 'project', 'client_name', 'client_approved', 'customer_quote', 'quotes_received', 'item_count', 'awarded_items'}
        and isinstance(r['client_approved'], bool) and all(isinstance(r[k], int) for k in ('quotes_received', 'item_count', 'awarded_items')) for r in reqs))
    check('emisión: toda requisición con adjudicación vigente aparece en el selector', {i['requisition_id'] for i in iss['items']} <= {r['id'] for r in reqs})
    check('emisión: aprobada = cotización al cliente vigente con estatus "Aprobada" (misma regla que Cotizaciones)', all((r['customer_quote'] is not None) == r['client_approved'] for r in reqs))
    cqs = get('/api/v1/quotes/customer-quotes?scope=current&group=approved&page=1&page_size=50')['items']
    check('emisión: requisiciones aprobadas = cotizaciones al cliente aprobadas vigentes', {r['folio'] for r in reqs if r['client_approved']} == {c['requisition'] for c in cqs})
    check('emisión: partidas solo de proveedores ganadores (sin perdedoras)', all(any(i['requisition_id'] == l['requisition_id'] and i['supplier_id'] == l['supplier_id'] for i in iss['items']) for l in lines)
        and all(i['items'] == sum(1 for l in lines if l['requisition_id'] == i['requisition_id'] and l['supplier_id'] == i['supplier_id']) for i in iss['items']))
    check('emisión: importe adjudicado = suma de partidas', all(abs(float(i['awarded_amount']) - sum(float(l['subtotal']) for l in lines if l['requisition_id'] == i['requisition_id'] and l['supplier_id'] == i['supplier_id'])) < 0.01 for i in iss['items']))
    check('emisión: OC activa nunca es cancelada/sustituida', all(not i['active_pos'] or i['existing_pos'] for i in iss['items']))
    t = get(R + '/tasks'); check('tareas: forma', isinstance(t['responsible'], list) and isinstance(t['modification_requests'], list))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nÓrdenes de Compra (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
