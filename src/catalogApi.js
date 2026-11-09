// Master Admin read-only catalog API. The browser never receives database credentials.
const paths = Object.freeze({ clients: '/api/v1/catalogs/clients', suppliers: '/api/v1/catalogs/suppliers' });

async function getJson(url, signal) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'No se pudieron cargar los datos.');
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}

export function listCatalog(kind, { page = 1, pageSize = 25, q = '', status = 'all' } = {}, signal) {
  if (!Object.hasOwn(paths, kind)) throw new Error('Catálogo desconocido.');
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), q, status });
  return getJson(`${paths[kind]}?${params}`, signal);
}

export function getCatalogRecord(kind, publicId, signal) {
  if (!Object.hasOwn(paths, kind) || !/^[0-9a-f-]{36}$/i.test(publicId)) throw new Error('Identificador inválido.');
  return getJson(`${paths[kind]}/${encodeURIComponent(publicId)}`, signal);
}
