// Monedas dadas de alta en ESTA base (GET /api/v1/catalogs/currencies, solo lectura, Master Admin).
// Las llaves foráneas de MariaDB solo aceptan esas monedas: ofrecer una lista fija (MXN/USD/EUR) hacía que, en una base sin EUR,
// elegir EUR terminara en «No se pudo guardar». Si la consulta falla se usa la lista fija y el servidor explica el rechazo.

export const CURRENCIES_URL = '/api/v1/catalogs/currencies';
const PREFERRED = ['MXN', 'USD', 'EUR'];

/** Active codes in the usual order (MXN, USD, EUR, then the rest alphabetically). */
export function activeCodes(items) {
  if (!Array.isArray(items)) return null;
  const codes = items.filter(c => c && c.active && typeof c.code === 'string').map(c => c.code);
  const rank = c => (PREFERRED.includes(c) ? PREFERRED.indexOf(c) : PREFERRED.length);
  return [...new Set(codes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Options for a currency select: active codes (or the fallback while unknown) plus the record's current value if it is not among them. */
export function currencyChoices(active, current, fallback = PREFERRED) {
  const base = Array.isArray(active) && active.length ? active : fallback;
  return current && !base.includes(current) ? [...base, current] : base;
}

let cache = null; // { at, promise }
/** Active currency codes, fetched once per minute; null when unavailable (401/403/red). */
export function loadCurrencies(fetchImpl = (...a) => fetch(...a), now = Date.now()) {
  if (cache && now - cache.at < 60000) return cache.promise;
  const promise = fetchImpl(CURRENCIES_URL, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : null)).then(b => (b ? activeCodes(b.items) : null)).catch(() => null);
  cache = { at: now, promise };
  return promise;
}
export function resetCurrenciesCache() { cache = null; }
