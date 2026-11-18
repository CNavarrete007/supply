// Órdenes de Compra · tarjeta 2 "Matriz de órdenes": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PO_STATES, poState, revLabel, buyerCardList, filterBuyers, buyersBadge, rangeText, buyerCaption, editBlock, requestBlock, modifyBlock, deleteBlock, folioConfirmed, validateRequest, validateEdit, editForm } from '../../src/views/purchaseOrders/poMatrix.mjs';

// Resumen sintético con la forma de summary del endpoint /purchase-orders.
const SUM = {
  counters: { total: 13, received: 4, without_buyer: 1 },
  buyers: [
    { id: 'b1', name: 'Karla Barbosa Castellanos', email: 'karla@qa.invalid', phone: '555 100', position: 'Compradora Sr', count: 6, received: 0, suppliers: 6, requisitions: 6, money: [{ currency: 'MXN', amount: '100' }, { currency: 'USD', amount: '5' }] },
    { id: 'b2', name: 'Juan Vicente Ruiz Hernández', email: 'juan@qa.invalid', phone: null, position: null, count: 4, received: 3, suppliers: 4, requisitions: 2, money: [{ currency: 'MXN', amount: '5421.84' }] },
  ],
};
const PO = (o = {}) => ({ folio: 'OC-QA-1', version_number: 1, legacy_revision_number: null, approval_status: 'approved', state_key: 'issued', receipt_count: 0, invoice_count: 0, versions: 1, mod_pending: null, mod_approved: null, ...o });

test('estatus del diseño (orden del filtro) y pill', () => {
  assert.deepEqual(PO_STATES.map(s => s[1]), ['Emitida', 'Enviada al proveedor', 'Aceptada', 'Parcialmente recibida', 'Cancelada', 'Borrador', 'Recibida', 'Sustituida']);
  assert.equal(poState(PO({ state_key: 'cancelled' })).text, 'Cancelada'); assert.match(poState(PO({ state_key: 'cancelled' })).tone, /rose/);
  assert.equal(poState(PO({ state_key: 'other', legacy_status: 'Liberada' })).text, 'Liberada');
  assert.equal(poState(PO({ state_key: 'sent' }), true).text, 'Sent to supplier');
  assert.equal(revLabel(PO()), 'Rev. 0'); assert.equal(revLabel(PO({ version_number: 2 })), 'Rev. 1');
});

test('tarjetas por comprador: Todas, compradores y sin comprador', () => {
  const c = buyerCardList(SUM);
  assert.deepEqual(c.map(x => x.id), ['all', 'b1', 'b2', 'none']);
  assert.deepEqual([c[0].count, c[0].pending, c[0].received, c[0].sub], [13, 9, 4, '2 compradores']);
  assert.deepEqual([c[1].tag, c[1].pending, c[1].pct, c[1].amount, c[1].meta], ['KB', 6, 0, '2 monedas', '6 proveedores · 6 requisiciones']);
  assert.deepEqual([c[2].tag, c[2].pct, c[2].amount], ['JV', 75, '$5,421.84 MXN']);
  assert.equal(c[3].isNone, true);
  assert.equal(buyersBadge(SUM), '2 compradores · 13 OC');
  assert.equal(buyersBadge({ buyers: [SUM.buyers[0]], counters: { total: 4 } }), '1 comprador · 4 OC');
});

test('búsqueda de compradores por nombre, correo, teléfono o puesto (sin acentos); las generales se conservan', () => {
  const c = buyerCardList(SUM);
  assert.deepEqual(filterBuyers(c, 'hernandez').map(x => x.id), ['all', 'b2', 'none']);
  assert.deepEqual(filterBuyers(c, 'karla@').map(x => x.id), ['all', 'b1', 'none']);
  assert.deepEqual(filterBuyers(c, '555').map(x => x.id), ['all', 'b1', 'none']);
  assert.deepEqual(filterBuyers(c, 'compradora').map(x => x.id), ['all', 'b1', 'none']);
  assert.equal(filterBuyers(c, '').length, 4);
});

test('rango y encabezado del comprador', () => {
  assert.equal(rangeText(1, 15, 13), 'Mostrando 1–13 de 13 órdenes de compra');
  assert.equal(rangeText(2, 15, 40), 'Mostrando 16–30 de 40 órdenes de compra');
  assert.equal(rangeText(1, 15, 0), 'No hay órdenes de compra para mostrar');
  const c = buyerCardList(SUM);
  assert.equal(buyerCaption(c[0], 13, 2), '13 registros de 2 compradores');
  assert.equal(buyerCaption(c[0], 4, 1), '4 registros de 1 comprador');
  assert.equal(buyerCaption(c[1], 6, 2), 'karla@qa.invalid · 6 registros');
});

test('EDITAR solo antes de autorizar; después SOLICITAR MODIFICACIÓN', () => {
  assert.match(editBlock(PO()), /SOLICITAR MODIFICACIÓN/);
  assert.equal(editBlock(PO({ approval_status: 'pending', state_key: 'draft' })), null);
  assert.match(editBlock(PO({ state_key: 'cancelled' })), /cancelada/);
});

test('SOLICITAR MODIFICACIÓN y MODIFICAR OC', () => {
  assert.equal(requestBlock(PO()), null);
  assert.match(requestBlock(PO({ mod_pending: 'MOD-1' })), /MOD-1/);
  assert.match(requestBlock(PO({ mod_approved: 'MOD-2' })), /MODIFICAR OC/);
  assert.match(requestBlock(PO({ approval_status: 'pending', state_key: 'draft' })), /EDITAR/);
  assert.match(modifyBlock(PO()), /aprobada/);
  assert.equal(modifyBlock(PO({ mod_approved: 'MOD-2' })), null);
});

test('ELIMINAR: protecciones por recepciones, facturas, versiones o cancelada; folio exacto', () => {
  assert.match(deleteBlock(PO({ receipt_count: 2, invoice_count: 1 })), /2 recepción\(es\), 1 factura\(s\)/);
  assert.match(deleteBlock(PO({ versions: 3 })), /3 versiones/);
  assert.match(deleteBlock(PO({ state_key: 'cancelled' })), /historial/);
  assert.equal(deleteBlock(PO()), null);
  assert.equal(folioConfirmed(PO(), ' oc-qa-1 '), true); assert.equal(folioConfirmed(PO(), 'OC-QA-2'), false);
});

test('validación de la solicitud de modificación', () => {
  assert.match(validateRequest({ type: '', urgency: 'normal', reason: '' }).first, /tipo/);
  assert.match(validateRequest({ type: 'date', urgency: 'normal', reason: 'corto' }).first, /mínimo 10/);
  assert.equal(validateRequest({ type: 'date', urgency: 'alta', reason: 'Cambio de fecha pedido por el proveedor' }).ok, true);
});

test('validación de EDITAR (borrador)', () => {
  const det = { order_date: '2026-10-10', commitment_date: '2026-10-20', delivery_place: 'Almacén', internal_reference: 'SCI-1', terms_text: '', notes: '' };
  const f = editForm(det);
  assert.match(validateEdit(f, det).first, /No hay cambios/);
  assert.match(validateEdit({ ...f, commitment: '2026-10-01' }, det).first, /anterior a la emisión/);
  const v = validateEdit({ ...f, place: 'Planta 2', notes: 'x' }, det);
  assert.equal(v.ok, true); assert.deepEqual(v.changed, ['lugar de entrega', 'notas']);
});
