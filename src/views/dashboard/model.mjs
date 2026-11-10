// Inicio y Dashboard · cálculos puros sobre datos REALES de la API (sin datos de demostración).
// Fuentes: /api/v1/analytics/* (resumen por filtro) y /api/v1/recovery/matrix (filas con la etapa
// calculada por el servidor con la política 'apps-script-eight-stage-matrix').

export const P2P_STAGES = [
  ['Requisición recibida', 'Requisition received', 'bg-blue-600'],
  ['Validación interna', 'Internal validation', 'bg-teal-600'],
  ['Solicitud de cotización', 'Quotation request', 'bg-purple-600'],
  ['Comparativo y autorización', 'Comparison & approval', 'bg-pink-600'],
  ['Orden de compra', 'Purchase order', 'bg-amber-600'],
  ['Recepción', 'Receipt', 'bg-teal-500'],
  ['Entrega y aceptación', 'Delivery & acceptance', 'bg-emerald-600'],
  ['Factura', 'Invoice', 'bg-rose-600'],
];
export const DELIVERED_STAGE = 6; // 'Entrega y aceptación'
export const INVOICE_STAGE = 7;   // 'Factura'

export function localToday(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function daysBetween(fromYmd, toYmd) {
  const p = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(toYmd) - p(fromYmd)) / 86400000);
}
export const pct = (part, total) => (total > 0 ? Math.round((Number(part) || 0) * 100 / total) : 0);

/** Same scope as the analytics API: client public id and request_date range (undated rows excluded when a range is set). */
export function scopeRows(rows = [], { client = 'all', from = '', to = '' } = {}) {
  return rows.filter(r => (client === 'all' || !client || r.client_id === client)
    && (!from || (r.request_date && r.request_date >= from))
    && (!to || (r.request_date && r.request_date <= to)));
}

const stageOf = r => (r.stage_index === null || r.stage_index === undefined ? null : Number(r.stage_index));
export const isOverdue = (r, day) => { const s = stageOf(r); return s !== null && s < DELIVERED_STAGE && !!r.need_date && String(r.need_date).slice(0, 10) < day; };

export function stageDistribution(rows = []) {
  const counts = P2P_STAGES.map(() => 0);
  let unknown = 0;
  for (const r of rows) { const s = stageOf(r); if (s === null || s < 0 || s > 7) unknown++; else counts[s]++; }
  return { counts, unknown, total: rows.length };
}

export function processStatus(rows = [], day = localToday()) {
  let open = 0, overdue = 0, closed = 0, delivered = 0, unknown = 0;
  for (const r of rows) {
    const s = stageOf(r);
    if (s === null) { unknown++; continue; }
    if (s === INVOICE_STAGE) closed++; else open++;
    if (s >= DELIVERED_STAGE) delivered++;
    if (isOverdue(r, day)) overdue++;
  }
  return { total: rows.length, open, overdue, onTime: open - overdue, closed, delivered, unknown };
}

export function priorityDistribution(rows = []) {
  const out = { urgent: 0, high: 0, normal: 0, other: 0 };
  for (const r of rows) { const p = r.priority || 'normal'; if (p in out) out[p]++; else out.other++; }
  return out;
}

export function clientActivity(rows = [], limit = 5) {
  const map = new Map();
  for (const r of rows) {
    const k = r.client_id || r.client;
    const e = map.get(k) || { id: k, name: r.client || '—', total: 0, open: 0 };
    e.total++; const s = stageOf(r); if (s !== null && s < INVOICE_STAGE) e.open++;
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es')).slice(0, limit);
}

/** Requisitions still at 'received' or 'internal validation': the next operational step is pending. */
export function nextActions(rows = [], day = localToday(), limit = 6) {
  const list = rows.filter(r => [0, 1].includes(stageOf(r)));
  list.sort((a, b) => Number(isOverdue(b, day)) - Number(isOverdue(a, day)) || String(a.need_date || '9999').localeCompare(String(b.need_date || '9999')));
  return { total: list.length, items: list.slice(0, limit) };
}

export function alerts(rows = [], day = localToday(), limit = 40) {
  const out = [];
  for (const r of rows) {
    if (isOverdue(r, day)) out.push({ id: `n-${r.id}`, type: 'danger', kind: 'need', folio: r.folio, client: r.client, days: daysBetween(String(r.need_date).slice(0, 10), day) });
    if (r.is_provisional && !/^Regularizada/u.test(String(r.regularization_status || '')) && r.regularization_due_date && String(r.regularization_due_date).slice(0, 10) < day)
      out.push({ id: `r-${r.id}`, type: 'warning', kind: 'regularization', folio: r.folio, client: r.client, days: daysBetween(String(r.regularization_due_date).slice(0, 10), day) });
  }
  out.sort((a, b) => b.days - a.days || String(a.folio).localeCompare(String(b.folio)));
  return { total: out.length, items: out.slice(0, limit) };
}

export function recentMoves(rows = [], limit = 7) {
  return [...rows].filter(r => r.updated_at || r.created_at)
    .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
    .slice(0, limit)
    .map(r => ({ id: r.id, at: r.updated_at || r.created_at, created: !r.updated_at || r.updated_at === r.created_at, folio: r.folio, client: r.client, stage: stageOf(r) }));
}

export function averageProgress(rows = []) {
  const v = rows.map(r => r.progress).filter(x => x !== null && x !== undefined && Number.isFinite(Number(x))).map(Number);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

/** analytics.financial → per currency { budgets, quotes, po } with amount and documents. */
export function moneyByCurrency(financial = {}) {
  const out = {};
  for (const [key, field] of [['requisition_budgets', 'budgets'], ['customer_quotes', 'quotes'], ['purchase_orders', 'po']]) {
    for (const x of financial?.[key] || []) {
      const c = x.currency_code || '—';
      out[c] = out[c] || { budgets: null, quotes: null, po: null };
      out[c][field] = { amount: Number(x.amount) || 0, documents: Number(x.documents) || 0 };
    }
  }
  const currencies = Object.keys(out).sort((a, b) => (a === 'MXN' ? -1 : b === 'MXN' ? 1 : a.localeCompare(b)));
  return { currencies, byCurrency: out };
}
export const documentsOf = (financial, key) => (financial?.[key] || []).reduce((n, x) => n + (Number(x.documents) || 0), 0);

export function activeCount(summary) {
  if (!summary) return null;
  const s = (summary.statuses || []).find(x => x.code === 'active');
  return s ? Number(s.count) || 0 : 0;
}

export function changeSummary(list, queue) {
  if (!list && !queue) return null;
  const by = {};
  for (const c of list?.items || []) by[c.status_code] = (by[c.status_code] || 0) + 1;
  return { own: list?.items?.length ?? null, ownTruncated: !!list?.truncated, byStatus: by,
    toReview: queue?.items?.length ?? null, toReviewTruncated: !!queue?.truncated };
}

export function historyBased(rows = [], limit = 8) {
  const list = rows.filter(r => r.history_based);
  return { total: list.length, items: list.slice(0, limit) };
}
