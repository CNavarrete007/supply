#!/usr/bin/env python3
"""Gestión del Contratista · contrato HTTP de /api/v1/contractor-management/* (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, que los responsables sean personal activo de la organización, coherencia de requisiciones,
validaciones (requisition_reviews) y documentos posteriores, que no se expongan contraseñas ni identificadores internos y
que sin CSRF ninguna escritura responda 2xx (las escrituras reales se prueban en contractor_mgmt_write_http_check.py, solo
con base sintética).
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
T = f'{R}/strategy-setup'; M = f'{R}/validations'; RU = f'{R}/rules'
anon = session(); check('sin sesión: 401', all(status(anon, p) == 401 for p in [S, f'{R}/requisitions/{ZERO}', T, f'{R}/strategy/{ZERO}', M, RU]))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, S) == 403 and status(o, T) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', status(adm, S) == 200)
    check('422 con parámetros', status(adm, S + '?x=1') == 422 and status(adm, f'{R}/requisitions/{ZERO}?a=1') == 422)
    check('requisición inexistente o id inválido → 404', status(adm, f'{R}/requisitions/{ZERO}') == 404 and status(adm, f'{R}/requisitions/abc') == 404)
    check('sin CSRF ninguna escritura responde 2xx (POST/PUT/PATCH/DELETE)', all(status(adm, p, m) >= 400 for p in [S, f'{R}/requisitions/{ZERO}', f'{R}/validations', f'{R}/requisitions/{ZERO}/validations', T, f'{R}/strategy/{ZERO}', f'{R}/strategy/{ZERO}/lots', M, f'{M}/{ZERO}', RU] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))
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
    # Tarjeta 2 · estrategia y lotificación
    check('estrategia: 200 / 422 / 404', status(adm, T) == 200 and status(adm, T + '?x=1') == 422 and status(adm, f'{R}/strategy/{ZERO}') == 404 and status(adm, f'{R}/strategy/abc') == 404)
    t = get(T); sreqs = t['requisitions']; sups = t['suppliers']
    check('estrategia: solo requisiciones con validación (la más reciente)', {r['id'] for r in sreqs} == {r['id'] for r in reqs if r['review_count']} and all(r['review_folio'] == next(x for x in reqs if x['id'] == r['id'])['last_review']['folio'] for r in sreqs))
    check('catálogo: conteos autorizados y asignables', t['summary']['authorized'] == sum(1 for x in sups if x['status'] in ('authorized', 'active')) and t['summary']['available'] == sum(1 for x in sups if x['status'] not in ('suspended', 'inactive', 'blocked')) and t['summary']['suppliers'] == len(sups))
    check('catálogo: categorías de suministros como lista', all(isinstance(x['offering_categories'], list) for x in sups))
    for r in sreqs:
        x = get(f"{R}/strategy/{r['id']}")
        lots = (x['plan'] or {}).get('lots', [])
        ok = len(x['items']) == r['item_count'] and (x['plan'] is not None) == (r['plan_count'] > 0)
        ids = {i['id'] for i in x['items']}; sup_ids = {s['id'] for s in sups}
        ok = ok and all(it['id'] in ids for l in lots for it in l['items']) and all(s['id'] in sup_ids for l in lots for s in l['suppliers'])
        ok = ok and sum(len(l['rfqs']) for l in lots) + len(x['rfqs_without_lot']) == r['rfq_count']
        check(f"estrategia {r['folio']}: partidas, plan, proveedores y RFQ por lote coherentes", ok)
    check('estrategia: sin ids internos', not re.search(r'"(db_id|sourcing_lot_id|supplier_id_db|requisition_item_id)"', json.dumps([get(f"{R}/strategy/{r['id']}") for r in sreqs[:3]])))
    # Tarjeta 3 · matriz de validaciones
    check('matriz: 200 / 422', status(adm, M) == 200 and all(status(adm, M + b) == 422 for b in ['?x=1', '?buyer=nadie', '?page_size=51', '?page=0', '?q=%01']))
    mx = get(M + '?page_size=50'); sm = mx['summary']
    check('matriz: total = validaciones registradas', mx['total'] == sm['validations'] == sum(r['review_count'] for r in reqs) and len(mx['items']) == min(50, mx['total']))
    check('matriz: tarjetas por responsable suman el total; bloqueadas = total − puede cotizar', sum(b['total'] for b in sm['buyers']) == sm['validations'] and all(b['blocked'] == b['total'] - b['can_quote'] for b in sm['buyers']) and sm['blocked'] == sm['validations'] - sm['can_quote'])
    rule = lambda x: x['technical'].lower() in ('conforme', 'con observaciones') and x['contract'].lower() in ('conforme', 'con observaciones') and x['budget'].lower() in ('disponible', 'parcial')
    check('matriz: ¿puede cotizar? = regla de Reglas inteligentes', all(x['can_quote'] == rule(x) for x in mx['items']))
    check('matriz: vigente = la más reciente por requisición', all(x['latest'] == (x['folio'] == next(r['last_review']['folio'] for r in reqs if r['id'] == x['requisition_id'])) for x in mx['items']))
    ok_b = True
    for b in sm['buyers']:
        bb = get(M + f"?buyer={b['key']}&page_size=50")
        ok_b = ok_b and bb['total'] == b['total'] and all(x['buyer_key'] == b['key'] for x in bb['items']) and sum(1 for x in bb['items'] if x['can_quote']) == b['can_quote']
    check('matriz: filtro por responsable en el servidor', ok_b)
    if mx['items']:
        f0 = mx['items'][0]
        check('matriz: búsqueda por folio', any(x['folio'] == f0['folio'] for x in get(M + '?q=' + urllib.request.quote(f0['folio']))['items']) and get(M + '?q=zzz-no-existe')['total'] == 0)
        p1 = get(M + '?page_size=1&page=1'); p2 = get(M + '?page_size=1&page=2') if mx['total'] > 1 else {'items': []}
        check('matriz: paginación', len(p1['items']) == 1 and (mx['total'] < 2 or p1['items'][0]['id'] != p2['items'][0]['id']))
    check('matriz: sin ids internos', not re.search(r'"(db_id|rv_id|buyer_user_id|requisition_db_id)"', json.dumps(mx)))
    # Tarjeta 4 · reglas inteligentes
    check('reglas: 200 / 422', status(adm, RU) == 200 and status(adm, RU + '?x=1') == 422)
    ru = get(RU); k = ru['counters']
    check('reglas: sin validación = requisiciones sin validaciones registradas', k['without_validation'] == sum(1 for r in reqs if r['review_count'] == 0))
    check('reglas: bloqueadas + listas = requisiciones con validación vigente', k['blocked'] + k['ready'] == sum(1 for r in reqs if r['review_count']))
    cur = [x for x in get(M + '?page_size=50')['items'] if x['latest']]
    check('reglas: bloqueo / listas = ¿puede cotizar? de la validación vigente', k['ready'] == sum(1 for x in cur if x['can_quote']) and k['blocked'] == sum(1 for x in cur if not x['can_quote']) or len(cur) == 50)
    check('reglas: listas ≤ 100 y coherentes con los contadores', all(len(ru[n]) == min(100, k[n]) for n in ('without_validation', 'blocked', 'ready')))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nGestión del Contratista (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
