// Usuarios y roles · gestión de acceso (src/views/usersRoles/accessModel.mjs). Lógica pura; node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, accessView, validateAccessForm, accessPayload, accessError, accessDone, passwordProblem } from '../../src/views/usersRoles/accessModel.mjs';

const U = (o = {}) => ({ id: 'u2', status: 'active', access_enabled: false, credential_state: 'reset_required', role_codes: [], version: 3, ...o });

test('acciones disponibles: nunca sobre la propia cuenta ni sobre inactivos o externos', () => {
  assert.deepEqual(accessView(U(), 'u1').actions, ['grant_master_admin']);
  assert.deepEqual(accessView(U({ role_codes: ['master_admin'], credential_state: 'local_validated', access_enabled: true }), 'u1').actions, ['reset_password', 'revoke_master_admin']);
  assert.deepEqual(accessView(U({ role_codes: ['master_admin'], credential_state: 'reset_required', access_enabled: true }), 'u1').actions, ['reset_password', 'revoke_master_admin']);
  const self = accessView(U({ id: 'u1', role_codes: ['master_admin'] }), 'u1');
  assert.deepEqual(self.actions, []); assert.match(self.note, /propia cuenta/);
  assert.deepEqual(accessView(U({ status: 'inactive' }), 'u1').actions, []);
  assert.deepEqual(accessView(U({ credential_state: 'external' }), 'u1').actions, []);
  assert.equal(accessView(U({ access_enabled: true }), 'u1').credential[0], 'Temporal: debe cambiarla al entrar');
});

test('formulario: motivo, contraseña del administrador y confirmación de persona distinta', () => {
  const ok = { reason: 'Segundo revisor independiente', password: 'x', independent: true };
  assert.equal(validateAccessForm(ok, 'grant_master_admin'), null);
  assert.match(validateAccessForm({ ...ok, reason: 'corto' }, 'grant_master_admin'), /motivo/);
  assert.match(validateAccessForm({ ...ok, password: '' }, 'grant_master_admin'), /contraseña/);
  assert.match(validateAccessForm({ ...ok, independent: false }, 'grant_master_admin'), /distinta/);
  assert.equal(validateAccessForm({ ...ok, independent: false }, 'revoke_master_admin'), null);
  assert.deepEqual(accessPayload({ ...ok, reason: '  Segundo   revisor  independiente ' }, 'reset_password'), { action: 'reset_password', actor_password: 'x', reason: 'Segundo revisor independiente' });
  assert.deepEqual(Object.keys(ACTIONS), ['grant_master_admin', 'reset_password', 'revoke_master_admin']);
});

test('mensajes: reautenticación, versión, cuenta sin aprovisionar y resultado', () => {
  assert.match(accessError(403, 'REAUTH_FAILED', '')[1], /Tu contraseña no es correcta/);
  assert.equal(accessError(412, 'STALE_VERSION', '')[0], 'warn');
  assert.match(accessError(503, 'USERADMIN_NOT_PROVISIONED', 'No habilitada.')[1], /docs\/usuarios\/SEGUNDO_MASTER_ADMIN\.md/);
  assert.match(accessError(0, undefined, 'red')[1], /MISMA operación/);
  const out = { name: 'Ana', email: 'ana@x.invalid', action: 'grant_master_admin', temporary_password_issued: true, sessions_revoked: 0 };
  assert.match(accessDone(out), /^Ana \(ana@x\.invalid\) ya es Master Admin\. Entrégale la contraseña temporal/);
  assert.match(accessDone({ ...out, replayed: true }), /ya se había aplicado.*no se vuelve a mostrar/);
  assert.match(accessDone({ ...out, action: 'revoke_master_admin', access_enabled: false, temporary_password_issued: false }), /ya no es Master Admin\. Su acceso quedó deshabilitado/);
});

test('contraseña nueva: mismas reglas que el servidor', () => {
  assert.equal(passwordProblem('Compras2026Seguro', 'ana.lopez@x.invalid', 'Temp-1234'), null);
  assert.match(passwordProblem('Corta1', 'a@x.invalid'), /entre 12 y 128/);
  assert.match(passwordProblem('soloLetrasSinNumero', 'a@x.invalid'), /letras y números/);
  assert.match(passwordProblem('111111111111a', 'a@x.invalid'), /repite/);
  assert.match(passwordProblem('ana.lopez2026XYZ', 'ana.lopez@x.invalid'), /usuario/);
  assert.match(passwordProblem('Compras2026Seguro', 'a@x.invalid', 'Compras2026Seguro'), /distinta/);
});
