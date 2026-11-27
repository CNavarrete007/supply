#!/usr/bin/env python3
"""Cotizaciones y Comparativo · TRAZADO DE PUNTA A PUNTA de una requisición sintética por las 11 tarjetas (HTTP).
Comprueba que lo que guarda una tarjeta aparece, con los mismos datos, en las tarjetas que lo leen, y que las que siguen
bloqueadas no escriben. ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (SF_SYNTHETIC_WRITES=1).

Flujo: requisición RF1 (3 partidas) → validación del contratista → RFQ A (Borrador, 3 partidas, MXN) → Marcar enviada →
RFQ B (Enviada, 2 partidas, USD) → cotización A (3 partidas) y B (1 ofertada, 1 no ofertada) → borrador de cotización al
cliente → lecturas de las tarjetas 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 y 11 → bitácora → rutas de escritura que no deben existir.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 python3 tests/quotes_flow_trace_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
from datetime import date, timedelta
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
B = '/api/v1/quotes'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper(); TODAY = date.today(); T = TODAY.isoformat()
PRICEY = re.compile(r'price|amount|cost|subtotal|margin', re.I)
import math
r2 = lambda x: math.floor((x + 2.220446049250313e-16) * 100 + 0.5) / 100  # redondeo de la app (medio hacia arriba), igual que la tarjeta

class S:
    def __init__(self, email):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
        self.call('POST', '/api/v1/auth/login', {'email': email, 'password': PASSWORD}, key=None)
        self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
    def get(self, p): return json.loads(self.op.open(API + p).read())
    def call(self, method, path, body=None, key='new', ifm=None):
        h = {'Content-Type': 'application/json', 'X-SF-CSRF': self.csrf}
        if key: h['Idempotency-Key'] = str(uuid.uuid4()) if key == 'new' else key
        if ifm is not None: h['If-Match'] = f'"{ifm}"'
        try:
            r = self.op.open(urllib.request.Request(API + path, None if body is None else json.dumps(body).encode(), h, method=method))
            return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try: return e.code, json.loads(e.read() or b'{}')
            except ValueError: return e.code, {}

def must(res, what):
    st, out = res
    if st not in (200, 201): raise SystemExit(f'BLOCKED: {what} ({st} {json.dumps(out)[:300]})')
    return out

def find(items, key, value):
    return next((x for x in items if x.get(key) == value), None)

adm = S(USER)
try:
    # ---------- Antes del módulo: requisición RF1 y validación del contratista ----------
    cat = adm.get('/api/v1/recovery/catalogs'); client = next(c for c in cat['clients'] if c['status'] == 'active' and c.get('code'))
    cats = [c['name'] for c in cat['categories'] if c['active']]
    folio = adm.get(f"/api/v1/recovery/folio?client_id={client['id']}&date={T}&mode=formal")['folio']
    req = must(adm.call('POST', '/api/v1/recovery/requisitions', {'folio': folio, 'client_id': client['id'], 'request_date': T, 'need_date': f'{TODAY.year + 1}-05-01',
        'project': f'PRY-TRZ-{RUN}', 'contract': 'CTO-TRZ', 'client_reference': f'TRZ-{RUN}', 'priority': 'normal', 'delivery_place': 'Almacén de trazado', 'requester_name': 'Solicitante QA',
        'requester_email': 'qa@cliente.invalid', 'budget': '', 'currency': 'MXN', 'description': f'Requisición sintética de trazado {RUN}', 'notes': None,
        'source': {'type': 'Requisición formal del cliente', 'date': T, 'reference': None, 'notes': None, 'requirement': 'formal', 'due_date': None, 'owner': None},
        'items': [{'id': None, 'description': f'Válvula TRZ {RUN}', 'quantity': '4', 'unit': 'pza', 'category': cats[0]},
                  {'id': None, 'description': f'Sensor TRZ {RUN}', 'quantity': '2', 'unit': 'pza', 'category': cats[0]},
                  {'id': None, 'description': f'Cable TRZ {RUN}', 'quantity': '10', 'unit': 'm', 'category': cats[-1]}], 'document': None}), 'requisición')
    vs = adm.get('/api/v1/contractor-management/validation-setup'); buyer = next(b for b in vs['buyers'] if b['has_user'] and b['with_access'])
    must(adm.call('POST', '/api/v1/contractor-management/validations', {'requisition_id': req['id'], 'buyer_id': buyer['id'], 'technical': 'Conforme', 'contract': 'Conforme',
        'budget': 'Disponible', 'strategy': 'Competencia abierta', 'min_quotes': '2', 'deadline': f'{TODAY.year + 1}-01-20', 'criteria': 'Precio y plazo', 'notes': f'Trazado {RUN}'}), 'validación')

    # ---------- Tarjeta 2 · Solicitud a proveedores (RFQ) ----------
    setup = adm.get(f'{B}/rfq-setup'); sups = [x for x in setup['suppliers'] if x['status'] in ('authorized', 'active')]; contact = setup['contacts'][0]
    det = adm.get(f"{B}/rfq-requisitions/{req['id']}"); L = det['items']; key = det['item']['buyer_key']
    check('T2 · la requisición validada aparece para su comprador (3 partidas, sin RFQ)', find(adm.get(f"{B}/rfq-requisitions?page=1&page_size=50&buyer={key}&q={req['folio']}")['items'], 'id', req['id'])
          and len(L) == 3 and det['item']['rfq_count'] == 0)
    ra = must(adm.call('POST', f'{B}/rfqs', {'requisition_id': req['id'], 'supplier_id': sups[0]['id'], 'contact_id': contact['id'], 'issue_date': T, 'deadline': T, 'required_date': None,
        'currency': 'MXN', 'delivery_place': '', 'docs': '', 'conditions': '', 'status': 'draft', 'items': [x['id'] for x in L]}), 'RFQ A')
    rb = must(adm.call('POST', f'{B}/rfqs', {'requisition_id': req['id'], 'supplier_id': sups[1]['id'], 'contact_id': contact['id'], 'issue_date': T, 'deadline': T, 'required_date': None,
        'currency': 'USD', 'delivery_place': '', 'docs': '', 'conditions': '', 'status': 'sent', 'items': [L[0]['id'], L[1]['id']]}), 'RFQ B')
    det2 = adm.get(f"{B}/rfq-requisitions/{req['id']}")
    sent_to = {x['id']: sorted(s['rfq'] for s in x['sent_to']) for x in det2['items']}
    check('T2 · folios RFQ-AAAA-NNNN consecutivos y distintos', all(re.fullmatch(rf'RFQ-{TODAY.year}-\d{{4,}}', f) for f in (ra['folio'], rb['folio'])) and ra['folio'] != rb['folio'])
    check('T2 · cada partida registra a qué RFQ se envió (A: 3 partidas, B: 2)', sent_to[L[0]['id']] == sorted([ra['folio'], rb['folio']]) and sent_to[L[2]['id']] == [ra['folio']] and det2['item']['rfq_count'] == 2, json.dumps(sent_to))
    rfqA = adm.get(f"{B}/rfqs/{ra['id']}")
    check('T2 · la RFQ no lleva precios ni importes (documento al proveedor)', not PRICEY.search(json.dumps(rfqA)) and len(rfqA['items']) == 3)

    # ---------- Tarjeta 3 · Matriz de RFQ (Borrador → Enviada) ----------
    rowA = find(adm.get(f"{B}/rfqs?q={ra['folio']}&page=1&page_size=10")['items'], 'folio', ra['folio']) or {}
    check('T3 · la RFQ A aparece en Borrador, versión 1, sin respuesta', rowA.get('status') == 'borrador' and rowA.get('version') == 1 and rowA.get('responded') is False, json.dumps(rowA)[:200])
    st, qa_early = adm.call('POST', f'{B}/supplier-quotes', {'rfq_id': ra['id'], 'supplier_reference': 'X', 'quote_date': T, 'valid_until': None, 'vat': '16', 'currency': 'MXN', 'lead_days': '5',
        'payment': 'PPD', 'technical': '100', 'documentation': '100', 'notes': '', 'document': None, 'lines': [{'line_number': 1, 'offered': True, 'qty': '4', 'price': '1'}]})
    check('T3→T4 · una RFQ en Borrador no recibe cotización (409 RFQ_NOT_SENT)', st == 409 and qa_early.get('error', {}).get('code') == 'RFQ_NOT_SENT', f'{st} {qa_early}')
    st, ms = adm.call('POST', f"{B}/rfqs/{ra['id']}/mark-sent", {}, ifm=1)
    check('T3 · Marcar enviada: Borrador → Enviada (versión 2)', st == 200 and ms.get('status') == 'enviada' and ms.get('version') == 2, f'{st} {ms}')
    check('T2 · la requisición queda disponible para registrar cotizaciones (tarjeta 4: «por cotizar»)',
          find(adm.get(f"{B}/rfq-requisitions?page=1&page_size=50&rfq=quotable&q={req['folio']}")['items'], 'id', req['id']) is not None)

    # ---------- Tarjeta 4 · Cotizaciones recibidas ----------
    itA = adm.get(f"{B}/rfqs/{ra['id']}")['items']; itB = adm.get(f"{B}/rfqs/{rb['id']}")['items']
    num = {x['id']: int(x['line_number']) for x in L}
    qa = must(adm.call('POST', f'{B}/supplier-quotes', {'rfq_id': ra['id'], 'supplier_reference': f'PA-{RUN}', 'quote_date': T, 'valid_until': None, 'vat': '16', 'currency': 'MXN',
        'lead_days': '7', 'payment': 'PPD', 'technical': '90', 'documentation': '100', 'notes': '', 'document': None,
        'lines': [{'line_number': int(i['line_number']), 'offered': True, 'qty': str(int(float(i['quantity']))), 'price': p} for i, p in zip(itA, ['1200', '850.50', '35'])]}), 'cotización A')
    qb = must(adm.call('POST', f'{B}/supplier-quotes', {'rfq_id': rb['id'], 'supplier_reference': f'PB-{RUN}', 'quote_date': T, 'valid_until': None, 'vat': '16', 'currency': 'USD',
        'lead_days': '3', 'payment': 'PUE', 'technical': '100', 'documentation': '80', 'notes': '', 'document': None,
        'lines': [{'line_number': int(itB[0]['line_number']), 'offered': True, 'qty': '4', 'price': '60'}, {'line_number': int(itB[1]['line_number']), 'offered': False, 'qty': '2', 'price': ''}]}), 'cotización B')
    dA = adm.get(f"{B}/supplier-quotes/{qa['id']}"); dB = adm.get(f"{B}/supplier-quotes/{qb['id']}")
    subA = round(4 * 1200 + 2 * 850.50 + 10 * 35, 2)
    check('T4 · cotización A: folio COT, Recibida, versión 1, editable; subtotal y total calculados en el servidor',
          re.fullmatch(rf'COT-{TODAY.year}-\d{{4,}}', qa['folio']) and dA['item']['legacy_status'] == 'Recibida' and dA['item']['version'] == 1 and dA['item']['editable'] is True
          and abs(float(dA['item']['subtotal_amount']) - subA) < 0.005 and abs(float(dA['item']['total_amount']) - round(subA * 1.16, 2)) < 0.011, json.dumps(dA['item'])[:300])
    check('T4 · cotización B: solo la partida ofertada suma (60 × 4 USD)', abs(float(dB['item']['subtotal_amount']) - 240) < 0.005 and sum(1 for x in dB['items'] if x.get('offered')) == 1)
    st, dup = adm.call('POST', f'{B}/supplier-quotes', {'rfq_id': ra['id'], 'supplier_reference': 'Y', 'quote_date': T, 'valid_until': None, 'vat': '16', 'currency': 'MXN', 'lead_days': '5',
        'payment': 'PPD', 'technical': '100', 'documentation': '100', 'notes': '', 'document': None, 'lines': [{'line_number': 1, 'offered': True, 'qty': '4', 'price': '1'}]})
    check('T4 · una cotización por RFQ (409 RFQ_ALREADY_QUOTED)', st == 409 and dup.get('error', {}).get('code') == 'RFQ_ALREADY_QUOTED', f'{st} {dup}')
    check('T4 · ya no queda RFQ por cotizar en la requisición', find(adm.get(f"{B}/rfq-requisitions?page=1&page_size=50&rfq=quotable&q={req['folio']}")['items'], 'id', req['id']) is None)
    rowA2 = find(adm.get(f"{B}/rfqs?q={ra['folio']}&page=1&page_size=10")['items'], 'folio', ra['folio']) or {}
    check('T3 · la Matriz de RFQ muestra la RFQ A respondida con su cotización', rowA2.get('responded') is True and qa['folio'] in json.dumps(rowA2), json.dumps(rowA2)[:250])

    # ---------- Tarjeta 11 · Matriz interna de proveedores ----------
    m11 = adm.get(f"{B}/supplier-quotes?page=1&page_size=10&q={req['folio']}")['items']
    xa = find(m11, 'id', qa['id']) or {}; xb = find(m11, 'id', qb['id']) or {}
    check('T11 · ambas cotizaciones en la matriz interna (partidas ofertadas, total, sin adjudicar)', xa.get('offered_count') == 3 and xb.get('offered_count') == 1 and not xa.get('awarded') and not xb.get('awarded')
          and abs(float(xa.get('total_amount') or 0) - float(dA['item']['total_amount'])) < 0.005, f'{xa} {xb}')

    # ---------- Tarjeta 5 · Comparativo (solo cálculo) ----------
    cmp = adm.get(f"{B}/comparison?requisition={req['id']}")
    lines5 = {x['id']: x for x in cmp['lines']}
    offers = {k: sorted((o['quote_id'], bool(o['offered'])) for o in v['offers']) for k, v in lines5.items()}
    check('T5 · comparativo: 3 partidas; ofertas por partida coherentes con las cotizaciones registradas', len(cmp['lines']) == 3
          and offers[L[0]['id']] == sorted([(qa['id'], True), (qb['id'], True)]) and offers[L[1]['id']] == sorted([(qa['id'], True), (qb['id'], False)]) and offers[L[2]['id']] == [(qa['id'], True)], json.dumps(offers))
    check('T5 · sin adjudicación (la selección = adjudicación sigue bloqueada) y sin cotización al cliente', all(x['award'] is None for x in cmp['lines']) and cmp['customer_quote'] is None and len(cmp['quotes']) == 2)

    # ---------- Tarjeta 6 · Cotización al cliente (borrador interno) ----------
    row6 = find(adm.get(f"{B}/rfq-requisitions?page=1&page_size=50&rfq=quoted&q={req['folio']}")['items'], 'id', req['id']) or {}
    check('T6 · el selector la ofrece para guardar (sin cotización al cliente, todas las partidas con costo)', row6.get('customer_quote', 'x') is None and row6.get('unquoted_items') == 0, json.dumps(row6)[:200])
    best = lambda lid: min((o for o in lines5[lid]['offers'] if o['offered'] and o['unit_price'] is not None), key=lambda o: float(o['unit_price']))  # misma regla de la tarjeta
    ppl = [x for x in adm.get(f'{B}/customer-quote-setup')['people'] if x['id'] != contact['id']]
    CQ = {'requisition_id': req['id'], 'issue_date': T, 'valid_until': (TODAY + timedelta(days=30)).isoformat(), 'currency': 'MXN', 'preparer_id': contact['id'], 'reviewer_id': ppl[0]['id'], 'approver_id': ppl[1]['id'], 'lead_time': '8 días',
          'delivery_place': 'Almacén de trazado', 'payment_terms': 'Crédito 30 días', 'warranty': '12 meses', 'inclusions': '', 'exclusions': '', 'notes': f'Trazado {RUN}', 'fx_date': T,
          'usd_mxn': '18', 'eur_mxn': None, 'fx_source': 'Manual QA', 'discount': '0', 'vat': '16', 'sf_enabled': True, 'sf_pct': '4', 'sf_comments': '',
          'lines': [{'line_id': lid, 'source': 'offer', 'quote_id': best(lid)['quote_id'], 'qty': str(int(float(x['quantity']))), 'handling': '0', 'margin': '15', 'brand_model': ''}
                    for lid, x in ((l['id'], l) for l in L)]}
    cq = must(adm.call('POST', f'{B}/customer-quotes', CQ), 'borrador al cliente')
    # Línea 1: la mejor oferta es B (60 USD × 18 = 1,080 MXN < 1,200 MXN): costo convertido.
    units = [r2(1080 * 1.15), r2(850.50 * 1.15), r2(35 * 1.15)]; third = r2(r2(4 * units[0]) + r2(2 * units[1]) + r2(10 * units[2]))
    sf = r2(third * 0.04); total = r2(r2(third + r2(third * 0.16)) + r2(sf + r2(sf * 0.16)))
    check('T6 · borrador Rev. 0 con folio COT; total del servidor = fórmula de la tarjeta (con conversión USD)', re.fullmatch(rf'COT-{TODAY.year}-\d{{4,}}', cq['folio']) and cq['revision'] == 0
          and abs(float(cq['total']) - total) < 0.005, f"{cq.get('total')} vs {total}")
    row6b = (find(adm.get(f"{B}/rfq-requisitions?page=1&page_size=50&rfq=quoted&q={req['folio']}")['items'], 'id', req['id']) or {}).get('customer_quote') or {}
    check('T6 · el selector ahora la marca como borrador editable', row6b.get('folio') == cq['folio'] and row6b.get('editable_draft') is True)

    # ---------- Tarjetas 7, 8, 1, 9 y 10 (lecturas) ----------
    d7 = adm.get(f"{B}/customer-quotes/{cq['id']}")
    check('T7 · formato: Revisó/Autorizó asignados (pendientes, sin firma registrada)', d7['item'].get('reviewer_assigned') == ppl[0]['name'] and d7['item'].get('approver_assigned') == ppl[1]['name']
          and not d7['item'].get('reviewed_by') and not d7['item'].get('approved_by'))
    check('T7 · formato para el cliente: 3 partidas con precio de venta, sin costos internos ni margen', len(d7['items']) == 3 and not re.search(r'cost|margin|charge_pct|extra_amount|supplier', json.dumps(d7['items']), re.I)
          and abs(float(d7['item']['total_amount']) - float(cq['total'])) < 0.005 and [round(float(x['unit_price']), 2) for x in d7['items']] == units, json.dumps(d7['items'])[:300])
    r8 = find(adm.get(f"{B}/customer-quotes?page=1&page_size=10&scope=all&q={cq['folio']}")['items'], 'id', cq['id']) or {}
    check('T8 · matriz de cotizaciones al cliente: Borrador, Rev. 0, decisión sin registrar', r8.get('status_key') == 'draft' and r8.get('revision') == 0 and r8.get('client_decision_status') == 'not_recorded'
          and r8.get('requisition') == req['folio'], json.dumps(r8)[:250])
    fam = find(adm.get(f"{B}/revisions?page=1&page_size=24&q={cq['folio']}")['items'], 'current_id', cq['id']) or {}
    check('T1 · revisiones/modificaciones: familia con Rev. 0 vigente = el borrador', fam.get('revisions') == 1 and fam.get('current_folio') == cq['folio'], json.dumps(fam)[:250])
    c9 = find(adm.get(f"{B}/customer-quotes?page=1&page_size=10&scope=current&q={cq['folio']}")['items'], 'id', cq['id']) or {}
    check('T9 · decisión del cliente: aparece como vigente, sin decisión registrada', c9.get('is_current') is True and not c9.get('last_decision'), json.dumps(c9)[:200])
    aw = adm.get(f"{B}/awards?page=1&page_size=10&q={req['folio']}")
    check('T10 · adjudicación definitiva: ninguna para esta requisición (sigue bloqueada)', aw.get('total') == 0, json.dumps(aw)[:200])

    # ---------- Bitácora ----------
    log = adm.get('/api/v1/audit-events?module=quotes&page_size=50')['items']
    acts = {(x['action'], f) for x in log for f in (ra['folio'], rb['folio'], qa['folio'], qb['folio'], cq['folio']) if f in json.dumps(x, ensure_ascii=False)}
    need = {('rfq.create', ra['folio']), ('rfq.mark_sent', ra['folio']), ('rfq.create', rb['folio']), ('supplier_quote.create', qa['folio']), ('supplier_quote.create', qb['folio']),
            ('customer_quote.draft_create', cq['folio'])}
    check('bitácora (módulo quotes): cada guardado quedó registrado con su folio', need <= acts, str(sorted(need - acts)))

    # ---------- Escrituras que siguen bloqueadas ----------
    P = f"{B}/customer-quotes/{cq['id']}"
    blocked = [('POST', f'{B}/awards'), ('POST', f'{B}/comparison/select'), ('POST', f'{B}/comparison'), ('POST', f'{P}/send'), ('POST', f'{P}/approve'), ('POST', f'{P}/authorize'),
               ('POST', f'{P}/decision'), ('POST', f'{P}/issue'), ('DELETE', P), ('DELETE', f"{B}/rfqs/{ra['id']}"), ('DELETE', f"{B}/supplier-quotes/{qa['id']}"), ('PUT', f"{B}/rfqs/{ra['id']}")]
    codes = {f'{m} {p.replace(B, "")}': adm.call(m, p, {})[0] for m, p in blocked}
    check('bloqueadas (5 seleccionar/adjudicar, 9 decisión, 10 adjudicación, enviar/autorizar/emitir, eliminar): sin ruta (≠ 2xx)', all(not 200 <= c < 300 for c in codes.values()), json.dumps(codes))
    print(f"Trazado sintético: {req['folio']} · RFQ {ra['folio']}, {rb['folio']} · COT proveedor {qa['folio']}, {qb['folio']} · COT cliente {cq['folio']}")
except SystemExit:
    raise
except Exception as e:
    check('trazado sin excepciones', False, f'{type(e).__name__}: {e}')

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok)
print(f'\nCotizaciones · trazado de punta a punta (HTTP): {len(results) - failed}/{len(results)} {"PASS" if not failed else "FAIL"}'); sys.exit(1 if failed else 0)
