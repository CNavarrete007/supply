#!/usr/bin/env python3
"""Usuarios y roles · contrato HTTP de /users, /roles, /users/functions y /audit-events (SOLO LECTURA).

Solo hace GET (más login/logout), por lo que puede ejecutarse contra la base sintética o contra la base local real
sin modificarla. Verifica:
  - sin sesión: 401 en los 4 endpoints; con Master Admin: 200;
  - (opcional) con un usuario que NO es Master Admin (SF_NONADMIN_USER / SF_NONADMIN_PASSWORD): 403;
  - forma aditiva de /users (role_codes, permission_overrides) y /roles (description, is_system, permissions);
  - /users/functions: un registro por usuario, conteos enteros;
  - /audit-events: validación estricta (422), límites de página, totales coherentes, sin JSON crudo y
    valores de campos sensibles siempre protegidos.

Uso: SF_API=http://127.0.0.1:8080 SF_USER=<correo admin> SF_QA_PASSWORD=<clave> python3 tests/users_audit_http_check.py
"""
import http.cookiejar
import json
import os
import re
import sys
import urllib.error
import urllib.request

API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/')
USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', '')
NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
NONADMIN_PASSWORD = os.environ.get('SF_NONADMIN_PASSWORD', PASSWORD if NONADMIN else '')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD:
    print('BLOCKED: solo API local y SF_QA_PASSWORD.')
    sys.exit(2)
SENSITIVE = re.compile(r'pass|hash|token|secret|clave|contrase|cookie|session|sha256|digest', re.I)
results = []
check = lambda name, ok, detail='': results.append((name, bool(ok), detail))


def session(email=None, password=None):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if email:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/login', json.dumps({'email': email, 'password': password}).encode(),
                                       {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    return op


def status(op, path):
    try:
        return op.open(API + path).status
    except urllib.error.HTTPError as e:
        return e.code


def logout(op):
    try:
        tok = json.loads(op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        op.open(urllib.request.Request(API + '/api/v1/auth/logout', b'{}', {'Content-Type': 'application/json', 'X-SF-CSRF': tok}))
    except Exception:
        pass


ENDPOINTS = ['/api/v1/users?page=1', '/api/v1/roles', '/api/v1/users/functions', '/api/v1/audit-events']
anon = session()
check('sin sesión: 401 en los 4 endpoints', all(status(anon, p) == 401 for p in ENDPOINTS))
admin = session(USER, PASSWORD)
try:
    get = lambda p: json.loads(admin.open(API + p).read())
    check('Master Admin: 200 en los 4 endpoints', all(status(admin, p) == 200 for p in ENDPOINTS))
    if NONADMIN:
        other = session(NONADMIN, NONADMIN_PASSWORD)
        check('usuario sin Master Admin: 403', all(status(other, p) == 403 for p in ENDPOINTS))
        logout(other)
    users, page, total = [], 1, None
    while total is None or len(users) < total:
        body = get(f'/api/v1/users?page={page}'); total = body['total']; users += body['items']; page += 1
        if page > 200:
            break
    check('usuarios: forma aditiva (role_codes, permission_overrides)', users and all(isinstance(u.get('role_codes'), list) and isinstance(u.get('permission_overrides'), list) and len(u['role_codes']) == len(u['roles']) for u in users))
    check('usuarios: nunca se expone hash ni contraseña', all(not any(SENSITIVE.search(k) for k in u) for u in users))
    roles = get('/api/v1/roles')['items']
    check('roles: descripción, sistema y permisos registrados', roles and all({'code', 'name', 'users', 'description', 'is_system', 'permissions'} <= set(r) and isinstance(r['permissions'], list) for r in roles))
    check('roles: usuarios por rol = asignaciones reales', sum(r['users'] for r in roles) == sum(len(u['role_codes']) for u in users))
    fns = get('/api/v1/users/functions')['items']
    check('funciones observadas: un registro por usuario', {f['id'] for f in fns} == {u['id'] for u in users})
    check('funciones observadas: conteos enteros no negativos', all(isinstance(f[k], int) and f[k] >= 0 for f in fns for k in ('po_buyer', 'po_preparer', 'po_authorizer', 'review_buyer', 'rfq_contact', 'audit_actions')))
    for bad in ['x=1', 'page_size=51', 'page=0', 'from=2026-11-01', 'actor=abc', 'module=a%27b', 'from=2026-11-10%2000:00:00&to=2026-11-01%2000:00:00', 'q=' + 'a' * 121]:
        check(f'bitácora: 422 con filtro inválido ({bad[:30]})', status(admin, '/api/v1/audit-events?' + bad) == 422)
    check('funciones: 422 con parámetros', status(admin, '/api/v1/users/functions?page=2') == 422)
    a = get('/api/v1/audit-events?page=1&page_size=50')
    check('bitácora: resumen y facetas', {'total', 'last_24h', 'actors', 'critical'} <= set(a['summary']) and isinstance(a['facets']['modules'], list) and isinstance(a['facets']['actions'], list))
    check('bitácora: total sin filtros = resumen', a['total'] == a['summary']['total'])
    check('bitácora: máximo 50 por página y orden descendente', len(a['items']) <= 50 and all((x['occurred_at'] or x['recorded_at']) >= (y['occurred_at'] or y['recorded_at']) for x, y in zip(a['items'], a['items'][1:])))
    check('bitácora: sin JSON crudo (changes/before/after)', all(not any(k.endswith('_json') for k in e) for e in a['items']))
    leaks = [e['id'] for e in a['items'] for c in e['changes'] if SENSITIVE.search(c['field']) and any(v not in (None, '[protegido]') for v in (c['value'], c['before'], c['after']))]
    check('bitácora: campos sensibles siempre protegidos', not leaks, ', '.join(leaks[:5]))
    if a['facets']['actions']:
        act = a['facets']['actions'][0]
        f = get(f"/api/v1/audit-events?action={urllib.parse.quote(act['code'])}&page_size=1")
        check('bitácora: filtro por acción = conteo de la faceta', f['total'] == act['count'], f"{f['total']} vs {act['count']}")
finally:
    logout(admin)

width = max(len(n) for n, _, _ in results)
for name, ok, detail in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {'' if ok else detail}")
failed = sum(1 for _, ok, _ in results if not ok)
print(f'\nUsuarios, roles y bitácora (HTTP): {len(results) - failed}/{len(results)} PASS')
sys.exit(1 if failed else 0)
