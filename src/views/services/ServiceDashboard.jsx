import React, { useMemo, useState } from 'react';
import { servicesMatrix } from './api';
import { useLoad } from '../reception/useLoad.js';
import { PERIODS, dashboard, money, barPct, donut, STATUS_COLORS, alertText } from './dashboardModel.mjs';
import { localToday, httpMessage } from './newRequestModel.mjs';

// Servicios Operativos · sección 1 "Dashboard" (Panel ejecutivo) conectada a MariaDB en modo lectura: reutiliza
// GET /api/v1/services/matrix (cliente y servicio se filtran en el servidor; el periodo, por fecha de solicitud, en el
// navegador). Sin datos de demostración y sin escrituras. Límite: 2,000 servicios por consulta (igual que Reportes).
const MAX_PAGES = 40;
const BAR = ['bg-blue-600', 'bg-purple-600', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-slate-500', 'bg-lime-500'];

export function ServiceDashboard({ en = false, t }) {
  const tx = (es, e) => (en ? e : es);
  const [period, setPeriod] = useState('all');
  const [client, setClient] = useState('all');
  const [service, setService] = useState('');
  const [reload, setReload] = useState(0);
  const today = localToday();
  const load = useLoad(async signal => {
    const rows = []; let page = 1; let total = 0; let first = null;
    do {
      const r = await servicesMatrix({ client, service, page, page_size: 50 }, signal);
      if (!first) first = r;
      rows.push(...r.items); total = r.total; page += 1;
    } while (rows.length < total && page <= MAX_PAGES);
    return { rows, total, clients: first?.summary?.clients || [], types: first?.service_types || [] };
  }, [client, service, reload]);
  const data = load.data;
  const d = useMemo(() => dashboard(data?.rows || [], { period, today, en }), [data, period, today, en]);
  const c = d.money.main.currency;
  const m = v => money(v, d.money.others.length ? c : '');
  const ready = load.status === 'ready' || (load.status === 'loading' && data);

  const sel = 'p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs';
  const card = 'bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3';
  const kpi = (testid, value, icon, label, sub, color, bar) => (
    <div data-testid={testid} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
      <div className={`absolute top-0 left-0 right-0 h-1 ${bar} rounded-t-2xl`} />
      <div className="flex items-center justify-between gap-1 min-w-0"><span title={String(value)} className={`${String(value).length > 13 ? 'text-[12px]' : String(value).length > 6 ? 'text-[15px]' : 'text-xl'} font-black text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis min-w-0`}>{value}</span><span className="text-sm shrink-0">{icon}</span></div>
      <div className="mt-2"><p className="text-[11px] text-slate-400 font-medium">{label}</p><p className={`text-[10px] font-extrabold ${color}`}>{sub}</p></div>
    </div>
  );
  const progress = (testid, label, value, color) => (
    <div data-testid={testid} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
      <span className="text-lg font-black text-slate-900">{value}%</span>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></div>
    </div>
  );
  const bars = (testid, list, value, fmt) => {
    const max = Math.max(0, ...list.map(value));
    return (
      <div data-testid={testid} className="h-40 flex items-end justify-around gap-1 border-b border-slate-100 pb-1 pt-2">
        {list.length ? list.slice(0, 8).map((g, i) => (
          <div key={g.key} className="text-center flex-1 min-w-0 flex flex-col items-center justify-end h-full" title={`${g.key}: ${fmt(value(g))}`}>
            <span className="text-[9px] font-bold text-slate-700 mb-0.5 whitespace-nowrap">{fmt(value(g))}</span>
            <div className={`w-6 ${BAR[i % BAR.length]} rounded-t-md`} style={{ height: `${barPct(value(g), max) * 0.8}%` }} />
            <span className="text-[8px] text-slate-500 font-bold mt-1 block w-full truncate">{g.key}</span>
          </div>
        )) : <p className="text-[11px] text-slate-400 self-center">{tx('Sin servicios para este filtro.', 'No services for this filter.')}</p>}
      </div>
    );
  };
  const tile = (testid, value, label, tone = '') => <div data-testid={testid} className={`p-2.5 rounded-xl border ${tone || 'bg-slate-50 border-slate-100'}`}><span className={`text-lg font-black block ${tone ? 'text-amber-800' : 'text-slate-900'}`}>{value}</span><span className={`text-[9px] ${tone ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>{label}</span></div>;
  const trendMax = Math.max(0, ...d.trend.flatMap(o => [o.price, o.cost, o.margin]));
  const funnelLabel = { requests: t.topSection.requests, authorized: t.topSection.authorized, executed: t.topSection.executed, ready: t.topSection.readyToInvoice, invoiced: t.topSection.invoiced };
  const funnelColor = { requests: 'bg-purple-600', authorized: 'bg-blue-600', executed: 'bg-purple-500', ready: 'bg-indigo-500', invoiced: 'bg-blue-400' };

  return (
    <div className="space-y-6 text-left" data-testid="service-dashboard">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{t.title}</h3>
          <p className="text-xs text-slate-400">{t.subtitle}</p>
          {data && <p data-testid="sd-source" className="text-[10px] text-slate-500 mt-1">{tx(`${d.total} servicio(s) en el periodo · ${data.total} con este cliente/servicio en MariaDB`, `${d.total} service(s) in the period · ${data.total} for this client/service in MariaDB`)}{data.rows.length < data.total ? tx(` · se analizan ${data.rows.length}`, ` · ${data.rows.length} analyzed`) : ''}</p>}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto text-xs font-medium">
          <select data-testid="sd-period" value={period} onChange={e => setPeriod(e.target.value)} className={sel}>{PERIODS.map(([k, es, e]) => <option key={k} value={k}>{en ? e : es}</option>)}</select>
          <select data-testid="sd-client" value={client} onChange={e => setClient(e.target.value)} className={sel}>
            <option value="all">{t.filters.allClients}</option>
            {(data?.clients || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select data-testid="sd-service" value={service} onChange={e => setService(e.target.value)} className={sel}>
            <option value="">{t.filters.allServices}</option>
            {(data?.types || []).map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>

      {load.status === 'error' && (
        <div data-testid="sd-error" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-[12px] text-rose-700 flex flex-wrap items-center justify-between gap-3">
          <span><b>{tx('No se pudo cargar el panel.', 'The dashboard could not be loaded.')}</b> {httpMessage(load.error, en)}</span>
          {![401, 403].includes(load.error?.status) && <button type="button" data-testid="sd-retry" onClick={() => setReload(n => n + 1)} className="px-4 h-9 rounded-xl bg-white border border-rose-200 text-rose-700"><span className="font-black text-[12px]">{tx('Reintentar', 'Retry')}</span></button>}
        </div>
      )}
      {!ready && load.status !== 'error' && <div data-testid="sd-loading" className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-[13px] text-slate-500">{tx('Cargando servicios de MariaDB…', 'Loading services from MariaDB…')}</div>}

      {ready && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {kpi('sd-kpi-services', d.total, '📦', t.kpis.services, t.kpis.portfolio, 'text-blue-600', 'bg-blue-500')}
            {kpi('sd-kpi-active', d.kpis.active, '⚙️', t.kpis.active, `${d.kpis.activePct}% ${t.kpis.ofTotal}`, 'text-purple-600', 'bg-purple-600')}
            {kpi('sd-kpi-executed', d.kpis.executed, '✅', t.kpis.executed, `${d.kpis.executedPct}% ${t.kpis.ofTotal}`, 'text-emerald-600', 'bg-emerald-500')}
            {kpi('sd-kpi-invoiced', d.kpis.invoiced, '🧾', t.kpis.invoiced, `${d.kpis.invoicedPct}% ${t.kpis.ofTotal}`, 'text-teal-600', 'bg-teal-500')}
            {kpi('sd-kpi-income', m(d.money.main.price), '💵', t.kpis.income, t.kpis.accSales, 'text-orange-600', 'bg-orange-500')}
            {kpi('sd-kpi-cost', m(d.money.main.cost), '💳', t.kpis.costs, t.kpis.accCost, 'text-amber-600', 'bg-amber-500')}
            {kpi('sd-kpi-margin', m(d.money.main.margin), '📈', t.kpis.margin, `${d.money.main.marginPct.toFixed(1)}% ${t.kpis.marginPct}`, d.money.main.margin < 0 ? 'text-rose-600' : 'text-rose-600', 'bg-rose-500')}
          </div>
          {d.money.others.length > 0 && <p data-testid="sd-currencies" className="text-[11px] text-slate-500 -mt-3">{tx('Importes en otras monedas (no se suman):', 'Amounts in other currencies (not added up):')} {d.money.others.map(o => `${o.currency || tx('sin moneda', 'no currency')}: ${tx('venta', 'sale')} ${money(o.price, o.currency)} · ${tx('costo', 'cost')} ${money(o.cost, o.currency)} (${o.n})`).join(' · ')}</p>}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {progress('sd-bar-auth', t.bars.commAuth, d.bars.auth, 'bg-blue-600')}
            {progress('sd-bar-evidence', t.bars.fileEvidence, d.bars.evidence, 'bg-purple-600')}
            {progress('sd-bar-po', t.bars.poServices, d.bars.po, 'bg-amber-500')}
            {progress('sd-bar-invoice', t.bars.invConversion, d.bars.invoice, 'bg-teal-500')}
            {progress('sd-bar-margin', t.bars.grossMargin, d.bars.margin, 'bg-rose-500')}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div><h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span>📊</span> {t.charts.monthlyTrend}</h4><p className="text-[11px] text-slate-400">{t.charts.monthlySubtitle}</p></div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">{t.charts.monthsLabel}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-sm" /> {t.charts.income}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" /> {t.charts.costs}</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> {t.charts.margin}</span>
              </div>
              <div data-testid="sd-trend" className="h-48 border-b border-slate-200 flex items-end justify-between px-1 pt-6 pb-1 gap-0.5">
                {d.trend.map(o => (
                  <div key={o.key} data-month={o.key} className="flex flex-col items-center gap-1 flex-1 min-w-0" title={`${o.label}: ${o.n} ${t.charts.servicesUnit} · ${t.charts.income} ${money(o.price)} · ${t.charts.costs} ${money(o.cost)} · ${t.charts.margin} ${money(o.margin)}`}>
                    <div className="h-32 w-full flex items-end justify-center gap-0.5">
                      {[['bg-blue-600', o.price], ['bg-amber-500', o.cost], ['bg-emerald-500', o.margin]].map(([cl, v]) => <div key={cl} className={`w-1.5 sm:w-2 ${cl} rounded-t-sm`} style={{ height: `${barPct(v, trendMax)}%` }} />)}
                    </div>
                    <span className={`text-[9px] ${o.n ? 'text-slate-700 font-bold' : 'text-slate-400 font-medium'} whitespace-nowrap`}>{o.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col">
              <div><h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span>🎯</span> {t.charts.opStatus}</h4><p className="text-[11px] text-slate-400">{t.charts.portfolioDist}</p></div>
              <div className="flex items-center justify-around gap-3 py-2">
                <div data-testid="sd-donut" className="relative w-28 h-28 rounded-full shrink-0" style={{ background: `conic-gradient(${donut(d.statuses, d.total)})` }}>
                  <div className="absolute inset-3 rounded-full bg-white flex items-center justify-center text-center"><div><span className="text-xl font-black text-slate-900 block leading-none">{d.total}</span><span className="text-[9px] text-slate-400 font-medium">{t.charts.servicesUnit}</span></div></div>
                </div>
                <div data-testid="sd-status-legend" className="space-y-1.5 text-[11px] min-w-0">
                  {d.statuses.slice(0, 6).map((s, i) => <div key={s.key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-slate-600 truncate"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }} /> {s.key}</span><span className="font-bold text-slate-900">{s.n}</span></div>)}
                  {!d.statuses.length && <span className="text-slate-400">{tx('Sin servicios.', 'No services.')}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={card}><h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🚚 {t.byType.servicesByType}</h4><p className="text-[10px] text-slate-400">{t.byType.volume}</p>{bars('sd-type-count', d.byType, g => g.n, v => String(v))}</div>
            <div className={card}><h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">💰 {t.byType.incomeByType}</h4><p className="text-[10px] text-slate-400">{t.byType.accSales}</p>{bars('sd-type-income', d.byType, g => g.price, v => money(v))}</div>
            <div className={card}><h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">📈 {t.byType.marginByType}</h4><p className="text-[10px] text-slate-400">{t.byType.grossProfit}</p>{bars('sd-type-margin', d.byType, g => g.margin, v => money(v))}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={card}><h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🏢 {t.topSection.topClients}</h4><p className="text-[10px] text-slate-400">{t.topSection.clientIncome}</p>{bars('sd-top-clients', d.topClients, g => g.price, v => money(v))}</div>
            <div className={card}>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">✅ {t.topSection.commAuthTitle}</h4><p className="text-[10px] text-slate-400">{t.topSection.docControl}</p>
              <div className="flex items-center justify-between py-2 gap-3">
                <div data-testid="sd-auth-pct" className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-slate-900" style={{ background: `conic-gradient(#10b981 0 ${d.auth.pct}%, #e2e8f0 ${d.auth.pct}% 100%)` }}><span className="w-12 h-12 rounded-full bg-white flex items-center justify-center">{d.auth.pct}%</span></div>
                <div data-testid="sd-auth" className="space-y-1 text-[10px] text-slate-600">
                  <div className="flex items-center justify-between gap-3"><span>{t.topSection.validAuth}</span><span className="font-bold text-slate-900">{d.auth.valid}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>{t.topSection.pendingReg}</span><span className="font-bold text-slate-900">{d.auth.pending}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>{t.topSection.rejected}</span><span className="font-bold text-slate-900">{d.auth.rejected}</span></div>
                  <div className="flex items-center justify-between gap-3" title={tx('El sistema original no registró documentos de autorización como archivo propio (solo evidencias del servicio).', 'The original system did not store authorization documents as their own file (only service evidence).')}><span>{t.topSection.withDoc}</span><span className="font-bold text-slate-400">{tx('sin registro', 'not recorded')}</span></div>
                </div>
              </div>
            </div>
            <div className={card}>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">📄 {t.topSection.invFunnel}</h4><p className="text-[10px] text-slate-400">{t.topSection.fromReqToClose}</p>
              <div data-testid="sd-funnel" className="space-y-1.5 pt-1 text-[10px]">
                {d.funnel.map(([k, n]) => <div key={k} className="flex items-center justify-between gap-2"><span className="w-24 shrink-0">{funnelLabel[k]}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className={`${funnelColor[k]} h-full`} style={{ width: `${d.total ? (n / d.total) * 100 : 0}%` }} /></div><span className="font-bold w-6 text-right">{n}</span></div>)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={card}>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🛒 {t.externalSec.extContracting}</h4><p className="text-[10px] text-slate-400">{t.externalSec.vendorAndPO}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {tile('sd-ext-internal', d.external.internal, t.externalSec.intExecution)}
                {tile('sd-ext-external', d.external.external, t.externalSec.extVendor)}
                {tile('sd-ext-linked', d.external.linked, t.externalSec.linkedPO)}
                {tile('sd-ext-pending', d.external.pending, t.externalSec.pendingPO, 'bg-amber-50 border-amber-200/60')}
              </div>
              <div className="pt-1"><div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>{t.externalSec.poCoverage}</span><span data-testid="sd-ext-coverage" className="font-bold">{d.external.external ? `${d.external.coverage}%` : '—'}</span></div><div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="bg-amber-500 h-full" style={{ width: `${d.external.coverage}%` }} /></div></div>
            </div>
            <div className={card}>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">⚙️ {t.externalSec.opStatusTitle}</h4><p className="text-[10px] text-slate-400">{t.externalSec.statusCount}</p>
              <div data-testid="sd-status-grid" className="grid grid-cols-2 gap-2 text-[11px]">
                {d.statuses.map(s => <div key={s.key} className="bg-slate-50 p-3 rounded-xl border border-slate-100"><span className="text-lg font-black block text-slate-900">{s.n}</span><span className="text-[10px] text-slate-500 font-medium">{s.key}</span></div>)}
                {!d.statuses.length && <p className="col-span-2 text-slate-400">{tx('Sin servicios.', 'No services.')}</p>}
              </div>
            </div>
            <div className={card}>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🚨 {t.externalSec.alertsTitle}</h4><p className="text-[10px] text-slate-400">{t.externalSec.priorityAtt}</p>
              <div data-testid="sd-alerts" className="space-y-1.5 text-[10px] max-h-64 overflow-y-auto">
                {d.alerts.length ? d.alerts.slice(0, 8).map(a => <div key={a.folio} className="bg-amber-50 border border-amber-200/80 rounded-xl p-2 text-amber-900 flex items-start gap-1.5 font-medium"><span>⚠️</span> <span>{alertText(a)}</span></div>)
                  : <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-500 text-center font-medium">{t.externalSec.noAlerts}</div>}
                {d.alerts.length > 8 && <p className="text-slate-500 text-center">{tx(`y ${d.alerts.length - 8} servicio(s) más con alertas (ver Reportes › Gerencial).`, `and ${d.alerts.length - 8} more service(s) with alerts (see Reports › Management).`)}</p>}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">📌 {t.mgmtKpis.title}</h4><p className="text-[10px] text-slate-400">{t.mgmtKpis.subtitle}</p>
            <div data-testid="sd-mgmt" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              {[['sd-m-days', t.mgmtKpis.timeReq, d.mgmt.avgDays === null ? '—' : `${d.mgmt.avgDays} ${t.mgmtKpis.days}`], ['sd-m-overdue', t.mgmtKpis.overdueSrv, d.mgmt.overdue], ['sd-m-negative', t.mgmtKpis.negMargin, d.mgmt.negMargin],
                ['sd-m-pendreg', t.mgmtKpis.pendReg, d.mgmt.pendReg], ['sd-m-external', t.mgmtKpis.withExtVendor, d.mgmt.external], ['sd-m-evidence', t.mgmtKpis.withEvidence, d.mgmt.withEvidence]].map(([id, label, v]) => (
                <div key={id} data-testid={id} className="bg-slate-50/80 p-3 rounded-xl border border-slate-100"><span className="text-[10px] text-slate-400 block font-medium">{label}</span><span className="text-base font-black text-slate-900 mt-1 block">{v}</span></div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
