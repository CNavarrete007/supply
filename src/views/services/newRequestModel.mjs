// Servicios Operativos · sección 2 "Nueva solicitud" (asistente del original: 1 · Operación, 2 · Servicio, 3 · Requisición).
// Lógica pura (sin React) para poder probarla con node --test. El servidor sigue siendo la autoridad:
//  · Folio "⚙ Generar": GET /api/v1/recovery/folio (regla del original {NÚMERO DE CLIENTE}-REQ-{AÑO}-{0000}).
//  · Referencia "⚙ Generar": GET /api/v1/services/new-request/reference (SRV-{PROYECTO}-{AÑO}-{0000}).
//  · Disponibilidad del folio: GET /api/v1/services/new-request/availability.
// Las reglas se derivaron de las requisiciones de servicio que el sistema original ya creó (route_code 'service',
// tipo de servicio, una partida "1 servicio" con la categoría del tipo). La creación queda BLOQUEADA: el alta RF1
// existente fija route_code 'supply' y no admite tipo de servicio, y no hay endpoint de escritura autorizado para
// la requisición maestra de servicio ni para su expediente (service_orders).

export const OPERATIONS = [
  { id: 'purchase', icon: '📦', es: 'Compra / renta', en: 'Purchase / rental',
    descEs: 'Continúa al flujo actual: requisición, cotización, comparativo, aprobación, OC, recepción, entrega y factura.',
    descEn: 'Continues the current flow: requisition, quote, comparison, approval, PO, receiving, delivery and invoice.' },
  { id: 'service', icon: '🚛', es: 'Servicio', en: 'Service',
    descEs: 'Agua, transporte, Rise X, grúa, montacargas, gasolina, Last Mile u otro servicio operativo/administrativo.',
    descEn: 'Water, transport, Rise X, crane, forklift, fuel, Last Mile or another operational/administrative service.' },
];

// Los 9 servicios del asistente original (mismo orden e íconos del diseño).
export const SERVICE_OPTIONS = [
  { key: 'agua', label: 'Suministro de agua', icon: '💧' },
  { key: 'transporte', label: 'Transporte', icon: '🚚' },
  { key: 'transporte_personal', label: 'Transporte de personal', icon: '🚚' },
  { key: 'rise_x', label: 'Gestión Rise X', icon: '🔐' },
  { key: 'grua', label: 'Servicio de grúa', icon: '🏗️' },
  { key: 'montacargas', label: 'Montacargas', icon: '🚜' },
  { key: 'gasolina', label: 'Recarga de gasolina', icon: '⛽' },
  { key: 'last_mile', label: 'Last Mile Deliveries', icon: '📍' },
  { key: 'otro', label: 'Otro servicio', icon: '🧩' },
];

export const STEPS = [['1 · Operación', '1 · Operation'], ['2 · Servicio', '2 · Service'], ['3 · Requisición', '3 · Requisition']];

export const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const chars = s => [...String(s ?? '')].length;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const LINE_CONTROL = /[\x00-\x1f\x7f]/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function validDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= '1000-01-01';
}

export function localToday(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Los 9 servicios del original vinculados por nombre a service_types de MariaDB (los códigos difieren entre bases),
 *  más los tipos activos de MariaDB que no estén en la lista del original. */
export function serviceOptions(types = []) {
  const byName = new Map(types.map(t => [fold(t.name), t]));
  const used = new Set();
  const out = SERVICE_OPTIONS.map(o => {
    const t = byName.get(fold(o.label));
    if (t) used.add(fold(t.name));
    return { ...o, code: t?.code ?? null, active: t ? !!t.active : null, inCatalog: !!t };
  });
  for (const t of types) {
    if (!t.active || used.has(fold(t.name))) continue;
    out.push({ key: `db:${t.code}`, label: t.name, icon: '🧩', code: t.code, active: true, inCatalog: true });
  }
  return out;
}

export const clientLabel = c => (c ? (c.code ? `${c.code} · ${c.name}` : c.name) : '');

/** Búsqueda del selector del original: número, razón social, RFC o nombre comercial. */
export function filterClients(clients = [], q = '') {
  const n = fold(q);
  const list = [...clients].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
  if (!n) return list;
  return list.filter(c => fold([c.code, c.name, c.tax_id, c.brand_name].join(' ')).includes(n));
}

export function emptyRequest(today = localToday()) {
  return { client_id: '', folio: '', reference: '', project: '', contract: '', request_date: today, need_date: '',
    requester_name: '', requester_email: '', place: '', description: '' };
}

const PREFILL = [['project', 'project'], ['contract', 'contract'], ['requester_name', 'contact'], ['requester_email', 'email']];

/** Selecciona el cliente y precarga proyecto, contrato, solicitante y correo de su ficha: solo sustituye los campos
 *  vacíos o los que aún conservan el valor precargado del cliente anterior (no pisa lo capturado a mano).
 *  Si el folio había sido generado para otro cliente, se limpia (su número de cliente ya no corresponde). */
export function applyClient(form, client, previous = null, generatedFolio = '') {
  const next = { ...form, client_id: client?.id || '' };
  for (const [key, from] of PREFILL) {
    const prior = previous ? String(previous[from] || '') : '';
    if (!String(form[key] || '').trim() || (previous && form[key] === prior)) next[key] = client?.[from] || '';
  }
  if (generatedFolio && form.folio === generatedFolio && previous?.id !== client?.id) next.folio = '';
  return next;
}

const FIELD_LIMITS = { folio: 128, reference: 255, project: 255, contract: 255, requester_name: 255, requester_email: 254, place: 16000, description: 16000 };

/** Primer error bloqueante → { field, message }; null si la captura es válida. */
export function validateRequest(form, { clients = [], option = null, en = false } = {}) {
  const tx = (es, e) => (en ? e : es);
  const bad = (field, es, e) => ({ field, message: tx(es, e) });
  if (!option) return bad('service', 'Regresa al paso 2 y selecciona el servicio que se realizará.', 'Go back to step 2 and select the service.');
  if (!form.client_id || !clients.some(c => c.id === form.client_id)) return bad('client_id', 'Selecciona el cliente.', 'Select the client.');
  const v = k => String(form[k] ?? '').trim();
  if (!v('folio')) return bad('folio', 'Captura el folio / requisición del cliente o usa ⚙ Generar.', 'Enter the client folio / requisition or use ⚙ Generate.');
  for (const [k, max] of Object.entries(FIELD_LIMITS)) {
    const multi = k === 'place' || k === 'description';
    if (chars(v(k)) > max || (multi ? CONTROL : LINE_CONTROL).test(v(k))) return bad(k, `El campo admite hasta ${max.toLocaleString('es-MX')} caracteres sin caracteres de control.`, `The field accepts up to ${max} characters without control characters.`);
  }
  if (!v('project')) return bad('project', 'Captura el proyecto / instalación.', 'Enter the project / site.');
  if (!validDate(form.request_date)) return bad('request_date', 'Captura una fecha de solicitud válida.', 'Enter a valid request date.');
  if (form.need_date && !validDate(form.need_date)) return bad('need_date', 'La fecha requerida no es válida.', 'The required date is not valid.');
  if (!v('requester_name')) return bad('requester_name', 'Captura el nombre del solicitante del cliente.', "Enter the client's requester name.");
  if (!v('requester_email')) return bad('requester_email', 'Captura el correo del solicitante.', "Enter the requester's email.");
  if (!EMAIL.test(v('requester_email'))) return bad('requester_email', 'Captura un correo válido del solicitante.', 'Enter a valid requester email.');
  return null;
}

/** Avisos no bloqueantes (se muestran en el resumen validado). */
export function requestWarnings(form, { client = null, option = null, availability = null, en = false } = {}) {
  const tx = (es, e) => (en ? e : es);
  const out = [];
  if (form.need_date && validDate(form.need_date) && validDate(form.request_date) && form.need_date < form.request_date)
    out.push(tx('La fecha requerida es anterior a la fecha de solicitud.', 'The required date is earlier than the request date.'));
  if (client && client.status && client.status !== 'active')
    out.push(tx(`El cliente tiene estatus "${client.status}" en el catálogo de clientes.`, `The client has status "${client.status}" in the client catalog.`));
  if (option && !option.inCatalog)
    out.push(tx(`"${option.label}" no existe en el catálogo service_types de MariaDB: se registraría como tipo de servicio de origen (legacy).`, `"${option.label}" is not in the MariaDB service_types catalog: it would be stored as a legacy service type.`));
  else if (option && option.active === false)
    out.push(tx(`"${option.label}" figura como inactivo en service_types (tipo observado en datos importados).`, `"${option.label}" is inactive in service_types (type observed in imported data).`));
  const used = availability?.reference && !availability.reference.available ? availability.reference.used_by || [] : [];
  if (used.length) out.push(tx(`La referencia interna ya se usa en: ${used.join(', ')}.`, `The internal reference is already used by: ${used.join(', ')}.`));
  if (!String(form.reference || '').trim()) out.push(tx('Sin referencia interna: puedes generarla con ⚙ Generar (SRV-PROYECTO-AÑO-0000).', 'No internal reference: you can generate one with ⚙ Generate (SRV-PROJECT-YEAR-0000).'));
  return out;
}

/** Folio ocupado → error bloqueante (requisitions.folio es único por organización). */
export function folioTakenError(availability, en = false) {
  const f = availability?.folio;
  if (!f || f.available) return null;
  return { field: 'folio', message: en
    ? `Folio ${f.requisition} already exists in Request / Requisition${f.client_code ? ` (client ${f.client_code})` : ''}. Enter another one or use ⚙ Generate.`
    : `El folio ${f.requisition} ya existe en Solicitud / Requisición${f.client_code ? ` (cliente ${f.client_code})` : ''}. Captura otro o usa ⚙ Generar.` };
}

/** La requisición maestra que se registraría (mismo formato que las requisiciones de servicio del original). */
export function serviceRequisition(form, option, client) {
  const t = k => String(form[k] ?? '').trim();
  const scope = t('description') || option.label;
  return {
    folio: t('folio'), internal_reference: t('reference') || null, client: clientLabel(client), client_id: form.client_id,
    route: 'service', service_type: option.label, service_type_code: option.code, project: t('project'), contract: t('contract') || null,
    request_date: form.request_date, need_date: form.need_date || null, requester_name: t('requester_name'), requester_email: t('requester_email'),
    delivery_place: t('place') || null, description: scope, priority: 'normal', currency: 'MXN',
    items: [{ line: 1, description: scope, quantity: '1', unit: 'servicio', category: option.label }],
  };
}

export function lockedText(en = false) {
  return en
    ? 'Data validated, but the requisition and the service file were NOT created: creating service master requisitions (route "service", service type and the "1 service" line) needs its own write endpoint, which has not been authorized yet. The Requisition registration endpoint only creates supply requisitions. Nothing was stored in MariaDB.'
    : 'Datos validados, pero no se creó la requisición ni el expediente del servicio: el alta de requisiciones maestras de servicio (ruta Servicio, tipo de servicio y partida «1 servicio») requiere su propio endpoint de escritura, que todavía no está autorizado. El alta de Registro de requisición solo crea requisiciones de suministro. No se guardó nada en MariaDB.';
}

/** Mensaje claro para errores HTTP de los catálogos / generadores. */
export function httpMessage(e, en = false) {
  if (e?.status === 401) return en ? 'Your session expired. Sign in again.' : 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (e?.status === 403) return en ? 'You do not have access to this module.' : 'No tienes acceso a este módulo.';
  return e?.message || (en ? 'MariaDB could not be queried.' : 'No fue posible consultar MariaDB.');
}
