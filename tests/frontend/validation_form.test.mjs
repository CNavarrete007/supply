// Gestión del Contratista · tarjeta 1 "Registro de validación": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TECH_RESULTS, BUDGET_RESULTS, STRATEGIES, DEFAULT_CRITERIA, emptyValidation, clearKeepingRequisition, canQuote, blockReasons, requisitionOptions, buyerOptions, validateValidation, reviewPayload, reviewSavedText, reviewSaveError, importedEditBlock, nextStepBlock } from '../../src/views/contractorMgmt/validationForm.mjs';

const TODAY = '2026-11-19';
const BUYERS = [{ id: 'b1', name: 'QA Comprador', position: null, roles: 'Comprador', has_user: true, with_access: true }, { id: 'b2', name: 'Sin Usuario', position: 'Almacén', has_user: false, with_access: false },
  { id: 'b3', name: 'Inactivo', position: null, roles: 'Comprador', has_user: true, with_access: false }];
const REQ = { id: 'r1', folio: 'QA-REQ-1', need_date: '2026-12-01', rfq_count: 0, quote_count: 0, po_count: 0 };
const good = (o = {}) => ({ ...emptyValidation(), requisition: 'r1', buyer: 'b1', technical: 'Conforme', contract: 'Conforme', budget: 'Disponible', deadline: '2026-11-25', ...o });
const v = (f, ctx = {}) => validateValidation(f, { req: REQ, reviews: [], today: TODAY, buyers: BUYERS, ...ctx });

test('valores del diseño: Pendiente, Competencia abierta, 3 cotizaciones y criterios por defecto', () => {
  const f = emptyValidation();
  assert.deepEqual([f.technical, f.contract, f.budget, f.strategy, f.minQuotes, f.criteria, f.deadline], ['Pendiente', 'Pendiente', 'Pendiente', 'Competencia abierta', '3', DEFAULT_CRITERIA, '']);
  assert.equal(DEFAULT_CRITERIA, 'Precio, plazo, calidad, cumplimiento documental');
  assert.deepEqual(TECH_RESULTS.map(x => x[0]), ['Pendiente', 'Conforme', 'Con observaciones', 'No conforme']);
  assert.deepEqual(BUDGET_RESULTS.map(x => x[0]), ['Pendiente', 'Disponible', 'Parcial', 'No disponible']);
  assert.deepEqual(STRATEGIES.map(x => x[0]), ['Competencia abierta', 'Proveedor preferente', 'Compra urgente', 'Fuente única justificada']);
  assert.deepEqual(clearKeepingRequisition(good({ notes: 'x' })), { ...emptyValidation(), requisition: 'r1' });
});

test('regla para cotizar: técnica y contractual conformes (u observaciones) y presupuesto disponible o parcial', () => {
  assert.equal(canQuote({ technical: 'Conforme', contract: 'Con observaciones', budget: 'Parcial' }), true);
  assert.equal(canQuote({ technical: 'Pendiente', contract: 'Conforme', budget: 'Disponible' }), false);
  assert.equal(canQuote({ technical: 'Conforme', contract: 'No conforme', budget: 'Disponible' }), false);
  assert.equal(canQuote({ technical: 'Conforme', contract: 'Conforme', budget: 'No disponible' }), false);
  assert.equal(blockReasons({ technical: 'Conforme', contract: 'Pendiente', budget: 'No disponible' }), 'contractual pendiente, presupuesto no disponible');
});

test('selectores: requisición "FOLIO · PROYECTO · Cliente" y responsables con usuario activo', () => {
  assert.deepEqual(requisitionOptions([{ id: 'r1', folio: 'REQ-001', project: 'Proyecto ejemplo general', client_name: 'Cliente', review_count: 2 }]), [{ id: 'r1', label: 'REQ-001 · PROYECTO EJEMPLO GENERAL · Cliente · 2 validación(es)' }]);
  const o = buyerOptions(BUYERS);
  assert.deepEqual(o.map(x => [x.label, x.disabled]), [['QA Comprador · Comprador', false], ['Sin Usuario · Almacén (sin usuario en SupplyFlow)', true], ['Inactivo · Comprador (sin acceso)', true]]);
});

test('captura completa válida y que puede cotizar', () => {
  const r = v(good());
  assert.equal(r.ok, true, r.first);
  assert.equal(r.canQuote, true);
});

test('obligatorios y formatos', () => {
  const r = v({ ...emptyValidation(), minQuotes: 'x', criteria: '' });
  for (const k of ['requisition', 'buyer', 'minQuotes', 'criteria']) assert.ok(r.errors[k], k);
  assert.match(v(good({ buyer: 'b2' })).errors.buyer, /usuario activo/);
  assert.match(v(good({ buyer: 'b3' })).errors.buyer, /usuario activo/);
  assert.match(v(good({ minQuotes: '0' })).errors.minQuotes, /1 a 20/);
  assert.match(v(good({ minQuotes: '21' })).errors.minQuotes, /1 a 20/);
  assert.match(v(good({ deadline: '2026-11-18' })).errors.deadline, /anterior a hoy/);
  assert.match(v(good({ deadline: '2026-02-30' })).errors.deadline, /inválida/);
  assert.match(v(good({ criteria: 'x'.repeat(1001) })).errors.criteria, /1000/);
});

test('justificación obligatoria: fuente única, no conforme o sin presupuesto', () => {
  assert.match(v(good({ strategy: 'Fuente única justificada', minQuotes: '1' })).errors.notes, /Justifica/);
  assert.equal(v(good({ strategy: 'Fuente única justificada', minQuotes: '1', notes: 'Único distribuidor autorizado' })).ok, true);
  assert.match(v(good({ technical: 'No conforme' })).errors.notes, /Justifica/);
  assert.match(v(good({ budget: 'No disponible' })).errors.notes, /Justifica/);
  assert.equal(v(good({ budget: 'No disponible', notes: 'Sin partida presupuestal autorizada' })).ok, true);
});

test('advertencias: bloqueo para cotizar, fecha posterior a la requerida, historial y documentos posteriores', () => {
  const w = f => v(f, { reviews: [{ id: 'x' }], req: { ...REQ, rfq_count: 2, po_count: 1 } }).warnings.join(' | ');
  assert.match(w(good({ contract: 'Pendiente' })), /no podrá pasar a cotización \(contractual pendiente\)/);
  assert.match(w(good({ deadline: '2026-12-15' })), /posterior a la fecha requerida de la requisición \(2026-12-01\)/);
  assert.match(w(good()), /ya tiene 1 validación\(es\) registrada\(s\)/);
  assert.match(w(good()), /ya avanzó \(2 RFQ, 1 OC\)/);
  assert.match(w(good({ minQuotes: '1' })), /Competencia abierta con una sola cotización/);
  assert.match(w(good({ strategy: 'Compra urgente' })), /Compra urgente: documenta el motivo/);
  assert.match(w(good({ deadline: '' })), /Sin fecha límite/);
});

test('Guardar registra (cuerpo, mensaje y errores) y Siguiente paso solo si puede cotizar', () => {
  const body = reviewPayload(good({ minQuotes: ' 3 ', notes: ' nota ' }));
  assert.deepEqual(Object.keys(body).sort(), ['budget', 'buyer_id', 'contract', 'criteria', 'deadline', 'min_quotes', 'notes', 'requisition_id', 'strategy', 'technical']);
  assert.equal(body.min_quotes, '3'); assert.equal(body.notes, 'nota');
  const t = reviewSavedText({ folio: 'SCI-2026-0035', requisition: 'QA-REQ-1', can_quote: true }, REQ, good(), 'QA Comprador');
  assert.match(t, /^Validación interna SCI-2026-0035 de QA-REQ-1 guardada en MariaDB \(técnica conforme, contractual conforme, presupuesto disponible, competencia abierta, 3 cotización\(es\), responsable QA Comprador, puede cotizar\)/);
  assert.match(reviewSavedText({ folio: 'SCI-1', can_quote: false }, REQ, good({ budget: 'Pendiente' }), 'X'), /bloqueada para cotizar/);
  assert.match(reviewSavedText({ folio: 'SCI-1', version: 3, changed: ['budget', 'min_quotes'] }, REQ, good(), 'X'), /^Cambios de SCI-1 guardados en MariaDB \(presupuesto, mínimo de cotizaciones\); versión 3\.$/);
  assert.equal(reviewSavedText({ folio: 'SCI-1', changed: [] }, REQ, good(), 'X'), 'No había cambios por guardar.');
  assert.equal(reviewSaveError(0, {}).retry, true);
  assert.equal(reviewSaveError(422, { error: { code: 'INVALID_VALIDATION', field: 'min_quotes' } }).field, 'minQuotes');
  assert.match(reviewSaveError(503, { error: { code: 'MGMT_WRITE_NOT_PROVISIONED' } }).text, /no está habilitado en este equipo\. No se guardó nada/);
  assert.match(reviewSaveError(412, {}).text, /Otra persona modificó/);
  assert.match(importedEditBlock({ folio: 'SCI-2026-0006', imported: true }), /importada del sistema original/);
  assert.equal(importedEditBlock({ folio: 'SCI-2026-0050', imported: false }), '');
  assert.match(nextStepBlock(emptyValidation()), /Selecciona una requisición/);
  assert.match(nextStepBlock(good({ technical: 'Pendiente' })), /No puede avanzar a Estrategia y lotificación: técnica pendiente/);
  assert.equal(nextStepBlock(good()), '');
  assert.equal(v({ ...emptyValidation() }, {}).errors.requisition, 'Selecciona la requisición.');
  assert.equal(validateValidation({ ...emptyValidation() }, {}, true).errors.requisition, 'Select the requisition.');
});
