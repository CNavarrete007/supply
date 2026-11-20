// Servicios Operativos · sección 4 "Formatos y Reportes" · lógica pura (sin red).
// Datos: GET /api/v1/services/matrix (con from/to = rango de fecha de solicitud, cliente, servicio y estatus) y
// GET /api/v1/services/{id} (expediente para el Formato de Solicitud). Cada reporte se construye como un documento
// estructurado (encabezado, filtros, indicadores y secciones) que se dibuja igual en la vista previa (HTML aislado) y en el
// PDF (jsPDF), con la identidad Grupo Gerez. No escribe nada.
import { escapeHtml } from '../generalMatrix/model.mjs';
import { PO_FORMAT } from '../purchaseOrders/poPdf.mjs';
import { money, serviceRow } from './serviceMatrix.mjs';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = v => ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const num = v => Number(v) || 0;
const pct = (a, b) => (b ? `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%` : '—');
const scalar = v => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const humanKey = k => clean(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

export const REPORT_KINDS = [
  ['solicitud', '📝', 'Formato de Solicitud', 'Request format', 'Documento individual del servicio', 'Individual service document'],
  ['partidas', '📋', 'Por Partidas', 'By line', 'Detalle línea por línea', 'Line-by-line detail'],
  ['general', '📊', 'General', 'General', 'Consolidado operativo y financiero', 'Operational and financial summary'],
  ['cliente', '🤝', 'Hacia el Cliente', 'For the client', 'Sin costo interno ni margen', 'Without internal cost or margin'],
  ['gerencial', '💼', 'Gerencial', 'Management', 'Rentabilidad, riesgos y tendencias', 'Profitability, risks and trends'],
];
/** Statuses of the report filter (design) — values present in MariaDB are added by the view. */
export const REPORT_STATUSES = ['Solicitado', 'Cotizado', 'Autorizado', 'Programado', 'En ejecución', 'Pendiente de información', 'Pendiente de aprobación', 'Completado', 'Listo para facturar', 'Facturado', 'Cancelado'];
export const emptyFilters = () => ({ from: '', to: '', client: 'all', service: '', status: '' });

/** '' when valid. */
export function filtersError(f, en = false) {
  const m = (es, e) => (en ? e : es);
  if (clean(f.from) && !validDate(f.from)) return m('Fecha "Desde" inválida.', 'Invalid "From" date.');
  if (clean(f.to) && !validDate(f.to)) return m('Fecha "Hasta" inválida.', 'Invalid "To" date.');
  if (clean(f.from) && clean(f.to) && f.from > f.to) return m('"Desde" no puede ser posterior a "Hasta".', '"From" cannot be after "To".');
  return '';
}
/** Query of GET /services/matrix for the filters. */
export const filtersQuery = f => ({ from: clean(f.from), to: clean(f.to), client: f.client || 'all', service: clean(f.service), status: clean(f.status) });

export function filtersText(f, clientName = '', en = false) {
  const m = (es, e) => (en ? e : es);
  const period = clean(f.from) || clean(f.to) ? `${clean(f.from) || m('inicio', 'start')} – ${clean(f.to) || m('hoy', 'today')}` : m('Todo el periodo', 'Whole period');
  return [`${m('Periodo', 'Period')}: ${period}`, `${m('Cliente', 'Client')}: ${f.client && f.client !== 'all' ? clientName || f.client : m('Todos', 'All')}`, `${m('Servicio', 'Service')}: ${clean(f.service) || m('Todos', 'All')}`, `${m('Estatus', 'Status')}: ${clean(f.status) || m('Todos', 'All')}`].join(' · ');
}

/** "Solicitud de servicio" selector: "SRV-… · Servicio · CLIENTE". */
export const requestOptions = (items = []) => items.map(x => ({ id: x.id, label: `${clean(x.folio)} · ${clean(x.service)} · ${clean(x.client_name).toUpperCase()}` }));

const byCurrency = items => { const m = new Map(); for (const x of items) { const c = clean(x.currency) || '—'; const t = m.get(c) || { n: 0, cost: 0, price: 0, margin: 0 }; t.n += 1; t.cost += num(x.cost); t.price += num(x.price); t.margin += num(x.price) - num(x.cost); m.set(c, t); } return [...m.entries()]; };
const isInvoiced = x => !!clean(x.invoices);
const isDone = x => !!x.is_done || /^(completado|facturado)$/.test(fold(x.status));
function groupBy(items, key) {
  const m = new Map();
  for (const x of items) { const k = clean(key(x)) || '—'; const g = m.get(k) || { key: k, n: 0, open: 0, cost: 0, price: 0, margin: 0 }; g.n += 1; g.open += x.is_open ? 1 : 0; g.cost += num(x.cost); g.price += num(x.price); g.margin += num(x.price) - num(x.cost); m.set(k, g); }
  return [...m.values()];
}
const cur = items => (byCurrency(items).length === 1 ? byCurrency(items)[0][0] : '');

/** Risk flags of a service (Gerencial). */
export function serviceRisks(x, today = '', en = false) {
  const m = (es, e) => (en ? e : es);
  const out = [];
  const st = fold(x.status);
  if (/cancel/.test(st)) return out;
  const margin = num(x.price) - num(x.cost);
  if (margin < 0) out.push(m('Margen negativo', 'Negative margin'));
  else if (num(x.price) > 0 && num(x.cost) === 0) out.push(m('Costo no registrado', 'Cost not recorded'));
  if (!clean(x.authorization_type) && !clean(x.authorization_reference)) out.push(m('Sin autorización del cliente', 'No client authorization'));
  if (x.requires_supplier && !clean(x.supplier_po)) out.push(m('Sin OC de proveedor', 'No supplier PO'));
  if (x.is_open && clean(x.required_date) && today && clean(x.required_date).slice(0, 10) < today) out.push(m(`Vencido (requerido ${clean(x.required_date).slice(0, 10)})`, `Overdue (required ${clean(x.required_date).slice(0, 10)})`));
  if ((isDone(x) || /listo para facturar/.test(st)) && !isInvoiced(x)) out.push(m('Pendiente de facturar', 'Pending invoicing'));
  if (isDone(x) && !num(x.evidence_count)) out.push(m('Sin evidencia', 'No evidence'));
  return out;
}

const company = () => ({ name: PO_FORMAT.company, tagline: PO_FORMAT.tagline, address: PO_FORMAT.address, site: PO_FORMAT.site });

/**
 * Structured report. ctx: { items (filtered services), detail (GET /services/{id}), filters, clientName, today }.
 * doc: { kind, title, subtitle, head: [[k,v]], filters, kpis: [[label,value]], sections: [{ title, kv?:[[k,v]], columns?:[[label,align]], rows?, totals? }], note, landscape }
 */
export function buildReport(kind, { items = [], detail = null, filters = emptyFilters(), clientName = '', today = '' } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const base = { kind, company: company(), filters: kind === 'solicitud' ? '' : filtersText(filters, clientName, en), generated: today };
  if (kind === 'solicitud') {
    const x = detail?.item || {}; const v = serviceRow(x, en);
    return { ...base, title: m('SOLICITUD DE SERVICIO', 'SERVICE REQUEST'), subtitle: v.service, head: [[m('Folio', 'Folio'), x.folio], [m('Fecha', 'Date'), v.date], [m('Estatus', 'Status'), v.status.text]], kpis: [],
      sections: [
        { title: m('Cliente y requisición', 'Client and requisition'), kv: [[m('Cliente', 'Client'), x.client_name], [m('Proyecto', 'Project'), v.project], [m('Contrato', 'Contract'), scalar(x.contract)], [m('Requisición', 'Requisition'), v.requisition], [m('Referencia interna', 'Internal reference'), v.reference], [m('Comprador', 'Buyer'), scalar(x.buyer)], [m('Responsable', 'Responsible'), scalar(x.responsible)]] },
        { title: m('Autorización del cliente', 'Client authorization'), kv: [[m('Tipo', 'Type'), scalar(x.authorization_type)], [m('Estatus', 'Status'), scalar(x.authorization_status)], [m('Referencia', 'Reference'), scalar(x.authorization_reference)], [m('Fecha', 'Date'), scalar(x.authorization_date)], [m('Monto', 'Amount'), x.authorization_amount === null || x.authorization_amount === undefined ? '—' : money(x.authorization_amount, x.authorization_currency)], [m('Vigencia', 'Valid until'), scalar(x.authorization_valid_until)]] },
        { title: m('Ejecución', 'Execution'), kv: [[m('Fecha requerida', 'Required date'), scalar(clean(x.required_date).slice(0, 10))], [m('Cantidad', 'Quantity'), v.qty], [m('Proveedor / OC', 'Supplier / PO'), x.supplier_po ? `${x.supplier_po} · ${scalar(x.supplier_name)}` : v.po.text], [m('Evidencias', 'Evidence'), String(v.evidence)]] },
        { title: m('Importes', 'Amounts'), kv: [[m('Costo', 'Cost'), money(x.cost, x.currency)], [m('Venta', 'Sale'), money(x.price, x.currency)], [m('Margen', 'Margin'), money(x.margin, x.currency)], [m('Facturación', 'Billing'), `${v.billing.text}${v.billing.sub ? ` (${v.billing.sub})` : ''}`]] },
        { title: m('Descripción / alcance', 'Description / scope'), kv: [[m('Descripción', 'Description'), scalar(x.description)], ...(clean(x.notes) ? [[m('Observaciones', 'Notes'), x.notes]] : [])], full: true },
        ...(Object.keys(detail?.details || {}).length ? [{ title: m('Datos operativos', 'Operational data'), kv: Object.entries(detail.details).map(([k, val]) => [humanKey(k), scalar(val)]), full: true }] : []),
        ...((detail?.files || []).length ? [{ title: m('Evidencias registradas', 'Recorded evidence'), kv: detail.files.map((f, i) => [`${i + 1}`, `${clean(f.name) || '—'} · ${clean(f.role)}`]), full: true }] : []),
      ], note: (detail?.files || []).length ? m('Los archivos privados no se descargan desde este formato.', 'Private files are not downloaded from this format.') : '' };
  }
  const totals = byCurrency(items);
  const money2 = (v, c) => money(v, c);
  if (kind === 'partidas') {
    return { ...base, landscape: true, title: m('REPORTE DE SERVICIOS POR PARTIDAS', 'SERVICES REPORT BY LINE'), subtitle: m('Detalle operativo y financiero', 'Operational and financial detail'), head: [[m('Servicios', 'Services'), String(items.length)]],
      kpis: [], sections: [{ title: m('Partidas', 'Lines'), columns: [['#', 'c'], [m('Folio', 'Folio'), 'l'], [m('Fecha', 'Date'), 'l'], [m('Cliente', 'Client'), 'l'], [m('Proyecto', 'Project'), 'l'], [m('Servicio', 'Service'), 'l'], [m('Requisición', 'Requisition'), 'l'], [m('Cant.', 'Qty.'), 'r'], [m('Costo', 'Cost'), 'r'], [m('Venta', 'Sale'), 'r'], [m('Margen', 'Margin'), 'r'], [m('Estatus', 'Status'), 'l']],
        rows: items.map((x, i) => [String(i + 1), x.folio, clean(x.date).slice(0, 10) || '—', x.client_name, x.project || '—', x.service, x.requisition || '—', `${num(x.quantity)} ${clean(x.unit_label)}`.trim(), money2(x.cost), money2(x.price), money2(num(x.price) - num(x.cost)), x.status]),
        totals: totals.map(([c, t]) => ['', `${m('Total', 'Total')} ${c}`, '', '', '', '', '', String(t.n), money2(t.cost, c), money2(t.price, c), money2(t.margin, c), '']) }],
      note: items.length ? '' : m('Sin servicios con los filtros aplicados.', 'No services with the applied filters.') };
  }
  if (kind === 'cliente') {
    const groups = groupBy(items, x => x.client_name);
    return { ...base, landscape: true, title: m('REPORTE DE SERVICIOS AL CLIENTE', 'CLIENT SERVICES REPORT'), subtitle: filters.client && filters.client !== 'all' ? clientName : m('Todos los clientes', 'All clients'), head: [[m('Servicios', 'Services'), String(items.length)]], kpis: [],
      sections: groups.map(g => { const rows = items.filter(x => (clean(x.client_name) || '—') === g.key); return { title: g.key, columns: [[m('Folio', 'Folio'), 'l'], [m('Fecha', 'Date'), 'l'], [m('Servicio', 'Service'), 'l'], [m('Proyecto', 'Project'), 'l'], [m('Requisición', 'Requisition'), 'l'], [m('Autorización', 'Authorization'), 'l'], [m('Cantidad', 'Quantity'), 'r'], [m('Importe', 'Amount'), 'r'], [m('Estatus', 'Status'), 'l']],
        rows: rows.map(x => [x.folio, clean(x.date).slice(0, 10) || '—', x.service, x.project || '—', x.requisition || '—', [clean(x.authorization_type), clean(x.authorization_reference)].filter(Boolean).join(' · ') || '—', `${num(x.quantity)} ${clean(x.unit_label)}`.trim(), money2(x.price, x.currency), x.status]),
        totals: byCurrency(rows).map(([c, t]) => [`${m('Total', 'Total')} ${c}`, '', '', '', '', '', String(t.n), money2(t.price, c), '']) }; }),
      note: items.length ? m('Documento para el cliente: no incluye costo interno ni margen.', 'Client document: it does not include internal cost or margin.') : m('Sin servicios con los filtros aplicados.', 'No services with the applied filters.') };
  }
  const c0 = cur(items);
  const sumPrice = items.reduce((n, x) => n + num(x.price), 0); const sumCost = items.reduce((n, x) => n + num(x.cost), 0);
  const groupTable = (title, gs) => ({ title, columns: [[m('Concepto', 'Item'), 'l'], [m('Servicios', 'Services'), 'r'], [m('Abiertos', 'Open'), 'r'], [m('Venta', 'Sale'), 'r'], [m('Costo', 'Cost'), 'r'], [m('Margen', 'Margin'), 'r'], [m('Margen %', 'Margin %'), 'r']],
    rows: gs.map(g => [g.key, String(g.n), String(g.open), money2(g.price, c0), money2(g.cost, c0), money2(g.margin, c0), pct(g.margin, g.price)]) });
  const multi = totals.length > 1 ? m(' Hay importes en varias monedas: los totales por moneda se muestran en "Totales por moneda".', ' There are amounts in several currencies: totals per currency are shown in "Totals per currency".') : '';
  const currencyTable = { title: m('Totales por moneda', 'Totals per currency'), columns: [[m('Moneda', 'Currency'), 'l'], [m('Servicios', 'Services'), 'r'], [m('Venta', 'Sale'), 'r'], [m('Costo', 'Cost'), 'r'], [m('Margen', 'Margin'), 'r'], [m('Margen %', 'Margin %'), 'r']],
    rows: totals.map(([c, t]) => [c, String(t.n), money2(t.price, c), money2(t.cost, c), money2(t.margin, c), pct(t.margin, t.price)]) };
  if (kind === 'general') {
    return { ...base, title: m('REPORTE GENERAL DE SERVICIOS', 'GENERAL SERVICES REPORT'), subtitle: m('Consolidado operativo y financiero', 'Operational and financial summary'), head: [[m('Servicios', 'Services'), String(items.length)]],
      kpis: [[m('Servicios', 'Services'), String(items.length)], [m('Abiertos', 'Open'), String(items.filter(x => x.is_open).length)], [m('Completados', 'Completed'), String(items.filter(isDone).length)], [m('Facturados', 'Invoiced'), String(items.filter(isInvoiced).length)],
        [m('Venta', 'Sale'), money2(sumPrice, c0)], [m('Costo', 'Cost'), money2(sumCost, c0)], [m('Margen', 'Margin'), money2(sumPrice - sumCost, c0)], [m('Margen %', 'Margin %'), pct(sumPrice - sumCost, sumPrice)]],
      sections: [groupTable(m('Por estatus', 'By status'), groupBy(items, x => x.status)), groupTable(m('Por tipo de servicio', 'By service type'), groupBy(items, x => x.service)), groupTable(m('Por cliente', 'By client'), groupBy(items, x => x.client_name)), currencyTable],
      note: `${items.length ? '' : m('Sin servicios con los filtros aplicados.', 'No services with the applied filters.')}${multi}`.trim() };
  }
  // gerencial
  const risky = items.map(x => ({ x, r: serviceRisks(x, today, en) })).filter(y => y.r.length);
  const months = groupBy(items, x => clean(x.date).slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
  const rank = gs => gs.sort((a, b) => b.margin - a.margin);
  return { ...base, title: m('REPORTE GERENCIAL DE SERVICIOS', 'SERVICES MANAGEMENT REPORT'), subtitle: m('Rentabilidad, riesgos y tendencias', 'Profitability, risks and trends'), head: [[m('Servicios', 'Services'), String(items.length)]],
    kpis: [[m('Venta', 'Sale'), money2(sumPrice, c0)], [m('Costo', 'Cost'), money2(sumCost, c0)], [m('Margen', 'Margin'), money2(sumPrice - sumCost, c0)], [m('Margen %', 'Margin %'), pct(sumPrice - sumCost, sumPrice)], [m('Servicios en riesgo', 'Services at risk'), String(risky.length)], [m('Pendientes de facturar', 'Pending invoicing'), String(items.filter(x => serviceRisks(x, today, en).some(r => /facturar|invoicing/.test(r))).length)]],
    sections: [groupTable(m('Rentabilidad por tipo de servicio', 'Profitability by service type'), rank(groupBy(items, x => x.service))), groupTable(m('Rentabilidad por cliente', 'Profitability by client'), rank(groupBy(items, x => x.client_name))),
      { title: m('Riesgos', 'Risks'), columns: [[m('Folio', 'Folio'), 'l'], [m('Cliente', 'Client'), 'l'], [m('Servicio', 'Service'), 'l'], [m('Estatus', 'Status'), 'l'], [m('Riesgo(s)', 'Risk(s)'), 'l']], rows: risky.map(({ x, r }) => [x.folio, x.client_name, x.service, x.status, r.join('; ')]) },
      { title: m('Tendencia mensual', 'Monthly trend'), columns: [[m('Mes', 'Month'), 'l'], [m('Servicios', 'Services'), 'r'], [m('Venta', 'Sale'), 'r'], [m('Costo', 'Cost'), 'r'], [m('Margen', 'Margin'), 'r'], [m('Margen %', 'Margin %'), 'r']], rows: months.map(g => [g.key || '—', String(g.n), money2(g.price, c0), money2(g.cost, c0), money2(g.margin, c0), pct(g.margin, g.price)]) },
      ...(totals.length > 1 ? [currencyTable] : [])],
    note: `${items.length ? '' : m('Sin servicios con los filtros aplicados.', 'No services with the applied filters.')}${multi}`.trim() };
}

/** HTML of a report (iframe sandbox=""), every value escaped. */
export function reportHtml(doc, en = false, { logoUrl = '/image_923273.svg' } = {}) {
  const e = escapeHtml; const L = (es, x) => (en ? x : es);
  const table = s => `<table class="t"><thead><tr>${s.columns.map(([h, a]) => `<th class="${a}">${e(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.length ? s.rows.map(r => `<tr>${r.map((c, i) => `<td class="${s.columns[i][1]}">${e(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${s.columns.length}" class="c muted">${L('Sin registros.', 'No records.')}</td></tr>`}${(s.totals || []).map(r => `<tr class="tot">${r.map((c, i) => `<td class="${s.columns[i][1]}">${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const kv = s => `<table class="kv">${s.kv.map(([k, v]) => `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`).join('')}</table>`;
  const kvs = doc.sections.filter(s => s.kv && !s.full); const rest = doc.sections.filter(s => !(s.kv && !s.full));
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${e(doc.title)}</title><style>
@page { size: letter ${doc.landscape ? 'landscape' : 'portrait'}; margin: 1.1cm; } * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; padding: 24px 28px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 10px; background: #fff; }
.hd { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid #1e385c; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 180px; } .brand img { width: 44px; height: 44px; object-fit: contain; } .brand .n { font-size: 16px; font-weight: 900; color: #ea580c; } .brand .tg { font-size: 7px; font-weight: 700; color: #64748b; letter-spacing: 1px; }
.ttl { flex: 1; text-align: center; } .ttl h1 { margin: 0; font-size: 18px; } .ttl div { margin-top: 3px; font-size: 9px; color: #1d4ed8; }
.meta { text-align: right; font-size: 8.5px; color: #475569; line-height: 1.7; min-width: 150px; } .meta b { color: #0f172a; }
.flt { margin-top: 10px; font-size: 8.5px; color: #475569; } .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
.kpi { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; background: #f8fafc; } .kpi .v { font-size: 13px; font-weight: 900; } .kpi .l { font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; } .box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 3px; padding: 9px 11px; margin-top: 12px; } .grid .box { margin-top: 0; }
.lbl { font-size: 8.5px; font-weight: 800; color: #1e385c; text-transform: uppercase; margin-bottom: 6px; }
.kv { width: 100%; border-collapse: collapse; } .kv th { text-align: left; width: 40%; font-weight: 700; color: #475569; padding: 2px 6px 2px 0; vertical-align: top; } .kv td { padding: 2px 0; vertical-align: top; word-break: break-word; }
.t { width: 100%; border-collapse: collapse; font-size: 8.5px; background: #fff; } .t th { background: #e2e8f0; padding: 5px 4px; border: 1px solid #94a3b8; font-size: 7.5px; text-transform: uppercase; } .t td { padding: 5px 4px; border: 1px solid #cbd5e1; vertical-align: top; }
.t .r { text-align: right; white-space: nowrap; } .t .c { text-align: center; } .t .l { text-align: left; } .tot td { font-weight: 800; background: #f1f5f9; } .muted { color: #64748b; }
.note { margin-top: 10px; font-size: 8.5px; color: #475569; } .foot { margin-top: 16px; text-align: center; font-size: 7.5px; color: #94a3b8; }
</style></head><body>
<div class="hd"><div class="brand"><img src="${e(logoUrl)}" alt="Grupo Gerez"><div><div class="n">${e(doc.company.name)}</div><div class="tg">${doc.company.tagline.map(e).join('<br>')}</div></div></div>
<div class="ttl"><h1>${e(doc.title)}</h1><div>${e(doc.subtitle)}</div></div>
<div class="meta">${doc.head.map(([k, v]) => `<div>${e(k)}: <b>${e(v)}</b></div>`).join('')}${doc.generated ? `<div>${L('Generado', 'Generated')}: ${e(doc.generated)}</div>` : ''}</div></div>
${doc.filters ? `<div class="flt">${e(doc.filters)}</div>` : ''}
${doc.kpis.length ? `<div class="kpis">${doc.kpis.map(([l, v]) => `<div class="kpi"><div class="v">${e(v)}</div><div class="l">${e(l)}</div></div>`).join('')}</div>` : ''}
${kvs.length ? `<div class="grid">${kvs.map(s => `<div class="box"><div class="lbl">${e(s.title)}</div>${kv(s)}</div>`).join('')}</div>` : ''}
${rest.map(s => `<div class="box"><div class="lbl">${e(s.title)}</div>${s.kv ? kv(s) : table(s)}</div>`).join('')}
${doc.note ? `<div class="note">${e(doc.note)}</div>` : ''}
<div class="foot">${e(doc.company.name)} · ${e(doc.company.address)} · ${e(doc.company.site)}</div>
</body></html>`;
}

/** "Formato de Solicitud" HTML (also used by the matrix "Solicitud" button). */
export const serviceRequestHtml = (detail, en = false, opts = {}) => reportHtml(buildReport('solicitud', { detail }, en), en, opts);

const NAVY = [30, 56, 92]; const ORANGE = [234, 88, 12]; const INK = [15, 23, 42]; const GRAY = [100, 116, 139]; const LINE = [203, 213, 225]; const SOFT = [248, 250, 252];

/** PDF of a report (jsPDF injected so it is testable in Node). */
export function buildReportPdf(JsPDF, doc, logo = null) {
  const pdf = new JsPDF({ unit: 'pt', format: 'letter', orientation: doc.landscape ? 'landscape' : 'portrait' });
  const W = pdf.internal.pageSize.getWidth(); const H = pdf.internal.pageSize.getHeight(); const M = 32; const CW = W - 2 * M; let y = M;
  const font = (size, style = 'normal', color = INK) => { pdf.setFont('helvetica', style); pdf.setFontSize(size); pdf.setTextColor(...color); };
  const fit = (text, w) => pdf.splitTextToSize(String(text ?? ''), w).flatMap(line => { const out = []; let c = ''; for (const ch of line) { if (c && pdf.getTextWidth(c + ch) > w) { out.push(c); c = ch; } else c += ch; } return [...out, c]; });
  const room = h => { if (y + h > H - 40) { pdf.addPage(); y = M; return true; } return false; };
  pdf.setProperties({ title: doc.title, subject: doc.company.name, creator: 'SupplyFlow' });
  if (logo) { try { pdf.addImage(logo, 'PNG', M, y, 36, 36); } catch { /* logotipo opcional */ } }
  font(12, 'bold', ORANGE); pdf.text(doc.company.name, M + 42, y + 15); font(5.5, 'bold', GRAY); pdf.text(doc.company.tagline, M + 42, y + 23);
  font(14, 'bold'); pdf.text(doc.title, W / 2, y + 15, { align: 'center' }); font(8, 'normal', [29, 78, 216]); pdf.text(String(doc.subtitle || ''), W / 2, y + 27, { align: 'center' });
  font(7.5, 'normal', GRAY); [...doc.head.map(([k, v]) => `${k}: ${v}`), ...(doc.generated ? [`${doc.generated}`] : [])].forEach((t, i) => pdf.text(String(t), W - M, y + 8 + i * 10, { align: 'right' }));
  y += 44; pdf.setFillColor(...NAVY); pdf.rect(M, y, CW, 2.4, 'F'); y += 12;
  if (doc.filters) { font(7.5, 'normal', GRAY); const l = fit(doc.filters, CW); pdf.text(l, M, y + 6); y += l.length * 9 + 6; }
  if (doc.kpis.length) {
    const per = 4; const kw = (CW - (per - 1) * 8) / per;
    doc.kpis.forEach(([l, v], i) => { const col = i % per; if (col === 0 && i) y += 40; if (col === 0) room(40); const x = M + col * (kw + 8); pdf.setFillColor(...SOFT); pdf.setDrawColor(...LINE); pdf.rect(x, y, kw, 34, 'FD'); font(11, 'bold'); pdf.text(String(v), x + 7, y + 15); font(6.5, 'bold', GRAY); pdf.text(String(l).toUpperCase(), x + 7, y + 27); });
    y += 46;
  }
  for (const s of doc.sections) {
    room(40); font(8, 'bold', NAVY); pdf.text(String(s.title).toUpperCase(), M, y + 8); y += 14;
    if (s.kv) {
      for (const [k, v] of s.kv) { const vl = fit(v, CW * 0.62); const h = Math.max(12, vl.length * 9 + 3); room(h); font(7.5, 'bold', GRAY); pdf.text(fit(k, CW * 0.34)[0], M, y + 8); font(7.5); pdf.text(vl, M + CW * 0.36, y + 8); y += h; }
      y += 8; continue;
    }
    const n = s.columns.length;
    const weight = s.columns.map((c, i) => Math.min(30, Math.max(String(c[0]).length, ...s.rows.slice(0, 50).map(r => String(r[i] ?? '').length), ...(s.totals || []).map(r => String(r[i] ?? '').length))) + 2);
    const sum = weight.reduce((a, b) => a + b, 0); const ws = weight.map(w => (w / sum) * CW);
    const xs = []; let cx = M; ws.forEach(w => { xs.push(cx); cx += w; });
    const head = () => { pdf.setFillColor(226, 232, 240); pdf.setDrawColor(148, 163, 184); pdf.rect(M, y, CW, 16, 'FD'); font(6.3, 'bold'); s.columns.forEach(([h, a], i) => { const tx = a === 'r' ? xs[i] + ws[i] - 3 : a === 'c' ? xs[i] + ws[i] / 2 : xs[i] + 3; pdf.text(fit(String(h).toUpperCase(), ws[i] - 4)[0], tx, y + 10.5, { align: a === 'r' ? 'right' : a === 'c' ? 'center' : 'left' }); }); y += 16; };
    room(32); head();
    const rows = s.rows.length ? s.rows.map(r => ({ r, tot: false })) : [{ r: [`—`, ...Array(n - 1).fill('')], tot: false }];
    for (const { r, tot } of [...rows, ...(s.totals || []).map(t => ({ r: t, tot: true }))]) {
      font(6.8, tot ? 'bold' : 'normal');
      const cells = r.map((c, i) => fit(c, ws[i] - 6)); const h = Math.max(14, Math.max(...cells.map(c => c.length)) * 8 + 6);
      if (room(h)) head();
      if (tot) { pdf.setFillColor(241, 245, 249); pdf.rect(M, y, CW, h, 'F'); }
      pdf.setDrawColor(...LINE); pdf.rect(M, y, CW, h, 'S');
      font(6.8, tot ? 'bold' : 'normal'); cells.forEach((c, i) => { const a = s.columns[i][1]; const tx = a === 'r' ? xs[i] + ws[i] - 3 : a === 'c' ? xs[i] + ws[i] / 2 : xs[i] + 3; pdf.text(c, tx, y + 9.5, { align: a === 'r' ? 'right' : a === 'c' ? 'center' : 'left' }); });
      y += h;
    }
    y += 12;
  }
  if (doc.note) { const l = fit(doc.note, CW); room(l.length * 9 + 6); font(7.5, 'italic', GRAY); pdf.text(l, M, y + 6); }
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { pdf.setPage(p); font(6.5, 'normal', [148, 163, 184]); pdf.text(`${doc.company.name} · ${doc.company.address}`, W / 2, H - 18, { align: 'center' }); if (pages > 1) pdf.text(`${p}/${pages}`, W - M, H - 18, { align: 'right' }); }
  return pdf;
}

export const reportFileName = (doc, folio = '') => `${(folio || doc.title).replace(/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ-]+/g, '-').replace(/^-+|-+$/g, '')}.pdf`;
