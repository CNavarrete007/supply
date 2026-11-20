#!/usr/bin/env python3
"""Requisición › Catálogo de categorías · contrato HTTP de GET /api/v1/catalogs/categories (SOLO LECTURA; apto para la base real).
Verifica 401/403/422, que no exista ninguna ruta de escritura, estructura y totales, coincidencia con el catálogo que usa
Registro de requisición (/recovery/catalogs), uso coherente con las partidas de la matriz y que no se expongan ids internos.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/categories_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
C = '/api/v1/catalogs/categories'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
anon = session(); check('sin sesión: 401', status(anon, C) == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, C) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', status(adm, C) == 200)
    check('422 con cualquier parámetro', all(status(adm, C + q) == 422 for q in ['?x=1', '?q=a', '?page=1', '?status=all']))
    check('sin rutas de escritura (POST/PUT/PATCH/DELETE ≠ 2xx)', all(status(adm, p, m) >= 400 for p in [C, C + '/cat_x', C + '/00000000-0000-4000-8000-000000000000'] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))
    d = get(C); items = d['items']; t = d['totals']
    check('solo lectura declarada', d.get('read_only') is True)
    keys = {'code', 'name', 'description', 'active', 'imported', 'usage'}; ukeys = {'items', 'items_by_label', 'requisitions', 'suppliers', 'offerings'}
    check('estructura de cada categoría', all(set(c) == keys and set(c['usage']) == ukeys and isinstance(c['active'], bool) and all(isinstance(v, int) and v >= 0 for v in c['usage'].values()) for c in items))
    check('totales coherentes', t['categories'] == len(items) and t['active'] == sum(c['active'] for c in items) and t['inactive'] == len(items) - t['active']
          and t['items'] == sum(c['usage']['items'] + c['usage']['items_by_label'] for c in items) and t['unlinked_items'] >= 0)
    check('ordenadas por nombre', [c['name'] for c in items] == sorted([c['name'] for c in items], key=lambda s: s.lower()) or len(items) < 2)
    check('códigos únicos', len({c['code'] for c in items}) == len(items))
    rec = get('/api/v1/recovery/catalogs')['categories']
    check('coincide con el catálogo de Registro de requisición (código, nombre, estatus, descripción)',
          sorted((c['code'], c['name'], bool(c['active']), c.get('description') or None) for c in rec) == sorted((c['code'], c['name'], c['active'], c['description'] or None) for c in items))
    lines = sum(int(r.get('line_count') or 0) for r in get('/api/v1/recovery/matrix')['items'])
    check('uso ≤ partidas registradas y requisiciones ≤ partidas', t['items'] + t['unlinked_items'] <= lines and all(c['usage']['requisitions'] <= c['usage']['items'] + c['usage']['items_by_label'] for c in items), f"{t} vs {lines}")
    check('sin ids internos', not re.search(r'"(id|organization_id|category_id|legacy_id)"\s*:', json.dumps(d)))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCatálogo de categorías (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
