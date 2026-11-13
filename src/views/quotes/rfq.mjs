// Cotizaciones › Solicitud a proveedores (RFQ) · lógica pura (sin red). La RFQ nunca lleva precios.
// Preparar la solicitud y su vista previa usa datos reales de MariaDB; GUARDAR o ENVIAR la RFQ es una escritura comercial
// que sigue bloqueada hasta su validación integral, por eso el folio que se muestra es solo el previsto.
import { escapeHtml } from '../generalMatrix/model.mjs';

export const RFQ_STATUSES = [['draft', 'Borrador', 'Draft'], ['sent', 'Enviada', 'Sent'], ['answered', 'Respondida', 'Answered'], ['cancelled', 'Cancelada', 'Cancelled'], ['expired', 'Vencida', 'Expired']];
export const CURRENCY_NAMES = { MXN: ['Peso mexicano', 'Mexican peso'], USD: ['Dólar estadounidense', 'US dollar'], EUR: ['Euro', 'Euro'] };
export const DEFAULT_DOCS = ['Ficha técnica, garantía, plazo, impuestos y condiciones comerciales.', 'Technical datasheet, warranty, timeframe, taxes and commercial conditions.'];
export const DEFAULT_CONDITIONS = ['Indicar vigencia, tiempo de entrega, condiciones de pago, impuestos, alcance y exclusiones.', 'Indicate validity, delivery time, payment terms, taxes, scope and exclusions.'];
/** Suppliers that cannot be invited (their status blocks new purchases). */
export const BLOCKED_SUPPLIER = new Set(['suspended', 'inactive']);

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function addDays(day, n) { const [y, m, d] = String(day).split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
export const statusLabel = (code, en = false) => RFQ_STATUSES.find(s => s[0] === code)?.[en ? 2 : 1] ?? String(code || '—');

export function emptyRfq(today, en = false) {
  return {
    buyer: '', requisition: '', supplier: '', issue_date: today, deadline: addDays(today, 5), currency: 'MXN', delivery_place: '', required_date: '',
    contact: '', status: 'draft', docs: DEFAULT_DOCS[en ? 1 : 0], conditions: DEFAULT_CONDITIONS[en ? 1 : 0],
  };
}

/** Next folio RFQ-YYYY-NNNN for the issue-date year (preview only; the server assigns it when an RFQ is saved). */
export function nextRfqFolio(folios = {}, issueDate = '') {
  const y = /^\d{4}/.test(issueDate) ? issueDate.slice(0, 4) : String(new Date().getFullYear());
  return `RFQ-${y}-${String((Number(folios[y]) || 0) + 1).padStart(4, '0')}`;
}

/** "Referencia interna" of the design: internal reference (or folio) · project (or client). */
export const internalReference = req => (req ? [req.internal_reference || req.folio, req.project || req.client_name].filter(Boolean).join(' · ') : '');
export const projectLine = (req, en = false) => (req ? `${internalReference(req)} · ${en ? 'Contract' : 'Contrato'} ${req.contract || 'N/A'}` : '');

/** Fields filled from the selected requisition (delivery place and required date). */
export const fromRequisition = (f, req) => ({ ...f, delivery_place: req?.delivery_place || '', required_date: req?.need_date ? String(req.need_date).slice(0, 10) : '' });
/** Currency taken from the supplier's usual currency (editable afterwards). */
export const currencyFor = supplier => (['MXN', 'USD', 'EUR'].includes(supplier?.currency) ? supplier.currency : 'MXN');

/** { ok, errors, first } — required fields of the design (*) plus date order and invitable supplier. */
export function validateRfq(f, { supplier = null } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  if (!f.buyer) errors.buyer = m('Selecciona el comprador responsable.', 'Select the responsible buyer.');
  if (!f.requisition) errors.requisition = m('Selecciona la requisición validada.', 'Select the validated requisition.');
  if (!f.supplier) errors.supplier = m('Selecciona el proveedor invitado.', 'Select the invited supplier.');
  else if (supplier && BLOCKED_SUPPLIER.has(supplier.status)) errors.supplier = m('El proveedor está suspendido o inactivo; no puede invitarse.', 'The supplier is suspended or inactive; it cannot be invited.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.issue_date || '')) errors.issue_date = m('Indica la fecha de emisión.', 'Enter the issue date.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.deadline || '')) errors.deadline = m('Indica la fecha límite de respuesta.', 'Enter the response deadline.');
  else if (f.issue_date && f.deadline < f.issue_date) errors.deadline = m('La fecha límite no puede ser anterior a la emisión.', 'The deadline cannot be before the issue date.');
  if (!['MXN', 'USD', 'EUR'].includes(f.currency)) errors.currency = m('Selecciona la moneda.', 'Select the currency.');
  if (!f.contact) errors.contact = m('Selecciona el contacto de compras.', 'Select the purchasing contact.');
  if (String(f.docs || '').length > 4000 || String(f.conditions || '').length > 4000) errors.conditions = m('Máximo 4000 caracteres.', 'Max 4000 characters.');
  const first = Object.values(errors)[0] || '';
  return { ok: !first, errors, first };
}

/** Lines already sent to THIS supplier in another RFQ of the requisition (duplicate invitation warning). */
export const sentToSupplier = (item, supplierName) => (item?.sent_to || []).filter(s => supplierName && s.supplier_name === supplierName);

const qty = v => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('es-MX', { maximumFractionDigits: 6 }) : String(v ?? ''));

/** Document model for a NEW RFQ preview from the form and the real requisition/supplier/contact records. */
export function previewDoc({ form, folio, req, items = [], selected = [], supplier, contact }, en = false) {
  const primary = (list, type) => (list || []).filter(c => c.type === type).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.value || '';
  return {
    folio, preview: true, status: statusLabel(form.status, en), issue_date: form.issue_date, deadline: form.deadline, currency: form.currency,
    supplier: { name: supplier?.name || '', code: supplier?.code || '', tax_id: supplier?.tax_id || '', contact: (supplier?.contacts || []).find(c => c.is_primary)?.name || supplier?.contacts?.[0]?.name || '', email: primary(supplier?.channels, 'email'), phone: primary(supplier?.channels, 'phone') },
    contact: { name: contact?.name || '', email: contact?.email || '', phone: contact?.phone || '' },
    project: projectLine(req, en), delivery: [form.delivery_place, form.required_date && `${en ? 'Date' : 'Fecha'} ${form.required_date}`].filter(Boolean).join(' · '),
    docs: form.docs, conditions: form.conditions, requisition: req?.folio || '', client: req?.client_name || '',
    items: items.filter(i => selected.includes(i.id)).map(i => ({ description: i.description, category: i.category, quantity: i.quantity, unit: i.unit })),
  };
}

/** Document model for a REGISTERED RFQ (GET /api/v1/quotes/rfqs/{id}). */
export function registeredDoc(d, en = false) {
  const v = d?.item || {};
  const req = { folio: v.requisition, internal_reference: v.internal_reference, project: v.project, contract: v.contract, client_name: v.client_name };
  return {
    folio: v.folio, preview: false, status: RFQ_STATUSES.some(x => x[0] === v.status) ? statusLabel(v.status, en) : (v.legacy_status || v.status || '—'),
    issue_date: v.request_date, deadline: v.deadline, currency: v.currency,
    supplier: { name: v.supplier_name, code: v.supplier_code, tax_id: v.supplier_tax_id, contact: '', email: '', phone: '' },
    contact: { name: v.contact_name || '', email: v.contact_email || '', phone: v.contact_phone || '' },
    project: projectLine(req, en), delivery: [v.delivery_place, v.required_date && `${en ? 'Date' : 'Fecha'} ${String(v.required_date).slice(0, 10)}`].filter(Boolean).join(' · '),
    docs: v.requested_documents_text || '', conditions: v.terms_text || '', requisition: v.requisition, client: v.client_name,
    items: (d?.items || []).map(i => ({ description: i.description, specification: i.specification, category: i.category, quantity: i.quantity, unit: i.unit_label })),
  };
}

/** "Formato de Solicitud de Cotización" (Grupo Gerez). Every value is escaped; there is never a price column. */
export function rfqDocHtml(doc, en = false) {
  const L = (es, e) => (en ? e : es);
  const e = escapeHtml;
  const rows = (doc.items || []).map((i, n) => `<tr><td class="n">${n + 1}</td><td><strong>${e(i.description)}</strong>${i.specification ? `<br><small>${e(i.specification)}</small>` : ''}${i.category ? `<br><small class="cat">${e(i.category)}</small>` : ''}</td><td class="c">${e(qty(i.quantity))}</td><td class="c">${e(i.unit)}</td></tr>`).join('');
  const box = (t, v) => `<div class="blk"><h6>${e(t)}</h6><p>${e(v || '—')}</p></div>`;
  const sup = doc.supplier || {}; const ct = doc.contact || {};
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${e(doc.folio || 'RFQ')}</title><style>
@page { size: letter; margin: 1.2cm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; } body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 18px; position: relative; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; } .logo { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; } .logo b { color: #d97706; font-size: 13px; display: block; } .logo small { font-size: 7px; color: #64748b; text-transform: uppercase; }
.title { text-align: center; } .title h1 { margin: 0; font-size: 20px; letter-spacing: .5px; } .title p { margin: 2px 0 0; font-size: 9px; color: #94a3b8; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
.meta { text-align: right; } .meta .st { display: inline-block; color: #2563eb; font-weight: 900; font-size: 13px; border-bottom: 2px solid #2563eb; text-transform: uppercase; margin-bottom: 4px; } .meta div { color: #475569; }
.bar { height: 4px; background: #2563eb; border-radius: 4px; margin: 12px 0; } .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px; } .card h5 { margin: 0 0 4px; color: #2563eb; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; } .card p { margin: 1px 0; } .muted { color: #64748b; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; border-radius: 10px; overflow: hidden; } th { background: #1d3557; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; text-align: left; padding: 7px 10px; } td { border-bottom: 1px solid #e2e8f0; padding: 7px 10px; vertical-align: top; } td.c, th.c { text-align: center; } td.n { color: #64748b; font-weight: bold; width: 40px; } small { color: #64748b; } small.cat { color: #2563eb; }
.blk { background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; padding: 8px 10px; } .blk h6 { margin: 0 0 2px; font-size: 10px; } .blk p { margin: 0; color: #475569; }
.foot { text-align: center; color: #94a3b8; font-size: 9px; margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0; } .nop { text-align: center; color: #94a3b8; padding: 18px; }
.wm { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 900; color: rgba(37,99,235,.08); transform: rotate(-18deg); pointer-events: none; }
.pv { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 10px; }
</style></head><body>
${doc.preview ? `<div class="wm">${L('VISTA PREVIA · NO REGISTRADA', 'PREVIEW · NOT REGISTERED')}</div><div class="pv">${L('Vista previa generada desde MariaDB. La RFQ aún no está registrada: el folio es el previsto y se confirma al guardar.', 'Preview generated from MariaDB. The RFQ is not registered yet: the folio is the expected one and is confirmed when saved.')}</div>` : ''}
<div class="top"><div class="logo"><b>GRUPO GEREZ</b><small>Customs &amp; Logistics Worldwide</small></div>
<div class="title"><h1>${L('SOLICITUD DE COTIZACIÓN', 'REQUEST FOR QUOTATION')}</h1><p>${L('Solicitud de cotización a proveedor', 'Request for quotation from supplier')}</p></div>
<div class="meta"><span class="st">${e(doc.status)}</span><div><strong>${L('Folio', 'Folio')}:</strong> ${e(doc.folio || '—')}</div><div><strong>${L('Fecha', 'Date')}:</strong> ${e(doc.issue_date || '—')}</div><div><strong>${L('Responder antes de', 'Reply before')}:</strong> ${e(doc.deadline || '—')}</div><div><strong>${L('Moneda', 'Currency')}:</strong> ${e(doc.currency || '—')}</div></div></div>
<div class="bar"></div>
<div class="grid"><div class="card"><h5>${L('Proveedor invitado', 'Invited supplier')}</h5><p><strong>${e(sup.name || '—')}</strong></p>${sup.code ? `<p class="muted">${L('No. proveedor', 'Supplier no.')} ${e(sup.code)}${sup.tax_id ? ` · RFC ${e(sup.tax_id)}` : ''}</p>` : ''}${sup.contact ? `<p>${e(sup.contact)}</p>` : ''}${sup.email ? `<p class="muted">${e(sup.email)}</p>` : ''}${sup.phone ? `<p class="muted">${e(sup.phone)}</p>` : ''}</div>
<div class="card"><h5>${L('Solicita', 'Requested by')}</h5><p><strong>GRUPO GEREZ S.A. DE C.V.</strong></p><p>${e(ct.name || '—')}</p>${ct.email ? `<p class="muted">${e(ct.email)}</p>` : ''}${ct.phone ? `<p class="muted">${e(ct.phone)}</p>` : ''}</div></div>
<table><thead><tr><th>${L('Artículo', 'Item')}</th><th>${L('Descripción / especificación', 'Description / specification')}</th><th class="c">${L('Cantidad', 'Quantity')}</th><th class="c">${L('Unidad', 'Unit')}</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="nop">${L('No hay partidas seleccionadas para incluir en esta RFQ.', 'There are no items selected for this RFQ.')}</td></tr>`}</tbody></table>
<div class="grid">${box(L('Requisición / proyecto', 'Requisition / project'), doc.project)}${box(L('Entrega requerida', 'Required delivery'), doc.delivery)}${box(L('Documentación solicitada', 'Requested documentation'), doc.docs)}${box(L('Condiciones', 'Conditions'), doc.conditions)}</div>
<div class="foot">${L('Favor de referenciar', 'Please reference')} <strong>${e(doc.folio || '—')}</strong> ${L('en su propuesta · Esta solicitud no incluye precios: el proveedor los indica en su cotización.', 'in your proposal · This request has no prices: the supplier states them in its quote.')}</div>
</body></html>`;
}
