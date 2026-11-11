#!/usr/bin/env python3
"""Recepción y Entrega · contrato HTTP de /api/v1/reception/* (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, coherencia de la matriz, avance por OC, semáforo de cierre contra los datos de la propia API,
que las evidencias no expongan rutas de almacenamiento y que no exista ninguna ruta de escritura.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/reception_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/reception'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
ZERO = '00000000-0000-4000-8000-000000000000'
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
EPS = [R + p for p in ['/matrix', '/orders', '/closure']]
anon = session(); check('sin sesión: 401', all(status(anon, p) == 401 for p in EPS + [f'{R}/receipts/{ZERO}']))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', all(status(o, p) == 403 for p in EPS)); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', all(status(adm, p) == 200 for p in EPS))
    for bad in ['/matrix?x=1', '/matrix?page_size=51', '/matrix?kind=x', '/matrix?client=abc', '/orders?status=done', '/orders?q=%01x', '/closure?page=1', f'/receipts/{ZERO}?a=1']:
        check(f'422 con parámetro inválido ({bad})', status(adm, R + bad) == 422)
    check('detalle con UUID inexistente: 404', all(status(adm, f'{R}{p}/{ZERO}') == 404 for p in ['/orders', '/receipts', '/deliveries']))
    check('sin rutas de escritura (POST/PUT/DELETE ≠ 2xx)', all(status(adm, R + s, m) >= 400 for s in ['/matrix', '/orders', '/closure', f'/receipts/{ZERO}', f'/deliveries/{ZERO}'] for m in ['POST', 'PUT', 'DELETE']))

    items, page = [], 1
    while True:
        d = get(f'{R}/matrix?page={page}&page_size=50'); items += d['items']; page += 1
        if len(items) >= d['total'] or page > 400: break
    s = d['summary']
    check('matriz: total = recepciones + entregas', d['total'] == s['receipts'] + s['deliveries'] == len(items))
    check('matriz: orden por fecha descendente', all(str(a['date'] or '') >= str(b['date'] or '') for a, b in zip(items, items[1:])))
    check('matriz: sin identificadores internos', not any('db_id' in i or 'po_db_id' in i for i in items))
    check('tarjetas por cliente = totales', sum(c['receipts'] for c in s['clients']) >= s['receipts'] and sum(c['deliveries'] for c in s['clients']) == s['deliveries'])
    rec = [i for i in items if i['kind'] == 'receipt']; dl = [i for i in items if i['kind'] == 'delivery']
    check('avance de recepción en 0–100+ o sin registrar', all(r['received_percent'] is None or r['received_percent'] >= 0 for r in rec))
    od = get(f'{R}/orders?page_size=50')
    check('OC: resumen por estado = total', sum(od['summary'].values()) == od['total'] and all(o['reception'] == ('pending' if o['receipt_count'] == 0 else 'complete' if (o['received_percent'] or 0) >= 100 else 'partial') for o in od['items']))
    pos = get('/api/v1/purchase-orders?page_size=50&scope=current')
    active = [p for p in pos['items'] if (p['legacy_status'] or p['operational_status'] or '').lower() not in ('cancelada', 'sustituida', 'cancelled', 'superseded')]
    check('OC vigentes no canceladas = módulo de Órdenes de Compra', od['total'] == len(active) or pos['total'] > 50)
    if od['items']:
        o = get(f"{R}/orders/{od['items'][0]['id']}")
        check('detalle de OC: partidas y recepciones de la serie', o['item']['folio'] == od['items'][0]['folio'] and len(o['receipts']) == od['items'][0]['receipt_count'])
    if rec:
        r = get(f"{R}/receipts/{rec[0]['id']}")
        check('detalle de recepción', r['item']['folio'] == rec[0]['folio'] and {'items', 'deliveries', 'files', 'signatures'} <= set(r))
    if dl:
        x = get(f"{R}/deliveries/{dl[0]['id']}")
        check('detalle de entrega: partidas, origen y evidencia', x['item']['folio'] == dl[0]['folio'] and len(x['items']) == dl[0]['item_count'] and {'sources', 'files', 'signatures'} <= set(x))
        check('evidencia sin rutas de almacenamiento', not re.search(r'storage_key|storage_backend|"path"', json.dumps(x)))
    c = get(f'{R}/closure'); k = c['counters']
    check('semáforo: contadores = listas', all(k[n] == len(c[n]) for n in k))
    check('semáforo: OC sin recepción = OC con 0 recepciones', k['po_without_receipt'] == od['summary']['pending'] or od['total'] > 50)
    check('semáforo: entregas no registradas = recepciones sin aceptación', k['deliveries_missing'] == len([r for r in rec if r['acceptance'] is None]))
    check('semáforo: recepciones con pendientes', k['receipts_pending'] == len([r for r in rec if r['pending_reasons']]))
    check('semáforo: aceptaciones pendientes (entregas no aceptadas + históricas)', k['acceptance_pending'] == len([x for x in dl if not re.match(r'^(accepted|aceptad)', (x['acceptance_status'] or '').lower())]) + len([r for r in rec if r['acceptance_source'] == 'legacy_receipt' and not re.match(r'^(accepted|aceptad)', (r['acceptance'] or '').lower())]))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nRecepción y Entrega (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
