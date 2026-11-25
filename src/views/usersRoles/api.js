// Usuarios y roles · cliente HTTP: consulta (GET, sesión del servidor; sin datos de demostración) y gestión de acceso
// (POST /users/{id}/access con CSRF, If-Match e Idempotency-Key; 25 nov 2026).
async function getJson(path, signal) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 403 ? 'Tu sesión no tiene permiso para consultar usuarios.' : response.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : body?.error?.message || 'No se pudieron consultar los datos de MariaDB.');
    error.status = response.status; error.code = body?.error?.code;
    throw error;
  }
  return body;
}

/** Every page of /users (fixed 50 per page on the server). */
export async function allUsers(signal, onProgress) {
  let page = 1, items = [], total = 0;
  do {
    const r = await getJson(`/api/v1/users?page=${page}`, signal);
    total = Number(r.total) || 0; items = items.concat(r.items || []); page += 1;
    if (onProgress) onProgress(items, total);
  } while (items.length < total && page <= 200 && !signal?.aborted);
  return { items, total };
}
export const listRoles = signal => getJson('/api/v1/roles', signal);
/** Session user (public id and roles), used to prevent self-lockout in the user form. */
export const authMe = signal => getJson('/api/v1/auth/me', signal);
export const userFunctions = signal => getJson('/api/v1/users/functions', signal);
export function auditEvents(filters = {}, signal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== '' && v !== 'all') params.set(k, String(v));
  return getJson(`/api/v1/audit-events?${params}`, signal);
}

export const accessStatus = signal => getJson('/api/v1/users/access-status', signal);
/** Same `key` when retrying the same operation (the server replays it; a temporary password is never shown twice). */
export async function userAccess({ id, version, key, data }) {
  const t = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
  const r = await fetch(`/api/v1/users/${encodeURIComponent(id)}/access`, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-SF-CSRF': t.csrf_token || '', 'Idempotency-Key': key, 'If-Match': `"${version}"` },
    body: JSON.stringify(data) });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: body };
}
