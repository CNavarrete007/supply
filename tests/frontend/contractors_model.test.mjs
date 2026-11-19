// Contratista · tarjeta 2 "Matriz de contratistas": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_FILTERS, CONTRACTOR_LOGO, contractorRow, matrixBadge, deleteBlock, activeText, personRow, editPrefill } from '../../src/views/contractors/model.mjs';

// Fila sintética con la forma de GET /api/v1/contractors.
const C = { id: 'o1', legal_name: 'Supply Base Services de Mexico', tax_identifier: 'SPM1802193A6', phone: '8332140041', email: 'supplies@qa.invalid', postal_address: '3ra avenida #1007, Tampico', status: 'active',
  has_logo: false, responsible: null, personnel: 0, with_access: 0, active: true, usage: { requisitions: 31, purchase_orders: 4, deliveries: 0, invoices: 3 } };

test('filtros de estatus del diseño', () => {
  assert.deepEqual(STATUS_FILTERS.map(f => f[1]), ['Todos los estatus', 'Activo', 'Inactivo']);
});

test('fila del contratista con las columnas del diseño', () => {
  const v = contractorRow(C);
  assert.deepEqual([v.name, v.taxId, v.phone, v.email, v.address], ['SUPPLY BASE SERVICES DE MEXICO', 'SPM1802193A6', '8332140041', 'supplies@qa.invalid', '3ra avenida #1007, Tampico']);
  assert.equal(v.logo.src, CONTRACTOR_LOGO);
  assert.match(v.logo.note, /institucional Grupo Gerez/);
  assert.deepEqual([v.responsible.text, v.responsible.tone], ['Sin responsable', 'amber']);
  assert.deepEqual([v.personnel.text, v.personnel.sub], ['0 persona(s)', '']);
  assert.deepEqual([v.status.text, v.status.tone], ['Activo', 'blue']);
  assert.deepEqual([v.usage.text, v.usage.tone, v.usage.sub], ['Contratista activo', 'green', '31 requisición(es) · 4 OC · 3 factura(s)']);
  const w = contractorRow({ ...C, has_logo: true, responsible: { name: 'Ana Pérez', position: 'Gerente' }, personnel: 5, with_access: 3, status: 'suspended', active: false, tax_identifier: null });
  assert.deepEqual([w.responsible.text, w.responsible.sub, w.personnel.text, w.personnel.sub, w.status.text, w.usage.text, w.taxId], ['Ana Pérez', 'Gerente', '5 persona(s)', '3 con acceso', 'Inactivo', 'Disponible', '—']);
  assert.match(w.logo.note, /resguardo privado/);
  assert.equal(contractorRow(C, true).usage.text, 'Active contractor');
});

test('insignia, Activo y Eliminar (escrituras bloqueadas)', () => {
  assert.equal(matrixBadge({ total: 1 }), '1 empresa(s) · activa en esta sesión');
  assert.match(activeText(C), /ya es el contratista activo para documentos y operaciones/);
  assert.match(activeText({ ...C, active: false }), /escritura bloqueada/);
  assert.match(deleteBlock(C), /^No se elimina Supply Base Services de Mexico: es el contratista activo de esta sesión y la empresa titular de 38 documento\(s\) y 0 persona\(s\)/);
  assert.match(deleteBlock(C, true), /is not deleted/);
});

test('personal: estado, acceso y responsable', () => {
  const p = personRow({ name: 'QA Comprador', position: null, email: 'qa@x.invalid', active: true, has_user: true, access_enabled: true, user_status: 'active', roles: 'Comprador', responsible: true });
  assert.deepEqual([p.name, p.position, p.roles, p.active.text, p.access.text, p.responsible], ['QA Comprador', '—', 'Comprador', 'Activa', 'Con acceso', true]);
  assert.equal(personRow({ name: 'X', has_user: false }).access.text, 'Sin usuario');
  assert.equal(personRow({ name: 'X', has_user: true, access_enabled: false, active: false }).access.text, 'Sin acceso');
});

test('Editar precarga la tarjeta 1 con los datos reales', () => {
  assert.deepEqual(editPrefill(C), { companyName: 'Supply Base Services de Mexico', rfc: 'SPM1802193A6', phone: '8332140041', email: 'supplies@qa.invalid', address: '3ra avenida #1007, Tampico', status: 'Activo' });
});
