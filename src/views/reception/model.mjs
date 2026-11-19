// Recepción y Entrega · lógica pura (sin red). Solo lectura: registrar recepciones, entregas, firmas o fotografías sigue
// bloqueado hasta su validación integral.

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
