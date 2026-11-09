import { getCsrf } from './apiAuth';
const ROOT = '/api/v1/requisitions/drafts';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin', cache: 'no-store',
    ...options, headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'No fue posible completar la solicitud.');
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}

export function getDrafts(signal) { return jsonRequest(ROOT, { signal }); }
export function getDraft(id, signal) {
  if (!uuid.test(id)) throw new Error('ID de borrador inválido.');
  return jsonRequest(`${ROOT}/${encodeURIComponent(id)}`, { signal });
}
export async function saveDraft(payload, id = null, version = null, idempotencyKey = crypto.randomUUID()) {
  const csrf = await getCsrf();
  const editing = Boolean(id);
  if (editing && (!uuid.test(id) || !Number.isInteger(version) || version < 1)) {
    throw new Error('El borrador no tiene una versión válida.');
  }
  return jsonRequest(editing ? `${ROOT}/${encodeURIComponent(id)}` : ROOT, {
    method: editing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': csrf,
      'Idempotency-Key': idempotencyKey, ...(editing ? { 'If-Match': `"${version}"` } : {}) },
    body: JSON.stringify(payload),
  });
}
