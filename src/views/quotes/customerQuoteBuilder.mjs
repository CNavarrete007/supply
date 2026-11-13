// Cotizaciones › Cotización formal al cliente · lógica pura (sin red).
// Costos de la adjudicación o de la mejor oferta, convertidos a la moneda del cliente; precio de venta por partida con
// entrega/manipulación y % de margen; descuento, IVA, Service Fee y nivel de aprobación según la política vigente.
// Los costos internos nunca salen en el formato del cliente. GUARDAR/EMITIR es una escritura comercial bloqueada.

export const CQ_STATUSES = [['Borrador', 'Draft'], ['En revisión interna', 'Under internal review'], ['Pendiente de autorización', 'Pending authorization'], ['Enviada al cliente', 'Sent to the client'],
  ['Aprobada', 'Approved'], ['Rechazada', 'Rejected'], ['Solicitud de modificación', 'Change request'], ['Sustituida', 'Superseded'], ['Vencida', 'Expired']];
export const CURRENCIES = [['MXN', 'Peso mexicano', 'Mexican peso'], ['USD', 'Dólar estadounidense', 'US dollar'], ['EUR', 'Euro', 'Euro']];
export const DEFAULT_PDF_NOTES = ['Precios expresados en la moneda indicada. Vigencia sujeta a disponibilidad del proveedor al momento de la orden.', 'Prices in the indicated currency. Validity subject to supplier availability at the time of the order.'];

const t = v => String(v ?? '').trim();
const DEC = /^-?(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;
const num = v => (t(v) !== '' && DEC.test(t(v)) ? Number(t(v)) : null);
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const pos = v => num(v) !== null && num(v) > 0;
const pct = v => num(v) !== null && num(v) >= 0 && num(v) <= 100;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function addDays(day, n) { const [y, m, d] = String(day).split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
export const normQty = v => { const s = t(v); return /^\d+\.\d+$/.test(s) ? (s.replace(/0+$/, '').replace(/\.$/, '') || '0') : s; };

export function emptyCq(today) {
  return { buyer: '', requisition: '', revision: '0', issue_date: today, valid_until: addDays(today, 30), currency: 'MXN', status: 'Borrador', preparer: '', lead_time: '', delivery_place: '',
    payment_terms: '', warranty: '', inclusions: '', exclusions: '', notes: '', fx_date: today, usd_mxn: '1', eur_mxn: '1', fx_source: 'Manual', discount: '0', vat: '16',
    sf_enabled: true, sf_pct: '0.00', sf_comments: '' };
}

/** MXN per 1 unit of the currency. */
export function rate(cur, f) { if (cur === 'USD') return num(f.usd_mxn); if (cur === 'EUR') return num(f.eur_mxn); return cur === 'MXN' ? 1 : null; }
/** Converts an amount between MXN/USD/EUR through MXN; null when a needed rate is missing. */
export function convert(amount, from, to, f) {
  const a = num(amount); if (a === null) return null; if (from === to) return a;
  const rf = rate(from, f); const rt = rate(to, f); return rf && rt ? (a * rf) / rt : null;
}

/** Lines from GET /api/v1/quotes/comparison?requisition=: cost of the current award, else the best offer, else none. */
export function linesFromComparison(lines = []) {
  return lines.filter(l => !l.line_status || l.line_status === 'active').map(l => {
    const offers = (l.offers || []).filter(o => o.offered && num(o.unit_price) !== null);
    const best = [...offers].sort((a, b) => num(a.unit_price) - num(b.unit_price))[0];
    const src = l.award ? { source: 'award', qty: l.award.quantity, cost: l.award.unit_price, currency: l.award.currency, supplier: l.award.supplier_name }
      : best ? { source: 'offer', qty: l.quantity, cost: best.unit_price, currency: best.currency, supplier: best.supplier_name } : { source: 'none', qty: l.quantity, cost: '', currency: '', supplier: '' };
    return { key: l.id, line_number: l.line_number, description: l.description, brand_model: '', unit: l.unit_label, category: l.category || '', qty: normQty(src.qty), cost_unit: src.cost === '' ? '' : String(Number(src.cost)),
      cost_currency: src.currency, supplier: src.supplier, source: src.source, handling: '0', margin: '' };
  });
}

/** Price of one line in the quote currency: unit = (cost × qty + handling) × (1 + margin %) ÷ qty; subtotal = unit × qty. */
export function priceLine(l, f) {
  const q = num(l.qty); const cu = convert(l.cost_unit, l.cost_currency || f.currency, f.currency, f); const h = num(l.handling) ?? 0; const m = num(l.margin) ?? 0;
  if (!q || q <= 0 || cu === null) return { cost: cu, unit: null, subtotal: 0 };
  const unit = r2(((cu * q + h) * (1 + m / 100)) / q);
  return { cost: cu, unit, subtotal: r2(unit * q) };
}

/** Third-party subtotal, discount, IVA, Service Fee and grand total. */
export function cqTotals(lines = [], f) {
  const third = r2(lines.reduce((s, l) => s + priceLine(l, f).subtotal, 0));
  const discount = r2(third * (num(f.discount) ?? 0) / 100); const taxable = r2(third - discount); const vat = num(f.vat) ?? 0;
  const tax = r2(taxable * vat / 100); const thirdTotal = r2(taxable + tax);
  const sfOn = Boolean(f.sf_enabled); const sfUnit = sfOn ? r2(taxable * (num(f.sf_pct) ?? 0) / 100) : 0; const sfTax = r2(sfUnit * vat / 100); const sfTotal = r2(sfUnit + sfTax);
  return { third, discount, taxable, tax, thirdTotal, sfBase: sfOn ? taxable : 0, sfUnit, sfSubtotal: sfUnit, sfTax, sfTotal, subtotal: r2(taxable + sfUnit), total: r2(thirdTotal + sfTotal) };
}

/**
 * Approval level from the enabled policy (approval_policy_versions): highest unit sale price and the evaluated subtotal
 * (total_basis "total" = grand total; otherwise subtotal before IVA) converted to the policy currency.
 * Within both limits → "Nivel 1 · Solo Comprador"; otherwise additional internal authorization is required.
 */
export function approvalLevel(policy, lines, f, totals) {
  if (!policy) return { status: 'no_policy' };
  const pc = policy.currency || 'MXN';
  const units = lines.map(l => priceLine(l, f).unit).filter(u => u !== null);
  const maxUnit = units.length ? convert(Math.max(...units), f.currency, pc, f) : 0;
  const evaluated = convert(String(t(policy.total_basis).toLowerCase() === 'total' ? totals.total : totals.subtotal), f.currency, pc, f);
  if (maxUnit === null || evaluated === null) return { status: 'no_rate', currency: pc };
  const over = (v, lim) => num(lim) !== null && (policy.comparison_operator === '>=' ? v >= num(lim) : v > num(lim));
  const unitOver = over(maxUnit, policy.unit_price_limit); const docOver = over(evaluated, policy.document_limit);
  return { status: unitOver || docOver ? 'exceeds' : 'within', level: unitOver || docOver ? null : 1, maxUnit: r2(maxUnit), evaluated: r2(evaluated), unitLimit: num(policy.unit_price_limit), docLimit: num(policy.document_limit), currency: pc, unitOver, docOver };
}

/** { ok, errors, first } — required (*) fields, dates, rates and priced lines. */
export function validateCq(f, lines = [], en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  if (!f.buyer) errors.buyer = m('Selecciona el comprador responsable.', 'Select the responsible buyer.');
  if (!f.requisition) errors.requisition = m('Selecciona la requisición del cliente.', 'Select the client requisition.');
  if (!/^\d{1,3}$/.test(t(f.revision))) errors.revision = m('Revisión: entero 0–999.', 'Revision: integer 0–999.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.issue_date || '')) errors.issue_date = m('Indica la fecha de emisión.', 'Enter the issue date.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.valid_until || '')) errors.valid_until = m('Indica la vigencia.', 'Enter the validity date.');
  else if (f.issue_date && f.valid_until < f.issue_date) errors.valid_until = m('La vigencia no puede ser anterior a la emisión.', 'Validity cannot be before the issue date.');
  if (!CURRENCIES.some(c => c[0] === f.currency)) errors.currency = m('Selecciona la moneda de cotización.', 'Select the quote currency.');
  if (!f.preparer) errors.preparer = m('Selecciona el comprador que elabora la cotización.', 'Select the buyer preparing the quote.');
  const needs = new Set([f.currency, ...lines.map(l => l.cost_currency).filter(Boolean)]);
  if (needs.has('USD') && !pos(f.usd_mxn)) errors.usd_mxn = m('Captura el tipo de cambio USD.', 'Enter the USD exchange rate.');
  if (needs.has('EUR') && !pos(f.eur_mxn)) errors.eur_mxn = m('Captura el tipo de cambio EUR.', 'Enter the EUR exchange rate.');
  if (!pct(f.discount)) errors.discount = m('Descuento entre 0 y 100.', 'Discount between 0 and 100.');
  if (!pct(f.vat)) errors.vat = m('IVA entre 0 y 100.', 'VAT between 0 and 100.');
  if (f.sf_enabled && !pct(f.sf_pct)) errors.sf_pct = m('Service Fee entre 0 y 100.', 'Service Fee between 0 and 100.');
  if (f.requisition && !lines.length) errors.lines = m('La requisición no tiene partidas vigentes.', 'The requisition has no active items.');
  for (const l of lines) {
    let e = '';
    if (l.source === 'none' || num(l.cost_unit) === null) e = m(`Partida ${l.line_number}: sin costo; registra una cotización del proveedor.`, `Item ${l.line_number}: no cost; record a supplier quote.`);
    else if (!pos(l.qty)) e = m(`Partida ${l.line_number}: cantidad mayor a cero.`, `Item ${l.line_number}: quantity above zero.`);
    else if (num(l.handling) === null || num(l.handling) < 0) e = m(`Partida ${l.line_number}: entrega / manipulación inválida.`, `Item ${l.line_number}: invalid delivery / handling.`);
    else if (t(l.margin) === '' || num(l.margin) === null || num(l.margin) < 0 || num(l.margin) > 1000) e = m(`Partida ${l.line_number}: captura el % de margen (0–1000).`, `Item ${l.line_number}: enter the margin % (0–1000).`);
    else if (priceLine(l, f).unit === null) e = m(`Partida ${l.line_number}: falta el tipo de cambio de ${l.cost_currency}.`, `Item ${l.line_number}: missing ${l.cost_currency} exchange rate.`);
    if (e) errors[`line:${l.key}`] = e;
  }
  const first = Object.values(errors)[0] || '';
  return { ok: !first, errors, first };
}

/** Client-facing document data for customerQuoteHtml (no internal cost, handling or margin). */
export function previewData({ form, lines, totals, req, preparerName, preparerPosition = '', issuer = null, en = false }) {
  return {
    issuer,
    item: { folio: en ? 'To be assigned' : 'Por asignar', version_number: (num(form.revision) ?? 0) + 1, revision: num(form.revision) ?? 0, quote_date: form.issue_date, valid_until: form.valid_until, currency: form.currency,
      client_name: req?.client_name || '', client_tax_id: req?.client_tax_id || '', requisition: req?.folio || '', client_reference: req?.internal_reference || req?.folio || '', project: req?.project || '', contract: req?.contract || '',
      subtotal_amount: totals.taxable + totals.discount, discount_amount: totals.discount, tax_rate_pct: num(form.vat), third_party_taxable_amount: totals.taxable, third_party_tax_amount: totals.tax, third_party_total_amount: totals.thirdTotal,
      tax_amount: r2(totals.tax + totals.sfTax), service_fee_enabled: Boolean(form.sf_enabled) && totals.sfSubtotal > 0, service_fee_rate_pct: num(form.sf_pct), service_fee_subtotal_amount: totals.sfSubtotal, service_fee_tax_amount: totals.sfTax, service_fee_total_amount: totals.sfSubtotal, total_amount: totals.total,
      prepared_by_position: preparerPosition, internal_approval_status: 'pending',
      delivery_place: form.delivery_place, lead_time_text: form.lead_time, payment_terms: form.payment_terms, warranty_text: form.warranty, inclusions_text: form.inclusions, exclusions_text: form.exclusions,
      notes: t(form.notes) || DEFAULT_PDF_NOTES[en ? 1 : 0], prepared_by: preparerName || '', reviewed_by: '', approved_by: '' },
    items: lines.map(l => { const p = priceLine(l, form); return { line_number: l.line_number, description: l.description, brand_model: t(l.brand_model), quantity: l.qty, unit_label: l.unit, unit_price: p.unit, line_subtotal: p.subtotal }; }),
  };
}
