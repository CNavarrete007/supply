// Configuración · cliente HTTP de SOLO LECTURA (GET con la sesión del servidor; sin datos de demostración).
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
export const getSettings = signal => getJson('/api/v1/settings', signal);
export const getEmailLog = ({ q = '', status = '', page = 1, page_size = 10 } = {}, signal) => getJson(`/api/v1/settings/email-log?${qs({ q, status, page, page_size })}`, signal);
export const SETTINGS_LOGO_URL = '/api/v1/settings/logo';
