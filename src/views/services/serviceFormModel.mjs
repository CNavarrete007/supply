// Servicios Operativos · formulario "Nuevo servicio" (expediente operativo), al que redirige "Crear requisición y
// continuar" de la Nueva solicitud. Lógica pura (node --test); el servidor sigue siendo la autoridad.
// Estructura tomada del registro de servicio del sistema original (import_records 'services' → service_orders):
// type, reqFolio, internalReference, clientId, project, contract, requestDate, requiredDate, responsible, status,
// authorization{Type,Status,Ref,Date,Amount,Currency,ValidUntil}, requiresSupplier, supplierId, supplierPo{Id,Folio,
// Amount,Currency}, quantity, unit, cost, price, details, description, notes, evidenceFiles.
// "Guardar servicio" valida y NO guarda: no existe endpoint de escritura ni permiso INSERT en service_orders.
import { mergeOptions, money } from './serviceMatrix.mjs';
import { REPORT_STATUSES } from './serviceReports.mjs';
import { fold, validDate, clientLabel } from './newRequestModel.mjs';

export { money };
export const STATUS_OPTIONS = db => mergeOptions(REPORT_STATUSES, db || []);
// Tipos de autorización: los dos registrados en la base real ("Orden de Servicio (SO) del cliente", "Correo de
// autorización") + los que menciona la nota del original (PO, contrato, portal, emergencia).
export const AUTH_TYPES = ['Orden de Compra (PO) del cliente', 'Orden de Servicio (SO) del cliente', 'Contrato / Call-off vigente', 'Correo de autorización', 'Confirmación en portal del cliente', 'Emergencia / autorización verbal'];
export const AUTH_STATUSES = ['Pendiente de documento', 'Autorizada / recibida', 'Pendiente de regularización', 'Rechazada'];
export const CURRENCIES = ['MXN', 'USD', 'EUR'];
export const REQUIRES = [['no', 'No · Ejecución con recursos propios'], ['yes', 'Sí · Requiere proveedor externo']];
export const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const FILE_LIMIT = 8 * 1024 * 1024; // límite técnico local del piloto (igual que RF1), no regla del original

// "Datos específicos" por tipo (formulario dinámico). Claves = details_json del original:
//  · Transporte, Last Mile Deliveries y Gestión Rise X: claves de los registros importados.
//  · Suministro de agua: campos de la captura del original.
//  · Los demás tipos no tienen registros ni capturas: pendientes (no se inventan campos).
export const DETAIL_SCHEMAS = {
  agua: [['supplier', 'Proveedor / pipa'], ['vehicle', 'Pipa / unidad'], ['plates', 'Placas'], ['operator', 'Operador'], ['volume', 'Volumen entregado (L o m³)'], ['deliveryPlace', 'Lugar de entrega'], ['ticket', 'Ticket / folio'], ['startTime', 'Hora inicio', 'time'], ['endTime', 'Hora término', 'time']],
  transporte: [['origin', 'Origen'], ['destination', 'Destino'], ['vehicleType', 'Tipo de vehículo'], ['vehicle', 'Vehículo / unidad'], ['plates', 'Placas'], ['operator', 'Operador'], ['cargo', 'Carga'], ['weight', 'Peso'], ['pod', 'POD / folio de entrega'], ['departure', 'Salida', 'datetime-local'], ['arrival', 'Llegada', 'datetime-local']],
  last_mile: [['origin', 'Origen'], ['destination', 'Destino'], ['guide', 'Guía'], ['packages', 'Paquetes'], ['weight', 'Peso'], ['vehicle', 'Vehículo / unidad'], ['operator', 'Operador'], ['recipient', 'Recibe'], ['pod', 'POD / folio de entrega'], ['deliveryTime', 'Fecha y hora de entrega', 'datetime-local']],
  rise_x: [['site', 'Sitio / instalación'], ['platformUser', 'Usuario de plataforma'], ['requestObject', 'Objeto de la solicitud'], ['subjectName', 'Persona / sujeto'], ['externalReference', 'Referencia externa'], ['captureDate', 'Fecha de captura', 'date'], ['approvalDate', 'Fecha de aprobación', 'date'], ['result', 'Resultado'], ['captureTime', 'Tiempo de captura']],
};
export const detailFields = key => DETAIL_SCHEMAS[key] || null;
/** detail_schema_code del original: 'legacy_' + nombre del tipo en minúsculas y sin acentos (p. ej. legacy_gestion_rise_x). */
export const schemaCode = label => `legacy_${fold(label).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

const num = v => (v === '' || v === null || v === undefined ? NaN : Number(String(v).replace(/,/g, '')));
const DEC = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const LINE_CONTROL = /[\x00-\x1f\x7f]/;
const chars = s => [...String(s ?? '')].length;

/** Estado inicial a partir de la requisición validada en el paso 3 (record de serviceRequisition). */
export function initialService(draft) {
  return {
    type: draft.option_key, client_id: draft.client_id, project: draft.project || '', contract: draft.contract || '',
    request_date: draft.request_date, need_date: draft.need_date || '', responsible: '', status: 'Solicitado',
    auth_type: '', auth_status: 'Pendiente de documento', auth_reference: '', auth_date: '', auth_amount: '0', auth_currency: 'MXN', auth_valid_until: '', auth_file: null,
    requires: 'no', supplier_id: '', po_id: '',
    quantity: '1', unit: 'servicio', cost: '0', price: '0', details: {}, description: draft.description || '', notes: '', evidence: [],
  };
}

export function authBadge(status, hasDoc = false) {
  const s = fold(status);
  const main = !s || s.includes('pendiente de documento') ? { text: 'Documento pendiente', tone: 'amber' }
    : s.includes('rechaz') ? { text: 'Rechazada', tone: 'red' }
    : s.includes('regulariz') || s === 'pendiente' ? { text: 'Pendiente / regularización', tone: 'amber' }
    : s.includes('autoriz') || s.includes('recib') ? { text: 'Autorización válida', tone: 'green' }
    : { text: status, tone: 'gray' };
  return hasDoc ? [main, { text: 'Con documento adjunto', tone: 'blue' }] : [main];
}

/** Sección "Contratación de proveedor": badge, textos de ayuda, habilitación y OC del proveedor. */
export function contractingState(form, contracting = { suppliers: [], purchase_orders: [] }) {
  const external = form.requires === 'yes';
  const supplier = external ? (contracting.suppliers || []).find(s => s.id === form.supplier_id) || null : null;
  const orders = supplier ? (contracting.purchase_orders || []).filter(o => o.supplier_id === supplier.id) : [];
  const po = supplier ? orders.find(o => o.id === form.po_id) || null : null;
  const badge = !external ? { text: 'Ejecución interna', tone: 'blue' } : !supplier ? { text: 'Proveedor por definir', tone: 'amber' } : !po ? { text: 'OC pendiente', tone: 'amber' } : { text: 'OC vinculada', tone: 'green' };
  return {
    external, supplier, orders, po, badge,
    requiresHelp: external ? 'Selecciona el proveedor externo y vincula la OC emitida cuando exista.' : 'Ejecución con recursos propios. No se requiere proveedor ni Orden de Compra.',
    supplierHelp: 'Se habilita cuando el servicio requiere contratación externa.',
    poHelp: !supplier ? 'Bloqueado hasta seleccionar un proveedor externo.' : orders.length ? `${orders.length} OC vigente(s) del proveedor (sin canceladas ni sustituidas).` : 'El proveedor no tiene OC vigentes: usa Gestionar contratación / OC.',
    canManage: external, canUnlink: !!po,
    poCost: po ? po.total : 0, poCurrency: po ? po.currency : '—',
    info: !external ? ['Ejecución interna.', 'Supply Base ejecutará el servicio con recursos propios; no se requiere una OC a proveedor.']
      : po ? ['OC vinculada.', `${po.folio} · ${supplier.name} · ${money(po.total, po.currency)}${po.status ? ` · ${po.status}` : ''}.`]
      : ['Contratación externa.', supplier ? `${supplier.name}: vincula la OC emitida al proveedor para controlar costo y margen.` : 'Selecciona el proveedor externo que ejecutará el servicio.'],
  };
}

export const poLabel = o => `${o.folio} · ${money(o.total, o.currency)}${o.status ? ` · ${o.status}` : ''}${o.services ? ` · ${o.services} servicio(s)` : ''}`;

export function totals(form) {
  const cost = Number.isFinite(num(form.cost)) ? num(form.cost) : 0;
  const price = Number.isFinite(num(form.price)) ? num(form.price) : 0;
  const margin = price - cost;
  return { cost, price, margin, pct: price > 0 ? (margin / price) * 100 : 0 };
}
export const totalsText = t => ({ cost: money(t.cost), price: money(t.price), margin: `${money(t.margin)} (${t.pct.toFixed(1)}%)` });

/** Folio que se asignaría al guardar: SRV-AÑO-00000 (siguiente a la mayor secuencia registrada en ese año). */
export function nextServiceFolio(sequences = {}, date = '') {
  const y = /^\d{4}/.test(date) ? date.slice(0, 4) : String(new Date().getFullYear());
  return `SRV-${y}-${String((Number(sequences?.[y]) || 0) + 1).padStart(5, '0')}`;
}

export function fileProblem(file) {
  if (!file) return null;
  if (!FILE_TYPES.includes(file.type)) return `«${file.name}»: adjunta PDF o imagen (PNG, JPEG, WebP o GIF).`;
  if (file.size <= 0) return `«${file.name}» está vacío.`;
  if (file.size > FILE_LIMIT) return `«${file.name}» excede el límite técnico local de 8 MiB.`;
  return null;
}
export const fileSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Primer error bloqueante → { field, message }; null si es válido. */
export function validateService(form, { options = [], clients = [], contracting } = {}) {
  const bad = (field, message) => ({ field, message });
  const t = k => String(form[k] ?? '').trim();
  if (!options.some(o => o.key === form.type)) return bad('type', 'Selecciona el tipo de servicio.');
  if (!form.client_id || !clients.some(c => c.id === form.client_id)) return bad('client_id', 'Selecciona el cliente.');
  if (!validDate(form.request_date)) return bad('request_date', 'Captura una fecha de solicitud válida.');
  for (const [k, label] of [['need_date', 'La fecha requerida'], ['auth_date', 'La fecha de autorización'], ['auth_valid_until', 'La vigencia / fecha límite']])
    if (form[k] && !validDate(form[k])) return bad(k, `${label} no es válida.`);
  for (const [k, max] of [['project', 255], ['contract', 255], ['responsible', 255], ['auth_reference', 255], ['unit', 128], ['description', 16000], ['notes', 16000]]) {
    const multi = k === 'description' || k === 'notes';
    if (chars(t(k)) > max || (multi ? CONTROL : LINE_CONTROL).test(t(k))) return bad(k, `El campo admite hasta ${max.toLocaleString('es-MX')} caracteres sin caracteres de control.`);
  }
  if (!t('status')) return bad('status', 'Selecciona el estatus.');
  if (!DEC.test(t('quantity')) || !(num(form.quantity) > 0)) return bad('quantity', 'La cantidad debe ser mayor a cero (hasta seis decimales, sin separadores).');
  if (!t('unit')) return bad('unit', 'Captura la unidad (p. ej. servicio, viaje, hora).');
  for (const [k, label] of [['cost', 'El costo interno'], ['price', 'El precio al cliente'], ['auth_amount', 'El monto autorizado']])
    if (t(k) !== '' && !DEC.test(t(k))) return bad(k, `${label} debe ser un número mayor o igual a cero, sin separadores y con hasta seis decimales.`);
  if (!CURRENCIES.includes(form.auth_currency)) return bad('auth_currency', 'Selecciona la moneda.');
  if (form.requires === 'yes' && form.supplier_id && !(contracting?.suppliers || []).some(s => s.id === form.supplier_id)) return bad('supplier_id', 'El proveedor seleccionado ya no está disponible.');
  if (form.po_id && !contractingState(form, contracting).po) return bad('po_id', 'La OC seleccionada no corresponde al proveedor.');
  for (const [k, value] of Object.entries(form.details || {}))
    if (chars(String(value).trim()) > 500 || LINE_CONTROL.test(String(value))) return bad(`detail-${k}`, 'Los datos específicos admiten hasta 500 caracteres por campo.');
  const fp = fileProblem(form.auth_file);
  if (fp) return bad('auth_file', fp);
  for (const f of form.evidence || []) { const p = fileProblem(f); if (p) return bad('evidence', p); }
  return null;
}

/** Avisos no bloqueantes (mismo criterio que los riesgos del reporte Gerencial y las alertas del Dashboard). */
export function serviceWarnings(form, { draft = null, contracting, option = null } = {}) {
  const out = [];
  const t = totals(form);
  const c = contractingState(form, contracting);
  if (t.margin < 0) out.push(`Margen negativo: la venta (${money(t.price)}) es menor que el costo (${money(t.cost)}).`);
  if (t.price > 0 && t.cost === 0 && !c.external) out.push('Costo interno no registrado (0): el margen se calculará al 100 %.');
  if (form.need_date && validDate(form.need_date) && form.need_date < form.request_date) out.push('La fecha requerida es anterior a la fecha de solicitud.');
  if (draft && form.client_id !== draft.client_id) out.push(`El cliente difiere del de la requisición vinculada ${draft.folio}.`);
  if (/autoriz|recib/i.test(form.auth_status) && !String(form.auth_reference).trim() && !form.auth_file) out.push('Autorización marcada como recibida sin número / referencia ni documento.');
  if (c.external && !c.po) out.push('Requiere proveedor externo y no tiene OC vinculada.');
  if (c.po && c.po.currency && form.auth_currency && c.po.currency !== form.auth_currency) out.push(`La OC vinculada está en ${c.po.currency} y la autorización del cliente en ${form.auth_currency}.`);
  if (option && !detailFields(option.key)) out.push(`Los datos específicos de «${option.label}» quedan en Descripción / Observaciones (formulario del original pendiente).`);
  if (!(form.evidence || []).length) out.push('Sin evidencias cargadas.');
  return out;
}

/** Registro que se guardaría en service_orders (vista previa; no se envía). */
export function serviceRecord(form, { draft, option, client, contracting, sequences } = {}) {
  const c = contractingState(form, contracting);
  const details = {};
  for (const [k] of detailFields(form.type) || []) details[k] = String(form.details?.[k] ?? '').trim();
  return {
    folio: nextServiceFolio(sequences, form.request_date), requisition: draft?.folio || null, internal_reference: draft?.internal_reference || null,
    service_type: option?.label, client: clientLabel(client), project: form.project.trim() || null, contract: form.contract.trim() || null,
    request_date: form.request_date, required_date: form.need_date || null, responsible: form.responsible.trim() || null, status: form.status,
    authorization: { type: form.auth_type || null, status: form.auth_status, reference: form.auth_reference.trim() || null, date: form.auth_date || null, amount: form.auth_amount || '0', currency: form.auth_currency, valid_until: form.auth_valid_until || null, document: form.auth_file?.name || null },
    requires_supplier: c.external, supplier: c.supplier?.name || null, supplier_po: c.po?.folio || null,
    quantity: form.quantity.trim(), unit: form.unit.trim(), cost: form.cost || '0', price: form.price || '0', margin: totals(form).margin,
    detail_schema_code: option ? schemaCode(option.label) : null, details, description: form.description.trim() || option?.label || null, notes: form.notes.trim() || null,
    evidence: (form.evidence || []).map(f => f.name),
  };
}

export const lockedServiceText = (folio, requisition) =>
  `Datos validados, pero no se guardó el servicio${folio ? ` (folio sugerido ${folio})` : ''}: el alta del expediente en service_orders requiere un endpoint de escritura y el permiso INSERT, que no están autorizados${requisition ? `, y la requisición ${requisition} tampoco se creó` : ''}. Los archivos no se subieron. No se guardó nada en MariaDB.`;
