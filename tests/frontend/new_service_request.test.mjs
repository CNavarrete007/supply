// Servicios Operativos · sección 2 "Nueva solicitud": lógica pura del asistente (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { OPERATIONS, SERVICE_OPTIONS, STEPS, serviceOptions, clientLabel, filterClients, emptyRequest, applyClient, validateRequest,
  requestWarnings, folioTakenError, serviceRequisition, lockedText, httpMessage, validDate, localToday } from '../../src/views/services/newRequestModel.mjs';

// Catálogos sintéticos con la forma de GET /recovery/catalogs y GET /services/new-request (los códigos de la base real
// son svc_type_N y los del sandbox agua/transporte...: el vínculo es por nombre).
const CLIENTS = [
  { id: 'c1', code: '9001', name: 'CLIENTE SINTÉTICO NORTE', brand_name: 'Norte QA', tax_id: 'QAN010101AAA', project: 'PRY-NORTE', contract: 'CTR-1', contact: 'Ana Pérez', email: 'ana@norte.invalid', status: 'inactive' },
  { id: 'c2', code: '9002', name: 'CLIENTE SINTÉTICO SUR', brand_name: '', tax_id: 'QAS990101BBB', project: 'PRY-SUR', contract: '', contact: 'Luis Gómez', email: 'luis@sur.invalid', status: 'active' },
  { id: 'c3', code: '', name: 'ÁLAMO SINTÉTICO', brand_name: 'Alamo', tax_id: '', project: '', contract: '', contact: '', email: '', status: 'active' },
];
const TYPES = [
  { code: 'svc_type_2', name: 'Transporte', active: true }, { code: 'observed_1', name: 'Transporte de personal', active: false },
  { code: 'svc_type_7', name: 'Last Mile Deliveries', active: true }, { code: 'svc_type_9', name: 'Inspección submarina', active: true },
  { code: 'old', name: 'Servicio retirado', active: false },
];
const valid = () => ({ ...emptyRequest('2026-11-23'), client_id: 'c2', folio: '9002-REQ-2026-0003', reference: 'SRV-PRY-SUR-2026-0002', project: 'PRY-SUR', request_date: '2026-11-23', requester_name: 'Luis Gómez', requester_email: 'luis@sur.invalid' });

test('pasos, operaciones y los 9 servicios del original', () => {
  assert.deepEqual(STEPS.map(s => s[0]), ['1 · Operación', '2 · Servicio', '3 · Requisición']);
  assert.deepEqual(OPERATIONS.map(o => o.es), ['Compra / renta', 'Servicio']);
  assert.match(OPERATIONS[0].descEs, /requisición, cotización, comparativo, aprobación, OC, recepción, entrega y factura/);
  assert.deepEqual(SERVICE_OPTIONS.map(o => `${o.icon} ${o.label}`), ['💧 Suministro de agua', '🚚 Transporte', '🚚 Transporte de personal', '🔐 Gestión Rise X', '🏗️ Servicio de grúa', '🚜 Montacargas', '⛽ Recarga de gasolina', '📍 Last Mile Deliveries', '🧩 Otro servicio']);
});

test('servicios vinculados por nombre a service_types (+ tipos activos adicionales de MariaDB)', () => {
  const o = serviceOptions(TYPES);
  assert.equal(o.length, 10, '9 del original + 1 activo adicional; el inactivo que no está en el original no se ofrece');
  const by = k => o.find(x => x.key === k);
  assert.deepEqual([by('transporte').code, by('transporte').active, by('transporte').inCatalog], ['svc_type_2', true, true]);
  assert.deepEqual([by('transporte_personal').active, by('agua').inCatalog, by('agua').code], [false, false, null]);
  assert.deepEqual(o.at(-1), { key: 'db:svc_type_9', label: 'Inspección submarina', icon: '🧩', code: 'svc_type_9', active: true, inCatalog: true });
  assert.equal(serviceOptions([]).length, 9, 'sin catálogo se muestran los 9 del original');
});

test('selector de cliente: "NÚMERO · RAZÓN SOCIAL" y búsqueda por número, razón social, RFC o nombre', () => {
  assert.deepEqual([clientLabel(CLIENTS[0]), clientLabel(CLIENTS[2]), clientLabel(null)], ['9001 · CLIENTE SINTÉTICO NORTE', 'ÁLAMO SINTÉTICO', '']);
  assert.deepEqual(filterClients(CLIENTS, '').map(c => c.id), ['c3', 'c1', 'c2'], 'orden alfabético');
  assert.deepEqual(filterClients(CLIENTS, '9002').map(c => c.id), ['c2']);
  assert.deepEqual(filterClients(CLIENTS, 'qan010101').map(c => c.id), ['c1'], 'RFC');
  assert.deepEqual(filterClients(CLIENTS, 'alamo').map(c => c.id), ['c3'], 'sin acentos');
  assert.deepEqual(filterClients(CLIENTS, 'norte qa').map(c => c.id), ['c1'], 'nombre comercial');
  assert.deepEqual(filterClients(CLIENTS, 'zzz'), []);
});

test('al elegir cliente se precargan proyecto, contrato, solicitante y correo sin pisar lo capturado', () => {
  let f = applyClient(emptyRequest('2026-11-23'), CLIENTS[0]);
  assert.deepEqual([f.client_id, f.project, f.contract, f.requester_name, f.requester_email], ['c1', 'PRY-NORTE', 'CTR-1', 'Ana Pérez', 'ana@norte.invalid']);
  f = { ...f, project: 'Plataforma Norte', folio: '9001-REQ-2026-0001' };
  const g = applyClient(f, CLIENTS[1], CLIENTS[0], '9001-REQ-2026-0001');
  assert.deepEqual([g.client_id, g.project, g.contract, g.requester_name, g.requester_email], ['c2', 'Plataforma Norte', '', 'Luis Gómez', 'luis@sur.invalid'], 'los precargados del cliente anterior se sustituyen; lo capturado a mano se conserva');
  assert.equal(g.folio, '', 'el folio generado para otro cliente se limpia (su número de cliente ya no corresponde)');
  assert.equal(applyClient({ ...f, folio: 'MANUAL-1' }, CLIENTS[1], CLIENTS[0], '9001-REQ-2026-0001').folio, 'MANUAL-1', 'un folio capturado a mano se conserva');
});

test('validación del paso 3 (campos obligatorios del diseño, longitudes y correo)', () => {
  const opt = serviceOptions(TYPES).find(o => o.key === 'transporte');
  const ctx = { clients: CLIENTS, option: opt };
  assert.equal(validateRequest(valid(), ctx), null);
  assert.equal(validateRequest({ ...valid(), contract: '', need_date: '', place: '', description: '', reference: '' }, ctx), null, 'contrato, fecha requerida, lugar, descripción y referencia son opcionales');
  const err = (patch, o = ctx) => validateRequest({ ...valid(), ...patch }, o)?.field;
  assert.equal(validateRequest(valid(), { clients: CLIENTS, option: null }).field, 'service');
  assert.equal(err({ client_id: '' }), 'client_id');
  assert.equal(err({ client_id: 'desconocido' }), 'client_id');
  assert.equal(err({ folio: '  ' }), 'folio');
  assert.equal(err({ folio: 'x'.repeat(129) }), 'folio');
  assert.equal(err({ folio: 'A\tB' }), 'folio', 'sin caracteres de control');
  assert.equal(err({ project: '' }), 'project');
  assert.equal(err({ request_date: '2026-02-30' }), 'request_date');
  assert.equal(err({ need_date: '2026-13-01' }), 'need_date');
  assert.equal(err({ requester_name: '' }), 'requester_name');
  assert.equal(err({ requester_email: 'sin-arroba' }), 'requester_email');
  assert.equal(err({ reference: 'R'.repeat(256) }), 'reference');
  assert.equal(err({ description: 'línea 1\nlínea 2' }), undefined, 'la descripción admite saltos de línea');
  assert.match(validateRequest({ ...valid(), folio: '' }, { ...ctx, en: true }).message, /Generate/);
  assert.deepEqual([validDate('2024-02-29'), validDate('2026-02-29'), validDate('')], [true, false, false]);
  assert.match(localToday(new Date(2026, 10, 3)), /^2026-11-03$/);
});

test('avisos no bloqueantes y folio duplicado bloqueante', () => {
  const o = serviceOptions(TYPES);
  const w = requestWarnings({ ...valid(), need_date: '2026-11-01', reference: '' }, { client: CLIENTS[0], option: o.find(x => x.key === 'transporte_personal'), availability: { reference: { available: false, used_by: ['9002-REQ-2026-0002'] } } });
  assert.equal(w.length, 5);
  assert.match(w[0], /anterior a la fecha de solicitud/);
  assert.match(w[1], /estatus "inactive"/);
  assert.match(w[2], /inactivo en service_types/);
  assert.match(w[3], /ya se usa en: 9002-REQ-2026-0002/);
  assert.match(w[4], /SRV-PROYECTO-AÑO-0000/);
  assert.match(requestWarnings(valid(), { client: CLIENTS[1], option: o.find(x => x.key === 'agua') })[0], /no existe en el catálogo service_types/);
  assert.deepEqual(requestWarnings(valid(), { client: CLIENTS[1], option: o.find(x => x.key === 'transporte'), availability: { folio: { available: true }, reference: { available: true, used_by: [] } } }), []);
  assert.equal(folioTakenError({ folio: { available: true } }), null);
  assert.equal(folioTakenError(null), null);
  const e = folioTakenError({ folio: { available: false, requisition: '9002-REQ-2026-0002', client_code: '9002' } });
  assert.deepEqual([e.field, e.message], ['folio', 'El folio 9002-REQ-2026-0002 ya existe en Solicitud / Requisición (cliente 9002). Captura otro o usa ⚙ Generar.']);
});

test('requisición maestra que se registraría (formato de las requisiciones de servicio del original) y bloqueo', () => {
  const opt = serviceOptions(TYPES).find(o => o.key === 'last_mile');
  const r = serviceRequisition({ ...valid(), description: '  ', place: ' Muelle 3 ' }, opt, CLIENTS[1]);
  assert.deepEqual([r.folio, r.internal_reference, r.client, r.route, r.service_type, r.service_type_code, r.delivery_place, r.description, r.priority, r.currency],
    ['9002-REQ-2026-0003', 'SRV-PRY-SUR-2026-0002', '9002 · CLIENTE SINTÉTICO SUR', 'service', 'Last Mile Deliveries', 'svc_type_7', 'Muelle 3', 'Last Mile Deliveries', 'normal', 'MXN']);
  assert.deepEqual(r.items, [{ line: 1, description: 'Last Mile Deliveries', quantity: '1', unit: 'servicio', category: 'Last Mile Deliveries' }], 'sin descripción, la partida usa el nombre del servicio');
  assert.equal(serviceRequisition({ ...valid(), description: 'TRASLADO DE PERSONAL' }, opt, CLIENTS[1]).items[0].description, 'TRASLADO DE PERSONAL');
  assert.match(lockedText(), /^Datos validados, pero no se creó la requisición ni el expediente del servicio/);
  assert.match(lockedText(), /No se guardó nada en MariaDB\.$/);
  assert.match(lockedText(true), /^Data validated, but the requisition and the service file were NOT created/);
  assert.deepEqual([httpMessage({ status: 401 }), httpMessage({ status: 403 }), httpMessage({ status: 503, message: 'X' }), httpMessage({})],
    ['Tu sesión expiró. Inicia sesión nuevamente.', 'No tienes acceso a este módulo.', 'X', 'No fue posible consultar MariaDB.']);
});
