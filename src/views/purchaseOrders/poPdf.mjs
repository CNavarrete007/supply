// Órdenes de Compra · PDF de la Orden de Compra generado en el navegador (jsPDF) con los datos reales de la OC.
// Todas las etiquetas salen en el idioma elegido; los datos capturados (descripciones, nombres) se imprimen como se
// registraron. No escribe nada en el servidor.
import { money, revLabel } from './model.mjs';

const clean = v => String(v ?? '').trim();
const dash = v => clean(v) || '—';

/**
 * Builds the PDF with the given jsPDF constructor (injected so the module stays testable in Node).
 * @returns {import('jspdf').jsPDF}
 */
export function buildPoPdf(JsPDF, d, en = false) {
  const L = (es, e) => (en ? e : es);
  const po = d?.item || {};
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const M = 40; let y = M;
  doc.setProperties({ title: `${L('Orden de Compra', 'Purchase Order')} ${dash(po.folio)}`, subject: 'Grupo Gerez', creator: 'SupplyFlow' });

  // Banner
  doc.setFillColor(37, 99, 235); doc.roundedRect(M, y, W - 2 * M, 54, 6, 6, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(`${L('Orden de Compra', 'Purchase Order')} ${dash(po.folio)} · ${revLabel(po)}`, M + 14, y + 22);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Grupo Gerez · ${L('Compras', 'Purchasing')}`, M + 14, y + 38);
  doc.text(`${L('Fecha', 'Date')}: ${dash(clean(po.order_date).slice(0, 10))}`, W - M - 14, y + 22, { align: 'right' });
  doc.text(`${L('Compromiso', 'Commitment')}: ${dash(clean(po.commitment_date).slice(0, 10))}`, W - M - 14, y + 38, { align: 'right' });
  y += 70; doc.setTextColor(15, 23, 42);

  // Boxes (2 x 2)
  const boxes = [
    [L('Proveedor', 'Supplier'), [dash(po.supplier_name), `${clean(po.supplier_code)}${po.supplier_tax_id ? ` · RFC ${po.supplier_tax_id}` : ''}`]],
    [L('Referencias', 'References'), [`${L('Requisición', 'Requisition')}: ${dash(po.requisitions)}`, `${L('Cliente', 'Client')}: ${dash(po.clients)}`, `${L('Ref. interna', 'Internal ref.')}: ${dash(po.internal_reference)}`]],
    [L('Entrega', 'Delivery'), [`${dash(po.delivery_place)}${po.incoterm_code ? ` · ${po.incoterm_code}` : ''}`]],
    [L('Pago y facturación', 'Payment and invoicing'), [`${dash(po.payment_method_label)} · ${dash(po.payment_form_label)} · CFDI ${dash(po.cfdi_use_label)}`]],
  ];
  const bw = (W - 2 * M - 12) / 2;
  for (let i = 0; i < boxes.length; i += 2) {
    const pair = boxes.slice(i, i + 2).map(([t, lines]) => [t, lines.flatMap(l => doc.splitTextToSize(l, bw - 16))]);
    const bh = 26 + Math.max(...pair.map(([, l]) => l.length)) * 11;
    pair.forEach(([t, lines], j) => {
      const x = M + j * (bw + 12);
      doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, bw, bh, 4, 4, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(t.toUpperCase(), x + 8, y + 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(15, 23, 42); doc.text(lines, x + 8, y + 26);
    });
    y += bh + 10;
  }

  // Items table
  const cols = [['#', 22, 'left'], [L('Descripción', 'Description'), 0, 'left'], [L('Categoría', 'Category'), 80, 'left'], [L('Cantidad', 'Qty'), 50, 'right'], [L('Unidad', 'Unit'), 42, 'left'],
    [L('Precio unitario', 'Unit price'), 82, 'right'], [L('Importe', 'Amount'), 86, 'right']];
  const fixed = cols.reduce((n, c) => n + c[1], 0); cols[1][1] = W - 2 * M - fixed;
  const header = () => {
    doc.setFillColor(248, 250, 252); doc.rect(M, y, W - 2 * M, 18, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
    let x = M; for (const [t, w, a] of cols) { doc.text(t.toUpperCase(), a === 'right' ? x + w - 4 : x + 4, y + 12, { align: a }); x += w; }
    y += 22; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
  };
  header();
  const rows = d?.items || [];
  if (!rows.length) { doc.text(L('Sin partidas registradas.', 'No line items recorded.'), M + 4, y + 4); y += 16; }
  for (const it of rows) {
    const vals = [clean(it.line_number), clean(it.description), clean(it.category), String(Number(it.quantity)), clean(it.unit_label), money(it.unit_price, po.currency, en), money(it.line_subtotal, po.currency, en)];
    const wrapped = vals.map((v, i) => doc.splitTextToSize(v, cols[i][1] - 8));
    const rh = Math.max(...wrapped.map(w => w.length)) * 10 + 6;
    if (y + rh > H - 120) { doc.addPage(); y = M; header(); }
    let x = M; wrapped.forEach((w, i) => { const [, cw, a] = cols[i]; doc.text(w, a === 'right' ? x + cw - 4 : x + 4, y + 4, { align: a }); x += cw; });
    y += rh; doc.setDrawColor(226, 232, 240); doc.line(M, y - 3, W - M, y - 3);
  }

  // Totals
  if (y > H - 170) { doc.addPage(); y = M; }
  y += 6; const tx = W - M - 220;
  [['Subtotal', po.subtotal_amount], [L('Impuestos', 'Taxes'), po.tax_amount]].forEach(([t, v]) => { doc.text(t, tx, y); doc.text(money(v, po.currency, en), W - M, y, { align: 'right' }); y += 14; });
  doc.setDrawColor(15, 23, 42); doc.line(tx, y - 8, W - M, y - 8); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Total', tx, y + 4); doc.text(money(po.total_amount, po.currency, en), W - M, y + 4, { align: 'right' }); y += 24;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);

  if (clean(po.terms_text)) {
    const t = doc.splitTextToSize(clean(po.terms_text), W - 2 * M - 16);
    if (y + t.length * 10 + 30 > H - 90) { doc.addPage(); y = M; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139); doc.text(L('CONDICIONES', 'TERMS'), M, y); y += 12;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42); doc.text(t, M, y); y += t.length * 10 + 8;
  }

  // Signatures
  if (y > H - 90) { doc.addPage(); y = M; }
  const sy = Math.max(y + 40, H - 80); const sw = (W - 2 * M - 40) / 3;
  [[L('Comprador', 'Buyer'), po.buyer_name], [L('Preparó / Revisó', 'Prepared / Reviewed'), po.preparer_name], [L('Autorizó', 'Authorized'), po.authorizer_name]].forEach(([t, n], i) => {
    const x = M + i * (sw + 20);
    doc.setDrawColor(15, 23, 42); doc.line(x, sy, x + sw, sy);
    doc.setFont('helvetica', 'bold'); doc.text(dash(n), x + sw / 2, sy + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139); doc.text(t, x + sw / 2, sy + 23, { align: 'center' }); doc.setTextColor(15, 23, 42);
  });
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
    doc.text(`${L('Documento generado por SupplyFlow con los datos registrados de la OC.', 'Document generated by SupplyFlow from the recorded PO data.')} ${p}/${pages}`, M, H - 20);
  }
  return doc;
}

export const pdfName = po => `${clean(po?.folio) || 'OC'}-${revLabel(po).replace(/\s+/g, '').replace('.', '')}.pdf`;
