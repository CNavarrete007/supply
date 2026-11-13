import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Search, Lock, ChevronLeft, ChevronRight, X, AlertTriangle } from 'lucide-react';
import { listCustomerQuotes } from './api';
import { money } from './model.mjs';
import { CQM_STATUSES, statusText, statusTone, clientCards, approvalBadge, decisionText, canValidateBuyer, deleteBlock, folioConfirmed, changeTarget, matrixCaption } from './cqMatrix.mjs';

// Tarjeta 8 · Matriz de cotizaciones al cliente. Lee de MariaDB todas las revisiones registradas
// (GET /api/v1/quotes/customer-quotes?scope=all) con filtros en el servidor (cliente, estatus y búsqueda).
// VER PDF usa el visor de la tarjeta 1; MODIFICAR DESDE REQ. abre la modificación controlada R3A (la API decide).
// Validar comprador y eliminar son escrituras comerciales bloqueadas: se explica el motivo y nunca se simula el registro.
function useLoad(fn, deps) {
  const [st, setSt] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    const c = new AbortController();
    setSt(x => ({ ...x, status: 'loading', error: null }));
    fn(c.signal).then(d => !c.signal.aborted && setSt({ status: 'ready', data: d, error: null })).catch(e => !c.signal.aborted && setSt(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
const DASH = '—';
const ymd = v => (v ? String(v).slice(0, 10) : DASH);
const PAGE = 25;

export function CustomerQuoteMatrixCard({ en = false, notify, lockText = '', refresh = 0, onNew, onOpenPdf, onRequestChange, onBlocked }) {
  const tx = (es, e) => (en ? e : es);
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [client, setClient] = useState(null); // null = matriz cerrada; 'all' | public id del cliente
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);
  const [del, setDel] = useState(null); const [typed, setTyped] = useState(''); const [delErr, setDelErr] = useState('');
  useEffect(() => { const h = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); if (n && !client) setClient('all'); } }, 300); return () => clearTimeout(h); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useLoad(s => listCustomerQuotes({ scope: 'all', page, page_size: PAGE, q, status, client: client || 'all' }, s), [page, q, status, client, refresh]);
  const cards = useMemo(() => clientCards(list.data?.summary?.client_cards || [], en), [list.data, en]);
  const sel = client ? (cards.find(c => c.id === client) || { id: client, name: DASH, isAll: client === 'all' }) : null;
  const rows = list.data?.items || [];
  const total = list.data?.total || 0;
  const last = Math.max(1, Math.ceil(total / PAGE));
  const open = id => { setClient(id); setPage(1); setNotice(null); };

  const validate = v => {
    const msg = tx(`${v.folio}: la validación del comprador (aprobación interna) es una escritura comercial bloqueada hasta su autorización. No se registró nada.`, `${v.folio}: buyer validation (internal approval) is a commercial write blocked until authorized. Nothing was recorded.`);
    setNotice({ folio: v.folio, msg }); notify?.(tx('Validar comprador', 'Validate buyer'), msg, 'warning');
  };
  const modify = v => { const t = changeTarget(v); (t.can_request_change ? onRequestChange : onBlocked)?.(t); };
  const askDelete = v => { setDel(v); setTyped(''); setDelErr(''); };
  const confirmDelete = () => {
    if (!del || !folioConfirmed(del, typed)) return;
    setDelErr(tx(`No se eliminó ${del.folio}: escritura comercial bloqueada hasta su autorización.`, `${del.folio} was not deleted: commercial write blocked until authorized.`));
  };
  const delBlock = del ? deleteBlock(del, en) : null;

  const th = 'p-3.5 whitespace-nowrap';
  return <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden" data-testid="cq-matrix-card">
    <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h3 className="text-lg sm:text-xl font-black text-slate-900">{tx('Matriz de cotizaciones al cliente', 'Client quotation matrix')}</h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{tx('Consulta revisiones, vigencia, total, estado de aprobación y PDF formal.', 'Check revisions, validity, total, approval status and the formal PDF.')}</p></div>
      <span className="text-sm font-medium shrink-0"><button type="button" onClick={() => onNew?.()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"><span>+</span>{tx('Nueva cotización al cliente', 'New client quote')}</button></span>
    </div>

    <div className="p-5 sm:p-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="md:col-span-2 relative"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar cotización al cliente', 'Search client quote')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar por folio, cliente, requisición o estatus...', 'Search by folio, client, requisition or status...')} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" /></div>
        <div><select aria-label={tx('Estatus', 'Status')} value={status} onChange={e => { setStatus(e.target.value); setPage(1); if (!client) setClient('all'); }} className="w-full bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
          <option value="all">{tx('Todos los estatus', 'All statuses')}</option>
          {CQM_STATUSES.map(([k, es, e]) => { const n = (list.data?.summary?.statuses || []).find(x => x.code === k)?.count; return <option key={k} value={k}>{en ? e : es}{n ? ` (${n})` : ''}</option>; })}
        </select></div>
      </div>
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] sm:text-xs text-amber-900" data-testid="cqm-rule"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
        <span><strong>{tx('Cambio posterior a aprobación:', 'Change after approval:')}</strong> {tx('no elimines ni sobrescribas la cotización. Usa MODIFICAR DESDE REQUISICIÓN para generar Rev. N con trazabilidad.', 'do not delete or overwrite the quote. Use MODIFY FROM REQUISITION to create Rev. N with traceability.')}</span></div>
    </div>

    <div className="p-5 sm:p-6 bg-slate-50/30 border-b border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div><h4 className="text-sm font-black text-slate-900">{tx('Tarjetas por cliente', 'Cards per client')}</h4><p className="text-xs text-slate-500 mt-0.5">{tx('Selecciona un cliente para abrir únicamente sus cotizaciones al cliente.', 'Select a client to open only that client’s quotes.')}</p></div>
        <span data-testid="cqm-badge" className="px-3 py-1 bg-purple-50 text-purple-800 font-bold text-xs rounded-full border border-purple-100 self-start sm:self-auto">{tx(`${cards.length - 1} cliente(s) · ${cards[0]?.total ?? 0} cotización(es)`, `${cards.length - 1} client(s) · ${cards[0]?.total ?? 0} quote(s)`)}</span>
      </div>
      {list.status === 'loading' && !list.data && <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-3"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {list.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5 mb-3"><AlertCircle className="w-4 h-4" />{list.error.message}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(c => { const on = client === c.id; return <div key={c.id} data-testid="cqm-client-card" className={`relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${on ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/90'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl" />
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br ${c.isAll ? 'from-fuchsia-600 via-purple-600 to-indigo-600' : 'from-fuchsia-600 to-purple-600'}`}>{c.tag}</div>
              <div className="min-w-0"><h5 className="font-black text-xs text-slate-900 uppercase tracking-tight truncate" title={c.name}>{c.name}</h5><p className="text-[11px] text-slate-400 font-medium">{c.subtitle}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center my-2">
              <div><span className="text-sm font-black text-slate-800 block">{c.total}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{tx('Cotizaciones', 'Quotes')}</span></div>
              <div><span className="text-sm font-black text-emerald-600 block">{c.approved}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{tx('Aprobadas', 'Approved')}</span></div>
              <div><span className="text-sm font-black text-amber-600 block">{c.pending}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{tx('Pendientes', 'Pending')}</span></div>
            </div>
          </div>
          <span className="text-[11px] font-bold"><button type="button" aria-pressed={on} aria-label={`${c.isAll ? tx('Abrir todas', 'Open all') : tx('Abrir cliente', 'Open client')}: ${c.name}`} onClick={() => open(c.id)} className="flex items-center justify-between w-full pt-2 text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-2 group-hover:underline">
            <span>{c.isAll ? tx('Abrir todas', 'Open all') : tx('Abrir cliente', 'Open client')}</span><span className="text-xs">➔</span></button></span>
        </div>; })}
        {list.status === 'ready' && cards.length === 1 && !cards[0].total && <div className="col-span-full p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('No hay cotizaciones al cliente registradas.', 'No client quotes recorded.')}</div>}
      </div>
    </div>

    {sel && <div className="p-4 sm:p-6 bg-slate-100/50" data-testid="cqm-matrix">
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" /><h4 className="font-black text-sm text-slate-900 uppercase tracking-tight">{sel.name}</h4></div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium pl-4">{matrixCaption(sel, total, !!q || status !== 'all', en)}</p></div>
        <span className="text-xs font-bold self-start sm:self-auto"><button type="button" aria-label={tx('Cerrar matriz', 'Close matrix')} onClick={() => { setClient(null); setNotice(null); }} className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"><X className="w-3.5 h-3.5" /></button></span>
      </div>
      {notice && <div role="status" data-testid="cqm-notice" className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{notice.msg}</span></div>}
      {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-3"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1500px]">
          <thead><tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
            {[tx('Cotización', 'Quote'), 'Rev.', tx('Cliente', 'Client'), tx('Requisición', 'Requisition'), tx('Referencia interna', 'Internal reference'), tx('Emisión', 'Issued'), tx('Vigencia', 'Valid until'), 'Total', tx('Estatus', 'Status'), tx('Comprador', 'Buyer'), tx('Revisó', 'Reviewed'), tx('Autorizó', 'Authorized'), tx('Decisión del cliente', 'Client decision'), 'PDF', tx('Acciones', 'Actions')]
              .map((h, i) => <th key={h} className={`${th} ${i === 0 ? 'pl-4' : ''} ${i === 14 ? 'pr-4 text-center' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {rows.map(v => { const ab = approvalBadge(v, en); const dc = decisionText(v, en); return <tr key={v.id} data-testid="cqm-row" data-folio={v.folio} className="hover:bg-slate-50/80 transition-colors">
              <td className="p-3.5 pl-4 align-middle"><div className="font-bold text-slate-900 text-xs whitespace-nowrap">{v.folio}</div>
                <div className="flex items-center gap-1 mt-1"><span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${ab.tone}`}>{ab.text}</span><span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full whitespace-nowrap">Rev. {v.revision}</span></div></td>
              <td className="p-3.5 align-middle text-slate-600 font-medium">{v.revision}<div className="text-[10px] text-slate-400 whitespace-nowrap">v{v.version_number} / {v.versions}</div></td>
              <td className="p-3.5 align-middle min-w-[190px]"><div className="font-bold text-slate-900">{v.client_name}</div><div className="text-[10px] text-slate-400 font-medium">{v.client_reference ? `${tx('Ref. cliente', 'Client ref.')}: ${v.client_reference}` : tx('Cliente', 'Client')}</div></td>
              <td className="p-3.5 align-middle text-slate-700 font-medium whitespace-nowrap">{v.requisition}</td>
              <td className="p-3.5 align-middle">{v.internal_reference ? <span className="inline-block px-2.5 py-1 bg-blue-50/80 text-blue-700 font-bold text-[11px] rounded-full border border-blue-100 shadow-2xs whitespace-nowrap">{v.internal_reference}</span> : <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-500 font-bold text-xs rounded-full">{DASH}</span>}</td>
              <td className="p-3.5 align-middle text-slate-600 font-medium whitespace-nowrap">{ymd(v.quote_date)}</td>
              <td className={`p-3.5 align-middle font-medium whitespace-nowrap ${v.status_key === 'expired' ? 'text-rose-600' : 'text-slate-600'}`}>{ymd(v.valid_until)}</td>
              <td className="p-3.5 align-middle font-black text-slate-900 whitespace-nowrap">{money(v.total_amount, v.currency, en)}</td>
              <td className="p-3.5 align-middle"><span title={v.legacy_status || undefined} className={`px-3 py-1 font-bold text-[11px] rounded-full inline-block whitespace-nowrap ${statusTone(v.status_key)}`}>{statusText(v, en)}</span></td>
              <td className="p-3.5 align-middle">{v.prepared_by ? <><div className="font-bold text-slate-800 uppercase whitespace-nowrap">{v.prepared_by}</div><div className="text-[10px] text-slate-400 font-medium uppercase">{v.prepared_by_position || DASH}</div></> : <span className="text-slate-400 font-bold">{DASH}</span>}</td>
              <td className="p-3.5 align-middle">{v.reviewed_by ? <span className="font-semibold text-slate-800 whitespace-nowrap">{v.reviewed_by}</span> : <span className="text-slate-400 font-bold">{DASH}</span>}</td>
              <td className="p-3.5 align-middle">{v.approved_by ? <span className="font-semibold text-slate-800 whitespace-nowrap">{v.approved_by}</span> : <span className="text-slate-400 font-bold">{DASH}</span>}</td>
              <td className="p-3.5 align-middle">{dc.pending ? <span className="text-slate-500 font-medium">{dc.text}</span> : <><div className="font-semibold text-slate-800 whitespace-nowrap">{dc.text}</div>{dc.at && <div className="text-[10px] text-slate-400 whitespace-nowrap">{dc.at}</div>}</>}</td>
              <td className="p-3.5 align-middle text-[10px] font-bold"><button type="button" onClick={() => onOpenPdf?.(v.id)} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap">{tx('VER PDF', 'VIEW PDF')}</button></td>
              <td className="p-3.5 pr-4 align-middle text-[10px] font-black"><div className="flex items-center justify-end gap-1.5 flex-wrap min-w-[430px]">
                <button type="button" onClick={() => modify(v)} title={v.can_request_change ? undefined : tx('Ver por qué no se puede modificar', 'See why it cannot be modified')} className={`inline-flex items-center gap-1 px-2.5 py-1 text-white rounded-full uppercase tracking-tight shadow-2xs transition-colors cursor-pointer whitespace-nowrap ${v.can_request_change ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-300 hover:bg-amber-400'}`}><span>🔄</span>{tx('MODIFICAR DESDE REQ.', 'MODIFY FROM REQ.')}</button>
                {canValidateBuyer(v) && <button type="button" onClick={() => validate(v)} title={lockText || undefined} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full uppercase tracking-tight transition-colors cursor-pointer whitespace-nowrap"><Lock className="w-3 h-3" />{tx('VALIDAR COMPRADOR', 'VALIDATE BUYER')}</button>}
                <button type="button" onClick={() => askDelete(v)} className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full uppercase tracking-tight transition-colors cursor-pointer whitespace-nowrap">{tx('ELIMINAR', 'DELETE')}</button>
              </div></td>
            </tr>; })}
            {list.status === 'ready' && !rows.length && <tr><td colSpan={15} className="py-10 text-center text-xs text-slate-400 font-semibold">{q || status !== 'all' ? tx('Ninguna cotización coincide con los filtros.', 'No quote matches the filters.') : tx('Este cliente no tiene cotizaciones registradas.', 'This client has no recorded quotes.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center text-xs text-slate-600 mt-3"><span>{total} {tx('registros', 'records')} · {tx('Página', 'Page')} {page} / {last}</span>
        <div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
    </div>}

    {del && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDel(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sf-cqm-del" data-testid="cqm-delete" className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-rose-600 px-5 py-3"><h2 id="sf-cqm-del" className="text-white font-black text-sm">{tx('Eliminar cotización', 'Delete quote')} · {del.folio}</h2></div>
        <div className="p-5 space-y-3 text-xs text-slate-700">
          <p className="font-bold text-slate-900">{del.folio} · Rev. {del.revision} · {del.client_name} · {money(del.total_amount, del.currency, en)}</p>
          {delBlock ? <p className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{delBlock}</span></p> : <>
            <p className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">{tx('Solo un borrador sin emitir puede eliminarse (en el sistema original, con contraseña de administrador). En SupplyFlow es una escritura comercial bloqueada hasta su validación integral: no se borrará nada.', 'Only an unissued draft can be deleted (in the original system, with the administrator password). In SupplyFlow it is a commercial write blocked until fully validated: nothing will be deleted.')}</p>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold text-slate-700">{tx('Escribe exactamente el folio para confirmar', 'Type the exact folio to confirm')}</span>
              <span className="text-sm font-medium"><input aria-label={tx('Folio a confirmar', 'Folio to confirm')} value={typed} onChange={e => { setTyped(e.target.value); setDelErr(''); }} maxLength={64} autoComplete="off" placeholder={del.folio} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-500" /></span></label>
            {delErr && <p role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{delErr}</span></p>}
          </>}
          <div className="flex justify-end gap-2 text-xs font-bold">
            <button type="button" onClick={() => setDel(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200">{delBlock ? tx('Entendido', 'Got it') : tx('Cancelar', 'Cancel')}</button>
            {!delBlock && <button type="button" onClick={confirmDelete} disabled={!folioConfirmed(del, typed)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{tx('Sí, eliminar', 'Yes, delete')}</button>}
          </div>
        </div>
      </div>
    </div>}
  </div>;
}

export default CustomerQuoteMatrixCard;
