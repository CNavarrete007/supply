// Cotizaciones y Comparativo · cliente HTTP (GET con la sesión del servidor; sin datos de demostración). Escrituras: registro
// de la RFQ (tarjetas 2 y 3) y de la cotización del proveedor (tarjeta 4); cuenta quotewrite; CSRF + Idempotency-Key + If-Match.
import { getCsrf } from '../../apiAuth';
async function getJson(path, signal) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : response.status === 403 ? 'No tienes acceso a este módulo.' : body?.error?.message || 'No fue posible consultar MariaDB.');
    error.status = response.status; throw error;
  }
  return body;
}
const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
const uuid = id => /^[0-9a-f-]{36}$/i.test(String(id));
const one = (path, id, signal) => (uuid(id) ? getJson(`${path}/${encodeURIComponent(id)}`, signal) : Promise.reject(new Error('Identificador inválido.')));
export const listRfqs = (o = {}, s) => getJson(`/api/v1/quotes/rfqs?${qs({ page: 1, page_size: 25, ...o })}`, s);
export const getRfq = (id, s) => one('/api/v1/quotes/rfqs', id, s);
export const listSupplierQuotes = (o = {}, s) => getJson(`/api/v1/quotes/supplier-quotes?${qs({ page: 1, page_size: 25, ...o })}`, s);
export const getSupplierQuote = (id, s) => one('/api/v1/quotes/supplier-quotes', id, s);
export const getComparison = (requisition = 'all', s) => getJson(`/api/v1/quotes/comparison?${qs({ requisition })}`, s);
export const listCustomerQuotes = (o = {}, s) => getJson(`/api/v1/quotes/customer-quotes?${qs({ page: 1, page_size: 25, ...o })}`, s);
export const getCustomerQuote = (id, s) => one('/api/v1/quotes/customer-quotes', id, s);
export const listAwards = (o = {}, s) => getJson(`/api/v1/quotes/awards?${qs({ page: 1, page_size: 25, ...o })}`, s);
export const listRevisionFamilies = (o = {}, s) => getJson(`/api/v1/quotes/revisions?${qs({ page: 1, page_size: 24, ...o })}`, s);
// Tarjeta 2 · RFQ (solo lectura): catálogos, requisiciones validadas por comprador y detalle con partidas.
export const getRfqSetup = s => getJson('/api/v1/quotes/rfq-setup', s);
export const listRfqRequisitions = (o = {}, s) => getJson(`/api/v1/quotes/rfq-requisitions?${qs({ page: 1, page_size: 50, ...o })}`, s);
export const getRfqRequisition = (id, s) => one('/api/v1/quotes/rfq-requisitions', id, s);
// Tarjeta 3 · Matriz de RFQ por contacto de compras (solo lectura).
export const getRfqContacts = s => getJson('/api/v1/quotes/rfq-contacts', s);
// Tarjeta 6 · tipo de cambio registrado y políticas de aprobación vigentes (solo lectura).
export const getCustomerQuoteSetup = s => getJson('/api/v1/quotes/customer-quote-setup', s);
// Tarjeta 4 · Registro de cotización (escritura): { ok, status, data } (nunca lanzan por un 4xx/5xx; un fallo de red sí lanza
// y la tarjeta conserva la clave para reintentar la MISMA operación sin duplicarla).
async function write(method, path, { data, key, version }) {
  const token = await getCsrf();
  const r = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-SF-CSRF': token, 'Idempotency-Key': key, ...(version !== undefined ? { 'If-Match': `"${version}"` } : {}) },
    body: JSON.stringify(data) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
export const createSupplierQuote = op => write('POST', '/api/v1/quotes/supplier-quotes', op);
export const updateSupplierQuote = op => (uuid(op.id) ? write('PUT', `/api/v1/quotes/supplier-quotes/${encodeURIComponent(op.id)}`, op) : Promise.reject(new Error('Identificador inválido.')));
/** PDF registrado de la cotización (descarga privada, sin caché). */
export const supplierQuoteDocumentUrl = id => (uuid(id) ? `/api/v1/quotes/supplier-quotes/${encodeURIComponent(id)}/document` : '');
let statusCache = null;
/** Diagnóstico del guardado (una consulta por minuto); 401/403/red → null (sin aviso). */
export function quoteWriteStatus(now = Date.now()) {
  if (statusCache && now - statusCache.at < 60000) return statusCache.promise;
  const promise = fetch('/api/v1/quotes/write-status', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  statusCache = { at: now, promise };
  return promise;
}
// Tarjeta 2 · registro de la RFQ (Borrador o Enviada) y tarjeta 3 · Borrador → Enviada (If-Match). SupplyFlow no envía correos.
export const createRfq = op => write('POST', '/api/v1/quotes/rfqs', op);
export const markRfqSent = op => (uuid(op.id) ? write('POST', `/api/v1/quotes/rfqs/${encodeURIComponent(op.id)}/mark-sent`, { ...op, data: {} }) : Promise.reject(new Error('Identificador inválido.')));
// Tarjeta 6 · cotización al cliente como BORRADOR INTERNO (alta, edición con If-Match y datos internos para seguir editando).
export const createCustomerQuote = op => write('POST', '/api/v1/quotes/customer-quotes', op);
export const updateCustomerQuote = op => (uuid(op.id) ? write('PUT', `/api/v1/quotes/customer-quotes/${encodeURIComponent(op.id)}`, op) : Promise.reject(new Error('Identificador inválido.')));
export const getCustomerQuoteDraft = (id, s) => (uuid(id) ? getJson(`/api/v1/quotes/customer-quotes/${encodeURIComponent(id)}/draft`, s) : Promise.reject(new Error('Identificador inválido.')));
