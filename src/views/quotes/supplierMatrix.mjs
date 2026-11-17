// Tarjeta 11 · Matriz interna de proveedores (matriz de cotizaciones) · lógica pura (sin red).
// Uso interno: muestra costos de proveedor; nunca se comparte con el cliente. Editar, adjudicar desde aquí y eliminar
// son escrituras comerciales bloqueadas: ADJUDICAR abre el comparativo (tarjeta 5) y EDITAR muestra el detalle.
import { label, money } from './model.mjs';
import { escapeHtml } from '../generalMatrix/model.mjs';
import { initials } from './cqMatrix.mjs';
import { scoreQuotes } from './comparison.mjs';

const clean = v => String(v ?? '').trim();
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** "Todas las cotizaciones" (Cotizaciones / Adjudicadas / Sin adjudicar) + una por proveedor (… / Activas). */
export function supplierCards(suppliers = [], en = false) {
  const m = (es, e) => (en ? e : es);
  const sum = k => suppliers.reduce((a, s) => a + (Number(s[k]) || 0), 0);
  return [{ id: 'all', name: m('Todas las cotizaciones', 'All quotes'), subtitle: m('Vista general', 'Overview'), tag: m('TOD', 'ALL'), isAll: true,
    boxes: [[sum('total'), m('Cotizaciones', 'Quotes')], [sum('awarded'), m('Adjudicadas', 'Awarded')], [sum('active'), m('Sin adjudicar', 'Not awarded')]], total: sum('total'), footer: m('Abrir todas', 'Open all') },
  ...suppliers.map(s => ({ id: s.id, name: s.name, subtitle: m('Proveedor', 'Supplier'), tag: initials(s.name), isAll: false, total: Number(s.total) || 0,
    boxes: [[Number(s.total) || 0, m('Cotizaciones', 'Quotes')], [Number(s.awarded) || 0, m('Adjudicadas', 'Awarded')], [Number(s.active) || 0, m('Activas', 'Active')]], footer: m('Abrir proveedor', 'Open supplier') }))];
}

/** Estatus de la cotización: adjudicación vigente (total/parcial) o el estatus registrado. */
export function quoteStatus(row, en = false) {
  const m = (es, e) => (en ? e : es);
  const aw = Number(row?.awarded_lines) || 0; const items = Number(row?.req_items) || 0;
  if (aw > 0) return items && aw >= items ? { code: 'total', text: m('Adjudicada total', 'Fully awarded'), tone: 'bg-blue-50 text-blue-800 border-blue-200' }
    : { code: 'partial', text: m('Adjudicada parcial', 'Partially awarded'), tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
  if (row?.awarded) return { code: 'awarded', text: m('Adjudicada', 'Awarded'), tone: 'bg-blue-50 text-blue-800 border-blue-200' };
  const t = clean(row?.legacy_status) || label(row?.status, en);
  return { code: 'other', text: t, tone: /no seleccionada|rechaz|cancel|vencid/i.test(t) ? 'bg-rose-50 text-rose-700 border-rose-200' : /seleccionad/i.test(t) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200' };
}

/** Requisición visible: referencia del cliente (como en el diseño) con el folio interno debajo. */
export function requisitionRef(row) {
  const ref = clean(row?.client_reference); const folio = clean(row?.requisition);
  return ref ? { main: ref, sub: folio } : { main: folio || '—', sub: '' };
}
export const pct = v => (num(v) === null ? '—' : `${Math.round(num(v) * 10) / 10}%`);
export const leadText = (v, en = false) => (num(v) === null ? '—' : `${Math.round(num(v) * 10) / 10} ${en ? 'days' : 'días'}`);
export const scoreTone = s => (num(s) === null ? 'bg-slate-100 text-slate-500' : s >= 80 ? 'bg-emerald-50 text-emerald-700' : s >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600');

/** Puntaje por cotización a partir del comparativo de su requisición (mismo criterio provisional de la tarjeta 5). */
export function scoresFromComparison(cmp) {
  if (!cmp) return {};
  return Object.fromEntries(scoreQuotes(cmp.quotes || [], cmp.lines || []).map(q => [q.id, { score: q.score, recommended: q.recommended, comparable: q.comparable, position: q.position }]));
}

/** Eliminar: una cotización con adjudicación vigente se conserva (trazabilidad); las demás son escritura bloqueada. */
export function deleteBlock(row, en = false) {
  if (!row?.awarded && !(Number(row?.awarded_lines) > 0)) return null;
  return en ? `${row.folio} has a current award: it is kept for traceability and is not deleted. Change the award from the comparison.`
    : `${row.folio} tiene adjudicación vigente: se conserva para trazabilidad y no se elimina. Cambia la adjudicación desde el comparativo.`;
}

/** Documento interno imprimible de la cotización del proveedor (datos registrados en MariaDB; todo valor escapado). */
export function supplierQuoteHtml(det, en = false) {
  const m = (es, e) => (en ? e : es);
  const it = det?.item || {}; const e = escapeHtml; const cur = it.currency;
  const rows = (det?.items || []).map(i => `<tr><td>${e(i.line_number)}</td><td>${e(i.description)}</td><td class="r">${e(Number(i.requested_quantity))}</td><td>${i.offered ? m('Sí', 'Yes') : 'No'}</td><td class="r">${e(Number(i.quantity))} ${e(i.unit_label || '')}</td><td class="r">${e(money(i.unit_price, cur, en))}</td><td class="r">${e(money(i.line_subtotal, cur, en))}</td></tr>`).join('');
  const kv = [[m('Proveedor', 'Supplier'), `${it.supplier_name || '—'}${it.supplier_code ? ` (${it.supplier_code})` : ''}`], [m('Referencia del proveedor', 'Supplier reference'), it.supplier_reference || '—'],
    [m('Requisición', 'Requisition'), it.requisition || '—'], [m('Cliente', 'Client'), it.client_name || '—'], [m('Fecha', 'Date'), String(it.quote_date || '—').slice(0, 10)], [m('Vigencia', 'Valid until'), String(it.valid_until || '—').slice(0, 10)],
    [m('Entrega', 'Lead time'), leadText(it.lead_days, en)], [m('Condiciones de pago', 'Payment terms'), it.payment_terms || '—'], [m('Técnico / documental', 'Technical / documentary'), `${pct(it.technical_score)} / ${pct(it.document_score)}`], [m('Estatus', 'Status'), it.legacy_status || label(it.status, en)]];
  const css = 'body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px;font-size:12px}h1{font-size:18px;margin:0 0 4px}p.s{color:#64748b;margin:0 0 14px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}th{background:#1e293b;color:#fff;font-size:10px;text-transform:uppercase}.r{text-align:right}.kv td:first-child{width:32%;font-weight:bold;background:#f8fafc}.t{margin-top:12px;text-align:right;font-weight:bold;font-size:13px}.w{margin-top:14px;padding:8px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-size:10px}';
  const body = `<h1>${e(m('Cotización de proveedor', 'Supplier quote'))} · ${e(it.folio || '')}</h1><p class="s">${e(m('Uso interno · datos registrados en SupplyFlow (MariaDB)', 'Internal use · data recorded in SupplyFlow (MariaDB)'))}</p>
<table class="kv">${kv.map(([k, v]) => `<tr><td>${e(k)}</td><td>${e(v)}</td></tr>`).join('')}</table>
<table><thead><tr><th>#</th><th>${e(m('Descripción', 'Description'))}</th><th class="r">${e(m('Solicitada', 'Requested'))}</th><th>${e(m('Ofertada', 'Offered'))}</th><th class="r">${e(m('Cantidad', 'Qty'))}</th><th class="r">${e(m('Precio unitario', 'Unit price'))}</th><th class="r">${e(m('Importe', 'Amount'))}</th></tr></thead><tbody>${rows}</tbody></table>
<p class="t">${e(m('Subtotal', 'Subtotal'))}: ${e(money(it.subtotal_amount, cur, en))} · ${e(m('Total', 'Total'))}: ${e(money(it.total_amount, cur, en))}</p>
<p class="w">${e(m('Documento interno con costos de proveedor: no compartir con el cliente.', 'Internal document with supplier costs: do not share with the client.'))}</p>`;
  return { css, body, html: `<!doctype html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${e(it.folio || '')}</title><style>${css}</style></head><body>${body}</body></html>` };
}
