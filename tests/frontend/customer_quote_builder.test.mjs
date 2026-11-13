// Cotizaciones › Cotización formal al cliente · lógica pura. node --test tests/frontend/customer_quote_builder.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCq, addDays, convert, linesFromComparison, priceLine, cqTotals, approvalLevel, validateCq, previewData, CQ_STATUSES, DEFAULT_PDF_NOTES } from '../../src/views/quotes/customerQuoteBuilder.mjs';
import { customerQuoteHtml } from '../../src/views/quotes/model.mjs';

const f0 = { ...emptyCq('2026-09-24'), buyer: 'b', requisition: 'r', preparer: 'u', currency: 'USD', usd_mxn: '17.25', eur_mxn: '18.9', sf_pct: '5' };
const cmpLines = [
  { id: 'l1', line_number: 1, description: 'Material', quantity: '3.000000', unit_label: 'pza', category: 'Materiales', line_status: 'active', award: { quote_id: 'A', supplier_name: 'Aceros', quantity: '3.000000', unit_price: '500.000000', currency: 'USD' }, offers: [] },
  { id: 'l2', line_number: 2, description: 'Flete', quantity: '1.000000', unit_label: 'viaje', line_status: 'active', award: null, offers: [{ quote_id: 'B', supplier_name: 'Equipos', offered: true, unit_price: '9000', currency: 'MXN' }, { quote_id: 'C', supplier_name: 'Otro', offered: true, unit_price: '9500', currency: 'MXN' }] },
  { id: 'l3', line_number: 3, description: 'Sin oferta', quantity: '2', unit_label: 'pza', line_status: 'active', award: null, offers: [] },
  { id: 'l4', line_number: 4, description: 'Cancelada', quantity: '1', unit_label: 'pza', line_status: 'cancelled', offers: [] },
];

test('valores por defecto del diseño: vigencia +30 días, MXN, Borrador, IVA 16, Service Fee activo', () => {
  const e = emptyCq('2026-09-24');
  assert.deepEqual([e.valid_until, e.currency, e.status, e.vat, e.sf_enabled, e.revision, e.fx_source], ['2026-10-24', 'MXN', 'Borrador', '16', true, '0', 'Manual']);
  assert.equal(CQ_STATUSES.length, 9); assert.equal(addDays('2026-12-20', 30), '2027-01-19');
});

test('conversión de moneda vía MXN', () => {
  assert.equal(convert('100', 'USD', 'MXN', f0), 1725); assert.equal(convert('1725', 'MXN', 'USD', f0), 100);
  assert.equal(Math.round(convert('100', 'EUR', 'USD', f0) * 1e6) / 1e6, 109.565217); assert.equal(convert('5', 'MXN', 'MXN', f0), 5);
  assert.equal(convert('5', 'USD', 'MXN', { ...f0, usd_mxn: '' }), null);
});

test('partidas: costo de la adjudicación, si no de la mejor oferta, si no sin costo; canceladas fuera', () => {
  const l = linesFromComparison(cmpLines);
  assert.deepEqual(l.map(x => [x.line_number, x.source, x.cost_unit, x.cost_currency, x.qty, x.supplier]), [[1, 'award', '500', 'USD', '3', 'Aceros'], [2, 'offer', '9000', 'MXN', '1', 'Equipos'], [3, 'none', '', '', '2', '']]);
});

test('precio de venta: (costo × cantidad + manipulación) × (1 + margen) ÷ cantidad, convertido', () => {
  const [a, b] = linesFromComparison(cmpLines);
  assert.deepEqual(priceLine({ ...a, handling: '150', margin: '20' }, f0), { cost: 500, unit: 660, subtotal: 1980 });
  // 9000 MXN → 521.74 USD; (521.739… + 0) × 1.1 = 573.91
  const p = priceLine({ ...b, margin: '10' }, f0); assert.equal(p.unit, 573.91); assert.equal(p.subtotal, 573.91);
  assert.equal(priceLine({ ...a, qty: '0', margin: '10' }, f0).unit, null);
});

test('totales: subtotal de terceros, descuento, IVA, Service Fee sobre la base antes de IVA y total', () => {
  const [a] = linesFromComparison(cmpLines);
  const t = cqTotals([{ ...a, handling: '150', margin: '20' }], f0);
  assert.deepEqual([t.third, t.discount, t.taxable, t.tax, t.sfBase, t.sfUnit, t.sfTax, t.sfTotal, t.subtotal, t.total], [1980, 0, 1980, 316.8, 1980, 99, 15.84, 114.84, 2079, 2411.64]);
  const d = cqTotals([{ ...a, handling: '150', margin: '20' }], { ...f0, discount: '10', sf_enabled: false });
  assert.deepEqual([d.discount, d.taxable, d.tax, d.sfTotal, d.total], [198, 1782, 285.12, 0, 2067.12]);
});

test('nivel de aprobación con la política (moneda de la política y operador)', () => {
  const [a] = linesFromComparison(cmpLines); const lines = [{ ...a, handling: '150', margin: '20' }];
  const pol = { currency: 'MXN', unit_price_limit: '15000', document_limit: '35000.02', total_basis: 'subtotal', comparison_operator: '>' };
  const t = cqTotals(lines, f0);
  const lv = approvalLevel(pol, lines, f0, t);
  assert.deepEqual([lv.status, lv.maxUnit, lv.evaluated, lv.unitOver, lv.docOver], ['exceeds', 11385, 35862.75, false, true]);
  const within = approvalLevel(pol, lines, { ...f0, sf_enabled: false }, cqTotals(lines, { ...f0, sf_enabled: false }));
  assert.deepEqual([within.status, within.level, within.evaluated], ['within', 1, 34155]);
  assert.equal(approvalLevel(null, lines, f0, t).status, 'no_policy');
  assert.equal(approvalLevel(pol, lines, { ...f0, usd_mxn: '' }, t).status, 'no_rate');
  assert.equal(approvalLevel({ ...pol, document_limit: '35862.75', comparison_operator: '>=' }, lines, f0, t).docOver, true);
});

test('validación: obligatorios, fechas, tipos de cambio y partidas con costo y margen', () => {
  const lines = linesFromComparison(cmpLines).slice(0, 2).map(l => ({ ...l, margin: '10' }));
  assert.equal(validateCq(f0, lines).ok, true);
  const e = validateCq(emptyCq('2026-09-24'), []).errors; assert.ok(e.buyer && e.requisition && e.preparer);
  assert.match(validateCq({ ...f0, valid_until: '2026-09-01' }, lines).errors.valid_until, /anterior/);
  assert.ok(validateCq({ ...f0, usd_mxn: '0' }, lines).errors.usd_mxn); assert.ok(validateCq({ ...f0, revision: '-1' }, lines).errors.revision);
  assert.match(validateCq(f0, linesFromComparison(cmpLines).map(l => ({ ...l, margin: '10' }))).first, /Partida 3: sin costo/);
  assert.match(validateCq(f0, [{ ...lines[0], margin: '' }]).first, /% de margen/);
  assert.ok(validateCq({ ...f0, discount: '101' }, lines).errors.discount); assert.ok(validateCq({ ...f0, sf_pct: 'x' }, lines).errors.sf_pct);
  assert.equal(validateCq({ ...f0, sf_enabled: false, sf_pct: 'x' }, lines).ok, true);
});

test('vista previa para el cliente: sin costos, manipulación ni margen y con comentarios predeterminados', () => {
  const [a] = linesFromComparison(cmpLines); const lines = [{ ...a, handling: '150', margin: '20', brand_model: 'ACME X' }];
  const t = cqTotals(lines, f0);
  const d = previewData({ form: { ...f0, revision: '2' }, lines, totals: t, req: { folio: 'REQ-1', client_name: 'Cliente <b>', client_tax_id: 'XAXX010101000' }, preparerName: 'QA Comprador' });
  assert.equal(d.item.version_number, 3); assert.equal(d.item.total_amount, 2411.64); assert.equal(d.item.notes, DEFAULT_PDF_NOTES[0]);
  assert.deepEqual(Object.keys(d.items[0]).sort(), ['brand_model', 'description', 'line_number', 'line_subtotal', 'quantity', 'unit_label', 'unit_price']);
  const html = customerQuoteHtml(d, false, { preview: true });
  assert.ok(html.includes('Rev. 2') && html.includes('$660.00 USD') && html.includes('$2,411.64 USD') && html.includes('VISTA PREVIA · NO REGISTRADA') && html.includes('Cliente &lt;b&gt;') && html.includes('ACME X'));
  assert.ok(!/500\.00|150\.00|margen de ganancia|cost/i.test(html.replace('costos internos', '')), 'no internal cost/handling/margin in the client document');
});
