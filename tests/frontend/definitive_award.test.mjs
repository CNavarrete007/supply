// Tarjeta 10 · Adjudicación definitiva: lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARD_STEPS, eligibleRef, awardBadge, recommendedByLine, definitiveInit, chosenOffer, validateAward } from '../../src/views/quotes/definitiveAward.mjs';

const off = (q, sup, price, extra = {}) => ({ quote_id: q, quote_folio: `COT-${q}`, supplier_name: sup, currency: 'MXN', offered: true, quantity: '2', unit_price: String(price), lead_days: '5', ...extra });
const QUOTES = [
  { id: 'A', folio: 'COT-A', supplier_name: 'Aceros', currency: 'MXN', total_amount: 800, lead_days: 7, technical_score: 90 },
  { id: 'B', folio: 'COT-B', supplier_name: 'Bienes', currency: 'MXN', total_amount: 760, lead_days: 12, technical_score: 70 },
];
const LINES = [
  { id: 'L1', line_number: 1, description: 'Tubo', quantity: '2', unit_label: 'pza', line_status: 'active', award: null, offers: [off('A', 'Aceros', 400), off('B', 'Bienes', 380)] },
  { id: 'L2', line_number: 2, description: 'Brida', quantity: '1', unit_label: 'pza', line_status: 'active', award: null, offers: [off('B', 'Bienes', 120)] },
  { id: 'L3', line_number: 3, description: 'Cancelada', quantity: '1', unit_label: 'pza', line_status: 'cancelled', award: null, offers: [] },
];

test('flujo de seis pasos con gate en la aceptación del cliente', () => {
  assert.deepEqual(AWARD_STEPS.map(s => s[1]), ['Comparativo', 'Selección preliminar', 'Cotización al cliente', 'Aceptación del cliente', 'Adjudicación definitiva', 'Orden de Compra']);
  assert.deepEqual(AWARD_STEPS.map(s => s[5]), ['done', 'done', 'done', 'gate', 'current', 'next']);
});

test('referencia y estado de adjudicación de la fila elegible', () => {
  assert.equal(eligibleRef({ client_reference: '19900001411', requisition: 'REQ-1' }), '19900001411');
  assert.equal(eligibleRef({ client_reference: '', requisition: 'SOL-PROV-2026-0001' }), 'SOL-PROV-2026-0001');
  assert.equal(awardBadge({ item_count: 2, awarded_items: 0 }).text, 'Elegible');
  assert.equal(awardBadge({ item_count: 2, awarded_items: 1 }).text, 'Adjudicación parcial');
  assert.equal(awardBadge({ item_count: 2, awarded_items: 2 }).text, 'Adjudicada');
  assert.equal(awardBadge({ item_count: 2, awarded_items: 2, purchase_orders: 'OC-1' }, true).text, 'With PO');
});

test('recomendado por partida: cotización recomendada; si no ofertó, la más barata', () => {
  const r = recommendedByLine(LINES, QUOTES);
  assert.ok(r.quote);
  assert.equal(r.byLine.L2.quote_id, 'B'); // A no ofertó la brida
  assert.equal(r.byLine.L3, undefined); // partida cancelada fuera
  assert.equal(chosenOffer(LINES[0], { quote: 'B' }).supplier_name, 'Bienes');
  assert.equal(chosenOffer(LINES[0], { quote: '' }), null);
});

test('selección inicial: adjudicación vigente o recomendado', () => {
  const lines = [{ ...LINES[0], award: { quote_id: 'B', quantity: '2.000000' } }, LINES[1]];
  const init = definitiveInit(lines, { L1: LINES[0].offers[0], L2: LINES[1].offers[0] });
  assert.deepEqual(init, { L1: { quote: 'B', qty: '2', why: '' }, L2: { quote: 'B', qty: '1', why: '' } });
});

test('validación: gate, proveedor, cantidad, justificación y OC vigente', () => {
  const rec = { L1: LINES[0].offers[0], L2: LINES[1].offers[0] };
  const lines = LINES.slice(0, 2);
  let v = validateAward({ lines, selection: { L1: { quote: 'A', qty: '2' }, L2: { quote: 'B', qty: '1' } }, recommended: rec, approved: false });
  assert.equal(v.ok, false); assert.match(v.errors.gate, /no está aprobada/);
  v = validateAward({ lines, selection: { L1: { quote: '', qty: '2' }, L2: { quote: 'B', qty: '1' } }, recommended: rec, approved: true });
  assert.match(v.errors.L1, /selecciona el proveedor definitivo/);
  v = validateAward({ lines, selection: { L1: { quote: 'A', qty: '3' }, L2: { quote: 'B', qty: '1' } }, recommended: rec, approved: true });
  assert.match(v.errors.L1, /excede la ofertada por Aceros/);
  v = validateAward({ lines, selection: { L1: { quote: 'B', qty: '2', why: 'más barato' }, L2: { quote: 'B', qty: '1' } }, recommended: rec, approved: true });
  assert.match(v.errors.L1, /distinto al recomendado \(Aceros\); mínimo 15/);
  v = validateAward({ lines, selection: { L1: { quote: 'B', qty: '2', why: 'Precio menor y plazo aceptado por el cliente' }, L2: { quote: 'B', qty: '1' } }, recommended: rec, approved: true });
  assert.equal(v.ok, true); assert.deepEqual(v.changed, ['L1', 'L2']);
  assert.deepEqual(v.orders, [{ supplier: 'Bienes', currency: 'MXN', lines: 2, amount: 880, quotes: ['COT-B'] }]);
  const awarded = [{ ...LINES[0], award: { quote_id: 'A', quantity: '2' } }, { ...LINES[1], award: { quote_id: 'B', quantity: '1' } }];
  v = validateAward({ lines: awarded, selection: { L1: { quote: 'A', qty: '2' }, L2: { quote: 'B', qty: '1' } }, recommended: rec, approved: true, hasPO: true });
  assert.equal(v.ok, true); assert.deepEqual(v.changed, []);
  v = validateAward({ lines: awarded, selection: { L1: { quote: 'B', qty: '2', why: 'Cambio solicitado por el cliente' }, L2: { quote: 'B', qty: '1' } }, recommended: rec, approved: true, hasPO: true });
  assert.match(v.errors.L1, /enmienda de la OC/);
  assert.match(validateAward({ lines: [], selection: {}, recommended: {}, approved: true }).errors.gate, /sin partidas|no tiene partidas/);
});
