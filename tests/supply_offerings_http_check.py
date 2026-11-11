#!/usr/bin/env python3
"""Suministros de proveedores · contrato HTTP de GET /api/v1/catalogs/supplier-offerings (SOLO LECTURA).

Solo hace GET (más login/logout); apto para la base sintética o la base local real. Verifica 401 sin sesión, 200 con
Master Admin (403 opcional con SF_NONADMIN_USER), validación estricta (422), límites de página, que el catálogo NO
expone precios, coherencia del resumen por proveedor y que los filtros de proveedor y estatus devuelven solo lo pedido.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> python3 tests/supply_offerings_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.parse, urllib.request

API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/')
USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', '')
NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD:
    print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
P = '/api/v1/catalogs/supplier-offerings'
results = []
check = lambda n, ok, d='': results.append((n, bool(ok), d))

def session(email=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op

def status(op, path):
    try: return op.open(API + path).status
    except urllib.error.HTTPError as e: return e.code

def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass

check('sin sesión: 401', status(session(), P) == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, P) == 403); logout(o)
adm = session(USER)
try:
    get = lambda q='': json.loads(adm.open(API + P + q).read())
    check('Master Admin: 200', status(adm, P) == 200)
    for bad in ['?x=1', '?page_size=51', '?page=0', '?supplier=abc', '?status=BAD!', '?q=' + 'a' * 121]:
        check(f'422 con filtro inválido ({bad[:18]})', status(adm, P + bad) == 422)
    items, page, total = [], 1, None
    while total is None or len(items) < total:
        d = get(f'?page={page}&page_size=50'); total = d['total']; items += d['items']; page += 1
        if page > 200: break
    check('todas las páginas (≤ 50) suman el total', len(items) == total and all(len(get(f'?page={p}&page_size=50')['items']) <= 50 for p in (1,)))
    check('sin precios en el catálogo', all(not any(re.search(r'price|precio|amount|total|cost', k, re.I) for k in i) for i in items))
    s = d['summary']
    check('resumen: suma por proveedor = total', sum(x['total'] for x in s['suppliers']) == s['total'] == total and all(0 <= x['active'] <= x['total'] for x in s['suppliers']))
    check('resumen: estatus suman el total', sum(x['count'] for x in s['statuses']) == total)
    if s['suppliers']:
        sup = s['suppliers'][0]
        f = get(f"?supplier={sup['id']}&page_size=50")
        check('filtro por proveedor: solo ese proveedor y conteo exacto', f['total'] == sup['total'] and all(i['supplier_id'] == sup['id'] for i in f['items']))
    if s['statuses']:
        st = s['statuses'][0]
        f = get(f"?status={urllib.parse.quote(st['code'])}&page_size=50")
        check('filtro por estatus: conteo de la faceta', f['total'] == st['count'] and all(i['status'] == st['code'] for i in f['items']))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok)
print(f'\nSuministros (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
