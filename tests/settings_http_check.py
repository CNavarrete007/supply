#!/usr/bin/env python3
"""Configuración · pestañas 1 a 5: GET /api/v1/settings, /settings/email-log y /settings/logo (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, que no existan rutas de escritura, contrato de respuesta, filtros y paginación del historial de
correos, logotipo verificado (200 image/* o 404) y ausencia de ids internos. Con SF_SQLQ (comando que ejecuta mariadb con los
argumentos dados, p. ej. `docker exec -i ... mariadb -u<lectura> supplyflow_dev`) compara además los valores con
organization_settings y email_delivery_logs de forma independiente.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] [SF_SQLQ=<cmd>] [SF_ORG_ID=1]
     python3 tests/settings_http_check.py
"""
import http.cookiejar, json, os, re, shlex, subprocess, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', ''); SQLQ = os.environ.get('SF_SQLQ', ''); ORG = int(os.environ.get('SF_ORG_ID', '1'))
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
S, L, G = '/api/v1/settings', '/api/v1/settings/email-log', '/api/v1/settings/logo'

def session(email=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op
def resp(op, path, method='GET', body=None, headers=None):
    try:
        r = op.open(urllib.request.Request(API + path, body, headers or {}, method=method)); return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read()
status = lambda op, path, **k: resp(op, path, **k)[0]
def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']; op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass
def sql(q):
    out = subprocess.run(shlex.split(SQLQ) + ['-N', '-B', '-e', q], capture_output=True, text=True, timeout=60)
    if out.returncode: raise RuntimeError('SF_SQLQ falló (sin mostrar credenciales).')
    return [l.split('\t') for l in out.stdout.splitlines()]

anon = session()
check('sin sesión: 401 en los tres endpoints', all(status(anon, p) == 401 for p in (S, L, G)))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', all(status(o, p) == 403 for p in (S, L, G))); logout(o)
adm = session(USER)
try:
    st, hd, raw = resp(adm, S); s = json.loads(raw)
    check('GET /settings: 200 sin caché', st == 200 and 'no-store' in hd.get('Cache-Control', ''))
    check('422 con parámetros desconocidos', status(adm, S + '?x=1') == 422 and status(adm, L + '?x=1') == 422)
    check('historial: 422 con page_size > 50 o página inválida', status(adm, L + '?page_size=51') == 422 and status(adm, L + '?page=0') == 422 and status(adm, L + '?page=abc') == 422)
    check('logotipo: 404 con parámetros', status(adm, G + '?x=1') == 404)
    tok = json.loads(adm.open(API + '/api/v1/auth/csrf').read())['csrf_token']
    w = {m: status(adm, p, method=m, body=b'{}', headers={'Content-Type': 'application/json', 'X-SF-CSRF': tok}) for m in ('POST', 'PUT', 'PATCH', 'DELETE') for p in (S, L, G)}
    check('sin rutas de escritura (POST/PUT/PATCH/DELETE ≠ 2xx)', all(not 200 <= v < 300 for v in w.values()), json.dumps(w))
    check('contrato: secciones y solo lectura', all(k in s for k in ('identity', 'parameters', 'approvals', 'conditions', 'email', 'currencies', 'meta')) and s.get('read_only') is True and s.get('write_enabled') is False)
    codes = [c['code'] for c in s['currencies']]
    check('monedas del catálogo (código y nombre)', codes and all(re.fullmatch(r'[A-Z]{3}', c) for c in codes) and all(c.get('name') for c in s['currencies']))
    p = s['parameters']
    check('parámetros: moneda registrada y prefijos/enteros coherentes', (not p['currency'] or p['currency'] in codes) and all(p[k] is None or isinstance(p[k], int) for k in ('alert_days', 'min_quotes')))
    a = s['approvals']
    check('aprobaciones: moneda registrada, límites numéricos y política versionada con la misma forma', (not a['currency'] or a['currency'] in codes)
          and all(a[k] is None or isinstance(a[k], (int, float)) for k in ('item_limit', 'total_limit'))
          and (a['policy'] is None or (isinstance(a['policy']['version_number'], int) and a['policy']['version_number'] >= 1)))
    check('condiciones: ES/EN con estado activo', isinstance(s['conditions'], list) and all(set(c) >= {'active', 'es', 'en'} and isinstance(c['active'], bool) for c in s['conditions']))
    e = s['email']
    check('correos: interruptores booleanos y máximo entero', all(isinstance(e[k], bool) for k in ('internal_enabled', 'cc_buyer', 'cc_admin', 'client_enabled', 'req_created', 'process_updates', 'quote_client'))
          and (e['max_recipients'] is None or isinstance(e['max_recipients'], int)) and e['client_language'] in (None, '', 'es', 'en', 'document'))
    blob = json.dumps(s)
    check('sin ids internos, contraseñas ni rutas de almacenamiento', not re.search(r'"(id|organization_id|file_id|user_id|storage_key|password[a-z_]*)"\s*:', blob) and '/run/' not in blob and 'imports/' not in blob)

    # ---- Historial de correos ----
    first = json.loads(adm.open(API + L + '?page=1&page_size=50').read())
    allrows, pg = list(first['items']), 1
    while len(allrows) < first['total'] and pg < 40:
        pg += 1; allrows += json.loads(adm.open(API + L + f'?page={pg}&page_size=50').read())['items']
    check('historial: total = filas paginadas; orden descendente por fecha', len(allrows) == first['total'] and all((x['occurred_at'] or '') >= (y['occurred_at'] or '') for x, y in zip(allrows, allrows[1:])))
    check('historial: facetas de resultado suman el total', sum(x['count'] for x in first['statuses']) == first['total'])
    check('historial: destinatarios Para/CC/CCO sin vacíos', all(r['kind'] in ('Para', 'CC', 'CCO') and r['address'] for x in allrows for r in x['recipients']))
    if first['statuses']:
        st0 = first['statuses'][0]
        f = json.loads(adm.open(API + L + '?status=' + urllib.request.quote(st0['status']) + '&page_size=50').read())
        check('filtro de resultado: total = faceta y todas las filas con ese resultado', f['total'] == st0['count'] and all(x['status'] == st0['status'] for x in f['items']))
    if allrows:
        ref = next((x['reference'] for x in allrows if x['reference']), '')
        q = json.loads(adm.open(API + L + '?q=' + urllib.request.quote(ref) + '&page_size=50').read()) if ref else {'items': [], 'total': 0}
        check('búsqueda: el texto de una referencia la encuentra', not ref or (q['total'] >= 1 and any(x['reference'] == ref for x in q['items'])))
    nada = json.loads(adm.open(API + L + '?q=zz-sin-coincidencias-qa-zz').read())
    check('búsqueda sin coincidencias: 0 filas', nada['total'] == 0 and nada['items'] == [])
    check('historial sin ids internos', not re.search(r'"(id|organization_id|legacy_id|event_key|sender_snapshot)"\s*:', json.dumps(first)))

    # ---- Logotipo ----
    st, hd, raw = resp(adm, G)
    if s['identity']['logo']['configured']:
        check('logotipo: 200 imagen verificada o 404 si el archivo no está en este equipo', (st == 200 and hd.get('Content-Type', '').startswith('image/') and len(raw) > 0 and hd.get('X-Content-Type-Options') == 'nosniff'
                                                                                              and 'sandbox' in hd.get('Content-Security-Policy', '') and 'no-store' in hd.get('Cache-Control', '')) or st == 404, f'{st} {hd.get("Content-Type")}')
    else:
        check('logotipo no configurado: 404', st == 404)

    # ---- Comparación independiente con MariaDB (opcional) ----
    if SQLQ:
        groups = {g: json.loads(j) for g, j in sql(f'SELECT settings_group, settings_json FROM organization_settings WHERE organization_id={ORG}')}
        b, loc, pur, qp = groups.get('legacy_branding', {}), groups.get('legacy_localization', {}), groups.get('legacy_purchasing', {}), groups.get('legacy_quote_policy', {})
        num = lambda v: None if v in (None, '') else float(v)
        check('SQL: identidad e idiomas = organization_settings', s['identity']['system_name'] == b.get('systemName') and s['identity']['company'] == b.get('company')
              and s['identity']['document_language'] == loc.get('documentLanguage') and s['identity']['client_document_language'] == loc.get('clientDocumentLanguage'))
        check('SQL: parámetros = legacy_purchasing', p['currency'] == pur.get('currency') and p['req_prefix'] == pur.get('reqPrefix') and p['po_prefix'] == pur.get('poPrefix')
              and num(p['tax_pct']) == num(pur.get('tax')) and num(p['min_quotes']) == num(pur.get('minQuotes')))
        check('SQL: aprobaciones = legacy_quote_policy', a['enabled'] == qp.get('customerQuoteApprovalEnabled') and num(a['item_limit']) == num(qp.get('customerQuoteItemApprovalLimit'))
              and num(a['total_limit']) == num(qp.get('customerQuoteTotalApprovalLimit')))
        conds = groups.get('legacy_quote_conditions', {}).get('customerQuoteDefaultConditions', [])
        check('SQL: condiciones = legacy_quote_conditions', [(bool(c.get('active')), c.get('es'), c.get('en')) for c in conds] == [(c['active'], c['es'], c['en']) for c in s['conditions']])
        em = groups.get('legacy_email', {})
        check('SQL: correos = legacy_email', e['sender_name'] == em.get('emailSenderName') and e['cc_admin'] == bool(em.get('emailCcAdmin')) and e['client_enabled'] == bool(em.get('emailClientEnabled')))
        n = int(sql(f'SELECT COUNT(*) FROM email_delivery_logs WHERE organization_id={ORG}')[0][0])
        check('SQL: historial completo = email_delivery_logs', first['total'] == n, f"{first['total']} vs {n}")
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nConfiguración (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
