#!/usr/bin/env python3
"""Requisición › Crear desde historial · contrato HTTP de POST /api/v1/recovery/requisitions/from-history.
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (crea requisiciones nuevas del primer cliente activo con
historial aprobado; las requisiciones no se pueden eliminar). Exige SF_SYNTHETIC_WRITES=1.
Verifica 401/403/CSRF/415/422, idempotencia (reintento y conflicto de clave), historial cambiado (409), ruta no permitida (409),
categoría inactiva (409), folio asignado por el servidor, origen y ruta por partida (precio fijo con el precio aprobado, no el del
navegador), etapa normal en la Matriz, que la requisición y la cotización de origen no cambian, que Registro no cambia el cliente
ni el origen de una requisición desde historial, Control de cambios (R3A del solicitante, sin autoaprobación, R3B de otro
Master Admin → Rev. 1 con la ruta conservada; SF_REVIEWER_USER, por omisión qa.admin.b), bitácora y que no se exponen identificadores internos.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/requisition_history_write_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
P = '/api/v1/recovery/requisitions/from-history'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper()

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
            return e.code, json.loads(e.read() or b'{}')
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {}, key=None)
        except Exception: pass

adm = S(USER)
cat = adm.get('/api/v1/recovery/catalogs')
active = [c['name'] for c in cat['categories'] if c['active']]
client = hist = None
for c in cat['clients']:
    if c['status'] != 'active': continue
    d = adm.get(f"/api/v1/requisition-history/catalog?client={c['id']}")
    if any(a['last'].get('unit_price') and a['unit'] and a['category'] in active for a in d['items']): client, hist = c, d; break
if not client:
    print('BLOCKED: la base sintética no tiene un cliente activo con historial aprobado utilizable.'); sys.exit(2)
arts = hist['items']
fixable = next(a for a in arts if a['last'].get('unit_price') and a['unit'] and a['category'] in active)
nosup = next((a for a in arts if not a['last'].get('supplier') and a['unit'] and a['category'] in active), None)
def hline(a, price='validate', sourcing='requote', qty='3'):
    return {'origin': 'history', 'article_key': a['key'], 'quote_version_id': a['last']['quote_version_id'], 'quantity': qty, 'price_mode': price, 'sourcing_mode': sourcing}
NEW = {'origin': 'new', 'description': f'Partida nueva sintética {RUN}', 'quantity': '2.5', 'unit': 'servicio', 'category': active[0], 'price_mode': 'requote', 'sourcing_mode': 'requote'}
def body(items, **kw):
    b = {'client_id': client['id'], 'request_date': '2026-11-25', 'need_date': '2026-12-10', 'project': client.get('project') or f'Proyecto QA {RUN}',
         'contract': client.get('contract') or 'Contrato QA', 'client_reference': f'REF-HIST-{RUN}', 'priority': 'high', 'delivery_place': 'Almacén sintético QA',
         'requester_name': 'Solicitante Sintético', 'requester_email': 'solicitante@supplyflow.invalid', 'budget': '', 'currency': 'MXN',
         'description': 'Recompra / nueva solicitud construida desde historial', 'items': items}
    b.update(kw); return b
sup_ok = bool(fixable['last'].get('supplier')) and (fixable['last'].get('cost') or 0) > 0
GOOD = body([hline(fixable, 'fixed', 'reuse' if sup_ok else 'requote'), NEW])

try:
    anon = S()
    check('sin sesión: 401', anon.call('POST', P, GOOD, csrf=False)[0] == 401)
    if NONADMIN:
        o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', P, GOOD)[0] == 403); o.logout()
    check('sin CSRF: 403', adm.call('POST', P, GOOD, csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('POST', P, b'x=1', ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('POST', P, GOOD, key=None)[0] == 422)
    bad = [body([]), body([hline(fixable)], folio='X-1'), body([{**hline(fixable), 'origin': 'otro'}]), body([{**hline(fixable), 'article_key': 'zz'}]),
           body([hline(fixable), hline(fixable)]), body([{**NEW, 'price_mode': 'fixed'}]), body([{**hline(fixable), 'price_mode': 'gratis'}]),
           body([{**hline(fixable), 'description': 'otra'}]), body([hline(fixable, qty='0')]), body([hline(fixable)], requester_email='no-es-correo'),
           body([hline(fixable)], need_date='2026-11-01'), body([hline(fixable)], currency='JPY'), ['lista']]
    got = [adm.call('POST', P, b) for b in bad]
    check('cuerpo inválido: 422 INVALID_REQUISITION', all(s == 422 and r.get('error', {}).get('code') == 'INVALID_REQUISITION' for s, r in got), str([(s, r.get('error', {}).get('message')) for s, r in got if s != 422]))
    s, r = adm.call('POST', P, body([{**hline(fixable), 'quote_version_id': str(uuid.uuid4())}]))
    check('cotización de referencia distinta: 409 HISTORY_CHANGED', s == 409 and r['error']['code'] == 'HISTORY_CHANGED', f'{s} {r}')
    s, r = adm.call('POST', P, body([{**hline(fixable), 'article_key': 'f' * 16}]))
    check('artículo inexistente en el historial: 409 HISTORY_CHANGED', s == 409 and r['error']['code'] == 'HISTORY_CHANGED', f'{s} {r}')
    if nosup:
        s, r = adm.call('POST', P, body([hline(nosup, 'validate', 'reuse')]))
        check('reutilizar proveedor sin proveedor histórico: 409 ROUTE_NOT_ALLOWED', s == 409 and r['error']['code'] == 'ROUTE_NOT_ALLOWED' and 'proveedor' in r['error']['message'], f'{s} {r}')
    inactive = next((c['name'] for c in cat['categories'] if not c['active']), None)
    if inactive:
        s, r = adm.call('POST', P, body([{**NEW, 'category': inactive}]))
        check('categoría inactiva: 409 CATEGORY_UNKNOWN', s == 409 and r['error']['code'] == 'CATEGORY_UNKNOWN', f'{s} {r}')
    src_before = adm.get(f"/api/v1/recovery/requisitions/{fixable['last']['requisition_id']}")
    rows_before = adm.get('/api/v1/recovery/matrix')['total']

    key = str(uuid.uuid4())
    s, out = adm.call('POST', P, GOOD, key=key)
    check('alta: 201 con folio asignado por el servidor y versión 1', s == 201 and re.fullmatch(r'[A-Z0-9-]+-\d{4}-\d{4}', out.get('folio', '')) and out.get('version') == 1
          and out.get('line_count') == 2 and out.get('history_lines') == 1 and out.get('new_lines') == 1 and out.get('fixed_price_lines') == 1 and out.get('replayed') is False, f'{s} {out}')
    s2, out2 = adm.call('POST', P, GOOD, key=key)
    check('reintento con la misma clave: 200 sin duplicar', s2 == 200 and out2.get('replayed') is True and out2.get('id') == out.get('id') and out2.get('folio') == out.get('folio'), f'{s2} {out2}')
    check('misma clave con otro contenido: 409 IDEMPOTENCY_CONFLICT', adm.call('POST', P, body([hline(fixable, 'validate', 'requote')]), key=key)[1].get('error', {}).get('code') == 'IDEMPOTENCY_CONFLICT')
    mx = adm.get('/api/v1/recovery/matrix')
    row = next((x for x in mx['items'] if x['id'] == out.get('id')), {})
    check('matriz: una sola requisición nueva, desde historial, etapa «Requisición recibida» y editable', mx['total'] == rows_before + 1 and row.get('history_based') == 1 and row.get('stage_index') == 0
          and row.get('editable') is True and row.get('is_provisional') is False, json.dumps({k: row.get(k) for k in ('history_based', 'stage_index', 'editable', 'is_provisional', 'regularization_status')}))
    det = adm.get(f"/api/v1/recovery/requisitions/{out.get('id')}")
    it = det['items']; hl = (det.get('history') or {}).get('lines', [])
    desc = fixable['description'] + (f"\nMarca / modelo: {fixable['brand_model']}" if fixable.get('brand_model') else '')
    check('partida del historial: descripción, marca, unidad y categoría del historial aprobado', len(it) == 2 and it[0]['description'] == desc and it[0]['unit'] == fixable['unit'] and it[0]['category'] == fixable['category'] and float(it[0]['quantity']) == 3, json.dumps(it[0], ensure_ascii=False))
    check('partida nueva: tal como se capturó', it[1]['description'] == NEW['description'] and it[1]['unit'] == 'servicio' and float(it[1]['quantity']) == 2.5)
    h0, h1 = (hl + [{}, {}])[:2]
    check('ruta de la partida del historial: precio fijo con el precio aprobado y su cotización de origen', h0.get('history_based') is True and h0.get('origin') == 'approved_customer_quote' and h0.get('price_mode') == 'fixed'
          and h0.get('sourcing_mode') == ('reuse' if sup_ok else 'requote') and h0.get('fixed_client_price') is True and abs(float(h0.get('fixed_client_unit_price') or 0) - float(fixable['last']['unit_price'])) < 1e-6
          and h0.get('fixed_client_currency') == fixable['last']['currency'] and h0.get('source_quote_folio') == fixable['last']['quote_folio'] and h0.get('source_requisition_folio') == fixable['last']['requisition_folio'], json.dumps(h0, ensure_ascii=False))
    check('ruta de la partida nueva: recotizar precio y proveedor', h1.get('history_based') is False and h1.get('origin') == 'new_line' and h1.get('price_mode') == 'requote' and h1.get('sourcing_mode') == 'requote' and h1.get('fixed_client_price') is False)
    pol = (det.get('history') or {}).get('policy') or {}
    check('política del cliente evaluada al crear (snapshot)', pol.get('evaluated_on') and pol.get('policy', {}).get('sales_policy') == hist['client']['policy']['sales_policy'], json.dumps(pol, ensure_ascii=False)[:200])
    check('origen: historial, no provisional y sin regularización', det.get('request_source_type') == 'Historial del cliente (recompra)' and det.get('is_provisional') in (0, False) and det.get('regularization_status') == 'No aplica · desde historial')
    check('sin identificadores internos', not re.search(r'"(db_id|organization_id|source_requisition_id|source_customer_quote_version_id|category_id)"\s*:', json.dumps(det)))
    src_after = adm.get(f"/api/v1/recovery/requisitions/{fixable['last']['requisition_id']}")
    check('la requisición de origen no cambia', src_before['version'] == src_after['version'] and src_before['line_count'] == src_after['line_count'] and src_before['items'] == src_after['items'])
    hist2 = adm.get(f"/api/v1/requisition-history/catalog?client={client['id']}")
    check('el catálogo histórico no cambia (la nueva requisición no tiene cotización aprobada)', hist2['totals'] == hist['totals'])

    cand = adm.get(f"/api/v1/requisition-changes/candidates?scope=eligible&q={out['folio']}")
    check('elegible para Control de cambios (SOLICITAR MODIFICACIÓN)', any(x.get('folio') == out['folio'] for x in cand.get('items', [])), json.dumps(cand)[:300])
    # Registro (RF1) sobre una requisición desde historial: el cliente y el origen documental se conservan.
    other = next((c for c in cat['clients'] if c['status'] == 'active' and c['id'] != client['id']), None)
    rf1 = {'folio': det['folio'], 'client_id': client['id'], 'request_date': det['request_date'], 'need_date': '2026-12-15', 'project': det['project'], 'contract': det['contract'],
           'client_reference': det['client_reference'], 'priority': det['priority'], 'delivery_place': det['delivery_place'], 'requester_name': det['requester_name'],
           'requester_email': det['requester_email'], 'budget': det['budget'], 'currency': det['currency'], 'description': det['description'], 'notes': det['notes'],
           'source': {'type': 'Correo del cliente', 'date': det['request_date'], 'reference': 'correo QA', 'notes': None, 'requirement': 'formal', 'due_date': '2026-12-01', 'owner': None},
           'items': [{'id': x['id'], 'description': x['description'], 'quantity': x['quantity'], 'unit': x['unit'], 'category': x['category']} for x in it], 'document': None}
    if other:
        s, r = adm.call('PUT', f"/api/v1/recovery/requisitions/{out['id']}", {**rf1, 'client_id': other['id']}, ifm=det['version'])
        check('Registro: cambiar el cliente de una requisición desde historial → 409 HISTORY_CLIENT_LOCKED', s == 409 and r['error']['code'] == 'HISTORY_CLIENT_LOCKED', f'{s} {r}')
    s, r = adm.call('PUT', f"/api/v1/recovery/requisitions/{out['id']}", rf1, ifm=det['version'])
    det2 = adm.get(f"/api/v1/recovery/requisitions/{out['id']}")
    check('Registro: edita datos generales y conserva origen, no provisional y rutas por partida', s == 200 and det2['need_date'] == '2026-12-15' and det2['request_source_type'] == 'Historial del cliente (recompra)'
          and det2['is_provisional'] in (0, False) and det2['history_based'] == 1 and (det2.get('history') or {}).get('lines', [{}])[0].get('price_mode') == 'fixed', f'{s} {r} {det2.get("request_source_type")}')

    # Control de cambios sobre la requisición desde historial: R3A (solicitante) → R3B (otro Master Admin) → Rev. 1 con la ruta conservada.
    REVIEWER = os.environ.get('SF_REVIEWER_USER', 'qa.admin.b@supplyflow.invalid')
    s0, out2 = adm.call('POST', P, body([hline(fixable, 'fixed', 'requote')], client_reference=f'REF-HIST-CC-{RUN}'))
    cur = adm.get(f"/api/v1/recovery/requisitions/{out2.get('id')}")
    s, cr = adm.call('POST', f"/api/v1/recovery/requisitions/{out2.get('id')}/changes", {'date': '2026-11-25', 'requested_by': 'Cliente QA', 'source': 'Correo del cliente', 'change_type': 'Cambio de cantidad',
        'reference': f'CC-HIST-{RUN}', 'reason': 'El cliente pide más piezas (sintético).', 'header': {},
        'items': [{'action': 'modify', 'id': cur['items'][0]['id'], 'description': cur['items'][0]['description'], 'quantity': '7', 'unit': cur['items'][0]['unit'], 'category': cur['items'][0]['category']}]}, ifm=cur['version'])
    check('Control de cambios: solicitud R3A sobre la requisición desde historial (201)', s == 201 and cr.get('id'), f'{s} {cr}')
    if s == 201:
        rev = S(REVIEWER)
        imp = rev.get(f"/api/v1/recovery/changes/{cr['id']}/impact")  # vista del revisor (el solicitante recibe 404)
        dec = {'decision': 'approve', 'reason': 'Revisión independiente (sintético).', 'requisition_version': imp['requisition_version'], 'acknowledge_scope': True}
        s, r = adm.call('POST', f"/api/v1/recovery/changes/{cr['id']}/decision", dec, ifm=imp['change_version'])
        check('el solicitante no puede autoaprobar (409)', s == 409, f'{s} {r}')
        s, r = rev.call('POST', f"/api/v1/recovery/changes/{cr['id']}/decision", dec, ifm=imp['change_version']); rev.logout()
        fin = adm.get(f"/api/v1/recovery/requisitions/{out2['id']}")
        h0f = ((fin.get('history') or {}).get('lines') or [{}])[0]
        check('otro Master Admin aprueba: Rev. 1 con la cantidad nueva y la ruta de historial conservada', s == 200 and int(fin['current_revision_number']) == 1 and float(fin['items'][0]['quantity']) == 7
              and h0f.get('price_mode') == 'fixed' and h0f.get('fixed_client_price') is True, f'{s} {r} rev={fin.get("current_revision_number")}')
    # Limitación vigente del contrato R3B (aprobado en INT02): si la requisición se editó en Registro, su snapshot RF1 ocupa el
    # número Rev. 1 y R3B responde SNAPSHOT_NUMBER_OCCUPIED (conciliación R2/R3 pendiente). Se documenta para detectar si cambia.
    cur = adm.get(f"/api/v1/recovery/requisitions/{out['id']}")
    s, cr3 = adm.call('POST', f"/api/v1/recovery/requisitions/{out['id']}/changes", {'date': '2026-11-25', 'requested_by': 'Cliente QA', 'source': 'Correo del cliente', 'change_type': 'Cambio de cantidad',
        'reference': f'CC-HIST-ED-{RUN}', 'reason': 'Cambio tras edición en Registro (sintético).', 'header': {},
        'items': [{'action': 'modify', 'id': cur['items'][0]['id'], 'description': cur['items'][0]['description'], 'quantity': '9', 'unit': cur['items'][0]['unit'], 'category': cur['items'][0]['category']}]}, ifm=cur['version'])
    if s == 201:
        rev = S(REVIEWER); imp = rev.get(f"/api/v1/recovery/changes/{cr3['id']}/impact")
        s, r = rev.call('POST', f"/api/v1/recovery/changes/{cr3['id']}/decision", {'decision': 'approve', 'reason': 'Revisión (sintético).', 'requisition_version': imp['requisition_version'], 'acknowledge_scope': True}, ifm=imp['change_version']); rev.logout()
        check('limitación vigente: editada en Registro → R3B 409 SNAPSHOT_NUMBER_OCCUPIED y el revisor lo ve antes de decidir', s == 409 and r.get('error', {}).get('code') == 'SNAPSHOT_NUMBER_OCCUPIED' and imp.get('snapshot_number_occupied') is True, f'{s} {r} {imp.get("snapshot_number_occupied")}')
    log = adm.get('/api/v1/audit-events?module=requisitions&page_size=50')['items']
    check('bitácora: requisition.history.create', any(x['action'] == 'requisition.history.create' and out['folio'] in json.dumps(x, ensure_ascii=False) for x in log))
    check('sin rutas de baja (DELETE ≠ 2xx)', not 200 <= adm.call('DELETE', f"/api/v1/recovery/requisitions/{out['id']}")[0] < 300)
    print(f"Requisición creada (sintética): {out.get('folio')}")
finally:
    adm.logout()

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCrear desde historial · escritura (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
