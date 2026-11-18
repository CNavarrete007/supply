// Factura · tarjeta 1 "Registro de factura": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENCIES, STATUSES, FILE_MAX, emptyInvoice, fromInvoice, contextDefaults, computeTotal, validateInvoice, changedInvoiceFields, previewType, fileSize } from '../../src/views/invoices/invoiceForm.mjs';

const TODAY = '2026-11-18';
const READY = { ready: true, received: true, accepted: true };
const NOT_READY = { ready: false, received: false, accepted: true };
// Facturas sintéticas con la forma del endpoint /invoices/requisitions/{id}/context.
const A1 = { id: 'i1', folio: 'FAC-QA-0001', invoice_number: 'A-0001', fiscal_uuid: '11111111-2222-4333-8444-555555555555', state: 'overdue', issue_date: '2026-10-01', due_date: '2026-10-31', currency: 'USD', issuer: 'Grupo Gerez QA', receiver: 'Cliente QA', subtotal_amount: '1000.00', tax_amount: '160.00', total_amount: '1160.00', payment_terms: 'Transferencia', notes: '' };
const A2 = { id: 'i2', folio: 'FAC-QA-0002', invoice_number: 'A-0002', fiscal_uuid: '', state: 'cancelled', issue_date: '2026-10-02', currency: 'USD', total_amount: '3480.00' };
const INVS = [A1, A2];
const file = (name, type, size = 2048) => ({ name, type, size });
const good = (o = {}) => ({ ...emptyInvoice(TODAY), requisition: 'r1', number: 'A-1058', uuid: 'abcdef01-2345-4678-9abc-def012345678', subtotal: '100', taxes: '16', total: '116.00', file: file('a.pdf', 'application/pdf'), ...o });
const v = (f, o = {}) => validateInvoice(f, { readiness: READY, invoices: INVS, today: TODAY, ...o });

test('nuevo registro: valores del diseño (hoy, MXN, Registrada)', () => {
  const f = emptyInvoice(TODAY);
  assert.equal(f.issue, TODAY); assert.equal(f.currency, 'MXN'); assert.equal(f.status, 'registered'); assert.equal(f.file, null);
  assert.deepEqual(CURRENCIES, ['MXN', 'USD', 'EUR']);
  assert.equal(STATUSES.find(s => s[0] === 'registered')[1], 'Registrada');
});

test('factura registrada → formulario de actualización (estatus desde el estado del servidor)', () => {
  const f = fromInvoice(A1, 'r1');
  assert.equal(f.number, 'A-0001'); assert.equal(f.uuid, A1.fiscal_uuid); assert.equal(f.status, 'pending_payment');
  assert.equal(f.subtotal, '1000.00'); assert.equal(f.total, '1160.00'); assert.equal(f.requisition, 'r1'); assert.equal(f.currency, 'USD');
  assert.equal(fromInvoice({ ...A1, state: 'paid' }).status, 'paid');
  assert.equal(fromInvoice(A2).status, 'cancelled');
});

test('contexto: receptor = cliente; emisor y moneda de la última factura vigente', () => {
  const d = contextDefaults({ requisition: { client_name: 'Cliente QA' }, invoices: [A1, { ...A2, issuer: 'Otro', currency: 'EUR' }] });
  assert.deepEqual(d, { receiver: 'Cliente QA', issuer: 'Grupo Gerez QA', currency: 'USD' });
  assert.deepEqual(contextDefaults({ requisition: { client_name: 'X' }, invoices: [] }), { receiver: 'X', issuer: '', currency: '' });
});

test('Calcular total: subtotal + impuestos a 2 decimales; null si falta subtotal o es inválido', () => {
  assert.equal(computeTotal({ subtotal: '1,000.10', taxes: '160.02' }), '1160.12');
  assert.equal(computeTotal({ subtotal: '100', taxes: '' }), '100.00');
  assert.equal(computeTotal({ subtotal: '', taxes: '16' }), null);
  assert.equal(computeTotal({ subtotal: '10.123', taxes: '1' }), null);
});

test('captura completa válida', () => {
  const r = v(good());
  assert.equal(r.ok, true, r.first); assert.deepEqual(r.warnings, []);
});

test('obligatorios: requisición, número, emisión, total y archivo', () => {
  const r = v({ ...emptyInvoice(''), requisition: '' });
  for (const k of ['requisition', 'number', 'issue', 'total', 'file']) assert.ok(r.errors[k], k);
  assert.equal(r.ok, false); assert.equal(r.first, r.errors.requisition);
});

test('la requisición debe estar recibida al 100 % y aceptada (salvo actualización de una existente)', () => {
  assert.match(v(good(), { readiness: NOT_READY }).errors.requisition, /no puede facturarse/);
  assert.equal(v(good({ file: null }), { readiness: NOT_READY, editing: A1 }).errors.requisition, undefined);
});

test('número: formato y único entre facturas vigentes (las canceladas no bloquean)', () => {
  assert.match(v(good({ number: '#A' })).errors.number, /inválido/);
  assert.match(v(good({ number: 'a-0001' })).errors.number, /Ya existe/);
  assert.equal(v(good({ number: 'A-0002' })).errors.number, undefined);
  assert.equal(v(good({ number: 'A-0001' }), { editing: A1 }).errors.number, undefined);
});

test('UUID: formato CFDI y único; sin UUID solo advierte', () => {
  assert.match(v(good({ uuid: '123' })).errors.uuid, /8-4-4-4-12/);
  assert.match(v(good({ uuid: A1.fiscal_uuid.toUpperCase() })).errors.uuid, /ya está registrado/);
  assert.equal(v(good({ uuid: A1.fiscal_uuid }), { editing: A1 }).errors.uuid, undefined);
  const r = v(good({ uuid: '' }));
  assert.equal(r.ok, true); assert.match(r.warnings[0], /Sin UUID/);
  // un UUID histórico fuera de formato no impide actualizar otros campos
  assert.equal(v(good({ uuid: 'LEGACY-1' }), { editing: A1, original: { uuid: 'LEGACY-1' } }).errors.uuid, undefined);
});

test('fechas: emisión no futura y vencimiento no anterior', () => {
  assert.match(v(good({ issue: '2026-11-19' })).errors.issue, /futura/);
  assert.match(v(good({ issue: '2026-02-30' })).errors.issue, /inválida/);
  assert.match(v(good({ due: '2026-11-01', issue: '2026-11-10' })).errors.due, /anterior/);
  assert.equal(v(good({ due: '2026-12-10' })).errors.due, undefined);
});

test('importes: decimales, total > 0 y total = subtotal + impuestos', () => {
  assert.match(v(good({ subtotal: 'abc' })).errors.subtotal, /inválido/);
  assert.match(v(good({ total: '0' })).errors.total, /mayor a cero/);
  assert.match(v(good({ total: '120' })).errors.total, /116\.00/);
  assert.equal(v(good({ total: '116.01' })).errors.total, undefined);
  assert.equal(v(good({ subtotal: '', taxes: '', total: '500' })).ok, true);
});

test('archivo: PDF/XML/imagen, coherente con su extensión, no vacío y ≤ 10 MB', () => {
  assert.equal(v(good({ file: file('cfdi.xml', 'text/xml') })).ok, true);
  assert.equal(v(good({ file: file('scan.JPG', 'image/jpeg') })).ok, true);
  assert.match(v(good({ file: file('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') })).errors.file, /PDF, XML o imagen/);
  assert.match(v(good({ file: file('x.pdf', 'text/html') })).errors.file, /PDF, XML o imagen/, 'HTML renombrado');
  assert.match(v(good({ file: file('a.pdf', 'application/pdf', 0) })).errors.file, /vacío/);
  assert.match(v(good({ file: file('a.pdf', 'application/pdf', FILE_MAX + 1) })).errors.file, /10 MB/);
  assert.equal(v(good({ file: null }), { editing: A1 }).errors.file, undefined, 'la actualización conserva el archivo registrado');
});

test('vista previa: tipo seguro forzado (XML como texto; nunca HTML/SVG)', () => {
  assert.equal(previewType(file('a.pdf', 'application/pdf')), 'application/pdf');
  assert.equal(previewType(file('a.xml', 'application/xml')), 'text/plain');
  assert.equal(previewType(file('a.png', '')), 'image/png');
  assert.equal(previewType(file('a.svg', 'image/svg+xml')), null);
  assert.equal(previewType(file('a.pdf', 'text/html')), null);
  assert.equal(previewType(null), null);
});

test('advertencia: pagada antes del vencimiento', () => {
  assert.match(v(good({ status: 'paid', due: '2026-12-31' })).warnings.join(' '), /pagada antes/);
});

test('cambios de una actualización', () => {
  const o = fromInvoice(A1, 'r1');
  assert.deepEqual(changedInvoiceFields(o, o), []);
  assert.deepEqual(changedInvoiceFields({ ...o, notes: 'x', total: '1160.00 ' }, o), ['observaciones']);
  assert.deepEqual(changedInvoiceFields({ ...o, due: '2026-11-30', file: file('n.pdf', 'application/pdf') }, o), ['vencimiento', 'archivo']);
  assert.deepEqual(changedInvoiceFields({ ...o, status: 'paid' }, o, true), ['status']);
  assert.deepEqual(changedInvoiceFields(o, null), []);
});

test('inglés y tamaño de archivo', () => {
  assert.equal(validateInvoice(emptyInvoice(''), {}, true).errors.number, 'Enter the invoice number.');
  assert.equal(fileSize(500), '500 B'); assert.equal(fileSize(2048), '2.0 KB'); assert.equal(fileSize(3 * 1048576), '3.0 MB');
});
