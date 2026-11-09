import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BarChart3, Building2, ClipboardList, FileText, Loader2, RefreshCw, ShoppingCart, Truck, AlertCircle } from 'lucide-react';
import { analyticsOverview, analyticsReport } from '../analyticsApi';
import { matrixClients } from '../matrixApi';

const formatCount = (value) => new Intl.NumberFormat('es-MX').format(Number(value) || 0);
const formatAmount = (value, currency, language) => {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', {
    style: 'currency', currency: currency || 'MXN', maximumFractionDigits: 2,
  }).format(n) : `${value} ${currency}`;
};

const milestones = [
  { key: 'with_rfq', es: 'Con RFQ', en: 'With RFQ', color: 'bg-indigo-500' },
  { key: 'with_supplier_quote', es: 'Con oferta de proveedor', en: 'With supplier offer', color: 'bg-violet-500' },
  { key: 'with_customer_quote', es: 'Con cotización al cliente', en: 'With client quote', color: 'bg-sky-500' },
  { key: 'with_purchase_order', es: 'Con orden de compra', en: 'With purchase order', color: 'bg-amber-500' },
  { key: 'with_receipt', es: 'Con recepción', en: 'With receipt', color: 'bg-emerald-500' },
  { key: 'with_delivery', es: 'Con entrega', en: 'With delivery', color: 'bg-teal-500' },
  { key: 'with_invoice', es: 'Con factura', en: 'With invoice', color: 'bg-rose-500' },
];

function FilterLabel({ children }) {
  return <label className="block text-[11px] font-bold text-slate-600 mb-1.5">{children}</label>;
}

function StatCard({ label, value, hint, Icon, tint = 'blue' }) {
  const colors = { blue: 'border-t-blue-500 text-blue-700 bg-blue-50', violet: 'border-t-violet-500 text-violet-700 bg-violet-50', amber: 'border-t-amber-500 text-amber-700 bg-amber-50', teal: 'border-t-teal-500 text-teal-700 bg-teal-50' };
  return <div className="bg-white rounded-2xl p-4 border border-slate-200 border-t-4 shadow-sm min-w-0" style={{borderTopColor: tint === 'blue' ? '#3b82f6' : tint === 'violet' ? '#8b5cf6' : tint === 'amber' ? '#f59e0b' : '#14b8a6'}}>
    <div className="flex justify-between items-start gap-3"><div className="min-w-0"><p className="text-2xl font-black text-slate-900 tabular-nums">{formatCount(value)}</p><p className="text-xs font-bold text-slate-700 mt-1">{label}</p></div><div className={`p-2 rounded-xl ${colors[tint]?.split(' ').slice(1).join(' ') || 'bg-blue-50'}`}><Icon size={19}/></div></div>
    <p className="text-[11px] text-slate-500 mt-3 leading-snug">{hint}</p>
  </div>;
}

export const Dashboard = ({ onNavigate = () => {}, lang, language }) => {
  const activeLang = lang || language || 'es';
  const isEn = activeLang === 'en' || activeLang === 'English' || activeLang === 'EN';
  const t = (es, en) => isEn ? en : es;
  const [clients, setClients] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', client: 'all' });
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const dateInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  useEffect(() => {
    const c = new AbortController();
    matrixClients(c.signal).then(result => {
      if (!c.signal.aborted) setClients(result.items || []);
    }).catch(() => { if (!c.signal.aborted) setClients([]); });
    return () => c.abort();
  }, []);

  useEffect(() => {
    if (dateInvalid) { setData(null); setRecent([]); setError(t('El rango de fechas es inválido.', 'Invalid date range.')); setLoading(false); return; }
    const c = new AbortController();
    setLoading(true); setData(null); setError('');
    Promise.all([
      analyticsOverview(filters, c.signal),
      analyticsReport({ ...filters, has: 'all', q: '', page: 1, page_size: 5 }, c.signal),
    ]).then(([overview, report]) => {
      if (!c.signal.aborted) { setData(overview); setRecent(report.items || []); }
    }).catch(e => { if (!c.signal.aborted) setError(e.message || t('Error al consultar la API.', 'API request failed.')); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [filters.from, filters.to, filters.client, refresh, dateInvalid]);

  const summary = data?.summary || {};
  const maxMonth = useMemo(() => Math.max(1, ...(data?.monthly || []).map(row => Number(row.requisitions) || 0)), [data]);
  const total = Number(summary.total) || 0;
  const selectedClientName = clients.find(c => c.id === filters.client)?.name;
  const headingContext = filters.client === 'all' ? t('Todos los clientes', 'All clients') : selectedClientName || t('Cliente seleccionado', 'Selected client');

  return <div className="space-y-5 pb-8">
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-6 md:p-7 text-white shadow-lg">
      <div className="absolute -right-10 -top-16 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="relative flex flex-col md:flex-row justify-between gap-5">
        <div><span className="inline-flex items-center gap-2 text-[11px] font-bold bg-white/15 px-3 py-1 rounded-full mb-3"><Activity size={14}/>{t('Fuente: MariaDB · Solo consulta', 'Source: MariaDB · Read only')}</span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">{t('Centro de control de SupplyFlow', 'SupplyFlow Control Center')}</h1>
          <p className="mt-2 text-sm text-blue-100 max-w-2xl">{t('Requisiciones y documentos vinculados realmente registrados. Los hitos son evidencia de documentos, no aprobaciones automáticas.', 'Recorded requisitions and linked documents. Milestones denote document evidence, not automatic approval.')}</p>
          <div className="flex flex-wrap gap-2 mt-4"><button onClick={() => onNavigate('general_matrix')} className="rounded-xl bg-white text-blue-900 font-bold text-xs px-4 py-2 flex gap-2 items-center hover:bg-blue-50"><ClipboardList size={15}/>{t('Abrir Matriz General', 'Open Requisition Matrix')}</button>
          <button onClick={() => onNavigate('reports')} className="rounded-xl bg-white/15 border border-white/20 text-white font-bold text-xs px-4 py-2 flex gap-2 items-center hover:bg-white/25"><FileText size={15}/>{t('Ver reportes', 'View reports')}</button></div>
        </div>
        <div className="bg-white/10 border border-white/20 rounded-2xl p-4 self-start min-w-[220px]"><div className="text-[10px] text-blue-100 uppercase font-bold">{t('Alcance de la consulta', 'Query scope')}</div><div className="text-sm font-extrabold mt-2 break-words max-w-xs">{headingContext}</div><div className="text-xs text-blue-100 mt-1">{filters.from || t('Sin fecha inicial', 'No start date')} — {filters.to || t('Sin fecha final', 'No end date')}</div></div>
      </div>
    </header>

    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3"><div className="flex-1"><FilterLabel>{t('Cliente', 'Client')}</FilterLabel><select value={filters.client} onChange={e => setFilters(old => ({ ...old, client: e.target.value }))} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm bg-white"><option value="all">{t('Todos los clientes', 'All clients')}</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="w-full lg:w-44"><FilterLabel>{t('Desde (fecha de solicitud)', 'From (request date)')}</FilterLabel><input type="date" value={filters.from} onChange={e => setFilters(old => ({ ...old, from: e.target.value }))} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm" /></div>
        <div className="w-full lg:w-44"><FilterLabel>{t('Hasta', 'To')}</FilterLabel><input type="date" value={filters.to} onChange={e => setFilters(old => ({ ...old, to: e.target.value }))} className="w-full border border-slate-300 p-2.5 rounded-xl text-sm" /></div>
        <button onClick={() => setRefresh(n => n + 1)} className="rounded-xl bg-blue-600 text-white px-4 py-2.5 flex gap-2 items-center justify-center text-sm font-semibold hover:bg-blue-700"><RefreshCw size={16}/>{t('Actualizar', 'Refresh')}</button>
        <button onClick={() => setFilters({ from: '', to: '', client: 'all' })} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">{t('Limpiar', 'Clear')}</button>
      </div>
    </section>

    {loading && <div className="flex items-center justify-center gap-2 bg-white rounded-2xl p-10 text-slate-600"><Loader2 className="animate-spin" size={20}/>{t('Consultando datos reales...', 'Loading actual records...')}</div>}
    {!loading && error && <div role="alert" className="flex items-center gap-2 border border-rose-200 bg-rose-50 text-rose-800 p-4 rounded-xl"><AlertCircle size={19}/>{error}</div>}
    {!loading && data && <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={t('Requisiciones', 'Requisitions')} value={total} hint={t('Registros del periodo y cliente', 'Records in selected scope')} Icon={ClipboardList} />
        <StatCard label={t('Con cotización al cliente', 'With client quote')} value={summary.with_customer_quote} hint={t('Con versión comercial vinculada', 'With linked commercial version')} Icon={BarChart3} tint="violet" />
        <StatCard label={t('Con orden de compra', 'With purchase order')} value={summary.with_purchase_order} hint={t('Con al menos una OC vinculada', 'With at least one linked PO')} Icon={ShoppingCart} tint="amber" />
        <StatCard label={t('Con entrega', 'With delivery')} value={summary.with_delivery} hint={t('Con entrega documentada', 'With documented delivery')} Icon={Truck} tint="teal" />
      </section>
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
        <span className="flex items-center gap-2"><Building2 size={15} className="text-blue-600"/><strong>{formatCount(data.catalogs?.clients)}</strong> {t('clientes registrados', 'registered clients')}</span>
        <span className="flex items-center gap-2"><Truck size={15} className="text-teal-700"/><strong>{formatCount(data.catalogs?.suppliers)}</strong> {t('proveedores registrados', 'registered suppliers')}</span>
        <span className="text-slate-400">{t('Catálogos globales, independientes del periodo y del cliente filtrado.', 'Global catalogs, not affected by requisition filters.')}</span>
      </div>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><h2 className="text-base font-black text-slate-900">{t('Cobertura documental', 'Document coverage')}</h2><p className="text-xs text-slate-500 mt-1">{t('Requisiciones con cada documento; los grupos pueden solaparse.', 'Requisitions with each document; categories can overlap.')}</p>
          <div className="mt-5 space-y-3">{milestones.map(m => <div key={m.key} className="grid grid-cols-[150px_1fr_45px] sm:grid-cols-[210px_1fr_45px] items-center gap-3 text-xs"><span className="font-semibold text-slate-700">{isEn ? m.en : m.es}</span><div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`${m.color} h-full rounded-full`} style={{ width: `${total ? Math.min(100, Number(summary[m.key] || 0) * 100 / total) : 0}%` }}/></div><strong className="text-slate-900 text-right tabular-nums">{formatCount(summary[m.key])}</strong></div>)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><h2 className="text-base font-black text-slate-900">{t('Requisiciones por mes', 'Monthly requisitions')}</h2><p className="text-xs text-slate-500 mt-1">{t('Meses con fecha registrada; hasta 24 meses con datos.', 'Recorded request months; up to 24 months with data.')}</p>
          {(data.monthly || []).length ? <div className="mt-5 space-y-2 max-h-[360px] overflow-auto">{data.monthly.map(m => <div key={m.period} className="grid grid-cols-[75px_1fr_36px] items-center gap-3 text-xs"><span className="text-slate-600 tabular-nums">{m.period}</span><div className="bg-slate-100 rounded-full h-3 overflow-hidden"><div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full" style={{ width: `${Math.max(2, Number(m.requisitions) * 100 / maxMonth)}%` }}/></div><strong className="text-right tabular-nums">{m.requisitions}</strong></div>)}</div> : <p className="mt-6 text-sm text-slate-500">{t('No hay fechas para este filtro.', 'No dated records for these filters.')}</p>}
        </div>
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><h2 className="text-base font-black text-slate-900">{t('Clientes por requisiciones', 'Clients by requisitions')}</h2><p className="text-xs text-slate-500 mt-1">{t('Clasificación por número de solicitudes, no por importe.', 'Ranked by request count, not amount.')}</p>
          {(data.top_clients || []).length ? <div className="mt-4 divide-y divide-slate-100">{data.top_clients.map((c, i) => <div key={c.id} className="py-2.5 flex justify-between gap-3 text-xs"><div className="min-w-0"><span className="text-blue-700 mr-2 font-black">{i + 1}.</span><span className="text-slate-800 font-semibold break-words">{c.name}</span></div><span className="font-black shrink-0 tabular-nums">{formatCount(c.requisitions)}</span></div>)}</div> : <p className="text-sm text-slate-500 mt-4">{t('Sin registros.', 'No records.')}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><h2 className="text-base font-black text-slate-900">{t('Valor económico documentado', 'Documented monetary values')}</h2><p className="text-xs text-slate-500 mt-1">{t('Importes guardados por moneda; se toma la última versión registrada por serie.', 'Recorded amounts per currency, latest recorded version per series.')}</p>
          <div className="space-y-4 mt-4">{[['requisition_budgets',t('Presupuesto en requisiciones', 'Requisition budgets')],['customer_quotes',t('Cotizaciones al cliente', 'Client quotes')],['purchase_orders',t('Órdenes de compra', 'Purchase orders')]].map(([key,label]) => <div key={key} className="rounded-xl bg-slate-50 border border-slate-100 p-3"><div className="text-xs font-bold text-slate-700 mb-2">{label}</div>{(data.financial?.[key] || []).length ? <div className="space-y-1.5">{data.financial[key].map(x => <div key={x.currency_code} className="flex justify-between gap-3 text-xs"><span className="font-bold text-slate-500">{x.currency_code} · {formatCount(x.documents)} {t('documentos', 'documents')}</span><span className="text-slate-900 font-black tabular-nums">{formatAmount(x.amount,x.currency_code,activeLang)}</span></div>)}</div> : <p className="text-xs text-slate-500">{t('Sin importes registrados.', 'No recorded amounts.')}</p>}</div>)}</div>
          <p className="text-[11px] mt-3 text-amber-800">{t('Valores históricos sin conciliación financiera completa; no son ahorros, pagos ni ingresos.', 'Historical amounts not fully reconciled; these are not savings, payments or revenue.')}</p>
        </div>
      </section>
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-slate-900">{t('Últimas requisiciones del filtro', 'Recent requisitions in scope')}</h2><p className="text-xs text-slate-500">{t('Registros reales, según fecha de solicitud.', 'Real records sorted by request date.')}</p></div><button onClick={() => onNavigate('general_matrix')} className="text-xs font-bold text-blue-700 flex gap-1 items-center hover:underline">{t('Ver Matriz', 'View Matrix')}<ArrowRight size={15}/></button></div>
        <div className="overflow-x-auto mt-4"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">{t('Folio', 'Folio')}</th><th className="p-3">{t('Cliente', 'Client')}</th><th className="p-3">{t('Solicitud', 'Date')}</th><th className="p-3">{t('OC', 'PO')}</th></tr></thead><tbody>{recent.map(r => <tr key={r.id} className="border-b border-slate-100"><td className="p-3 font-bold text-slate-800">{r.folio}</td><td className="p-3 text-slate-700">{r.client_name}</td><td className="p-3 text-slate-600">{r.request_date || '—'}</td><td className="p-3 tabular-nums">{r.purchase_order_count}</td></tr>)}{!recent.length && <tr><td colSpan={4} className="p-5 text-slate-500">{t('Sin registros.', 'No records.')}</td></tr>}</tbody></table></div>
      </section>
      <p className="text-[11px] text-slate-500 bg-slate-100 rounded-xl p-3">{data.definitions?.coverage} {data.definitions?.document_grain}</p>
    </>}
  </div>;
};
