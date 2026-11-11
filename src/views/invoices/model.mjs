// Factura · lógica pura (sin red). Solo lectura: registrar, editar, cancelar o eliminar facturas y descargar archivos
// privados sigue bloqueado.
import { money } from '../generalMatrix/model.mjs';

export { money };
const STATES = { pending: ['Pendiente de pago', 'Pending payment'], overdue: ['Vencida', 'Overdue'], paid: ['Pagada', 'Paid'], cancelled: ['Cancelada', 'Cancelled'] };
export const stateLabel = (s, en = false) => STATES[s]?.[en ? 1 : 0] ?? (s ? String(s) : '—');
export const stateTone = s => ({ pending: 'bg-amber-50 text-amber-700 border-amber-200', overdue: 'bg-rose-50 text-rose-700 border-rose-200', paid: 'bg-emerald-50 text-emerald-700 border-emerald-200', cancelled: 'bg-slate-100 text-slate-500 border-slate-200' }[s] || 'bg-blue-50 text-blue-700 border-blue-200');
/** Status shown to the user: the original (Apps Script) status when present, else the derived state. */
export const statusText = (inv, en = false) => inv?.legacy_status || stateLabel(inv?.state, en);
const ACCEPT = { accepted: ['Aceptada', 'Accepted'], pending: ['Pendiente', 'Pending'], rejected: ['Rechazada', 'Rejected'] };
export const acceptLabel = (v, en = false) => ACCEPT[v]?.[en ? 1 : 0] ?? (v ? String(v) : '—');
export const daysOverdue = (due, today) => {
  if (!due) return null;
  const d = Math.round((Date.parse(`${String(today).slice(0, 10)}T00:00:00Z`) - Date.parse(`${String(due).slice(0, 10)}T00:00:00Z`)) / 86400000);
  return d > 0 ? d : 0;
};
/** Money list per currency (never summed across currencies). */
export const moneyList = (rows = [], key = 'amount', en = false) => rows.filter(r => Number(r[key]) !== 0 || key === 'amount' || key === 'invoiced').map(r => money(r[key], r.currency, en));
/** Control metrics in the design order with their color bars. */
export const controlCards = (c = {}, moneyRows = [], en = false) => [
  ['ready_to_invoice', en ? 'Ready to invoice' : 'Listos para facturar', 'bg-amber-500', c.ready_to_invoice],
  ['active', en ? 'Active invoices' : 'Facturas vigentes', 'bg-purple-600', c.active],
  ['pending_payment', en ? 'Pending payment' : 'Pendientes de pago', 'bg-orange-500', c.pending_payment],
  ['overdue', en ? 'Overdue' : 'Vencidas', 'bg-rose-600', c.overdue],
  ['paid', en ? 'Paid' : 'Pagadas', 'bg-emerald-500', c.paid],
  ['total', en ? 'Total invoiced' : 'Total facturado', 'bg-teal-600', null],
].map(([key, title, bar, n]) => ({ key, title, bar, value: key === 'total' ? (moneyRows.length ? moneyList(moneyRows, 'invoiced', en) : ['$0.00']) : Number(n ?? 0) }));
