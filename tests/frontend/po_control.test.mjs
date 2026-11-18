// Órdenes de Compra · tarjeta 3 "Control de autorización": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { controlAlerts, pendingAwards, partialNote, poLine, overdueDays, otherChecks } from '../../src/views/purchaseOrders/poControl.mjs';

const COUNTERS = { preselected_quotes: 2, awards_without_po: 3, auto_generated: 1, overdue_without_receipt: 1, without_buyer: 1, reconciliation_pending: 0, change_pending: 2 };
// Respuesta sintética con la forma de GET /api/v1/purchase-orders/issuance.
const ISS = {
  requisitions: [{ id: 'r1', client_approved: true }, { id: 'r2', client_approved: false }],
  items: [
    { requisition_id: 'r2', folio: 'REQ-2', client_name: 'Cliente B', supplier_id: 's1', supplier_name: 'Bombas', items: 1, awarded_amount: '900', currencies: 'USD', active_pos: null, existing_pos: null },
    { requisition_id: 'r1', folio: 'REQ-1', client_name: 'Cliente A', supplier_id: 's2', supplier_name: 'Aceros', items: 2, awarded_amount: '1500', currencies: 'USD', active_pos: null, existing_pos: 'OC-9' },
    { requisition_id: 'r1', folio: 'REQ-1', client_name: 'Cliente A', supplier_id: 's3', supplier_name: 'Cables', items: 1, awarded_amount: '50', currencies: 'MXN', active_pos: 'OC-7', existing_pos: 'OC-7' },
  ],
  alerts: {
    preselected_quotes: [{ folio: 'COT-1', supplier_name: 'Aceros', requisition: 'REQ-1', status: 'Seleccionada', awarded: true, total_amount: '1740', currency: 'USD' }],
    auto_generated: [{ id: 'p1', folio: 'OC-7', version_number: 1, supplier_name: 'Cables', requisitions: 'REQ-1', total_amount: '58', currency: 'MXN' }],
    overdue_without_receipt: [{ id: 'p2', folio: 'OC-8', version_number: 2, supplier_name: 'Bombas', requisitions: 'REQ-2', commitment_date: '2026-11-01', total_amount: '900', currency: 'USD' }],
  },
};

test('cuatro alertas del diseño en orden, con conteo del servidor y tono', () => {
  const a = controlAlerts(COUNTERS, ISS);
  assert.deepEqual(a.map(x => [x.key, x.count, x.tone]), [['preselected', 2, 'emerald'], ['awards', 3, 'amber'], ['auto', 1, 'blue'], ['overdue', 1, 'rose']]);
  assert.deepEqual(a.map(x => x.text), ['cotizaciones preseleccionadas o adjudicadas.', 'adjudicaciones pendientes de OC.', 'órdenes generadas automáticamente con PDF.', 'órdenes vencidas sin recepción.']);
  assert.equal(a[1].shown, 3, 'adjudicaciones = partidas sin OC vigente');
});

test('sin datos de emisión: conteos visibles y detalle pendiente', () => {
  const a = controlAlerts(COUNTERS, null);
  assert.ok(a.every(x => x.rows === null && x.shown === 0));
  assert.equal(controlAlerts({}, null)[0].count, 0);
});

test('adjudicaciones sin OC vigente: aprobadas primero; OC cancelada no cuenta como generada', () => {
  const p = pendingAwards(ISS);
  assert.deepEqual(p.map(x => [x.requisition, x.supplier, x.approved]), [['REQ-1', 'Aceros', true], ['REQ-2', 'Bombas', false]]);
  assert.equal(p[0].cancelledPo, 'OC-9'); assert.equal(p[0].requisitionId, 'r1');
});

test('aviso de lista parcial (máximo 200 documentos)', () => {
  const a = controlAlerts({ ...COUNTERS, preselected_quotes: 250 }, ISS);
  assert.equal(partialNote(a[0]), 'Se muestran 1 de 250.');
  assert.equal(partialNote(a[2]), '');
});

test('línea de OC, días vencidos y otras revisiones', () => {
  assert.equal(poLine(ISS.alerts.overdue_without_receipt[0]), 'OC-8 · Rev. 1 · Bombas · REQ-2 · $900.00 USD');
  assert.equal(overdueDays('2026-11-01', '2026-11-18'), 17); assert.equal(overdueDays('2026-12-01', '2026-11-18'), 0); assert.equal(overdueDays(null, '2026-11-18'), 0);
  assert.deepEqual(otherChecks(COUNTERS), [{ count: 1, text: 'OC sin comprador asignado' }, { count: 2, text: 'OC con cambio pendiente' }]);
  assert.equal(controlAlerts(COUNTERS, ISS, true)[3].text, 'overdue orders without receipt.');
});
