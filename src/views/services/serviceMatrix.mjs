// Servicios Operativos · sección 3 "Matriz de servicios" · lógica pura (sin red).
// Datos: GET /api/v1/services/matrix (servicios de service_orders con tarjetas por cliente y por comprador; el comprador es
// el de la validación interna vigente de la requisición vinculada) y GET /api/v1/services/{id} (expediente para la vista
// "Solicitud"). Editar y eliminar servicios son escrituras sin endpoint: se validan y se informa que no se guardaron.
import { escapeHtml } from '../generalMatrix/model.mjs';
import { PO_FORMAT } from '../purchaseOrders/poPdf.mjs';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = v => ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Service types and statuses of the design (filters); values present in MariaDB are added after them. */
export const SERVICE_TYPES = ['Suministro de agua', 'Transporte', 'Transporte de personal', 'Gestión Rise X', 'Servicio de grúa', 'Montacargas', 'Recarga de gasolina', 'Last Mile Deliveries'];
export const STATUSES = ['Solicitado', 'Programado', 'En ejecución', 'Pendiente de información', 'Pendiente de aprobación', 'Completado', 'Facturado', 'Cancelado'];
export const PAGE_SIZES = [10, 25, 50];
export const mergeOptions = (design = [], db = []) => [...design, ...db.filter(x => clean(x) && !design.some(d => fold(d) === fold(x)))];

export const money = (v, cur = '') => (v === null || v === undefined || v === '' ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ''}`);
export const initials = n => clean(n).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '—';

export const clientsChip = (summary, en = false) => {
  const c = (summary?.clients || []).length; const s = Number(summary?.services) || 0;
  return en ? `${c} client(s) · ${s} service(s)` : `${c} cliente(s) · ${s} servicio(s)`;
};

/** Step 1 cards: one per client with services, buyers, open services and services with evidence. */
export const clientCards = (summary, en = false) => (summary?.clients || []).map(c => ({ id: c.id, badge: initials(c.name), name: clean(c.name).toUpperCase(), sub: clean(c.projects) || '—',
  stats: [[c.services, en ? 'Services' : 'Servicios'], [c.buyers, en ? 'Buyers' : 'Compradores'], [c.open, en ? 'Open' : 'Abiertos']], foot: en ? `${c.with_evidence} with evidence` : `${c.with_evidence} con evidencia` }));

/** Step 2 cards: "Todos los compradores" + one per buyer of the validation of the linked requisition. */
export function buyerCards(summary, clientName = '', en = false) {
  const m = (es, e) => (en ? e : es);
  const b = summary?.buyers || [];
  const total = b.reduce((n, x) => n + x.services, 0);
  return [{ key: 'all', badge: 'TOD', name: m('Todos los compradores', 'All buyers'), sub: clean(clientName).toUpperCase(), stats: [[total, m('Servicios', 'Services')], [b.length, m('Compradores', 'Buyers')], [b.reduce((n, x) => n + x.completed, 0), m('Completados', 'Completed')]], foot: m('Vista general', 'Overview') },
    ...b.map(x => ({ key: x.key, badge: x.key === 'unassigned' ? 'SC' : initials(x.name), name: x.key === 'unassigned' ? m('Sin comprador asignado', 'No buyer assigned') : clean(x.name).toUpperCase(), sub: clean(x.requisitions) || m('Sin requisición vinculada', 'No linked requisition'),
      stats: [[x.services, m('Servicios', 'Services')], [x.open, m('Abiertos', 'Open')], [x.completed, m('Completados', 'Completed')]], foot: m(`${x.types} tipo(s) de servicio`, `${x.types} service type(s)`) }))];
}

const statusTone = s => { const k = fold(s); return /^(completado|facturado|completed|invoiced)$/.test(k) ? 'green' : /cancel/.test(k) ? 'red' : /^pendiente|pending/.test(k) ? 'amber' : /^(solicitado|requested)$/.test(k) ? 'gray' : 'blue'; };

/** Display model of a row (columns of the design). */
export function serviceRow(x, en = false) {
  const m = (es, e) => (en ? e : es);
  const st = clean(x?.status) || '—';
  const cancelled = /cancel/.test(fold(st));
  const billing = clean(x?.invoices) ? { text: m('Facturado', 'Invoiced'), sub: clean(x.invoices), tone: 'green' }
    : cancelled ? { text: m('No aplica', 'Not applicable'), sub: '', tone: 'gray' }
      : x?.is_done || /listo para facturar|ready/.test(fold(st)) ? { text: m('Listo para facturar', 'Ready to invoice'), sub: '', tone: 'green' } : { text: m('Pendiente', 'Pending'), sub: '', tone: 'amber' };
  const po = clean(x?.supplier_po) ? { text: clean(x.supplier_po), sub: clean(x.supplier_name), tone: 'blue' } : x?.requires_supplier ? { text: m('No vinculada', 'Not linked'), sub: '', tone: 'blue' } : { text: m('No requerida', 'Not required'), sub: '', tone: 'gray' };
  const margin = x?.margin === null || x?.margin === undefined ? null : Number(x.margin);
  return {
    id: x?.id, folio: clean(x?.folio), requisition: clean(x?.requisition) || '—', reference: clean(x?.internal_reference) || '—', service: clean(x?.service) || '—', client: clean(x?.client_name).toUpperCase() || '—',
    project: clean(x?.project) || '—', date: clean(x?.date).slice(0, 10) || '—', auth: { text: clean(x?.authorization_type) || m('Sin autorización registrada', 'No authorization recorded'), sub: clean(x?.authorization_reference) },
    po, billing, status: { text: st, tone: statusTone(st) }, qty: `${Number(x?.quantity) || 0} ${clean(x?.unit_label)}`.trim(), cost: money(x?.cost), price: money(x?.price),
    margin: { text: money(margin), tone: margin === null ? 'gray' : margin < 0 ? 'red' : 'green' }, responsible: clean(x?.responsible).toUpperCase() || '—', evidence: Number(x?.evidence_count) || 0,
  };
}

/** Excel/CSV of the filtered services (UTF-8 with BOM for Excel). */
export function servicesCsv(items = [], en = false) {
  const h = en ? ['Folio', 'Requisition', 'Internal reference', 'Service', 'Client', 'Project', 'Date', 'Client authorization', 'Authorization reference', 'Supplier PO', 'Billing', 'Status', 'Quantity', 'Unit', 'Cost', 'Sale', 'Margin', 'Currency', 'Responsible', 'Buyer', 'Evidence']
    : ['Folio', 'Requisición', 'Referencia interna', 'Servicio', 'Cliente', 'Proyecto', 'Fecha', 'Autorización cliente', 'Referencia de autorización', 'OC proveedor', 'Facturación', 'Estatus', 'Cantidad', 'Unidad', 'Costo', 'Venta', 'Margen', 'Moneda', 'Responsable', 'Comprador', 'Evidencias'];
  const q = v => { const s = clean(v); return /[",\n;]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s; };
  const rows = items.map(x => { const v = serviceRow(x, en); return [x.folio, x.requisition, x.internal_reference, x.service, x.client_name, x.project, clean(x.date).slice(0, 10), x.authorization_type, x.authorization_reference,
    x.supplier_po || v.po.text, v.billing.text, x.status, x.quantity, x.unit_label, x.cost, x.price, x.margin, x.currency, x.responsible, x.buyer, x.evidence_count]; });
  return `﻿${[h, ...rows].map(r => r.map(q).join(',')).join('\r\n')}`;
}

/** "Editar": editable fields of a service (the folio, client and requisition are not editable). */
export const editForm = x => ({ status: clean(x?.status), required_date: clean(x?.required_date).slice(0, 10), quantity: x?.quantity === null || x?.quantity === undefined ? '' : String(x.quantity),
  cost: x?.cost === null || x?.cost === undefined ? '' : String(x.cost), price: x?.price === null || x?.price === undefined ? '' : String(x.price), authorization_reference: clean(x?.authorization_reference) });
const EDIT_LABELS = { status: ['estatus', 'status'], required_date: ['fecha requerida', 'required date'], quantity: ['cantidad', 'quantity'], cost: ['costo', 'cost'], price: ['venta', 'sale'], authorization_reference: ['referencia de autorización', 'authorization reference'] };

export function validateEdit(f, x, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = [];
  const num = (k, min, label) => { const raw = clean(f[k]); if (!/^\d{1,14}(\.\d{1,6})?$/.test(raw) || Number(raw) < min || (k === 'quantity' && Number(raw) <= 0)) errors[k] = m(`${label} inválido(a).`, `Invalid ${label}.`); };
  if (!clean(f.status)) errors.status = m('Selecciona el estatus.', 'Select the status.');
  if (clean(f.required_date) && !validDate(f.required_date)) errors.required_date = m('Fecha inválida.', 'Invalid date.');
  num('quantity', 0, m('Cantidad', 'quantity')); num('cost', 0, m('Costo', 'cost')); num('price', 0, m('Venta', 'sale'));
  if (clean(f.authorization_reference).length > 255) errors.authorization_reference = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  const changed = Object.keys(EDIT_LABELS).filter(k => clean(f[k]) !== clean(editForm(x)[k]) && !(['quantity', 'cost', 'price'].includes(k) && Number(f[k]) === Number(editForm(x)[k]) && clean(f[k]) !== ''));
  if (!changed.length) errors.changes = m('Sin cambios por guardar.', 'No changes to save.');
  if (!errors.cost && !errors.price && Number(f.price) < Number(f.cost)) warnings.push(m('La venta es menor al costo: el margen será negativo.', 'The sale is lower than the cost: the margin will be negative.'));
  if (/^facturado$/.test(fold(f.status)) && !clean(x?.invoices)) warnings.push(m('Estatus "Facturado" sin factura registrada para la requisición.', '"Invoiced" status without an invoice recorded for the requisition.'));
  if (/^cancelado$/.test(fold(f.status)) && clean(x?.invoices)) warnings.push(m('Se cancela un servicio cuya requisición ya tiene factura.', 'A service whose requisition already has an invoice is being cancelled.'));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, changed: changed.map(k => EDIT_LABELS[k][en ? 1 : 0]), first: keys.length ? errors[keys[0]] : '' };
}
export const editLockedText = (x, changed, en = false) => (en
  ? `Data validated, but the changes to ${clean(x?.folio)} were not saved (${changed.join(', ')}): editing services is an operational write blocked until authorized.`
  : `Datos validados, pero no se guardaron los cambios de ${clean(x?.folio)} (${changed.join(', ')}): editar servicios es una escritura operativa bloqueada hasta su autorización.`);

/** Why a service cannot be deleted; null when the confirmation dialog applies. */
export function deleteBlock(x, en = false) {
  const m = (es, e) => (en ? e : es);
  if (x?.imported) return m(`No se elimina ${x.folio}: es un servicio importado del sistema original y se conserva como expediente.`, `${x?.folio} is not deleted: it is a service imported from the original system and is kept as a record.`);
  const why = [clean(x?.invoices) && m(`factura ${x.invoices}`, `invoice ${x.invoices}`), clean(x?.supplier_po) && m(`OC de proveedor ${x.supplier_po}`, `supplier PO ${x.supplier_po}`), Number(x?.evidence_count) > 0 && m(`${x.evidence_count} evidencia(s)`, `${x.evidence_count} evidence file(s)`)].filter(Boolean);
  if (why.length) return m(`No se elimina ${x.folio}: tiene ${why.join(', ')} que deben conservarse. Si ya no procede, cámbialo a "Cancelado" con Editar.`, `${x.folio} is not deleted: it has ${why.join(', ')} that must be kept. If it no longer applies, change it to "Cancelled" with Edit.`);
  return null;
}
export function deleteError(x, folio, reason, en = false) {
  const m = (es, e) => (en ? e : es);
  if (clean(folio).toUpperCase() !== clean(x?.folio).toUpperCase()) return m(`Escribe el folio ${x?.folio} para confirmar.`, `Type the folio ${x?.folio} to confirm.`);
  if (clean(reason).length < 10) return m('Indica el motivo de la eliminación (mínimo 10 caracteres).', 'Enter the deletion reason (minimum 10 characters).');
  return '';
}
export const deleteLockedText = (x, en = false) => (en
  ? `Data validated, but ${x?.folio} was not deleted: deleting services is an operational write blocked until authorized.`
  : `Datos validados, pero no se eliminó ${x?.folio}: eliminar servicios es una escritura operativa bloqueada hasta su autorización.`);

export function rangeText(data, en = false) {
  const t = Number(data?.total) || 0; const p = Number(data?.page) || 1; const s = Number(data?.page_size) || 10;
  const a = t ? (p - 1) * s + 1 : 0; const b = Math.min(t, p * s);
  return en ? `${a}-${b} of ${t} records` : `${a}-${b} de ${t} registros`;
}

const humanKey = k => clean(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const scalar = v => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** "Solicitud": printable service request (Grupo Gerez), every value escaped. */
export function serviceRequestHtml(d, en = false, { logoUrl = '/image_923273.svg' } = {}) {
  const x = d?.item || {}; const v = serviceRow(x, en);
  const L = (es, e) => (en ? e : es); const e = escapeHtml;
  const box = (title, pairs) => `<div class="box"><div class="lbl">${e(title)}</div><table class="kv">${pairs.map(([k, val]) => `<tr><th>${e(k)}</th><td>${e(val)}</td></tr>`).join('')}</table></div>`;
  const details = Object.entries(d?.details || {});
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${e(x.folio)}</title><style>
@page { size: letter; margin: 1.2cm; } * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; padding: 24px 30px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 10px; }
.hd { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid #1e385c; }
.brand { display: flex; align-items: center; gap: 10px; } .brand img { width: 44px; height: 44px; } .brand .n { font-size: 16px; font-weight: 900; color: #ea580c; } .brand .t { font-size: 7px; font-weight: 700; color: #64748b; letter-spacing: 1px; }
h1 { margin: 0; font-size: 18px; text-align: center; } .sub { text-align: center; color: #1e385c; font-size: 8.5px; margin-top: 3px; } .meta { text-align: right; font-size: 8.5px; color: #475569; line-height: 1.7; } .meta .f { font-size: 11px; font-weight: 800; color: #1d4ed8; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; } .box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 3px; padding: 9px 11px; }
.lbl { font-size: 8px; font-weight: 800; color: #1e385c; text-transform: uppercase; margin-bottom: 5px; } .kv { width: 100%; border-collapse: collapse; } .kv th { text-align: left; width: 42%; font-weight: 700; color: #475569; padding: 2px 6px 2px 0; vertical-align: top; } .kv td { padding: 2px 0; vertical-align: top; word-break: break-word; }
.full { margin-top: 12px; } .foot { margin-top: 18px; text-align: center; font-size: 7.5px; color: #94a3b8; }
</style></head><body>
<div class="hd"><div class="brand"><img src="${e(logoUrl)}" alt="Grupo Gerez"><div><div class="n">${e(PO_FORMAT.company)}</div><div class="t">${PO_FORMAT.tagline.map(e).join('<br>')}</div></div></div>
<div><h1>${L('SOLICITUD DE SERVICIO', 'SERVICE REQUEST')}</h1><div class="sub">${e(v.service)}</div></div>
<div class="meta"><div class="f">${e(x.folio)}</div><div>${L('Fecha', 'Date')}: ${e(v.date)}</div><div>${L('Estatus', 'Status')}: ${e(v.status.text)}</div></div></div>
<div class="grid">
${box(L('Cliente y requisición', 'Client and requisition'), [[L('Cliente', 'Client'), x.client_name], [L('Proyecto', 'Project'), v.project], [L('Contrato', 'Contract'), scalar(x.contract)], [L('Requisición', 'Requisition'), v.requisition], [L('Referencia interna', 'Internal reference'), v.reference], [L('Comprador', 'Buyer'), scalar(x.buyer)], [L('Responsable', 'Responsible'), scalar(x.responsible)]])}
${box(L('Autorización del cliente', 'Client authorization'), [[L('Tipo', 'Type'), scalar(x.authorization_type)], [L('Estatus', 'Status'), scalar(x.authorization_status)], [L('Referencia', 'Reference'), scalar(x.authorization_reference)], [L('Fecha', 'Date'), scalar(x.authorization_date)], [L('Monto', 'Amount'), x.authorization_amount === null || x.authorization_amount === undefined ? '—' : money(x.authorization_amount, x.authorization_currency)], [L('Vigencia', 'Valid until'), scalar(x.authorization_valid_until)]])}
${box(L('Ejecución', 'Execution'), [[L('Fecha requerida', 'Required date'), scalar(clean(x.required_date).slice(0, 10))], [L('Cantidad', 'Quantity'), v.qty], [L('Proveedor / OC', 'Supplier / PO'), x.supplier_po ? `${x.supplier_po} · ${scalar(x.supplier_name)}` : v.po.text], [L('Evidencias', 'Evidence'), String(v.evidence)]])}
${box(L('Importes', 'Amounts'), [[L('Costo', 'Cost'), money(x.cost, x.currency)], [L('Venta', 'Sale'), money(x.price, x.currency)], [L('Margen', 'Margin'), money(x.margin, x.currency)], [L('Facturación', 'Billing'), `${v.billing.text}${v.billing.sub ? ` (${v.billing.sub})` : ''}`]])}
</div>
<div class="box full"><div class="lbl">${L('Descripción / alcance', 'Description / scope')}</div><div>${e(scalar(x.description))}</div>${clean(x.notes) ? `<div style="margin-top:4px"><strong>${L('Observaciones', 'Notes')}:</strong> ${e(x.notes)}</div>` : ''}</div>
${details.length ? `<div class="box full"><div class="lbl">${L('Datos operativos', 'Operational data')}</div><table class="kv">${details.map(([k, val]) => `<tr><th>${e(humanKey(k))}</th><td>${e(scalar(val))}</td></tr>`).join('')}</table></div>` : ''}
${(d?.files || []).length ? `<div class="box full"><div class="lbl">${L('Evidencias registradas', 'Recorded evidence')}</div>${d.files.map(f => `<div>${e(f.name || '—')} · ${e(f.role || '')}</div>`).join('')}<div style="color:#64748b;margin-top:3px">${L('Los archivos privados no se descargan desde esta vista.', 'Private files are not downloaded from this view.')}</div></div>` : ''}
<div class="foot">${e(PO_FORMAT.company)} · ${e(PO_FORMAT.address)}</div>
</body></html>`;
}
