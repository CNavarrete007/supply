import React, { useEffect, useState } from 'react';
import { Lock, Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, Printer, X } from 'lucide-react';
import { listSupplierQuotes, getSupplierQuote, listCustomerQuotes, getCustomerQuote, listAwards, listRevisionFamilies } from './api';
import { money, label, tone, customerQuoteHtml, revStatusLabel, revStatusTone, crStatusLabel, familyReference, plainAmount } from './model.mjs';
import { ChangeRequestModal } from '../recovery/ChangeRequestModal';
import { RfqRequestCard } from './RfqRequestCard';
import { RfqMatrixCard } from './RfqMatrixCard';
import { SupplierQuoteCard } from './SupplierQuoteCard';
import { ComparisonCard } from './ComparisonCard';
import { changeBlockMessage } from '../recovery/changeForm.mjs';

// Cotizaciones y Comparativo · diseño Grupo Gerez (11 tarjetas) conectado a MariaDB en modo consulta.
// GET /api/v1/quotes/* (Master Admin). Enviar RFQ, capturar cotizaciones, seleccionar, adjudicar, emitir la cotización al
// cliente y registrar su decisión son escrituras comerciales que siguen bloqueadas hasta su validación integral.
const DASH = '—';
const show = v => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));
const ymd = v => (v ? String(v).slice(0, 10) : DASH);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function useLoad(fn, deps, enabled = true) {
  const [st, setSt] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    const c = new AbortController();
    setSt(x => ({ ...x, status: 'loading', error: null }));
    fn(c.signal).then(d => !c.signal.aborted && setSt({ status: 'ready', data: d, error: null })).catch(e => !c.signal.aborted && setSt(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}

export function QuotesModule({ lang = 'es', language, isEnglish, onNotify, onNavigate }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const notify = (t, m, k = 'info') => { if (typeof onNotify === 'function') onNotify(t, m, k); };
  const LOCK = tx('Modo consulta MariaDB: enviar RFQ, capturar cotizaciones, seleccionar, adjudicar, emitir la cotización al cliente y registrar su decisión son escrituras comerciales bloqueadas hasta su validación integral.', 'MariaDB read mode: sending RFQs, capturing quotes, selecting, awarding, issuing client quotes and recording decisions are commercial writes blocked until fully validated.');
  const tabs = [
    [1, '🔄', tx('Revisiones/modificaciones', 'Revisions & Modifications'), tx('Historial de versiones de la cotización al cliente.', 'Client quote version history.')],
    [2, '📑', tx('Solicitud a proveedores (RFQ)', 'Supplier Request (RFQ)'), tx('Documento sin precios enviado a cada proveedor.', 'Document without prices sent to each supplier.')],
    [3, '📋', tx('Matriz de RFQ', 'RFQ Matrix'), tx('Solicitudes enviadas, fechas límite y respuestas.', 'Sent requests, deadlines and responses.')],
    [4, '📥', tx('Cotizaciones recibidas', 'Received Quotes'), tx('Ofertas devueltas por los proveedores.', 'Offers returned by suppliers.')],
    [5, '📊', tx('Comparativo y selección preliminar', 'Comparison & Preliminary Selection'), tx('Compara ofertas por partida.', 'Compares offers per item.')],
    [6, '💼', tx('Cotización al cliente', 'Client Quotation'), tx('Precio de venta consolidado sin costos internos.', 'Consolidated sales price without internal costs.')],
    [7, '📑', tx('Formato para el cliente', 'Client Format'), tx('Vista formal y PDF de la propuesta.', 'Formal view and proposal PDF.')],
    [8, '📂', tx('Matriz de cotizaciones al cliente', 'Client Quotes Matrix'), tx('Revisiones, montos, vigencia y trazabilidad.', 'Revisions, amounts, validity and traceability.')],
    [9, '☑️', tx('Decisión del cliente', 'Client Decision'), tx('Aceptación, rechazo o solicitud de cambios.', 'Acceptance, rejection or change request.')],
    [10, '🏆', tx('Adjudicación definitiva', 'Definitive Awarding'), tx('Proveedor ganador por partida.', 'Winning supplier per item.')],
    [11, '🔒', tx('Matriz interna de proveedores', 'Internal Suppliers Matrix'), tx('Ofertas originales, costos y trazabilidad interna.', 'Original offers, costs and internal traceability.')],
  ];
  const [tab, setTab] = useState(3);
  const [rev, setRev] = useState(0);
  const [q, setQ] = useState(''); const [input, setInput] = useState('');
  const [page, setPage] = useState(1);
  const [supplier, setSupplier] = useState('all');
  const [client, setClient] = useState('all');
  const [decision, setDecision] = useState('all');
  const [revStatus, setRevStatus] = useState('all');
  const [pdfId, setPdfId] = useState('');
  const [changeFor, setChangeFor] = useState(null);
  const [blocked, setBlocked] = useState(null);
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = id => { setTab(id); setPage(1); setInput(''); setQ(''); setSupplier('all'); setClient('all'); setDecision('all'); setRevStatus('all'); };

  const sqs = useLoad(s => listSupplierQuotes({ page, q, supplier }, s), [tab, page, q, supplier, rev], tab === 11);
  const cqs = useLoad(s => listCustomerQuotes({ page, q, client, decision, scope: 'current' }, s), [tab, page, q, client, decision, rev], [6, 7, 8, 9].includes(tab));
  const fams = useLoad(s => listRevisionFamilies({ page, q, status: revStatus }, s), [tab, page, q, revStatus, rev], tab === 1);
  const pdf = useLoad(s => getCustomerQuote(pdfId, s), [pdfId], !!pdfId);
  const awards = useLoad(s => listAwards({ page, q, status: 'current' }, s), [tab, page, q, rev], tab === 10);
  const [compReq, setCompReq] = useState('');
  const [rfqLang, setRfqLang] = useState(en ? 'en' : 'es');
  const [cqId, setCqId] = useState(''); const cq = useLoad(s => getCustomerQuote(cqId, s), [cqId, rev], [6, 7, 9].includes(tab) && !!cqId);
  const [sqId, setSqId] = useState(''); const sq = useLoad(s => getSupplierQuote(sqId, s), [sqId, rev], tab === 11 && !!sqId);
  const day = today();

  const Err = ({ s }) => (s?.error ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{s.error.message}</p> : null);
  const Wait = ({ s }) => (s?.status === 'loading' ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p> : null);
  const pill = (code, txt) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${tone(code)}`}>{txt || label(code, en)}</span>;
  const lockBtn = t => <button type="button" disabled title={LOCK} className="px-3 py-1.5 bg-slate-200 text-slate-500 text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{t}</button>;
  const box = 'bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4';
  const head = (title, sub, right) => <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{title}</h3><p className="text-xs text-slate-500 mt-0.5">{sub}</p></div>{right}</div>;
  const searchBox = ph => <div className="relative flex-1 min-w-[240px]"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar', 'Search')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={ph} className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>;
  const pager = st => { const last = Math.max(1, Math.ceil((st.data?.total || 0) / (st.data?.page_size || 25))); return <div className="flex justify-between items-center text-xs text-slate-600"><span>{st.data?.total ?? 0} {tx('registros', 'records')} · {tx('Página', 'Page')} {page} / {last}</span><div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>; };
  const table = (headers, rows, empty) => <div className="overflow-x-auto rounded-2xl border border-slate-200/80"><table className="w-full text-left border-collapse min-w-[900px]"><thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">{headers.map(h => <th key={h} className="py-3 px-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">{rows}{!rows.length && <tr><td colSpan={headers.length} className="py-10 text-center text-xs text-slate-400 font-semibold">{empty}</td></tr>}</tbody></table></div>;
  const printCq = (d = cq.data) => { if (!d) return; const w = window.open('', '_blank', 'width=900,height=1000'); if (!w) { notify(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; } w.document.write(customerQuoteHtml(d, en)); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250); };
  const cqSelect = <select aria-label={tx('Cotización al cliente', 'Client quote')} value={cqId} onChange={e => setCqId(e.target.value)} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl min-w-[280px]"><option value="">{tx('Seleccionar cotización…', 'Select quote…')}</option>{cqId && cq.data && !(cqs.data?.items || []).some(v => v.id === cqId) && <option value={cqId}>{cq.data.item.folio} · {cq.data.item.client_name} · {label(cq.data.item.client_decision_status, en)}</option>}{(cqs.data?.items || []).map(v => <option key={v.id} value={v.id}>{v.folio} · {v.client_name} · {label(v.client_decision_status, en)}</option>)}</select>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{tx('Cotizaciones y Comparativo', 'Quotes and Comparison')}</h2><p className="text-xs text-slate-500">{tx('RFQ, ofertas de proveedores, comparativo, cotización al cliente y adjudicación con datos de MariaDB.', 'RFQs, supplier offers, comparison, client quotation and awarding from MariaDB.')}</p></div>
      <div className="flex items-center gap-2"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span><button type="button" onClick={() => setRev(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {tabs.map(([id, emoji, title, desc]) => { const on = tab === id; return <button key={id} type="button" aria-pressed={on} onClick={() => go(id)} className={`relative text-left p-4 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-32 border ${on ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-0.5' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-sm'}`}>
        <span className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${on ? 'bg-white text-purple-700 shadow-xs' : 'bg-slate-100 text-slate-500 border border-slate-200/60'}`}>{id}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${on ? 'bg-white/20 backdrop-blur-md' : 'bg-blue-50/80 border border-blue-100/50'}`}><span>{emoji}</span></div>
        <div className="pr-4"><h4 className={`text-xs font-black tracking-tight mb-0.5 ${on ? 'text-white' : 'text-slate-800'}`}>{title}</h4><p className={`text-[10px] leading-relaxed line-clamp-2 ${on ? 'text-blue-100' : 'text-slate-400'}`}>{desc}</p></div>
      </button>; })}
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    {tab === 1 && <div className={box} data-testid="revisions-card">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
        <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('🔄 Revisiones y modificaciones de cotizaciones al cliente', '🔄 Revisions and modifications of client quotes')}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{tx('Una cotización aprobada no se borra. El cambio se origina desde la requisición y genera una nueva revisión conservando la anterior.', 'An approved quote is not deleted. Changes originate from the requisition and generate a new revision while preserving the previous one.')}</p></div>
        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-full border border-indigo-200/60 shrink-0 font-mono">Rev. 0 → Rev. 1 → Rev. N</span>
      </div>
      <div className="p-3.5 bg-blue-50/60 border-l-4 border-blue-600 rounded-r-xl text-xs text-slate-700 leading-relaxed"><span className="font-bold text-slate-900">{tx('Regla:', 'Rule:')}</span> {tx('para cambiar cantidades, eliminar partidas o agregar alcance después de una aprobación, usa Solicitar modificación. SupplyFlow genera una nueva revisión de la requisición y de la cotización al cliente sin repetir RFQ/comparativo cuando no existe impacto de abastecimiento.', 'to change quantities, remove items or add scope after an approval, use Request modification. SupplyFlow generates a new revision of the requisition and of the client quote without repeating RFQ/comparison when there is no sourcing impact.')}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[[fams.data?.summary?.families, tx('Familias de cotización', 'Quote families'), 'border-t-violet-600'], [fams.data?.summary?.with_rev_n, tx('Con Rev. N', 'With Rev. N'), 'border-t-violet-600'], [fams.data?.summary?.approved, tx('Aprobadas vigentes/históricas', 'Approved current/historical'), 'border-t-emerald-500'], [fams.data?.summary?.linked_cr, tx('Ligadas a Change Request', 'Linked to Change Request'), 'border-t-amber-500']].map(([n, t, c]) => <div key={t} data-testid="rev-kpi" className={`bg-white p-4 rounded-2xl border border-slate-200/80 border-t-4 ${c} shadow-2xs`}><div className="text-2xl font-black text-slate-900">{n ?? '—'}</div><div className="text-xs font-medium text-slate-500 mt-1">{t}</div></div>)}</div>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/70">
        <div className="relative w-full sm:w-96 text-xs font-medium"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar', 'Search')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar cotización, requisición, cliente, CR o estatus...', 'Search quote, requisition, client, CR or status...')} className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium placeholder:text-slate-400" /></div>
        <div className="w-full sm:w-auto text-xs font-semibold"><select aria-label={tx('Estatus', 'Status')} value={revStatus} onChange={e => { setRevStatus(e.target.value); setPage(1); }} className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl outline-none text-slate-700 shadow-2xs cursor-pointer w-full sm:w-auto">
          {[['all', tx('Todos los estatus', 'All statuses'), fams.data?.summary?.families], ['pending', tx('Pendientes de revisión', 'Pending review'), fams.data?.summary?.pending], ['approved', tx('Aprobadas', 'Approved'), fams.data?.summary?.current_approved], ['closed', tx('Sustituidas o rechazadas', 'Superseded or rejected'), fams.data?.summary?.closed]].map(([v, t, n]) => <option key={v} value={v}>{t}{n !== undefined ? ` (${n})` : ''}</option>)}
        </select></div>
      </div>
      <Wait s={fams} /><Err s={fams} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">{(fams.data?.items || []).map(f => <div key={f.id} data-testid="rev-family" className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-[11px] font-black text-slate-900 leading-tight truncate" title={`${f.current_folio} · ${f.client_name}`}>{f.current_folio} · <span className="text-slate-700">{f.client_name}</span></h4>
          <p className="text-[9.5px] font-semibold text-slate-400 truncate" title={f.change_request ? `${f.change_request} · ${crStatusLabel(f.change_request_status, en)}` : undefined}>{familyReference(f, en)}{f.change_request && f.change_request_status ? ` · ${crStatusLabel(f.change_request_status, en)}` : ''}</p>
          <div className="pt-1 flex flex-wrap gap-1"><span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold rounded-md border ${revStatusTone(f.status_label)}`}>Rev. {f.current_rev} · {revStatusLabel(f.status_label, en)}</span>{f.pending_change && <span className="inline-block px-2 py-0.5 text-[9px] font-extrabold rounded-md border bg-amber-50 text-amber-800 border-amber-200">{f.pending_change} · {tx('en revisión', 'in review')}</span>}</div>
        </div>
        <div className="grid grid-cols-3 gap-1 py-1.5 px-2 bg-slate-50/80 rounded-xl border border-slate-100 text-center">
          <div><span className="block text-xs font-black text-slate-800">{f.revisions}</span><span className="block text-[8px] font-bold text-slate-400 uppercase">{tx('Revisiones', 'Revisions')}</span></div>
          <div><span className="block text-[10px] font-black text-slate-800">{plainAmount(f.rev0_total, en)}</span><span className="block text-[8px] font-bold text-slate-400 uppercase">{f.rev0_currency} (Rev. {f.rev0_rev})</span></div>
          <div><span className="block text-[10px] font-black text-slate-800">{plainAmount(f.current_total, en)}</span><span className="block text-[8px] font-bold text-slate-400 uppercase">{f.currency} ({tx('Vigente', 'Current')})</span></div>
        </div>
        <div className="space-y-1.5 text-[9.5px] font-extrabold">
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setPdfId(f.current_id)} className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[9.5px] rounded-lg transition-colors cursor-pointer shadow-2xs">{tx('VER PDF', 'VIEW PDF')}</button>
            <button type="button" onClick={() => { go(6); setCqId(f.current_id); }} className="px-2 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-[9.5px] rounded-lg transition-colors cursor-pointer shadow-2xs truncate">{tx('ABRIR REV. VIGENTE', 'OPEN CURRENT REV.')}</button>
          </div>
          <button type="button" onClick={() => (f.can_request_change ? setChangeFor(f) : setBlocked(f))} title={f.can_request_change ? undefined : changeBlockMessage(f.change_block, f.pending_change, en)} className={`w-full py-1.5 text-white font-extrabold text-[9.5px] rounded-lg transition-all cursor-pointer shadow-2xs tracking-wide ${f.can_request_change ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' : 'bg-gradient-to-r from-orange-300 to-amber-300'}`}>{tx('SOLICITAR MODIFICACIÓN', 'REQUEST MODIFICATION')}</button>
        </div>
      </div>)}
        {fams.status === 'ready' && !(fams.data?.items || []).length && <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">{q || revStatus !== 'all' ? tx('No se encontraron cotizaciones que coincidan con la búsqueda.', 'No quotes matching the search were found.') : tx('No hay cotizaciones al cliente registradas.', 'No client quotes recorded.')}</div>}
      </div>
      {pager(fams)}
    </div>}

    {pdfId && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setPdfId(''); }}>
      <div role="dialog" aria-modal="true" aria-label={tx('Vista previa de la cotización', 'Quote preview')} data-testid="rev-pdf" className="bg-white w-full max-w-5xl h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#1e4a7a] px-5 py-3 flex justify-between items-center shrink-0 gap-3"><h2 className="text-white font-bold text-sm truncate">{tx('Vista previa', 'Preview')} · {pdf.data?.item?.folio || '…'}{pdf.data?.item ? ` · Rev. ${Number(pdf.data.item.version_number) - 1}` : ''}</h2>
          <div className="flex gap-2 text-xs font-bold"><button type="button" onClick={() => printCq(pdf.data)} disabled={!pdf.data} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-3.5 h-3.5" />{tx('Imprimir PDF', 'Print PDF')}</button><button type="button" onClick={() => setPdfId('')} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"><X className="w-3.5 h-3.5" />{tx('Cerrar', 'Close')}</button></div></div>
        <div className="flex-1 overflow-hidden bg-slate-200/50 p-3 sm:p-6">
          <Wait s={pdf} /><Err s={pdf} />
          {pdf.data && <iframe title={tx('Cotización al cliente', 'Client quote')} srcDoc={customerQuoteHtml(pdf.data, en)} sandbox="" className="w-full h-full rounded-lg border border-slate-200 bg-white" />}
        </div>
      </div>
    </div>}

    {blocked && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setBlocked(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sf-rev-blocked" data-testid="rev-blocked" className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#2B4B9A] to-[#8C3AAA] px-5 py-3"><h2 id="sf-rev-blocked" className="text-white font-black text-sm">🔁 {tx('Modificación controlada de requisición', 'Controlled requisition modification')}</h2></div>
        <div className="p-5 space-y-3 text-xs text-slate-700">
          <p className="font-bold text-slate-900">{blocked.current_folio} · Rev. {blocked.current_rev} · {blocked.requisition}</p>
          <p className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{changeBlockMessage(blocked.change_block, blocked.pending_change, en)}</span></p>
          <div className="flex justify-end text-xs font-bold"><button type="button" onClick={() => setBlocked(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg">{tx('Entendido', 'Got it')}</button></div>
        </div>
      </div>
    </div>}

    {changeFor && <ChangeRequestModal requisitionId={changeFor.requisition_id} en={en} context={{ requisition: changeFor.requisition, client: changeFor.client_name, quoteFolio: changeFor.current_folio, currentRev: changeFor.current_rev }}
      onClose={() => setChangeFor(null)} onCreated={() => setRev(n => n + 1)} onNotify={notify} />}

    {tab === 2 && <RfqRequestCard en={en} notify={notify} onOpenMatrix={() => go(3)} lockText={LOCK} refresh={rev} docLang={rfqLang} />}

    {tab === 3 && <RfqMatrixCard en={en} notify={notify} onNewRfq={() => go(2)} docLang={rfqLang} onDocLang={setRfqLang} refresh={rev} />}

    {tab === 4 && <SupplierQuoteCard en={en} notify={notify} lockText={LOCK} refresh={rev} onMatrix={() => go(11)} onCompare={reqId => { go(5); if (reqId) setCompReq(reqId); }} />}

    {tab === 11 && <div className={box}>{head(tx('Matriz interna de proveedores', 'Internal suppliers matrix'), tx('Cotizaciones recibidas con su RFQ de origen; ofertas originales con costos y partidas (uso interno; no se muestran al cliente).', 'Received quotes with their source RFQ; original offers with costs and items (internal use; never shown to the client).'), null)}
      {tab === 11 && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[{ id: 'all', name: tx('Todas las cotizaciones', 'All quotes'), total: (sqs.data?.summary?.suppliers || []).reduce((n, x) => n + x.total, 0), awarded: (sqs.data?.summary?.suppliers || []).reduce((n, x) => n + x.awarded, 0), active: (sqs.data?.summary?.suppliers || []).reduce((n, x) => n + x.active, 0) }, ...(sqs.data?.summary?.suppliers || [])].map(c => <button key={c.id} type="button" aria-pressed={supplier === c.id} onClick={() => { setSupplier(c.id); setPage(1); }} className={`text-left p-3 rounded-2xl border bg-white ${supplier === c.id ? 'border-purple-500 ring-2 ring-purple-500/10' : 'border-slate-200 hover:border-purple-300'}`}><div className="text-[11px] font-extrabold text-slate-800 truncate" title={c.name}>{c.name}</div><div className="grid grid-cols-3 gap-1 mt-2 text-center">{[[c.total, tx('Total', 'Total')], [c.awarded, tx('Adjudicadas', 'Awarded')], [c.active, tx('Activas', 'Active')]].map(([n, l]) => <div key={l}><span className="block text-sm font-black tabular-nums">{n}</span><span className="block text-[9px] text-slate-400">{l}</span></div>)}</div></button>)}</div>}
      <div className="flex flex-wrap gap-3">{searchBox(tx('Buscar cotización, referencia, requisición, proveedor o cliente...', 'Search quote, reference, requisition, supplier or client...'))}{tab === 11 && <select aria-label={tx('Cotización de proveedor', 'Supplier quote')} value={sqId} onChange={e => setSqId(e.target.value)} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl min-w-[260px]"><option value="">{tx('Ver partidas de…', 'View items of…')}</option>{(sqs.data?.items || []).map(x => <option key={x.id} value={x.id}>{x.folio} · {x.supplier_name}</option>)}</select>}</div>
      <Wait s={sqs} /><Err s={sqs} />
      {table([tx('Cotización', 'Quote'), 'RFQ', tx('Requisición', 'Requisition'), tx('Proveedor', 'Supplier'), tx('Fecha', 'Date'), tx('Vigencia', 'Valid until'), tx('Total', 'Total'), tx('Entrega', 'Lead'), tx('Pago', 'Payment'), tx('Evaluación', 'Score'), tx('Estatus', 'Status')], (sqs.data?.items || []).map(x => <tr key={x.id} className="align-top"><td className="py-2.5 px-3 font-black">{x.folio}{x.supplier_reference && <div className="text-[10px] text-slate-400">{x.supplier_reference}</div>}</td><td className="py-2.5 px-3">{show(x.rfq_folio)}</td><td className="py-2.5 px-3">{x.requisition}<div className="text-[10px] text-slate-400">{x.client_name}</div></td><td className="py-2.5 px-3">{x.supplier_name}</td><td className="py-2.5 px-3">{ymd(x.quote_date)}</td><td className="py-2.5 px-3">{ymd(x.valid_until)}</td><td className="py-2.5 px-3 font-bold whitespace-nowrap">{money(x.total_amount, x.currency, en)}</td><td className="py-2.5 px-3">{x.lead_days !== null ? `${Number(x.lead_days)} ${tx('días', 'days')}` : DASH}</td><td className="py-2.5 px-3">{show(x.payment_terms)}</td><td className="py-2.5 px-3">{x.technical_score !== null ? Number(x.technical_score) : DASH}</td><td className="py-2.5 px-3">{x.awarded ? pill('awarded') : pill(x.status, x.legacy_status || label(x.status, en))}</td></tr>), tx('No hay cotizaciones de proveedor.', 'No supplier quotes.'))}
      {pager(sqs)}
      {tab === 11 && sq.data && <div data-testid="internal-quote" className="space-y-2"><h4 className="text-xs font-black text-slate-800">{sq.data.item.folio} · {sq.data.item.supplier_name} · {money(sq.data.item.total_amount, sq.data.item.currency, en)}</h4>{table(['#', tx('Descripción', 'Description'), tx('Cant. solicitada', 'Requested'), tx('Ofertada', 'Offered'), tx('Cantidad', 'Qty'), tx('Precio unitario', 'Unit price'), tx('Importe', 'Amount')], sq.data.items.map(i => <tr key={i.line_number}><td className="py-2.5 px-3">{i.line_number}</td><td className="py-2.5 px-3 font-semibold">{i.description}</td><td className="py-2.5 px-3">{Number(i.requested_quantity)}</td><td className="py-2.5 px-3">{i.offered ? tx('Sí', 'Yes') : 'No'}</td><td className="py-2.5 px-3">{Number(i.quantity)} {i.unit_label}</td><td className="py-2.5 px-3">{money(i.unit_price, sq.data.item.currency, en)}</td><td className="py-2.5 px-3 font-bold">{money(i.line_subtotal, sq.data.item.currency, en)}</td></tr>), tx('Sin partidas.', 'No items.'))}</div>}
    </div>}

    {tab === 5 && <ComparisonCard en={en} notify={notify} requisition={compReq} onRequisition={setCompReq} refresh={rev} onAddCompany={() => go(4)}
      onRegisterSupplier={() => onNavigate?.('suppliers')} onOpenOrders={() => onNavigate?.('purchase_orders')} />}

    {(tab === 6 || tab === 7) && <div className={box}>{head(tab === 6 ? tx('Cotización al cliente', 'Client quotation') : tx('Formato para el cliente', 'Client format'), tab === 6 ? tx('Precio de venta consolidado; los costos internos no se muestran.', 'Consolidated sale price; internal costs are not shown.') : tx('Vista formal con firmas registradas e impresión a PDF.', 'Formal view with recorded signatures and PDF printing.'), <div className="flex gap-2">{cqSelect}{tab === 7 ? <button type="button" onClick={() => printCq()} disabled={!cq.data} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />{tx('Imprimir / PDF', 'Print / PDF')}</button> : lockBtn(tx('Emitir cotización', 'Issue quote'))}</div>)}
      <Wait s={cqs} /><Err s={cqs} /><Wait s={cq} /><Err s={cq} />
      {!cqId && <div className="p-12 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('Selecciona una cotización al cliente.', 'Select a client quote.')}</div>}
      {cq.data && tab === 6 && <div data-testid="client-quote" className="space-y-3"><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">{[[tx('Cliente', 'Client'), cq.data.item.client_name], [tx('Requisición', 'Requisition'), cq.data.item.requisition], [tx('Vigencia', 'Valid until'), ymd(cq.data.item.valid_until)], [tx('Total', 'Total'), money(cq.data.item.total_amount, cq.data.item.currency, en)], [tx('Documento', 'Document'), label(cq.data.item.document_status, en)], [tx('Aprobación interna', 'Internal approval'), label(cq.data.item.internal_approval_status, en)], [tx('Decisión del cliente', 'Client decision'), label(cq.data.item.client_decision_status, en)], [tx('Condiciones de pago', 'Payment terms'), show(cq.data.item.payment_terms)]].map(([k, v]) => <div key={k} className="p-3 rounded-xl border border-slate-200"><div className="text-[10px] font-bold text-slate-400 uppercase">{k}</div><div className="font-semibold text-slate-800">{v}</div></div>)}</div>
        {table(['#', tx('Descripción', 'Description'), tx('Marca / modelo', 'Brand / model'), tx('Cantidad', 'Qty'), tx('Precio unitario', 'Unit price'), tx('Importe', 'Amount')], cq.data.items.map(i => <tr key={i.line_number}><td className="py-2.5 px-3">{i.line_number}</td><td className="py-2.5 px-3 font-semibold">{i.description}</td><td className="py-2.5 px-3">{show(i.brand_model)}</td><td className="py-2.5 px-3">{Number(i.quantity)} {i.unit_label}</td><td className="py-2.5 px-3">{money(i.unit_price, cq.data.item.currency, en)}</td><td className="py-2.5 px-3 font-bold">{money(i.line_subtotal, cq.data.item.currency, en)}</td></tr>), tx('Sin partidas.', 'No items.'))}</div>}
      {cq.data && tab === 7 && <iframe title={tx('Formato para el cliente', 'Client format')} srcDoc={customerQuoteHtml(cq.data, en)} sandbox="" className="w-full h-[900px] rounded-xl border border-slate-200 bg-white" />}
    </div>}

    {tab === 8 && <div className={box}>{head(tx('Matriz de cotizaciones al cliente', 'Client quotes matrix'), tx('Versión vigente de cada cotización: montos, vigencia, aprobación interna y decisión del cliente.', 'Current version of each quote: amounts, validity, internal approval and client decision.'), lockBtn(tx('Nueva cotización', 'New quote')))}
      <div className="flex flex-wrap gap-3">{searchBox(tx('Buscar folio, serie, requisición o cliente...', 'Search folio, series, requisition or client...'))}<select aria-label={tx('Decisión', 'Decision')} value={decision} onChange={e => { setDecision(e.target.value); setPage(1); }} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"><option value="all">{tx('Todas las decisiones', 'All decisions')}</option>{(cqs.data?.summary?.decisions || []).map(x => <option key={x.code} value={x.code}>{label(x.code, en)} ({x.count})</option>)}</select></div>
      <Wait s={cqs} /><Err s={cqs} />
      <p className="text-[11px] text-slate-500">{(cqs.data?.summary?.money || []).map(m => `${money(m.amount, m.currency, en)} · ${m.quotes} ${tx('cotización(es)', 'quote(s)')}`).join('  |  ')}</p>
      {table([tx('Folio', 'Folio'), tx('Versión', 'Version'), tx('Cliente', 'Client'), tx('Requisición', 'Requisition'), tx('Fecha', 'Date'), tx('Vigencia', 'Valid until'), tx('Total', 'Total'), tx('Aprobación interna', 'Internal approval'), tx('Decisión del cliente', 'Client decision'), tx('Elaboró / autorizó', 'Prepared / approved')], (cqs.data?.items || []).map(v => <tr key={v.id} className="align-top"><td className="py-2.5 px-3 font-black">{v.folio}<div className="text-[10px] text-slate-400">{v.series}</div></td><td className="py-2.5 px-3">v{v.version_number} / {v.versions}</td><td className="py-2.5 px-3">{v.client_name}</td><td className="py-2.5 px-3">{v.requisition}</td><td className="py-2.5 px-3">{ymd(v.quote_date)}</td><td className={`py-2.5 px-3 ${v.valid_until && String(v.valid_until).slice(0, 10) < day ? 'text-rose-600 font-bold' : ''}`}>{ymd(v.valid_until)}</td><td className="py-2.5 px-3 font-bold whitespace-nowrap">{money(v.total_amount, v.currency, en)}</td><td className="py-2.5 px-3">{pill(v.internal_approval_status)}</td><td className="py-2.5 px-3">{pill(v.client_decision_status)}</td><td className="py-2.5 px-3">{show(v.prepared_by)} / {show(v.approved_by)}</td></tr>), tx('No hay cotizaciones al cliente.', 'No client quotes.'))}
      {pager(cqs)}
    </div>}

    {tab === 9 && <div className={box}>{head(tx('Decisión del cliente', 'Client decision'), tx('Envío, aceptación, rechazo o solicitud de modificación registrados por versión.', 'Delivery, acceptance, rejection or change request recorded per version.'), lockBtn(tx('Registrar decisión', 'Record decision')))}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[{ id: 'all', name: tx('Todos los clientes', 'All clients'), total: (cqs.data?.summary?.clients || []).reduce((n, x) => n + x.total, 0), pending: (cqs.data?.summary?.clients || []).reduce((n, x) => n + x.pending, 0) }, ...(cqs.data?.summary?.clients || [])].map(c => <button key={c.id} type="button" aria-pressed={client === c.id} onClick={() => { setClient(c.id); setPage(1); }} className={`text-left p-3 rounded-2xl border bg-white ${client === c.id ? 'border-purple-500 ring-2 ring-purple-500/10' : 'border-slate-200 hover:border-purple-300'}`}><div className="text-[11px] font-extrabold text-slate-800 truncate">{c.name}</div><div className="text-[10px] text-slate-500 mt-1">{c.total} {tx('cotización(es)', 'quote(s)')} · <strong className="text-amber-700">{c.pending} {tx('por decidir', 'pending')}</strong></div></button>)}</div>
      <Wait s={cqs} /><Err s={cqs} />
      <div className="flex flex-wrap gap-2 items-center">{cqSelect}<span className="text-[11px] text-slate-400">{tx('Selecciona una cotización para ver su historial de decisiones.', 'Select a quote to see its decision history.')}</span></div>
      {cq.data && <div data-testid="decisions" className="space-y-2">{cq.data.versions.map(v => <div key={v.id} className={`p-3 rounded-xl border text-xs flex flex-wrap justify-between gap-2 ${v.id === cqId ? 'border-purple-300 bg-purple-50/30' : 'border-slate-200'}`}><span className="font-bold">{v.folio} · v{v.version_number}</span><span>{money(v.total_amount, v.currency, en)}</span>{pill(v.client_decision_status)}</div>)}
        {cq.data.decisions.map((x, i) => <div key={i} className="p-3 rounded-xl border-l-4 border-l-emerald-500 border border-slate-100 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong>{label(x.decision_code, en)}</strong><span className="text-slate-500">{String(x.decision_at || '').slice(0, 16)} · {show(x.decision_channel)} · {show(x.actor)}</span></div>{x.note && <p className="text-[11px] text-slate-600 mt-1">{x.note}</p>}</div>)}
        {!cq.data.decisions.length && <p className="text-[11px] text-slate-400">{tx('Sin decisiones registradas para esta versión.', 'No decisions recorded for this version.')}</p>}</div>}
    </div>}

    {tab === 10 && <div className={box}>{head(tx('Adjudicación definitiva', 'Definitive awarding'), tx('Proveedor ganador por partida (adjudicaciones vigentes) y OC generadas.', 'Winning supplier per item (current awards) and generated POs.'), lockBtn(tx('Confirmar adjudicación', 'Confirm award')))}
      <div className="flex flex-wrap gap-3">{searchBox(tx('Buscar requisición, proveedor, cotización o partida...', 'Search requisition, supplier, quote or item...'))}</div>
      <Wait s={awards} /><Err s={awards} />
      {table([tx('Requisición', 'Requisition'), tx('Partida', 'Item'), tx('Proveedor ganador', 'Winning supplier'), tx('Cotización', 'Quote'), tx('Cantidad', 'Qty'), tx('Precio unitario', 'Unit price'), tx('Importe', 'Amount'), tx('Origen', 'Source'), tx('OC', 'PO')], (awards.data?.items || []).map(a => <tr key={a.id} className="align-top"><td className="py-2.5 px-3 font-bold">{a.requisition}<div className="text-[10px] text-slate-400">{a.client_name}</div></td><td className="py-2.5 px-3">{a.line_number} · {a.description}</td><td className="py-2.5 px-3 font-semibold">{a.supplier_name}</td><td className="py-2.5 px-3">{a.quote_folio}</td><td className="py-2.5 px-3">{Number(a.quantity)}</td><td className="py-2.5 px-3">{money(a.unit_price, a.currency, en)}</td><td className="py-2.5 px-3 font-bold">{money(a.subtotal_amount, a.currency, en)}</td><td className="py-2.5 px-3">{show(a.source_kind)}</td><td className="py-2.5 px-3">{a.purchase_orders ? <span className="text-emerald-700 font-bold">{a.purchase_orders}</span> : <span className="text-amber-700 font-bold">{tx('Pendiente de OC', 'PO pending')}</span>}</td></tr>), tx('No hay adjudicaciones vigentes.', 'No current awards.'))}
      {pager(awards)}
    </div>}
  </div>;
}
