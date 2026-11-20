// Requisición › Crear desde historial · lógica pura (diseño del Apps Script original).
// Fuente: GET /api/v1/requisition-history/catalog?client= (política de recompra + cotizaciones al cliente aprobadas).
// La requisición NO se crea: el alta RF1 no admite origen histórico ni tratamiento por partida (requisition_items.
// history_*, repeat_client_price_mode, repeat_sourcing_mode, fixed_client_*); un endpoint propio requiere autorización.
import { SALES_POLICIES, SOURCING_POLICIES, policyCode } from '../clients/form.mjs';

export const STEPS = [
  ['1', 'Cliente', 'SupplyFlow lee su política comercial.'],
  ['2', 'Partidas', 'Selecciona cualquier combinación del historial y agrega nuevas.'],
  ['3', 'Ruta por partida', 'Precio fijo / recotizar / validar / reutilizar.'],
  ['4', 'Nuevo expediente', 'Requisición nueva → cotización cliente nueva → OC nueva.'],
];
export const DEFAULT_DESCRIPTION = 'Recompra / nueva solicitud construida desde historial';
export const PRIORITIES = [['normal', 'Normal'], ['high', 'Alta'], ['urgent', 'Crítica']];
export const CURRENCIES = ['MXN', 'USD', 'EUR'];
export const PRICE_MODES = [['fixed', 'Precio fijo (último precio al cliente)'], ['requote', 'Nuevo precio (recotizar)'], ['validate', 'Validar precio (revisión)']];
export const SOURCING_MODES = [['reuse', 'Reutilizar proveedor/costo'], ['validate', 'Validar costo/proveedor histórico'], ['requote', 'Recotizar proveedor']];
export const HISTORY_FILTERS = [['all', 'Todo el historial'], ['valid', 'Solo precios vigentes'], ['expired', 'Solo precios vencidos']];

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
export const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');
const chars = v => [...String(v ?? '')].length;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;
const QTY = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
export const label = (list, v) => (list.find(x => x[0] === v) || [v, v || '—'])[1];
export const money = (v, cur = '') => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ' ' + cur : ''}`);

export function emptyHistoryForm(day) {
  return { client_id: '', request_date: day, need_date: '', project: '', contract: '', client_reference: '', priority: 'normal', delivery_place: '', requester_name: '', requester_email: '', currency: 'MXN', budget: '', description: DEFAULT_DESCRIPTION };
}

const addDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Validity of a historical price under the client policy (price_validity_days: null = sin definir, 0 = sin vencimiento). */
export function validity(entry, policy, day) {
  const days = policy?.price_validity_days;
  const date = entry?.quote_date ? String(entry.quote_date).slice(0, 10) : '';
  if (days === null || days === undefined || !date) return { state: 'undefined', label: 'Sin vigencia definida', until: null };
  if (Number(days) === 0) return { state: 'valid', label: 'Vigente (sin vencimiento por días)', until: null };
  const until = addDays(date, Number(days));
  return until >= day ? { state: 'valid', label: `Vigente hasta ${until}`, until } : { state: 'expired', label: `Vencido el ${until}`, until };
}

/** Default per-line route from the client policy. Unknown or legacy policy values fall back to "validar". */
export function policyDefaults(policy, day) {
  const sales = policyCode(policy?.sales_policy, SALES_POLICIES), sourcing = policyCode(policy?.sourcing_policy, SOURCING_POLICIES);
  const contractOk = !policy?.contract_valid_until || String(policy.contract_valid_until).slice(0, 10) >= day;
  const price = { guaranteed: 'fixed', contract: contractOk ? 'fixed' : 'validate', quote_required: 'requote', manual: 'validate', mixed: 'fixed' }[sales] || 'validate';
  const supply = { requote_always: 'requote', validate_history: 'validate', reuse_if_valid: 'reuse' }[sourcing] || 'validate';
  const known = !!SALES_POLICIES.find(p => p[0] === sales) && !!SOURCING_POLICIES.find(p => p[0] === sourcing);
  return { price, sourcing: supply, known, sales, sourcingCode: sourcing, contractOk };
}

/** Why a route is not allowed for a line (null = allowed). */
export function modeBlock(line, kind, mode, policy, day) {
  const isNew = line.origin === 'new', last = line.last || {}, v = isNew ? null : validity(last, policy, day);
  if (kind === 'price') {
    if (isNew) return mode === 'requote' ? null : 'Las partidas nuevas requieren nuevo precio comercial.';
    if (mode === 'fixed' && !(Number(last.unit_price) > 0)) return 'Sin precio histórico al cliente.';
    if (mode === 'fixed' && v.state === 'expired') return `Precio histórico vencido (${v.label.toLowerCase()}).`;
    return null;
  }
  if (isNew) return mode === 'requote' ? null : 'Las partidas nuevas requieren cotización de proveedor.';
  if (mode !== 'requote' && !clean(last.supplier)) return 'Sin proveedor adjudicado en el historial.';
  if (mode === 'reuse' && !(Number(last.cost) > 0)) return 'Sin costo histórico registrado.';
  if (mode === 'reuse' && v.state === 'expired') return `Costo histórico vencido (${v.label.toLowerCase()}).`;
  return null;
}

/** New selected line from a historical article, applying the policy defaults and falling back when not allowed. */
export function lineFromHistory(article, policy, day) {
  const d = policyDefaults(policy, day);
  const line = { key: `h:${article.key}`, origin: 'history', description: article.description, brand_model: article.brand_model || '', unit: article.unit || '', category: article.category || '',
    quantity: article.last?.quantity ? String(Number(article.last.quantity)) : '', last: article.last, occurrences: article.occurrences };
  line.price_mode = modeBlock(line, 'price', d.price, policy, day) ? (Number(article.last?.unit_price) > 0 ? 'validate' : 'requote') : d.price;
  line.sourcing_mode = modeBlock(line, 'sourcing', d.sourcing, policy, day) ? (clean(article.last?.supplier) ? 'validate' : 'requote') : d.sourcing;
  return line;
}
let seq = 0;
export function newLine(item) {
  return { key: `n:${++seq}`, origin: 'new', description: clean(item.description), brand_model: '', unit: clean(item.unit), category: item.category, quantity: String(item.quantity).trim(), last: null, price_mode: 'requote', sourcing_mode: 'requote' };
}
export function newItemError(item, activeCategories = []) {
  if (!clean(item.description) || !clean(item.unit) || !item.category || !QTY.test(String(item.quantity).trim()) || Number(item.quantity) <= 0) return 'Completa descripción, cantidad, unidad y categoría de la partida.';
  if (activeCategories.length && !activeCategories.includes(item.category)) return 'Selecciona una categoría activa del catálogo.';
  return null;
}

/** Non-blocking consequences per line (currency, margin and policy conflicts). */
export function lineWarnings(line, form, policy, day) {
  if (line.origin === 'new') return [];
  const out = [], last = line.last || {}, d = policyDefaults(policy, day), n = `«${line.description}»`;
  if (line.price_mode === 'fixed' && last.currency && last.currency !== form.currency) out.push(`${n}: el precio histórico está en ${last.currency} y la requisición en ${form.currency}; requerirá conversión.`);
  const min = policy?.min_margin_pct;
  if (line.price_mode === 'fixed' && min !== null && min !== undefined && Number(last.unit_price) > 0 && Number(last.cost) > 0) {
    const margin = (Number(last.unit_price) - Number(last.cost)) / Number(last.unit_price) * 100;
    if (margin < Number(min)) out.push(`${n}: el margen histórico (${margin.toFixed(1)}%) es menor al mínimo de la política (${Number(min)}%).`);
  }
  if (line.price_mode === 'fixed' && d.sales === 'quote_required') out.push(`${n}: la política del cliente pide nueva cotización; justifica por qué se respeta el precio.`);
  if (line.price_mode === 'requote' && d.sales === 'guaranteed') out.push(`${n}: la política garantiza el precio al cliente; recotizar puede cambiarlo.`);
  if (line.price_mode === 'fixed' && validity(last, policy, day).state === 'undefined') out.push(`${n}: el cliente no tiene vigencia de precio definida; confirma que el precio sigue aplicando.`);
  return out;
}

export function filterArticles(items, { query = '', category = '', state = 'all' } = {}, policy, day) {
  const q = fold(query), cat = fold(category);
  return (items || []).filter(a => (!cat || fold(a.category) === cat)
    && (state === 'all' || validity(a.last, policy, day).state === state)
    && (!q || [a.description, a.brand_model, a.category, a.last?.requisition_folio, a.last?.quote_folio, a.last?.supplier, ...(a.history || []).map(h => `${h.quote_folio} ${h.requisition_folio} ${h.supplier || ''}`)].some(v => fold(v).includes(q))));
}

export function routeSummary(lines) {
  const s = { total: lines.length, history: 0, fresh: 0, fixed: 0, requote: 0, validate: 0, reuse: 0, supplierRequote: 0, supplierValidate: 0 };
  for (const l of lines) {
    s[l.origin === 'new' ? 'fresh' : 'history']++;
    s[l.price_mode]++;
    if (l.sourcing_mode === 'reuse') s.reuse++; else if (l.sourcing_mode === 'requote') s.supplierRequote++; else s.supplierValidate++;
  }
  return s;
}

const validDate = v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false; const [y, m, d] = v.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return y >= 1000 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
const text = (v, max, required, name) => { const s = String(v ?? '').trim(); if (required && !s) return `Captura ${name}.`; if (chars(s) > max || CONTROL.test(s)) return `${name[0].toUpperCase()}${name.slice(1)} admite hasta ${max.toLocaleString('es-MX')} caracteres sin caracteres de control.`; return null; };

/** First blocking error (Spanish) or null. Mirrors RequisitionRecoveryInput for the general data plus the per-line routes. */
export function validateHistoryRequisition(form, lines, { policy, day, activeCategories = [] } = {}) {
  if (!form.client_id) return 'Selecciona el cliente.';
  if (!validDate(form.request_date)) return 'Captura una fecha de solicitud válida.';
  if (!validDate(form.need_date)) return 'Captura la fecha requerida.';
  if (form.need_date < form.request_date) return 'La fecha requerida no puede ser anterior a la fecha de solicitud.';
  for (const [k, max, req, name] of [['project', 255, true, 'el proyecto'], ['contract', 255, true, 'el contrato'], ['client_reference', 255, false, 'la referencia del cliente'], ['delivery_place', 16000, true, 'el lugar de entrega'], ['requester_name', 255, true, 'el solicitante'], ['description', 16000, false, 'la descripción general']]) {
    const e = text(form[k], max, req, name); if (e) return e;
  }
  const email = String(form.requester_email || '').trim();
  if (!email) return 'Captura el correo del solicitante.';
  if (chars(email) > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return 'Captura un correo válido del solicitante.';
  if (!PRIORITIES.some(p => p[0] === form.priority) || !CURRENCIES.includes(form.currency)) return 'Prioridad o moneda no válida.';
  if (String(form.budget ?? '').trim() !== '' && !QTY.test(String(form.budget).trim())) return 'El presupuesto debe ser un número sin separadores y con hasta seis decimales.';
  if (!lines.length) return 'Agrega al menos una partida desde el historial o captura una nueva.';
  if (lines.length > 1000) return 'Límite técnico: 1000 partidas.';
  for (const [i, l] of lines.entries()) {
    const n = `Partida ${i + 1} («${clean(l.description).slice(0, 60)}»)`;
    if (!clean(l.description) || chars(l.description) > 16000) return `${n}: descripción requerida.`;
    if (!QTY.test(String(l.quantity).trim()) || Number(l.quantity) <= 0) return `${n}: captura una cantidad mayor a cero (hasta seis decimales).`;
    if (!clean(l.unit) || chars(l.unit) > 128) return `${n}: captura la unidad.`;
    if (!clean(l.category)) return `${n}: sin categoría; captúrala como partida nueva con una categoría del catálogo.`;
    if (activeCategories.length && !activeCategories.some(c => fold(c) === fold(l.category))) return `${n}: la categoría «${l.category}» no está activa en el catálogo.`;
    const pb = modeBlock(l, 'price', l.price_mode, policy, day); if (pb) return `${n}: ${pb}`;
    const sb = modeBlock(l, 'sourcing', l.sourcing_mode, policy, day); if (sb) return `${n}: ${sb}`;
  }
  return null;
}

export function createLockedText(form, lines, clientName) {
  const s = routeSummary(lines);
  return `Datos validados, pero no se creó la requisición nueva para «${clientName || 'el cliente'}» (${s.total} partida(s): ${s.history} del historial y ${s.fresh} nueva(s); precio fijo ${s.fixed}, recotizar ${s.requote}, validar ${s.validate}; proveedor reutilizado ${s.reuse}). SupplyFlow aún no tiene endpoint para crear requisiciones desde historial: el alta de Registro de requisición no guarda el origen histórico ni el tratamiento por partida, por eso no se usó para no perderlos. Habilitarlo requiere tu autorización.`;
}
