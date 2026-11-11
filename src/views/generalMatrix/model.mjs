// Matriz General · lógica pura (sin red). Etapas: política del servidor `apps-script-eight-stage-matrix`
// (stage_index de /api/v1/recovery/matrix), con las mismas reglas de vencimiento que el Dashboard.
import { P2P_STAGES, DELIVERED_STAGE, INVOICE_STAGE, localToday, daysBetween } from '../dashboard/model.mjs';

export { P2P_STAGES, localToday };
export const PENDING_STAGE = 'pending';

/** Joins /matrix/requisitions rows with /recovery/matrix stages by public id. Without a stage source, stage_index stays undefined. */
export function mergeStages(rows = [], recoveryItems = null) {
  if (!Array.isArray(recoveryItems)) return rows.map(r => ({ ...r }));
  const byId = new Map(recoveryItems.map(x => [x.id, x]));
  return rows.map(r => {
    const s = byId.get(r.id);
    if (!s) return { ...r };
    return { ...r, stage_index: s.stage_index === null || s.stage_index === undefined ? null : Number(s.stage_index), client_tax: s.client_tax || null };
  });
}

const ymd = v => (v ? String(v).slice(0, 10) : '');

/**
 * overdue | on_time | no_date | delivered | closed | pending.
 * Same rule as the Dashboard: overdue = need_date before today and stage before "Entrega y aceptación".
 * stage_index null = history/change flow without stage equivalence → pending. Without any stage source
 * (undefined), the document counts are used: delivery or invoice recorded means it is no longer overdue.
 */
export function riskOf(row, day = localToday()) {
  const s = row?.stage_index;
  const need = ymd(row?.need_date);
  if (s === null) return 'pending';
  if (s === undefined) {
    if (Number(row?.invoice_count) > 0) return 'closed';
    if (Number(row?.delivery_count) > 0) return 'delivered';
  } else {
    if (s === INVOICE_STAGE) return 'closed';
    if (s >= DELIVERED_STAGE) return 'delivered';
  }
  if (!need) return 'no_date';
  return need < day ? 'overdue' : 'on_time';
}

export const RISKS = {
  overdue: ['Vencido', 'Overdue'], on_time: ['A tiempo', 'On time'], no_date: ['Sin fecha requerida', 'No required date'],
  delivered: ['Entregado', 'Delivered'], closed: ['Facturado', 'Invoiced'], pending: ['Por conciliar', 'To reconcile'],
};
export const stageLabel = (s, en = false) => (s === null ? (en ? 'Pending stage equivalence' : 'Pendiente de equivalencia') : s === undefined ? '—' : P2P_STAGES[s]?.[en ? 1 : 0] ?? '—');

export function initials(name = '') {
  const words = String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w && !/^(s|de|del|la|el|y|sa|cv|rl|sc|llc|inc)$/i.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
}

const distinct = values => new Set(values.map(v => String(v ?? '').trim()).filter(Boolean)).size;
const isOpen = r => r.stage_index === undefined ? !(Number(r.invoice_count) > 0) : r.stage_index !== INVOICE_STAGE;

/** Average age in days (request_date → today) of open requisitions; null when none has a date. */
export function averageOpenAge(rows = [], day = localToday()) {
  const ages = rows.filter(r => isOpen(r) && r.request_date).map(r => daysBetween(ymd(r.request_date), day)).filter(n => n >= 0);
  return ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
}

function cardStats(rows, day) {
  return {
    requisitions: rows.length,
    withPO: rows.filter(r => Number(r.purchase_order_count) > 0).length,
    withInvoice: rows.filter(r => Number(r.invoice_count) > 0).length,
    overdue: rows.filter(r => riskOf(r, day) === 'overdue').length,
    projects: distinct(rows.map(r => r.project)),
    contracts: distinct(rows.map(r => r.contract_reference)),
  };
}

/** Cards from /matrix/clients (every client, even without requisitions) plus the "all clients" card. */
export function clientCards(clients = [], rows = [], day = localToday()) {
  const byClient = new Map();
  for (const r of rows) { const k = r.client_id; if (!byClient.has(k)) byClient.set(k, []); byClient.get(k).push(r); }
  const items = clients.map(c => {
    const own = byClient.get(c.id) || [];
    return {
      id: c.id, code: c.code, name: c.name, badge: initials(c.name), serverCount: Number(c.requisitions) || 0,
      tax: own.find(r => r.client_tax)?.client_tax || '',
      search: [c.name, c.code, own.find(r => r.client_tax)?.client_tax, ...own.map(r => r.project), ...own.map(r => r.contract_reference)].filter(Boolean).join(' '),
      ...cardStats(own, day),
    };
  }).sort((a, b) => b.requisitions - a.requisitions || String(a.name).localeCompare(String(b.name), 'es'));
  return { all: { id: 'ALL', clients: clients.length, ...cardStats(rows, day), avgAge: averageOpenAge(rows, day) }, items };
}

export const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const filterCards = (items, term) => { const t = fold(term).trim(); return t ? items.filter(c => fold(c.search).includes(t)) : items; };

export const DOC_FILTERS = [
  ['all', 'Todos los documentos', 'All documents', () => true],
  ['review', 'Con revisión', 'With review', r => r.review_count > 0],
  ['rfq', 'Con RFQ', 'With RFQ', r => r.rfq_count > 0],
  ['supplier_quote', 'Con oferta de proveedor', 'With supplier quote', r => r.supplier_quote_count > 0],
  ['customer_quote', 'Con cotización al cliente', 'With customer quote', r => r.customer_quote_count > 0],
  ['purchase_order', 'Con OC', 'With purchase order', r => r.purchase_order_count > 0],
  ['receipt', 'Con recepción vinculada a OC', 'With PO-linked receipt', r => r.receipt_count > 0],
  ['delivery', 'Con entrega', 'With delivery', r => r.delivery_count > 0],
  ['invoice', 'Con factura', 'With invoice', r => r.invoice_count > 0],
  ['without_purchase_order', 'Sin OC vinculada', 'Without linked PO', r => !(r.purchase_order_count > 0)],
];
const refs = r => r.references || {};
const searchable = r => [r.folio, r.client_name, r.client_code, r.project, r.contract_reference, r.internal_reference, r.client_reference, r.requester_name, r.description,
  ...(refs(r).purchase_orders || []), ...(refs(r).winning_suppliers || []), ...(refs(r).receipts || []), ...(refs(r).invoices || [])].join(' ');

/** client: 'ALL' or client public id; stage: 'all' | 0..7 | 'pending'; doc: DOC_FILTERS key. */
export function filterRows(rows = [], { client = 'ALL', term = '', stage = 'all', doc = 'all' } = {}) {
  const t = fold(term).trim();
  const docTest = (DOC_FILTERS.find(d => d[0] === doc) || DOC_FILTERS[0])[3];
  return rows.filter(r => (client === 'ALL' || r.client_id === client)
    && (!t || fold(searchable(r)).includes(t))
    && (stage === 'all' || (stage === PENDING_STAGE ? r.stage_index === null : r.stage_index === Number(stage)))
    && docTest(r));
}

export function stageCounts(rows = []) {
  const counts = P2P_STAGES.map(() => 0); let pending = 0;
  for (const r of rows) { if (r.stage_index === null) pending++; else if (r.stage_index >= 0 && r.stage_index <= 7) counts[r.stage_index]++; }
  return { counts, pending };
}

export function money(value, currency, en = false) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value} ${currency || ''}`.trim();
  return `$${new Intl.NumberFormat(en ? 'en-US' : 'es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency || ''}`.trim();
}

export const projectLine = (r, en = false) => [r.project, r.contract_reference ? `${en ? 'Contract' : 'Contrato'}: ${r.contract_reference}` : ''].filter(Boolean).join(' · ');

/** Column values shared by the table, CSV and print (one source, so the three never disagree). */
export function exportColumns(en = false, day = localToday()) {
  const L = (es, e) => (en ? e : es);
  const list = v => (v && v.length ? v.join(' / ') : '—');
  return [
    [L('Requisición', 'Requisition'), r => r.folio],
    [L('Cliente', 'Client'), r => r.client_name],
    [L('Proyecto / contrato', 'Project / contract'), r => projectLine(r, en) || '—'],
    [L('Folio interno', 'Internal folio'), r => r.internal_reference || '—'],
    [L('Cotizaciones', 'Quotes'), r => Number(r.supplier_quote_count) || 0],
    [L('Proveedor ganador', 'Winning supplier'), r => list(refs(r).winning_suppliers)],
    [L('OC', 'PO'), r => list(refs(r).purchase_orders)],
    [L('Recepción', 'Reception'), r => list(refs(r).receipts)],
    [L('Factura', 'Invoice'), r => list(refs(r).invoices)],
    [L('Monto (presupuesto)', 'Amount (budget)'), r => (r.budget_amount === null || r.budget_amount === undefined || r.budget_amount === '' ? '' : String(r.budget_amount))],
    [L('Moneda', 'Currency'), r => r.currency_code || ''],
    [L('Fecha requerida', 'Required date'), r => ymd(r.need_date) || '—'],
    [L('Etapa', 'Stage'), r => stageLabel(r.stage_index, en)],
    [L('Riesgo', 'Risk'), r => RISKS[riskOf(r, day)][en ? 1 : 0]],
  ];
}

/** CSV cell: quoted, newlines flattened, and spreadsheet formulas neutralized (=, +, -, @, tab, CR). */
export function csvCell(value) {
  let s = String(value ?? '').replace(/\r?\n/g, ' / ');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function matrixCsv(rows = [], en = false, day = localToday()) {
  const cols = exportColumns(en, day);
  return '﻿' + [cols.map(c => csvCell(c[0])).join(','), ...rows.map(r => cols.map(c => csvCell(c[1](r))).join(','))].join('\r\n');
}

export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Printable landscape document (all filtered rows, not only the visible page). Every value is HTML-escaped. */
export function matrixPrintHtml(rows = [], { en = false, clientTitle = '', day = localToday() } = {}) {
  const cols = exportColumns(en, day);
  const title = en ? 'General Process Matrix' : 'Matriz general del proceso';
  const head = cols.map(c => `<th>${escapeHtml(c[0])}</th>`).join('');
  const body = rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(c[1](r))}</td>`).join('')}</tr>`).join('');
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${escapeHtml(title)} - ${escapeHtml(clientTitle)}</title><style>
@page { size: landscape; margin: 1cm; } body { font-family: Arial, sans-serif; font-size: 9px; color: #1e293b; margin: 0; padding: 10px; }
.header { margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; } .header h1 { font-size: 14px; margin: 0; color: #0f172a; text-transform: uppercase; }
.header p { margin: 3px 0 0 0; color: #64748b; } table { width: 100%; border-collapse: collapse; }
th { background-color: #f8fafc; color: #334155; font-weight: bold; text-transform: uppercase; font-size: 8px; border-bottom: 2px solid #cbd5e1; padding: 6px 8px; text-align: left; }
td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; } td:first-child { font-weight: bold; }
</style></head><body><div class="header"><h1>Grupo Gerez | ${en ? 'Purchasing' : 'Compras'}</h1><p><strong>${en ? 'Client' : 'Cliente'}:</strong> ${escapeHtml(clientTitle)} | <strong>${escapeHtml(title)}</strong> (${rows.length} ${en ? 'requisitions' : 'requisiciones'}) · ${en ? 'Source: MariaDB' : 'Fuente: MariaDB'} · ${escapeHtml(day)}</p></div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}
