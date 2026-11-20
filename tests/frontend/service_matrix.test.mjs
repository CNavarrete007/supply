// Servicios Operativos · sección 3 "Matriz de servicios": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_TYPES, STATUSES, PAGE_SIZES, mergeOptions, money, clientsChip, clientCards, buyerCards, serviceRow, servicesCsv, editForm, validateEdit, editLockedText, deleteBlock, deleteError, deleteLockedText, rangeText } from '../../src/views/services/serviceMatrix.mjs';
import { serviceRequestHtml } from '../../src/views/services/serviceReports.mjs';

// Filas sintéticas con la forma de GET /api/v1/services/matrix.
const X = { id: 's1', folio: 'SRV-2026-00002', requisition: 'HOL-0001', internal_reference: 'HOL-0001', service: 'Last Mile Deliveries', client_name: 'Hool Energy de Mexico', project: 'TRION', date: '2026-08-05', required_date: '2026-08-10',
  authorization_type: 'Orden de Servicio (SO) del cliente', authorization_reference: 'HOL-0001', requires_supplier: true, supplier_po: null, supplier_name: null, status: 'Listo para facturar', quantity: 1, unit_label: 'servicio',
  cost: 0, price: 5000, margin: 5000, currency: 'MXN', responsible: 'Maximo Garcia', evidence_count: 3, invoices: null, buyer: null, buyer_key: 'unassigned', is_open: true, is_done: false, imported: false };
const SUM = { services: 3, clients: [{ id: 'c1', name: 'Hool Energy de Mexico S. de R.L. de C.V.', projects: 'TRION', services: 1, buyers: 1, open: 1, with_evidence: 1 }, { id: 'c2', name: 'Hornbeck Offshore', projects: 'TRION', services: 2, buyers: 2, open: 2, with_evidence: 1 }],
  buyers: [{ key: 'unassigned', name: null, requisitions: 'HOL-0001', services: 1, open: 1, completed: 0, types: 1 }] };

test('filtros del diseño (+ valores de MariaDB) y paginación', () => {
  assert.deepEqual(SERVICE_TYPES, ['Suministro de agua', 'Transporte', 'Transporte de personal', 'Gestión Rise X', 'Servicio de grúa', 'Montacargas', 'Recarga de gasolina', 'Last Mile Deliveries']);
  assert.deepEqual(STATUSES, ['Solicitado', 'Programado', 'En ejecución', 'Pendiente de información', 'Pendiente de aprobación', 'Completado', 'Facturado', 'Cancelado']);
  assert.deepEqual(mergeOptions(STATUSES, ['completado', 'Listo para facturar', '']).slice(-1), ['Listo para facturar'], 'sin duplicar (acentos/mayúsculas) y agrega los de la base');
  assert.deepEqual(PAGE_SIZES, [10, 25, 50]);
  assert.deepEqual([money(5000), money(0), money(null), money(1234.5, 'USD')], ['$5,000.00', '$0.00', '—', '$1,234.50 USD']);
});

test('tarjetas por cliente y por comprador', () => {
  assert.equal(clientsChip(SUM), '2 cliente(s) · 3 servicio(s)');
  const c = clientCards(SUM);
  assert.deepEqual([c[0].badge, c[0].name, c[0].sub, c[0].stats, c[0].foot], ['HE', 'HOOL ENERGY DE MEXICO S. DE R.L. DE C.V.', 'TRION', [[1, 'Servicios'], [1, 'Compradores'], [1, 'Abiertos']], '1 con evidencia']);
  const b = buyerCards(SUM, 'Hool Energy');
  assert.deepEqual([b[0].badge, b[0].name, b[0].sub, b[0].stats, b[0].foot], ['TOD', 'Todos los compradores', 'HOOL ENERGY', [[1, 'Servicios'], [1, 'Compradores'], [0, 'Completados']], 'Vista general']);
  assert.deepEqual([b[1].badge, b[1].name, b[1].sub, b[1].stats, b[1].foot], ['SC', 'Sin comprador asignado', 'HOL-0001', [[1, 'Servicios'], [1, 'Abiertos'], [0, 'Completados']], '1 tipo(s) de servicio']);
});

test('fila: autorización, OC proveedor, facturación, estatus, importes y margen', () => {
  const v = serviceRow(X);
  assert.deepEqual([v.folio, v.requisition, v.service, v.client, v.date, v.auth.text, v.auth.sub, v.qty, v.cost, v.price, v.evidence], ['SRV-2026-00002', 'HOL-0001', 'Last Mile Deliveries', 'HOOL ENERGY DE MEXICO', '2026-08-05', 'Orden de Servicio (SO) del cliente', 'HOL-0001', '1 servicio', '$0.00', '$5,000.00', 3]);
  assert.deepEqual([v.po.text, v.billing.text, v.billing.tone, v.status.text, v.status.tone, v.margin.text, v.margin.tone, v.responsible], ['No vinculada', 'Listo para facturar', 'green', 'Listo para facturar', 'blue', '$5,000.00', 'green', 'MAXIMO GARCIA']);
  assert.deepEqual([serviceRow({ ...X, requires_supplier: false }).po.text, serviceRow({ ...X, supplier_po: 'OC-1', supplier_name: 'Prov' }).po.text], ['No requerida', 'OC-1']);
  assert.deepEqual([serviceRow({ ...X, invoices: 'FAC-1' }).billing.text, serviceRow({ ...X, status: 'Cancelado' }).billing.text, serviceRow({ ...X, status: 'En ejecución', is_done: false }).billing.text], ['Facturado', 'No aplica', 'Pendiente']);
  assert.deepEqual([serviceRow({ ...X, status: 'Completado' }).status.tone, serviceRow({ ...X, status: 'Pendiente de información' }).status.tone, serviceRow({ ...X, status: 'Cancelado' }).status.tone], ['green', 'amber', 'red']);
  assert.equal(serviceRow({ ...X, margin: -10 }).margin.tone, 'red');
});

test('Excel/CSV: encabezados, escapado y protección contra fórmulas', () => {
  const csv = servicesCsv([X, { ...X, folio: '=HYPERLINK("x")', client_name: 'A, "B"' }]);
  assert.ok(csv.startsWith('﻿Folio,Requisición,Referencia interna,Servicio,Cliente'));
  assert.ok(csv.includes('SRV-2026-00002,HOL-0001,HOL-0001,Last Mile Deliveries'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`) && csv.includes('"A, ""B"""'));
  assert.equal(csv.split('\r\n').length, 3);
  const cl = servicesCsv([X], false, { internal: false }).split('\r\n')[0];
  assert.ok(!/Costo|Margen|OC proveedor|Comprador/.test(cl) && cl.includes('Venta'), 'exportación al cliente sin costo interno, margen, OC ni comprador');
});

test('editar: cambios, validación, advertencias y no guarda', () => {
  const f = editForm(X);
  assert.deepEqual(f, { status: 'Listo para facturar', required_date: '2026-08-10', quantity: '1', cost: '0', price: '5000', authorization_reference: 'HOL-0001' });
  assert.match(validateEdit(f, X).errors.changes, /Sin cambios/);
  const g = { ...f, status: 'Facturado', cost: '6000' };
  const r = validateEdit(g, X);
  assert.equal(r.ok, true, r.first);
  assert.deepEqual(r.changed, ['estatus', 'costo']);
  assert.ok(r.warnings.some(w => /margen será negativo/.test(w)) && r.warnings.some(w => /sin factura registrada/.test(w)));
  assert.match(validateEdit({ ...f, quantity: '0' }, X).errors.quantity, /inválid/);
  assert.match(validateEdit({ ...f, price: 'abc' }, X).errors.price, /inválid/);
  assert.match(validateEdit({ ...f, required_date: '2026-02-30' }, X).errors.required_date, /inválida/);
  assert.equal(validateEdit({ ...f, price: '5000.00' }, X).errors.changes, 'Sin cambios por guardar.', '5000.00 = 5000');
  assert.match(editLockedText(X, r.changed), /^Datos validados, pero no se guardaron los cambios de SRV-2026-00002 \(estatus, costo\): editar servicios es una escritura operativa bloqueada/);
});

test('eliminar: importado, facturado, con OC o evidencias se conserva', () => {
  assert.match(deleteBlock(X), /3 evidencia\(s\)/);
  assert.match(deleteBlock({ ...X, imported: true }), /importado del sistema original/);
  assert.match(deleteBlock({ ...X, evidence_count: 0, invoices: 'FAC-1', supplier_po: 'OC-1' }), /factura FAC-1, OC de proveedor OC-1/);
  assert.equal(deleteBlock({ ...X, evidence_count: 0 }), null);
  assert.match(deleteError(X, 'x', 'motivo suficiente'), /Escribe el folio/);
  assert.equal(deleteError(X, 'srv-2026-00002', 'Captura duplicada'), '');
  assert.match(deleteLockedText(X), /^Datos validados, pero no se eliminó SRV-2026-00002/);
  assert.equal(rangeText({ total: 34, page: 2, page_size: 10 }), '11-20 de 34 registros');
});

test('Solicitud: formato Grupo Gerez escapado con autorización, ejecución, importes y datos operativos', () => {
  const html = serviceRequestHtml({ item: { ...X, client_name: 'Hool & <Co>', contract: 'X0001', buyer: 'Comprador', description: 'Entrega', authorization_amount: 5000, authorization_currency: 'MXN' }, details: { origen: 'Almacén', numeroEntregas: 3 }, files: [{ name: 'foto.jpg', role: 'serviceEvidence' }] });
  for (const t of ['GRUPO GEREZ', 'SOLICITUD DE SERVICIO', 'SRV-2026-00002', 'Hool &amp; &lt;Co&gt;', 'Orden de Servicio (SO) del cliente', '$5,000.00 MXN', 'Numero Entregas', 'Almacén', 'foto.jpg', 'Listo para facturar']) assert.ok(html.includes(t), t);
  assert.ok(!html.includes('<Co>'));
});
