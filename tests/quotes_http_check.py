#!/usr/bin/env python3
"""Cotizaciones y Comparativo · contrato HTTP de /api/v1/quotes/* (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, coherencia de resúmenes, versión vigente por serie, comparativo, que la cotización al cliente no
exponga costos internos, las familias Rev. 0 → Rev. N de /revisions y que no exista ninguna ruta de escritura.
Con SF_ADMIN2_USER (otro Master Admin) comprueba que la elegibilidad para Solicitar modificación es por capturista.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/quotes_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.parse, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', ''); ADMIN2 = os.environ.get('SF_ADMIN2_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/quotes'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
LISTS = ['/rfqs', '/supplier-quotes', '/comparison', '/customer-quotes', '/awards', '/revisions']
EPS = [R + p for p in LISTS]
anon = session(); check('sin sesión: 401', all(status(anon, p) == 401 for p in EPS + [f'{R}/rfqs/{ZERO}']))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', all(status(o, p) == 403 for p in EPS)); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', all(status(adm, p) == 200 for p in EPS))
    for bad in ['/rfqs?x=1', '/rfqs?page_size=51', '/rfqs?supplier=abc', '/supplier-quotes?status=%27or', '/comparison?requisition=abc', '/comparison?page=1',
                '/customer-quotes?scope=x', '/customer-quotes?client=1', '/awards?status=%27x', f'/rfqs/{ZERO}?a=1',
                '/revisions?status=superseded', '/revisions?client=1', '/revisions?page_size=51', '/revisions?q=%01']:
        check(f'422 con parámetro inválido ({bad})', status(adm, R + bad) == 422)
    check('detalle con UUID inexistente: 404', all(status(adm, f'{R}{p}/{ZERO}') == 404 for p in ['/rfqs', '/supplier-quotes', '/customer-quotes']))
    check('detalle con identificador no UUID: 404', status(adm, R + '/rfqs/abc') == 404)
    check('sin rutas de escritura (POST/PUT/DELETE ≠ 2xx)', all(status(adm, R + s, m) >= 400 for s in LISTS + [f'/rfqs/{ZERO}', f'/customer-quotes/{ZERO}'] for m in ['POST', 'PUT', 'DELETE']))

    rf = get(f'{R}/rfqs?page_size=50'); s = rf['summary']
    check('RFQ: resumen coherente', s['total'] == rf['total'] and 0 <= s['responded'] <= s['total'] and 0 <= s['overdue'] <= s['total'] - s['responded'] and sum(x['count'] for x in s['statuses']) == s['total'])
    if rf['items']:
        d = get(f"{R}/rfqs/{rf['items'][0]['id']}")
        check('RFQ: detalle sin precios', d['item']['folio'] == rf['items'][0]['folio'] and len(d['items']) == rf['items'][0]['item_count'] and not any('price' in k or 'amount' in k for i in d['items'] for k in i))
    sq = get(f'{R}/supplier-quotes?page_size=50')
    check('cotizaciones de proveedor: resumen por proveedor = total', sum(x['total'] for x in sq['summary']['suppliers']) == sq['total'] == sum(x['count'] for x in sq['summary']['statuses']))
    if sq['items']:
        d = get(f"{R}/supplier-quotes/{sq['items'][0]['id']}")
        check('cotización de proveedor: detalle con partidas', d['item']['folio'] == sq['items'][0]['folio'] and len(d['items']) >= 1 and 'unit_price' in d['items'][0])
    cm = get(f'{R}/comparison')
    check('comparativo: requisiciones con cotizaciones', all(r['quotes'] >= 1 and r['suppliers'] >= 1 for r in cm['requisitions']))
    if cm['requisitions']:
        d = get(f"{R}/comparison?requisition={cm['requisitions'][0]['id']}")
        check('comparativo: partidas con ofertas por proveedor', d['requisition']['folio'] == cm['requisitions'][0]['folio'] and all({'quote_id', 'supplier_name', 'unit_price', 'currency', 'offered', 'awarded'} <= set(o) for l in d['lines'] for o in l['offers']))
    cur = get(f'{R}/customer-quotes?page_size=50'); allv = get(f'{R}/customer-quotes?page_size=50&scope=all')
    check('cliente: versión vigente única por serie', len({v['series'] for v in cur['items']}) == len(cur['items']) and allv['total'] >= cur['total'])
    check('cliente: resúmenes coherentes', sum(x['count'] for x in cur['summary']['decisions']) == cur['total'] == sum(c['total'] for c in cur['summary']['clients']) and all(isinstance(m['quotes'], int) for m in cur['summary']['money']))
    if cur['items']:
        d = get(f"{R}/customer-quotes/{cur['items'][0]['id']}"); txt = json.dumps(d)
        check('cliente: detalle sin costos internos', not re.search(r'cost|margin|supplier_unit|markup', txt, re.I) and d['item']['folio'] == cur['items'][0]['folio'])
        check('cliente: historial de versiones de la serie', len(d['versions']) == cur['items'][0]['versions'])
    # Revisiones / modificaciones: una familia por serie, Rev. 0 y revisión vigente reales, grupos y elegibilidad R3A.
    fam = get(f'{R}/revisions?page_size=50'); fs = fam['summary']
    check('revisiones: familias = series vigentes y resumen entero', fs['families'] == fam['total'] == cur['total'] and all(isinstance(v, int) for v in fs.values()))
    check('revisiones: grupos pendiente/aprobada/cerrada suman las familias', fs['pending'] + fs['current_approved'] + fs['closed'] == fs['families'])
    check('revisiones: filtros por grupo en el servidor', all(get(f'{R}/revisions?page_size=50&status={g}')['total'] == fs[k] for g, k in [('pending', 'pending'), ('approved', 'current_approved'), ('closed', 'closed')]))
    check('revisiones: KPI coherentes', 0 <= fs['with_rev_n'] <= fs['families'] and 0 <= fs['approved'] <= fs['families'] and 0 <= fs['linked_cr'] <= fs['families'])
    check('revisiones: sin costos internos', not re.search(r'cost|margin|supplier_unit|markup', json.dumps(fam), re.I))
    BLOCKS = {None, 'imported', 'not_rf1', 'not_owner', 'pending_change'}
    check('revisiones: elegibilidad coherente', all(i['can_request_change'] == (i['change_block'] is None) and i['change_block'] in BLOCKS and (i['change_block'] != 'pending_change' or i['pending_change']) for i in fam['items']))
    for i in fam['items'][:5]:
        d = get(f"{R}/customer-quotes/{i['current_id']}"); vs = d['versions']
        check(f"revisiones {i['series']}: vigente = última versión, Rev. 0 = primera", vs[-1]['id'] == i['current_id'] and len(vs) == i['revisions'] and vs[0]['folio'] == i['rev0_folio']
              and float(vs[0]['total_amount']) == float(i['rev0_total']) and float(vs[-1]['total_amount']) == float(i['current_total']) and i['current_version'] == int(vs[-1]['version_number']))
        hit = get(f"{R}/revisions?page_size=50&q={urllib.parse.quote(i['current_folio'])}")
        check(f"revisiones {i['series']}: búsqueda por folio", any(x['id'] == i['id'] for x in hit['items']))
    check('revisiones: comodín % se trata como texto', get(f'{R}/revisions?q=%25%25%25')['total'] <= fs['families'])
    if ADMIN2 and fam['items']:
        o2 = session(ADMIN2)
        try:
            other = {x['id']: x for x in json.loads(o2.open(API + f'{R}/revisions?page_size=50').read())['items']}
            mine = [i for i in fam['items'] if i['can_request_change']]
            check('revisiones: otro Master Admin no puede solicitar sobre requisiciones ajenas', all(other[i['id']]['change_block'] == 'not_owner' for i in mine), [i['series'] for i in mine])
        finally:
            logout(o2)
    aw = get(f'{R}/awards?page_size=50'); awa = get(f'{R}/awards?page_size=50&status=all')
    check('adjudicaciones: vigentes ⊆ todas', aw['total'] <= awa['total'] and all(a['superseded_at'] is None for a in aw['items']))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCotizaciones (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
