// Órdenes de Compra · PDF de la OC (jsPDF en Node): contenido, idioma, saltos de página y nombre de archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { buildPoPdf, pdfName } from '../../src/views/purchaseOrders/poPdf.mjs';

// Detalle sintético con la forma de GET /api/v1/purchase-orders/{id}.
const D = {
  item: { folio: 'OC-QA-0777', version_number: 2, legacy_revision_number: null, order_date: '2026-10-20', commitment_date: '2026-11-05', currency: 'USD', subtotal_amount: '3900', tax_amount: '624', total_amount: '4524',
    supplier_name: 'Proveedor Sintético Ñandú', supplier_code: 'PRV-QA', supplier_tax_id: 'XAXX010101000', requisitions: 'REQ-QA-1', clients: 'Cliente QA', internal_reference: 'SCI-QA',
    delivery_place: 'Almacén QA', incoterm_code: 'DAP', payment_method_label: 'PPD', payment_form_label: '99', cfdi_use_label: 'G03', terms_text: 'Condiciones sintéticas.', buyer_name: 'QA Comprador', preparer_name: 'QA Prepara', authorizer_name: 'QA Autoriza' },
  items: [{ line_number: 1, description: 'Instrumento sintético de medición', category: 'Equipos', quantity: '3', unit_label: 'pza', unit_price: '1300', line_subtotal: '3900' }],
};
const text = doc => Buffer.from(doc.output('arraybuffer')).toString('latin1');

test('PDF en español: folio, Rev. N, proveedor, partidas, totales y firmas', () => {
  const t = text(buildPoPdf(jsPDF, D, false));
  for (const x of ['Orden de Compra OC-QA-0777', 'Rev. 1', 'Proveedor Sint', 'Instrumento sint', '$3,900.00 USD', '$4,524.00 USD', 'QA Autoriza', 'Autoriz', 'CONDICIONES']) assert.ok(t.includes(x), x);
  assert.ok(!t.includes('Purchase Order OC-QA-0777'));
});

test('PDF en inglés: etiquetas traducidas', () => {
  const t = text(buildPoPdf(jsPDF, D, true));
  for (const x of ['Purchase Order OC-QA-0777', 'SUPPLIER', 'UNIT PRICE', 'Authorized', 'TERMS']) assert.ok(t.includes(x), x);
  assert.ok(!t.includes('Orden de Compra OC-QA-0777'));
});

test('muchas partidas generan varias páginas con encabezado repetido', () => {
  const many = { ...D, items: Array.from({ length: 60 }, (_, i) => ({ ...D.items[0], line_number: i + 1 })) };
  const doc = buildPoPdf(jsPDF, many, false);
  assert.ok(doc.getNumberOfPages() >= 2);
  assert.ok(text(doc).includes(`1/${doc.getNumberOfPages()}`));
});

test('sin partidas y nombre de archivo', () => {
  assert.ok(text(buildPoPdf(jsPDF, { item: D.item, items: [] }, false)).includes('Sin partidas registradas.'));
  assert.equal(pdfName(D.item), 'OC-QA-0777-Rev1.pdf');
  assert.equal(pdfName({ folio: 'OC-1', version_number: 1 }), 'OC-1-Rev0.pdf');
});
