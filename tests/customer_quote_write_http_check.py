#!/usr/bin/env python3
"""Cotizaciones › Cotización formal al cliente (tarjeta 6) · contrato HTTP del BORRADOR INTERNO (cuenta supplyflow_quotewrite_local):
POST /api/v1/quotes/customer-quotes, PUT /api/v1/quotes/customer-quotes/{id} y GET /api/v1/quotes/customer-quotes/{id}/draft.
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable. Crea por la API su requisición sintética, su validación, dos
RFQ enviadas y dos cotizaciones de proveedor (MXN y USD); nada se puede eliminar. Exige SF_SYNTHETIC_WRITES=1.
Verifica 401/403/CSRF/415/422 por campo/404/409/428/412, idempotencia, folio COT-AAAA-NNNN y Rev. 0, costos tomados de la oferta
registrada (no del navegador), conversión de moneda, precio de venta, descuento, IVA, Service Fee y total calculados en el
servidor (misma fórmula de la tarjeta), un borrador por requisición, edición con versión, que una cotización existente no se
duplica, que el formato del cliente no expone costos, bitácora y que no existan rutas para emitir, autorizar ni enviar.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/customer_quote_write_http_check.py
"""
import http.cookiejar, json, math, os, re, sys, urllib.error, urllib.request, uuid
from datetime import date, timedelta
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
B = '/api/v1/quotes'; C = f'{B}/customer-quotes'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper(); ZERO = '00000000-0000-4000-8000-000000000000'; TODAY = date.today()

class S:
    def __init__(self, email=None):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); self.csrf = ''
        if email:
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
            self.call('POST', '/api/v1/auth/login', {'email': email, 'password': PASSWORD}, key=None)
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
    def get(self, p): return json.loads(self.op.open(API + p).read())
    def call(self, method, path, body=None, key='new', ifm=None, csrf=True, ctype='application/json'):
        h = {'Content-Type': ctype}
        if csrf and self.csrf: h['X-SF-CSRF'] = self.csrf
        if key: h['Idempotency-Key'] = str(uuid.uuid4()) if key == 'new' else key
        if ifm is not None: h['If-Match'] = f'"{ifm}"'
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        try:
            r = self.op.open(urllib.request.Request(API + path, data, h, method=method)); return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try: return e.code, json.loads(e.read() or b'{}')
            except ValueError: return e.code, {}
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {}, key=None)
        except Exception: pass

def must(st, out, what):
    if st not in (200, 201): raise SystemExit(f'BLOCKED: {what} ({st} {out})')
    return out

def fixtures(op):
    """Requisición validada (2 partidas), dos RFQ enviadas y sus cotizaciones: A en MXN y B en USD."""
    today = TODAY.isoformat(); cat = op.get('/api/v1/recovery/catalogs')
    client = next(c for c in cat['clients'] if c['status'] == 'active' and c.get('code')); cats = [c['name'] for c in cat['categories'] if c['active']]
    folio = op.get(f"/api/v1/recovery/folio?client_id={client['id']}&date={today}&mode=formal")['folio']
    req = must(*op.call('POST', '/api/v1/recovery/requisitions', {'folio': folio, 'client_id': client['id'], 'request_date': today, 'need_date': f'{TODAY.year + 1}-03-01',
        'project': f'PRY-CQ-{RUN}', 'contract': 'CTO-QA', 'client_reference': f'CQ-{RUN}', 'priority': 'normal', 'delivery_place': 'Almacén sintético CQ', 'requester_name': 'Solicitante QA',
        'requester_email': 'qa@cliente.invalid', 'budget': '', 'currency': 'MXN', 'description': f'Requisición sintética cotización al cliente {RUN}', 'notes': None,
        'source': {'type': 'Requisición formal del cliente', 'date': today, 'reference': None, 'notes': None, 'requirement': 'formal', 'due_date': None, 'owner': None},
        'items': [{'id': None, 'description': f'Bomba sintética {RUN}', 'quantity': '10', 'unit': 'pza', 'category': cats[0]},
                  {'id': None, 'description': f'Servicio de instalación {RUN}', 'quantity': '2', 'unit': 'servicio', 'category': cats[-1]}], 'document': None}), 'requisición')
    vs = op.get('/api/v1/contractor-management/validation-setup'); buyer = next(b for b in vs['buyers'] if b['has_user'] and b['with_access'])
    must(*op.call('POST', '/api/v1/contractor-management/validations', {'requisition_id': req['id'], 'buyer_id': buyer['id'], 'technical': 'Conforme', 'contract': 'Conforme', 'budget': 'Disponible',
        'strategy': 'Competencia abierta', 'min_quotes': '2', 'deadline': f'{TODAY.year + 1}-01-15', 'criteria': 'Precio y plazo', 'notes': f'Validación sintética CQ {RUN}'}), 'validación')
    rs = op.get(f'{B}/rfq-setup'); sups = [x for x in rs['suppliers'] if x['status'] in ('authorized', 'active')]
    lines = op.get(f"{B}/rfq-requisitions/{req['id']}")['items']
    quotes = []
    for n, (cur, prices) in enumerate([('MXN', ['100', '500']), ('USD', ['6', '600'])]):
        f = must(*op.call('POST', f'{B}/rfqs', {'requisition_id': req['id'], 'supplier_id': sups[n]['id'], 'contact_id': rs['contacts'][0]['id'], 'issue_date': today, 'deadline': today,
            'required_date': None, 'currency': cur, 'delivery_place': '', 'docs': '', 'conditions': '', 'status': 'sent', 'items': [l['id'] for l in lines]}), 'RFQ')
        items = op.get(f"{B}/rfqs/{f['id']}")['items']
        q = must(*op.call('POST', f'{B}/supplier-quotes', {'rfq_id': f['id'], 'supplier_reference': f'P-{RUN}-{n}', 'quote_date': today, 'valid_until': None, 'vat': '16', 'currency': cur,
            'lead_days': '5', 'payment': 'PPD', 'technical': '100', 'documentation': '100', 'notes': '', 'document': None,
            'lines': [{'line_number': int(i['line_number']), 'offered': True, 'qty': str(int(float(i['quantity']))), 'price': prices[k]} for k, i in enumerate(items)]}), 'cotización de proveedor')
        quotes.append({**q, 'supplier': sups[n]['name']})
    return req, lines, quotes, buyer

# Misma fórmula y redondeo de la tarjeta (customerQuoteBuilder.mjs).
EPS = 2.220446049250313e-16
r2 = lambda x: math.floor((x + EPS) * 100 + 0.5) / 100
def expected(lines_in, fx, p):
    rate = lambda c: {'MXN': 1.0, 'USD': fx.get('usd'), 'EUR': fx.get('eur')}[c]
    subs = []; units = []
    for cost, cur, qty, h, m in lines_in:
        cu = cost if cur == p['currency'] else cost * rate(cur) / rate(p['currency'])
        u = r2(((cu * qty + h) * (1 + m / 100)) / qty); units.append(u); subs.append(r2(u * qty))
    third = r2(sum(subs)); disc = r2(third * p['discount'] / 100); taxable = r2(third - disc); tax = r2(taxable * p['vat'] / 100); tt = r2(taxable + tax)
    sfu = r2(taxable * p['sf'] / 100) if p['sf_on'] else 0.0; sft = r2(sfu * p['vat'] / 100); sftot = r2(sfu + sft)
    return {'units': units, 'subs': subs, 'third': third, 'discount': disc, 'taxable': taxable, 'tax': tax, 'sf': sfu, 'sf_total': sftot, 'total': r2(tt + sftot)}

adm = S(USER)
try:
    st = adm.get(f'{B}/write-status')
    check('write-status: OK, 111 permisos, sin faltantes, sin secretos', st.get('code') == 'OK' and st.get('expected_grants') == 111 and st.get('missing_grants') == []
          and not re.search(r'(?i)password|secret|/run/|[0-9a-f]{64}', json.dumps(st)), json.dumps(st)[:300])
    req, lines, quotes, buyer = fixtures(adm)
    qa, qb = quotes
    setup = adm.get(f'{B}/rfq-setup'); prep = setup['contacts'][0]
    L = [{'line_id': lines[0]['id'], 'source': 'offer', 'quote_id': qb['id'], 'qty': '10', 'handling': '50', 'margin': '20', 'brand_model': f'Marca X {RUN}'},
         {'line_id': lines[1]['id'], 'source': 'offer', 'quote_id': qa['id'], 'qty': '2', 'handling': '0', 'margin': '10', 'brand_model': ''}]
    OK = {'requisition_id': req['id'], 'issue_date': TODAY.isoformat(), 'valid_until': (TODAY + timedelta(days=30)).isoformat(), 'currency': 'MXN', 'preparer_id': prep['id'],
          'lead_time': '10 días hábiles', 'delivery_place': 'Planta sintética', 'payment_terms': 'Crédito 30 días', 'warranty': '12 meses', 'inclusions': 'Flete', 'exclusions': 'Maniobras',
          'notes': f'Notas sintéticas {RUN}', 'fx_date': TODAY.isoformat(), 'usd_mxn': '18.5', 'eur_mxn': '20.1', 'fx_source': 'Manual QA', 'discount': '5', 'vat': '16',
          'sf_enabled': True, 'sf_pct': '3', 'sf_comments': 'Service fee QA', 'lines': L}
    EXP = expected([(6.0, 'USD', 10, 50, 20), (500.0, 'MXN', 2, 0, 10)], {'usd': 18.5, 'eur': 20.1}, {'currency': 'MXN', 'discount': 5, 'vat': 16, 'sf': 3, 'sf_on': True})

    anon = S()
    check('sin sesión: 401', anon.call('POST', C, OK, csrf=False)[0] == 401)
    if NONADMIN:
        o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', C, OK)[0] == 403 and o.call('PUT', f'{C}/{ZERO}', OK, ifm=1)[0] == 403); o.logout()
    check('sin CSRF: 403', adm.call('POST', C, OK, csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('POST', C, b'a=1', ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('POST', C, OK, key=None)[0] == 422)
    l0 = f"line:{lines[0]['id']}"
    bad = [({**OK, 'requisition_id': 'x'}, 'requisition_id'), ({**OK, 'issue_date': ''}, 'issue_date'), ({**OK, 'valid_until': (TODAY - timedelta(days=1)).isoformat()}, 'valid_until'),
           ({**OK, 'currency': 'mxn'}, 'currency'), ({**OK, 'preparer_id': 'x'}, 'preparer_id'), ({**OK, 'discount': '101'}, 'discount'), ({**OK, 'vat': '-1'}, 'vat'),
           ({**OK, 'sf_pct': 'x'}, 'sf_pct'), ({**OK, 'usd_mxn': '0'}, 'usd_mxn'), ({**OK, 'notes': 'x' * 4001}, 'notes'), ({**OK, 'lines': []}, 'lines'),
           ({**OK, 'lines': [{**L[0], 'qty': '0'}, L[1]]}, l0), ({**OK, 'lines': [{**L[0], 'margin': '1001'}, L[1]]}, l0), ({**OK, 'lines': [{**L[0], 'source': 'manual'}, L[1]]}, l0),
           ({**OK, 'lines': [L[0], L[0]]}, 'lines'), ({**OK, 'lines': [{**L[0], 'cost': '1'}, L[1]]}, 'lines'), ({**OK, 'total': '1'}, 'body'), ({**OK, 'sf_enabled': 'yes'}, 'sf_enabled')]
    got = [(f, *adm.call('POST', C, b)) for b, f in bad]
    check('cuerpo inválido: 422 INVALID_CUSTOMER_QUOTE con el campo (costos y totales no se aceptan del navegador)', all(s == 422 and r['error']['code'] == 'INVALID_CUSTOMER_QUOTE' and r['error'].get('field') == f for f, s, r in got),
          str([(f, s, r.get('error', {}).get('field')) for f, s, r in got if s != 422 or r.get('error', {}).get('field') != f]))
    check('requisición inexistente: 404', adm.call('POST', C, {**OK, 'requisition_id': ZERO})[0] == 404)
    s, r = adm.call('POST', C, {**OK, 'currency': 'XYZ'})
    check('moneda fuera del catálogo: 422 CURRENCY_UNAVAILABLE', s == 422 and r['error']['code'] == 'CURRENCY_UNAVAILABLE', f'{s} {r}')
    s, r = adm.call('POST', C, {**OK, 'preparer_id': ZERO})
    check('comprador que elabora sin usuario activo Comprador/Master Admin: 422 PREPARER_UNAVAILABLE', s == 422 and r['error']['code'] == 'PREPARER_UNAVAILABLE', f'{s} {r}')
    s, r = adm.call('POST', C, {**OK, 'lines': [L[0]]})
    check('partidas distintas a las vigentes de la requisición: 409 LINES_CHANGED', s == 409 and r['error']['code'] == 'LINES_CHANGED', f'{s} {r}')
    s, r = adm.call('POST', C, {**OK, 'lines': [{**L[0], 'quote_id': ZERO}, L[1]]})
    check('oferta que no existe para la partida: 409 COST_SOURCE_CHANGED', s == 409 and r['error']['code'] == 'COST_SOURCE_CHANGED' and r['error'].get('field') == l0, f'{s} {r}')
    s, r = adm.call('POST', C, {**OK, 'usd_mxn': None})
    check('costo en USD sin tipo de cambio: 422 EXCHANGE_RATE_REQUIRED (usd_mxn)', s == 422 and r['error']['code'] == 'EXCHANGE_RATE_REQUIRED' and r['error'].get('field') == 'usd_mxn', f'{s} {r}')

    key = str(uuid.uuid4())
    s, a = adm.call('POST', C, OK, key=key)
    check('alta: 201 borrador Rev. 0 con folio COT-AAAA-NNNN y total calculado en el servidor', s == 201 and re.fullmatch(rf'COT-{TODAY.year}-\d{{4,}}', a.get('folio', '')) and a.get('revision') == 0
          and a.get('status') == 'Borrador' and a.get('version') == 1 and a.get('total') == EXP['total'], f'{s} {a} esperado {EXP["total"]}')
    s2, a2 = adm.call('POST', C, OK, key=key)
    check('reintento con la misma clave: 200 sin duplicar', s2 == 200 and a2.get('replayed') is True and a2.get('folio') == a.get('folio'))
    check('misma clave con otro contenido: 409', adm.call('POST', C, {**OK, 'discount': '6'}, key=key)[0] == 409)
    s, r = adm.call('POST', C, OK)
    check('un borrador por requisición: 409 DRAFT_EXISTS', s == 409 and r['error']['code'] == 'DRAFT_EXISTS' and a['folio'] in r['error']['message'], f'{s} {r}')

    d = adm.get(f"{C}/{a['id']}"); it = d['item']
    check('formato del cliente: Borrador, Rev. 0, partidas con precio de venta, Service Fee y total', it.get('legacy_status') == 'Borrador' and it.get('revision') == 0 and float(it['total_amount']) == EXP['total']
          and [float(x['unit_price']) for x in d['items']] == EXP['units'] and float(it['service_fee_subtotal_amount']) == EXP['sf'] and float(it['third_party_taxable_amount']) == EXP['taxable']
          and it.get('prepared_by') == prep['name'], json.dumps(it, ensure_ascii=False)[:400])
    check('formato del cliente sin costos, gasto ni margen', not any(k in x for x in d['items'] for k in ('cost_amount', 'extra_amount', 'charge_pct', 'original_cost_amount')), json.dumps(d['items'])[:200])
    dr = adm.get(f"{C}/{a['id']}/draft"); di = dr['item']
    check('borrador interno: costo de la oferta (USD 6 de B), gasto, margen, tipo de cambio y versión', di.get('version') == 1 and di.get('preparer_id') == prep['id'] and float(di['usd_mxn_rate']) == 18.5
          and dr['items'][0]['original_cost_currency'] == 'USD' and float(dr['items'][0]['original_cost_amount']) == 6 and qb['supplier'] in dr['items'][0]['cost_source_text']
          and float(dr['items'][0]['handling']) == 50 and float(dr['items'][0]['margin']) == 20 and dr['items'][0]['brand_model'] == f'Marca X {RUN}', json.dumps(dr, ensure_ascii=False)[:400])
    cmp = adm.get(f"{B}/comparison?requisition={req['id']}")['customer_quote']
    check('comparativo: el borrador es la cotización vigente y editable', cmp.get('folio') == a['folio'] and cmp.get('editable_draft') is True and cmp.get('imported') is False, json.dumps(cmp))
    row = next((x for x in adm.get(f"{C}?q={a['folio']}&page=1&page_size=10&scope=all")['items'] if x['folio'] == a['folio']), {})
    check('matriz de cotizaciones al cliente: aparece en Borrador', row.get('legacy_status') == 'Borrador' and row.get('document_status') == 'draft' and float(row.get('total_amount') or 0) == EXP['total'], json.dumps(row, ensure_ascii=False)[:300])

    # Edición del borrador
    P = f"{C}/{a['id']}"; E = {k: v for k, v in OK.items() if k != 'requisition_id'}
    check('edición sin If-Match: 428', adm.call('PUT', P, E)[0] == 428)
    check('edición de cotización inexistente: 404', adm.call('PUT', f'{C}/{ZERO}', E, ifm=1)[0] == 404)
    check('edición con versión vencida: 412', adm.call('PUT', P, E, ifm=7)[0] == 412)
    check('edición inválida: 422 con el campo', (lambda s, r: s == 422 and r['error'].get('field') == 'vat')(*adm.call('PUT', P, {**E, 'vat': '200'}, ifm=1)))
    E2 = {**E, 'currency': 'USD', 'sf_enabled': False, 'lines': [{**L[0], 'margin': '25'}, {**L[1], 'handling': '100'}]}
    EXP2 = expected([(6.0, 'USD', 10, 50, 25), (500.0, 'MXN', 2, 100, 10)], {'usd': 18.5, 'eur': 20.1}, {'currency': 'USD', 'discount': 5, 'vat': 16, 'sf': 0, 'sf_on': False})
    s, u = adm.call('PUT', P, E2, ifm=1)
    check('edición: 200, versión 2, recalculado en USD sin Service Fee', s == 200 and u.get('version') == 2 and u.get('currency') == 'USD' and u.get('total') == EXP2['total'], f'{s} {u} esperado {EXP2["total"]}')
    d2 = adm.get(f"{C}/{a['id']}")
    check('formato tras editar: USD, precios recalculados y sin Service Fee', d2['item']['currency'] == 'USD' and [float(x['unit_price']) for x in d2['items']] == EXP2['units'] and not d2['item']['service_fee_enabled'], json.dumps(d2['item'])[:200])
    check('versión anterior: guardar otra vez exige la versión nueva (412)', adm.call('PUT', P, E2, ifm=1)[0] == 412)

    # Cotizaciones que ya existen y no son borradores de SupplyFlow: no se duplican ni se editan aquí.
    # Se prefiere una cotización importada/no borrador (las «sf:» de otras corridas son borradores editables y quedan al frente).
    others = [x for x in adm.get(f'{C}?page=1&page_size=50&scope=all')['items'] if x['folio'] != a['folio'] and x.get('requisition_id')]
    other = next((x for x in others if not str(x.get('series') or '').startswith('sf:')), None) or next(iter(others), None)
    if other:
        oc = adm.get(f"{B}/comparison?requisition={other['requisition_id']}").get('customer_quote') or {}
        s, r = adm.call('POST', C, {**OK, 'requisition_id': other['requisition_id']})
        check('requisición con cotización al cliente existente: 409 (no se crea otra; nueva revisión vía Solicitar modificación)', s == 409 and r['error']['code'] in ('CUSTOMER_QUOTE_EXISTS', 'DRAFT_EXISTS', 'LINES_CHANGED'), f'{s} {r}')
        if r.get('error', {}).get('code') == 'CUSTOMER_QUOTE_EXISTS':
            msg = r['error']['message']
            check('409: importada → expediente en consulta y recaptura; propia → «Solicitar modificación»',
                  ('expediente importado' in msg and 'Registro de requisición' in msg) if oc.get('imported') else ('nueva revisión se origina con «Solicitar modificación»' in msg), msg)
        if oc and not oc.get('editable_draft'):
            s, r = adm.call('PUT', f"{C}/{oc['id']}", E, ifm=oc.get('row_version') or 1)
            check('cotización importada o ya no borrador: 409 al editar', s == 409 and r['error']['code'] in ('IMPORTED_READ_ONLY', 'NOT_A_DRAFT'), f'{s} {r}')
            check('sin datos internos de borrador para una no editable (404)', adm.call('GET', f"{C}/{oc['id']}/draft", key=None)[0] == 404)
    check('sin rutas para emitir, autorizar, enviar ni decidir (≠ 2xx)', all(not 200 <= adm.call(m, p, {})[0] < 300 for m, p in [('POST', f'{P}/send'), ('POST', f'{P}/issue'), ('POST', f'{P}/approve'),
          ('POST', f'{P}/decision'), ('DELETE', P), ('POST', f'{P}/authorize')]))
    log = adm.get('/api/v1/audit-events?module=quotes&page_size=50')['items']
    acts = {x['action'] for x in log if a['folio'] in json.dumps(x, ensure_ascii=False)}
    check('bitácora: customer_quote.draft_create y draft_update', {'customer_quote.draft_create', 'customer_quote.draft_update'} <= acts, str(acts))
    print(f"Borrador sintético: {a['folio']} de {req['folio']}")
finally:
    adm.logout()

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCotizaciones · borrador de cotización al cliente (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
