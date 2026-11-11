// Órdenes de Compra · lógica pura (sin red). Solo lectura: emitir, autorizar, modificar o eliminar OC sigue bloqueado.
import { money, escapeHtml } from '../generalMatrix/model.mjs';

export { money };
const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const OP = {
  draft: ['Borrador', 'Draft'], issued: ['Emitida', 'Issued'], sent: ['Enviada', 'Sent'], approved: ['Aprobada', 'Approved'], pending: ['Pendiente', 'Pending'],
  partially_received: ['Recibida parcial', 'Partially received'], received: ['Recibida', 'Received'], closed: ['Cerrada', 'Closed'],
  cancelled: ['Cancelada', 'Cancelled'], superseded: ['Sustituida', 'Superseded'], rejected: ['Rechazada', 'Rejected'],
};
export const opLabel = (code, en = false) => (code ? OP[code]?.[en ? 1 : 0] ?? String(code) : '—');
export const statusTone = code => {
  const k = fold(code);
  if (/cancel|sustitu|supersed|rechaz|reject/.test(k)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (/pend|draft|borrador/.test(k)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (/receiv|recib|closed|cerrad/.test(k)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Delivery progress from the linked receipts (legacy header percentage when present). */
export function progressOf(po) {
  const pct = num(po?.received_percent);
  if (pct !== null) return { pct: Math.max(0, Math.min(100, pct)), known: true };
  return { pct: po?.receipt_count > 0 ? null : 0, known: !(po?.receipt_count > 0) };
}

export function buyerCards(summary = {}) {
  const buyers = summary.buyers || [];
  const total = summary.counters?.total || 0;
  const without = summary.counters?.without_buyer || 0;
  return { all: { id: 'all', count: total }, items: buyers, none: { id: 'none', count: without } };
}

/** Awarded winners grouped by requisition, with the PO-issuance metrics of the original design. */
export function issuanceGroups(data = {}) {
  const map = new Map();
  for (const r of data.items || []) {
    const g = map.get(r.requisition_id) || { id: r.requisition_id, folio: r.folio, client: r.client_name, decision: r.client_decision, suppliers: [] };
    g.suppliers.push({ id: r.supplier_id, name: r.supplier_name, items: Number(r.items) || 0, amount: r.awarded_amount, currencies: r.currencies, existing: r.existing_pos || '' });
    map.set(r.requisition_id, g);
  }
  const groups = [...map.values()];
  const all = groups.flatMap(g => g.suppliers);
  return {
    groups,
    metrics: { awardedItems: all.reduce((n, s) => n + s.items, 0), winningSuppliers: new Set(all.map(s => s.id)).size, toGenerate: all.filter(s => !s.existing).length, losingQuotes: Number(data.losing_quotes) || 0 },
  };
}

/** Families (series) with more than one version, from the list items (current versions carry `versions`). */
export const amendedFamilies = (items = []) => items.filter(po => (po.versions || 0) > 1 || po.change_pending);

/** Formal printable PO ("Formato de Orden de Compra"). Every value is escaped. */
export function poPrintHtml(d, en = false) {
  const po = d?.item || {};
  const L = (es, e) => (en ? e : es);
  const rows = (d?.items || []).map(i => `<tr><td>${escapeHtml(i.line_number)}</td><td>${escapeHtml(i.description)}</td><td>${escapeHtml(i.category || '')}</td><td style="text-align:right">${escapeHtml(Number(i.quantity))}</td><td>${escapeHtml(i.unit_label)}</td><td style="text-align:right">${escapeHtml(money(i.unit_price, po.currency, en))}</td><td style="text-align:right">${escapeHtml(money(i.line_subtotal, po.currency, en))}</td></tr>`).join('');
  const sig = (label, name) => `<div class="sig"><div class="line"></div><strong>${escapeHtml(name || '—')}</strong><span>${escapeHtml(label)}</span></div>`;
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${escapeHtml(po.folio)}</title><style>
@page { size: letter; margin: 1.2cm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { font-family: Arial, sans-serif; font-size: 10px; color: #0f172a; }
.banner { background: linear-gradient(to right,#2563eb,#7c3aed); color:#fff; padding:14px 18px; border-radius:10px; display:flex; justify-content:space-between; } .banner h1 { margin:0; font-size:18px; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0; } .box { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; } .box h3 { margin:0 0 4px; font-size:9px; text-transform:uppercase; color:#64748b; }
table { width:100%; border-collapse:collapse; margin-top:8px; } th { background:#f8fafc; text-transform:uppercase; font-size:8px; text-align:left; border-bottom:2px solid #cbd5e1; padding:6px; } td { border-bottom:1px solid #e2e8f0; padding:6px; vertical-align:top; }
.tot { margin-left:auto; width:40%; margin-top:8px; } .tot div { display:flex; justify-content:space-between; padding:3px 0; } .tot .g { font-weight:bold; font-size:12px; border-top:2px solid #0f172a; }
.sigs { display:flex; gap:20px; margin-top:40px; } .sig { flex:1; text-align:center; display:flex; flex-direction:column; gap:2px; } .sig .line { border-top:1px solid #0f172a; margin-bottom:4px; } .sig span { color:#64748b; font-size:9px; }
.note { color:#64748b; font-size:8px; margin-top:16px; }
</style></head><body>
<div class="banner"><div><h1>${L('Orden de Compra', 'Purchase Order')} ${escapeHtml(po.folio)}${po.version_number > 1 ? ` · Rev. ${escapeHtml(po.version_number)}` : ''}</h1><div>Grupo Gerez · ${L('Compras', 'Purchasing')}</div></div><div style="text-align:right">${L('Fecha', 'Date')}: <strong>${escapeHtml(po.order_date || '—')}</strong><br>${L('Compromiso', 'Commitment')}: ${escapeHtml(po.commitment_date || '—')}</div></div>
<div class="grid"><div class="box"><h3>${L('Proveedor', 'Supplier')}</h3><strong>${escapeHtml(po.supplier_name)}</strong><br>${escapeHtml(po.supplier_code || '')} · RFC ${escapeHtml(po.supplier_tax_id || '—')}</div>
<div class="box"><h3>${L('Referencias', 'References')}</h3>${L('Requisición', 'Requisition')}: ${escapeHtml(po.requisitions || '—')}<br>${L('Cliente', 'Client')}: ${escapeHtml(po.clients || '—')}<br>${L('Ref. interna', 'Internal ref.')}: ${escapeHtml(po.internal_reference || '—')}</div>
<div class="box"><h3>${L('Entrega', 'Delivery')}</h3>${escapeHtml(po.delivery_place || '—')}${po.incoterm_code ? ` · ${escapeHtml(po.incoterm_code)}` : ''}</div>
<div class="box"><h3>${L('Pago y facturación', 'Payment and invoicing')}</h3>${escapeHtml(po.payment_method_label || '—')} · ${escapeHtml(po.payment_form_label || '—')} · CFDI ${escapeHtml(po.cfdi_use_label || '—')}</div></div>
<table><thead><tr><th>#</th><th>${L('Descripción', 'Description')}</th><th>${L('Categoría', 'Category')}</th><th>${L('Cantidad', 'Qty')}</th><th>${L('Unidad', 'Unit')}</th><th>${L('Precio unitario', 'Unit price')}</th><th>${L('Importe', 'Amount')}</th></tr></thead><tbody>${rows || `<tr><td colspan="7">${L('Sin partidas registradas.', 'No line items recorded.')}</td></tr>`}</tbody></table>
<div class="tot"><div><span>Subtotal</span><span>${escapeHtml(money(po.subtotal_amount, po.currency, en))}</span></div><div><span>${L('Impuestos', 'Taxes')}</span><span>${escapeHtml(money(po.tax_amount, po.currency, en))}</span></div><div class="g"><span>Total</span><span>${escapeHtml(money(po.total_amount, po.currency, en))}</span></div></div>
${po.terms_text ? `<div class="box" style="margin-top:10px"><h3>${L('Condiciones', 'Terms')}</h3>${escapeHtml(po.terms_text)}</div>` : ''}
<div class="sigs">${sig(L('Comprador', 'Buyer'), po.buyer_name)}${sig(L('Preparó / Revisó', 'Prepared / Reviewed'), po.preparer_name)}${sig(L('Autorizó', 'Authorized'), po.authorizer_name)}</div>
<p class="note">${L('Vista generada desde MariaDB (solo lectura). Las firmas indican responsables registrados; no sustituyen la firma electrónica ni la aceptación del proveedor.', 'View generated from MariaDB (read-only). Signatures show recorded people; they do not replace electronic signature or supplier acceptance.')}</p>
</body></html>`;
}
