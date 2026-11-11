// Proveedores · pruebas de la lógica pura (sin red). Uso: node --test tests/frontend/suppliers_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSupplierHeaders, analyzeSupplierImport, supplierIndicators, leadTime, credit, ratingText, matchKey, SUPPLIER_TEMPLATE_HEADERS } from '../../src/views/suppliers/model.mjs';

const existing = [
  { id: 'a', code: 'PRV-QA-01', supplier_key: 'KQA1', name: 'Proveedor Sintético QA, S.A. de C.V.', tax_id: 'PSQ010101AAA', status: 'authorized', rating: 4.5, offerings_count: 3, category: 'Materiales' },
  { id: 'b', code: 'PRV-QA-02', supplier_key: '', name: 'Servicios Sintéticos', tax_id: '', status: 'under_evaluation', rating: null, offerings_count: 0, category: 'Servicios' },
  { id: 'c', code: 'PRV-QA-03', supplier_key: null, name: 'Suspendido QA', tax_id: null, status: 'suspended', rating: '3', offerings_count: '2', category: '' },
];

test('reconoce encabezados del diseño (inglés) y equivalentes en español, incluidos múltiples', () => {
  const { map, unknown, recognized } = mapSupplierHeaders(SUPPLIER_TEMPLATE_HEADERS);
  assert.deepEqual(unknown, []);
  assert.equal(recognized, SUPPLIER_TEMPLATE_HEADERS.length);
  assert.equal(map.code, 0); assert.equal(map.key, 1); assert.equal(map.name, 2); assert.equal(map.rfc, 4);
  assert.deepEqual(map.emails, [5, 6]); assert.deepEqual(map.contacts, [7, 8]); assert.deepEqual(map.phones, [9]);
  const es = mapSupplierHeaders(['No. de proveedor', 'Razón social', 'Correo electrónico', 'Teléfono', 'Categoría', 'Moneda', 'Columna rara']);
  assert.equal(es.map.code, 0); assert.equal(es.map.name, 1); assert.deepEqual(es.map.emails, [2]); assert.deepEqual(es.map.phones, [3]);
  assert.equal(es.map.category, 4); assert.equal(es.map.currency, 5); assert.deepEqual(es.unknown, ['Columna rara']);
});

test('coincidencia por No. de proveedor, Clave, RFC y razón social sin mayúsculas, acentos ni puntuación', () => {
  assert.equal(matchKey('Proveedor Sintético QA, S.A. de C.V.'), matchKey('PROVEEDOR SINTETICO QA SA DE CV'));
  const headers = ['Provider number', 'Clave', 'Legal / company name', 'RFC', 'Category'];
  const rows = [
    ['prv-qa-01', '', 'Otro nombre', '', 'X'],                         // por número
    ['', 'kqa1', 'Otro', '', 'X'],                                     // por clave
    ['NUEVO-1', '', 'Distinto', 'psq010101aaa', 'X'],                  // por RFC
    ['NUEVO-2', '', 'servicios sinteticos', '', 'X'],                  // por razón social
  ];
  const a = analyzeSupplierImport(headers, rows, existing, {});
  assert.deepEqual(a.rows.map(r => r.matchedBy), ['code', 'key', 'rfc', 'name']);
  assert.deepEqual(a.rows.map(r => r.matched?.id), ['a', 'a', 'a', 'b']);
  assert.equal(a.counts.existing_skip, 4);
  assert.equal(analyzeSupplierImport(headers, rows, existing, { duplicateMode: 'update' }).counts.existing_update, 4);
});

test('nuevos, incompletos (siempre En evaluación), repetidos en archivo y defaults', () => {
  const headers = ['Provider number', 'Legal / company name', 'Email', 'Category', 'Currency'];
  const rows = [
    ['N-1', 'Alfa', 'ventas@alfa.invalid; compras@alfa.invalid', 'Materiales', 'usd'],
    ['N-2', 'Beta', 'no-es-correo', '', ''],
    ['', 'Gamma', '', 'Servicios', 'MXN'],
    ['N-1', 'Alfa duplicado', '', 'Materiales', 'MXN'],
    ['', '', '', '', ''],                                              // fila vacía: se ignora
    ['N-5', 'Delta', '', 'Fletes', 'JPY'],
  ];
  const a = analyzeSupplierImport(headers, rows, existing, { newStatus: 'authorized', defaultCurrency: 'EUR' });
  assert.equal(a.counts.total, 5);
  const [alfa, beta, gamma, dup, delta] = a.rows;
  assert.equal(alfa.outcome, 'new'); assert.equal(alfa.currency, 'USD'); assert.equal(alfa.statusIfSaved, 'authorized');
  assert.deepEqual(alfa.emails, ['ventas@alfa.invalid', 'compras@alfa.invalid']);
  assert.equal(beta.outcome, 'new_incomplete'); assert.deepEqual(beta.issues, ['category', 'email']); assert.equal(beta.currency, 'EUR');
  assert.equal(beta.statusIfSaved, 'under_evaluation');
  assert.equal(gamma.outcome, 'new_incomplete'); assert.deepEqual(gamma.issues, ['code']);
  assert.equal(dup.outcome, 'duplicate_in_file'); assert.equal(dup.matchedBy, 'code'); assert.equal(dup.statusIfSaved, null);
  assert.equal(delta.outcome, 'new_incomplete'); assert.deepEqual(delta.issues, ['currency']);
  assert.equal(delta.n, 6, 'conserva el número de fila del archivo');
  const withDefault = analyzeSupplierImport(headers, [['N-9', 'Omega', '', '', '']], [], { defaultCategory: 'General' });
  assert.equal(withDefault.rows[0].category, 'General'); assert.equal(withDefault.rows[0].outcome, 'new');
});

test('indicadores sobre la lista completa y el resumen del servidor', () => {
  const summary = { total: 3, incomplete: 1, statuses: [{ code: 'authorized', count: '1' }, { code: 'suspended', count: 1 }, { code: 'under_evaluation', count: 1 }] };
  const i = supplierIndicators(summary, existing);
  assert.equal(i.total, 3); assert.equal(i.authorized, 1); assert.equal(i.evaluation, 1); assert.equal(i.suspended, 1); assert.equal(i.incomplete, 1);
  assert.equal(i.rated, 2); assert.equal(i.avgRating, 3.8);
  assert.equal(i.offerings, 5); assert.equal(i.withOfferings, 2);
  assert.deepEqual(i.categories.map(c => c.name), ['Materiales', 'Servicios', 'Sin categoría']);
  assert.equal(i.complete, true);
  const empty = supplierIndicators({}, []);
  assert.equal(empty.avgRating, null); assert.equal(empty.total, 0); assert.equal(empty.complete, true);
});

test('formatos de entrega, crédito y calificación sin inventar valores', () => {
  assert.equal(leadTime({ lead_time_value: '5.00', lead_time_unit: 'días' }), '5 días');
  assert.equal(leadTime({ lead_time_value: null, lead_time_unit: 'días' }), '');
  assert.equal(credit({ credit_type: 'Crédito', credit_days: '30' }), 'Crédito · 30 días');
  assert.equal(credit({ credit_type: 'Crédito', credit_days: 30 }, true), 'Crédito · 30 days');
  assert.equal(credit({ credit_type: null, credit_days: null }), '');
  assert.equal(ratingText({ rating: '4.50' }, '5'), '4.5 / 5');
  assert.equal(ratingText({ rating: null }, '5'), '');
});
