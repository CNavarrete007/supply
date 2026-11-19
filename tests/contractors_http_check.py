#!/usr/bin/env python3
"""Contratista · contrato HTTP de /api/v1/contractors (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, que solo se lee la organización de la sesión, coherencia del personal y que no se expongan
contraseñas, identificadores de inicio de sesión ni rutas de almacenamiento; y que no exista ninguna ruta de escritura.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/contractors_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.parse, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/contractors'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
anon = session(); check('sin sesión: 401', status(anon, R) == 401 and status(anon, f'{R}/{ZERO}/personnel') == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, R) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', status(adm, R) == 200)
    for bad in ['?x=1', '?status=done', '?q=%01x', '?page=1']:
        check(f'422 con parámetro inválido ({bad})', status(adm, R + bad) == 422)
    check('personal: UUID ajeno o inválido → 404; parámetros → 422', status(adm, f'{R}/{ZERO}/personnel') == 404 and status(adm, f'{R}/abc/personnel') == 404)
    check('sin rutas de escritura (POST/PUT/PATCH/DELETE ≠ 2xx)', all(status(adm, p, m) >= 400 for p in [R, f'{R}/{ZERO}', f'{R}/{ZERO}/personnel'] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))
    d = get(R); items = d['items']
    check('solo la organización de la sesión', d['total'] == len(items) <= 1 and (not items or items[0]['id'] == d['active_id']) and d['summary']['companies'] == 1)
    check('estructura: contacto, responsable, personal, estatus y uso', all({'legal_name', 'tax_identifier', 'phone', 'email', 'postal_address', 'status', 'has_logo', 'responsible', 'personnel', 'with_access', 'active', 'usage'} <= set(c) for c in items))
    check('sin contraseñas, logins ni rutas de almacenamiento', not re.search(r'password|hash|login|storage_key|logo_file_id|"path"', json.dumps(d), re.I))
    if items:
        c = items[0]
        check('filtro de texto (nombre parcial) y estatus', get(R + '?q=' + urllib.parse.quote(c['legal_name'][:5]))['total'] == 1 and get(R + '?q=zzz-no-existe')['total'] == 0
              and get(R + '?status=' + ('active' if c['status'] == 'active' else 'inactive'))['total'] == 1 and get(R + '?status=' + ('inactive' if c['status'] == 'active' else 'active'))['total'] == 0)
        p = adm.open(API + f"{R}/{c['id']}/personnel"); pd = json.loads(p.read())
        check('personal de la organización (200)', p.status == 200 and pd['contractor']['id'] == c['id'])
        check('personal: total = personas registradas; activas = columna Personal', pd['total'] == c['personnel_total'] and sum(1 for x in pd['items'] if x['active']) == c['personnel'])
        check('personal: con acceso coincide con la columna', sum(1 for x in pd['items'] if x['has_user'] and x['access_enabled'] and x['user_status'] == 'active') == c['with_access'])
        check('personal: responsable marcado solo si existe', sum(1 for x in pd['items'] if x['responsible']) == (1 if c['responsible'] else 0))
        check('personal: sin contraseñas ni identificadores internos', not re.search(r'password|hash|login|person_id|"user_id"', json.dumps(pd), re.I))
        check('personal: parámetros → 422', status(adm, f"{R}/{c['id']}/personnel?x=1") == 422)
        check('uso: conteos no negativos', all(isinstance(v, int) and v >= 0 for v in c['usage'].values()))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nContratista (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
