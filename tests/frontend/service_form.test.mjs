// Servicios Operativos · formulario "Nuevo servicio" (expediente): lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_OPTIONS, AUTH_TYPES, AUTH_STATUSES, REQUIRES, DETAIL_SCHEMAS, detailFields, schemaCode, initialService, authBadge, contractingState, poLabel,
  totals, totalsText, nextServiceFolio, fileProblem, fileSize, validateService, serviceWarnings, serviceRecord, lockedServiceText } from '../../src/views/services/serviceFormModel.mjs';
import { serviceOptions, serviceRequisition, emptyRequest } from '../../src/views/services/newRequestModel.mjs';

// Datos sintéticos con la forma de /recovery/catalogs, /services/new-request y /services/new-request/contracting.
const CLIENTS = [{ id: 'c1', code: '9001', name: 'CLIENTE SINTÉTICO NORTE', project: 'PRY-N', contract: 'CTR-N', contact: 'Ana', email: 'ana@n.invalid' }, { id: 'c2', code: '9002', name: 'CLIENTE SINTÉTICO SUR' }];
const OPTIONS = serviceOptions([{ code: 'svc_type_1', name: 'Suministro de agua', active: true }, { code: 'svc_type_2', name: 'Transporte', active: true }]);
const K = { suppliers: [{ id: 's1', code: 'PRV-1', name: 'Pipas Sintéticas' }, { id: 's2', code: 'PRV-2', name: 'Grúas QA' }],
  purchase_orders: [{ id: 'p1', folio: 'OC-QA-1', supplier_id: 's1', currency: 'MXN', total: 3500, status: 'Emitida', services: 0 }, { id: 'p2', folio: 'OC-QA-2', supplier_id: 's2', currency: 'USD', total: 1200.5, status: 'Aceptada', services: 2 }] };
const opt = k => OPTIONS.find(o => o.key === k);
const DRAFT = serviceRequisition({ ...emptyRequest('2026-11-23'), client_id: 'c1', folio: '9001-REQ-2026-0001', reference: 'SRV-PRY-N-2026-0002', project: 'PRY-N', contract: 'CTR-N', requester_name: 'Ana', requester_email: 'ana@n.invalid' }, opt('agua'), CLIENTS[0]);
const ctx = { options: OPTIONS, clients: CLIENTS, contracting: K };

test('estado inicial desde la requisición validada (como la captura del original)', () => {
  const f = initialService(DRAFT);
  assert.deepEqual([f.type, f.client_id, f.project, f.contract, f.request_date, f.status, f.auth_status, f.auth_currency, f.auth_amount, f.requires, f.quantity, f.unit, f.cost, f.price, f.description],
    ['agua', 'c1', 'PRY-N', 'CTR-N', '2026-11-23', 'Solicitado', 'Pendiente de documento', 'MXN', '0', 'no', '1', 'servicio', '0', '0', 'Suministro de agua']);
  assert.equal(STATUS_OPTIONS(['Autorizado', 'En proceso'])[0], 'Solicitado');
  assert.ok(STATUS_OPTIONS(['En proceso']).includes('En proceso') && STATUS_OPTIONS([]).length === 11, '11 estatus del diseño + los registrados');
  assert.ok(AUTH_TYPES.includes('Orden de Servicio (SO) del cliente') && AUTH_TYPES.includes('Correo de autorización'), 'incluye los tipos registrados en la base real');
  assert.deepEqual([AUTH_STATUSES[0], REQUIRES.map(r => r[1])], ['Pendiente de documento', ['No · Ejecución con recursos propios', 'Sí · Requiere proveedor externo']]);
});

test('formulario dinámico por tipo con las claves details_json del original', () => {
  assert.deepEqual(detailFields('agua').map(f => f[1]), ['Proveedor / pipa', 'Pipa / unidad', 'Placas', 'Operador', 'Volumen entregado (L o m³)', 'Lugar de entrega', 'Ticket / folio', 'Hora inicio', 'Hora término']);
  assert.deepEqual(detailFields('transporte').map(f => f[0]), ['origin', 'destination', 'vehicleType', 'vehicle', 'plates', 'operator', 'cargo', 'weight', 'pod', 'departure', 'arrival']);
  assert.deepEqual(detailFields('last_mile').map(f => f[0]), ['origin', 'destination', 'guide', 'packages', 'weight', 'vehicle', 'operator', 'recipient', 'pod', 'deliveryTime']);
  assert.deepEqual(detailFields('rise_x').map(f => f[0]), ['site', 'platformUser', 'requestObject', 'subjectName', 'externalReference', 'captureDate', 'approvalDate', 'result', 'captureTime']);
  assert.equal(detailFields('grua'), null, 'sin capturas ni registros: no se inventan campos');
  assert.deepEqual(Object.keys(DETAIL_SCHEMAS), ['agua', 'transporte', 'last_mile', 'rise_x']);
  assert.deepEqual([schemaCode('Gestión Rise X'), schemaCode('Last Mile Deliveries'), schemaCode('Transporte')], ['legacy_gestion_rise_x', 'legacy_last_mile_deliveries', 'legacy_transporte']);
});

test('autorización comercial: badges', () => {
  assert.deepEqual(authBadge('Pendiente de documento'), [{ text: 'Documento pendiente', tone: 'amber' }]);
  assert.deepEqual(authBadge('Autorizada / recibida', true).map(b => b.text), ['Autorización válida', 'Con documento adjunto']);
  assert.equal(authBadge('Pendiente de regularización')[0].text, 'Pendiente / regularización');
  assert.equal(authBadge('Rechazada')[0].tone, 'red');
  assert.deepEqual(authBadge('Otro estatus')[0], { text: 'Otro estatus', tone: 'gray' });
});

test('contratación de proveedor: interna, proveedor, OC vinculada y quitar vínculo', () => {
  const f = initialService(DRAFT);
  let c = contractingState(f, K);
  assert.deepEqual([c.badge.text, c.external, c.canManage, c.canUnlink, c.poCurrency, c.poHelp], ['Ejecución interna', false, false, false, '—', 'Bloqueado hasta seleccionar un proveedor externo.']);
  assert.deepEqual(c.info, ['Ejecución interna.', 'Supply Base ejecutará el servicio con recursos propios; no se requiere una OC a proveedor.']);
  c = contractingState({ ...f, requires: 'yes' }, K);
  assert.deepEqual([c.badge.text, c.canManage, c.supplier], ['Proveedor por definir', true, null]);
  c = contractingState({ ...f, requires: 'yes', supplier_id: 's1' }, K);
  assert.deepEqual([c.badge.text, c.orders.map(o => o.folio), c.poHelp], ['OC pendiente', ['OC-QA-1'], '1 OC vigente(s) del proveedor (sin canceladas ni sustituidas).']);
  c = contractingState({ ...f, requires: 'yes', supplier_id: 's1', po_id: 'p1' }, K);
  assert.deepEqual([c.badge.text, c.canUnlink, c.poCost, c.poCurrency, c.info[0]], ['OC vinculada', true, 3500, 'MXN', 'OC vinculada.']);
  assert.match(c.info[1], /^OC-QA-1 · Pipas Sintéticas · \$3,500\.00 MXN · Emitida\.$/);
  assert.equal(contractingState({ ...f, requires: 'yes', supplier_id: 's1', po_id: 'p2' }, K).po, null, 'una OC de otro proveedor no se vincula');
  assert.equal(contractingState({ ...f, requires: 'yes', supplier_id: 'zz' }, K).poHelp, 'Bloqueado hasta seleccionar un proveedor externo.');
  assert.equal(poLabel(K.purchase_orders[1]), 'OC-QA-2 · $1,200.50 USD · Aceptada · 2 servicio(s)');
});

test('importes, margen y folio sugerido del expediente', () => {
  assert.deepEqual(totalsText(totals({ cost: '3500', price: '6500' })), { cost: '$3,500.00', price: '$6,500.00', margin: '$3,000.00 (46.2%)' });
  assert.deepEqual(totalsText(totals({ cost: '0', price: '0' })), { cost: '$0.00', price: '$0.00', margin: '$0.00 (0.0%)' });
  assert.equal(totals({ cost: '100', price: '80' }).margin, -20);
  assert.equal(totals({ cost: 'x', price: '' }).margin, 0);
  assert.deepEqual([nextServiceFolio({ 2026: 7 }, '2026-11-23'), nextServiceFolio({}, '2027-01-02'), nextServiceFolio(undefined, '2026-05-05')], ['SRV-2026-00008', 'SRV-2027-00001', 'SRV-2026-00001']);
});

test('validación (bloqueante) de Guardar servicio', () => {
  const f = initialService(DRAFT);
  assert.equal(validateService(f, ctx), null);
  const field = (patch, c = ctx) => validateService({ ...f, ...patch }, c)?.field;
  assert.equal(field({ type: 'zzz' }), 'type');
  assert.equal(field({ client_id: '' }), 'client_id');
  assert.equal(field({ request_date: '2026-02-31' }), 'request_date');
  assert.equal(field({ need_date: 'mañana' }), 'need_date');
  assert.equal(field({ auth_valid_until: '2026-13-01' }), 'auth_valid_until');
  assert.equal(field({ quantity: '0' }), 'quantity');
  assert.equal(field({ quantity: '1,5' }), 'quantity');
  assert.equal(field({ quantity: '2.5' }), undefined);
  assert.equal(field({ unit: ' ' }), 'unit');
  assert.equal(field({ cost: '-1' }), 'cost');
  assert.equal(field({ price: '1e3' }), 'price');
  assert.equal(field({ auth_amount: 'abc' }), 'auth_amount');
  assert.equal(field({ project: 'p'.repeat(256) }), 'project');
  assert.equal(field({ notes: 'a\nb' }), undefined, 'observaciones con saltos de línea');
  assert.equal(field({ requires: 'yes', supplier_id: 'zz' }), 'supplier_id');
  assert.equal(field({ requires: 'yes', supplier_id: 's1', po_id: 'p2' }), 'po_id');
  assert.equal(field({ details: { plates: 'x'.repeat(501) } }), 'detail-plates');
  assert.equal(field({ evidence: [{ name: 'a.exe', type: 'application/x-msdownload', size: 10 }] }), 'evidence');
  assert.equal(field({ auth_file: { name: 'big.pdf', type: 'application/pdf', size: 9 * 1024 * 1024 } }), 'auth_file');
  assert.equal(fileProblem({ name: 'ok.png', type: 'image/png', size: 2048 }), null);
  assert.match(fileProblem({ name: 'v.pdf', type: 'application/pdf', size: 0 }), /vacío/);
  assert.deepEqual([fileSize(2048), fileSize(3 * 1048576)], ['2 KB', '3.0 MB']);
});

test('avisos no bloqueantes, registro que se guardaría y texto de bloqueo', () => {
  const f = { ...initialService(DRAFT), client_id: 'c2', need_date: '2026-11-01', cost: '100', price: '80', auth_status: 'Autorizada / recibida', requires: 'yes', supplier_id: 's2', auth_currency: 'MXN' };
  const w = serviceWarnings(f, { draft: DRAFT, contracting: K, option: opt('agua') });
  assert.deepEqual(w, ['Margen negativo: la venta ($80.00) es menor que el costo ($100.00).', 'La fecha requerida es anterior a la fecha de solicitud.', 'El cliente difiere del de la requisición vinculada 9001-REQ-2026-0001.',
    'Autorización marcada como recibida sin número / referencia ni documento.', 'Requiere proveedor externo y no tiene OC vinculada.', 'Sin evidencias cargadas.']);
  assert.ok(serviceWarnings({ ...f, requires: 'yes', supplier_id: 's2', po_id: 'p2' }, { draft: DRAFT, contracting: K, option: opt('agua') }).includes('La OC vinculada está en USD y la autorización del cliente en MXN.'));
  assert.ok(serviceWarnings({ ...initialService(DRAFT), type: 'grua' }, { draft: DRAFT, contracting: K, option: opt('grua') }).some(x => /formulario del original pendiente/.test(x)));
  const r = serviceRecord({ ...initialService(DRAFT), requires: 'yes', supplier_id: 's1', po_id: 'p1', details: { plates: ' ABC-1 ', ghost: 'x' }, evidence: [{ name: 'ticket.pdf' }] }, { draft: DRAFT, option: opt('agua'), client: CLIENTS[0], contracting: K, sequences: { 2026: 7 } });
  assert.deepEqual([r.folio, r.requisition, r.internal_reference, r.service_type, r.client, r.supplier, r.supplier_po, r.detail_schema_code, r.details.plates, 'ghost' in r.details, Object.keys(r.details).length, r.evidence],
    ['SRV-2026-00008', '9001-REQ-2026-0001', 'SRV-PRY-N-2026-0002', 'Suministro de agua', '9001 · CLIENTE SINTÉTICO NORTE', 'Pipas Sintéticas', 'OC-QA-1', 'legacy_suministro_de_agua', 'ABC-1', false, 9, ['ticket.pdf']]);
  assert.equal(lockedServiceText('SRV-2026-00008', '9001-REQ-2026-0001'), 'Datos validados, pero no se guardó el servicio (folio sugerido SRV-2026-00008): el alta del expediente en service_orders requiere un endpoint de escritura y el permiso INSERT, que no están autorizados, y la requisición 9001-REQ-2026-0001 tampoco se creó. Los archivos no se subieron. No se guardó nada en MariaDB.');
});
