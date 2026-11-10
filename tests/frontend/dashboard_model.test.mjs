// Inicio y Dashboard · pruebas de los cálculos puros. Ejecutar: node --test tests/frontend/dashboard_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { P2P_STAGES, scopeRows, stageDistribution, processStatus, priorityDistribution, clientActivity, nextActions, alerts, recentMoves,
  averageProgress, moneyByCurrency, documentsOf, activeCount, changeSummary, historyBased, daysBetween, pct, isOverdue } from '../../src/views/dashboard/model.mjs';

const DAY = '2026-11-10';
const r = o => ({ id: o.id, folio: o.folio || o.id, client_id: o.client_id || 'c1', client: o.client || 'Cliente Uno', stage_index: 0, priority: 'normal',
  request_date: '2026-11-01', need_date: '2026-12-01', progress: 10, updated_at: '2026-11-02 10:00:00', created_at: '2026-11-02 10:00:00', ...o });
const rows = [
  r({ id: 'a', stage_index: 0, need_date: '2026-11-05', priority: 'urgent', progress: 10 }),             // overdue (past need, received)
  r({ id: 'b', stage_index: 4, need_date: '2026-11-09', priority: 'high', progress: 64, client_id: 'c2', client: 'Cliente Dos' }), // overdue at PO
  r({ id: 'c', stage_index: 6, need_date: '2026-10-01', progress: 90 }),                                  // delivered: not overdue
  r({ id: 'd', stage_index: 7, need_date: '2026-10-01', progress: 100, updated_at: '2026-11-09 08:00:00' }), // invoiced/closed
  r({ id: 'e', stage_index: null, need_date: '2026-10-01', progress: null, history_based: true }),          // unknown stage
  r({ id: 'f', stage_index: 1, need_date: DAY, request_date: '2026-10-15' }),                              // due today: not overdue
];

test('8 stages mirror the backend apps-script-eight-stage-matrix', () => {
  assert.equal(P2P_STAGES.length, 8);
  assert.equal(P2P_STAGES[0][0], 'Requisición recibida');
  assert.equal(P2P_STAGES[7][0], 'Factura');
});

test('scope matches analytics filters (client public id + request date; undated excluded with range)', () => {
  assert.equal(scopeRows(rows, { client: 'c2' }).length, 1);
  assert.deepEqual(scopeRows(rows, { from: '2026-11-01' }).map(x => x.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(scopeRows(rows, { to: '2026-10-31' }).map(x => x.id), ['f']);
  assert.equal(scopeRows([r({ id: 'x', request_date: null })], { from: '2026-01-01' }).length, 0);
  assert.equal(scopeRows([r({ id: 'x', request_date: null })], {}).length, 1);
});

test('stage distribution and process status', () => {
  const d = stageDistribution(rows);
  assert.deepEqual(d.counts, [1, 1, 0, 0, 1, 0, 1, 1]);
  assert.equal(d.unknown, 1);
  const s = processStatus(rows, DAY);
  assert.deepEqual(s, { total: 6, open: 4, overdue: 2, onTime: 2, closed: 1, delivered: 2, unknown: 1 });
  assert.equal(isOverdue(rows[5], DAY), false, 'due today is not overdue');
});

test('priority, client activity, next actions', () => {
  assert.deepEqual(priorityDistribution(rows), { urgent: 1, high: 1, normal: 4, other: 0 });
  const act = clientActivity(rows);
  assert.deepEqual(act[0], { id: 'c1', name: 'Cliente Uno', total: 5, open: 3 }); // stage 6 (delivered, not invoiced) is still open
  const na = nextActions(rows, DAY);
  assert.equal(na.total, 2);
  assert.equal(na.items[0].id, 'a', 'overdue first');
});

test('alerts: overdue need dates and overdue provisional regularizations', () => {
  const extra = r({ id: 'p', stage_index: 1, is_provisional: true, regularization_status: 'Pendiente de requisición formal', regularization_due_date: '2026-11-01' });
  const done = r({ id: 'q', stage_index: 1, is_provisional: true, regularization_status: 'Regularizada · Requisición formal', regularization_due_date: '2026-11-01' });
  const a = alerts([...rows, extra, done], DAY);
  assert.equal(a.total, 3);
  assert.deepEqual(a.items.map(x => [x.kind, x.days]), [['regularization', 9], ['need', 5], ['need', 1]]);
});

test('recent moves, progress, history-based', () => {
  const mv = recentMoves(rows, 2);
  assert.equal(mv[0].id, 'd');
  assert.equal(mv[0].created, false);
  assert.equal(averageProgress(rows), 55); // (10+64+90+100+10)/5 = 54.8
  assert.equal(averageProgress([]), null);
  assert.equal(historyBased(rows).total, 1);
});

test('money per currency, documents, active catalogs, changes', () => {
  const fin = { requisition_budgets: [{ currency_code: 'USD', amount: '10.50', documents: 2 }, { currency_code: 'MXN', amount: '100', documents: 1 }],
    customer_quotes: [{ currency_code: 'MXN', amount: '80', documents: 3 }], purchase_orders: [] };
  const mm = moneyByCurrency(fin);
  assert.deepEqual(mm.currencies, ['MXN', 'USD']);
  assert.deepEqual(mm.byCurrency.MXN, { budgets: { amount: 100, documents: 1 }, quotes: { amount: 80, documents: 3 }, po: null });
  assert.equal(documentsOf(fin, 'customer_quotes'), 3);
  assert.equal(activeCount({ statuses: [{ code: 'active', count: 8 }, { code: 'inactive', count: 3 }] }), 8);
  assert.equal(activeCount(null), null);
  const cs = changeSummary({ items: [{ status_code: 'pending_review' }, { status_code: 'applied' }], truncated: false }, { items: [{}], truncated: true });
  assert.deepEqual(cs, { own: 2, ownTruncated: false, byStatus: { pending_review: 1, applied: 1 }, toReview: 1, toReviewTruncated: true });
  assert.equal(changeSummary(null, null), null);
});

test('helpers', () => {
  assert.equal(daysBetween('2026-11-05', DAY), 5);
  assert.equal(pct(1, 3), 33);
  assert.equal(pct(5, 0), 0);
});
