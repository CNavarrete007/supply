// Tarjeta 11 · Matriz interna de proveedores: lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierCards, quoteStatus, requisitionRef, pct, leadText, scoreTone, scoresFromComparison, deleteBlock, supplierQuoteHtml } from '../../src/views/quotes/supplierMatrix.mjs';

test('tarjetas: "Todas las cotizaciones" suma y cada proveedor muestra activas', () => {
  const c = supplierCards([{ id: 'a', name: 'ULINE SHIPPING SUPPLIES', total: 5, awarded: 3, active: 2 }, { id: 'b', name: '001', total: 1, awarded: 1, active: 0 }]);
  assert.deepEqual([c[0].name, c[0].tag, c[0].boxes, c[0].footer], ['Todas las cotizaciones', 'TOD', [[6, 'Cotizaciones'], [4, 'Adjudicadas'], [2, 'Sin adjudicar']], 'Abrir todas']);
  assert.deepEqual([c[1].tag, c[1].subtitle, c[1].boxes[2], c[1].footer], ['US', 'Proveedor', [2, 'Activas'], 'Abrir proveedor']);
  assert.equal(c[2].tag, '00');
});

test('estatus: adjudicada total/parcial o el registrado', () => {
  assert.equal(quoteStatus({ awarded_lines: 2, req_items: 2 }).text, 'Adjudicada total');
  assert.equal(quoteStatus({ awarded_lines: 1, req_items: 3 }).text, 'Adjudicada parcial');
  assert.equal(quoteStatus({ awarded: true, awarded_lines: 0 }).text, 'Adjudicada');
  assert.equal(quoteStatus({ legacy_status: 'No seleccionada', status: 'received' }).text, 'No seleccionada');
  assert.match(quoteStatus({ legacy_status: 'No seleccionada' }).tone, /rose/);
  assert.equal(quoteStatus({ status: 'received' }).text, 'Recibida');
});

test('requisición, porcentajes, entrega y color del puntaje', () => {
  assert.deepEqual(requisitionRef({ client_reference: '19900001411', requisition: 'REQ-1' }), { main: '19900001411', sub: 'REQ-1' });
  assert.deepEqual(requisitionRef({ requisition: 'REQ-1' }), { main: 'REQ-1', sub: '' });
  assert.equal(pct('100.0000'), '100%'); assert.equal(pct(null), '—'); assert.equal(pct('87.55'), '87.6%');
  assert.equal(leadText('3.0000'), '3 días'); assert.equal(leadText(null), '—'); assert.equal(leadText(21, true), '21 days');
  assert.match(scoreTone(45), /rose/); assert.match(scoreTone(70), /amber/); assert.match(scoreTone(90), /emerald/);
});

test('puntaje desde el comparativo (mismo criterio que la tarjeta 5)', () => {
  const cmp = { quotes: [{ id: 'A', currency: 'MXN', total_amount: 400, lead_days: 7, technical_score: 90 }, { id: 'B', currency: 'MXN', total_amount: 380, lead_days: 12, technical_score: 70 }],
    lines: [{ id: 'L1', line_status: 'active', offers: [{ quote_id: 'A', offered: true, currency: 'MXN', unit_price: '400' }, { quote_id: 'B', offered: true, currency: 'MXN', unit_price: '380' }] }] };
  const s = scoresFromComparison(cmp);
  assert.equal(s.A.recommended, true); assert.equal(s.B.recommended, false);
  assert.equal(s.A.score, 75.5); assert.equal(s.B.score, 66.7);
  assert.deepEqual(scoresFromComparison(null), {});
});

test('eliminar: con adjudicación vigente se conserva', () => {
  assert.match(deleteBlock({ folio: 'COT-1', awarded: true }), /COT-1 tiene adjudicación vigente/);
  assert.equal(deleteBlock({ folio: 'COT-2', awarded: false, awarded_lines: 0 }), null);
});

test('documento interno: datos escapados y aviso de costos', () => {
  const d = supplierQuoteHtml({ item: { folio: 'COT-<1>', supplier_name: 'A & B', currency: 'MXN', total_amount: 10, subtotal_amount: 10, status: 'received' }, items: [{ line_number: 1, description: '<script>x</script>', requested_quantity: '1', offered: true, quantity: '1', unit_label: 'pza', unit_price: '10', line_subtotal: '10' }] });
  assert.ok(d.html.includes('COT-&lt;1&gt;') && d.html.includes('A &amp; B') && d.html.includes('&lt;script&gt;'));
  assert.ok(!d.html.includes('<script>'));
  assert.match(d.html, /no compartir con el cliente/);
});
