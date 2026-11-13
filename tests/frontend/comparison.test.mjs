// Cotizaciones › Comparativo y selección preliminar · lógica pura. node --test tests/frontend/comparison.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEIGHTS, majorityCurrency, scoreQuotes, awardState, initialSelection, awardPreview, awardChanges } from '../../src/views/quotes/comparison.mjs';

const offer = (q, sup, price, extra = {}) => ({ quote_id: q, quote_folio: `F-${q}`, supplier_name: sup, currency: 'USD', offered: true, quantity: '3', unit_price: String(price), ...extra });
const lines = [
  { id: 'l1', line_number: 1, quantity: '3', line_status: 'active', award: { quote_id: 'A', quantity: '3.000000' }, offers: [offer('A', 'Aceros', 500), offer('B', 'Equipos', 566.666667)] },
  { id: 'l2', line_number: 2, quantity: '1', line_status: 'active', award: null, offers: [offer('B', 'Equipos', 100)] },
  { id: 'l3', line_number: 3, quantity: '1', line_status: 'cancelled', offers: [] },
];
const quotes = [
  { id: 'A', supplier_name: 'Aceros', currency: 'USD', total_amount: '1500', lead_days: 5, technical_score: '90', document_score: null, awarded_lines: 1 },
  { id: 'B', supplier_name: 'Equipos', currency: 'USD', total_amount: '1800', lead_days: 10, technical_score: '80', document_score: '100', awarded_lines: 0 },
];

test('pesos del criterio suman 100', () => { assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100); });

test('moneda mayoritaria', () => {
  assert.equal(majorityCurrency([{ currency: 'USD' }, { currency: 'MXN' }, { currency: 'USD' }]), 'USD');
  assert.equal(majorityCurrency([]), null);
});

test('puntaje: precio por partida (no ofertadas = 0), entrega, técnico y documental', () => {
  const r = scoreQuotes(quotes, lines.slice(0, 2));
  const a = r.find(q => q.id === 'A'); const b = r.find(q => q.id === 'B');
  // A: precio (1 + 0)/2 = 50 · entrega 100 · técnico 90 · documental 0 → 20 + 15 + 22.5 + 0 = 57.5
  assert.deepEqual(a.parts, { price: 50, delivery: 100, technical: 90, documental: 0 }); assert.equal(a.score, 57.5);
  // B: precio (500/566.67 + 1)/2 = 94.1 · entrega 6/11 = 54.5 · técnico 80 · documental 100
  assert.equal(b.parts.price, 94.1); assert.equal(b.parts.delivery, 54.5); assert.equal(b.score, 37.6 + 8.2 + 20 + 20);
  assert.equal(r[0].id, 'B'); assert.equal(r[0].recommended, true); assert.equal(r[1].position, 2); assert.equal(r[1].recommended, false);
});

test('partidas canceladas no cuentan y una sola oferta completa obtiene precio y entrega máximos', () => {
  const r = scoreQuotes([quotes[0]], [lines[0], lines[2]]);
  assert.deepEqual(r[0].parts, { price: 100, delivery: 100, technical: 90, documental: 0 }); assert.equal(r[0].score, 77.5);
});

test('otra moneda no se compara ni se recomienda', () => {
  const mx = { ...quotes[1], id: 'C', currency: 'MXN' };
  const r = scoreQuotes([quotes[0], mx, { ...quotes[0], id: 'D' }], [lines[0]]);
  const c = r.find(q => q.id === 'C');
  assert.equal(c.comparable, false); assert.equal(c.parts.price, 0); assert.equal(c.recommended, false); assert.equal(r.at(-1).id, 'C');
});

test('empate: gana el menor total y luego el menor plazo', () => {
  const t = [{ ...quotes[0], id: 'X', total_amount: '1600' }, { ...quotes[0], id: 'Y', total_amount: '1500' }];
  const l = [{ id: 'l', line_number: 1, line_status: 'active', offers: [offer('X', 'X', 500), offer('Y', 'Y', 500)] }];
  assert.equal(scoreQuotes(t, l)[0].id, 'Y');
});

test('estatus de adjudicación por cotización', () => {
  assert.equal(awardState({ awarded_lines: 2 }, 2), 'total'); assert.equal(awardState({ awarded_lines: 1 }, 2), 'partial'); assert.equal(awardState({ awarded_lines: 0 }, 2), null);
});

test('selección inicial = adjudicación vigente; sin cambios no hay nada que guardar', () => {
  const sel = initialSelection(lines);
  assert.deepEqual(sel, { l1: { quote: 'A', qty: '3' }, l2: { quote: '', qty: '1' } });
  assert.equal(awardChanges(lines, sel).length, 0);
});

test('vista previa: una OC por proveedor con sus partidas e importe; errores de cantidad', () => {
  const sel = { l1: { quote: 'B', qty: '3' }, l2: { quote: 'B', qty: '1' } };
  const p = awardPreview(lines, sel);
  assert.deepEqual(p.orders.map(o => [o.supplier_name, o.lines, o.amount, o.currency]), [['Equipos', 2, 1800, 'USD']]);
  assert.equal(awardChanges(lines, sel).length, 2);
  assert.deepEqual(awardPreview(lines, { l1: { quote: 'A', qty: '0' } }).errors, [{ line: 1, code: 'qty' }]);
  assert.deepEqual(awardPreview(lines, { l1: { quote: 'A', qty: '4' } }).errors, [{ line: 1, code: 'over_offer' }]);
  assert.equal(awardPreview(lines, { l1: { quote: '', qty: '3' } }).orders.length, 0);
});
