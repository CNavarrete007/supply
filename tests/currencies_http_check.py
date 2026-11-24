#!/usr/bin/env python3
"""Monedas · GET /api/v1/catalogs/currencies (SOLO LECTURA: apto para la base real) y rechazo claro de una moneda no dada de alta.
Lectura: 401/403/422, sin rutas de escritura, forma exacta y orden.
Con SF_SYNTHETIC_WRITES=1 (SOLO base sintética): para cada moneda del formulario (MXN/USD/EUR) que NO esté dada de alta en la base,
dar de alta un proveedor y un suministro sintéticos con esa moneda responde 422 INVALID_VALUE con field=currency (antes: 503 «No se
pudo guardar») y no crea nada. Si todas están dadas de alta, esa parte se informa como no aplicable.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... [SF_NONADMIN_USER=<correo>] [SF_SYNTHETIC_WRITES=1] python3 tests/currencies_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', ''); WRITES = os.environ.get('SF_SYNTHETIC_WRITES') == '1'
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
P = '/api/v1/catalogs/currencies'; RUN = uuid.uuid4().hex[:6].upper()

class S:
    def __init__(self, email=None):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        if email:
            self.call('POST', '/api/v1/auth/login', {'email': email, 'password': PASSWORD}, idem=False)
    def csrf(self): return json.loads(self.op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
    def call(self, method, path, body=None, idem=True, raw=None):
        h = {'Content-Type': 'application/json'}
        if method != 'GET': h['X-SF-CSRF'] = self.csrf()
        if method != 'GET' and idem: h['Idempotency-Key'] = str(uuid.uuid4())
        data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
        try:
            r = self.op.open(urllib.request.Request(API + path, data, h, method=method)); b = r.read(); return r.status, r.headers, json.loads(b or b'{}')
        except urllib.error.HTTPError as e:
            b = e.read(); return e.code, e.headers, (json.loads(b) if b[:1] == b'{' else {})
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {}, idem=False)
        except Exception: pass

check('sin sesión: 401', S().call('GET', P)[0] == 401)
if NONADMIN:
    o = S(NONADMIN); check('sin Master Admin: 403', o.call('GET', P)[0] == 403); o.logout()
a = S(USER)
try:
    st, hd, body = a.call('GET', P)
    check('Master Admin: 200 sin caché', st == 200 and 'no-store' in (hd.get('Cache-Control') or ''), str(st))
    items = body.get('items', [])
    check('forma exacta', set(body) == {'items', 'read_only'} and body['read_only'] is True and all(set(i) == {'code', 'name', 'minor_units', 'active'} for i in items), str(body)[:200])
    check('códigos ISO de 3 letras, sin repetir', all(re.fullmatch(r'[A-Z]{3}', i['code']) for i in items) and len({i['code'] for i in items}) == len(items))
    check('activas primero', [i['active'] for i in items] == sorted([i['active'] for i in items], reverse=True))
    check('parámetros desconocidos: 422', a.call('GET', P + '?x=1')[0] == 422)
    w = [a.call(m, P, {})[0] for m in ('POST', 'PUT', 'PATCH', 'DELETE')]
    check('sin rutas de escritura (≠ 2xx)', all(not 200 <= x < 300 for x in w), str(w))
    active = {i['code'] for i in items if i['active']}
    print('Monedas activas en esta base:', ', '.join(sorted(active)) or '(ninguna)')

    if WRITES:
        missing = [c for c in ('MXN', 'USD', 'EUR') if c not in {i['code'] for i in items}]
        if not missing:
            print('No aplica: MXN, USD y EUR están dadas de alta en esta base (el rechazo por moneda no se puede provocar).')
        for cur in missing:
            code = f'QA-SINT-CUR-{RUN}-{cur}'
            st, _, js = a.call('POST', '/api/v1/catalogs/suppliers', {'code': code, 'name': f'Proveedor moneda {cur} {RUN}', 'category': 'Materiales', 'status': 'authorized', 'currency': cur})
            err = js.get('error', {})
            check(f'proveedor con {cur} (no dada de alta): 422 INVALID_VALUE en «currency»', st == 422 and err.get('code') == 'INVALID_VALUE' and err.get('field') == 'currency' and 'moneda' in err.get('message', ''), f'{st} {err}')
            found = [x for x in a.call('GET', '/api/v1/catalogs/suppliers?q=' + code)[2].get('items', []) if x.get('code') == code]
            check(f'proveedor con {cur}: no se creó nada', not found)
        if missing:
            st, _, sp = a.call('POST', '/api/v1/catalogs/suppliers', {'code': f'QA-SINT-CUR-{RUN}-OK', 'name': f'Proveedor moneda válida {RUN}', 'category': 'Materiales', 'status': 'authorized', 'currency': 'MXN'})
            check('proveedor con MXN: 201 (la regla solo afecta a monedas no dadas de alta)', st == 201, str(st))
            for cur in missing:
                st, _, js = a.call('POST', '/api/v1/catalogs/supplier-offerings', {'supplier_id': sp.get('id'), 'name': f'Suministro moneda {cur} {RUN}', 'type': 'product', 'category': 'Materiales', 'currency': cur, 'status': 'active'})
                err = js.get('error', {})
                check(f'suministro con {cur} (no dada de alta): 422 INVALID_VALUE en «currency»', st == 422 and err.get('code') == 'INVALID_VALUE' and err.get('field') == 'currency', f'{st} {err}')
finally:
    a.logout()
w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nMonedas (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
