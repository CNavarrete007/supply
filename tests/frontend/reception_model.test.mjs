// Recepción y Entrega · pruebas de la lógica pura. Uso: node --test tests/frontend/reception_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { label, tone, isAccepted, reasonLabel, pct, shortHash, bytes, closureCards, deliveryHtml } from '../../src/views/reception/model.mjs';

test('etiquetas, tonos y aceptación', () => {
  assert.equal(label('accepted'), 'Aceptada'); assert.equal(label('pending', true), 'Pending'); assert.equal(label('Aceptado'), 'Aceptado'); assert.equal(label(null), '—');
  assert.ok(isAccepted('accepted') && isAccepted('Aceptado') && isAccepted('ACEPTADA por cliente'));
  assert.ok(!isAccepted('No aceptado') && !isAccepted('pending') && !isAccepted(null), '"No aceptado" no cuenta como aceptado');
  assert.match(tone('Aceptado'), /emerald/); assert.match(tone('No conforme'), /rose/); assert.match(tone('Con observaciones'), /amber/); assert.match(tone('Incompleta'), /rose/);
  assert.equal(reasonLabel('documentation'), 'Documentación incompleta');
});

test('formatos de porcentaje, hash y tamaño', () => {
  assert.equal(pct(66.67), '66.67%'); assert.equal(pct(null), '—'); assert.equal(shortHash('7f09511f015935f96f7c'), 'SHA-256 7f09511f0159…'); assert.equal(shortHash(null), null);
  assert.equal(bytes(2048), '2.0 KB'); assert.equal(bytes(500), '500 B');
});

test('semáforo: cinco tarjetas en el orden del diseño', () => {
  const c = closureCards({ po_without_receipt: 1, receipts_pending: 2, deliveries_missing: 3, acceptance_pending: 4, ready_to_invoice: 5 });
  assert.deepEqual(c.map(x => x.count), [1, 2, 3, 4, 5]);
  assert.deepEqual(c.map(x => x.title), ['OC sin recepción', 'Recepciones con pendientes', 'Entregas no registradas', 'Aceptaciones pendientes', 'Listos para facturar']);
  assert.equal(closureCards({})[0].count, 0);
});

test('acuse de entrega escapado, con origen, firmas y saldo', () => {
  const html = deliveryHtml({ item: { folio: 'ENT-<1>', client_name: 'Cliente & Co', date: '2026-10-22', acceptance_status: 'accepted', delivered_by: 'QA', received_by: '<b>R</b>', locked: true },
    items: [{ line_number: 1, requisition: 'REQ-1', description: 'Placa', delivered: 3, unit_label: 'pza', requested: 3, balance: 0 }],
    sources: [{ po_folio: 'OC-1', receipt_folio: 'REC-1' }], signatures: [{ signer: 'R', role: 'client_receiver', method: 'Firma', signed_at: '2026-10-22 18:00:00', document_sha256: 'abcdef0123456789' }] });
  assert.ok(html.includes('ENT-&lt;1&gt;') && html.includes('Cliente &amp; Co') && html.includes('&lt;b&gt;R&lt;/b&gt;') && !html.includes('<b>R</b>'));
  assert.ok(html.includes('OC-1 / REC-1') && html.includes('Recibe (cliente)') && html.includes('SHA-256 abcdef012345…') && html.includes('firmado y bloqueado'));
});
