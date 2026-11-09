#!/usr/bin/env python3
"""INT03-D1 · Prueba HTTP real del contrato R2 (Regularización) contra una API SINTETICA.

Uso:  SF_BASE=http://127.0.0.1:8090 SF_QA_PASSWORD=... python3 -I tests/int03d1/r2_http_e2e.py
Requiere usuarios sintéticos de tests/int03d1/sandbox_sql.py. Crea requisiciones provisionales
sintéticas mediante el endpoint RF1 existente; nunca toca registros importados.
Se niega a ejecutarse si SF_BASE no es localhost/127.0.0.1.
"""
from __future__ import annotations
import base64
import hashlib
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get('SF_BASE', 'http://127.0.0.1:8090').rstrip('/')
PASSWORD = os.environ.get('SF_QA_PASSWORD', '')
host = urllib.parse.urlparse(BASE).hostname
if host not in ('127.0.0.1', 'localhost') or not PASSWORD:
    sys.exit('BLOCKED: solo API local sintética y SF_QA_PASSWORD definido.')

# 1x1 PNG and minimal PDF (synthetic evidence).
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
PDF = b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'
results: list[tuple[str, bool, str]] = []


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method, path, body=None, headers=None, raw=False):
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        req = urllib.request.Request(BASE + path, data=data, method=method, headers={'Accept': 'application/json', **(headers or {})})
        try:
            with self.op.open(req, timeout=30) as r:
                payload = r.read()
                return r.status, (payload if raw else json.loads(payload or b'{}')), dict(r.headers)
        except urllib.error.HTTPError as e:
            payload = e.read()
            try:
                return e.code, json.loads(payload or b'{}'), dict(e.headers)
            except ValueError:
                return e.code, {'raw': payload[:200].decode('latin1')}, dict(e.headers)

    def csrf(self):
        return self.call('GET', '/api/v1/auth/csrf')[1]['csrf_token']

    def login(self, email):
        token = self.csrf()
        s, b, _ = self.call('POST', '/api/v1/auth/login', {'email': email, 'password': PASSWORD},
                            {'Content-Type': 'application/json', 'X-SF-CSRF': token})
        assert s == 200, (s, b)
        return self

    def write(self, method, path, body, version=None, key=None, token=None, ctype='application/json'):
        h = {'Content-Type': ctype, 'X-SF-CSRF': token if token is not None else self.csrf(),
             'Idempotency-Key': key or str(uuid.uuid4())}
        if version is not None:
            h['If-Match'] = f'"{version}"'
        return self.call(method, path, body, h)


def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))


def provisional(c: Client, client_id: str, requirement: str, folio: str) -> dict:
    data = {'folio': folio, 'client_id': client_id, 'request_date': '2026-11-09', 'need_date': '2026-11-30',
            'project': 'PRY-QA-01', 'contract': 'CTO-QA-01', 'client_reference': 'QA-REF', 'priority': 'normal',
            'delivery_place': 'Almacén sintético', 'requester_name': 'Solicitante QA', 'requester_email': 'solicitante@cliente.invalid',
            'budget': None, 'currency': 'MXN', 'description': 'Requisición sintética INT03-D1', 'notes': '',
            'items': [{'id': None, 'description': 'Partida sintética', 'quantity': '1', 'unit': 'pza', 'category': 'Materiales'}],
            'source': {'type': 'Correo del cliente', 'date': '2026-11-09', 'reference': 'Correo QA', 'notes': '',
                       'requirement': requirement, 'due_date': None if requirement == 'contract' else '2026-11-20', 'owner': 'QA'},
            'document': None}
    s, b, _ = c.write('POST', '/api/v1/recovery/requisitions', data)
    assert s == 201, (s, b)
    return b


def main() -> int:
    anon = Client()
    s, b, _ = anon.call('GET', '/api/v1/recovery/matrix')
    check('401 matriz sin sesión', s == 401 and b['error']['code'] == 'NOT_AUTHENTICATED', s)
    rid0 = str(uuid.uuid4())
    s, b, _ = anon.call('GET', f'/api/v1/recovery/requisitions/{rid0}/regularization')
    check('401 consulta regularización sin sesión', s == 401, s)

    buyer = Client().login('qa.buyer@supplyflow.invalid')
    s, b, _ = buyer.call('GET', '/api/v1/recovery/matrix')
    check('403 rol sin Master Admin', s == 403 and b['error']['code'] == 'FORBIDDEN', s)

    a = Client().login('qa.admin.a@supplyflow.invalid')
    b_admin = Client().login('qa.admin.b@supplyflow.invalid')
    cat = a.call('GET', '/api/v1/recovery/catalogs')[1]
    client_id = next(x['id'] for x in cat['clients'] if x['code'] == 'QA01')
    suffix = uuid.uuid4().hex[:6].upper()
    r1 = provisional(a, client_id, 'formal', f'SOL-PROV-QA-{suffix}-1')
    r2 = provisional(a, client_id, 'contract', f'SOL-PROV-QA-{suffix}-2')

    s, m, _ = a.call('GET', '/api/v1/recovery/matrix')
    row = next(x for x in m['items'] if x['id'] == r1['id'])
    check('matriz expone provisional pendiente', row['is_provisional'] and row['regularization_status'] == 'Pendiente de requisición formal', row['regularization_status'])
    for k in ('regularization_requirement', 'regularization_due_date', 'regularization_owner_snapshot', 'provisional_folio', 'version', 'editable'):
        check(f'matriz incluye {k}', k in row)

    s, g, _ = a.call('GET', f"/api/v1/recovery/requisitions/{r1['id']}/regularization")
    check('GET regularización pendiente', s == 200 and g['is_provisional'] and g['regularization'] is None and g['version'] == 1, g)
    s, _, _ = a.call('GET', f"/api/v1/recovery/requisitions/{r1['id']}/regularization/document")
    check('404 evidencia aún inexistente', s == 404, s)
    s, _, _ = a.call('GET', f'/api/v1/recovery/requisitions/{rid0}/regularization')
    check('404 expediente inexistente', s == 404, s)

    path = f"/api/v1/recovery/requisitions/{r1['id']}/regularization"
    good = {'method': 'formal', 'date': '2026-11-09', 'reference': 'REQ-CLIENTE-QA-0001', 'notes': 'Sintético',
            'evidence': {'name': 'requisicion-formal.pdf', 'data': base64.b64encode(PDF).decode()}}
    s, b, _ = a.write('POST', path, good, 1, token='0' * 64)
    check('403 CSRF inválido', s == 403 and b['error']['code'] == 'CSRF_INVALID', s)
    s, b, _ = a.write('POST', path, good, None)
    check('428 sin If-Match', s == 428 and b['error']['code'] == 'VERSION_REQUIRED', s)
    s, b, _ = a.call('POST', path, json.dumps(good).encode(), {'Content-Type': 'application/json', 'X-SF-CSRF': a.csrf(), 'If-Match': '"1"'})
    check('422 sin Idempotency-Key', s == 422 and b['error']['code'] == 'IDEMPOTENCY_REQUIRED', s)
    s, b, _ = a.write('POST', path, good, 1, ctype='text/plain')
    check('415 no JSON', s == 415, s)
    s, b, _ = a.write('POST', path, {**good, 'evidence': None}, 1)
    check('422 método formal sin evidencia', s == 422 and b['error']['code'] == 'INVALID_REQUISITION', b)
    s, b, _ = a.write('POST', path, {**good, 'method': 'fax'}, 1)
    check('422 método inválido', s == 422, s)
    s, b, _ = a.write('POST', path, {**good, 'evidence': {'name': 'x.txt', 'data': base64.b64encode(b'hola').decode()}}, 1)
    check('422 tipo de evidencia no admitido', s == 422, b)
    s, b, _ = a.write('POST', path, good, 7)
    check('412 versión obsoleta', s == 412 and b['error']['code'] == 'STALE_VERSION', s)
    s, b, _ = b_admin.write('POST', path, good, 1)
    check('409 otro administrador no creador', s == 409 and b['error']['code'] == 'READ_ONLY_RECORD', b)

    key = str(uuid.uuid4())
    s, ok, _ = a.write('POST', path, good, 1, key=key)
    check('200 regularización formal', s == 200 and ok['status'] == 'Regularizada · Requisición formal' and ok['version'] == 2 and ok['replayed'] is False, ok)
    check('folio original conservado', ok.get('folio') == r1['folio'])
    s, again, _ = a.write('POST', path, good, 1, key=key)
    check('200 reintento idempotente (replayed)', s == 200 and again['replayed'] is True and again['version'] == 2, again)
    s, b, _ = a.write('POST', path, {**good, 'reference': 'OTRA'}, 1, key=key)
    check('409 misma clave con otro contenido', s == 409 and b['error']['code'] == 'IDEMPOTENCY_CONFLICT', b)
    s, b, _ = a.write('POST', path, good, 2)
    check('409 ya regularizada', s == 409 and b['error']['code'] == 'NOT_PENDING_REGULARIZATION', b)

    s, g, _ = a.call('GET', path)
    reg = g.get('regularization') or {}
    check('GET refleja regularización', s == 200 and g['status'].startswith('Regularizada') and reg.get('reference') == 'REQ-CLIENTE-QA-0001' and g['version'] == 2, g)
    check('GET evidencia con sha256', (reg.get('evidence') or {}).get('sha256') == hashlib.sha256(PDF).hexdigest())
    s, body, h = a.call('GET', path + '/document', raw=True)
    check('descarga de evidencia íntegra', s == 200 and hashlib.sha256(body).hexdigest() == hashlib.sha256(PDF).hexdigest(), s)
    check('evidencia como attachment y no-store', 'attachment' in h.get('Content-Disposition', '') and 'no-store' in h.get('Cache-Control', ''), h.get('Content-Disposition'))
    s, _, _ = anon.call('GET', path + '/document', raw=True)
    check('401 descarga de evidencia sin sesión', s == 401, s)

    s, m, _ = a.call('GET', '/api/v1/recovery/matrix')
    row = next(x for x in m['items'] if x['id'] == r1['id'])
    check('matriz muestra regularizada y no editable', row['regularization_status'].startswith('Regularizada') and row['editable'] is False and row['folio'] == r1['folio'], row['regularization_status'])

    p2 = f"/api/v1/recovery/requisitions/{r2['id']}/regularization"
    s, ok2, _ = a.write('POST', p2, {'method': 'contract', 'date': '2026-11-09', 'reference': 'CTO-QA-01 Call-off', 'notes': None, 'evidence': None}, 1)
    check('200 base contractual sin evidencia', s == 200 and ok2['status'] == 'Regularizada · Evidencia alternativa', ok2)
    s, _, _ = a.call('GET', p2 + '/document')
    check('404 sin evidencia en contractual', s == 404, s)

    width = max(len(n) for n, _, _ in results)
    for name, passed, detail in results:
        print(f"{'PASS' if passed else 'FAIL'}  {name.ljust(width)}  {'' if passed else detail}")
    failed = sum(1 for _, p, _ in results if not p)
    print(f'\nR2 HTTP E2E: {len(results) - failed}/{len(results)} PASS')
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
