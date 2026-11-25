// Gestión del Contratista · tarjeta 3 "Matriz de validaciones internas" + modo edición de la tarjeta 1 (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SIZES, initials, matrixChip, buyerCards, matrixRow, deleteBlock, deleteError, deleteLockedText, editPreset, emptyCostSource, validateCostSource, costSourceLockedText, rangeText } from '../../src/views/contractorMgmt/validationMatrix.mjs';
import { fromPreset, changedFields, validateValidation } from '../../src/views/contractorMgmt/validationForm.mjs';

// Fila sintética con la forma de GET /api/v1/contractor-management/validations.
const X = { id: 'v1', folio: 'SCI-2026-0006', requisition_id: 'r1', requisition: '19900001263', client_reference: 'CR-1', internal_reference: 'TRS-0141', client_name: 'Ejemplo 1', buyer: 'Karla Barbosa Castellanos',
  buyer_person_id: 'p1', buyer_key: 'u1', technical: 'Conforme', contract: 'Conforme', budget: 'Parcial', strategy: 'Fuente única justificada', min_quotes: 1, deadline: '2026-11-10', criteria: 'Precio', notes: 'Distribuidor exclusivo',
  created_at: '2026-10-01 10:00:00', imported: false, can_quote: true, latest: true, rfq_count: 0, quote_count: 0, po_count: 0 };
const SUM = { validations: 34, can_quote: 33, blocked: 1, buyers: [{ key: 'u1', name: 'Karla Barbosa Castellanos', total: 20, can_quote: 19, blocked: 1 }, { key: 'unassigned', name: null, total: 1, can_quote: 1, blocked: 0 }] };

test('tarjetas por responsable y chip del diseño', () => {
  assert.equal(matrixChip(SUM), '2 responsable(s) · 34 validación(es)');
  const c = buyerCards(SUM);
  assert.deepEqual(c.map(x => [x.key, x.badge, x.name, x.total, x.can, x.blocked, x.foot]), [['all', 'TOD', 'Todas las validaciones', 34, 33, 1, 'Abrir todas'], ['u1', 'KB', 'KARLA BARBOSA CASTELLANOS', 20, 19, 1, 'Abrir responsable'], ['unassigned', '—', 'Sin responsable', 1, 1, 0, 'Abrir responsable']]);
  assert.equal(c[1].sub, 'Responsable de compras');
  assert.equal(initials('Aram Asriel Mendiola Huerta'), 'AA');
  assert.deepEqual(PAGE_SIZES, [10, 25, 50]);
});

test('fila de la matriz: referencia, resultados, fuente única y ¿puede cotizar?', () => {
  const v = matrixRow(X);
  assert.deepEqual([v.folio, v.requisition, v.requisitionSub, v.reference, v.buyer], ['SCI-2026-0006', '19900001263', 'CR-1 · Ejemplo 1', 'TRS-0141', 'KARLA BARBOSA CASTELLANOS']);
  assert.deepEqual([v.technical.tone, v.budget.text, v.budget.tone, v.sole, v.canQuote.text], ['green', 'Parcial', 'amber', true, 'Sí']);
  const b = matrixRow({ ...X, contract: 'Pendiente', budget: 'No disponible', can_quote: false, strategy: 'Compra urgente', latest: false, internal_reference: null });
  assert.deepEqual([b.contract.tone, b.budget.tone, b.sole, b.canQuote.text, b.reference], ['gray', 'red', false, 'No (Bloqueado)', '—']);
  assert.match(b.folioSub, /Histórica \(sustituida\)/);
});

test('eliminar: importada o vigente con documentos posteriores se conserva; si no, folio y motivo', () => {
  assert.match(deleteBlock({ ...X, imported: true }), /importada del sistema original/);
  assert.match(deleteBlock({ ...X, rfq_count: 2, po_count: 1 }), /validación vigente de 19900001263, que ya tiene 2 RFQ, 1 OC/);
  assert.equal(deleteBlock({ ...X, rfq_count: 2, latest: false }), null, 'una validación sustituida no sostiene los documentos');
  assert.equal(deleteBlock(X), null);
  assert.match(deleteError(X, 'x', 'motivo suficiente'), /Escribe el folio SCI-2026-0006/);
  assert.match(deleteError(X, 'sci-2026-0006', 'corto'), /mínimo 10/);
  assert.equal(deleteError(X, 'SCI-2026-0006', 'Captura duplicada'), '');
  assert.match(deleteLockedText(X), /^Datos validados, pero no se eliminó SCI-2026-0006/);
});

test('editar: precarga (con versión e importada), cambios detectados', () => {
  const p = editPreset(X);
  assert.deepEqual(p, { id: 'v1', folio: 'SCI-2026-0006', requisition: 'r1', buyer: 'p1', buyerName: 'Karla Barbosa Castellanos', technical: 'Conforme', contract: 'Conforme', budget: 'Parcial', strategy: 'Fuente única justificada', minQuotes: '1', deadline: '2026-11-10', criteria: 'Precio', notes: 'Distribuidor exclusivo', version: 1, imported: false });
  const f = fromPreset(p);
  const ctx = { today: '2026-11-19', buyers: [], edit: p };
  assert.match(validateValidation(f, ctx).errors.changes, /Sin cambios por guardar/);
  assert.equal(validateValidation(f, ctx).errors.deadline, undefined, 'la fecha límite registrada (pasada) se conserva al editar');
  const g = { ...f, budget: 'Disponible', notes: 'Distribuidor exclusivo con carta' };
  assert.deepEqual(changedFields(g, p), ['presupuesto', 'observaciones']);
  assert.equal(validateValidation(g, ctx).ok, true, validateValidation(g, ctx).first);
  assert.match(validateValidation({ ...g, deadline: '2026-11-11' }, ctx).errors.deadline, /anterior a hoy/, 'cambiarla a otra fecha pasada sí se rechaza');
  assert.equal(p.imported, false); assert.equal(p.version, 1); // la edición real usa la versión (If-Match) y bloquea las importadas
  assert.ok(!validateValidation(g, { ...ctx, reviews: [{}] }).warnings.some(w => /nuevo folio interno/.test(w)), 'al editar no se genera un folio nuevo');
});

test('fuente de costo (fuente única): costo por partida, moneda y fuente; no se registra', () => {
  const lines = [{ line_number: 1, description: 'Casco', quantity: 3, unit_label: 'pza' }, { line_number: 2, description: 'Guante', quantity: 5, unit_label: 'par' }];
  const f = emptyCostSource(lines);
  assert.deepEqual(f, { source: '', notes: '', lines: { 1: { cost: '', currency: 'MXN' }, 2: { cost: '', currency: 'MXN' } } });
  let v = validateCostSource(f, lines);
  assert.ok(v.errors.source && v.errors.lines);
  v = validateCostSource({ ...f, source: 'Cotización única', lines: { 1: { cost: '-5', currency: 'MXN' }, 2: { cost: '', currency: 'MXN' } } }, lines);
  assert.match(v.lineErrors[1], /Costo inválido/);
  const ok = { ...f, source: 'Cotización única del distribuidor', lines: { 1: { cost: '150.5', currency: 'USD' }, 2: { cost: '', currency: 'MXN' } } };
  assert.equal(validateCostSource(ok, lines).ok, true);
  assert.match(costSourceLockedText(X, ok, lines), /^Datos validados, pero no se registró la fuente de costo de 19900001263 \(SCI-2026-0006; 1 partida\(s\), fuente: Cotización única del distribuidor\): registrar costos es una escritura comercial bloqueada/);
});

test('rango de registros', () => {
  assert.equal(rangeText({ total: 34, page: 1, page_size: 10 }), '1-10 de 34 registros');
  assert.equal(rangeText({ total: 34, page: 4, page_size: 10 }), '31-34 de 34 registros');
  assert.equal(rangeText({ total: 0, page: 1, page_size: 10 }), '0-0 de 0 registros');
});
