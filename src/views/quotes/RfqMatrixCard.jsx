import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, AlertCircle, Printer, X, ChevronLeft, ChevronRight, Globe, Plus } from 'lucide-react';
import { getRfqContacts, listRfqs, getRfq } from './api';
import { label, tone, rfqState } from './model.mjs';
import { initials, responseRate, filterContacts, rfqReference, registeredDoc, rfqDocHtml } from './rfq.mjs';

// Tarjeta 3 · Matriz de solicitudes de cotización (RFQ), diseño Grupo Gerez: primero las RFQ por contacto de compras
// (tarjetas con métricas reales) y después la matriz paginada del contacto elegido. Solo lectura: "Nueva RFQ" lleva a la
// tarjeta 2 y "Ver" abre el formato registrado en el idioma de RFQ seleccionado.
const DASH = '—';
const ymd = v => (v ? String(v).slice(0, 10) : DASH);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
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

export function RfqMatrixCard({ en = false, notify, onNewRfq, docLang = 'es', onDocLang, refresh = 0 }) {
  const tx = (es, e) => (en ? e : es);
  const docEn = docLang === 'en';
  const [cq, setCq] = useState('');
  const [open, setOpen] = useState(null); // null | 'all' | contact key
  const [page, setPage] = useState(1);
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [rfqId, setRfqId] = useState('');
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  const contacts = useLoad(s => getRfqContacts(s), [refresh]);
  const list = useLoad(s => listRfqs({ page, q, contact: open || 'all' }, s), [open, page, q, refresh], open !== null);
  const rfq = useLoad(s => getRfq(rfqId, s), [rfqId], !!rfqId);
  const all = contacts.data?.all;
  const cards = useMemo(() => filterContacts(contacts.data?.contacts || [], cq), [contacts.data, cq]);
  const total = contacts.data?.contacts?.length ?? 0;
  const day = localToday();
  const nameOf = c => c.name || (c.key === 'unassigned' ? tx('Sin contacto asignado', 'No contact assigned') : DASH);
  const current = open === 'all' ? null : (contacts.data?.contacts || []).find(c => c.key === open);
  const openCard = key => { setOpen(key); setPage(1); setInput(''); setQ(''); };
  const close = () => { setOpen(null); setInput(''); setQ(''); setPage(1); };
  const html = rfq.data ? rfqDocHtml(registeredDoc(rfq.data, docEn), docEn) : '';
  const print = () => {
    if (!html) return;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { notify?.(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250);
  };
  const last = Math.max(1, Math.ceil((list.data?.total || 0) / (list.data?.page_size || 25)));

  const card = (c, isAll = false) => {
    const on = isAll ? open === 'all' : open === c.key;
    const pct = responseRate(c);
    return <button key={isAll ? '__all' : c.key} type="button" data-testid={isAll ? 'rfq-contact-all' : 'rfq-contact'} aria-pressed={on} onClick={() => openCard(isAll ? 'all' : c.key)}
      className={`relative text-left rounded-2xl p-4 border shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between gap-3 cursor-pointer ${isAll ? 'bg-gradient-to-br from-blue-50/80 to-cyan-50/50' : 'bg-white'} ${on ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200/80'}`}>
      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 to-purple-600" />
      <div className="flex items-start gap-3 pl-1">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">{isAll ? 'ALL' : initials(c.name)}</div>
        <div className="min-w-0"><h5 className="text-[13px] font-black text-slate-900 uppercase leading-tight">{isAll ? tx('Todas las RFQ', 'All RFQs') : nameOf(c)}</h5>
          <p className="text-[10px] text-slate-500 truncate mt-0.5" title={isAll ? undefined : [c.email, c.phone].filter(Boolean).join(' · ')}>{isAll ? tx(`${c.contacts} contactos de compras`, `${c.contacts} purchasing contacts`) : [c.email, c.phone].filter(Boolean).join(' · ') || tx('Sin correo ni teléfono', 'No e-mail or phone')}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 pl-1">{[[c.rfqs, 'RFQ'], [c.responded, tx('Respondidas', 'Answered')], [c.overdue, tx('Vencidas', 'Overdue')]].map(([n, l]) => <div key={l} className="p-2 rounded-xl border border-slate-200/80 bg-white"><div className="text-base font-black text-slate-900 tabular-nums">{n}</div><div className="text-[9px] text-slate-500 font-medium">{l}</div></div>)}</div>
      <div className="pl-1 space-y-2">
        <div className="flex justify-between gap-2 text-[10px] text-slate-600 font-medium"><span>{tx(`${c.suppliers} proveedores`, `${c.suppliers} suppliers`)}{isAll ? '' : ` · ${tx(`${c.requisitions} requisiciones`, `${c.requisitions} requisitions`)}`}</span><span>{tx('Respuesta', 'Response')} {pct}%</span></div>
        <div className="flex items-center gap-3"><div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-600 to-purple-600" style={{ width: `${pct}%` }} /></div><span className="text-[10px] font-black text-slate-700 whitespace-nowrap">{isAll ? tx('Abrir todas →', 'Open all →') : tx('Abrir contacto →', 'Open contact →')}</span></div>
      </div>
    </button>;
  };

  return <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="rfq-matrix-card">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de solicitudes de cotización · RFQ', 'Request for Quotation Matrix · RFQ')}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{tx('Organiza las RFQ primero por contacto de compras y abre después la matriz paginada de cada responsable.', 'Organize RFQs by purchasing contact first, then open the paginated matrix of each person in charge.')}</p></div>
      <span className="text-sm font-black shrink-0"><button type="button" onClick={() => onNewRfq?.()} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-1.5"><Plus className="w-4 h-4" />{tx('Nueva RFQ', 'New RFQ')}</button></span>
    </div>

    <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 flex flex-wrap items-center gap-3">
      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-600" />Idioma de RFQ / RFQ language:</span>
      <span className="text-sm font-medium"><select aria-label="Idioma de RFQ / RFQ language" value={docLang} onChange={e => onDocLang?.(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl min-w-[180px] outline-none focus:ring-2 focus:ring-blue-500"><option value="es">Español</option><option value="en">English</option></select></span>
      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold" title={tx('Etiquetas y textos fijos del formato; las descripciones capturadas se muestran tal como se registraron.', 'Labels and fixed texts of the format; captured descriptions are shown as recorded.')}>{docEn ? 'PDF: 100% in the selected language' : 'PDF: 100% en el idioma seleccionado'}</span>
    </div>

    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div><h4 className="text-sm font-black text-slate-900">{tx('RFQ por contacto de compras', 'RFQs by purchasing contact')}</h4><p className="text-[10.5px] text-slate-500">{tx('Selecciona un contacto de compras para abrir únicamente sus RFQ en una matriz paginada.', 'Select a purchasing contact to open only their RFQs in a paginated matrix.')}</p></div>
        <span className="text-xs font-black shrink-0"><button type="button" onClick={() => { close(); setCq(''); }} className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-800 shadow-2xs">← {tx('Volver a contactos', 'Back to contacts')}</button></span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 text-sm font-medium"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar contacto de compras', 'Search purchasing contact')} value={cq} onChange={e => setCq(e.target.value)} maxLength={120} placeholder={tx('Buscar contacto de compras, correo o teléfono...', 'Search purchasing contact, e-mail or phone...')} className="w-full pl-10 pr-3.5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
        <span data-testid="rfq-contact-count" className="self-end sm:self-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black whitespace-nowrap">{tx(`${cards.length} de ${total} contactos`, `${cards.length} of ${total} contacts`)}</span>
      </div>
      {contacts.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {contacts.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{contacts.error.message}</p>}
      {contacts.data && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {!cq && card(all, true)}
        {cards.map(c => card(c))}
        {!cards.length && cq && <div className="col-span-full py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">{tx('Ningún contacto coincide con la búsqueda.', 'No contact matches the search.')}</div>}
        {!total && <div className="col-span-full py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">{tx('No hay RFQ registradas.', 'No RFQs recorded.')}</div>}
      </div>}
    </div>

    {open !== null && <div data-testid="rfq-matrix" className="space-y-3 pt-5 border-t border-slate-200/80">
      <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-200/70">
        <div className="text-xs text-slate-500 font-bold">{open === 'all' ? tx('Todas las RFQ', 'All RFQs') : nameOf(current || { key: open })} · {tx('Total de solicitudes:', 'Total requests:')} <span className="text-slate-900">{list.data?.total ?? '…'}</span></div>
        <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
          <div className="relative w-full sm:w-72 text-xs font-medium"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar en la matriz', 'Search in matrix')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar RFQ, requisición, proveedor o cliente...', 'Search RFQ, requisition, supplier or client...')} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
          <span className="text-xs font-bold"><button type="button" onClick={close} aria-label={tx('Cerrar matriz', 'Close matrix')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200"><X className="w-4 h-4" /></button></span>
        </div>
      </div>
      {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {list.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{list.error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200/80">{[tx('Folio RFQ', 'RFQ folio'), tx('Requisición', 'Requisition'), tx('Referencia', 'Reference'), tx('Comprador', 'Buyer'), tx('Proveedor', 'Supplier'), tx('Emisión', 'Issued'), tx('Límite', 'Deadline'), tx('Moneda', 'Currency'), tx('Estatus', 'Status'), tx('Fecha enviado', 'Date sent'), tx('Acciones', 'Actions')].map((h, i) => <th key={h} className={`py-3 px-3.5 ${i === 10 ? 'text-center' : ''}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
            {(list.data?.items || []).map(r => { const st = rfqState(r, day); return <tr key={r.id} data-testid="rfq-row" className="align-top hover:bg-slate-50/60">
              <td className="py-2.5 px-3.5 font-black text-slate-900">{r.folio}</td>
              <td className="py-2.5 px-3.5">{r.requisition}<div className="text-[10px] text-slate-400">{r.client_name}</div></td>
              <td className="py-2.5 px-3.5">{rfqReference(r) || DASH}</td>
              <td className="py-2.5 px-3.5">{r.buyer_name || DASH}{r.contact_name && r.contact_name !== r.buyer_name ? <div className="text-[10px] text-slate-400">{tx('Contacto', 'Contact')}: {r.contact_name}</div> : null}</td>
              <td className="py-2.5 px-3.5 font-semibold">{r.supplier_name}</td>
              <td className="py-2.5 px-3.5 whitespace-nowrap">{ymd(r.request_date)}</td>
              <td className={`py-2.5 px-3.5 whitespace-nowrap ${st === 'overdue' ? 'text-rose-600 font-bold' : ''}`}>{ymd(r.deadline)}</td>
              <td className="py-2.5 px-3.5">{r.currency}</td>
              <td className="py-2.5 px-3.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${tone(r.status)}`}>{r.legacy_status || label(r.status, en)}</span>
                <div className={`text-[10px] mt-1 font-bold ${st === 'answered' ? 'text-emerald-700' : st === 'overdue' ? 'text-rose-600' : 'text-amber-700'}`}>{st === 'answered' ? `${tx('Respondida', 'Answered')} · ${r.quote_folio}` : st === 'overdue' ? tx('Vencida', 'Overdue') : tx('En espera', 'Waiting')}</div></td>
              <td className="py-2.5 px-3.5 text-slate-400" title={tx('MariaDB no registra la fecha de envío de la RFQ.', 'MariaDB does not store the RFQ send date.')}>{DASH}</td>
              <td className="py-2.5 px-3.5 text-center text-[11px] font-bold"><button type="button" onClick={() => setRfqId(r.id)} aria-label={`${tx('Ver formato', 'View format')} ${r.folio}`} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">{tx('Ver', 'View')}</button></td>
            </tr>; })}
            {list.status === 'ready' && !(list.data?.items || []).length && <tr><td colSpan={11} className="py-12 text-center text-slate-400 text-xs">{q ? tx('Ninguna RFQ coincide con la búsqueda.', 'No RFQ matches the search.') : tx('No hay solicitudes registradas aún.', 'There are no requests registered yet.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center text-xs text-slate-600"><span>{list.data?.total ?? 0} {tx('registros', 'records')} · {tx('Página', 'Page')} {page} / {last}</span>
        <div className="flex gap-1"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button></div></div>
    </div>}

    {rfqId && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setRfqId(''); }}>
      <div role="dialog" aria-modal="true" aria-label={tx('Formato de RFQ', 'RFQ format')} data-testid="rfq-doc" className="bg-white w-full max-w-5xl h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#1e4a7a] px-5 py-3 flex justify-between items-center shrink-0 gap-3"><h2 className="text-white font-bold text-sm truncate">{tx('Solicitud de cotización', 'Request for quotation')} · {rfq.data?.item?.folio || '…'} · {docEn ? 'English' : 'Español'}</h2>
          <div className="flex gap-2 text-xs font-bold"><button type="button" disabled={!rfq.data} onClick={print} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-3.5 h-3.5" />{tx('Imprimir PDF', 'Print PDF')}</button><button type="button" onClick={() => setRfqId('')} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded flex items-center gap-1.5"><X className="w-3.5 h-3.5" />{tx('Cerrar', 'Close')}</button></div></div>
        <div className="flex-1 overflow-hidden bg-slate-200/50 p-3 sm:p-6">
          {rfq.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
          {rfq.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{rfq.error.message}</p>}
          {html && <iframe title={tx('Formato de RFQ', 'RFQ format')} srcDoc={html} sandbox="" className="w-full h-full rounded-lg border border-slate-200 bg-white" />}
        </div>
      </div>
    </div>}
  </div>;
}

export default RfqMatrixCard;
