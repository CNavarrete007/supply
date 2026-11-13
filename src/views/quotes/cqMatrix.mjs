// Tarjeta 8 · Matriz de cotizaciones al cliente · lógica pura (sin red).
// El estatus de cada revisión (status_key) lo calcula el servidor (QuoteReadRepository::STATUS_KEY); aquí solo se
// traduce, se colorea y se decide qué acciones muestra la fila. Validar comprador y eliminar son escrituras comerciales
// bloqueadas: la interfaz explica el motivo y nunca simula el registro.
import { label } from './model.mjs';

/** Los nueve estatus del filtro original, en el mismo orden. */
export const CQM_STATUSES = [
  ['draft', 'Borrador', 'Draft'],
  ['review', 'En revisión interna', 'Under internal review'],
  ['authorized', 'Autorizada internamente', 'Internally authorized'],
  ['sent', 'Enviada al cliente', 'Sent to the client'],
  ['approved', 'Aprobada', 'Approved'],
  ['change_requested', 'Solicitud de modificación', 'Modification request'],
  ['rejected', 'Rechazada', 'Rejected'],
  ['expired', 'Vencida', 'Expired'],
  ['superseded', 'Sustituida', 'Superseded'],
];
const BY_KEY = Object.fromEntries(CQM_STATUSES.map(([k, es, en]) => [k, [es, en]]));
const TONES = {
  draft: 'bg-sky-100 text-sky-800', review: 'bg-amber-100 text-amber-800', authorized: 'bg-indigo-100 text-indigo-800', sent: 'bg-violet-100 text-violet-800',
  approved: 'bg-blue-100 text-blue-800', change_requested: 'bg-orange-100 text-orange-800', rejected: 'bg-rose-100 text-rose-800', expired: 'bg-rose-50 text-rose-700',
  superseded: 'bg-slate-200 text-slate-700',
};
/** Estatus que cuentan como "Pendientes" en las tarjetas por cliente (mismo criterio que el resumen del servidor). */
export const PENDING_KEYS = ['draft', 'review', 'authorized', 'sent', 'change_requested'];

const clean = v => String(v ?? '').trim();

/** Etiqueta del estatus; un estatus fuera de los nueve muestra la etiqueta original importada o el código. */
export function statusText(row, en = false) {
  const k = row?.status_key;
  if (BY_KEY[k]) return BY_KEY[k][en ? 1 : 0];
  return clean(row?.legacy_status) || label(row?.document_status, en);
}
export const statusTone = key => TONES[key] || 'bg-slate-100 text-slate-700';

/** Iniciales del avatar: primera letra de las dos primeras palabras ("EJEMPLO 1" → E1, "Grupo Santa Fe" → GS). */
export function initials(name) {
  const w = clean(name).toUpperCase().split(/\s+/).filter(Boolean);
  if (!w.length) return '—';
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]);
}

/** Tarjeta "Todas las cotizaciones" + una por cliente (resumen del servidor, sin filtros). */
export function clientCards(cards = [], en = false) {
  const sum = k => cards.reduce((n, c) => n + (Number(c[k]) || 0), 0);
  return [{ id: 'all', name: en ? 'All quotes' : 'Todas las cotizaciones', subtitle: en ? 'Overview' : 'Vista general', tag: en ? 'ALL' : 'TOD', total: sum('total'), approved: sum('approved'), pending: sum('pending'), isAll: true },
    ...cards.map(c => ({ ...c, subtitle: en ? 'Client' : 'Cliente', tag: initials(c.name), isAll: false }))];
}

/** "Nivel N · Comprador" cuando la evaluación registrada trae nivel; si no, el estado de la aprobación interna. */
export function approvalBadge(row, en = false) {
  const n = Number(row?.approval_level);
  if (Number.isInteger(n) && n > 0) return { text: `${en ? 'Level' : 'Nivel'} ${n}${n === 1 ? (en ? ' · Buyer' : ' · Comprador') : ''}`, tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  const ok = row?.internal_approval_status === 'approved';
  return { text: `${en ? 'Internal approval' : 'Aprob. interna'}: ${label(row?.internal_approval_status || 'pending', en)}`, tone: ok ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200' };
}

/** Decisión del cliente: última decisión registrada (con fecha), la decisión importada o el estado actual. */
export function decisionText(row, en = false) {
  if (row?.last_decision) return { text: label(row.last_decision, en), at: clean(row.last_decision_at).slice(0, 16), pending: false };
  if (clean(row?.legacy_client_decision)) return { text: clean(row.legacy_client_decision), at: '', pending: false };
  const code = row?.client_decision_status || 'pending';
  return { text: label(code, en), at: '', pending: code === 'pending' };
}

/** VALIDAR COMPRADOR solo aplica a cotizaciones que aún esperan la validación interna. */
export const canValidateBuyer = row => ['draft', 'review'].includes(row?.status_key);

/**
 * Eliminación: solo un borrador sin emitir podría eliminarse (y aun así es una escritura bloqueada); una cotización emitida,
 * aprobada, sustituida o con decisión del cliente se conserva para trazabilidad y se modifica con Rev. N.
 * Devuelve null (borrador) o el motivo del bloqueo.
 */
export function deleteBlock(row, en = false) {
  if (row?.status_key === 'draft' && (row?.versions || 1) <= 1) return null;
  const m = (es, e) => (en ? e : es);
  if (row?.status_key === 'draft') return m('Es una revisión de una cotización con historial: se conserva para trazabilidad. Usa MODIFICAR DESDE REQ. para generar Rev. N.', 'It is a revision of a quote with history: it is kept for traceability. Use MODIFY FROM REQ. to create Rev. N.');
  return m(`${row?.folio || 'La cotización'} está "${statusText(row, en)}": una cotización emitida, aprobada o sustituida no se elimina ni se sobrescribe. Usa MODIFICAR DESDE REQ. para generar Rev. N con trazabilidad.`,
    `${row?.folio || 'The quote'} is "${statusText(row, en)}": an issued, approved or superseded quote is never deleted or overwritten. Use MODIFY FROM REQ. to create Rev. N with traceability.`);
}

/** Confirmación exacta del folio (sin espacios sobrantes, sensible a mayúsculas como en el original). */
export const folioConfirmed = (row, typed) => !!row?.folio && clean(typed) === row.folio;

/** Datos para el modal de modificación controlada (R3A) o para el aviso de bloqueo, con la forma de una familia de la tarjeta 1. */
export function changeTarget(row) {
  return {
    requisition_id: row.requisition_id, requisition: row.requisition, client_name: row.client_name, current_folio: row.folio, current_rev: row.revision,
    can_request_change: !!row.can_request_change, change_block: row.change_block,
    pending_change: row.change_block === 'superseded' ? row.current_folio : row.pending_change,
  };
}

/** Texto bajo el título de la matriz abierta. */
export function matrixCaption(sel, total, filtered, en = false) {
  const m = (es, e) => (en ? e : es);
  const base = sel?.isAll ? m(`Mostrando ${total} cotización(es) registradas`, `Showing ${total} recorded quote(s)`) : m(`Mostrando detalle de cotizaciones para ${sel?.name || ''}`, `Showing quote detail for ${sel?.name || ''}`);
  return filtered ? `${base} · ${m('con filtros aplicados', 'with filters applied')}` : base;
}
