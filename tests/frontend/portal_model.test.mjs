// Portal del Cliente · vista previa interna: presentación (node --test; datos sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { money, portalState, clientOption, requisitionOption, stageStatus, photoTotals, quoteDocument } from '../../src/views/portal/portalModel.mjs';

test('estado del portal del cliente', () => {
  assert.equal(portalState({ portal_enabled: false, portal_locked: true }), 'Portal deshabilitado');
  assert.equal(portalState({ portal_enabled: true, portal_locked: true }), 'Portal bloqueado');
  assert.equal(portalState({ portal_enabled: true, portal_locked: false }, false), 'Portal enabled');
  assert.equal(clientOption({ code: 'QA9', name: 'CLIENTE SINTÉTICO NORTE', portal_enabled: true, portal_locked: false }), 'QA9 · CLIENTE SINTÉTICO NORTE · Portal habilitado');
});

test('requisición y etapas (8 etapas de la política del servidor)', () => {
  assert.equal(requisitionOption({ folio: 'REQ-QA-1', project: 'PRY', stage: 4 }), 'REQ-QA-1 · PRY · Etapa 4');
  assert.equal(requisitionOption({ folio: 'REQ-QA-2', project: '', stage: null }), 'REQ-QA-2 · Sin proyecto · Sin etapa inferida');
  assert.deepEqual([1, 4, 5, 8].map(i => stageStatus(i, 4)), ['completed', 'current', 'pending', 'pending']);
  assert.deepEqual([1, 8].map(i => stageStatus(i, null)), ['pending', 'pending']);
});

test('fotografías y montos', () => {
  assert.deepEqual(photoTotals({ receipts: [{ photos: 2 }, { photos: 1 }], deliveries: [{ photos: 4 }] }), { receipt: 3, delivery: 4 });
  assert.deepEqual(photoTotals(null), { receipt: 0, delivery: 0 });
  assert.equal(money(2262), '2,262.00');
  assert.equal(money(null), '—');
});

test('formato de cotización: totales guardados, sin costos internos', () => {
  const doc = quoteDocument({
    quote: { folio: 'CQ-QA-9', revision: 1, quote_date: '2026-10-10', valid_until: '2026-11-30', currency: 'USD', status_label: 'Aprobada', client_name: 'CLIENTE SINTÉTICO NORTE',
      subtotal_amount: 1950, discount_amount: 0, tax_rate_pct: 16, tax_amount: 312, total_amount: 2262, service_fee_enabled: false, third_party_total_amount: null,
      prepared_by: 'QA Admin A', lead_time_text: '5 días hábiles' },
    items: [{ line_number: 1, description: 'Material sintético', brand_model: null, unit_label: 'pza', quantity: 3, unit_price: 650, line_subtotal: 1950 }],
    issuer: { legal_name: 'Organización Sintética QA' },
  });
  assert.equal(doc.folio, 'CQ-QA-9');
  assert.deepEqual(doc.items[0], { id: 1, desc: 'Material sintético', brand: '—', qty: 3, unit: 'pza', price: 650, subtotal: 1950 });
  assert.equal(doc.totales.total, 2262);
  assert.equal(doc.totales.descuento, null);
  assert.equal(doc.totales.terceros, null);
  assert.equal(doc.totales.fee, null);
  assert.equal(doc.condiciones.tiempoEntrega, '5 días hábiles');
  assert.equal(doc.cliente.contacto, '—');
  assert.equal(doc.emisor.legal_name, 'Organización Sintética QA');
  assert.doesNotMatch(JSON.stringify(doc), /cost|margin/);
});
