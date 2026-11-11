#!/usr/bin/env python3
"""Factura · contrato HTTP de /api/v1/invoices* (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, estados derivados, montos por moneda sin canceladas, control coherente con la matriz y con el
semáforo de Recepción, que los archivos no expongan rutas de almacenamiento y que no exista ninguna ruta de escritura.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/invoices_http_check.py
"""
import datetime, http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/invoices'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
EPS = [R, R + '/control', R + '/requisitions']
anon = session(); check('sin sesión: 401', all(status(anon, p) == 401 for p in EPS + [f'{R}/{ZERO}']))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', all(status(o, p) == 403 for p in EPS)); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', all(status(adm, p) == 200 for p in EPS))
    for bad in ['?x=1', '?page_size=51', '?state=void', '?client=abc', '?q=%01x', '/control?page=1', '/requisitions?q=x', f'/{ZERO}?a=1']:
        check(f'422 con parámetro inválido ({bad})', status(adm, R + bad) == 422)
    check('detalle con UUID inexistente: 404', status(adm, f'{R}/{ZERO}') == 404 and status(adm, f'{R}/requisitions/{ZERO}') == 404)
    check('sin rutas de escritura (POST/PUT/DELETE ≠ 2xx)', all(status(adm, R + s, m) >= 400 for s in ['', '/control', f'/{ZERO}', f'/requisitions/{ZERO}'] for m in ['POST', 'PUT', 'DELETE']))
    items, page = [], 1
    while True:
        d = get(f'{R}?page={page}&page_size=50'); items += d['items']; page += 1
        if len(items) >= d['total'] or page > 400: break
    today = datetime.date.today().isoformat()
    def expected(i):
        s = (i['legacy_status'] or i['status_code'] or '').lower()
        return 'cancelled' if s in ('cancelada', 'cancelled') else 'paid' if s in ('pagada', 'paid') else 'overdue' if i['due_date'] and i['due_date'] < today else 'pending'
    check('estado derivado por factura', all(i['state'] == expected(i) for i in items))
    st = {x['code']: x['count'] for x in d['summary']['states']}
    check('resumen de estados = conteo de la lista', sum(st.values()) == d['total'] and all(st.get(k, 0) == len([i for i in items if i['state'] == k]) for k in ('pending', 'overdue', 'paid', 'cancelled')))
    mon = {}
    for i in items:
        if i['state'] != 'cancelled': mon[i['currency']] = mon.get(i['currency'], 0) + float(i['total_amount'])
    check('montos por moneda sin canceladas', all(abs(float(m['amount']) - mon.get(m['currency'], 0)) < 0.01 for m in d['summary']['money']) and len(d['summary']['money']) == len(mon))
    check('archivo sin ruta de almacenamiento', not re.search(r'storage_key|storage_backend|sandbox/', json.dumps(items)))
    for s in ('pending', 'overdue', 'paid', 'cancelled'):
        f = get(f'{R}?state={s}&page_size=50'); check(f'filtro state={s}', f['total'] == st.get(s, 0) and all(i['state'] == s for i in f['items']))
    if items:
        x = get(f"{R}/{items[0]['id']}")
        check('detalle con OC y acuses', x['item']['folio'] == items[0]['folio'] and len(x['acknowledgments']) == items[0]['acknowledgments'] and isinstance(x['purchase_orders'], list))
    c = get(f'{R}/control'); k = c['counters']
    check('control: vigentes, pendientes, vencidas y pagadas = lista', k['active'] == len([i for i in items if i['state'] != 'cancelled']) and k['pending_payment'] == len([i for i in items if i['state'] in ('pending', 'overdue')]) and k['overdue'] == len(c['overdue']) == st.get('overdue', 0) and k['paid'] == st.get('paid', 0))
    rc = get('/api/v1/reception/closure')
    check('listos para facturar = semáforo de Recepción', k['ready_to_invoice'] == rc['counters']['ready_to_invoice'] and sorted(r['id'] for r in c['ready_to_invoice']) == sorted(r['id'] for r in rc['ready_to_invoice']))
    rq = get(f'{R}/requisitions')
    check('requisiciones: listas sin factura = control', len([r for r in rq['items'] if r['ready'] and not r['invoiced']]) == k['ready_to_invoice'])
    if rq['items']:
        ctx = get(f"{R}/requisitions/{rq['items'][0]['id']}")
        check('contexto de requisición', ctx['requisition']['folio'] == rq['items'][0]['folio'] and ctx['readiness']['ready'] == rq['items'][0]['ready'] and isinstance(ctx['invoices'], list))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nFactura (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
