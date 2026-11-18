// Órdenes de Compra · tarjeta 1 "Emisión de orden de compra": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { issuanceOptions, winningSuppliers, supplierTotal, toGenerate, validateIssuance, issuanceLockedText } from '../../src/views/purchaseOrders/poIssuance.mjs';

// Respuesta sintética con la forma de GET /api/v1/purchase-orders/issuance.
const DATA = {
  losing_quotes: 3,
  requisitions: [
    { id: 'r1', folio: 'REQ-1', client_reference: 'CLI-9', client_name: 'Cliente Uno', project: 'P1', client_approved: true, customer_quote: 'CQ-1-R1', quotes_received: 4, item_count: 3, awarded_items: 2 },
    { id: 'r2', folio: 'REQ-2', client_reference: null, client_name: 'Cliente Dos', project: null, client_approved: true, customer_quote: 'CQ-2', quotes_received: 2, item_count: 1, awarded_items: 0 },
    { id: 'r3', folio: 'REQ-3', client_reference: null, client_name: 'Cliente Uno', project: null, client_approved: false, customer_quote: null, quotes_received: 2, item_count: 1, awarded_items: 1 },
    { id: 'r4', folio: 'REQ-4', client_reference: null, client_name: 'Cliente Tres', project: null, client_approved: true, customer_quote: 'CQ-4', quotes_received: 2, item_count: 1, awarded_items: 1 },
  ],
  items: [
    { requisition_id: 'r1', supplier_id: 'sA', supplier_name: 'Aceros', items: 1, active_pos: null },
    { requisition_id: 'r1', supplier_id: 'sB', supplier_name: 'Bombas', items: 1, active_pos: 'OC-7' },
    { requisition_id: 'r3', supplier_id: 'sA', supplier_name: 'Aceros', items: 1, active_pos: null },
    { requisition_id: 'r4', supplier_id: 'sC', supplier_name: 'Cables', items: 2, active_pos: null },
  ],
  lines: [
    { requisition_id: 'r1', supplier_id: 'sA', line_number: '2', description: 'Placa', quantity: '3', unit_label: 'pza', unit_price: '500', subtotal: '1500', currency: 'USD', quote_folio: 'COT-1' },
    { requisition_id: 'r1', supplier_id: 'sB', line_number: '1', description: 'Bomba', quantity: '1', unit_label: 'pza', unit_price: '900', subtotal: '900', currency: 'USD', quote_folio: 'COT-2' },
    { requisition_id: 'r4', supplier_id: 'sC', line_number: '1', description: 'Cable', quantity: '10', unit_label: 'm', unit_price: '5', subtotal: '50', currency: 'MXN', quote_folio: 'COT-5' },
    { requisition_id: 'r4', supplier_id: 'sC', line_number: '2', description: 'Conector', quantity: '2', unit_label: 'pza', unit_price: '10', subtotal: '20', currency: 'USD', quote_folio: 'COT-5' },
  ],
};

test('opciones: solo aprobadas por el cliente; sin adjudicación deshabilitada; con adjudicación sin aprobación en espera', () => {
  const o = issuanceOptions(DATA);
  assert.deepEqual(o.options.map(x => [x.id, x.ready]), [['r1', true], ['r4', true], ['r2', false]]);
  assert.equal(o.options[0].label, 'REQ-1 · CLI-9 · Cliente Uno');
  assert.match(o.options[2].label, /sin adjudicación definitiva$/);
  assert.deepEqual(o.waiting.map(r => r.folio), ['REQ-3']);
  assert.equal(o.quotesReceived, 6, 'cotizaciones recibidas de las requisiciones listas');
});

test('proveedores ganadores: partidas, total por moneda y OC ya generada (pendientes primero)', () => {
  const w = winningSuppliers(DATA, 'r1');
  assert.deepEqual(w.map(s => [s.name, s.generated, s.po]), [['Aceros', false, ''], ['Bombas', true, 'OC-7']]);
  assert.equal(w[0].lines[0].description, 'Placa'); assert.deepEqual(w[0].quotes, ['COT-1']);
  assert.equal(supplierTotal(w[0]), '$1,500.00 USD');
  assert.equal(toGenerate(w), 1);
  assert.deepEqual(winningSuppliers(DATA, ''), []);
  assert.deepEqual(winningSuppliers(DATA, 'r2'), []);
});

test('crear: sin requisición o sin adjudicación no procede', () => {
  assert.match(validateIssuance(null, []).errors[0], /Selecciona una requisición/);
  const r2 = issuanceOptions(DATA).options.find(o => o.id === 'r2');
  assert.match(validateIssuance(r2, []).errors.join(' '), /adjudicación definitiva/);
});

test('crear: solo las OC faltantes, con advertencias de partidas sin adjudicar y OC ya generadas', () => {
  const r1 = issuanceOptions(DATA).options.find(o => o.id === 'r1');
  const v = validateIssuance(r1, winningSuppliers(DATA, 'r1'));
  assert.equal(v.ok, true);
  assert.deepEqual(v.orders, [{ supplier: 'Aceros', items: 1, total: '$1,500.00 USD' }]);
  assert.match(v.warnings.join(' '), /1 de 3 partida\(s\) aún sin adjudicación/);
  assert.match(v.warnings.join(' '), /Ya generadas: OC-7 \(Bombas\)/);
  const t = issuanceLockedText(r1, v.orders);
  assert.match(t, /^Datos validados, pero no se generó la OC de REQ-1 \(Aceros: \$1,500.00 USD · 1 partida\(s\)\)/);
  assert.match(issuanceLockedText(r1, [...v.orders, { supplier: 'Bombas', items: 1, total: '$900.00 USD' }]), /no se generaron las 2 OC de REQ-1/);
  assert.match(t, /escritura comercial bloqueada/);
});

test('crear: todas generadas o proveedor con varias monedas', () => {
  const r1 = issuanceOptions(DATA).options.find(o => o.id === 'r1');
  const all = winningSuppliers(DATA, 'r1').map(s => ({ ...s, generated: true, po: s.po || 'OC-8' }));
  assert.match(validateIssuance(r1, all).errors[0], /ya fueron generadas/);
  const r4 = issuanceOptions(DATA).options.find(o => o.id === 'r4');
  const v4 = validateIssuance(r4, winningSuppliers(DATA, 'r4'));
  assert.equal(v4.ok, false); assert.match(v4.errors[0], /varias monedas \(MXN, USD\)/);
});

test('inglés', () => {
  assert.equal(validateIssuance(null, [], true).errors[0], 'Select a requisition approved by the client.');
  assert.match(issuanceOptions(DATA, true).options[2].label, /no definitive award$/);
});
