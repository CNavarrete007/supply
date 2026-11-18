// Órdenes de Compra · tarjeta 1 "Emisión de orden de compra" · lógica pura (sin red).
// Regla del diseño: 1 requisición → 1 OC por proveedor ganador, solo con la Cotización al Cliente APROBADA y adjudicación
// definitiva por partida; las cotizaciones perdedoras nunca aparecen. Emitir OC es una escritura comercial bloqueada:
// "Crear una OC por cada proveedor" valida y explica qué se generaría, sin escribir.
import { money } from './model.mjs';

const clean = v => String(v ?? '').trim();
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
const round2 = n => Math.round(n * 100) / 100;

/**
 * Selector options. ready = client approved + at least one awarded item (enabled); no_award = approved without definitive
 * award (shown disabled). Requisitions with awards but WITHOUT client approval are not offered (counted in `waiting`).
 */
export function issuanceOptions(data = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const reqs = data.requisitions || [];
  const options = reqs.filter(r => r.client_approved).map(r => {
    const ready = r.awarded_items > 0;
    const ref = clean(r.client_reference) ? ` · ${clean(r.client_reference)}` : '';
    const tail = ready ? '' : m(' — sin adjudicación definitiva', ' — no definitive award');
    return { id: r.id, ready, label: `${r.folio}${ref} · ${r.client_name}${tail}`, req: r };
  }).sort((a, b) => Number(b.ready) - Number(a.ready) || a.req.folio.localeCompare(b.req.folio));
  const waiting = reqs.filter(r => !r.client_approved && r.awarded_items > 0);
  return { options, waiting, quotesReceived: options.filter(o => o.ready).reduce((n, o) => n + (Number(o.req.quotes_received) || 0), 0) };
}

/** Winning suppliers of a requisition with their awarded lines, totals per currency and the PO already generated (if any). */
export function winningSuppliers(data = {}, requisitionId = '') {
  if (!requisitionId) return [];
  const lines = (data.lines || []).filter(l => l.requisition_id === requisitionId);
  return (data.items || []).filter(r => r.requisition_id === requisitionId).map(r => {
    const own = lines.filter(l => l.supplier_id === r.supplier_id).sort((a, b) => num(a.line_number) - num(b.line_number));
    const totals = {};
    for (const l of own) totals[l.currency] = round2((totals[l.currency] || 0) + num(l.subtotal));
    const currencies = Object.keys(totals).sort();
    const po = clean(r.active_pos);
    return { id: r.supplier_id, name: r.supplier_name, lines: own, items: Number(r.items) || own.length, totals, currencies,
      quotes: [...new Set(own.map(l => l.quote_folio).filter(Boolean))], po, generated: !!po };
  }).sort((a, b) => Number(a.generated) - Number(b.generated) || a.name.localeCompare(b.name));
}

/** "$1,500.00 USD" (one per currency; a PO never mixes currencies). */
export const supplierTotal = (s, en = false) => (s?.currencies || []).map(c => money(s.totals[c], c, en)).join(' + ');

/** POs still to generate for the selected requisition. */
export const toGenerate = suppliers => suppliers.filter(s => !s.generated).length;

/**
 * "Crear una OC por cada proveedor": { ok, errors, warnings, orders } — orders = one per pending winning supplier.
 * Never writes: when ok, the caller reports that nothing was generated (commercial write blocked).
 */
export function validateIssuance(option, suppliers = [], en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = []; const warnings = [];
  if (!option) return { ok: false, errors: [m('Selecciona una requisición aprobada por el cliente.', 'Select a requisition approved by the client.')], warnings, orders: [] };
  const r = option.req;
  if (!r.client_approved) errors.push(m('La Cotización al Cliente de esta requisición no está aprobada: no se puede emitir OC.', 'The client quote of this requisition is not approved: a PO cannot be issued.'));
  if (!suppliers.length || !r.awarded_items) errors.push(m('La requisición no tiene adjudicación definitiva por partida. Confírmala en Cotizaciones → Adjudicación definitiva.', 'The requisition has no definitive award per item. Confirm it in Quotes → Definitive award.'));
  const pending = suppliers.filter(s => !s.generated);
  if (suppliers.length && !pending.length) errors.push(m('Todas las OC de esta requisición ya fueron generadas (una por proveedor ganador).', 'All POs of this requisition were already generated (one per winning supplier).'));
  for (const s of pending) {
    if (s.currencies.length > 1) errors.push(m(`${s.name}: sus partidas ganadas están en varias monedas (${s.currencies.join(', ')}); una OC solo admite una moneda.`, `${s.name}: its awarded items are in several currencies (${s.currencies.join(', ')}); a PO admits a single currency.`));
    if (!s.lines.length) errors.push(m(`${s.name}: no se encontraron las partidas adjudicadas.`, `${s.name}: the awarded items were not found.`));
  }
  if (r.item_count && r.awarded_items < r.item_count) warnings.push(m(`${r.item_count - r.awarded_items} de ${r.item_count} partida(s) aún sin adjudicación definitiva: no se incluirán en ninguna OC.`, `${r.item_count - r.awarded_items} of ${r.item_count} item(s) still without a definitive award: they will not be included in any PO.`));
  const done = suppliers.filter(s => s.generated);
  if (done.length && pending.length) warnings.push(m(`Ya generadas: ${done.map(s => `${s.po} (${s.name})`).join(', ')}. Solo se emitirían las faltantes.`, `Already generated: ${done.map(s => `${s.po} (${s.name})`).join(', ')}. Only the missing ones would be issued.`));
  const orders = errors.length ? [] : pending.map(s => ({ supplier: s.name, items: s.lines.length, total: supplierTotal(s, en) }));
  return { ok: !errors.length, errors, warnings, orders };
}

/** Message after a valid "Crear": nothing is written. */
export function issuanceLockedText(option, orders = [], en = false) {
  const list = orders.map(o => `${o.supplier}: ${o.total} · ${o.items} ${en ? 'item(s)' : 'partida(s)'}`).join('; ');
  return en
    ? `Data validated, but the ${orders.length} PO(s) for ${option.req.folio} were not generated (${list}): issuing purchase orders is a commercial write blocked until authorized.`
    : `Datos validados, pero ${orders.length === 1 ? 'no se generó la OC' : `no se generaron las ${orders.length} OC`} de ${option.req.folio} (${list}): emitir órdenes de compra es una escritura comercial bloqueada hasta su autorización.`;
}
