// Órdenes de Compra · tarjeta 6 "Formato de Orden de Compra": documento HTML y firmas (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNATURE_SLOTS, poOptionLabel, registeredSignature, signatureStatus, signatureFileError, safeSignature, saveSignaturesResult, poFormatHtml, SIGNATURE_MAX } from '../../src/views/purchaseOrders/poFormat.mjs';
import { PO_FORMAT } from '../../src/views/purchaseOrders/poPdf.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
// Detalle sintético con la forma de GET /api/v1/purchase-orders/{id}.
const D = {
  item: { folio: 'OC-<5>', version_number: 1, order_date: '2026-08-05', currency: 'MXN', subtotal_amount: '10470', tax_amount: '1675.2', total_amount: '12145.2', tax_rate_pct: '16.000000',
    supplier_name: 'Grainger & Co', supplier_contact: null, requisitions: '19900001080', order_reference: '19900001080', internal_reference: 'TRS-0105', delivery_place: 'ESEASA',
    payment_method_label: 'PUE - Pago en una sola exhibición', payment_form_label: '03 - Transferencia', cfdi_use_label: 'G03 - Gastos en general', notes: null,
    buyer_name: 'Karla Barbosa', buyer_email: 'karla@qa.invalid', buyer_position: 'Administrative assistant', preparer_name: 'Katia Cespedez', preparer_position: null, authorizer_name: 'Monica Macias', authorizer_position: 'Administrative manager' },
  items: [{ line_number: 1, description: 'WRENCHES <b>10"</b>', quantity: '6', unit_label: 'Each', unit_price: '1745', line_subtotal: '10470' }],
  signatures: [{ role: 'authorizer', method: 'Firma autógrafa digitalizada', signed_at: '2026-08-06 10:00:00', signer: 'Monica', has_image: true }],
};

test('documento con el formato del diseño, valores escapados y totales', () => {
  const { html } = poFormatHtml(D, false);
  for (const x of ['ORDEN DE COMPRA', PO_FORMAT.code, `Fecha: ${PO_FORMAT.issued}`, PO_FORMAT.city, 'COMPRADOR:', 'karla@qa.invalid', 'Grainger &amp; Co', 'NÚMERO DE OC:', 'OC-&lt;5&gt;', 'REF. INTERNA:', 'TRS-0105',
    '1. WRENCHES &lt;b&gt;10&quot;&lt;/b&gt;', '6 Each', '$1,745.00', '$10,470.00', 'INFORMACIÓN ADICIONAL', 'PUE - Pago en una sola exhibición / 03 - Transferencia', PO_FORMAT.invoiceTo, PO_FORMAT.billTo,
    'IVA 16% $', '1,675.20', '12,145.20 MXN', 'COMPRÓ:', 'PREPARÓ:', 'AUTORIZÓ:', 'ADMINISTRATIVE MANAGER', '[ Firma ]', PO_FORMAT.address]) assert.ok(html.includes(x), x);
  assert.ok(!html.includes('<b>10'), 'sin HTML inyectado');
  assert.ok(!html.includes('<script'), 'sin scripts');
  assert.ok(!html.includes('no registradas en SupplyFlow'), 'sin firmas capturadas no hay nota');
});

test('firmas capturadas se insertan como imagen PNG y el documento lo indica; URL no segura se ignora', () => {
  const { html } = poFormatHtml(D, false, { signatures: { buyer: PNG, preparer: 'data:image/svg+xml;base64,PHN2Zz4=', authorizer: 'javascript:alert(1)' } });
  assert.equal(html.split('<img alt="Firma"').length - 1, 1, 'solo la firma PNG');
  assert.ok(html.includes(PNG)); assert.ok(!html.includes('svg+xml') && !html.includes('javascript:'));
  assert.ok(html.includes('Firmas manuscritas capturadas en este equipo; no registradas en SupplyFlow.'));
  assert.equal(safeSignature(PNG), PNG); assert.equal(safeSignature('data:image/png;base64,AA"><script>'), '');
});

test('inglés y sin partidas', () => {
  const { html } = poFormatHtml({ item: D.item, items: [] }, true);
  assert.ok(html.includes('PURCHASE ORDER') && html.includes('No line items recorded.') && html.includes('[ Signature ]') && html.includes('VAT 16% $'));
});

test('espacios de firma, estado y firma registrada en SupplyFlow', () => {
  assert.deepEqual(SIGNATURE_SLOTS.map(s => s[1]), ['Compró / Comprador', 'Preparó', 'Autorizó']);
  assert.equal(registeredSignature(D, 'authorizer').signer, 'Monica'); assert.equal(registeredSignature(D, 'buyer'), null);
  assert.equal(signatureStatus(true, null).text, 'Firma capturada (sin guardar)');
  assert.equal(signatureStatus(false, registeredSignature(D, 'authorizer')).text, 'Firma registrada en SupplyFlow · 2026-08-06');
  assert.equal(signatureStatus(false, null).text, 'Sin firma');
});

test('imagen de firma: PNG/JPG, no vacía, máximo 2 MB', () => {
  assert.equal(signatureFileError({ type: 'image/png', size: 100 }), '');
  assert.equal(signatureFileError({ type: 'image/jpeg', size: 100 }), '');
  assert.match(signatureFileError({ type: 'image/svg+xml', size: 100 }), /PNG o JPG/);
  assert.match(signatureFileError({ type: 'image/png', size: 0 }), /vacía/);
  assert.match(signatureFileError({ type: 'image/png', size: SIGNATURE_MAX + 1 }), /2 MB/);
});

test('guardar firmas: exige al menos una y nunca escribe', () => {
  assert.match(saveSignaturesResult(D.item, {}).text, /al menos una firma/);
  const r = saveSignaturesResult(D.item, { buyer: PNG, authorizer: PNG });
  assert.equal(r.ok, true); assert.equal(r.kind, 'locked');
  assert.match(r.text, /Firmas validadas \(Compró \/ Comprador, Autorizó\), pero no se guardaron en OC-<5>/);
  assert.match(saveSignaturesResult(null, { buyer: PNG }).text, /Selecciona una orden/);
});

test('etiqueta del selector', () => {
  assert.equal(poOptionLabel({ folio: 'OC-2026-0005', version_number: 1, supplier_name: 'Grainger Inc.', total_amount: '12145.2' }), 'OC-2026-0005 · GRAINGER INC. · $12,145.20');
  assert.equal(poOptionLabel({ folio: 'OC-1', version_number: 2, supplier_name: 'X', total_amount: '1' }), 'OC-1 Rev. 1 · X · $1.00');
});
