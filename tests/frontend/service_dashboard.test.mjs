// Servicios Operativos · sección 1 "Dashboard": indicadores calculados con filas de GET /services/matrix (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIODS, periodRange, inRange, isExecuted, isInvoiced, authState, currencyTotals, monthlyTrend, dashboard, barPct, donut, alertText } from '../../src/views/services/dashboardModel.mjs';

// Filas sintéticas con la forma de la Matriz (service_orders + requisición, autorización, OC, facturas, evidencias).
const row = o => ({ folio: 'SRV-QA-0000', service: 'Transporte', client_name: 'CLIENTE NORTE', date: '2026-11-10', required_date: '2026-11-12', status: 'Autorizado', authorization_type: 'Correo de autorización', authorization_reference: 'R-1', authorization_status: 'Autorizada / recibida',
  requires_supplier: false, supplier_po: null, invoices: null, cost: 100, price: 300, currency: null, evidence_count: 1, is_open: true, is_done: false, ...o });
const TODAY = '2026-11-23';
const ROWS = [
  row({ folio: 'SRV-QA-0001' }),
  row({ folio: 'SRV-QA-0002', service: 'Last Mile Deliveries', client_name: 'CLIENTE SUR', date: '2026-08-05', required_date: '2026-08-08', status: 'Listo para facturar', requires_supplier: true, cost: 0, price: 5000, evidence_count: 3, authorization_type: 'Orden de Servicio (SO) del cliente' }),
  row({ folio: 'SRV-QA-0003', service: 'Servicio de grúa', date: '2026-10-01', required_date: '2026-10-05', status: 'Completado', is_open: false, is_done: true, invoices: 'FAC-9', cost: 400, price: 350, evidence_count: 0, authorization_status: 'Pendiente de regularización', requires_supplier: true, supplier_po: 'OC-QA-1' }),
  row({ folio: 'SRV-QA-0004', date: '2025-12-31', required_date: '', status: 'Cancelado', is_open: false, authorization_status: 'Rechazada', authorization_type: '', authorization_reference: '', cost: 50, price: 0, evidence_count: 0 }),
  row({ folio: 'SRV-QA-0005', date: '2026-11-20', required_date: '2026-11-25', currency: 'USD', price: 1000, cost: 200, status: 'Facturado', is_open: false, is_done: true, authorization_status: '' }),
];

test('periodos del filtro y rango por fecha de solicitud', () => {
  assert.deepEqual(PERIODS.map(p => p[1]), ['Todo el periodo', 'Mes actual', 'Trimestre actual', 'Año actual']);
  assert.deepEqual([periodRange('all', TODAY), periodRange('month', TODAY), periodRange('quarter', TODAY), periodRange('year', TODAY)],
    [{ from: '', to: '' }, { from: '2026-11-01', to: '2026-11-30' }, { from: '2026-10-01', to: '2026-12-31' }, { from: '2026-01-01', to: '2026-12-31' }]);
  assert.deepEqual(periodRange('quarter', '2026-02-28'), { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(periodRange('month', '2024-02-10'), { from: '2024-02-01', to: '2024-02-29' });
  assert.equal(inRange({ date: '' }, periodRange('month', TODAY)), false, 'sin fecha no entra en un periodo');
  assert.equal(inRange({ date: '' }, periodRange('all', TODAY)), true);
});

test('clasificaciones: ejecutado, facturado y autorización', () => {
  assert.deepEqual(ROWS.map(isExecuted), [false, true, true, false, true]);
  assert.deepEqual(ROWS.map(isInvoiced), [false, false, true, false, true]);
  assert.deepEqual(ROWS.map(authState), ['valid', 'valid', 'pending', 'rejected', 'pending']);
  assert.equal(authState({ authorization_status: 'Autorizada' }), 'valid');
  assert.equal(authState({ authorization_status: 'Pendiente de documento' }), 'pending');
});

test('moneda principal y otras monedas (no se suman)', () => {
  const c = currencyTotals(ROWS);
  assert.deepEqual([c.main.currency, c.main.n, c.main.price, c.main.cost, c.main.margin], ['', 4, 5650, 550, 5100]);
  assert.deepEqual(c.others.map(o => [o.currency, o.n, o.price, o.cost]), [['USD', 1, 1000, 200]]);
  assert.equal(currencyTotals([row({ currency: 'USD' }), row({ currency: 'MXN' })]).main.currency, 'MXN', 'empate → MXN');
  assert.equal(currencyTotals([]).main.price, 0);
});

test('panel completo (todo el periodo)', () => {
  const d = dashboard(ROWS, { period: 'all', today: TODAY });
  assert.equal(d.total, 5);
  assert.deepEqual(d.kpis, { active: 2, activePct: 40, executed: 3, executedPct: 60, invoiced: 2, invoicedPct: 40 });
  assert.equal(Math.round(d.money.main.marginPct * 10) / 10, 90.3);
  assert.deepEqual(d.bars, { auth: 40, evidence: 60, po: 20, invoice: 40, margin: 90 });
  assert.deepEqual(d.statuses.map(s => [s.key, s.n]), [['Autorizado', 1], ['Cancelado', 1], ['Completado', 1], ['Facturado', 1], ['Listo para facturar', 1]]);
  assert.deepEqual(d.byType.map(g => [g.key, g.n, g.price, g.margin]), [['Transporte', 3, 300, 150], ['Last Mile Deliveries', 1, 5000, 5000], ['Servicio de grúa', 1, 350, -50]], 'importes por tipo solo en la moneda principal');
  assert.deepEqual(d.topClients.map(g => [g.key, g.price]), [['CLIENTE SUR', 5000], ['CLIENTE NORTE', 650]]);
  assert.deepEqual(d.auth, { valid: 2, pending: 2, rejected: 1, pct: 40 });
  assert.deepEqual(d.funnel, [['requests', 5], ['authorized', 2], ['executed', 3], ['ready', 1], ['invoiced', 2]]);
  assert.deepEqual(d.external, { internal: 3, external: 2, linked: 1, pending: 1, coverage: 50 });
  assert.deepEqual(d.mgmt, { avgDays: 3.5, overdue: 2, negMargin: 1, pendReg: 2, external: 2, withEvidence: 3 });
  assert.deepEqual(d.alerts.map(alertText), [
    'SRV-QA-0005 · Pendiente de facturar',
    'SRV-QA-0003 · Margen negativo · Sin evidencia',
    'SRV-QA-0002 · Costo no registrado · Sin OC de proveedor · Vencido (requerido 2026-08-08) · Pendiente de facturar',
    'SRV-QA-0001 · Vencido (requerido 2026-11-12)']);
});

test('filtro de periodo y tendencia de 12 meses', () => {
  const m = dashboard(ROWS, { period: 'month', today: TODAY });
  assert.deepEqual([m.total, m.items.map(x => x.folio)], [2, ['SRV-QA-0001', 'SRV-QA-0005']]);
  assert.equal(dashboard(ROWS, { period: 'year', today: TODAY }).total, 4, 'el cancelado de 2025 queda fuera del año actual');
  const tr = monthlyTrend(ROWS, TODAY, '');
  assert.equal(tr.length, 12);
  assert.deepEqual([tr[0].key, tr[0].label, tr[11].key, tr[11].label], ['2025-12', 'Dic 25', '2026-11', 'Nov 26']);
  assert.deepEqual([tr[0].n, tr[0].price, tr[0].cost], [1, 0, 50]);
  assert.deepEqual([tr[11].n, tr[11].price], [2, 300], 'el servicio en USD cuenta pero no se suma a la moneda principal');
  assert.deepEqual([tr[8].key, tr[8].price], ['2026-08', 5000]);
  assert.equal(monthlyTrend([], TODAY, '', true)[11].label, 'Nov 26');
  assert.equal(dashboard(ROWS, { period: 'month', today: TODAY }).trend.reduce((n, o) => n + o.n, 0), 5, 'la tendencia usa todo el cliente/servicio, no solo el periodo');
});

test('vacío y utilidades de gráficas', () => {
  const e = dashboard([], { period: 'all', today: TODAY });
  assert.deepEqual([e.total, e.kpis.activePct, e.bars.margin, e.mgmt.avgDays, e.external.coverage, e.alerts.length], [0, 0, 0, null, 0, 0]);
  assert.deepEqual([barPct(50, 100), barPct(1, 1000), barPct(-5, 10), barPct(5, 0)], [50, 4, 0, 0]);
  assert.equal(donut([], 0), '#e2e8f0 0 100%');
  assert.equal(donut([{ n: 1 }, { n: 3 }], 4), '#2563eb 0.00% 25.00%, #9333ea 25.00% 100.00%');
});
