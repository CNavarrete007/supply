#!/usr/bin/env python3
"""Catálogos · diagnóstico del guardado (GET /api/v1/catalogs/write-status). SOLO LECTURA: apto para la base real.
Verifica 401/403/422, que no haya rutas de escritura, la forma exacta de la respuesta (sin secretos ni rutas internas) y el código.
Con SF_EXPECT_WRITE_STATUS=<código> exige ese resultado (OK en un equipo con la cuenta catalogwrite aprovisionada).
Uso: SF_API=http://127.0.0.1:8080 SF_QA_PASSWORD=... [SF_USER=<correo>] [SF_NONADMIN_USER=<correo>] [SF_EXPECT_WRITE_STATUS=OK] python3 tests/catalog_write_status_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', ''); EXPECT = os.environ.get('SF_EXPECT_WRITE_STATUS', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
P = '/api/v1/catalogs/write-status'
CODES = {'OK', 'CATALOG_WRITE_NOT_PROVISIONED', 'CATALOG_WRITE_ACCOUNT_REJECTED', 'CATALOG_WRITE_GRANTS_INCOMPLETE', 'CATALOG_WRITE_UNAVAILABLE'}

def session(email=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op
def call(op, path, method='GET', body=None, headers=None):
    try:
        r = op.open(urllib.request.Request(API + path, body, headers or {}, method=method)); return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()
def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass

check('sin sesión: 401', call(session(), P)[0] == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', call(o, P)[0] == 403); logout(o)
adm = session(USER)
try:
    st, hd, raw = call(adm, P)
    body = json.loads(raw)
    check('Master Admin: 200 sin caché', st == 200 and 'no-store' in (hd.get('Cache-Control') or ''), f'{st} {hd.get("Cache-Control")}')
    check('forma exacta de la respuesta', set(body) == {'enabled', 'code', 'expected_grants', 'missing_grants', 'read_only'} and body['read_only'] is True, str(sorted(body)))
    check('código conocido y coherente con enabled', body['code'] in CODES and body['enabled'] == (body['code'] == 'OK'), f"{body['code']} {body['enabled']}")
    check('contrato de 35 permisos', body['expected_grants'] == 35, str(body['expected_grants']))
    check('permisos faltantes solo si el código lo indica', (body['missing_grants'] != []) == (body['code'] == 'CATALOG_WRITE_GRANTS_INCOMPLETE')
          and all(re.fullmatch(r'(SELECT|INSERT|UPDATE|DELETE) [a-z_]+', m) for m in body['missing_grants']), str(body['missing_grants']))
    check('sin secretos ni rutas internas', not re.search(r'(?i)password|secret|/run/|\.txt|[0-9a-f]{64}', raw.decode()), raw.decode()[:200])
    check('parámetros desconocidos: 422', call(adm, P + '?x=1')[0] == 422)
    tok = json.loads(adm.open(API + '/api/v1/auth/csrf').read())['csrf_token']
    w = [call(adm, P, m, b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok})[0] for m in ('POST', 'PUT', 'PATCH', 'DELETE')]
    check('sin rutas de escritura (≠ 2xx)', all(not 200 <= x < 300 for x in w), str(w))
    if EXPECT:
        check(f'resultado esperado: {EXPECT}', body['code'] == EXPECT, body['code'])
    print(f"Estado del guardado de catálogos: {body['code']}" + (f" · faltan {len(body['missing_grants'])} permisos" if body['missing_grants'] else ''))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCatálogos · estado del guardado (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
