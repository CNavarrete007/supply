// Recepción y Entrega · tarjeta 3 "Matriz de recepción y entrega" · lógica pura (sin red).
// Cada fila viene de GET /api/v1/reception/matrix (kind receipt | delivery). Eliminar recepciones o entregas es una escritura
// operativa sin endpoint: el diálogo aplica las reglas de conservación, valida folio y motivo, y termina en "no se eliminó".
import { label, isAccepted, pct, shortHash } from './model.mjs';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ymd = v => (v ? String(v).slice(0, 10) : '—');
/** Quantities like the design: 2 decimals (up to 4 when needed), "—" when unknown. */
export const qty2 = v => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
const isPartial = v => /^(partial|parcial)/.test(fold(v));
const isCancelled = r => /^(cancelad|cancelled)/.test(fold(r?.legacy_status)) || /^(cancelad|cancelled)/.test(fold(r?.status));
const typeLabel = (v, en) => (isPartial(v) ? (en ? 'Partial' : 'Parcial') : /^(complete|completa|total)/.test(fold(v)) ? (en ? 'Complete' : 'Completa') : label(v, en));

/** Header chip of the client panel: "1 cliente(s) · 6 registro(s)". */
export function clientsChip(cards = [], en = false) {
  const total = cards.reduce((n, c) => n + (Number(c.receipts) || 0) + (Number(c.deliveries) || 0), 0);
  return en ? `${cards.length} client(s) · ${total} record(s)` : `${cards.length} cliente(s) · ${total} registro(s)`;
}

/**
 * Display model of a matrix row (columns of the design). tone: green | amber | red | blue | purple | gray.
 * Receipt: progress, delivery formats, quality, documentation, reception photos, acceptance ("Entrega parcial" when the
 * latest linked delivery is partial) and integrity ("Firmas vinculadas" when it has its own signatures or its latest
 * linked delivery is complete and signed). Delivery: delivered quantity, lines · type, signed/locked state, evidence and
 * place, photos, acceptance and SHA-256 of the signed document.
 */
export function matrixRow(r, en = false) {
  const m = (es, e) => (en ? e : es);
  if (r?.kind === 'delivery') {
    const cancelled = isCancelled(r);
    const acc = clean(r.acceptance_status);
    return {
      kind: 'delivery', folio: r.folio, folioSub: `${typeLabel(r.delivery_type, en)} · ${ymd(r.date)}`,
      ocs: clean(r.po_folios) ? clean(r.po_folios).split(', ') : ['—'], requisitions: clean(r.requisitions) || '—', reqSub: '', client: clean(r.client_name) || '—',
      qtyMain: `${qty2(r.delivered_qty)} ${m('entregado', 'delivered')}`, qtySub: `${Number(r.item_count) || 0} ${m('partida(s)', 'line(s)')} · ${typeLabel(r.delivery_type, en)}`,
      status: cancelled ? { text: m('Cancelada', 'Cancelled'), tone: 'red' } : r.locked ? { text: m('Firmada y bloqueada', 'Signed and locked'), tone: 'blue' } : { text: label(r.status, en), tone: 'amber' },
      docs: { text: clean(r.evidence_text) || '—', chip: false, sub: clean(r.delivery_place) },
      photos: { text: `${Number(r.photo_count) || 0} ${m('foto(s)', 'photo(s)')}`, tone: 'purple' },
      acceptance: !acc ? { text: m('Sin aceptación', 'No acceptance'), tone: 'gray' } : isAccepted(acc) ? { text: m('Aceptado', 'Accepted'), tone: 'green' }
        : /reject|rechaz/.test(fold(acc)) ? { text: m('Rechazado', 'Rejected'), tone: 'red' } : { text: label(acc, en), tone: 'amber' },
      integrity: r.locked ? { text: m('Firmada y bloqueada', 'Signed and locked'), tone: 'green', lock: true, hash: shortHash(r.document_sha256) } : { text: m('Sin bloqueo', 'Unlocked'), tone: 'amber', lock: false, hash: null },
    };
  }
  const q = clean(r?.quality_result);
  const docs = clean(r?.documentation_result);
  const acc = clean(r?.acceptance);
  const linkedSigned = r?.delivery_locked === true && !isPartial(r?.delivery_type);
  return {
    kind: 'receipt', folio: r?.folio, folioSub: ymd(r?.date),
    ocs: [`${clean(r?.po_folio)}${Number(r?.po_version) > 1 ? ` Rev. ${Number(r.po_version) - 1}` : ''}` || '—'], requisitions: clean(r?.requisitions) || '—', reqSub: clean(r?.supplier_name), client: clean(r?.client_name) || '—',
    qtyMain: r?.received_percent === null || r?.received_percent === undefined ? m('Avance sin registrar', 'Progress not recorded') : `${pct(r.received_percent)} ${m('recibido', 'received')}`,
    qtySub: `${Number(r?.delivery_count) || 0} ${m('formato(s) de entrega', 'delivery format(s)')}`,
    status: !q ? { text: '—', tone: 'gray' } : /^(conforme|conformant|according)/.test(fold(q)) ? { text: q, tone: 'green' } : /^no /.test(fold(q)) ? { text: q, tone: 'red' } : { text: q, tone: 'amber' },
    docs: { text: docs || '—', chip: !!docs, tone: !docs ? 'gray' : /^(completa|complete)$/.test(fold(docs)) ? 'blue' : 'amber', sub: clean(r?.notes) },
    photos: { text: `${Number(r?.photo_count) || 0} ${m('recepción', 'receipt')}`, tone: 'blue' },
    acceptance: Number(r?.delivery_count) > 0 && isPartial(r?.delivery_type) ? { text: m('Entrega parcial', 'Partial delivery'), tone: 'amber' }
      : !acc ? { text: m('Sin entrega', 'No delivery'), tone: 'gray' } : isAccepted(acc) ? { text: m('Aceptado', 'Accepted'), tone: 'green' }
        : /reject|rechaz|no acept|not acc/.test(fold(acc)) ? { text: label(acc, en), tone: 'red' } : { text: label(acc, en), tone: 'amber' },
    integrity: Number(r?.signature_count) > 0 || linkedSigned ? { text: m('Firmas vinculadas', 'Linked signatures'), tone: 'green', lock: true, hash: null } : { text: m('Recepción', 'Receipt'), tone: 'gray', lock: false, hash: null },
  };
}

/** Why a row cannot be deleted (records that must be kept); null when the confirmation dialog applies. */
export function deleteBlock(r, en = false) {
  const m = (es, e) => (en ? e : es);
  if (r?.kind === 'delivery') {
    if (isCancelled(r)) return m(`${r.folio} ya está cancelada: se conserva como historial.`, `${r.folio} is already cancelled: it is kept as history.`);
    if (r.locked) return m(`No se elimina ${r.folio}: el formato está firmado y bloqueado y se conserva como evidencia de entrega. Si procede, debe cancelarse con motivo y auditoría.`, `${r.folio} is not deleted: the format is signed and locked and is kept as delivery evidence. If appropriate, it must be cancelled with a reason and audit trail.`);
    return null;
  }
  if (r?.capture_grain === 'legacy_header_only') return m(`No se elimina ${r.folio}: es una recepción histórica importada del sistema original y se conserva como expediente.`, `${r?.folio} is not deleted: it is a historical receipt imported from the original system and is kept as a record.`);
  const why = [Number(r?.delivery_count) > 0 && m(`${r.delivery_count} formato(s) de entrega`, `${r.delivery_count} delivery format(s)`), Number(r?.signature_count) > 0 && m(`${r.signature_count} firma(s)`, `${r.signature_count} signature(s)`)].filter(Boolean);
  if (why.length) return m(`No se elimina ${r.folio}: tiene ${why.join(' y ')} vinculados que deben conservarse.`, `${r.folio} is not deleted: it has linked ${why.join(' and ')} that must be kept.`);
  return null;
}

/** Folio typed exactly (case-insensitive) and a reason of at least 10 characters. → '' when valid. */
export function deleteError(r, folio, reason, en = false) {
  const m = (es, e) => (en ? e : es);
  if (clean(folio).toUpperCase() !== clean(r?.folio).toUpperCase()) return m(`Escribe el folio ${r?.folio} para confirmar.`, `Type the folio ${r?.folio} to confirm.`);
  if (clean(reason).length < 10) return m('Indica el motivo de la eliminación (mínimo 10 caracteres).', 'Enter the deletion reason (minimum 10 characters).');
  if (clean(reason).length > 500) return m('Máximo 500 caracteres.', 'Maximum 500 characters.');
  return '';
}

export const deleteLockedText = (r, en = false) => (en
  ? `Data validated, but ${r?.folio} was not deleted: deleting receipts or deliveries is an operational write blocked until authorized.`
  : `Datos validados, pero no se eliminó ${r?.folio}: eliminar recepciones o entregas es una escritura operativa bloqueada hasta su autorización.`);

/** Preset for "Nueva entrega" from a receipt row: client and requisition folios to preselect in card 2. */
export const deliveryPreset = r => ({ client: clean(r?.client_id), folios: clean(r?.requisitions).split(',').map(clean).filter(Boolean), from: clean(r?.folio) });
