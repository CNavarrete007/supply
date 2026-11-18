// Órdenes de Compra · tarjeta 2 "Matriz de órdenes" · lógica pura (sin red).
// Flujo del diseño: tarjetas por comprador → matriz paginada del comprador elegido. Editar, solicitar modificación,
// modificar y eliminar OC son escrituras comerciales sin endpoint: se validan (reglas y protecciones) y se informa que
// no se aplicaron. VER/DESCARGAR PDF generan el formato en el navegador con los datos reales de la OC.
import { money, revOf, revLabel } from './model.mjs';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const initials = name => {
  const w = clean(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase() || '··';
};

/** Status list of the design (order of the select). Codes = server `state` filter. */
export const PO_STATES = [
  ['issued', 'Emitida', 'Issued'], ['sent', 'Enviada al proveedor', 'Sent to supplier'], ['accepted', 'Aceptada', 'Accepted'],
  ['partially_received', 'Parcialmente recibida', 'Partially received'], ['cancelled', 'Cancelada', 'Cancelled'], ['draft', 'Borrador', 'Draft'],
  ['received', 'Recibida', 'Received'], ['superseded', 'Sustituida', 'Superseded'],
];
const TONES = { issued: 'bg-blue-50 text-blue-700 border-blue-200', sent: 'bg-sky-50 text-sky-700 border-sky-200', accepted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  partially_received: 'bg-amber-50 text-amber-800 border-amber-200', received: 'bg-emerald-50 text-emerald-700 border-emerald-200', cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  superseded: 'bg-slate-100 text-slate-600 border-slate-200', draft: 'bg-slate-50 text-slate-700 border-slate-200' };

/** Pill of a PO: label of its state key (server), or the original status text when it is not a known one. */
export function poState(po, en = false) {
  const k = po?.state_key || 'other';
  const s = PO_STATES.find(x => x[0] === k);
  return { key: k, text: s ? (en ? s[2] : s[1]) : clean(po?.legacy_status) || clean(po?.operational_status) || '—', tone: TONES[k] || 'bg-slate-50 text-slate-700 border-slate-200' };
}

export { revOf, revLabel };

/** Buyer cards: "Todas las órdenes de compra" + one per buyer (+ "Sin comprador" when it applies). */
export function buyerCardList(summary = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const buyers = summary.buyers || []; const c = summary.counters || {};
  const card = b => {
    const count = Number(b.count) || 0; const received = Number(b.received) || 0; const cur = b.money || [];
    return { ...b, tag: initials(b.name), sub: clean(b.email), count, received, pending: count - received, pct: count ? Math.round((received / count) * 100) : 0,
      meta: m(`${b.suppliers ?? 0} proveedores · ${b.requisitions ?? 0} requisiciones`, `${b.suppliers ?? 0} suppliers · ${b.requisitions ?? 0} requisitions`),
      amount: cur.length === 1 ? money(cur[0].amount, cur[0].currency, en) : cur.length > 1 ? m(`${cur.length} monedas`, `${cur.length} currencies`) : '—', isAll: false };
  };
  const total = Number(c.total) || 0; const rec = Number(c.received) || 0;
  const out = [{ id: 'all', name: m('Todas las órdenes de compra', 'All purchase orders'), sub: m(`${buyers.length} comprador${buyers.length === 1 ? '' : 'es'}`, `${buyers.length} buyer${buyers.length === 1 ? '' : 's'}`), tag: m('TOD', 'ALL'),
    count: total, received: rec, pending: total - rec, isAll: true }, ...buyers.map(card)];
  if (Number(c.without_buyer) > 0) out.push({ id: 'none', name: m('Sin comprador asignado', 'No buyer assigned'), sub: '', tag: '—', count: Number(c.without_buyer), received: null, pending: null, isAll: true, isNone: true });
  return out;
}

/** Search over buyer cards: name, email, phone or position (accent-insensitive). The overview cards always stay. */
export function filterBuyers(cards = [], q = '') {
  const t = fold(q);
  if (!t) return cards;
  return cards.filter(c => c.isAll || [c.name, c.email, c.phone, c.position].some(v => fold(v).includes(t)));
}

export const buyersBadge = (summary = {}, en = false) => {
  const n = (summary.buyers || []).length; const t = Number(summary.counters?.total) || 0;
  return en ? `${n} buyer${n === 1 ? '' : 's'} · ${t} POs` : `${n} comprador${n === 1 ? '' : 'es'} · ${t} OC`;
};

/** "Mostrando 1–13 de 13 órdenes de compra". */
export function rangeText(page, size, total, en = false) {
  if (!total) return en ? 'No purchase orders to show' : 'No hay órdenes de compra para mostrar';
  const a = (page - 1) * size + 1; const b = Math.min(total, page * size);
  return en ? `Showing ${a}–${b} of ${total} purchase orders` : `Mostrando ${a}–${b} de ${total} órdenes de compra`;
}

/** Selected buyer header line. */
export function buyerCaption(card, total, buyers, en = false) {
  if (!card) return '';
  if (card.isAll && !card.isNone) return en ? `${total} records from ${buyers} buyer${buyers === 1 ? '' : 's'}` : `${total} registros de ${buyers} comprador${buyers === 1 ? '' : 'es'}`;
  return [card.sub, en ? `${total} records` : `${total} registros`].filter(Boolean).join(' · ');
}

const closed = po => ['cancelled', 'superseded'].includes(po?.state_key);
const authorized = po => po?.approval_status === 'approved' || ['issued', 'sent', 'accepted', 'partially_received', 'received'].includes(po?.state_key);

/** EDITAR: only before authorization/issue; afterwards the change goes through SOLICITAR MODIFICACIÓN. Null = editable. */
export function editBlock(po, en = false) {
  const m = (es, e) => (en ? e : es);
  if (closed(po)) return m('La OC está cancelada o sustituida: no se edita.', 'The PO is cancelled or superseded: it cannot be edited.');
  if (authorized(po)) return m('La OC ya fue autorizada/emitida: para cambiarla usa SOLICITAR MODIFICACIÓN (requiere aprobación previa; después se habilita MODIFICAR OC y la Rev. N vuelve a revisión/autorización).', 'The PO was already authorized/issued: to change it use REQUEST CHANGE (prior approval required; then MODIFY PO is enabled and Rev. N goes back to review/authorization).');
  return null;
}

/** SOLICITAR MODIFICACIÓN: authorized PO without another request in progress. Null = allowed. */
export function requestBlock(po, en = false) {
  const m = (es, e) => (en ? e : es);
  if (closed(po)) return m('La OC está cancelada o sustituida: no admite modificaciones.', 'The PO is cancelled or superseded: it admits no changes.');
  if (clean(po?.mod_pending)) return m(`Ya existe una solicitud pendiente (${po.mod_pending}); espera su resolución.`, `A request is already pending (${po.mod_pending}); wait for its resolution.`);
  if (clean(po?.mod_approved)) return m(`La solicitud ${po.mod_approved} ya está aprobada: usa MODIFICAR OC.`, `Request ${po.mod_approved} is already approved: use MODIFY PO.`);
  if (!authorized(po)) return m('La OC aún no está autorizada: usa EDITAR.', 'The PO is not authorized yet: use EDIT.');
  return null;
}

/** MODIFICAR OC: only with an approved modification request. Null = allowed. */
export function modifyBlock(po, en = false) {
  const m = (es, e) => (en ? e : es);
  if (closed(po)) return m('La OC está cancelada o sustituida.', 'The PO is cancelled or superseded.');
  if (!clean(po?.mod_approved)) return m('Requiere una solicitud de modificación aprobada (SOLICITAR MODIFICACIÓN).', 'Requires an approved modification request (REQUEST CHANGE).');
  return null;
}

/** ELIMINAR: never with receipts, invoices, revision history or when already cancelled. Null = deletable after confirming. */
export function deleteBlock(po, en = false) {
  const m = (es, e) => (en ? e : es);
  if (closed(po)) return m('La OC ya está cancelada o sustituida: se conserva como historial.', 'The PO is already cancelled or superseded: it is kept as history.');
  const why = [Number(po?.receipt_count) > 0 && m(`${po.receipt_count} recepción(es)`, `${po.receipt_count} receipt(s)`), Number(po?.invoice_count) > 0 && m(`${po.invoice_count} factura(s)`, `${po.invoice_count} invoice(s)`),
    Number(po?.versions) > 1 && m(`${po.versions} versiones`, `${po.versions} versions`)].filter(Boolean);
  if (why.length) return m(`No se elimina: tiene ${why.join(', ')} que deben conservarse. Si ya no procede, solicita su cancelación con SOLICITAR MODIFICACIÓN.`, `Not deleted: it has ${why.join(', ')} that must be kept. If it no longer applies, request its cancellation with REQUEST CHANGE.`);
  return null;
}

export const folioConfirmed = (po, typed) => !!clean(po?.folio) && clean(typed).toUpperCase() === clean(po.folio).toUpperCase();

/** Change types of the design (first = default "Cantidad"). Codes are stable for a future write endpoint. */
export const REQUEST_TYPES = [['quantity', 'Cantidad', 'Quantity'], ['price', 'Precio', 'Price'], ['date', 'Fecha de entrega', 'Delivery date'],
  ['terms', 'Condiciones comerciales', 'Commercial terms'], ['items', 'Partidas (agregar o quitar)', 'Items (add or remove)'], ['cancel', 'Cancelación de la OC', 'PO cancellation'], ['other', 'Otro', 'Other']];
export const URGENCIES = [['normal', 'Normal', 'Normal'], ['alta', 'Alta', 'High'], ['urgente', 'Urgente', 'Urgent']];
export const IMPACTS = [['none', 'Sin impacto económico confirmado', 'No confirmed economic impact'], ['increase', 'Incrementa el monto de la OC', 'Increases the PO amount'],
  ['decrease', 'Reduce el monto de la OC', 'Reduces the PO amount'], ['schedule', 'Impacto en fechas de entrega', 'Impact on delivery dates'], ['review', 'Por evaluar', 'To be evaluated']];

/** New request form: design defaults (Cantidad, Normal, sin impacto) and the PO's current authorizer when eligible. */
export const emptyRequest = (approver = '') => ({ type: 'quantity', urgency: 'normal', approver, reference: '', impact: 'none', reason: '' });

/**
 * "Autoriza la modificación": active users with enabled access, never the requester (independent approval, as in R3B).
 * The PO's current authorizer goes first. Each option: { id, name, email, current }.
 */
export function approverOptions(users = [], me = null, po = null) {
  const cur = fold(po?.authorizer_name);
  return users.filter(u => u.status === 'active' && u.access_enabled && u.credential_state === 'local_validated' && u.id !== me?.public_id)
    .map(u => ({ id: u.id, name: u.name, email: u.email, current: !!cur && fold(u.name) === cur }))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
}

/** SOLICITAR MODIFICACIÓN form → { ok, errors, first }. ctx: approvers (options), me (requester). */
export function validateRequest(f = {}, { approvers = [], me = null } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  if (!REQUEST_TYPES.some(t => t[0] === f.type)) errors.type = m('Selecciona el tipo de modificación.', 'Select the change type.');
  if (!URGENCIES.some(t => t[0] === f.urgency)) errors.urgency = m('Selecciona la urgencia.', 'Select the urgency.');
  if (!f.approver) errors.approver = m('Selecciona quién autoriza la modificación.', 'Select who authorizes the change.');
  else if (me && f.approver === me.public_id) errors.approver = m('Quien solicita no puede autorizar su propia modificación.', 'The requester cannot authorize their own change.');
  else if (!approvers.some(a => a.id === f.approver)) errors.approver = m('El autorizador debe ser un usuario activo con acceso.', 'The approver must be an active user with access.');
  if (clean(f.reference).length > 255) errors.reference = m('Referencia: máximo 255 caracteres.', 'Reference: maximum 255 characters.');
  if (!IMPACTS.some(t => t[0] === f.impact)) errors.impact = m('Selecciona el impacto estimado.', 'Select the estimated impact.');
  const r = clean(f.reason);
  if (r.length < 10) errors.reason = m('Describe el motivo / justificación (mínimo 10 caracteres).', 'Describe the reason / justification (minimum 10 characters).');
  else if (r.length > 1000) errors.reason = m('Motivo: máximo 1000 caracteres.', 'Reason: maximum 1000 characters.');
  const k = Object.keys(errors);
  return { ok: !k.length, errors, first: k.length ? errors[k[0]] : '' };
}

/** Message after a valid request: nothing is recorded and the PO stays as it is. */
export function requestLockedText(po, f, approver, en = false) {
  const t = REQUEST_TYPES.find(x => x[0] === f.type); const label = t ? (en ? t[2] : t[1]) : f.type;
  return en
    ? `Data validated, but the change request for ${po.folio} (${label}, to be authorized by ${approver?.name || '—'}) was not recorded: it requires an authorized write endpoint. The PO was not modified.`
    : `Datos validados, pero no se registró la solicitud de modificación de ${po.folio} (${label}, autoriza ${approver?.name || '—'}): requiere un endpoint de escritura autorizado. La OC no se modificó.`;
}

/** EDITAR form (header data of a not yet authorized PO) → { ok, errors, first, changed }. */
export function validateEdit(f = {}, original = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (f.commitment && !iso.test(f.commitment)) errors.commitment = m('Fecha inválida.', 'Invalid date.');
  else if (f.commitment && original.order_date && f.commitment < String(original.order_date).slice(0, 10)) errors.commitment = m('El compromiso no puede ser anterior a la emisión.', 'The commitment cannot precede the issue date.');
  if (clean(f.place).length > 255) errors.place = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  if (clean(f.reference).length > 64) errors.reference = m('Máximo 64 caracteres.', 'Maximum 64 characters.');
  for (const k of ['terms', 'notes']) if (clean(f[k]).length > 2000) errors[k] = m('Máximo 2000 caracteres.', 'Maximum 2000 characters.');
  const L = { commitment: m('compromiso', 'commitment'), place: m('lugar de entrega', 'delivery place'), reference: m('referencia interna', 'internal reference'), terms: m('condiciones', 'terms'), notes: m('notas', 'notes') };
  const src = { commitment: clean(original.commitment_date).slice(0, 10), place: original.delivery_place, reference: original.internal_reference, terms: original.terms_text, notes: original.notes };
  const changed = Object.keys(L).filter(k => clean(f[k]) !== clean(src[k])).map(k => L[k]);
  if (!changed.length && !Object.keys(errors).length) errors.none = m('No hay cambios que guardar.', 'There are no changes to save.');
  const k = Object.keys(errors);
  return { ok: !k.length, errors, first: k.length ? errors[k[0]] : '', changed };
}

/** Initial EDITAR form from the PO detail. */
export const editForm = d => ({ commitment: clean(d?.commitment_date).slice(0, 10), place: d?.delivery_place || '', reference: d?.internal_reference || '', terms: d?.terms_text || '', notes: d?.notes || '' });
