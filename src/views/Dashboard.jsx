import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, TrendingUp, Plus, RefreshCw, CheckCircle, ChevronRight, Target, Loader2, AlertCircle, ArrowRight, FileText } from 'lucide-react';
import { analyticsOverview, analyticsReport } from '../analyticsApi';
import { matrixClients } from '../matrixApi';
import { listCatalog } from '../catalogApi';
import { request as recoveryRequest } from './recovery/api';
import { regKpis } from './recovery/model.mjs';
import {
  P2P_STAGES, localToday, pct, scopeRows, stageDistribution, processStatus, priorityDistribution, clientActivity,
  nextActions, alerts, recentMoves, averageProgress, moneyByCurrency, documentsOf, activeCount, changeSummary, historyBased,
} from './dashboard/model.mjs';

// Inicio y Dashboard · diseño "Grupo Gerez · Control integral" con datos REALES de MariaDB.
// Regla: nunca datos de demostración. Si una métrica no tiene fuente en la API, la tarjeta conserva su
// diseño y muestra "Pendiente de integración".

const DASH = '—';
const formatCount = (value) => new Intl.NumberFormat('es-MX').format(Number(value) || 0);
const formatAmount = (value, currency, language) => {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', { style: 'currency', currency: currency || 'MXN', maximumFractionDigits: 2 }).format(n) : `${value} ${currency}`;
};
const formatUtc = (value, en) => {
  if (!value) return DASH;
  const d = new Date(String(value).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(en ? 'en-US' : 'es-MX', { dateStyle: 'short', timeStyle: 'short' });
};

/* ---------- Piezas visuales del diseño ---------- */
function Panel({ accent, title, subtitle, icon, iconBg = 'bg-purple-50 text-purple-600', className = '', children, right }) {
  return <div className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden flex flex-col ${className}`}>
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent}`} />
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="min-w-0"><h3 className="text-base font-black text-slate-900">{title}</h3>{subtitle && <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>}</div>
      {right || (icon && <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center font-bold text-xs shrink-0`}>{icon}</div>)}
    </div>
    <div className="flex-1">{children}</div>
  </div>;
}
function MiniStat({ value, label, tone = 'text-slate-900', size = 'text-xl' }) {
  return <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 min-w-0">
    <p className={`${size} font-black ${tone} truncate`} title={String(value)}>{value}</p>
    <p className="text-[10px] font-bold text-slate-400 mt-1">{label}</p>
  </div>;
}
function Pending({ text, tall = false }) {
  return <div className={`flex items-center justify-center ${tall ? 'min-h-[180px]' : 'min-h-[90px]'} bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-3 text-center`}>
    <span className="text-[11px] font-medium text-slate-400">{text}</span>
  </div>;
}
function HBar({ label, count, max, color = 'bg-gradient-to-r from-purple-600 to-blue-500', wide = false }) {
  return <div className="flex items-center justify-between text-xs gap-3">
    <span className={`text-[11px] font-semibold text-slate-600 truncate ${wide ? 'w-44' : 'w-36'}`} title={label}>{label}</span>
    <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden flex items-center"><div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${max ? Math.min(100, count * 100 / max) : 0}%` }} /></div>
    <span className="text-xs font-black text-slate-800 w-8 text-right tabular-nums">{formatCount(count)}</span>
  </div>;
}
function VBar({ value, label, percent, color, sub, tall = 'h-64' }) {
  return <div className="flex flex-col items-center flex-1 max-w-[130px] min-w-0">
    <span className="text-xs font-black text-slate-900 mb-2 truncate max-w-full" title={String(value)}>{value}</span>
    <div className={`w-full bg-slate-50 rounded-2xl ${tall} flex items-end justify-center p-2`}><div className={`w-full ${color} rounded-xl transition-all duration-500`} style={{ height: `${Math.max(percent || 0, percent > 0 ? 4 : 0)}%` }} /></div>
    <span className="text-xs font-bold text-slate-600 mt-3 text-center">{label}</span>
    {sub && <span className="text-[9px] font-bold text-slate-400 text-center mt-0.5">{sub}</span>}
  </div>;
}
function SourceState({ state, t }) {
  if (state.loading) return <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />{t('Consultando MariaDB…', 'Querying MariaDB…')}</p>;
  if (state.error) return <p role="alert" className="text-[11px] text-rose-700 flex items-center gap-1.5"><AlertCircle size={13} />{state.error}</p>;
  return null;
}

export const Dashboard = ({ onNavigate = () => {}, lang, language }) => {
  const activeLang = lang || language || 'es';
  const isEn = activeLang === 'en' || activeLang === 'English' || activeLang === 'EN';
  const t = (es, en) => (isEn ? en : es);
  const PENDING = t('Pendiente de integración: esta información aún no tiene fuente conectada en MariaDB.', 'Pending integration: no MariaDB source is connected for this information yet.');
  const day = localToday();

  const [clients, setClients] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', client: 'all' });
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [ops, setOps] = useState({ loading: true, error: '', rows: [] });
  const [cats, setCats] = useState({ clients: null, suppliers: null });
  const [chg, setChg] = useState({ loading: true, error: '', list: null, queue: null });
  const [currency, setCurrency] = useState('');
  const dateInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  useEffect(() => {
    const c = new AbortController();
    matrixClients(c.signal).then(result => { if (!c.signal.aborted) setClients(result.items || []); })
      .catch(() => { if (!c.signal.aborted) setClients([]); });
    return () => c.abort();
  }, []);

  // Núcleo: resumen por filtro (analítica). Igual que antes: si falla, la página muestra el error.
  useEffect(() => {
    if (dateInvalid) { setData(null); setRecent([]); setError(t('El rango de fechas es inválido.', 'Invalid date range.')); setLoading(false); return; }
    const c = new AbortController();
    setLoading(true); setData(null); setError('');
    Promise.all([
      analyticsOverview(filters, c.signal),
      analyticsReport({ ...filters, has: 'all', q: '', page: 1, page_size: 5 }, c.signal),
    ]).then(([overview, report]) => { if (!c.signal.aborted) { setData(overview); setRecent(report.items || []); } })
      .catch(e => { if (!c.signal.aborted) setError(e.message || t('Error al consultar la API.', 'API request failed.')); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [filters.from, filters.to, filters.client, refresh, dateInvalid]);

  // Fuentes complementarias (solo GET). Cada una informa su propio estado sin bloquear el resto.
  useEffect(() => {
    const c = new AbortController();
    const msg = e => e?.message || t('No fue posible consultar MariaDB.', 'Could not query MariaDB.');
    setOps(o => ({ ...o, loading: true, error: '' }));
    recoveryRequest('/matrix', { signal: c.signal })
      .then(m => { if (!c.signal.aborted) setOps({ loading: false, error: '', rows: m.items || [] }); })
      .catch(e => { if (!c.signal.aborted) setOps({ loading: false, error: msg(e), rows: [] }); });
    Promise.allSettled([listCatalog('clients', { page: 1, pageSize: 1 }, c.signal), listCatalog('suppliers', { page: 1, pageSize: 1 }, c.signal)])
      .then(([a, b]) => { if (!c.signal.aborted) setCats({ clients: a.status === 'fulfilled' ? a.value.summary : null, suppliers: b.status === 'fulfilled' ? b.value.summary : null }); });
    setChg(o => ({ ...o, loading: true, error: '' }));
    Promise.allSettled([recoveryRequest('/changes', { signal: c.signal }), recoveryRequest('/changes/review-queue', { signal: c.signal })])
      .then(([l, q]) => {
        if (c.signal.aborted) return;
        const failed = [l, q].find(x => x.status === 'rejected');
        setChg({ loading: false, error: failed ? msg(failed.reason) : '', list: l.status === 'fulfilled' ? l.value : null, queue: q.status === 'fulfilled' ? q.value : null });
      });
    return () => c.abort();
  }, [refresh]);

  const summary = data?.summary || {};
  const total = Number(summary.total) || 0;
  const rows = useMemo(() => scopeRows(ops.rows, filters), [ops.rows, filters.client, filters.from, filters.to]);
  const status = useMemo(() => processStatus(rows, day), [rows, day]);
  const stages = useMemo(() => stageDistribution(rows), [rows]);
  const prio = useMemo(() => priorityDistribution(rows), [rows]);
  const activity = useMemo(() => clientActivity(rows, 5), [rows]);
  const actions = useMemo(() => nextActions(rows, day, 6), [rows, day]);
  const alertList = useMemo(() => alerts(rows, day, 40), [rows, day]);
  const moves = useMemo(() => recentMoves(rows, 7), [rows]);
  const avg = useMemo(() => averageProgress(rows), [rows]);
  const prov = useMemo(() => regKpis(rows, day), [rows, day]);
  const hist = useMemo(() => historyBased(rows, 8), [rows]);
  const money = useMemo(() => moneyByCurrency(data?.financial), [data]);
  const chs = useMemo(() => changeSummary(chg.list, chg.queue), [chg.list, chg.queue]);
  const cur = money.currencies.includes(currency) ? currency : money.currencies[0] || '';
  const m = money.byCurrency[cur] || {};
  const maxMonth = Math.max(1, ...(data?.monthly || []).map(row => Number(row.requisitions) || 0));
  const maxStage = Math.max(1, ...stages.counts);
  const topStage = stages.counts.reduce((best, n, i) => (n > best.n ? { n, i } : best), { n: 0, i: -1 });
  const selectedClientName = clients.find(c => c.id === filters.client)?.name;
  const scopeLabel = filters.client === 'all' ? t('Todos los clientes', 'All clients') : selectedClientName || t('Cliente seleccionado', 'Selected client');
  const stageName = i => (i >= 0 ? (isEn ? P2P_STAGES[i][1] : P2P_STAGES[i][0]) : DASH);
  const opsReady = !ops.loading && !ops.error;
  const v = (value, ready = opsReady) => (ready ? formatCount(value) : DASH);
  const known = status.onTime + status.overdue + status.closed;
  const donut = [[status.onTime, 'text-blue-600'], [status.overdue, 'text-rose-500'], [status.closed, 'text-emerald-500']]
    .reduce((acc, [n, cls]) => { const p = known ? n * 100 / known : 0; acc.items.push({ p, off: acc.off, cls }); acc.off += p; return acc; }, { off: 0, items: [] }).items;
  const coverage = [
    ['with_rfq', t('Con RFQ', 'With RFQ')], ['with_supplier_quote', t('Con oferta de proveedor', 'With supplier offer')],
    ['with_customer_quote', t('Con cotización al cliente', 'With client quote')], ['with_purchase_order', t('Con orden de compra', 'With purchase order')],
    ['with_receipt', t('Con recepción', 'With receipt')], ['with_delivery', t('Con entrega', 'With delivery')], ['with_invoice', t('Con factura', 'With invoice')],
  ];
  const cq = documentsOf(data?.financial, 'customer_quotes');
  const poDocs = documentsOf(data?.financial, 'purchase_orders');

  return <div className="space-y-6 pb-8">

    {/* 1. BANNER HERO PRINCIPAL (GRUPO GEREZ) */}
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 p-6 md:p-8 text-white shadow-xl shadow-indigo-500/10">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-blue-100 backdrop-blur-md border border-white/10"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />{t('Centro de control inteligente', 'Smart Control Center')}</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 text-blue-100 border border-white/10">{t('Fuente: MariaDB · Solo consulta', 'Source: MariaDB · Read only')}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{t('Grupo Gerez · Control integral de compras y servicios', 'Grupo Gerez · Comprehensive Procurement & Services Control')}</h1>
          <p className="text-xs md:text-sm text-blue-100 font-medium leading-relaxed">{t('Administra la operación desde la solicitud hasta el cierre con flujo guiado, estrategia por partida, lotes paralelos, múltiples proveedores, órdenes de compra, recepción, entrega y factura.', 'Manage operations from request to closure with guided workflow, line-item strategy, parallel batches, multiple suppliers, purchase orders, receipts, delivery, and invoices.')}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button onClick={() => onNavigate('requisition')} className="px-4 py-2 bg-white text-blue-900 font-extrabold text-xs rounded-xl shadow-md hover:bg-blue-50 transition-all duration-300 flex items-center gap-2 hover:scale-105 cursor-pointer"><Plus className="w-4 h-4 text-blue-600" />{t('Nueva solicitud', 'New Request')}</button>
            <button onClick={() => onNavigate('quotes')} className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs rounded-xl backdrop-blur-md transition-all duration-300 flex items-center gap-2 cursor-pointer"><span className="text-sm">📊</span>{t('Cotizaciones / Service Fee', 'Quotes / Service Fee')}</button>
            <button onClick={() => onNavigate('general_matrix')} className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs rounded-xl backdrop-blur-md transition-all duration-300 flex items-center gap-2 cursor-pointer"><span className="text-sm">🧭</span>{t('Trazabilidad integral', 'Comprehensive Traceability')}</button>
            <button onClick={() => onNavigate('reports')} className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs rounded-xl backdrop-blur-md transition-all duration-300 flex items-center gap-2 cursor-pointer"><FileText className="w-4 h-4" />{t('Reportes', 'Reports')}</button>
          </div>
        </div>
        <div className="w-full lg:w-80 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 shrink-0 space-y-2">
          <h3 className="text-xs font-extrabold text-white tracking-wide">{t('Lectura ejecutiva en tiempo real', 'Real-time Executive Overview')}</h3>
          <p className="text-[11px] text-blue-100 leading-relaxed font-medium"><strong className="text-white font-bold">{v(status.open)}</strong> {t('compra(s) abierta(s)', 'open purchase(s)')} · <strong className="text-white font-bold">{DASH}</strong> {t('servicio(s) activo(s)', 'active service(s)')} · <strong className="text-white font-bold">{v(status.overdue)}</strong> {t('vencido(s)', 'overdue')}.</p>
          <p className="text-[10px] text-blue-200/90 font-medium pt-1 border-t border-white/10">{t('Mayor concentración P2P:', 'Highest P2P concentration:')} <strong className="text-white">{opsReady && topStage.i >= 0 ? `${stageName(topStage.i)} (${formatCount(topStage.n)})` : DASH}</strong></p>
          <p className="text-[10px] text-blue-200/90 font-medium">{t('Alcance:', 'Scope:')} <strong className="text-white break-words">{scopeLabel}</strong> · {filters.from || t('sin fecha inicial', 'no start date')} — {filters.to || t('sin fecha final', 'no end date')}</p>
        </div>
      </div>
    </div>

    {/* Filtros (funcionalidad existente: cliente y periodo por fecha de solicitud) */}
    <section className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1"><label className="block text-[11px] font-bold text-slate-600 mb-1.5" htmlFor="dash-client">{t('Cliente', 'Client')}</label><select id="dash-client" value={filters.client} onChange={e => setFilters(old => ({ ...old, client: e.target.value }))} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm bg-white"><option value="all">{t('Todos los clientes', 'All clients')}</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="w-full lg:w-44"><label className="block text-[11px] font-bold text-slate-600 mb-1.5" htmlFor="dash-from">{t('Desde (fecha de solicitud)', 'From (request date)')}</label><input id="dash-from" type="date" value={filters.from} onChange={e => setFilters(old => ({ ...old, from: e.target.value }))} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm" /></div>
        <div className="w-full lg:w-44"><label className="block text-[11px] font-bold text-slate-600 mb-1.5" htmlFor="dash-to">{t('Hasta', 'To')}</label><input id="dash-to" type="date" value={filters.to} onChange={e => setFilters(old => ({ ...old, to: e.target.value }))} className="w-full border border-slate-200 p-2.5 rounded-xl text-sm" /></div>
        <button onClick={() => setRefresh(n => n + 1)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"><RefreshCw size={15} />{t('Actualizar', 'Refresh')}</button>
        <button onClick={() => setFilters({ from: '', to: '', client: 'all' })} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer">{t('Limpiar', 'Clear')}</button>
      </div>
    </section>

    {loading && <div className="flex items-center justify-center gap-2 bg-white rounded-2xl p-10 text-slate-600"><Loader2 className="animate-spin" size={20} />{t('Consultando datos reales...', 'Loading actual records...')}</div>}
    {!loading && error && <div role="alert" className="flex items-center gap-2 border border-rose-200 bg-rose-50 text-rose-800 p-4 rounded-xl"><AlertCircle size={19} />{error}</div>}
    {!loading && data && <>

      {/* 2. MÉTRICAS / TARJETAS RESUMEN (GRID 4x2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          [formatCount(total), t('Requisiciones', 'Requisitions'), 'Procure-to-Pay', 'border-t-blue-500', 'text-blue-600', 'bg-blue-100/50'],
          [DASH, t('Servicios', 'Services'), t('Service-to-Cash · pendiente de integración', 'Service-to-Cash · pending integration'), 'border-t-purple-500', 'text-purple-600', 'bg-purple-100/50'],
          [v(status.open), t('Procesos abiertos', 'Open processes'), t('Etapa anterior a Factura', 'Stage before Invoice'), 'border-t-teal-500', 'text-teal-600', 'bg-teal-100/50'],
          [v(status.overdue), t('Vencidos', 'Overdue'), t('Requieren atención', 'Require attention'), 'border-t-rose-500', 'text-rose-600', 'bg-rose-100/50'],
          [formatCount(summary.with_customer_quote), t('Cotizaciones cliente', 'Client quotes'), t(`${formatCount(cq)} versión(es) registradas`, `${formatCount(cq)} recorded version(s)`), 'border-t-pink-500', 'text-pink-600', 'bg-pink-100/50'],
          [DASH, 'Service fee', t('Pendiente de integración', 'Pending integration'), 'border-t-indigo-500', 'text-indigo-600', 'bg-indigo-100/50'],
          [formatCount(summary.with_purchase_order), t('Órdenes de compra', 'Purchase orders'), m.po ? formatAmount(m.po.amount, cur, activeLang) : t('Sin importes', 'No amounts'), 'border-t-amber-500', 'text-amber-600', 'bg-amber-100/50'],
          [formatCount(summary.with_invoice), t('Facturación', 'Invoicing'), t('Requisiciones con factura', 'Requisitions with invoice'), 'border-t-emerald-500', 'text-emerald-600', 'bg-emerald-100/50'],
        ].map(([value, label, hint, border, tone, glow]) => <div key={label} className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow border-t-4 ${border}`}>
          <div className="space-y-1"><p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>
          <span className={`text-[10px] font-extrabold ${tone} mt-3 inline-block`}>{hint}</span>
          <div className={`absolute -bottom-4 -right-4 w-16 h-16 ${glow} rounded-full blur-md`} />
        </div>)}
      </div>

      {/* 3. PANEL: ABASTECIMIENTO POR LOTES Y RUTAS PARALELAS */}
      <div className="bg-slate-50/60 rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="space-y-1"><h2 className="text-xl font-black text-slate-900 flex items-center gap-2 pt-1"><span>🧩</span> {t('Abastecimiento por lotes y rutas paralelas', 'Batch Sourcing & Parallel Routes')}</h2>
            <p className="text-xs text-slate-500 font-medium">{t('Controla requisiciones con múltiples categorías, proveedores y estrategias por partida sin dividir el expediente del cliente.', 'Control requisitions with multiple categories, suppliers, and line-item strategies without splitting the client file.')}</p></div>
          <button onClick={() => setRefresh(n => n + 1)} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"><span>↻</span><span>{t('Actualizar', 'Refresh')}</span></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          {[[t('Por lotificar', 'To be batched'), 'border-l-amber-500'], [t('Requisiciones lotificadas', 'Batched requisitions'), 'border-l-purple-500'], [t('Partidas con RFQ', 'Items with RFQ'), 'border-l-blue-500'], [t('Proveedores asignados', 'Assigned suppliers'), 'border-l-indigo-500'], [t('RFQ pendientes', 'Pending RFQs'), 'border-l-rose-500'], [t('Rutas paralelas', 'Parallel routes'), 'border-l-emerald-500']].map(([label, border]) =>
            <div key={label} className={`bg-white rounded-2xl p-3.5 border border-slate-100 shadow-xs border-l-4 ${border}`}><p className="text-xl font-black text-slate-300">{DASH}</p><p className="text-[11px] font-bold text-slate-700 leading-tight">{label}</p><p className="text-[9px] text-slate-400 mt-0.5">{t('Pendiente de integración', 'Pending integration')}</p></div>)}
        </div>
        <p className="text-[10px] text-slate-400 mb-6">{t('El esquema incluye planes y lotes de abastecimiento, pero todavía no hay un endpoint de consulta; no se muestran cifras estimadas.', 'The schema includes sourcing plans and lots, but no read endpoint exists yet; no estimated figures are shown.')}</p>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
            <div><h3 className="text-sm font-extrabold text-slate-900 mb-3">{t('Mapa del abastecimiento', 'Procurement Map')}</h3>
              <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
                {[[t('Validación', 'Validation'), 'done'], [t('Lotificación', 'Batching'), 'done'], [t('Rutas paralelas', 'Parallel Routes'), 'current'], [t('Consolidación', 'Consolidation'), 'next'], [t('Cotización cliente', 'Client Quote'), 'next']].map(([label, st], i) => <React.Fragment key={label}>
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] ${st === 'done' ? 'bg-emerald-100/70 text-emerald-800' : st === 'current' ? 'bg-white text-blue-700 border border-blue-200 font-extrabold shadow-xs' : 'bg-slate-100 text-slate-400'}`}>{st === 'done' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <span>{st === 'current' ? '⚙️' : '📄'}</span>}{label}</div>
                </React.Fragment>)}
              </div>
            </div>
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[11px] text-slate-600">{t('Mapa de referencia del proceso. Las cifras por lote y partida se mostrarán cuando exista la consulta de planes de abastecimiento.', 'Reference process map. Batch and line-item figures will be shown once the sourcing plan query exists.')}</div>
          </div>
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100"><h3 className="text-sm font-extrabold text-slate-900">{t('Siguientes acciones guiadas', 'Next Guided Actions')}</h3><span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold text-[10px] rounded-full">{v(actions.total)} {t('pendiente(s)', 'pending')}</span></div>
            <SourceState state={ops} t={t} />
            {opsReady && <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {actions.items.map(r => <div key={r.id} className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-100 transition-all duration-200">
                <div className="space-y-0.5 pr-2 min-w-0"><p className="font-extrabold text-slate-900 text-xs">{r.folio}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">{r.client}</p>
                  <p className="text-[9px] text-slate-400 font-medium">{t('Etapa', 'Stage')}: {stageName(r.stage_index)} · {t('siguiente', 'next')}: {stageName(Number(r.stage_index) + 1)}{r.need_date ? ` · ${t('requerida', 'needed')} ${r.need_date}` : ''}</p></div>
                <button onClick={() => onNavigate('requisition')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold rounded-lg shadow-xs hover:scale-105 transition-all shrink-0 cursor-pointer">{t('Abrir →', 'Open →')}</button>
              </div>)}
              {!actions.items.length && <Pending text={t('Sin requisiciones en recepción o validación.', 'No requisitions in receipt or validation.')} />}
            </div>}
          </div>
        </div>
      </div>

      {/* 4. CUADROS PRINCIPALES (GESTIÓN Y AHORRO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-100 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div className="flex items-center justify-between relative z-10"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20"><ShoppingBag className="w-5 h-5" /></div>
            <div><h3 className="font-extrabold text-slate-900 text-sm">{t('Gestión de Cotizaciones', 'Quotes Management')}</h3><p className="text-[11px] text-slate-400 font-medium">{t('Requisiciones con documentos de cotización', 'Requisitions with quotation documents')}</p></div></div>
            <span className="bg-blue-50 text-blue-600 font-extrabold text-[11px] px-3 py-1 rounded-full border border-blue-100">{formatCount(total)} {t('proceso(s)', 'process(es)')}</span></div>
          <div className="grid grid-cols-4 gap-2 relative z-10">
            {[[summary.with_rfq, 'RFQ', 'hover:bg-blue-50'], [summary.with_supplier_quote, t('Ofertas', 'Offers'), 'hover:bg-emerald-50'], [summary.with_customer_quote, t('Cliente', 'Client'), 'hover:bg-purple-50'], [summary.with_purchase_order, t('Con OC', 'With PO'), 'hover:bg-amber-50']].map(([n, label, hv]) =>
              <div key={label} className={`bg-slate-50 p-2.5 rounded-xl text-center ${hv} transition-all`}><p className="text-lg font-black text-slate-900">{formatCount(n)}</p><p className="text-[10px] font-bold text-slate-400">{label}</p></div>)}
          </div>
          <div className="relative z-10"><div className="flex justify-between items-center text-[11px] font-extrabold mb-1"><span className="text-slate-800">{t('Avance ponderado', 'Weighted progress')}</span><span className="text-blue-600">{avg === null || !opsReady ? DASH : `${avg}%`}</span></div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full rounded-full" style={{ width: `${opsReady ? avg || 0 : 0}%` }} /></div></div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-100 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
          <div className="flex items-center justify-between relative z-10"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20"><TrendingUp className="w-5 h-5" /></div>
            <div><h3 className="font-extrabold text-slate-900 text-sm">{t('Ahorro y Desempeño', 'Savings & Performance')}</h3><p className="text-[11px] text-slate-400 font-medium">{t('Evaluaciones de proveedores', 'Supplier evaluations')}</p></div></div>
            <span className="bg-purple-50 text-purple-600 font-extrabold text-[11px] px-3 py-1 rounded-full border border-purple-100">{t('Ahorro: pendiente', 'Savings: pending')}</span></div>
          <div className="grid grid-cols-4 gap-2 relative z-10">
            {[[DASH, t('Ahorro pot.', 'Pot. savings')], [DASH, t('Evaluados', 'Evaluated')], [DASH, t('Costo prom.', 'Avg. cost')], [`${pct(summary.with_invoice, total)}%`, t('Facturados', 'Invoiced')]].map(([n, label]) =>
              <div key={label} className="bg-slate-50 p-2.5 rounded-xl text-center hover:bg-purple-50 transition-all"><p className="text-lg font-black text-slate-900">{n}</p><p className="text-[10px] font-bold text-slate-400">{label}</p></div>)}
          </div>
          <p className="text-[10px] text-slate-400 relative z-10">{t('El ahorro requiere comparar precios adjudicados contra referencias; los importes guardados no son ahorro comprobado.', 'Savings require comparing awarded prices with references; stored amounts are not verified savings.')}</p>
          <div className="relative z-10"><div className="flex justify-between items-center text-[11px] font-extrabold mb-1"><span className="text-slate-800">{t('Requisiciones facturadas', 'Invoiced requisitions')}</span><span className="text-purple-600">{pct(summary.with_invoice, total)}%</span></div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full" style={{ width: `${pct(summary.with_invoice, total)}%` }} /></div></div>
        </div>
      </div>

      {/* 5. SECCIÓN DE GRÁFICAS PROCURE-TO-PAY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-rose-500" />
          <div className="flex items-center justify-between mb-2 gap-3"><div><h3 className="text-base font-black text-slate-900">{t(`Distribución Procure-to-Pay · ${P2P_STAGES.length} etapas`, `Procure-to-Pay Distribution · ${P2P_STAGES.length} stages`)}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t('Etapa actual de cada requisición, calculada en el servidor con la regla de 8 etapas del Apps Script.', 'Current stage of each requisition, computed server-side with the Apps Script 8-stage rule.')}</p></div>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 font-extrabold text-[11px] rounded-full border border-blue-100 shrink-0">{v(stages.total)} {t('procesos P2P', 'P2P processes')}</span></div>
          <SourceState state={ops} t={t} />
          {opsReady && <>
            <div className="pt-8 pb-4 flex items-end justify-between gap-1 sm:gap-2 overflow-x-auto min-h-[220px]">
              {P2P_STAGES.map(([es, en, color], i) => <div key={es} className="flex flex-col items-center group flex-1 min-w-[48px]">
                <span className="text-xs font-black text-slate-900 mb-2">{formatCount(stages.counts[i])}</span>
                <div className="w-full bg-slate-100 rounded-2xl h-36 flex items-end p-1"><div className={`w-full ${color} rounded-xl transition-all duration-500 group-hover:brightness-110`} style={{ height: `${stages.counts[i] ? Math.max(stages.counts[i] * 100 / maxStage, 8) : 0}%` }} /></div>
                <div className="mt-3 flex flex-col items-center gap-1 h-12"><div className={`w-5 h-5 rounded-full ${color} text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs`}>{i + 1}</div><span className="text-[10px] font-bold text-slate-700 text-center leading-tight max-w-[78px] line-clamp-2">{isEn ? en : es}</span></div>
              </div>)}
            </div>
            {stages.unknown > 0 && <p className="text-[10px] text-slate-400">{t(`${formatCount(stages.unknown)} requisición(es) desde historial o con cambio controlado: etapa pendiente de equivalencia.`, `${formatCount(stages.unknown)} history-based or controlled-change requisition(s): stage equivalence pending.`)}</p>}
          </>}
        </div>
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-rose-500" />
          <div className="space-y-6">
            <div className="flex items-center justify-between"><div><h3 className="text-base font-black text-slate-900">{t('Estado Procure-to-Pay', 'Procure-to-Pay Status')}</h3><p className="text-xs text-slate-500 font-medium mt-0.5">{t('Abiertos, vencidos y cerrados.', 'Open, overdue and closed.')}</p></div>
              <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center"><Target className="w-4 h-4" /></div></div>
            <SourceState state={ops} t={t} />
            {opsReady && <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-between gap-6 py-2">
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="4.5" className="text-slate-100" stroke="currentColor" />
                  {donut.map((s, i) => s.p > 0 && <circle key={i} cx="18" cy="18" r="15.9155" fill="none" strokeWidth="4.5" className={s.cls} stroke="currentColor" strokeDasharray={`${s.p} ${100 - s.p}`} strokeDashoffset={-s.off} />)}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center"><span className="text-2xl font-black text-slate-900 leading-none">{formatCount(known)}</span><span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-tight mt-0.5">PROCURE-TO-PAY</span></div>
              </div>
              <div className="w-full space-y-2">
                {[[t('Abiertos en tiempo', 'Open on time'), status.onTime, 'bg-blue-600'], [t('Vencidos', 'Overdue'), status.overdue, 'bg-rose-500'], [t('Factura/cierre', 'Invoice/closing'), status.closed, 'bg-emerald-500']].map(([label, n, dot]) =>
                  <div key={label} className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-xl border border-slate-100"><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${dot} inline-block`} /><span className="text-xs font-bold text-slate-700">{label}</span></div><span className="text-xs font-black text-slate-900">{formatCount(n)}</span></div>)}
              </div>
            </div>}
          </div>
        </div>
      </div>

      {/* 6. EMBUDO, VALOR Y PROVEEDORES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel accent="from-purple-500 to-blue-600" title={t('Embudo comercial', 'Sales funnel')} subtitle={t('Requisiciones con cada documento generado en el abastecimiento', 'Requisitions with each document generated during procurement')} icon="📈">
          <div className="space-y-3 pt-2"><HBar label={t('Requisiciones', 'Requisitions')} count={total} max={total} />{coverage.map(([k, label]) => <HBar key={k} label={label} count={Number(summary[k]) || 0} max={total} />)}</div>
        </Panel>
        <Panel accent="from-blue-600 via-pink-500 to-purple-600" title={t('Valor económico integral', 'Comprehensive economic value')} subtitle={t('Presupuesto, cotización y OC por moneda (importes guardados)', 'Budget, quote and PO per currency (stored amounts)')} icon="💰" iconBg="bg-amber-50 text-amber-600"
          right={money.currencies.length > 1 ? <select aria-label={t('Moneda', 'Currency')} value={cur} onChange={e => setCurrency(e.target.value)} className="border border-slate-200 rounded-lg text-xs p-1">{money.currencies.map(c => <option key={c}>{c}</option>)}</select> : null}>
          {cur ? (() => {
            const bars = [[t('Presupuesto', 'Budget'), m.budgets, 'from-teal-500 to-emerald-600'], [t('Cotizaciones', 'Quotes'), m.quotes, 'from-blue-600 to-indigo-600'], [t('OC', 'PO'), m.po, 'from-amber-500 to-orange-600']];
            const max = Math.max(1, ...bars.map(b => b[1]?.amount || 0));
            return <div className="pt-6 pb-2 flex items-end justify-around gap-1.5 h-56">
              {bars.map(([label, x, color]) => <div key={label} className="flex flex-col items-center flex-1 min-w-0"><span className="text-[10px] font-black text-slate-800 mb-1 truncate max-w-full" title={x ? formatAmount(x.amount, cur, activeLang) : DASH}>{x ? formatAmount(x.amount, cur, activeLang) : DASH}</span>
                <div className="w-full bg-slate-50 rounded-2xl h-36 flex items-end justify-center p-1"><div className={`w-full bg-gradient-to-t ${color} rounded-xl transition-all duration-500`} style={{ height: `${x?.amount ? Math.max(4, x.amount * 100 / max) : 0}%` }} /></div>
                <span className="text-[9px] font-bold text-slate-600 mt-2 text-center w-full truncate" title={label}>{label}</span></div>)}
              {[t('Service Fee', 'Service Fee'), t('Facturación', 'Invoicing')].map(label => <div key={label} className="flex flex-col items-center flex-1 min-w-0 opacity-60"><span className="text-[10px] font-black text-slate-400 mb-1">{DASH}</span><div className="w-full bg-slate-50 rounded-2xl h-36 border border-dashed border-slate-200" /><span className="text-[9px] font-bold text-slate-400 mt-2 text-center w-full truncate" title={label}>{label}</span></div>)}
            </div>;
          })() : <Pending tall text={t('Sin importes registrados para este filtro.', 'No recorded amounts for these filters.')} />}
          <p className="text-[10px] text-amber-700 mt-2">{t('Valores históricos sin conciliación financiera completa; no son ahorros, pagos ni ingresos. Service Fee y facturación: pendientes de integración.', 'Historical amounts not fully reconciled; not savings, payments or revenue. Service Fee and invoicing: pending integration.')}</p>
        </Panel>
        <Panel accent="from-blue-500 to-indigo-600" title={t('Proveedores con mayor actividad', 'Most active suppliers')} subtitle={t('Participación por RFQ, ofertas y adjudicaciones', 'Participation via RFQ, bids, and awards')} icon="🏆" iconBg="bg-amber-50 text-amber-600">
          <Pending tall text={PENDING} />
          <p className="text-[10px] text-slate-400 mt-2">{t(`${formatCount(data.catalogs?.suppliers)} proveedor(es) registrados en el catálogo.`, `${formatCount(data.catalogs?.suppliers)} supplier(s) registered in the catalog.`)}</p>
        </Panel>
      </div>

      {/* 7. SECCIÓN: ANALÍTICA AMPLIADA */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">{t('Analítica ampliada', 'Augmented analytics')}</h2><p className="text-xs text-slate-500 font-medium">{t('Compras, servicios, cotizaciones, Service Fee, autorizaciones, margen y cierre comercial.', 'Purchases, services, price quotes, service fee, authorizations, margin, and commercial closing.')}</p></div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-[11px] rounded-full border border-indigo-100 shrink-0">MariaDB</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Panel accent="from-purple-500 via-pink-500 to-rose-500" title={t('Servicios Operativos', 'Operational Services')} subtitle={t('Portafolio Service-to-Cash', 'Service-to-Cash Portfolio')} icon="🚛"><Pending tall text={PENDING} /></Panel>
          <Panel accent="from-blue-500 via-indigo-500 to-purple-600" title={t('Service-to-Cash · 8 etapas', 'Service-to-Cash · 8 stages')} subtitle={t('Distribución operativa actual', 'Current operational distribution')} icon="🧭" iconBg="bg-amber-50 text-amber-600"><Pending tall text={PENDING} /></Panel>
          <Panel accent="from-purple-500 to-pink-500" title={t('Cotización + Service Fee', 'Quote + Service Fee')} subtitle={t('Seguimiento comercial al cliente', 'Commercial follow-up with the client')} icon="💼" iconBg="bg-pink-50 text-pink-600">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat value={formatCount(cq)} label={t('Versiones de cotización', 'Quote versions')} />
              <MiniStat value={formatCount(summary.with_customer_quote)} label={t('Requisiciones cotizadas', 'Quoted requisitions')} />
              <MiniStat value={DASH} label={t('Con Service Fee', 'With Service Fee')} tone="text-slate-300" />
              <MiniStat value={DASH} label={t('Aprobadas por cliente', 'Client approved')} tone="text-slate-300" />
              <MiniStat value={DASH} label={t('Service Fee acumulado', 'Accrued service fee')} tone="text-slate-300" size="text-lg" />
              <MiniStat value={m.quotes ? formatAmount(m.quotes.amount, cur, activeLang) : DASH} label={t('Valor cotizado total', 'Total quoted value')} tone="text-purple-600" size="text-lg" />
            </div>
          </Panel>
          <Panel accent="from-emerald-500 to-teal-600" title={t('Autorizaciones y controles', 'Authorizations and controls')} subtitle={t('Compuertas comerciales y documentales', 'Commercial and documentary gateways')} icon="✅" iconBg="bg-emerald-50 text-emerald-600">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat value={formatCount(poDocs)} label={t('OC registradas', 'Registered PO')} />
              <MiniStat value={chs?.toReview === null || chs?.toReview === undefined ? DASH : `${formatCount(chs.toReview)}${chs.toReviewTruncated ? '+' : ''}`} label={t('Cambios por revisar (tú)', 'Changes to review (you)')} />
              <MiniStat value={formatCount(stages.counts[3] || 0)} label={t('En comparativo/autorización', 'In comparison/approval')} />
              <MiniStat value={DASH} label={t('Servicios autorizados', 'Authorized services')} tone="text-slate-300" />
            </div>
            <div className="mt-2"><SourceState state={chg} t={t} /></div>
          </Panel>
          <Panel accent="from-amber-500 via-rose-500 to-red-600" title={t('Facturación y cierre', 'Invoicing and closing')} subtitle={t('Cierre comercial de ambas rutas', 'Commercial closure of both routes')} icon="🧾" iconBg="bg-amber-50 text-amber-600">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat value={formatCount(summary.with_invoice)} label={t('Con factura', 'With invoice')} />
              <MiniStat value={formatCount(summary.with_delivery)} label={t('Con entrega', 'With delivery')} />
              <MiniStat value={formatCount(Math.max(0, (Number(summary.with_delivery) || 0) - (Number(summary.with_invoice) || 0)))} label={t('Entregadas sin factura (aprox.)', 'Delivered w/o invoice (approx.)')} />
              <MiniStat value={DASH} label={t('Pagadas', 'Paid')} tone="text-slate-300" />
            </div>
          </Panel>
          <Panel accent="from-amber-500 to-red-600" title={t('Riesgos transversales', 'Cross-cutting risks')} subtitle={t('Prioridades de compra y servicios', 'Purchasing priorities and services')} icon="🚨" iconBg="bg-rose-50 text-rose-600">
            <SourceState state={ops} t={t} />
            {opsReady && <div className="space-y-3">
              {status.overdue > 0 && <div className="p-3 bg-rose-50/70 border-l-4 border-l-rose-500 rounded-r-2xl border border-slate-100 text-[11px] font-semibold text-slate-700"><strong className="text-rose-700 font-extrabold">{t('Atención: ', 'Attention: ')}</strong>{t(`${formatCount(status.overdue)} requisición(es) con fecha requerida vencida sin entrega aceptada.`, `${formatCount(status.overdue)} requisition(s) past their required date without accepted delivery.`)}</div>}
              {prov.overdue > 0 && <div className="p-3 bg-amber-50/70 border-l-4 border-l-amber-500 rounded-r-2xl border border-slate-100 text-[11px] font-semibold text-slate-700"><strong className="text-amber-700 font-extrabold">{t('Atención: ', 'Attention: ')}</strong>{t(`${formatCount(prov.overdue)} solicitud(es) provisional(es) con regularización vencida.`, `${formatCount(prov.overdue)} provisional request(s) with overdue regularization.`)}</div>}
              {prio.urgent > 0 && <div className="p-3 bg-rose-50/70 border-l-4 border-l-rose-500 rounded-r-2xl border border-slate-100 text-[11px] font-semibold text-slate-700"><strong className="text-rose-700 font-extrabold">{t('Prioridad: ', 'Priority: ')}</strong>{t(`${formatCount(prio.urgent)} requisición(es) crítica(s).`, `${formatCount(prio.urgent)} critical requisition(s).`)}</div>}
              {!status.overdue && !prov.overdue && !prio.urgent && <div className="p-3 bg-emerald-50/60 border border-emerald-100/80 rounded-xl text-[11px] font-medium text-emerald-800">{t('Sin riesgos detectados con las reglas actuales.', 'No risks detected with current rules.')}</div>}
            </div>}
          </Panel>
        </div>
      </div>

      {/* 8. SECCIÓN: ALERTAS, MOVIMIENTOS Y CICLO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        <Panel accent="from-rose-500 to-pink-600" title={t('Alertas inteligentes', 'Smart alerts')} subtitle={t('Prioridades y desviaciones que requieren atención.', 'Priorities and deviations that require attention.')} icon="🚨" iconBg="bg-purple-50/60">
          <SourceState state={ops} t={t} />
          {opsReady && <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {alertList.items.map(a => <div key={a.id} className={`p-3 rounded-2xl border text-xs font-semibold leading-relaxed ${a.type === 'danger' ? 'bg-rose-50/50 border-rose-100/80 border-l-4 border-l-rose-500 text-slate-700' : 'bg-amber-50/50 border-amber-100/80 border-l-4 border-l-amber-500 text-slate-700'}`}>
              {a.kind === 'need' ? t(`${a.folio} venció hace ${a.days} día(s).`, `${a.folio} expired ${a.days} day(s) ago.`) : t(`${a.folio}: regularización vencida hace ${a.days} día(s).`, `${a.folio}: regularization overdue by ${a.days} day(s).`)}
              <span className="block text-[10px] font-medium text-slate-400 truncate">{a.client}</span>
            </div>)}
            {alertList.total > alertList.items.length && <p className="text-[10px] text-slate-400">{t(`Mostrando ${alertList.items.length} de ${alertList.total}.`, `Showing ${alertList.items.length} of ${alertList.total}.`)}</p>}
            {!alertList.total && <Pending text={t('Sin alertas con las reglas actuales.', 'No alerts with current rules.')} />}
          </div>}
        </Panel>
        <Panel accent="from-blue-500 to-indigo-600" title={t('Últimos movimientos', 'Latest moves')} subtitle={t('Trazabilidad reciente del sistema.', 'Recent system traceability.')} icon="🕒" iconBg="bg-purple-50/60">
          <SourceState state={ops} t={t} />
          {opsReady && (moves.length ? <div className="max-h-[350px] overflow-y-auto pr-1 py-1">
            {moves.map(item => <div key={item.id} className="grid grid-cols-[64px_1fr] gap-3">
              <span className="text-[9px] font-bold text-slate-400 text-right leading-tight pt-0.5">{formatUtc(item.at, isEn)}</span>
              <div className="relative border-l-2 border-blue-600 pl-4 pb-4"><span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-600" />
                <p className="text-xs font-black text-slate-900 leading-tight break-words">{item.created ? t('Alta / creación', 'Creation') : t('Actualización', 'Update')} · {item.folio}</p>
                <p className="text-[11px] font-medium text-slate-500 leading-snug mt-0.5">{item.client} · {stageName(item.stage ?? -1)}</p></div>
            </div>)}
          </div> : <Pending text={t('Sin movimientos.', 'No activity.')} />)}
        </Panel>
        <Panel accent="from-indigo-600 via-purple-600 to-pink-500" title={t('Avance del ciclo', 'Cycle progress')} subtitle={t('Promedio de avance de las requisiciones.', 'Average progress of requisitions.')} icon="🚀" iconBg="bg-purple-50/60">
          <SourceState state={ops} t={t} />
          {opsReady && <>
            <div className="mb-6"><span className="text-4xl font-black text-blue-600 tracking-tight">{avg === null ? DASH : `${avg}%`}</span>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-2"><div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 h-full rounded-full" style={{ width: `${avg || 0}%` }} /></div></div>
            <div className="space-y-2 pt-1 border-t border-slate-100">
              {[['Procure-to-Pay', avg === null ? DASH : `${avg}%`], ['Service-to-Cash', DASH], [t('Service fee aplicado', 'Applied service fee'), DASH], [t('Cerradas (factura)', 'Closed (invoice)'), `${pct(status.closed, status.total)}%`]].map(([label, val]) =>
                <div key={label} className="flex items-center justify-between text-xs py-1 border-b border-slate-50"><span className="text-slate-500 font-medium">{label}</span><span className="font-black text-slate-900">{val}</span></div>)}
            </div>
          </>}
        </Panel>
      </div>

      {/* 9. RESUMEN OPERATIVO GENERAL (GRID 5x2) */}
      <div className="pt-4">
        <div className="mb-4"><h2 className="text-xl font-black text-slate-900">{t('Resumen operativo general', 'General operational summary')}</h2><p className="text-xs text-slate-500 font-medium">{t('Métricas globales de clientes, proveedores y flujo de abastecimiento.', 'Global metrics for customers, suppliers, and supply flow.')}</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            [t('Clientes activos', 'Active clients'), activeCount(cats.clients) ?? DASH, t(`${formatCount(data.catalogs?.clients)} registrados`, `${formatCount(data.catalogs?.clients)} registered`), '🏢', 'border-t-blue-500', 'bg-blue-100/60', 'bg-blue-100/40'],
            [t('Proveedores activos', 'Active suppliers'), activeCount(cats.suppliers) ?? DASH, t(`${formatCount(data.catalogs?.suppliers)} registrados`, `${formatCount(data.catalogs?.suppliers)} registered`), '🚚', 'border-t-teal-500', 'bg-teal-100/60', 'bg-teal-100/40'],
            [t('Con RFQ', 'With RFQ'), formatCount(summary.with_rfq), t('Requisiciones con solicitud de cotización', 'Requisitions with quotation request'), '📨', 'border-t-purple-600', 'bg-purple-100/60', 'bg-purple-100/40'],
            [t('Con oferta', 'With offer'), formatCount(summary.with_supplier_quote), t('Cotizaciones de proveedores', 'Supplier quotes'), '📊', 'border-t-blue-500', 'bg-blue-100/60', 'bg-blue-100/40'],
            [t('Cotizaciones al cliente', 'Client quotes'), formatCount(summary.with_customer_quote), t(`${formatCount(cq)} versión(es)`, `${formatCount(cq)} version(s)`), '🧮', 'border-t-pink-500', 'bg-rose-100/60', 'bg-rose-100/40'],
            [t('Órdenes de compra', 'Purchase orders'), formatCount(summary.with_purchase_order), t(`${formatCount(poDocs)} OC registradas`, `${formatCount(poDocs)} recorded PO`), '🛒', 'border-t-orange-500', 'bg-orange-100/60', 'bg-orange-100/40'],
            [t('Recepciones', 'Receipts'), formatCount(summary.with_receipt), t(`${formatCount(summary.with_delivery)} con entrega`, `${formatCount(summary.with_delivery)} delivered`), '📦', 'border-t-emerald-600', 'bg-emerald-100/60', 'bg-emerald-100/40'],
            [t('Facturas', 'Invoices'), formatCount(summary.with_invoice), t('Pago: pendiente de integración', 'Payment: pending integration'), '📋', 'border-t-rose-600', 'bg-rose-100/60', 'bg-rose-100/40'],
            [t('Entregas aceptadas', 'Accepted deliveries'), v(status.delivered), t('Aceptación del cliente', 'Client acceptance'), '🤝', 'border-t-teal-700', 'bg-teal-100/60', 'bg-teal-100/40'],
            [t('Procesos vencidos', 'Overdue processes'), v(status.overdue), t('Requieren seguimiento', 'Require follow-up'), '⏰', 'border-t-red-600', 'bg-rose-100/60', 'bg-rose-100/40'],
          ].map(([title, value, subtitle, emoji, border, badge, circle]) => <div key={title} className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-xs relative overflow-hidden flex flex-col justify-between border-t-4 ${border} hover:shadow-md transition-all duration-300 min-h-[125px]`}>
            <div className="flex items-start justify-between gap-2 z-10"><span className="text-xs font-bold text-slate-800 leading-tight">{title}</span><div className={`w-8 h-8 rounded-xl ${badge} flex items-center justify-center text-sm shrink-0 shadow-xs`}>{emoji}</div></div>
            <div className="space-y-0.5 mt-2 z-10"><p className="text-2xl font-black text-slate-900 tracking-tight leading-none tabular-nums">{typeof value === 'number' ? formatCount(value) : value}</p><p className="text-[10px] font-medium text-slate-400">{subtitle}</p></div>
            <div className={`absolute -bottom-5 -right-5 w-20 h-20 ${circle} rounded-full blur-sm pointer-events-none`} />
          </div>)}
        </div>
      </div>

      {/* 10. MÉTRICAS Y PIPELINES (AMPLIADO) */}
      <div className="pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel accent="from-pink-500 via-purple-500 to-blue-500" title={t('Prioridad de requisiciones', 'Requisition priority')} subtitle={t('Distribución actual por urgencia y criticidad.', 'Current distribution by urgency and criticality.')} icon="⚡">
          <SourceState state={ops} t={t} />
          {opsReady && (() => { const max = Math.max(1, prio.urgent, prio.high, prio.normal); return <div className="pt-4 pb-2 flex items-end justify-center gap-6 w-full">
            <VBar value={formatCount(prio.urgent)} label={t('Crítica', 'Critical')} percent={prio.urgent * 100 / max} color="bg-rose-600" />
            <VBar value={formatCount(prio.high)} label={t('Alta', 'High')} percent={prio.high * 100 / max} color="bg-rose-400" />
            <VBar value={formatCount(prio.normal)} label="Normal" percent={prio.normal * 100 / max} color="bg-blue-500" />
          </div>; })()}
        </Panel>
        <Panel accent="from-blue-600 to-indigo-600" title={t('Actividad por cliente', 'Activity by client')} subtitle={t('Clientes con mayor número de requisiciones registradas.', 'Clients with the highest number of registered requisitions.')} icon="👥" iconBg="bg-blue-50 text-blue-600">
          <div className="space-y-2.5 pt-1">
            {(opsReady ? activity.map(a => ({ id: a.id, name: a.name, count: a.total, detail: t(`${formatCount(a.open)} proceso(s) abierto(s)`, `${formatCount(a.open)} open process(es)`) }))
              : (data.top_clients || []).slice(0, 5).map(c => ({ id: c.id, name: c.name, count: Number(c.requisitions) || 0, detail: t('requisiciones', 'requisitions') }))).map((item, i) =>
              <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50/70 hover:bg-blue-50/40 rounded-2xl border border-slate-100/80 transition-all"><div className="flex items-center gap-3 min-w-0"><div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">{i + 1}</div><div className="min-w-0"><p className="text-xs font-black text-slate-900 leading-tight break-words">{item.name}</p><p className="text-[9px] font-bold text-slate-400 leading-tight mt-0.5">{item.detail}</p></div></div><span className="text-xs font-black text-blue-600 ml-2">{formatCount(item.count)}</span></div>)}
            {!(data.top_clients || []).length && <Pending text={t('Sin registros.', 'No records.')} />}
          </div>
        </Panel>
        <Panel accent="from-blue-500 via-purple-500 to-pink-500" title={t('Conversión documental del proceso', 'Document conversion for the process')} subtitle={t('Requisiciones con cada documento; los grupos pueden solaparse.', 'Requisitions with each document; categories can overlap.')} icon="📊">
          <div className="space-y-4 pt-3">
            {[['with_rfq', 'bg-purple-600'], ['with_supplier_quote', 'bg-blue-400'], ['with_customer_quote', 'bg-pink-500'], ['with_purchase_order', 'bg-orange-500']].map(([k, color]) => <div key={k} className="space-y-1">
              <div className="flex items-center justify-between text-xs"><span className="text-[11px] font-bold text-slate-700">{coverage.find(c => c[0] === k)[1]}</span><span className="text-xs font-black text-slate-800">{formatCount(summary[k])}</span></div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex items-center"><div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct(summary[k], total)}%` }} /></div>
            </div>)}
          </div>
        </Panel>
        <Panel accent="from-blue-500 to-teal-500" title={t('Seguimiento de cierres', 'Tracking of closures')} subtitle={t('Recepción, entrega, aceptación y facturación del suministro.', 'Receipt, delivery, acceptance, and invoicing of the supply.')} icon="✅" iconBg="bg-emerald-50 text-emerald-600">
          {(() => { const items = [[summary.with_receipt, t('Recepción', 'Receipt'), 'bg-blue-500'], [summary.with_delivery, t('Entrega', 'Delivery'), 'bg-teal-500'], [summary.with_invoice, t('Factura', 'Invoice'), 'bg-rose-500']]; const max = Math.max(1, ...items.map(x => Number(x[0]) || 0));
            return <div className="pt-4 pb-2 flex items-end justify-center gap-6 w-full">{items.map(([n, label, color]) => <VBar key={label} value={formatCount(n)} label={label} percent={(Number(n) || 0) * 100 / max} color={color} />)}</div>; })()}
        </Panel>
        <Panel accent="from-purple-600 to-orange-500" title={t('Pipeline económico', 'Economic pipeline')} subtitle={t('Montos guardados desde la cotización comercial hasta la OC.', 'Stored amounts from the commercial quote to the PO.')} icon="💵" iconBg="bg-emerald-50 text-emerald-600">
          {cur ? (() => { const max = Math.max(1, m.quotes?.amount || 0, m.po?.amount || 0); return <div className="pt-4 pb-2 flex items-end justify-center gap-8 w-full">
            <VBar value={m.quotes ? formatAmount(m.quotes.amount, cur, activeLang) : DASH} label={t('Cotización cliente', 'Client quote')} percent={(m.quotes?.amount || 0) * 100 / max} color="bg-purple-600" sub={cur} />
            <VBar value={m.po ? formatAmount(m.po.amount, cur, activeLang) : DASH} label={t('Órdenes de compra', 'Purchase orders')} percent={(m.po?.amount || 0) * 100 / max} color="bg-orange-500" sub={cur} />
          </div>; })() : <Pending tall text={t('Sin importes registrados para este filtro.', 'No recorded amounts for these filters.')} />}
        </Panel>
        <Panel accent="from-rose-500 to-purple-600" title={t('Estatus de facturación', 'Billing status')} subtitle={t('Situación actual de las facturas registradas en el sistema.', 'Current status of invoices recorded in the system.')} icon="🏺" iconBg="bg-rose-50 text-rose-500">
          {Number(summary.with_invoice) ? <div className="space-y-3"><MiniStat value={formatCount(summary.with_invoice)} label={t('Requisiciones con factura vinculada', 'Requisitions with linked invoice')} /><Pending text={t('El estatus de pago de cada factura está pendiente de integración.', 'Per-invoice payment status is pending integration.')} /></div>
            : <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 p-4 text-center"><p className="text-xs font-medium text-slate-400">{t('No existen facturas registradas para analizar su estatus.', 'There are no recorded invoices to analyze their status.')}</p></div>}
        </Panel>
        <Panel className="lg:col-span-3" accent="from-blue-500 to-indigo-500" title={t('Requisiciones por mes', 'Monthly requisitions')} subtitle={t('Meses con fecha registrada; hasta 24 meses con datos.', 'Recorded request months; up to 24 months with data.')} icon="📅" iconBg="bg-blue-50 text-blue-600">
          {(data.monthly || []).length ? <div className="flex items-end gap-2 overflow-x-auto pt-4 pb-1 min-h-[180px]">{data.monthly.map(row => <div key={row.period} className="flex flex-col items-center min-w-[44px] flex-1">
            <span className="text-[10px] font-black text-slate-800 mb-1">{row.requisitions}</span>
            <div className="w-full bg-slate-50 rounded-xl h-32 flex items-end p-1"><div className="w-full bg-gradient-to-t from-blue-600 to-indigo-500 rounded-lg" style={{ height: `${Math.max(4, Number(row.requisitions) * 100 / maxMonth)}%` }} /></div>
            <span className="text-[9px] font-bold text-slate-500 mt-1 tabular-nums">{row.period}</span></div>)}</div>
            : <Pending text={t('No hay fechas para este filtro.', 'No dated records for these filters.')} />}
        </Panel>
      </div>

      {/* 11. CONTROL DE SOLICITUDES SIN REQUISICIÓN */}
      <div className="pt-6"><div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div><div className="flex items-center gap-2"><span className="text-xl">📑</span><h3 className="text-base font-black text-slate-900">{t('Control de solicitudes sin requisición', 'Control of requests without a requisition')}</h3></div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t('Expedientes provisionales y su regularización documental.', 'Provisional files and their documentary regularization.')}</p></div>
          <button onClick={() => onNavigate('requisition')} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition-all shadow-sm active:scale-95 self-start sm:self-auto cursor-pointer">{t('Ir a Regularización →', 'Go to Regularization →')}</button>
        </div>
        <SourceState state={ops} t={t} />
        {opsReady && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[[t('PROVISIONALES', 'PROVISIONAL'), prov.total], [t('PENDIENTES', 'PENDING'), prov.pending], [t('VENCIDAS', 'OVERDUE'), prov.overdue], [t('REGULARIZADAS', 'REGULARIZED'), prov.done]].map(([label, n]) =>
            <div key={label} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 flex flex-col justify-between hover:border-slate-200 hover:bg-slate-50 transition-all"><span className="text-2xl font-black text-slate-900 mb-6">{formatCount(n)}</span><span className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{label}</span></div>)}
        </div>}
      </div></div>

      {/* 12. CONTROL DE RECOMPRA, PRECIOS, CAMBIOS Y REVISIONES */}
      <div className="pt-6"><div className="bg-slate-50/60 rounded-3xl border border-slate-200/80 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><div className="flex items-center gap-2"><span className="text-xl">🧭</span><h3 className="text-base font-black text-slate-900">{t('Control de recompra, precios, cambios y revisiones', 'Management of repurchases, pricing, changes, and revisions')}</h3></div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t('Indicadores de las rutas agregadas: requisiciones desde historial, tratamiento por partida, políticas comerciales, Change Requests, revisiones de cotización y enmiendas de OC.', 'Indicators of the added routes: requisitions from history, treatment by item, commercial policies, Change Requests, quote revisions and PO amendments.')}</p></div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-[11px] border border-blue-100">R3 · MariaDB</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            [v(hist.total), t('Requisiciones desde historial', 'Requisitions from history'), t('Marcadas como basadas en historial', 'Flagged as history-based'), 'from-blue-500 to-blue-600'],
            [DASH, t('Precios respetados', 'Prices honored'), t('Pendiente de integración', 'Pending integration'), 'from-purple-500 to-indigo-600'],
            [DASH, t('Partidas por recotizar', 'Items to re-quote'), t('Pendiente de integración', 'Pending integration'), 'from-amber-400 to-amber-500'],
            [DASH, t('Precio comercial pendiente', 'Pending commercial price'), t('Pendiente de integración', 'Pending integration'), 'from-rose-500 to-pink-600'],
            [chs?.own === null || chs?.own === undefined ? DASH : formatCount(chs.own), 'Change Requests', chs ? t(`${formatCount(chs.byStatus.pending_review || 0)} pendiente(s) de revisión · propias`, `${formatCount(chs.byStatus.pending_review || 0)} pending review · own`) : DASH, 'from-teal-400 to-teal-600'],
            [DASH, t('Enmiendas de OC', 'PO amendments'), t('Bloqueadas hasta validación integral', 'Blocked until end-to-end validation'), 'from-orange-500 to-red-500'],
          ].map(([n, title, sub, grad]) => <div key={title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${grad}`} />
            <div><span className={`text-2xl font-black ${n === DASH ? 'text-slate-300' : 'text-slate-900'} block mb-1`}>{n}</span><h4 className="text-xs font-black text-slate-800 leading-tight">{title}</h4></div>
            <p className="text-[10px] font-medium text-slate-400 mt-2 leading-tight">{sub}</p>
          </div>)}
        </div>
        <SourceState state={chg} t={t} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[[t('Rutas de precio al cliente', 'Customer pricing paths'), t('Tratamiento configurado por partida en requisiciones desde historial.', 'Configured treatment per line in history-based requisitions.')],
            [t('Rutas de abastecimiento', 'Supply routes'), t('Proveedor histórico, validación o nueva cotización.', 'Historical supplier, validation, or new quote.')],
            [t('Políticas de clientes', 'Customer policies'), t('Configuración general que sirve como valor por defecto.', 'General configuration used as the default value.')]].map(([title, sub]) =>
            <div key={title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between"><div><h4 className="text-sm font-black text-slate-900">{title}</h4><p className="text-[10px] text-slate-400 font-medium">{sub}</p></div><div className="mt-4"><Pending text={PENDING} /></div></div>)}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[640px]">
          <thead><tr className="bg-slate-100/70 text-[10px] font-black text-slate-600 tracking-wider uppercase border-b border-slate-100">{[t('Requisición', 'Requisition'), t('Cliente', 'Customer'), t('Partidas', 'Lines'), t('Revisión', 'Revision'), t('Etapa', 'Stage')].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
            {opsReady && hist.items.map(r => <tr key={r.id} className="hover:bg-slate-50/60"><td className="p-3 font-bold text-slate-900">{r.folio}</td><td className="p-3">{r.client}</td><td className="p-3 tabular-nums">{formatCount(r.line_count)}</td><td className="p-3 tabular-nums">Rev. {formatCount(r.current_revision_number)}</td><td className="p-3">{r.stage || DASH}</td></tr>)}
            {(!opsReady || !hist.items.length) && <tr><td colSpan={5} className="p-12 text-center bg-slate-50/30"><span className="text-xs font-medium text-slate-400">{opsReady ? t('Todavía no existen requisiciones creadas desde historial.', 'There are no requisitions created from history yet.') : DASH}</span></td></tr>}
          </tbody></table></div></div>
      </div></div>

      {/* 13. DASHBOARD DE COMPRADORES */}
      <div className="pt-6"><div className="bg-slate-50/60 rounded-3xl border border-slate-200/80 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div>
          <span className="inline-block px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] uppercase tracking-wider mb-2">{t('Responsabilidades y segregación de funciones', 'Responsibilities and segregation of duties')}</span>
          <h3 className="text-xl font-black text-slate-900">{t('Dashboard de compradores, preparación/revisión y autorización', 'Buyer dashboard, preparation/review, and authorization')}</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">{t('Separa las responsabilidades de las requisiciones de las funciones propias de las Órdenes de Compra.', 'Separate requisition responsibilities from Purchase Order functions.')}</p></div></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[['📝', 'border-l-blue-500', t('Requisiciones / Gestión del Contratista', 'Requisitions / Contractor Management'), t('El comprador/responsable se toma de la validación interna vinculada a cada requisición.', 'The buyer is taken from the internal validation linked to each requisition.')],
            ['🛒', 'border-l-purple-500', t('Órdenes de Compra', 'Purchase Orders'), t('Comprador, Preparó/Revisó y Autorizó se leen de cada OC emitida.', 'Buyer, Prepared/Reviewed and Authorized are read from each issued PO.')]].map(([emoji, border, title, sub]) =>
            <div key={title} className="space-y-3"><div className={`bg-white rounded-2xl border-l-4 ${border} border border-slate-100 p-4 shadow-sm flex items-center gap-3`}><span className="text-xl p-2 bg-slate-50 rounded-xl">{emoji}</span><div><h4 className="text-sm font-black text-slate-900">{title}</h4><p className="text-[10px] text-slate-400 font-medium">{sub}</p></div></div><Pending text={PENDING} /></div>)}
        </div>
      </div></div>

      {/* 14. SEGREGACIÓN DE FUNCIONES - ÓRDENES DE COMPRA */}
      <div className="pt-6"><div className="bg-slate-50/60 rounded-3xl border border-slate-200/80 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div>
          <div className="flex items-center gap-2"><span className="text-xl">🛒</span><h3 className="text-lg font-black text-slate-900">{t('Segregación de funciones · Órdenes de compra', 'Segregation of duties · Purchase orders')}</h3></div>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t('Las tres funciones se muestran por separado para evitar confundir requisiciones con responsabilidades de la OC.', 'The three functions are shown separately to avoid confusing requisitions with PO responsibilities.')}</p></div>
          <span className="self-start sm:self-auto px-3.5 py-1 rounded-full bg-amber-100/80 text-amber-800 font-black text-xs border border-amber-200/60">{formatCount(poDocs)} OC</span></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[[t('Comprador de la OC', 'PO Buyer'), '🛒', 'bg-blue-50 text-blue-600'], [t('Preparó / Revisó', 'Prepared / Reviewed'), '✏️', 'bg-amber-50 text-amber-600'], [t('Autorizó', 'Authorized'), '✅', 'bg-emerald-50 text-emerald-600']].map(([title, emoji, tone]) =>
            <div key={title} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6"><div className="flex items-center justify-between mb-4"><h4 className="text-sm font-black text-slate-900">{title}</h4><span className={`p-2 ${tone} rounded-xl text-xs`}>{emoji}</span></div><Pending tall text={PENDING} /></div>)}
        </div>
      </div></div>

      {/* Últimas requisiciones del filtro (funcionalidad existente) */}
      <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-slate-900">{t('Últimas requisiciones del filtro', 'Recent requisitions in scope')}</h2><p className="text-xs text-slate-500">{t('Registros reales, según fecha de solicitud.', 'Real records sorted by request date.')}</p></div>
          <button onClick={() => onNavigate('general_matrix')} className="text-xs font-bold text-blue-700 flex gap-1 items-center hover:underline">{t('Ver Matriz', 'View Matrix')}<ArrowRight size={15} /></button></div>
        <div className="overflow-x-auto mt-4"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">{t('Folio', 'Folio')}</th><th className="p-3">{t('Cliente', 'Client')}</th><th className="p-3">{t('Solicitud', 'Date')}</th><th className="p-3">{t('OC', 'PO')}</th></tr></thead>
          <tbody>{recent.map(r => <tr key={r.id} className="border-b border-slate-100"><td className="p-3 font-bold text-slate-800">{r.folio}</td><td className="p-3 text-slate-700">{r.client_name}</td><td className="p-3 text-slate-600">{r.request_date || DASH}</td><td className="p-3 tabular-nums">{r.purchase_order_count}</td></tr>)}
            {!recent.length && <tr><td colSpan={4} className="p-5 text-slate-500">{t('Sin registros.', 'No records.')}</td></tr>}</tbody></table></div>
      </section>

      <div className="text-[11px] text-slate-500 bg-slate-100 rounded-xl p-3 space-y-1">
        <p>{data.definitions?.coverage} {data.definitions?.document_grain}</p>
        <p>{t('Reglas del tablero: etapas según la política de 8 etapas del Apps Script calculada en el servidor; "abierto" = etapa anterior a Factura; "vencido" = fecha requerida anterior a hoy sin llegar a Entrega y aceptación; las secciones sin fuente se marcan como pendientes de integración y no muestran cifras.', 'Dashboard rules: stages follow the Apps Script 8-stage policy computed server-side; "open" = stage before Invoice; "overdue" = required date before today without reaching Delivery & acceptance; sections without a source are marked pending integration and show no figures.')}</p>
      </div>
    </>}
  </div>;
};
