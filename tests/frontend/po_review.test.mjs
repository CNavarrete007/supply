// Órdenes de Compra · tarjeta 5 "Revisión y autorización": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewKpis, flowCard, flowStatus, historyRow, pendingAction, validateTaskDecision, MOD_FILTERS, modKind, modKpis, filterMods, modPill, validateModDecision, stamp } from '../../src/views/purchaseOrders/poReview.mjs';

// Filas sintéticas con la forma de GET /api/v1/purchase-orders/tasks.
const AUTH = { id: 'p1', folio: 'OC-1', version_number: 1, state_key: 'issued', approval_status: 'approved', authorized_on: '2026-10-14 15:08:00', requisitions: 'REQ-1', supplier_name: 'Office Depot',
  buyer_name: 'Isabela', preparer_name: 'Carlos', authorizer_name: 'Aime', total_amount: '516.2', currency: 'MXN', updated_at: '2026-10-14 15:08:00', me_buyer: false, me_preparer: false, me_authorizer: true, me_responsible: false,
  client_quote: { id: 'q1', folio: 'COT-33-4', revision: 0, total_amount: '18945.68', currency: 'MXN', approved_at: null } };
const TO_REVIEW = { ...AUTH, id: 'p2', folio: 'OC-2', approval_status: 'pending', authorized_on: null, preparer_name: null, current_responsible_role: 'reviewer', me_responsible: true, me_authorizer: false, client_quote: null };
const TO_AUTH = { ...TO_REVIEW, id: 'p3', folio: 'OC-3', preparer_name: 'Carlos', current_responsible_role: 'authorizer' };
const CANCELLED = { ...TO_REVIEW, id: 'p4', folio: 'OC-4', state_key: 'cancelled', legacy_status: 'Cancelada' };

test('KPI: pendientes para mí, relacionadas, autorizadas y notificaciones', () => {
  assert.deepEqual(reviewKpis({ my_tasks: [TO_REVIEW, TO_AUTH, CANCELLED, AUTH], related: [AUTH, TO_AUTH], notifications_unread: 3 }), { pendingMine: 2, related: 2, authorized: 1, unread: 3 });
  assert.deepEqual(reviewKpis({}), { pendingMine: 0, related: 0, authorized: 0, unread: 0 });
  assert.equal(pendingAction(CANCELLED), false); assert.equal(pendingAction(TO_AUTH), true);
});

test('estatus del flujo: autorizada, pendiente de revisión, pendiente de autorización, cancelada', () => {
  assert.equal(flowStatus(AUTH).text, 'Autorizada'); assert.equal(flowStatus(TO_REVIEW).text, 'Pendiente de revisión');
  assert.equal(flowStatus(TO_AUTH).text, 'Pendiente de autorización'); assert.equal(flowStatus(CANCELLED).text, 'Cancelada');
});

test('tarjeta: personas en mayúsculas, cotización aprobada, monto, actualizado y solo consulta', () => {
  const c = flowCard(AUTH);
  assert.equal(c.subtitle, 'REQ-1 · OFFICE DEPOT');
  assert.deepEqual(c.people.map(p => p[1]), ['ISABELA', 'CARLOS', 'AIME']);
  assert.equal(c.quote.line, 'COT-33-4 · Rev. 0 · Total cliente: $18,945.68 MXN'); assert.equal(c.quote.approved, 'Aprobada por Cliente · —');
  assert.equal(c.amount, '$516.20 MXN'); assert.equal(c.readOnly, true);
  assert.equal(flowCard(TO_AUTH).readOnly, false); assert.equal(flowCard(TO_AUTH).quote, null);
  assert.match(stamp('2026-10-14 15:08:00'), /14\/10\/26/);
});

test('decisión de tareas: segregación de funciones y motivo para devolver', () => {
  assert.equal(validateTaskDecision({ ...TO_AUTH, me_buyer: true }, 'authorize', '').ok, false);
  assert.match(validateTaskDecision({ ...TO_AUTH, me_preparer: true }, 'authorize', '').error, /preparó/);
  assert.equal(validateTaskDecision({ ...TO_REVIEW, me_preparer: true }, 'authorize', '').ok, true, 'en revisión, quien revisa envía a autorizar');
  assert.match(validateTaskDecision({ ...TO_REVIEW, me_buyer: true }, 'authorize', '').error, /no puede revisarla/);
  assert.match(validateTaskDecision(TO_AUTH, 'return', 'corto').error, /mínimo 10/);
  assert.equal(validateTaskDecision(TO_AUTH, 'return', 'Falta la referencia del cliente').ok, true);
  assert.match(validateTaskDecision(AUTH, 'authorize', '').error, /no tiene una tarea pendiente/);
});

test('historial: texto original o "{folio} {estado}", persona y comentario', () => {
  assert.deepEqual(historyRow({ occurred_at: '2026-10-14 15:08:00', folio: 'OC-32', legacy_action_text: 'OC-32 autorizada', actor_name: 'Aime Vega', comment_text: '' }).title, 'OC-32 · OC-32 autorizada');
  const h = historyRow({ occurred_at: '2026-10-13 23:20:00', folio: 'OC-31', to_state: 'pending_authorization', actor_name: 'Carlos', comment_text: 'lista' });
  assert.deepEqual([h.title, h.actor, h.comment], ['OC-31 · OC-31 pendiente de autorización', 'CARLOS', 'lista']);
});

const MODS = [
  { folio: 'MOD-1', status: 'pending', assigned_to_me: true, requested_by_me: false },
  { folio: 'MOD-2', status: 'pending', assigned_to_me: false, requested_by_me: false },
  { folio: 'MOD-3', status: 'approved', consumed_at: null, assigned_to_me: true },
  { folio: 'MOD-4', status: 'approved', consumed_at: '2026-11-01 10:00:00' },
  { folio: 'MOD-5', status: 'rejected' },
  { folio: 'MOD-6', status: 'pending', assigned_to_me: true, requested_by_me: true },
];

test('solicitudes de modificación: filtros del diseño, KPI y estatus', () => {
  assert.deepEqual(MOD_FILTERS.map(f => f[1]), ['Pendientes para mí', 'Todas las pendientes', 'Aprobadas sin ejecutar', 'Rechazadas / devueltas', 'Todo el historial']);
  assert.deepEqual(modKpis(MODS), { pendingMine: 2, pending: 3, approved: 1, executed: 1 });
  assert.deepEqual(filterMods(MODS, 'mine').map(m => m.folio), ['MOD-1', 'MOD-6']);
  assert.deepEqual(filterMods(MODS, 'approved').map(m => m.folio), ['MOD-3']);
  assert.deepEqual(filterMods(MODS, 'rejected').map(m => m.folio), ['MOD-5']);
  assert.equal(filterMods(MODS, 'all').length, 6);
  assert.equal(modKind(MODS[3]), 'executed'); assert.equal(modPill(MODS[2]).text, 'Aprobada sin ejecutar');
});

test('decidir solicitudes: solo la persona asignada, nunca la propia y motivo para rechazar', () => {
  assert.equal(validateModDecision(MODS[0], 'approve', '').ok, true);
  assert.match(validateModDecision(MODS[1], 'approve', '').error, /asignada/);
  assert.match(validateModDecision(MODS[5], 'approve', '').error, /tú enviaste/);
  assert.match(validateModDecision(MODS[0], 'reject', 'no').error, /mínimo 10/);
  assert.match(validateModDecision(MODS[2], 'approve', '').error, /ya no está pendiente/);
});
