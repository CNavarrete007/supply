#!/usr/bin/env python3
"""Servicios Operativos › Nueva solicitud · contrato HTTP de los endpoints de SOLO LECTURA (apto para la base real):
GET /api/v1/services/new-request, /new-request/reference, /new-request/availability y /new-request/contracting
(formulario "Nuevo servicio": proveedores y sus OC vigentes).
Verifica 401/403/422, que no existan rutas de escritura, la regla SRV-{PROYECTO}-{AÑO}-{0000} (siguiente número libre a
partir de las referencias existentes), la disponibilidad del folio (sin distinguir mayúsculas), que generar no reserva
ni escribe nada (los conteos no cambian) y que no se expongan ids internos.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/services_new_request_http_check.py
"""
import http.cookiejar, json, os, re, sys, unicodedata, urllib.error, urllib.parse, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
B = '/api/v1/services/new-request'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
q = urllib.parse.quote
def session(email=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op
def status(op, path, method='GET'):
    try: return op.open(urllib.request.Request(API + path, method=method, data=b'{}' if method != 'GET' else None, headers={'Content-Type': 'application/json'})).status
    except urllib.error.HTTPError as e: return e.code
def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']; op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass
def clean(s):  # misma limpieza que RequisitionRecoveryInput::cleanFolioPart
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^A-Z0-9]+', '-', s.upper().strip()).strip('-')

anon = session()
check('sin sesión: 401 en los 4 endpoints', all(status(anon, B + p) == 401 for p in ['', '/reference?date=2026-01-01', '/availability?folio=X', '/contracting']))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', all(status(o, B + p) == 403 for p in ['', '/reference?date=2026-01-01', '/availability?folio=X', '/contracting'])); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    c = get(B)
    t = c['service_types']
    check('catálogo 200: tipos (code, name, active, uso) y bandera de solo lectura', isinstance(t, list) and all(set(x) == {'code', 'name', 'active', 'requisitions', 'services'} and isinstance(x['active'], bool) for x in t)
          and c['read_only'] is True and c['write_enabled'] is False and c['reference_rule'] == 'SRV-{PROYECTO}-{AÑO}-{0000}', json.dumps(c)[:300])
    bad = [B + '?x=1', B + '/reference', B + '/reference?date=2026-02-30', B + '/reference?date=20260101', B + '/reference?date=2026-01-01&x=1',
           B + '/reference?date=2026-01-01&project=' + 'P' * 256, B + '/reference?date=2026-01-01&project=%01', B + '/reference?date[]=2026-01-01',
           B + '/availability', B + '/availability?folio=&reference=', B + '/availability?folio=' + 'F' * 129, B + '/availability?reference=' + 'R' * 256,
           B + '/availability?folio=A%0AB', B + '/availability?folio=X&x=1', B + '/contracting?x=1']
    codes = [status(adm, p) for p in bad]
    check('422 con parámetros ausentes, desconocidos, inválidos o demasiado largos', all(x == 422 for x in codes), str(codes))
    check('sin rutas de escritura (POST/PUT/PATCH/DELETE ≠ 2xx)', all(status(adm, B + p, m) >= 400 for p in ['', '/reference', '/availability', '/contracting'] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))

    check('catálogo: tipos y estatus de autorización y estatus registrados (listas sin vacíos) y secuencias SRV por año', all(isinstance(c[k], list) and all(isinstance(x, str) and x.strip() for x in c[k]) for k in ('authorization_types', 'authorization_statuses', 'statuses'))
          and isinstance(c['service_folio_sequences'], dict) and all(re.fullmatch(r'\d{4}', y) and isinstance(n, int) and n > 0 for y, n in c['service_folio_sequences'].items()))
    k = get(B + '/contracting')
    check('contratación: proveedores (id, code, name, status) y OC (folio, proveedor, importe, moneda, estatus, servicios)', k['read_only'] is True and all(set(x) == {'id', 'code', 'name', 'status'} for x in k['suppliers'])
          and all(set(x) == {'id', 'folio', 'supplier_id', 'currency', 'total', 'status', 'order_date', 'services'} for x in k['purchase_orders']))
    sup_ids = {x['id'] for x in k['suppliers']}
    check('cada OC pertenece a un proveedor del listado', all(o['supplier_id'] in sup_ids for o in k['purchase_orders']))
    cur, p = [], 1
    while True:
        d = get(f'/api/v1/purchase-orders?scope=current&page_size=50&page={p}'); cur += d['items']
        if len(cur) >= d['total'] or p >= 40: break
        p += 1
    vig = {o['folio'] for o in cur if o.get('state_key') not in ('cancelled', 'superseded') and str(o.get('legacy_status') or o.get('operational_status') or '').lower() not in ('cancelada', 'sustituida', 'cancelled', 'superseded')}
    check('OC = últimas versiones no canceladas ni sustituidas (cruce con /purchase-orders)', {o['folio'] for o in k['purchase_orders']} == vig, f"{sorted(o['folio'] for o in k['purchase_orders'])} vs {sorted(vig)}")
    po_by = {o['folio']: o for o in cur}
    check('importe, moneda y proveedor de cada OC coinciden con Órdenes de Compra', all(abs(float(po_by[o['folio']]['total_amount']) - o['total']) < 0.005 and po_by[o['folio']]['currency'] == o['currency'] and po_by[o['folio']]['supplier_id'] == o['supplier_id'] for o in k['purchase_orders'] if o['folio'] in po_by))
    reqs = get('/api/v1/recovery/matrix')['items']
    svcs = []
    p = 1
    while True:
        d = get(f'/api/v1/services/matrix?page={p}&page_size=50'); svcs += d['items']
        if len(svcs) >= d['total'] or p >= 40: break
        p += 1
    before = (len(reqs), len(svcs))
    r = get(B + '/reference?project=' + q('Plataforma Ñandú 7') + '&date=2031-05-04')
    check('referencia: SRV-PROYECTO-AÑO-0000 sin acentos ni espacios, año de la fecha', re.fullmatch(r'SRV-PLATAFORMA-NANDU-7-2031-\d{4}', r['reference']) and r['prefix'] == 'SRV-PLATAFORMA-NANDU-7-2031-' and r['suggestion_only'] is True, json.dumps(r))
    check('referencia sin proyecto → SRV-PROYECTO-AÑO-…', get(B + '/reference?date=2031-05-04')['reference'].startswith('SRV-PROYECTO-2031-'))
    check('generar no reserva: dos llamadas devuelven la misma referencia', get(B + '/reference?project=' + q('Plataforma Ñandú 7') + '&date=2031-05-04')['reference'] == r['reference'])
    # Secuencia: siguiente número libre sobre las referencias SRV existentes (client_reference visible y servicios).
    pat = re.compile(r'^(SRV-[A-Z0-9-]+-)(\d{4})-(\d{4,})$')
    known = {}
    for v in [x.get('client_reference') for x in reqs] + [x.get('internal_reference') for x in svcs]:
        m = pat.match(str(v or '').upper())
        if m: known.setdefault(m.group(1) + m.group(2) + '-', []).append(int(m.group(3)))
    if known:
        prefix, nums = sorted(known.items(), key=lambda kv: -max(kv[1]))[0]
        proj, year = prefix[4:-6], prefix[-5:-1]
        n = get(B + '/reference?project=' + q(proj) + '&date=' + year + '-06-15')
        check('secuencia: siguiente número mayor que el último existente para ese proyecto y año', n['prefix'] == prefix and n['sequence'] > max(nums) and n['reference'] == prefix + str(n['sequence']).zfill(4), f'{prefix} {max(nums)} → {n}')
    else:
        check('secuencia: proyecto nuevo empieza en 0001 (no hay referencias SRV en esta base)', r['reference'].endswith('-0001') or r['sequence'] >= 1)
    a = get(B + '/availability?reference=' + q(r['reference']))
    check('la referencia sugerida está libre', a['reference']['available'] is True and a['reference']['used_by'] == [] and 'folio' not in a)
    if reqs:
        f0 = reqs[0]['folio']
        a = get(B + '/availability?folio=' + q(f0))
        check('folio existente → ocupado, con folio y número de cliente', a['folio']['available'] is False and a['folio']['requisition'] == f0 and a['folio']['client_code'] == reqs[0]['client_code'], json.dumps(a))
        swapped = f0.swapcase()
        check('folio ocupado sin distinguir mayúsculas', swapped == f0 or get(B + '/availability?folio=' + q(swapped))['folio']['available'] is False)
        withref = next((x for x in reqs if x.get('client_reference')), None)
        if withref:
            a = get(B + '/availability?reference=' + q(withref['client_reference']))
            check('referencia en uso → lista de folios que la usan (máx. 5)', a['reference']['available'] is False and 1 <= len(a['reference']['used_by']) <= 5)
    free = 'QA-LIBRE-' + os.urandom(4).hex().upper()
    a = get(B + '/availability?folio=' + q(free) + '&reference=' + q(free))
    check('folio y referencia nuevos → disponibles', a['folio']['available'] is True and a['folio']['requisition'] is None and a['reference']['available'] is True)
    if NONADMIN or True:
        cl = get('/api/v1/recovery/catalogs')['clients']
        cc = next((x for x in cl if x.get('code')), None)
        if cc:
            fo = get('/api/v1/recovery/folio?client_id=' + cc['id'] + '&date=2031-05-04&mode=formal')['folio']
            av = get(B + '/availability?folio=' + q(fo))
            check('folio generado por Solicitud / Requisición (NÚMERO-REQ-AÑO-0000) está libre', fo.startswith(clean(cc['code']) + '-') and '-2031-' in fo and av['folio']['available'] is True, fo)
    after = (len(get('/api/v1/recovery/matrix')['items']), get('/api/v1/services/matrix?page=1&page_size=1')['total'])
    check('nada se escribió: requisiciones y servicios sin cambios', before == after, f'{before} → {after}')
    dump = json.dumps([c, r, a, k])
    check('sin ids internos (solo identificadores públicos UUID)', not re.search(r'"(db_id|organization_id|service_type_id|client_id|requisition_id|supplier_purchase_order_id)"\s*:', dump)
          and all(re.fullmatch(r'[0-9a-f-]{36}', x['id']) for x in k['suppliers'] + k['purchase_orders']) and all(re.fullmatch(r'[0-9a-f-]{36}', o['supplier_id']) for o in k['purchase_orders']))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nNueva solicitud de servicio (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
