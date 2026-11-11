// Recepción y Entrega · lógica pura (sin red). Solo lectura: registrar recepciones, entregas, firmas o fotografías sigue
// bloqueado hasta su validación integral.
import { escapeHtml } from '../generalMatrix/model.mjs';

const LABELS = {
  received: ['Recibida', 'Received'], pending: ['Pendiente', 'Pending'], accepted: ['Aceptada', 'Accepted'], rejected: ['Rechazada', 'Rejected'],
  partial: ['Parcial', 'Partial'], complete: ['Completa', 'Complete'], signed: ['Firmada', 'Signed'], draft: ['Borrador', 'Draft'],
  cancelled: ['Cancelada', 'Cancelled'], verified: ['Verificada', 'Verified'], unverified: ['Sin verificar', 'Unverified'],
  line_items: ['Por partida', 'Per line item'], legacy_header_only: ['Histórico (encabezado)', 'Historical (header)'],
  client_receiver: ['Recibe (cliente)', 'Receiver (client)'], deliveryPhoto: ['Fotografía de entrega', 'Delivery photo'],
};
export const label = (code, en = false) => (code === null || code === undefined || code === '' ? '—' : LABELS[code]?.[en ? 1 : 0] ?? String(code));
const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const isAccepted = v => /^(accepted|aceptad)/.test(fold(v));
export const tone = code => {
  const k = fold(code);
  if (/^(accepted|aceptad|complete|completa|conforme|signed|firmad|verified|received)/.test(k)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (/reject|rechaz|no conforme|cancel|incomplet|no recibid/.test(k)) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (/pend|partial|parcial|observ|draft|borrador/.test(k)) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};
const REASONS = { partial: ['Recepción parcial', 'Partial receipt'], rejected: ['Piezas rechazadas', 'Rejected units'], quality: ['Calidad con observaciones', 'Quality findings'], documentation: ['Documentación incompleta', 'Incomplete documents'], progress_unknown: ['Avance sin registrar', 'Progress not recorded'] };
export const reasonLabel = (code, en = false) => REASONS[code]?.[en ? 1 : 0] ?? String(code);
export const pct = v => (v === null || v === undefined ? '—' : `${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`);
export const qty = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('es-MX', { maximumFractionDigits: 4 }));
export const shortHash = h => (h ? `SHA-256 ${String(h).slice(0, 12)}…` : null);
export const bytes = n => (n === null || n === undefined ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Closing traffic light cards in design order with their color bars. */
export const closureCards = (c = {}, en = false) => [
  ['po_without_receipt', en ? 'POs without receipt' : 'OC sin recepción', 'bg-amber-500'],
  ['receipts_pending', en ? 'Receipts with pending items' : 'Recepciones con pendientes', 'bg-rose-500'],
  ['deliveries_missing', en ? 'Unrecorded deliveries' : 'Entregas no registradas', 'bg-purple-600'],
  ['acceptance_pending', en ? 'Pending acceptances' : 'Aceptaciones pendientes', 'bg-orange-500'],
  ['ready_to_invoice', en ? 'Ready to invoice' : 'Listos para facturar', 'bg-emerald-500'],
].map(([key, title, bar]) => ({ key, title, bar, count: Number(c[key] ?? 0) }));

/** Client delivery acknowledgment (acuse). Every value is escaped; evidence files are listed by name only. */
export function deliveryHtml(d, en = false) {
  const v = d?.item || {};
  const L = (es, e) => (en ? e : es);
  const rows = (d?.items || []).map(i => `<tr><td>${escapeHtml(i.line_number)}</td><td>${escapeHtml(i.requisition)}</td><td>${escapeHtml(i.description)}</td><td style="text-align:right">${escapeHtml(qty(i.delivered))}</td><td>${escapeHtml(i.unit_label)}</td><td style="text-align:right">${escapeHtml(qty(i.requested))}</td><td style="text-align:right">${escapeHtml(qty(i.balance))}</td></tr>`).join('');
  const src = (d?.sources || []).map(s => `${escapeHtml(s.po_folio)}${s.receipt_folio ? ` / ${escapeHtml(s.receipt_folio)}` : ''}`).join(' · ');
  const sig = (d?.signatures || []).map(s => `<div class="sig">${escapeHtml(s.signer || '—')}<br><small>${escapeHtml(label(s.role, en))} · ${escapeHtml(s.method)} · ${escapeHtml(String(s.signed_at || '').slice(0, 16))}</small>${s.document_sha256 ? `<br><small class="mono">${escapeHtml(shortHash(s.document_sha256))}</small>` : ''}</div>`).join('');
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${escapeHtml(v.folio)}</title><style>
@page { size: letter; margin: 1.2cm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } body { font-family: Arial, sans-serif; font-size: 10px; color: #0f172a; }
.banner { background: linear-gradient(to right,#2563eb,#7c3aed); color:#fff; padding:14px 18px; border-radius:10px; display:flex; justify-content:space-between; } .banner h1 { margin:0; font-size:18px; }
.box { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-top:10px; } table { width:100%; border-collapse:collapse; margin-top:10px; } th { background:#f8fafc; text-transform:uppercase; font-size:8px; text-align:left; border-bottom:2px solid #cbd5e1; padding:6px; } td { border-bottom:1px solid #e2e8f0; padding:6px; vertical-align:top; }
.sigs { display:flex; gap:20px; margin-top:36px; } .sig { flex:1; text-align:center; border-top:1px solid #0f172a; padding-top:4px; } .mono { font-family: monospace; color:#64748b; } .note { color:#64748b; font-size:8px; margin-top:16px; }
</style></head><body>
<div class="banner"><div><h1>${L('Acuse de entrega', 'Delivery acknowledgment')} ${escapeHtml(v.folio)}</h1><div>Grupo Gerez · ${escapeHtml(v.client_name)}</div></div><div style="text-align:right">${L('Fecha', 'Date')}: <strong>${escapeHtml(v.date || '—')}</strong><br>${L('Aceptación', 'Acceptance')}: ${escapeHtml(label(v.acceptance_status, en))}</div></div>
<div class="box">${L('Lugar de entrega', 'Delivery place')}: <strong>${escapeHtml(v.delivery_place || '—')}</strong> · ${L('Control', 'Control')}: ${escapeHtml(v.control_reference || '—')} · ${L('Origen (OC / recepción)', 'Source (PO / receipt)')}: ${src || '—'}</div>
<table><thead><tr><th>#</th><th>${L('Requisición', 'Requisition')}</th><th>${L('Descripción', 'Description')}</th><th>${L('Entregado', 'Delivered')}</th><th>${L('Unidad', 'Unit')}</th><th>${L('Solicitado', 'Requested')}</th><th>${L('Saldo', 'Balance')}</th></tr></thead><tbody>${rows || `<tr><td colspan="7">${L('Sin partidas registradas.', 'No line items recorded.')}</td></tr>`}</tbody></table>
${v.evidence_text || v.notes ? `<div class="box">${v.evidence_text ? `<div><strong>${L('Evidencia', 'Evidence')}:</strong> ${escapeHtml(v.evidence_text)}</div>` : ''}${v.notes ? `<div><strong>${L('Observaciones', 'Notes')}:</strong> ${escapeHtml(v.notes)}</div>` : ''}</div>` : ''}
<div class="sigs"><div class="sig">${escapeHtml(v.delivered_by || '—')}<br><small>${L('Entregó', 'Delivered by')}</small></div><div class="sig">${escapeHtml(v.received_by || '—')}<br><small>${L('Recibió', 'Received by')}</small></div></div>
${sig ? `<div class="sigs">${sig}</div>` : ''}
<p class="note">${L('Vista generada desde MariaDB (solo lectura).', 'View generated from MariaDB (read-only).')} ${v.locked ? L('Registro firmado y bloqueado.', 'Signed and locked record.') : L('Registro sin bloqueo de firma.', 'Record not signature-locked.')}</p>
</body></html>`;
}
