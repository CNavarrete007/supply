// Matriz General · pruebas de la lógica pura. Uso: node --test tests/frontend/general_matrix_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStages, riskOf, clientCards, filterCards, filterRows, stageCounts, matrixCsv, csvCell, matrixPrintHtml, escapeHtml, averageOpenAge, initials, money, stageLabel } from '../../src/views/generalMatrix/model.mjs';

const DAY = '2026-11-11';
const base = { review_count: 0, rfq_count: 0, supplier_quote_count: 0, customer_quote_count: 0, purchase_order_count: 0, receipt_count: 0, delivery_count: 0, invoice_count: 0 };
const rows = [
  { ...base, id: 'r1', folio: 'REQ-1', client_id: 'c1', client_name: 'Cliente Uno', project: 'TRION', contract_reference: '11166', need_date: '2026-10-20', request_date: '2026-10-01', purchase_order_count: 2, invoice_count: 1, budget_amount: '1500.000000', currency_code: 'USD',
    references: { purchase_orders: ['OC-1'], winning_suppliers: ['Aceros'], winning_supplier_source: 'purchase_order', receipts: ['REC-1'], invoices: ['FAC-1'] } },
  { ...base, id: 'r2', folio: 'REQ-2', client_id: 'c1', client_name: 'Cliente Uno', project: 'TRION', contract_reference: '11166', need_date: '2026-10-30', request_date: '2026-10-11', supplier_quote_count: 2, references: { purchase_orders: [], winning_suppliers: ['Europa'], winning_supplier_source: 'award', receipts: [], invoices: [] } },
  { ...base, id: 'r3', folio: '=HYPERLINK("x")', client_id: 'c2', client_name: 'Cliente <Dos>', project: 'SONDA', contract_reference: '', need_date: '2026-12-01', request_date: '2026-11-01', internal_reference: 'SCI-26', references: {} },
  { ...base, id: 'r4', folio: 'REQ-4', client_id: 'c2', client_name: 'Cliente <Dos>', project: 'OTRO', need_date: null, request_date: null, references: {} },
  { ...base, id: 'r5', folio: 'REQ-5', client_id: 'c2', client_name: 'Cliente <Dos>', project: 'SONDA', need_date: '2026-01-01', request_date: '2025-12-01', references: {} },
];
const recovery = [{ id: 'r1', stage_index: 7, client_tax: 'CUN010101AAA' }, { id: 'r2', stage_index: 3 }, { id: 'r3', stage_index: 2 }, { id: 'r4', stage_index: 0 }, { id: 'r5', stage_index: null }];
const merged = mergeStages(rows, recovery);

test('une etapas del servidor por id; sin fuente de etapas no inventa etapa', () => {
  assert.deepEqual(merged.map(r => r.stage_index), [7, 3, 2, 0, null]);
  assert.equal(merged[0].client_tax, 'CUN010101AAA');
  assert.equal(mergeStages(rows, null)[0].stage_index, undefined);
  assert.equal(stageLabel(null), 'Pendiente de equivalencia'); assert.equal(stageLabel(3, true), 'Comparison & approval'); assert.equal(stageLabel(undefined), '—');
});

test('riesgo con la regla del Dashboard (vencido solo antes de Entrega y aceptación)', () => {
  assert.deepEqual(merged.map(r => riskOf(r, DAY)), ['closed', 'overdue', 'on_time', 'no_date', 'pending']);
  assert.equal(riskOf({ stage_index: 6, need_date: '2026-01-01' }, DAY), 'delivered');
  // Sin etapas: se apoya en documentos registrados
  assert.equal(riskOf({ ...base, invoice_count: 1, need_date: '2026-01-01' }, DAY), 'closed');
  assert.equal(riskOf({ ...base, delivery_count: 1, need_date: '2026-01-01' }, DAY), 'delivered');
  assert.equal(riskOf({ ...base, need_date: '2026-01-01' }, DAY), 'overdue');
});

test('tarjetas por cliente: requisiciones, con OC, con factura, vencidas, proyectos, contratos y promedio', () => {
  const clients = [{ id: 'c2', code: '2444', name: 'Cliente <Dos>', requisitions: 3 }, { id: 'c1', code: '1400', name: 'Cliente Uno, S.A. de C.V.', requisitions: 2 }, { id: 'c9', code: '9', name: 'Sin Requisiciones', requisitions: 0 }];
  const { all, items } = clientCards(clients, merged, DAY);
  assert.deepEqual([all.clients, all.requisitions, all.withPO, all.withInvoice, all.overdue], [3, 5, 1, 1, 1]);
  assert.equal(all.avgAge, Math.round((31 + 10 + 345) / 3), 'antigüedad promedio de abiertas con fecha');
  assert.deepEqual(items.map(c => c.id), ['c2', 'c1', 'c9'], 'orden por número de requisiciones');
  const c1 = items.find(c => c.id === 'c1');
  assert.deepEqual([c1.requisitions, c1.withPO, c1.withInvoice, c1.overdue, c1.projects, c1.contracts, c1.badge, c1.tax], [2, 1, 1, 1, 1, 1, 'CU', 'CUN010101AAA']);
  assert.equal(items.find(c => c.id === 'c9').requisitions, 0);
  assert.deepEqual(filterCards(items, 'trion').map(c => c.id), ['c1'], 'busca por proyecto');
  assert.deepEqual(filterCards(items, 'cun0101').map(c => c.id), ['c1'], 'busca por RFC');
  assert.deepEqual(filterCards(items, '2444').map(c => c.id), ['c2'], 'busca por número');
  assert.equal(averageOpenAge([], DAY), null);
  assert.equal(initials('GLOBALSANTAFE DRILLING MEXICO, S. DE R.L.'), 'GD');
});

test('filtros de matriz: cliente, búsqueda en referencias, etapa, pendiente y documentos', () => {
  assert.deepEqual(filterRows(merged, { client: 'c1' }).map(r => r.id), ['r1', 'r2']);
  assert.deepEqual(filterRows(merged, { term: 'fac-1' }).map(r => r.id), ['r1'], 'busca folios de factura');
  assert.deepEqual(filterRows(merged, { term: 'europa' }).map(r => r.id), ['r2'], 'busca proveedor ganador');
  assert.deepEqual(filterRows(merged, { term: 'sci-26' }).map(r => r.id), ['r3'], 'busca folio interno');
  assert.deepEqual(filterRows(merged, { stage: '3' }).map(r => r.id), ['r2']);
  assert.deepEqual(filterRows(merged, { stage: 'pending' }).map(r => r.id), ['r5']);
  assert.deepEqual(filterRows(merged, { doc: 'without_purchase_order' }).map(r => r.id), ['r2', 'r3', 'r4', 'r5']);
  assert.deepEqual(filterRows(merged, { doc: 'supplier_quote', client: 'c1' }).map(r => r.id), ['r2']);
  const sc = stageCounts(merged); assert.deepEqual([sc.counts[0], sc.counts[2], sc.counts[3], sc.counts[7], sc.pending], [1, 1, 1, 1, 1]);
});

test('CSV: encabezados alineados, BOM, fórmulas neutralizadas y listas', () => {
  const csv = matrixCsv(merged, false, DAY);
  assert.ok(csv.startsWith('﻿"Requisición","Cliente","Proyecto / contrato"'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 6);
  const cols = lines[0].split('","').length;
  for (const l of lines) assert.equal(l.match(/","/g).length + 1, cols, 'mismo número de columnas en cada fila');
  assert.ok(lines[1].includes('"OC-1"') && lines[1].includes('"Aceros"') && lines[1].includes('"FAC-1"') && lines[1].includes('"Factura"') && lines[1].includes('"Facturado"'));
  assert.ok(lines[3].startsWith('"\'=HYPERLINK(""x"")"'), lines[3]);
  assert.equal(csvCell('-1+2'), '"\'-1+2"'); assert.equal(csvCell('a\nb'), '"a / b"');
});

test('impresión: escapa HTML de los datos', () => {
  const html = matrixPrintHtml(merged, { clientTitle: '<script>x</script>', day: DAY });
  assert.ok(!html.includes('<script>x</script>') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Cliente &lt;Dos&gt;') && html.includes('(5 requisiciones)'));
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
  assert.equal(money('1500.000000', 'USD'), '$1,500.00 USD'); assert.equal(money(null, 'USD'), '—');
});
