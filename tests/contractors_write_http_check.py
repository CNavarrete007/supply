#!/usr/bin/env python3
"""Contratista · contrato HTTP de la edición de los datos de la empresa (PUT /api/v1/contractors/{id}, GET .../logo).
ESCRIBE en la organización de la sesión: úsese SOLO contra la base sintética/desechable. Al terminar restaura la razón social,
RFC, teléfono, correo y domicilio originales; si la empresa tenía un logotipo, las pruebas de logotipo se omiten (no se puede
reponer un logotipo importado por la API). Exige SF_SYNTHETIC_WRITES=1.
Verifica 401/403/CSRF/415/422 por campo/428/404, idempotencia (reintento y conflicto de clave), versión (If-Match → 412),
lectura posterior en la matriz, guardado sin cambios, logotipo (alta, consulta privada, retiro), bitácora (contractor.update)
y que no existan rutas de alta ni de baja de empresas.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/contractors_write_http_check.py
"""
import base64, http.cookiejar, json, os, re, struct, sys, urllib.error, urllib.request, uuid, zlib
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
R = '/api/v1/contractors'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper(); ZERO = '00000000-0000-4000-8000-000000000000'

def png(w, h, rgb=(162, 33, 183)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
data_url = lambda b, mime='image/png': f'data:{mime};base64,' + base64.b64encode(b).decode()

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
            r = self.op.open(API + p); return r.status, r.headers.get('Content-Type', ''), r.headers.get('Cache-Control', ''), r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get('Content-Type', ''), '', e.read()
    def call(self, method, path, body=None, key='new', ifm=None, csrf=True, ctype='application/json'):
        h = {'Content-Type': ctype}
        if csrf and self.csrf: h['X-SF-CSRF'] = self.csrf
        if key: h['Idempotency-Key'] = str(uuid.uuid4()) if key == 'new' else key
        if ifm is not None: h['If-Match'] = ifm if isinstance(ifm, str) and ifm.startswith('"') else f'"{ifm}"'
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        try:
            r = self.op.open(urllib.request.Request(API + path, data, h, method=method)); return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}')
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {}, key=None)
        except Exception: pass

anon = S()
check('sin sesión: 401', anon.call('PUT', f'{R}/{ZERO}', {'legal_name': 'x'}, csrf=False, ifm=1)[0] == 401)
check('logotipo sin sesión: 401', anon.raw(f'{R}/{ZERO}/logo')[0] == 401)
adm = S(USER)
org = adm.get(R)['items'][0]; OID = org['id']; P = f'{R}/{OID}'
if NONADMIN:
    o = S(NONADMIN)
    check('sin Master Admin: 403 (PUT y logotipo)', o.call('PUT', P, {'legal_name': 'x'}, ifm=org['version'])[0] == 403 and o.raw(f'{P}/logo')[0] == 403); o.logout()
orig = {'legal_name': org['legal_name'], 'tax_id': org['tax_identifier'] or '', 'phone': org['phone'] or '', 'email': org['email'] or '', 'address': org['postal_address'] or ''}
had_logo = org['has_logo']
current = lambda: next(x for x in adm.get(R)['items'] if x['id'] == OID)
audit = lambda: [x for x in adm.get('/api/v1/audit-events?module=catalogs&page_size=50')['items']
                 if x['action'] == 'contractor.update' and any(OID in (ch.get('value') or '') for ch in x.get('changes', []))]
try:
    check('lectura: versión numérica y logo_stored', isinstance(org.get('version'), int) and org['version'] > 0 and isinstance(org.get('logo_stored'), bool), str({k: org.get(k) for k in ('version', 'logo_stored')}))
    v0 = org['version']
    NEW = {'legal_name': f"{orig['legal_name']} QA {RUN}"[:255], 'tax_id': f'QAX{RUN}', 'phone': '+52 (55) 1234-5678 ext. 9', 'email': f'qa.{RUN.lower()}@supplyflow.invalid', 'address': 'Calle Sintética 1\nCol. QA, CDMX'}
    check('sin CSRF: 403', adm.call('PUT', P, NEW, ifm=v0, csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('PUT', P, b'legal_name=x', ifm=v0, ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('PUT', P, NEW, ifm=v0, key=None)[0] == 422)
    check('sin If-Match: 428', adm.call('PUT', P, NEW)[0] == 428)
    check('If-Match no numérico: 428', adm.call('PUT', P, NEW, ifm='"abc"')[0] == 428)
    bad = [({**NEW, 'legal_name': ''}, 'legal_name'), ({**NEW, 'legal_name': '   '}, 'legal_name'), ({**NEW, 'legal_name': 'x' * 256}, 'legal_name'),
           ({**NEW, 'tax_id': 'RFC<script>'}, 'tax_id'), ({**NEW, 'tax_id': 'x' * 65}, 'tax_id'), ({**NEW, 'phone': 'llamar'}, 'phone'), ({**NEW, 'phone': '+()'}, 'phone'),
           ({**NEW, 'email': 'qa@'}, 'email'), ({**NEW, 'email': 'a' * 250 + '@x.mx'}, 'email'), ({**NEW, 'address': 'y' * 4001}, 'address'),
           ({**NEW, 'logo': {'data': 'data:image/svg+xml;base64,PHN2Zy8+', 'name': 'x.svg'}}, 'logo'), ({**NEW, 'logo': {'data': data_url(b'GIF89a' + b'0' * 20), 'name': 'x.png'}}, 'logo'),
           ({**NEW, 'logo': {'remove': False}}, 'logo'), ({**NEW, 'status': 'inactive'}, 'body'), ({**NEW, 'legal_name': 12}, 'legal_name'), (['lista'], 'body')]
    got = [(f, *adm.call('PUT', P, b, ifm=v0)) for b, f in bad]
    check('cuerpo inválido: 422 INVALID_CONTRACTOR con el campo', all(st == 422 and r.get('error', {}).get('code') == 'INVALID_CONTRACTOR' and r['error'].get('field') == f for f, st, r in got),
          str([(f, st, r.get('error', {}).get('field')) for f, st, r in got if st != 422 or r.get('error', {}).get('field') != f]))
    check('el estatus no se edita aquí (campo status rechazado)', got[13][1] == 422)
    check('otra organización: 404', adm.call('PUT', f'{R}/{ZERO}', NEW, ifm=v0)[0] == 404)
    check('identificador inválido: 404', adm.call('PUT', f'{R}/no-es-uuid', NEW, ifm=v0)[0] == 404)
    check('sin rutas de alta ni baja (POST/DELETE ≠ 2xx)', all(not 200 <= adm.call(m, p, NEW)[0] < 300 for m, p in [('POST', R), ('DELETE', P), ('PATCH', P)]))
    check('validaciones fallidas no cambian la versión', current()['version'] == v0)

    key = str(uuid.uuid4())
    st, u = adm.call('PUT', P, NEW, key=key, ifm=v0)
    check('edición: 200 con los cinco campos cambiados y versión nueva', st == 200 and set(u.get('changed', [])) == {'legal_name', 'tax_id', 'phone', 'email', 'address'}
          and isinstance(u.get('version'), int) and u['version'] > v0 and u.get('id') == OID and u.get('replayed') is False, f'{st} {u}')
    v1 = u.get('version')
    st2, u2 = adm.call('PUT', P, NEW, key=key, ifm=v0)
    check('reintento con la misma clave: 200 repetido sin volver a escribir', st2 == 200 and u2.get('replayed') is True and u2.get('version') == v1, f'{st2} {u2}')
    check('misma clave con otro contenido: 409', adm.call('PUT', P, {**NEW, 'phone': '555'}, key=key, ifm=v0)[0] == 409)
    check('versión vencida: 412 STALE_VERSION', adm.call('PUT', P, {**NEW, 'phone': '555 000 1111'}, ifm=v0)[0] == 412)
    c = current()
    check('la matriz lee los datos guardados (saltos de línea del domicilio incluidos)', c['legal_name'] == NEW['legal_name'] and c['tax_identifier'] == NEW['tax_id'] and c['phone'] == NEW['phone']
          and c['email'] == NEW['email'] and c['postal_address'] == NEW['address'] and c['version'] == v1, str({k: c[k] for k in ('legal_name', 'tax_identifier', 'phone', 'email', 'postal_address', 'version')}))
    check('el estatus y la empresa activa no cambian', c['status'] == org['status'] and c['active'] is True)
    n_before = len(audit())
    st3, u3 = adm.call('PUT', P, {**NEW, 'legal_name': f"  {NEW['legal_name']}  "}, ifm=v1)
    check('guardar sin cambios (espacios normalizados): 200 sin campos cambiados ni bitácora', st3 == 200 and u3.get('changed') == [] and len(audit()) == n_before, f'{st3} {u3}')
    v2 = u3.get('version', v1)

    if had_logo:
        print('NOTA: la empresa ya tenía logotipo; se omiten las pruebas de logotipo para no sustituirlo.')
    else:
        img = png(64, 32)
        st4, u4 = adm.call('PUT', P, {**NEW, 'logo': {'data': data_url(img), 'name': f'logo QA {RUN}.png'}}, ifm=v2)
        check('logotipo: 200 solo con el logotipo cambiado', st4 == 200 and u4.get('changed') == ['logo_file'], f'{st4} {u4}')
        v2 = u4.get('version', v2)
        c = current()
        check('matriz: has_logo y logo_stored verdaderos', c['has_logo'] is True and c['logo_stored'] is True)
        s, ct, cc, body = adm.raw(f'{P}/logo')
        check('GET logotipo: 200 privado, PNG, mismos bytes', s == 200 and ct.startswith('image/png') and 'no-store' in cc and body == img, f'{s} {ct} {cc} {len(body)}')
        check('GET logotipo con parámetros: 404', adm.raw(f'{P}/logo?x=1')[0] == 404)
        check('GET logotipo de otra organización: 404', adm.raw(f'{R}/{ZERO}/logo')[0] == 404)
        st5, u5 = adm.call('PUT', P, {**NEW, 'logo': {'remove': True}}, ifm=v2)
        check('quitar logotipo: 200 y GET logotipo 404', st5 == 200 and u5.get('changed') == ['logo_file'] and adm.raw(f'{P}/logo')[0] == 404 and current()['has_logo'] is False, f'{st5} {u5}')
        v2 = u5.get('version', v2)

    mine = audit()
    dump = json.dumps(mine, ensure_ascii=False)
    check('bitácora: contractor.update con los cambios campo por campo', len(mine) >= (1 if had_logo else 3) and f'QAX{RUN}' in dump and (had_logo or 'logo_file' in dump), f'{len(mine)}')
    check('bitácora sin bytes del logotipo', 'base64' not in dump and 'iVBOR' not in dump)
finally:
    try:
        cur = current()
        st, r = adm.call('PUT', P, orig, ifm=cur['version'])
        fin = current()
        check('restauración de los datos originales', st == 200 and fin['legal_name'] == orig['legal_name'] and (fin['tax_identifier'] or '') == orig['tax_id'] and (fin['phone'] or '') == orig['phone']
              and (fin['email'] or '') == orig['email'] and (fin['postal_address'] or '') == orig['address'] and fin['has_logo'] == had_logo, f'{st} {r}')
    except Exception as e:
        check('restauración de los datos originales', False, str(e))
    adm.logout()

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nContratista · datos de la empresa (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
