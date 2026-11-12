// R3A · "Modificación controlada de requisición" — lógica pura (sin red). Contrato real:
// POST /api/v1/recovery/requisitions/{id}/changes (RequisitionChangeInput.php) con CSRF + If-Match + Idempotency-Key.
// Solo REGISTRA la solicitud (pending_review). Aplicarla exige revisión independiente (R3B) y no emite ni modifica
// cotizaciones u OC. La validación aquí solo ayuda al usuario: el servidor vuelve a validar todo.

// Mismos textos que RequisitionChangeInput::SOURCES / ::TYPES (el servidor compara exacto).
export const SOURCES = [
  ['Correo del cliente', 'Client email'], ['PO / OC modificada del cliente', 'Client modified PO'], ['Orden de Servicio revisada', 'Revised service order'],
  ['Portal del cliente', 'Client portal'], ['Minuta', 'Minutes'], ['Llamada confirmada por escrito', 'Call confirmed in writing'], ['Otro', 'Other'],
];
export const TYPES = [
  ['Cambio de cantidad', 'Quantity change'], ['Eliminación de partida', 'Item removal'], ['Agregar partida', 'Add item'], ['Cambio de especificación', 'Specification change'],
  ['Cambio de fecha requerida', 'Required date change'], ['Cambio de lugar de entrega', 'Delivery place change'], ['Cambio de alcance', 'Scope change'], ['Otro', 'Other'],
];
export const ACTIONS = [['keep', 'Mantener', 'Keep'], ['modify', 'Modificar', 'Modify'], ['cancel', 'Cancelar', 'Cancel']];
export const MAX_ITEMS = 100;
export const MAX_ADDITIONS = 20;

const t = v => String(v ?? '').trim();
const DEC = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** '3.000000' → '3'; '2.500' → '2.5' (same normalization the server uses to detect real differences). */
export function normQty(v) {
  const s = t(v);
  if (!DEC.test(s)) return s;
  return s.includes('.') ? (s.replace(/0+$/, '').replace(/\.$/, '') || '0') : s;
}
export const localToday = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Initial form from GET /api/v1/recovery/requisitions/{id}. */
export function emptyChange(detail, today = localToday(), requestedBy = '') {
  const lines = (detail?.items || []).map(it => ({
    id: it.id, original: { description: it.description || '', quantity: normQty(it.quantity), unit: it.unit || '', category: it.category || '' },
    action: 'keep', description: it.description || '', quantity: normQty(it.quantity), unit: it.unit || '', category: it.category || '',
  }));
  return {
    date: today, requested_by: requestedBy, source: '', change_type: '', reference: '', reason: '',
    need_date: detail?.need_date ? String(detail.need_date).slice(0, 10) : '', delivery_place: detail?.delivery_place || '',
    base: { need_date: detail?.need_date ? String(detail.need_date).slice(0, 10) : '', delivery_place: detail?.delivery_place || '' },
    lines, additions: [], draft: { description: '', quantity: '', unit: '', category: '' },
  };
}

const lineChanged = l => l.action === 'modify' && (t(l.description) !== t(l.original.description) || normQty(l.quantity) !== normQty(l.original.quantity)
  || t(l.unit) !== t(l.original.unit) || t(l.category) !== t(l.original.category));

/** Result chip of a line: none | modified | cancelled | unchanged-modify (modify without differences). */
export function lineResult(l) {
  if (l.action === 'cancel') return 'cancelled';
  if (l.action === 'modify') return lineChanged(l) ? 'modified' : 'same';
  return 'none';
}

/** JSON body for R3A. Only real differences are sent; "Mantener" lines are omitted. */
export function toChangePayload(f) {
  const header = {};
  if (f.need_date && f.need_date !== f.base.need_date) header.need_date = f.need_date;
  if (t(f.delivery_place) && t(f.delivery_place) !== t(f.base.delivery_place)) header.delivery_place = t(f.delivery_place);
  const items = [];
  for (const l of f.lines) {
    if (l.action === 'cancel') items.push({ action: 'cancel', id: l.id });
    else if (lineChanged(l)) items.push({ action: 'modify', id: l.id, description: t(l.description), quantity: normQty(l.quantity), unit: t(l.unit), category: t(l.category) });
  }
  for (const a of f.additions) items.push({ action: 'add', description: t(a.description), quantity: normQty(a.quantity), unit: t(a.unit), category: t(a.category) });
  return { date: f.date, requested_by: t(f.requested_by), source: f.source, change_type: f.change_type, reference: t(f.reference), reason: t(f.reason), header, items };
}

const lineErrors = (l, en) => {
  const m = (es, e) => (en ? e : es);
  if (!t(l.description)) return m('Describe la partida.', 'Describe the item.');
  if (t(l.description).length > 16000) return m('Descripción demasiado larga.', 'Description too long.');
  if (!DEC.test(normQty(l.quantity)) || /^0(?:\.0+)?$/.test(normQty(l.quantity))) return m('Cantidad mayor a cero, sin separadores y hasta 6 decimales.', 'Quantity above zero, no separators, up to 6 decimals.');
  if (!t(l.unit) || t(l.unit).length > 128) return m('Indica la unidad (máx. 128).', 'Enter the unit (max 128).');
  if (!t(l.category)) return m('Selecciona la categoría.', 'Select the category.');
  return '';
};

/** { ok, errors: {field|line:<id>|add:<n>|draft: message}, first } — mirrors RequisitionChangeInput. */
export function validateChange(f, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  if (!DATE.test(f.date || '')) errors.date = m('Indica la fecha del cambio.', 'Enter the change date.');
  if (!t(f.requested_by)) errors.requested_by = m('Indica quién solicita el cambio.', 'Enter who requests the change.');
  else if (t(f.requested_by).length > 255) errors.requested_by = m('Máximo 255 caracteres.', 'Max 255 characters.');
  if (!SOURCES.some(([s]) => s === f.source)) errors.source = m('Selecciona el origen.', 'Select the source.');
  if (!TYPES.some(([s]) => s === f.change_type)) errors.change_type = m('Selecciona el tipo principal.', 'Select the main type.');
  if (t(f.reference).length > 255) errors.reference = m('Máximo 255 caracteres.', 'Max 255 characters.');
  if (!t(f.reason)) errors.reason = m('Describe el motivo o la instrucción del cliente.', 'Describe the client reason or instruction.');
  if (f.need_date && !DATE.test(f.need_date)) errors.need_date = m('Fecha inválida.', 'Invalid date.');
  if (f.need_date !== f.base.need_date && !f.need_date) errors.need_date = m('La fecha requerida no puede quedar vacía.', 'The required date cannot be empty.');
  if (t(f.base.delivery_place) && !t(f.delivery_place)) errors.delivery_place = m('El lugar de entrega no puede quedar vacío.', 'The delivery place cannot be empty.');
  for (const l of f.lines) if (l.action === 'modify') { const e = lineErrors(l, en); if (e) errors[`line:${l.id}`] = e; }
  f.additions.forEach((a, i) => { const e = lineErrors(a, en); if (e) errors[`add:${i}`] = e; });
  if (f.additions.length > MAX_ADDITIONS) errors.additions = m(`Máximo ${MAX_ADDITIONS} partidas nuevas por solicitud.`, `Max ${MAX_ADDITIONS} new items per request.`);
  const p = toChangePayload(f);
  if (p.items.length > MAX_ITEMS) errors.items = m(`Se admiten hasta ${MAX_ITEMS} partidas por solicitud.`, `Up to ${MAX_ITEMS} items per request.`);
  if (!Object.keys(p.header).length && !p.items.length) errors.changes = m('Indica al menos un cambio real: modifica o cancela una partida, agrega una nueva o cambia la fecha o el lugar de entrega.', 'Enter at least one real change: modify or cancel an item, add one or change the date or delivery place.');
  const adds = f.additions.length;
  if (f.change_type === 'Agregar partida' && adds === 0) errors.change_type = m('El tipo Agregar partida requiere al menos una partida nueva.', 'The Add item type requires at least one new item.');
  if (adds > 0 && f.change_type && !['Agregar partida', 'Cambio de alcance'].includes(f.change_type)) errors.change_type = m('Para agregar partidas selecciona Agregar partida o Cambio de alcance.', 'To add items select Add item or Scope change.');
  const first = Object.values(errors)[0] || '';
  return { ok: !first, errors, first };
}

/** Validates the "+ Agregar nueva partida" row before moving it to the list. */
export function validateDraft(d, en = false) { return lineErrors(d, en); }

/** Outcome of a failed POST: keep = retry the SAME key/content; reload = re-read the requisition. */
export function changeOutcome(e, en = false) {
  const m = (es, x) => (en ? x : es);
  const s = e?.status, c = e?.code;
  if (!s || s >= 500) return { keep: true, reload: false, message: m('No se confirmó el resultado. Presiona Registrar solicitud para reintentar exactamente la misma solicitud; no se duplicará.', 'The result was not confirmed. Press Register request to retry exactly the same request; it will not be duplicated.') };
  if (s === 401) return { keep: false, reload: false, message: m('Tu sesión expiró. Inicia sesión nuevamente; la solicitud no se registró.', 'Your session expired. Sign in again; the request was not registered.') };
  if (s === 403 && c === 'CSRF_INVALID') return { keep: true, reload: false, message: m('La protección de la solicitud expiró. Presiona Registrar solicitud para reintentar la misma operación.', 'The request protection expired. Press Register request to retry the same operation.') };
  if (s === 403) return { keep: false, reload: false, message: m('Solo un Master Admin puede solicitar modificaciones.', 'Only a Master Admin can request changes.') };
  if (s === 412) return { keep: false, reload: true, message: m('La requisición cambió desde que abriste el formulario. Se cargó la versión vigente; revisa y vuelve a registrar. No se sobrescribió nada.', 'The requisition changed since you opened the form. The current version was loaded; review and register again. Nothing was overwritten.') };
  if (s === 409 && ['BUSY', 'OPERATION_PENDING'].includes(c)) return { keep: true, reload: false, message: m('La operación está ocupada o en proceso. Reintenta en unos segundos con la misma solicitud.', 'The operation is busy or in progress. Retry in a few seconds with the same request.') };
  if (s === 409 && c === 'CHANGE_ALREADY_EXISTS') return { keep: false, reload: true, message: m('La requisición ya tiene una solicitud de cambio pendiente de revisión. Concílala antes de registrar otra.', 'The requisition already has a change request pending review. Resolve it before filing another.') };
  if (s === 409 && c === 'READ_ONLY_RECORD') return { keep: false, reload: false, message: m('Solo se admiten solicitudes sobre requisiciones RF1 propias, no importadas. No se registró nada.', 'Requests are only allowed on your own non-imported RF1 requisitions. Nothing was registered.') };
  if (s === 409 && c === 'NO_CHANGES') return { keep: false, reload: false, message: m('No se detectaron diferencias respecto a la requisición vigente.', 'No differences from the current requisition were detected.') };
  if (s === 409 && c === 'CATEGORY_UNAVAILABLE') return { keep: false, reload: false, message: m('La categoría indicada no existe o no está activa en el catálogo.', 'The category does not exist or is not active.') };
  if (s === 409 && c === 'LINE_MISMATCH') return { keep: false, reload: true, message: m('Una partida ya no está vigente en la requisición. Se recargó el expediente.', 'An item is no longer active in the requisition. The record was reloaded.') };
  if (s === 409 && c === 'IDEMPOTENCY_CONFLICT') return { keep: false, reload: false, message: m('La solicitud anterior se registró con otro contenido. Revisa el expediente antes de reintentar.', 'The previous request was registered with different content. Check the record before retrying.') };
  if (s === 422) return { keep: false, reload: false, message: e.message || m('Revisa los datos de la solicitud.', 'Check the request data.') };
  return { keep: false, reload: s === 409, message: e?.message || m('No se pudo registrar la solicitud.', 'Could not register the request.') };
}

/** Why "Solicitar modificación" is not available for a quote family (code from GET /api/v1/quotes/revisions). */
export function changeBlockMessage(code, pending, en = false) {
  const m = (es, e) => (en ? e : es);
  if (code === 'imported') return m('Expediente histórico importado: permanece en consulta. Las modificaciones controladas (R3A) solo se registran sobre requisiciones RF1 capturadas en SupplyFlow; no se modificó nada.', 'Imported historical record: read-only. Controlled modifications (R3A) are only registered on RF1 requisitions captured in SupplyFlow; nothing was changed.');
  if (code === 'not_rf1') return m('La requisición no se capturó con el flujo RF1 de SupplyFlow; permanece en consulta. No se modificó nada.', 'The requisition was not captured with the SupplyFlow RF1 flow; it stays read-only. Nothing was changed.');
  if (code === 'not_owner') return m('Solo quien capturó la requisición RF1 puede solicitar su modificación; otro Master Admin la revisa después de forma independiente.', 'Only the person who captured the RF1 requisition can request its modification; another Master Admin reviews it independently.');
  if (code === 'pending_change') return m(`La requisición ya tiene la solicitud ${pending || ''} pendiente de revisión independiente. Concílala antes de registrar otra.`.replace('  ', ' '), `The requisition already has request ${pending || ''} pending independent review. Resolve it before filing another.`.replace('  ', ' '));
  return '';
}
