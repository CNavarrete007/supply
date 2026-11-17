import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, Lock, ChevronLeft, ChevronRight, Search, X, Printer, Paperclip } from 'lucide-react';
import { listSupplierQuotes, getSupplierQuote, getComparison } from './api';
import { money } from './model.mjs';
import { supplierCards, quoteStatus, requisitionRef, pct, leadText, scoreTone, scoresFromComparison, deleteBlock, supplierQuoteHtml } from './supplierMatrix.mjs';

// Tarjeta 11 · Matriz interna de proveedores (uso interno, con costos). Lee de MariaDB
// GET /api/v1/quotes/supplier-quotes (filtro por proveedor y búsqueda en el servidor) y, para el puntaje, el comparativo
// de cada requisición visible (GET /quotes/comparison). EDITAR muestra el detalle registrado; ADJUDICAR abre el
// comparativo (tarjeta 5); ELIMINAR y modificar la cotización son escrituras comerciales bloqueadas.
function useLoad(fn, deps, enabled = true) {
  const [st, setSt] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!enabled) { setSt({ status: 'idle', data: null, error: null }); return undefined; }
    const c = new AbortController();
    setSt(x => ({ ...x, status: 'loading', error: null }));
    fn(c.signal).then(d => !c.signal.aborted && setSt({ status: 'ready', data: d, error: null })).catch(e => !c.signal.aborted && setSt(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, [...deps, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
const PAGE = 25;

/** Comparativos de las requisiciones visibles (máximo 3 consultas simultáneas) → puntaje por cotización. */
function useScores(reqIds, refresh) {
  const cache = useRef({}); const [, bump] = useState(0);
  useEffect(() => { cache.current = {}; bump(x => x + 1); }, [refresh]);
  const key = reqIds.join(',');
  useEffect(() => {
    const todo = reqIds.filter(id => !cache.current[id] || cache.current[id].status === 'loading');
    if (!todo.length) return undefined;
    const c = new AbortController(); let i = 0;
    todo.forEach(id => { cache.current[id] = { status: 'loading' }; }); bump(x => x + 1);
    const put = (id, v) => { if (!c.signal.aborted) { cache.current[id] = v; bump(x => x + 1); } };
    const worker = async () => {
      while (i < todo.length && !c.signal.aborted) {
        const id = todo[i++];
        try { put(id, { status: 'ready', by: scoresFromComparison(await getComparison(id, c.signal)) }); } catch { put(id, { status: 'error', by: {} }); }
      }
    };
    Promise.all([worker(), worker(), worker()]);
    return () => c.abort();
  }, [key, refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  return cache.current;
}

export function SupplierMatrixCard({ en = false, notify, refresh = 0, onNew, onCompare }) {
  const tx = (es, e) => (en ? e : es);
  const [supplier, setSupplier] = useState(null); // null = solo tarjetas; 'all' | public id
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [detId, setDetId] = useState(''); const [detMode, setDetMode] = useState('edit');
  const [del, setDel] = useState(null); const [typed, setTyped] = useState(''); const [delMsg, setDelMsg] = useState('');
  useEffect(() => { const h = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(h); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useLoad(s => listSupplierQuotes({ supplier: supplier || 'all', q, page, page_size: PAGE }, s), [supplier, q, page, refresh]);
  const det = useLoad(s => getSupplierQuote(detId, s), [detId, refresh], !!detId);
  const cards = useMemo(() => supplierCards(list.data?.summary?.suppliers || [], en), [list.data, en]);
  const sel = supplier ? (cards.find(c => c.id === supplier) || { id: supplier, name: '—' }) : null;
  const rows = useMemo(() => (supplier ? list.data?.items || [] : []), [supplier, list.data]);
  const total = list.data?.total || 0; const last = Math.max(1, Math.ceil(total / PAGE));
  const reqIds = useMemo(() => [...new Set(rows.map(r => r.requisition_id).filter(Boolean))], [rows]);
  const scores = useScores(reqIds, refresh);
  const open = id => { setSupplier(id); setPage(1); };
  const doc = useMemo(() => (det.data ? supplierQuoteHtml(det.data, en) : null), [det.data, en]);
  const print = () => {
    if (!doc) return;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { notify?.(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; }
    w.document.write(doc.html); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250);
  };
  const delBlock = del ? deleteBlock(del, en) : null;
  const confirmDelete = () => { if (del && typed.trim() === del.folio) setDelMsg(tx(`No se eliminó ${del.folio}: escritura comercial bloqueada hasta su autorización.`, `${del.folio} was not deleted: commercial write blocked until authorized.`)); };
  const detRow = rows.find(r => r.id === detId);

  return <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="sqm-card">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de cotizaciones', 'Quotes matrix')}</h3><p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{tx('Consulta todas las ofertas registradas y define cuál será la seleccionada.', 'Review all recorded offers and define which one will be selected.')}</p></div>
      <span className="text-sm font-black shrink-0"><button type="button" onClick={() => onNew?.()} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><span>+</span>{tx('Nueva cotización', 'New quote')}</button></span>
    </div>
    <div className="px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/50 text-[11px] text-slate-700" data-testid="sqm-actions">
      <strong className="text-slate-900">{tx('Acciones:', 'Actions:')}</strong> <strong className="text-slate-900">{tx('EDITAR', 'EDIT')}</strong> {tx('abre la cotización para modificarla.', 'opens the quote to modify it.')} <strong className="text-slate-900 ml-1.5">{tx('ADJUDICAR', 'AWARD')}</strong> {tx('abre el comparativo para elegir la oferta con la que se emitirá la orden de compra.', 'opens the comparison to choose the offer used to issue the purchase order.')} <strong className="text-slate-900 ml-1.5">{tx('ELIMINAR', 'DELETE')}</strong> {tx('borra la cotización después de confirmar.', 'deletes the quote after confirming.')}
      <span className="block text-[10.5px] text-amber-800 mt-1"><Lock className="w-3 h-3 inline -mt-0.5 mr-1" />{tx('Modificar y eliminar cotizaciones son escrituras comerciales bloqueadas hasta su autorización: aquí se consultan y validan.', 'Modifying and deleting quotes are commercial writes blocked until authorized: here they are reviewed and validated.')}</span>
    </div>

    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-purple-50/30 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div><h4 className="text-sm sm:text-base font-black text-slate-900">{tx('Tarjetas por proveedor', 'Cards by supplier')}</h4><p className="text-[10.5px] text-slate-500 mt-0.5">{tx('Selecciona un proveedor para abrir únicamente su matriz interna de cotizaciones.', 'Select a supplier to open only its internal quotes matrix.')}</p></div>
        <span data-testid="sqm-badge" className="px-3 py-1 bg-blue-50 text-blue-900 font-bold text-[10.5px] rounded-full border border-blue-100 self-start sm:self-auto">{tx(`${cards.length - 1} proveedor(es) · ${cards[0]?.total ?? 0} cotización(es)`, `${cards.length - 1} supplier(s) · ${cards[0]?.total ?? 0} quote(s)`)}</span>
      </div>
      {list.status === 'loading' && !list.data && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {list.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{list.error.message}</p>}
      <div className="max-h-[440px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">{cards.map(c => { const on = supplier === c.id; return <button key={c.id} type="button" data-testid="sqm-supplier-card" aria-pressed={on} aria-label={`${c.isAll ? tx('Abrir todas', 'Open all') : tx('Abrir proveedor', 'Open supplier')}: ${c.name}`} onClick={() => open(c.id)}
        className={`relative text-left p-3.5 rounded-2xl border bg-white shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col gap-3 cursor-pointer ${on ? 'border-purple-500 ring-2 ring-purple-200 bg-gradient-to-br from-white to-pink-50/50' : 'border-slate-200/90'}`}>
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-600 to-pink-500" />
        <span className="flex items-center gap-3 min-w-0"><span className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">{c.tag}</span>
          <span className="min-w-0"><span className="block text-xs font-black text-slate-900 leading-tight line-clamp-2" title={c.name}>{c.name}</span><span className="block text-[10px] text-slate-400 mt-0.5">{c.subtitle}</span></span></span>
        <span className="grid grid-cols-3 gap-1.5">{c.boxes.map(([n, t]) => <span key={t} className="block px-1.5 py-2 rounded-xl border border-slate-200/80 bg-white min-w-0"><span className="block text-sm font-black text-slate-900">{n}</span><span className="block text-[8.5px] font-bold text-slate-500 leading-tight">{t}</span></span>)}</span>
        <span className="flex items-center justify-between text-[10px] font-bold text-slate-600"><span>{c.footer}</span><span className="text-purple-600 text-sm">→</span></span>
      </button>; })}
        {list.status === 'ready' && cards.length === 1 && <div className="col-span-full p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('No hay cotizaciones de proveedor registradas.', 'No supplier quotes recorded.')}</div>}
      </div>
      {sel && <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3.5 rounded-xl border border-slate-200/80 bg-white/80">
        <div><h5 className="text-xs font-black text-slate-900">{sel.name}</h5><p className="text-[10px] text-slate-500">{tx(`${total} registro(s)`, `${total} record(s)`)}</p></div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative text-xs font-medium"><Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar en la matriz', 'Search the matrix')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Folio, requisición, referencia…', 'Folio, requisition, reference…')} className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
          <span className="text-xs font-black"><button type="button" onClick={() => { setSupplier(null); setInput(''); }} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs whitespace-nowrap">← {tx('Volver a tarjetas', 'Back to cards')}</button></span>
        </div>
      </div>}
    </div>

    {sel && <div className="space-y-3" data-testid="sqm-matrix">
      {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80"><table className="w-full text-left border-collapse min-w-[1200px]">
        <thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">{[tx('Folio', 'Folio'), tx('Requisición', 'Requisition'), tx('Referencia interna', 'Internal reference'), tx('Proveedor', 'Supplier'), 'Total', tx('Entrega', 'Delivery'), tx('Técnico', 'Technical'), tx('Documental', 'Documentary'), tx('Puntaje', 'Score'), tx('Estatus', 'Status'), tx('PDF cotización', 'Quote PDF'), tx('Acciones', 'Actions')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">{rows.map(r => { const st = quoteStatus(r, en); const rr = requisitionRef(r); const sc = scores[r.requisition_id]; const s = sc?.by?.[r.id];
          return <tr key={r.id} data-testid="sqm-row" data-folio={r.folio} className="align-top hover:bg-slate-50/60">
            <td className="py-3 px-3 font-black text-slate-900 whitespace-nowrap">{r.folio}{r.rfq_folio && <div className="text-[10px] text-slate-400 font-medium">{r.rfq_folio}</div>}</td>
            <td className="py-3 px-3 whitespace-nowrap">{rr.main}{rr.sub && <div className="text-[10px] text-slate-400">{rr.sub}</div>}</td>
            <td className="py-3 px-3">{r.internal_reference ? <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-800 font-bold text-[10.5px] rounded-full border border-blue-100 whitespace-nowrap">{r.internal_reference}</span> : <span className="text-slate-400">—</span>}</td>
            <td className="py-3 px-3 min-w-[170px]"><div className="uppercase">{r.supplier_name}</div><div className="text-[10px] text-slate-400">{tx(`${r.offered_count} partida(s)`, `${r.offered_count} item(s)`)}</div></td>
            <td className="py-3 px-3 font-bold whitespace-nowrap">{money(r.total_amount, r.currency, en)}</td>
            <td className="py-3 px-3 whitespace-nowrap">{leadText(r.lead_days, en)}</td>
            <td className="py-3 px-3">{pct(r.technical_score)}</td>
            <td className="py-3 px-3">{pct(r.document_score)}</td>
            <td className="py-3 px-3">{s ? <span title={s.recommended ? tx('Recomendada en el comparativo', 'Recommended in the comparison') : undefined} className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-black whitespace-nowrap ${scoreTone(s.score)}`}>{s.score.toFixed(1)}{s.recommended ? ' ★' : ''}</span> : sc?.status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <span className="text-slate-400">—</span>}</td>
            <td className="py-3 px-3"><span className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-black border whitespace-nowrap ${st.tone}`}>{st.text}</span></td>
            <td className="py-3 px-3">{r.file_count ? <span className="text-xs font-black"><button type="button" onClick={() => { setDetId(r.id); setDetMode('pdf'); }} title={r.file_name || undefined} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl whitespace-nowrap">{tx('VER PDF', 'VIEW PDF')}</button></span> : <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-600 whitespace-nowrap">{tx('Sin PDF', 'No PDF')}</span>}</td>
            <td className="py-3 px-3"><div className="flex items-center gap-1.5 text-[11px] font-black">
              <button type="button" onClick={() => { setDetId(r.id); setDetMode('edit'); }} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm">{tx('EDITAR', 'EDIT')}</button>
              <button type="button" onClick={() => onCompare?.(r.requisition_id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm">{tx('ADJUDICAR', 'AWARD')}</button>
              <button type="button" onClick={() => { setDel(r); setTyped(''); setDelMsg(''); }} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm">{tx('ELIMINAR', 'DELETE')}</button>
            </div></td>
          </tr>; })}
          {list.status === 'ready' && !rows.length && <tr><td colSpan={12} className="py-10 text-center text-xs text-slate-400 font-semibold">{q ? tx('Ninguna cotización coincide con la búsqueda.', 'No quote matches the search.') : tx('No hay cotizaciones registradas en la matriz para este filtro.', 'There are no quotes in the matrix for this filter.')}</td></tr>}
        </tbody></table></div>
      <p className="text-[10.5px] text-slate-400">{tx('Puntaje: criterio provisional del comparativo (precio 40, entrega 15, técnico 25, documental 20); ★ = recomendada. Pendiente de confirmar contra la fórmula del sistema original.', 'Score: provisional comparison criterion (price 40, delivery 15, technical 25, documentary 20); ★ = recommended. Pending confirmation against the original system formula.')}</p>
      {total > PAGE && <div className="flex justify-between items-center text-xs text-slate-600"><span>{total} {tx('registros', 'records')} · {tx('Página', 'Page')} {page} / {last}</span>
        <div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(x => x - 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(x => x + 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronRight size={16} /></button></div></div>}
    </div>}

    {detId && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDetId(''); }}>
      <div role="dialog" aria-modal="true" aria-label={tx('Cotización de proveedor', 'Supplier quote')} data-testid="sqm-detail" className="bg-white w-full max-w-5xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#1e4a7a] px-5 py-3 flex justify-between items-center gap-3 shrink-0"><h2 className="text-white font-bold text-sm truncate">{detMode === 'pdf' ? tx('Vista de la cotización', 'Quote view') : tx('Detalle de la cotización', 'Quote detail')} · {det.data?.item?.folio || detRow?.folio || '…'}</h2>
          <div className="flex gap-2 text-xs font-bold"><button type="button" onClick={print} disabled={!doc} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-3.5 h-3.5" />{tx('Imprimir', 'Print')}</button><button type="button" onClick={() => setDetId('')} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded flex items-center gap-1.5"><X className="w-3.5 h-3.5" />{tx('Cerrar', 'Close')}</button></div></div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs">
          {det.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
          {det.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{det.error.message}</p>}
          {detMode === 'edit' && <p className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{tx('Modificar una cotización registrada es una escritura comercial bloqueada hasta su autorización. Aquí se consulta lo registrado; para capturar una nueva oferta usa Registro de cotización (tarjeta 4).', 'Modifying a recorded quote is a commercial write blocked until authorized. Here the recorded data is shown; to capture a new offer use Quote registration (card 4).')}</span></p>}
          {detRow && <p className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"><Paperclip className="w-4 h-4 shrink-0" />{detRow.file_count ? tx(`Archivo original registrado: ${detRow.file_name || 'sin nombre'}. Su descarga desde esta pantalla aún no está habilitada; la vista siguiente se genera con los datos registrados en MariaDB.`, `Original file recorded: ${detRow.file_name || 'unnamed'}. Downloading it from this screen is not enabled yet; the view below is generated from the data recorded in MariaDB.`) : tx('Sin archivo original del proveedor registrado; la vista se genera con los datos de MariaDB.', 'No original supplier file recorded; the view is generated from MariaDB data.')}</p>}
          {doc && <iframe data-testid="sqm-doc" title={tx('Cotización de proveedor', 'Supplier quote')} srcDoc={doc.html} sandbox="" className="w-full h-[560px] rounded-lg border border-slate-200 bg-white" />}
          {detMode === 'edit' && <div className="flex justify-end gap-2 text-xs font-bold"><button type="button" onClick={() => { setDetId(''); onCompare?.(detRow?.requisition_id); }} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg">{tx('Abrir comparativo', 'Open comparison')}</button><button type="button" onClick={() => { setDetId(''); onNew?.(); }} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">{tx('Ir a Registro de cotización', 'Go to Quote registration')}</button></div>}
        </div>
      </div>
    </div>}

    {del && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDel(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sf-sqm-del" data-testid="sqm-delete" className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-rose-600 px-5 py-3"><h2 id="sf-sqm-del" className="text-white font-black text-sm">{tx('Eliminar cotización', 'Delete quote')} · {del.folio}</h2></div>
        <div className="p-5 space-y-3 text-xs text-slate-700">
          <p className="font-bold text-slate-900">{del.folio} · {del.supplier_name} · {money(del.total_amount, del.currency, en)}</p>
          {delBlock ? <p className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{delBlock}</span></p> : <>
            <p className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">{tx('Eliminar una cotización de proveedor es una escritura comercial bloqueada hasta su validación integral: no se borrará nada.', 'Deleting a supplier quote is a commercial write blocked until fully validated: nothing will be deleted.')}</p>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold text-slate-700">{tx('Escribe exactamente el folio para confirmar', 'Type the exact folio to confirm')}</span>
              <span className="text-sm font-medium"><input aria-label={tx('Folio a confirmar', 'Folio to confirm')} value={typed} onChange={e => { setTyped(e.target.value); setDelMsg(''); }} maxLength={128} autoComplete="off" placeholder={del.folio} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-500" /></span></label>
            {delMsg && <p role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{delMsg}</span></p>}
          </>}
          <div className="flex justify-end gap-2 text-xs font-bold">
            <button type="button" onClick={() => setDel(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200">{delBlock ? tx('Entendido', 'Got it') : tx('Cancelar', 'Cancel')}</button>
            {!delBlock && <button type="button" onClick={confirmDelete} disabled={typed.trim() !== del.folio} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{tx('Sí, eliminar', 'Yes, delete')}</button>}
          </div>
        </div>
      </div>
    </div>}
  </div>;
}

export default SupplierMatrixCard;
