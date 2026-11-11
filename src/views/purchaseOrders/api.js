// Órdenes de Compra · cliente HTTP de SOLO LECTURA (GET con la sesión del servidor; sin datos de demostración).
async function getJson(path, signal) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : response.status === 403 ? 'No tienes acceso a este módulo.' : body?.error?.message || 'No fue posible consultar MariaDB.');
    error.status = response.status; throw error;
  }
  return body;
}
export function listPurchaseOrders({ page = 1, pageSize = 25, q = '', status = 'all', buyer = 'all', sort = 'recent', scope = 'current' } = {}, signal) {
  const p = new URLSearchParams({ page: String(page), page_size: String(pageSize), q, status, buyer, sort, scope });
  return getJson(`/api/v1/purchase-orders?${p}`, signal);
}
export const poIssuance = signal => getJson('/api/v1/purchase-orders/issuance', signal);
export const poTasks = signal => getJson('/api/v1/purchase-orders/tasks', signal);
export function poDetail(id, signal) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return Promise.reject(new Error('Identificador inválido.'));
  return getJson(`/api/v1/purchase-orders/${encodeURIComponent(id)}`, signal);
}
