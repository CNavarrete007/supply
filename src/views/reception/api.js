// Recepción y Entrega · cliente HTTP de SOLO LECTURA (GET con la sesión del servidor; sin datos de demostración).
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
const one = (path, id, signal) => (/^[0-9a-f-]{36}$/i.test(String(id)) ? getJson(`${path}/${encodeURIComponent(id)}`, signal) : Promise.reject(new Error('Identificador inválido.')));
export const receptionMatrix = (o = {}, s) => getJson(`/api/v1/reception/matrix?${qs({ page: 1, page_size: 25, ...o })}`, s);
export const receptionOrders = (o = {}, s) => getJson(`/api/v1/reception/orders?${qs({ page: 1, page_size: 50, ...o })}`, s);
export const receptionOrder = (id, s) => one('/api/v1/reception/orders', id, s);
export const receiptDetail = (id, s) => one('/api/v1/reception/receipts', id, s);
export const deliveryDetail = (id, s) => one('/api/v1/reception/deliveries', id, s);
export const receptionClosure = s => getJson('/api/v1/reception/closure', s);
