// Servicios Operativos · sección 1 "Dashboard" (Panel ejecutivo). Lógica pura (node --test) sobre las filas reales de
// GET /api/v1/services/matrix (service_orders + requisición, autorización, OC de proveedor, facturas y evidencias).
// Los riesgos / alertas usan serviceRisks() del reporte Gerencial para que Dashboard y Reportes coincidan.
import { serviceRisks } from './serviceReports.mjs';
import { money } from './serviceMatrix.mjs';

export { money };
const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const PERIODS = [['all', 'Todo el periodo', 'All period'], ['month', 'Mes actual', 'Current month'], ['quarter', 'Trimestre actual', 'Current quarter'], ['year', 'Año actual', 'Current year']];

/** Rango de fecha de solicitud del periodo (incluye el periodo completo, no solo hasta hoy). */
export function periodRange(period, today) {
  if (period === 'all' || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return { from: '', to: '' };
  const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7));
  const iso = (yy, mm, dd) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const last = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (period === 'month') return { from: iso(y, m, 1), to: iso(y, m, last(y, m)) };
  if (period === 'quarter') { const q0 = Math.floor((m - 1) / 3) * 3 + 1; return { from: iso(y, q0, 1), to: iso(y, q0 + 2, last(y, q0 + 2)) }; }
  if (period === 'year') return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
  return { from: '', to: '' };
}
export const inRange = (x, r) => { const d = clean(x.date).slice(0, 10); return (!r.from || (!!d && d >= r.from)) && (!r.to || (!!d && d <= r.to)); };

// Clasificaciones (mismo criterio que la Matriz y los Reportes).
export const isCancelled = x => /cancel/.test(fold(x.status));
export const isExecuted = x => !!x.is_done || /^(completado|listo para facturar|facturado)$/.test(fold(x.status));
export const isReady = x => fold(x.status) === 'listo para facturar';
export const isInvoiced = x => !!clean(x.invoices) || fold(x.status) === 'facturado';
export const authState = x => {
  const s = fold(x.authorization_status);
  if (/rechaz/.test(s)) return 'rejected';
  if (/regulariz|pend/.test(s) || !s) return 'pending';
  if (/autoriz|recib|aprob|valid/.test(s)) return 'valid';
  return 'pending';
};

const MONTHS = { es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };

/** Totales por moneda: la principal es la de más servicios (MXN en empate); las demás se informan aparte. */
export function currencyTotals(items) {
  const m = new Map();
  for (const x of items) { const c = clean(x.currency); const t = m.get(c) || { currency: c, n: 0, price: 0, cost: 0 }; t.n += 1; t.price += num(x.price); t.cost += num(x.cost); m.set(c, t); }
  const list = [...m.values()].map(t => ({ ...t, margin: t.price - t.cost, marginPct: t.price > 0 ? ((t.price - t.cost) / t.price) * 100 : 0 }))
    .sort((a, b) => b.n - a.n || (a.currency === 'MXN' ? -1 : b.currency === 'MXN' ? 1 : 0) || a.currency.localeCompare(b.currency));
  return { main: list[0] || { currency: '', n: 0, price: 0, cost: 0, margin: 0, marginPct: 0 }, others: list.slice(1) };
}

function group(items, key, main) {
  const m = new Map();
  for (const x of items) {
    const k = clean(key(x)) || '—'; const g = m.get(k) || { key: k, n: 0, price: 0, cost: 0, margin: 0 };
    g.n += 1;
    if (clean(x.currency) === main) { g.price += num(x.price); g.cost += num(x.cost); g.margin += num(x.price) - num(x.cost); }
    m.set(k, g);
  }
  return [...m.values()];
}

/** Tendencia de los últimos 12 meses (por fecha de solicitud) en la moneda principal. */
export function monthlyTrend(items, today, main = '', en = false) {
  const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7));
  const out = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: `${MONTHS[en ? 'en' : 'es'][d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, n: 0, price: 0, cost: 0, margin: 0 });
  }
  const at = new Map(out.map(o => [o.key, o]));
  for (const x of items) {
    const o = at.get(clean(x.date).slice(0, 7)); if (!o) continue;
    o.n += 1;
    if (clean(x.currency) === main) { o.price += num(x.price); o.cost += num(x.cost); o.margin += num(x.price) - num(x.cost); }
  }
  return out;
}

const days = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

/**
 * Indicadores del panel. all = filas del cliente/servicio filtrados (para la tendencia de 12 meses);
 * el periodo se aplica a todo lo demás.
 */
export function dashboard(all = [], { period = 'all', today = '', en = false } = {}) {
  const items = all.filter(x => inRange(x, periodRange(period, today)));
  const total = items.length;
  const cur = currencyTotals(items);
  const main = cur.main.currency;
  const executed = items.filter(isExecuted).length;
  const invoiced = items.filter(isInvoiced).length;
  const ready = items.filter(isReady).length;
  const active = items.filter(x => x.is_open).length;
  const auth = { valid: items.filter(x => authState(x) === 'valid').length, pending: items.filter(x => authState(x) === 'pending').length, rejected: items.filter(x => authState(x) === 'rejected').length };
  const withEvidence = items.filter(x => num(x.evidence_count) > 0).length;
  const external = items.filter(x => x.requires_supplier).length;
  const linked = items.filter(x => clean(x.supplier_po)).length;
  const linkedExternal = items.filter(x => x.requires_supplier && clean(x.supplier_po)).length;
  const statuses = group(items, x => x.status, main).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, 'es'));
  const byType = group(items, x => x.service, main).sort((a, b) => b.n - a.n || b.price - a.price || a.key.localeCompare(b.key, 'es'));
  const topClients = group(items, x => x.client_name, main).sort((a, b) => b.price - a.price || b.n - a.n).slice(0, 5);
  const alerts = items.map(x => ({ folio: x.folio, risks: serviceRisks(x, today, en) })).filter(a => a.risks.length)
    .sort((a, b) => clean(b.folio).localeCompare(clean(a.folio), 'es', { numeric: true }));
  const spans = items.filter(x => /^\d{4}-\d{2}-\d{2}/.test(clean(x.date)) && /^\d{4}-\d{2}-\d{2}/.test(clean(x.required_date))).map(x => days(clean(x.date).slice(0, 10), clean(x.required_date).slice(0, 10)));
  return {
    total, items,
    kpis: { active, activePct: pct(active, total), executed, executedPct: pct(executed, total), invoiced, invoicedPct: pct(invoiced, total) },
    money: cur,
    bars: { auth: pct(auth.valid, total), evidence: pct(withEvidence, total), po: pct(linked, total), invoice: pct(invoiced, total), margin: Math.round(cur.main.marginPct) },
    trend: monthlyTrend(all, today, main, en),
    statuses, byType, topClients,
    auth: { ...auth, pct: pct(auth.valid, total) },
    funnel: [['requests', total], ['authorized', auth.valid], ['executed', executed], ['ready', ready], ['invoiced', invoiced]],
    external: { internal: total - external, external, linked: linkedExternal, pending: external - linkedExternal, coverage: pct(linkedExternal, external) },
    alerts,
    mgmt: {
      avgDays: spans.length ? Math.round((spans.reduce((n, d) => n + d, 0) / spans.length) * 10) / 10 : null,
      overdue: items.filter(x => x.is_open && clean(x.required_date) && today && clean(x.required_date).slice(0, 10) < today).length,
      negMargin: items.filter(x => !isCancelled(x) && num(x.price) - num(x.cost) < 0).length,
      pendReg: auth.pending, external, withEvidence,
    },
  };
}

/** Altura relativa (0–100 %) para barras; valores negativos se dibujan como 0. */
export const barPct = (v, max) => (max > 0 && v > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0);
export const money0 = (v, c = '') => money(v, c);
/** Colores del donut de estatus (conic-gradient). */
export const STATUS_COLORS = ['#2563eb', '#9333ea', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#64748b', '#84cc16', '#ec4899', '#0ea5e9', '#a855f7'];
export function donut(statuses, total) {
  if (!total) return '#e2e8f0 0 100%';
  let acc = 0;
  return statuses.map((s, i) => { const from = acc; acc += (s.n / total) * 100; return `${STATUS_COLORS[i % STATUS_COLORS.length]} ${from.toFixed(2)}% ${acc.toFixed(2)}%`; }).join(', ');
}
export const alertText = a => `${a.folio} · ${a.risks.join(' · ')}`;
