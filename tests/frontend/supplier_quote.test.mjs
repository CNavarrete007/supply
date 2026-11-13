// Cotizaciones › Registro de cotización · lógica pura. node --test tests/frontend/supplier_quote.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyQuote, linesFromRfq, lineAmounts, quoteTotals, qtyNote, validateQuote, isPdfHeader, normQty } from '../../src/views/quotes/supplierQuote.mjs';

const items = [{ line_number: '1', description: 'Material', specification: null, category: 'Materiales', unit_label: 'pza', quantity: '2.000000' },
  { line_number: '2', description: 'Flete', specification: 'Local', category: null, unit_label: 'viaje', quantity: '1.500000' }];
const ready = (patch = {}) => ({ ...emptyQuote(), buyer: 'b', requisition: 'r', rfq: 'f', quote_date: '2026-11-10', lead_days: '7', ...patch });

test('partidas desde la RFQ: todas ofertadas y cantidad cotizada = solicitada', () => {
  const l = linesFromRfq(items);
  assert.deepEqual(l.map(x => [x.line_number, x.requested, x.qty, x.offered, x.price]), [[1, '2', '2', true, ''], [2, '1.5', '1.5', true, '']]);
  assert.equal(l[1].specification, 'Local'); assert.equal(normQty('3.000000'), '3');
});

test('importe sin IVA, IVA y total por partida y totales (centavos redondeados)', () => {
  const l = linesFromRfq(items); l[0].price = '1250.5'; l[1].price = '333.333';
  assert.deepEqual(lineAmounts(l[0], '16'), { subtotal: 2501, tax: 400.16, total: 2901.16 });
  assert.deepEqual(lineAmounts(l[1], '16'), { subtotal: 500, tax: 80, total: 580 });
  assert.deepEqual(quoteTotals(l, '16'), { offered: 2, subtotal: 3001, tax: 480.16, total: 3481.16 });
  l[1].offered = false;
  assert.deepEqual(quoteTotals(l, '0'), { offered: 1, subtotal: 2501, tax: 0, total: 2501 });
  assert.deepEqual(lineAmounts({ offered: true, qty: '1,5', price: '10' }, '16'), { subtotal: 0, tax: 0, total: 0 });
});

test('cantidad cotizada parcial o mayor a la solicitada', () => {
  assert.equal(qtyNote({ offered: true, qty: '1', requested: '2' }), 'partial');
  assert.equal(qtyNote({ offered: true, qty: '3', requested: '2' }), 'over');
  assert.equal(qtyNote({ offered: true, qty: '2.0', requested: '2' }), '');
  assert.equal(qtyNote({ offered: false, qty: '1', requested: '2' }), '');
});

test('validación: obligatorios del diseño, fechas, porcentajes y partidas con precio', () => {
  const l = linesFromRfq(items); l.forEach(x => { x.price = '10'; });
  assert.equal(validateQuote(ready(), l).ok, true);
  const e = validateQuote(emptyQuote(), []).errors; assert.ok(e.buyer && e.requisition && e.rfq && e.quote_date && e.lead_days);
  assert.ok(!e.lines, 'sin RFQ no se exigen partidas');
  assert.match(validateQuote(ready({ valid_until: '2026-11-01' }), l).errors.valid_until, /anterior/);
  assert.ok(validateQuote(ready({ vat: '116' }), l).errors.vat); assert.ok(validateQuote(ready({ technical: '-1' }), l).errors.technical); assert.ok(validateQuote(ready({ documentation: 'x' }), l).errors.documentation);
  assert.ok(validateQuote(ready({ lead_days: '2.5' }), l).errors.lead_days); assert.ok(validateQuote(ready({ lead_days: '4000' }), l).errors.lead_days);
  assert.match(validateQuote(ready(), l.map(x => ({ ...x, offered: false }))).errors.lines, /al menos una partida/);
  const noPrice = linesFromRfq(items); assert.match(validateQuote(ready(), noPrice).first, /precio unitario/);
  const zeroQty = linesFromRfq(items).map(x => ({ ...x, price: '1', qty: '0' })); assert.match(validateQuote(ready(), zeroQty).first, /cantidad cotizada mayor a cero/);
  assert.match(validateQuote(emptyQuote(), [], true).errors.buyer, /Select the responsible buyer/);
});

test('formulario vacío con los valores por defecto del diseño', () => {
  const e = emptyQuote();
  assert.deepEqual([e.buyer, e.requisition, e.rfq, e.vat, e.currency, e.technical, e.documentation, e.payment, e.lead_days], ['', '', '', '16', 'MXN', '100', '100', '', '']);
});

test('PDF: se valida por su firma, no solo por el tipo declarado', () => {
  assert.equal(isPdfHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(isPdfHeader(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c])), false);
  assert.equal(isPdfHeader(new Uint8Array([0x25])), false);
});
