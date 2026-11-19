#!/usr/bin/env python3
"""Gestión del Contratista · contrato HTTP de /api/v1/contractor-management/* (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, que los responsables sean personal activo de la organización, coherencia de requisiciones,
validaciones (requisition_reviews) y documentos posteriores, que no se expongan contraseñas ni identificadores internos y
que no exista ninguna ruta de escritura.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/contractor_mgmt_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/contractor-management'; S = f'{R}/validation-setup'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
anon = session(); check('sin sesión: 401', status(anon, S) == 401 and status(anon, f'{R}/requisitions/{ZERO}') == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, S) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', status(adm, S) == 200)
    check('422 con parámetros', status(adm, S + '?x=1') == 422 and status(adm, f'{R}/requisitions/{ZERO}?a=1') == 422)
    check('requisición inexistente o id inválido → 404', status(adm, f'{R}/requisitions/{ZERO}') == 404 and status(adm, f'{R}/requisitions/abc') == 404)
    check('sin rutas de escritura (POST/PUT/PATCH/DELETE ≠ 2xx)', all(status(adm, p, m) >= 400 for p in [S, f'{R}/requisitions/{ZERO}', f'{R}/validations', f'{R}/requisitions/{ZERO}/validations'] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))
    d = get(S); reqs = d['requisitions']; buyers = d['buyers']
    check('estructura de requisiciones', all({'id', 'folio', 'project', 'client_name', 'internal_reference', 'item_count', 'review_count', 'last_review', 'rfq_count', 'quote_count', 'po_count'} <= set(r) for r in reqs) and d['summary']['requisitions'] == len(reqs))
    check('validación más reciente presente solo si hay validaciones', all((r['last_review'] is None) == (r['review_count'] == 0) for r in reqs) and d['summary']['with_review'] == sum(1 for r in reqs if r['review_count']))
    staff = get(f"/api/v1/contractors/{d['contractor']['id']}/personnel") if d['contractor'] else {'items': []}
    active = {p['id'] for p in staff['items'] if p['active']}
    check('responsables = personal activo del contratista (Contratista → Personal)', {b['id'] for b in buyers} == active and d['summary']['buyers'] == len(buyers))
    check('sin contraseñas, logins ni ids internos', not re.search(r'password|hash|login|"db_id"|buyer_user_id|person_id', json.dumps(d), re.I))
    with_rev = [r for r in reqs if r['review_count']]
    if with_rev:
        r = with_rev[0]; x = get(f"{R}/requisitions/{r['id']}")
        check('detalle: validaciones = conteo y la más reciente coincide', len(x['reviews']) == r['review_count'] and x['reviews'][0]['folio'] == r['last_review']['folio'])
        check('detalle: documentos posteriores = conteos del selector', [x['item'][k] for k in ('rfq_count', 'quote_count', 'po_count')] == [r[k] for k in ('rfq_count', 'quote_count', 'po_count')])
        check('detalle: partidas activas = conteo', len(x['items']) == r['item_count'])
        check('detalle: campos de requisition_reviews', all({'folio', 'buyer', 'technical', 'contract', 'budget', 'strategy', 'min_quotes', 'deadline', 'criteria', 'notes'} <= set(v) and isinstance(v['min_quotes'], int) for v in x['reviews']))
        check('detalle: sin ids internos', not re.search(r'"db_id"|buyer_user_id|requisition_id', json.dumps(x)))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nGestión del Contratista (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
