// Server-authoritative session. Never save credentials or bearer tokens in localStorage.
export async function getCsrf() {
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo preparar la solicitud segura.');
  const body = await response.json();
  return body.csrf_token;
}
export async function loginWithPassword(email, password) {
  const csrf = await getCsrf();
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': csrf },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'No se pudo iniciar sesión.');
  return body.user;
}
export async function getSession() {
  const response = await fetch('/api/v1/auth/me', { credentials: 'same-origin', cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('No se pudo validar la sesión.');
  const body = await response.json();
  return body.user;
}
export async function endSession() {
  const csrf = await getCsrf();
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': csrf },
    body: '{}',
  });
  if (!response.ok) throw new Error('No fue posible cerrar sesión; reintenta.');
}
