#!/usr/bin/env python3
"""Requisición › Crear desde historial · contrato HTTP de GET /api/v1/requisition-history/catalog (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, que no exista ninguna ruta de escritura, estructura, totales y orden del historial para cada cliente,
que la política de recompra coincide con la del catálogo de Clientes y que no se expongan ids internos.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/history_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
H = '/api/v1/requisition-history/catalog'; ZERO = '00000000-0000-4000-8000-000000000000'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
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
anon = session(); check('sin sesión: 401', status(anon, f'{H}?client={ZERO}') == 401)
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', status(o, f'{H}?client={ZERO}') == 403); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('422 sin cliente, cliente inválido o parámetro desconocido', all(status(adm, H + q) == 422 for q in ['', '?client=', '?client=abc', f'?client={ZERO}&x=1', '?client=ABCDEF00-0000-4000-8000-00000000000A']))
    check('404 cliente inexistente', status(adm, f'{H}?client={ZERO}') == 404)
    check('sin rutas de escritura (POST/PUT/PATCH/DELETE ≠ 2xx)', all(status(adm, H + q, m) >= 400 for q in ['', f'?client={ZERO}'] for m in ['POST', 'PUT', 'PATCH', 'DELETE']))
    clients = get('/api/v1/recovery/catalogs')['clients']
    ok_struct = ok_totals = ok_order = ok_client = ok_policy = ok_ids = True; with_history = 0; detail = ''
    ikeys = {'key', 'description', 'brand_model', 'unit', 'category', 'occurrences', 'last', 'history'}
    ekeys = {'quote_folio', 'version_number', 'quote_date', 'quote_version_id', 'requisition_folio', 'requisition_id', 'quantity', 'unit_price', 'currency', 'cost', 'original_cost', 'original_cost_currency', 'supplier'}
    for c in clients:
        d = get(f"{H}?client={c['id']}")
        items = d['items']; t = d['totals']
        with_history += 1 if items else 0
        ok_struct = ok_struct and d['read_only'] is True and bool(d['approval_rule']) and all(set(a) == ikeys and set(a['last']) == ekeys and 1 <= len(a['history']) <= 5 and a['history'][0] == a['last'] for a in items)
        ok_totals = ok_totals and t['articles'] == len(items) == len({a['key'] for a in items}) and t['lines'] == sum(a['occurrences'] for a in items) and t['approved_quotes'] <= t['lines']
        ok_order = ok_order and all([h['quote_date'] or '' for h in a['history']] == sorted([h['quote_date'] or '' for h in a['history']], reverse=True) for a in items)
        ok_client = ok_client and d['client']['id'] == c['id'] and d['client']['name'] == c['name']
        rp = get(f"/api/v1/catalogs/clients/{c['id']}")['item'].get('repeat_policy') or {}
        p = d['client']['policy']
        same = all((rp.get(k) in (None, '') and p.get(k) in (None, '')) or str(rp.get(k)) == str(p.get(k)) for k in ('sales_policy', 'sourcing_policy', 'price_validity_days', 'contract_reference', 'contract_valid_until'))
        same = same and ((rp.get('min_margin_pct') in (None, '') and p.get('min_margin_pct') is None) or abs(float(rp.get('min_margin_pct')) - float(p.get('min_margin_pct'))) < 1e-6)
        if not same and not detail: detail = f"{c.get('code')}: {rp} vs {p}"
        ok_policy = ok_policy and same
        ok_ids = ok_ids and not re.search(r'"(organization_id|client_id|customer_quote_version_id|requisition_item_id|award_id|db_id)"\s*:', json.dumps(d))
    check('estructura del catálogo (artículo, último precio/costo/proveedor, historial ≤5)', ok_struct)
    check('totales: artículos únicos y partidas = suma de ocurrencias', ok_totals)
    check('historial del artículo del más reciente al más antiguo', ok_order)
    check('cliente de la respuesta = cliente solicitado', ok_client)
    check('política de recompra = catálogo de Clientes', ok_policy, detail)
    check('sin ids internos', ok_ids)
    check('al menos un cliente con historial aprobado', with_history >= 1, f'{with_history} cliente(s)')
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCrear desde historial (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
