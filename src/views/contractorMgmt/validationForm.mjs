// Gestión del Contratista · tarjeta 1 "Registro de validación" · lógica pura (sin red).
// Datos: GET /api/v1/contractor-management/validation-setup (requisiciones y responsables de compras = personal activo del
// contratista) y GET /api/v1/contractor-management/requisitions/{id} (contexto y validaciones registradas en
// requisition_reviews). Registrar la validación es una escritura sin endpoint: el formulario se valida por completo y
// "Guardar validación" informa que no se guardó.

export const TECH_RESULTS = [['Pendiente', 'Pending'], ['Conforme', 'Compliant'], ['Con observaciones', 'With observations'], ['No conforme', 'Non-compliant']];
export const CONTRACT_RESULTS = TECH_RESULTS;
export const BUDGET_RESULTS = [['Pendiente', 'Pending'], ['Disponible', 'Available'], ['Parcial', 'Partial'], ['No disponible', 'Not available']];
export const STRATEGIES = [['Competencia abierta', 'Open competition'], ['Proveedor preferente', 'Preferred supplier'], ['Compra urgente', 'Urgent purchase'], ['Fuente única justificada', 'Justified sole source']];
export const DEFAULT_CRITERIA = 'Precio, plazo, calidad, cumplimiento documental';
export const DEFAULT_MIN_QUOTES = '3';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = v => ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const tr = (list, v, en) => { const x = list.find(r => r[0] === v); return x ? (en ? x[1] : x[0]) : clean(v); };

export const emptyValidation = () => ({ requisition: '', buyer: '', technical: 'Pendiente', contract: 'Pendiente', budget: 'Pendiente', strategy: 'Competencia abierta', minQuotes: DEFAULT_MIN_QUOTES, deadline: '', criteria: DEFAULT_CRITERIA, notes: '' });

/** "Limpiar": keeps the selected requisition and restores the design defaults. */
export const clearKeepingRequisition = f => ({ ...emptyValidation(), requisition: f?.requisition || '' });

/**
 * Rule of the original "Reglas inteligentes": technical and contractual must be compliant (or with acceptable
 * observations) and the budget available or partially available. Accepts DB values in Spanish or English.
 */
export function canQuote(v) {
  const ok = x => /^(conforme|con observaciones|compliant|with observations)$/.test(fold(x));
  return ok(v?.technical) && ok(v?.contract) && /^(disponible|parcial|available|partial)$/.test(fold(v?.budget));
}

/** Why a validation cannot pass to quoting ('' when it can). */
export function blockReasons(v, en = false) {
  const m = (es, e) => (en ? e : es);
  const out = [];
  const st = x => fold(x);
  if (!/^(conforme|con observaciones|compliant|with observations)$/.test(st(v?.technical))) out.push(m(`técnica ${clean(v?.technical).toLowerCase() || 'sin dato'}`, `technical ${clean(v?.technical).toLowerCase() || 'missing'}`));
  if (!/^(conforme|con observaciones|compliant|with observations)$/.test(st(v?.contract))) out.push(m(`contractual ${clean(v?.contract).toLowerCase() || 'sin dato'}`, `contractual ${clean(v?.contract).toLowerCase() || 'missing'}`));
  if (!/^(disponible|parcial|available|partial)$/.test(st(v?.budget))) out.push(m(`presupuesto ${clean(v?.budget).toLowerCase() || 'sin dato'}`, `budget ${clean(v?.budget).toLowerCase() || 'missing'}`));
  return out.join(', ');
}

/** Requisition selector: "FOLIO · PROYECTO · Cliente" (+ validations registered). */
export function requisitionOptions(reqs = [], en = false) {
  return reqs.map(r => {
    const tail = r.review_count ? (en ? ` · ${r.review_count} validation(s)` : ` · ${r.review_count} validación(es)`) : '';
    return { id: r.id, label: `${clean(r.folio)} · ${clean(r.project).toUpperCase() || '—'} · ${clean(r.client_name)}${tail}` };
  });
}

/** Purchasing managers: active personnel of the contractor; people without a SupplyFlow user cannot be linked. */
export function buyerOptions(buyers = [], en = false) {
  return buyers.map(b => {
    const sub = clean(b.position) || clean(b.roles);
    const why = !b.has_user ? (en ? ' (no SupplyFlow user)' : ' (sin usuario en SupplyFlow)') : !b.with_access ? (en ? ' (no access)' : ' (sin acceso)') : '';
    return { id: b.id, label: `${clean(b.name)}${sub ? ` · ${sub}` : ''}${why}`, disabled: !b.has_user || !b.with_access };
  });
}

/** { ok, errors, warnings, first, canQuote }. ctx: { req (detail item), reviews, today, buyers }. */
export function validateValidation(f, { req = null, reviews = [], today = '', buyers = [] } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = [];
  if (!f.requisition) errors.requisition = m('Selecciona la requisición.', 'Select the requisition.');
  if (!f.buyer) errors.buyer = m('Selecciona el responsable de compras.', 'Select the purchasing manager.');
  else { const b = buyers.find(x => x.id === f.buyer); if (buyers.length && (!b || !b.has_user || !b.with_access)) errors.buyer = m('El responsable de compras debe tener usuario activo en SupplyFlow.', 'The purchasing manager must have an active SupplyFlow user.'); }
  if (!TECH_RESULTS.some(x => x[0] === f.technical)) errors.technical = m('Selecciona la validación técnica.', 'Select the technical validation.');
  if (!CONTRACT_RESULTS.some(x => x[0] === f.contract)) errors.contract = m('Selecciona la validación contractual.', 'Select the contractual validation.');
  if (!BUDGET_RESULTS.some(x => x[0] === f.budget)) errors.budget = m('Selecciona la disponibilidad presupuestal.', 'Select the budget availability.');
  if (!STRATEGIES.some(x => x[0] === f.strategy)) errors.strategy = m('Selecciona la estrategia de compra.', 'Select the purchase strategy.');
  const n = /^\d{1,2}$/.test(clean(f.minQuotes)) ? Number(f.minQuotes) : null;
  if (n === null || n < 1 || n > 20) errors.minQuotes = m('Captura un número entero de 1 a 20.', 'Enter a whole number from 1 to 20.');
  else if (f.strategy === 'Competencia abierta' && n < 2) warnings.push(m('Competencia abierta con una sola cotización: considera solicitar al menos 2.', 'Open competition with a single quote: consider requesting at least 2.'));
  if (clean(f.deadline)) {
    if (!validDate(f.deadline)) errors.deadline = m('Fecha inválida.', 'Invalid date.');
    else if (today && f.deadline < today) errors.deadline = m('La fecha límite de cotización no puede ser anterior a hoy.', 'The quotation deadline cannot be earlier than today.');
    else if (req?.need_date && f.deadline > clean(req.need_date).slice(0, 10)) warnings.push(m(`La fecha límite de cotización es posterior a la fecha requerida de la requisición (${clean(req.need_date).slice(0, 10)}).`, `The quotation deadline is after the requisition need date (${clean(req.need_date).slice(0, 10)}).`));
  } else warnings.push(m('Sin fecha límite de cotización.', 'No quotation deadline.'));
  if (!clean(f.criteria)) errors.criteria = m('Indica los criterios de evaluación.', 'Enter the evaluation criteria.');
  else if (clean(f.criteria).length > 1000) errors.criteria = m('Máximo 1000 caracteres.', 'Maximum 1000 characters.');
  const needsWhy = f.strategy === 'Fuente única justificada' || f.technical === 'No conforme' || f.contract === 'No conforme' || f.budget === 'No disponible';
  if (f.strategy === 'Compra urgente' && !clean(f.notes)) warnings.push(m('Compra urgente: documenta el motivo en observaciones.', 'Urgent purchase: document the reason in the notes.'));
  if (clean(f.notes).length > 2000) errors.notes = m('Máximo 2000 caracteres.', 'Maximum 2000 characters.');
  else if (needsWhy && clean(f.notes).length < 10) errors.notes = m('Justifica la fuente única o el resultado no conforme / sin presupuesto (mínimo 10 caracteres).', 'Justify the sole source or the non-compliant / no-budget result (minimum 10 characters).');
  if (f.strategy === 'Fuente única justificada' && n !== null && n > 1) warnings.push(m('Fuente única: normalmente se solicita una sola cotización.', 'Sole source: usually a single quote is requested.'));
  const ok = canQuote(f);
  if (!ok) warnings.push(m(`La requisición no podrá pasar a cotización (${blockReasons(f, en)}).`, `The requisition cannot move to quoting (${blockReasons(f, en)}).`));
  if (reviews.length) warnings.push(m(`La requisición ya tiene ${reviews.length} validación(es) registrada(s); esta generaría un nuevo folio interno y la anterior se conserva como historial.`, `The requisition already has ${reviews.length} recorded validation(s); this one would get a new internal folio and the previous one is kept as history.`));
  const down = [[req?.rfq_count, 'RFQ'], [req?.quote_count, m('cotización(es)', 'quote(s)')], [req?.po_count, 'OC']].filter(([x]) => Number(x) > 0).map(([x, t]) => `${x} ${t}`);
  if (down.length) warnings.push(m(`La requisición ya avanzó (${down.join(', ')}): la validación quedaría como actualización posterior.`, `The requisition already moved forward (${down.join(', ')}): the validation would be a later update.`));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, first: keys.length ? errors[keys[0]] : '', canQuote: ok };
}

/** Message after a valid "Guardar validación": nothing is written. */
export function validationLockedText(f, req, buyerName, en = false) {
  const parts = en
    ? [`technical ${tr(TECH_RESULTS, f.technical, en).toLowerCase()}`, `contractual ${tr(CONTRACT_RESULTS, f.contract, en).toLowerCase()}`, `budget ${tr(BUDGET_RESULTS, f.budget, en).toLowerCase()}`, tr(STRATEGIES, f.strategy, en).toLowerCase(), `${Number(f.minQuotes)} quote(s)`, `manager ${buyerName}`, canQuote(f) ? 'can quote' : 'blocked for quoting']
    : [`técnica ${f.technical.toLowerCase()}`, `contractual ${f.contract.toLowerCase()}`, `presupuesto ${f.budget.toLowerCase()}`, f.strategy.toLowerCase(), `${Number(f.minQuotes)} cotización(es)`, `responsable ${buyerName}`, canQuote(f) ? 'puede cotizar' : 'bloqueada para cotizar'];
  return en
    ? `Data validated, but the internal validation of ${clean(req?.folio)} was not saved (${parts.join(', ')}): recording internal validations is a write blocked until authorized.`
    : `Datos validados, pero no se guardó la validación interna de ${clean(req?.folio)} (${parts.join(', ')}): registrar validaciones internas es una escritura bloqueada hasta su autorización.`;
}

/** "Siguiente paso": only when the captured validation lets the requisition move to quoting. '' = can continue. */
export function nextStepBlock(f, en = false) {
  const m = (es, e) => (en ? e : es);
  if (!f.requisition) return m('Selecciona una requisición para continuar.', 'Select a requisition to continue.');
  if (!canQuote(f)) return m(`No puede avanzar a Estrategia y lotificación: ${blockReasons(f, en)}.`, `Cannot move to Strategy & lotting: ${blockReasons(f, en)}.`);
  return '';
}
