// Factura · tarjeta 2 "Matriz de facturas": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientCards, clientBadge, cardMoney, cardsEmpty, clientCaption, invoiceDeleteBlock, invoiceNumberConfirmed, deleteReasonError } from '../../src/views/invoices/invoiceMatrix.mjs';

// Resumen sintético con la forma de summary.client_cards del endpoint /invoices.
const UNO = { id: 'c1', name: 'Cliente Sintético Uno', tax_id: null, invoices: 3, active: 2, pending: 0, overdue: 1, paid: 1, cancelled: 1, requisitions: 1, projects: 'PRY-QA01', money: [{ currency: 'MXN', invoiced: '5000.000000', outstanding: '0.000000' }, { currency: 'USD', invoiced: '1740.000000', outstanding: '1740.000000' }] };
const DOS = { id: 'c2', name: 'Ácme Dos', tax_id: 'ADO010101AA1', invoices: 2, active: 2, pending: 2, overdue: 0, paid: 0, cancelled: 0, requisitions: 2, projects: '', money: [{ currency: 'MXN', invoiced: '100.5', outstanding: '100.5' }] };
const SUM = { items: [UNO, DOS], clients_total: 5 };

test('tarjetas: "Todas las facturas" suma conteos y montos por moneda sin mezclarlas', () => {
  const c = clientCards(SUM);
  assert.equal(c.length, 3); assert.equal(c[0].id, 'all'); assert.equal(c[0].isAll, true);
  assert.equal(c[0].invoices, 5); assert.equal(c[0].pending, 2); assert.equal(c[0].overdue, 1); assert.equal(c[0].requisitions, 3);
  assert.deepEqual(c[0].money, [{ currency: 'MXN', invoiced: 5100.5, outstanding: 100.5 }, { currency: 'USD', invoiced: 1740, outstanding: 1740 }]);
  assert.equal(c[1].tag, 'CS'); assert.equal(c[2].tag, 'AD');
  assert.equal(clientCards(SUM, true)[0].name, 'All invoices');
});

test('sin facturas no hay tarjetas (ni "Todas")', () => {
  assert.deepEqual(clientCards({ items: [], clients_total: 0 }), []);
  assert.deepEqual(clientCards(undefined), []);
});

test('contador "N de M clientes"', () => {
  assert.equal(clientBadge(SUM), '2 de 5 clientes');
  assert.equal(clientBadge({ items: [], clients_total: 1 }), '0 de 1 cliente');
  assert.equal(clientBadge({}), '0 de 0 clientes');
  assert.equal(clientBadge(SUM, true), '2 of 5 clients');
});

test('montos de la tarjeta: facturado y por cobrar solo si hay saldo', () => {
  const m = cardMoney(UNO);
  assert.equal(m[0].invoiced, '$5,000.00 MXN'); assert.equal(m[0].outstanding, '');
  assert.equal(m[1].outstanding, '$1,740.00 USD');
});

test('estado vacío del diseño y búsqueda sin coincidencias', () => {
  assert.equal(cardsEmpty({ items: [], clients_total: 0 }), 'Aún no hay facturas registradas.');
  assert.equal(cardsEmpty({ items: [], clients_total: 2 }, ' xyz '), 'Ningún cliente coincide con "xyz".');
  assert.equal(cardsEmpty(SUM, 'x'), '');
});

test('encabezado del cliente: facturas, RFC y requisiciones', () => {
  assert.equal(clientCaption(UNO), '3 factura(s) · RFC sin registrar · 1 requisición(es)');
  assert.equal(clientCaption(DOS), '2 factura(s) · RFC ADO010101AA1 · 2 requisición(es)');
  assert.equal(clientCaption(clientCards(SUM)[0]), '5 factura(s) · 3 requisición(es)');
  assert.equal(clientCaption(null), '');
});

test('eliminar: pagadas y con acuse se conservan; el resto exige número exacto y motivo', () => {
  assert.match(invoiceDeleteBlock({ state: 'paid', acknowledgments: 0 }), /pagada/);
  assert.match(invoiceDeleteBlock({ state: 'overdue', acknowledgments: 1 }), /acuse/);
  assert.equal(invoiceDeleteBlock({ state: 'cancelled', acknowledgments: 0 }), null);
  assert.equal(invoiceNumberConfirmed({ invoice_number: 'A-0002' }, ' a-0002 '), true);
  assert.equal(invoiceNumberConfirmed({ invoice_number: 'A-0002' }, 'A-0003'), false);
  assert.equal(invoiceNumberConfirmed({ invoice_number: '' }, ''), false);
  assert.match(deleteReasonError('corto'), /mínimo 10/);
  assert.equal(deleteReasonError('Motivo suficiente'), '');
  assert.match(deleteReasonError('x'.repeat(501)), /500/);
});
