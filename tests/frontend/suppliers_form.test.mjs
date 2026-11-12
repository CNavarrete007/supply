// Proveedores · formulario de alta/actualización (lógica pura). Uso: node --test tests/frontend/suppliers_form.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, CREDIT_TYPES, LEAD_UNITS, optionValue, emptyForm, formFromRecord, validateForm, toPayload, payloadSignature, missingRequired, saveErrorMessage } from '../../src/views/suppliers/form.mjs';

test('opciones del diseño y valores por omisión', () => {
  assert.deepEqual(STATUSES.map(o => o[1]), ['En evaluación', 'Autorizado', 'Suspendido', 'Inactivo']);
  assert.deepEqual(CREDIT_TYPES.map(o => o[1]), ['Contado', 'Anticipo', 'Crédito', 'Contra entrega', 'Parcialidades', 'Consignación', 'Otro']);
  assert.deepEqual(LEAD_UNITS.map(o => o[1]), ['Días hábiles', 'Días naturales', 'Semanas', 'Meses']);
  const f = emptyForm();
  assert.deepEqual([f.status, f.currency, f.credit_type, f.credit_days, f.lead_time_value, f.lead_time_unit, f.rating, f.rating_scale], ['under_evaluation', 'MXN', 'Contado', '0', '0', 'días hábiles', '80', '100']);
  assert.equal(optionValue('Semanas', LEAD_UNITS), 'semanas'); assert.equal(optionValue('CREDITO', CREDIT_TYPES), 'Crédito'); assert.equal(optionValue('horas', LEAD_UNITS), 'horas');
});

test('ficha importada → formulario conserva valores históricos y escala', () => {
  const f = formFromRecord({ id: 'x', version: 3, imported: true, code: 'PRV-1', name: 'Prov', status: 'active', credit_type: 'Contado', lead_time_unit: 'horas', lead_time_value: '4.0000',
    rating: '2.4000', rating_scale: '5', currency: 'MXN', category: 'Materiales', contacts: [{ name: 'Ana' }], channels: [{ type: 'phone', value: '111' }, { type: 'phone', value: '222' }, { type: 'email', value: 'a@b.mx' }] });
  assert.equal(f.status, 'active'); assert.equal(f.legacy.status, 'active'); assert.equal(f.legacy.lead_time_unit, 'horas'); assert.equal(f.legacy.credit_type, '');
  assert.equal(f.lead_time_value, '4'); assert.equal(f.rating, '2.4'); assert.equal(f.rating_scale, '5'); assert.deepEqual(f.phones, ['111', '222']); assert.deepEqual(f.emails, ['a@b.mx']);
  assert.equal(validateForm({ ...f, rating: '6' }).errors.rating, 'Calificación entre 0 y 5.');
});

test('validación previa y obligatorios', () => {
  assert.deepEqual(Object.keys(validateForm(emptyForm()).errors).sort(), ['category', 'code', 'name']);
  assert.deepEqual(missingRequired(emptyForm()), ['No. de proveedor', 'razón social', 'categoría']);
  const ok = { ...emptyForm(), code: 'PROV-001', name: 'X', category: 'Materiales' };
  assert.equal(validateForm(ok).ok, true);
  assert.deepEqual(Object.keys(validateForm({ ...ok, emails: ['mal'], phones: ['abc'], credit_days: '-1', lead_time_value: '10000', rating: '101' }).errors).sort(), ['credit_days', 'emails', 'lead_time_value', 'phones', 'rating']);
});

test('cuerpo JSON y firma de guardado', () => {
  const f = { ...emptyForm(), code: ' P1 ', name: 'N', category: 'Servicios', contacts: ['Ana', ''], phones: ['', '81-1'], credit_days: '', rating: '' };
  const p = toPayload(f);
  assert.equal(p.code, 'P1'); assert.deepEqual(p.contacts, ['Ana']); assert.deepEqual(p.phones, ['81-1']); assert.equal(p.credit_days, null); assert.equal(p.rating, null); assert.equal(p.lead_time_value, 0); assert.equal(p.logo, null);
  assert.equal(payloadSignature(f), payloadSignature({ ...f })); assert.notEqual(payloadSignature(f), payloadSignature({ ...f, notes: 'x' }));
  assert.notEqual(payloadSignature(f), payloadSignature({ ...f, logo: { current: null, next: { name: 'l.webp', size: 10, dataUrl: 'd' }, remove: false } }));
  assert.match(saveErrorMessage(409, 'CODE_TAKEN'), /número de proveedor ya está registrado/); assert.match(saveErrorMessage(503, 'CATALOG_WRITE_NOT_PROVISIONED'), /proveedores/);
});
