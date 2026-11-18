// Órdenes de Compra · tarjeta 5 "Revisión y autorización" (Flujo de revisión y autorización) · lógica pura (sin red).
// Datos: GET /purchase-orders/tasks (responsable, relacionadas, historial, notificaciones y solicitudes de modificación).
// Autorizar, devolver, aprobar o rechazar solicitudes son escrituras comerciales sin endpoint: se validan (incluida la
// segregación de funciones) y se informa que no se registraron.
import { money } from './model.mjs';
import { poState, revLabel } from './poMatrix.mjs';

const clean = v => String(v ?? '').trim();
const CLOSED = ['cancelled', 'superseded'];

/** PO that still needs the actor's review/authorization (actor is the current responsible). */
export const pendingAction = po => !CLOSED.includes(po?.state_key) && !['approved', 'rejected'].includes(clean(po?.approval_status));
const isAuthorized = po => clean(po?.approval_status) === 'approved' || !!po?.authorized_on;
/** True while the PO is in the Preparó/Revisó step (responsible role reviewer/preparer, or no reviewer recorded yet). */
const reviewStep = po => { const role = clean(po?.current_responsible_role); return ['reviewer', 'preparer'].includes(role) || (role !== 'authorizer' && !clean(po?.preparer_name)); };

/** KPI cards of the design. */
export function reviewKpis(t = {}) {
  return { pendingMine: (t.my_tasks || t.responsible || []).filter(pendingAction).length, related: (t.related || []).length,
    authorized: (t.related || []).filter(isAuthorized).length, unread: Number(t.notifications_unread) || 0 };
}

/** "14/10/26, 9:08 a.m." (es-MX) from a UTC DATETIME; '' when missing. */
export function stamp(utc, en = false) {
  if (!utc) return '';
  const d = new Date(`${String(utc).replace(' ', 'T').replace(/(\.\d{3})\d*$/, '$1')}Z`);
  if (Number.isNaN(d.getTime())) return String(utc);
  return d.toLocaleString(en ? 'en-US' : 'es-MX', { day: '2-digit', month: '2-digit', year: '2-digit', hour: 'numeric', minute: '2-digit' });
}

/** Status pill of a PO in the flow: Autorizada / Pendiente de revisión / Pendiente de autorización / Cancelada… */
export function flowStatus(po, en = false) {
  const m = (es, e) => (en ? e : es);
  if (CLOSED.includes(po?.state_key)) { const s = poState(po, en); return { text: s.text, tone: 'bg-rose-50 text-rose-700 border-rose-200' }; }
  if (isAuthorized(po)) return { text: m('Autorizada', 'Authorized'), tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (reviewStep(po)) return { text: m('Pendiente de revisión', 'Pending review'), tone: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { text: m('Pendiente de autorización', 'Pending authorization'), tone: 'bg-amber-50 text-amber-800 border-amber-200' };
}

/** Card of a related / pending PO ("Enviadas por mí", "Mis tareas pendientes"). */
export function flowCard(po, en = false) {
  const m = (es, e) => (en ? e : es);
  const q = po.client_quote || null;
  return {
    id: po.id, folio: po.folio, rev: revLabel(po), status: flowStatus(po, en),
    subtitle: [clean(po.requisitions), clean(po.supplier_name).toUpperCase()].filter(Boolean).join(' · '),
    people: [[m('Comprador', 'Buyer'), po.buyer_name], [m('Preparó/Revisó', 'Prepared/Reviewed'), po.preparer_name], [m('Autorizó', 'Authorized'), po.authorizer_name]].map(([k, v]) => [k, clean(v).toUpperCase() || '—']),
    quote: q ? { id: q.id, title: m('Cotización aprobada por el cliente', 'Quote approved by the client'),
      line: `${q.folio} · Rev. ${q.revision} · ${m('Total cliente', 'Client total')}: ${money(q.total_amount, q.currency, en)}`,
      approved: `${m('Aprobada por Cliente', 'Approved by Client')} · ${q.approved_at ? stamp(q.approved_at, en) : '—'}` } : null,
    amount: money(po.total_amount, po.currency, en), updated: stamp(po.updated_at, en) || '—',
    readOnly: !pendingAction(po) || !po.me_responsible,
  };
}

const STATE_ES = { authorized: 'autorizada', approved: 'autorizada', pending_review: 'pendiente de revisión', pending_authorization: 'pendiente de autorización', rejected: 'rechazada', returned: 'devuelta', draft: 'borrador', cancelled: 'cancelada', issued: 'emitida', sent: 'enviada' };
const STATE_EN = { authorized: 'authorized', approved: 'authorized', pending_review: 'pending review', pending_authorization: 'pending authorization', rejected: 'rejected', returned: 'returned', draft: 'draft', cancelled: 'cancelled', issued: 'issued', sent: 'sent' };

/** Timeline entry of "Historial": original text of the event when recorded, else "{folio} {estado}". */
export function historyRow(h, en = false) {
  const state = (en ? STATE_EN : STATE_ES)[clean(h.to_state)] || clean(h.to_state) || clean(h.action_code);
  const text = clean(h.legacy_action_text) || `${h.folio} ${state}`.trim();
  return { when: stamp(h.occurred_at, en) || '—', title: `${h.folio} · ${text}`, actor: clean(h.actor_name).toUpperCase() || '—', comment: clean(h.comment_text) };
}

/** Decision on a PO task (authorize / return): segregation of duties and reason. { ok, error }. */
export function validateTaskDecision(po, decision, comment, en = false) {
  const m = (es, e) => (en ? e : es);
  if (!po?.me_responsible || !pendingAction(po)) return { ok: false, error: m('Esta OC no tiene una tarea pendiente para ti.', 'This PO has no pending task for you.') };
  if (decision === 'authorize' && (po.me_buyer || (po.me_preparer && !reviewStep(po)))) return { ok: false, error: reviewStep(po) ? m('Segregación de funciones: quien compró la OC no puede revisarla.', 'Segregation of duties: whoever bought the PO cannot review it.') : m('Segregación de funciones: quien compró o preparó la OC no puede autorizarla.', 'Segregation of duties: whoever bought or prepared the PO cannot authorize it.') };
  if (decision === 'return' && clean(comment).length < 10) return { ok: false, error: m('Para devolver la OC describe el motivo (mínimo 10 caracteres).', 'To return the PO describe the reason (minimum 10 characters).') };
  if (clean(comment).length > 1000) return { ok: false, error: m('Máximo 1000 caracteres.', 'Maximum 1000 characters.') };
  return { ok: true, error: '' };
}

// ---------- Solicitudes de modificación ----------
export const MOD_FILTERS = [['mine', 'Pendientes para mí', 'Pending for me'], ['pending', 'Todas las pendientes', 'All pending'], ['approved', 'Aprobadas sin ejecutar', 'Approved not executed'],
  ['rejected', 'Rechazadas / devueltas', 'Rejected / returned'], ['all', 'Todo el historial', 'Full history']];

/** pending | approved (not executed) | executed | rejected | other. */
export function modKind(r) {
  const s = clean(r?.status).toLowerCase();
  if (r?.consumed_at || ['consumed', 'executed', 'ejecutada', 'consumida'].includes(s)) return 'executed';
  if (['pending', 'pendiente', 'submitted', 'resubmitted'].includes(s)) return 'pending';
  if (['approved', 'aprobada'].includes(s)) return 'approved';
  if (['rejected', 'returned', 'rechazada', 'devuelta', 'cancelled'].includes(s)) return 'rejected';
  return 'other';
}

export function modKpis(list = []) {
  return { pendingMine: list.filter(r => modKind(r) === 'pending' && r.assigned_to_me).length, pending: list.filter(r => modKind(r) === 'pending').length,
    approved: list.filter(r => modKind(r) === 'approved').length, executed: list.filter(r => modKind(r) === 'executed').length };
}

export function filterMods(list = [], f = 'mine') {
  if (f === 'all') return list;
  if (f === 'mine') return list.filter(r => modKind(r) === 'pending' && r.assigned_to_me);
  return list.filter(r => modKind(r) === f);
}

const KIND = { pending: ['Pendiente', 'Pending', 'bg-amber-50 text-amber-800 border-amber-200'], approved: ['Aprobada sin ejecutar', 'Approved, not executed', 'bg-blue-50 text-blue-700 border-blue-200'],
  executed: ['Ejecutada / consumida', 'Executed / consumed', 'bg-emerald-50 text-emerald-700 border-emerald-200'], rejected: ['Rechazada / devuelta', 'Rejected / returned', 'bg-rose-50 text-rose-700 border-rose-200'],
  other: ['Otro estado', 'Other state', 'bg-slate-50 text-slate-700 border-slate-200'] };
export const modPill = (r, en = false) => { const k = KIND[modKind(r)]; return { text: en ? k[1] : k[0], tone: k[2] }; };

/** Decision on a modification request: only the assigned approver, never on one's own request, reason to reject. */
export function validateModDecision(r, decision, comment, en = false) {
  const m = (es, e) => (en ? e : es);
  if (modKind(r) !== 'pending') return { ok: false, error: m('La solicitud ya no está pendiente.', 'The request is no longer pending.') };
  if (!r.assigned_to_me) return { ok: false, error: m('Solo la persona autorizadora asignada puede decidir esta solicitud.', 'Only the assigned approver can decide this request.') };
  if (r.requested_by_me) return { ok: false, error: m('Segregación de funciones: no puedes decidir una solicitud que tú enviaste.', 'Segregation of duties: you cannot decide a request you sent.') };
  if (decision === 'reject' && clean(comment).length < 10) return { ok: false, error: m('Para rechazar o devolver describe el motivo (mínimo 10 caracteres).', 'To reject or return describe the reason (minimum 10 characters).') };
  if (clean(comment).length > 1000) return { ok: false, error: m('Máximo 1000 caracteres.', 'Maximum 1000 characters.') };
  return { ok: true, error: '' };
}
