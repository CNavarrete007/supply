// Órdenes de Compra · tarjeta 4 "Modificaciones / Enmiendas": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { AMEND_FILTERS, familyRow, amendKpis, filterFamilies, versionLine, familyRange } from '../../src/views/purchaseOrders/poAmend.mjs';

// Versiones vigentes sintéticas con la forma de GET /api/v1/purchase-orders (scope=current).
const PO = {
  amended: { id: 'p3', folio: 'OC-QA-0003', version_number: 2, versions: 2, supplier_name: 'Instrumentos Europa', requisitions: 'QA02-REQ', order_reference: null, change_request_folio: 'CR-QA-9',
    state_key: 'issued', approval_status: 'approved', total_amount: '3900', currency: 'USD', original_total_amount: '2600', original_currency: 'USD', received_percent: '50', receipt_count: 1,
    active_invoice_count: 0, reconciliation_status: 'pending', change_pending: false, mod_pending: 'MOD-QA-0001', mod_approved: null },
  plain: { id: 'p1', folio: 'OC-QA-0001', version_number: 1, versions: 1, supplier_name: 'Aceros Ñandú', requisitions: 'QA01-REQ', order_reference: 'ORD-1', change_request_folio: null,
    state_key: 'received', approval_status: 'approved', total_amount: '1740', currency: 'USD', original_total_amount: '1740', original_currency: 'USD', received_percent: '100', receipt_count: 1,
    active_invoice_count: 1, reconciliation_status: 'reconciled', change_pending: false, mod_pending: null, mod_approved: null },
  pendingAuth: { id: 'p5', folio: 'OC-QA-0005', version_number: 1, versions: 1, supplier_name: 'Grainger', requisitions: '', order_reference: '19900001080', change_request_folio: null,
    state_key: 'other', legacy_status: 'Pendiente de autorización', approval_status: 'pending', total_amount: '12145.2', currency: 'MXN', original_total_amount: '12145.2', original_currency: 'MXN',
    received_percent: null, receipt_count: 0, active_invoice_count: 0, reconciliation_status: 'not_required', change_pending: false, mod_pending: null, mod_approved: null },
  approvedMod: { id: 'p7', folio: 'OC-QA-0007', version_number: 1, versions: 1, supplier_name: 'Safety', requisitions: 'R-7', state_key: 'issued', approval_status: 'approved', total_amount: '10', currency: 'MXN',
    original_total_amount: '10', original_currency: 'MXN', received_percent: '0', receipt_count: 0, active_invoice_count: 0, reconciliation_status: 'reconciled', change_pending: true, mod_pending: null, mod_approved: 'MOD-7' },
  cancelled: { id: 'p9', folio: 'OC-QA-0009', version_number: 1, versions: 1, supplier_name: 'Bombas', requisitions: 'R-9', state_key: 'cancelled', legacy_status: 'Cancelada', approval_status: 'approved', total_amount: '1700', currency: 'USD',
    original_total_amount: '1700', original_currency: 'USD', received_percent: null, receipt_count: 0, active_invoice_count: 0, reconciliation_status: 'pending', change_pending: false, mod_pending: null, mod_approved: null },
};
const rows = Object.values(PO).map(p => familyRow(p));
const byFolio = f => rows.find(r => r.folio === f);

test('tarjeta de familia: referencia, CR, Rev/estatus, montos original y vigente, recepción y factura vigente', () => {
  const a = byFolio('OC-QA-0003');
  assert.equal(a.reference, 'QA02-REQ'); assert.equal(a.cr, 'CR CR-QA-9'); assert.equal(a.badge, 'Rev. 1 · Emitida');
  assert.equal(a.original, '2,600.00 USD'); assert.equal(a.current, '3,900.00 USD'); assert.equal(a.reception, '50%'); assert.equal(a.invoice, 'No');
  const p = byFolio('OC-QA-0001');
  assert.equal(p.cr, 'Sin CR vinculado'); assert.equal(p.invoice, 'Sí'); assert.equal(p.reception, '100%');
  assert.equal(byFolio('OC-QA-0005').reference, '19900001080'); assert.equal(byFolio('OC-QA-0005').badge, 'Rev. 0 · Pendiente de autorización');
  assert.match(byFolio('OC-QA-0009').tone, /rose/);
});

test('acciones con las reglas de la Matriz: solicitar solo autorizada y sin otra solicitud; modificar solo con aprobada', () => {
  assert.equal(byFolio('OC-QA-0001').canRequest, true);
  assert.equal(byFolio('OC-QA-0003').canRequest, false, 'ya tiene una solicitud pendiente');
  assert.equal(byFolio('OC-QA-0005').canRequest, false, 'pendiente de autorización');
  assert.equal(byFolio('OC-QA-0009').canRequest, false, 'cancelada');
  assert.equal(byFolio('OC-QA-0007').canModify, true); assert.equal(byFolio('OC-QA-0007').canRequest, false);
  assert.equal(byFolio('OC-QA-0001').canModify, false);
});

test('KPI: familias, con enmienda, cambios pendientes (marca o solicitud) y conciliación requerida', () => {
  assert.deepEqual(amendKpis(rows), { families: 5, amended: 1, pending: 2, reconciliation: 2 });
});

test('filtros del diseño y búsqueda sin acentos (OC, proveedor, requisición, CR, estatus)', () => {
  assert.deepEqual(AMEND_FILTERS.map(f => f[1]), ['Todos los estados', 'Cambio pendiente', 'Con enmienda', 'Conciliación requerida', 'Cancelada']);
  const f = (q, s) => filterFamilies(rows, q, s).map(r => r.folio);
  assert.deepEqual(f('', 'pending'), ['OC-QA-0003', 'OC-QA-0007']);
  assert.deepEqual(f('', 'amended'), ['OC-QA-0003']);
  assert.deepEqual(f('', 'cancelled'), ['OC-QA-0009']);
  assert.deepEqual(f('nandu', 'all'), ['OC-QA-0001']);
  assert.deepEqual(f('cr-qa-9', 'all'), ['OC-QA-0003']);
  assert.deepEqual(f('pendiente de autorizacion', 'all'), ['OC-QA-0005']);
  assert.deepEqual(f('mod-qa-0001', 'all'), ['OC-QA-0003']);
});

test('historial por versión y rango de páginas', () => {
  const v0 = versionLine({ id: 'a', folio: 'OC-QA-0003', version_number: 1, order_date: '2026-10-01', total_amount: '2600', currency: 'USD', operational_status: 'superseded', legacy_status: null });
  assert.deepEqual([v0.title, v0.amount, v0.status, v0.amend], ['Rev. 0 · 2026-10-01', '$2,600.00 USD', 'superseded', 'Versión original']);
  const v1 = versionLine({ id: 'b', version_number: 2, order_date: '2026-10-20', total_amount: '3900', currency: 'USD', operational_status: 'issued', amendment_type: 'Cambio de cantidad', amendment_reason: 'Ajuste' });
  assert.equal(v1.amend, 'Cambio de cantidad: Ajuste');
  assert.equal(familyRange(1, 12, 13), 'Mostrando 1–12 de 13 familias'); assert.equal(familyRange(2, 12, 13), 'Mostrando 13–13 de 13 familias'); assert.equal(familyRange(1, 12, 0), 'Sin familias');
});
