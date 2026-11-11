// Factura · cliente HTTP de SOLO LECTURA (GET con la sesión del servidor; sin datos de demostración).
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
export const listInvoices = (o = {}, s) => getJson(`/api/v1/invoices?${qs({ page: 1, page_size: 25, ...o })}`, s);
export const invoiceDetail = (id, s) => one('/api/v1/invoices', id, s);
export const invoiceRequisitions = s => getJson('/api/v1/invoices/requisitions', s);
export const invoiceContext = (id, s) => one('/api/v1/invoices/requisitions', id, s);
export const invoiceControl = s => getJson('/api/v1/invoices/control', s);
