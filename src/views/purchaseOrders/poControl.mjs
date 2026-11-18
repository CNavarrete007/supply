// Órdenes de Compra · tarjeta 3 "Control de autorización" · lógica pura (sin red).
// Cuatro alertas del diseño con el conteo del servidor (resumen de la matriz) y, al desplegarlas, los documentos que las
// originan (GET /purchase-orders/issuance → alerts / items / requisitions). Solo consulta.
import { money, revLabel } from './model.mjs';

const clean = v => String(v ?? '').trim();
const n = v => Number(v) || 0;

/** Days a commitment date is overdue (today as YYYY-MM-DD); 0 when not overdue or missing. */
export function overdueDays(date, today) {
  if (!date || !today) return 0;
  const d = Math.round((Date.parse(`${String(today).slice(0, 10)}T00:00:00Z`) - Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`)) / 86400000);
  return d > 0 ? d : 0;
}

/** Awards still without an ACTIVE PO, one row per requisition × winning supplier, with the client approval of the requisition. */
export function pendingAwards(iss = {}) {
  const reqs = new Map((iss.requisitions || []).map(r => [r.id, r]));
  return (iss.items || []).filter(i => !clean(i.active_pos)).map(i => {
    const r = reqs.get(i.requisition_id) || {};
    return { key: `${i.requisition_id}:${i.supplier_id}`, requisitionId: i.requisition_id, requisition: i.folio, client: i.client_name, supplier: i.supplier_name, items: n(i.items),
      amount: i.awarded_amount, currencies: clean(i.currencies), approved: !!r.client_approved, cancelledPo: clean(i.existing_pos) };
  }).sort((a, b) => Number(b.approved) - Number(a.approved) || a.requisition.localeCompare(b.requisition));
}

/**
 * The four alerts in the design order. counters = list summary counters; iss = issuance payload (null while loading).
 * Each: { key, count, text, tone, rows, shown } — rows = documents behind the alert (null until loaded).
 */
export function controlAlerts(counters = {}, iss = null, en = false) {
  const m = (es, e) => (en ? e : es);
  const al = iss?.alerts || {};
  const pend = iss ? pendingAwards(iss) : null;
  return [
    { key: 'preselected', count: n(counters.preselected_quotes), text: m('cotizaciones preseleccionadas o adjudicadas.', 'preselected or awarded quotes.'), tone: 'emerald', rows: iss ? al.preselected_quotes || [] : null },
    { key: 'awards', count: n(counters.awards_without_po), text: m('adjudicaciones pendientes de OC.', 'awards pending PO.'), tone: 'amber', rows: pend },
    { key: 'auto', count: n(counters.auto_generated), text: m('órdenes generadas automáticamente con PDF.', 'orders automatically generated with PDF.'), tone: 'blue', rows: iss ? al.auto_generated || [] : null },
    { key: 'overdue', count: n(counters.overdue_without_receipt), text: m('órdenes vencidas sin recepción.', 'overdue orders without receipt.'), tone: 'rose', rows: iss ? al.overdue_without_receipt || [] : null },
  ].map(a => ({ ...a, shown: a.rows ? (a.key === 'awards' ? a.rows.reduce((s, r) => s + r.items, 0) : a.rows.length) : 0 }));
}

/** Note when the detail does not cover the whole count (lists are capped at 200 documents). */
export function partialNote(a, en = false) {
  if (!a.rows || a.shown >= a.count) return '';
  return en ? `Showing ${a.shown} of ${a.count}.` : `Se muestran ${a.shown} de ${a.count}.`;
}

/** One-line description of a PO in the alert detail. */
export const poLine = (po, en = false) => [`${po.folio} · ${revLabel(po)}`, po.supplier_name, clean(po.requisitions), money(po.total_amount, po.currency, en)].filter(Boolean).join(' · ');

/** Secondary checks shown under the alerts (only the ones that need attention). */
export function otherChecks(counters = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  return [[n(counters.without_buyer), m('OC sin comprador asignado', 'POs without buyer')], [n(counters.reconciliation_pending), m('OC con conciliación pendiente', 'POs pending reconciliation')],
    [n(counters.change_pending), m('OC con cambio pendiente', 'POs with pending change')]].filter(([c]) => c > 0).map(([count, text]) => ({ count, text }));
}
