// Usuarios y roles · tarjeta 1 "Alta y actualización de usuarios": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNCTIONS, STATUSES, emptyUser, fromUser, validateUser, passwordRequired, credentialActive, changedFields, PHOTO_MAX } from '../../src/views/usersRoles/userForm.mjs';

const ROLES = [{ code: 'master_admin', name: 'Master Admin', permissions: [] }, { code: 'buyer', name: 'Comprador', permissions: [{ code: 'purchase_order.prepare' }] }];
const A = { id: 'a', name: 'QA Admin A', email: 'qa.admin.a@x.invalid', status: 'active', access_enabled: true, credential_state: 'local_validated', role_codes: ['master_admin'], permission_overrides: [] };
const B = { id: 'b', name: 'QA Comprador', email: 'qa.buyer@x.invalid', position: 'Comprador', phone: '833 000 0000', status: 'active', access_enabled: true, credential_state: 'local_validated', role_codes: ['buyer'], permission_overrides: [{ code: 'customer_quote.review', effect: 'allow' }] };
const USERS = [A, B];
const ok = { ...emptyUser(), name: 'Nueva Persona', email: 'nueva@grupogerez.com', position: 'Compradora', role: 'buyer', password: 'Segura123' };

test('catálogos del diseño', () => {
  assert.deepEqual(FUNCTIONS.map(f => f[1]), ['🛒 Comprador', '✍️ Preparó / Revisó', '✅ Autorizó']);
  assert.deepEqual(STATUSES.map(s => s[0]), ['active', 'inactive', 'blocked']);
  const e = emptyUser();
  assert.equal(e.access, true); assert.equal(e.status, 'active'); assert.equal(Object.keys(e.perms).length, 6);
});

test('carga de un usuario registrado: rol, estatus, funciones observadas y permisos efectivos', () => {
  const f = fromUser(B, ROLES, { po_buyer: 3, po_authorizer: 0 });
  assert.equal(f.role, 'buyer'); assert.equal(f.status, 'active'); assert.equal(f.access, true); assert.equal(f.password, '');
  assert.deepEqual(f.functions, { buyer: true, preparer: false, authorizer: false });
  assert.equal(f.perms['purchase_order.prepare'], true); assert.equal(f.perms['customer_quote.review'], true); assert.equal(f.perms['purchase_order.authorize'], false);
  assert.equal(fromUser({ ...A, role_codes: ['buyer', 'master_admin'] }, ROLES).role, 'master_admin');
});

test('alta válida y obligatorios', () => {
  assert.equal(validateUser(ok, { users: USERS, roles: ROLES }).ok, true);
  const v = validateUser(emptyUser(), { users: USERS, roles: ROLES });
  assert.equal(v.ok, false);
  assert.deepEqual(Object.keys(v.errors), ['name', 'email', 'position', 'role', 'password']);
  assert.equal(v.first, 'Indica el nombre completo.');
});

test('correo, duplicados, teléfono y rol', () => {
  assert.match(validateUser({ ...ok, email: 'sin-arroba' }, { users: USERS, roles: ROLES }).errors.email, /inválido/);
  assert.match(validateUser({ ...ok, email: ' QA.BUYER@x.invalid ' }, { users: USERS, roles: ROLES }).errors.email, /Ya existe/);
  assert.equal(validateUser({ ...fromUser(B, ROLES), password: '' }, { users: USERS, editing: B, roles: ROLES }).errors.email, undefined, 'su propio correo no es duplicado');
  assert.match(validateUser({ ...ok, phone: '12ab' }, { users: USERS, roles: ROLES }).errors.phone, /Teléfono inválido/);
  assert.equal(validateUser({ ...ok, phone: '+52 (833) 000-0000' }, { users: USERS, roles: ROLES }).ok, true);
  assert.match(validateUser({ ...ok, role: 'ghost' }, { users: USERS, roles: ROLES }).errors.role, /no existe/);
});

test('contraseña: obligatoria solo con acceso y sin credencial activada', () => {
  assert.equal(passwordRequired({ access: true }, null), true);
  assert.equal(passwordRequired({ access: false }, null), false);
  assert.equal(passwordRequired({ access: true }, B), false); assert.equal(credentialActive(B), true);
  assert.equal(passwordRequired({ access: true }, { ...B, credential_state: 'reset_required' }), true);
  assert.equal(validateUser({ ...ok, access: false, password: '' }, { users: USERS, roles: ROLES }).ok, true);
  assert.match(validateUser({ ...ok, password: 'corta' }, { users: USERS, roles: ROLES }).errors.password, /mínimo 8/);
  assert.match(validateUser({ ...ok, password: 'nueva@grupogerez.com' }, { users: USERS, roles: ROLES }).errors.password, /igual al correo/);
  assert.equal(validateUser({ ...fromUser(B, ROLES), position: 'Comprador' }, { users: USERS, editing: B, roles: ROLES }).ok, true, 'conserva la contraseña actual');
});

test('fotografía: tipo y tamaño', () => {
  assert.match(validateUser({ ...ok, photo: { type: 'application/pdf', size: 10 } }, { users: USERS, roles: ROLES }).errors.photo, /PNG, JPG o WebP/);
  assert.match(validateUser({ ...ok, photo: { type: 'image/png', size: PHOTO_MAX + 1 } }, { users: USERS, roles: ROLES }).errors.photo, /2 MB/);
  assert.equal(validateUser({ ...ok, photo: { type: 'image/webp', size: 2048 } }, { users: USERS, roles: ROLES }).ok, true);
});

test('protección: sin autobloqueo y al menos un Master Admin activo', () => {
  const fa = fromUser(A, ROLES);
  const me = { public_id: 'a' };
  assert.match(validateUser({ ...fa, role: 'buyer' }, { users: USERS, editing: A, me, activeAdmins: 2, roles: ROLES }).errors.self, /a ti mismo/);
  assert.match(validateUser({ ...fa, access: false }, { users: USERS, editing: A, me: { public_id: 'z' }, activeAdmins: 1, roles: ROLES }).errors.self, /al menos un Master Admin/);
  assert.equal(validateUser({ ...fa, status: 'blocked' }, { users: USERS, editing: A, me: { public_id: 'z' }, activeAdmins: 2, roles: ROLES }).errors.self, undefined);
});

test('advertencias: elaborar y autorizar a la vez; Master Admin sin acceso', () => {
  const w = validateUser({ ...ok, perms: { ...ok.perms, 'purchase_order.prepare': true, 'purchase_order.authorize': true } }, { users: USERS, roles: ROLES }).warnings;
  assert.match(w[0], /alguien distinto/);
  assert.match(validateUser({ ...ok, role: 'master_admin', access: false }, { users: USERS, roles: ROLES }).warnings[0], /no podrá iniciar sesión/);
});

test('cambios de una actualización (la contraseña solo se nombra)', () => {
  const o = fromUser(B, ROLES);
  assert.deepEqual(changedFields(o, o), []);
  assert.deepEqual(changedFields({ ...o, phone: '833 111 1111', password: 'Secreta123', functions: { ...o.functions, authorizer: true } }, o), ['teléfono', 'contraseña', 'funciones operativas']);
  assert.ok(!JSON.stringify(changedFields({ ...o, password: 'Secreta123' }, o)).includes('Secreta123'));
  assert.deepEqual(changedFields(o, null), []);
});
