// Flujo del Proceso: textos y comprobaciones de presentación sobre GET /api/v1/analytics/process-flow (node --test; datos sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { processCount, bottleneckText, bottleneckMeta, groupTotals, indicatorCards, kpiValue } from '../../src/views/processFlow/model.mjs';

const GROUP_OF = [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 5, 6, 7];

test('contador de procesos y valores de KPI', () => {
  assert.equal(processCount(0), '0 proceso(s)');
  assert.equal(processCount(12, false), '12 process(es)');
  assert.equal(processCount(undefined), '— proceso(s)');
  assert.equal(kpiValue(7), '7');
  assert.equal(kpiValue(0), '0');
  assert.equal(kpiValue(null), '—');
});

test('grupos de la política de 8 etapas a partir de las 15 etapas', () => {
  assert.deepEqual(groupTotals([5, 1, 2, 3, 4, 1, 1, 1, 1, 1, 1, 2, 3, 4, 6], GROUP_OF), [5, 3, 7, 6, 2, 3, 4, 6]);
  assert.deepEqual(groupTotals([], GROUP_OF), [0, 0, 0, 0, 0, 0, 0, 0]);
});

test('cuellos de botella: motivo por código (P2P y S2C)', () => {
  assert.equal(bottleneckText({ folio: 'REQ-QA-1', reason: 'request' }), 'REQ-QA-1: pendiente de validación interna.');
  assert.equal(bottleneckText({ folio: 'REQ-QA-2', reason: 'offers', offers: 1, min_offers: 3 }), 'REQ-QA-2: RFQ enviada; 1 de 3 oferta(s) mínimas registradas.');
  assert.equal(bottleneckText({ folio: 'REQ-QA-3', reason: 'po' }, 'p2p', false), 'REQ-QA-3: quote approved; supplier PO pending.');
  assert.equal(bottleneckText({ folio: 'SRV-QA-1', reason: 'authorization' }, 'services'), 'SRV-QA-1: autorización comercial del cliente pendiente.');
  assert.equal(bottleneckText({ folio: 'X', reason: 'desconocido' }), 'X: etapa pendiente.');
  for (const code of ['request', 'validation_blocked', 'lots', 'rfq', 'offers', 'compare', 'quote', 'review', 'authorize', 'send', 'decision', 'po', 'rejected', 'change_requested', 'receipt', 'delivery', 'invoice', 'history', 'change']) {
    assert.doesNotMatch(bottleneckText({ folio: 'F', reason: code }), /etapa pendiente/, code);
  }
  for (const code of ['link', 'authorization', 'planning', 'supplier_po', 'execution', 'evidence', 'closure']) {
    assert.doesNotMatch(bottleneckText({ folio: 'F', reason: code }, 'services'), /etapa pendiente/, code);
  }
});

test('detalle del cuello de botella: cliente, servicio, etapa y antigüedad', () => {
  assert.equal(bottleneckMeta({ client_name: 'CLIENTE SINTÉTICO NORTE', stage: 4, days: 12 }, ['a', 'b', 'c', 'RFQ por lote y proveedor']),
    'CLIENTE SINTÉTICO NORTE · Etapa 4 · RFQ por lote y proveedor · 12 día(s) desde la solicitud');
  assert.equal(bottleneckMeta({ client_name: 'CLIENTE SINTÉTICO SUR', service: 'Transporte', stage: null, days: null }), 'CLIENTE SINTÉTICO SUR · Transporte · Sin etapa inferida');
});

test('KPI de Indicadores según la ruta activa', () => {
  const data = { indicators: { rfq_to_issue: 1, insufficient_bids: 2, awaiting_client: 3, approved_without_po: 4, po_without_receipt: 5, receipts_without_delivery: 6 },
    services: { total: 9, pending_auth: 1, pending_po: 0, executed: 4, ready: 2, invoiced: 3 } };
  assert.deepEqual(indicatorCards(data).map(c => c[0]), [1, 2, 3, 4, 5, 6]);
  assert.equal(indicatorCards(data)[0][1], 'RFQ por emitir');
  assert.deepEqual(indicatorCards(data, 'services').map(c => c[0]), [9, 1, 0, 4, 2, 3]);
  assert.equal(indicatorCards(data, 'services', false)[4][1], 'Ready to invoice');
  assert.deepEqual(indicatorCards(null).map(c => c[0]), [undefined, undefined, undefined, undefined, undefined, undefined]);
});
