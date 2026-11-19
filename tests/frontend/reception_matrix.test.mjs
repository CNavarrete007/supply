// Recepción y Entrega · tarjeta 3 "Matriz de recepción y entrega" y Formato de entrega Grupo Gerez (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { clientsChip, matrixRow, deleteBlock, deleteError, deleteLockedText, deliveryPreset, qty2 } from '../../src/views/reception/receptionMatrix.mjs';
import { formatModel, deliveryFormatHtml, buildDeliveryPdf, deliveryPdfName } from '../../src/views/reception/deliveryFormat.mjs';

// Filas sintéticas con la forma de GET /api/v1/reception/matrix.
const REC = { kind: 'receipt', id: 'r1', folio: 'REC-QA-0005', date: '2026-10-14', po_folio: 'OC-QA-0032', po_version: 1, po_id: 'p1', supplier_name: 'Proveedor QA', requisitions: 'REQ-QA-2, REQ-QA-3',
  client_name: 'Cliente Uno', client_id: 'c1', received_percent: 100, delivery_count: 1, quality_result: 'Conforme', documentation_result: 'Completa', notes: 'comprobante 12189', photo_count: 0,
  acceptance: 'accepted', delivery_type: 'partial', delivery_locked: true, signature_count: 0, capture_grain: 'line_items' };
const DEL = { kind: 'delivery', id: 'd1', folio: 'ENT-QA-0004', date: '2026-10-14', delivery_type: 'partial', po_folios: 'OC-QA-0026, OC-QA-0024', requisitions: 'REQ-QA-2', client_name: 'Cliente Uno',
  delivered_qty: 2, item_count: 1, status: 'signed', locked: true, evidence_text: 'FOTOS', delivery_place: 'ESEASA', photo_count: 1, acceptance_status: 'accepted', document_sha256: '5e1399d964e4abcdef' };

test('chip del panel de clientes y cantidades con dos decimales', () => {
  assert.equal(clientsChip([{ receipts: 4, deliveries: 2 }]), '1 cliente(s) · 6 registro(s)');
  assert.equal(clientsChip([], true), '0 client(s) · 0 record(s)');
  assert.deepEqual([qty2(2), qty2(0.5), qty2('98'), qty2(1.23456), qty2(null)], ['2.00', '0.50', '98.00', '1.2346', '—']);
});

test('fila RECEPCIÓN con las columnas del diseño', () => {
  const v = matrixRow(REC);
  assert.equal(v.qtyMain, '100% recibido'); assert.equal(v.qtySub, '1 formato(s) de entrega');
  assert.deepEqual([v.status.text, v.status.tone], ['Conforme', 'green']);
  assert.deepEqual([v.docs.text, v.docs.chip, v.docs.tone, v.docs.sub], ['Completa', true, 'blue', 'comprobante 12189']);
  assert.equal(v.photos.text, '0 recepción');
  assert.deepEqual([v.acceptance.text, v.acceptance.tone], ['Entrega parcial', 'amber'], 'última entrega vinculada parcial');
  assert.deepEqual([v.integrity.text, v.integrity.lock], ['Recepción', false], 'entrega parcial: aún no hay firmas vinculadas completas');
  const done = matrixRow({ ...REC, delivery_type: 'complete' });
  assert.deepEqual([done.acceptance.text, done.integrity.text, done.integrity.lock], ['Aceptado', 'Firmas vinculadas', true]);
  assert.equal(matrixRow({ ...REC, delivery_count: 0, acceptance: null, delivery_type: null, delivery_locked: null }).acceptance.text, 'Sin entrega');
  assert.equal(matrixRow({ ...REC, received_percent: null }).qtyMain, 'Avance sin registrar');
  assert.equal(matrixRow({ ...REC, quality_result: 'No conforme' }).status.tone, 'red');
  assert.equal(matrixRow({ ...REC, po_version: 2 }).ocs[0], 'OC-QA-0032 Rev. 1');
});

test('fila ENTREGA con las columnas del diseño', () => {
  const v = matrixRow(DEL);
  assert.equal(v.folioSub, 'Parcial · 2026-10-14');
  assert.deepEqual(v.ocs, ['OC-QA-0026', 'OC-QA-0024']);
  assert.deepEqual([v.qtyMain, v.qtySub], ['2.00 entregado', '1 partida(s) · Parcial']);
  assert.deepEqual([v.status.text, v.status.tone], ['Firmada y bloqueada', 'blue']);
  assert.deepEqual([v.docs.text, v.docs.chip, v.docs.sub], ['FOTOS', false, 'ESEASA']);
  assert.equal(v.photos.text, '1 foto(s)');
  assert.deepEqual([v.acceptance.text, v.integrity.text, v.integrity.hash], ['Aceptado', 'Firmada y bloqueada', 'SHA-256 5e1399d964e4…']);
  const draft = matrixRow({ ...DEL, locked: false, status: 'draft', acceptance_status: 'pending' });
  assert.deepEqual([draft.status.text, draft.integrity.text, draft.acceptance.text], ['Borrador', 'Sin bloqueo', 'Pendiente']);
  assert.equal(matrixRow({ ...DEL, legacy_status: 'Cancelada' }).status.text, 'Cancelada');
  assert.equal(matrixRow(DEL, true).qtyMain, '2.00 delivered');
});

test('eliminar: reglas de conservación, confirmación y bloqueo de escritura', () => {
  assert.match(deleteBlock(DEL), /firmado y bloqueado/);
  assert.match(deleteBlock({ ...DEL, locked: false, legacy_status: 'Cancelada' }), /ya está cancelada/);
  assert.equal(deleteBlock({ ...DEL, locked: false }), null, 'borrador sin firma: aplica el diálogo');
  assert.match(deleteBlock(REC), /1 formato\(s\) de entrega/);
  assert.match(deleteBlock({ ...REC, delivery_count: 0, signature_count: 2 }), /2 firma\(s\)/);
  assert.match(deleteBlock({ ...REC, delivery_count: 0, capture_grain: 'legacy_header_only' }), /histórica importada/);
  assert.equal(deleteBlock({ ...REC, delivery_count: 0 }), null);
  assert.match(deleteError(REC, 'REC-QA-9', 'motivo suficiente'), /Escribe el folio REC-QA-0005/);
  assert.match(deleteError(REC, 'rec-qa-0005', 'corto'), /mínimo 10/);
  assert.equal(deleteError(REC, ' rec-qa-0005 ', 'Captura duplicada por error'), '');
  assert.match(deleteLockedText(REC), /^Datos validados, pero no se eliminó REC-QA-0005: eliminar recepciones o entregas es una escritura operativa bloqueada/);
});

test('Nueva entrega desde una recepción: cliente y requisiciones a preseleccionar', () => {
  assert.deepEqual(deliveryPreset(REC), { client: 'c1', folios: ['REQ-QA-2', 'REQ-QA-3'], from: 'REC-QA-0005' });
  assert.deepEqual(deliveryPreset({ folio: 'X' }), { client: '', folios: [], from: 'X' });
});

// Detalle sintético con la forma de GET /api/v1/reception/deliveries/{id}.
const DET = {
  item: { id: 'e7f2', folio: 'ENT-QA-<4>', date: '2026-10-14', control_reference: 'CTRL-QA-04', delivery_type: 'partial', acceptance_status: 'accepted', status: 'signed', delivery_place: 'ESEASA',
    delivered_by: 'Miguel', delivered_by_position: 'Coordinador de auxiliares', received_by: '<b>Abraham</b>', received_by_position: 'Manager', evidence_text: 'FOTOS', notes: 'Sin daños',
    locked: true, client_name: 'Ejemplo & Uno', po_folios: 'OC-QA-0032', receipt_folios: 'REC-QA-0005', requisitions: '202609-REQ-0002', document_sha256: '5e1399d964e4434eec9c35d2' },
  items: [{ line_number: 2, description: 'Cuaderno profesional', unit_label: 'pza', delivered: 2, requested: 100, received: 100, previously_delivered: 0, balance: 98, requisition: '202609-REQ-0002' }],
  sources: [{ po_folio: 'OC-QA-0032', receipt_folio: 'REC-QA-0005', requisition: '202609-REQ-0002' }],
  signatures: [{ role: 'contractor_deliverer', method: 'Firma electrónica manuscrita capturada en SupplyFlow', signed_at: '2026-10-14 15:26:31.085000', document_sha256: 'aa', signature_sha256: 'bbccdd', has_image: true, signer: 'Miguel' },
    { role: 'client_receiver', method: 'Firma electrónica manuscrita capturada en SupplyFlow', signed_at: '2026-10-14 15:20:00.000000', document_sha256: 'aa', signature_sha256: null, has_image: false, signer: 'Abraham' }],
  files: [],
};

test('formato: modelo con cliente, partidas (OC por requisición), firmantes y control electrónico', () => {
  const f = formatModel(DET);
  assert.deepEqual([f.folio, f.date, f.type, f.acceptance, f.client, f.place], ['ENT-QA-<4>', '2026-10-14', 'Parcial', 'Aceptado', 'Ejemplo & Uno', 'ESEASA']);
  assert.deepEqual(f.rows[0], { req: '202609-REQ-0002', oc: 'OC-QA-0032', item: '2', desc: 'Cuaderno profesional', unit: 'PZA', requested: '100.00', delivered: '2.00', balance: '98.00' });
  assert.equal(f.evidence, 'FOTOS · Sin daños');
  assert.deepEqual(f.signers.map(s => [s.title, s.name, s.position]), [['ENTREGÓ POR EL CONTRATISTA', 'MIGUEL', 'COORDINADOR DE AUXILIARES'], ['RECIBIÓ POR EL CLIENTE', '<B>ABRAHAM</B>', 'MANAGER']]);
  assert.match(f.signers[0].sig.text, /resguardo privado/, 'la imagen de la firma no se descarga');
  assert.equal(f.signers[0].sig.hash, 'bbccdd');
  assert.equal(f.signers[1].sig.text, 'Firma electrónica registrada');
  assert.deepEqual(f.control, { id: 'CTRL-QA-04', signedAt: '2026-10-14 15:26:31', method: 'Firma electrónica manuscrita capturada en SupplyFlow', hash: '5e1399d964e4434eec9c35d2' });
  const none = formatModel({ item: { folio: 'ENT-1', locked: false }, items: [], sources: [], signatures: [] }, true);
  assert.deepEqual([none.signers[0].sig, none.control.signedAt, none.type], [null, '', '—']);
  assert.equal(deliveryPdfName(DET), 'ENT-QA-<4>.pdf');
});

test('formato HTML Grupo Gerez: escapado, encabezado, tabla, firmas e integridad', () => {
  const html = deliveryFormatHtml(DET);
  assert.ok(html.includes('ENT-QA-&lt;4&gt;') && html.includes('Ejemplo &amp; Uno') && html.includes('&lt;B&gt;ABRAHAM&lt;/B&gt;') && !html.includes('<b>Abraham</b>'));
  for (const t of ['GRUPO GEREZ', 'FORMATO DE ENTREGA', 'DELIVERY NOTE / EVIDENCIA DE ENTREGA', 'Aceptación: Aceptado', 'OC: OC-QA-0032', 'ENTREGÓ POR EL CONTRATISTA', 'RECIBIÓ POR EL CLIENTE',
    'CONTROL ELECTRÓNICO E INTEGRIDAD'.toLowerCase(), 'ID de control: CTRL-QA-04', 'SHA-256 expediente: 5e1399d964e4434eec9c35d2', 'Documento firmado y bloqueado.', 'image_923273.svg', 'Tampico'])
    assert.ok(html.toLowerCase().includes(t.toLowerCase()), t);
  assert.ok(html.includes('<td class="n b">2.00</td>'), 'Entregado en negritas');
  assert.ok(deliveryFormatHtml({ ...DET, item: { ...DET.item, locked: false } }).includes('Registro sin bloqueo de firma.'));
  assert.ok(deliveryFormatHtml(DET, true).includes('DELIVERY FORMAT'));
});

test('PDF del formato (jsPDF en Node): contenido Grupo Gerez, partidas, firmas, integridad y saltos de página', () => {
  const doc = buildDeliveryPdf(jsPDF, DET);
  const pdf = Buffer.from(doc.output('arraybuffer')).toString('latin1');
  for (const t of ['GRUPO GEREZ', 'FORMATO DE ENTREGA', 'ENT-QA-<4>', 'CLIENTE', 'Cuaderno profesional', 'ENTREGADO', '98.00', 'MIGUEL', 'CONTROL ELECTR', 'CTRL-QA-04', '5e1399d964e4434eec9c35d2', 'Tampico'])
    assert.ok(pdf.includes(t), t);
  assert.equal(doc.getNumberOfPages(), 1);
  const many = { ...DET, items: Array.from({ length: 40 }, (_, i) => ({ ...DET.items[0], line_number: i + 1, description: `Partida ${i + 1} con descripción larga para forzar varias líneas en la tabla del formato` })) };
  const big = buildDeliveryPdf(jsPDF, many);
  assert.ok(big.getNumberOfPages() > 1);
  assert.ok(Buffer.from(big.output('arraybuffer')).toString('latin1').includes(`1/${big.getNumberOfPages()}`));
  assert.ok(Buffer.from(buildDeliveryPdf(jsPDF, DET, true).output('arraybuffer')).toString('latin1').includes('DELIVERY FORMAT'));
});
