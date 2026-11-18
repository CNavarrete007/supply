// Órdenes de Compra · tarjeta 4 "Modificaciones / Enmiendas" · lógica pura (sin red).
// Una familia = la serie de una OC (Rev. 0, Rev. 1…); se muestra su versión vigente con el monto original (Rev. 0), el
// vigente, la recepción y si tiene factura vigente. SOLICITAR MODIFICACIÓN y MODIFICAR OC aplican las mismas reglas de la
// Matriz (requestBlock / modifyBlock) y no escriben: crear una Rev. N es una escritura comercial bloqueada.
import { money, progressOf } from './model.mjs';

/** "2,600.00 USD" (design tiles: no $ sign so the amount fits; currencies never mixed). */
const amount = (v, cur) => (v === null || v === undefined || v === '' ? '—' : `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0)} ${String(cur ?? '').trim()}`.trim());
import { poState, revLabel, requestBlock, modifyBlock } from './poMatrix.mjs';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RECONCILED = ['reconciled', 'ok', 'not_required'];

/** Filters of the design ("Todos los estados", Cambio pendiente, Con enmienda, Conciliación requerida, Cancelada). */
export const AMEND_FILTERS = [['all', 'Todos los estados', 'All states'], ['pending', 'Cambio pendiente', 'Pending change'], ['amended', 'Con enmienda', 'Amended'],
  ['reconciliation', 'Conciliación requerida', 'Reconciliation required'], ['cancelled', 'Cancelada', 'Cancelled']];

/** Current version of each PO series → family card. */
export function familyRow(po, en = false) {
  const m = (es, e) => (en ? e : es);
  const st = poState(po, en);
  const pr = progressOf(po);
  const flags = {
    pending: !!po.change_pending || !!clean(po.mod_pending),
    amended: (Number(po.versions) || 1) > 1,
    reconciliation: !!clean(po.reconciliation_status) && !RECONCILED.includes(clean(po.reconciliation_status)),
    cancelled: st.key === 'cancelled',
  };
  const tone = st.key === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' : st.key === 'superseded' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  return {
    po, id: po.id, folio: po.folio, supplier: clean(po.supplier_name),
    reference: clean(po.requisitions) || clean(po.order_reference) || '—',
    cr: clean(po.change_request_folio) ? `CR ${clean(po.change_request_folio)}` : m('Sin CR vinculado', 'No linked CR'),
    badge: `${revLabel(po)} · ${st.text}`, tone, state: st,
    original: amount(po.original_total_amount ?? po.total_amount, po.original_currency || po.currency),
    current: amount(po.total_amount, po.currency),
    reception: pr.pct === null ? '—' : `${Math.round(pr.pct)}%`,
    invoice: (Number(po.active_invoice_count) || 0) > 0 ? m('Sí', 'Yes') : 'No',
    flags,
    canRequest: !requestBlock(po, en), canModify: !modifyBlock(po, en),
    modPending: clean(po.mod_pending), modApproved: clean(po.mod_approved),
  };
}

/** KPI cards: families, with revision/amendment, pending changes, reconciliation required. */
export function amendKpis(rows = []) {
  return { families: rows.length, amended: rows.filter(r => r.flags.amended).length, pending: rows.filter(r => r.flags.pending).length, reconciliation: rows.filter(r => r.flags.reconciliation).length };
}

/** Search (OC, proveedor, requisición, CR o estatus — accent-insensitive) and state filter. */
export function filterFamilies(rows = [], q = '', filter = 'all') {
  const t = fold(q);
  return rows.filter(r => (filter === 'all' || r.flags[filter])
    && (!t || [r.folio, r.supplier, r.reference, r.po.order_reference, r.cr, r.state.text, r.badge, r.modPending, r.modApproved].some(v => fold(v).includes(t))));
}

/** History line of a version (detail.versions). */
export function versionLine(v, en = false) {
  const m = (es, e) => (en ? e : es);
  const status = clean(v.legacy_status) || clean(v.operational_status) || '—';
  const amend = [clean(v.amendment_type), clean(v.amendment_reason)].filter(Boolean).join(': ');
  return { id: v.id, title: `${revLabel(v)} · ${clean(v.order_date).slice(0, 10) || '—'}`, amount: money(v.total_amount, v.currency, en), status,
    amend: amend || (Number(v.version_number) > 1 ? m('Enmienda sin motivo registrado', 'Amendment without recorded reason') : m('Versión original', 'Original version')) };
}

/** "Mostrando 1–12 de 13 familias". */
export function familyRange(page, size, total, en = false) {
  if (!total) return en ? 'No families' : 'Sin familias';
  const a = (page - 1) * size + 1; const b = Math.min(total, page * size);
  return en ? `Showing ${a}–${b} of ${total} families` : `Mostrando ${a}–${b} de ${total} familias`;
}
