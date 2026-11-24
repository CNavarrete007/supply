// Contratista · tarjeta 2 "Matriz de contratistas": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_FILTERS, CONTRACTOR_LOGO, CONTRACTOR_IDENTITY, contractorRow, matrixBadge, deleteBlock, activeText, personRow, editPrefill, displayName, registeredName, serverQuery, validateCompany, companyPayload, companySavedText, companySaveError } from '../../src/views/contractors/model.mjs';

// Fila sintética con la forma de GET /api/v1/contractors.
const C = { id: 'o1', legal_name: 'Supply Base Services de Mexico', tax_identifier: 'SPM1802193A6', phone: '8332140041', email: 'supplies@qa.invalid', postal_address: '3ra avenida #1007, Tampico', status: 'active',
  has_logo: false, responsible: null, personnel: 0, with_access: 0, active: true, usage: { requisitions: 31, purchase_orders: 4, deliveries: 0, invoices: 3 } };

test('filtros de estatus del diseño', () => {
  assert.deepEqual(STATUS_FILTERS.map(f => f[1]), ['Todos los estatus', 'Activo', 'Inactivo']);
});

test('fila del contratista con las columnas del diseño', () => {
  const v = contractorRow(C);
  assert.deepEqual([v.name, v.registered, v.taxId, v.phone, v.email, v.address], ['TRÁMITES ADUANALES GEREZ S.C', 'Supply Base Services de Mexico', 'SPM1802193A6', '8332140041', 'supplies@qa.invalid', '3ra avenida #1007, Tampico']);
  assert.equal(v.logo.src, CONTRACTOR_LOGO);
  assert.match(v.logo.note, /institucional Grupo Gerez/);
  assert.deepEqual([v.responsible.text, v.responsible.tone], ['Sin responsable', 'amber']);
  assert.deepEqual([v.personnel.text, v.personnel.sub], ['0 persona(s)', '']);
  assert.deepEqual([v.status.text, v.status.tone], ['Activo', 'blue']);
  assert.deepEqual([v.usage.text, v.usage.tone, v.usage.sub], ['Contratista activo', 'green', '31 requisición(es) · 4 OC · 3 factura(s)']);
  const w = contractorRow({ ...C, has_logo: true, responsible: { name: 'Ana Pérez', position: 'Gerente' }, personnel: 5, with_access: 3, status: 'suspended', active: false, tax_identifier: null });
  assert.deepEqual([w.responsible.text, w.responsible.sub, w.personnel.text, w.personnel.sub, w.status.text, w.usage.text, w.taxId], ['Ana Pérez', 'Gerente', '5 persona(s)', '3 con acceso', 'Inactivo', 'Disponible', '—']);
  assert.deepEqual([w.name, w.registered], ['SUPPLY BASE SERVICES DE MEXICO', ''], 'otro contratista (no activo) conserva su razón social');
  assert.match(w.logo.note, /resguardo privado/);
  assert.equal(contractorRow(C, true).usage.text, 'Active contractor');
});

test('insignia, Activo y Eliminar (escrituras bloqueadas)', () => {
  assert.equal(matrixBadge({ total: 1 }), '1 empresa(s) · activa en esta sesión');
  assert.match(activeText(C), /ya es el contratista activo para documentos y operaciones/);
  assert.match(activeText({ ...C, active: false }), /escritura bloqueada/);
  assert.match(deleteBlock(C), /^No se elimina Trámites Aduanales Gerez S\.C: es el contratista activo de esta sesión y la empresa titular de 38 documento\(s\) y 0 persona\(s\)/);
  assert.match(deleteBlock(C, true), /is not deleted/);
});

test('personal: estado, acceso y responsable', () => {
  const p = personRow({ name: 'QA Comprador', position: null, email: 'qa@x.invalid', active: true, has_user: true, access_enabled: true, user_status: 'active', roles: 'Comprador', responsible: true });
  assert.deepEqual([p.name, p.position, p.roles, p.active.text, p.access.text, p.responsible], ['QA Comprador', '—', 'Comprador', 'Activa', 'Con acceso', true]);
  assert.equal(personRow({ name: 'X', has_user: false }).access.text, 'Sin usuario');
  assert.equal(personRow({ name: 'X', has_user: true, access_enabled: false, active: false }).access.text, 'Sin acceso');
});

test('Editar precarga la tarjeta 1 con los datos reales (razón social REGISTRADA, no el nombre de documentos)', () => {
  assert.deepEqual(editPrefill(C), { companyName: 'Supply Base Services de Mexico', rfc: 'SPM1802193A6', phone: '8332140041', email: 'supplies@qa.invalid', address: '3ra avenida #1007, Tampico', status: 'Activo' });
});

test('identidad Trámites Aduanales Gerez S.C con logotipo Grupo Gerez, sin ocultar la razón social registrada', () => {
  assert.deepEqual(CONTRACTOR_IDENTITY, { name: 'Trámites Aduanales Gerez S.C', logo: '/image_923273.svg' });
  assert.equal(displayName(C), 'Trámites Aduanales Gerez S.C');
  assert.equal(registeredName({ ...C, legal_name: 'TRAMITES ADUANALES GEREZ, S.C.' }), '', 'misma razón social (sin acentos, puntos ni comas): no se repite');
  assert.equal(registeredName({ ...C, legal_name: '' }), '');
  assert.equal(registeredName(C), 'Supply Base Services de Mexico');
  assert.match(activeText(C), /^Trámites Aduanales Gerez S\.C ya es el contratista activo/);
  assert.deepEqual(['trámites', 'ADUANALES gerez', 'Gerez S.C', 'SPM18', 'Supply', ''].map(serverQuery), ['', '', '', 'SPM18', 'Supply', ''], 'el nombre mostrado también encuentra la empresa');
});

test('Datos de la empresa: validación igual a la del servidor (ContractorInput)', () => {
  const ok = { companyName: 'Empresa QA', rfc: 'QAX010101-A1', phone: '+52 (55) 1234-5678 ext. 9', email: 'qa@supplyflow.invalid', address: 'Calle 1\nCol. 2' };
  assert.equal(validateCompany(ok), null);
  assert.equal(validateCompany({ ...ok, rfc: '', phone: '', email: '', address: '' }), null);
  assert.deepEqual(validateCompany({ ...ok, companyName: '   ' })[0], 'companyName');
  assert.deepEqual(validateCompany({ ...ok, companyName: 'x'.repeat(256) })[0], 'companyName');
  assert.deepEqual(validateCompany({ ...ok, rfc: 'RFC<script>' })[0], 'rfc');
  assert.deepEqual(validateCompany({ ...ok, phone: 'llamar' })[0], 'phone');
  assert.deepEqual(validateCompany({ ...ok, phone: '+()' })[0], 'phone');
  assert.deepEqual(validateCompany({ ...ok, email: 'qa@' })[0], 'email');
  assert.deepEqual(validateCompany({ ...ok, address: 'y'.repeat(4001) })[0], 'address');
});

test('Datos de la empresa: cuerpo del PUT (sin estatus) y logotipo opcional', () => {
  const f = { companyName: '  Empresa   QA ', rfc: ' QAX ', phone: ' 555 ', email: ' qa@x.mx ', address: '\tCalle 1\nCol. 2 ', status: 'Inactivo' };
  assert.deepEqual(companyPayload(f), { legal_name: 'Empresa QA', tax_id: 'QAX', phone: '555', email: 'qa@x.mx', address: 'Calle 1\nCol. 2' });
  assert.deepEqual(companyPayload(f, { remove: true }).logo, { remove: true });
  assert.equal('status' in companyPayload(f), false);
});

test('Datos de la empresa: mensajes de guardado y de error', () => {
  assert.equal(companySavedText({ changed: ['legal_name', 'logo_file'] }), 'Datos de la empresa guardados en MariaDB (razón social, logotipo).');
  assert.equal(companySavedText({ changed: [] }), 'No había cambios por guardar.');
  assert.match(companySaveError(412, 'STALE_VERSION', '', null)[1], /Otra persona modificó/);
  assert.match(companySaveError(422, 'INVALID_CONTRACTOR', '', 'phone')[1], /teléfono/);
  assert.match(companySaveError(403, 'FORBIDDEN', '', null)[1], /Master Admin/);
  assert.match(companySaveError(503, 'CATALOG_WRITE_GRANTS_INCOMPLETE', '', null)[1], /faltan permisos.*No se guardó nada.*docs\/contratista\/DATOS_EMPRESA\.md/);
  const [, net, retry] = companySaveError(0, undefined, 'sin conexión con la API', null);
  assert.ok(retry && /misma operación sin duplicarla/.test(net));
});
