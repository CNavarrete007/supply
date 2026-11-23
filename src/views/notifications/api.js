// Campana · cliente HTTP de SOLO LECTURA: notificaciones del usuario en sesión (GET con la sesión del servidor).
export async function getNotifications({ status = 'all', page = 1, page_size = 10 } = {}, signal) {
  const qs = new URLSearchParams({ status, page: String(page), page_size: String(page_size) });
  const response = await fetch(`/api/v1/notifications?${qs}`, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : body?.error?.message || 'No fue posible consultar las notificaciones.');
    error.status = response.status; throw error;
  }
  return body;
}
