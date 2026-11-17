// Usuarios y roles · tarjeta 3 "Roles y permisos": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SECTIONS, emptyRole, fromRole, roleCodeOf, sectionCount, validateRole, changedRoleFields, roleCardInfo, roleDeleteBlock } from '../../src/views/usersRoles/roleForm.mjs';

const MASTER = { code: 'master_admin', name: 'Master Admin', description: 'Sintético QA', is_system: true, users: 2, permissions: [] };
const BUYER = { code: 'buyer', name: 'Comprador', description: 'Sintético', is_system: false, users: 1, permissions: [] };
const FREE = { code: 'consulta', name: 'Consulta', description: '', is_system: false, users: 0, permissions: [] };
const ROLES = [MASTER, BUYER, FREE];

test('nuevo rol: secciones del diseño marcadas por defecto', () => {
  const f = emptyRole();
  assert.deepEqual(DEFAULT_SECTIONS, ['inicioDashboard', 'ayudaInstructivo']);
  assert.equal(sectionCount(f), 2);
  assert.equal(sectionCount(emptyRole(false)), 0);
  assert.equal(Object.keys(f.sections).length, 19);
});

test('rol registrado: acceso efectivo del servidor', () => {
  const m = fromRole(MASTER);
  assert.equal(m.canEdit, true); assert.equal(m.canManageUsers, true); assert.equal(sectionCount(m), 12); assert.equal(m.sections.usuariosRoles, true);
  const b = fromRole(BUYER);
  assert.equal(b.canEdit, false); assert.equal(sectionCount(b), 0);
});

test('código del rol desde el nombre', () => {
  assert.equal(roleCodeOf('Compras Norte'), 'compras_norte');
  assert.equal(roleCodeOf('  Operación & Logística  '), 'operacion_logistica');
  assert.equal(roleCodeOf('!!!'), '');
});

test('validación: nombre, duplicados, código, secciones y Master Admin', () => {
  const ok = { ...emptyRole(), name: 'Operaciones', description: 'Gestiona requisiciones' };
  assert.equal(validateRole(ok, { roles: ROLES }).ok, true);
  assert.match(validateRole({ ...ok, name: '' }, { roles: ROLES }).errors.name, /Indica el nombre/);
  assert.match(validateRole({ ...ok, name: 'comprador' }, { roles: ROLES }).errors.name, /Ya existe un rol con ese nombre/);
  assert.match(validateRole({ ...ok, name: 'Master-Admin' }, { roles: ROLES }).errors.name, /código "master_admin" ya existe/);
  assert.match(validateRole({ ...ok, name: '¡¿!' }, { roles: ROLES }).errors.name, /entre 3 y 128|letras o números/);
  assert.match(validateRole({ ...emptyRole(false), name: 'Vacío' }, { roles: ROLES }).errors.sections, /al menos una sección/);
  assert.match(validateRole({ ...ok, canManageUsers: true }, { roles: ROLES }).errors.sections, /Usuarios y roles/);
  assert.match(validateRole({ ...ok, description: 'x'.repeat(501) }, { roles: ROLES }).errors.description, /500/);
  const m = fromRole(MASTER);
  assert.equal(validateRole(m, { roles: ROLES, editing: MASTER }).ok, true, 'su propio nombre no es duplicado');
  assert.match(validateRole({ ...m, canManageUsers: false }, { roles: ROLES, editing: MASTER }).errors.master, /Master Admin debe conservar/);
  assert.match(validateRole({ ...m, sections: { ...m.sections, usuariosRoles: false } }, { roles: ROLES, editing: MASTER }).errors.sections || '', /Usuarios y roles/);
});

test('advertencias: edición sin secciones operativas y usuarios afectados', () => {
  assert.match(validateRole({ ...emptyRole(), name: 'Editor', canEdit: true }, { roles: ROLES }).warnings[0], /no tiene ninguna sección operativa/);
  assert.match(validateRole(fromRole(BUYER), { roles: ROLES, editing: BUYER }).warnings.join(' '), /afectaría a 1 usuario/);
});

test('cambios de una edición', () => {
  const o = fromRole(BUYER);
  assert.deepEqual(changedRoleFields(o, o), []);
  assert.deepEqual(changedRoleFields({ ...o, description: 'Nueva', canEdit: true, sections: { ...o.sections, clientes: true, proveedores: true } }, o), ['descripción', 'edición de registros', '2 sección(es)']);
});

test('tarjetas del catálogo y eliminación', () => {
  assert.deepEqual([roleCardInfo(MASTER).sections, roleCardInfo(MASTER).modeText, roleCardInfo(MASTER).users], [12, 'Edición', 2]);
  assert.equal(roleCardInfo(BUYER).modeText, 'Sin acceso efectivo');
  assert.match(roleDeleteBlock(MASTER), /rol del sistema/);
  assert.match(roleDeleteBlock(BUYER), /en uso por 1 usuario/);
  assert.equal(roleDeleteBlock(FREE), null);
});
