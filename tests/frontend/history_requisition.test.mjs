// Requisición › Crear desde historial · pruebas de la lógica pura. Ejecutar: node --test tests/frontend/history_requisition.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, PRICE_MODES, SOURCING_MODES, HISTORY_FILTERS, DEFAULT_DESCRIPTION, emptyHistoryForm, validity, policyDefaults, modeBlock, lineFromHistory, newLine, newItemError, lineWarnings, filterArticles, routeSummary, validateHistoryRequisition, historyPayload, createdText, historySaveError, refreshLines } from '../../src/views/recovery/historyModel.mjs';

const DAY = '2026-11-20';
const art = (o = {}) => ({ key: o.key || 'a1', description: o.description || 'Guante de nitrilo', brand_model: o.brand_model ?? 'Ansell 92-600', unit: o.unit ?? 'caja', category: o.category ?? 'EPP y seguridad', occurrences: o.occurrences || 2,
  last: { quote_folio: 'CQ-0001', version_number: 1, quote_date: o.date || '2026-10-01', requisition_folio: 'QA-REQ-2026-0001', quantity: 10, unit_price: 'price' in o ? o.price : 120, currency: o.currency || 'MXN', cost: 'cost' in o ? o.cost : 90, supplier: 'supplier' in o ? o.supplier : 'Proveedor Uno', ...(o.last || {}) },
  history: [] });
const POL = { sales_policy: 'guaranteed', sourcing_policy: 'reuse_if_valid', price_validity_days: 90, contract_reference: null, contract_valid_until: null, min_margin_pct: 15 };
const okForm = { ...emptyHistoryForm(DAY), client_id: '11111111-1111-4111-8111-111111111111', need_date: '2026-12-01', project: 'PRY', contract: 'CTO', delivery_place: 'Almacén', requester_name: 'Ana', requester_email: 'ana@cliente.invalid' };

test('design texts of the original', () => {
  assert.deepEqual(STEPS.map(s => s[1]), ['Cliente', 'Partidas', 'Ruta por partida', 'Nuevo expediente']);
  assert.equal(DEFAULT_DESCRIPTION, 'Recompra / nueva solicitud construida desde historial');
  assert.deepEqual(PRICE_MODES.map(m => m[0]), ['fixed', 'requote', 'validate']);
  assert.deepEqual(SOURCING_MODES.map(m => m[0]), ['reuse', 'validate', 'requote']);
  assert.deepEqual(HISTORY_FILTERS.map(f => f[1]), ['Todo el historial', 'Solo precios vigentes', 'Solo precios vencidos']);
  assert.equal(emptyHistoryForm(DAY).request_date, DAY);
});

test('validity of the historical price under the policy', () => {
  assert.equal(validity({ quote_date: '2026-10-01' }, POL, DAY).state, 'valid');
  assert.equal(validity({ quote_date: '2026-08-01' }, POL, DAY).label, 'Vencido el 2026-10-30');
  assert.equal(validity({ quote_date: '2026-08-01' }, { ...POL, price_validity_days: 0 }, DAY).state, 'valid');
  assert.equal(validity({ quote_date: '2026-08-01' }, { ...POL, price_validity_days: null }, DAY).state, 'undefined');
  assert.equal(validity({}, POL, DAY).state, 'undefined');
});

test('policy defaults: codes and labels of the Clients module; unknown or legacy values → validar', () => {
  assert.deepEqual([policyDefaults(POL, DAY).price, policyDefaults(POL, DAY).sourcing], ['fixed', 'reuse']);
  assert.equal(policyDefaults({ sales_policy: 'Precio sujeto a nueva cotización', sourcing_policy: 'requote_always' }, DAY).price, 'requote');
  assert.equal(policyDefaults({ sales_policy: 'contract', contract_valid_until: '2026-01-01' }, DAY).price, 'validate');
  assert.equal(policyDefaults({ sales_policy: 'contract', contract_valid_until: '2027-01-01' }, DAY).price, 'fixed');
  const legacy = policyDefaults({ sales_policy: 'reprice', sourcing_policy: 'requote' }, DAY);
  assert.deepEqual([legacy.price, legacy.sourcing, legacy.known], ['validate', 'validate', false]);
  assert.deepEqual([policyDefaults(null, DAY).price, policyDefaults(null, DAY).sourcing], ['validate', 'validate']);
});

test('route blocks: fixed needs a valid price; reuse needs supplier + cost; new lines only re-quote', () => {
  const h = lineFromHistory(art(), POL, DAY);
  assert.deepEqual([h.price_mode, h.sourcing_mode, h.quantity, h.origin], ['fixed', 'reuse', '10', 'history']);
  assert.equal(modeBlock(h, 'price', 'fixed', POL, DAY), null);
  const old = lineFromHistory(art({ date: '2026-07-01' }), POL, DAY);
  assert.deepEqual([old.price_mode, old.sourcing_mode], ['validate', 'validate']);
  assert.match(modeBlock(old, 'price', 'fixed', POL, DAY), /vencido/);
  assert.match(modeBlock(old, 'sourcing', 'reuse', POL, DAY), /vencido/);
  const noPrice = lineFromHistory(art({ price: 0, supplier: null }), POL, DAY);
  assert.deepEqual([noPrice.price_mode, noPrice.sourcing_mode], ['requote', 'requote']);
  assert.match(modeBlock(noPrice, 'sourcing', 'validate', POL, DAY), /Sin proveedor/);
  assert.match(modeBlock(lineFromHistory(art({ cost: null }), POL, DAY), 'sourcing', 'reuse', POL, DAY), /Sin costo/);
  const n = newLine({ description: ' Arnés  ', quantity: '2', unit: 'pza', category: 'EPP y seguridad' });
  assert.deepEqual([n.origin, n.price_mode, n.sourcing_mode, n.description], ['new', 'requote', 'requote', 'Arnés']);
  assert.match(modeBlock(n, 'price', 'fixed', POL, DAY), /nuevo precio/);
  assert.match(modeBlock(n, 'sourcing', 'reuse', POL, DAY), /cotización de proveedor/);
});

test('new item validation mirrors the requisition item builder', () => {
  assert.equal(newItemError({ description: 'Arnés', quantity: '2', unit: 'pza', category: 'EPP y seguridad' }, ['EPP y seguridad']), null);
  assert.match(newItemError({ description: 'Arnés', quantity: '0', unit: 'pza', category: 'EPP y seguridad' }), /Completa/);
  assert.match(newItemError({ description: 'Arnés', quantity: '1,5', unit: 'pza', category: 'EPP y seguridad' }), /Completa/);
  assert.match(newItemError({ description: 'Arnés', quantity: '1', unit: 'pza', category: 'Vieja' }, ['EPP y seguridad']), /activa/);
});

test('warnings: currency, margin under the policy minimum and policy conflicts', () => {
  const usd = lineFromHistory(art({ currency: 'USD', cost: 110 }), POL, DAY);
  const w = lineWarnings(usd, okForm, POL, DAY);
  assert.equal(w.length, 2);
  assert.match(w[0], /USD y la requisición en MXN/);
  assert.match(w[1], /margen histórico \(8\.3%\) es menor al mínimo de la política \(15%\)/);
  const qr = { ...POL, sales_policy: 'quote_required' };
  assert.match(lineWarnings({ ...lineFromHistory(art(), POL, DAY), price_mode: 'fixed' }, okForm, qr, DAY).join(' '), /pide nueva cotización/);
  assert.match(lineWarnings({ ...lineFromHistory(art(), POL, DAY), price_mode: 'requote' }, okForm, POL, DAY).join(' '), /garantiza el precio/);
  assert.deepEqual(lineWarnings(newLine({ description: 'x', quantity: '1', unit: 'u', category: 'c' }), okForm, POL, DAY), []);
});

test('catalog filters: text over article, folios and supplier; category; validity', () => {
  const items = [art({ key: 'a' }), art({ key: 'b', description: 'Llave de impacto', brand_model: 'Truper', category: 'Herramientas', date: '2026-06-01', last: { supplier: 'Ferretera Dos', quote_folio: 'CQ-0099' } })];
  assert.deepEqual(filterArticles(items, { query: 'ansell' }, POL, DAY).map(a => a.key), ['a']);
  assert.deepEqual(filterArticles(items, { query: 'cq-0099' }, POL, DAY).map(a => a.key), ['b']);
  assert.deepEqual(filterArticles(items, { query: 'FERRETERA' }, POL, DAY).map(a => a.key), ['b']);
  assert.deepEqual(filterArticles(items, { category: 'herramientas' }, POL, DAY).map(a => a.key), ['b']);
  assert.deepEqual(filterArticles(items, { state: 'valid' }, POL, DAY).map(a => a.key), ['a']);
  assert.deepEqual(filterArticles(items, { state: 'expired' }, POL, DAY).map(a => a.key), ['b']);
});

test('requisition validation (general data like RF1 + per-line routes) and locked creation', () => {
  const lines = [lineFromHistory(art(), POL, DAY), newLine({ description: 'Arnés', quantity: '2', unit: 'pza', category: 'EPP y seguridad' })];
  const ctx = { policy: POL, day: DAY, activeCategories: ['EPP y seguridad'] };
  assert.equal(validateHistoryRequisition(okForm, lines, ctx), null);
  assert.match(validateHistoryRequisition({ ...okForm, client_id: '' }, lines, ctx), /cliente/);
  assert.match(validateHistoryRequisition({ ...okForm, need_date: '2026-11-01' }, lines, ctx), /anterior/);
  assert.match(validateHistoryRequisition({ ...okForm, project: ' ' }, lines, ctx), /proyecto/);
  assert.match(validateHistoryRequisition({ ...okForm, requester_email: 'ana@' }, lines, ctx), /correo válido/);
  assert.match(validateHistoryRequisition({ ...okForm, budget: '1,000' }, lines, ctx), /presupuesto/);
  assert.match(validateHistoryRequisition(okForm, [], ctx), /al menos una partida/);
  assert.match(validateHistoryRequisition(okForm, [{ ...lines[0], quantity: '0' }], ctx), /cantidad mayor a cero/);
  assert.match(validateHistoryRequisition(okForm, [{ ...lines[0], category: '' }], ctx), /sin categoría/);
  assert.match(validateHistoryRequisition(okForm, [{ ...lines[0], category: 'Herramientas' }], ctx), /no está activa/);
  assert.match(validateHistoryRequisition(okForm, [{ ...lines[0], last: { ...lines[0].last, quote_date: '2026-01-01' } }], ctx), /vencido/);
  const s = routeSummary(lines);
  assert.deepEqual([s.total, s.history, s.fresh, s.fixed, s.requote, s.reuse, s.supplierRequote], [2, 1, 1, 1, 1, 1, 1]);
});

test('alta real: cuerpo del POST (el historial solo envía referencia, cantidad y ruta), mensajes y recarga', () => {
  const base = art(); base.last.quote_version_id = '22222222-2222-4222-8222-222222222222';
  const lines = [lineFromHistory(base, POL, DAY), newLine({ description: 'Arnés', quantity: '2', unit: 'pza', category: 'EPP y seguridad' })];
  const ctx = { policy: POL, day: DAY, activeCategories: ['EPP y seguridad'] };
  const p = historyPayload({ ...okForm, project: ' PRY ', budget: ' ' }, lines);
  assert.deepEqual(Object.keys(p).sort(), ['budget', 'client_id', 'client_reference', 'contract', 'currency', 'delivery_place', 'description', 'items', 'need_date', 'priority', 'project', 'request_date', 'requester_email', 'requester_name']);
  assert.equal(p.project, 'PRY'); assert.equal(p.budget, '');
  assert.deepEqual(Object.keys(p.items[0]).sort(), ['article_key', 'origin', 'price_mode', 'quantity', 'quote_version_id', 'sourcing_mode']);
  assert.equal(p.items[0].origin, 'history'); assert.equal(p.items[0].article_key, lines[0].key.replace(/^h:/, ''));
  assert.equal(p.items[0].quote_version_id, lines[0].last.quote_version_id);
  assert.ok(!('unit_price' in p.items[0]) && !('cost' in p.items[0]) && !('supplier' in p.items[0]));
  assert.deepEqual(p.items[1], { origin: 'new', description: lines[1].description, quantity: lines[1].quantity, unit: lines[1].unit, category: lines[1].category, price_mode: 'requote', sourcing_mode: 'requote' });
  assert.match(createdText({ folio: 'QA01-REQ-2026-0007', line_count: 2, history_lines: 1, new_lines: 1, fixed_price_lines: 1, reuse_supplier_lines: 1 }, 'Cliente Uno'),
    /^Requisición QA01-REQ-2026-0007 creada en MariaDB para «Cliente Uno»: 2 partida\(s\) \(1 del historial y 1 nueva\(s\); precio fijo 1, proveedor reutilizado 1\)\. Ya aparece en la Matriz/);
  assert.equal(historySaveError(undefined, undefined, 'Failed to fetch').retry, true);
  assert.match(historySaveError(undefined, undefined, 'x').text, /^No se confirmó el resultado/);
  assert.equal(historySaveError(409, 'HISTORY_CHANGED', 'Partida 1: el historial cambió.').reload, true);
  assert.match(historySaveError(409, 'ROUTE_NOT_ALLOWED', 'Partida 1: Sin proveedor.').text, /Sin proveedor\. No se creó la requisición\.$/);
  assert.ok(!historySaveError(422, 'INVALID_REQUISITION', 'x').retry);
  assert.match(historySaveError(403, 'FORBIDDEN', '').text, /Master Admin/);
  const a0 = { key: lines[0].key.replace(/^h:/, ''), description: 'Art', unit: 'pza', category: 'Materiales', last: { ...lines[0].last, unit_price: 0 }, occurrences: 1 };
  const r = refreshLines(lines, [a0], ctx.policy, ctx.day);
  assert.equal(r.removed.length, 0); assert.equal(r.lines.length, 2);
  assert.notEqual(r.lines[0].price_mode, 'fixed'); // sin precio histórico: el precio fijo ya no es válido
  assert.equal(r.lines[0].quantity, lines[0].quantity);
  assert.equal(refreshLines(lines, [], ctx.policy, ctx.day).removed.length, 1);
});
