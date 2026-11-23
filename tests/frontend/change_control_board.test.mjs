// Requisición › Control de cambios · tablero del diseño original (lógica pura). Ejecutar: node --test tests/frontend/change_control_board.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOW, FLOW_FILTERS, flowChip, boardKpis, boardQuery, quoteCell, poCell, impactCell, requestCell, changeCell, detailMode, statusChip } from '../../src/views/recovery/changeControl.mjs';

const row = o => ({ id: 'c1', folio: 'CR-2026-0001', status_code: 'pending_review', flow_state: 'pending_review', flow_label: 'Pendiente de revisión independiente', change_type: 'Cambio de cantidad', change_count: 2,
  request_date: '2026-11-18', requested_by: 'Ana Cliente', requester_name: 'QA Admin A', cq_count: 0, cq_latest: null, cq_change_folio: null, client_confirmed: false,
  po_count: 0, po_latest: null, po_change_folio: null, receipt_count: 0, po_amended: false, requires_sourcing: false, requires_supplier_confirmation: false,
  assessment_count: 0, executions_pending: 0, impact: '', mine: false, imported: false, ...o });

test('filter of the original: four business states first, then the R3 states present in the data', () => {
  assert.deepEqual(FLOW_FILTERS.slice(0, 5).map(f => f[1]), ['Todos los estados', 'Pendiente de aprobación del cliente', 'Cambio aprobado', 'Reabastecimiento parcial requerido', 'Conciliación de OC/recepción requerida']);
  assert.deepEqual(FLOW_FILTERS.slice(5).map(f => f[0]), ['pending_review', 'rejected', 'withdrawn']);
  assert.deepEqual(Object.keys(FLOW).sort(), ['approved', 'partial_resupply', 'pending_client', 'pending_review', 'po_reconciliation', 'rejected', 'withdrawn']);
});

test('state chip: server flow state; unknown/legacy keeps the server label', () => {
  assert.deepEqual(flowChip(row({ flow_state: 'pending_client' })), ['pending', 'Pendiente de aprobación del cliente']);
  assert.deepEqual(flowChip(row({ flow_state: 'other', flow_label: 'Cambio autorizado (legado)' })), ['info', 'Cambio autorizado (legado)']);
});

test('KPI cards of the original map to server filters', () => {
  const k = boardKpis({ total: 9, applied: 3, intervention: 2, flow: { pending_client: 4 } });
  assert.deepEqual(k.map(x => [x.label, x.n, x.filter]), [['Cambios registrados', 9, 'all'], ['Pendientes de cliente', 4, 'pending_client'], ['Cambios aprobados', 3, 'applied'], ['Con intervención adicional', 2, 'intervention']]);
  assert.deepEqual(boardKpis().map(x => x.n), [0, 0, 0, 0]);
});

test('query string', () => {
  assert.equal(boardQuery({}), 'page=1&page_size=15');
  assert.equal(boardQuery({ state: 'pending_client', q: '  CR-2026 ', page: 2 }), 'state=pending_client&q=CR-2026&page=2&page_size=15');
});

test('customer quote column: change revision, latest version and client confirmation', () => {
  assert.deepEqual(quoteCell(row()), { main: 'Sin cotización al cliente', sub: '' });
  assert.deepEqual(quoteCell(row({ cq_count: 3, cq_latest: 'CQ-0009-R2' })), { main: 'CQ-0009-R2 (+2)', sub: 'Confirmación del cliente pendiente' });
  assert.deepEqual(quoteCell(row({ cq_count: 1, cq_latest: 'CQ-1', client_confirmed: true })).sub, 'Confirmación del cliente verificada');
  assert.equal(quoteCell(row({ cq_count: 2, cq_change_folio: 'CQ-0009-R3', status_code: 'applied' })).main, 'Rev. del cambio: CQ-0009-R3');
  assert.equal(quoteCell(row({ cq_count: 1, cq_latest: 'CQ-1', status_code: 'withdrawn' })).sub, 'Sin confirmación registrada');
});

test('PO / amendment column: linked POs, receipts and verified amendment', () => {
  assert.deepEqual(poCell(row()), { main: 'Sin OC', sub: '' });
  assert.deepEqual(poCell(row({ po_count: 2, po_latest: 'OC-0009', receipt_count: 1 })), { main: 'OC-0009 (+1)', sub: 'Enmienda / conciliación pendiente · 1 recepción(es)' });
  assert.equal(poCell(row({ po_count: 1, po_latest: 'OC-1', po_amended: true })).sub, 'Enmienda verificada');
  assert.equal(poCell(row({ po_count: 1, po_change_folio: 'OC-1-R1' })).main, 'OC Rev. del cambio: OC-1-R1');
});

test('impact, request and change cells', () => {
  assert.deepEqual(impactCell(row({ impact: 'Aumenta 2 piezas', requires_sourcing: true, requires_supplier_confirmation: true, assessment_count: 1, executions_pending: 2 })),
    { main: 'Aumenta 2 piezas', chips: ['Reabastecimiento', 'Confirmación de proveedor', 'Conciliación R3C2 (1)', 'Evidencia por revisar (2)'] });
  assert.deepEqual(impactCell(row()), { main: '—', chips: [] });
  assert.deepEqual(requestCell(row()), { main: '2026-11-18', sub: 'Ana Cliente · Registró: QA Admin A' });
  assert.deepEqual(requestCell(row({ requester_name: 'Ana Cliente' })).sub, 'Ana Cliente');
  assert.deepEqual(changeCell(row()), { main: 'CR-2026-0001', sub: 'Cambio de cantidad · 2 cambio(s)' });
});

test('detail mode keeps reviewer independence (owner reads its own; others go through review)', () => {
  assert.equal(detailMode(row({ mine: true })), 'owner');
  assert.equal(detailMode(row({ mine: false })), 'review');
  assert.equal(detailMode(row({ imported: true })), 'imported');
  assert.deepEqual(statusChip({ status_code: 'applied', new_revision_number: 2 }), ['ok', 'Aplicada · Rev. 2']);
});
