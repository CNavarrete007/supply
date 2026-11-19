// Gestión del Contratista · cliente HTTP de SOLO LECTURA (GET con la sesión del servidor; sin datos de demostración).
async function getJson(path, signal) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : response.status === 403 ? 'No tienes acceso a este módulo.' : body?.error?.message || 'No fue posible consultar MariaDB.');
    error.status = response.status; throw error;
  }
  return body;
}
export const validationSetup = signal => getJson('/api/v1/contractor-management/validation-setup', signal);
export const validationRequisition = (id, signal) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? getJson(`/api/v1/contractor-management/requisitions/${encodeURIComponent(id)}`, signal) : Promise.reject(new Error('Identificador inválido.')));
export const strategySetup = signal => getJson('/api/v1/contractor-management/strategy-setup', signal);
export const strategyRequisition = (id, signal) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? getJson(`/api/v1/contractor-management/strategy/${encodeURIComponent(id)}`, signal) : Promise.reject(new Error('Identificador inválido.')));
const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
export const validationsMatrix = (o = {}, signal) => getJson(`/api/v1/contractor-management/validations?${qs({ page: 1, page_size: 10, buyer: 'all', ...o })}`, signal);
export const smartRules = signal => getJson('/api/v1/contractor-management/rules', signal);
