// Recepción y Entrega · tarjeta 2 "Formato de entrega al cliente": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DELIVERY_TYPES, ACCEPTANCE, emptyDelivery, requisitionSummary, deliverableLines, quantitiesFor, includedLines, validateDelivery, deliveryCanonical, deliveryLockedText, sha256Hex, deliveryHashes } from '../../src/views/reception/deliveryForm.mjs';

const TODAY = '2026-11-19';
const SIG = 'data:image/png;base64,iVBORw0KGgo=';
const safeSig = v => /^data:image\/(png|jpeg);base64,/.test(String(v || ''));
// Requisiciones sintéticas con la forma de GET /api/v1/reception/deliverable?client=<uuid>.
const REQS = [
  { id: 'r1', folio: 'QA-REQ-1', project: 'PRY-1', purchase_orders: 'OC-1', deliveries: [], items: [
    { id: 'i1', line_number: 1, description: 'Válvula', unit_label: 'pza', requested: 10, received: 6, delivered: 2, available: 4, purchase_orders: 'OC-1' },
    { id: 'i2', line_number: 2, description: 'Brida', unit_label: 'pza', requested: 5, received: 5, delivered: 5, available: 0, purchase_orders: 'OC-1' },
    { id: 'i3', line_number: 3, description: 'Tornillo', unit_label: 'kg', requested: 2.5, received: 2.5, delivered: 0, available: 2.5, purchase_orders: 'OC-1' }] },
  { id: 'r2', folio: 'QA-REQ-2', project: 'PRY-1', purchase_orders: 'OC-2', deliveries: [{ id: 'd1', folio: 'ENT-1' }], items: [
    { id: 'i4', line_number: 1, description: 'Cable', unit_label: 'm', requested: 3, received: 3, delivered: 3, available: 0, purchase_orders: 'OC-2' }] },
];
const good = (o = {}) => ({ ...emptyDelivery(TODAY), client: 'c1', place: 'Almacén central', requisitions: ['r1'], qty: { 'r1:i1': '2' }, evidence: 'REM-1',
  deliverer: 'Ana Pérez', delivererPosition: 'Almacenista', receiver: 'Luis Gómez', receiverPosition: 'Residente', sigDeliverer: SIG, sigReceiver: SIG, consentDeliverer: true, consentReceiver: true,
  photos: [{ id: 'p' }], ...o });
const v = f => validateDelivery(f, { reqs: REQS, today: TODAY, safeSig });

test('valores del diseño: Parcial, Recibido parcial sin cierre, fecha de hoy, sin fotografías ni firmas', () => {
  const f = emptyDelivery(TODAY);
  assert.deepEqual([f.type, f.acceptance, f.date, f.photos.length, f.sigDeliverer, f.sigReceiver, f.consentDeliverer], ['partial', 'partial_open', TODAY, 0, null, null, false]);
  assert.deepEqual(DELIVERY_TYPES.map(t => t[1]), ['Parcial', 'Completa']);
  assert.deepEqual(ACCEPTANCE.map(t => t[1]), ['Recibido parcial sin cierre', 'Aceptado de conformidad', 'Aceptado con observaciones', 'Rechazado / devuelto']);
});

test('resumen por requisición y partidas con saldo de las requisiciones seleccionadas', () => {
  assert.deepEqual(requisitionSummary(REQS[0]), { items: 3, received: 3, delivered: 2, available: 2, availableQty: 6.5 });
  assert.equal(requisitionSummary(REQS[1]).available, 0);
  assert.deepEqual(deliverableLines(REQS, []).length, 0);
  const l = deliverableLines(REQS, ['r1', 'r2']);
  assert.deepEqual(l.map(x => x.key), ['r1:i1', 'r1:i3'], 'solo partidas con saldo > 0');
  assert.equal(l[0].requisition, 'QA-REQ-1');
});

test('Completa carga todos los saldos; Parcial conserva lo capturado de partidas vigentes', () => {
  const l = deliverableLines(REQS, ['r1']);
  assert.deepEqual(quantitiesFor('complete', l, {}), { 'r1:i1': '4', 'r1:i3': '2.5' });
  assert.deepEqual(quantitiesFor('partial', l, { 'r1:i1': '1', 'r9:x': '3' }), { 'r1:i1': '1' });
  assert.deepEqual(includedLines(l, { 'r1:i1': '1', 'r1:i3': '0' }).map(x => x.key), ['r1:i1']);
});

test('formato completo y válido: sin errores; advierte saldo pendiente en entrega parcial', () => {
  const r = v(good());
  assert.equal(r.ok, true, r.first);
  assert.ok(r.warnings.some(w => /saldo pendiente/.test(w)));
  const c = v(good({ type: 'complete', acceptance: 'accepted', qty: { 'r1:i1': '4', 'r1:i3': '2.5' } }));
  assert.equal(c.ok, true, c.first);
  assert.ok(!c.warnings.some(w => /saldo pendiente/.test(w)));
});

test('campos obligatorios del encabezado', () => {
  const r = v({ ...emptyDelivery(''), type: 'x', acceptance: 'x' });
  for (const k of ['client', 'type', 'date', 'place', 'acceptance', 'deliverer', 'delivererPosition', 'receiver', 'receiverPosition', 'sigDeliverer', 'sigReceiver']) assert.ok(r.errors[k], k);
  assert.equal(r.ok, false);
  assert.match(v(good({ date: '2026-02-30' })).errors.date, /inválida/);
  assert.match(v(good({ date: '2026-11-20' })).errors.date, /futura/);
  assert.match(v(good({ place: 'x'.repeat(256) })).errors.place, /255/);
});

test('requisiciones y cantidades: selección, saldo, formato numérico y entrega completa', () => {
  assert.match(v(good({ requisitions: [], qty: {} })).errors.requisitions, /Selecciona/);
  assert.match(v(good({ requisitions: ['r2'], qty: {} })).errors.items, /no tienen saldo/);
  assert.match(v(good({ qty: {} })).errors.items, /al menos una partida/);
  const over = v(good({ qty: { 'r1:i1': '4.5' } }));
  assert.match(over.lineErrors['r1:i1'], /Excede el saldo disponible \(4\)/);
  assert.match(over.errors.items, /Revisa las cantidades/);
  assert.match(v(good({ qty: { 'r1:i1': '1,5' } })).lineErrors['r1:i1'], /inválida/);
  assert.match(v(good({ qty: { 'r1:i1': '-1' } })).lineErrors['r1:i1'], /inválida/);
  assert.equal(v(good({ qty: { 'r1:i3': '2.5' } })).ok, true, 'cantidad decimal igual al saldo');
  assert.match(v(good({ type: 'complete', acceptance: 'accepted', qty: { 'r1:i1': '4' } })).errors.items, /todos los saldos/);
  assert.match(v(good({ type: 'complete', acceptance: 'partial_open', qty: { 'r1:i1': '4', 'r1:i3': '2.5' } })).errors.acceptance, /entrega completa/);
});

test('aceptación con observaciones o rechazo exige observaciones', () => {
  assert.match(v(good({ acceptance: 'accepted_obs', notes: 'corto' })).errors.notes, /mínimo 10/);
  assert.match(v(good({ acceptance: 'rejected' })).errors.notes, /rechazo/);
  assert.equal(v(good({ acceptance: 'rejected', notes: 'Material dañado en el empaque' })).ok, true);
  assert.match(v(good({ notes: 'x'.repeat(2001) })).errors.notes, /2000/);
});

test('firmantes distintos, firmas válidas con confirmación y correo', () => {
  assert.match(v(good({ receiver: ' ana  PÉREZ'.replace('  ', ' ').trim() })).errors.receiver, /personas distintas/);
  assert.match(v(good({ receiver: 'Ána Perez' })).errors.receiver, /personas distintas/, 'sin distinguir acentos ni mayúsculas');
  assert.match(v(good({ sigDeliverer: 'javascript:alert(1)' })).errors.sigDeliverer, /Falta la firma/);
  assert.match(v(good({ consentDeliverer: false })).errors.sigDeliverer, /confirmar/);
  assert.match(v(good({ sigReceiver: null })).errors.sigReceiver, /Falta la firma/);
  assert.match(v(good({ consentReceiver: false })).errors.sigReceiver, /confirmar/);
  assert.match(v(good({ receiverEmail: 'no-es-correo' })).errors.receiverEmail, /inválido/);
  assert.equal(v(good({ receiverEmail: 'residente@cliente.com.mx' })).ok, true);
  assert.match(v(good({ deliverer: 'x'.repeat(129) })).errors.deliverer, /128/);
});

test('fotografías opcionales (máximo 8) y advertencias de evidencia', () => {
  const r = v(good({ photos: [], evidence: '' }));
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some(w => /Sin fotografías/.test(w)));
  assert.ok(r.warnings.some(w => /remisión/.test(w)));
  assert.match(v(good({ photos: Array.from({ length: 9 }, (_, i) => ({ id: i })) })).errors.photos, /8/);
});

test('mensajes en inglés', () => {
  const r = validateDelivery({ ...emptyDelivery(TODAY) }, { reqs: REQS, today: TODAY, safeSig }, true);
  assert.equal(r.errors.client, 'Select the client.');
  assert.equal(r.first, 'Select the client.');
});

test('contenido canónico y huellas SHA-256 (contenido y firmas)', () => {
  const f = good({ qty: { 'r1:i1': '2', 'r1:i3': '1' } });
  const c = JSON.parse(deliveryCanonical(f, REQS, 'Cliente Uno'));
  assert.equal(c.client, 'Cliente Uno');
  assert.deepEqual(c.items.map(i => [i.requisition, i.line, i.quantity, i.balance_after]), [['QA-REQ-1', 1, 2, 2], ['QA-REQ-1', 3, 1, 1.5]]);
  assert.deepEqual(c.received_by, { name: 'Luis Gómez', position: 'Residente', company: '', email: '' });
  assert.equal(c.photos, 1);
  assert.ok(!JSON.stringify(c).includes('base64'), 'las imágenes de firma no forman parte del JSON: se firman por su propia huella');
  for (const t of ['', 'abc', 'ñandú 🚚'.repeat(100), 'a'.repeat(64), deliveryCanonical(f, REQS, 'Cliente Uno')]) assert.equal(sha256Hex(t), createHash('sha256').update(t, 'utf8').digest('hex'));
  const h = deliveryHashes(f, REQS, 'Cliente Uno');
  assert.equal(h.content, createHash('sha256').update(deliveryCanonical(f, REQS, 'Cliente Uno'), 'utf8').digest('hex'));
  assert.equal(h.deliverer, createHash('sha256').update(SIG).digest('hex'));
  assert.notEqual(deliveryHashes(good({ qty: { 'r1:i1': '3' } }), REQS, 'Cliente Uno').content, h.content, 'otra cantidad cambia la huella');
});

test('Guardar y firmar formato no escribe: mensaje de bloqueo con resumen y huella', () => {
  const f = good({ qty: { 'r1:i1': '2', 'r1:i3': '1' } });
  const t = deliveryLockedText(f, REQS, 'Cliente Uno', 'abc123');
  assert.match(t, /^Datos validados, pero no se guardó ni se firmó el formato de entrega/);
  assert.match(t, /2 partida\(s\) de 1 requisición\(es\) de Cliente Uno, entrega parcial, recibido parcial sin cierre/);
  assert.match(t, /SHA-256 del contenido que se firmaría: abc123/);
  assert.match(deliveryLockedText(f, REQS, 'Client One', 'abc', true), /^Data validated, but the delivery format was neither saved nor signed/);
});
