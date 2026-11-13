import React from 'react';
import { Search, Loader2, AlertCircle, X } from 'lucide-react';

// Ventana "Requisiciones validadas" del comprador (tarjetas 2 y 4 de Cotizaciones). Solo muestra y elige; los datos llegan
// de GET /api/v1/quotes/rfq-requisitions (validación del contratista, partidas, RFQ, cotizaciones y OC).
export function RequisitionPickerModal({ en = false, title, buyerName, search, onSearch, state, selectedId, onPick, onClose, emptyText }) {
  const tx = (es, e) => (en ? e : es);
  const items = state?.data?.items || [];
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="sf-rfq-reqs" data-testid="rfq-req-modal" className="bg-white w-full max-w-5xl max-h-[88vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs">
      <div className="bg-gradient-to-r from-[#2B4B9A] to-[#8C3AAA] px-5 py-3 flex justify-between items-start gap-3">
        <div><h2 id="sf-rfq-reqs" className="text-white font-black text-sm">🔍 {title}</h2><p className="text-[11px] text-blue-100">{buyerName || tx('Sin comprador asignado', 'No buyer assigned')}</p></div>
        <span className="font-bold shrink-0"><button type="button" onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded border border-white/30 flex items-center gap-1"><X className="w-3.5 h-3.5" />{tx('Cerrar', 'Close')}</button></span>
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="relative font-medium"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar requisición', 'Search requisition')} value={search} onChange={e => onSearch(e.target.value)} maxLength={120} placeholder={tx('Buscar folio, cliente, referencia, descripción o validación...', 'Search folio, client, reference, description or validation...')} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
        {state?.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
        {state?.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{state.error.message}</p>}
        {state?.status === 'ready' && !items.length && <p className="text-center text-slate-400 py-8">{emptyText}</p>}
        <div className="space-y-2">{items.map(r => <div key={r.id} data-testid="rfq-req-option" className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${selectedId === r.id ? 'border-purple-400 bg-purple-50/40' : 'border-slate-200'}`}>
          <div className="min-w-0 flex-1"><div className="font-black text-slate-900">{r.folio} · <span className="text-slate-700">{r.client_name}</span></div>
            <div className="text-[10.5px] text-slate-500 truncate">{[r.internal_reference, r.project, r.description].filter(Boolean).join(' · ')}</div>
            <div className="flex flex-wrap gap-1 mt-1 text-[9.5px] font-bold"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{r.review_folio} · {r.strategy}</span><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{r.item_count} {tx('partida(s)', 'item(s)')}</span><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{r.rfq_count} RFQ · {r.quote_count} {tx('cotización(es)', 'quote(s)')} / {tx('mín.', 'min.')} {r.min_quotes}</span>{r.has_po && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{tx('Con OC', 'With PO')}</span>}</div></div>
          <span className="font-bold"><button type="button" onClick={() => onPick(r.id)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">{tx('Seleccionar', 'Select')}</button></span>
        </div>)}</div>
        {(state?.data?.total || 0) > items.length && <p className="text-[10.5px] text-slate-400">{tx(`Se muestran ${items.length} de ${state.data.total}; usa la búsqueda para acotar.`, `Showing ${items.length} of ${state.data.total}; use search to narrow down.`)}</p>}
      </div>
    </div>
  </div>;
}

export default RequisitionPickerModal;
