// Factura · tarjeta 2 "Matriz de facturas" · lógica pura (sin red).
// "Facturas por cliente": tarjetas por cliente (resumen de solo lectura del servidor, con la misma búsqueda que la
// matriz) y la matriz de un único cliente. Eliminar facturas es una escritura comercial sin endpoint: se valida
// (protecciones, número exacto y motivo) y se informa que no se eliminó.
import { money } from './model.mjs';

const clean = v => String(v ?? '').trim();
const initials = name => {
  const w = clean(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase() || '··';
};

/** Cards: "Todas las facturas" (overview, only with data) + one per client in the search. */
export function clientCards(summary = {}, en = false) {
  const items = summary?.items || [];
  const sum = k => items.reduce((n, c) => n + (Number(c[k]) || 0), 0);
  const cards = items.map(c => ({ ...c, tag: initials(c.name), isAll: false }));
  if (!cards.length) return [];
  const byCur = {};
  for (const c of items) for (const m of c.money || []) {
    const t = (byCur[m.currency] ||= { currency: m.currency, invoiced: 0, outstanding: 0 });
    t.invoiced += Number(m.invoiced) || 0; t.outstanding += Number(m.outstanding) || 0;
  }
  return [{ id: 'all', name: en ? 'All invoices' : 'Todas las facturas', tax_id: null, tag: en ? 'ALL' : 'TOD', isAll: true,
    invoices: sum('invoices'), active: sum('active'), pending: sum('pending'), overdue: sum('overdue'), paid: sum('paid'), cancelled: sum('cancelled'),
    requisitions: sum('requisitions'), projects: '', money: Object.values(byCur).sort((a, b) => a.currency.localeCompare(b.currency)) }, ...cards];
}

/** "N de M clientes" (search vs. every client with invoices). */
export const clientBadge = (summary = {}, en = false) => {
  const n = (summary?.items || []).length; const t = Number(summary?.clients_total) || 0;
  return en ? `${n} of ${t} client${t === 1 ? '' : 's'}` : `${n} de ${t} cliente${t === 1 ? '' : 's'}`;
};

/** Money lines of a card (never mixed): "$5,000.00 MXN". Outstanding only when there is some. */
export const cardMoney = (c, en = false) => (c?.money || []).map(m => ({ currency: m.currency, invoiced: money(m.invoiced, m.currency, en), outstanding: Number(m.outstanding) > 0 ? money(m.outstanding, m.currency, en) : '' }));

/** Empty state of the cards area. */
export function cardsEmpty(summary = {}, q = '', en = false) {
  if ((summary?.items || []).length) return '';
  if (clean(q) && Number(summary?.clients_total) > 0) return en ? `No client matches "${clean(q)}".` : `Ningún cliente coincide con "${clean(q)}".`;
  return en ? 'There are no invoices recorded yet.' : 'Aún no hay facturas registradas.';
}

/** Selected client header line: invoices, RFC and requisitions. */
export function clientCaption(c, en = false) {
  if (!c) return '';
  const parts = [`${c.invoices} ${en ? 'invoice(s)' : 'factura(s)'}`, `${c.requisitions} ${en ? 'requisition(s)' : 'requisición(es)'}`];
  if (!c.isAll) parts.splice(1, 0, `RFC ${clean(c.tax_id) || (en ? 'not recorded' : 'sin registrar')}`);
  return parts.join(' · ');
}

/** Why an invoice must not be deleted (kept for audit/reconciliation), or null. */
export function invoiceDeleteBlock(inv, en = false) {
  const m = (es, e) => (en ? e : es);
  if (!inv) return m('Selecciona una factura.', 'Select an invoice.');
  if (inv.state === 'paid') return m('Está pagada: se conserva para la conciliación y la auditoría. No se elimina.', 'It is paid: it is kept for reconciliation and audit. It is not deleted.');
  if (Number(inv.acknowledgments) > 0) return m(`Tiene ${inv.acknowledgments} acuse(s) de recibo del cliente: se conserva como evidencia. Para anularla regístrala como Cancelada.`, `It has ${inv.acknowledgments} client acknowledgment(s): it is kept as evidence. To void it, record it as Cancelled.`);
  return null;
}

/** Exact invoice number confirmation (case-insensitive, trimmed). */
export const invoiceNumberConfirmed = (inv, typed) => !!clean(inv?.invoice_number) && clean(typed).toLowerCase() === clean(inv.invoice_number).toLowerCase();

/** Reason for a deletion request: 10–500 characters. */
export function deleteReasonError(reason, en = false) {
  const r = clean(reason);
  if (r.length < 10) return en ? 'Describe the reason (minimum 10 characters).' : 'Describe el motivo (mínimo 10 caracteres).';
  if (r.length > 500) return en ? 'Maximum 500 characters.' : 'Máximo 500 caracteres.';
  return '';
}
