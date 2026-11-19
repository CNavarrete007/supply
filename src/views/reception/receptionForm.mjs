// Recepción y Entrega · tarjeta 1 "Registro de recepción" · lógica pura (sin red).
// Registrar una recepción y subir sus fotografías es una escritura operativa sin endpoint: el formulario se valida contra
// la OC (GET /reception/orders/{id}: % recibido de la serie, partidas y recepciones previas) y "Guardar recepción" informa
// que no se guardó. Las fotografías se comprimen en el navegador y no se suben.

export const RECEPTION_TYPES = [['total', 'Total', 'Total'], ['partial', 'Parcial', 'Partial']];
export const QUALITY = [['conforme', 'Conforme', 'Compliant'], ['observaciones', 'Con observaciones', 'With observations'], ['no_conforme', 'No conforme', 'Non-compliant']];
export const DOCUMENTATION = [['completa', 'Completa', 'Complete'], ['incompleta', 'Incompleta', 'Incomplete'], ['no_recibida', 'No recibida', 'Not received']];
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX = 8;
export const PHOTO_INPUT_MAX = 15 * 1024 * 1024;
export const PHOTO_EDGE = 1600;

const clean = v => String(v ?? '').trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = v => ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const label = (list, v, en) => { const x = list.find(r => r[0] === v); return x ? (en ? x[2] : x[1]) : clean(v); };
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export const emptyReception = (today = '') => ({ po: '', date: today, type: 'total', qty: '100', quality: 'conforme', docs: 'completa', evidence: '', notes: '', photos: [] });

/** Changing the type: Total means 100 % received; Parcial clears 100 so the user captures the partial percentage. */
export const withType = (f, type) => ({ ...f, type, qty: type === 'total' ? '100' : (Number(f.qty) >= 100 ? '' : f.qty) });

/** Purchase order selector: "OC-QA-0003 Rev. 1 · Proveedor · 66.67 % recibido"; fully received orders are disabled. */
export function orderOptions(items = [], en = false) {
  return items.map(o => {
    const rev = Math.max(0, (Number(o.version_number) || 1) - 1);
    const pct = o.received_percent === null || o.received_percent === undefined ? (en ? 'no receipt' : 'sin recepción') : `${Number(o.received_percent)} % ${en ? 'received' : 'recibido'}`;
    const done = o.reception === 'complete' || Number(o.received_percent) >= 100;
    return { id: o.id, label: `${o.folio}${rev ? ` Rev. ${rev}` : ''} · ${clean(o.supplier_name)} · ${pct}${done ? (en ? ' — complete' : ' — completa') : ''}`, disabled: done };
  }).sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.label.localeCompare(b.label));
}

/** Image to attach: JPG, PNG or WebP up to 15 MB before compression. '' = valid. */
export function photoError(file, en = false) {
  const m = (es, e) => (en ? e : es);
  if (!PHOTO_TYPES.includes(clean(file?.type).toLowerCase())) return m(`${clean(file?.name) || 'Archivo'}: solo se aceptan imágenes JPG, PNG o WebP.`, `${clean(file?.name) || 'File'}: only JPG, PNG or WebP images are accepted.`);
  if (!file.size) return m(`${file.name}: el archivo está vacío.`, `${file.name}: the file is empty.`);
  if (file.size > PHOTO_INPUT_MAX) return m(`${file.name}: excede 15 MB.`, `${file.name}: exceeds 15 MB.`);
  return '';
}

/** Compressed size keeping the aspect ratio: the longest edge becomes at most 1600 px (never upscaled). */
export function fitSize(w, h, edge = PHOTO_EDGE) {
  const k = Math.min(1, edge / Math.max(w || 1, h || 1));
  return { w: Math.max(1, Math.round((w || 1) * k)), h: Math.max(1, Math.round((h || 1) * k)) };
}

/**
 * { ok, errors, warnings, first }. ctx.order = GET /reception/orders/{id} ({ item, items, receipts }), ctx.today.
 * "Cantidad / % recibido" is the cumulative percentage of the order received after this receipt.
 */
export function validateReception(f, { order = null, today = '' } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = [];
  const o = order?.item || null; const prev = Number(o?.received_percent) || 0;
  if (!f.po) errors.po = m('Selecciona la orden de compra.', 'Select the purchase order.');
  else if (o && (o.reception === 'complete' || prev >= 100)) errors.po = m(`${o.folio} ya está recibida al 100 %: no admite otra recepción.`, `${o.folio} is already 100% received: it admits no further receipt.`);
  if (!f.date) errors.date = m('Indica la fecha de recepción.', 'Enter the receipt date.');
  else if (!validDate(f.date)) errors.date = m('Fecha inválida.', 'Invalid date.');
  else if (today && f.date > today) errors.date = m('La fecha de recepción no puede ser futura.', 'The receipt date cannot be in the future.');
  if (!RECEPTION_TYPES.some(t => t[0] === f.type)) errors.type = m('Selecciona el tipo de recepción.', 'Select the receipt type.');
  const q = /^\d{1,3}(\.\d{1,2})?$/.test(clean(f.qty)) ? Number(f.qty) : null;
  if (q === null || q <= 0 || q > 100) errors.qty = m('Captura el % recibido (mayor a 0 y hasta 100, con hasta 2 decimales).', 'Enter the % received (greater than 0 and up to 100, up to 2 decimals).');
  else if (f.type === 'total' && q !== 100) errors.qty = m('Una recepción total corresponde al 100 % recibido.', 'A total receipt means 100% received.');
  else if (f.type === 'partial' && q >= 100) errors.qty = m('Una recepción parcial debe ser menor al 100 %; si llega todo, usa Total.', 'A partial receipt must be below 100%; if everything arrived, use Total.');
  else if (o && q <= prev) errors.qty = m(`El % recibido acumulado debe ser mayor al ya registrado (${prev} %).`, `The cumulative % received must be greater than the one already recorded (${prev}%).`);
  if (!QUALITY.some(t => t[0] === f.quality)) errors.quality = m('Selecciona el resultado de la inspección.', 'Select the inspection result.');
  if (!DOCUMENTATION.some(t => t[0] === f.docs)) errors.docs = m('Selecciona la documentación recibida.', 'Select the documentation received.');
  if (clean(f.evidence).length > 255) errors.evidence = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  if (clean(f.notes).length > 2000) errors.notes = m('Máximo 2000 caracteres.', 'Maximum 2000 characters.');
  else if (f.quality !== 'conforme' && clean(f.notes).length < 10) errors.notes = m('Describe las observaciones o la no conformidad (mínimo 10 caracteres).', 'Describe the observations or the non-compliance (minimum 10 characters).');
  if ((f.photos || []).length > PHOTO_MAX) errors.photos = m(`Máximo ${PHOTO_MAX} fotografías por recepción.`, `Maximum ${PHOTO_MAX} photos per receipt.`);
  if (f.docs !== 'completa') warnings.push(m(`Documentación ${label(DOCUMENTATION, f.docs, en).toLowerCase()}: la recepción quedará con pendiente documental.`, `Documentation ${label(DOCUMENTATION, f.docs, en).toLowerCase()}: the receipt will keep a documentation pending.`));
  if (f.quality === 'no_conforme') warnings.push(m('No conforme: el material rechazado no cuenta para la entrega al cliente.', 'Non-compliant: rejected material does not count for the client delivery.'));
  if (!(f.photos || []).length) warnings.push(m('Sin evidencia fotográfica.', 'No photo evidence.'));
  if (!clean(f.evidence)) warnings.push(m('Sin número de remisión, factura o packing list.', 'No delivery note, invoice or packing list number.'));
  if (o?.commitment_date && f.date && validDate(f.date) && f.date > clean(o.commitment_date).slice(0, 10)) warnings.push(m(`Recepción ${days(clean(o.commitment_date).slice(0, 10), f.date)} día(s) después del compromiso de entrega (${clean(o.commitment_date).slice(0, 10)}).`, `Receipt ${days(clean(o.commitment_date).slice(0, 10), f.date)} day(s) after the delivery commitment (${clean(o.commitment_date).slice(0, 10)}).`));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, first: keys.length ? errors[keys[0]] : '' };
}

/** Message after a valid "Guardar recepción": nothing is written nor uploaded. */
export function receptionLockedText(order, f, en = false) {
  const o = order?.item || {};
  const parts = [`${Number(f.qty)} %`, label(RECEPTION_TYPES, f.type, en).toLowerCase(), label(QUALITY, f.quality, en).toLowerCase(), `${en ? 'documentation' : 'documentación'} ${label(DOCUMENTATION, f.docs, en).toLowerCase()}`, `${(f.photos || []).length} ${en ? 'photo(s)' : 'fotografía(s)'}`];
  return en
    ? `Data validated, but the receipt of ${o.folio} was not saved (${parts.join(', ')}): recording receipts and uploading their photos is an operational write blocked until authorized. The photos were not uploaded.`
    : `Datos validados, pero no se guardó la recepción de ${o.folio} (${parts.join(', ')}): registrar recepciones y subir sus fotografías es una escritura operativa bloqueada hasta su autorización. Las fotografías no se subieron.`;
}

/** Outstanding quantity per line (ordered − received), never negative. */
export const outstanding = line => Math.max(0, (Number(line?.quantity) || 0) - (Number(line?.received) || 0));
