#!/usr/bin/env python3
"""Clientes · contrato HTTP de alta/actualización (POST/PUT /api/v1/catalogs/clients) y logotipo privado.
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (crea clientes con número QA-SINT-*). Exige
SF_SYNTHETIC_WRITES=1. Verifica 401/403/CSRF/415/422/428/409/412, idempotencia, auditoría, conciliación de contactos,
correos y teléfonos, política de recompra, logotipo (validación por bytes, reemplazo, retiro) y que las cuentas SQL previas
no cambiaron.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/clients_write_http_check.py
"""
import base64, http.cookiejar, json, os, re, struct, sys, urllib.error, urllib.request, uuid, zlib
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
R = '/api/v1/catalogs/clients'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper()

def png(w, h, rgb=(37, 99, 235)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
data_url = lambda b, mime='image/png': f'data:{mime};base64,' + base64.b64encode(b).decode()

class S:
    def __init__(self, email=None):
        self.jar = http.cookiejar.CookieJar(); self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar)); self.csrf = ''
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
            b = e.read();
            try: return e.code, json.loads(b or b'{}'), dict(e.headers)
            except Exception: return e.code, {}, dict(e.headers)
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {})
        except Exception: pass

def body(code, **kw):
    b = {'code': code, 'name': f'Cliente Sintético {code}', 'brand_name': 'Marca QA', 'tax_id': 'XAXX010101000', 'project': 'PRY-QA-W', 'contract_reference': 'CTO-QA-W',
         'phone': '833-456-7890', 'contacts': ['Ana QA', 'Luis QA'], 'emails': ['ana@qa.invalid', 'luis@qa.invalid'], 'status': 'active', 'address': 'Calle QA 1\nCiudad QA',
         'terms': 'Crédito 30 días', 'notes': 'Alta sintética', 'repeat_policy': {'sales_policy': 'guaranteed', 'sourcing_policy': 'requote_always', 'price_validity_days': 90,
         'contract_reference': 'Rate Card QA', 'contract_valid_until': '2027-12-31', 'min_margin_pct': 12.5}}
    b.update(kw); return b
key = lambda: {'Idempotency-Key': str(uuid.uuid4())}

anon = S()
check('sin sesión: POST 401', anon.call('POST', R, body('QA-SINT-X'), key())[0] == 401)
if NONADMIN:
    o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', R, body('QA-SINT-X'), key())[0] == 403); o.logout()
a = S(USER)
try:
    code = f'QA-SINT-{RUN}'
    check('sin CSRF: 403', a.call('POST', R, body(code), {**key(), 'X-SF-CSRF': '0' * 64})[0] == 403)
    check('sin JSON: 415', a.call('POST', R, b'code=1', {**key(), 'Content-Type': 'text/plain'})[0] == 415)
    check('sin Idempotency-Key: 422', a.call('POST', R, body(code))[0] == 422)
    for name, b in [('número vacío', body('')), ('razón social vacía', body(code, name='')), ('proyecto obligatorio', body(code, project='')), ('contrato obligatorio', body(code, contract_reference='')),
                    ('correo inválido', body(code, emails=['no-es-correo'])), ('estatus desconocido', body(code, status='deleted')), ('campo extra', {**body(code), 'portal_key': 'x'}),
                    ('política fuera de catálogo', body(code, repeat_policy={'sales_policy': 'inventada'})), ('margen > 100', body(code, repeat_policy={'min_margin_pct': 150})),
                    ('fecha inválida', body(code, repeat_policy={'contract_valid_until': '2027-02-30'})), ('logo HTML disfrazado', body(code, logo={'data': data_url(b'<html><script>alert(1)</script></html>'), 'name': 'x.png'})),
                    ('logo SVG', body(code, logo={'data': 'data:image/svg+xml;base64,PHN2Zy8+', 'name': 'x.svg'})), ('logo > 400 KB', body(code, logo={'data': data_url(b'\x89PNG\r\n\x1a\n' + b'0' * 420000), 'name': 'x.png'})),
                    ('teléfono inválido', body(code, phone='llámame'))]:
        st, js, _ = a.call('POST', R, b, key())
        check(f'422 {name}', st == 422, f'{st} {js}')
    k1 = key(); logo1 = png(64, 32)
    st, c1, _ = a.call('POST', R, body(code, logo={'data': data_url(logo1), 'name': 'logo empresa.png'}), k1)
    check('alta: 201 con id y versión 1', st == 201 and c1.get('version') == 1 and re.match(r'^[0-9a-f-]{36}$', c1.get('id', '')), f'{st} {c1}')
    st, rep, _ = a.call('POST', R, body(code, logo={'data': data_url(logo1), 'name': 'logo empresa.png'}), k1)
    check('idempotencia: misma clave y contenido → 200 replay, mismo id', st == 200 and rep.get('id') == c1.get('id') and rep.get('replayed') is True, f'{st} {rep}')
    check('idempotencia: misma clave con otro contenido → 409', a.call('POST', R, body(code, notes='otro'), k1)[0] == 409)
    check('número duplicado → 409 CODE_TAKEN', a.call('POST', R, body(code), key())[1].get('error', {}).get('code') == 'CODE_TAKEN')
    st, d, _ = a.call('GET', f'{R}/{c1["id"]}')
    it = d.get('item', {})
    check('detalle refleja el alta', st == 200 and it.get('code') == code and it.get('project') == 'PRY-QA-W' and it.get('contract_reference') == 'CTO-QA-W' and it.get('version') == 1 and it.get('imported') is False, json.dumps(it)[:300])
    check('contactos y correos en orden (el primero es principal)', [c['name'] for c in it.get('contacts', [])] == ['Ana QA', 'Luis QA'] and [c['value'] for c in it.get('channels', []) if c['type'] == 'email'] == ['ana@qa.invalid', 'luis@qa.invalid'] and it['contacts'][0]['is_primary'])
    rp = it.get('repeat_policy', {})
    check('política de recompra guardada', rp.get('sales_policy') == 'guaranteed' and rp.get('sourcing_policy') == 'requote_always' and rp.get('price_validity_days') == 90 and str(rp.get('min_margin_pct')).startswith('12.5') and rp.get('contract_valid_until') == '2027-12-31' and rp.get('updated_at'))
    check('portal deshabilitado por omisión', it.get('portal_enabled') is False)
    check('logotipo registrado (solo metadatos)', it.get('logo', {}).get('mime') == 'image/png' and it['logo'].get('name') == 'logo empresa.png' and 'storage' not in json.dumps(it))
    st, img, h = a.call('GET', f'{R}/{c1["id"]}/logo', raw=True)
    check('logotipo servido como imagen con nosniff y CSP', st == 200 and img == logo1 and h.get('Content-Type') == 'image/png' and h.get('X-Content-Type-Options') == 'nosniff' and "default-src 'none'" in h.get('Content-Security-Policy', ''), f'{st} {h.get("Content-Type")}')
    check('logotipo sin sesión → 401', anon.call('GET', f'{R}/{c1["id"]}/logo', raw=True)[0] == 401)
    # Actualización
    upd = body(code + '-B', name=f'Cliente Sintético {code} (edit)', phone='833-000-1111 / 81-2222-3333', contacts=['Luis QA', 'Marta QA'], emails=['LUIS@qa.invalid', 'marta@qa.invalid'],
               status='inactive', repeat_policy={'sales_policy': 'contract', 'sourcing_policy': 'reuse_if_valid', 'price_validity_days': 0}, logo={'data': data_url(png(16, 16, (124, 58, 237))), 'name': 'nuevo.png'})
    check('PUT sin If-Match → 428', a.call('PUT', f'{R}/{c1["id"]}', upd, key())[0] == 428)
    k2 = key(); st, u1, _ = a.call('PUT', f'{R}/{c1["id"]}', upd, {**k2, 'If-Match': '"1"'})
    check('actualización: 200 versión 2 con campos cambiados', st == 200 and u1.get('version') == 2 and {'code', 'legal_name', 'status_code', 'contacts', 'emails', 'phones', 'logo_file'} <= set(u1.get('changed', [])), f'{st} {u1}')
    check('replay de la actualización', a.call('PUT', f'{R}/{c1["id"]}', upd, {**k2, 'If-Match': '"1"'})[1].get('replayed') is True)
    check('versión vieja → 412 STALE_VERSION', a.call('PUT', f'{R}/{c1["id"]}', upd, {**key(), 'If-Match': '"1"'})[1].get('error', {}).get('code') == 'STALE_VERSION')
    it = a.call('GET', f'{R}/{c1["id"]}')[1]['item']
    check('detalle tras editar: número, estatus, dos teléfonos', it['code'] == code + '-B' and it['status'] == 'inactive' and [c['value'] for c in it['channels'] if c['type'] == 'phone'] == ['833-000-1111', '81-2222-3333'], json.dumps(it)[:300])
    check('contactos conciliados: Luis conservado, Ana desactivada, Marta nueva', [c['name'] for c in it['contacts']] == ['Luis QA', 'Marta QA'])
    check('correos conciliados sin duplicar mayúsculas', [c['value'] for c in it['channels'] if c['type'] == 'email'] == ['LUIS@qa.invalid', 'marta@qa.invalid'])
    check('política actualizada (0 días = sin vencimiento)', it['repeat_policy']['sales_policy'] == 'contract' and it['repeat_policy']['price_validity_days'] == 0 and it['repeat_policy']['contract_reference'] is None)
    check('logotipo reemplazado', a.call('GET', f'{R}/{c1["id"]}/logo', raw=True)[1] == png(16, 16, (124, 58, 237)))
    st, u2, _ = a.call('PUT', f'{R}/{c1["id"]}', {**upd, 'logo': {'remove': True}}, {**key(), 'If-Match': '"2"'})
    check('retirar logotipo', st == 200 and a.call('GET', f'{R}/{c1["id"]}/logo', raw=True)[0] == 404 and a.call('GET', f'{R}/{c1["id"]}')[1]['item']['logo'] is None)
    st, c2, _ = a.call('POST', R, body(f'QA-SINT-{RUN}-C'), key())
    check('no se puede tomar el número de otro cliente al editar → 409', a.call('PUT', f'{R}/{c1["id"]}', {**upd, 'code': f'QA-SINT-{RUN}-C', 'logo': None}, {**key(), 'If-Match': '"3"'})[1].get('error', {}).get('code') == 'CODE_TAKEN')
    check('UUID inexistente → 404', a.call('PUT', f'{R}/00000000-0000-4000-8000-000000000000', upd, {**key(), 'If-Match': '"1"'})[0] == 404)
    au = a.call('GET', '/api/v1/audit-events?module=catalogs&page_size=50')[1]
    acts = [e.get('action') or e.get('action_code') for e in au.get('items', [])]
    check('bitácora: client.create y client.update registrados', acts.count('client.create') >= 2 and acts.count('client.update') >= 2, str(acts[:8]))
    lst = a.call('GET', f'{R}?q=QA-SINT-{RUN}&page_size=50')[1]
    check('la matriz de clientes encuentra los nuevos registros', lst.get('total') == 2)
finally:
    a.logout()
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nClientes · escritura (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
