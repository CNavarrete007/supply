// Cotizaciones › Cotización formal al cliente · lógica pura (sin red).
// Costos de la adjudicación o de la mejor oferta, convertidos a la moneda del cliente; precio de venta por partida con
// entrega/manipulación y % de margen; descuento, IVA, Service Fee y nivel de aprobación según la política vigente.
// Los costos internos nunca salen en el formato del cliente. «Guardar» la registra como BORRADOR INTERNO en MariaDB (el
// servidor toma el costo de la adjudicación u oferta registrada y recalcula todo); emitir, autorizar y enviar siguen bloqueados.
import { label } from './model.mjs';

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
/**
 * Mejor oferta registrada de una partida: el menor precio unitario. Si las ofertas vienen en monedas distintas se comparan
 * convertidas a MXN con los tipos de cambio de la tarjeta (antes se comparaba el número sin moneda: 70 USD «ganaba» a
 * 1,200 MXN). Una oferta en una moneda sin tipo de cambio válido no se puede comparar y queda fuera.
 */
export function bestOffer(offers = [], rates = null) {
  const same = new Set(offers.map(o => o.currency || '')).size <= 1;
  const mxn = o => { const r = !o.currency || o.currency === 'MXN' ? 1 : o.currency === 'USD' ? num(rates?.usd_mxn) : o.currency === 'EUR' ? num(rates?.eur_mxn) : null; return r && r > 0 ? num(o.unit_price) * r : null; };
  return offers.map(o => ({ o, v: same ? num(o.unit_price) : mxn(o) })).filter(x => x.v !== null).sort((a, b) => a.v - b.v)[0]?.o;
}

/** Partidas vigentes con su costo: adjudicación vigente o, si no hay, la mejor oferta (`rates`: { usd_mxn, eur_mxn }). */
export function linesFromComparison(lines = [], rates = null) {
  return lines.filter(l => !l.line_status || l.line_status === 'active').map(l => {
    const offers = (l.offers || []).filter(o => o.offered && num(o.unit_price) !== null);
    const best = bestOffer(offers, rates);
    const src = l.award ? { source: 'award', qty: l.award.quantity, cost: l.award.unit_price, currency: l.award.currency, supplier: l.award.supplier_name, quote_id: l.award.quote_id || '' }
      : best ? { source: 'offer', qty: l.quantity, cost: best.unit_price, currency: best.currency, supplier: best.supplier_name, quote_id: best.quote_id || '' } : { source: 'none', qty: l.quantity, cost: '', currency: '', supplier: '', quote_id: '' };
    return { key: l.id, line_number: l.line_number, description: l.description, brand_model: '', unit: l.unit_label, category: l.category || '', qty: normQty(src.qty), cost_unit: src.cost === '' ? '' : String(Number(src.cost)),
      cost_currency: src.currency, supplier: src.supplier, source: src.source, quote_id: src.quote_id, handling: '0', margin: '' };
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

// ---- Borrador interno en MariaDB (POST/PUT /api/v1/quotes/customer-quotes) ----
/** Único estatus que se guarda desde la tarjeta: enviar a revisión, autorizar y enviar al cliente siguen bloqueados. */
export const CQ_SAVE_STATUS = 'Borrador';

/** Body: the server takes each cost from the award/registered offer and recomputes prices and totals (none are sent). */
export function cqPayload(f, lines = [], edit = false) {
  const needs = new Set([f.currency, ...lines.map(l => l.cost_currency).filter(Boolean)]);
  const p = { issue_date: f.issue_date, valid_until: f.valid_until, currency: f.currency, preparer_id: f.preparer, lead_time: t(f.lead_time), delivery_place: t(f.delivery_place),
    payment_terms: t(f.payment_terms), warranty: t(f.warranty), inclusions: t(f.inclusions), exclusions: t(f.exclusions), notes: t(f.notes), fx_date: f.fx_date || null,
    usd_mxn: needs.has('USD') ? t(f.usd_mxn) : null, eur_mxn: needs.has('EUR') ? t(f.eur_mxn) : null, fx_source: t(f.fx_source), discount: t(f.discount), vat: t(f.vat),
    sf_enabled: Boolean(f.sf_enabled), sf_pct: f.sf_enabled ? t(f.sf_pct) : '0', sf_comments: f.sf_enabled ? t(f.sf_comments) : '',
    lines: lines.map(l => ({ line_id: l.key, source: l.source, quote_id: l.quote_id, qty: t(l.qty), handling: t(l.handling), margin: t(l.margin), brand_model: t(l.brand_model) })) };
  return edit ? p : { requisition_id: f.requisition, ...p };
}

/** Form and lines of a registered draft (GET …/customer-quotes/{id}/draft) over the current lines of the comparison. */
export function cqFromDraft(draft, compLines = [], f = {}) {
  const d = draft?.item || {}; const byLine = Object.fromEntries((draft?.items || []).map(i => [i.line_id, i]));
  const n = v => (v === null || v === undefined || v === '' ? '' : normQty(String(v)));
  const form = { ...f, requisition: d.requisition_id || f.requisition, revision: String(d.revision ?? 0), issue_date: String(d.quote_date || '').slice(0, 10), valid_until: String(d.valid_until || '').slice(0, 10),
    currency: d.currency || f.currency, status: CQ_SAVE_STATUS, preparer: d.preparer_id || '', lead_time: d.lead_time_text || '', delivery_place: d.delivery_place || '', payment_terms: d.payment_terms || '',
    warranty: d.warranty_text || '', inclusions: d.inclusions_text || '', exclusions: d.exclusions_text || '', notes: d.notes || '', fx_date: String(d.exchange_rate_date || f.fx_date || '').slice(0, 10),
    usd_mxn: d.usd_mxn_rate ? n(d.usd_mxn_rate) : (f.usd_mxn || '1'), eur_mxn: d.eur_mxn_rate ? n(d.eur_mxn_rate) : (f.eur_mxn || '1'), fx_source: d.exchange_rate_source || '',
    discount: n(d.discount_rate_pct) || '0', vat: n(d.tax_rate_pct) || '0', sf_enabled: Boolean(d.service_fee_enabled), sf_pct: n(d.service_fee_rate_pct) || '0.00', sf_comments: d.service_fee_comments || '' };
  const lines = compLines.map(l => { const i = byLine[l.key]; return i ? { ...l, brand_model: i.brand_model || '', qty: n(i.quantity) || l.qty, handling: n(i.handling) || '0', margin: n(i.margin) } : l; });
  return { form, lines };
}

/**
 * Why the requisition cannot get a new draft here ('' = it can): it already has a client quote that is not a SupplyFlow draft.
 * Decisión del usuario (27 nov 2026): las existentes pasan por «Solicitar modificación» (R3A). R3A solo aplica a requisiciones
 * capturadas en SupplyFlow; una cotización importada (incluidas las que siguen en «Borrador») se conserva en consulta.
 */
export function cqExistingBlock(prior, en = false) {
  if (!prior || prior.editable_draft) return '';
  const m = (es, e) => (en ? e : es);
  const q = `${t(prior.folio)} (Rev. ${prior.revision} · ${t(prior.legacy_status) || t(prior.document_status)})`;
  if (prior.imported) {
    return m(`La requisición ya tiene la cotización ${q}, importada del sistema original: se conserva como expediente en consulta y no se crea otra. «Solicitar modificación» solo aplica a requisiciones capturadas en SupplyFlow; para continuar este proceso, captura la requisición en «Registro de requisición» y sigue el flujo (validación, RFQ y cotizaciones) hasta esta tarjeta.`,
      `The requisition already has quote ${q}, imported from the original system: it is kept as a read-only record and no other is created. "Request modification" only applies to requisitions captured in SupplyFlow; to continue this process, capture the requisition in "Requisition record" and follow the flow (validation, RFQ and quotes) up to this card.`);
  }
  return m(`La requisición ya tiene la cotización ${q}. No se crea otra: una nueva revisión se origina con «Solicitar modificación» (tarjetas 1 u 8).`,
    `The requisition already has quote ${q}. No other is created: a new revision starts with "Request modification" (cards 1 or 8).`);
}

/**
 * Opción del selector de requisiciones (GET …/rfq-requisitions?rfq=quoted): qué pasará al guardar, antes de elegirla.
 * { label, kind: new|draft|locked|uncosted }. Todas se pueden elegir (27 nov 2026, a petición del usuario): la que ya tiene
 * cotización importada/enviada se abre solo para consulta (aviso de bloqueo y Guardar deshabilitado; no se crea otra).
 */
export function cqReqOption(r, en = false) {
  const m = (es, e) => (en ? e : es);
  const base = `${t(r?.folio)} - ${t(r?.client_name)}`;
  const q = r?.customer_quote;
  if (q && !q.editable_draft) {
    const st = label(t(q.status), en);
    return { label: `${base} · ${m(`ya tiene ${t(q.folio)}${q.imported ? ' (importada, solo consulta)' : ` (${st}, solo consulta)`}`, `already has ${t(q.folio)}${q.imported ? ' (imported, read-only)' : ` (${st}, read-only)`}`)}`, kind: 'locked' };
  }
  if (q) return { label: `${base} · ${m(`borrador ${t(q.folio)} (editar)`, `draft ${t(q.folio)} (edit)`)}`, kind: 'draft' };
  if (Number(r?.unquoted_items) > 0) return { label: `${base} · ${m(`${r.unquoted_items} partida(s) sin costo`, `${r.unquoted_items} item(s) without cost`)}`, kind: 'uncosted' };
  return { label: base, kind: 'new' };
}

/** Resumen bajo el selector: cuántas se pueden guardar y por qué no las demás. */
export function cqReqSummary(items = [], total = 0, en = false) {
  const m = (es, e) => (en ? e : es);
  const k = items.map(r => cqReqOption(r, en).kind); const n = x => k.filter(y => y === x).length;
  const parts = [m(`${n('new') + n('draft')} se pueden guardar`, `${n('new') + n('draft')} can be saved`)];
  if (n('draft')) parts.push(m(`${n('draft')} con borrador para editar`, `${n('draft')} with a draft to edit`));
  if (n('uncosted')) parts.push(m(`${n('uncosted')} con partidas sin costo (registra la cotización del proveedor en la tarjeta 4)`, `${n('uncosted')} with items without cost (record the supplier quote in card 4)`));
  if (n('locked')) parts.push(m(`${n('locked')} ya tienen cotización al cliente (se abren solo para consulta)`, `${n('locked')} already have a client quote (read-only)`));
  return m(`${total} requisición(es) con cotizaciones de proveedor: ${parts.join('; ')}.`, `${total} requisition(s) with supplier quotes: ${parts.join('; ')}.`);
}

export function cqSavedText(out, en = false) {
  const m = (es, e) => (en ? e : es);
  const total = Number(out?.total || 0).toLocaleString(en ? 'en-US' : 'es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return out?.version > 1
    ? m(`Borrador ${t(out.folio)} (Rev. ${out.revision}) actualizado en MariaDB: total $${total} ${out.currency}; versión ${out.version}. Sigue como borrador interno: no se envió a revisión ni al cliente.`, `Draft ${t(out.folio)} updated in MariaDB: total $${total} ${out.currency}; version ${out.version}. Still an internal draft.`)
    : m(`Cotización al cliente ${t(out?.folio)} (Rev. ${out?.revision ?? 0}) guardada en MariaDB como borrador interno: ${out?.lines} partida(s), total $${total} ${out?.currency}. No se envió a revisión ni al cliente.`, `Client quote ${t(out?.folio)} saved to MariaDB as an internal draft: ${out?.lines} item(s), total $${total} ${out?.currency}. Not sent for review nor to the client.`);
}

const CQ_FIELD = { requisition_id: 'requisition', preparer_id: 'preparer', issue_date: 'issue_date', valid_until: 'valid_until', currency: 'currency', discount: 'discount', vat: 'vat', sf_pct: 'sf_pct', usd_mxn: 'usd_mxn', eur_mxn: 'eur_mxn' };
const CQ_BLOCKING = ['QUOTE_WRITE_NOT_PROVISIONED', 'QUOTE_WRITE_ACCOUNT_REJECTED', 'QUOTE_WRITE_GRANTS_INCOMPLETE'];
/** Server error → { kind: error|warn, text, field (form key or line:<id>), retry (reuse the Idempotency-Key) }. */
export function cqSaveError(status, body, en = false) {
  const m = (es, e) => (en ? e : es);
  const code = body?.error?.code; const message = body?.error?.message; const raw = body?.error?.field || '';
  const field = /^line:/.test(raw) ? raw : CQ_FIELD[raw] || null;
  if (!status) return { kind: 'error', text: m('No se confirmó el guardado (sin respuesta del servidor). Presiona Guardar otra vez: se repite la misma operación sin duplicarla.', 'The save was not confirmed. Press Save again: the same operation is repeated without duplicating it.'), retry: true };
  if (status === 401) return { kind: 'error', text: m('Tu sesión expiró. Inicia sesión nuevamente; no se guardó nada.', 'Your session expired; nothing was saved.') };
  if (status === 403) return { kind: 'error', text: code === 'CSRF_INVALID' ? m('La sesión de seguridad cambió. Vuelve a intentarlo.', 'The security token changed. Try again.') : m('Solo un Master Admin puede guardar cotizaciones al cliente.', 'Only a Master Admin can save client quotes.') };
  if (CQ_BLOCKING.includes(code)) return { kind: 'warn', text: `${message || m('El guardado de Cotizaciones no está habilitado en este equipo.', 'Saving quotes is not enabled on this computer.')} ${m('Consulta «Activación en la PC» en docs/cotizaciones/REGISTRO_COTIZACION_PROVEEDOR.md.', 'See "Activación en la PC" in docs/cotizaciones/REGISTRO_COTIZACION_PROVEEDOR.md.')}` };
  if (status === 412) return { kind: 'warn', text: m('Otra sesión modificó este borrador desde que se abrió; no se guardó tu cambio. Se cargó la versión vigente: revisa los datos y vuelve a guardar.', 'Another session changed this draft since it was opened; your change was not saved. The current version was loaded: review it and save again.') };
  if (status === 422) return { kind: 'error', text: code === 'INVALID_CUSTOMER_QUOTE' ? m('Revisa el campo o la partida marcada: el servidor no lo aceptó.', 'Check the highlighted field or item: the server did not accept it.') : message || m('Revisa los datos capturados.', 'Check the entered data.'), field };
  if (status === 404 || status === 409) return { kind: 'error', text: message || m('No se pudo guardar.', 'Could not save.'), field };
  return { kind: 'error', text: m(`No se confirmó el guardado (${message || 'error del servidor'}). Presiona Guardar otra vez: se repite la misma operación sin duplicarla.`, `The save was not confirmed (${message || 'server error'}). Press Save again.`), retry: true };
}
