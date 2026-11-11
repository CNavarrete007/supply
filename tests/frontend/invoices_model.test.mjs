// Factura · pruebas de la lógica pura. Uso: node --test tests/frontend/invoices_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { stateLabel, stateTone, statusText, daysOverdue, moneyList, controlCards } from '../../src/views/invoices/model.mjs';

test('estados, tonos y estatus original', () => {
  assert.equal(stateLabel('overdue'), 'Vencida'); assert.equal(stateLabel('paid', true), 'Paid'); assert.equal(stateLabel(null), '—');
  assert.match(stateTone('overdue'), /rose/); assert.match(stateTone('paid'), /emerald/); assert.match(stateTone('pending'), /amber/);
  assert.equal(statusText({ legacy_status: 'Enviada al cliente', state: 'pending' }), 'Enviada al cliente');
  assert.equal(statusText({ legacy_status: null, state: 'cancelled' }), 'Cancelada');
});

test('días vencidos', () => {
  assert.equal(daysOverdue('2026-11-01', '2026-11-11'), 10); assert.equal(daysOverdue('2026-12-01', '2026-11-11'), 0); assert.equal(daysOverdue(null, '2026-11-11'), null);
});

test('montos por moneda y métricas del control en el orden del diseño', () => {
  const m = [{ currency: 'MXN', invoiced: '5000', outstanding: '0' }, { currency: 'USD', invoiced: '1740', outstanding: '1740' }];
  assert.deepEqual(moneyList(m, 'invoiced'), ['$5,000.00 MXN', '$1,740.00 USD']);
  assert.deepEqual(moneyList(m, 'outstanding'), ['$1,740.00 USD'], 'omite monedas en cero');
  const c = controlCards({ ready_to_invoice: 1, active: 2, pending_payment: 1, overdue: 1, paid: 1 }, m);
  assert.deepEqual(c.map(x => x.title), ['Listos para facturar', 'Facturas vigentes', 'Pendientes de pago', 'Vencidas', 'Pagadas', 'Total facturado']);
  assert.deepEqual(c.slice(0, 5).map(x => x.value), [1, 2, 1, 1, 1]); assert.deepEqual(c[5].value, ['$5,000.00 MXN', '$1,740.00 USD']);
});
