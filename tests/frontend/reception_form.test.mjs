// Recepción y Entrega · tarjeta 1 "Registro de recepción": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RECEPTION_TYPES, QUALITY, DOCUMENTATION, PHOTO_MAX, emptyReception, withType, orderOptions, photoError, fitSize, validateReception, receptionLockedText, outstanding } from '../../src/views/reception/receptionForm.mjs';

const TODAY = '2026-11-19';
// Detalle sintético con la forma de GET /api/v1/reception/orders/{id}.
const ORDER = { item: { id: 'p3', folio: 'OC-QA-0003', version_number: 2, commitment_date: '2026-11-05', supplier_name: 'Instrumentos', received_percent: 66.67, reception: 'partial' },
  items: [{ line_number: 1, description: 'Instrumento', quantity: 3, received: 2, rejected: 1 }], receipts: [] };
const DONE = { ...ORDER, item: { ...ORDER.item, folio: 'OC-QA-0001', received_percent: 100, reception: 'complete' } };
const photo = n => ({ id: String(n), name: `f${n}.jpg`, size: 1000, data: 'data:image/jpeg;base64,AA' });
const good = (o = {}) => ({ ...emptyReception(TODAY), po: 'p3', evidence: 'REM-123', photos: [photo(1)], ...o });
const v = (f, order = ORDER) => validateReception(f, { order, today: TODAY });

test('valores del diseño: Total 100 %, Conforme, Completa y fecha de hoy', () => {
  const f = emptyReception(TODAY);
  assert.deepEqual([f.type, f.qty, f.quality, f.docs, f.date, f.photos.length], ['total', '100', 'conforme', 'completa', TODAY, 0]);
  assert.deepEqual(RECEPTION_TYPES.map(t => t[1]), ['Total', 'Parcial']);
  assert.deepEqual(QUALITY.map(t => t[1]), ['Conforme', 'Con observaciones', 'No conforme']);
  assert.deepEqual(DOCUMENTATION.map(t => t[1]), ['Completa', 'Incompleta', 'No recibida']);
  assert.equal(PHOTO_MAX, 8);
});

test('tipo: Total fija 100 %; Parcial pide capturar el porcentaje', () => {
  assert.equal(withType({ qty: '80' }, 'total').qty, '100');
  assert.equal(withType({ qty: '100' }, 'partial').qty, '');
  assert.equal(withType({ qty: '80' }, 'partial').qty, '80');
});

test('captura válida (total) y advertencia de recepción tardía', () => {
  const r = v(good());
  assert.equal(r.ok, true, r.first);
  assert.match(r.warnings.join(' '), /14 día\(s\) después del compromiso/);
});

test('obligatorios y OC ya recibida al 100 %', () => {
  const r = v({ ...emptyReception(''), qty: '' }, null);
  for (const k of ['po', 'date', 'qty']) assert.ok(r.errors[k], k);
  assert.match(v(good({ po: 'p1' }), DONE).errors.po, /ya está recibida al 100 %/);
});

test('% recibido acumulado: rango, total = 100, parcial < 100 y mayor a lo ya recibido', () => {
  assert.match(v(good({ qty: '0' })).errors.qty, /mayor a 0/);
  assert.match(v(good({ qty: '101' })).errors.qty, /hasta 100/);
  assert.match(v(good({ qty: '90' })).errors.qty, /total corresponde al 100 %/);
  assert.match(v(good({ type: 'partial', qty: '100' })).errors.qty, /menor al 100 %/);
  assert.match(v(good({ type: 'partial', qty: '60' })).errors.qty, /mayor al ya registrado \(66\.67 %\)/);
  assert.equal(v(good({ type: 'partial', qty: '80.5' })).ok, true);
});

test('fecha no futura; calidad distinta de Conforme exige observaciones', () => {
  assert.match(v(good({ date: '2026-11-20' })).errors.date, /futura/);
  assert.match(v(good({ date: '2026-02-30' })).errors.date, /inválida/);
  assert.match(v(good({ quality: 'observaciones', notes: 'corto' })).errors.notes, /mínimo 10/);
  assert.equal(v(good({ quality: 'no_conforme', notes: 'Pieza con golpe en la carcasa' })).ok, true);
  assert.match(v(good({ quality: 'no_conforme', notes: 'Pieza con golpe en la carcasa' })).warnings.join(' '), /material rechazado/);
});

test('advertencias: documentación pendiente, sin fotografías ni remisión', () => {
  const w = v(good({ docs: 'incompleta', photos: [], evidence: '' })).warnings.join(' ');
  assert.match(w, /Documentación incompleta/); assert.match(w, /Sin evidencia fotográfica/); assert.match(w, /Sin número de remisión/);
});

test('fotografías: tipo, tamaño, máximo 8 y compresión proporcional', () => {
  assert.equal(photoError({ name: 'a.jpg', type: 'image/jpeg', size: 10 }), '');
  assert.match(photoError({ name: 'a.gif', type: 'image/gif', size: 10 }), /JPG, PNG o WebP/);
  assert.match(photoError({ name: 'a.png', type: 'image/png', size: 0 }), /vacío/);
  assert.match(photoError({ name: 'a.png', type: 'image/png', size: 16 * 1024 * 1024 }), /15 MB/);
  assert.match(v(good({ photos: Array.from({ length: 9 }, (_, i) => photo(i)) })).errors.photos, /Máximo 8/);
  assert.deepEqual(fitSize(4000, 3000), { w: 1600, h: 1200 }); assert.deepEqual(fitSize(800, 600), { w: 800, h: 600 }); assert.deepEqual(fitSize(1000, 5000), { w: 320, h: 1600 });
});

test('selector de OC: completas al final y deshabilitadas', () => {
  const o = orderOptions([{ id: 'a', folio: 'OC-1', version_number: 1, supplier_name: 'A', received_percent: 100, reception: 'complete' }, { id: 'b', folio: 'OC-3', version_number: 2, supplier_name: 'B', received_percent: 66.67, reception: 'partial' }, { id: 'c', folio: 'OC-5', version_number: 1, supplier_name: 'C', received_percent: null, reception: 'pending' }]);
  assert.deepEqual(o.map(x => [x.id, x.disabled]), [['b', false], ['c', false], ['a', true]]);
  assert.equal(o[0].label, 'OC-3 Rev. 1 · B · 66.67 % recibido'); assert.equal(o[1].label, 'OC-5 · C · sin recepción'); assert.match(o[2].label, /completa$/);
});

test('mensaje de guardado bloqueado y pendiente por partida', () => {
  const t = receptionLockedText(ORDER, good({ type: 'partial', qty: '80', quality: 'observaciones', docs: 'incompleta' }));
  assert.match(t, /^Datos validados, pero no se guardó la recepción de OC-QA-0003 \(80 %, parcial, con observaciones, documentación incompleta, 1 fotografía\(s\)\)/);
  assert.match(t, /Las fotografías no se subieron\./);
  assert.equal(outstanding(ORDER.items[0]), 1); assert.equal(outstanding({ quantity: 2, received: 3 }), 0);
  assert.equal(validateReception(emptyReception(''), {}, true).errors.po, 'Select the purchase order.');
});
