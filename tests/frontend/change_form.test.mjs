// R3A · formulario "Modificación controlada de requisición" (lógica pura). node --test tests/frontend/change_form.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, TYPES, emptyChange, toChangePayload, validateChange, validateDraft, lineResult, changeOutcome, changeBlockMessage, normQty } from '../../src/views/recovery/changeForm.mjs';

const detail = { version: 3, need_date: '2026-10-20', delivery_place: 'Almacén QA', current_revision_number: 0,
  items: [{ id: 'a0000000-0000-4000-8000-000000000001', description: 'Material sintético', quantity: '3.000000', unit: 'pza', category: 'Materiales' },
    { id: 'a0000000-0000-4000-8000-000000000002', description: 'Equipo QA', quantity: '1.500000', unit: 'jgo', category: 'Equipos' }] };
const filled = (patch = {}) => ({ ...emptyChange(detail, '2026-11-12'), requested_by: 'QA Solicitante', source: SOURCES[0][0], change_type: 'Cambio de cantidad', reason: 'Cliente pide 5 piezas.', ...patch });

test('fuentes y tipos idénticos al contrato del servidor (RequisitionChangeInput)', () => {
  assert.deepEqual(SOURCES.map(s => s[0]), ['Correo del cliente', 'PO / OC modificada del cliente', 'Orden de Servicio revisada', 'Portal del cliente', 'Minuta', 'Llamada confirmada por escrito', 'Otro']);
  assert.deepEqual(TYPES.map(s => s[0]), ['Cambio de cantidad', 'Eliminación de partida', 'Agregar partida', 'Cambio de especificación', 'Cambio de fecha requerida', 'Cambio de lugar de entrega', 'Cambio de alcance', 'Otro']);
});

test('normaliza cantidades como el servidor', () => {
  assert.equal(normQty('3.000000'), '3'); assert.equal(normQty('2.500'), '2.5'); assert.equal(normQty('10'), '10'); assert.equal(normQty('0.000'), '0'); assert.equal(normQty('1,5'), '1,5');
});

test('formulario inicial desde la requisición: todas las partidas en Mantener', () => {
  const f = emptyChange(detail, '2026-11-12');
  assert.equal(f.date, '2026-11-12'); assert.equal(f.lines.length, 2); assert.ok(f.lines.every(l => l.action === 'keep'));
  assert.equal(f.lines[0].quantity, '3'); assert.equal(f.base.need_date, '2026-10-20');
});

test('sin cambios reales no se envía nada (y Modificar sin diferencias no cuenta)', () => {
  const f = filled(); f.lines[0].action = 'modify';
  const v = validateChange(f); assert.equal(v.ok, false); assert.match(v.errors.changes, /al menos un cambio real/);
  assert.equal(lineResult(f.lines[0]), 'same');
  assert.deepEqual(toChangePayload(f).items, []);
});

test('payload solo con diferencias: modificar, cancelar, encabezado y altas', () => {
  const f = filled({ change_type: 'Cambio de alcance', need_date: '2026-12-01', delivery_place: ' Patio 2 ' });
  f.lines[0] = { ...f.lines[0], action: 'modify', quantity: '5.0' };
  f.lines[1] = { ...f.lines[1], action: 'cancel' };
  f.additions = [{ description: 'Partida nueva', quantity: '2', unit: 'pza', category: 'Materiales' }];
  assert.equal(validateChange(f).ok, true);
  const p = toChangePayload(f);
  assert.deepEqual(p.header, { need_date: '2026-12-01', delivery_place: 'Patio 2' });
  assert.deepEqual(p.items, [
    { action: 'modify', id: detail.items[0].id, description: 'Material sintético', quantity: '5', unit: 'pza', category: 'Materiales' },
    { action: 'cancel', id: detail.items[1].id },
    { action: 'add', description: 'Partida nueva', quantity: '2', unit: 'pza', category: 'Materiales' }]);
  assert.deepEqual(Object.keys(p).sort(), ['change_type', 'date', 'header', 'items', 'reason', 'reference', 'requested_by', 'source']);
  assert.equal(lineResult(f.lines[0]), 'modified'); assert.equal(lineResult(f.lines[1]), 'cancelled');
});

test('campos obligatorios y límites como el servidor', () => {
  const f = filled({ requested_by: ' ', source: 'Whatsapp', change_type: '', reason: '' }); f.lines[0].action = 'cancel';
  const e = validateChange(f).errors;
  assert.ok(e.requested_by && e.source && e.change_type && e.reason);
  assert.ok(validateChange(filled({ reference: 'x'.repeat(256), lines: [] })).errors.reference);
});

test('reglas de tipo para altas de partidas', () => {
  const add = [{ description: 'Nueva', quantity: '1', unit: 'pza', category: 'Materiales' }];
  assert.match(validateChange(filled({ change_type: 'Agregar partida' })).errors.change_type, /al menos una partida nueva/);
  assert.match(validateChange(filled({ change_type: 'Cambio de cantidad', additions: add })).errors.change_type, /Agregar partida o Cambio de alcance/);
  assert.equal(validateChange(filled({ change_type: 'Agregar partida', additions: add })).ok, true);
});

test('cantidad inválida o cero en partida modificada o nueva', () => {
  for (const q of ['0', '0.000', '-1', '1,5', '1.1234567', 'abc', '']) {
    const f = filled(); f.lines[0] = { ...f.lines[0], action: 'modify', quantity: q };
    assert.ok(validateChange(f).errors[`line:${detail.items[0].id}`], q);
    assert.ok(validateDraft({ description: 'x', quantity: q, unit: 'pza', category: 'Materiales' }), q);
  }
  assert.equal(validateDraft({ description: 'x', quantity: '2.25', unit: 'pza', category: 'Materiales' }), '');
  assert.ok(validateDraft({ description: 'x', quantity: '2', unit: 'pza', category: '' }));
});

test('no se permite vaciar fecha requerida ni lugar de entrega existentes', () => {
  const f = filled({ need_date: '', delivery_place: '' }); f.lines[0].action = 'cancel';
  const e = validateChange(f).errors; assert.ok(e.need_date && e.delivery_place);
});

test('resultado del POST: reintento con la misma clave solo cuando el resultado es incierto', () => {
  assert.equal(changeOutcome({}).keep, true);
  assert.equal(changeOutcome({ status: 503 }).keep, true);
  assert.equal(changeOutcome({ status: 403, code: 'CSRF_INVALID' }).keep, true);
  assert.equal(changeOutcome({ status: 409, code: 'BUSY' }).keep, true);
  const stale = changeOutcome({ status: 412, code: 'STALE_VERSION' }); assert.equal(stale.keep, false); assert.equal(stale.reload, true);
  assert.equal(changeOutcome({ status: 409, code: 'CHANGE_ALREADY_EXISTS' }).reload, true);
  assert.match(changeOutcome({ status: 409, code: 'READ_ONLY_RECORD' }).message, /RF1 propias/);
  assert.match(changeOutcome({ status: 401 }).message, /sesión/);
  assert.equal(changeOutcome({ status: 422, message: 'Tipo de cambio no válido.' }).message, 'Tipo de cambio no válido.');
});

test('motivos de bloqueo de Solicitar modificación', () => {
  assert.match(changeBlockMessage('imported'), /importado/);
  assert.match(changeBlockMessage('not_owner'), /Solo quien capturó/);
  assert.match(changeBlockMessage('pending_change', 'CR-2026-0001'), /CR-2026-0001 pendiente/);
  assert.match(changeBlockMessage('imported', null, true), /Imported historical/);
  assert.equal(changeBlockMessage(null), '');
});
