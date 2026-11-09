import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, BarChart3, Loader2, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import { analyticsReport, analyticsCsv } from '../analyticsApi';
import { matrixClients } from '../matrixApi';

const empty = { from: '', to: '', client: 'all', q: '', has: 'all' };
const milestoneOptions = [
  ['all', 'Todas las requisiciones', 'All requisitions'],
  ['rfq', 'Con RFQ', 'With RFQ'],
  ['supplier_quote', 'Con oferta de proveedor', 'With supplier offer'],
  ['customer_quote', 'Con cotización al cliente', 'With client quote'],
  ['purchase_order', 'Con OC', 'With PO'],
  ['receipt', 'Con recepción', 'With receipt'],
  ['delivery', 'Con entrega', 'With delivery'],
  ['invoice', 'Con factura', 'With invoice'],
  ['without_purchase_order', 'Sin OC vinculada', 'Without linked PO'],
];
const count = v => new Intl.NumberFormat('es-MX').format(Number(v) || 0);
const money = (value, currency, isEn) => {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(isEn ? 'en-US' : 'es-MX', {
    style: 'currency', currency: currency || 'MXN', maximumFractionDigits: 2,
  }).format(n) : `${value} ${currency}`;
};

const box = 'bg-white rounded-2xl border border-slate-200 shadow-sm';
const field = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400';

export function Reports({ lang = 'es', language, isEnglish }) {
  const isEn = isEnglish || lang === 'en' || language === 'en';
  const t = (es, en) => isEn ? en : es;
  const [clients, setClients] = useState([]);
  const [draft, setDraft] = useState(empty);
  const [applied, setApplied] = useState(empty);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const invalidRange = !!(draft.from && draft.to && draft.from > draft.to);

  useEffect(() => {
    const controller = new AbortController();
    matrixClients(controller.signal).then(result => {
      if (!controller.signal.aborted) setClients(result.items || []);
    }).catch(() => { if (!controller.signal.aborted) setClients([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError('');
    analyticsReport({ ...applied, page, page_size: 25 }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message || t('Error al consultar MariaDB.', 'Could not load database.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied, page, refresh]);

  const generate = e => {
    e.preventDefault();
    if (invalidRange) { setError(t('La fecha inicial es mayor que la final.', 'Start date exceeds end date.')); return; }
    setPage(1); setApplied({ ...draft });
    setRefresh(n => n + 1);
  };

  const exportCsv = async () => {
    if (downloading || loading || !data) return;
    setDownloading(true); setError('');
    try {
      const blob = await analyticsCsv(applied);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'supplyflow-requisiciones.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message || t('No se pudo exportar.', 'Export failed.')); }
    finally { setDownloading(false); }
  };

  const summary = data?.summary || {};
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 25));
  const selectedClient = clients.find(x => x.id === applied.client)?.name;
  return <div className="space-y-5 pb-6">
    <style>{`@media print {
      @page { size: landscape; margin: 13mm; }
      body * { visibility: hidden !important; }
      #supplyflow-report-print, #supplyflow-report-print * { visibility: visible !important; }
      #supplyflow-report-print { position: absolute !important; left: 0; top: 0; width: 100% !important; background: white !important; }
      #supplyflow-report-print .no-print { display: none !important; }
      #supplyflow-report-print table { font-size: 9px !important; }
      #supplyflow-report-print tr { break-inside: avoid; }
    }`}</style>
    <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white rounded-3xl p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between gap-3"><div><span className="inline-flex items-center text-[11px] font-semibold gap-2 bg-white/15 rounded-full px-3 py-1"><ShieldCheck size={14}/>{t('MariaDB · Consulta segura', 'MariaDB · Secured read-only')}</span><h1 className="text-2xl font-black mt-3">{t('Reportes gerenciales', 'Management Reports')}</h1><p className="text-sm text-blue-100 mt-2">{t('Requisiciones y documentos realmente vinculados, con filtros coherentes y exportación completa.', 'Actual requisitions and linked documents, consistent filters and full-scope export.')}</p></div><BarChart3 size={45} className="opacity-50 self-end"/></div>
    </div>

    <form onSubmit={generate} className={`${box} p-5 no-print space-y-4`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="text-xs font-bold text-slate-600">{t('Desde (fecha solicitud)', 'From (request date)')}<input type="date" className={`${field} mt-1.5`} value={draft.from} onChange={e => setDraft(old => ({ ...old, from: e.target.value }))} /></label>
        <label className="text-xs font-bold text-slate-600">{t('Hasta', 'To')}<input type="date" className={`${field} mt-1.5`} value={draft.to} onChange={e => setDraft(old => ({ ...old, to: e.target.value }))} /></label>
        <label className="text-xs font-bold text-slate-600">{t('Cliente', 'Client')}<select className={`${field} mt-1.5`} value={draft.client} onChange={e => setDraft(old => ({ ...old, client: e.target.value }))}><option value="all">{t('Todos', 'All')}</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{t('Evidencia documental', 'Document evidence')}<select className={`${field} mt-1.5`} value={draft.has} onChange={e => setDraft(old => ({ ...old, has: e.target.value }))}>{milestoneOptions.map(([id,es,en]) => <option key={id} value={id}>{isEn ? en : es}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-600">{t('Buscar', 'Search')}<input className={`${field} mt-1.5`} value={draft.q} onChange={e => setDraft(old => ({ ...old, q: e.target.value }))} maxLength={120} placeholder={t('Folio, cliente, descripción...', 'Folio, client, description...')} /></label>
      </div>
      {invalidRange && <p role="alert" className="text-xs font-semibold text-rose-700">{t('Corrige el rango de fechas.', 'Correct the date range.')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={invalidRange} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white text-xs font-bold flex items-center gap-2"><RefreshCw size={15}/>{t('Generar reporte', 'Generate report')}</button>
        <button type="button" disabled={!data || loading || downloading} onClick={exportCsv} className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-2"><Download size={15}/>{downloading ? t('Exportando...', 'Exporting...') : 'CSV'}</button>
        <button type="button" disabled={!data || loading} onClick={() => window.print()} className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-2"><Printer size={15}/>{t('Imprimir página actual / PDF', 'Print current page / PDF')}</button>
        <button type="button" onClick={() => { setDraft({ ...empty }); setApplied({ ...empty }); setPage(1); }} className="px-3 py-2.5 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl">{t('Limpiar filtros', 'Clear filters')}</button>
      </div>
    </form>

    {loading && <div className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-2xl p-9 text-slate-600"><Loader2 className="animate-spin" size={20}/>{t('Consultando MariaDB...', 'Loading MariaDB...')}</div>}
    {!loading && error && <div role="alert" className="flex items-center gap-2 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl p-4"><AlertCircle size={18}/>{error}</div>}
    {!loading && data && <div id="supplyflow-report-print" className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{t('Reporte de requisiciones', 'Requisition report')}</h2><p className="text-xs text-slate-500 mt-1">{selectedClient || t('Todos los clientes', 'All clients')} · {applied.from || t('Sin fecha inicial', 'No start date')} — {applied.to || t('Sin fecha final', 'No end date')}</p></div><div className="text-right text-xs text-slate-500">{t('Fuente: MariaDB', 'Source: MariaDB')}<div className="font-bold text-slate-700">{t('Página', 'Page')} {page} / {pages}</div></div></div></div>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
        [t('Requisiciones', 'Requisitions'),summary.total,'border-t-blue-500'],
        [t('Con OC', 'With PO'),summary.with_purchase_order,'border-t-amber-500'],
        [t('Con recepción', 'With receipt'),summary.with_receipt,'border-t-emerald-500'],
        [t('Con entrega', 'With delivery'),summary.with_delivery,'border-t-teal-500'],
      ].map(([label,value,color]) => <div key={label} className={`bg-white border border-slate-200 border-t-4 ${color} rounded-xl p-4`}><div className="text-2xl font-black tabular-nums text-slate-900">{count(value)}</div><div className="mt-1 text-xs font-bold text-slate-600">{label}</div></div>)}</section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><section className={`${box} p-4`}><h3 className="text-xs font-black text-slate-900">{t('Resumen del alcance', 'Scope summary')}</h3><p className="text-xs text-slate-700 mt-2">{t('Hay', 'There are')} <strong>{count(data.total)}</strong> {t('requisiciones coincidentes. Los hitos indican documentos vinculados y pueden coincidir entre sí.', 'matching requisitions. Milestones indicate linked documents and can overlap.')}</p><p className="text-[11px] text-slate-500 mt-2">{t('La fecha utilizada para el filtro es la fecha de solicitud. Una fecha ausente queda fuera de periodos delimitados.', 'Filtering uses request date. Undated records are excluded from bounded periods.')}</p></section>
      <section className={`${box} p-4`}><h3 className="text-xs font-black text-slate-900">{t('Presupuestos registrados por moneda', 'Recorded budgets by currency')}</h3>{data.budgets?.length ? <div className="mt-2 space-y-2">{data.budgets.map(b => <div key={b.currency_code} className="flex justify-between gap-2 text-xs"><span>{b.currency_code} · {count(b.documents)} {t('requisiciones', 'requisitions')}</span><strong>{money(b.amount,b.currency_code,isEn)}</strong></div>)}</div> : <p className="text-xs text-slate-500 mt-2">{t('No hay presupuestos registrados para el filtro.', 'No recorded budgets in this scope.')}</p>}<p className="text-[11px] text-slate-500 mt-2">{t('Ausente no significa cero; no se calculan ahorros ni se mezclan monedas.', 'Missing does not mean zero; no savings are calculated or currencies mixed.')}</p></section></div>
      <div className={`${box} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr>{[t('Folio', 'Folio'),t('Cliente / proyecto', 'Client / project'),t('Fecha', 'Date'),t('Requerida', 'Required'),t('Presupuesto', 'Budget'),t('Partidas', 'Items'),'RFQ',t('Versiones cot. cliente', 'Client quote versions'),'OC',t('Recepciones', 'Receipts'),t('Entregas', 'Deliveries')].map(h => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{(data.items || []).map(r => <tr key={r.id} className="border-t border-slate-100"><td className="p-3 font-bold text-slate-900">{r.folio}</td><td className="p-3 min-w-[190px]"><div className="font-semibold">{r.client_name}</div><div className="text-slate-500">{r.project || '—'}</div></td><td className="p-3 whitespace-nowrap">{r.request_date || '—'}</td><td className="p-3 whitespace-nowrap">{r.need_date || '—'}</td><td className="p-3 whitespace-nowrap">{r.budget_amount == null ? '—' : money(r.budget_amount,r.currency_code,isEn)}</td><td className="p-3 tabular-nums">{r.line_count}</td><td className="p-3 tabular-nums">{r.rfq_count}</td><td className="p-3 tabular-nums">{r.customer_quote_count}</td><td className="p-3 tabular-nums">{r.purchase_order_count}</td><td className="p-3 tabular-nums">{r.receipt_count}</td><td className="p-3 tabular-nums">{r.delivery_count}</td></tr>)}{!data.items?.length && <tr><td colSpan={11} className="p-8 text-slate-500 text-center">{t('No hay registros para estos filtros.', 'No matching records.')}</td></tr>}</tbody></table></div>
        <div className="no-print flex items-center justify-between gap-3 p-4 border-t border-slate-200"><p className="text-xs text-slate-500">{t('Página', 'Page')} {page} / {pages} · {count(data.total)} {t('registros totales', 'total records')}</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(n => Math.max(1,n - 1))} className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40">{t('Anterior', 'Previous')}</button><button disabled={page >= pages} onClick={() => setPage(n => Math.min(pages,n + 1))} className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40">{t('Siguiente', 'Next')}</button></div></div>
      </div>
      <p className="text-[11px] text-slate-500">{t('Impresión: página actual. CSV: todas las filas del filtro. Los conteos de versiones/OC pueden incluir revisiones; no se deduce aprobación, pago ni cierre. Históricos sin vínculo válido quedan fuera de esas relaciones.', 'Print: current page. CSV: all matching rows. Version/PO counts may include revisions; no approval, payment or closure is inferred. History without valid links is excluded from relations.')}</p>
    </div>}
  </div>;
}
