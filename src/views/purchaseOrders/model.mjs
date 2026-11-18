// Órdenes de Compra · lógica pura (sin red). Solo lectura: emitir, autorizar, modificar o eliminar OC sigue bloqueado.
import { money } from '../generalMatrix/model.mjs';

export { money };

/** Revision as in the Apps Script: Rev. 0 is the original order (imported revision number when present). */
export function revOf(po) {
  const legacy = po?.legacy_revision_number;
  if (legacy !== null && legacy !== undefined && legacy !== '' && Number.isFinite(Number(legacy))) return Number(legacy);
  return Math.max(0, (Number(po?.version_number) || 1) - 1);
}
export const revLabel = po => `Rev. ${revOf(po)}`;
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

