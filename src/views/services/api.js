// Servicios Operativos · cliente HTTP de SOLO LECTURA (GET con la sesión del servidor; sin datos de demostración).
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
export const servicesMatrix = (o = {}, signal) => getJson(`/api/v1/services/matrix?${qs({ page: 1, page_size: 10, client: 'all', buyer: 'all', ...o })}`, signal);
export const serviceDetail = (id, signal) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? getJson(`/api/v1/services/${encodeURIComponent(id)}`, signal) : Promise.reject(new Error('Identificador inválido.')));
// Sección 2 "Nueva solicitud" (solo lectura): catálogo de tipos, referencia interna sugerida y disponibilidad de folio.
// El folio del cliente se genera con la regla vigente de Solicitud / Requisición (GET /recovery/folio, sin escritura).
export const serviceRequestCatalog = signal => getJson('/api/v1/services/new-request', signal);
export const serviceRequestReference = ({ project = '', date }, signal) => getJson(`/api/v1/services/new-request/reference?${new URLSearchParams({ project, date })}`, signal);
export const serviceRequestAvailability = ({ folio = '', reference = '' }, signal) => getJson(`/api/v1/services/new-request/availability?${qs({ folio, reference })}`, signal);
export const requisitionClients = signal => getJson('/api/v1/recovery/catalogs', signal);
export const requisitionFolio = ({ client, date }, signal) => getJson(`/api/v1/recovery/folio?${new URLSearchParams({ client_id: client, date, mode: 'formal' })}`, signal);
