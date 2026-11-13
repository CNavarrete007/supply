#!/usr/bin/env python3
"""Cotizaciones y Comparativo · contrato HTTP de /api/v1/quotes/* (SOLO LECTURA; apto para la base real).
Verifica 401/403/422/404, coherencia de resúmenes, versión vigente por serie, comparativo, que la cotización al cliente no
exponga costos internos, las familias Rev. 0 → Rev. N de /revisions y que no exista ninguna ruta de escritura.
Con SF_ADMIN2_USER (otro Master Admin) comprueba que la elegibilidad para Solicitar modificación es por capturista.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> [SF_NONADMIN_USER=<correo>] python3 tests/quotes_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.parse, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', ''); ADMIN2 = os.environ.get('SF_ADMIN2_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
R = '/api/v1/quotes'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
ZERO = '00000000-0000-4000-8000-000000000000'
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
LISTS = ['/rfqs', '/supplier-quotes', '/comparison', '/customer-quotes', '/awards', '/revisions', '/rfq-setup', '/rfq-requisitions', '/rfq-contacts', '/customer-quote-setup']
EPS = [R + p for p in LISTS]
anon = session(); check('sin sesión: 401', all(status(anon, p) == 401 for p in EPS + [f'{R}/rfqs/{ZERO}']))
if NONADMIN:
    o = session(NONADMIN); check('sin Master Admin: 403', all(status(o, p) == 403 for p in EPS)); logout(o)
adm = session(USER)
try:
    get = lambda p: json.loads(adm.open(API + p).read())
    check('Master Admin: 200', all(status(adm, p) == 200 for p in EPS))
    for bad in ['/rfqs?x=1', '/rfqs?page_size=51', '/rfqs?supplier=abc', '/supplier-quotes?status=%27or', '/comparison?requisition=abc', '/comparison?page=1',
                '/customer-quotes?scope=x', '/customer-quotes?client=1', '/awards?status=%27x', f'/rfqs/{ZERO}?a=1',
                '/revisions?status=superseded', '/revisions?client=1', '/revisions?page_size=51', '/revisions?q=%01',
                '/rfq-setup?x=1', '/rfq-setup?page=1', '/rfq-requisitions?buyer=abc', '/rfq-requisitions?buyer=legacy-xyz', '/rfq-requisitions?supplier=all', f'/rfq-requisitions/{ZERO}?a=1', '/rfq-contacts?page=1', '/rfq-contacts?x=1', '/rfqs?contact=abc', '/rfqs?contact=legacy-12', '/rfq-requisitions?rfq=all', '/rfq-requisitions?rfq=', '/customer-quote-setup?page=1', '/customer-quote-setup?x=1']:
        check(f'422 con parámetro inválido ({bad})', status(adm, R + bad) == 422)
    check('detalle con UUID inexistente: 404', all(status(adm, f'{R}{p}/{ZERO}') == 404 for p in ['/rfqs', '/supplier-quotes', '/customer-quotes', '/rfq-requisitions']))
    check('detalle con identificador no UUID: 404', status(adm, R + '/rfqs/abc') == 404)
    check('sin rutas de escritura (POST/PUT/DELETE ≠ 2xx)', all(status(adm, R + s, m) >= 400 for s in LISTS + [f'/rfqs/{ZERO}', f'/customer-quotes/{ZERO}', f'/rfq-requisitions/{ZERO}'] for m in ['POST', 'PUT', 'DELETE']))

    rf = get(f'{R}/rfqs?page_size=50'); s = rf['summary']
    check('RFQ: resumen coherente', s['total'] == rf['total'] and 0 <= s['responded'] <= s['total'] and 0 <= s['overdue'] <= s['total'] - s['responded'] and sum(x['count'] for x in s['statuses']) == s['total'])
    if rf['items']:
        d = get(f"{R}/rfqs/{rf['items'][0]['id']}")
        check('RFQ: detalle sin precios', d['item']['folio'] == rf['items'][0]['folio'] and len(d['items']) == rf['items'][0]['item_count'] and not any('price' in k or 'amount' in k for i in d['items'] for k in i))
    sq = get(f'{R}/supplier-quotes?page_size=50')
    check('cotizaciones de proveedor: resumen por proveedor = total', sum(x['total'] for x in sq['summary']['suppliers']) == sq['total'] == sum(x['count'] for x in sq['summary']['statuses']))
    if sq['items']:
        d = get(f"{R}/supplier-quotes/{sq['items'][0]['id']}")
        check('cotización de proveedor: detalle con partidas', d['item']['folio'] == sq['items'][0]['folio'] and len(d['items']) >= 1 and 'unit_price' in d['items'][0])
    cm = get(f'{R}/comparison')
    check('comparativo: requisiciones con cotizaciones', all(r['quotes'] >= 1 and r['suppliers'] >= 1 for r in cm['requisitions']))
    if cm['requisitions']:
        d = get(f"{R}/comparison?requisition={cm['requisitions'][0]['id']}")
        check('comparativo: partidas con ofertas por proveedor', d['requisition']['folio'] == cm['requisitions'][0]['folio'] and all({'quote_id', 'supplier_name', 'unit_price', 'currency', 'offered', 'awarded'} <= set(o) for l in d['lines'] for o in l['offers']))
    for rq in cm['requisitions'][:5]:
        d = get(f"{R}/comparison?requisition={rq['id']}"); rr = d['requisition']
        check(f"comparativo {rq['folio']}: contexto de la requisición", rr['id'] == rq['id'] and {'project', 'contract', 'budget_amount', 'currency', 'min_quotes', 'item_count'} <= set(rr) and rr['item_count'] == sum(1 for l in d['lines'] if l['line_status'] == 'active'))
        check(f"comparativo {rq['folio']}: una cotización por oferta registrada", len(d['quotes']) == rq['quotes'] and len({q['supplier_id'] for q in d['quotes']}) == rq['suppliers'] and all(0 <= q['offered_lines'] <= len(d['lines']) and 0 <= q['awarded_lines'] <= q['offered_lines'] for q in d['quotes']))
        qids = {q['id'] for q in d['quotes']}
        check(f"comparativo {rq['folio']}: adjudicación vigente y ofertas ligadas a sus cotizaciones", all(o['quote_id'] in qids for l in d['lines'] for o in l['offers']) and all(l['award'] is None or l['award']['quote_id'] in qids for l in d['lines']))
        check(f"comparativo {rq['folio']}: OC vigentes sin repetir serie", len({o['folio'] for o in d['orders']}) == len(d['orders']) and all(o['item_count'] >= 1 for o in d['orders']))
        check(f"comparativo {rq['folio']}: sin costos internos de margen", not re.search(r'margin|markup|cost_amount', json.dumps(d), re.I))
    cur = get(f'{R}/customer-quotes?page_size=50'); allv = get(f'{R}/customer-quotes?page_size=50&scope=all')
    check('cliente: versión vigente única por serie', len({v['series'] for v in cur['items']}) == len(cur['items']) and allv['total'] >= cur['total'])
    check('cliente: resúmenes coherentes', sum(x['count'] for x in cur['summary']['decisions']) == cur['total'] == sum(c['total'] for c in cur['summary']['clients']) and all(isinstance(m['quotes'], int) for m in cur['summary']['money']))
    if cur['items']:
        d = get(f"{R}/customer-quotes/{cur['items'][0]['id']}"); txt = json.dumps(d)
        check('cliente: detalle sin costos internos', not re.search(r'cost|margin|supplier_unit|markup', txt, re.I) and d['item']['folio'] == cur['items'][0]['folio'])
        check('cliente: historial de versiones de la serie', len(d['versions']) == cur['items'][0]['versions'])
    # Revisiones / modificaciones: una familia por serie, Rev. 0 y revisión vigente reales, grupos y elegibilidad R3A.
    fam = get(f'{R}/revisions?page_size=50'); fs = fam['summary']
    check('revisiones: familias = series vigentes y resumen entero', fs['families'] == fam['total'] == cur['total'] and all(isinstance(v, int) for v in fs.values()))
    check('revisiones: grupos pendiente/aprobada/cerrada suman las familias', fs['pending'] + fs['current_approved'] + fs['closed'] == fs['families'])
    check('revisiones: filtros por grupo en el servidor', all(get(f'{R}/revisions?page_size=50&status={g}')['total'] == fs[k] for g, k in [('pending', 'pending'), ('approved', 'current_approved'), ('closed', 'closed')]))
    check('revisiones: KPI coherentes', 0 <= fs['with_rev_n'] <= fs['families'] and 0 <= fs['approved'] <= fs['families'] and 0 <= fs['linked_cr'] <= fs['families'])
    check('revisiones: sin costos internos', not re.search(r'cost|margin|supplier_unit|markup', json.dumps(fam), re.I))
    BLOCKS = {None, 'imported', 'not_rf1', 'not_owner', 'pending_change'}
    check('revisiones: elegibilidad coherente', all(i['can_request_change'] == (i['change_block'] is None) and i['change_block'] in BLOCKS and (i['change_block'] != 'pending_change' or i['pending_change']) for i in fam['items']))
    for i in fam['items'][:5]:
        d = get(f"{R}/customer-quotes/{i['current_id']}"); vs = d['versions']
        check(f"revisiones {i['series']}: vigente = última versión, Rev. 0 = primera", vs[-1]['id'] == i['current_id'] and len(vs) == i['revisions'] and vs[0]['folio'] == i['rev0_folio']
              and float(vs[0]['total_amount']) == float(i['rev0_total']) and float(vs[-1]['total_amount']) == float(i['current_total']) and i['current_version'] == int(vs[-1]['version_number']))
        hit = get(f"{R}/revisions?page_size=50&q={urllib.parse.quote(i['current_folio'])}")
        check(f"revisiones {i['series']}: búsqueda por folio", any(x['id'] == i['id'] for x in hit['items']))
    check('revisiones: comodín % se trata como texto', get(f'{R}/revisions?q=%25%25%25')['total'] <= fs['families'])
    if ADMIN2 and fam['items']:
        o2 = session(ADMIN2)
        try:
            other = {x['id']: x for x in json.loads(o2.open(API + f'{R}/revisions?page_size=50').read())['items']}
            mine = [i for i in fam['items'] if i['can_request_change']]
            check('revisiones: otro Master Admin no puede solicitar sobre requisiciones ajenas', all(other[i['id']]['change_block'] == 'not_owner' for i in mine), [i['series'] for i in mine])
        finally:
            logout(o2)
    # Tarjeta 3 · RFQ por contacto de compras: tarjetas = matriz filtrada por contacto.
    rc = get(f'{R}/rfq-contacts'); A = rc['all']
    check('RFQ por contacto: Todas = resumen de la matriz', A['rfqs'] == rf['summary']['total'] and A['responded'] == rf['summary']['responded'] and A['overdue'] == rf['summary']['overdue'] and A['contacts'] == len(rc['contacts']))
    check('RFQ por contacto: suma de contactos = total y claves únicas', sum(c['rfqs'] for c in rc['contacts']) == A['rfqs'] and len({c['key'] for c in rc['contacts']}) == len(rc['contacts']))
    check('RFQ por contacto: métricas coherentes', all(0 <= c['responded'] <= c['rfqs'] and 0 <= c['overdue'] <= c['rfqs'] - c['responded'] and 1 <= c['suppliers'] <= c['rfqs'] and 1 <= c['requisitions'] <= c['rfqs'] for c in rc['contacts']))
    for c in rc['contacts'][:6]:
        lst = get(f"{R}/rfqs?page_size=50&contact={c['key']}")
        check(f"RFQ del contacto {c['name'] or c['key']}: filtro en servidor", lst['total'] == c['rfqs'] and all(i['contact_key'] == c['key'] for i in lst['items']) and sum(i['responded'] for i in lst['items']) == c['responded'] if c['rfqs'] <= 50 else lst['total'] == c['rfqs'])
    check('RFQ: columnas de la matriz (referencia, comprador, contacto)', all({'internal_reference', 'project', 'buyer_name', 'contact_name', 'contact_key'} <= set(i) for i in rf['items']))

    # Tarjeta 2 · RFQ: compradores de la validación, requisiciones validadas por comprador y su detalle (solo lectura).
    st = get(f'{R}/rfq-setup'); allreq = get(f'{R}/rfq-requisitions?page_size=50')
    check('RFQ setup: compradores cubren todas las requisiciones validadas', sum(b['requisitions'] for b in st['buyers']) == allreq['total'] and len({b['key'] for b in st['buyers']}) == len(st['buyers']))
    check('RFQ setup: contactos solo de compras/Master Admin', all(set(c['roles'].split(',')) & {'buyer', 'master_admin'} for c in st['contacts']))
    check('RFQ setup: proveedores con estatus y folios por año', all(x['status'] for x in st['suppliers']) and all(re.match(r'^\d{4}$', y) and isinstance(n, int) for y, n in st['folios'].items()) and st['currencies'] == ['MXN', 'USD', 'EUR'])
    for b in st['buyers']:
        lst = get(f"{R}/rfq-requisitions?page_size=50&buyer={b['key']}")
        check(f"RFQ: requisiciones del comprador {b['name'] or b['key']}", lst['total'] == b['requisitions'] and all(i['buyer_key'] == b['key'] for i in lst['items']))
    for i in allreq['items'][:5]:
        d = get(f"{R}/rfq-requisitions/{i['id']}")
        sent = {x['rfq'] for it in d['items'] for x in it['sent_to']}
        check(f"RFQ {i['folio']}: partidas vigentes, RFQ y envíos coherentes", len(d['items']) == i['item_count'] and len(d['rfqs']) == i['rfq_count'] and sent <= {x['folio'] for x in d['rfqs']} and d['item']['folio'] == i['folio'])
        check(f"RFQ {i['folio']}: sin precios ni importes", not re.search(r'price|amount|cost|subtotal', json.dumps(d), re.I))
    # Tarjeta 7 · Formato para el cliente: revisión, emisor, contacto, desglose y lista de todas las revisiones.
    allcq = get(f'{R}/customer-quotes?page_size=50&scope=all')
    check('Formato: la lista trae revisión y referencia del cliente', all(isinstance(x['revision'], int) and x['revision'] >= 0 and 'client_reference' in x for x in allcq['items']))
    for x in allcq['items'][:3]:
        d = get(f"{R}/customer-quotes/{x['id']}"); it = d['item']
        check(f"Formato {x['folio']}: campos del documento externo", it['revision'] == x['revision'] and {'client_contact', 'client_email', 'client_phone', 'project', 'contract', 'client_reference', 'prepared_by_position', 'third_party_taxable_amount', 'service_fee_subtotal_amount'} <= set(it)
              and d['issuer'] is not None and d['issuer'].get('legal_name') and not re.search(r'cost_amount|charge_pct|extra_amount|margin', json.dumps(d), re.I))

    # Tarjeta 6 · Cotización al cliente: requisiciones con ofertas, tipo de cambio registrado y política de aprobación.
    quoted = get(f'{R}/rfq-requisitions?page_size=50&rfq=quoted')
    check('Cotización al cliente: rfq=quoted solo con cotizaciones de proveedor', all(i['quote_count'] > 0 for i in quoted['items']) and quoted['total'] <= allreq['total'])
    cs = get(f'{R}/customer-quote-setup')
    check('Cotización al cliente: emisor de la organización', cs['issuer'] is not None and cs['issuer'].get('legal_name'))
    check('Cotización al cliente: tipo de cambio registrado (o nulo) y políticas vigentes', (cs['fx'] is None or (float(cs['fx']['usd_mxn'] or 1) > 0 and cs['fx']['folio'])) and all(p['comparison_operator'] in ('>', '>=') and p['currency'] for p in cs['policies']))
    for i in quoted['items'][:3]:
        d = get(f"{R}/comparison?requisition={i['id']}")
        cqx = d['customer_quote']
        check(f"Cotización al cliente {i['folio']}: contexto y cotización vigente", {'delivery_place', 'client_tax_id', 'client_code'} <= set(d['requisition']) and (cqx is None or (cqx['revision'] >= 0 and cqx['versions'] >= 1 and cqx['version_number'] >= 1)))

    # Tarjeta 4 · Registro de cotización: solo requisiciones validadas con RFQ; RFQ con proveedor, moneda y cotizaciones.
    withr = get(f'{R}/rfq-requisitions?page_size=50&rfq=with')
    check('Registro: rfq=with ⊆ validadas y todas con RFQ', withr['total'] <= allreq['total'] and all(i['rfq_count'] > 0 for i in withr['items']) and withr['total'] == sum(1 for i in allreq['items'] if i['rfq_count'] > 0) if allreq['total'] <= 50 else all(i['rfq_count'] > 0 for i in withr['items']))
    for i in withr['items'][:5]:
        d = get(f"{R}/rfq-requisitions/{i['id']}")
        rq = {x['folio']: x for x in rf['items']} if rf['total'] <= 50 else {}
        check(f"Registro {i['folio']}: RFQ con proveedor, moneda y cotizaciones", d['rfqs'] and all(x['supplier_code'] and x['currency'] in ('MXN', 'USD', 'EUR') for x in d['rfqs'])
              and all((x['quote_folios'] is not None) == rq[x['folio']]['responded'] for x in d['rfqs'] if x['folio'] in rq))
    if rf['items']:
        d = get(f"{R}/rfqs/{rf['items'][0]['id']}")
        check('RFQ registrada: contacto y referencias para el formato', {'contact_name', 'contact_email', 'contact_phone', 'internal_reference', 'project', 'contract'} <= set(d['item']))
    aw = get(f'{R}/awards?page_size=50'); awa = get(f'{R}/awards?page_size=50&status=all')
    check('adjudicaciones: vigentes ⊆ todas', aw['total'] <= awa['total'] and all(a['superseded_at'] is None for a in aw['items']))
finally:
    logout(adm)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nCotizaciones (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
