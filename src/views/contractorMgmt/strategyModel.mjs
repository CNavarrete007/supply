// Gestión del Contratista · tarjeta 2 "Estrategia y lotificación" · lógica pura (sin red).
// Datos: GET /api/v1/contractor-management/strategy-setup (requisiciones con validación vigente y catálogo de proveedores
// con su categoría y las categorías de sus suministros) y GET /strategy/{id} (partidas, plan de lotificación vigente
// —sourcing_plans / sourcing_lots / sourcing_lot_items / sourcing_lot_suppliers— y RFQ por lote). Guardar la estrategia,
// los lotes o abrir una RFQ desde aquí son escrituras sin endpoint: se valida todo y se informa que no se guardó.
import { canQuote, blockReasons } from './validationForm.mjs';

export const ITEM_STRATEGIES = [['Competencia abierta', 'Open competition'], ['Proveedor preferente', 'Preferred supplier'], ['Fuente única justificada', 'Justified sole source'],
  ['Precio histórico auto', 'Automatic historical price'], ['Compra urgente', 'Urgent purchase']];
export const NO_RFQ = 'Precio histórico auto';
const STATUS = { authorized: ['Autorizado', 'Authorized'], active: ['Activo', 'Active'], under_evaluation: ['En evaluación', 'Under evaluation'], suspended: ['Suspendido', 'Suspended'], inactive: ['Inactivo', 'Inactive'], blocked: ['Bloqueado', 'Blocked'] };

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
const int = v => (/^\d{1,2}$/.test(clean(v)) ? Number(v) : null);

export const isAuthorized = s => ['authorized', 'active'].includes(clean(s?.status));
export const isAssignable = s => !!s && !['suspended', 'inactive', 'blocked'].includes(clean(s.status));
export const statusLabel = (s, en = false) => (en ? STATUS[clean(s?.status)]?.[1] : clean(s?.legacy_status) || STATUS[clean(s?.status)]?.[0]) || clean(s?.status) || '—';
export const routeOf = (strategy, en = false) => (strategy === NO_RFQ ? { code: 'history', text: en ? 'Historical price (no RFQ)' : 'Precio histórico (sin RFQ)' } : { code: 'rfq', text: en ? 'RFQ per lot' : 'RFQ por lote' });
const needsRfq = (state, id) => (state.items[id]?.strategy || '') !== NO_RFQ;

/** Validated requisition selector: "FOLIO · CLIENTE · PROYECTO"; blocked validations are disabled with the reason. */
export function requisitionOptions(reqs = [], en = false) {
  return reqs.map(r => {
    const v = { technical: r.technical, contract: r.contract_result, budget: r.budget };
    const ok = canQuote(v);
    return { id: r.id, disabled: !ok, label: `${clean(r.folio)} · ${clean(r.client_name).toUpperCase()} · ${clean(r.project).toUpperCase() || '—'}${ok ? '' : ` — ${en ? 'blocked' : 'bloqueada'}: ${blockReasons(v, en)}`}` };
  }).sort((a, b) => Number(a.disabled) - Number(b.disabled));
}

/** Authorized suppliers whose category or registered supplies match one of the categories (accent/case-insensitive). */
export function suggestedFor(categories = [], suppliers = []) {
  const want = new Set(categories.map(fold).filter(Boolean));
  if (!want.size) return [];
  return suppliers.filter(s => isAuthorized(s) && [s.category, ...(s.offering_categories || [])].some(c => want.has(fold(c)))).map(s => s.id);
}

/** Default strategy of a line: historical price when the line comes from history, else the validation strategy. */
export function defaultStrategy(item, review) {
  if (item?.history_based || item?.fixed_client_price || /hist/i.test(clean(item?.repeat_sourcing_mode))) return NO_RFQ;
  return ITEM_STRATEGIES.some(s => s[0] === review?.strategy) ? review.strategy : 'Competencia abierta';
}

const lotName = c => clean(c) || 'Sin categoría';

/** "Agrupar automáticamente por categoría": one lot per category of the lines that need RFQ, suggested suppliers preselected. */
export function autoGroup(state, items = [], suppliers = [], keepLots = []) {
  const groups = new Map();
  for (const i of items) if (needsRfq(state, i.id)) { const n = lotName(i.category); if (!groups.has(fold(n))) groups.set(fold(n), { name: n, ids: [] }); groups.get(fold(n)).ids.push(i.id); }
  const prior = [...state.lots, ...keepLots];
  let seq = 0;
  const lots = [...groups.values()].map(g => {
    const old = prior.find(l => fold(l.name) === fold(g.name));
    const sug = suggestedFor([g.name], suppliers);
    const manual = (old?.suppliers || []).filter(s => !s.suggested && !sug.includes(s.id));
    return { key: old?.key || `N${++seq}`, name: old?.name || g.name, minQuotes: old?.minQuotes || clean(state.minQuotes) || '3', persisted: !!old?.persisted,
      suppliers: [...sug.map(id => ({ id, selected: old ? (old.suppliers.find(s => s.id === id)?.selected ?? true) : true, suggested: true })), ...manual] };
  });
  const itemsState = { ...state.items };
  for (const g of groups.values()) { const l = lots.find(x => fold(x.name) === fold(g.name)); for (const id of g.ids) itemsState[id] = { ...itemsState[id], lot: l.key }; }
  return { ...state, lots, items: itemsState };
}

/** Initial state: the registered plan when it exists; otherwise the proposal grouped by category. */
export function initialState(detail, suppliers = []) {
  const review = detail?.item || {};
  const items = detail?.items || [];
  const plan = detail?.plan;
  const st = { minQuotes: String(plan?.min_quotes ?? review.min_quotes ?? 3), items: {}, lots: [], fromPlan: !!plan };
  for (const i of items) st.items[i.id] = { strategy: defaultStrategy(i, review), lot: '' };
  if (plan) {
    st.lots = plan.lots.map(l => ({ key: l.key, name: l.name, minQuotes: String(l.min_quotes), persisted: true, suppliers: l.suppliers.map(s => ({ id: s.id, selected: !!s.selected, suggested: !!s.suggested })) }));
    for (const l of plan.lots) for (const it of l.items) if (st.items[it.id]) st.items[it.id] = { strategy: ITEM_STRATEGIES.some(s => s[0] === it.strategy) ? it.strategy : st.items[it.id].strategy, lot: l.key };
    return st;
  }
  return autoGroup(st, items, suppliers);
}

export function addLot(state) {
  let n = state.lots.length + 1; while (state.lots.some(l => fold(l.name) === fold(`Lote ${n}`))) n += 1;
  let k = 1; while (state.lots.some(l => l.key === `N${k}`)) k += 1;
  return { ...state, lots: [...state.lots, { key: `N${k}`, name: `Lote ${n}`, minQuotes: clean(state.minQuotes) || '3', persisted: false, suppliers: [] }] };
}

/** "Actualizar proveedores sugeridos": recompute per lot from its lines' categories; manual suppliers are kept. */
export function refreshSuggestions(state, items = [], suppliers = []) {
  return { ...state, lots: state.lots.map(l => {
    const cats = items.filter(i => state.items[i.id]?.lot === l.key && needsRfq(state, i.id)).map(i => lotName(i.category));
    const sug = suggestedFor(cats, suppliers);
    const kept = l.suppliers.filter(s => !sug.includes(s.id) && (!s.suggested || s.selected)).map(s => ({ ...s, suggested: false }));
    return { ...l, suppliers: [...sug.map(id => ({ id, selected: l.suppliers.find(s => s.id === id)?.selected ?? true, suggested: true })), ...kept] };
  }) };
}

export const setItem = (state, id, patch) => {
  const next = { ...state.items[id], ...patch };
  if (next.strategy === NO_RFQ) next.lot = '';
  return { ...state, items: { ...state.items, [id]: next } };
};
export const setLot = (state, key, patch) => ({ ...state, lots: state.lots.map(l => (l.key === key ? { ...l, ...patch } : l)) });
export const toggleSupplier = (state, key, id) => setLot(state, key, { suppliers: state.lots.find(l => l.key === key).suppliers.map(s => (s.id === id ? { ...s, selected: !s.selected } : s)) });
export const selectSuggested = (state, key) => setLot(state, key, { suppliers: state.lots.find(l => l.key === key).suppliers.map(s => (s.suggested ? { ...s, selected: true } : s)) });
export function addSupplier(state, key, id) {
  const l = state.lots.find(x => x.key === key);
  if (!id || !l || l.suppliers.some(s => s.id === id)) return state;
  return setLot(state, key, { suppliers: [...l.suppliers, { id, selected: true, suggested: false }] });
}
export const removeLot = (state, key) => ({ ...state, lots: state.lots.filter(l => l.key !== key), items: Object.fromEntries(Object.entries(state.items).map(([id, v]) => [id, v.lot === key ? { ...v, lot: '' } : v])) });

/** RFQs already created per lot (registered plan) → { [lotKey]: [{ folio, supplier_id }] }. */
export const rfqsByLot = detail => Object.fromEntries((detail?.plan?.lots || []).map(l => [l.key, l.rfqs || []]));

/** Card of a lot: its lines, lines needing RFQ, selected suppliers and RFQs created for them. */
export function lotView(state, lot, items = [], rfqs = {}) {
  const lines = items.filter(i => state.items[i.id]?.lot === lot.key);
  const selected = lot.suppliers.filter(s => s.selected);
  const created = new Set((rfqs[lot.key] || []).map(r => r.supplier_id));
  return { lines, rfqLines: lines.filter(i => needsRfq(state, i.id)).length, selected: selected.length, created: selected.filter(s => created.has(s.id)).length,
    pending: selected.filter(s => !created.has(s.id)).length, createdIds: created };
}

/** Top metrics: lines, lots, distinct selected suppliers, lines without RFQ and pending RFQs. */
export function strategyStats(state, items = [], rfqs = {}) {
  const sup = new Set(); let pending = 0;
  for (const l of state.lots) { const v = lotView(state, l, items, rfqs); if (!v.lines.length) continue; l.suppliers.filter(s => s.selected).forEach(s => sup.add(s.id)); pending += v.pending; }
  return { items: items.length, lots: state.lots.filter(l => lotView(state, l, items, rfqs).lines.length).length, suppliers: sup.size, noRfq: items.filter(i => !needsRfq(state, i.id)).length, pending };
}

/** { ok, errors, warnings, lotErrors, lineErrors, first }. ctx: { detail, suppliers }. */
export function validateStrategy(state, { detail = null, suppliers = [] } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = []; const lotErrors = {}; const lineErrors = {};
  if (!detail) { errors.requisition = m('Selecciona una requisición validada.', 'Select a validated requisition.'); return { ok: false, errors, warnings, lotErrors, lineErrors, first: errors.requisition }; }
  const rv = detail.item; const items = detail.items || []; const rfqs = rfqsByLot(detail);
  const v = { technical: rv.technical, contract: rv.contract_result, budget: rv.budget };
  if (!canQuote(v)) errors.requisition = m(`La requisición no puede pasar a cotización: ${blockReasons(v, en)}.`, `The requisition cannot move to quoting: ${blockReasons(v, en)}.`);
  const g = int(state.minQuotes);
  if (g === null || g < 1 || g > 20) errors.minQuotes = m('Mínimo general de cotizaciones: número entero de 1 a 20.', 'General minimum of quotes: whole number from 1 to 20.');
  for (const i of items) {
    const s = state.items[i.id] || {};
    if (!ITEM_STRATEGIES.some(x => x[0] === s.strategy)) lineErrors[i.id] = m('Selecciona la estrategia.', 'Select the strategy.');
    else if (s.strategy !== NO_RFQ && !state.lots.some(l => l.key === s.lot)) lineErrors[i.id] = m('Asigna la partida a un lote.', 'Assign the line to a lot.');
    if (s.strategy === NO_RFQ && !(i.history_based || i.fixed_client_price || /hist/i.test(clean(i.repeat_sourcing_mode)))) warnings.push(m(`Partida #${i.line_number}: "Precio histórico auto" sin historial registrado en la partida; confirma el precio de referencia.`, `Line #${i.line_number}: "Automatic historical price" without recorded history on the line; confirm the reference price.`));
    if ((i.sent || []).length && s.strategy !== NO_RFQ) warnings.push(m(`Partida #${i.line_number} ya se envió en ${i.sent.map(x => x.rfq).join(', ')}.`, `Line #${i.line_number} was already sent in ${i.sent.map(x => x.rfq).join(', ')}.`));
  }
  if (Object.keys(lineErrors).length) errors.items = m('Revisa las partidas marcadas: cada partida que requiere RFQ debe tener estrategia y lote.', 'Check the marked lines: every line that needs an RFQ must have a strategy and a lot.');
  const names = new Map();
  for (const l of state.lots) {
    const lv = lotView(state, l, items, rfqs);
    if (!lv.lines.length) { warnings.push(m(`${clean(l.name) || l.key}: sin partidas asignadas; no se considerará.`, `${clean(l.name) || l.key}: no lines assigned; it will be ignored.`)); continue; }
    const e = [];
    const n = fold(l.name);
    if (!n) e.push(m('Nombre del lote obligatorio.', 'Lot name required.'));
    else if (clean(l.name).length > 255) e.push(m('Nombre: máximo 255 caracteres.', 'Name: maximum 255 characters.'));
    else if (names.has(n)) e.push(m('Nombre de lote repetido.', 'Duplicated lot name.'));
    names.set(n, true);
    const q = int(l.minQuotes);
    if (q === null || q < 1 || q > 20) e.push(m('Mínimo de cotizaciones: 1 a 20.', 'Minimum of quotes: 1 to 20.'));
    const sel = l.suppliers.filter(s => s.selected).map(s => suppliers.find(x => x.id === s.id) || { id: s.id, name: s.id, status: '' });
    if (!sel.length && lv.rfqLines) e.push(m('Selecciona al menos un proveedor.', 'Select at least one supplier.'));
    const bad = sel.filter(s => !isAssignable(s));
    if (bad.length) e.push(m(`Proveedor no asignable (${bad.map(s => `${s.name}: ${statusLabel(s, en).toLowerCase()}`).join(', ')}).`, `Supplier not assignable (${bad.map(s => `${s.name}: ${statusLabel(s, en).toLowerCase()}`).join(', ')}).`));
    if (e.length) lotErrors[l.key] = e.join(' ');
    if (q !== null && sel.length && sel.length < q) warnings.push(m(`${clean(l.name)}: hay ${sel.length} proveedor(es) seleccionado(s) y el mínimo configurado es ${q}. Puedes guardar, pero documenta la excepción si continúas así.`, `${clean(l.name)}: ${sel.length} supplier(s) selected and the configured minimum is ${q}. You can save, but document the exception if you continue this way.`));
    const unauth = sel.filter(s => isAssignable(s) && !isAuthorized(s));
    if (unauth.length) warnings.push(m(`${clean(l.name)}: ${unauth.map(s => `${s.name} (${statusLabel(s, en).toLowerCase()})`).join(', ')} no está autorizado.`, `${clean(l.name)}: ${unauth.map(s => `${s.name} (${statusLabel(s, en).toLowerCase()})`).join(', ')} is not authorized.`));
    if (lv.lines.some(i => state.items[i.id]?.strategy === 'Fuente única justificada') && sel.length > 1) warnings.push(m(`${clean(l.name)}: incluye partidas de fuente única con ${sel.length} proveedores seleccionados.`, `${clean(l.name)}: includes sole-source lines with ${sel.length} selected suppliers.`));
  }
  if (Object.keys(lotErrors).length) errors.lots = m('Revisa los lotes marcados.', 'Check the marked lots.');
  if (!state.lots.length && items.some(i => needsRfq(state, i.id))) errors.lots = m('Crea al menos un lote para las partidas que requieren RFQ.', 'Create at least one lot for the lines that need an RFQ.');
  if (rv.has_po) warnings.push(m('La requisición ya tiene orden de compra: cambiar la estrategia no modifica las RFQ ni las OC existentes.', 'The requisition already has a purchase order: changing the strategy does not modify existing RFQs or POs.'));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, lotErrors, lineErrors, first: keys.length ? errors[keys[0]] : '' };
}

/** Message after a valid "Guardar estrategia": nothing is written. */
export function strategyLockedText(state, detail, en = false) {
  const items = detail?.items || []; const s = strategyStats(state, items, rfqsByLot(detail));
  const rfqLines = items.length - s.noRfq;
  return en
    ? `Data validated, but the strategy of ${clean(detail?.item?.folio)} was not saved (${s.lots} lot(s), ${s.suppliers} selected supplier(s), ${rfqLines} line(s) by RFQ and ${s.noRfq} by historical price): recording strategies, lots and suppliers is a write blocked until authorized.`
    : `Datos validados, pero no se guardó la estrategia de ${clean(detail?.item?.folio)} (${s.lots} lote(s), ${s.suppliers} proveedor(es) seleccionado(s), ${rfqLines} partida(s) por RFQ y ${s.noRfq} por precio histórico): registrar estrategias, lotes y proveedores es una escritura bloqueada hasta su autorización.`;
}

/** Next RFQ of a lot: first selected supplier without an RFQ in that lot. → { lot, supplier, lines } | { error } */
export function nextRfq(state, key, { detail = null, suppliers = [] } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const lot = state.lots.find(l => l.key === key);
  if (!detail || !lot) return { error: m('Selecciona una requisición validada.', 'Select a validated requisition.') };
  const v = lotView(state, lot, detail.items || [], rfqsByLot(detail));
  const lines = v.lines.filter(i => needsRfq(state, i.id));
  if (!lines.length) return { error: m(`${clean(lot.name)}: no tiene partidas que requieran RFQ.`, `${clean(lot.name)}: it has no lines that need an RFQ.`) };
  const next = lot.suppliers.find(s => s.selected && !v.createdIds.has(s.id));
  if (!next) return { error: lot.suppliers.some(s => s.selected) ? m(`${clean(lot.name)}: todas las RFQ de los proveedores seleccionados ya están creadas.`, `${clean(lot.name)}: every RFQ for the selected suppliers is already created.`) : m(`${clean(lot.name)}: selecciona al menos un proveedor.`, `${clean(lot.name)}: select at least one supplier.`) };
  const sup = suppliers.find(x => x.id === next.id) || { name: next.id };
  return { lot, supplier: sup, lines };
}

export function nextRfqText(n, folio, en = false) {
  const parts = n.lines.map(i => `#${i.line_number}`).join(', ');
  return en
    ? `Next RFQ of lot "${clean(n.lot.name)}" for ${clean(folio)}: ${clean(n.supplier.name)} with ${n.lines.length} line(s) (${parts}). It was not opened: the strategy is not saved and creating RFQs from here is a write blocked until authorized; RFQs are issued in Quotes → Supplier request (RFQ).`
    : `Siguiente RFQ del lote «${clean(n.lot.name)}» de ${clean(folio)}: ${clean(n.supplier.name)} con ${n.lines.length} partida(s) (${parts}). No se abrió: la estrategia no está guardada y crear RFQ desde aquí es una escritura bloqueada hasta su autorización; las RFQ se emiten en Cotizaciones → Solicitud a proveedores (RFQ).`;
}
