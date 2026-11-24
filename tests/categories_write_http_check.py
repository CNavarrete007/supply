#!/usr/bin/env python3
"""Catálogo de categorías · contrato HTTP de alta, edición y eliminación (POST/PUT/DELETE /api/v1/catalogs/categories).
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (crea categorías "Categoría Sintética QA <RUN>" y las elimina).
Exige SF_SYNTHETIC_WRITES=1. Verifica 401/403/CSRF/415/422/428/409/412/404, idempotencia (reintento y conflicto de clave),
nombres duplicados sin distinguir mayúsculas ni acentos, versión (If-Match), que el estatus se refleja en el catálogo de Registro de
requisición, que una categoría usada no se elimina, auditoría (bitácora de Usuarios y roles) y que no quedan categorías de prueba.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/categories_write_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
C = '/api/v1/catalogs/categories'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper()
NAME = f'Categoría Sintética QA {RUN}'

class S:
    def __init__(self, email=None):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); self.csrf = ''
        if email:
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
            self.call('POST', '/api/v1/auth/login', {'email': email, 'password': PASSWORD}, auth=False)
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
    def get(self, p): return json.loads(self.op.open(API + p).read())
    def call(self, method, path, body=None, key='new', ifm=None, csrf=True, ctype='application/json', auth=True):
        h = {'Content-Type': ctype}
        if csrf and self.csrf: h['X-SF-CSRF'] = self.csrf
        if auth and key: h['Idempotency-Key'] = str(uuid.uuid4()) if key == 'new' else key
        if ifm: h['If-Match'] = f'"{ifm}"'
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        try:
            r = self.op.open(urllib.request.Request(API + path, data, h, method=method)); return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}')
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {}, auth=False)
        except Exception: pass

anon = S()
check('sin sesión: 401', anon.call('POST', C, {'name': NAME}, csrf=False)[0] == 401)
if NONADMIN:
    o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', C, {'name': NAME})[0] == 403); o.logout()
adm = S(USER)
created = []
try:
    before = adm.get(C)
    check('sin CSRF: 403', adm.call('POST', C, {'name': NAME}, csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('POST', C, b'name=x', ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('POST', C, {'name': NAME}, key=None)[0] == 422)
    bad = [{'name': ''}, {'name': '   '}, {'name': NAME, 'extra': 1}, {'name': NAME, 'status': 'borrada'}, {'name': 'a\x01b'}, {'name': 'x' * 256}, {'name': NAME, 'description': 'y' * 16001}, {'name': 12}, ['lista']]
    check('cuerpo inválido: 422 con el campo', all(adm.call('POST', C, b)[0] == 422 for b in bad))

    key = str(uuid.uuid4())
    st, c = adm.call('POST', C, {'name': f'  {NAME}  ', 'description': 'Alcance sintético', 'status': 'active'}, key=key)
    check('alta: 201 con código cat_… y versión', st == 201 and re.fullmatch(r'cat_[a-z0-9_]+', c.get('code', '')) and re.fullmatch(r'[0-9a-f]{16}', c.get('version', '')), f'{st} {c}')
    code = c.get('code'); created.append(code)
    st2, c2 = adm.call('POST', C, {'name': f'  {NAME}  ', 'description': 'Alcance sintético', 'status': 'active'}, key=key)
    check('reintento con la misma clave: 200 sin duplicar', st2 == 200 and c2.get('replayed') is True and c2.get('code') == code)
    check('misma clave con otro contenido: 409', adm.call('POST', C, {'name': NAME + ' otro'}, key=key)[0] == 409)
    st3, c3 = adm.call('POST', C, {'name': NAME.upper().replace('Í', 'I')})
    check('nombre duplicado sin distinguir mayúsculas ni acentos: 409 DUPLICATE_CATEGORY', st3 == 409 and c3['error']['code'] == 'DUPLICATE_CATEGORY')
    cat = {x['code']: x for x in adm.get(C)['items']}
    row = cat.get(code, {})
    check('lectura: nombre normalizado, activa, sin uso y misma versión', row.get('name') == NAME and row.get('active') is True and row.get('description') == 'Alcance sintético'
          and sum(row.get('usage', {}).values()) == 0 and row.get('version') == c['version'])
    check('aparece activa en el catálogo de Registro de requisición', any(x['code'] == code and x['active'] for x in adm.get('/api/v1/recovery/catalogs')['categories']))

    upd = {'name': NAME + ' v2', 'description': '', 'status': 'inactive'}
    check('edición sin If-Match: 428', adm.call('PUT', f'{C}/{code}', upd)[0] == 428)
    check('edición de código inexistente: 404', adm.call('PUT', f'{C}/cat_no_existe_{RUN.lower()}', upd, ifm='0' * 16)[0] == 404)
    check('código con caracteres inválidos: 404', adm.call('PUT', f'{C}/..%2Fx', upd, ifm='0' * 16)[0] == 404)
    st4, u = adm.call('PUT', f'{C}/{code}', upd, ifm=c['version'])
    check('edición: 200 con campos cambiados y versión nueva', st4 == 200 and set(u.get('changed', [])) == {'name', 'description', 'active'} and u.get('version') != c['version'], f'{st4} {u}')
    check('versión vencida: 412 STALE_VERSION', adm.call('PUT', f'{C}/{code}', {'name': NAME + ' v3'}, ifm=c['version'])[0] == 412)
    row = {x['code']: x for x in adm.get(C)['items']}.get(code, {})
    check('lectura tras editar: inactiva, sin descripción', row.get('name') == NAME + ' v2' and row.get('active') is False and row.get('description') is None and row.get('version') == u['version'])
    check('inactiva en el catálogo de Registro de requisición (deja de ofrecerse)', any(x['code'] == code and not x['active'] for x in adm.get('/api/v1/recovery/catalogs')['categories']))
    st5, n5 = adm.call('PUT', f'{C}/{code}', {'name': NAME + ' v2', 'description': '', 'status': 'active'}, ifm=u['version'])
    check('reactivar: 200 (solo estatus)', st5 == 200 and n5.get('changed') == ['active'])

    used = next((x for x in adm.get(C)['items'] if x['usage']['items'] + x['usage']['items_by_label'] + x['usage']['suppliers'] + x['usage']['offerings'] > 0), None)
    if used:
        st6, d6 = adm.call('DELETE', f"{C}/{used['code']}", ifm=used['version'])
        check('eliminar una categoría usada: 409 CATEGORY_IN_USE (sin tocarla)', st6 == 409 and d6['error']['code'] == 'CATEGORY_IN_USE' and any(x['code'] == used['code'] for x in adm.get(C)['items']))
    check('eliminar sin If-Match: 428', adm.call('DELETE', f'{C}/{code}')[0] == 428)
    check('eliminar con versión vencida: 412', adm.call('DELETE', f'{C}/{code}', ifm=u['version'])[0] == 412)
    dkey = str(uuid.uuid4())
    st7, d7 = adm.call('DELETE', f'{C}/{code}', ifm=n5['version'], key=dkey)
    check('eliminar una categoría nunca usada: 200', st7 == 200 and d7.get('deleted') is True)
    check('reintento de la eliminación con la misma clave: 200 repetido', (lambda r: r[0] == 200 and r[1].get('replayed') is True)(adm.call('DELETE', f'{C}/{code}', ifm=n5['version'], key=dkey)))
    check('eliminada: ya no aparece y otra eliminación da 404', code not in {x['code'] for x in adm.get(C)['items']} and adm.call('DELETE', f'{C}/{code}', ifm=n5['version'])[0] == 404)
    if not any(r[0].startswith('eliminada') and not r[1] for r in results):
        created.remove(code)

    log = adm.get('/api/v1/audit-events?module=catalogs&page_size=50')['items']
    acts = {x['action'] for x in log if any(code in (ch.get('value') or '') for ch in x.get('changes', []))}
    check('bitácora: alta, edición y eliminación auditadas (módulo catalogs)', {'category.create', 'category.update', 'category.delete'} <= acts, str(acts))
    after = adm.get(C)
    check('sin categorías de prueba al terminar; las demás sin cambios',
          [(x['code'], x['name'], x['active'], x['version']) for x in after['items']] == [(x['code'], x['name'], x['active'], x['version']) for x in before['items']])
finally:
    for code in created:  # limpieza si algo falló a medias (solo las categorías de esta corrida)
        row = {x['code']: x for x in adm.get(C)['items']}.get(code)
        if row and row['name'].startswith('Categoría Sintética QA') and sum(row['usage'].values()) == 0:
            adm.call('DELETE', f'{C}/{code}', ifm=row['version'])
    adm.logout()
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCategorías · escritura (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
