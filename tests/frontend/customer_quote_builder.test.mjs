// Cotizaciones › Cotización formal al cliente · lógica pura. node --test tests/frontend/customer_quote_builder.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCq, addDays, convert, linesFromComparison, priceLine, cqTotals, approvalLevel, validateCq, previewData, CQ_STATUSES, DEFAULT_PDF_NOTES, CQ_SAVE_STATUS, cqPayload, cqFromDraft, cqExistingBlock, cqSavedText, cqSaveError, cqReqOption, cqReqSummary, bestOffer } from '../../src/views/quotes/customerQuoteBuilder.mjs';
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

// ---- Borrador interno (POST/PUT /api/v1/quotes/customer-quotes) ----
test('payload del borrador: sin precios ni totales (el servidor los recalcula), tipo de cambio solo si se usa', () => {
  const l = linesFromComparison(cmpLines).map(x => ({ ...x, margin: '20', handling: ' 150 ', brand_model: ' ACME X ' }));
  const p = cqPayload({ ...f0, lead_time: ' 5 días ' }, l);
  assert.equal(p.requisition_id, 'r'); assert.equal(p.preparer_id, 'u'); assert.equal(p.lead_time, '5 días');
  assert.equal(p.usd_mxn, '17.25'); assert.equal(p.eur_mxn, null, 'EUR no se usa: no se envía');
  assert.deepEqual(p.lines[0], { line_id: 'l1', source: 'award', quote_id: 'A', qty: '3', handling: '150', margin: '20', brand_model: 'ACME X' });
  assert.ok(!JSON.stringify(p).match(/unit_price|subtotal|total|status/), 'ni precios, ni totales, ni estatus');
  const mxn = cqPayload({ ...f0, currency: 'MXN' }, l.slice(1, 2));
  assert.deepEqual([mxn.usd_mxn, mxn.eur_mxn], [null, null]);
  const noSf = cqPayload({ ...f0, sf_enabled: false, sf_pct: '5', sf_comments: 'x' }, l);
  assert.deepEqual([noSf.sf_enabled, noSf.sf_pct, noSf.sf_comments], [false, '0', '']);
  assert.equal('requisition_id' in cqPayload(f0, l, true), false, 'la edición no cambia la requisición');
  assert.equal(CQ_SAVE_STATUS, 'Borrador');
});

test('abrir el borrador registrado: formulario y partidas sobre el comparativo vigente', () => {
  const draft = { item: { id: 'q1', version: 3, folio: 'COT-2026-0007', revision: 0, requisition_id: 'r', quote_date: '2026-11-20', valid_until: '2026-12-20', currency: 'USD', exchange_rate_date: '2026-11-19',
    usd_mxn_rate: '18.500000', eur_mxn_rate: null, exchange_rate_source: 'Banxico', preparer_id: 'u2', delivery_place: 'Planta', lead_time_text: '5 días', payment_terms: '30 días', warranty_text: '1 año',
    inclusions_text: 'Flete', exclusions_text: '', notes: 'n', discount_rate_pct: '2.5000', tax_rate_pct: '16.0000', service_fee_enabled: true, service_fee_rate_pct: '5.0000', service_fee_comments: 'sf' },
    items: [{ line_id: 'l1', brand_model: 'ACME', quantity: '2.000000', handling: '10.00', margin: '15.0000' }] };
  const { form, lines } = cqFromDraft(draft, linesFromComparison(cmpLines), { ...f0, usd_mxn: '17' });
  assert.deepEqual([form.revision, form.issue_date, form.currency, form.preparer, form.usd_mxn, form.eur_mxn, form.discount, form.vat, form.sf_pct, form.status, form.fx_source],
    ['0', '2026-11-20', 'USD', 'u2', '18.5', '18.9', '2.5', '16', '5', 'Borrador', 'Banxico']);
  assert.deepEqual([lines[0].qty, lines[0].handling, lines[0].margin, lines[0].brand_model, lines[0].source], ['2', '10', '15', 'ACME', 'award']);
  assert.deepEqual([lines[1].qty, lines[1].margin], ['1', ''], 'partida sin dato en el borrador: queda como en el comparativo');
});

test('cotización existente: importada/enviada bloquea; borrador de SupplyFlow se edita', () => {
  assert.equal(cqExistingBlock(null), ''); assert.equal(cqExistingBlock({ editable_draft: true, folio: 'COT-1', revision: 0 }), '');
  const b = cqExistingBlock({ editable_draft: false, folio: 'COT-2025-0001', revision: 1, legacy_status: 'Enviada' });
  assert.match(b, /COT-2025-0001 \(Rev\. 1 · Enviada\)/); assert.match(b, /nueva revisión se origina con «Solicitar modificación»/);
  assert.match(cqExistingBlock({ folio: 'X', revision: 0 }, true), /Request modification/);
  // Importada (aunque siga en «Borrador»): expediente en consulta; R3A no aplica; se recaptura la requisición.
  const i = cqExistingBlock({ editable_draft: false, imported: true, folio: 'COT-2025-0002', revision: 0, legacy_status: 'Borrador' });
  assert.match(i, /COT-2025-0002 \(Rev\. 0 · Borrador\), importada del sistema original: se conserva como expediente en consulta/);
  assert.match(i, /solo aplica a requisiciones capturadas en SupplyFlow/); assert.match(i, /Registro de requisición/);
  assert.doesNotMatch(i, /nueva revisión se origina/);
});

test('mensajes de resultado y errores del servidor', () => {
  assert.match(cqSavedText({ folio: 'COT-2026-0009', revision: 0, version: 1, lines: 2, total: 1234.5, currency: 'MXN' }), /COT-2026-0009 \(Rev\. 0\) guardada en MariaDB como borrador interno: 2 partida\(s\), total \$1,234\.50 MXN/);
  assert.match(cqSavedText({ folio: 'COT-2026-0009', revision: 0, version: 2, total: 10, currency: 'USD' }), /actualizado en MariaDB: total \$10\.00 USD; versión 2/);
  assert.deepEqual(cqSaveError(0, {}).retry, true);
  assert.equal(cqSaveError(500, { error: { message: 'x' } }).retry, true);
  assert.equal(cqSaveError(401, {}).retry, undefined);
  assert.match(cqSaveError(403, {}).text, /Master Admin/);
  assert.equal(cqSaveError(503, { error: { code: 'QUOTE_WRITE_NOT_PROVISIONED', message: 'No habilitado.' } }).kind, 'warn');
  assert.equal(cqSaveError(412, {}).kind, 'warn');
  assert.deepEqual(cqSaveError(422, { error: { code: 'INVALID_CUSTOMER_QUOTE', field: 'preparer_id' } }).field, 'preparer');
  assert.equal(cqSaveError(422, { error: { code: 'INVALID_CUSTOMER_QUOTE', field: 'line:abc' } }).field, 'line:abc');
  assert.equal(cqSaveError(409, { error: { code: 'COST_SOURCE_CHANGED', message: 'Cambió el costo.', field: 'line:l2' } }).field, 'line:l2');
  assert.equal(cqSaveError(409, { error: { code: 'DRAFT_EXISTS', message: 'Ya existe.' } }).text, 'Ya existe.');
});

test('selector de requisiciones: anticipa si se puede guardar', () => {
  const r = (x = {}) => ({ id: 'r', folio: 'REQ-1', client_name: 'ACME', unquoted_items: 0, customer_quote: null, ...x });
  assert.deepEqual(cqReqOption(r()), { label: 'REQ-1 - ACME', kind: 'new' });
  assert.deepEqual(cqReqOption(r({ customer_quote: { folio: 'COT-2025-0007', imported: true, editable_draft: false, status: 'Borrador' } })),
    { label: 'REQ-1 - ACME · ya tiene COT-2025-0007 (importada, solo consulta)', kind: 'locked' });
  assert.equal(cqReqOption(r({ customer_quote: { folio: 'COT-2026-0009', imported: false, editable_draft: false, status: 'Enviada al cliente' } })).label, 'REQ-1 - ACME · ya tiene COT-2026-0009 (Enviada al cliente, solo consulta)');
  assert.equal(cqReqOption(r({ customer_quote: { folio: 'CQ-1', imported: false, editable_draft: false, status: 'issued' } })).label, 'REQ-1 - ACME · ya tiene CQ-1 (Emitida, solo consulta)', 'código → etiqueta en español');
  assert.deepEqual(cqReqOption(r({ customer_quote: { folio: 'COT-2026-0010', imported: false, editable_draft: true } })), { label: 'REQ-1 - ACME · borrador COT-2026-0010 (editar)', kind: 'draft' });
  assert.deepEqual(cqReqOption(r({ unquoted_items: 8 })), { label: 'REQ-1 - ACME · 8 partida(s) sin costo', kind: 'uncosted' });
  const items = [r(), r({ customer_quote: { folio: 'A', imported: true } }), r({ customer_quote: { folio: 'B', imported: true } }), r({ unquoted_items: 2 }), r({ customer_quote: { folio: 'C', editable_draft: true } })];
  assert.equal(cqReqSummary(items, 5), '5 requisición(es) con cotizaciones de proveedor: 2 se pueden guardar; 1 con borrador para editar; 1 con partidas sin costo (registra la cotización del proveedor en la tarjeta 4); 2 ya tienen cotización al cliente (se abren solo para consulta).');
});

test('mejor oferta con monedas distintas: se compara en MXN con el tipo de cambio de la tarjeta', () => {
  const A = { quote_id: 'A', offered: true, unit_price: '1200', currency: 'MXN', supplier_name: 'Aceros' };
  const B = { quote_id: 'B', offered: true, unit_price: '70', currency: 'USD', supplier_name: 'Bombas' };
  assert.equal(bestOffer([A, B], { usd_mxn: '18' }).quote_id, 'A', '70 USD = 1,260 MXN > 1,200 MXN');
  assert.equal(bestOffer([A, B], { usd_mxn: '17' }).quote_id, 'B', '70 USD = 1,190 MXN < 1,200 MXN');
  assert.equal(bestOffer([A, B], { usd_mxn: '' }).quote_id, 'A', 'sin tipo de cambio USD la oferta en USD no se puede comparar');
  assert.equal(bestOffer([B, { ...B, quote_id: 'C', unit_price: '65' }]).quote_id, 'C', 'misma moneda: precio directo, sin tipo de cambio');
  assert.equal(bestOffer([]), undefined);
  const cmp = [{ id: 'x', line_number: 1, description: 'Bomba', quantity: '2', unit_label: 'pza', line_status: 'active', award: null, offers: [A, B] }];
  assert.deepEqual(linesFromComparison(cmp, { usd_mxn: '18' }).map(l => [l.quote_id, l.cost_unit, l.cost_currency]), [['A', '1200', 'MXN']]);
  assert.deepEqual(linesFromComparison(cmp, { usd_mxn: '17' }).map(l => [l.quote_id, l.cost_unit, l.cost_currency]), [['B', '70', 'USD']]);
});
