// Usuarios y roles · pruebas de la lógica pura. Uso: node --test tests/frontend/users_roles_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, roleAccess, effectivePermissions, statusKind, accessKind, functionsOf, accessSummary, filterUsers, localDateTime, utcBounds, actionLabel, moduleLabel, isCritical, actorName, initials } from '../../src/views/usersRoles/model.mjs';

const users = [
  { id: 'a', name: 'Ana Admin', email: 'ana@x.invalid', position: 'Gerente', status: 'active', access_enabled: true, credential_state: 'local_validated', roles: ['Master Admin'], role_codes: ['master_admin'], permission_overrides: [] },
  { id: 'b', name: 'Beto Compras', email: 'beto@x.invalid', position: 'Comprador', status: 'active', access_enabled: true, credential_state: 'reset_required', roles: ['Compras'], role_codes: ['compras'], permission_overrides: [{ code: 'reports.read', effect: 'allow' }, { code: 'users.read', effect: 'deny' }] },
  { id: 'c', name: 'Carla Campo', email: 'carla@x.invalid', status: 'active', access_enabled: false, credential_state: 'reset_required', roles: [], role_codes: [], permission_overrides: [] },
  { id: 'd', name: 'Dora Bloq', email: 'dora@x.invalid', status: 'blocked', access_enabled: true, credential_state: 'local_validated', roles: ['Compras'], role_codes: ['compras'], permission_overrides: [] },
];
const roles = [{ code: 'master_admin', permissions: [{ code: 'users.read' }, { code: 'roles.read' }] }, { code: 'compras', permissions: [{ code: 'users.read' }, { code: 'catalogs.read' }] }];
const fn = new Map([['a', { po_authorizer: 2 }], ['b', { po_buyer: 1, rfq_contact: 3, po_preparer: 1 }]]);

test('acceso efectivo del servidor: solo master_admin abre módulos conectados', () => {
  assert.equal(SECTIONS.length, 19);
  const m = roleAccess('master_admin'), c = roleAccess('compras');
  assert.equal(m.sectionCount, 7); assert.equal(m.sections.clientes, true); assert.equal(m.sections.flujoProceso, false);
  assert.equal(c.sectionCount, 0); assert.equal(c.canEdit, false); assert.equal(m.canEdit, true);
  assert.equal(m.canManageUsers, false, 'no hay endpoints de escritura de usuarios');
});

test('permisos efectivos: rol ∪ permitir − negar', () => {
  assert.deepEqual(effectivePermissions(users[0], roles), ['roles.read', 'users.read']);
  assert.deepEqual(effectivePermissions(users[1], roles), ['catalogs.read', 'reports.read']);
  assert.deepEqual(effectivePermissions(users[2], roles), []);
});

test('estatus, acceso y funciones observadas', () => {
  assert.deepEqual(users.map(statusKind), ['active', 'active', 'active', 'blocked']);
  assert.deepEqual(users.map(accessKind), ['enabled', 'pending', 'none', 'pending']);
  assert.deepEqual(functionsOf(fn.get('b')), { buyer: true, buyerDocs: 4, preparer: true, preparerDocs: 1, authorizer: false, authorizerDocs: 0 });
  assert.equal(functionsOf(undefined).buyer, false);
  const s = accessSummary(users, fn);
  assert.deepEqual(s, { people: 4, withAccess: 1, buyers: 1, preparers: 1, authorizers: 1, inactiveBlocked: 2, activeAdmins: 1, pendingCredentials: 2 });
});

test('búsqueda por nombre, correo, rol, estatus y función (sin acentos)', () => {
  assert.deepEqual(filterUsers(users, 'compras', fn).map(u => u.id), ['b', 'd']);
  assert.deepEqual(filterUsers(users, 'comprador', fn).map(u => u.id), ['b']);
  assert.deepEqual(filterUsers(users, 'autorizo', fn).map(u => u.id), ['a']);
  assert.deepEqual(filterUsers(users, 'bloqueado', fn).map(u => u.id), ['d']);
  assert.deepEqual(filterUsers(users, 'CARLA@', fn).map(u => u.id), ['c']);
  assert.equal(filterUsers(users, '', fn).length, 4);
});

test('fechas UTC ↔ local, etiquetas y eventos críticos', () => {
  const local = localDateTime('2026-11-11 17:27:07.194477');
  const d = new Date(Date.UTC(2026, 10, 11, 17, 27, 7));
  const p = n => String(n).padStart(2, '0');
  assert.equal(local, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`);
  assert.equal(localDateTime(null), '');
  const b = utcBounds('2026-11-01', '2026-11-02');
  assert.match(b.from, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); assert.ok(b.from < b.to);
  assert.equal(new Date(b.from.replace(' ', 'T') + 'Z').getTime(), new Date(2026, 10, 1).getTime(), 'medianoche local en UTC');
  assert.deepEqual(utcBounds('', ''), { from: '', to: '' });
  assert.equal(actionLabel('auth.login'), 'Inicio de sesión'); assert.equal(actionLabel('x.y'), 'x.y'); assert.equal(moduleLabel('requisitions', true), 'Requisitions');
  assert.equal(isCritical({ action: 'user.block', result: 'success' }), true); assert.equal(isCritical({ action: 'auth.login', result: 'error' }), true); assert.equal(isCritical({ action: 'auth.login', result: 'success' }), false);
  assert.equal(actorName({ actor_snapshot_name: 'Legado' }), 'Legado'); assert.equal(actorName({}), 'Sistema');
  assert.equal(initials('Ana María López'), 'AM');
});
