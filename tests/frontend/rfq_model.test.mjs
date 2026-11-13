// Cotizaciones › Solicitud a proveedores (RFQ) · lógica pura. node --test tests/frontend/rfq_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRfq, addDays, nextRfqFolio, internalReference, projectLine, fromRequisition, currencyFor, validateRfq, sentToSupplier, previewDoc, registeredDoc, rfqDocHtml, statusLabel } from '../../src/views/quotes/rfq.mjs';

const req = { id: 'r1', folio: 'QA01-REQ-1', internal_reference: 'OCE0001-26', project: 'TRION', contract: null, client_name: 'Cliente QA', delivery_place: 'ESEASA', need_date: '2026-07-28' };
const items = [{ id: 'i1', line_number: 1, description: 'Canastilla', category: 'Servicios', quantity: '1.000000', unit: 'servicio', sent_to: [{ rfq: 'RFQ-2026-0001', supplier_name: 'Proveedor A' }] },
  { id: 'i2', line_number: 2, description: 'Flete <b>', category: 'Transporte', quantity: '2.500000', unit: 'viaje', sent_to: [] }];
const ok = { ...emptyRfq('2026-09-30'), buyer: 'b', requisition: 'r1', supplier: 's', contact: 'c' };

test('fechas por defecto: emisión hoy y límite +5 días (también entre meses y años)', () => {
  const f = emptyRfq('2026-09-30'); assert.equal(f.issue_date, '2026-09-30'); assert.equal(f.deadline, '2026-10-05'); assert.equal(f.status, 'draft'); assert.equal(f.currency, 'MXN');
  assert.equal(addDays('2026-12-29', 5), '2027-01-03');
});

test('folio previsto por año de emisión', () => {
  assert.equal(nextRfqFolio({ 2026: 89 }, '2026-09-30'), 'RFQ-2026-0090');
  assert.equal(nextRfqFolio({ 2026: 89 }, '2027-01-02'), 'RFQ-2027-0001');
  assert.equal(nextRfqFolio({}, '2026-01-01'), 'RFQ-2026-0001');
});

test('referencia interna y proyecto como en el diseño', () => {
  assert.equal(internalReference(req), 'OCE0001-26 · TRION');
  assert.equal(projectLine(req), 'OCE0001-26 · TRION · Contrato N/A');
  assert.equal(internalReference({ folio: 'REQ-9', client_name: 'Cliente' }), 'REQ-9 · Cliente');
  assert.equal(internalReference(null), '');
});

test('la requisición llena lugar y fecha requerida; la moneda viene del proveedor', () => {
  const f = fromRequisition(ok, req); assert.equal(f.delivery_place, 'ESEASA'); assert.equal(f.required_date, '2026-07-28');
  assert.equal(currencyFor({ currency: 'USD' }), 'USD'); assert.equal(currencyFor({ currency: null }), 'MXN'); assert.equal(currencyFor({ currency: 'GBP' }), 'MXN');
});

test('validación: obligatorios, orden de fechas y proveedor no invitable', () => {
  assert.equal(validateRfq(ok).ok, true);
  const e = validateRfq(emptyRfq('2026-09-30')).errors; assert.ok(e.buyer && e.requisition && e.supplier && e.contact);
  assert.match(validateRfq({ ...ok, deadline: '2026-09-29' }).errors.deadline, /anterior a la emisión/);
  assert.match(validateRfq(ok, { supplier: { status: 'suspended' } }).errors.supplier, /suspendido o inactivo/);
  assert.equal(validateRfq(ok, { supplier: { status: 'under_evaluation' } }).ok, true);
  assert.ok(validateRfq({ ...ok, currency: 'GBP' }).errors.currency);
  assert.match(validateRfq(emptyRfq('2026-09-30'), {}, true).errors.buyer, /Select the responsible buyer/);
});

test('aviso de partida ya enviada al mismo proveedor', () => {
  assert.equal(sentToSupplier(items[0], 'Proveedor A').length, 1);
  assert.equal(sentToSupplier(items[0], 'Proveedor B').length, 0);
  assert.equal(sentToSupplier(items[1], 'Proveedor A').length, 0);
});

test('vista previa: solo partidas seleccionadas, datos reales del proveedor y sin precios', () => {
  const supplier = { name: 'Proveedor A', code: 'PRV-1', tax_id: 'XAXX010101000', contacts: [{ name: 'Ana', is_primary: false }, { name: 'Luis', is_primary: true }], channels: [{ type: 'email', value: 'b@x.invalid', is_primary: false }, { type: 'email', value: 'a@x.invalid', is_primary: true }, { type: 'phone', value: '833', is_primary: true }] };
  const d = previewDoc({ form: fromRequisition(ok, req), folio: 'RFQ-2026-0090', req, items, selected: ['i2'], supplier, contact: { name: 'Juan', email: 'j@x.invalid' } });
  assert.deepEqual(d.items.map(i => i.description), ['Flete <b>']);
  assert.equal(d.supplier.contact, 'Luis'); assert.equal(d.supplier.email, 'a@x.invalid'); assert.equal(d.supplier.phone, '833');
  assert.equal(d.status, 'Borrador'); assert.equal(d.preview, true); assert.equal(d.delivery, 'ESEASA · Fecha 2026-07-28');
  const html = rfqDocHtml(d);
  assert.ok(html.includes('RFQ-2026-0090') && html.includes('Proveedor A') && html.includes('Flete &lt;b&gt;') && !html.includes('Flete <b>'));
  assert.ok(html.includes('VISTA PREVIA · NO REGISTRADA'));
  assert.ok(!/precio unitario|importe|unit price/i.test(html));
  assert.ok(rfqDocHtml({ ...d, items: [] }).includes('No hay partidas seleccionadas'));
});

test('RFQ registrada: formato sin marca de vista previa y estatus traducido', () => {
  const d = registeredDoc({ item: { folio: 'RFQ-QA-0001', status: 'sent', request_date: '2026-10-05', deadline: '2026-10-07', required_date: '2026-10-20', currency: 'MXN', delivery_place: 'Almacén', supplier_name: 'Aceros', supplier_code: 'PRV-2', requisition: 'QA01', project: 'PRY', contract: 'CTO', client_name: 'Cliente', contact_name: 'QA Comprador', terms_text: 'Términos' },
    items: [{ line_number: '1', description: 'Material', specification: null, category: null, unit_label: 'pza', quantity: '3.000000' }] });
  assert.equal(d.status, 'Enviada'); assert.equal(d.preview, false); assert.equal(d.project, 'QA01 · PRY · Contrato CTO'); assert.equal(d.conditions, 'Términos');
  const html = rfqDocHtml(d); assert.ok(!html.includes('NO REGISTRADA') && html.includes('RFQ-QA-0001') && html.includes('QA Comprador'));
  assert.equal(registeredDoc({ item: { status: 'legacy_x', legacy_status: 'Cotizando' }, items: [] }).status, 'Cotizando');
  assert.equal(statusLabel('expired', true), 'Expired');
});
