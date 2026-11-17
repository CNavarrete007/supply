// Tarjeta 9 · Decisión del cliente (control de aprobación) · lógica pura (sin red).
// Agrupa el estatus normalizado del servidor (status_key, ver cqMatrix.mjs) en las etapas del diseño y valida el
// formulario de decisión. Enviar al cliente y registrar la decisión son escrituras comerciales bloqueadas: se validan
// y se explica que no se registró nada; nunca se simula el registro.
import { initials } from './cqMatrix.mjs';

/** Mismos grupos que QuoteReadRepository::GROUPS. */
export const DECISION_GROUPS = {
  prep: ['draft', 'review', 'authorized'],
  client: ['sent', 'expired'],
  approved: ['approved'],
  change: ['change_requested'],
  rejected: ['rejected'],
  attention: ['draft', 'review', 'authorized', 'sent', 'expired', 'change_requested'],
};
export const groupOf = key => ['prep', 'client', 'approved', 'change', 'rejected'].find(g => DECISION_GROUPS[g].includes(key)) || 'other';

/** KPIs del encabezado a partir del facet de estatus (revisión vigente de cada cotización). */
export function decisionKpis(statuses = []) {
  const n = g => statuses.filter(s => DECISION_GROUPS[g].includes(s.code)).reduce((a, s) => a + (Number(s.count) || 0), 0);
  return { prep: n('prep'), client: n('client'), approved: n('approved'), change: n('change'), rejected: n('rejected'), attention: n('attention') };
}

/** "Todos los clientes" + una tarjeta por cliente con Pendientes / Sin respuesta / Modificar. */
export function decisionCards(cards = [], en = false) {
  const sum = k => cards.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  const all = { id: 'all', name: en ? 'All clients' : 'Todos los clientes', subtitle: en ? `${cards.length} clients` : `${cards.length} clientes`, tag: en ? 'ALL' : 'TOD', isAll: true,
    attention: sum('attention'), no_response: sum('no_response'), change: sum('change'), footer: en ? 'Overview' : 'Vista general' };
  return [all, ...cards.map(c => ({ ...c, tag: initials(c.name), isAll: false, subtitle: c.contact || c.name,
    footer: en ? `${c.requisitions} requisition(s)` : `${c.requisitions} requisición(es)` }))];
}

/** Referencia visible: la del cliente, la interna o la requisición. */
export const quoteReference = row => [row?.client_reference, row?.internal_reference, row?.requisition].map(v => String(v ?? '').trim()).find(Boolean) || '—';

/** Qué botones lleva cada cotización según su etapa. */
export function decisionActions(row) {
  const k = row?.status_key;
  return {
    edit: DECISION_GROUPS.prep.includes(k), // edición sobre el registro (tarjeta 6); en otra etapa se explica el bloqueo
    send: k === 'authorized',
    decide: DECISION_GROUPS.client.includes(k),
    modify: k === 'change_requested',
  };
}

/** Motivo por el que una cotización ya no se edita (null si está en preparación interna). */
export function editBlock(row, en = false) {
  if (decisionActions(row).edit) return null;
  return en ? `${row?.folio} was already sent or decided: it is not edited. Use MODIFY FROM REQ. to create Rev. N with traceability.`
    : `${row?.folio} ya fue enviada o decidida: no se edita. Usa MODIFICAR DESDE REQ. para generar Rev. N con trazabilidad.`;
}

export const DECISIONS = [
  ['approved', 'Aprobada por el cliente', 'Approved by the client'],
  ['change_requested', 'Solicita modificación', 'Requests a modification'],
  ['rejected', 'Rechazada por el cliente', 'Rejected by the client'],
];
export const CHANNELS = [
  ['email', 'Correo electrónico', 'Email'],
  ['portal', 'Portal del cliente', 'Client portal'],
  ['phone', 'Teléfono', 'Phone'],
  ['meeting', 'Reunión', 'Meeting'],
  ['other', 'Otro', 'Other'],
];
export const EVIDENCE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const EVIDENCE_MAX = 10 * 1024 * 1024;

export const emptyDecision = (row, today) => ({ decision: '', date: today, time: '', channel: 'email', actor: row?.client_contact || '', note: '', file: null });

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = v => ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** { ok, errors, warnings, first } del formulario de decisión. */
export function validateDecision(f, row, today, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = [];
  if (!DECISIONS.some(d => d[0] === f.decision)) errors.decision = m('Selecciona la decisión del cliente.', 'Select the client decision.');
  if (!f.date) errors.date = m('Indica la fecha de la decisión.', 'Enter the decision date.');
  else if (!validDate(f.date)) errors.date = m('Fecha inválida (AAAA-MM-DD).', 'Invalid date (YYYY-MM-DD).');
  else if (f.date > today) errors.date = m('La decisión no puede tener fecha futura.', 'The decision cannot be dated in the future.');
  else if (row?.quote_date && f.date < String(row.quote_date).slice(0, 10)) errors.date = m('La decisión no puede ser anterior a la emisión de la cotización.', 'The decision cannot precede the quote issue date.');
  if (f.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time)) errors.time = m('Hora inválida (HH:MM).', 'Invalid time (HH:MM).');
  if (!CHANNELS.some(c => c[0] === f.channel)) errors.channel = m('Selecciona el canal.', 'Select the channel.');
  const actor = String(f.actor || '').trim();
  if (!actor) errors.actor = m('Indica quién decide por parte del cliente.', 'Enter who decides on behalf of the client.');
  else if (actor.length > 120) errors.actor = m('Máximo 120 caracteres.', 'Maximum 120 characters.');
  const note = String(f.note || '').trim();
  if (['rejected', 'change_requested'].includes(f.decision) && note.length < 10) errors.note = m('Describe el motivo o los cambios solicitados (mínimo 10 caracteres).', 'Describe the reason or requested changes (minimum 10 characters).');
  else if (note.length > 1000) errors.note = m('Máximo 1000 caracteres.', 'Maximum 1000 characters.');
  if (f.file) {
    if (!EVIDENCE_TYPES.includes(f.file.type)) errors.file = m('La evidencia debe ser PDF, PNG o JPG.', 'Evidence must be PDF, PNG or JPG.');
    else if (f.file.size > EVIDENCE_MAX) errors.file = m('La evidencia no debe exceder 10 MB.', 'Evidence must not exceed 10 MB.');
    else if (!f.file.size) errors.file = m('El archivo está vacío.', 'The file is empty.');
  }
  if (f.decision === 'approved' && row?.valid_until && f.date && validDate(f.date) && f.date > String(row.valid_until).slice(0, 10)) {
    warnings.push(m(`La vigencia venció el ${String(row.valid_until).slice(0, 10)}: confirma precios y disponibilidad antes de aprobar.`, `Validity expired on ${String(row.valid_until).slice(0, 10)}: confirm prices and availability before approving.`));
  }
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, first: keys.length ? errors[keys[0]] : '' };
}

/** Efecto que tendría la decisión (texto informativo; no se registra nada). */
export function decisionEffect(code, en = false) {
  const m = (es, e) => (en ? e : es);
  if (code === 'approved') return m('Una aprobación habilita la compra (adjudicación definitiva y OC).', 'An approval enables purchasing (definitive award and PO).');
  if (code === 'change_requested') return m('La nueva revisión (Rev. N) se genera después con MODIFICAR DESDE REQ.; la revisión actual se conserva.', 'The new revision (Rev. N) is then created with MODIFY FROM REQ.; the current revision is kept.');
  if (code === 'rejected') return m('La cotización queda como no autorizada; se conserva para trazabilidad.', 'The quote is marked as not authorized; it is kept for traceability.');
  return '';
}
