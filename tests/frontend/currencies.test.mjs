// Catálogos · monedas dadas de alta en la base (src/views/catalog/currencies.mjs). Lógica pura; node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCodes, currencyChoices, loadCurrencies, resetCurrenciesCache, CURRENCIES_URL } from '../../src/views/catalog/currencies.mjs';

test('activeCodes: solo activas, sin repetir, en el orden habitual (MXN, USD, EUR, resto alfabético)', () => {
  assert.deepEqual(activeCodes([{ code: 'USD', active: true }, { code: 'EUR', active: false }, { code: 'MXN', active: true }, { code: 'CAD', active: true }, { code: 'MXN', active: true }]), ['MXN', 'USD', 'CAD']);
  assert.deepEqual(activeCodes([{ code: 'EUR', active: true }, { code: 'USD', active: true }, { code: 'MXN', active: true }]), ['MXN', 'USD', 'EUR']);
  assert.equal(activeCodes(null), null);
  assert.deepEqual(activeCodes([]), []);
});

test('currencyChoices: base de la base de datos; sin datos, la lista fija; conserva el valor guardado si no está', () => {
  assert.deepEqual(currencyChoices(['MXN', 'USD'], 'MXN'), ['MXN', 'USD']);
  assert.deepEqual(currencyChoices(['MXN', 'USD'], ''), ['MXN', 'USD']);
  assert.deepEqual(currencyChoices(['MXN', 'USD'], 'EUR'), ['MXN', 'USD', 'EUR']); // valor ya guardado: se muestra para no perderlo
  assert.deepEqual(currencyChoices(null, 'MXN'), ['MXN', 'USD', 'EUR']);
  assert.deepEqual(currencyChoices([], 'MXN', ['MXN']), ['MXN']);
});

test('loadCurrencies: una consulta por minuto; 401/403/red → null (se usa la lista fija)', async () => {
  resetCurrenciesCache();
  const calls = [];
  const ok = (url, opts) => { calls.push([url, opts]); return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [{ code: 'USD', active: true }, { code: 'MXN', active: true }], read_only: true }) }); };
  assert.deepEqual(await loadCurrencies(ok, 1000), ['MXN', 'USD']);
  await loadCurrencies(ok, 30000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], CURRENCIES_URL);
  assert.equal(calls[0][1].cache, 'no-store');
  await loadCurrencies(ok, 62000);
  assert.equal(calls.length, 2);
  resetCurrenciesCache();
  assert.equal(await loadCurrencies(() => Promise.resolve({ ok: false, status: 403 }), 1), null);
  resetCurrenciesCache();
  assert.equal(await loadCurrencies(() => Promise.reject(new Error('red')), 1), null);
  resetCurrenciesCache();
});
