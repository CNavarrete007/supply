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
/** Control metrics in the design order: color bar, title, colored caption. "Total facturado" lists each currency (never summed). */
export const controlCards = (c = {}, moneyRows = [], en = false) => [
  ['ready_to_invoice', en ? 'Ready to invoice' : 'Listos para facturar', en ? 'Accepted deliveries without invoice' : 'Entregas aceptadas sin factura', 'bg-amber-500', 'text-amber-600', c.ready_to_invoice],
  ['active', en ? 'Active invoices' : 'Facturas vigentes', en ? 'Non-cancelled records' : 'Registros no cancelados', 'bg-purple-600', 'text-purple-700', c.active],
  ['pending_payment', en ? 'Pending payment' : 'Pendientes de pago', en ? 'Administrative follow-up' : 'Seguimiento administrativo', 'bg-orange-600', 'text-orange-600', c.pending_payment],
  ['overdue', en ? 'Overdue' : 'Vencidas', en ? 'Due date exceeded' : 'Fecha de vencimiento superada', 'bg-rose-600', 'text-rose-600', c.overdue],
  ['paid', en ? 'Paid' : 'Pagadas', en ? 'Settled invoices' : 'Facturas liquidadas', 'bg-emerald-600', 'text-emerald-600', c.paid],
  ['total', en ? 'Total invoiced' : 'Total facturado', en ? 'Recorded nominal sum' : 'Suma nominal registrada', 'bg-cyan-600', 'text-cyan-700', null],
].map(([key, title, sub, bar, tone, n]) => ({ key, title, sub, bar, tone, value: key === 'total' ? (moneyRows.length ? moneyList(moneyRows, 'invoiced', en) : ['$0.00']) : Number(n ?? 0) }));

/** "OC-1, OC-2" → ['OC-1', 'OC-2'] (one per line in "Entregas aceptadas pendientes de factura"). */
export const poList = v => String(v ?? '').split(',').map(x => x.trim()).filter(Boolean);

/** Accepted delivery date, or a note when the acceptance only exists in an imported receipt. */
export const acceptedText = (date, en = false) => (date ? String(date).slice(0, 10) : en ? 'Accepted (no delivery date recorded)' : 'Aceptada (sin fecha de entrega registrada)');
