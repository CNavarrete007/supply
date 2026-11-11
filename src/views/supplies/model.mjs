// Suministros de proveedores · lógica pura (sin red). Catálogo SIN precios: el precio solo existe en la cotización
// formal del proveedor. Los códigos guardados en MariaDB se muestran tal cual; solo se traducen los conocidos.
const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const TYPES = { product: ['Producto', 'Product'], service: ['Servicio', 'Service'], rent: ['Renta', 'Rent'], rental: ['Renta', 'Rent'], consumable: ['Consumible', 'Consumable'], spare_part: ['Refacción', 'Spare part'], equipment: ['Equipo', 'Equipment'], storage: ['Almacenamiento', 'Storage'], tool: ['Herramienta', 'Tool'] };
const TYPE_ES = Object.fromEntries(Object.values(TYPES).map(v => [fold(v[0]), v]));
export const typeLabel = (v, en = false) => (!v ? '—' : (TYPES[v] || TYPE_ES[fold(v)])?.[en ? 1 : 0] ?? String(v));

const STATUS = { active: ['Activo', 'Active'], available: ['Activo', 'Active'], inactive: ['Inactivo', 'Inactive'], unavailable: ['No disponible', 'Unavailable'] };
const STATUS_ES = { activo: 'active', inactivo: 'inactive', 'no disponible': 'unavailable' };
export const statusKey = v => (STATUS[v] ? (v === 'available' ? 'active' : v) : STATUS_ES[fold(v)] || 'other');
export const statusLabel = (v, en = false) => STATUS[statusKey(v)]?.[en ? 1 : 0] ?? (v ? String(v) : '—');
export const STATUS_TONE = { active: 'bg-emerald-50 text-emerald-700 border-emerald-200', inactive: 'bg-slate-100 text-slate-600 border-slate-200', unavailable: 'bg-amber-50 text-amber-700 border-amber-200', other: 'bg-slate-100 text-slate-600 border-slate-200' };

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fmt = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
export const leadTime = o => (num(o?.lead_time_value) === null ? '' : `${fmt(num(o.lead_time_value))} ${o.lead_time_unit || ''}`.trim());
export const credit = (o, en = false) => [o?.credit_type, num(o?.credit_days) !== null ? `${num(o.credit_days)} ${en ? 'days' : 'días'}` : ''].filter(Boolean).join(' · ');
/** Lead time is averaged only for day-based units (business or calendar days); other units are reported apart. */
export const isDayUnit = u => /^(d[ií]as?|days?|business[_ ]?days?|calendar[_ ]?days?|d[ií]as? (h[aá]biles|naturales))$/i.test(String(u || '').trim());

const mode = list => { const m = new Map(); for (const x of list) if (x) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es'))[0]?.[0] || null; };
const distinct = list => [...new Set(list.map(x => (x ?? '').toString().trim()).filter(Boolean))];

/** Commercial summary of ONE supplier from all its offerings (+ supplier record for habitual terms and rating). */
export function supplierCommercial(offerings = [], supplier = null) {
  const active = offerings.filter(o => statusKey(o.status) === 'active');
  const dayBased = offerings.filter(o => num(o.lead_time_value) !== null && isDayUnit(o.lead_time_unit));
  const timed = offerings.filter(o => num(o.lead_time_value) !== null);
  return {
    registered: offerings.length, active: active.length,
    categories: distinct(offerings.map(o => o.category)), generalCategory: mode(offerings.map(o => o.category)),
    avgDays: dayBased.length ? Math.round(dayBased.reduce((s, o) => s + num(o.lead_time_value), 0) / dayBased.length * 10) / 10 : null,
    dayBased: dayBased.length, timed: timed.length,
    creditTypes: distinct(offerings.map(o => o.credit_type)), coverages: distinct(offerings.map(o => o.coverage)),
    currencies: distinct(offerings.map(o => o.currency)), activeItems: active.map(o => o.name),
    habitualCurrency: supplier?.currency || mode(offerings.map(o => o.currency)),
    habitualLead: supplier ? leadTime(supplier) : '', habitualCredit: supplier ? credit(supplier) : '',
    creditDays: num(supplier?.credit_days), rating: num(supplier?.rating), ratingScale: supplier?.rating_scale || null,
  };
}

/** Supplier cards ("Tarjetas por proveedor") from the server summary; others = total − active. */
export function supplierCards(summary = {}) {
  const items = (summary.suppliers || []).map(s => ({ ...s, others: Math.max(0, (s.total || 0) - (s.active || 0)) }));
  const total = items.reduce((n, s) => n + s.total, 0), active = items.reduce((n, s) => n + s.active, 0);
  return { all: { id: 'all', total, active, others: total - active, suppliers: items.length }, items };
}
