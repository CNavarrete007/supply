#!/usr/bin/env python3
"""Usuarios y roles · gestión de acceso (POST /api/v1/users/{id}/access, POST /api/v1/auth/password/change, login).
ESCRIBE credenciales y roles: úsese SOLO contra la base sintética con un usuario OBJETIVO sintético (por omisión
qa.reviewer.c@supplyflow.invalid, sin rol ni credencial al sembrarse) y, opcionalmente, uno inactivo (qa.inactive.d). Exige
SF_SYNTHETIC_WRITES=1. Al terminar el objetivo queda SIN rol Master Admin y sin acceso.
Verifica: estado de la cuenta useradmin; 401/403/CSRF/415/422/428/404; reautenticación del administrador; nunca sobre la propia
cuenta ni sobre inactivos; versión (412); idempotencia (la contraseña temporal NO se repite al reintentar); login con contraseña
temporal → 409 PASSWORD_CHANGE_REQUIRED sin sesión; reglas de la contraseña nueva; cambio → acceso como Master Admin; restablecer
revoca sesiones; retirar el rol deshabilita el acceso; bitácora sin contraseñas ni hashes.
Uso: SF_API=http://127.0.0.1:8090 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_ACCESS_TARGET=<correo>] [SF_INACTIVE_TARGET=<correo>] [SF_NONADMIN_USER=<correo>] python3 tests/user_access_http_check.py
"""
import http.cookiejar, json, os, re, sys, urllib.error, urllib.request, uuid
API = os.environ.get('SF_API', 'http://127.0.0.1:8090').rstrip('/'); USER = os.environ.get('SF_USER', 'qa.admin.a@supplyflow.invalid')
PASSWORD = os.environ.get('SF_QA_PASSWORD', ''); NONADMIN = os.environ.get('SF_NONADMIN_USER', '')
TARGET = os.environ.get('SF_ACCESS_TARGET', 'qa.reviewer.c@supplyflow.invalid'); INACTIVE = os.environ.get('SF_INACTIVE_TARGET', 'qa.inactive.d@supplyflow.invalid')
if not re.match(r'^http://(127\.0\.0\.1|localhost)(:\d+)?$', API) or not PASSWORD or os.environ.get('SF_SYNTHETIC_WRITES') != '1' or not TARGET.endswith('.invalid'):
    print('BLOCKED: solo API local con base sintética, SF_QA_PASSWORD, SF_SYNTHETIC_WRITES=1 y un objetivo sintético (.invalid).'); sys.exit(2)
results = []; check = lambda n, ok, d='': results.append((n, bool(ok), d))
REASON = 'Segundo Master Admin para revisión independiente (sintético).'

class S:
    def __init__(self, email=None, password=None):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.login_status = None
        if email: self.login_status, self.login_body = self.call('POST', '/api/v1/auth/login', {'email': email, 'password': password or PASSWORD}, key=None)
    def get(self, p):
        try: r = self.op.open(API + p); return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
    def call(self, method, path, body=None, key='new', ifm=None, csrf=True, ctype='application/json'):
        h = {'Content-Type': ctype}
        if csrf: h['X-SF-CSRF'] = json.loads(self.op.open(API + '/api/v1/auth/csrf').read())['csrf_token']
        if key: h['Idempotency-Key'] = str(uuid.uuid4()) if key == 'new' else key
        if ifm is not None: h['If-Match'] = f'"{ifm}"'
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        try: r = self.op.open(urllib.request.Request(API + path, data, h, method=method)); return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
    def logout(self):
        try: self.call('POST', '/api/v1/auth/logout', {}, key=None)
        except Exception: pass

adm = S(USER)
def users(): return {u['email']: u for u in adm.get('/api/v1/users?page=1')[1]['items']}
def act(u, action, pw=PASSWORD, reason=REASON, **kw): return adm.call('POST', f"/api/v1/users/{u['id']}/access", {'action': action, 'actor_password': pw, 'reason': reason}, ifm=u['version'], **kw)
try:
    st, s = adm.get('/api/v1/users/access-status')
    check('estado de la cuenta useradmin: OK, 18 permisos, sin secretos', st == 200 and s.get('code') == 'OK' and s.get('expected_grants') == 18 and s.get('missing_grants') == []
          and not re.search(r'(?i)password|secret|/run/|\.txt|[0-9a-f]{64}', json.dumps(s)), json.dumps(s))
    check('estado: parámetros desconocidos → 422', adm.get('/api/v1/users/access-status?x=1')[0] == 422)
    U = users(); t = U.get(TARGET); me = U.get(USER)
    if not t: print(f'BLOCKED: no existe el usuario objetivo {TARGET}.'); sys.exit(2)
    if 'master_admin' in t['role_codes']:  # estado inicial limpio
        act(t, 'revoke_master_admin'); t = users()[TARGET]
    P = f"/api/v1/users/{t['id']}/access"
    anon = S()
    check('sin sesión: 401', anon.call('POST', P, {'action': 'grant_master_admin', 'actor_password': 'x', 'reason': REASON}, ifm=t['version'], csrf=False)[0] == 401)
    if NONADMIN:
        o = S(NONADMIN); check('sin Master Admin: 403 (acción y estado)', o.call('POST', P, {'action': 'grant_master_admin', 'actor_password': PASSWORD, 'reason': REASON}, ifm=t['version'])[0] == 403 and o.get('/api/v1/users/access-status')[0] == 403); o.logout()
    body = {'action': 'grant_master_admin', 'actor_password': PASSWORD, 'reason': REASON}
    check('sin CSRF: 403', adm.call('POST', P, body, ifm=t['version'], csrf=False)[0] == 403)
    check('sin JSON: 415', adm.call('POST', P, b'a=1', ifm=t['version'], ctype='application/x-www-form-urlencoded')[0] == 415)
    check('sin Idempotency-Key: 422', adm.call('POST', P, body, ifm=t['version'], key=None)[0] == 422)
    check('sin If-Match: 428', adm.call('POST', P, body)[0] == 428)
    bad = [({**body, 'action': 'make_god'}, 'action'), ({**body, 'reason': 'corto'}, 'reason'), ({**body, 'actor_password': ''}, 'actor_password'), ({**body, 'role': 'x'}, 'body'), (['x'], 'body')]
    got = [(f, *adm.call('POST', P, b, ifm=t['version'])) for b, f in bad]
    check('cuerpo inválido: 422 con el campo', all(s == 422 and r['error'].get('field') == f for f, s, r in got), str([(f, s, r.get('error', {}).get('field')) for f, s, r in got]))
    s, r = act(t, 'grant_master_admin', pw=PASSWORD + 'x')
    check('reautenticación: contraseña del administrador incorrecta → 403 REAUTH_FAILED, sin cambios', s == 403 and r['error']['code'] == 'REAUTH_FAILED' and users()[TARGET]['version'] == t['version'], f'{s} {r}')
    check('nunca sobre la propia cuenta: 409 SELF_NOT_ALLOWED', act(me, 'reset_password')[1].get('error', {}).get('code') == 'SELF_NOT_ALLOWED')
    ina = users().get(INACTIVE)
    if ina: check('usuario inactivo: 409 USER_INACTIVE', act(ina, 'grant_master_admin')[1].get('error', {}).get('code') == 'USER_INACTIVE')
    check('usuario inexistente: 404', adm.call('POST', '/api/v1/users/00000000-0000-4000-8000-000000000000/access', body, ifm=1)[0] == 404)
    check('versión vencida: 412 STALE_VERSION', adm.call('POST', P, body, ifm=t['version'] + 7)[0] == 412)
    check('retirar a quien no es Master Admin: 409 NOT_MASTER_ADMIN', act(t, 'revoke_master_admin')[1].get('error', {}).get('code') == 'NOT_MASTER_ADMIN')

    key = str(uuid.uuid4())
    had_cred = t['credential_state'] == 'local_validated'
    s, g = act(t, 'grant_master_admin', key=key)
    check('habilitar: 200, Master Admin con acceso; contraseña temporal solo si no tenía credencial', s == 200 and g.get('master_admin') is True and g.get('access_enabled') is True
          and g.get('temporary_password_issued') == (not had_cred) and bool(g.get('temporary_password')) == (not had_cred), json.dumps({k: v for k, v in g.items() if k != 'temporary_password'}))
    s2, g2 = act(t, 'grant_master_admin', key=key)
    check('reintento con la misma clave: 200 repetido SIN volver a mostrar la contraseña', s2 == 200 and g2.get('replayed') is True and g2.get('temporary_password') is None and g2.get('version') == g.get('version'), json.dumps(g2))
    check('misma clave con otro contenido: 409', adm.call('POST', P, {**body, 'reason': REASON + ' otro'}, key=key, ifm=t['version'])[1].get('error', {}).get('code') == 'IDEMPOTENCY_CONFLICT')
    t = users()[TARGET]
    check('matriz de usuarios: rol master_admin, acceso y versión nueva', 'master_admin' in t['role_codes'] and t['access_enabled'] is True and t['version'] == g.get('version'))
    # Contraseña temporal (si ya tenía credencial, se restablece para probar el flujo completo).
    s, rp = act(t, 'reset_password')
    temp = rp.get('temporary_password')
    check('restablecer: contraseña temporal de 4 grupos y vencimiento en 72 h', s == 200 and re.fullmatch(r'([A-Za-z2-9]{4}-){3}[A-Za-z2-9]{4}', temp or '') and rp.get('credential_state') == 'reset_required' and rp.get('temporary_password_expires_at'), json.dumps({k: v for k, v in rp.items() if k != 'temporary_password'}))
    c = S(TARGET, temp)
    check('login con la contraseña temporal: 409 PASSWORD_CHANGE_REQUIRED y sin sesión', c.login_status == 409 and c.login_body['error']['code'] == 'PASSWORD_CHANGE_REQUIRED' and c.get('/api/v1/auth/me')[0] == 401, f'{c.login_status} {c.login_body}')
    check('login con contraseña incorrecta: 401 (no revela que existe una temporal)', S(TARGET, 'NoEs-' + uuid.uuid4().hex).login_status == 401)
    weak = [('corta1A', 'entre 12'), ('soloLetrasSinNumeros', 'letras y números'), (temp, 'distinta'), ('qa.reviewer.c-2026x', 'usuario')]
    w_res = [c.call('POST', '/api/v1/auth/password/change', {'email': TARGET, 'current_password': temp, 'new_password': n}, key=None) for n, _ in weak]
    check('contraseña nueva débil: 422 WEAK_PASSWORD con el motivo', all(s == 422 and r['error']['code'] == 'WEAK_PASSWORD' and m in r['error']['message'] for (s, r), (_, m) in zip(w_res, weak)), str([(s, r.get('error', {}).get('message')) for s, r in w_res]))
    check('cambio con la contraseña actual incorrecta: 401', c.call('POST', '/api/v1/auth/password/change', {'email': TARGET, 'current_password': 'x' + temp, 'new_password': 'Nueva-Clave-2026-QA'}, key=None)[0] == 401)
    newpw = 'Revisor-' + uuid.uuid4().hex[:10] + '-9Q'
    s, r = c.call('POST', '/api/v1/auth/password/change', {'email': TARGET, 'current_password': temp, 'new_password': newpw}, key=None)
    check('cambio de contraseña: 200 password_changed', s == 200 and r.get('status') == 'password_changed', f'{s} {r}')
    check('la contraseña temporal deja de servir', S(TARGET, temp).login_status == 401)
    c2 = S(TARGET, newpw)
    roles = [x['code'] for x in (c2.get('/api/v1/auth/me')[1].get('user') or {}).get('roles', [])]
    check('entra con la nueva contraseña como Master Admin y consulta módulos', c2.login_status == 200 and roles == ['master_admin'] and c2.get('/api/v1/recovery/matrix')[0] == 200, f'{c2.login_status} {roles}')
    t = users()[TARGET]
    s, r = act(t, 'grant_master_admin')
    check('habilitar de nuevo a quien ya es Master Admin activo: 409 ALREADY_MASTER_ADMIN', s == 409 and r['error']['code'] == 'ALREADY_MASTER_ADMIN', f'{s} {r}')
    s, rp2 = act(t, 'reset_password')
    check('restablecer revoca sus sesiones abiertas', s == 200 and rp2.get('sessions_revoked', 0) >= 1 and c2.get('/api/v1/auth/me')[0] == 401, json.dumps({k: v for k, v in rp2.items() if k != 'temporary_password'}))
    t = users()[TARGET]
    s, rv = act(t, 'revoke_master_admin')
    check('retirar Master Admin: sin rol y, sin otro rol, sin acceso', s == 200 and rv.get('master_admin') is False and rv.get('access_enabled') is False and 'master_admin' not in users()[TARGET]['role_codes'], json.dumps(rv))
    check('sin rol ni acceso, la contraseña temporal ya no permite entrar', S(TARGET, rp2.get('temporary_password')).login_status == 401)
    st, log = adm.get('/api/v1/audit-events?module=users&page_size=50')
    acts = [x['action'] for x in log.get('items', [])]
    dump = json.dumps(log, ensure_ascii=False)
    check('bitácora: habilitar, restablecer, retirar y cambio de contraseña', {'users.access.grant_master_admin', 'users.access.reset_password', 'users.access.revoke_master_admin'} <= set(acts), str(acts[:10]))
    check('bitácora sin contraseñas ni hashes', temp not in dump and newpw not in dump and '$argon2id$' not in dump)
    st, alog = adm.get('/api/v1/audit-events?module=users&action=auth.password.change&page_size=5')
    check('bitácora: auth.password.change del propio usuario', st == 200 and any(x['action'] == 'auth.password.change' for x in alog.get('items', [])) or 'auth.password.change' in acts, f'{st}')
finally:
    adm.logout()

w = max(len(n) for n, _, _ in results)
for n, ok, d in results: print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(w)}  {'' if ok else d}")
failed = sum(1 for _, ok, _ in results if not ok); print(f'\nUsuarios · gestión de acceso (HTTP): {len(results) - failed}/{len(results)} PASS'); sys.exit(1 if failed else 0)
