// Reportes · reporte gerencial calculado con datos reales (sin red). Mismas reglas que la Matriz General y el
// Dashboard: alcance por fecha de solicitud y cliente, 8 etapas del servidor, vencidas antes de "Entrega y
// aceptación". Montos SIEMPRE por moneda; las OC se cuentan una sola vez (id público de la versión vigente).
import { mergeStages, riskOf, stageLabel, money, csvCell, escapeHtml, P2P_STAGES, PENDING_STAGE, localToday } from '../generalMatrix/model.mjs';
import { scopeRows, INVOICE_STAGE, daysBetween } from '../dashboard/model.mjs';

export { mergeStages, stageLabel, money, P2P_STAGES, PENDING_STAGE, localToday };
export const DEFAULT_COMPANY = 'TRÁMITES ADUANALES GEREZ S.C.';

/** filters: { from, to, client: 'all'|id, stage: 'all'|'0'..'7'|'pending' } — dates apply to request_date (undated rows excluded from bounded periods). */
export function reportRows(rows = [], { from = '', to = '', client = 'all', stage = 'all' } = {}) {
  return scopeRows(rows, { client, from, to })
    .filter(r => stage === 'all' || (stage === PENDING_STAGE ? r.stage_index === null : r.stage_index === Number(stage)));
}

const sortCurrencies = keys => [...keys].sort((a, b) => (a === 'MXN' ? -1 : b === 'MXN' ? 1 : a.localeCompare(b)));
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round2 = n => Math.round(n * 100) / 100;
const orders = r => r.references?.purchase_order_totals || [];

/** Distinct current POs (by public id) of the given rows, summed per currency. */
export function purchasedByCurrency(rows = []) {
  const seen = new Map();
  for (const r of rows) for (const po of orders(r)) if (po?.id && !seen.has(po.id)) seen.set(po.id, po);
  const out = {};
  for (const po of seen.values()) {
    const a = num(po.amount); if (a === null || !po.currency) continue;
    out[po.currency] = out[po.currency] || { amount: 0, orders: 0 };
    out[po.currency].amount = round2(out[po.currency].amount + a); out[po.currency].orders++;
  }
  return out;
}

/**
 * Comparable deviation per currency = budget − purchased, ONLY over requisitions that have a budget and current
 * POs all in that same currency (no currency conversion, no budgets of requisitions without PO).
 * Positive = below budget (saving), negative = above budget.
 */
export function comparableDeviation(rows = []) {
  const groups = {};
  for (const r of rows) {
    const b = num(r.budget_amount); const pos = orders(r);
    if (b === null || !r.currency_code || !pos.length || pos.some(p => p.currency !== r.currency_code)) continue;
    (groups[r.currency_code] = groups[r.currency_code] || []).push(r);
  }
  const out = {};
  for (const [cur, list] of Object.entries(groups)) {
    const budget = round2(list.reduce((s, r) => s + num(r.budget_amount), 0));
    const purchased = purchasedByCurrency(list)[cur]?.amount || 0;
    out[cur] = { budget, purchased, deviation: round2(budget - purchased), requisitions: list.length };
  }
  return out;
}

export function reportMetrics(rows = [], day = localToday()) {
  const budget = {}; let noBudget = 0;
  for (const r of rows) {
    const b = num(r.budget_amount);
    if (b === null || !r.currency_code) { noBudget++; continue; }
    budget[r.currency_code] = round2((budget[r.currency_code] || 0) + b);
  }
  const overdueRows = rows.filter(r => riskOf(r, day) === 'overdue');
  const purchased = purchasedByCurrency(rows);
  return {
    total: rows.length,
    closed: rows.filter(r => r.stage_index === INVOICE_STAGE).length,
    overdue: overdueRows.length,
    oldestOverdueDays: overdueRows.reduce((m, r) => Math.max(m, daysBetween(String(r.need_date).slice(0, 10), day)), 0),
    pending: rows.filter(r => r.stage_index === null).length,
    noBudget,
    withPO: rows.filter(r => orders(r).length > 0).length,
    budget, purchased, deviation: comparableDeviation(rows),
    orders: Object.values(purchased).reduce((n, x) => n + x.orders, 0),
  };
}

/** ["$1,500.00 USD", ...] with MXN first; [] when empty. */
export const moneyLines = (map = {}, en = false, pick = v => v) => sortCurrencies(Object.keys(map)).map(c => money(pick(map[c]), c, en));

export function poCell(r, en = false) {
  const pos = orders(r);
  if (!pos.length) return '—';
  return `${pos.length} ${en ? 'PO' : 'OC'} · ${moneyLines(purchasedByCurrency([r]), en, x => x.amount).join(' + ')}`;
}

/** Executive summary sentences built only from computed values (no fixed claims). */
export function executiveSummary(m, en = false) {
  const L = (es, e) => (en ? e : es);
  const purchased = moneyLines(m.purchased, en, x => x.amount);
  const dev = sortCurrencies(Object.keys(m.deviation));
  const parts = [
    L(`Durante el periodo se gestionaron ${m.total} requisiciones. Se cerraron ${m.closed} procesos y existen ${m.overdue} solicitudes vencidas.`,
      `During the period, ${m.total} requisitions were managed. ${m.closed} processes were closed and there are ${m.overdue} overdue requests.`),
    purchased.length
      ? L(`El valor acumulado de órdenes de compra vigentes es ${purchased.join(' + ')} (${m.orders} OC).`, `The cumulative value of current purchase orders is ${purchased.join(' + ')} (${m.orders} POs).`)
      : L('No hay órdenes de compra vigentes vinculadas a estas requisiciones.', 'There are no current purchase orders linked to these requisitions.'),
    dev.length
      ? L(`La diferencia respecto del presupuesto registrado, en requisiciones con OC y presupuesto en la misma moneda, es ${dev.map(c => `${money(m.deviation[c].deviation, c, en)} (${m.deviation[c].requisitions} req.)`).join(' y ')}.`,
          `The variance against the recorded budget, for requisitions with POs and budget in the same currency, is ${dev.map(c => `${money(m.deviation[c].deviation, c, en)} (${m.deviation[c].requisitions} req.)`).join(' and ')}.`)
      : L('No hay base comparable entre presupuesto y OC (se requieren requisiciones con presupuesto y OC en la misma moneda).', 'There is no comparable basis between budget and POs (requisitions with budget and POs in the same currency are required).'),
  ];
  return parts.join(' ');
}

/** Rule-based conclusions from the computed metrics. tone: warning | ok | info */
export function conclusions(m, en = false) {
  const L = (es, e) => (en ? e : es);
  const out = [];
  if (!m.total) return [{ tone: 'info', text: L('No hay requisiciones para los filtros seleccionados.', 'There are no requisitions for the selected filters.') }];
  if (m.overdue) out.push({ tone: 'warning', text: L(`Priorizar las ${m.overdue} requisiciones vencidas (la más atrasada lleva ${m.oldestOverdueDays} días), confirmar fechas compromiso con proveedores y documentar acciones de recuperación.`, `Prioritize the ${m.overdue} overdue requisitions (the oldest is ${m.oldestOverdueDays} days late), confirm commitment dates with suppliers and document recovery actions.`) });
  else out.push({ tone: 'ok', text: L('No hay requisiciones vencidas en el alcance del reporte.', 'There are no overdue requisitions in the report scope.') });
  for (const c of sortCurrencies(Object.keys(m.deviation))) {
    const d = m.deviation[c];
    out.push(d.deviation >= 0
      ? { tone: 'ok', text: L(`En ${c}, el monto comprado se mantiene dentro del presupuesto de las ${d.requisitions} requisiciones comparables (${money(d.deviation, c, en)} por debajo).`, `In ${c}, the purchased amount stays within the budget of the ${d.requisitions} comparable requisitions (${money(d.deviation, c, en)} below).`) }
      : { tone: 'warning', text: L(`En ${c}, el monto comprado excede el presupuesto de las ${d.requisitions} requisiciones comparables por ${money(-d.deviation, c, en)}; revisar las OC correspondientes.`, `In ${c}, the purchased amount exceeds the budget of the ${d.requisitions} comparable requisitions by ${money(-d.deviation, c, en)}; review the corresponding POs.`) });
  }
  if (m.withPO && !Object.keys(m.deviation).length) out.push({ tone: 'info', text: L('Las OC vigentes no tienen presupuesto comparable en la misma moneda; no se calcula ahorro ni desviación.', 'Current POs have no comparable budget in the same currency; no saving or variance is computed.') });
  if (m.noBudget) out.push({ tone: 'info', text: L(`${m.noBudget} requisiciones no tienen presupuesto registrado; no se consideran como cero.`, `${m.noBudget} requisitions have no recorded budget; they are not treated as zero.`) });
  if (m.pending) out.push({ tone: 'info', text: L(`${m.pending} requisiciones históricas o con cambios controlados no tienen etapa equivalente; conviene conciliarlas.`, `${m.pending} historical or change-controlled requisitions have no equivalent stage; they should be reconciled.`) });
  return out;
}

export function reportColumns(en = false, day = localToday()) {
  const L = (es, e) => (en ? e : es);
  return [
    [L('Requisición', 'Requisition'), r => r.folio],
    [L('Cliente', 'Client'), r => r.client_name],
    [L('Proyecto', 'Project'), r => r.project || '—'],
    [L('Monto est.', 'Est. amount'), r => money(r.budget_amount, r.currency_code, en)],
    [L('OC', 'PO'), r => poCell(r, en)],
    [L('Folios OC', 'PO folios'), r => orders(r).map(p => p.folio).join(' / ') || '—'],
    [L('Recepción', 'Reception'), r => (r.references?.receipts || []).join(' / ') || '—'],
    [L('Etapa', 'Stage'), r => stageLabel(r.stage_index, en)],
    [L('Fecha requerida', 'Required date'), r => (r.need_date ? String(r.need_date).slice(0, 10) : '—')],
    [L('Riesgo', 'Risk'), r => ({ overdue: L('Vencido', 'Overdue'), on_time: L('A tiempo', 'On time'), no_date: L('Sin fecha', 'No date'), delivered: L('Entregado', 'Delivered'), closed: L('Facturado', 'Invoiced'), pending: L('Por conciliar', 'To reconcile') }[riskOf(r, day)])],
  ];
}

export function reportCsv(rows = [], en = false, day = localToday()) {
  const cols = reportColumns(en, day);
  return '﻿' + [cols.map(c => csvCell(c[0])).join(','), ...rows.map(r => cols.map(c => csvCell(c[1](r))).join(','))].join('\r\n');
}

/** Printable executive report (all rows of the scope). Every dynamic value is HTML-escaped. */
export function reportPrintHtml(rows = [], m, { en = false, title, subtitle, issued, scopeText, day = localToday() } = {}) {
  const L = (es, e) => (en ? e : es);
  const cols = reportColumns(en, day).filter(c => c[0] !== L('Folios OC', 'PO folios') && c[0] !== L('Riesgo', 'Risk'));
  const lines = list => (list.length ? list.map(escapeHtml).join('<br>') : '—');
  const kpis = [
    ['#2563eb', String(m.total), L('Requisiciones', 'Requisitions')], ['#10b981', String(m.closed), L('Cerradas', 'Closed')], ['#ef4444', String(m.overdue), L('Vencidas', 'Overdue')],
    ['#8b5cf6', lines(moneyLines(m.budget, en)), L('Presupuesto', 'Budget')], ['#f97316', lines(moneyLines(m.purchased, en, x => x.amount)), L('Comprado', 'Purchased')],
    ['#0d9488', lines(moneyLines(m.deviation, en, x => x.deviation)), L('Ahorro / desviación', 'Savings / variance')],
  ].map(([color, value, label]) => `<div class="kpi-card" style="border-top-color:${color}"><div class="kpi-val">${value}</div><div class="kpi-lbl">${escapeHtml(label)}</div></div>`).join('');
  const body = rows.map(r => `<tr>${cols.map((c, i) => `<td${i === 0 ? ' style="font-weight:bold"' : ''}>${escapeHtml(c[1](r))}</td>`).join('')}</tr>`).join('');
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>
@page { size: landscape; margin: 1cm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; color: #0f172a; margin: 0; padding: 15px; }
.header-banner { background: linear-gradient(to right, #2563eb, #7c3aed); color: white; padding: 15px 20px; border-radius: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; gap: 12px; }
.header-banner h1 { font-size: 18px; margin: 0; font-weight: bold; } .header-banner p { font-size: 10px; margin: 4px 0 0 0; opacity: 0.9; }
.kpis { display: flex; gap: 10px; margin-bottom: 15px; } .kpi-card { flex: 1; background: #fff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; border-top-width: 4px; }
.kpi-val { font-size: 14px; font-weight: 900; } .kpi-lbl { font-size: 8px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-top: 3px; }
.box { background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; margin-bottom: 15px; } .box h3 { margin: 0 0 6px 0; font-size: 12px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; } tr { break-inside: avoid; }
th { background-color: #f8fafc; color: #334155; font-weight: bold; text-transform: uppercase; font-size: 8px; border-bottom: 2px solid #cbd5e1; padding: 8px; text-align: left; }
td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; } ul { margin: 0; padding-left: 16px; } .note { color: #64748b; font-size: 8px; margin-top: 10px; }
</style></head><body>
<div class="header-banner"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><p>${escapeHtml(scopeText)}</p></div><div style="text-align:right"><p>${L('Fecha de emisión', 'Issue date')}</p><strong>${escapeHtml(issued)}</strong></div></div>
<div class="kpis">${kpis}</div>
<div class="box"><h3>${L('Resumen ejecutivo', 'Executive summary')}</h3><p>${escapeHtml(executiveSummary(m, en))}</p></div>
<table><thead><tr>${cols.map(c => `<th>${escapeHtml(c[0])}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
<div class="box" style="margin-top:15px"><h3>${L('Conclusiones', 'Conclusions')}</h3><ul>${conclusions(m, en).map(c => `<li>${escapeHtml(c.text)}</li>`).join('')}</ul></div>
<p class="note">${L('Fuente: MariaDB (solo lectura). Montos por moneda, sin conversión. Comprado = OC vigentes (última versión, sin canceladas/sustituidas), contadas una vez. Ahorro/desviación solo sobre requisiciones con presupuesto y OC en la misma moneda.', 'Source: MariaDB (read-only). Amounts per currency, no conversion. Purchased = current POs (latest version, excluding cancelled/superseded), counted once. Savings/variance only over requisitions with budget and POs in the same currency.')}</p>
</body></html>`;
}
