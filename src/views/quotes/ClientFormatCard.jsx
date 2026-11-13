import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Download, Search } from 'lucide-react';
import { listCustomerQuotes, getCustomerQuote } from './api';
import { docModel, quoteDocHtml, docFileName } from './quoteDocument.mjs';

// Tarjeta 7 · Formato de cotización para el cliente (documento externo que puede compartirse en el Portal del Cliente).
// Lee de MariaDB cualquier revisión registrada (GET /api/v1/quotes/customer-quotes/{id}); nunca muestra costos de
// proveedor ni margen. "Descargar PDF" genera el archivo en el navegador (html2pdf.js) sin escribir nada en el servidor.
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
export const optionLabel = q => [q.folio, `Rev. ${q.revision ?? Math.max(0, (q.version_number || 1) - 1)}`, q.client_name, q.client_reference].filter(Boolean).join(' · ');

export function ClientFormatCard({ en = false, notify, selectedId = '', onSelect, refresh = 0 }) {
  const tx = (es, e) => (en ? e : es);
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const h = setTimeout(() => setQ(input.trim()), 300); return () => clearTimeout(h); }, [input]);
  const list = useLoad(s => listCustomerQuotes({ scope: 'all', page_size: 50, q }, s), [q, refresh]);
  const det = useLoad(s => getCustomerQuote(selectedId, s), [selectedId, refresh], !!selectedId);
  const items = list.data?.items || [];
  // The most recent quote is shown by default, as in the design.
  useEffect(() => { if (!selectedId && !q && items.length) onSelect?.(items[0].id); }, [items, selectedId, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/image_923273.svg` : '/image_923273.svg';
  const model = useMemo(() => (det.data ? docModel(det.data, en) : null), [det.data, en]);
  const doc = useMemo(() => (model ? quoteDocHtml(model, en, { logoUrl }) : null), [model, en, logoUrl]);
  const current = det.data?.item;

  const printFallback = () => {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { notify?.(tx('Descargar PDF', 'Download PDF'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; }
    w.document.write(doc.html); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 300);
  };
  const download = async () => {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set({ margin: [6, 6, 6, 6], filename: docFileName(model), image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } }).from(`<div style="background:#fff;color:#0f172a"><style>${doc.css}</style>${doc.body}</div>`, 'string').save();
      notify?.(tx('PDF generado', 'PDF generated'), docFileName(model), 'success');
    } catch (err) {
      console.warn('SupplyFlow PDF:', err?.message || err);
      notify?.(tx('Descargar PDF', 'Download PDF'), tx('No se pudo generar el archivo en este navegador; se abrió la impresión para guardarlo como PDF.', 'The file could not be generated in this browser; printing was opened to save it as PDF.'), 'warning');
      printFallback();
    } finally { setBusy(false); }
  };

  return <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="format-card">
    <div className="p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Formato de cotización para el cliente', 'Client quotation format')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Documento comercial que sí puede compartirse en el Portal del Cliente. No contiene costos de proveedor ni margen.', 'Commercial document that can be shared in the Client Portal. It contains no supplier costs or margin.')}</p></div>
      <span className="text-sm font-medium shrink-0"><button type="button" onClick={download} disabled={!doc || busy} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{tx('Descargar PDF', 'Download PDF')}</button></span>
    </div>
    <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
      <div className="text-sm font-medium"><select aria-label={tx('Cotización al cliente', 'Client quote')} value={selectedId} onChange={e => onSelect?.(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs">
        <option value="">{tx('Seleccionar cotización…', 'Select quote…')}</option>
        {selectedId && current && !items.some(x => x.id === selectedId) && <option value={selectedId}>{optionLabel({ ...current, client_name: current.client_name, client_reference: current.client_reference })}</option>}
        {items.map(x => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}
      </select></div>
      <div className="relative text-xs font-medium"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar cotización', 'Search quote')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar folio, serie, requisición o cliente…', 'Search folio, series, requisition or client…')} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
      <p className="text-[10.5px] text-slate-400">{tx(`${list.data?.total ?? '…'} revisión(es) registradas${(list.data?.total || 0) > items.length ? `; se muestran ${items.length}, usa la búsqueda` : ''}.`, `${list.data?.total ?? '…'} recorded revision(s)${(list.data?.total || 0) > items.length ? `; showing ${items.length}, use search` : ''}.`)}</p>
    </div>
    {(list.status === 'loading' || det.status === 'loading') && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
    {(list.error || det.error) && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{(list.error || det.error).message}</p>}
    {list.status === 'ready' && !items.length && !selectedId && <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{q ? tx('Ninguna cotización coincide con la búsqueda.', 'No quote matches the search.') : tx('No hay cotizaciones al cliente registradas.', 'No client quotes recorded.')}</div>}
    {doc && <div className="rounded-2xl border border-slate-200 bg-slate-100/60 p-2 sm:p-4"><iframe data-testid="format-doc" title={tx('Formato para el cliente', 'Client format')} srcDoc={doc.html} sandbox="" className="w-full h-[1180px] rounded-xl border border-slate-200 bg-white shadow-sm" /></div>}
  </div>;
}

export default ClientFormatCard;
