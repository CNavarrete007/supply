#!/usr/bin/env python3
"""Gestión del Contratista · contrato HTTP de las escrituras (cuenta supplyflow_mgmtwrite_local):
GET write-status, POST/PUT /validations y PUT /strategy/{requisición}.
ESCRIBE en la base: úsese SOLO contra la base sintética/desechable (registra validaciones y planes de abastecimiento en una
requisición sintética; no se pueden eliminar). Exige SF_SYNTHETIC_WRITES=1.
Verifica 401/403/CSRF/415/422 por campo/404/428/412, idempotencia, folio SCI-AAAA-NNNN consecutivo, responsable con usuario
activo, edición con versión (las importadas no se editan), regla «puede cotizar» antes de la estrategia, plan versionado con
lotes/proveedores/partidas, partidas «Precio histórico auto» sin lote, proveedores no asignables, bitácora y que no exista
ninguna ruta para eliminar ni para emitir RFQ.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_NONADMIN_USER=<correo>] python3 tests/contractor_mgmt_write_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
from datetime import date
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1':
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); sys.exit(2)
B = '/api/v1/contractor-management'; V = f'{B}/validations'; results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
RUN = uuid.uuid4().hex[:6].upper(); ZERO = '00000000-0000-4000-8000-000000000000'

class S:
    def __init__(self, email=None):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); self.csrf = ''
        if email:
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
            self.call('POST', '/api/v1/auth/login', {'email': email, 'password': PASSWORD}, key=None)
            self.csrf = self.get('/api/v1/auth/csrf')['csrf_token']
    def get(self, p): return json.loads(self.op.open(API + p).read())
    def call(self, method, path, body=None, key='new', ifm=None, csrf=True, ctype='application/json'):
        h = {'Content-Type': ctype}
        if csrf and self.csrf: h['X-SF-CSRF'] = self.csrf
        if key: h['Idempotency-Key'] = str(uuid.uuid4()) if key == 'new' else key
        if ifm is not None: h['If-Match'] = f'"{ifm}"'
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        try:
            r = self.op.open(urllib.request.Request(API + path, data, h, method=method)); return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}')
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {}, key=None)
        except Exception: pass

def synthetic_requisition(op, run):
    """Requisición sintética propia (Registro RF1) con 2 partidas: las pruebas de escritura no consumen las de otras pruebas."""
    cat = op.get('/api/v1/recovery/catalogs')
    client = next(c for c in cat['clients'] if c['status'] == 'active' and c.get('code'))
    cats = [c['name'] for c in cat['categories'] if c['active']]
    folio = op.get(f"/api/v1/recovery/folio?client_id={client['id']}&date={date.today().isoformat()}&mode=formal")['folio']
    body = {'folio': folio, 'client_id': client['id'], 'request_date': date.today().isoformat(), 'need_date': f'{date.today().year + 1}-03-01', 'project': f'PRY-GC-{run}',
            'contract': 'CTO-QA', 'client_reference': f'GC-{run}', 'priority': 'normal', 'delivery_place': 'Almacén sintético', 'requester_name': 'Solicitante QA',
            'requester_email': 'qa@cliente.invalid', 'budget': '', 'currency': 'MXN', 'description': f'Requisición sintética Gestión del Contratista {run}', 'notes': None,
            'source': {'type': 'Requisición formal del cliente', 'date': date.today().isoformat(), 'reference': None, 'notes': None, 'requirement': 'formal', 'due_date': None, 'owner': None},
            'items': [{'id': None, 'description': f'Guantes sintéticos {run}', 'quantity': '10', 'unit': 'par', 'category': cats[0]},
                      {'id': None, 'description': f'Casco sintético {run}', 'quantity': '2', 'unit': 'pza', 'category': cats[-1]}], 'document': None}
    st, out = op.call('POST', '/api/v1/recovery/requisitions', body)
    if st != 201: raise SystemExit(f'BLOCKED: no se pudo crear la requisición sintética ({st} {out})')
    return out['id']

adm = S(USER)
try:
    st = adm.get(f'{B}/write-status')
    check('write-status: OK, 33 permisos, sin faltantes, sin secretos', st.get('code') == 'OK' and st.get('enabled') is True and st.get('expected_grants') == 33 and st.get('missing_grants') == []
          and not re.search(r'(?i)password|secret|/run/|[0-9a-f]{64}', json.dumps(st)), json.dumps(st))
    setup = adm.get(f'{B}/validation-setup')
    rid = synthetic_requisition(adm, RUN)
    setup = adm.get(f'{B}/validation-setup')
    req = next(r for r in setup['requisitions'] if r['id'] == rid)
    buyer = next(b for b in setup['buyers'] if b['has_user'] and b['with_access'])
    nouser = next((b for b in setup['buyers'] if not b['has_user']), None)
    year = date.today().year
    OK = {'requisition_id': req['id'], 'buyer_id': buyer['id'], 'technical': 'Conforme', 'contract': 'Conforme', 'budget': 'Disponible', 'strategy': 'Competencia abierta',
          'min_quotes': '3', 'deadline': f'{year + 1}-01-15', 'criteria': 'Precio, plazo, calidad, cumplimiento documental', 'notes': f'Validación sintética {RUN}'}

    anon = S()
    check('sin sesión: 401', anon.call('POST', V, OK, csrf=False)[0] == 401)
    if NONADMIN:
        o = S(NONADMIN); check('sin Master Admin: 403', o.call('POST', V, OK)[0] == 403 and o.call('PUT', f"{B}/strategy/{req['id']}", {}, ifm=0)[0] == 403); o.logout()
    check('sin CSRF: 403', adm.call('POST', V, OK, csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('POST', V, b'a=1', ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('POST', V, OK, key=None)[0] == 422)
    bad = [({**OK, 'requisition_id': 'x'}, 'requisition_id'), ({**OK, 'buyer_id': 'x'}, 'buyer_id'), ({**OK, 'technical': 'Excelente'}, 'technical'), ({**OK, 'budget': 'Sobrado'}, 'budget'),
           ({**OK, 'strategy': 'Subasta'}, 'strategy'), ({**OK, 'min_quotes': '0'}, 'min_quotes'), ({**OK, 'min_quotes': '21'}, 'min_quotes'), ({**OK, 'min_quotes': '3a'}, 'min_quotes'),
           ({**OK, 'deadline': '2020-01-01'}, 'deadline'), ({**OK, 'deadline': '2026-02-30'}, 'deadline'), ({**OK, 'criteria': ''}, 'criteria'), ({**OK, 'criteria': 'x' * 1001}, 'criteria'),
           ({**OK, 'strategy': 'Fuente única justificada', 'notes': 'corto'}, 'notes'), ({**OK, 'technical': 'No conforme', 'notes': ''}, 'notes'), ({**OK, 'extra': 1}, 'body')]
    got = [(f, *adm.call('POST', V, b)) for b, f in bad]
    check('cuerpo inválido: 422 INVALID_VALIDATION con el campo', all(s == 422 and r['error']['code'] == 'INVALID_VALIDATION' and r['error'].get('field') == f for f, s, r in got),
          str([(f, s, r.get('error', {}).get('field')) for f, s, r in got if s != 422 or r.get('error', {}).get('field') != f]))
    if nouser:
        s, r = adm.call('POST', V, {**OK, 'buyer_id': nouser['id']})
        check('responsable sin usuario en SupplyFlow: 422 BUYER_UNAVAILABLE', s == 422 and r['error']['code'] == 'BUYER_UNAVAILABLE' and r['error'].get('field') == 'buyer_id', f'{s} {r}')
    check('requisición inexistente: 404', adm.call('POST', V, {**OK, 'requisition_id': ZERO})[0] == 404)

    key = str(uuid.uuid4())
    s, a = adm.call('POST', V, OK, key=key)
    check('alta: 201 con folio SCI-AAAA-NNNN, versión 1 y «puede cotizar»', s == 201 and re.fullmatch(rf'SCI-{year}-\d{{4,}}', a.get('folio', '')) and a.get('version') == 1 and a.get('can_quote') is True, f'{s} {a}')
    s2, a2 = adm.call('POST', V, OK, key=key)
    check('reintento con la misma clave: 200 sin duplicar', s2 == 200 and a2.get('replayed') is True and a2.get('folio') == a.get('folio'))
    check('misma clave con otro contenido: 409', adm.call('POST', V, {**OK, 'min_quotes': '2'}, key=key)[0] == 409)
    s3, b2 = adm.call('POST', V, {**OK, 'notes': f'Segunda validación {RUN}'})
    n1 = int(a['folio'].rsplit('-', 1)[1]); n2 = int(b2.get('folio', 'x-0').rsplit('-', 1)[1])
    check('segunda validación de la misma requisición: folio consecutivo', s3 == 201 and n2 == n1 + 1, f'{a["folio"]} → {b2.get("folio")}')
    det = adm.get(f"{B}/requisitions/{req['id']}")
    mine = next((x for x in det['reviews'] if x['folio'] == b2['folio']), {})
    check('contexto de la requisición: la validación aparece con su responsable y resultados', mine.get('buyer') == buyer['name'] and mine.get('technical') == 'Conforme' and mine.get('min_quotes') == 3 and mine.get('deadline') == OK['deadline'], json.dumps(mine, ensure_ascii=False))
    mx = adm.get(f"{V}?q={b2['folio']}&page=1&page_size=10&buyer=all")
    row = next((x for x in mx['items'] if x['folio'] == b2['folio']), {})
    check('matriz: versión 1, no importada, vigente y «puede cotizar»', row.get('version') == 1 and row.get('imported') is False and row.get('latest') is True and row.get('can_quote') is True, json.dumps(row, ensure_ascii=False)[:300])

    # Edición
    P = f"{V}/{b2['id']}"
    check('edición sin If-Match: 428', adm.call('PUT', P, OK)[0] == 428)
    check('edición de validación inexistente: 404', adm.call('PUT', f'{V}/{ZERO}', OK, ifm=1)[0] == 404)
    check('edición con versión vencida: 412', adm.call('PUT', P, OK, ifm=5)[0] == 412)
    imp = next((x for x in adm.get(f'{V}?page=1&page_size=50&buyer=all')['items'] if x['imported']), None)
    if imp:
        s, r = adm.call('PUT', f"{V}/{imp['id']}", {**OK, 'notes': 'no'}, ifm=imp['version'])
        check('validación importada: 409 IMPORTED_READ_ONLY (se conserva)', s == 409 and r['error']['code'] == 'IMPORTED_READ_ONLY', f'{s} {r}')
    s, u = adm.call('PUT', P, {**OK, 'technical': 'No conforme', 'notes': f'Especificación incompleta {RUN}'}, ifm=1)
    check('edición: 200, versión 2, campos cambiados y ya no puede cotizar', s == 200 and u.get('version') == 2 and set(u.get('changed', [])) == {'technical', 'notes'} and u.get('can_quote') is False, f'{s} {u}')
    s, u2 = adm.call('PUT', P, {**OK, 'technical': 'No conforme', 'notes': f'Especificación incompleta {RUN}'}, ifm=2)
    check('guardar sin cambios: 200 sin campos cambiados ni versión nueva', s == 200 and u2.get('changed') == [] and u2.get('version') == 2)

    # Estrategia
    SP = f"{B}/strategy/{req['id']}"
    sd = adm.get(SP)
    ver = (sd.get('plan') or {}).get('version', 0)
    items = sd['items']; cat = adm.get(f'{B}/strategy-setup')['suppliers']
    sup = [x for x in cat if x['status'] in ('authorized', 'active')]
    bad_sup = next((x for x in cat if x['status'] in ('suspended', 'inactive', 'blocked')), None)
    def plan(lots=None, items_=None, mq='3'):
        return {'min_quotes': mq, 'items': items_ if items_ is not None else [{'id': i['id'], 'strategy': 'Competencia abierta', 'lot': 'L1'} for i in items],
                'lots': lots if lots is not None else [{'key': 'L1', 'name': f'Lote QA {RUN}', 'min_quotes': '2', 'suppliers': [{'id': sup[0]['id'], 'selected': True, 'suggested': True}, {'id': sup[1]['id'], 'selected': False, 'suggested': True}]}]}
    s, r = adm.call('PUT', SP, plan(), ifm=ver)
    check('estrategia con la validación vigente bloqueada: 409 REVIEW_BLOCKS_QUOTING', s == 409 and r['error']['code'] == 'REVIEW_BLOCKS_QUOTING', f'{s} {r}')
    adm.call('PUT', P, {**OK, 'notes': f'Especificación corregida {RUN}'}, ifm=2)
    check('estrategia sin If-Match: 428', adm.call('PUT', SP, plan())[0] == 428)
    check('estrategia con versión vencida: 412', adm.call('PUT', SP, plan(), ifm=ver + 7)[0] == 412)
    s, r = adm.call('PUT', SP, plan(items_=[{'id': i['id'], 'strategy': 'Competencia abierta', 'lot': 'L1'} for i in items[:-1]]), ifm=ver)
    check('partidas incompletas: 409 LINES_CHANGED', s == 409 and r['error']['code'] == 'LINES_CHANGED', f'{s} {r}')
    bads = [plan(lots=[{'key': 'L1', 'name': 'Sin proveedor', 'min_quotes': '2', 'suppliers': [{'id': sup[0]['id'], 'selected': False, 'suggested': True}]}]),
            plan(lots=[{'key': 'L1', 'name': '', 'min_quotes': '2', 'suppliers': [{'id': sup[0]['id'], 'selected': True, 'suggested': False}]}]),
            plan(lots=[{'key': 'L1', 'name': 'A', 'min_quotes': '0', 'suppliers': [{'id': sup[0]['id'], 'selected': True, 'suggested': False}]}]),
            plan(items_=[{'id': i['id'], 'strategy': 'Competencia abierta', 'lot': 'L9'} for i in items]), plan(mq='25'),
            plan(items_=[{'id': i['id'], 'strategy': 'Subasta', 'lot': 'L1'} for i in items])]
    got = [adm.call('PUT', SP, b, ifm=ver) for b in bads]
    check('estrategia inválida: 422 INVALID_STRATEGY (lote sin proveedor, sin nombre, mínimo, lote inexistente, estrategia)', all(s == 422 and r['error']['code'] == 'INVALID_STRATEGY' for s, r in got), str([(s, r.get('error')) for s, r in got if s != 422]))
    if len(items) >= 2:
        two = plan(lots=[{'key': 'L1', 'name': 'Lote', 'min_quotes': '1', 'suppliers': [{'id': sup[0]['id'], 'selected': True, 'suggested': False}]},
                         {'key': 'L2', 'name': ' lote ', 'min_quotes': '1', 'suppliers': [{'id': sup[0]['id'], 'selected': True, 'suggested': False}]}],
                   items_=[{'id': items[0]['id'], 'strategy': 'Competencia abierta', 'lot': 'L1'}] + [{'id': i['id'], 'strategy': 'Competencia abierta', 'lot': 'L2'} for i in items[1:]])
        s, r = adm.call('PUT', SP, two, ifm=ver)
        check('nombres de lote repetidos (sin distinguir mayúsculas ni espacios): 422', s == 422 and r['error'].get('field') == 'lots', f'{s} {r}')
    if bad_sup:
        s, r = adm.call('PUT', SP, plan(lots=[{'key': 'L1', 'name': 'Lote', 'min_quotes': '1', 'suppliers': [{'id': bad_sup['id'], 'selected': True, 'suggested': False}]}]), ifm=ver)
        check('proveedor suspendido/inactivo seleccionado: 422 SUPPLIER_NOT_ASSIGNABLE', s == 422 and r['error']['code'] == 'SUPPLIER_NOT_ASSIGNABLE', f'{s} {r}')
    noRfq = items[-1]['id'] if len(items) >= 2 else None
    its = [{'id': i['id'], 'strategy': 'Precio histórico auto' if i['id'] == noRfq else 'Competencia abierta', 'lot': 'L1'} for i in items]
    good = plan(items_=its)
    k2 = str(uuid.uuid4())
    s, o = adm.call('PUT', SP, good, key=k2, ifm=ver)
    check('estrategia: 200 con plan versión nueva', s == 200 and o.get('plan_version') == ver + 1 and o.get('lots') == 1 and o.get('suppliers') == 1 and o.get('no_rfq_lines') == (1 if noRfq else 0), f'{s} {o}')
    s, o2 = adm.call('PUT', SP, good, key=k2, ifm=ver)
    check('estrategia: reintento con la misma clave sin crear otra versión', s == 200 and o2.get('replayed') is True and o2.get('plan_version') == ver + 1)
    sd2 = adm.get(SP); pl = sd2.get('plan') or {}
    lot = (pl.get('lots') or [{}])[0]
    check('lectura: plan vigente con el lote, sus partidas y proveedores (seleccionado y sugerido)', pl.get('version') == ver + 1 and pl.get('min_quotes') == 3 and lot.get('name') == f'Lote QA {RUN}' and lot.get('min_quotes') == 2
          and {x['id'] for x in lot.get('items', [])} == {i['id'] for i in items if i['id'] != noRfq}
          and sorted((x['id'], x['selected'], x['suggested']) for x in lot.get('suppliers', [])) == sorted([(sup[0]['id'], True, True), (sup[1]['id'], False, True)]), json.dumps(pl, ensure_ascii=False)[:400])
    if noRfq:
        check('partida «Precio histórico auto»: sin lote y registrada en el plan', pl.get('no_rfq_items') == [noRfq], json.dumps(pl.get('no_rfq_items')))
    check('versión anterior: guardar otra vez exige la versión nueva (412)', adm.call('PUT', SP, good, ifm=ver)[0] == 412)
    check('sin rutas para eliminar ni para emitir RFQ (≠ 2xx)', all(not 200 <= adm.call(m, p, {})[0] < 300 for m, p in [('DELETE', P), ('DELETE', SP), ('POST', f'{SP}/rfq'), ('POST', f'{B}/rfqs')]))
    log = adm.get('/api/v1/audit-events?module=contractor_management&page_size=50')['items']
    acts = {x['action'] for x in log if RUN in json.dumps(x, ensure_ascii=False) or a['folio'] in json.dumps(x, ensure_ascii=False) or req['folio'] in json.dumps(x, ensure_ascii=False)}
    check('bitácora: review.create, review.update y strategy.save', {'review.create', 'review.update', 'strategy.save'} <= acts, str(acts))
    print(f"Validaciones sintéticas: {a['folio']}, {b2['folio']} · plan v{ver + 1} de {req['folio']}")
finally:
    adm.logout()

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nGestión del Contratista · escrituras (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
