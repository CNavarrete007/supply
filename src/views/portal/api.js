// Portal del Cliente · cliente HTTP de la VISTA PREVIA INTERNA (Master Admin, solo lectura; sesión del servidor).
async function getJson(path, signal) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : response.status === 403 ? 'No tienes acceso a este módulo.'
      : response.status === 404 ? 'El documento no existe o el cliente no puede verlo.' : body?.error?.message || 'No fue posible consultar MariaDB.');
    error.status = response.status; throw error;
  }
  return body;
}
const seg = v => encodeURIComponent(String(v || ''));
export const previewClients = signal => getJson('/api/v1/portal/preview/clients', signal);
export const previewClient = (client, signal) => getJson(`/api/v1/portal/preview/clients/${seg(client)}`, signal);
export const previewRequisition = (client, requisition, signal) => getJson(`/api/v1/portal/preview/clients/${seg(client)}/requisitions/${seg(requisition)}`, signal);
export const previewQuote = (client, quote, signal) => getJson(`/api/v1/portal/preview/clients/${seg(client)}/quotes/${seg(quote)}`, signal);
export const clientLogoUrl = client => `/api/v1/catalogs/clients/${seg(client)}/logo`;
