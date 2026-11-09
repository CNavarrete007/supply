/** v0.5: Master-Admin-only, read-only requisition matrix. No demo fallback. */
const ROOT = '/api/v1/matrix';

async function getJson(path, signal) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'No fue posible consultar MariaDB.');
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}

export function listMatrix({ page = 1, pageSize = 25, q = '', client = 'all', has = 'all' } = {}, signal) {
  const params = new URLSearchParams({
    page: String(page), page_size: String(pageSize), q, client, has,
  });
  return getJson(`${ROOT}/requisitions?${params}`, signal);
}

export function matrixClients(signal) {
  return getJson(`${ROOT}/clients`, signal);
}

export function matrixDetail(id, signal) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Identificador inválido.');
  }
  return getJson(`${ROOT}/requisitions/${encodeURIComponent(id)}`, signal);
}
