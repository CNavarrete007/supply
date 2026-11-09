/** SupplyFlow v0.6 — authoritative read-only metrics; never fall back to mock data. */
const ROOT = '/api/v1/analytics';

function query(filters = {}, includeReport = false) {
  const params = new URLSearchParams();
  for (const key of ['from', 'to', 'client', ...(includeReport ? ['has', 'q', 'page', 'page_size'] : [])]) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '' && (key !== 'client' || value !== 'all')) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

async function request(path, signal, type = 'json') {
  const response = await fetch(path, {
    credentials: 'same-origin', cache: 'no-store', headers: { Accept: type === 'csv' ? 'text/csv' : 'application/json' }, signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error?.message || 'No fue posible consultar MariaDB.');
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return type === 'csv' ? response.blob() : response.json();
}

export function analyticsOverview(filters = {}, signal) {
  return request(`${ROOT}/overview?${query(filters)}`, signal);
}

export function analyticsReport(filters = {}, signal) {
  return request(`${ROOT}/requisitions?${query(filters, true)}`, signal);
}

export function analyticsCsv(filters = {}, signal) {
  // Entire matching scope, never only the page displayed in the UI.
  const { page, page_size, ...all } = filters;
  return request(`${ROOT}/requisitions.csv?${query(all, true)}`, signal, 'csv');
}
