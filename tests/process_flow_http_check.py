#!/usr/bin/env python3
"""Flujo del Proceso · GET /api/v1/analytics/process-flow (SOLO LECTURA; apto para la base real).
Cruza cada cifra con OTROS endpoints de lectura ya existentes (no con el mismo código): etapas ↔ política de 8 etapas de
/recovery/matrix · servicios ↔ /analytics/overview · cotizaciones ↔ /quotes/* · OC ↔ /purchase-orders · recepción ↔ /reception/* ·
facturación ↔ /invoices/requisitions · cambios ↔ /requisition-changes. Además 401/403/422, sin rutas de escritura y sin ids internos.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/process_flow_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
P = '/api/v1/analytics/process-flow'

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
fold = lambda s: (s or '').strip().lower().translate(str.maketrans('áéíóúü', 'aeiouu'))

check('sin sesión: 401', status(session(), P) == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, P) == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    def pages(path):
        out, p = [], 1
        while True:
            d = get(f"{path}{'&' if '?' in path else '?'}page={p}&page_size=50"); out += d['items']
            if len(out) >= d['total'] or p >= 60: return out
            p += 1
    check('422 con cualquier parámetro', all(status(adm, P + q) == 422 for q in ['?x=1', '?page=1', '?client=all']))
    tok = json.loads(adm.open(API + '/api/v1/auth/csrf').read())['csrf_token']
    w = [status(adm, P, m, b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}) for m in ('POST', 'PUT', 'PATCH', 'DELETE')]
    check('sin rutas de escritura (≠ 2xx)', all(not 200 <= x < 300 for x in w), str(w))
    d = get(P); p2p = d['p2p']
    check('contrato: 15 etapas P2P, 8 S2C, solo lectura', len(p2p['stage_names']) == 15 == len(p2p['stages']) == len(d['related']) and len(d['services']['stages']) == 8 and d['read_only'] is True)

    # ---- Coherencia interna ----
    g = [0] * 8
    for i, n in enumerate(p2p['stages']): g[p2p['group_of'][i]] += n
    check('cada grupo de 8 = suma de sus etapas de 15', g == p2p['groups'], f"{g} vs {p2p['groups']}")
    check('total = etapas + sin etapa inferida; abiertos = total − cerrados', p2p['total'] == sum(p2p['stages']) + p2p['unmapped'] and p2p['open'] == p2p['total'] - p2p['closed']
          and p2p['closed'] == p2p['stages'][14] and p2p['pending_client'] == p2p['stages'][9])

    # ---- Política de 8 etapas ↔ /recovery/matrix (todas las requisiciones no archivadas) ----
    m = get('/api/v1/recovery/matrix')
    dist = [sum(1 for x in m['items'] if x['stage_index'] == i) for i in range(8)]
    sr = p2p['service_route']
    check('etapas = política de 8 etapas de la Matriz de requisiciones (P2P + ruta de servicios)', [a + b for a, b in zip(p2p['groups'], sr['groups'])] == dist, f"{p2p['groups']} + {sr['groups']} vs {dist}")
    check('sin etapa inferida = "Pendiente de equivalencia" de la Matriz', p2p['unmapped'] + sr['unmapped'] == sum(1 for x in m['items'] if x['stage_index'] is None))
    check('requisiciones P2P + ruta de servicios = Matriz de requisiciones', p2p['total'] + sr['total'] == m['total'])
    check('nombres de grupo = etapas de la Matriz', p2p['group_names'] == ['Requisición recibida', 'Validación interna', 'Solicitud de cotización', 'Comparativo y autorización', 'Orden de compra', 'Recepción', 'Entrega y aceptación', 'Factura'])

    # ---- Servicios ↔ Dashboard (/analytics/overview) ----
    ov = get('/api/v1/analytics/overview'); sv = d['services']
    check('servicios: 8 etapas = Dashboard', sv['stages'] == ov['services']['stages'] and sv['stage_names'] == ov['services']['stage_names'])
    check('servicios: total, ejecutados, facturados y cancelados = Dashboard', [sv['total'], sv['executed'], sv['invoiced'], sv['cancelled']] == [ov['services'][k] for k in ('total', 'executed', 'invoiced', 'cancelled')])
    check('servicios: autorización pendiente = activos − autorizados del Dashboard', sv['pending_auth'] == ov['services']['total'] - ov['services']['cancelled'] - ov['services']['authorized'])
    srows = pages('/api/v1/services/matrix?client=all&buyer=all')
    check('servicios: listos para facturar = Matriz de servicios (estatus "Listo para facturar" sin factura)', sv['ready'] == sum(1 for x in srows if fold(x['status']) == 'listo para facturar' and not (x['invoices'] or '').strip()))

    # ---- Flujo comercial ----
    c = d['commercial']
    check('RFQ pendientes = Dashboard (sin oferta ni cancelación)', c['pending_rfqs'] == ov['sourcing']['pending_rfqs'])
    check('cotizaciones al cliente (todas las revisiones) = /quotes/customer-quotes', c['customer_quotes'] == get('/api/v1/quotes/customer-quotes?scope=all&page_size=1')['total'])
    check('pendientes del cliente = cotizaciones vigentes enviadas/vencidas (grupo client)', c['awaiting_client'] == get('/api/v1/quotes/customer-quotes?scope=current&group=client&page_size=1')['total'] == d['indicators']['awaiting_client'])
    cur = pages('/api/v1/purchase-orders?scope=current')
    issued = sum(1 for x in cur if fold(x.get('legacy_status') or x.get('operational_status')) not in ('cancelada', 'sustituida', 'cancelled', 'superseded'))
    check('OC emitidas = OC vigentes no canceladas (/purchase-orders)', c['issued_pos'] == issued == d['related'][11], f"{c['issued_pos']} vs {issued}")
    ready = get('/api/v1/invoices/requisitions')['items']
    check('entregas sin factura = requisiciones listas sin factura (/invoices/requisitions)', c['deliveries_without_invoice'] == sum(1 for x in ready if x['ready'] and not x['invoiced']))
    check('aprobadas sin OC ≤ decisión del cliente (etapa 11)', c['approved_without_po'] == d['indicators']['approved_without_po'] <= p2p['stages'][10])

    # ---- Registros relacionados por etapa ----
    rel = d['related']
    check('registros: requisiciones P2P, RFQ y ofertas = Cotizaciones', rel[0] == p2p['total'] and rel[3] == get('/api/v1/quotes/rfqs?page_size=1')['total'] and rel[4] == get('/api/v1/quotes/supplier-quotes?page_size=1')['total'])
    check('registros: cotizaciones vigentes en revisión, autorizadas, enviadas y con decisión = /quotes/customer-quotes',
          [rel[7], rel[8], rel[9]] == [get(f'/api/v1/quotes/customer-quotes?scope=current&status={k}&page_size=1')['total'] for k in ('review', 'authorized', 'sent')][:2] + [c['awaiting_client']]
          and rel[10] == sum(get(f'/api/v1/quotes/customer-quotes?scope=current&status={k}&page_size=1')['total'] for k in ('approved', 'rejected', 'change_requested')))
    rec = pages('/api/v1/reception/matrix?client=all&kind=all')
    check('registros: recepciones y entregas = Recepción y Entrega', rel[12] >= sum(1 for x in rec if x['kind'] == 'receipt') and rel[13] >= sum(1 for x in rec if x['kind'] == 'delivery'))

    # ---- Rutas especiales ----
    s = d['special']
    check('recompra y enmiendas = Dashboard', [s['history_items'], s['pending_supplier'], s['pending_client_price'], s['po_amendments']]
          == [ov['repeat']['items'], ov['repeat']['requote'], ov['repeat']['price_pending'], ov['po_amendments']['amended_versions']])
    check('Change Requests = Control de cambios (/requisition-changes)', s['change_requests'] == get('/api/v1/requisition-changes')['total'])

    # ---- Indicadores ↔ Recepción ----
    i = d['indicators']; receipts = [x for x in rec if x['kind'] == 'receipt']
    acc = lambda v: bool(re.match(r'^(accepted|aceptad)', (v or '').strip(), re.I))
    check('OC sin recepción = Recepción y Entrega (pendientes)', i['po_without_receipt'] == get('/api/v1/reception/orders?page_size=1')['summary']['pending'])
    check('recepciones sin entrega = recepciones sin entrega ni aceptación', i['receipts_without_delivery'] == sum(1 for x in receipts if x['delivery_count'] == 0 and not acc(x['acceptance'])))
    check('desviaciones = recepciones parciales, rechazadas, de calidad o documentación', p2p['deviations'] == sum(1 for x in receipts if set(x['pending_reasons']) & {'partial', 'rejected', 'quality', 'documentation'}))
    check('RFQ por emitir ≤ etapas 2–3; ofertas insuficientes ≤ etapas 4–5', i['rfq_to_issue'] <= p2p['stages'][1] + p2p['stages'][2] and i['insufficient_bids'] <= p2p['stages'][3] + p2p['stages'][4])

    # ---- Cuellos de botella ----
    b = d['bottlenecks']
    codes = {'request', 'validation_blocked', 'lots', 'rfq', 'offers', 'compare', 'quote', 'review', 'authorize', 'send', 'decision', 'po', 'rejected', 'change_requested', 'receipt', 'delivery', 'invoice', 'history', 'change'}
    check('cuellos P2P: abiertos = total − cerrados; máximo 12; motivos conocidos', b['p2p_total'] == p2p['open'] and len(b['p2p']) == min(12, b['p2p_total']) and all(x['reason'] in codes for x in b['p2p']))
    check('cuellos P2P: más antiguos primero y etapa 1–14 o sin etapa', all((x['request_date'] or '9999') <= (y['request_date'] or '9999') for x, y in zip(b['p2p'], b['p2p'][1:])) and all(x['stage'] is None or 1 <= x['stage'] <= 14 for x in b['p2p']))
    check('cuellos S2C: servicios abiertos = etapas 1 a 7', b['services_total'] == sum(sv['stages'][:7]) and all(1 <= x['stage'] <= 7 for x in b['services']))
    check('sin ids internos', not re.search(r'"(id|db_id|organization_id|requisition_id|client_id)"\s*:', json.dumps(d)))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nFlujo del Proceso (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
