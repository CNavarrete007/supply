// Usuarios y roles · tarjeta 2 "Matriz de usuarios": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { lastAccessText, matrixBadge, companyLine, accessPill, toggleAction, toggleBlock, reasonError, deleteBlock, emailConfirmed } from '../../src/views/usersRoles/userMatrix.mjs';

const A = { id: 'a', name: 'QA Admin A', email: 'qa.admin.a@x.invalid', status: 'active', access_enabled: true, credential_state: 'local_validated', role_codes: ['master_admin'], last_login_at: '2026-10-13 23:26:06.000000' };
const B = { id: 'b', name: 'QA Comprador', email: 'qa.buyer@x.invalid', phone: '8331658967', status: 'blocked', access_enabled: true, credential_state: 'local_validated', role_codes: ['buyer'], last_login_at: null };
const C = { id: 'c', name: 'Nueva', email: 'nueva@x.invalid', status: 'active', access_enabled: false, role_codes: ['buyer'], last_login_at: null };

test('último acceso en formato local es-MX', () => {
  const t = lastAccessText(A.last_login_at);
  assert.match(t, /^\d{1,2}\/\d{1,2}\/2026, \d{1,2}:\d{2}:\d{2}/);
  assert.equal(t, new Date('2026-10-13T23:26:06.000Z').toLocaleString('es-MX'));
  assert.equal(lastAccessText(null), '');
});

test('insignia, empresa y acceso', () => {
  assert.equal(matrixBadge([A, B, C]), '2 activos · 3 operativos');
  assert.equal(matrixBadge([A], true), '1 active · 1 staff');
  assert.equal(companyLine(B), 'Uso general · 8331658967');
  assert.equal(companyLine(C), 'Uso general');
  assert.equal(accessPill(A).text, 'Acceso habilitado');
  assert.equal(accessPill(C).text, 'Sin acceso al sistema');
  assert.equal(accessPill({ ...C, access_enabled: true, credential_state: 'reset_required' }).text, 'Credencial pendiente');
});

test('bloquear / activar con protecciones y motivo', () => {
  assert.equal(toggleAction(A), 'block'); assert.equal(toggleAction(B), 'activate');
  assert.match(toggleBlock(A, { me: { public_id: 'a' }, activeAdmins: 2 }), /propia cuenta/);
  assert.match(toggleBlock(A, { me: { public_id: 'z' }, activeAdmins: 1 }), /único Master Admin/);
  assert.equal(toggleBlock(A, { me: { public_id: 'z' }, activeAdmins: 2 }), null);
  assert.equal(toggleBlock(B, { me: { public_id: 'b' } }), null, 'activar no tiene restricciones de autobloqueo');
  assert.match(reasonError('corto'), /mínimo 10/);
  assert.equal(reasonError('Baja temporal de prueba'), '');
  assert.match(reasonError('x'.repeat(501)), /500/);
});

test('eliminar: nunca a sí mismo ni con historial; confirmación por correo', () => {
  assert.match(deleteBlock(C, null, { me: { public_id: 'c' } }), /propia cuenta/);
  assert.match(deleteBlock(A, { po_authorizer: 2 }, { me: { public_id: 'z' } }), /tiene historial \(2 documento\(s\) y accesos registrados\).*BLOQUEAR/);
  assert.match(deleteBlock(B, { po_buyer: 1 }, {}), /1 documento\(s\)\)/);
  assert.equal(deleteBlock(C, null, { me: { public_id: 'z' } }), null);
  assert.equal(emailConfirmed(C, ' NUEVA@x.invalid '), true);
  assert.equal(emailConfirmed(C, 'otra@x.invalid'), false);
});
