#!/usr/bin/env python3
"""Suministros · edición de suministros REPETIDOS importados (mismo proveedor y mismo nombre), PUT /api/v1/catalogs/supplier-offerings/{id}.
Caso real (respaldo del 9 nov): un proveedor tenía 3 suministros importados con nombre idéntico. Antes, al editar cualquiera que no fuera
«la primera coincidencia», el servidor respondía 409 DUPLICATE_OFFERING aunque no se cambiara el nombre.
ESCRIBE en la base: SOLO sandbox sintético (exige SF_SYNTHETIC_WRITES=1). Requiere un grupo sembrado de ≥2 suministros del mismo proveedor
cuyo nombre empiece por «Duplicado sintético QA» (los duplicados solo nacen de una importación: la API no permite crearlos). Siembra de
referencia, SOLO en el sandbox (SQL como root):
  SET @s:=(SELECT id FROM suppliers WHERE code LIKE 'QA-SINT-OS-%' ORDER BY id DESC LIMIT 1); SET @o:=(SELECT organization_id FROM suppliers WHERE id=@s);
  INSERT INTO supplier_offerings (organization_id,supplier_id,public_id,legacy_id,name,offering_type,status_code,notes,updated_at)
  SELECT @o,@s,UUID(),CONCAT('QA-DUP-',n),'Duplicado sintético QA placa','product','active','Importado repetido',UTC_TIMESTAMP(6)
  FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3) t;
Verifica: cada miembro se edita sin renombrar (200, versión nueva) y se restaura; renombrar OTRO suministro al nombre ocupado → 409;
alta nueva con el nombre ocupado → 409. No deshace el grupo sembrado (la prueba se puede repetir).
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 python3 tests/offerings_duplicates_http_check.py
"""
import http.cookiejar, json, os, re, sys, unicodedata, urllib.error, urllib.request, uuid
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
R = '/api/v1/catalogs/supplier-offerings'; RUN = uuid.uuid4().hex[:6].upper(); PREFIX = 'Duplicado sintético QA'
FIELDS = ('supplier_id', 'name', 'type', 'category', 'brand', 'model', 'description', 'lead_time_value', 'lead_time_unit', 'credit_type', 'credit_days',
          'currency', 'minimum_order', 'valid_until', 'coverage', 'status', 'notes')
fold = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s or '') if not unicodedata.combining(c)).lower()

op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(method, path, body=None, version=None):
    h = {'Content-Type': 'application/json'}
    if method != 'GET':
        h['X-SF-CSRF'] = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']; h['Idempotency-Key'] = str(uuid.uuid4())
    if version is not None: h['If-Match'] = f'"{version}"'
    try:
        r = op.open(urllib.request.Request(API + path, None if body is None else json.dumps(body).encode(), h, method=method)); return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        b = e.read(); return e.code, (json.loads(b) if b[:1] == b'{' else {})
def payload(it, **kw):
    num = lambda v: None if v in (None, '') else (int(float(v)) if float(v).is_integer() else float(v))
    b = {k: it.get(k) for k in FIELDS}
    for k in ('category', 'brand', 'model', 'description', 'lead_time_unit', 'credit_type', 'currency', 'minimum_order', 'coverage', 'notes'): b[k] = b[k] or ''
    b['lead_time_value'] = num(b['lead_time_value']); b['credit_days'] = None if b['credit_days'] in (None, '') else int(b['credit_days'])
    b['valid_until'] = (b['valid_until'] or '')[:10] or None
    b.update(kw); return b

call('POST', '/api/v1/auth/login', {'email': USER, 'password': PASSWORD})
try:
    items, page = [], 1
    while True:
        st, js = call('GET', f'{R}?page={page}&page_size=50'); items += js.get('items', [])
        if st != 200 or len(items) >= js.get('total', 0) or page > 40: break
        page += 1
    groups = {}
    for it in items:
        if (it.get('name') or '').startswith(PREFIX): groups.setdefault((it['supplier_id'], fold(it['name'])), []).append(it)
    group = max(groups.values(), key=len, default=[])
    if len(group) < 2:
        print('No aplica: no hay un grupo sembrado de suministros repetidos «Duplicado sintético QA» (ver la siembra en el encabezado).'); sys.exit(2)
    check(f'grupo sembrado: {len(group)} suministros del mismo proveedor con el mismo nombre', len(group) >= 2)
    ok_edit = ok_restore = True; detail = ''
    for m in group:
        st, d = call('GET', f"{R}/{m['id']}"); it = d['item']
        st1, r1 = call('PUT', f"{R}/{m['id']}", payload(it, notes=(it.get('notes') or '') + f' · editado QA {RUN}'), it['version'])
        if st1 != 200: ok_edit = False; detail = f"{m['id']}: {st1} {r1}"; continue
        st2, r2 = call('PUT', f"{R}/{m['id']}", payload(it), r1['version'])
        if st2 != 200: ok_restore = False; detail = f"{m['id']} (restaurar): {st2} {r2}"
    check('cada suministro repetido se edita sin renombrar (200)', ok_edit, detail)
    check('y se restaura su valor original (200)', ok_restore, detail)
    shared = group[0]['name']; sup = group[0]['supplier_id']
    st, x = call('POST', R, {'supplier_id': sup, 'name': f'Suministro aparte QA {RUN}', 'type': 'product', 'status': 'active'})
    check('alta de un suministro con nombre libre: 201', st == 201, f'{st} {x}')
    if st == 201:
        _, dx = call('GET', f"{R}/{x['id']}")
        st3, r3 = call('PUT', f"{R}/{x['id']}", payload(dx['item'], name=shared), dx['item']['version'])
        check('renombrarlo al nombre ocupado: 409 DUPLICATE_OFFERING', st3 == 409 and r3.get('error', {}).get('code') == 'DUPLICATE_OFFERING', f'{st3} {r3}')
    st4, r4 = call('POST', R, {'supplier_id': sup, 'name': shared, 'type': 'product', 'status': 'active'})
    check('alta nueva con el nombre ocupado: 409 DUPLICATE_OFFERING', st4 == 409 and r4.get('error', {}).get('code') == 'DUPLICATE_OFFERING', f'{st4} {r4}')
    after = [it for it in (call('GET', f'{R}?page_size=50&q=' + urllib.request.quote(PREFIX))[1].get('items', [])) if it['supplier_id'] == sup and fold(it['name']) == fold(shared)]
    check('el grupo repetido sigue intacto (la prueba se puede repetir)', len(after) == len(group), f'{len(after)} vs {len(group)}')
finally:
    try: call('POST', '/api/v1/auth/logout', {})
    except Exception: pass
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nSuministros repetidos · edición (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
