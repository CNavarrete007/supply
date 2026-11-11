// Órdenes de Compra · pruebas de la lógica pura. Uso: node --test tests/frontend/purchase_orders_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { opLabel, statusTone, progressOf, buyerCards, issuanceGroups, amendedFamilies, poPrintHtml } from '../../src/views/purchaseOrders/model.mjs';

test('estatus: conocidos traducidos, desconocidos tal cual y tono', () => {
  assert.equal(opLabel('issued'), 'Emitida'); assert.equal(opLabel('cancelled', true), 'Cancelled'); assert.equal(opLabel('Liberada'), 'Liberada'); assert.equal(opLabel(null), '—');
  assert.match(statusTone('Cancelada'), /rose/); assert.match(statusTone('pending'), /amber/); assert.match(statusTone('received'), /emerald/); assert.match(statusTone('issued'), /blue/);
});

test('avance de recepción', () => {
  assert.deepEqual(progressOf({ received_percent: '50.00', receipt_count: 1 }), { pct: 50, known: true });
  assert.deepEqual(progressOf({ received_percent: 140 }), { pct: 100, known: true });
  assert.deepEqual(progressOf({ receipt_count: 0 }), { pct: 0, known: true });
  assert.deepEqual(progressOf({ receipt_count: 2 }), { pct: null, known: false }, 'recepción sin porcentaje: desconocido');
});

test('tarjetas por comprador y emisión agrupada por requisición', () => {
  const b = buyerCards({ buyers: [{ id: 'u1', name: 'Ana', count: 3 }], counters: { total: 5, without_buyer: 2 } });
  assert.deepEqual([b.all.count, b.items.length, b.none.count], [5, 1, 2]);
  const g = issuanceGroups({ losing_quotes: 4, items: [
    { requisition_id: 'r1', folio: 'R-1', client_name: 'C', supplier_id: 's1', supplier_name: 'A', items: 2, existing_pos: 'OC-1' },
    { requisition_id: 'r1', folio: 'R-1', client_name: 'C', supplier_id: 's2', supplier_name: 'B', items: 1, existing_pos: null },
    { requisition_id: 'r2', folio: 'R-2', client_name: 'D', supplier_id: 's1', supplier_name: 'A', items: '3', existing_pos: '' },
  ] });
  assert.equal(g.groups.length, 2); assert.equal(g.groups[0].suppliers.length, 2);
  assert.deepEqual(g.metrics, { awardedItems: 6, winningSuppliers: 2, toGenerate: 2, losingQuotes: 4 });
  assert.deepEqual(amendedFamilies([{ versions: 2 }, { versions: 1 }, { versions: 1, change_pending: true }]).length, 2);
});

test('formato de OC: escapado, partidas, totales y firmas', () => {
  const html = poPrintHtml({ item: { folio: 'OC-<1>', version_number: 2, supplier_name: 'Prov & Cía', currency: 'USD', subtotal_amount: '1500', tax_amount: '240', total_amount: '1740', buyer_name: 'Ana', authorizer_name: null },
    items: [{ line_number: 1, description: '<b>Placa</b>', quantity: '3.000000', unit_label: 'pza', unit_price: '500', line_subtotal: '1500' }] });
  assert.ok(html.includes('OC-&lt;1&gt; · Rev. 2') && html.includes('Prov &amp; Cía') && html.includes('&lt;b&gt;Placa&lt;/b&gt;') && !html.includes('<b>Placa'));
  assert.ok(html.includes('$1,740.00 USD') && html.includes('<strong>Ana</strong>') && html.includes('<strong>—</strong>'));
  assert.ok(poPrintHtml({ item: { folio: 'X' }, items: [] }).includes('Sin partidas registradas.'));
});
