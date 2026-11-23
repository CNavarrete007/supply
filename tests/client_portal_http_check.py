#!/usr/bin/env python3
"""Portal del Cliente · vista previa interna (GET /api/v1/portal/preview/..., SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, que no existan rutas de escritura y que cada cliente vea SOLO lo suyo, cruzando con OTROS endpoints:
clientes ↔ /catalogs/clients · etapas ↔ /recovery/matrix (política de 8 etapas) · cotizaciones ↔ /quotes/customer-quotes (solo enviadas
al cliente; borradores y revisiones internas → 404) · OC ↔ /purchase-orders (sin proveedor ni montos) · facturas ↔ /invoices.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] [SF_MAX_CLIENTS=40] python3 tests/client_portal_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', ''); MAXC = int(os.environ.get('SF_MAX_CLIENTS', '40'))
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
B = '/api/v1/portal/preview/clients'
VISIBLE = {'sent', 'expired', 'approved', 'rejected', 'change_requested'}
ZERO = '00000000-0000-4000-8000-000000000000'

def session(email=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op
def status(op, path, method='GET', body=None, headers=None):
    try: return op.open(urllib.request.Request(API + path, body, headers or {}, method=method)).status
    except urllib.error.HTTPError as e: return e.code
def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']; op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass
fold = lambda s: (s or '').strip().lower()

check('sin sesión: 401', status(session(), B) == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, B) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    def pages(path):
        out, p = [], 1
        while True:
            d = get(f"{path}{'&' if '?' in path else '?'}page={p}&page_size=50"); out += d['items']
            if len(out) >= d['total'] or p >= 80: return out
            p += 1
    check('422 con parámetros; 404 con ids inválidos o inexistentes', status(adm, B + '?x=1') == 422 and status(adm, f'{B}/no-es-uuid') == 404 and status(adm, f'{B}/{ZERO}') == 404)
    tok = json.loads(adm.open(API + '/api/v1/auth/csrf').read())['csrf_token']
    w = [status(adm, B + sfx, m, b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}) for m in ('POST', 'PUT', 'PATCH', 'DELETE') for sfx in ('', f'/{ZERO}')]
    check('sin rutas de escritura (≠ 2xx)', all(not 200 <= x < 300 for x in w), str(w))
    lst = get(B)
    check('acceso externo deshabilitado y solo lectura', lst['external_access_enabled'] is False and lst['read_only'] is True)
    cat = {c['id']: c for c in pages('/api/v1/catalogs/clients?status=all')}
    check('clientes = catálogo de Clientes (mismos ids y códigos)', {c['id'] for c in lst['items']} <= set(cat) and all(cat[c['id']]['code'] == c['code'] for c in lst['items']), f"{len(lst['items'])} vs {len(cat)}")

    matrix = get('/api/v1/recovery/matrix')['items']
    cq = pages('/api/v1/quotes/customer-quotes?scope=all')
    pos = pages('/api/v1/purchase-orders?scope=current')
    invs = pages('/api/v1/invoices?')
    clients = [c for c in lst['items'] if c['requisitions'] > 0][:MAXC]
    stage_ok = docs_ok = quote_ok = po_ok = inv_ok = True; detail = ''; hidden = []; shown = []
    for c in clients:
        o = get(f"{B}/{c['id']}")
        mine = [r for r in matrix if r['client_id'] == c['id']]
        if {r['folio'] for r in o['requisitions']} != {r['folio'] for r in mine} or o['metrics']['total'] != len(mine):
            stage_ok = False; detail = f"{c['code']}: requisiciones {len(o['requisitions'])} vs {len(mine)}"; continue
        by = {r['folio']: r for r in mine}
        for r in o['requisitions']:
            m = by[r['folio']]
            if (r['stage'] is None) != (m['stage_index'] is None) or (r['stage'] is not None and (r['stage'] != m['stage_index'] + 1 or r['progress'] != m['progress'])):
                stage_ok = False; detail = f"{r['folio']}: etapa {r['stage']} vs {m['stage_index']}"
            # Cotizaciones: solo versiones enviadas al cliente, de esta requisición.
            for q in r['quotes']:
                src = next((x for x in cq if x['id'] == q['id']), None)
                if not src or src['requisition'] != r['folio'] or src['status_key'] not in VISIBLE or q['status'] != src['status_key']:
                    quote_ok = False; detail = f"cotización {q['folio']}"
                shown.append((c['id'], q['id']))
            for x in cq:
                if x['requisition'] == r['folio'] and x['status_key'] not in VISIBLE:
                    hidden.append((c['id'], x['id']))
            # OC: folios de las OC vigentes no canceladas ligadas a la requisición; sin proveedor ni montos.
            exp = sorted(x['folio'] for x in pos if r['folio'] in [s.strip() for s in (x.get('requisitions') or '').split(',')] and fold(x.get('legacy_status') or x.get('operational_status')) not in ('cancelada', 'sustituida', 'cancelled', 'superseded'))
            if sorted(p['folio'] for p in r['purchase_orders']) != exp or any(set(p) != {'folio', 'order_date', 'commitment_date', 'status'} for p in r['purchase_orders']):
                po_ok = False; detail = f"OC de {r['folio']}: {[p['folio'] for p in r['purchase_orders']]} vs {exp}"
            ei = sorted(x['folio'] for x in invs if x.get('requisition') == r['folio'] and fold(x.get('legacy_status') or x.get('status_code')) not in ('cancelada', 'cancelled', 'cancelado'))
            if sorted(i['folio'] for i in r['invoices']) != ei:
                inv_ok = False; detail = f"facturas de {r['folio']}"
        mt = o['metrics']
        st = [r['stage'] for r in o['requisitions']]
        if [mt['closed'], mt['in_progress'], mt['without_stage'], mt['pending_delivery'], mt['pending_invoice']] != [st.count(8), sum(1 for s in st if s and s < 8), st.count(None), st.count(6), st.count(7)]:
            docs_ok = False; detail = f"métricas {c['code']}"
    check('requisiciones del cliente = Matriz de requisiciones; etapa y avance = política de 8 etapas', stage_ok, detail)
    check('métricas del cliente coherentes con sus etapas', docs_ok, detail)
    check('cotizaciones: solo versiones enviadas al cliente y de su requisición', quote_ok, detail)
    check('OC: folios vigentes no cancelados, solo folio/fechas/estatus', po_ok, detail)
    check('facturas no canceladas = Factura (/invoices)', inv_ok, detail)

    if shown:
        cid, qid = shown[0]
        doc = get(f'{B}/{cid}/quotes/{qid}')
        src = get(f'/api/v1/quotes/customer-quotes/{qid}')
        blob = json.dumps(doc)
        check('formato de cotización: precios de venta = Cotizaciones, sin costos ni márgenes', [i['unit_price'] for i in doc['items']] == [float(i['unit_price']) if i['unit_price'] is not None else None for i in src['items']]
              and not re.search(r'"(cost_amount|extra_amount|charge_pct|legacy_margin_value|pricing_formula_code|original_cost_amount|internal_reference|document_status|internal_approval_status)"', blob))
        other = next((c['id'] for c in lst['items'] if c['id'] != cid), None)
        if other:
            check('aislamiento: la cotización de un cliente no se ve desde otro (404)', status(adm, f'{B}/{other}/quotes/{qid}') == 404)
    if hidden:
        check('borradores y revisiones internas no visibles para el cliente (404)', all(status(adm, f'{B}/{c}/quotes/{q}') == 404 for c, q in hidden[:10]), str(hidden[:3]))
    if clients:
        c0 = clients[0]; o0 = get(f"{B}/{c0['id']}")
        if o0['requisitions']:
            rq = o0['requisitions'][0]
            rd = get(f"{B}/{c0['id']}/requisitions/{rq['id']}")
            check('solicitud: partidas = número de partidas del expediente', len(rd['items']) == rq['line_count'] and rd['requisition']['folio'] == rq['folio'])
            other = next((c['id'] for c in lst['items'] if c['id'] != c0['id']), None)
            if other:
                check('aislamiento: la solicitud de un cliente no se ve desde otro (404)', status(adm, f"{B}/{other}/requisitions/{rq['id']}") == 404)
        check('sin ids internos', not re.search(r'"(db_id|organization_id|requisition_id|customer_quote_id|supplier_id|supplier_name|total_amount)"\s*:', json.dumps(o0)))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nPortal del Cliente · vista previa (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
