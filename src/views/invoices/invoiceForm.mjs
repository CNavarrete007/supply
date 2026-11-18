// Factura · tarjeta 1 "Registro de factura" · lógica pura (sin red).
// Registrar o modificar facturas es una escritura comercial sin endpoint: el formulario se valida por completo y
// "Guardar factura" informa que no se guardó. El archivo se revisa solo en el navegador (no se sube).

export const CURRENCIES = ['MXN', 'USD', 'EUR'];
/** Estatus del registro (el estado de pago real lo calcula el servidor con el vencimiento y los pagos). */
export const STATUSES = [['registered', 'Registrada', 'Recorded'], ['pending_payment', 'Pendiente de pago', 'Pending payment'], ['paid', 'Pagada', 'Paid'], ['cancelled', 'Cancelada', 'Cancelled']];
export const FILE_TYPES = ['application/pdf', 'application/xml', 'text/xml', 'image/png', 'image/jpeg'];
export const FILE_MAX = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$/;
const DEC = /^\d{1,15}(\.\d{1,2})?$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clean = v => String(v ?? '').trim();
const num = v => (DEC.test(clean(v).replace(/,/g, '')) ? Number(clean(v).replace(/,/g, '')) : null);
const validDate = v => ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export const emptyInvoice = (today = '') => ({
  id: '', requisition: '', number: '', uuid: '', issue: today, due: '', currency: 'MXN', status: 'registered',
  issuer: '', receiver: '', subtotal: '', taxes: '', total: '', terms: '', notes: '', file: null,
});

const STATUS_FROM_STATE = { pending: 'pending_payment', overdue: 'pending_payment', paid: 'paid', cancelled: 'cancelled' };
const amount = v => (v === null || v === undefined || v === '' ? '' : (Math.round(Number(v) * 100) / 100).toFixed(2));

/** Registered invoice (context endpoint) → form (update mode). */
export function fromInvoice(inv, requisition = '') {
  if (!inv) return emptyInvoice();
  return {
    ...emptyInvoice(), id: inv.id, requisition, number: inv.invoice_number || '', uuid: inv.fiscal_uuid || '', issue: clean(inv.issue_date).slice(0, 10), due: clean(inv.due_date).slice(0, 10),
    currency: inv.currency || 'MXN', status: STATUS_FROM_STATE[inv.state] || 'registered', issuer: inv.issuer || '', receiver: inv.receiver || '',
    subtotal: amount(inv.subtotal_amount), taxes: amount(inv.tax_amount), total: amount(inv.total_amount), terms: inv.payment_terms || '', notes: inv.notes || '',
  };
}

/** Defaults from the requisition context: receiver = client; issuer and currency from its latest invoice when present. */
export function contextDefaults(ctx) {
  const last = (ctx?.invoices || []).filter(v => v.state !== 'cancelled').at(-1) || null;
  return { receiver: ctx?.requisition?.client_name || '', issuer: last?.issuer || '', currency: last?.currency || '' };
}

/** "Calcular total": subtotal + impuestos (2 decimales); null cuando falta o es inválido alguno. */
export function computeTotal(f) {
  const s = num(f.subtotal); const t = clean(f.taxes) === '' ? 0 : num(f.taxes);
  if (s === null || t === null) return null;
  return (Math.round((s + t) * 100) / 100).toFixed(2);
}

/**
 * { ok, errors, warnings, first }.
 * ctx: readiness (requisition context), invoices (registered for the requisition), editing (invoice being updated), today.
 */
export function validateInvoice(f, { readiness = null, invoices = [], editing = null, original = null, today = '' } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = [];
  if (!f.requisition) errors.requisition = m('Selecciona la requisición entregada y aceptada.', 'Select the delivered and accepted requisition.');
  else if (readiness && !readiness.ready && !editing) errors.requisition = m('La requisición aún no está recibida al 100 % y aceptada por el cliente: no puede facturarse.', 'The requisition is not yet 100% received and accepted by the client: it cannot be invoiced.');
  const number = clean(f.number);
  if (!number) errors.number = m('Indica el número de factura.', 'Enter the invoice number.');
  else if (!NUMBER.test(number)) errors.number = m('Número inválido (letras, números, espacio, punto, guion o diagonal; máximo 40).', 'Invalid number (letters, numbers, space, dot, dash or slash; max 40).');
  else if (invoices.some(v => clean(v.invoice_number).toLowerCase() === number.toLowerCase() && v.id !== editing?.id && v.state !== 'cancelled')) errors.number = m('Ya existe una factura vigente con ese número en esta requisición.', 'A current invoice with that number already exists for this requisition.');
  const uuid = clean(f.uuid);
  if (uuid && !UUID.test(uuid) && uuid !== clean(original?.uuid)) errors.uuid = m('UUID inválido (formato 8-4-4-4-12 del CFDI).', 'Invalid UUID (CFDI 8-4-4-4-12 format).');
  else if (uuid && invoices.some(v => clean(v.fiscal_uuid).toLowerCase() === uuid.toLowerCase() && v.id !== editing?.id)) errors.uuid = m('Ese UUID ya está registrado en otra factura.', 'That UUID is already recorded on another invoice.');
  if (!f.issue) errors.issue = m('Indica la fecha de emisión.', 'Enter the issue date.');
  else if (!validDate(f.issue)) errors.issue = m('Fecha inválida.', 'Invalid date.');
  else if (today && f.issue > today) errors.issue = m('La fecha de emisión no puede ser futura.', 'The issue date cannot be in the future.');
  if (f.due && !validDate(f.due)) errors.due = m('Fecha inválida.', 'Invalid date.');
  else if (f.due && f.issue && validDate(f.issue) && f.due < f.issue) errors.due = m('El vencimiento no puede ser anterior a la emisión.', 'The due date cannot precede the issue date.');
  if (!CURRENCIES.includes(f.currency)) errors.currency = m('Selecciona la moneda.', 'Select the currency.');
  if (!STATUSES.some(s => s[0] === f.status)) errors.status = m('Selecciona el estatus.', 'Select the status.');
  for (const k of ['issuer', 'receiver']) if (clean(f[k]).length > 255) errors[k] = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  for (const k of ['subtotal', 'taxes']) if (clean(f[k]) && num(f[k]) === null) errors[k] = m('Importe inválido (hasta 2 decimales).', 'Invalid amount (up to 2 decimals).');
  const total = num(f.total);
  if (!clean(f.total)) errors.total = m('Indica el total de la factura.', 'Enter the invoice total.');
  else if (total === null) errors.total = m('Importe inválido (hasta 2 decimales).', 'Invalid amount (up to 2 decimals).');
  else if (total <= 0) errors.total = m('El total debe ser mayor a cero.', 'The total must be greater than zero.');
  else if (clean(f.subtotal) && !errors.subtotal && !errors.taxes) {
    const calc = computeTotal(f); // tolerancia ±1 centavo por redondeo
    if (calc !== null && Math.abs(Math.round(Number(calc) * 100) - Math.round(total * 100)) > 1) errors.total = m(`El total no coincide con subtotal + impuestos (${calc}); usa Calcular total.`, `The total does not match subtotal + taxes (${calc}); use Calculate total.`);
  }
  if (clean(f.terms).length > 255) errors.terms = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  if (clean(f.notes).length > 2000) errors.notes = m('Máximo 2000 caracteres.', 'Maximum 2000 characters.');
  if (f.file) {
    if (!previewType(f.file)) errors.file = m('El archivo debe ser PDF, XML o imagen (PNG/JPG).', 'The file must be PDF, XML or an image (PNG/JPG).');
    else if (!f.file.size) errors.file = m('El archivo está vacío.', 'The file is empty.');
    else if (f.file.size > FILE_MAX) errors.file = m('El archivo no debe exceder 10 MB.', 'The file must not exceed 10 MB.');
  } else if (!editing) errors.file = m('Adjunta el archivo de la factura (PDF, XML o imagen).', 'Attach the invoice file (PDF, XML or image).');
  if (!uuid && f.status !== 'cancelled') warnings.push(m('Sin UUID: la factura no podrá conciliarse con el CFDI del SAT.', 'Without UUID the invoice cannot be reconciled with the SAT CFDI.'));
  if (f.status === 'paid' && f.due && today && f.due > today) warnings.push(m('Marcada como pagada antes de su vencimiento: confirma el comprobante de pago.', 'Marked as paid before its due date: confirm the payment proof.'));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, first: keys.length ? errors[keys[0]] : '' };
}

/** Changed fields of an update (labels). */
export function changedInvoiceFields(f, original, en = false) {
  if (!original) return [];
  const m = (es, e) => (en ? e : es);
  const L = { number: m('número', 'number'), uuid: 'UUID', issue: m('emisión', 'issue date'), due: m('vencimiento', 'due date'), currency: m('moneda', 'currency'), status: m('estatus', 'status'), issuer: m('emisor', 'issuer'), receiver: m('receptor', 'receiver'), subtotal: 'subtotal', taxes: m('impuestos', 'taxes'), total: 'total', terms: m('condiciones', 'terms'), notes: m('observaciones', 'notes') };
  const out = Object.keys(L).filter(k => clean(f[k]) !== clean(original[k])).map(k => L[k]);
  if (f.file) out.push(m('archivo', 'file'));
  return out;
}

/**
 * Safe MIME type to preview a local file in a new tab (blob URLs share the app origin, so HTML/SVG/XHTML must never
 * render): PDF and images keep their type, XML is shown as plain text. Null when the file is not an allowed type.
 */
export function previewType(file) {
  if (!file) return null;
  const ext = String(file.name || '').toLowerCase().split('.').pop();
  const t = String(file.type || '').toLowerCase();
  if (ext === 'pdf' && (!t || t === 'application/pdf')) return 'application/pdf';
  if (ext === 'xml' && (!t || t === 'application/xml' || t === 'text/xml')) return 'text/plain';
  if (ext === 'png' && (!t || t === 'image/png')) return 'image/png';
  if ((ext === 'jpg' || ext === 'jpeg') && (!t || t === 'image/jpeg')) return 'image/jpeg';
  return null;
}

export const fileSize = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
