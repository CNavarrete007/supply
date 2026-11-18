// Órdenes de Compra · PDF de la OC en el formato Grupo Gerez (jsPDF en Node): contenido, idioma, saltos de página,
// datos registrados con prioridad sobre los fijos del formato y nombre de archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { buildPoPdf, pdfName, PO_FORMAT } from '../../src/views/purchaseOrders/poPdf.mjs';

// Detalle sintético con la forma de GET /api/v1/purchase-orders/{id}.
const D = {
  item: { folio: 'OC-QA-0777', version_number: 2, legacy_revision_number: null, order_date: '2026-10-20', commitment_date: '2026-11-05', currency: 'USD', subtotal_amount: '3900', tax_amount: '624', total_amount: '4524', tax_rate_pct: '16.000000',
    supplier_name: 'Proveedor Sintético Ñandú', supplier_code: 'PRV-QA', supplier_tax_id: 'XAXX010101000', supplier_contact: 'Laura Ficticia', supplier_contact_email: 'ventas@proveedor.invalid',
    requisitions: 'REQ-QA-1', clients: 'Cliente QA', order_reference: 'ORD-QA-55', internal_reference: 'SCI-QA', delivery_place: 'Almacén QA', incoterm_code: 'DAP',
    payment_method_label: 'PUE', payment_form_label: '03 · Transferencia', cfdi_use_label: 'G03', notes: 'Nota sintética', terms_text: 'Condiciones sintéticas.',
    buyer_name: 'QA Comprador', buyer_email: 'qa.buyer@supplyflow.invalid', buyer_position: 'Asistente administrativa', preparer_name: 'QA Prepara', preparer_position: null,
    authorizer_name: 'QA Autoriza', authorizer_position: 'Gerente administrativo', bill_to: null, invoice_to: null },
  items: [{ line_number: 1, description: 'Instrumento sintético de medición', category: 'Equipos', quantity: '3', unit_label: 'pza', unit_price: '1300', line_subtotal: '3900' }],
};
const text = doc => Buffer.from(doc.output('arraybuffer')).toString('latin1');

test('PDF en español con el formato del diseño: encabezado, comprador/proveedor, partidas, información adicional, total y firmas', () => {
  const t = text(buildPoPdf(jsPDF, D, false));
  for (const x of ['ORDEN DE COMPRA', 'GRUPO GEREZ', PO_FORMAT.site, PO_FORMAT.code, `Fecha: ${PO_FORMAT.issued}`, `Revisión: ${PO_FORMAT.revision}`, PO_FORMAT.city,
    'COMPRADOR:', 'QA Comprador', 'qa.buyer@supplyflow.invalid', 'PROVEEDOR:', 'Proveedor Sintético Ñandú', 'Laura Ficticia · ventas@proveedor.invalid',
    'FECHA DE OC:', '2026-10-20', 'NÚMERO DE OC:', 'OC-QA-0777 · Rev. 1', 'REFERENCIA:', 'ORD-QA-55', 'REF. INTERNA:', 'SCI-QA',
    'PARTIDA', 'REQUISICIÓN /', 'SOLICITUD', 'DESCRIPCIÓN', '1. Instrumento sintético de medición', '3 pza', '$1,300.00', '$3,900.00',
    'INFORMACIÓN ADICIONAL', 'Lugar de entrega:', 'Almacén QA · DAP', 'Requisiciones relacionadas:', 'Método y forma de pago:', 'PUE / 03 · Transferencia', 'USO DE CFDI:', 'Nota sintética', 'Condiciones sintéticas.',
    'Enviar la factura a:', PO_FORMAT.invoiceTo, 'Facturar a:', PO_FORMAT.billTo,
    'SUBTOTAL $', 'IVA 16% $', '624.00', 'TOTAL $', '4,524.00 USD',
    'COMPRÓ:', 'PREPARÓ:', 'AUTORIZÓ:', 'QA Autoriza', 'ASISTENTE ADMINISTRATIVA', 'GERENTE ADMINISTRATIVO', '[ Firma ]', PO_FORMAT.address]) assert.ok(t.includes(x), x);
  assert.ok(!t.includes('PURCHASE ORDER'));
  assert.ok(!t.includes('(1/1) Tj'), 'una sola página no lleva paginación');
});

test('los datos registrados en la OC tienen prioridad sobre los fijos del formato', () => {
  const t = text(buildPoPdf(jsPDF, { ...D, item: { ...D.item, bill_to: 'Empresa Facturadora QA', invoice_to: 'facturas@qa.invalid', tax_rate_pct: null } }, false));
  assert.ok(t.includes('Empresa Facturadora QA') && t.includes('facturas@qa.invalid'));
  assert.ok(!t.includes(PO_FORMAT.billTo) && !t.includes(PO_FORMAT.invoiceTo));
  assert.ok(t.includes('IMPUESTOS $'), 'sin tasa registrada no se inventa el 16 %');
});

test('PDF en inglés: etiquetas traducidas', () => {
  const t = text(buildPoPdf(jsPDF, D, true));
  for (const x of ['PURCHASE ORDER', 'BUYER:', 'SUPPLIER:', 'PO NUMBER:', 'UNIT PRICE', 'ADDITIONAL INFORMATION', 'Bill to:', 'VAT 16% $', 'AUTHORIZED BY:', '[ Signature ]']) assert.ok(t.includes(x), x);
  assert.ok(!t.includes('ORDEN DE COMPRA'));
});

test('muchas partidas generan varias páginas con encabezado repetido y paginación', () => {
  const many = { ...D, items: Array.from({ length: 60 }, (_, i) => ({ ...D.items[0], line_number: i + 1 })) };
  const doc = buildPoPdf(jsPDF, many, false);
  const pages = doc.getNumberOfPages();
  assert.ok(pages >= 3);
  const t = text(doc);
  assert.ok(t.includes(`(1/${pages}) Tj`) && t.includes(`(${pages}/${pages}) Tj`));
  assert.ok(t.split('REQUISICIÓN /').length - 1 >= 2, 'encabezado de partidas en cada página');
});

test('sin partidas, logotipo inválido y nombre de archivo', () => {
  assert.ok(text(buildPoPdf(jsPDF, { item: D.item, items: [] }, false, 'data:image/png;base64,xx')).includes('Sin partidas registradas.'));
  assert.equal(pdfName(D.item), 'OC-QA-0777-Rev1.pdf');
  assert.equal(pdfName({ folio: 'OC-1', version_number: 1 }), 'OC-1-Rev0.pdf');
});
