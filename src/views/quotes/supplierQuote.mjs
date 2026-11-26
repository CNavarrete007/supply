// Cotizaciones › Registro de cotización (oferta del proveedor contra su RFQ) · lógica pura (sin red).
// Captura y cálculo en el navegador con las partidas reales de la RFQ. «Guardar cotización» la registra en MariaDB
// (POST/PUT /api/v1/quotes/supplier-quotes, cuenta quotewrite): el servidor vuelve a validar y calcula los importes.

export const PAYMENT_METHODS = [['PUE', 'PUE - Pago en una sola exhibición', 'PUE - Payment in a single installment'], ['PPD', 'PPD - Pago en parcialidades o diferido', 'PPD - Payment in installments or deferred']];
// 8 MB: límite de transporte del gateway (el PDF viaja en base64 dentro del JSON; client_max_body_size 12m), igual que RF1.
export const PDF_MAX_BYTES = 8 * 1024 * 1024;
export const QUOTE_GUIDE = 'docs/cotizaciones/REGISTRO_COTIZACION_PROVEEDOR.md';

const t = v => String(v ?? '').trim();
const DEC = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Cantidad o precio tal como lo escribe el comprador → número decimal en texto: acepta signo de pesos, espacios, comas de
 * miles (1,500.00), «.5» y «1500.». Devuelve el texto limpio; si no es un número válido, devuelve el texto sin cambios.
 */
export function cleanNumber(v) {
  let s = t(v).replace(/^\$\s*/, '').replace(/\s+/g, '');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  if (/^\.\d+$/.test(s)) s = `0${s}`;
  if (/^\d+\.$/.test(s)) s = s.slice(0, -1);
  if (/^0\d/.test(s)) s = s.replace(/^0+(?=\d)/, '');
  return DEC.test(s) ? s : t(v);
}
const num = v => { const s = cleanNumber(v); return s !== '' && DEC.test(s) ? Number(s) : null; };
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
/** '3.000000' → '3' */
export const normQty = v => { const s = t(v); return DEC.test(s) && s.includes('.') ? (s.replace(/0+$/, '').replace(/\.$/, '') || '0') : s; };

export function emptyQuote() {
  return { buyer: '', requisition: '', rfq: '', supplier_reference: '', quote_date: '', valid_until: '', vat: '16', currency: 'MXN', lead_days: '', payment: '', technical: '100', documentation: '100', notes: '' };
}

/** Lines of the quote from the RFQ items (GET /api/v1/quotes/rfqs/{id} → items): all offered, quoted qty = requested. */
export function linesFromRfq(items = []) {
  return items.map((i, n) => ({ key: `${i.line_number}-${n}`, line_number: Number(i.line_number), description: i.description, specification: i.specification || '', category: i.category || '',
    unit: i.unit_label, requested: normQty(i.quantity), offered: true, qty: normQty(i.quantity), price: '' }));
}

/** Amounts of one line: importe sin IVA = qty × price, IVA = importe × IVA %, total con IVA (cents, rounded). */
export function lineAmounts(l, vat) {
  const q = num(l.qty); const p = num(l.price); const r = num(vat);
  if (!l.offered || q === null || p === null) return { subtotal: 0, tax: 0, total: 0 };
  const subtotal = round2(q * p); const tax = round2(subtotal * (r ?? 0) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}
export function quoteTotals(lines = [], vat) {
  const a = lines.map(l => lineAmounts(l, vat));
  const subtotal = round2(a.reduce((s, x) => s + x.subtotal, 0)); const tax = round2(a.reduce((s, x) => s + x.tax, 0));
  return { offered: lines.filter(l => l.offered).length, subtotal, tax, total: round2(subtotal + tax) };
}
/** "partial" | "over" | "" — quoted quantity vs requested. */
/** Aviso inmediato de una partida ofertada: formato no válido (error) o precio en cero (advertencia). */
export function lineNote(l, en = false) {
  if (!l?.offered) return null;
  const m = (es, e) => (en ? e : es);
  if ((t(l.qty) && num(l.qty) === null) || (t(l.price) && num(l.price) === null)) return { kind: 'error', text: m('Formato no válido: escribe solo el número, p. ej. 1500.50 (se aceptan $ y comas de miles).', 'Invalid format: type only the number, e.g. 1500.50 ($ and thousands commas are accepted).') };
  if (t(l.price) && num(l.price) === 0) return { kind: 'warn', text: m('Precio en $0: confirma que el proveedor no la cobra.', 'Price is $0: confirm the supplier does not charge it.') };
  return null;
}
export function qtyNote(l) { const q = num(l.qty); const r = num(l.requested); if (!l.offered || q === null || r === null || q === r) return ''; return q < r ? 'partial' : 'over'; }

const pct = v => { const n = num(v); return n !== null && n <= 100; };
/** { ok, errors, first } — required (*) fields of the design plus coherent dates, percentages and priced offered lines. */
export function validateQuote(f, lines = [], en = false, { edit = false } = {}) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  // Editar: comprador, requisición y RFQ quedan fijos (los de la cotización registrada).
  if (!edit && !f.buyer) errors.buyer = m('Selecciona el comprador responsable.', 'Select the responsible buyer.');
  if (!edit && !f.requisition) errors.requisition = m('Selecciona la requisición validada.', 'Select the validated requisition.');
  if (!edit && !f.rfq) errors.rfq = m('Selecciona la RFQ emitida.', 'Select the issued RFQ.');
  if (!DATE.test(f.quote_date || '')) errors.quote_date = m('Indica la fecha de cotización.', 'Enter the quote date.');
  if (f.valid_until && !DATE.test(f.valid_until)) errors.valid_until = m('Fecha inválida.', 'Invalid date.');
  else if (f.valid_until && f.quote_date && f.valid_until < f.quote_date) errors.valid_until = m('La vigencia no puede ser anterior a la fecha de cotización.', 'Validity cannot be before the quote date.');
  if (!/^\d{1,4}$/.test(t(f.lead_days)) || Number(f.lead_days) > 3650) errors.lead_days = m('Días de entrega: entero entre 0 y 3650.', 'Delivery days: integer between 0 and 3650.');
  if (!pct(f.vat)) errors.vat = m('IVA entre 0 y 100.', 'VAT between 0 and 100.');
  if (!pct(f.technical)) errors.technical = m('Cumplimiento técnico entre 0 y 100.', 'Technical compliance between 0 and 100.');
  if (!pct(f.documentation)) errors.documentation = m('Documentación entre 0 y 100.', 'Documentation between 0 and 100.');
  if (!['MXN', 'USD', 'EUR'].includes(f.currency)) errors.currency = m('Selecciona la moneda.', 'Select the currency.');
  if (t(f.supplier_reference).length > 128) errors.supplier_reference = m('Máximo 128 caracteres.', 'Max 128 characters.');
  if (t(f.notes).length > 4000) errors.notes = m('Máximo 4000 caracteres.', 'Max 4000 characters.');
  if (f.rfq) {
    const offered = lines.filter(l => l.offered);
    if (!offered.length) errors.lines = m('Marca al menos una partida que ofrece el proveedor.', 'Mark at least one item offered by the supplier.');
    for (const l of offered) {
      const q = num(l.qty); const p = num(l.price);
      if (q === null || q <= 0) errors[`line:${l.key}`] = t(l.qty) && q === null ? m(`Partida ${l.line_number}: cantidad con formato no válido (p. ej. 10 o 2.5).`, `Item ${l.line_number}: invalid quantity format (e.g. 10 or 2.5).`) : m(`Partida ${l.line_number}: cantidad cotizada mayor a cero.`, `Item ${l.line_number}: quoted quantity above zero.`);
      else if (p === null) errors[`line:${l.key}`] = t(l.price) ? m(`Partida ${l.line_number}: precio con formato no válido (p. ej. 1500.50).`, `Item ${l.line_number}: invalid price format (e.g. 1500.50).`) : m(`Partida ${l.line_number}: captura el precio unitario recibido.`, `Item ${l.line_number}: enter the unit price received.`);
    }
  }
  const first = Object.values(errors)[0] || '';
  return { ok: !first, errors, first };
}

/** First bytes of a PDF ("%PDF-"); the type reported by the browser alone is not trusted. */
export const isPdfHeader = bytes => bytes && bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';

// ---- Guardado en MariaDB (tarjeta 4) ----

/** Body of POST/PUT /api/v1/quotes/supplier-quotes. Amounts are NOT sent: the server computes them. */
export function quotePayload(f, lines = [], document = null, edit = false) {
  const p = { supplier_reference: t(f.supplier_reference), quote_date: t(f.quote_date), valid_until: t(f.valid_until), vat: t(f.vat), currency: f.currency, lead_days: t(f.lead_days),
    payment: f.payment || '', technical: t(f.technical), documentation: t(f.documentation), notes: t(f.notes),
    lines: lines.map(l => ({ line_number: Number(l.line_number), offered: !!l.offered, qty: l.offered ? cleanNumber(l.qty) : '0', price: l.offered ? cleanNumber(l.price) : '0' })), document: document || null };
  return edit ? p : { rfq_id: f.rfq, ...p };
}

/** Form and lines of a registered quote (GET /api/v1/quotes/supplier-quotes/{id}) for the edit mode. */
export function quoteFromDetail(det) {
  const it = det?.item || {};
  const form = { ...emptyQuote(), requisition: it.requisition_id || '', rfq: it.rfq_id || '', supplier_reference: it.supplier_reference || '', quote_date: String(it.quote_date || '').slice(0, 10),
    valid_until: String(it.valid_until || '').slice(0, 10), vat: it.tax_rate_pct === null || it.tax_rate_pct === undefined ? '0' : normQty(it.tax_rate_pct), currency: it.currency || 'MXN',
    lead_days: it.lead_days === null || it.lead_days === undefined ? '' : normQty(it.lead_days), payment: PAYMENT_METHODS.some(([c]) => c === it.payment_terms) ? it.payment_terms : '',
    technical: it.technical_score === null || it.technical_score === undefined ? '' : normQty(it.technical_score), documentation: it.document_score === null || it.document_score === undefined ? '' : normQty(it.document_score), notes: it.notes || '' };
  const lines = (det?.items || []).map((i, n) => ({ key: `${i.line_number}-${n}`, line_number: Number(i.line_number), description: i.description, specification: '', category: i.category || '', unit: i.unit_label,
    requested: normQty(i.requested_quantity), offered: !!i.offered, qty: i.offered ? normQty(i.quantity) : normQty(i.requested_quantity), price: i.offered ? normQty(i.unit_price) : '' }));
  return { form, lines };
}

/** Por qué una RFQ no puede recibir cotización en la tarjeta 4 ('' = disponible): ya cotizada, borrador o cancelada. */
export function rfqOptionBlock(x, en = false) {
  const m = (es, e) => (en ? e : es);
  const st = t(x?.status).toLowerCase();
  if (t(x?.quote_folios)) return m(`ya cotizada: ${t(x.quote_folios)}`, `already quoted: ${t(x.quote_folios)}`);
  if (['borrador', 'draft'].includes(st)) return x?.imported ? m('borrador importado: registra una RFQ nueva en la tarjeta 2', 'imported draft: record a new RFQ in card 2') : m('borrador: márcala como enviada en la Matriz de RFQ', 'draft: mark it as sent in the RFQ Matrix');
  if (['cancelada', 'cancelled', 'canceled', 'anulada'].includes(st)) return m('cancelada', 'cancelled');
  return '';
}

/** Why a quote cannot be edited ('' = editable). Codes from the server: imported | awarded | status. */
export function editBlockText(code, folio = '', en = false) {
  const m = (es, e) => (en ? e : es); const f = t(folio) || m('La cotización', 'The quote');
  if (!code) return '';
  if (code === 'imported') return m(`${f} es una cotización importada del sistema original (o sin RFQ): se conserva como expediente y no se edita.`, `${f} was imported from the original system (or has no RFQ): it is kept as a record and is not edited.`);
  if (code === 'awarded') return m(`${f} tiene adjudicación vigente: se conserva para trazabilidad y no se edita.`, `${f} has a current award: it is kept for traceability and is not edited.`);
  return m(`${f} ya no está en estatus «Recibida» y no se edita.`, `${f} is no longer "Received" and is not edited.`);
}

/** Same rule as the server, from a matrix row (GET /api/v1/quotes/supplier-quotes): code or null when editable. */
export function rowEditBlock(r) {
  if (!r) return 'imported';
  if (r.imported || (r.source_kind && r.source_kind !== 'explicit') || !t(r.rfq_folio)) return 'imported';
  if (r.awarded || Number(r.awarded_lines) > 0) return 'awarded';
  return r.status === 'recibida' ? null : 'status';
}

const CHANGE_LABEL = { supplier_reference: ['referencia del proveedor', 'supplier reference'], quote_date: ['fecha', 'date'], valid_until: ['vigencia', 'validity'], currency: ['moneda', 'currency'],
  vat: ['IVA', 'VAT'], lead_days: ['días de entrega', 'delivery days'], payment: ['condiciones de pago', 'payment terms'], technical: ['cumplimiento técnico', 'technical compliance'],
  documentation: ['documentación', 'documentation'], notes: ['comentarios', 'comments'], lines: ['partidas', 'items'], subtotal: ['importes', 'amounts'], tax: ['importes', 'amounts'],
  total: ['importes', 'amounts'], document: ['PDF', 'PDF'] };
/** Server change keys → readable labels (the three amounts collapse into one). */
export const changeLabels = (changed = [], en = false) => [...new Set(changed.map(k => (CHANGE_LABEL[k] ? CHANGE_LABEL[k][en ? 1 : 0] : k)))];

/** Message after a confirmed save. */
export function quoteSavedText(out, en = false) {
  const m = (es, e) => (en ? e : es);
  const total = Number(out?.total || 0).toLocaleString(en ? 'en-US' : 'es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const doc = out?.document?.name ? m(` con el PDF «${out.document.name}»`, ` with the PDF "${out.document.name}"`) : '';
  if (Array.isArray(out?.changed)) {
    const labels = changeLabels(out.changed, en).join(', ');
    return out.changed.length
      ? m(`Cambios de ${t(out.folio)} guardados en MariaDB (${labels}); versión ${out.version}. Total $${total} ${out.currency}${doc}.`, `Changes to ${t(out.folio)} saved to MariaDB (${labels}); version ${out.version}. Total $${total} ${out.currency}${doc}.`)
      : m('No había cambios por guardar.', 'No changes to save.');
  }
  return m(`Cotización ${t(out?.folio)} de ${t(out?.supplier_name)} registrada en MariaDB contra ${t(out?.rfq)} (${t(out?.requisition)}): total $${total} ${out?.currency}${doc}.`,
    `Quote ${t(out?.folio)} from ${t(out?.supplier_name)} recorded in MariaDB against ${t(out?.rfq)} (${t(out?.requisition)}): total $${total} ${out?.currency}${doc}.`);
}

const FORM_FIELD = { rfq_id: 'rfq', supplier_reference: 'supplier_reference', quote_date: 'quote_date', valid_until: 'valid_until', vat: 'vat', currency: 'currency', lead_days: 'lead_days',
  payment: 'payment', technical: 'technical', documentation: 'documentation', notes: 'notes', lines: 'lines', document: 'document' };
export const QUOTE_BLOCKING_CODES = ['QUOTE_WRITE_NOT_PROVISIONED', 'QUOTE_WRITE_ACCOUNT_REJECTED', 'QUOTE_WRITE_GRANTS_INCOMPLETE'];

/** Server error → { kind: error|warn, text, field (form key, or line:<key>), retry (reuse the Idempotency-Key) }. */
export function quoteSaveError(status, body, lines = [], en = false) {
  const m = (es, e) => (en ? e : es);
  const code = body?.error?.code; const message = body?.error?.message; const raw = body?.error?.field || '';
  const ln = /^line:(\d+)$/.exec(raw); const line = ln ? lines.find(l => Number(l.line_number) === Number(ln[1])) : null;
  const field = line ? `line:${line.key}` : FORM_FIELD[raw] || null;
  if (!status) return { kind: 'error', text: m('No se confirmó el guardado (sin respuesta del servidor). Presiona Guardar otra vez: se repite la misma operación sin duplicarla.', 'The save was not confirmed (no server response). Press Save again: the same operation is repeated without duplicating it.'), retry: true };
  if (status === 401) return { kind: 'error', text: m('Tu sesión expiró. Inicia sesión nuevamente; no se guardó nada.', 'Your session expired; nothing was saved.') };
  if (status === 403) return { kind: 'error', text: code === 'CSRF_INVALID' ? m('La sesión de seguridad cambió. Vuelve a intentarlo.', 'The security token changed. Try again.') : m('Solo un Master Admin puede registrar cotizaciones.', 'Only a Master Admin can record quotes.') };
  if (QUOTE_BLOCKING_CODES.includes(code)) return { kind: 'warn', text: `${message || m('El guardado de Cotizaciones no está habilitado en este equipo.', 'Saving quotes is not enabled on this computer.')} ${m(`Consulta «Activación en la PC» en ${QUOTE_GUIDE}.`, `See "Activación en la PC" in ${QUOTE_GUIDE}.`)}` };
  if (status === 412) return { kind: 'warn', text: m('Otra persona modificó la cotización. Vuelve a abrirla desde la matriz interna de proveedores.', 'Someone else changed the quote. Reopen it from the internal suppliers matrix.') };
  if (status === 413) return { kind: 'error', text: m('El PDF es demasiado grande: admite hasta 8 MB.', 'The PDF is too large: up to 8 MB.'), field: 'document' };
  if (status === 422) {
    const text = code === 'INVALID_QUOTE'
      ? (field === 'document' ? m('El servidor no aceptó el PDF (debe ser un PDF válido de hasta 8 MB).', 'The server did not accept the PDF (valid PDF up to 8 MB).') : line ? m(`Partida ${line.line_number}: revisa cantidad y precio unitario.`, `Item ${line.line_number}: check quantity and unit price.`) : m('Revisa el campo marcado: el servidor no lo aceptó.', 'Check the highlighted field: the server did not accept it.'))
      : message || m('Revisa los datos capturados.', 'Check the entered data.');
    return { kind: 'error', text, field };
  }
  if (status === 404 || status === 409) return { kind: 'error', text: message || m('No se pudo guardar.', 'Could not save.') };
  return { kind: 'error', text: m(`No se confirmó el guardado (${message || 'error del servidor'}). Presiona Guardar otra vez: se repite la misma operación sin duplicarla.`, `The save was not confirmed (${message || 'server error'}). Press Save again: the same operation is repeated without duplicating it.`), retry: true };
}
