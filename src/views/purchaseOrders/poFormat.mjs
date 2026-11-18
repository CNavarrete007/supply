// Órdenes de Compra · tarjeta 6 "Formato de Orden de Compra" · lógica pura (sin red).
// Vista previa / impresión en HTML con el formato Grupo Gerez (el mismo del PDF de poPdf.mjs) y las firmas manuscritas
// capturadas en el navegador. Guardar firmas en la OC es una escritura sin endpoint: se valida y se informa que no se
// guardaron; por transparencia, el documento impreso indica cuando lleva firmas capturadas y no registradas.
import { escapeHtml as e } from '../generalMatrix/model.mjs';
import { revOf, revLabel } from './model.mjs';
import { PO_FORMAT } from './poPdf.mjs';

const clean = v => String(v ?? '').trim();
const dash = v => clean(v) || '—';
const num = v => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const cash = v => (v === null || v === undefined || v === '' ? '—' : `$${num(v)}`);

/** Signature slots of the design (role key, title, description). */
export const SIGNATURE_SLOTS = [
  ['buyer', 'Compró / Comprador', 'Purchased by / Buyer', 'Firma del comprador seleccionado. Puede dibujarse o pegarse como imagen.', 'Signature of the selected buyer. It can be drawn or pasted as an image.'],
  ['preparer', 'Preparó', 'Prepared by', 'Firma de la persona que prepara el documento.', 'Signature of the person who prepares the document.'],
  ['authorizer', 'Autorizó', 'Authorized by', 'Firma de la persona seleccionada en el catálogo de autorizadores.', 'Signature of the person selected in the authorizers catalog.'],
];

/** Selector label: "OC-2026-0005 · GRAINGER INC. · $12,145.20" (Rev. N when it is not the original). */
export const poOptionLabel = po => [`${po.folio}${Number(revOf(po)) > 0 ? ` ${revLabel(po)}` : ''}`, clean(po.supplier_name).toUpperCase(), cash(po.total_amount)].filter(Boolean).join(' · ');

/** Registered signature (signature_evidence) of a role, matching the recorded role code in Spanish or English. */
export function registeredSignature(detail, role) {
  const re = { buyer: /buy|compr/i, preparer: /prep|revis|review/i, authorizer: /auth|autori/i }[role];
  return (detail?.signatures || []).find(s => re && re.test(clean(s.role))) || null;
}

/** Status chip of a pad: captured in this session, registered in SupplyFlow or empty. */
export function signatureStatus(captured, registered, en = false) {
  const m = (es, x) => (en ? x : es);
  if (captured) return { key: 'captured', text: m('Firma capturada (sin guardar)', 'Signature captured (not saved)'), tone: 'text-emerald-700' };
  if (registered) return { key: 'registered', text: m(`Firma registrada en SupplyFlow${registered.signed_at ? ` · ${clean(registered.signed_at).slice(0, 10)}` : ''}`, `Signature recorded in SupplyFlow${registered.signed_at ? ` · ${clean(registered.signed_at).slice(0, 10)}` : ''}`), tone: 'text-blue-700' };
  return { key: 'empty', text: m('Sin firma', 'No signature'), tone: 'text-slate-500' };
}

export const SIGNATURE_TYPES = ['image/png', 'image/jpeg'];
export const SIGNATURE_MAX = 2 * 1024 * 1024;
/** Uploaded/pasted signature image: PNG or JPG, not empty, ≤ 2 MB. '' = valid. */
export function signatureFileError(file, en = false) {
  const m = (es, x) => (en ? x : es);
  if (!file) return m('Selecciona una imagen.', 'Select an image.');
  if (!SIGNATURE_TYPES.includes(clean(file.type).toLowerCase())) return m('La firma debe ser una imagen PNG o JPG.', 'The signature must be a PNG or JPG image.');
  if (!file.size) return m('La imagen está vacía.', 'The image is empty.');
  if (file.size > SIGNATURE_MAX) return m('La imagen de la firma no debe exceder 2 MB.', 'The signature image must not exceed 2 MB.');
  return '';
}

/** Only PNG/JPEG data URLs are embedded in the document (never SVG/HTML). */
export const safeSignature = url => (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(clean(url)) ? clean(url) : '');

/** "Guardar firmas digitales": nothing is written; { ok, kind, text }. */
export function saveSignaturesResult(po, captured = {}, en = false) {
  const m = (es, x) => (en ? x : es);
  const roles = SIGNATURE_SLOTS.filter(([k]) => safeSignature(captured[k])).map(([, es, x]) => (en ? x : es));
  if (!po) return { ok: false, kind: 'error', text: m('Selecciona una orden de compra.', 'Select a purchase order.') };
  if (!roles.length) return { ok: false, kind: 'error', text: m('Captura al menos una firma (dibujada, pegada o cargada).', 'Capture at least one signature (drawn, pasted or uploaded).') };
  return { ok: true, kind: 'locked', text: m(`Firmas validadas (${roles.join(', ')}), pero no se guardaron en ${po.folio}: registrar firmas en la Orden de Compra es una escritura bloqueada hasta su autorización. Se incorporan solo a la vista previa e impresión de esta sesión.`,
    `Signatures validated (${roles.join(', ')}), but they were not saved in ${po.folio}: recording signatures in the Purchase Order is a blocked write until authorized. They are only added to this session's preview and print.`) };
}

/**
 * Formal PO document (HTML) in the Grupo Gerez format of the design; every value is escaped.
 * opts: { logoUrl, signatures: { buyer, preparer, authorizer } (PNG/JPEG data URLs) }.
 */
export function poFormatHtml(d, en = false, { logoUrl = '/image_923273.svg', signatures = {} } = {}) {
  const L = (es, x) => (en ? x : es);
  const po = d?.item || {};
  const rev = Number(revOf(po)) || 0;
  const rate = po.tax_rate_pct === null || po.tax_rate_pct === undefined || po.tax_rate_pct === '' ? null : Math.round(Number(po.tax_rate_pct) * 100) / 100;
  const contact = [clean(po.supplier_contact), clean(po.supplier_contact_email) || clean(po.supplier_contact_phone)].filter(Boolean).join(' · ');
  const rows = (d?.items || []).map(it => `<tr><td class="c">${e(it.line_number)}</td><td class="c b">${e(dash(po.requisitions))}</td><td class="c">${e(dash(po.internal_reference))}</td><td>${e(`${clean(it.line_number)}. ${clean(it.description)}`)}</td><td class="c">${e(`${Number(it.quantity)} ${clean(it.unit_label)}`.trim())}</td><td class="r">${e(cash(it.unit_price))}</td><td class="r b">${e(cash(it.line_subtotal))}</td></tr>`).join('')
    || `<tr><td colspan="7" class="c muted">${L('Sin partidas registradas.', 'No line items recorded.')}</td></tr>`;
  const info = [
    [L('Lugar de entrega', 'Delivery place'), `${dash(po.delivery_place)}${po.incoterm_code ? ` · ${po.incoterm_code}` : ''}`], [L('Orden', 'Order'), dash(po.order_reference)],
    [L('Requisiciones relacionadas', 'Related requisitions'), dash(po.requisitions)], [L('Referencias internas', 'Internal references'), dash(po.internal_reference)],
    [L('Moneda', 'Currency'), dash(po.currency), true], [L('Método y forma de pago', 'Payment method and form'), [clean(po.payment_method_label), clean(po.payment_form_label)].filter(Boolean).join(' / ') || '—'],
    [L('USO DE CFDI', 'CFDI USE'), dash(po.cfdi_use_label)], [L('NOTAS', 'NOTES'), dash(po.notes)], ...(clean(po.terms_text) ? [[L('Condiciones', 'Terms'), clean(po.terms_text)]] : []),
    [L('Enviar la factura a', 'Send the invoice to'), clean(po.invoice_to) || PO_FORMAT.invoiceTo], [L('Facturar a', 'Bill to'), clean(po.bill_to) || PO_FORMAT.billTo],
  ].map(([k, v, bold]) => `<div class="ir"><span class="arrow">➔</span><span class="ik">${e(k)}:</span><span class="${bold ? 'b' : ''}">${e(v)}</span></div>`).join('');
  const sig = (role, label, name, pos) => { const img = safeSignature(signatures[role]); return `<div class="sig"><div class="sigimg">${img ? `<img alt="${e(L('Firma', 'Signature'))}" src="${img}">` : `<span>${L('[ Firma ]', '[ Signature ]')}</span>`}</div><div class="line"></div><strong>${e(label)}</strong><strong>${e(dash(name))}</strong><span class="pos">${e(clean(pos).toUpperCase() || '—')}</span></div>`; };
  const captured = SIGNATURE_SLOTS.some(([k]) => safeSignature(signatures[k]));
  const css = `@page{size:letter;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#0f172a;background:#fff}
.doc{max-width:860px;margin:0 auto;padding:22px 26px}.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid #e2e8f0}
.logo{display:flex;align-items:center;gap:10px;border:1px solid #cbd5e1;border-radius:9px;padding:8px 14px 8px 8px}.logo img{width:46px;height:46px;object-fit:contain}.logo b{display:block;color:#ea580c;font-size:15px}.logo small{display:block;color:#64748b;font-size:7.5px;font-weight:bold;line-height:1.2}
.title{text-align:center}.title h1{margin:0;font-size:22px;letter-spacing:.3px}.title span{color:#64748b;font-weight:bold;font-size:9.5px}.ctl{text-align:right;color:#64748b;font-size:9.5px;line-height:1.55}.ctl a{color:#2563eb;text-decoration:none}
.info{display:flex;justify-content:space-between;gap:24px;margin:16px 0 14px}.who{flex:0 0 58%}.who div{display:flex;padding:7px 8px;background:#f1f5f9;margin-bottom:3px}.who div:nth-child(even){background:#f8fafc}.who b{width:100px;flex:none}
.ref{text-align:right;line-height:1.95}.ref .city{color:#94a3b8}.ref b{display:inline-block;margin-right:6px}
table{width:100%;border-collapse:collapse;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a}th{background:#1e385c;color:#fff;font-size:9px;padding:9px 6px;text-transform:uppercase;border-left:1px solid #fff}th:first-child{border-left:0}
td{padding:9px 6px;background:#f8fafc;border-bottom:1px solid #e2e8f0;vertical-align:top}.c{text-align:center}.r{text-align:right}.b{font-weight:bold}.muted{color:#64748b}
.bottom{display:flex;justify-content:space-between;gap:28px;margin-top:20px;padding-bottom:18px;border-bottom:1px solid #e2e8f0}.add{flex:0 0 54%}.add h3{text-align:center;font-size:10px;margin:0 0 6px;padding-bottom:5px;border-bottom:1px solid #cbd5e1}
.ir{display:flex;gap:6px;padding:3px 0}.arrow{color:#ea7c22;font-weight:bold}.ik{font-weight:bold;width:150px;flex:none}.tot{flex:1}.tot div{display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0}.tot div b{font-size:12.5px}
.grand{margin-top:8px;background:#ea7c22;color:#fff;border-radius:6px;padding:12px 14px!important;font-weight:bold;font-size:15px!important}
.sigs{display:flex;gap:24px;margin-top:56px}.sig{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px}.sigimg{height:54px;display:flex;align-items:flex-end;justify-content:center;width:100%}.sigimg img{max-height:54px;max-width:100%}.sigimg span{color:#94a3b8;font-style:italic;font-size:9px}
.line{width:100%;border-top:1px solid #0f172a;margin:2px 0 4px}.pos{color:#64748b;font-size:9px}.note{margin-top:12px;color:#b45309;font-size:9px;text-align:center}.foot{margin-top:28px;text-align:center;color:#94a3b8;font-size:9px}`;
  const body = `<div class="doc">
<div class="head"><div class="logo"><img alt="${e(PO_FORMAT.company)}" src="${e(logoUrl)}"><div><b>${e(PO_FORMAT.company)}</b><small>${PO_FORMAT.tagline.map(e).join('<br>')}</small></div></div>
<div class="title"><h1>${L('ORDEN DE COMPRA', 'PURCHASE ORDER')}</h1><span>${e(PO_FORMAT.company)}</span></div>
<div class="ctl"><a>${e(PO_FORMAT.site)}</a><br>${e(PO_FORMAT.code)}<br>${L('Fecha', 'Date')}: ${e(PO_FORMAT.issued)}<br>${L('Revisión', 'Revision')}: ${e(PO_FORMAT.revision)}</div></div>
<div class="info"><div class="who"><div><b>${L('COMPRADOR:', 'BUYER:')}</b>${e(dash(po.buyer_name))}</div><div><b>${L('CONTACTO:', 'CONTACT:')}</b>${e(dash(po.buyer_email))}</div><div><b>${L('PROVEEDOR:', 'SUPPLIER:')}</b>${e(dash(po.supplier_name))}</div><div><b>${L('CONTACTO:', 'CONTACT:')}</b>${e(dash(contact))}</div></div>
<div class="ref"><div class="city">${e(PO_FORMAT.city)}</div><div><b>${L('FECHA DE OC:', 'PO DATE:')}</b>${e(dash(clean(po.order_date).slice(0, 10)))}</div><div><b>${L('NÚMERO DE OC:', 'PO NUMBER:')}</b>${e(`${dash(po.folio)}${rev > 0 ? ` · ${revLabel(po)}` : ''}`)}</div><div><b>${L('REFERENCIA:', 'REFERENCE:')}</b>${e(dash(po.order_reference))}</div><div><b>${L('REF. INTERNA:', 'INTERNAL REF.:')}</b>${e(dash(po.internal_reference))}</div></div></div>
<table><thead><tr><th>${L('Partida', 'Item')}</th><th>${L('Requisición / Solicitud', 'Requisition / Request')}</th><th>${L('Referencia interna', 'Internal reference')}</th><th>${L('Descripción', 'Description')}</th><th>${L('Cantidad', 'Quantity')}</th><th>${L('Precio unitario', 'Unit price')}</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
<div class="bottom"><div class="add"><h3>${L('INFORMACIÓN ADICIONAL', 'ADDITIONAL INFORMATION')}</h3>${info}</div>
<div class="tot"><div><b>SUBTOTAL $</b><span>${e(num(po.subtotal_amount))}</span></div><div><b>${rate === null ? L('IMPUESTOS $', 'TAXES $') : `${L('IVA', 'VAT')} ${e(rate)}% $`}</b><span>${e(num(po.tax_amount))}</span></div><div class="grand"><span>TOTAL $</span><span>${e(`${num(po.total_amount)} ${clean(po.currency)}`.trim())}</span></div></div></div>
<div class="sigs">${sig('buyer', L('COMPRÓ:', 'PURCHASED BY:'), po.buyer_name, po.buyer_position)}${sig('preparer', L('PREPARÓ:', 'PREPARED BY:'), po.preparer_name, po.preparer_position)}${sig('authorizer', L('AUTORIZÓ:', 'AUTHORIZED BY:'), po.authorizer_name, po.authorizer_position)}</div>
${captured ? `<div class="note">${L('Firmas manuscritas capturadas en este equipo; no registradas en SupplyFlow.', 'Handwritten signatures captured on this device; not recorded in SupplyFlow.')}</div>` : ''}
<div class="foot">${e(PO_FORMAT.address)}</div></div>`;
  const html = `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${e(`${dash(po.folio)}-${revLabel(po).replace(/\s+/g, '').replace('.', '')}`)}</title><style>${css}</style></head><body>${body}</body></html>`;
  return { css, body, html };
}
