// Tarjeta 9 · Decisión del cliente: lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_GROUPS, groupOf, decisionKpis, decisionCards, quoteReference, decisionActions, editBlock, emptyDecision, validateDecision, decisionEffect, EVIDENCE_MAX } from '../../src/views/quotes/cqDecision.mjs';

test('grupos de etapa iguales a los del servidor', () => {
  assert.deepEqual(DECISION_GROUPS.attention, [...DECISION_GROUPS.prep, ...DECISION_GROUPS.client, ...DECISION_GROUPS.change]);
  assert.deepEqual(['draft', 'authorized', 'expired', 'sent', 'approved', 'change_requested', 'rejected', 'superseded'].map(groupOf), ['prep', 'prep', 'client', 'client', 'approved', 'change', 'rejected', 'other']);
});

test('KPIs del encabezado desde el facet de estatus', () => {
  const k = decisionKpis([{ code: 'draft', count: 10 }, { code: 'review', count: 2 }, { code: 'authorized', count: 3 }, { code: 'sent', count: 1 }, { code: 'expired', count: 2 }, { code: 'approved', count: 13 }, { code: 'superseded', count: 4 }]);
  assert.deepEqual(k, { prep: 15, client: 3, approved: 13, change: 0, rejected: 0, attention: 18 });
});

test('tarjetas: "Todos los clientes" suma pendientes, sin respuesta y modificar', () => {
  const c = decisionCards([{ id: 'a', name: 'GlobalSantaFe Drilling Mexico', contact: 'Isabella Pursell', attention: 11, no_response: 1, change: 0, requisitions: 7 }, { id: 'b', name: 'EJEMPLO 1', contact: null, attention: 2, no_response: 0, change: 1, requisitions: 1 }]);
  assert.deepEqual([c[0].name, c[0].subtitle, c[0].tag, c[0].attention, c[0].no_response, c[0].change, c[0].footer], ['Todos los clientes', '2 clientes', 'TOD', 13, 1, 1, 'Vista general']);
  assert.deepEqual([c[1].tag, c[1].subtitle, c[1].footer], ['GD', 'Isabella Pursell', '7 requisición(es)']);
  assert.deepEqual([c[2].tag, c[2].subtitle], ['E1', 'EJEMPLO 1']);
});

test('referencia visible: cliente, interna o requisición', () => {
  assert.equal(quoteReference({ client_reference: '19900001303', requisition: 'REQ-1' }), '19900001303');
  assert.equal(quoteReference({ client_reference: ' ', internal_reference: '202609-REQ-2026-0001', requisition: 'REQ-1' }), '202609-REQ-2026-0001');
  assert.equal(quoteReference({ requisition: 'REQ-1' }), 'REQ-1');
});

test('botones por etapa', () => {
  assert.deepEqual(decisionActions({ status_key: 'authorized' }), { edit: true, send: true, decide: false, modify: false });
  assert.deepEqual(decisionActions({ status_key: 'draft' }), { edit: true, send: false, decide: false, modify: false });
  assert.deepEqual(decisionActions({ status_key: 'sent' }), { edit: false, send: false, decide: true, modify: false });
  assert.deepEqual(decisionActions({ status_key: 'expired' }), { edit: false, send: false, decide: true, modify: false });
  assert.deepEqual(decisionActions({ status_key: 'change_requested' }), { edit: false, send: false, decide: false, modify: true });
  assert.equal(editBlock({ status_key: 'draft', folio: 'X' }), null);
  assert.match(editBlock({ status_key: 'approved', folio: 'COT-9' }), /COT-9 ya fue enviada o decidida.*MODIFICAR DESDE REQ\./);
});

test('validación del formulario de decisión', () => {
  const row = { quote_date: '2026-09-17', valid_until: '2026-10-15' };
  const f = { ...emptyDecision({ client_contact: 'Contacto QA' }, '2026-11-17') };
  assert.equal(f.actor, 'Contacto QA');
  let v = validateDecision(f, row, '2026-11-17');
  assert.equal(v.ok, false); assert.equal(v.first, 'Selecciona la decisión del cliente.');
  v = validateDecision({ ...f, decision: 'approved' }, row, '2026-11-17');
  assert.equal(v.ok, true); assert.match(v.warnings[0], /venció el 2026-10-15/);
  assert.match(validateDecision({ ...f, decision: 'approved', date: '2026-11-18' }, row, '2026-11-17').errors.date, /futura/);
  assert.match(validateDecision({ ...f, decision: 'approved', date: '2026-09-16' }, row, '2026-11-17').errors.date, /anterior a la emisión/);
  assert.match(validateDecision({ ...f, decision: 'approved', date: '2026-02-30' }, row, '2026-11-17').errors.date, /inválida/);
  assert.match(validateDecision({ ...f, decision: 'approved', time: '25:00' }, row, '2026-11-17').errors.time, /inválida/);
  assert.match(validateDecision({ ...f, decision: 'rejected', note: 'caro' }, row, '2026-11-17').errors.note, /mínimo 10/);
  assert.equal(validateDecision({ ...f, decision: 'change_requested', note: 'Cambiar cantidad a 5 piezas' }, row, '2026-11-17').ok, true);
  assert.match(validateDecision({ ...f, decision: 'approved', actor: ' ' }, row, '2026-11-17').errors.actor, /quién decide/);
  assert.match(validateDecision({ ...f, decision: 'approved', channel: 'fax' }, row, '2026-11-17').errors.channel, /canal/);
  assert.match(validateDecision({ ...f, decision: 'approved', file: { type: 'text/plain', size: 5 } }, row, '2026-11-17').errors.file, /PDF, PNG o JPG/);
  assert.match(validateDecision({ ...f, decision: 'approved', file: { type: 'application/pdf', size: EVIDENCE_MAX + 1 } }, row, '2026-11-17').errors.file, /10 MB/);
  assert.equal(validateDecision({ ...f, decision: 'approved', file: { type: 'image/png', size: 2048 } }, row, '2026-11-17').ok, true);
  assert.match(validateDecision(f, row, '2026-11-17', true).first, /Select the client decision/);
});

test('efecto informativo de cada decisión', () => {
  assert.match(decisionEffect('approved'), /habilita la compra/);
  assert.match(decisionEffect('change_requested'), /MODIFICAR DESDE REQ\./);
  assert.match(decisionEffect('rejected'), /no autorizada/);
  assert.equal(decisionEffect(''), '');
});
