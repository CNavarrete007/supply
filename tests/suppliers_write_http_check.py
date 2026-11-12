#!/usr/bin/env python3
"""Proveedores · contrato HTTP de alta/actualización (POST/PUT /api/v1/catalogs/suppliers) y logotipo privado.
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (crea proveedores QA-SINT-P-* y reescribe sin cambios al
proveedor sintético PRV-QA-04 para comprobar que un valor histórico se conserva). Exige SF_SYNTHETIC_WRITES=1.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/suppliers_write_http_check.py
"""
import base64, http.cookiejar, json, os, re, struct, sys, urllib.error, urllib.request, uuid, zlib
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
R = '/api/v1/catalogs/suppliers'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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

def body(code, **kw):
    b = {'code': code, 'name': f'Proveedor Sintético {code}', 'tax_id': 'XAXX010101000', 'supplier_key': f'CLAVE-{code}', 'contacts': ['Rosa QA', 'Iván QA'],
         'emails': ['rosa@prov.invalid'], 'phones': ['81-1000-2000', '81-3000-4000'], 'category': 'Materiales', 'status': 'under_evaluation', 'currency': 'USD',
         'credit_type': 'Crédito', 'credit_days': 30, 'lead_time_value': 5, 'lead_time_unit': 'días hábiles', 'rating': 80, 'document_notes': 'ISO 9001 vigente', 'notes': 'Alta sintética'}
    b.update(kw); return b
key = lambda: {'Idempotency-Key': str(uuid.uuid4())}

anon = S()
check('sin sesión: POST 401', anon.call('POST', R, body('QA-SINT-P-X'), key())[0] == 401)
if NONADMIN:
    o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', R, body('QA-SINT-P-X'), key())[0] == 403); o.logout()
a = S(USER)
try:
    code = f'QA-SINT-P-{RUN}'
    check('sin CSRF: 403', a.call('POST', R, body(code), {**key(), 'X-SF-CSRF': '0' * 64})[0] == 403)
    check('sin Idempotency-Key: 422', a.call('POST', R, body(code))[0] == 422)
    for name, b in [('número vacío', body('')), ('razón social vacía', body(code, name='')), ('categoría obligatoria', body(code, category='')),
                    ('estatus fuera de catálogo', body(code, status='deleted')), ('moneda fuera de catálogo', body(code, currency='JPY')), ('crédito fuera de catálogo', body(code, credit_type='Trueque')),
                    ('unidad fuera de catálogo', body(code, lead_time_unit='quincenas')), ('días de crédito negativos', body(code, credit_days=-1)), ('calificación > 100', body(code, rating=150)),
                    ('teléfono inválido', body(code, phones=['llámame'])), ('correo inválido', body(code, emails=['x'])), ('campo extra', {**body(code), 'portal': True}),
                    ('logo HTML disfrazado', body(code, logo={'data': data_url(b'<html></html>'), 'name': 'x.png'}))]:
        st, js, _ = a.call('POST', R, b, key()); check(f'422 {name}', st == 422, f'{st} {js}')
    k1 = key(); logo1 = png(48, 24)
    st, c1, _ = a.call('POST', R, body(code, logo={'data': data_url(logo1), 'name': 'logo prov.png'}), k1)
    check('alta: 201 con id y versión 1', st == 201 and c1.get('version') == 1, f'{st} {c1}')
    st, rep, _ = a.call('POST', R, body(code, logo={'data': data_url(logo1), 'name': 'logo prov.png'}), k1)
    check('idempotencia: replay 200, mismo id', st == 200 and rep.get('id') == c1.get('id') and rep.get('replayed') is True, f'{st} {rep}')
    check('número duplicado → 409 CODE_TAKEN', a.call('POST', R, body(code), key())[1].get('error', {}).get('code') == 'CODE_TAKEN')
    it = a.call('GET', f'{R}/{c1["id"]}')[1].get('item', {})
    check('detalle refleja el alta', it.get('code') == code and it.get('supplier_key') == f'CLAVE-{code}' and it.get('status') == 'under_evaluation' and it.get('currency') == 'USD' and it.get('version') == 1 and it.get('imported') is False, json.dumps(it)[:300])
    check('categoría existente vinculada', it.get('category') == 'Materiales')
    check('crédito, entrega y calificación (escala 0–100 para nuevos)', it.get('credit_type') == 'Crédito' and it.get('credit_days') in (30, '30') and float(it.get('lead_time_value')) == 5 and it.get('lead_time_unit') == 'días hábiles' and float(it.get('rating')) == 80 and str(it.get('rating_scale')) == '100', json.dumps({k: it.get(k) for k in ('credit_type', 'credit_days', 'lead_time_value', 'lead_time_unit', 'rating', 'rating_scale')}))
    check('contactos, correos y teléfonos en orden', [c['name'] for c in it.get('contacts', [])] == ['Rosa QA', 'Iván QA'] and [c['value'] for c in it.get('channels', []) if c['type'] == 'phone'] == ['81-1000-2000', '81-3000-4000'])
    check('documentos y logotipo (metadatos)', it.get('document_notes') == 'ISO 9001 vigente' and it.get('logo', {}).get('name') == 'logo prov.png')
    st, img, h = a.call('GET', f'{R}/{c1["id"]}/logo', raw=True)
    check('logotipo servido como imagen con nosniff y CSP', st == 200 and img == logo1 and h.get('Content-Type') == 'image/png' and h.get('X-Content-Type-Options') == 'nosniff')
    check('logotipo de proveedor no se sirve por la ruta de clientes', a.call('GET', f'/api/v1/catalogs/clients/{c1["id"]}/logo', raw=True)[0] == 404)
    upd = body(code + '-B', name=f'Proveedor Sintético {code} (edit)', category='Fletes especiales QA', status='suspended', currency='', credit_type='Parcialidades', credit_days=None,
               lead_time_unit='semanas', rating=None, phones=['81-3000-4000'], contacts=['Iván QA', 'Sofía QA'], emails=['ROSA@prov.invalid', 'sofia@prov.invalid'], logo={'remove': True})
    check('PUT sin If-Match → 428', a.call('PUT', f'{R}/{c1["id"]}', upd, key())[0] == 428)
    k2 = key(); st, u1, _ = a.call('PUT', f'{R}/{c1["id"]}', upd, {**k2, 'If-Match': '"1"'})
    check('actualización: 200 versión 2', st == 200 and u1.get('version') == 2 and {'code', 'legal_name', 'status_code', 'phones', 'contacts', 'logo_file'} <= set(u1.get('changed', [])), f'{st} {u1}')
    check('replay de la actualización', a.call('PUT', f'{R}/{c1["id"]}', upd, {**k2, 'If-Match': '"1"'})[1].get('replayed') is True)
    check('versión vieja → 412', a.call('PUT', f'{R}/{c1["id"]}', upd, {**key(), 'If-Match': '"1"'})[0] == 412)
    it = a.call('GET', f'{R}/{c1["id"]}')[1]['item']
    check('categoría nueva conservada como texto', it['category'] == 'Fletes especiales QA')
    check('estatus, moneda vacía, crédito, unidad y calificación vacía', it['status'] == 'suspended' and it['currency'] is None and it['credit_type'] == 'Parcialidades' and it['lead_time_unit'] == 'semanas' and it['rating'] is None)
    check('contactos/correos/teléfonos conciliados', [c['name'] for c in it['contacts']] == ['Iván QA', 'Sofía QA'] and [c['value'] for c in it['channels'] if c['type'] == 'email'] == ['ROSA@prov.invalid', 'sofia@prov.invalid'] and [c['value'] for c in it['channels'] if c['type'] == 'phone'] == ['81-3000-4000'])
    check('logotipo retirado', it['logo'] is None and a.call('GET', f'{R}/{c1["id"]}/logo', raw=True)[0] == 404)
    # Proveedor importado sintético con valores históricos (unidad "horas", escala 1–5): reescritura sin cambios
    lst = a.call('GET', f'{R}?q=PRV-QA-04&page_size=5')[1]['items']
    if lst:
        q4 = a.call('GET', f'{R}/{lst[0]["id"]}')[1]['item']
        same = {'code': q4['code'], 'name': q4['name'], 'tax_id': q4.get('tax_id') or '', 'supplier_key': q4.get('supplier_key') or '', 'contacts': [c['name'] for c in q4['contacts']],
                'emails': [c['value'] for c in q4['channels'] if c['type'] == 'email'], 'phones': [c['value'] for c in q4['channels'] if c['type'] == 'phone'], 'category': q4.get('category') or 'Servicios',
                'status': q4['status'], 'currency': q4.get('currency') or '', 'credit_type': q4.get('credit_type') or '', 'credit_days': None if q4.get('credit_days') is None else int(q4['credit_days']),
                'lead_time_value': None if q4.get('lead_time_value') is None else float(q4['lead_time_value']), 'lead_time_unit': q4.get('lead_time_unit') or '', 'rating': None if q4.get('rating') is None else float(q4['rating']),
                'document_notes': q4.get('document_notes') or '', 'notes': q4.get('notes') or ''}
        check('rating mayor a la escala del importado (1–5) → 422', a.call('PUT', f'{R}/{q4["id"]}', {**same, 'rating': 80}, {**key(), 'If-Match': f'"{q4["version"]}"'})[0] == 422)
        check('unidad histórica inventada → 422', a.call('PUT', f'{R}/{q4["id"]}', {**same, 'lead_time_unit': 'quincenas'}, {**key(), 'If-Match': f'"{q4["version"]}"'})[0] == 422)
        st, u, _ = a.call('PUT', f'{R}/{q4["id"]}', same, {**key(), 'If-Match': f'"{q4["version"]}"'})
        after = a.call('GET', f'{R}/{q4["id"]}')[1]['item']
        check('valor histórico ("horas", escala 5) se conserva al guardar sin cambios', st == 200 and after['lead_time_unit'] == q4['lead_time_unit'] and str(after.get('rating_scale')) == str(q4.get('rating_scale')) and after['status'] == q4['status'], f'{st} {u}')
    au = a.call('GET', '/api/v1/audit-events?module=catalogs&page_size=50')[1]
    acts = [e.get('action') or e.get('action_code') for e in au.get('items', [])]
    check('bitácora: supplier.create y supplier.update', 'supplier.create' in acts and 'supplier.update' in acts, str(acts[:8]))
    check('la matriz de proveedores encuentra el registro', a.call('GET', f'{R}?q={code}&page_size=10')[1].get('total') == 1)
finally:
    a.logout()
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nProveedores · escritura (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
