// Cotizaciones › Registro de cotización · lógica pura. node --test tests/frontend/supplier_quote.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyQuote, linesFromRfq, lineAmounts, quoteTotals, qtyNote, validateQuote, isPdfHeader, normQty, PDF_MAX_BYTES, quotePayload, quoteFromDetail, editBlockText, rowEditBlock, quoteSavedText, quoteSaveError, changeLabels } from '../../src/views/quotes/supplierQuote.mjs';
import { quoteNotice } from '../../src/views/quotes/quoteWriteStatus.mjs';

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

test('guardado: cuerpo sin importes (los calcula el servidor); partidas no ofertadas en cero; edición sin RFQ', () => {
  const l = linesFromRfq(items); l[0].price = ' 10.5 '; l[1].offered = false; l[1].price = '99';
  const f = ready({ supplier_reference: ' REF-1 ', notes: ' nota ', payment: 'PPD', valid_until: '' });
  const p = quotePayload(f, l, { name: 'a.pdf', data: 'JVBERi0=' });
  assert.deepEqual(p, { rfq_id: 'f', supplier_reference: 'REF-1', quote_date: '2026-11-10', valid_until: '', vat: '16', currency: 'MXN', lead_days: '7', payment: 'PPD', technical: '100', documentation: '100', notes: 'nota',
    lines: [{ line_number: 1, offered: true, qty: '2', price: '10.5' }, { line_number: 2, offered: false, qty: '0', price: '0' }], document: { name: 'a.pdf', data: 'JVBERi0=' } });
  assert.ok(!('total' in p) && !('subtotal' in p));
  const e = quotePayload(f, l, null, true); assert.ok(!('rfq_id' in e)); assert.equal(e.document, null);
  assert.equal(PDF_MAX_BYTES, 8 * 1024 * 1024);
});

test('edición: formulario y partidas desde la cotización registrada; comprador/requisición/RFQ no se exigen', () => {
  const det = { item: { requisition_id: 'r1', rfq_id: 'f1', supplier_reference: null, quote_date: '2026-11-10', valid_until: null, tax_rate_pct: '16.000000', currency: 'USD', lead_days: '7.0000',
    payment_terms: 'PUE', technical_score: '95.0000', document_score: '90.5000', notes: null },
  items: [{ line_number: 1, description: 'A', category: null, unit_label: 'pza', requested_quantity: '2.000000', offered: true, quantity: '2.000000', unit_price: '10.500000' },
    { line_number: 2, description: 'B', category: 'C', unit_label: 'm', requested_quantity: '3.000000', offered: false, quantity: '0.000000', unit_price: '0.000000' }] };
  const { form, lines } = quoteFromDetail(det);
  assert.deepEqual([form.requisition, form.rfq, form.vat, form.currency, form.lead_days, form.payment, form.technical, form.documentation, form.valid_until, form.notes], ['r1', 'f1', '16', 'USD', '7', 'PUE', '95', '90.5', '', '']);
  assert.deepEqual(lines.map(x => [x.line_number, x.offered, x.qty, x.price, x.requested]), [[1, true, '2', '10.5', '2'], [2, false, '3', '', '3']]);
  assert.equal(validateQuote(form, lines, false, { edit: true }).ok, true);
  assert.ok(validateQuote(form, lines).errors.buyer);
});

test('edición: solo las registradas en SupplyFlow con RFQ, sin adjudicar y «Recibida»', () => {
  const ok = { imported: false, source_kind: 'explicit', rfq_folio: 'RFQ-1', awarded: false, awarded_lines: 0, status: 'recibida' };
  assert.equal(rowEditBlock(ok), null);
  assert.equal(rowEditBlock({ ...ok, imported: true }), 'imported'); assert.equal(rowEditBlock({ ...ok, source_kind: 'legacy_explicit' }), 'imported');
  assert.equal(rowEditBlock({ ...ok, rfq_folio: null }), 'imported'); assert.equal(rowEditBlock({ ...ok, awarded_lines: 1 }), 'awarded');
  assert.equal(rowEditBlock({ ...ok, status: 'adjudicada_total' }), 'status');
  assert.match(editBlockText('imported', 'COT-1'), /COT-1 es una cotización importada.*se conserva como expediente/);
  assert.match(editBlockText('awarded', 'COT-1'), /adjudicación vigente/); assert.equal(editBlockText(null), '');
});

test('mensajes: guardado confirmado, cambios y errores del servidor', () => {
  assert.match(quoteSavedText({ folio: 'COT-2026-0001', supplier_name: 'Prov', rfq: 'RFQ-1', requisition: 'REQ-1', total: 1234.5, currency: 'MXN', document: { name: 'a.pdf' } }), /COT-2026-0001 de Prov registrada en MariaDB contra RFQ-1 \(REQ-1\): total \$1,234.50 MXN con el PDF «a.pdf»/);
  assert.match(quoteSavedText({ folio: 'COT-1', changed: ['lead_days', 'subtotal', 'total', 'lines'], version: 2, total: 10, currency: 'USD', document: null }), /\(días de entrega, importes, partidas\); versión 2/);
  assert.equal(quoteSavedText({ folio: 'COT-1', changed: [] }), 'No había cambios por guardar.');
  assert.deepEqual(changeLabels(['tax', 'total', 'document'], true), ['amounts', 'PDF']);
  const l = linesFromRfq(items);
  assert.equal(quoteSaveError(0, {}, l).retry, true);
  assert.equal(quoteSaveError(503, { error: { code: 'QUOTE_WRITE_UNAVAILABLE', message: 'x' } }, l).retry, true);
  const nf = quoteSaveError(503, { error: { code: 'QUOTE_WRITE_NOT_PROVISIONED', message: 'No habilitado.' } }, l);
  assert.equal(nf.kind, 'warn'); assert.ok(!nf.retry); assert.match(nf.text, /REGISTRO_COTIZACION_PROVEEDOR/);
  assert.equal(quoteSaveError(422, { error: { code: 'INVALID_QUOTE', field: 'line:2' } }, l).field, `line:${l[1].key}`);
  assert.equal(quoteSaveError(422, { error: { code: 'INVALID_QUOTE', field: 'rfq_id' } }, l).field, 'rfq');
  assert.equal(quoteSaveError(422, { error: { code: 'CURRENCY_UNAVAILABLE', field: 'currency', message: 'Moneda inactiva.' } }, l).text, 'Moneda inactiva.');
  assert.equal(quoteSaveError(413, {}, l).field, 'document');
  assert.match(quoteSaveError(409, { error: { code: 'RFQ_ALREADY_QUOTED', message: 'La RFQ ya tiene la cotización COT-1' } }, l).text, /COT-1/);
  assert.match(quoteSaveError(412, {}, l).text, /Otra persona/); assert.match(quoteSaveError(403, { error: { code: 'FORBIDDEN' } }, l).text, /Master Admin/);
});

test('aviso de guardado no habilitado (write-status)', () => {
  assert.equal(quoteNotice(null), null); assert.equal(quoteNotice({ enabled: true, code: 'OK' }), null);
  assert.match(quoteNotice({ enabled: false, code: 'QUOTE_WRITE_NOT_PROVISIONED' }).text, /compose.supply-quotewrite.yml/);
  assert.match(quoteNotice({ enabled: false, code: 'QUOTE_WRITE_GRANTS_INCOMPLETE', expected_grants: 43, missing_grants: ['INSERT files'] }).text, /Faltan 1 de 43 permisos \(INSERT files\)/);
  assert.match(quoteNotice({ enabled: false, code: 'QUOTE_WRITE_ACCOUNT_REJECTED' }).title, /rechazó/);
});
