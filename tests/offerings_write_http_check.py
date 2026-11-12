#!/usr/bin/env python3
"""Suministros de proveedores · contrato HTTP de alta/actualización (POST/PUT /api/v1/catalogs/supplier-offerings).
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (crea dos proveedores QA-SINT-OS-* y sus suministros "QA-SINT-S-*",
y reescribe sin cambios un suministro sintético con valor histórico). Exige SF_SYNTHETIC_WRITES=1.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/offerings_write_http_check.py
"""
import base64, http.cookiejar, json, os, re, struct, sys, urllib.error, urllib.request, uuid, zlib
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
R = '/api/v1/catalogs/supplier-offerings'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper()

def png(w, h, rgb=(16, 185, 129)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
data_url = lambda b: 'data:image/png;base64,' + base64.b64encode(b).decode()

class S:
    def __init__(self, email=None):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); self.csrf = ''
        if email:
            self.csrf = json.loads(self.op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
            self.op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': self.csrf}))
            self.csrf = json.loads(self.op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
    def call(self, method, path, body=None, headers=None, raw=False):
        h = {'Content-Type': 'application/json', 'X-SF-CSRF': self.csrf}; h.update(headers or {})
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        try:
            r = self.op.open(urllib.request.Request(API + path, data=data, method=method, headers=h)); b = r.read()
            return r.status, (b if raw else json.loads(b or b'{}')), dict(r.headers)
        except urllib.error.HTTPError as e:
            b = e.read()
            try: return e.code, json.loads(b or b'{}'), dict(e.headers)
            except Exception: return e.code, {}, dict(e.headers)
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {})
        except Exception: pass

key = lambda: {'Idempotency-Key': str(uuid.uuid4())}
a = S(USER)
# Proveedores sintéticos propios de esta corrida (no se alteran los proveedores de referencia de otras pruebas)
def new_supplier(suffix):
    st, js, _ = a.call('POST', '/api/v1/catalogs/suppliers', {'code': f'QA-SINT-OS-{RUN}-{suffix}', 'name': f'Proveedor de suministros QA {RUN}-{suffix}', 'category': 'Materiales', 'status': 'authorized'}, {'Idempotency-Key': str(uuid.uuid4())})
    if st != 201: print('BLOCKED: no se pudo crear el proveedor sintético', st, js); sys.exit(2)
    return js['id']
sup, sup2 = new_supplier('A'), new_supplier('B')
def body(name, **kw):
    b = {'supplier_id': sup, 'name': name, 'type': 'product', 'category': 'Materiales', 'brand': 'MarcaQA', 'model': 'MOD-1', 'description': 'Placa de acero sintética',
         'lead_time_value': 5, 'lead_time_unit': 'días hábiles', 'credit_type': 'Crédito', 'credit_days': 30, 'currency': 'MXN', 'minimum_order': '10 piezas',
         'valid_until': '2027-06-30', 'coverage': 'Nacional', 'status': 'active', 'notes': 'Alta sintética'}
    b.update(kw); return b
anon = S()
check('sin sesión: POST 401', anon.call('POST', R, body('X'), key())[0] == 401)
if NONADMIN:
    o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', R, body('X'), key())[0] == 403); o.logout()
try:
    name = f'QA-SINT-S-{RUN} Placa'
    check('sin CSRF: 403', a.call('POST', R, body(name), {**key(), 'X-SF-CSRF': '0' * 64})[0] == 403)
    check('sin Idempotency-Key: 422', a.call('POST', R, body(name))[0] == 422)
    for label, b in [('nombre vacío', body('')), ('proveedor inválido', body(name, supplier_id='abc')), ('proveedor inexistente', body(name, supplier_id='00000000-0000-4000-8000-000000000000')),
                     ('precio (catálogo sin precios)', {**body(name), 'unit_price': 10}), ('estatus fuera de catálogo', body(name, status='deleted')), ('crédito fuera de catálogo', body(name, credit_type='Trueque')),
                     ('unidad fuera de catálogo', body(name, lead_time_unit='quincenas')), ('moneda fuera de catálogo', body(name, currency='JPY')), ('fecha inválida', body(name, valid_until='2027-02-30')),
                     ('días negativos', body(name, credit_days=-1))]:
        st, js, _ = a.call('POST', R, b, key()); check(f'422 {label}', st == 422, f'{st} {js}')
    k1 = key(); st, c1, _ = a.call('POST', R, body(name), k1)
    check('alta: 201 con id y versión', st == 201 and c1.get('version', 0) > 1, f'{st} {c1}')
    st, rep, _ = a.call('POST', R, body(name), k1)
    check('idempotencia: replay 200, mismo id', st == 200 and rep.get('id') == c1.get('id') and rep.get('replayed') is True)
    check('mismo nombre en el mismo proveedor → 409 DUPLICATE_OFFERING', a.call('POST', R, body(name), key())[1].get('error', {}).get('code') == 'DUPLICATE_OFFERING')
    check('mismo nombre en otro proveedor sí se permite', a.call('POST', R, body(name, supplier_id=sup2), key())[0] == 201)
    st, d, _ = a.call('GET', f'{R}/{c1["id"]}')
    it = d.get('item', {})
    check('detalle refleja el alta (sin precios)', st == 200 and it.get('name') == name and it.get('supplier_id') == sup and it.get('type') == 'product' and it.get('category') == 'Materiales' and it.get('version') == c1['version'] and not any('price' in k for k in it), json.dumps(it)[:300])
    check('condiciones guardadas', it.get('credit_type') == 'Crédito' and it.get('credit_days') == 30 and float(it.get('lead_time_value')) == 5 and it.get('lead_time_unit') == 'días hábiles' and it.get('currency') == 'MXN' and it.get('minimum_order') == '10 piezas' and it.get('valid_until') == '2027-06-30' and it.get('coverage') == 'Nacional')
    check('detalle con parámetros → 404; UUID inexistente → 404', a.call('GET', f'{R}/{c1["id"]}?x=1')[0] == 404 and a.call('GET', f'{R}/00000000-0000-4000-8000-000000000000')[0] == 404)
    upd = body(name + ' (edit)', type='Grúa sobre camión', category='Renta de equipo', status='unavailable', credit_type='Otros', lead_time_unit='semanas', currency='', valid_until=None, credit_days=None)
    check('PUT sin If-Match → 428', a.call('PUT', f'{R}/{c1["id"]}', upd, key())[0] == 428)
    k2 = key(); st, u1, _ = a.call('PUT', f'{R}/{c1["id"]}', upd, {**k2, 'If-Match': f'"{c1["version"]}"'})
    check('actualización: 200 con versión nueva mayor', st == 200 and u1.get('version', 0) > c1['version'] and {'name', 'offering_type', 'status_code'} <= set(u1.get('changed', [])), f'{st} {u1}')
    check('replay de la actualización', a.call('PUT', f'{R}/{c1["id"]}', upd, {**k2, 'If-Match': f'"{c1["version"]}"'})[1].get('replayed') is True)
    check('versión vieja → 412', a.call('PUT', f'{R}/{c1["id"]}', upd, {**key(), 'If-Match': f'"{c1["version"]}"'})[0] == 412)
    it = a.call('GET', f'{R}/{c1["id"]}')[1]['item']
    check('tipo nuevo (texto libre), categoría nueva como texto, estatus y crédito', it['type'] == 'Grúa sobre camión' and it['category'] == 'Renta de equipo' and it['status'] == 'unavailable' and it['credit_type'] == 'Otros' and it['currency'] is None and it['valid_until'] is None)
    check('la versión del detalle coincide con la respuesta', it['version'] == u1['version'])
    lst = a.call('GET', f'{R}?q=QA-SINT-S-{RUN}&page_size=10')[1]
    check('la matriz encuentra los suministros con su versión', lst.get('total') == 2 and all(isinstance(x.get('version'), int) for x in lst['items']))
    # Suministro sintético con tipo histórico textual ("Servicio") y sin updated_at: reescritura sin cambios conserva el valor
    hist = [x for x in a.call('GET', f'{R}?page_size=50')[1]['items'] if x.get('type') == 'Servicio']
    if hist:
        h = hist[0]
        same = {k: h.get(k) for k in ('supplier_id', 'name', 'type', 'category', 'brand', 'model', 'description', 'lead_time_unit', 'credit_type', 'currency', 'minimum_order', 'valid_until', 'coverage', 'status', 'notes')}
        same = {k: ('' if v is None and k not in ('valid_until',) else v) for k, v in same.items()}
        same['lead_time_value'] = None if h.get('lead_time_value') is None else float(h['lead_time_value']); same['credit_days'] = h.get('credit_days')
        st, u, _ = a.call('PUT', f'{R}/{h["id"]}', same, {**key(), 'If-Match': f'"{h["version"]}"'})
        after = a.call('GET', f'{R}/{h["id"]}')[1]['item']
        check('valor histórico ("Servicio") se conserva al guardar sin cambios', st == 200 and after['type'] == 'Servicio' and after['version'] > h['version'], f'{st} {u}')
    au = a.call('GET', '/api/v1/audit-events?module=catalogs&page_size=50')[1]
    acts = [e.get('action') or e.get('action_code') for e in au.get('items', [])]
    check('bitácora: offering.create y offering.update', 'offering.create' in acts and 'offering.update' in acts, str(acts[:8]))
finally:
    a.logout()
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nSuministros · escritura (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
