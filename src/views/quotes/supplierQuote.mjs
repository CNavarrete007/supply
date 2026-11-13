// Cotizaciones › Registro de cotización (oferta del proveedor contra su RFQ) · lógica pura (sin red).
// Captura y cálculo en el navegador con las partidas reales de la RFQ; GUARDAR la cotización es una escritura comercial
// bloqueada hasta su validación integral, por eso aquí no se registra nada.

export const PAYMENT_METHODS = [['PUE', 'PUE - Pago en una sola exhibición', 'PUE - Payment in a single installment'], ['PPD', 'PPD - Pago en parcialidades o diferido', 'PPD - Payment in installments or deferred']];
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

const t = v => String(v ?? '').trim();
const DEC = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const num = v => (t(v) !== '' && DEC.test(t(v)) ? Number(t(v)) : null);
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
/** '3.000000' → '3' */
export const normQty = v => { const s = t(v); return DEC.test(s) && s.includes('.') ? (s.replace(/0+$/, '').replace(/\.$/, '') || '0') : s; };

export function emptyQuote() {
  return { buyer: '', requisition: '', rfq: '', supplier_reference: '', quote_date: '', valid_until: '', vat: '16', currency: 'MXN', lead_days: '', payment: '', technical: '100', documentation: '100', notes: '' };
}
/** Captured fields back to defaults, keeping the buyer / requisition / RFQ selection ("Limpiar"). */
export const clearCapture = f => ({ ...emptyQuote(), buyer: f.buyer, requisition: f.requisition, rfq: f.rfq, currency: f.currency });

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
export function qtyNote(l) { const q = num(l.qty); const r = num(l.requested); if (!l.offered || q === null || r === null || q === r) return ''; return q < r ? 'partial' : 'over'; }

const pct = v => { const n = num(v); return n !== null && n <= 100; };
/** { ok, errors, first } — required (*) fields of the design plus coherent dates, percentages and priced offered lines. */
export function validateQuote(f, lines = [], en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  if (!f.buyer) errors.buyer = m('Selecciona el comprador responsable.', 'Select the responsible buyer.');
  if (!f.requisition) errors.requisition = m('Selecciona la requisición validada.', 'Select the validated requisition.');
  if (!f.rfq) errors.rfq = m('Selecciona la RFQ emitida.', 'Select the issued RFQ.');
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
      if (q === null || q <= 0) errors[`line:${l.key}`] = m(`Partida ${l.line_number}: cantidad cotizada mayor a cero.`, `Item ${l.line_number}: quoted quantity above zero.`);
      else if (p === null) errors[`line:${l.key}`] = m(`Partida ${l.line_number}: captura el precio unitario recibido.`, `Item ${l.line_number}: enter the unit price received.`);
    }
  }
  const first = Object.values(errors)[0] || '';
  return { ok: !first, errors, first };
}

/** First bytes of a PDF ("%PDF-"); the type reported by the browser alone is not trusted. */
export const isPdfHeader = bytes => bytes && bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
