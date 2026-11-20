// Requisiciones › Control de cambios — lógica pura (sin red ni React).
// Contratos reales (backend R3 aprobado en INT02, sin cambios):
//   R3A  POST /api/v1/recovery/requisitions/{id}/changes          (changeForm.mjs + ChangeRequestModal.jsx)
//        GET  /api/v1/recovery/changes/{id}                        detalle del propio solicitante
//        POST /api/v1/recovery/changes/{id}/withdraw              {reason}               If-Match = versión del cambio
//   R3B  GET  /api/v1/recovery/changes/{id}/review | /impact      solo un Master Admin distinto del solicitante
//        POST /api/v1/recovery/changes/{id}/decision              approve|reject          If-Match = versión del cambio
//   R3C2/R3C3 GET commercial-reconciliation | commercial-executions (solo consulta; sus escrituras siguen bloqueadas)
// Lectura complementaria (solo SELECT): GET /api/v1/requisition-changes y /candidates.
// La validación aquí solo orienta al usuario; el servidor vuelve a validar y es la única autoridad.
import { changeBlockMessage } from './changeForm.mjs';

export const STATUS = {
  pending_review: ['pending', 'Pendiente de revisión'],
  applied: ['ok', 'Aplicada'],
  rejected: ['overdue', 'Rechazada'],
  withdrawn: ['info', 'Retirada'],
};
export const STATUS_FILTERS = [
  ['all', 'Todos los estados'], ['pending_review', 'Pendientes de revisión'], ['applied', 'Aplicadas'],
  ['rejected', 'Rechazadas'], ['withdrawn', 'Retiradas'], ['closed', 'Rechazadas o retiradas'],
];
export const SCOPES = [
  ['all', 'Todas las solicitudes'], ['mine', 'Solicitadas por mí'], ['review', 'Me toca revisar'], ['imported', 'Históricas importadas'],
];
export const ACTION = { modify: 'Modificar', cancel: 'Cancelar', add: 'Agregar' };
export const FIELD = { need_date: 'Fecha requerida', delivery_place: 'Lugar de entrega' };
export const RESOLUTION = { proposed: 'Propuesta', applied: 'Aplicada', rejected: 'Rechazada' };
export const DEPENDENCIES = {
  sourcing_plans: 'Estrategia / lotificación', rfqs: 'Solicitudes a proveedores (RFQ)', supplier_quotes: 'Cotizaciones de proveedor',
  customer_quotes: 'Cotizaciones al cliente', customer_quote_versions: 'Revisiones de cotización al cliente',
  requisition_reviews: 'Validación interna', awards: 'Adjudicaciones', invoices: 'Facturas', service_orders: 'Órdenes de servicio',
  purchase_order_requisitions: 'Órdenes de compra ligadas', delivery_items: 'Entregas', purchase_orders: 'Órdenes de compra',
  goods_receipts: 'Recepciones',
};
export const TREATMENTS = {
  obtain_confirmation: 'Obtener confirmación', prepare_requote: 'Preparar recotización', prepare_formal_amendment: 'Preparar enmienda formal',
  preserve_with_review: 'Conservar con revisión', escalate_manual_review: 'Escalar a revisión manual',
};
export const EXECUTION_STATE = { awaiting_independent_review: 'En espera de revisión independiente', accepted: 'Evidencia revisada', rejected: 'Evidencia rechazada' };
export const MAX_REASON = 16000;

const t = v => String(v ?? '').trim();
const CTRL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;
const qty = v => { const s = t(v); return /^\d+\.\d+$/.test(s) ? s.replace(/0+$/, '').replace(/\.$/, '') : s; };

/** [chip class, label]. Imported records keep the original Apps Script status when present. */
export function statusChip(row) {
  if (row?.imported && t(row.legacy_status)) return ['info', t(row.legacy_status)];
  const s = STATUS[row?.status_code];
  return s ? [s[0], row.status_code === 'applied' && row.new_revision_number != null ? `${s[1]} · Rev. ${row.new_revision_number}` : s[1]] : ['info', t(row?.status_code) || '—'];
}
export const revisionText = r => `Rev. ${r?.previous_revision_number ?? '—'} → Rev. ${r?.new_revision_number ?? r?.proposed_revision_number ?? '—'}`;

/** Query string for GET /api/v1/requisition-changes. */
export function overviewQuery({ status = 'all', scope = 'all', q = '', page = 1, pageSize = 15 } = {}) {
  const p = new URLSearchParams();
  if (status !== 'all') p.set('status', status);
  if (scope !== 'all') p.set('scope', scope);
  if (t(q)) p.set('q', t(q).slice(0, 120));
  p.set('page', String(page)); p.set('page_size', String(pageSize));
  return p.toString();
}
export function candidatesQuery({ scope = 'eligible', q = '', page = 1, pageSize = 10 } = {}) {
  const p = new URLSearchParams({ scope });
  if (t(q)) p.set('q', t(q).slice(0, 120));
  p.set('page', String(page)); p.set('page_size', String(pageSize));
  return p.toString();
}

/** Which detail endpoint applies: imported (overview only) | owner (GET changes/{id}) | review (GET changes/{id}/review). */
export function detailMode(row) {
  if (!row || row.imported) return 'imported';
  return row.mine ? 'owner' : 'review';
}

const itemText = s => (s ? [t(s.description), [qty(s.quantity), t(s.unit)].filter(Boolean).join(' '), t(s.category)].filter(Boolean).join(' · ') : '');
/** Normalized before/after rows for the "Partidas antes / después" table. */
export function diffRows(changes = []) {
  return changes.map(c => {
    const b = c.before_snapshot || {}, a = c.after_snapshot || {};
    const base = { n: c.change_ordinal, kind: c.change_kind, action: ACTION[c.change_kind] || c.change_kind, sourcing: !!c.requires_sourcing, resolution: RESOLUTION[c.resolution_status] || c.resolution_status || '—', changed: [] };
    if (c.target_kind === 'header') return { ...base, target: `Cabecera · ${FIELD[c.field_code] || c.field_code}`, before: t(b.value) || '—', after: t(a.value) || '—', changed: [c.field_code] };
    if (c.change_kind === 'add') return { ...base, target: 'Partida nueva', before: 'No existía', after: itemText(a) };
    if (c.change_kind === 'cancel') return { ...base, target: 'Partida', before: itemText(b), after: 'Cancelada' };
    const changed = ['description', 'quantity', 'unit', 'category'].filter(k => (k === 'quantity' ? qty(b[k]) !== qty(a[k]) : t(b[k]) !== t(a[k])));
    return { ...base, target: 'Partida', before: itemText(b), after: itemText(a), changed };
  });
}

/** Reasons the approval would be refused, from GET …/impact (informative; the decision re-checks under lock). */
export function applyBlockers(impact) {
  if (!impact) return [];
  const out = [];
  if (impact.status && impact.status !== 'pending_review') out.push('La solicitud ya no está pendiente de revisión.');
  if (impact.revision_number_current === false) out.push('El número de revisión propuesto ya no es el vigente de la requisición.');
  if (impact.snapshot_number_occupied) out.push('El historial ya usa ese número de revisión (requiere conciliación R2/R3).');
  const deps = Object.entries(impact.dependencies || {}).filter(([, v]) => v === true || (v && v.count > 0)).map(([k]) => DEPENDENCIES[k] || k);
  if (deps.length) out.push(`Existen documentos o planes dependientes: ${deps.join(', ')}. Se requiere conciliación comercial antes de aplicar.`);
  return out;
}
export const dependencyList = (deps = {}) => Object.entries(deps).map(([k, v]) => ({ key: k, label: DEPENDENCIES[k] || k, present: v === true || (!!v && typeof v === 'object' && v.count > 0), count: v && typeof v === 'object' ? v.count : (v ? 1 : 0) }));

function reasonError(reason, what) {
  const r = t(reason);
  if (!r) return `Escribe el motivo ${what}.`;
  if (r.length > MAX_REASON) return `El motivo admite hasta ${MAX_REASON} caracteres.`;
  if (CTRL.test(r)) return 'El motivo contiene caracteres de control no permitidos.';
  return '';
}

export const emptyDecision = () => ({ decision: '', reason: '', ack: false });
/** Mirrors RequisitionChangeDecisionInput::payload. */
export function validateDecision(f, review) {
  const errors = {};
  if (!['approve', 'reject'].includes(f?.decision)) errors.decision = 'Selecciona Aprobar y aplicar o Rechazar.';
  const r = reasonError(f?.reason, f?.decision === 'reject' ? 'del rechazo' : 'de la decisión');
  if (r) errors.reason = r;
  if (f?.decision === 'approve') {
    if (!f.ack) errors.ack = 'Confirma expresamente el alcance restringido de la revisión.';
    const v = review?.requisition_version;
    if (!Number.isInteger(v) || v < 1) errors.decision = 'No se conoce la versión vigente de la requisición; recarga el detalle.';
  }
  const first = Object.values(errors)[0] || '';
  return { ok: !first, errors, first };
}
export function decisionPayload(f, review) {
  return f.decision === 'approve'
    ? { decision: 'approve', reason: t(f.reason), requisition_version: review.requisition_version, acknowledge_scope: true }
    : { decision: 'reject', reason: t(f.reason) };
}
export const validateWithdraw = reason => reasonError(reason, 'del retiro');

const uncertain = (verb) => ({ keep: true, reload: false, message: `No se confirmó el resultado. Presiona ${verb} para reintentar exactamente la misma operación; no se duplicará.` });
/** Shared outcome of a failed decision/withdraw: keep = retry SAME key and content; reload = re-read the detail. */
function outcome(e, verb, extra = {}) {
  const s = e?.status, c = e?.code;
  if (!s || s >= 500) return uncertain(verb);
  if (s === 401) return { keep: false, reload: false, message: 'Tu sesión expiró. Inicia sesión nuevamente; no se registró nada.' };
  if (s === 403 && c === 'CSRF_INVALID') return { keep: true, reload: false, message: `La protección de la solicitud expiró. Presiona ${verb} para reintentar la misma operación.` };
  if (s === 403) return { keep: false, reload: false, message: 'Solo un Master Admin puede operar el Control de cambios.' };
  if (s === 412 || s === 428) return { keep: false, reload: true, message: 'La solicitud o la requisición cambió desde que la abriste. Se cargó la versión vigente; revisa y vuelve a decidir. No se sobrescribió nada.' };
  if (s === 409 && ['BUSY', 'OPERATION_PENDING'].includes(c)) return { keep: true, reload: false, message: `La operación está ocupada o en proceso. Espera unos segundos y presiona ${verb} con la misma solicitud.` };
  if (s === 409 && c === 'IDEMPOTENCY_CONFLICT') return { keep: false, reload: true, message: 'La operación anterior se registró con otro contenido. Revisa el estado antes de reintentar.' };
  if (s === 409 && extra[c]) return { keep: false, reload: true, message: extra[c] };
  if (s === 422) return { keep: false, reload: false, message: e.message || 'Revisa los datos capturados.' };
  return { keep: false, reload: s === 409, message: e?.message || 'No se pudo completar la operación.' };
}
export const decisionOutcome = e => outcome(e, 'Registrar decisión', {
  NOT_REVIEWABLE: 'No puedes revisar esta solicitud: no existe o la registraste tú. La revisión debe hacerla un Master Admin distinto.',
  DECISION_FINAL: 'Esta solicitud ya tiene una decisión. Se recargó su estado.',
  OTHER_PENDING: 'La requisición tiene otra solicitud pendiente. Resuélvela antes de aplicar esta.',
  DOWNSTREAM_RECONCILIATION_REQUIRED: 'La requisición tiene documentos o planes dependientes (cotizaciones, RFQ, OC, validaciones…). No se aplicó: requiere conciliación comercial. Puedes rechazarla con motivo.',
  SNAPSHOT_NUMBER_OCCUPIED: 'El historial ya utiliza el número de revisión propuesto. Requiere conciliación R2/R3 antes de aplicar.',
  CATEGORY_UNAVAILABLE: 'Una categoría propuesta ya no existe o está inactiva. No se aplicó el cambio.',
  LAST_LINE: 'La solicitud dejaría la requisición sin partidas activas. No se aplicó el cambio.',
  BAD_SNAPSHOT: 'El detalle de la solicitud no es consistente con el historial. No se aplicó el cambio.',
});
export const withdrawOutcome = e => outcome(e, 'Retirar solicitud', {
  CHANGE_NOT_FOUND: 'La solicitud ya no está disponible para retiro.',
  NOT_PENDING: 'Solo se puede retirar una solicitud pendiente de revisión. Se recargó su estado.',
});

/** Text shown for a requisition that does not admit a new R3A request. */
export const candidateBlock = row => (row?.change_block ? changeBlockMessage(row.change_block, row.pending_change) : '');

/** Line shown after a confirmed decision. */
export function decisionNotice(out) {
  if (!out) return '';
  const again = out.replayed ? ' (confirmada por reintento seguro)' : '';
  if (out.status === 'applied') {
    const extra = [out.requires_sourcing && 'reabastecimiento por evaluar', out.supplier_confirmation_pending && 'confirmación del proveedor pendiente'].filter(Boolean);
    return `Solicitud ${out.folio} aprobada y aplicada${again}: la requisición quedó en Rev. ${out.revision_number} (versión ${out.requisition_version}).${extra.length ? ` Pendiente: ${extra.join(' y ')}.` : ''} No se modificaron cotizaciones, RFQ ni OC.`;
  }
  return `Solicitud ${out.folio} rechazada${again}. La requisición no cambió.`;
}
