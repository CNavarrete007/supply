// Cotizaciones y Comparativo · pruebas de la lógica pura. Uso: node --test tests/frontend/quotes_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { label, tone, comparisonView, seriesGroups, rfqState, customerQuoteHtml } from '../../src/views/quotes/model.mjs';

test('etiquetas y tonos', () => {
  assert.equal(label('change_requested'), 'Cambios solicitados'); assert.equal(label('approved', true), 'Approved'); assert.equal(label('Liberada'), 'Liberada'); assert.equal(label(null), '—');
  assert.match(tone('rejected'), /rose/); assert.match(tone('pending'), /amber/); assert.match(tone('approved'), /emerald/); assert.match(tone('superseded'), /slate/);
});

test('comparativo: mejor oferta por partida sin mezclar monedas y sin contar no ofertadas', () => {
  const v = comparisonView([{ line_number: 1, offers: [
    { quote_id: 'a', currency: 'USD', offered: true, unit_price: '500' }, { quote_id: 'b', currency: 'USD', offered: true, unit_price: '450' },
    { quote_id: 'c', currency: 'MXN', offered: true, unit_price: '9000' }, { quote_id: 'd', currency: 'USD', offered: false, unit_price: '1' } ] }, { line_number: 2, offers: [] }]);
  assert.equal(v[0].best, 'b'); assert.equal(v[0].currency, 'USD'); assert.equal(v[0].mixed, true);
  assert.equal(v[1].best, null);
});

test('versiones agrupadas por serie y estado de RFQ', () => {
  const g = seriesGroups([{ series: 'S1', version_number: 2, quote_date: '2026-10-10' }, { series: 'S1', version_number: 1, quote_date: '2026-10-09' }, { series: 'S2', version_number: 1, quote_date: '2026-09-01' }]);
  assert.deepEqual(g.map(x => x.series), ['S1', 'S2']); assert.deepEqual(g[0].versions.map(x => x.version_number), [1, 2]);
  assert.equal(rfqState({ responded: true, deadline: '2026-01-01' }, '2026-11-11'), 'answered');
  assert.equal(rfqState({ responded: false, deadline: '2026-11-01' }, '2026-11-11'), 'overdue');
  assert.equal(rfqState({ responded: false, deadline: '2026-12-01' }, '2026-11-11'), 'open');
});

test('formato para el cliente: escapado, sin costos y con condiciones', () => {
  const html = customerQuoteHtml({ item: { folio: 'CQ-<1>', version_number: 2, client_name: 'Cliente & Co', currency: 'USD', subtotal_amount: '1950', tax_amount: '312', total_amount: '2262', payment_terms: 'Crédito 30 días' },
    items: [{ line_number: 1, description: '<i>Material</i>', quantity: '3', unit_label: 'pza', unit_price: '650', line_subtotal: '1950', cost_amount: '1500' }] });
  assert.ok(html.includes('CQ-&lt;1&gt; · Rev. 1') && html.includes('Cliente &amp; Co') && html.includes('&lt;i&gt;Material&lt;/i&gt;'));
  assert.ok(html.includes('$2,262.00 USD') && html.includes('Crédito 30 días') && !html.includes('1,500.00'), 'no expone el costo');
});
