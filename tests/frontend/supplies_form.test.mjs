// Suministros de proveedores · formulario (lógica pura). Uso: node --test tests/frontend/supplies_form.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, CATEGORIES, LEAD_UNITS, CREDIT_TYPES, STATUSES, OTHER_TYPE, emptyForm, formFromRecord, validateForm, toPayload, payloadSignature, missingRequired, serverField, saveErrorMessage } from '../../src/views/supplies/form.mjs';

test('listas del diseño y valores por omisión', () => {
  assert.deepEqual(TYPES.map(o => o[1]), ['Producto', 'Servicio', 'Renta', 'Consumible', 'Refacción', 'Equipo', 'Almacenamiento', 'Herramienta']);
  assert.deepEqual(CATEGORIES, ['Almacenamiento', 'Consumibles', 'EPP y seguridad', 'Equipos', 'Herramientas', 'Materiales', 'Refacciones', 'Renta de equipo', 'Servicios', 'Tecnología y comunicación', 'Transporte y logística', 'Otros']);
  assert.deepEqual(LEAD_UNITS.map(o => o[1]), ['Días hábiles', 'Días naturales', 'Semanas', 'Meses']);
  assert.deepEqual(CREDIT_TYPES.map(o => o[1]), ['Contado', 'Anticipo', 'Crédito', 'Contra entrega', 'Parcialidades', 'Consignación', 'Otros']);
  assert.deepEqual(STATUSES.map(o => o[1]), ['Activo', 'Inactivo', 'No disponible']);
  const f = emptyForm('sup-1');
  assert.deepEqual([f.supplier_id, f.type, f.category, f.lead_time_unit, f.credit_type, f.currency, f.coverage, f.status], ['sup-1', 'product', 'Materiales', 'días hábiles', 'Contado', 'MXN', 'Nacional', 'active']);
});

test('registro → formulario conserva valores históricos', () => {
  const f = formFromRecord({ id: 'o1', version: 123456789012345, supplier_id: 's1', name: 'Grúa', type: 'Servicio', category: 'Fletes', lead_time_unit: 'horas', credit_type: 'Crédito', status: 'available', lead_time_value: '4.0000', credit_days: 30, currency: 'USD', valid_until: '2027-01-31' });
  assert.equal(f.version, 123456789012345); assert.equal(f.type, 'Servicio'); assert.equal(f.legacy.type, 'Servicio'); assert.equal(f.legacy.lead_time_unit, 'horas'); assert.equal(f.legacy.status, 'available');
  assert.equal(f.legacy.credit_type, ''); assert.equal(f.lead_time_value, '4'); assert.equal(f.credit_days, '30'); assert.equal(f.category, 'Fletes');
  assert.equal(toPayload(f).type, 'Servicio', 'el tipo histórico viaja sin cambios');
});

test('validación previa, tipo nuevo y obligatorios', () => {
  assert.deepEqual(Object.keys(validateForm(emptyForm()).errors).sort(), ['name', 'supplier_id']);
  assert.deepEqual(missingRequired(emptyForm()), ['proveedor', 'producto, servicio o suministro']);
  const ok = { ...emptyForm('s1'), name: 'Placa' };
  assert.equal(validateForm(ok).ok, true);
  assert.deepEqual(Object.keys(validateForm({ ...ok, type: OTHER_TYPE, lead_time_value: '-1', credit_days: '1.5' }).errors).sort(), ['credit_days', 'lead_time_value', 'type_other']);
  assert.equal(toPayload({ ...ok, type: OTHER_TYPE, type_other: ' Grúa ' }).type, 'Grúa');
});

test('cuerpo JSON sin precios ni logotipo; firma y mensajes', () => {
  const p = toPayload({ ...emptyForm('s1'), name: ' Placa ', lead_time_value: '', credit_days: '', valid_until: '' });
  assert.equal(p.name, 'Placa'); assert.equal(p.lead_time_value, null); assert.equal(p.credit_days, null); assert.equal(p.valid_until, null);
  assert.ok(!Object.keys(p).some(k => /price|logo/.test(k)));
  const f = { ...emptyForm('s1'), name: 'X' };
  assert.equal(payloadSignature(f), payloadSignature({ ...f })); assert.notEqual(payloadSignature(f), payloadSignature({ ...f, notes: 'n' }));
  assert.equal(serverField('type'), 'type_other');
  assert.match(saveErrorMessage(409, 'DUPLICATE_OFFERING'), /ya tiene registrado/); assert.match(saveErrorMessage(503, 'CATALOG_WRITE_NOT_PROVISIONED'), /suministros/);
});
