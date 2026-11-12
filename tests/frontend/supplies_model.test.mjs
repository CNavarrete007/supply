// Suministros de proveedores · pruebas de la lógica pura. Uso: node --test tests/frontend/supplies_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { typeLabel, statusKey, statusLabel, leadTime, credit, isDayUnit, supplierCommercial, supplierCards, avatarText } from '../../src/views/supplies/model.mjs';

test('etiquetas: códigos conocidos traducidos y desconocidos tal cual', () => {
  assert.equal(typeLabel('product'), 'Producto'); assert.equal(typeLabel('Servicio', true), 'Service'); assert.equal(typeLabel('kit_especial'), 'kit_especial'); assert.equal(typeLabel(null), '—');
  assert.deepEqual(['active', 'available', 'Activo', 'inactive', 'No disponible', 'raro'].map(statusKey), ['active', 'active', 'active', 'inactive', 'unavailable', 'other']);
  assert.equal(statusLabel('unavailable'), 'No disponible'); assert.equal(statusLabel('raro'), 'raro');
});

test('tiempo de entrega y crédito sin inventar valores', () => {
  assert.equal(leadTime({ lead_time_value: '5.0000', lead_time_unit: 'días hábiles' }), '5 días hábiles');
  assert.equal(leadTime({ lead_time_value: null }), '');
  assert.equal(credit({ credit_type: 'Crédito', credit_days: 30 }), 'Crédito · 30 días');
  assert.equal(credit({}), '');
  assert.ok(isDayUnit('días hábiles') && isDayUnit('Días naturales') && isDayUnit('dias') && !isDayUnit('semanas') && !isDayUnit(''));
});

test('resumen comercial de un proveedor', () => {
  const offs = [
    { name: 'Placa', status: 'active', category: 'Materiales', lead_time_value: '5', lead_time_unit: 'días hábiles', credit_type: 'Crédito', coverage: 'Nacional', currency: 'MXN' },
    { name: 'Ángulo', status: 'active', category: 'Materiales', lead_time_value: '3', lead_time_unit: 'días naturales', credit_type: 'Contado', coverage: 'Tamaulipas', currency: 'MXN' },
    { name: 'Corte', status: 'inactive', category: 'Servicios', lead_time_value: '2', lead_time_unit: 'semanas', credit_type: 'Crédito', coverage: 'Nacional', currency: 'USD' },
  ];
  const c = supplierCommercial(offs, { currency: 'MXN', credit_type: 'Crédito', credit_days: 30, lead_time_value: '5', lead_time_unit: 'días hábiles', rating: '4.6', rating_scale: '5' });
  assert.deepEqual([c.registered, c.active, c.generalCategory, c.avgDays, c.dayBased, c.timed], [3, 2, 'Materiales', 4, 2, 3]);
  assert.deepEqual(c.categories, ['Materiales', 'Servicios']); assert.deepEqual(c.creditTypes, ['Crédito', 'Contado']); assert.deepEqual(c.coverages, ['Nacional', 'Tamaulipas']);
  assert.deepEqual(c.activeItems, ['Placa', 'Ángulo']);
  assert.deepEqual([c.habitualCurrency, c.habitualLead, c.habitualCredit, c.creditDays, c.rating, c.ratingScale], ['MXN', '5 días hábiles', 'Crédito · 30 días', 30, 4.6, '5']);
  const none = supplierCommercial([], null);
  assert.deepEqual([none.registered, none.avgDays, none.generalCategory, none.rating], [0, null, null, null]);
});

test('tarjetas por proveedor desde el resumen del servidor', () => {
  const r = supplierCards({ suppliers: [{ id: 'a', name: 'A', total: 3, active: 2 }, { id: 'b', name: 'B', total: 1, active: 1 }] });
  assert.deepEqual(r.all, { id: 'all', total: 4, active: 3, others: 1, suppliers: 2 });
  assert.equal(r.items[0].others, 1); assert.equal(supplierCards({}).all.total, 0);
});

test('iniciales del avatar de las tarjetas por proveedor (diseño)', () => {
  assert.deepEqual(['001', 'CENTURION FR', 'MARÍA EUGENIA ROVIROSA FERIA', 'ULINE SHIPPING SUPPLIES', 'Grúas del Golfo', '', '  (S.A.) de C.V.'].map(avatarText), ['00', 'CF', 'ME', 'US', 'GD', '—', 'SD']);
});
