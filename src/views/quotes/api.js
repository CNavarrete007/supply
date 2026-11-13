// Cotizaciones y Comparativo · cliente HTTP de SOLO LECTURA (GET con la sesión del servidor; sin datos de demostración).
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
