// Servicios Operativos · sección 4 "Formatos y Reportes": lógica pura y PDF (jsPDF en Node).
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { REPORT_KINDS, REPORT_STATUSES, emptyFilters, filtersError, filtersQuery, filtersText, requestOptions, serviceRisks, buildReport, reportHtml, serviceRequestHtml, buildReportPdf, reportFileName } from '../../src/views/services/serviceReports.mjs';

const TODAY = '2026-11-20';
const S = (o = {}) => ({ id: 's1', folio: 'SRV-1', service: 'Transporte', client_name: 'Hornbeck Offshore', project: 'TRION', date: '2026-10-05', required_date: '2026-11-30', requisition: 'REQ-1', authorization_type: 'Orden de Servicio (SO)', authorization_reference: 'SO-1',
  requires_supplier: false, supplier_po: null, status: 'En ejecución', quantity: 2, unit_label: 'viaje', cost: 1000, price: 1500, margin: 500, currency: 'MXN', evidence_count: 1, invoices: null, is_open: true, is_done: false, ...o });
const ITEMS = [S(), S({ id: 's2', folio: 'SRV-2', service: 'Servicio de grúa', client_name: 'Hool Energy', date: '2026-11-02', status: 'Completado', is_open: false, is_done: true, cost: 3000, price: 2500, evidence_count: 0 }),
  S({ id: 's3', folio: 'SRV-3', service: 'Transporte', date: '2026-11-10', status: 'Listo para facturar', cost: 0, price: 5000, authorization_type: null, authorization_reference: null, required_date: '2026-11-01', requires_supplier: true })];

test('tipos de reporte, estatus y filtros', () => {
  assert.deepEqual(REPORT_KINDS.map(k => k[2]), ['Formato de Solicitud', 'Por Partidas', 'General', 'Hacia el Cliente', 'Gerencial']);
  assert.deepEqual(REPORT_KINDS.map(k => k[4]), ['Documento individual del servicio', 'Detalle línea por línea', 'Consolidado operativo y financiero', 'Sin costo interno ni margen', 'Rentabilidad, riesgos y tendencias']);
  assert.equal(REPORT_STATUSES.length + 1, 12, 'Todos + 11 estatus como en el diseño');
  assert.equal(filtersError({ ...emptyFilters(), from: '2026-11-10', to: '2026-11-01' }), '"Desde" no puede ser posterior a "Hasta".');
  assert.match(filtersError({ ...emptyFilters(), from: '2026-02-30' }), /inválida/);
  assert.equal(filtersError(emptyFilters()), '');
  assert.deepEqual(filtersQuery({ from: '2026-11-01', to: '', client: 'c1', service: 'Transporte', status: '' }), { from: '2026-11-01', to: '', client: 'c1', service: 'Transporte', status: '' });
  assert.equal(filtersText({ ...emptyFilters(), from: '2026-11-01', client: 'c1' }, 'Hool'), 'Periodo: 2026-11-01 – hoy · Cliente: Hool · Servicio: Todos · Estatus: Todos');
  assert.deepEqual(requestOptions([S()]), [{ id: 's1', label: 'SRV-1 · Transporte · HORNBECK OFFSHORE' }]);
});

test('riesgos gerenciales por servicio', () => {
  assert.deepEqual(serviceRisks(ITEMS[0], TODAY), []);
  assert.deepEqual(serviceRisks(ITEMS[1], TODAY), ['Margen negativo', 'Pendiente de facturar', 'Sin evidencia']);
  assert.deepEqual(serviceRisks(ITEMS[2], TODAY), ['Costo no registrado', 'Sin autorización del cliente', 'Sin OC de proveedor', 'Vencido (requerido 2026-11-01)', 'Pendiente de facturar']);
  assert.deepEqual(serviceRisks(S({ status: 'Cancelado', cost: 9, price: 1 }), TODAY), [], 'los cancelados no generan riesgos');
});

test('Por Partidas: una fila por servicio con totales por moneda', () => {
  const d = buildReport('partidas', { items: ITEMS, filters: emptyFilters(), today: TODAY });
  assert.equal(d.title, 'REPORTE DE SERVICIOS POR PARTIDAS'); assert.equal(d.landscape, true);
  assert.equal(d.sections[0].rows.length, 3);
  assert.deepEqual(d.sections[0].rows[1].slice(1, 3), ['SRV-2', '2026-11-02']);
  assert.deepEqual(d.sections[0].totals[0].slice(7, 11), ['3', '$4,000.00 MXN', '$9,000.00 MXN', '$5,000.00 MXN']);
});

test('General: indicadores y agrupaciones por estatus, servicio y cliente', () => {
  const d = buildReport('general', { items: ITEMS, filters: emptyFilters(), today: TODAY });
  assert.deepEqual(d.kpis.map(k => k[1]), ['3', '2', '1', '0', '$9,000.00 MXN', '$4,000.00 MXN', '$5,000.00 MXN', '55.6%']);
  assert.deepEqual(d.sections.map(s => s.title), ['Por estatus', 'Por tipo de servicio', 'Por cliente', 'Totales por moneda']);
  assert.deepEqual(d.sections[1].rows.find(r => r[0] === 'Transporte'), ['Transporte', '2', '2', '$6,500.00 MXN', '$1,000.00 MXN', '$5,500.00 MXN', '84.6%']);
});

test('Hacia el Cliente: sin costo interno ni margen', () => {
  const d = buildReport('cliente', { items: ITEMS, filters: { ...emptyFilters(), client: 'c1' }, clientName: 'Hornbeck Offshore', today: TODAY });
  assert.equal(d.subtitle, 'Hornbeck Offshore');
  const html = reportHtml(d);
  assert.ok(!/Costo|Margen|\$1,000\.00|\$3,000\.00/.test(html.replace('Sin costo interno ni margen', '').replace('no incluye costo interno ni margen', '')), 'no muestra costos ni margen');
  assert.ok(html.includes('$5,000.00 MXN') && html.includes('Documento para el cliente: no incluye costo interno ni margen.'));
});

test('Gerencial: rentabilidad, riesgos y tendencia mensual', () => {
  const d = buildReport('gerencial', { items: ITEMS, filters: emptyFilters(), today: TODAY });
  assert.deepEqual(d.kpis.find(k => k[0] === 'Servicios en riesgo'), ['Servicios en riesgo', '2']);
  assert.deepEqual(d.sections.map(s => s.title), ['Rentabilidad por tipo de servicio', 'Rentabilidad por cliente', 'Riesgos', 'Tendencia mensual']);
  assert.equal(d.sections[0].rows[0][0], 'Transporte', 'ordenado por margen');
  assert.deepEqual(d.sections[3].rows.map(r => r[0]), ['2026-10', '2026-11']);
});

test('Formato de Solicitud (también desde la matriz) y HTML escapado', () => {
  const detail = { item: { ...S(), client_name: 'A & <B>', contract: 'X1', buyer: 'Comp', description: 'Desc' }, details: { origenDestino: 'Tampico' }, files: [{ name: 'f.jpg', role: 'serviceEvidence' }] };
  const html = serviceRequestHtml(detail);
  for (const t of ['GRUPO GEREZ', 'SOLICITUD DE SERVICIO', 'SRV-1', 'A &amp; &lt;B&gt;', 'Origen Destino', 'Tampico', 'f.jpg', 'Evidencias registradas']) assert.ok(html.includes(t), t);
  assert.ok(!html.includes('<B>'));
  assert.equal(reportFileName(buildReport('general', { items: ITEMS })), 'REPORTE-GENERAL-DE-SERVICIOS.pdf');
  assert.equal(reportFileName(buildReport('solicitud', { detail }), 'SRV-1'), 'SRV-1.pdf');
});

test('PDF (jsPDF): contenido, orientación y paginación', () => {
  const g = buildReportPdf(jsPDF, buildReport('general', { items: ITEMS, filters: emptyFilters(), today: TODAY }));
  const t = Buffer.from(g.output('arraybuffer')).toString('latin1');
  for (const x of ['GRUPO GEREZ', 'REPORTE GENERAL DE SERVICIOS', 'POR ESTATUS', 'Transporte', '$9,000.00 MXN']) assert.ok(t.includes(x), x);
  const p = buildReportPdf(jsPDF, buildReport('partidas', { items: Array.from({ length: 80 }, (_, i) => S({ id: `x${i}`, folio: `SRV-${i}` })), filters: emptyFilters(), today: TODAY }));
  assert.ok(p.internal.pageSize.getWidth() > p.internal.pageSize.getHeight(), 'Por Partidas en horizontal');
  assert.ok(p.getNumberOfPages() > 1);
  const s = buildReportPdf(jsPDF, buildReport('solicitud', { detail: { item: S(), details: {}, files: [] } }));
  assert.ok(Buffer.from(s.output('arraybuffer')).toString('latin1').includes('SOLICITUD DE SERVICIO'));
});
