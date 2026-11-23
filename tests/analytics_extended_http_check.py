#!/usr/bin/env python3
"""Inicio y Dashboard · indicadores ampliados de GET /api/v1/analytics/overview (SOLO LECTURA; apto para la base real).
Cruza cada bloque nuevo con OTROS endpoints de lectura ya existentes (no con el mismo código):
servicios ↔ /services/matrix · Service Fee ↔ financial.customer_quotes · facturación ↔ /invoices · proveedores y RFQ
pendientes ↔ /quotes/rfqs · enmiendas y funciones de OC ↔ /purchase-orders · filtros de cliente y periodo, 401/422 y sin ids internos.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> python3 tests/analytics_extended_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.parse, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']; op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass
fold = lambda s: (s or '').strip().lower().translate(str.maketrans('áéíóúü', 'aeiouu'))

check('sin sesión: 401', status(session(), '/api/v1/analytics/overview') == 401)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    def pages(path):
        out, p = [], 1
        while True:
            d = get(f"{path}{'&' if '?' in path else '?'}page={p}&page_size=50"); out += d['items']
            if len(out) >= d['total'] or p >= 40: return out
            p += 1
    check('422 con filtros inválidos (sin cambios en el contrato)', all(status(adm, '/api/v1/analytics/overview' + q) == 422 for q in ['?x=1', '?from=2026-13-01', '?client=zzz', '?from=2026-02-01&to=2026-01-01']))
    o = get('/api/v1/analytics/overview')
    keys = ['services', 'service_fee', 'supplier_activity', 'repeat', 'po_amendments', 'sourcing', 'invoices', 'buyers', 'po_roles']
    check('bloques ampliados presentes y documentados en definitions', all(k in o for k in keys) and all(k in o['definitions'] for k in ['services', 'service_fee', 'supplier_activity', 'repeat', 'po_amendments', 'sourcing', 'buyers', 'po_roles']))
    check('bloques existentes intactos', all(k in o for k in ['summary', 'monthly', 'top_clients', 'financial', 'catalogs']))

    # ---- Servicios ↔ /services/matrix ----
    sv = o['services']; srows = pages('/api/v1/services/matrix?client=all&buyer=all')
    check('servicios: total = Matriz de servicios', sv['total'] == len(srows), f"{sv['total']} vs {len(srows)}")
    done = lambda x: fold(x['status']) in ('completado', 'listo para facturar', 'facturado') or x['is_done']
    check('servicios: abiertos, ejecutados y facturados = Matriz', sv['open'] == sum(1 for x in srows if x['is_open']) and sv['executed'] == sum(1 for x in srows if done(x))
          and sv['invoiced'] == sum(1 for x in srows if (x['invoices'] or '').strip() or fold(x['status']) == 'facturado'))
    by = {}
    for x in srows:
        b = by.setdefault(x['currency'] or '', [0, 0.0, 0.0]); b[0] += 1; b[1] += float(x['price'] or 0); b[2] += float(x['cost'] or 0)
    check('servicios: venta y costo por moneda = Matriz', {m['currency_code']: [m['services'], round(m['price'], 2), round(m['cost'], 2)] for m in sv['money']} == {k: [v[0], round(v[1], 2), round(v[2], 2)] for k, v in by.items()})
    check('Service-to-Cash: 8 etapas y suma = total − cancelados', len(sv['stages']) == 8 and len(sv['stage_names']) == 8 and sum(sv['stages']) == sv['total'] - sv['cancelled'])
    check('servicios con evidencia = Matriz', sv['with_evidence'] == sum(1 for x in srows if x['evidence_count'] > 0))

    # ---- Service Fee ↔ financial.customer_quotes (misma regla de última versión) ----
    fee = o['service_fee']
    check('Service Fee: versiones = cotizaciones al cliente del bloque financiero', fee['versions'] == sum(int(x['documents']) for x in o['financial']['customer_quotes']))
    check('Service Fee: con fee ≤ versiones; aprobadas ≤ versiones; importes ≥ 0', fee['with_fee'] <= fee['versions'] and fee['approved'] <= fee['versions'] and all(x['fee_amount'] >= 0 for x in fee['by_currency']))

    # ---- Facturación ↔ /invoices ----
    inv = [x for x in pages('/api/v1/invoices?') if x.get('requisition_id') and fold(x.get('legacy_status') or x.get('status_code')) not in ('cancelada', 'cancelled', 'cancelado')]
    ib = {}
    for x in inv:
        b = ib.setdefault(x['currency'], [0, 0.0]); b[0] += 1; b[1] += float(x['total_amount'] or 0)
    check('facturación por moneda = Factura (/invoices, no canceladas con requisición)', {x['currency_code']: [int(x['documents']), round(float(x['amount']), 2)] for x in o['invoices']} == {k: [v[0], round(v[1], 2)] for k, v in ib.items()})

    # ---- Proveedores y RFQ ↔ /quotes/rfqs ----
    rfqs = pages('/api/v1/quotes/rfqs?')
    per = {}
    for x in rfqs: per[x['supplier_id']] = per.get(x['supplier_id'], 0) + 1
    top = o['supplier_activity']['suppliers']
    check('proveedores: RFQ por proveedor = RFQ registradas (/quotes/rfqs)', all(s['rfqs'] == per.get(s['id'], 0) for s in top), json.dumps(top)[:300])
    check('proveedores: orden por adjudicadas, ofertas y RFQ; máximo 8', len(top) <= 8 and all((a['awards'], a['quotes'], a['rfqs']) >= (b['awards'], b['quotes'], b['rfqs']) for a, b in zip(top, top[1:])))
    sups = pages('/api/v1/catalogs/suppliers?')
    check('proveedores evaluados = proveedores del catálogo con calificación', o['supplier_activity']['evaluated'] == sum(1 for x in sups if x.get('rating') not in (None, '') and float(x['rating']) > 0), str(o['supplier_activity']['evaluated']))
    canc = lambda x: fold(x.get('legacy_status') or x.get('status')).startswith('cancel')
    check('RFQ pendientes = RFQ sin respuesta ni cancelación', o['sourcing']['pending_rfqs'] == sum(1 for x in rfqs if not x['responded'] and not canc(x)), f"{o['sourcing']['pending_rfqs']}")
    src = o['sourcing']
    check('abastecimiento: rutas paralelas ≤ lotificadas ≤ total; valores enteros', src['parallel'] <= src['batched'] <= o['summary']['total'] and all(isinstance(v, int) and v >= 0 for v in src.values()))

    # ---- OC ↔ /purchase-orders ----
    allpo = pages('/api/v1/purchase-orders?scope=all')
    linked = [x for x in allpo if x.get('requisitions')]
    check('enmiendas: versiones posteriores = OC con versión > 1 (/purchase-orders)', o['po_amendments']['amended_versions'] == sum(1 for x in linked if int(x['version_number']) > 1))
    nlatest = sum(int(x['documents']) for x in o['financial']['purchase_orders'])
    check('funciones de OC: cada lista suma las OC vigentes del bloque financiero (top 6)', all(sum(r['orders'] for r in o['po_roles'][k]) <= nlatest for k in ('buyer', 'preparer', 'authorizer'))
          and (nlatest == 0 or len(o['po_roles']['buyer']) >= 1))
    cur = pages('/api/v1/purchase-orders?scope=current')
    names = {}
    for x in cur:
        if x.get('requisitions'): names[x.get('buyer_name') or ''] = names.get(x.get('buyer_name') or '', 0) + 1
    check('comprador de la OC = Órdenes de Compra (/purchase-orders)', all(names.get(r['name'], 0) == r['orders'] for r in o['po_roles']['buyer']), f"{o['po_roles']['buyer']} vs {names}")

    # ---- Compradores, recompra y políticas ----
    b = o['buyers']
    check('compradores: requisiciones por comprador ≤ validadas; con OC ≤ requisiciones', sum(x['requisitions'] for x in b['items']) <= b['validated'] and all(x['with_po'] <= x['requisitions'] for x in b['items']))
    rp = o['repeat']
    check('recompra: contadores ≤ partidas desde historial y distribuciones suman el total', all(rp[k] <= rp['items'] for k in ('honored', 'requote', 'price_pending'))
          and sum(x['n'] for x in rp['price_modes']) == rp['items'] and sum(x['n'] for x in rp['sourcing_modes']) == rp['items'])
    cp = rp['client_policies']
    check('políticas de clientes: venta y abasto suman los clientes', sum(x['n'] for x in cp['sales']) == cp['clients'] == sum(x['n'] for x in cp['sourcing']))

    # ---- Filtros ----
    cl = get('/api/v1/services/matrix?page=1&page_size=1&client=all&buyer=all')['summary']['clients']
    if cl:
        c0 = cl[0]; oc = get('/api/v1/analytics/overview?client=' + c0['id'])
        check('filtro de cliente: servicios = servicios del cliente', oc['services']['total'] == c0['services'])
        check('filtro de cliente: políticas de un solo cliente', oc['repeat']['client_policies']['clients'] == 1)
    dated = [x for x in srows if x.get('date')]
    if dated:
        d0 = sorted(x['date'][:10] for x in dated)[0]
        of = get(f'/api/v1/analytics/overview?from={d0}&to={d0}')
        check('filtro de periodo: servicios de esa fecha de solicitud', of['services']['total'] == sum(1 for x in srows if (x.get('date') or '')[:10] == d0))
    check('sin ids internos', not re.search(r'"(db_id|organization_id|supplier_db_id|so_id|requisition_db_id)"\s*:', json.dumps(o)))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nIndicadores ampliados del Dashboard (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
