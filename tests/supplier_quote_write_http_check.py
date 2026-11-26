#!/usr/bin/env python3
"""Cotizaciones › Registro de cotización (tarjeta 4) · contrato HTTP de las escrituras (cuenta supplyflow_quotewrite_local):
GET write-status, POST /supplier-quotes, PUT /supplier-quotes/{id} y GET /supplier-quotes/{id}/document.
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (registra cotizaciones de proveedor que no se pueden eliminar).
Exige SF_SYNTHETIC_WRITES=1. Crea por la API su propia requisición sintética (Registro RF1), su validación (Gestión del
Contratista) y sus RFQ (2 enviadas y 1 en borrador, tarjeta 2), para no consumir las RFQ de las pruebas de solo lectura.
Verifica 401/403/CSRF/415/413/422 por campo/404/409/428/412, idempotencia, folio COT-AAAA-NNNN consecutivo, importes calculados
en el servidor, una cotización por RFQ, PDF privado (descarga con huella), edición con versión y reemplazo del PDF, cotizaciones
importadas/sin RFQ que se conservan, lecturas (matriz, comparativo, RFQ respondida), bitácora y que no existan rutas para eliminar,
adjudicar ni emitir RFQ.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/supplier_quote_write_http_check.py
"""
import base64, hashlib, http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
from datetime import date, timedelta
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
B = '/api/v1/quotes'; Q = f'{B}/supplier-quotes'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper(); ZERO = '00000000-0000-4000-8000-000000000000'

class S:
    def __init__(self, email=None):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); self.csrf = ''
        if email:
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
            self.call('POST', '/api/v1/auth/login', {'email': email, 'password': PASSWORD}, key=None)
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
    def get(self, p): return json.loads(self.op.open(API + p).read())
    def raw(self, p):
        try:
            r = self.op.open(API + p); return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()
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

def pdf(label):
    body = f'%PDF-1.4\n% SupplyFlow QA {label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.encode()
    return {'name': f'Cotizacion {label}.pdf', 'data': base64.b64encode(body).decode()}, body

def fixtures(op):
    """Requisición sintética validada con 2 partidas y sus RFQ propias: 2 enviadas (proveedores distintos) y 1 en borrador."""
    today = date.today().isoformat()
    cat = op.get('/api/v1/recovery/catalogs')
    client = next(c for c in cat['clients'] if c['status'] == 'active' and c.get('code'))
    cats = [c['name'] for c in cat['categories'] if c['active']]
    folio = op.get(f"/api/v1/recovery/folio?client_id={client['id']}&date={today}&mode=formal")['folio']
    st, req = op.call('POST', '/api/v1/recovery/requisitions', {'folio': folio, 'client_id': client['id'], 'request_date': today, 'need_date': f'{date.today().year + 1}-03-01',
        'project': f'PRY-COT-{RUN}', 'contract': 'CTO-QA', 'client_reference': f'COT-{RUN}', 'priority': 'normal', 'delivery_place': 'Almacén sintético', 'requester_name': 'Solicitante QA',
        'requester_email': 'qa@cliente.invalid', 'budget': '', 'currency': 'MXN', 'description': f'Requisición sintética cotizaciones {RUN}', 'notes': None,
        'source': {'type': 'Requisición formal del cliente', 'date': today, 'reference': None, 'notes': None, 'requirement': 'formal', 'due_date': None, 'owner': None},
        'items': [{'id': None, 'description': f'Guantes sintéticos {RUN}', 'quantity': '10', 'unit': 'par', 'category': cats[0]},
                  {'id': None, 'description': f'Casco sintético {RUN}', 'quantity': '2', 'unit': 'pza', 'category': cats[-1]}], 'document': None})
    if st != 201: raise SystemExit(f'BLOCKED: no se pudo crear la requisición sintética ({st} {req})')
    setup = op.get('/api/v1/contractor-management/validation-setup'); buyer = next(b for b in setup['buyers'] if b['has_user'] and b['with_access'])
    st, r = op.call('POST', '/api/v1/contractor-management/validations', {'requisition_id': req['id'], 'buyer_id': buyer['id'], 'technical': 'Conforme', 'contract': 'Conforme',
        'budget': 'Disponible', 'strategy': 'Competencia abierta', 'min_quotes': '2', 'deadline': f'{date.today().year + 1}-01-15', 'criteria': 'Precio y plazo', 'notes': f'Validación sintética {RUN}'})
    if st != 201: raise SystemExit(f'BLOCKED: no se pudo registrar la validación ({st} {r})')
    rs = op.get('/api/v1/quotes/rfq-setup'); sups = [x for x in rs['suppliers'] if x['status'] in ('authorized', 'active')]
    lines = [i['id'] for i in op.get(f"/api/v1/quotes/rfq-requisitions/{req['id']}")['items']]
    made = []
    for n, status in enumerate(['sent', 'sent', 'draft']):
        st, f = op.call('POST', '/api/v1/quotes/rfqs', {'requisition_id': req['id'], 'supplier_id': sups[n]['id'], 'contact_id': rs['contacts'][0]['id'], 'issue_date': today,
            'deadline': (date.today() + timedelta(days=10)).isoformat(), 'required_date': None, 'currency': 'MXN', 'delivery_place': '', 'docs': '', 'conditions': '', 'status': status, 'items': lines})
        if st != 201: raise SystemExit(f'BLOCKED: no se pudo registrar la RFQ sintética ({st} {f})')
        made.append(f)
    det = op.get(f"/api/v1/quotes/rfq-requisitions/{req['id']}")
    by = {x['id']: x for x in det['rfqs']}
    return [(det['item'], by[made[0]['id']]), (det['item'], by[made[1]['id']])], by[made[2]['id']]

adm = S(USER)
try:
    st = adm.get(f'{B}/write-status')
    check('write-status: OK, 52 permisos, sin faltantes, sin secretos', st.get('code') == 'OK' and st.get('enabled') is True and st.get('expected_grants') == 52 and st.get('missing_grants') == []
          and not re.search(r'(?i)password|secret|/run/|[0-9a-f]{64}', json.dumps(st)), json.dumps(st))
    free, draft = fixtures(adm)
    if len(free) < 2:
        print('BLOCKED: no se pudieron preparar las RFQ sintéticas.'); sys.exit(2)
    (req, rfq), (req2, rfq2) = free[0], free[1]
    lines = adm.get(f"{B}/rfqs/{rfq['id']}")['items']
    today = date.today()
    doc1, bytes1 = pdf(f'A {RUN}')
    def body(rfq_id, lines_, **kw):
        b = {'rfq_id': rfq_id, 'supplier_reference': f'PROV-{RUN}', 'quote_date': today.isoformat(), 'valid_until': (today + timedelta(days=30)).isoformat(), 'vat': '16',
             'currency': 'MXN', 'lead_days': '7', 'payment': 'PPD', 'technical': '95', 'documentation': '90', 'notes': f'Cotización sintética {RUN}',
             'lines': [{'line_number': int(l['line_number']), 'offered': True, 'qty': str(float(l['quantity'])).rstrip('0').rstrip('.'), 'price': '12.345' if n == 0 else '99.999'} for n, l in enumerate(lines_)], 'document': None}
        b.update(kw); return b
    OK = body(rfq['id'], lines, document=doc1)
    # Importes esperados con la misma regla de la tarjeta (centavos por partida).
    r2 = lambda v: float(f'{v + (1e-9 if v >= 0 else -1e-9):.2f}')
    subs = [r2(float(l['qty']) * float(l['price'])) for l in OK['lines']]; taxes = [r2(s * 16 / 100) for s in subs]
    exp = (r2(sum(subs)), r2(sum(taxes)), r2(r2(sum(subs)) + r2(sum(taxes))))

    anon = S()
    check('sin sesión: 401', anon.call('POST', Q, OK, csrf=False)[0] == 401 and anon.raw(f'{B}/write-status')[0] == 401)
    if NONADMIN:
        o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', Q, OK)[0] == 403 and o.call('PUT', f'{Q}/{ZERO}', OK, ifm=1)[0] == 403); o.logout()
    check('sin CSRF: 403', adm.call('POST', Q, OK, csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('POST', Q, b'a=1', ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('POST', Q, OK, key=None)[0] == 422)
    L = OK['lines']
    bad = [({**OK, 'rfq_id': 'x'}, 'rfq_id'), ({**OK, 'quote_date': ''}, 'quote_date'), ({**OK, 'quote_date': '2026-02-30'}, 'quote_date'),
           ({**OK, 'valid_until': (today - timedelta(days=1)).isoformat()}, 'valid_until'), ({**OK, 'lead_days': 'x'}, 'lead_days'), ({**OK, 'lead_days': '3651'}, 'lead_days'),
           ({**OK, 'currency': 'mxn'}, 'currency'), ({**OK, 'payment': 'Contado'}, 'payment'), ({**OK, 'vat': '101'}, 'vat'), ({**OK, 'technical': 'abc'}, 'technical'),
           ({**OK, 'documentation': '90.12345'}, 'documentation'), ({**OK, 'supplier_reference': 'x' * 129}, 'supplier_reference'), ({**OK, 'notes': 'x' * 4001}, 'notes'),
           ({**OK, 'lines': []}, 'lines'), ({**OK, 'lines': [{**l, 'offered': False} for l in L]}, 'lines'), ({**OK, 'lines': [{**L[0], 'qty': '0'}] + L[1:]}, f"line:{L[0]['line_number']}"),
           ({**OK, 'lines': [{**L[0], 'price': ''}] + L[1:]}, f"line:{L[0]['line_number']}"), ({**OK, 'lines': [L[0], L[0]]}, 'lines'), ({**OK, 'lines': [{**L[0], 'subtotal': '1'}] + L[1:]}, 'lines'),
           ({**OK, 'document': {'name': 'x.pdf', 'data': base64.b64encode(b'GIF89a').decode()}}, 'document'), ({**OK, 'document': {'name': 'x.pdf', 'data': '%%%'}}, 'document'),
           ({**OK, 'total': '1'}, 'body')]
    got = [(f, *adm.call('POST', Q, b)) for b, f in bad]
    check('cuerpo inválido: 422 INVALID_QUOTE con el campo (los importes no se aceptan del navegador)', all(s == 422 and r['error']['code'] == 'INVALID_QUOTE' and r['error'].get('field') == f for f, s, r in got),
          str([(f, s, r.get('error', {}).get('field')) for f, s, r in got if s != 422 or r.get('error', {}).get('field') != f]))
    big = {'name': 'grande.pdf', 'data': base64.b64encode(b'%PDF-' + b'0' * (8 * 1024 * 1024)).decode()}
    s, r = adm.call('POST', Q, {**OK, 'document': big})
    check('PDF mayor a 8 MB: 422 document', s == 422 and r['error'].get('field') == 'document', f'{s} {r.get("error")}')
    check('cuerpo mayor a 12 MB: 413', adm.call('POST', Q, {**OK, 'notes': 'x' * (12 * 1024 * 1024 + 10)})[0] == 413)
    check('RFQ inexistente: 404', adm.call('POST', Q, {**OK, 'rfq_id': ZERO})[0] == 404)
    s, r = adm.call('POST', Q, {**OK, 'lines': [{**L[0], 'qty': '99999999999999', 'price': '99999999999999'}] + L[1:]})
    check('importe que no cabe en DECIMAL(20,6): 422 con la partida (no un 503)', s == 422 and r['error'].get('field') == f"line:{L[0]['line_number']}", f'{s} {r}')
    s, r = adm.call('POST', Q, {**OK, 'currency': 'XYZ'})
    check('moneda fuera del catálogo: 422 CURRENCY_UNAVAILABLE', s == 422 and r['error']['code'] == 'CURRENCY_UNAVAILABLE' and r['error'].get('field') == 'currency', f'{s} {r}')
    s, r = adm.call('POST', Q, {**OK, 'lines': L[:-1]} if len(L) > 1 else {**OK, 'lines': L + [{**L[0], 'line_number': 99}]})
    check('partidas distintas a las de la RFQ: 409 LINES_CHANGED', s == 409 and r['error']['code'] == 'LINES_CHANGED', f'{s} {r}')
    if draft:
        dl = adm.get(f"{B}/rfqs/{draft['id']}")['items']
        s, r = adm.call('POST', Q, body(draft['id'], dl))
        check('RFQ en borrador (no enviada): 409 RFQ_NOT_SENT', s == 409 and r['error']['code'] == 'RFQ_NOT_SENT', f'{s} {r}')

    key = str(uuid.uuid4())
    s, a = adm.call('POST', Q, OK, key=key)
    year = today.year
    check('alta: 201 con folio COT-AAAA-NNNN, versión 1 e importes calculados en el servidor', s == 201 and re.fullmatch(rf'COT-{year}-\d{{4,}}', a.get('folio', '')) and a.get('version') == 1
          and (a.get('subtotal'), a.get('tax'), a.get('total')) == exp and a.get('rfq') == rfq['folio'] and (a.get('document') or {}).get('name') == doc1['name'], f'{s} {a} esperado {exp}')
    s2, a2 = adm.call('POST', Q, OK, key=key)
    check('reintento con la misma clave: 200 sin duplicar', s2 == 200 and a2.get('replayed') is True and a2.get('folio') == a.get('folio'))
    check('misma clave con otro contenido: 409', adm.call('POST', Q, {**OK, 'lead_days': '8'}, key=key)[0] == 409)
    s, r = adm.call('POST', Q, OK)
    check('una cotización por RFQ: 409 RFQ_ALREADY_QUOTED', s == 409 and r['error']['code'] == 'RFQ_ALREADY_QUOTED' and a['folio'] in r['error']['message'], f'{s} {r}')
    lines2 = adm.get(f"{B}/rfqs/{rfq2['id']}")['items']
    s3, b2 = adm.call('POST', Q, body(rfq2['id'], lines2, currency='USD', vat='0', lines=[{'line_number': int(l['line_number']), 'offered': n == 0, 'qty': '1', 'price': '10'} for n, l in enumerate(lines2)]))
    n1 = int(a['folio'].rsplit('-', 1)[1]); n2 = int(b2.get('folio', 'x-0').rsplit('-', 1)[1])
    check('segunda cotización (otra RFQ, sin PDF, partida no ofertada): folio consecutivo y total 10', s3 == 201 and n2 == n1 + 1 and b2.get('total') == 10.0 and b2.get('document') is None, f'{a["folio"]} → {b2}')

    # Lecturas
    det = adm.get(f"{Q}/{a['id']}"); it = det['item']
    check('detalle: Recibida, versión 1, editable, RFQ y PDF', it.get('status') == 'recibida' and it.get('legacy_status') == 'Recibida' and it.get('version') == 1 and it.get('editable') is True
          and it.get('rfq_id') == rfq['id'] and it.get('requisition_id') == req['id'] and (it.get('document') or {}).get('name') == doc1['name'] and float(it['total_amount']) == exp[2], json.dumps(it, ensure_ascii=False)[:400])
    check('detalle: partidas con cantidad, precio e importe del servidor', [(x['line_number'], x['offered'], float(x['unit_price']), float(x['line_subtotal'])) for x in det['items']]
          == [(l['line_number'], True, float(l['price']), sub) for l, sub in zip(L, subs)], json.dumps(det['items'])[:300])
    row = next((x for x in adm.get(f"{Q}?q={a['folio']}&page=1&page_size=10")['items'] if x['folio'] == a['folio']), {})
    check('matriz interna: la cotización con su RFQ, PDF y sin adjudicar', row.get('rfq_folio') == rfq['folio'] and row.get('file_count') == 1 and row.get('file_name') == doc1['name'] and row.get('awarded') is False, json.dumps(row, ensure_ascii=False)[:300])
    cmp = adm.get(f"{B}/comparison?requisition={req['id']}")
    check('comparativo: la cotización aparece con sus ofertas', any(q['folio'] == a['folio'] for q in cmp['quotes']) and any(o['quote_folio'] == a['folio'] for l in cmp['lines'] for o in l['offers']))
    rr = adm.get(f"/api/v1/quotes/rfq-requisitions/{req['id']}")
    check('RFQ: muestra la cotización registrada', next(f for f in rr['rfqs'] if f['id'] == rfq['id']).get('quote_folios') == a['folio'])
    rl = next((x for x in adm.get(f"{B}/rfqs?q={rfq['folio']}&page=1&page_size=10")['items'] if x['folio'] == rfq['folio']), {})
    check('matriz de RFQ: respondida con el folio de la cotización', rl.get('responded') is True and rl.get('quote_folio') == a['folio'], json.dumps(rl, ensure_ascii=False)[:200])
    s, h, data = adm.raw(f"{Q}/{a['id']}/document")
    check('PDF: descarga privada idéntica (no-store, nosniff, adjunto)', s == 200 and h.get('Content-Type', '').startswith('application/pdf') and data == bytes1 and 'no-store' in h.get('Cache-Control', '')
          and h.get('X-Content-Type-Options') == 'nosniff' and h.get('Content-Disposition', '').startswith('attachment'), f'{s} {h.get("Content-Type")}')
    check('PDF: cotización sin PDF o inexistente: 404', adm.raw(f"{Q}/{b2['id']}/document")[0] == 404 and adm.raw(f'{Q}/{ZERO}/document')[0] == 404)
    check('PDF: sin sesión 401', anon.raw(f"{Q}/{a['id']}/document")[0] == 401)

    # Edición
    P = f"{Q}/{a['id']}"; E = {k: v for k, v in OK.items() if k != 'rfq_id'}; E['document'] = None
    check('edición sin If-Match: 428', adm.call('PUT', P, E)[0] == 428)
    check('edición de cotización inexistente: 404', adm.call('PUT', f'{Q}/{ZERO}', E, ifm=1)[0] == 404)
    check('edición con versión vencida: 412', adm.call('PUT', P, E, ifm=5)[0] == 412)
    check('edición inválida: 422 con el campo', (lambda s, r: s == 422 and r['error'].get('field') == 'vat')(*adm.call('PUT', P, {**E, 'vat': '-1'}, ifm=1)))
    s, u0 = adm.call('PUT', P, E, ifm=1)
    check('guardar sin cambios (sin reenviar el PDF): 200 sin campos cambiados ni versión nueva', s == 200 and u0.get('changed') == [] and u0.get('version') == 1, f'{s} {u0}')
    doc2, bytes2 = pdf(f'B {RUN}')
    E2 = {**E, 'lead_days': '10', 'lines': [{**L[0], 'price': '11'}] + L[1:], 'document': doc2}
    s, u = adm.call('PUT', P, E2, ifm=1)
    check('edición: 200, versión 2, campos cambiados (partidas, plazo, importes y PDF)', s == 200 and u.get('version') == 2 and {'lead_days', 'lines', 'document', 'subtotal', 'total'} <= set(u.get('changed', [])), f'{s} {u}')
    s, h, data = adm.raw(f"{Q}/{a['id']}/document")
    row = next((x for x in adm.get(f"{Q}?q={a['folio']}&page=1&page_size=10")['items'] if x['folio'] == a['folio']), {})
    check('PDF reemplazado: se descarga el nuevo y el anterior queda como historial', s == 200 and data == bytes2 and row.get('file_count') == 1 and row.get('file_name') == doc2['name'], f'{s} {row.get("file_count")}')
    det2 = adm.get(f"{Q}/{a['id']}")
    check('detalle tras editar: versión 2, plazo 10 y precio 11', det2['item']['version'] == 2 and float(det2['item']['lead_days']) == 10 and float(det2['items'][0]['unit_price']) == 11)
    check('versión anterior: guardar otra vez exige la versión nueva (412)', adm.call('PUT', P, E2, ifm=1)[0] == 412)
    keep = next((x for x in adm.get(f'{Q}?page=1&page_size=50')['items'] if x['folio'] not in (a['folio'], b2.get('folio')) and (x.get('source_kind') != 'explicit' or not x.get('rfq_folio'))), None)
    if keep:
        kd = adm.get(f"{Q}/{keep['id']}")['item']
        s, r = adm.call('PUT', f"{Q}/{keep['id']}", E, ifm=kd['version'])
        check('cotización importada o sin RFQ: 409 IMPORTED_READ_ONLY (se conserva)', s == 409 and r['error']['code'] == 'IMPORTED_READ_ONLY' and kd.get('editable') is False and kd.get('edit_block') == 'imported', f'{s} {r} {kd.get("edit_block")}')
    aw = next((x for x in adm.get(f'{Q}?page=1&page_size=50')['items'] if x.get('awarded')), None)
    if aw:
        kd = adm.get(f"{Q}/{aw['id']}")['item']
        s, r = adm.call('PUT', f"{Q}/{aw['id']}", E, ifm=kd['version'])
        check('cotización adjudicada: no se edita (409)', s == 409 and r['error']['code'] in ('AWARDED_READ_ONLY', 'IMPORTED_READ_ONLY') and kd.get('editable') is False, f'{s} {r}')
    check('sin rutas para eliminar, adjudicar ni emitir RFQ (≠ 2xx)', all(not 200 <= adm.call(m, p, {})[0] < 300 for m, p in [('DELETE', P), ('POST', f'{P}/award'), ('POST', f'{B}/awards'), ('POST', f'{B}/rfqs'), ('PUT', f"{B}/rfqs/{rfq['id']}")]))
    # Tarjeta 4: la requisición sale de la lista «por cotizar» cuando sus RFQ enviadas ya tienen cotización (el borrador no cuenta).
    rq = adm.get(f"/api/v1/quotes/rfq-requisitions/{req['id']}")
    quot = adm.get(f"/api/v1/quotes/rfq-requisitions?rfq=quotable&page=1&page_size=50&q={req['folio']}")['items']
    check('lista «por cotizar»: excluye la requisición con sus RFQ enviadas ya cotizadas; el borrador no cuenta', all(x['id'] != req['id'] for x in quot)
          and any(x['id'] == req['id'] for x in adm.get(f"/api/v1/quotes/rfq-requisitions?rfq=with&page=1&page_size=50&q={req['folio']}")['items'])
          and any(f['status'] in ('borrador', 'draft') and not f.get('quote_folios') and f.get('imported') is False for f in rq['rfqs']), json.dumps([x['folio'] for x in quot]))
    log = adm.get('/api/v1/audit-events?module=quotes&page_size=50')['items']
    acts = {x['action'] for x in log if a['folio'] in json.dumps(x, ensure_ascii=False) or b2.get('folio', '-') in json.dumps(x, ensure_ascii=False)}
    check('bitácora: supplier_quote.create y supplier_quote.update', {'supplier_quote.create', 'supplier_quote.update'} <= acts, str(acts))
    print(f"Cotizaciones sintéticas: {a['folio']} ({rfq['folio']}), {b2.get('folio')} ({rfq2['folio']})")
finally:
    adm.logout()

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCotizaciones · registro de cotización (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
