// Usuarios y roles · cliente HTTP de SOLO LECTURA (GET, sesión del servidor; sin datos de demostración).
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
export const userFunctions = signal => getJson('/api/v1/users/functions', signal);
export function auditEvents(filters = {}, signal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== '' && v !== 'all') params.set(k, String(v));
  return getJson(`/api/v1/audit-events?${params}`, signal);
}
