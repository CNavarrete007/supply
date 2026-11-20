import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { servicesMatrix, serviceDetail } from './api';
import { SERVICE_TYPES, mergeOptions, servicesCsv } from './serviceMatrix.mjs';
import { REPORT_KINDS, REPORT_STATUSES, emptyFilters, filtersError, filtersQuery, requestOptions, buildReport, reportHtml, buildReportPdf, reportFileName } from './serviceReports.mjs';
import { loadPoLogo } from '../purchaseOrders/poPdf.mjs';

// Servicios Operativos · sección 4 "Formatos y Reportes" (diseño Grupo Gerez), con datos reales de MariaDB en modo lectura:
// filtros (fechas, cliente, servicio, estatus), Formato de Solicitud, Por Partidas, General, Hacia el Cliente (sin costo
// interno ni margen) y Gerencial. Vista previa aislada, Imprimir, PDF (jsPDF) y Exportar datos (CSV). No escribe nada.
const MAX_PAGES = 40; // 2,000 servicios por reporte

async function loadAll(filters) {
  const items = []; let p = 1; let total = 0;
  do { const r = await servicesMatrix({ ...filtersQuery(filters), page: p, page_size: 50 }); items.push(...r.items); total = r.total; p += 1; } while (items.length < total && p <= MAX_PAGES);
  return { items, total };
}

export function ServiceReports({ en = false, notify = () => {} }) {
  const tx = (es, e) => (en ? e : es);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const [f, setF] = useState(emptyFilters); const [applied, setApplied] = useState(emptyFilters);
  const [kind, setKind] = useState('solicitud');
  const [data, setData] = useState({ status: 'loading', items: [], total: 0, error: null, clients: [], types: [], statuses: [] });
  const [reqId, setReqId] = useState('');
  const [doc, setDoc] = useState(null); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(null);

  const load = async filters => {
    setData(d => ({ ...d, status: 'loading', error: null }));
    try { const r = await loadAll(filters); setData(d => ({ ...d, status: 'ready', items: r.items, total: r.total })); }
    catch (e) { setData(d => ({ ...d, status: 'error', error: e })); }
  };
  useEffect(() => {
    let alive = true;
    servicesMatrix({ page: 1, page_size: 1 }).then(r => alive && setData(d => ({ ...d, clients: r.summary.clients, types: r.service_types, statuses: r.statuses }))).catch(() => {});
    load(emptyFilters());
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const clientName = id => data.clients.find(c => c.id === id)?.name || '';
  const err = filtersError(f, en);
  const apply = () => {
    if (err) { setMsg({ kind: 'error', text: err }); return; }
    setMsg(null); setApplied(f); setDoc(null); setReqId(''); load(f);
  };
  const options = useMemo(() => requestOptions(data.items), [data.items]);
  const generate = async () => {
    setMsg(null);
    if (data.status !== 'ready') return;
    if (kind === 'solicitud') {
      if (!reqId) { setMsg({ kind: 'error', text: tx('Selecciona una solicitud de servicio.', 'Select a service request.') }); return; }
      setBusy('gen');
      try { const detail = await serviceDetail(reqId); setDoc({ ...buildReport('solicitud', { detail, today }, en), folio: detail.item.folio }); }
      catch (e) { setMsg({ kind: 'error', text: e.message }); } finally { setBusy(''); }
      return;
    }
    setDoc(buildReport(kind, { items: data.items, filters: applied, clientName: clientName(applied.client), today }, en));
    if (data.items.length < data.total) setMsg({ kind: 'info', text: tx(`El reporte incluye ${data.items.length} de ${data.total} servicios (límite de 2,000).`, `The report includes ${data.items.length} of ${data.total} services (2,000 limit).`) });
  };
  const needDoc = () => { if (doc) return false; setMsg({ kind: 'error', text: kind === 'solicitud' ? tx('Selecciona una solicitud de servicio y genera su formato.', 'Select a service request and generate its format.') : tx('Genera el reporte primero.', 'Generate the report first.') }); return true; };
  const print = () => {
    if (needDoc()) return;
    const w = window.open('', '_blank', 'width=1000,height=1000');
    if (!w) { notify(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; }
    w.document.write(reportHtml(doc, en)); w.document.close(); w.focus(); setTimeout(() => { w.print(); }, 250);
  };
  const pdf = async () => {
    if (needDoc()) return;
    setBusy('pdf');
    try { const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), loadPoLogo()]); buildReportPdf(jsPDF, doc, logo).save(reportFileName(doc, doc.folio)); }
    catch (e) { setMsg({ kind: 'error', text: e.message || tx('No se pudo generar el PDF.', 'The PDF could not be generated.') }); } finally { setBusy(''); }
  };
  const exportCsv = () => {
    if (data.status !== 'ready') return;
    const rows = kind === 'solicitud' && reqId ? data.items.filter(x => x.id === reqId) : data.items;
    const blob = new Blob([servicesCsv(rows, en, { internal: kind !== 'cliente' })], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `servicios-${kind}-${today}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const lbl = (t, child) => <label className="block min-w-0"><span className="block text-[11px] font-black text-slate-900 mb-1.5">{t}</span>{child}</label>;
  const ctl = 'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
  const btnWhite = 'px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-xs disabled:opacity-60';
  const btnBlue = 'px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md disabled:opacity-60';

  return <div className="space-y-4 text-left" data-testid="service-reports">
    <div className="rounded-3xl p-6 text-white shadow-md bg-gradient-to-r from-[#0b2a5b] via-blue-600 to-purple-600 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="space-y-2 max-w-3xl"><span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-[10px] font-black">📄 {tx('Centro documental', 'Document center')}</span>
        <h3 className="text-xl md:text-2xl font-black">{tx('Formatos y Reportes de Servicios Operativos', 'Operational Services Formats and Reports')}</h3>
        <p className="text-xs text-blue-50">{tx('Genera documentos operativos, entregables al cliente y análisis gerencial con la información real registrada en Servicios Operativos.', 'Generate operational documents, client deliverables and management analysis with the real information recorded in Operational Services.')}</p></div>
      <div className="flex flex-wrap gap-2 text-sm font-black shrink-0">
        <button type="button" onClick={print} className="px-4 py-2.5 bg-white text-slate-900 rounded-xl shadow-sm">🖨 {tx('Imprimir', 'Print')}</button>
        <button type="button" onClick={pdf} disabled={busy === 'pdf'} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 border border-white/20 rounded-xl shadow-sm disabled:opacity-60">📄 {busy === 'pdf' ? '…' : tx('Generar PDF', 'Generate PDF')}</button>
        <button type="button" onClick={exportCsv} disabled={data.status !== 'ready'} className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl shadow-sm disabled:opacity-60">⬇ {tx('Exportar datos', 'Export data')}</button>
      </div>
    </div>

    <div data-testid="service-report-filters" className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
      {lbl(tx('Desde', 'From'), <input type="date" aria-label={tx('Desde', 'From')} value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value }))} className={ctl} />)}
      {lbl(tx('Hasta', 'To'), <input type="date" aria-label={tx('Hasta', 'To')} value={f.to} onChange={e => setF(x => ({ ...x, to: e.target.value }))} className={ctl} />)}
      {lbl(tx('Cliente', 'Client'), <select aria-label={tx('Cliente', 'Client')} value={f.client} onChange={e => setF(x => ({ ...x, client: e.target.value }))} className={ctl}><option value="all">{tx('Todos', 'All')}</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
      {lbl(tx('Servicio', 'Service'), <select aria-label={tx('Servicio', 'Service')} value={f.service} onChange={e => setF(x => ({ ...x, service: e.target.value }))} className={ctl}><option value="">{tx('Todos', 'All')}</option>{mergeOptions(SERVICE_TYPES, data.types).map(o => <option key={o} value={o}>{o}</option>)}</select>)}
      {lbl(tx('Estatus', 'Status'), <select aria-label={tx('Estatus', 'Status')} value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))} className={ctl}><option value="">{tx('Todos', 'All')}</option>{mergeOptions(REPORT_STATUSES, data.statuses).map(o => <option key={o} value={o}>{o}</option>)}</select>)}
      <span className="text-sm font-black"><button type="button" onClick={apply} className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md">{tx('Aplicar filtros', 'Apply filters')}</button></span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">{REPORT_KINDS.map(([id, icon, es, e2, des, dee]) => { const on = kind === id; return <button key={id} type="button" aria-pressed={on} data-testid="service-report-kind" onClick={() => { setKind(id); setDoc(null); setMsg(null); }} className={`text-left rounded-2xl border p-4 transition-all ${on ? 'border-indigo-500 bg-gradient-to-br from-white to-purple-50 ring-1 ring-indigo-200 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <span className="block text-lg mb-2" aria-hidden="true">{icon}</span><span className="block text-xs font-black text-slate-900">{en ? e2 : es}</span><span className="block text-[9.5px] text-slate-500 mt-0.5">{en ? dee : des}</span></button>; })}</div>

    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
      {data.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {data.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{data.error.message}</p>}
      {kind === 'solicitud' ? <div className="flex flex-col sm:flex-row sm:items-end gap-3">{lbl(tx('Solicitud de servicio', 'Service request'), <select aria-label={tx('Solicitud de servicio', 'Service request')} value={reqId} onChange={e => { setReqId(e.target.value); setDoc(null); }} className={ctl}><option value="">{tx('Seleccionar solicitud...', 'Select request...')}</option>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>)}
        <span className="text-sm font-black shrink-0"><button type="button" onClick={generate} disabled={busy === 'gen' || data.status !== 'ready'} className={btnBlue}>{busy === 'gen' ? '…' : tx('Generar formato', 'Generate format')}</button></span></div>
        : <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><p data-testid="service-report-count" className="text-xs text-slate-700"><strong className="text-slate-900">{data.total}</strong> {tx('servicio(s) con los filtros aplicados', 'service(s) with the applied filters')}</p>
          <span className="text-sm font-black shrink-0"><button type="button" onClick={generate} disabled={data.status !== 'ready'} className={btnBlue}>{tx('Generar reporte', 'Generate report')}</button></span></div>}
    </div>
    {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} data-testid="service-report-msg" className={`p-3 rounded-xl border text-xs ${msg.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{msg.text}</p>}

    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 flex justify-end gap-3 text-sm font-black">
      <button type="button" onClick={print} disabled={!doc} className={btnWhite}>🖨 {tx('Imprimir', 'Print')}</button>
      <button type="button" onClick={pdf} disabled={!doc || busy === 'pdf'} className={btnBlue}>📄 {tx('Descargar PDF', 'Download PDF')}</button>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-3 sm:p-5">
      {doc ? <iframe title={tx('Vista previa del reporte', 'Report preview')} srcDoc={reportHtml(doc, en)} sandbox="" className="w-full max-w-[1100px] mx-auto block h-[78vh] bg-white shadow-md border border-slate-300" />
        : <div className="p-10 border border-dashed border-slate-300 rounded-2xl bg-white/60 text-center text-sm text-slate-500">{kind === 'solicitud' ? tx('Selecciona una solicitud de servicio para generar su formato.', 'Select a service request to generate its format.') : tx('Aplica los filtros y presiona "Generar reporte".', 'Apply the filters and press "Generate report".')}</div>}
    </div>
    <p className="text-[10px] text-slate-400 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" />{tx('Fuente: MariaDB (service_orders). Los reportes se generan en el navegador y no se guardan; "Hacia el Cliente" y su exportación omiten costo interno, margen, OC de proveedor y comprador.', 'Source: MariaDB (service_orders). Reports are generated in the browser and are not stored; "For the client" and its export omit internal cost, margin, supplier PO and buyer.')}</p>
  </div>;
}

export default ServiceReports;
