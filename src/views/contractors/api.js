// Contratista · cliente HTTP: consulta (GET) y edición de los datos de la empresa de la sesión (PUT con CSRF, If-Match e
// Idempotency-Key; la misma clave se reutiliza al reintentar la misma operación para que el servidor no la duplique).
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
export const listContractors = (o = {}, signal) => getJson(`/api/v1/contractors?${qs(o)}`, signal);
export const contractorPersonnel = (id, signal) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? getJson(`/api/v1/contractors/${encodeURIComponent(id)}/personnel`, signal) : Promise.reject(new Error('Identificador inválido.')));

export async function saveCompany({ id, version, payload, key }) {
  const t = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
  const r = await fetch(`/api/v1/contractors/${encodeURIComponent(id)}`, { method: 'PUT', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-SF-CSRF': t.csrf_token || '', 'Idempotency-Key': key, 'If-Match': `"${version}"` },
    body: JSON.stringify(payload) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
/** Logotipo guardado desde SupplyFlow como object URL (null si no hay o es importado). El llamador lo libera. */
export async function companyLogoUrl(id, signal) {
  const r = await fetch(`/api/v1/contractors/${encodeURIComponent(id)}/logo`, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!r.ok) return null;
  const b = await r.blob();
  return ['image/png', 'image/jpeg', 'image/webp'].includes(b.type) ? URL.createObjectURL(b) : null;
}
