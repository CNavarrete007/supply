// Campana de notificaciones: presentación de GET /api/v1/notifications (node --test; datos sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { entityModule, entityLabel, whenText, badgeCount, badgeText } from '../../src/views/notifications/model.mjs';

test('documento ligado → módulo de la barra lateral', () => {
  assert.equal(entityModule({ kind: 'purchase_order' }), 'purchase_orders');
  assert.equal(entityModule({ kind: 'customer_quote_version' }), 'quotes');
  assert.equal(entityModule({ kind: 'requisition' }), 'requisition');
  assert.equal(entityModule({ kind: 'service_order' }), 'operational_services');
  assert.equal(entityModule({ kind: 'goods_receipt' }), 'reception');
  assert.equal(entityModule({ kind: 'project' }), null);
  assert.equal(entityModule(null), null);
});

test('etiqueta del documento con folio (ES/EN)', () => {
  assert.equal(entityLabel({ kind: 'purchase_order', folio: 'OC-QA-1' }), 'OC OC-QA-1');
  assert.equal(entityLabel({ kind: 'purchase_order', folio: 'OC-QA-1' }, false), 'PO OC-QA-1');
  assert.equal(entityLabel({ kind: 'invoice', folio: null }), 'Factura');
  assert.equal(entityLabel({ kind: 'project', folio: 'P-1' }), 'project P-1');
  assert.equal(entityLabel(null), '');
});

test('fecha en UTC → relativa en las últimas 24 h, completa después', () => {
  const now = new Date('2026-11-23T18:00:00Z');
  assert.equal(whenText('2026-11-23 17:30:00.000000', true, now), 'hace 30 min');
  assert.equal(whenText('2026-11-23 15:00:00', false, now), '3 h ago');
  assert.equal(whenText('2026-11-23 17:59:59', true, now), 'hace 1 min');
  assert.equal(whenText('2026-11-20 10:30:00', true, now), new Date(Date.UTC(2026, 10, 20, 10, 30)).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }));
  assert.equal(whenText(null), '');
  assert.equal(whenText('no-es-fecha'), 'no-es-fecha');
});

test('contador de la campana: no leídas de MariaDB + avisos de la sesión sin leer', () => {
  assert.equal(badgeCount(4, [{ read: false }, { read: true }]), 5);
  assert.equal(badgeCount(undefined, []), 0);
  assert.equal(badgeText(7), '7');
  assert.equal(badgeText(120), '99+');
});
