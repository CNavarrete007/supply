// Cotizaciones y Comparativo · lógica pura (sin red). Solo lectura: enviar RFQ, capturar cotizaciones, adjudicar o
// registrar decisiones sigue bloqueado (escrituras comerciales).
import { money, escapeHtml } from '../generalMatrix/model.mjs';

export { money };
const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const LABELS = {
  draft: ['Borrador', 'Draft'], sent: ['Enviada', 'Sent'], received: ['Recibida', 'Received'], issued: ['Emitida', 'Issued'], pending: ['Pendiente', 'Pending'],
  approved: ['Aprobada', 'Approved'], rejected: ['Rechazada', 'Rejected'], change_requested: ['Cambios solicitados', 'Changes requested'], superseded: ['Sustituida', 'Superseded'],
  awarded: ['Adjudicada', 'Awarded'], selected: ['Seleccionada', 'Selected'], preselected: ['Preseleccionada', 'Preselected'], cancelled: ['Cancelada', 'Cancelled'], expired: ['Vencida', 'Expired'],
  active: ['Vigente', 'Current'], closed: ['Cerrada', 'Closed'],
};
export const label = (code, en = false) => (code ? LABELS[code]?.[en ? 1 : 0] ?? String(code) : '—');
export const tone = code => {
  const k = fold(code);
  if (/reject|rechaz|cancel|expired|vencid/.test(k)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (/pend|draft|borrador|change|cambio|sent|envi/.test(k)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (/approv|aprob|award|adjud|select|active|vigent/.test(k)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (/supersed|sustitu/.test(k)) return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Comparison per line: best = lowest unit price among OFFERED items in the line's majority currency
 * (prices in different currencies are never compared). Returns lines with `best` quote id and `mixed` flag.
 */
export function comparisonView(lines = []) {
  return lines.map(l => {
    const offered = (l.offers || []).filter(o => o.offered && num(o.unit_price) !== null);
    const byCur = new Map(); for (const o of offered) byCur.set(o.currency, (byCur.get(o.currency) || 0) + 1);
    const cur = [...byCur.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const same = offered.filter(o => o.currency === cur);
    const best = same.reduce((m, o) => (!m || num(o.unit_price) < num(m.unit_price) ? o : m), null);
    return { ...l, best: best?.quote_id || null, currency: cur, mixed: byCur.size > 1, offers: l.offers || [] };
  });
}

/** Version history grouped by series (customer quotes), newest series first. */
export function seriesGroups(items = []) {
  const m = new Map();
  for (const v of items) { const k = v.series || v.folio; const g = m.get(k) || { series: k, client: v.client_name, requisition: v.requisition, versions: [] }; g.versions.push(v); m.set(k, g); }
  return [...m.values()].map(g => ({ ...g, versions: g.versions.sort((a, b) => Number(a.version_number) - Number(b.version_number)) })).sort((a, b) => String(b.versions.at(-1)?.quote_date || '').localeCompare(String(a.versions.at(-1)?.quote_date || '')));
}

/** RFQ deadline status: answered | overdue | open. */
export const rfqState = (r, today = new Date().toISOString().slice(0, 10)) => (r.responded ? 'answered' : r.deadline && String(r.deadline).slice(0, 10) < today ? 'overdue' : 'open');

/** Client-facing quotation (no internal costs). Every value is escaped. */
export function customerQuoteHtml(d, en = false) {
  const v = d?.item || {};
  const L = (es, e) => (en ? e : es);
  const rows = (d?.items || []).map(i => `<tr><td>${escapeHtml(i.line_number)}</td><td>${escapeHtml(i.description)}${i.brand_model ? `<br><small>${escapeHtml(i.brand_model)}</small>` : ''}</td><td style="text-align:right">${escapeHtml(Number(i.quantity))}</td><td>${escapeHtml(i.unit_label)}</td><td style="text-align:right">${escapeHtml(money(i.unit_price, v.currency, en))}</td><td style="text-align:right">${escapeHtml(money(i.line_subtotal, v.currency, en))}</td></tr>`).join('');
  const cond = [[L('Lugar de entrega', 'Delivery place'), v.delivery_place], [L('Tiempo de entrega', 'Lead time'), v.lead_time_text], [L('Condiciones de pago', 'Payment terms'), v.payment_terms], [L('Garantía', 'Warranty'), v.warranty_text], [L('Incluye', 'Includes'), v.inclusions_text], [L('No incluye', 'Excludes'), v.exclusions_text]]
    .filter(([, x]) => x).map(([k, x]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(x)}</div>`).join('');
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${escapeHtml(v.folio)}</title><style>
@page { size: letter; margin: 1.2cm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { font-family: Arial, sans-serif; font-size: 10px; color: #0f172a; }
.banner { background: linear-gradient(to right,#2563eb,#7c3aed); color:#fff; padding:14px 18px; border-radius:10px; display:flex; justify-content:space-between; } .banner h1 { margin:0; font-size:18px; }
.box { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-top:10px; } table { width:100%; border-collapse:collapse; margin-top:10px; } th { background:#f8fafc; text-transform:uppercase; font-size:8px; text-align:left; border-bottom:2px solid #cbd5e1; padding:6px; } td { border-bottom:1px solid #e2e8f0; padding:6px; vertical-align:top; }
.tot { margin-left:auto; width:40%; margin-top:8px; } .tot div { display:flex; justify-content:space-between; padding:3px 0; } .tot .g { font-weight:bold; font-size:12px; border-top:2px solid #0f172a; }
.sigs { display:flex; gap:20px; margin-top:36px; } .sig { flex:1; text-align:center; border-top:1px solid #0f172a; padding-top:4px; } .note { color:#64748b; font-size:8px; margin-top:16px; }
</style></head><body>
<div class="banner"><div><h1>${L('Cotización', 'Quotation')} ${escapeHtml(v.folio)}${Number(v.version_number) > 1 ? ` · Rev. ${escapeHtml(Number(v.version_number) - 1)}` : ''}</h1><div>Grupo Gerez · ${escapeHtml(v.client_name)}</div></div><div style="text-align:right">${L('Fecha', 'Date')}: <strong>${escapeHtml(v.quote_date || '—')}</strong><br>${L('Vigencia', 'Valid until')}: ${escapeHtml(v.valid_until || '—')}</div></div>
<div class="box">${L('Cliente', 'Client')}: <strong>${escapeHtml(v.client_name)}</strong> · RFC ${escapeHtml(v.client_tax_id || '—')} · ${L('Requisición', 'Requisition')}: ${escapeHtml(v.requisition || '—')}</div>
<table><thead><tr><th>#</th><th>${L('Descripción', 'Description')}</th><th>${L('Cantidad', 'Qty')}</th><th>${L('Unidad', 'Unit')}</th><th>${L('Precio unitario', 'Unit price')}</th><th>${L('Importe', 'Amount')}</th></tr></thead><tbody>${rows || `<tr><td colspan="6">${L('Sin partidas registradas.', 'No line items recorded.')}</td></tr>`}</tbody></table>
<div class="tot"><div><span>Subtotal</span><span>${escapeHtml(money(v.subtotal_amount, v.currency, en))}</span></div>${num(v.discount_amount) ? `<div><span>${L('Descuento', 'Discount')}</span><span>-${escapeHtml(money(v.discount_amount, v.currency, en))}</span></div>` : ''}<div><span>${L('Impuestos', 'Taxes')}</span><span>${escapeHtml(money(v.tax_amount, v.currency, en))}</span></div>${v.service_fee_enabled ? `<div><span>Service Fee</span><span>${escapeHtml(money(v.service_fee_total_amount, v.currency, en))}</span></div>` : ''}<div class="g"><span>Total</span><span>${escapeHtml(money(v.total_amount, v.currency, en))}</span></div></div>
${cond ? `<div class="box">${cond}</div>` : ''}
<div class="sigs"><div class="sig">${escapeHtml(v.prepared_by || '—')}<br><small>${L('Elaboró', 'Prepared')}</small></div><div class="sig">${escapeHtml(v.reviewed_by || '—')}<br><small>${L('Revisó', 'Reviewed')}</small></div><div class="sig">${escapeHtml(v.approved_by || '—')}<br><small>${L('Autorizó', 'Authorized')}</small></div></div>
<p class="note">${L('Vista generada desde MariaDB (solo lectura). No incluye costos internos del proveedor.', 'View generated from MariaDB (read-only). Internal supplier costs are not included.')}</p>
</body></html>`;
}

// ---- Revisiones / modificaciones (familias de cotización al cliente: Rev. 0 → Rev. N) ----
const REV_LABELS_EN = {
  aprobada: 'Approved', borrador: 'Draft', sustituida: 'Superseded', rechazada: 'Rejected', 'cambios solicitados': 'Changes requested',
  'autorizada internamente': 'Internally authorized', 'enviada al cliente': 'Sent to client', 'revisada al cliente': 'Reviewed with client', cancelada: 'Cancelled',
};
/** Status label of the current revision (server label: original imported text or derived from codes). */
export const revStatusLabel = (label, en = false) => (en ? REV_LABELS_EN[fold(label)] || String(label || '—') : String(label || '—'));
/** Pill colours of the original design (Aprobada green, Borrador blue, Revisada purple, Sustituida grey). */
export function revStatusTone(label) {
  const k = fold(label);
  if (/sustitu|supersed|cancel/.test(k)) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (/rechaz|reject/.test(k)) return 'bg-rose-100 text-rose-800 border-rose-200';
  if (/aprob|approv/.test(k)) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (/cambio|change/.test(k)) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (/revisad|enviad|sent|issued/.test(k)) return 'bg-purple-100 text-purple-800 border-purple-200';
  if (/autoriz/.test(k)) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  return 'bg-blue-100 text-blue-800 border-blue-200';
}
const CR_STATUS = { pending_review: ['Pendiente de revisión', 'Pending review'], applied: ['Aplicada', 'Applied'], rejected: ['Rechazada', 'Rejected'], withdrawn: ['Retirada', 'Withdrawn'] };
export const crStatusLabel = (code, en = false) => (code ? CR_STATUS[code]?.[en ? 1 : 0] ?? String(code) : '');
/** "requisición · CR-2026-001" or "requisición · Sin Change Request" (subtitle of each family card). */
export const familyReference = (f, en = false) => `${f.requisition || '—'} · ${f.change_request || (en ? 'No Change Request' : 'Sin Change Request')}`;
/** Plain amount for the stat boxes (currency shown below it, as in the design). */
export function plainAmount(v, en = false) {
  const n = num(v);
  return n === null ? '—' : n.toLocaleString(en ? 'en-US' : 'es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
