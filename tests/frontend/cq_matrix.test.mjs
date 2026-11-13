// Tarjeta 8 · Matriz de cotizaciones al cliente: lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CQM_STATUSES, statusText, statusTone, initials, clientCards, approvalBadge, decisionText, canValidateBuyer, deleteBlock, folioConfirmed, changeTarget, matrixCaption, PENDING_KEYS } from '../../src/views/quotes/cqMatrix.mjs';
import { changeBlockMessage } from '../../src/views/recovery/changeForm.mjs';

test('los nueve estatus del filtro original, en orden', () => {
  assert.deepEqual(CQM_STATUSES.map(x => x[1]), ['Borrador', 'En revisión interna', 'Autorizada internamente', 'Enviada al cliente', 'Aprobada', 'Solicitud de modificación', 'Rechazada', 'Vencida', 'Sustituida']);
  assert.deepEqual(PENDING_KEYS, ['draft', 'review', 'authorized', 'sent', 'change_requested']);
});

test('etiqueta y color del estatus; fuera de los nueve se muestra la etiqueta importada', () => {
  assert.equal(statusText({ status_key: 'expired' }), 'Vencida');
  assert.equal(statusText({ status_key: 'approved' }, true), 'Approved');
  assert.equal(statusText({ status_key: 'other', legacy_status: ' Cancelada por cliente ' }), 'Cancelada por cliente');
  assert.equal(statusText({ status_key: 'other', document_status: 'issued' }), 'Emitida');
  assert.match(statusTone('approved'), /blue/);
  assert.match(statusTone('draft'), /sky/);
  assert.match(statusTone('zzz'), /slate/);
});

test('iniciales del avatar como en el diseño', () => {
  assert.equal(initials('EJEMPLO 1'), 'E1');
  assert.equal(initials('GlobalSantaFe Drilling Mexico'), 'GD');
  assert.equal(initials('Pemex'), 'PE');
  assert.equal(initials('  '), '—');
});

test('tarjeta "Todas las cotizaciones" suma las de cada cliente', () => {
  const cards = clientCards([{ id: 'a', name: 'Uno', total: 3, approved: 1, pending: 1 }, { id: 'b', name: 'Dos', total: 1, approved: 0, pending: 1 }]);
  assert.equal(cards.length, 3);
  assert.deepEqual([cards[0].id, cards[0].total, cards[0].approved, cards[0].pending, cards[0].tag, cards[0].isAll], ['all', 4, 1, 2, 'TOD', true]);
  assert.deepEqual([cards[1].tag, cards[1].subtitle, cards[1].isAll], ['UN', 'Cliente', false]);
  assert.equal(clientCards([], true)[0].name, 'All quotes');
});

test('insignia de aprobación: nivel registrado o estado de aprobación interna', () => {
  assert.equal(approvalBadge({ approval_level: 1 }).text, 'Nivel 1 · Comprador');
  assert.equal(approvalBadge({ approval_level: 2 }).text, 'Nivel 2');
  assert.equal(approvalBadge({ approval_level: null, internal_approval_status: 'approved' }).text, 'Aprob. interna: Aprobada');
  assert.match(approvalBadge({ internal_approval_status: 'pending' }).tone, /amber/);
});

test('decisión del cliente: última registrada, importada o pendiente', () => {
  assert.deepEqual(decisionText({ last_decision: 'approved', last_decision_at: '2026-10-11 16:00:00.000000' }), { text: 'Aprobada', at: '2026-10-11 16:00', pending: false });
  assert.deepEqual(decisionText({ legacy_client_decision: 'Aceptada por correo' }), { text: 'Aceptada por correo', at: '', pending: false });
  assert.deepEqual(decisionText({ client_decision_status: 'pending' }), { text: 'Pendiente', at: '', pending: true });
});

test('VALIDAR COMPRADOR solo en borrador o revisión interna', () => {
  assert.equal(canValidateBuyer({ status_key: 'draft' }), true);
  assert.equal(canValidateBuyer({ status_key: 'review' }), true);
  assert.equal(canValidateBuyer({ status_key: 'approved' }), false);
});

test('eliminar: solo un borrador sin historial; lo emitido se conserva', () => {
  assert.equal(deleteBlock({ status_key: 'draft', versions: 1, folio: 'CQ-1' }), null);
  assert.match(deleteBlock({ status_key: 'draft', versions: 2, folio: 'CQ-1-R1' }), /trazabilidad/);
  assert.match(deleteBlock({ status_key: 'approved', folio: 'CQ-9' }), /CQ-9 está "Aprobada".*no se elimina/);
  assert.match(deleteBlock({ status_key: 'superseded', folio: 'CQ-9' }, true), /never deleted/);
  assert.equal(folioConfirmed({ folio: 'CQ-QA-0002' }, ' CQ-QA-0002 '), true);
  assert.equal(folioConfirmed({ folio: 'CQ-QA-0002' }, 'cq-qa-0002'), false);
  assert.equal(folioConfirmed({ folio: '' }, ''), false);
});

test('MODIFICAR DESDE REQ.: datos de la modificación controlada y motivo de bloqueo', () => {
  const row = { requisition_id: 'r', requisition: 'REQ-1', client_name: 'Uno', folio: 'CQ-1', revision: 0, can_request_change: false, change_block: 'superseded', current_folio: 'CQ-1-R1', pending_change: null };
  const t = changeTarget(row);
  assert.deepEqual([t.current_folio, t.current_rev, t.can_request_change, t.pending_change], ['CQ-1', 0, false, 'CQ-1-R1']);
  assert.match(changeBlockMessage(t.change_block, t.pending_change), /sustituida por CQ-1-R1/);
  assert.equal(changeTarget({ ...row, change_block: 'pending_change', pending_change: 'CR-7' }).pending_change, 'CR-7');
});

test('leyenda de la matriz abierta', () => {
  assert.equal(matrixCaption({ isAll: true }, 4, false), 'Mostrando 4 cotización(es) registradas');
  assert.equal(matrixCaption({ isAll: false, name: 'Uno' }, 2, true), 'Mostrando detalle de cotizaciones para Uno · con filtros aplicados');
});
