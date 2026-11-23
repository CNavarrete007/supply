#!/usr/bin/env python3
"""Campana de notificaciones · GET /api/v1/notifications (SOLO LECTURA; apto para la base real).
Verifica 401/422, que no existan rutas de escritura, que cada usuario vea SOLO sus notificaciones, filtro de no leídas,
paginación y orden, documentos ligados y ausencia de ids internos. Cruza las no leídas de OC con /purchase-orders/tasks
(regla independiente de Órdenes de Compra). Con SF_SQLQ compara además con la tabla notifications por destinatario.
Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo> SF_QA_PASSWORD=<clave> [SF_OTHER_USER=<otro correo>] [SF_SQLQ=<cmd mariadb>] python3 tests/notifications_http_check.py
"""
import http.cookiejar, json, os, re, shlex, subprocess, sys, urllib.error, urllib.request
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); OTHER = os.environ.get('SF_OTHER_USER', ''); SQLQ = os.environ.get('SF_SQLQ', '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD: print('BLOCKED: solo API local y SF_QA_PASSWORD.'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
N = '/api/v1/notifications'
KINDS = {'client', 'supplier', 'project', 'contract', 'requisition', 'review', 'rfq', 'supplier_quote', 'customer_quote', 'customer_quote_version', 'purchase_order',
         'goods_receipt', 'delivery', 'service_order', 'requisition_change_request', 'purchase_order_modification_request', 'invoice'}

def session(email=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': PASSWORD}).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op
def status(op, path, method='GET', body=None, headers=None):
    try: return op.open(urllib.request.Request(API + path, body, headers or {}, method=method)).status
    except urllib.error.HTTPError as e: return e.code
def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']; op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception: pass
def everything(op, st='all'):
    out, p = [], 1
    while True:
        d = json.loads(op.open(API + f'{N}?status={st}&page={p}&page_size=50').read()); out += d['items']
        if len(out) >= d['total'] or p >= 200: return out, d
        p += 1
def sql(q):
    r = subprocess.run(shlex.split(SQLQ) + ['-N', '-B', '-e', q], capture_output=True, text=True, timeout=60)
    if r.returncode: raise RuntimeError('SF_SQLQ falló (sin mostrar credenciales).')
    return [l.split('\t') for l in r.stdout.splitlines()]

check('sin sesión: 401', status(session(), N) == 401)
me = session(USER)
try:
    check('422 con parámetros inválidos', all(status(me, N + q) == 422 for q in ['?x=1', '?status=read', '?page_size=51', '?page=0']))
    tok = json.loads(me.open(API + '/api/v1/auth/csrf').read())['csrf_token']
    w = [status(me, N + sfx, m, b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}) for m in ('POST', 'PUT', 'PATCH', 'DELETE') for sfx in ('', '/read', '/read-all')]
    check('sin rutas de escritura (marcar como leída no existe)', all(not 200 <= x < 300 for x in w), str(w))
    first = json.loads(me.open(API + N + '?page_size=5').read())
    check('contrato: solo lectura y marcar como leída deshabilitado', first['read_only'] is True and first['mark_read_enabled'] is False and set(first['summary']) == {'total', 'unread'})
    allrows, d = everything(me)
    check('paginación: filas = total = resumen', len(allrows) == d['total'] == d['summary']['total'] and len({x['id'] for x in allrows}) == len(allrows))
    check('orden: más recientes primero', all(x['created_at'] >= y['created_at'] for x, y in zip(allrows, allrows[1:])))
    unread, du = everything(me, 'unread')
    check('no leídas: total = resumen y todas con is_read=false', du['total'] == d['summary']['unread'] == sum(1 for x in allrows if not x['is_read']) and all(not x['is_read'] for x in unread))
    check('documento ligado: tipo conocido e id público', all(x['entity'] is None or (x['entity']['kind'] in KINDS and re.fullmatch(r'[0-9a-f-]{36}', x['entity']['id'])) for x in allrows))
    tasks = json.loads(me.open(API + '/api/v1/purchase-orders/tasks').read())
    check('no leídas de OC = Órdenes de Compra (/purchase-orders/tasks)', sum(1 for x in unread if x['entity'] and x['entity']['kind'] == 'purchase_order') == tasks['notifications_unread'])
    check('sin ids internos ni destinatario', not re.search(r'"(recipient_user_id|sender_user_id|organization_id|entity_id|legacy_id|db_id)"\s*:', json.dumps(allrows)))
    if OTHER:
        other = session(OTHER)
        try:
            orows, od = everything(other)
            check('aislamiento: otro usuario no ve ninguna notificación ajena', not ({x['id'] for x in orows} & {x['id'] for x in allrows}), f"{len(orows)} vs {len(allrows)}")
        finally:
            logout(other)
    if SQLQ:
        mine = sql("SELECT COUNT(*),COALESCE(SUM(n.is_read=0),0) FROM notifications n JOIN users u ON u.id=n.recipient_user_id AND u.organization_id=n.organization_id"
                   f" WHERE u.normalized_login_email=LOWER('{USER.replace(chr(39), '')}')")[0]
        check('SQL: total y no leídas = notifications del destinatario', [d['summary']['total'], d['summary']['unread']] == [int(mine[0]), int(mine[1])], f"{d['summary']} vs {mine}")
finally:
    logout(me)
w = max(len(n) for n, _, _ in results)
for n, ok, dd in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else dd}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nNotificaciones (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
