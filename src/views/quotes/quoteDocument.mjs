// Cotizaciones › Formato de cotización para el cliente (documento externo, diseño Grupo Gerez) · lógica pura.
// Normaliza la cotización (GET /api/v1/quotes/customer-quotes/{id} o la vista previa de la tarjeta 6) y genera el HTML del
// documento. Solo datos visibles para el cliente: nunca costos del proveedor, gastos ni margen. Todo valor va escapado.
import { escapeHtml } from '../generalMatrix/model.mjs';

const n = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const t = v => String(v ?? '').trim();
/** "USD 478.80" (currency first, two decimals) as in the design. */
export const docMoney = (v, cur) => `${cur || ''} ${(n(v) ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
export const DOC_DEFAULTS = {
  delivery: ['Por confirmar', 'To be confirmed'], payment: ['Por confirmar', 'To be confirmed'], warranty: ['No indicada', 'Not specified'],
  inclusions: ['Conforme a las partidas descritas.', 'According to the items described.'], exclusions: ['No indicadas.', 'None specified.'],
  notes: ['Precios expresados en la moneda indicada. Vigencia sujeta a disponibilidad.', 'Prices in the indicated currency. Validity subject to availability.'],
};

/**
 * Totals of the document. Explicit third-party / Service Fee columns win; otherwise subtotal_amount is the third-party
 * subtotal before discount and tax_amount includes the Service Fee VAT.
 */
export function docTotals(v = {}) {
  const disc = n(v.discount_amount) ?? 0;
  const sfOn = Boolean(v.service_fee_enabled);
  const sfTax = sfOn ? (n(v.service_fee_tax_amount) ?? 0) : 0;
  const sfSub = sfOn ? (n(v.service_fee_subtotal_amount) ?? ((n(v.service_fee_total_amount) ?? 0) - sfTax)) : 0;
  const tpTaxable = n(v.third_party_taxable_amount) ?? r2((n(v.subtotal_amount) ?? 0) - disc);
  const tpTax = n(v.third_party_tax_amount) ?? r2((n(v.tax_amount) ?? 0) - sfTax);
  const tpTotal = n(v.third_party_total_amount) ?? r2(tpTaxable + tpTax);
  const genSub = r2(tpTaxable + sfSub); const genTax = r2(tpTax + sfTax);
  const vatRate = n(v.tax_rate_pct) ?? (tpTaxable ? r2((tpTax / tpTaxable) * 100) : null);
  return { tpGross: r2(tpTaxable + disc), discount: disc, tpTaxable, tpTax, tpTotal, vatRate, sfOn: sfOn && (sfSub !== 0 || sfTax !== 0), sfRate: n(v.service_fee_rate_pct), sfSub, sfTax, sfTotal: r2(sfSub + sfTax), genSub, genTax, total: n(v.total_amount) ?? r2(genSub + genTax) };
}

/** Electronic signature state: buyer signs when the quote has a preparer; review/authorization when recorded. */
export function signatures(v = {}, en = false) {
  const L = (es, e) => (en ? e : es);
  const approved = String(v.internal_approval_status || '').toLowerCase() === 'approved';
  return [
    { role: L('Comprador', 'Buyer'), name: v.prepared_by || '', position: v.prepared_by_position || '', signed: Boolean(v.prepared_by) },
    { role: L('Revisó', 'Reviewed'), name: v.reviewed_by || '', position: v.reviewed_by_position || '', signed: Boolean(v.reviewed_by) && (approved || Boolean(v.approved_by)) },
    { role: L('Autorizó', 'Authorized'), name: v.approved_by || '', position: v.approved_by_position || '', signed: Boolean(v.approved_by) && approved },
  ];
}

/** Normalized document from the API detail ({ item, items, issuer }) or the tarjeta 6 preview. */
export function docModel(d, en = false) {
  const v = d?.item || {}; const i = d?.issuer || {};
  const pick = (val, key) => (t(val) ? t(val) : DOC_DEFAULTS[key][en ? 1 : 0]);
  return {
    folio: v.folio || '', revision: n(v.revision) ?? Math.max(0, (n(v.version_number) ?? 1) - 1), date: v.quote_date ? String(v.quote_date).slice(0, 10) : '', validUntil: v.valid_until ? String(v.valid_until).slice(0, 10) : '', currency: v.currency || '',
    issuer: { name: i.legal_name || 'GRUPO GEREZ', taxId: i.tax_identifier || '', address: i.postal_address || '', email: i.email || '', phone: i.phone || '' },
    client: { name: v.client_name || '', taxId: v.client_tax_id || '', contact: v.client_contact || '', email: v.client_email || '', phone: v.client_phone || '', project: v.project || '', contract: v.contract || '', reference: v.client_reference || v.internal_reference || v.requisition || '' },
    items: (d?.items || []).map(x => ({ line: x.line_number, description: x.description, brand: t(x.brand_model), qty: n(x.quantity), unit: x.unit_label, unitPrice: n(x.unit_price), subtotal: n(x.line_subtotal) })),
    conditions: {
      delivery: [t(v.delivery_place), t(v.lead_time_text) || DOC_DEFAULTS.delivery[en ? 1 : 0]].filter(Boolean),
      payment: pick(v.payment_terms, 'payment'), warranty: pick(v.warranty_text, 'warranty'), inclusions: pick(v.inclusions_text, 'inclusions'), exclusions: pick(v.exclusions_text, 'exclusions'), notes: pick(v.notes, 'notes'),
    },
    totals: docTotals(v), signatures: signatures(v, en),
  };
}

export const docFileName = m => `${(m.folio || 'Cotizacion').replace(/[^\p{L}\p{N}._-]+/gu, '_')}_Rev${m.revision}.pdf`;

/** { css, body, html } of the document. `logoUrl` is the app logo; `preview` adds the NOT REGISTERED watermark. */
export function quoteDocHtml(m, en = false, { preview = false, logoUrl = '/image_923273.svg' } = {}) {
  const L = (es, e) => (en ? e : es); const e = escapeHtml; const cur = m.currency; const T = m.totals;
  const css = `.gq{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff;font-size:10.5px;line-height:1.4;max-width:820px;margin:0 auto;padding:28px 30px;position:relative;box-sizing:border-box}
.gq *{box-sizing:border-box}.gq .top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.gq .brand{display:flex;align-items:center;gap:10px}.gq .brand img{width:62px;height:62px;object-fit:contain}
.gq .wm{border:2px solid #ea580c;border-radius:6px;padding:5px 10px;color:#ea580c;text-align:center}.gq .wm b{display:block;font-size:17px;font-weight:900;letter-spacing:-.5px}.gq .wm small{font-size:6px;letter-spacing:.5px}
.gq .ttl{text-align:center;flex:1}.gq .ttl h1{margin:0;font-size:20px;font-weight:900;letter-spacing:.5px}.gq .ttl p{margin:2px 0 0;font-size:8px;font-weight:700;letter-spacing:1px;color:#1e3a8a;text-transform:uppercase}
.gq .meta{text-align:right;font-size:9.5px;color:#475569}.gq .meta .f{color:#1e3a8a;font-weight:900;font-size:11px}.gq .meta b{color:#0f172a}.gq .bar{height:2px;background:#2563eb;margin:14px 0 16px}
.gq .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.gq .box{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#f8fafc}.gq .box h5{margin:0 0 5px;color:#1d4ed8;font-size:8.5px;letter-spacing:1px;text-transform:uppercase;font-weight:900}
.gq .box .nm{font-weight:900;font-size:11px;margin-bottom:2px}.gq .box div{color:#475569}.gq .tpp{margin:16px 0 12px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:center;font-size:8.5px;font-weight:900;letter-spacing:5px;padding:4px}
.gq table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}.gq th{background:#1e293b;color:#fff;font-size:8px;text-transform:uppercase;text-align:left;padding:9px 10px;font-weight:900}
.gq td{padding:9px 10px;border-top:1px solid #e2e8f0;vertical-align:top}.gq td.r,.gq th.r{text-align:right}.gq td.c,.gq th.c{text-align:center}.gq td.b{font-weight:900}
.gq .low{display:grid;grid-template-columns:1.9fr 1fr;gap:16px;margin-top:16px;align-items:start}.gq .conds{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gq .cd{border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:4px;padding:8px 10px;background:#f8fafc;break-inside:avoid}
.gq .cd h6{margin:0 0 2px;font-size:9.5px;font-weight:900}.gq .cd div{color:#1d4ed8;font-size:9.5px}.gq .tot div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-weight:700;color:#334155;text-transform:uppercase;font-size:9.5px}
.gq .tot div span:last-child{color:#0f172a;font-weight:900}.gq .tot .g{border:2px solid #0f172a;border-radius:8px;padding:10px 12px;margin-top:10px;font-size:12px;color:#0f172a}.gq .tot .g span:last-child{font-size:14px}
.gq .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:22px;margin-top:34px;text-align:center;break-inside:avoid}.gq .sigs .ro{font-weight:900;font-size:9px;text-transform:uppercase;margin-bottom:18px}.gq .sigs .st{font-style:italic;font-size:9px;color:#94a3b8;border-bottom:1px solid #94a3b8;padding-bottom:3px}
.gq .sigs .st.ok{color:#047857}.gq .sigs .who{font-weight:900;margin-top:5px}.gq .sigs .pos{font-size:8px;color:#64748b;text-transform:uppercase}.gq .foot{border-top:1px solid #e2e8f0;margin-top:24px;padding-top:10px;text-align:center;font-size:8px;color:#94a3b8}
.gq .wmk{position:absolute;top:40%;left:0;right:0;text-align:center;font-size:44px;font-weight:900;color:rgba(37,99,235,.08);transform:rotate(-18deg);pointer-events:none}.gq .pv{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:6px;padding:5px 9px;margin-bottom:10px;font-size:9px}`;
  const rows = m.items.map(x => `<tr><td class="b">${e(x.line)}</td><td>${e(x.description)}</td><td>${e(x.brand || '—')}</td><td class="c">${e(x.qty === null ? '—' : x.qty.toLocaleString('en-US', { maximumFractionDigits: 6 }))}</td><td>${e(x.unit || '')}</td><td class="r">${e(docMoney(x.unitPrice, cur))}</td><td class="r b">${e(docMoney(x.subtotal, cur))}</td></tr>`).join('');
  const line = (k, v2, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><span>${e(k)}</span><span>${e(docMoney(v2, cur))}</span></div>`;
  const vat = T.vatRate === null ? '' : ` ${T.vatRate.toFixed(2)}%`;
  const totals = [line(L('Subtotal Third Party', 'Third Party subtotal'), T.tpGross), T.discount ? line(L('Descuento', 'Discount'), -T.discount) : '', line(`${L('IVA Third Party', 'Third Party VAT')}${vat}`, T.tpTax), line(L('Total Third Party', 'Third Party total'), T.tpTotal),
    T.sfOn ? line(`${L('Subtotal Service Fee', 'Service Fee subtotal')}${T.sfRate !== null ? ` ${T.sfRate.toFixed(2)}%` : ''}`, T.sfSub) : '', T.sfOn ? line(L('IVA Service Fee', 'Service Fee VAT'), T.sfTax) : '', T.sfOn ? line(L('Total Service Fee', 'Service Fee total'), T.sfTotal) : '',
    line(L('Subtotal general', 'General subtotal'), T.genSub), line(L('IVA general', 'General VAT'), T.genTax), line(L('Total general', 'Grand total'), T.total, 'g')].join('');
  const c = m.client; const i = m.issuer; const C = m.conditions;
  const cond = (h, v2) => `<div class="cd"><h6>${e(h)}</h6>${(Array.isArray(v2) ? v2 : [v2]).map(x => `<div>${e(x)}</div>`).join('')}</div>`;
  const body = `<div class="gq">${preview ? `<div class="wmk">${L('VISTA PREVIA · NO REGISTRADA', 'PREVIEW · NOT REGISTERED')}</div><div class="pv">${L('Vista previa no registrada: el folio se asigna al guardar.', 'Unregistered preview: the folio is assigned on save.')}</div>` : ''}
<div class="top"><div class="brand"><img src="${e(logoUrl)}" alt="Grupo Gerez"><div class="wm"><b>GRUPO GEREZ</b><small>CUSTOMS &amp; LOGISTICS WORLDWIDE</small></div></div>
<div class="ttl"><h1>${L('COTIZACIÓN', 'QUOTATION')}</h1><p>Commercial Quotation · ${L('Propuesta económica', 'Economic proposal')}</p></div>
<div class="meta"><div class="f">${e(m.folio || '—')}</div><div>${L('Revisión', 'Revision')}: ${e(m.revision)}</div><div>${L('Fecha', 'Date')}: ${e(m.date || '—')}</div><div>${L('Vigencia', 'Valid until')}: ${e(m.validUntil || '—')}</div><div>${L('Moneda', 'Currency')}: <b>${e(cur)}</b></div></div></div>
<div class="bar"></div>
<div class="two"><div class="box"><h5>${L('Cotiza', 'Quoted by')}</h5><div class="nm">${e(i.name)}</div>${i.taxId ? `<div>RFC ${e(i.taxId)}</div>` : ''}${i.address ? `<div>${e(i.address)}</div>` : ''}${i.email ? `<div>${e(i.email)}</div>` : ''}${i.phone ? `<div>${e(i.phone)}</div>` : ''}</div>
<div class="box"><h5>${L('Cliente', 'Client')}</h5><div class="nm">${e(c.name)}</div>${c.taxId ? `<div>RFC ${e(c.taxId)}</div>` : ''}${c.contact ? `<div>${L('Contacto', 'Contact')}: ${e(c.contact)}</div>` : ''}${c.email || c.phone ? `<div>${e([c.email, c.phone].filter(Boolean).join(' · '))}</div>` : ''}<div>${L('Proyecto', 'Project')}: ${e(c.project || 'N/A')} · ${L('Contrato', 'Contract')}: ${e(c.contract || 'N/A')}</div><div>${L('Referencia', 'Reference')}: ${e(c.reference || 'N/A')}</div></div></div>
<div class="tpp">T H I R D &nbsp; P A R T Y &nbsp; P A Y M E N T</div>
<table><thead><tr><th>Item</th><th>Description</th><th>Brand / Model</th><th class="c">Qty</th><th>Unit</th><th class="r">Unit price</th><th class="r">Subtotal</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="c">${L('Sin partidas registradas.', 'No items recorded.')}</td></tr>`}</tbody></table>
<div class="low"><div class="conds">${cond(L('Lugar y tiempo de entrega', 'Delivery place and time'), C.delivery)}${cond(L('Condiciones de pago', 'Payment terms'), C.payment)}${cond(L('Garantía', 'Warranty'), C.warranty)}${cond(L('Alcance incluido', 'Included scope'), C.inclusions)}${cond(L('Exclusiones', 'Exclusions'), C.exclusions)}${cond(L('Notas', 'Notes'), C.notes)}</div><div class="tot">${totals}</div></div>
<div class="sigs">${m.signatures.map(s => `<div><div class="ro">${e(s.role)}</div><div class="st${s.signed ? ' ok' : ''}">${s.signed ? L('Firmado electrónicamente', 'Signed electronically') : L('Pendiente', 'Pending')}</div><div class="who">${e(s.name || '—')}</div><div class="pos">${e(s.position || '')}</div></div>`).join('')}</div>
<div class="foot">${[i.email, i.phone].filter(Boolean).length ? `• ${e([i.email, i.phone].filter(Boolean).join(' · '))} •<br>` : ''}${L('Esta cotización no constituye una factura. Precios y disponibilidad sujetos a la vigencia indicada.', 'This quotation is not an invoice. Prices and availability subject to the indicated validity.')}</div></div>`;
  const html = `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${e(m.folio || L('Cotización', 'Quotation'))} · Rev. ${e(m.revision)}</title><style>@page{size:letter;margin:10mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#fff}${css}</style></head><body>${body}</body></html>`;
  return { css, body, html };
}
