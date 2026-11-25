// Gestión del Contratista · tarjeta 2 "Estrategia y lotificación": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_STRATEGIES, NO_RFQ, isAuthorized, isAssignable, statusLabel, routeOf, requisitionOptions, suggestedFor, defaultStrategy, initialState, autoGroup, addLot, refreshSuggestions,
  setItem, setLot, toggleSupplier, selectSuggested, addSupplier, removeLot, rfqsByLot, lotView, strategyStats, validateStrategy, strategyPayload, strategySavedText, strategySaveError, nextRfq, nextRfqText } from '../../src/views/contractorMgmt/strategyModel.mjs';

// Catálogo y detalle sintéticos con la forma de GET /strategy-setup y /strategy/{id}.
const SUP = [
  { id: 's1', name: 'Centurion FR', status: 'authorized', legacy_status: 'Autorizado', category: 'EPP y seguridad', offering_categories: [] },
  { id: 's2', name: 'Grainger', status: 'active', category: 'Herramientas', offering_categories: ['EPP y Seguridad'] },
  { id: 's3', name: 'Office Depot', status: 'authorized', category: 'Papelería, equipos electrónicos', offering_categories: [] },
  { id: 's4', name: 'En Evaluación SA', status: 'under_evaluation', category: 'EPP y seguridad', offering_categories: [] },
  { id: 's5', name: 'Suspendido SA', status: 'suspended', category: 'EPP y seguridad', offering_categories: [] },
];
const ITEMS = [{ id: 'i1', line_number: 1, description: 'Casco', category: 'EPP y seguridad', sent: [] }, { id: 'i2', line_number: 2, description: 'Cuaderno profesional', category: 'Papeleria, equipos electronicos', sent: [] },
  { id: 'i3', line_number: 3, description: 'Guantes', category: 'EPP y seguridad', sent: [{ rfq: 'RFQ-9', supplier_name: 'X' }] }];
const ITEM = { id: 'r1', folio: 'REQ-2', technical: 'Conforme', contract_result: 'Conforme', budget: 'Disponible', strategy: 'Competencia abierta', min_quotes: 3, has_po: false };
const D = { item: ITEM, items: ITEMS, plan: null, rfqs_without_lot: [] };
const PLAN = { ...D, plan: { version: 1, min_quotes: 2, lots: [{ key: 'L1', name: 'EPP y seguridad', min_quotes: 2, items: [{ id: 'i1', strategy: 'Proveedor preferente' }], suppliers: [{ id: 's1', selected: true, suggested: true }, { id: 's4', selected: false, suggested: false }], rfqs: [{ folio: 'RFQ-1', supplier_id: 's1' }] }] } };
const ctx = { detail: D, suppliers: SUP };

test('estrategias, rutas y estatus del catálogo', () => {
  assert.deepEqual(ITEM_STRATEGIES.map(s => s[0]), ['Competencia abierta', 'Proveedor preferente', 'Fuente única justificada', 'Precio histórico auto', 'Compra urgente']);
  assert.equal(routeOf('Competencia abierta').text, 'RFQ por lote');
  assert.equal(routeOf(NO_RFQ).text, 'Precio histórico (sin RFQ)');
  assert.deepEqual([isAuthorized(SUP[1]), isAuthorized(SUP[3]), isAssignable(SUP[3]), isAssignable(SUP[4])], [true, false, true, false]);
  assert.deepEqual([statusLabel(SUP[0]), statusLabel(SUP[1]), statusLabel(SUP[3]), statusLabel(SUP[3], true)], ['Autorizado', 'Activo', 'En evaluación', 'Under evaluation']);
});

test('selector de requisiciones validadas: bloqueadas deshabilitadas al final con el motivo', () => {
  const o = requisitionOptions([{ id: 'b', folio: 'REQ-B', client_name: 'Uno', project: 'p', technical: 'Conforme', contract_result: 'Pendiente', budget: 'Disponible' }, { id: 'a', folio: 'REQ-A', client_name: 'Ejemplo 1', project: 'Ejemplo', technical: 'Conforme', contract_result: 'Con observaciones', budget: 'Parcial' }]);
  assert.deepEqual(o.map(x => [x.id, x.disabled]), [['a', false], ['b', true]]);
  assert.equal(o[0].label, 'REQ-A · EJEMPLO 1 · EJEMPLO');
  assert.match(o[1].label, /bloqueada: contractual pendiente/);
});

test('sugerencias: proveedores autorizados por categoría propia o de sus suministros (sin acentos)', () => {
  assert.deepEqual(suggestedFor(['EPP y seguridad'], SUP), ['s1', 's2']);
  assert.deepEqual(suggestedFor(['Papeleria, equipos electronicos'], SUP), ['s3']);
  assert.deepEqual(suggestedFor([''], SUP), []);
});

test('propuesta inicial sin plan: un lote por categoría con sugeridos seleccionados', () => {
  const st = initialState(D, SUP);
  assert.equal(st.minQuotes, '3'); assert.equal(st.fromPlan, false);
  assert.deepEqual(st.lots.map(l => [l.name, l.suppliers.map(s => s.id), l.minQuotes]), [['EPP y seguridad', ['s1', 's2'], '3'], ['Papeleria, equipos electronicos', ['s3'], '3']]);
  assert.deepEqual(Object.values(st.items).map(x => x.lot), ['N1', 'N2', 'N1']);
  assert.equal(defaultStrategy({ history_based: true }, ITEM), NO_RFQ);
  // Rutas de «Crear desde historial»: solo reutilizar proveedor omite la RFQ.
  assert.equal(defaultStrategy({ history_based: true, repeat_sourcing_mode: 'reuse' }, ITEM), NO_RFQ);
  assert.notEqual(defaultStrategy({ history_based: true, fixed_client_price: true, repeat_sourcing_mode: 'requote' }, ITEM), NO_RFQ);
  assert.notEqual(defaultStrategy({ history_based: true, repeat_sourcing_mode: 'validate' }, ITEM), NO_RFQ);
  assert.notEqual(defaultStrategy({ history_based: false, repeat_sourcing_mode: 'requote' }, ITEM), NO_RFQ);
  assert.equal(defaultStrategy({}, { strategy: 'Otra' }), 'Competencia abierta');
});

test('plan registrado: lotes, estrategias, proveedores y RFQ creadas por lote', () => {
  const st = initialState(PLAN, SUP);
  assert.equal(st.minQuotes, '2'); assert.equal(st.fromPlan, true);
  assert.deepEqual(st.items.i1, { strategy: 'Proveedor preferente', lot: 'L1' });
  assert.deepEqual(st.items.i2, { strategy: 'Competencia abierta', lot: '' }, 'partida fuera del plan queda sin lote');
  const v = lotView(st, st.lots[0], ITEMS, rfqsByLot(PLAN));
  assert.deepEqual([v.lines.length, v.selected, v.created, v.pending], [1, 1, 1, 0]);
  assert.match(validateStrategy(st, { detail: PLAN, suppliers: SUP }).lineErrors.i2, /Asigna la partida a un lote/);
  const g = autoGroup(st, ITEMS, SUP);
  assert.equal(g.lots.find(l => l.name === 'EPP y seguridad').key, 'L1', 'reagrupar conserva el lote registrado (y sus RFQ) por nombre');
});

test('estadísticas: partidas, lotes con partidas, proveedores distintos, sin RFQ y RFQ pendientes', () => {
  let st = initialState(D, SUP);
  assert.deepEqual(strategyStats(st, ITEMS, {}), { items: 3, lots: 2, suppliers: 3, noRfq: 0, pending: 3 });
  st = setItem(st, 'i2', { strategy: NO_RFQ });
  assert.equal(st.items.i2.lot, '', 'precio histórico no lleva lote');
  assert.deepEqual(strategyStats(st, ITEMS, {}), { items: 3, lots: 1, suppliers: 2, noRfq: 1, pending: 2 });
});

test('edición: nuevo lote, proveedores manuales, seleccionar sugeridos, actualizar sugeridos y quitar lote', () => {
  let st = addLot(initialState(D, SUP));
  assert.deepEqual(st.lots.at(-1), { key: 'N3', name: 'Lote 3', minQuotes: '3', persisted: false, suppliers: [] });
  st = addSupplier(st, 'N1', 's4'); st = addSupplier(st, 'N1', 's4');
  assert.equal(st.lots[0].suppliers.filter(s => s.id === 's4').length, 1);
  st = toggleSupplier(st, 'N1', 's1'); assert.equal(st.lots[0].suppliers.find(s => s.id === 's1').selected, false);
  st = selectSuggested(st, 'N1'); assert.equal(st.lots[0].suppliers.find(s => s.id === 's1').selected, true);
  st = setItem(st, 'i2', { lot: 'N1' });
  st = refreshSuggestions(st, ITEMS, SUP);
  assert.deepEqual(st.lots[0].suppliers.map(s => [s.id, s.suggested]), [['s1', true], ['s2', true], ['s3', true], ['s4', false]], 'agrega sugeridos de la nueva categoría y conserva el manual');
  st = removeLot(st, 'N1');
  assert.ok(Object.values(st.items).every(x => x.lot !== 'N1'));
  st = setLot(st, 'N3', { name: 'Especial' }); assert.equal(st.lots.find(l => l.key === 'N3').name, 'Especial');
});

test('validación: requisición, mínimos, lotes, proveedores y advertencias del diseño', () => {
  assert.match(validateStrategy(initialState(D, SUP), { detail: null }).first, /Selecciona una requisición validada/);
  const ok = validateStrategy(initialState(D, SUP), ctx);
  assert.equal(ok.ok, true, ok.first);
  assert.ok(ok.warnings.some(w => /^EPP y seguridad: hay 2 proveedor\(es\) seleccionado\(s\) y el mínimo configurado es 3\. Puedes guardar, pero documenta la excepción si continúas así\.$/.test(w)));
  assert.ok(ok.warnings.some(w => /Partida #3 ya se envió en RFQ-9/.test(w)));
  let st = initialState(D, SUP);
  assert.match(validateStrategy({ ...st, minQuotes: '0' }, ctx).errors.minQuotes, /1 a 20/);
  assert.match(validateStrategy(setLot(st, 'N1', { name: '' }), ctx).lotErrors.N1, /Nombre del lote obligatorio/);
  assert.match(validateStrategy(setLot(st, 'N2', { name: 'epp Y seguridad' }), ctx).lotErrors.N2, /repetido/);
  assert.match(validateStrategy(setLot(st, 'N1', { minQuotes: '25' }), ctx).lotErrors.N1, /1 a 20/);
  st = toggleSupplier(toggleSupplier(st, 'N1', 's1'), 'N1', 's2');
  assert.match(validateStrategy(st, ctx).lotErrors.N1, /al menos un proveedor/);
  st = addSupplier(st, 'N1', 's5');
  assert.match(validateStrategy(st, ctx).lotErrors.N1, /no asignable \(Suspendido SA: suspendido\)/);
  const w = validateStrategy(addSupplier(initialState(D, SUP), 'N1', 's4'), ctx).warnings.join(' | ');
  assert.match(w, /En Evaluación SA \(en evaluación\) no está autorizado/);
  assert.match(validateStrategy(initialState(D, SUP), { detail: { ...D, item: { ...ITEM, contract_result: 'Pendiente' } }, suppliers: SUP }).errors.requisition, /no puede pasar a cotización: contractual pendiente/);
  assert.ok(validateStrategy(addLot(initialState(D, SUP)), ctx).warnings.some(w2 => /Lote 3: sin partidas asignadas/.test(w2)));
});

test('guardar estrategia (cuerpo, mensajes) y siguiente RFQ que no se abre', () => {
  const st = initialState(D, SUP);
  const body = strategyPayload(st, D);
  assert.deepEqual(Object.keys(body).sort(), ['items', 'lots', 'min_quotes']);
  assert.equal(body.items.length, D.items.length);
  assert.ok(body.items.every(i => i.lot === '' ? i.strategy === NO_RFQ : st.lots.some(l => l.key === i.lot)));
  assert.ok(body.lots.every(l => l.suppliers.every(s => s.selected || s.suggested)));
  assert.match(strategySavedText({ requisition: 'REQ-2', plan_version: 2, lots: 2, suppliers: 3, rfq_lines: 3, no_rfq_lines: 0 }), /^Estrategia de REQ-2 guardada en MariaDB como versión 2 \(2 lote\(s\), 3 proveedor\(es\) seleccionado\(s\), 3 partida\(s\) por RFQ y 0 por precio histórico\)\. Las versiones anteriores y sus RFQ se conservan\.$/);
  assert.equal(strategySaveError(412, {}).reload, true);
  assert.equal(strategySaveError(409, { error: { code: 'LINES_CHANGED' } }).reload, true);
  assert.equal(strategySaveError(0, {}).retry, true);
  assert.match(strategySaveError(409, { error: { code: 'REVIEW_BLOCKS_QUOTING', message: 'La validación vigente SCI-1 no permite pasar a cotización.' } }).text, /no permite pasar a cotización/);
  const withNoRfq = initialState({ ...PLAN, plan: { ...PLAN.plan, no_rfq_items: [PLAN.items[PLAN.items.length - 1].id] } }, SUP);
  assert.equal(withNoRfq.items[PLAN.items[PLAN.items.length - 1].id].strategy, NO_RFQ);
  const n = nextRfq(st, 'N1', ctx);
  assert.equal(n.supplier.name, 'Centurion FR');
  assert.match(nextRfqText(n, 'REQ-2'), /^Siguiente RFQ del lote «EPP y seguridad» de REQ-2: Centurion FR con 2 partida\(s\) \(#1, #3\)\. No se abrió/);
  const p = initialState(PLAN, SUP);
  assert.match(nextRfq(p, 'L1', { detail: PLAN, suppliers: SUP }).error, /todas las RFQ de los proveedores seleccionados ya están creadas/);
  assert.match(nextRfq(addLot(st), 'N3', ctx).error, /no tiene partidas que requieran RFQ/);
  assert.match(strategySavedText({ requisition: 'REQ-2', plan_version: 1, lots: 1, suppliers: 1, rfq_lines: 1, no_rfq_lines: 0 }, true), /^Strategy of REQ-2 saved to MariaDB as version 1/);
});
