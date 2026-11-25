// Gestión del Contratista · cliente HTTP: consultas (GET) y escrituras de la validación interna y la estrategia (cuenta mgmtwrite;
// CSRF + Idempotency-Key + If-Match). Reintentar la MISMA operación con la misma clave no la duplica.
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
export const validationSetup = signal => getJson('/api/v1/contractor-management/validation-setup', signal);
export const validationRequisition = (id, signal) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? getJson(`/api/v1/contractor-management/requisitions/${encodeURIComponent(id)}`, signal) : Promise.reject(new Error('Identificador inválido.')));
export const strategySetup = signal => getJson('/api/v1/contractor-management/strategy-setup', signal);
export const strategyRequisition = (id, signal) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? getJson(`/api/v1/contractor-management/strategy/${encodeURIComponent(id)}`, signal) : Promise.reject(new Error('Identificador inválido.')));
const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
export const validationsMatrix = (o = {}, signal) => getJson(`/api/v1/contractor-management/validations?${qs({ page: 1, page_size: 10, buyer: 'all', ...o })}`, signal);
export const smartRules = signal => getJson('/api/v1/contractor-management/rules', signal);

// Escrituras: { ok, status, data } (nunca lanzan por un 4xx/5xx; un fallo de red sí lanza y conserva la clave para reintentar).
async function write(method, path, { data, key, version }) {
  const token = await getCsrf();
  const r = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-SF-CSRF': token, 'Idempotency-Key': key, ...(version !== undefined ? { 'If-Match': `"${version}"` } : {}) },
    body: JSON.stringify(data) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
const uuidOk = id => /^[0-9a-f-]{36}$/i.test(String(id));
export const createReview = op => write('POST', '/api/v1/contractor-management/validations', op);
export const updateReview = op => (uuidOk(op.id) ? write('PUT', `/api/v1/contractor-management/validations/${encodeURIComponent(op.id)}`, op) : Promise.reject(new Error('Identificador inválido.')));
export const saveStrategy = op => (uuidOk(op.requisition) ? write('PUT', `/api/v1/contractor-management/strategy/${encodeURIComponent(op.requisition)}`, op) : Promise.reject(new Error('Identificador inválido.')));
let statusCache = null;
/** Diagnóstico del guardado (una consulta por minuto); 401/403/red → null (sin aviso). */
export function mgmtWriteStatus(now = Date.now()) {
  if (statusCache && now - statusCache.at < 60000) return statusCache.promise;
  const promise = fetch('/api/v1/contractor-management/write-status', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  statusCache = { at: now, promise };
  return promise;
}
export const resetMgmtWriteStatus = () => { statusCache = null; };
