// Órdenes de Compra · PDF de la Orden de Compra generado en el navegador (jsPDF) con los datos reales de la OC, en el
// formato Grupo Gerez del diseño (encabezado con logotipo y control documental, comprador/proveedor, partidas, información
// adicional, total y firmas). Los datos capturados se imprimen como se registraron. No escribe nada en el servidor.
import { revLabel, revOf } from './model.mjs';

/**
 * Datos fijos del formato aprobado (control documental P-COP-01-01 y datos de facturación de Grupo Gerez), tomados del
 * diseño. Cuando "Configuración" se conecte a organization_settings deberán leerse de ahí. Los valores registrados en la
 * OC (bill_to / invoice_to) tienen prioridad sobre estos.
 */
export const PO_FORMAT = {
  company: 'GRUPO GEREZ', tagline: ['CUSTOMS & LOGISTICS', 'WORLDWIDE'], site: 'www.grupogerez.com',
  code: 'P-COP-01-01', issued: '01/11/18', revision: '02', city: 'Tampico, Tamaulipas',
  invoiceTo: 'supplies@grupogerez.com', billTo: 'GRUPO GEREZ S.A. DE C.V.',
  address: '3ra avenida #1007 Col. Anahuac, Tampico Tamps. Teléfono: 8332140041',
};

const NAVY = [30, 56, 92]; const ORANGE = [234, 124, 34]; const INK = [15, 23, 42]; const GRAY = [100, 116, 139]; const LIGHT = [148, 163, 184];
const clean = v => String(v ?? '').trim();
const dash = v => clean(v) || '—';
const num = v => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const cash = v => (v === null || v === undefined || v === '' ? '—' : `$${num(v)}`);

/**
 * Builds the PDF with the given jsPDF constructor (injected so the module stays testable in Node).
 * `logo` (optional): PNG data URL of the company logo.
 * @returns {import('jspdf').jsPDF}
 */
export function buildPoPdf(JsPDF, d, en = false, logo = null) {
  const L = (es, e) => (en ? e : es);
  const po = d?.item || {};
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const M = 36; const CW = W - 2 * M; let y = M;
  const font = (size, style = 'normal', color = INK) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };
  doc.setProperties({ title: `${L('Orden de Compra', 'Purchase Order')} ${dash(po.folio)}`, subject: PO_FORMAT.company, creator: 'SupplyFlow' });

  // Encabezado: logotipo, título y control documental
  doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.8); doc.roundedRect(M, y, 158, 54, 7, 7, 'S');
  if (logo) { try { doc.addImage(logo, 'PNG', M + 8, y + 8, 38, 38); } catch { /* logotipo opcional */ } }
  font(12, 'bold', [234, 88, 12]); doc.text(PO_FORMAT.company, M + 52, y + 24);
  font(6, 'bold', GRAY); doc.text(PO_FORMAT.tagline, M + 52, y + 33);
  font(17, 'bold'); doc.text(L('ORDEN DE COMPRA', 'PURCHASE ORDER'), W / 2, y + 24, { align: 'center' });
  font(7.5, 'bold', GRAY); doc.text(PO_FORMAT.company, W / 2, y + 35, { align: 'center' });
  font(7.5, 'normal', [37, 99, 235]); doc.text(PO_FORMAT.site, W - M, y + 9, { align: 'right' });
  font(7.5, 'normal', GRAY);
  doc.text(PO_FORMAT.code, W - M, y + 20, { align: 'right' });
  doc.text(`${L('Fecha', 'Date')}: ${PO_FORMAT.issued}`, W - M, y + 31, { align: 'right' });
  doc.text(`${L('Revisión', 'Revision')}: ${PO_FORMAT.revision}`, W - M, y + 42, { align: 'right' });
  y += 66; doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 14;

  // Comprador / proveedor (izquierda) y datos de la OC (derecha)
  const supplierContact = [clean(po.supplier_contact), clean(po.supplier_contact_email) || clean(po.supplier_contact_phone)].filter(Boolean).join(' · ');
  const left = [[L('COMPRADOR:', 'BUYER:'), dash(po.buyer_name)], [L('CONTACTO:', 'CONTACT:'), dash(po.buyer_email)], [L('PROVEEDOR:', 'SUPPLIER:'), dash(po.supplier_name)], [L('CONTACTO:', 'CONTACT:'), dash(supplierContact)]];
  const lw = CW * 0.58; let ly = y;
  left.forEach(([k, v], i) => {
    const lines = doc.splitTextToSize(v, lw - 104);
    const h = Math.max(20, lines.length * 10 + 10);
    doc.setFillColor(...(i % 2 ? [248, 250, 252] : [241, 245, 249])); doc.rect(M, ly, lw, h, 'F');
    font(7.5, 'bold'); doc.text(k, M + 6, ly + 13);
    font(7.5); doc.text(lines, M + 96, ly + 13);
    ly += h + 3;
  });
  let ry = y + 4; const rx = W - M - 92;
  font(7.5, 'normal', LIGHT); doc.text(PO_FORMAT.city, W - M, ry, { align: 'right' }); ry += 18;
  const rev = Number(revOf(po)) || 0;
  [[L('FECHA DE OC:', 'PO DATE:'), dash(clean(po.order_date).slice(0, 10))], [L('NÚMERO DE OC:', 'PO NUMBER:'), `${dash(po.folio)}${rev > 0 ? ` · ${revLabel(po)}` : ''}`],
    [L('REFERENCIA:', 'REFERENCE:'), dash(po.order_reference)], [L('REF. INTERNA:', 'INTERNAL REF.:'), dash(po.internal_reference)]].forEach(([k, v]) => {
    font(7.5, 'bold'); doc.text(k, rx, ry, { align: 'right' });
    font(7.5); doc.text(doc.splitTextToSize(v, 90)[0], rx + 6, ry);
    ry += 15;
  });
  y = Math.max(ly, ry) + 8;
  doc.setDrawColor(...INK); doc.setLineWidth(1.6); doc.line(M, y, W - M, y); y += 2;

  // Partidas
  const cols = [[L('PARTIDA', 'ITEM'), 40, 'center'], [L('REQUISICIÓN / SOLICITUD', 'REQUISITION / REQUEST'), 104, 'center'], [L('REFERENCIA INTERNA', 'INTERNAL REFERENCE'), 70, 'center'],
    [L('DESCRIPCIÓN', 'DESCRIPTION'), 0, 'left'], [L('CANTIDAD', 'QUANTITY'), 52, 'center'], [L('PRECIO UNITARIO', 'UNIT PRICE'), 62, 'right'], ['SUBTOTAL', 64, 'right']];
  cols[3][1] = CW - cols.reduce((n, c) => n + c[1], 0);
  const colX = i => M + cols.slice(0, i).reduce((n, c) => n + c[1], 0);
  const at = (i, a) => (a === 'right' ? colX(i) + cols[i][1] - 5 : a === 'center' ? colX(i) + cols[i][1] / 2 : colX(i) + 5);
  const header = () => {
    doc.setFillColor(...NAVY); doc.rect(M, y, CW, 32, 'F');
    font(6.8, 'bold', [255, 255, 255]);
    cols.forEach(([t, w], i) => { const ls = doc.splitTextToSize(t, w - 6); doc.text(ls, colX(i) + w / 2, y + 17 - (ls.length - 1) * 4, { align: 'center' }); });
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5); cols.slice(1).forEach((_, i) => doc.line(colX(i + 1), y, colX(i + 1), y + 32));
    y += 32;
  };
  header();
  const rows = d?.items || [];
  if (!rows.length) { font(8, 'normal', GRAY); doc.text(L('Sin partidas registradas.', 'No line items recorded.'), M + 6, y + 16); y += 26; }
  for (const it of rows) {
    const vals = [clean(it.line_number), dash(po.requisitions), dash(po.internal_reference), `${clean(it.line_number)}. ${clean(it.description)}`,
      `${Number(it.quantity)} ${clean(it.unit_label)}`.trim(), cash(it.unit_price), cash(it.line_subtotal)];
    const wrapped = vals.map((v, i) => doc.splitTextToSize(v, cols[i][1] - 10));
    const rh = Math.max(...wrapped.map(w => w.length)) * 9.5 + 14;
    if (y + rh > H - 70) { doc.addPage(); y = M; header(); }
    doc.setFillColor(248, 250, 252); doc.rect(M, y, CW, rh, 'F');
    wrapped.forEach((w, i) => { font(7.8, i === 1 || i === 6 ? 'bold' : 'normal'); doc.text(w, at(i, cols[i][2]), y + 13, { align: cols[i][2] }); });
    y += rh; doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.line(M, y, W - M, y);
  }
  doc.setDrawColor(...INK); doc.setLineWidth(1.6); doc.line(M, y, W - M, y); y += 22;

  // Información adicional (izquierda) y totales (derecha)
  if (y > H - 290) { doc.addPage(); y = M; }
  const info = [
    [L('Lugar de entrega:', 'Delivery place:'), `${dash(po.delivery_place)}${po.incoterm_code ? ` · ${po.incoterm_code}` : ''}`],
    [L('Orden:', 'Order:'), dash(po.order_reference)],
    [L('Requisiciones relacionadas:', 'Related requisitions:'), dash(po.requisitions)],
    [L('Referencias internas:', 'Internal references:'), dash(po.internal_reference)],
    [L('Moneda:', 'Currency:'), dash(po.currency)],
    [L('Método y forma de pago:', 'Payment method and form:'), [clean(po.payment_method_label), clean(po.payment_form_label)].filter(Boolean).join(' / ') || '—'],
    [L('USO DE CFDI:', 'CFDI USE:'), dash(po.cfdi_use_label)],
    [L('NOTAS:', 'NOTES:'), dash(po.notes)],
    ...(clean(po.terms_text) ? [[L('Condiciones:', 'Terms:'), clean(po.terms_text)]] : []),
    [L('Enviar la factura a:', 'Send the invoice to:'), clean(po.invoice_to) || PO_FORMAT.invoiceTo],
    [L('Facturar a:', 'Bill to:'), clean(po.bill_to) || PO_FORMAT.billTo],
  ];
  const iw = CW * 0.52; let iy = y;
  font(7.5, 'bold'); doc.text(L('INFORMACIÓN ADICIONAL', 'ADDITIONAL INFORMATION'), M + iw / 2, iy, { align: 'center' });
  iy += 5; doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.5); doc.line(M, iy, M + iw, iy); iy += 13;
  for (const [k, v] of info) {
    doc.setFillColor(...ORANGE); doc.triangle(M + 2, iy - 6, M + 2, iy, M + 7, iy - 3, 'F');
    font(7.3, 'bold'); doc.text(k, M + 12, iy);
    const lines = doc.splitTextToSize(v, iw - 150);
    font(7.3, k.startsWith(L('Moneda', 'Currency')) ? 'bold' : 'normal'); doc.text(lines, M + 140, iy);
    iy += Math.max(1, lines.length) * 9 + 4;
  }
  const tx = M + CW * 0.6; const tw = W - M - tx; let ty = y + 8;
  const rate = po.tax_rate_pct === null || po.tax_rate_pct === undefined || po.tax_rate_pct === '' ? null : Math.round(Number(po.tax_rate_pct) * 100) / 100;
  [['SUBTOTAL $', num(po.subtotal_amount)], [rate === null ? L('IMPUESTOS $', 'TAXES $') : `${L('IVA', 'VAT')} ${rate}% $`, num(po.tax_amount)]].forEach(([k, v]) => {
    font(9.5, 'bold'); doc.text(k, tx, ty); font(9.5); doc.text(v, W - M, ty, { align: 'right' }); ty += 20;
  });
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(tx, ty - 8, W - M, ty - 8); ty += 2;
  doc.setFillColor(...ORANGE); doc.roundedRect(tx, ty, tw, 32, 4, 4, 'F');
  font(11, 'bold', [255, 255, 255]); doc.text('TOTAL $', tx + 12, ty + 20); doc.text(`${num(po.total_amount)} ${clean(po.currency)}`.trim(), W - M - 12, ty + 20, { align: 'right' });
  ty += 46;
  y = Math.max(iy, ty) + 6; doc.setDrawColor(226, 232, 240); doc.line(M, y, W - M, y);

  // Firmas
  if (y > H - 130) { doc.addPage(); y = M; }
  const sy = Math.max(y + 70, H - 112); const sw = (CW - 40) / 3;
  [[L('COMPRÓ:', 'PURCHASED BY:'), po.buyer_name, po.buyer_position], [L('PREPARÓ:', 'PREPARED BY:'), po.preparer_name, po.preparer_position], [L('AUTORIZÓ:', 'AUTHORIZED BY:'), po.authorizer_name, po.authorizer_position]].forEach(([t, n, p], i) => {
    const x = M + i * (sw + 20); const cx = x + sw / 2;
    font(6.8, 'italic', LIGHT); doc.text(L('[ Firma ]', '[ Signature ]'), cx, sy - 6, { align: 'center' });
    doc.setDrawColor(...INK); doc.setLineWidth(0.8); doc.line(x, sy, x + sw, sy);
    font(7.5, 'bold'); doc.text(t, cx, sy + 12, { align: 'center' });
    font(7.5, 'bold'); doc.text(doc.splitTextToSize(dash(n), sw), cx, sy + 24, { align: 'center' });
    font(6.5, 'normal', GRAY); doc.text(doc.splitTextToSize(clean(p).toUpperCase() || '—', sw), cx, sy + 35, { align: 'center' });
  });

  // Pie: domicilio y paginación
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg); font(6.8, 'normal', LIGHT);
    doc.text(PO_FORMAT.address, W / 2, H - 22, { align: 'center' });
    if (pages > 1) doc.text(`${pg}/${pages}`, W - M, H - 22, { align: 'right' });
  }
  return doc;
}

export const pdfName = po => `${clean(po?.folio) || 'OC'}-${revLabel(po).replace(/\s+/g, '').replace('.', '')}.pdf`;

/** Company logo (the sidebar SVG) rasterized to a PNG data URL for jsPDF; null when it cannot be loaded. Browser only. */
let logoCache;
export function loadPoLogo(src = '/image_923273.svg') {
  if (logoCache !== undefined) return Promise.resolve(logoCache);
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * (img.naturalHeight || 1) / (img.naturalWidth || 1));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); logoCache = c.toDataURL('image/png');
      } catch { logoCache = null; }
      resolve(logoCache);
    };
    img.onerror = () => { logoCache = null; resolve(null); };
    img.src = src;
  });
}
