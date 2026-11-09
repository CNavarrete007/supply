// INT03-D1 · Unit tests for the pure R2 regularization helpers. Run: node --test tests/int03d1/
import test from 'node:test';
import assert from 'node:assert/strict';
import { regState, regRows, regKpis, regMethodFor, emptyRegularization, validateRegularization, regularizationPayload, regOutcome, validRegDate, isImportedRestriction, regMethodLabel, REG_METHODS } from '../../src/views/recovery/model.mjs';

const DAY = '2026-11-09';
const row = (o) => ({ id: o.id || 'x', folio: o.folio || 'SOL-PROV-2026-0001', client: 'Cliente', is_provisional: true, regularization_status: 'Pendiente de requisición formal', regularization_due_date: '2026-11-20', regularization_requirement: 'formal', ...o });
const evidence = { name: 'req.pdf', data: 'JVBERi0=', mime: 'application/pdf', size: 5 };

test('methods mirror backend RequisitionRegularizationInput::METHODS', () => {
  assert.deepEqual(REG_METHODS.map(x => x[0]), ['formal', 'po', 'email', 'portal', 'contract', 'management', 'emergency', 'other']);
  assert.equal(regMethodLabel('contract'), 'Base contractual / Call-off');
});

test('state: pending, overdue, done, non-provisional', () => {
  assert.equal(regState(row({}), DAY), 'pending');
  assert.equal(regState(row({ regularization_due_date: '2026-11-08' }), DAY), 'overdue');
  assert.equal(regState(row({ regularization_due_date: DAY }), DAY), 'pending');
  assert.equal(regState(row({ regularization_status: 'Regularizada · Requisición formal', regularization_due_date: '2020-01-01' }), DAY), 'done');
  assert.equal(regState(row({ is_provisional: false }), DAY), null);
  assert.equal(regState(row({ regularization_requirement: 'contract', regularization_due_date: null }), DAY), 'pending');
});

test('rows: only provisional, overdue first, filters and search', () => {
  const rows = [row({ id: 'a', regularization_due_date: '2026-11-30' }), row({ id: 'b', regularization_due_date: '2026-11-01', folio: 'SOL-PROV-2026-0002' }),
    row({ id: 'c', regularization_status: 'Regularizada · Evidencia alternativa', updated_at: '2026-11-09 10:00:00' }), { id: 'd', is_provisional: false, folio: 'F' }];
  assert.deepEqual(regRows(rows, { day: DAY }).map(r => r.id), ['b', 'a', 'c']);
  assert.deepEqual(regRows(rows, { day: DAY, state: 'done' }).map(r => r.id), ['c']);
  assert.deepEqual(regRows(rows, { day: DAY, query: '0002' }).map(r => r.id), ['b']);
  assert.deepEqual(regKpis(rows, DAY), { total: 3, pending: 1, overdue: 1, done: 1 });
});

test('default method follows the recorded requirement', () => {
  assert.equal(regMethodFor('formal'), 'formal');
  assert.equal(regMethodFor('alternative'), 'email');
  assert.equal(regMethodFor('contract'), 'contract');
  assert.equal(emptyRegularization('contract').evidence, null);
});

test('validation mirrors server rules without inventing new ones', () => {
  const ok = { method: 'formal', date: DAY, reference: 'REQ-1', notes: '', evidence };
  assert.equal(validateRegularization(ok), null);
  assert.match(validateRegularization({ ...ok, evidence: null }), /evidencia/);
  assert.equal(validateRegularization({ ...ok, method: 'contract', evidence: null }), null);
  assert.match(validateRegularization({ ...ok, reference: '   ' }), /referencia/i);
  assert.match(validateRegularization({ ...ok, reference: 'x'.repeat(256) }), /255/);
  assert.equal(validateRegularization({ ...ok, reference: 'ñ'.repeat(255) }), null);
  assert.match(validateRegularization({ ...ok, notes: 'a\u0001b' }), /control/);
  assert.match(validateRegularization({ ...ok, method: 'fax' }), /método/);
  assert.match(validateRegularization({ ...ok, date: '2026-02-30' }), /fecha/i);
  assert.match(validateRegularization({ ...ok, evidence: { ...evidence, size: 8388609 } }), /8 MiB/);
  assert.match(validateRegularization({ ...ok, evidence: { ...evidence, mime: 'text/plain' } }), /PDF/);
  assert.equal(validRegDate('0999-01-01'), false);
  assert.equal(validRegDate('2024-02-29'), true);
});

test('payload uses only backend-accepted keys and trims', () => {
  const p = regularizationPayload({ method: 'po', date: DAY, reference: '  PO-9 ', notes: '  ', evidence });
  assert.deepEqual(Object.keys(p), ['method', 'date', 'reference', 'notes', 'evidence']);
  assert.equal(p.reference, 'PO-9');
  assert.equal(p.notes, null);
  assert.deepEqual(p.evidence, { name: 'req.pdf', data: 'JVBERi0=' });
  assert.equal(regularizationPayload({ method: 'contract', date: DAY, reference: 'C', notes: 'n', evidence: null }).evidence, null);
});

test('HTTP outcomes: keep key only when the result is uncertain or retry-safe', () => {
  const e = (status, code) => Object.assign(new Error('srv'), { status, code });
  assert.equal(regOutcome(new Error('network')).keep, true);
  assert.equal(regOutcome(e(503, 'RECOVERY_UNAVAILABLE')).keep, true);
  assert.equal(regOutcome(e(403, 'CSRF_INVALID')).keep, true);
  assert.equal(regOutcome(e(409, 'BUSY')).keep, true);
  assert.equal(regOutcome(e(401, 'NOT_AUTHENTICATED')).auth, true);
  const stale = regOutcome(e(412, 'STALE_VERSION'));
  assert.equal(stale.keep, false); assert.equal(stale.reload, true);
  assert.equal(regOutcome(e(409, 'NOT_PENDING_REGULARIZATION')).reload, true);
  assert.equal(regOutcome(e(409, 'IDEMPOTENCY_CONFLICT')).keep, false);
  assert.equal(regOutcome(e(422, 'INVALID_REQUISITION')).message, 'srv');
  assert.equal(regOutcome(e(403, 'FORBIDDEN')).keep, false);
});

test('imported history is never offered for regularization', () => {
  assert.equal(isImportedRestriction({ restriction: 'Histórico importado: edición pendiente de conciliación.' }), true);
  assert.equal(isImportedRestriction({ restriction: 'Requiere Control de cambios.' }), false);
});
