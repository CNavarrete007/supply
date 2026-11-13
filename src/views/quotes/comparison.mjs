// Cotizaciones › Comparativo y selección preliminar · lógica pura (sin red).
// El puntaje NO existe en MariaDB: es un criterio explícito de SupplyFlow (provisional, por confirmar contra el Apps
// Script) que se muestra desglosado. Adjudicar y generar OC son escrituras comerciales bloqueadas: aquí solo se prepara.

/** Weights of the provisional score (sum 100). */
export const WEIGHTS = { price: 40, delivery: 15, technical: 25, documental: 20 };
const n = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const clamp = v => Math.max(0, Math.min(100, v));
const round1 = v => Math.round(v * 10) / 10;

/** Majority currency among the quotes (ties: first seen). */
export function majorityCurrency(quotes = []) {
  const c = new Map(); for (const q of quotes) if (q.currency) c.set(q.currency, (c.get(q.currency) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/**
 * Score per quote (0–100):
 *  - price (40): per active line, best offered unit price / this quote's unit price (lines not offered = 0), averaged
 *    over the requisition lines; only quotes in the majority currency are comparable (others: price = null).
 *  - delivery (15): (fastest days + 1) / (days + 1); no days = 0.
 *  - technical (25) and documental (20): technical_score / document_score (0–100); empty = 0.
 * Returns quotes sorted by score with { score, parts, comparable, position, recommended }.
 */
export function scoreQuotes(quotes = [], lines = []) {
  const cur = majorityCurrency(quotes);
  const active = lines.filter(l => !l.line_status || l.line_status === 'active');
  const best = new Map();
  for (const l of active) {
    const prices = (l.offers || []).filter(o => o.offered && o.currency === cur && n(o.unit_price) > 0).map(o => n(o.unit_price));
    if (prices.length) best.set(l.id ?? l.line_number, Math.min(...prices));
  }
  const days = quotes.filter(q => q.currency === cur && n(q.lead_days) !== null).map(q => n(q.lead_days));
  const fastest = days.length ? Math.min(...days) : null;
  const scored = quotes.map(q => {
    const comparable = q.currency === cur;
    let price = null;
    if (comparable && active.length) {
      const per = active.map(l => {
        const o = (l.offers || []).find(x => x.quote_id === q.id && x.offered && n(x.unit_price) > 0);
        const b = best.get(l.id ?? l.line_number);
        return o && b ? b / n(o.unit_price) : 0;
      });
      price = clamp((per.reduce((s, x) => s + x, 0) / active.length) * 100);
    }
    const d = n(q.lead_days);
    const delivery = comparable && d !== null && fastest !== null ? clamp(((fastest + 1) / (d + 1)) * 100) : 0;
    const technical = clamp(n(q.technical_score) ?? 0);
    const documental = clamp(n(q.document_score) ?? 0);
    const parts = { price: round1(price ?? 0), delivery: round1(delivery), technical: round1(technical), documental: round1(documental) };
    const score = round1(((price ?? 0) * WEIGHTS.price + delivery * WEIGHTS.delivery + technical * WEIGHTS.technical + documental * WEIGHTS.documental) / 100);
    return { ...q, comparable, score, parts };
  });
  const order = [...scored].sort((a, b) => (Number(b.comparable) - Number(a.comparable)) || (b.score - a.score) || ((n(a.total_amount) ?? Infinity) - (n(b.total_amount) ?? Infinity)) || ((n(a.lead_days) ?? Infinity) - (n(b.lead_days) ?? Infinity)));
  return order.map((q, i) => ({ ...q, position: i + 1, recommended: i === 0 && q.comparable }));
}

/** "Adjudicada total" | "Adjudicada parcial" | null from awarded lines vs active lines. */
export function awardState(q, activeLines) {
  if (!q.awarded_lines) return null;
  return q.awarded_lines >= activeLines ? 'total' : 'partial';
}

/** Initial award selection per line: the current definitive award if any, otherwise "Sin adjudicar". */
export function initialSelection(lines = []) {
  const out = {};
  for (const l of lines) {
    if (l.line_status && l.line_status !== 'active') continue;
    const a = l.award && (l.offers || []).find(o => o.quote_id === l.award.quote_id);
    out[l.id] = { quote: a ? a.quote_id : '', qty: normQty(l.award?.quantity ?? l.quantity) };
  }
  return out;
}
export const normQty = v => { const s = String(v ?? '').trim(); return /^\d+(\.\d+)?$/.test(s) && s.includes('.') ? (s.replace(/0+$/, '').replace(/\.$/, '') || '0') : s; };
const DEC = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;

/** Preview of the POs that saving the award would create: one per supplier with its lines and amount. */
export function awardPreview(lines = [], selection = {}) {
  const groups = new Map(); const errors = [];
  for (const l of lines) {
    const s = selection[l.id]; if (!s || !s.quote) continue;
    const o = (l.offers || []).find(x => x.quote_id === s.quote);
    if (!o) continue;
    const q = String(s.qty ?? '').trim();
    if (!DEC.test(q) || Number(q) <= 0) { errors.push({ line: l.line_number, code: 'qty' }); continue; }
    if (n(o.quantity) !== null && Number(q) > n(o.quantity)) errors.push({ line: l.line_number, code: 'over_offer' });
    const k = `${o.supplier_name}|${o.currency}`;
    const g = groups.get(k) || { supplier_name: o.supplier_name, currency: o.currency, lines: 0, amount: 0, quotes: new Set() };
    g.lines += 1; g.amount = Math.round((g.amount + Number(q) * n(o.unit_price)) * 100) / 100; g.quotes.add(o.quote_folio);
    groups.set(k, g);
  }
  return { orders: [...groups.values()].map(g => ({ ...g, quotes: [...g.quotes] })), selected: Object.values(selection).filter(s => s.quote).length, errors };
}

/** Lines whose selection differs from the current definitive award (what "Guardar adjudicación" would change). */
export function awardChanges(lines = [], selection = {}) {
  return lines.filter(l => selection[l.id] && ((selection[l.id].quote || '') !== (l.award?.quote_id || '') || (selection[l.id].quote && normQty(selection[l.id].qty) !== normQty(l.award?.quantity ?? ''))));
}
