// Cotizaciones › Formato de cotización para el cliente · lógica pura. node --test tests/frontend/quote_document.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { docMoney, docTotals, signatures, docModel, quoteDocHtml, docFileName, DOC_DEFAULTS } from '../../src/views/quotes/quoteDocument.mjs';

const detail = {
  issuer: { legal_name: 'GRUPO GEREZ - TRAMITE ADUANALES', tax_identifier: null, phone: '8332140041', email: 'supplies@grupogerez.com', postal_address: '3ra avenida #1007 Col. Anahuac, Tampico Tamps.' },
  item: { folio: 'COT-2026-0024', revision: 0, version_number: 1, quote_date: '2026-09-01', valid_until: '2026-09-16', currency: 'USD', client_name: 'SBM <OFFSHORE>', client_contact: 'Ing. Roberto Hernández', client_email: 'nombre@sbm.invalid', client_phone: '37792050677',
    project: 'TRION', contract: null, client_reference: 'WO - GG - 004', subtotal_amount: '837.60', discount_amount: null, tax_rate_pct: '16', tax_amount: '134.016', total_amount: '971.616', service_fee_enabled: false,
    delivery_place: 'PISSA', lead_time_text: null, payment_terms: null, warranty_text: '', inclusions_text: null, exclusions_text: null, notes: null,
    prepared_by: 'Carlos Navarrete', prepared_by_position: 'Comprador senior', reviewed_by: 'Aime Vega', reviewed_by_position: 'Coordinador de compras', approved_by: null, internal_approval_status: 'pending' },
  items: [{ line_number: 1, description: 'Digital Thermometer', brand_model: null, quantity: '1.000000', unit_label: 'pza', unit_price: '478.80', line_subtotal: '478.80' }, { line_number: 2, description: 'Outdoor Thermometer', brand_model: 'X-2', quantity: '1', unit_label: 'pza', unit_price: '358.80', line_subtotal: '358.80' }],
};

test('montos con moneda al frente y dos decimales', () => {
  assert.equal(docMoney('971.616', 'USD'), 'USD 971.62'); assert.equal(docMoney(1950, 'MXN'), 'MXN 1,950.00'); assert.equal(docMoney(null, 'USD'), 'USD 0.00');
});

test('totales sin desglose explícito: subtotal = third party; IVA y total del registro', () => {
  const t = docTotals(detail.item);
  assert.deepEqual([t.tpGross, t.tpTaxable, t.tpTax, t.tpTotal, t.genSub, t.genTax, t.total, t.vatRate, t.sfOn], [837.6, 837.6, 134.02, 971.62, 837.6, 134.02, 971.616, 16, false]);
});

test('totales con descuento y Service Fee explícitos', () => {
  const t = docTotals({ subtotal_amount: 2000, discount_amount: 200, tax_rate_pct: 16, third_party_taxable_amount: 1800, third_party_tax_amount: 288, third_party_total_amount: 2088,
    service_fee_enabled: true, service_fee_rate_pct: 5, service_fee_subtotal_amount: 90, service_fee_tax_amount: 14.4, total_amount: 2192.4 });
  assert.deepEqual([t.tpGross, t.discount, t.tpTax, t.sfOn, t.sfSub, t.sfTax, t.sfTotal, t.genSub, t.genTax, t.total], [2000, 200, 288, true, 90, 14.4, 104.4, 1890, 302.4, 2192.4]);
});

test('firmas electrónicas: comprador firma con elaborador; revisión/autorización solo si consta la aprobación', () => {
  assert.deepEqual(signatures(detail.item).map(s => [s.role, s.name, s.signed]), [['Comprador', 'Carlos Navarrete', true], ['Revisó', 'Aime Vega', false], ['Autorizó', '', false]]);
  assert.deepEqual(signatures({ ...detail.item, approved_by: 'Gerente', internal_approval_status: 'approved' }).map(s => s.signed), [true, true, true]);
  assert.equal(signatures({}, true)[0].role, 'Buyer');
});

test('modelo: emisor desde organizations, cliente, condiciones con textos predeterminados', () => {
  const m = docModel(detail);
  assert.equal(m.issuer.name, 'GRUPO GEREZ - TRAMITE ADUANALES'); assert.equal(m.client.reference, 'WO - GG - 004'); assert.equal(m.revision, 0);
  assert.deepEqual(m.conditions.delivery, ['PISSA', DOC_DEFAULTS.delivery[0]]);
  assert.equal(m.conditions.warranty, 'No indicada'); assert.equal(m.conditions.inclusions, 'Conforme a las partidas descritas.'); assert.equal(m.conditions.notes, DOC_DEFAULTS.notes[0]);
  assert.equal(docModel({ item: {} }).issuer.name, 'GRUPO GEREZ'); assert.equal(docModel({ item: { version_number: 3 } }).revision, 2);
  assert.equal(docFileName(m), 'COT-2026-0024_Rev0.pdf'); assert.equal(docFileName({ folio: 'A/B C', revision: 2 }), 'A_B_C_Rev2.pdf');
});

test('HTML del documento: diseño, datos escapados, sin costos internos', () => {
  const { html, css, body } = quoteDocHtml(docModel(detail));
  for (const x of ['COTIZACIÓN', 'Commercial Quotation', 'COT-2026-0024', 'Revisión: 0', 'GRUPO GEREZ - TRAMITE ADUANALES', 'supplies@grupogerez.com', 'Ing. Roberto Hernández', 'Proyecto: TRION · Contrato: N/A', 'WO - GG - 004',
    'T H I R D', 'USD 478.80', 'USD 837.60', 'IVA Third Party 16.00%', 'Total general', 'USD 971.62', 'Firmado electrónicamente', 'Pendiente', 'Esta cotización no constituye una factura']) assert.ok(html.includes(x), x);
  assert.ok(html.includes('SBM &lt;OFFSHORE&gt;') && !html.includes('SBM <OFFSHORE>'));
  assert.ok(!/costo|margen|margin|cost_amount/i.test(body.replace('costos de proveedor', '')));
  assert.ok(css.startsWith('.gq{') && !html.includes('VISTA PREVIA'));
  assert.ok(quoteDocHtml(docModel(detail), false, { preview: true }).html.includes('VISTA PREVIA · NO REGISTRADA'));
  assert.ok(quoteDocHtml(docModel(detail, true), true).html.includes('QUOTATION') && quoteDocHtml(docModel(detail, true), true).html.includes('Grand total'));
  const sf = quoteDocHtml(docModel({ ...detail, item: { ...detail.item, service_fee_enabled: true, service_fee_rate_pct: 5, service_fee_subtotal_amount: 41.88, service_fee_tax_amount: 6.7 } })).html;
  assert.ok(sf.includes('Subtotal Service Fee 5.00%') && sf.includes('USD 41.88'));
});
