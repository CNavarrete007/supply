// Reportes · pruebas de la lógica pura. Uso: node --test tests/frontend/reports_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { reportRows, reportMetrics, purchasedByCurrency, comparableDeviation, executiveSummary, conclusions, poCell, moneyLines, reportCsv, reportPrintHtml } from '../../src/views/reports/model.mjs';

const DAY = '2026-11-11';
const po = (id, folio, currency, amount) => ({ id, folio, currency, amount });
const shared = po('p1', 'OC-1', 'USD', '1500.000000');
const rows = [
  { id: 'a', folio: 'R-A', client_id: 'c1', client_name: 'Uno', request_date: '2026-10-01', need_date: '2026-10-20', stage_index: 7, budget_amount: '15000.000000', currency_code: 'USD', references: { purchase_order_totals: [shared], receipts: ['REC-1'] } },
  { id: 'b', folio: 'R-B', client_id: 'c1', client_name: 'Uno', request_date: '2026-10-05', need_date: '2026-11-01', stage_index: 4, budget_amount: '1000.000000', currency_code: 'USD', references: { purchase_order_totals: [shared, po('p2', 'OC-2', 'USD', '600')], receipts: [] } },
  { id: 'c', folio: 'R-C', client_id: 'c2', client_name: 'Dos <S.A.>', request_date: '2026-10-10', need_date: '2026-11-03', stage_index: 5, budget_amount: '29700.000000', currency_code: 'MXN', references: { purchase_order_totals: [po('p3', 'OC-3', 'USD', '2600')] } },
  { id: 'd', folio: 'R-D', client_id: 'c2', client_name: 'Dos <S.A.>', request_date: '2026-11-01', need_date: '2026-12-01', stage_index: 2, budget_amount: null, currency_code: 'MXN', references: { purchase_order_totals: [] } },
  { id: 'e', folio: 'R-E', client_id: 'c1', client_name: 'Uno', request_date: null, need_date: '2026-01-01', stage_index: null, budget_amount: '500', currency_code: 'MXN', references: {} },
  { id: 'f', folio: 'R-F', client_id: 'c2', client_name: 'Dos <S.A.>', request_date: '2026-09-01', need_date: '2026-09-15', stage_index: 0, budget_amount: '800', currency_code: 'MXN', references: { purchase_order_totals: [po('p4', 'OC-4', 'MXN', '1000')] } },
];

test('alcance: fechas de solicitud (sin fecha fuera de periodos), cliente y etapa', () => {
  assert.deepEqual(reportRows(rows).map(r => r.id), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(reportRows(rows, { from: '2026-10-01', to: '2026-10-31' }).map(r => r.id), ['a', 'b', 'c']);
  assert.deepEqual(reportRows(rows, { client: 'c2' }).map(r => r.id), ['c', 'd', 'f']);
  assert.deepEqual(reportRows(rows, { stage: '7' }).map(r => r.id), ['a']);
  assert.deepEqual(reportRows(rows, { stage: 'pending' }).map(r => r.id), ['e']);
});

test('comprado: OC compartida contada una vez y por moneda', () => {
  assert.deepEqual(purchasedByCurrency(rows), { USD: { amount: 4700, orders: 3 }, MXN: { amount: 1000, orders: 1 } });
  assert.deepEqual(moneyLines(purchasedByCurrency(rows), false, x => x.amount), ['$1,000.00 MXN', '$4,700.00 USD']);
  assert.equal(poCell(rows[1]), '2 OC · $2,100.00 USD');
  assert.equal(poCell(rows[3]), '—');
});

test('desviación comparable: solo presupuesto y OC en la misma moneda; signo correcto', () => {
  const dev = comparableDeviation(rows);
  // USD: a (15000) + b (1000) con OC p1 (1500, una vez) + p2 (600) → 16000 − 2100 = 13900
  assert.deepEqual(dev.USD, { budget: 16000, purchased: 2100, deviation: 13900, requisitions: 2 });
  // MXN: c excluida (presupuesto MXN, OC USD); f: 800 − 1000 = −200 (sobrecosto)
  assert.deepEqual(dev.MXN, { budget: 800, purchased: 1000, deviation: -200, requisitions: 1 });
});

test('indicadores y textos generados con los valores reales', () => {
  const m = reportMetrics(rows, DAY);
  assert.deepEqual([m.total, m.closed, m.overdue, m.pending, m.noBudget, m.withPO, m.orders], [6, 1, 3, 1, 1, 4, 4]);
  assert.equal(m.oldestOverdueDays, 57, 'R-F requerida 2026-09-15');
  assert.deepEqual(m.budget, { USD: 16000, MXN: 31000 });
  assert.deepEqual(moneyLines(m.deviation, false, x => x.deviation), ['-$200.00 MXN', '$13,900.00 USD'], 'negativos como -$');
  const s = executiveSummary(m);
  assert.ok(s.includes('se gestionaron 6 requisiciones') && s.includes('Se cerraron 1 procesos') && s.includes('3 solicitudes vencidas'));
  assert.ok(s.includes('$1,000.00 MXN + $4,700.00 USD (4 OC)'));
  const c = conclusions(m).map(x => x.text).join(' | ');
  assert.ok(c.includes('Priorizar las 3 requisiciones vencidas') && c.includes('lleva 57 días'));
  assert.ok(c.includes('En MXN, el monto comprado excede') && c.includes('$200.00 MXN'));
  assert.ok(c.includes('En USD, el monto comprado se mantiene dentro') && c.includes('$13,900.00 USD'));
  assert.ok(c.includes('1 requisiciones no tienen presupuesto') && c.includes('1 requisiciones históricas'));
  const none = reportMetrics([], DAY);
  assert.equal(conclusions(none)[0].text, 'No hay requisiciones para los filtros seleccionados.');
  assert.ok(executiveSummary(none).includes('No hay órdenes de compra vigentes') && executiveSummary(none).includes('No hay base comparable'));
  const noComparable = reportMetrics([rows[2]], DAY);
  assert.ok(conclusions(noComparable).some(x => x.text.startsWith('Las OC vigentes no tienen presupuesto comparable')));
});

test('CSV y versión imprimible: columnas alineadas y HTML escapado', () => {
  const csv = reportCsv(rows, false, DAY).slice(1).split('\r\n');
  assert.equal(csv.length, 7);
  for (const l of csv) assert.equal(l.match(/","/g).length + 1, 10);
  assert.ok(csv[2].includes('"2 OC · $2,100.00 USD"') && csv[2].includes('"OC-1 / OC-2"'));
  const html = reportPrintHtml(rows, reportMetrics(rows, DAY), { title: 'Reporte <x>', subtitle: 'S', issued: 'hoy', scopeText: 'todo', day: DAY });
  assert.ok(!html.includes('Dos <S.A.>') && html.includes('Dos &lt;S.A.&gt;') && html.includes('Reporte &lt;x&gt;'));
  assert.ok(html.includes('$1,000.00 MXN<br>$4,700.00 USD') && html.includes('Conclusiones'));
});
