// Tarjeta 10 · Adjudicación definitiva · lógica pura (sin red).
// Gate: solo una cotización al cliente APROBADA (revisión vigente) es elegible. El proveedor recomendado sale del
// puntaje provisional del comparativo (comparison.mjs); el definitivo parte de la adjudicación vigente en MariaDB.
// Confirmar la adjudicación es una escritura comercial bloqueada: aquí solo se valida y se explica.
import { scoreQuotes, normQty } from './comparison.mjs';

/** Los seis pasos del flujo del diseño; el 4 es el gate y el 5 la etapa actual. */
export const AWARD_STEPS = [
  [1, 'Comparativo', 'Comparison', 'Ofertas evaluadas', 'Evaluated offers', 'done'],
  [2, 'Selección preliminar', 'Preliminary selection', 'Proveedor recomendado', 'Recommended supplier', 'done'],
  [3, 'Cotización al cliente', 'Client quote', 'Precio de venta', 'Sales price', 'done'],
  [4, 'Aceptación del cliente', 'Client acceptance', 'Gate obligatorio', 'Mandatory gate', 'gate'],
  [5, 'Adjudicación definitiva', 'Definitive award', 'Proveedor confirmado', 'Confirmed supplier', 'current'],
  [6, 'Orden de Compra', 'Purchase Order', 'Compromiso al proveedor', 'Supplier commitment', 'next'],
];

const n = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const clean = v => String(v ?? '').trim();

/** Referencia visible de la fila elegible: la del cliente o el folio de la requisición. */
export const eligibleRef = row => clean(row?.client_reference) || clean(row?.requisition) || '—';

/** Estado de adjudicación de la requisición: Con OC, Adjudicada, Adjudicación parcial o Elegible. */
export function awardBadge(row, en = false) {
  const m = (es, e) => (en ? e : es);
  if (clean(row?.purchase_orders)) return { code: 'po', text: m('Con OC', 'With PO'), tone: 'bg-sky-100 text-sky-800' };
  const items = Number(row?.item_count) || 0; const done = Number(row?.awarded_items) || 0;
  if (items && done >= items) return { code: 'awarded', text: m('Adjudicada', 'Awarded'), tone: 'bg-purple-100 text-purple-800' };
  if (done > 0) return { code: 'partial', text: m('Adjudicación parcial', 'Partial award'), tone: 'bg-amber-100 text-amber-800' };
  return { code: 'eligible', text: m('Elegible', 'Eligible'), tone: 'bg-emerald-100 text-emerald-800' };
}

const active = (lines = []) => lines.filter(l => !l.line_status || l.line_status === 'active');

/**
 * Proveedor recomendado por partida: la oferta de la cotización recomendada por el puntaje del comparativo; si esa
 * cotización no ofertó la partida, la oferta de menor precio en la misma moneda. Devuelve { [lineId]: offer|null }.
 */
export function recommendedByLine(lines = [], quotes = []) {
  const rec = scoreQuotes(quotes, lines).find(q => q.recommended) || null;
  const out = {};
  for (const l of active(lines)) {
    const offers = (l.offers || []).filter(o => o.offered && n(o.unit_price) > 0);
    let o = rec ? offers.find(x => x.quote_id === rec.id) : null;
    if (!o) {
      const cur = rec?.currency || offers[0]?.currency;
      o = offers.filter(x => x.currency === cur).sort((a, b) => n(a.unit_price) - n(b.unit_price))[0] || null;
    }
    out[l.id] = o || null;
  }
  return { quote: rec, byLine: out };
}

/** Selección inicial: la adjudicación vigente; sin ella, el recomendado. Cantidad = la adjudicada o la de la partida. */
export function definitiveInit(lines = [], recommended = {}) {
  const out = {};
  for (const l of active(lines)) {
    const cur = l.award && (l.offers || []).find(o => o.quote_id === l.award.quote_id);
    out[l.id] = { quote: cur ? cur.quote_id : (recommended[l.id]?.quote_id || ''), qty: normQty(l.award?.quantity ?? l.quantity), why: '' };
  }
  return out;
}

/** Oferta elegida para una partida (o null). */
export const chosenOffer = (line, sel) => (sel?.quote ? (line.offers || []).find(o => o.quote_id === sel.quote) || null : null);

/**
 * Valida la adjudicación definitiva.
 *  - gate: la cotización al cliente vigente debe estar aprobada por el cliente;
 *  - cada partida activa necesita proveedor definitivo con oferta, cantidad ≤ ofertada;
 *  - justificación (≥ 15 caracteres) cuando el definitivo es distinto al recomendado;
 *  - con OC vigente, cambiar una partida ya adjudicada requiere enmienda de OC (bloqueada).
 * Devuelve { ok, errors: {gate?, [lineId]: msg}, first, changed: [lineId], orders: [{supplier, currency, lines, amount}] }.
 */
export function validateAward({ lines = [], selection = {}, recommended = {}, approved = false, hasPO = false }, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const changed = []; const groups = new Map();
  if (!approved) errors.gate = m('La cotización al cliente no está aprobada: la adjudicación definitiva solo procede después de la aceptación del cliente.', 'The client quote is not approved: the definitive award only proceeds after client acceptance.');
  const act = active(lines);
  if (!act.length) errors.gate = errors.gate || m('La requisición no tiene partidas vigentes.', 'The requisition has no active items.');
  for (const l of act) {
    const s = selection[l.id] || {}; const o = chosenOffer(l, s); const r = recommended[l.id];
    if (!o) { errors[l.id] = m(`Partida ${l.line_number}: selecciona el proveedor definitivo.`, `Item ${l.line_number}: select the definitive supplier.`); continue; }
    const qty = n(s.qty);
    if (qty === null || qty <= 0) { errors[l.id] = m(`Partida ${l.line_number}: cantidad inválida.`, `Item ${l.line_number}: invalid quantity.`); continue; }
    if (n(o.quantity) !== null && qty > n(o.quantity)) { errors[l.id] = m(`Partida ${l.line_number}: la cantidad excede la ofertada por ${o.supplier_name}.`, `Item ${l.line_number}: quantity exceeds what ${o.supplier_name} offered.`); continue; }
    if (r && r.quote_id !== o.quote_id && clean(s.why).length < 15) { errors[l.id] = m(`Partida ${l.line_number}: justifica por qué el proveedor definitivo es distinto al recomendado (${r.supplier_name}); mínimo 15 caracteres.`, `Item ${l.line_number}: justify why the definitive supplier differs from the recommended one (${r.supplier_name}); minimum 15 characters.`); continue; }
    const isChange = (l.award?.quote_id || '') !== o.quote_id || normQty(l.award?.quantity ?? '') !== normQty(s.qty);
    if (isChange) {
      if (hasPO && l.award) { errors[l.id] = m(`Partida ${l.line_number}: ya tiene OC vigente; cambiar al proveedor requiere una enmienda de la OC (bloqueada).`, `Item ${l.line_number}: it already has a current PO; changing the supplier requires a PO amendment (blocked).`); continue; }
      changed.push(l.id);
    }
    const k = `${o.supplier_name}|${o.currency}`;
    const g = groups.get(k) || { supplier: o.supplier_name, currency: o.currency, lines: 0, amount: 0, quotes: new Set() };
    g.lines += 1; g.amount = Math.round((g.amount + qty * n(o.unit_price)) * 100) / 100; g.quotes.add(o.quote_folio); groups.set(k, g);
  }
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, first: keys.length ? errors[keys[0]] : '', changed, orders: [...groups.values()].map(g => ({ ...g, quotes: [...g.quotes] })) };
}
