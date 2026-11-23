#!/usr/bin/env python3
"""Requisición › Control de cambios · contrato HTTP del tablero GET /api/v1/requisition-changes (SOLO LECTURA; apto para la base real).
Verifica 401/403/422, que no exista ninguna ruta de escritura en el tablero, la derivación de estados del original
(flow_state/flow_label desde hechos R3), que los KPI cuadran con los filtros, paginación y que no se expongan ids internos.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/requisition_changes_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.parse, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
B = '/api/v1/requisition-changes'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
FLOW = {'pending_client': 'Pendiente de aprobación del cliente', 'approved': 'Cambio aprobado', 'partial_resupply': 'Reabastecimiento parcial requerido',
        'po_reconciliation': 'Conciliación de OC/recepción requerida', 'pending_review': 'Pendiente de revisión independiente', 'rejected': 'Rechazada', 'withdrawn': 'Retirada'}
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
anon = session(); check('sin sesión: 401', status(anon, B) == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, B) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', status(adm, B) == 200)
    check('422 con parámetros inválidos', all(status(adm, B + q) == 422 for q in ['?state=nada', '?status=x', '?scope=x', '?x=1', '?page_size=51', '?q=%01']))
    check('sin rutas de escritura en el tablero (POST/PUT/PATCH/DELETE ≠ 2xx)', all(status(adm, B + p, m) >= 400 for p in ['', '/candidates'] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))
    a = get(B + '?page_size=50'); k = a['kpis']
    allrows = []
    for p in range(1, a['pages'] + 1):
        allrows += get(B + f'?page_size=50&page={p}')['items']
    check('KPI total = solicitudes listadas', k['total'] == a['total'] == len(allrows))
    check('estados del original derivados de R3 (flow_state/flow_label)', all((r['flow_state'] in FLOW and r['flow_label'] == FLOW[r['flow_state']]) or r['flow_state'] == 'other' for r in allrows))
    def rule(r):
        s = r['status_code']
        if s == 'applied': return 'partial_resupply' if r['requires_sourcing'] else 'approved'
        if s in ('rejected', 'withdrawn'): return s
        if s == 'pending_review':
            if r['cq_count'] > 0 and not r['client_confirmed']: return 'pending_client'
            if r['po_count'] > 0 and not r['po_amended']: return 'po_reconciliation'
            return 'pending_review'
        return 'other'
    check('regla de derivación coherente por fila', all(r['flow_state'] == rule(r) for r in allrows))
    check('KPI por estado = filas por estado', all(k['flow'].get(s, 0) == sum(1 for r in allrows if r['flow_state'] == s) for s in list(FLOW) + ['other']))
    check('KPI aprobados = aplicadas', k['applied'] == sum(1 for r in allrows if r['status_code'] == 'applied'))
    check('KPI intervención adicional coherente', k['intervention'] == sum(1 for r in allrows if r['intervention']))
    ok = True
    for s in ['pending_client', 'approved', 'partial_resupply', 'po_reconciliation', 'withdrawn']:
        d = get(B + f'?state={s}&page_size=50'); ok = ok and d['total'] == k['flow'][s] and all(r['flow_state'] == s for r in d['items'])
    d = get(B + '?state=applied&page_size=50'); ok = ok and d['total'] == k['applied'] and all(r['status_code'] == 'applied' for r in d['items'])
    d = get(B + '?state=intervention&page_size=50'); ok = ok and d['total'] == k['intervention'] and all(r['intervention'] for r in d['items'])
    check('filtros state del tablero en el servidor', ok)
    if allrows:
        r0 = allrows[0]
        check('búsqueda por folio y por estado', any(x['id'] == r0['id'] for x in get(B + '?q=' + urllib.parse.quote(r0['folio']))['items'])
              and all(x['flow_label'] == r0['flow_label'] or r0['flow_label'].lower() in json.dumps(x, ensure_ascii=False).lower() for x in get(B + '?page_size=50&q=' + urllib.parse.quote(r0['flow_label']))['items']))
        check('independencia: nunca revisable por quien la solicitó', all(not (r['reviewable'] and r['mine']) for r in allrows))
    check('sin ids internos', not re.search(r'"(change_db_id|db_id|organization_id|requisition_db_id)"\s*:', json.dumps(a)))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nControl de cambios (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
