#!/usr/bin/env python3
"""Servicios Operativos · contrato HTTP de /api/v1/services/* (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, coherencia de tarjetas por cliente y comprador con la matriz, filtros en el servidor, margen,
paginación, que no se expongan ids internos ni rutas de almacenamiento y que no exista ninguna ruta de escritura.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/services_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.parse, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/services'; M = f'{R}/matrix'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
anon = session(); check('sin sesión: 401', status(anon, M) == 401 and status(anon, f'{R}/{ZERO}') == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, M) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', status(adm, M) == 200)
    check('422 con parámetros inválidos', all(status(adm, M + b) == 422 for b in ['?x=1', '?client=abc', '?buyer=nadie', '?page_size=51', '?q=%01']) and status(adm, f'{R}/{ZERO}?a=1') == 422)
    check('servicio inexistente o id inválido → 404', status(adm, f'{R}/{ZERO}') == 404 and status(adm, f'{R}/abc') == 404)
    check('sin rutas de escritura (POST/PUT/PATCH/DELETE ≠ 2xx)', all(status(adm, p, m) >= 400 for p in [M, R, f'{R}/{ZERO}'] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))
    a = get(M + '?page_size=50'); cl = a['summary']['clients']
    check('tarjetas por cliente suman el total', sum(c['services'] for c in cl) == a['total'] == a['summary']['services'])
    check('estructura de la fila', all({'folio', 'requisition', 'internal_reference', 'service', 'client_name', 'project', 'date', 'authorization_type', 'supplier_po', 'invoices', 'status', 'quantity', 'cost', 'price', 'margin', 'responsible', 'evidence_count', 'buyer_key'} <= set(x) for x in a['items']))
    check('margen = venta − costo', all(x['margin'] is None or abs(x['margin'] - (x['price'] - x['cost'])) < 1e-6 for x in a['items']))
    ok = True
    for c in cl:
        d = get(M + f"?client={c['id']}&page_size=50")
        ok = ok and d['total'] == c['services'] and all(x['client_id'] == c['id'] for x in d['items']) and sum(1 for x in d['items'] if x['is_open']) == c['open'] and sum(1 for x in d['items'] if x['evidence_count'] > 0) == c['with_evidence']
        ok = ok and sum(b['services'] for b in d['summary']['buyers']) == c['services'] and len(d['summary']['buyers']) == c['buyers']
        for b in d['summary']['buyers']:
            e = get(M + f"?client={c['id']}&buyer={b['key']}&page_size=50")
            ok = ok and e['total'] == b['services'] and all(x['buyer_key'] == b['key'] for x in e['items']) and sum(1 for x in e['items'] if x['is_done']) == b['completed']
    check('cliente → comprador: conteos coherentes (servicios, abiertos, evidencias, completados)', ok)
    if a['items']:
        x0 = a['items'][0]
        check('filtros de servicio, estatus y búsqueda en el servidor', all(y['service'] == x0['service'] for y in get(M + '?page_size=50&service=' + urllib.parse.quote(x0['service']))['items'])
              and all(y['status'] == x0['status'] for y in get(M + '?page_size=50&status=' + urllib.parse.quote(x0['status']))['items'])
              and any(y['folio'] == x0['folio'] for y in get(M + '?q=' + urllib.parse.quote(x0['folio']))['items']) and get(M + '?q=zzz-no-existe')['total'] == 0)
        p1 = get(M + '?page_size=1&page=1'); p2 = get(M + '?page_size=1&page=2') if a['total'] > 1 else {'items': []}
        check('paginación', len(p1['items']) == 1 and (a['total'] < 2 or p1['items'][0]['id'] != p2['items'][0]['id']))
        dd = get(f"{R}/{x0['id']}")
        check('solicitud: detalle del servicio, datos operativos y evidencias (metadatos)', dd['item']['folio'] == x0['folio'] and isinstance(dd['details'], dict) and len(dd['files']) == x0['evidence_count'])
        check('sin ids internos ni rutas de almacenamiento', not re.search(r'"(so_id|db_id|requisition_db_id)"|storage_key|"path"', json.dumps([a, dd])))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nServicios Operativos (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
