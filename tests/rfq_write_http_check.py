#!/usr/bin/env python3
"""Cotizaciones › Solicitud a proveedores (RFQ, tarjeta 2) · contrato HTTP de las escrituras (cuenta supplyflow_quotewrite_local):
POST /api/v1/quotes/rfqs y POST /api/v1/quotes/rfqs/{id}/mark-sent.
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable. Crea por la API sus propias requisiciones sintéticas (Registro
RF1) y sus validaciones (Gestión del Contratista), registra RFQ y una cotización; nada se puede eliminar. Exige SF_SYNTHETIC_WRITES=1.
Verifica 401/403/CSRF/415/422 por campo/404/409/428/412, idempotencia, folio RFQ-AAAA-NNNN consecutivo, validación vigente que
permita cotizar, proveedor invitable, contacto de compras, partidas 1..n en el orden de la requisición, Borrador → Enviada, que una
RFQ en borrador no recibe cotización y la enviada sí, bitácora y que no existan rutas para editar partidas ni eliminar RFQ.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/rfq_write_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
from datetime import date, timedelta
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
B = '/api/v1/quotes'; F = f'{B}/rfqs'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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

def requisition(op, tag, validation=None):
    """Requisición sintética propia (Registro RF1) con 3 partidas y, si se pide, su validación interna (Gestión del Contratista)."""
    cat = op.get('/api/v1/recovery/catalogs')
    client = next(c for c in cat['clients'] if c['status'] == 'active' and c.get('code'))
    cats = [c['name'] for c in cat['categories'] if c['active']]
    folio = op.get(f"/api/v1/recovery/folio?client_id={client['id']}&date={TODAY.isoformat()}&mode=formal")['folio']
    body = {'folio': folio, 'client_id': client['id'], 'request_date': TODAY.isoformat(), 'need_date': f'{TODAY.year + 1}-03-01', 'project': f'PRY-RFQ-{tag}',
            'contract': 'CTO-QA', 'client_reference': f'RFQ-{tag}', 'priority': 'normal', 'delivery_place': 'Almacén sintético RFQ', 'requester_name': 'Solicitante QA',
            'requester_email': 'qa@cliente.invalid', 'budget': '', 'currency': 'MXN', 'description': f'Requisición sintética RFQ {tag}', 'notes': None,
            'source': {'type': 'Requisición formal del cliente', 'date': TODAY.isoformat(), 'reference': None, 'notes': None, 'requirement': 'formal', 'due_date': None, 'owner': None},
            'items': [{'id': None, 'description': f'Tornillo sintético {tag}', 'quantity': '100', 'unit': 'pza', 'category': cats[0]},
                      {'id': None, 'description': f'Tuerca sintética {tag}', 'quantity': '50', 'unit': 'pza', 'category': cats[0]},
                      {'id': None, 'description': f'Arandela sintética {tag}', 'quantity': '25', 'unit': 'pza', 'category': cats[-1]}], 'document': None}
    st, out = op.call('POST', '/api/v1/recovery/requisitions', body)
    if st != 201: raise SystemExit(f'BLOCKED: no se pudo crear la requisición sintética ({st} {out})')
    if validation is not None:
        setup = op.get('/api/v1/contractor-management/validation-setup'); buyer = next(b for b in setup['buyers'] if b['has_user'] and b['with_access'])
        v = {'requisition_id': out['id'], 'buyer_id': buyer['id'], 'technical': 'Conforme', 'contract': 'Conforme', 'budget': 'Disponible', 'strategy': 'Competencia abierta',
             'min_quotes': '2', 'deadline': f'{TODAY.year + 1}-01-15', 'criteria': 'Precio y plazo', 'notes': f'Validación sintética RFQ {tag}', **validation}
        st, r = op.call('POST', '/api/v1/contractor-management/validations', v)
        if st != 201: raise SystemExit(f'BLOCKED: no se pudo registrar la validación ({st} {r})')
    return out['id']

adm = S(USER)
try:
    st = adm.get(f'{B}/write-status')
    check('write-status: OK, 111 permisos, sin faltantes, sin secretos', st.get('code') == 'OK' and st.get('enabled') is True and st.get('expected_grants') == 111 and st.get('missing_grants') == []
          and not re.search(r'(?i)password|secret|/run/|[0-9a-f]{64}', json.dumps(st)), json.dumps(st))
    rid = requisition(adm, RUN, {})
    blocked = requisition(adm, RUN + 'B', {'technical': 'No conforme', 'notes': f'Especificación incompleta {RUN}'})
    novalid = requisition(adm, RUN + 'N')
    setup = adm.get(f'{B}/rfq-setup')
    sups = [x for x in setup['suppliers'] if x['status'] in ('authorized', 'active')]
    bad_sup = next((x for x in setup['suppliers'] if x['status'] in ('suspended', 'inactive')), None)
    contact = setup['contacts'][0]
    det = adm.get(f'{B}/rfq-requisitions/{rid}'); items = det['items']
    pick = [items[0]['id'], items[2]['id']]
    OK = {'requisition_id': rid, 'supplier_id': sups[0]['id'], 'contact_id': contact['id'], 'issue_date': TODAY.isoformat(), 'deadline': (TODAY + timedelta(days=5)).isoformat(),
          'required_date': f'{TODAY.year + 1}-03-01', 'currency': 'MXN', 'delivery_place': 'Almacén sintético RFQ', 'docs': 'Ficha técnica y garantía.', 'conditions': f'Condiciones sintéticas {RUN}',
          'status': 'draft', 'items': list(reversed(pick))}

    anon = S()
    check('sin sesión: 401', anon.call('POST', F, OK, csrf=False)[0] == 401)
    if NONADMIN:
        o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', F, OK)[0] == 403 and o.call('POST', f'{F}/{ZERO}/mark-sent', {}, ifm=1)[0] == 403); o.logout()
    check('sin CSRF: 403', adm.call('POST', F, OK, csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('POST', F, b'a=1', ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('POST', F, OK, key=None)[0] == 422)
    bad = [({**OK, 'requisition_id': 'x'}, 'requisition_id'), ({**OK, 'supplier_id': ''}, 'supplier_id'), ({**OK, 'contact_id': None}, 'contact_id'), ({**OK, 'issue_date': ''}, 'issue_date'),
           ({**OK, 'deadline': (TODAY - timedelta(days=1)).isoformat()}, 'deadline'), ({**OK, 'required_date': '2026-02-30'}, 'required_date'), ({**OK, 'currency': 'mxn'}, 'currency'),
           ({**OK, 'status': 'answered'}, 'status'), ({**OK, 'items': []}, 'items'), ({**OK, 'items': ['x']}, 'items'), ({**OK, 'items': [pick[0], pick[0]]}, 'items'),
           ({**OK, 'docs': 'x' * 4001}, 'docs'), ({**OK, 'delivery_place': 'x' * 501}, 'delivery_place'), ({**OK, 'price': '1'}, 'body')]
    got = [(f, *adm.call('POST', F, b)) for b, f in bad]
    check('cuerpo inválido: 422 INVALID_RFQ con el campo', all(s == 422 and r['error']['code'] == 'INVALID_RFQ' and r['error'].get('field') == f for f, s, r in got),
          str([(f, s, r.get('error', {}).get('field')) for f, s, r in got if s != 422 or r.get('error', {}).get('field') != f]))
    check('requisición inexistente: 404', adm.call('POST', F, {**OK, 'requisition_id': ZERO})[0] == 404)
    s, r = adm.call('POST', F, {**OK, 'requisition_id': novalid})
    check('requisición sin validación interna: 409 REVIEW_REQUIRED', s == 409 and r['error']['code'] == 'REVIEW_REQUIRED', f'{s} {r}')
    s, r = adm.call('POST', F, {**OK, 'requisition_id': blocked})
    check('validación vigente que no permite cotizar: 409 REVIEW_BLOCKS_QUOTING', s == 409 and r['error']['code'] == 'REVIEW_BLOCKS_QUOTING', f'{s} {r}')
    s, r = adm.call('POST', F, {**OK, 'supplier_id': ZERO})
    check('proveedor inexistente: 422 SUPPLIER_UNAVAILABLE', s == 422 and r['error']['code'] == 'SUPPLIER_UNAVAILABLE' and r['error'].get('field') == 'supplier_id', f'{s} {r}')
    if bad_sup:
        s, r = adm.call('POST', F, {**OK, 'supplier_id': bad_sup['id']})
        check('proveedor suspendido o inactivo: 422 SUPPLIER_NOT_INVITABLE', s == 422 and r['error']['code'] == 'SUPPLIER_NOT_INVITABLE', f'{s} {r}')
    s, r = adm.call('POST', F, {**OK, 'contact_id': ZERO})
    check('contacto sin usuario Comprador/Master Admin activo: 422 CONTACT_UNAVAILABLE', s == 422 and r['error']['code'] == 'CONTACT_UNAVAILABLE' and r['error'].get('field') == 'contact_id', f'{s} {r}')
    s, r = adm.call('POST', F, {**OK, 'currency': 'XYZ'})
    check('moneda fuera del catálogo: 422 CURRENCY_UNAVAILABLE', s == 422 and r['error']['code'] == 'CURRENCY_UNAVAILABLE', f'{s} {r}')
    s, r = adm.call('POST', F, {**OK, 'items': [pick[0], ZERO]})
    check('partida que no es de la requisición: 409 LINES_CHANGED', s == 409 and r['error']['code'] == 'LINES_CHANGED', f'{s} {r}')

    key = str(uuid.uuid4())
    s, a = adm.call('POST', F, OK, key=key)
    check('alta en Borrador: 201 con folio RFQ-AAAA-NNNN (año de emisión), 2 partidas, versión 1', s == 201 and re.fullmatch(rf'RFQ-{TODAY.year}-\d{{4,}}', a.get('folio', '')) and a.get('status') == 'borrador'
          and a.get('status_label') == 'Borrador' and a.get('items') == 2 and a.get('version') == 1 and a.get('supplier_name') == sups[0]['name'], f'{s} {a}')
    s2, a2 = adm.call('POST', F, OK, key=key)
    check('reintento con la misma clave: 200 sin duplicar', s2 == 200 and a2.get('replayed') is True and a2.get('folio') == a.get('folio'))
    check('misma clave con otro contenido: 409', adm.call('POST', F, {**OK, 'status': 'sent'}, key=key)[0] == 409)
    s3, b2 = adm.call('POST', F, {**OK, 'supplier_id': sups[1]['id'], 'status': 'sent', 'items': [i['id'] for i in items]})
    n1 = int(a['folio'].rsplit('-', 1)[1]); n2 = int(b2.get('folio', 'x-0').rsplit('-', 1)[1])
    check('segunda RFQ (otro proveedor, Enviada, 3 partidas): folio consecutivo', s3 == 201 and n2 == n1 + 1 and b2.get('status') == 'enviada' and b2.get('items') == 3, f'{a["folio"]} → {b2}')

    d = adm.get(f"{F}/{a['id']}"); it = d['item']
    check('detalle: Borrador, versión 1, no importada, contacto, fechas y condiciones', it.get('status') == 'borrador' and it.get('legacy_status') == 'Borrador' and it.get('version') == 1 and it.get('imported') is False
          and it.get('contact_name') == contact['name'] and it.get('deadline') == OK['deadline'] and it.get('terms_text') == OK['conditions'] and it.get('delivery_place') == OK['delivery_place'], json.dumps(it, ensure_ascii=False)[:400])
    check('partidas 1..n en el orden de la requisición (sin precios)', [(int(x['line_number']), x['description'], float(x['quantity'])) for x in d['items']]
          == [(1, items[0]['description'], float(items[0]['quantity'])), (2, items[2]['description'], float(items[2]['quantity']))] and not any('price' in k for x in d['items'] for k in x), json.dumps(d['items'], ensure_ascii=False)[:300])
    det2 = adm.get(f'{B}/rfq-requisitions/{rid}')
    sent_to = {i['id']: [x['rfq'] for x in i['sent_to']] for i in det2['items']}
    check('requisición: cada partida muestra a qué RFQ se envió', a['folio'] in sent_to[items[0]['id']] and a['folio'] not in sent_to[items[1]['id']] and b2['folio'] in sent_to[items[1]['id']]
          and {x['folio'] for x in det2['rfqs']} >= {a['folio'], b2['folio']}, json.dumps(sent_to))
    row = next((x for x in adm.get(f"{F}?q={a['folio']}&page=1&page_size=10")['items'] if x['folio'] == a['folio']), {})
    check('matriz de RFQ: fila con estatus, versión, contacto y sin respuesta', row.get('status') == 'borrador' and row.get('version') == 1 and row.get('imported') is False and row.get('responded') is False
          and row.get('contact_key') == contact['id'], json.dumps(row, ensure_ascii=False)[:300])

    # Cotización contra borrador (no enviada) → bloqueada; marcar enviada; luego sí se registra.
    qlines = [{'line_number': int(x['line_number']), 'offered': True, 'qty': str(int(float(x['quantity']))), 'price': '2.5'} for x in d['items']]
    QB = {'rfq_id': a['id'], 'supplier_reference': f'PROV-{RUN}', 'quote_date': TODAY.isoformat(), 'valid_until': None, 'vat': '16', 'currency': 'MXN', 'lead_days': '3', 'payment': 'PUE',
          'technical': '100', 'documentation': '100', 'notes': '', 'lines': qlines, 'document': None}
    s, r = adm.call('POST', f'{B}/supplier-quotes', QB)
    check('cotización contra una RFQ en Borrador: 409 RFQ_NOT_SENT', s == 409 and r['error']['code'] == 'RFQ_NOT_SENT', f'{s} {r}')
    M = f"{F}/{a['id']}/mark-sent"
    check('marcar enviada sin If-Match: 428', adm.call('POST', M, {})[0] == 428)
    check('marcar enviada con versión vencida: 412', adm.call('POST', M, {}, ifm=9)[0] == 412)
    check('marcar enviada con cuerpo no vacío: 422', adm.call('POST', M, {'date': '2026-01-01'}, ifm=1)[0] == 422)
    check('marcar enviada RFQ inexistente: 404', adm.call('POST', f'{F}/{ZERO}/mark-sent', {}, ifm=1)[0] == 404)
    k2 = str(uuid.uuid4())
    s, m = adm.call('POST', M, {}, key=k2, ifm=1)
    check('marcar enviada: 200, Enviada, versión 2', s == 200 and m.get('status') == 'enviada' and m.get('version') == 2, f'{s} {m}')
    s, m2 = adm.call('POST', M, {}, key=k2, ifm=1)
    check('marcar enviada: reintento con la misma clave sin repetir', s == 200 and m2.get('replayed') is True)
    s, r = adm.call('POST', M, {}, ifm=2)
    check('marcar enviada otra vez: 409 RFQ_NOT_DRAFT', s == 409 and r['error']['code'] == 'RFQ_NOT_DRAFT', f'{s} {r}')
    check('detalle tras marcar: Enviada, versión 2', (lambda x: x['status'] == 'enviada' and x['legacy_status'] == 'Enviada' and x['version'] == 2)(adm.get(f"{F}/{a['id']}")['item']))
    s, q = adm.call('POST', f'{B}/supplier-quotes', QB)
    check('flujo completo: la RFQ enviada recibe su cotización (201 COT)', s == 201 and re.fullmatch(r'COT-\d{4}-\d{4,}', q.get('folio', '')) and q.get('rfq') == a['folio'], f'{s} {q}')
    row2 = next((x for x in adm.get(f"{F}?q={a['folio']}&page=1&page_size=10")['items'] if x['folio'] == a['folio']), {})
    check('matriz de RFQ: ahora respondida con el folio de la cotización', row2.get('responded') is True and row2.get('quote_folio') == q.get('folio'), json.dumps(row2, ensure_ascii=False)[:200])
    imp = next((x for x in adm.get(f'{F}?page=1&page_size=50')['items'] if x.get('imported') and x['status'] in ('borrador', 'draft')), None)
    if imp:
        s, r = adm.call('POST', f"{F}/{imp['id']}/mark-sent", {}, ifm=imp['version'])
        check('RFQ importada en borrador: 409 IMPORTED_READ_ONLY (se conserva)', s == 409 and r['error']['code'] == 'IMPORTED_READ_ONLY', f'{s} {r}')
    check('sin rutas para editar partidas ni eliminar RFQ (≠ 2xx)', all(not 200 <= adm.call(mth, p, {})[0] < 300 for mth, p in [('PUT', f"{F}/{a['id']}"), ('DELETE', f"{F}/{a['id']}"), ('POST', f"{F}/{a['id']}/items"), ('POST', f"{F}/{a['id']}/send")]))
    log = adm.get('/api/v1/audit-events?module=quotes&page_size=50')['items']
    acts = {x['action'] for x in log if a['folio'] in json.dumps(x, ensure_ascii=False) or b2.get('folio', '-') in json.dumps(x, ensure_ascii=False)}
    check('bitácora: rfq.create y rfq.mark_sent', {'rfq.create', 'rfq.mark_sent'} <= acts, str(acts))
    print(f"RFQ sintéticas: {a['folio']} (Borrador → Enviada), {b2.get('folio')} (Enviada) · cotización {q.get('folio')}")
finally:
    adm.logout()

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCotizaciones · registro de RFQ (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
