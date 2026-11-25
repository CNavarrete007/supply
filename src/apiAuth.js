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
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'No se pudo iniciar sesión.');
    error.status = response.status; error.code = body?.error?.code;
    throw error;
  }
  return body.user;
}
/** Replaces a temporary password (first sign-in) or changes the current one. No session is issued: sign in afterwards. */
export async function changePassword(email, currentPassword, newPassword) {
  const csrf = await getCsrf();
  const response = await fetch('/api/v1/auth/password/change', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': csrf },
    body: JSON.stringify({ email, current_password: currentPassword, new_password: newPassword }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'No se pudo cambiar la contraseña.');
    error.status = response.status; error.code = body?.error?.code;
    throw error;
  }
  return body;
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
