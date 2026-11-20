import React, { useEffect, useState } from 'react';
import { Lock, Loader2, AlertCircle, X, Printer } from 'lucide-react';
import { servicesMatrix, serviceDetail } from './api';
import { SERVICE_TYPES, STATUSES, PAGE_SIZES, mergeOptions, clientsChip, clientCards, buyerCards, serviceRow, servicesCsv, editForm, validateEdit, editLockedText, deleteBlock, deleteError, deleteLockedText, rangeText, serviceRequestHtml } from './serviceMatrix.mjs';
import { useLoad } from '../reception/useLoad.js';

// Servicios Operativos · sección 3 "Matriz de servicios" (diseño Grupo Gerez), conectada a MariaDB en modo lectura
// (service_orders). Paso 1 cliente, paso 2 comprador (validación interna de la requisición vinculada) y matriz paginada.
// Excel/CSV y Solicitud no escriben; Editar y Eliminar validan y no guardan.
const TONES = { green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-800 border-amber-200', red: 'bg-rose-50 text-rose-700 border-rose-200', gray: 'bg-slate-100 text-slate-600 border-slate-200', blue: 'bg-blue-50 text-blue-800 border-blue-200' };
const chip = c => <span className={`inline-block px-2.5 py-1 rounded-full text-[9.5px] font-black border whitespace-nowrap ${TONES[c.tone] || TONES.gray}`}>{c.text}</span>;

export function ServiceMatrix({ en = false, notify = () => {} }) {
  const tx = (es, e) => (en ? e : es);
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [service, setService] = useState(''); const [status, setStatus] = useState('');
  const [client, setClient] = useState(null); const [buyer, setBuyer] = useState('all');
  const [page, setPage] = useState(1); const [size, setSize] = useState(10);
  const [doc, setDoc] = useState(null); const [edit, setEdit] = useState(null); const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const filters = { service, status, q };
  const data = useLoad(s => servicesMatrix({ ...filters, client: client || 'all', buyer: client ? buyer : 'all', page, page_size: size }, s), [service, status, q, client, buyer, page, size]);
  const d = data.data;
  const last = Math.max(1, Math.ceil((d?.total || 0) / size));
  const clientName = (d?.summary?.clients || []).find(c => c.id === client)?.name || '';
  const reset = () => setPage(1);

  const exportCsv = async () => {
    setBusy(true); setMsg(null);
    try {
      const rows = []; let p = 1; let total = 0;
      do { const r = await servicesMatrix({ ...filters, client: client || 'all', buyer: client ? buyer : 'all', page: p, page_size: 50 }); rows.push(...r.items); total = r.total; p += 1; } while (rows.length < total && p <= 40);
      const blob = new Blob([servicesCsv(rows, en)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `servicios-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (rows.length < total) setMsg({ kind: 'info', text: tx(`Se exportaron ${rows.length} de ${total} servicios (límite de 2,000 por archivo).`, `${rows.length} of ${total} services were exported (2,000 per file limit).`) });
    } catch (e) { setMsg({ kind: 'error', text: e.message }); } finally { setBusy(false); }
  };
  const openDoc = async x => { setDoc({ x, status: 'loading' }); try { const r = await serviceDetail(x.id); setDoc(c => c && c.x.id === x.id ? { ...c, status: 'ready', data: r } : c); } catch (e) { setDoc(c => c && { ...c, status: 'error', error: e.message }); } };
  const printDoc = () => { if (!doc?.data) return; const w = window.open('', '_blank', 'width=900,height=1000'); if (!w) { notify(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; } w.document.write(serviceRequestHtml(doc.data, en)); w.document.close(); w.focus(); setTimeout(() => { w.print(); }, 250); };
  const ev = edit ? validateEdit(edit.f, edit.x, en) : null;
  const sel = (label, value, onChange, opts, all) => <select aria-label={label} value={value} onChange={e => { onChange(e.target.value); reset(); }} className="px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"><option value="">{all}</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>;
  const card = (c, on, onClick, testid) => <button key={c.id || c.key} type="button" aria-pressed={on} data-testid={testid} onClick={onClick} className={`relative overflow-hidden text-left rounded-2xl border p-4 pl-5 bg-white transition-all ${on ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-gradient-to-br from-white to-pink-50/40' : 'border-slate-200 hover:border-slate-300 shadow-xs'}`}>
    <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-purple-600 to-pink-500" />
    <div className="flex items-start gap-3 mb-3"><span className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0">{c.badge}</span><span className="min-w-0"><span className="block text-[11.5px] font-black text-slate-900 leading-tight">{c.name}</span><span className="block text-[9.5px] text-slate-500 mt-0.5 truncate">{c.sub}</span></span></div>
    <div className="grid grid-cols-3 gap-1.5 mb-3">{c.stats.map(([n, t]) => <span key={t} className="block min-w-0 bg-white border border-slate-200 rounded-xl px-2 py-1.5"><span className="block text-sm font-black text-slate-900">{n}</span><span className="block text-[8px] leading-tight font-black text-slate-600">{t}</span></span>)}</div>
    <span className="flex items-center justify-between text-[10px] font-black text-slate-700"><span>{c.foot}</span><span className="text-blue-700 text-sm">→</span></span>
  </button>;

  return <div className="space-y-5" data-testid="service-matrix">
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="min-w-0"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de servicios', 'Services matrix')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Consulta, filtra, edita y controla todos los servicios.', 'Review, filter, edit and control every service.')}</p></div>
        <span className="text-sm font-black shrink-0"><button type="button" disabled={busy || !d} onClick={exportCsv} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl shadow-md disabled:opacity-60">{busy ? '…' : '⬇'} Excel/CSV</button></span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input type="search" aria-label={tx('Buscar servicio', 'Search service')} value={input} maxLength={120} onChange={e => setInput(e.target.value)} placeholder={tx('Buscar folio, cliente, proyecto, referencia...', 'Search folio, client, project, reference...')} className="md:col-span-2 px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" />
        {sel(tx('Servicio', 'Service'), service, setService, mergeOptions(SERVICE_TYPES, d?.service_types || []), tx('Todos los servicios', 'All services'))}
        {sel(tx('Estatus', 'Status'), status, setStatus, mergeOptions(STATUSES, d?.statuses || []), tx('Todos los estatus', 'All statuses'))}
      </div>
      {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl border text-xs ${msg.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{msg.text}</p>}
    </div>

    <div className="rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4 bg-gradient-to-br from-white to-purple-50/30">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2"><div><h4 className="text-base font-black text-slate-900">{tx('Servicios por cliente → comprador', 'Services by client → buyer')}</h4><p className="text-[10.5px] text-slate-500">{tx('Paso 1: selecciona el cliente. Paso 2: selecciona el comprador vinculado a la requisición/validación. Después se muestra la matriz paginada.', 'Step 1: select the client. Step 2: select the buyer linked to the requisition/validation. Then the paginated matrix is shown.')}</p></div>{d && <span data-testid="service-clients-chip" className="text-[10.5px] font-black text-blue-900 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 shrink-0">{clientsChip(d.summary, en)}</span>}</div>
      {data.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {data.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{data.error.message}</p>}
      {d && !d.summary.clients.length && <div className="p-8 border border-dashed border-slate-300 rounded-2xl text-center text-sm text-slate-500">{tx('No hay servicios registrados con estos filtros.', 'No services recorded with these filters.')}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{d && clientCards(d.summary, en).map(c => card(c, client === c.id, () => { setClient(c.id); setBuyer('all'); reset(); }, 'service-client-card'))}</div>
      {client && <>
        <div data-testid="service-client-selected" className="rounded-2xl border border-slate-200 bg-white/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h4 className="text-xs font-black text-slate-900 uppercase">{clientName}</h4><p className="text-[10px] text-slate-500">{(d?.summary?.clients || []).find(c => c.id === client)?.services ?? 0} {tx('servicio(s) · ahora selecciona comprador', 'service(s) · now select the buyer')}</p></div>
          <span className="text-xs font-black"><button type="button" onClick={() => { setClient(null); setBuyer('all'); reset(); }} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl">← {tx('Volver a tarjetas', 'Back to cards')}</button></span></div>
        <div className="border-t border-dashed border-slate-300 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><p className="text-xs font-black text-slate-900 uppercase">{tx('Compradores de', 'Buyers of')} {clientName} <span className="normal-case text-[9.5px] font-semibold text-slate-500">{tx('Derivado de Gestión del Contratista / Validación interna de la requisición vinculada.', 'Derived from Contractor Management / internal validation of the linked requisition.')}</span></p><span data-testid="service-buyers-chip" className="text-[10.5px] font-black text-blue-900 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 shrink-0">{(d?.summary?.buyers || []).length} {tx('comprador(es)', 'buyer(s)')}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{d && buyerCards(d.summary, clientName, en).map(c => card(c, buyer === c.key, () => { setBuyer(c.key); reset(); }, 'service-buyer-card'))}</div>
        </div>
      </>}
    </div>

    {client && d && <div className="space-y-3">
      <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white"><table className="w-full text-left border-collapse text-[11px] min-w-[1900px]"><thead><tr className="bg-blue-50/60 border-b border-slate-200 text-slate-800 font-black uppercase tracking-wider text-[10px]">{[tx('Folio', 'Folio'), tx('Requisición', 'Requisition'), tx('Referencia interna', 'Internal reference'), tx('Servicio', 'Service'), tx('Cliente', 'Client'), tx('Proyecto', 'Project'), tx('Fecha', 'Date'), tx('Autorización cliente', 'Client authorization'), tx('OC proveedor', 'Supplier PO'), tx('Facturación', 'Billing'), tx('Estatus', 'Status'), tx('Cant.', 'Qty.'), tx('Costo', 'Cost'), tx('Venta', 'Sale'), tx('Margen', 'Margin'), tx('Responsable', 'Responsible'), tx('Evidencias', 'Evidence'), tx('Acciones', 'Actions')].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{d.items.map(x => { const v = serviceRow(x, en); return <tr key={x.id} data-testid="service-row" className="align-top hover:bg-slate-50/60">
          <td className="p-3 font-black text-slate-900 whitespace-nowrap">{v.folio}</td><td className="p-3">{v.requisition}</td><td className="p-3">{v.reference}</td><td className="p-3 min-w-[110px]">{v.service}</td><td className="p-3 min-w-[130px]">{v.client}</td><td className="p-3">{v.project}</td><td className="p-3 whitespace-nowrap">{v.date}</td>
          <td className="p-3 min-w-[150px]"><div className="font-black text-slate-900">{v.auth.text}</div>{v.auth.sub && <div className="text-[9.5px] text-slate-500">{v.auth.sub}</div>}</td>
          <td className="p-3">{chip(v.po)}{v.po.sub && <div className="text-[9px] text-slate-500 mt-1">{v.po.sub}</div>}</td>
          <td className="p-3">{chip(v.billing)}{v.billing.sub && <div className="text-[9px] text-slate-500 mt-1">{v.billing.sub}</div>}</td>
          <td className="p-3">{chip(v.status)}</td><td className="p-3 whitespace-nowrap">{v.qty}</td><td className="p-3 whitespace-nowrap">{v.cost}</td><td className="p-3 whitespace-nowrap">{v.price}</td>
          <td className={`p-3 whitespace-nowrap font-black ${v.margin.tone === 'red' ? 'text-rose-700' : 'text-emerald-700'}`}>{v.margin.text}</td><td className="p-3 min-w-[120px]">{v.responsible}</td><td className="p-3 text-center">{v.evidence}</td>
          <td className="p-3"><div className="flex flex-wrap gap-1.5 min-w-[150px] text-[11px] font-black">
            <button type="button" onClick={() => openDoc(x)} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs">📄 {tx('Solicitud', 'Request')}</button>
            <button type="button" onClick={() => { setMsg(null); setEdit({ x, f: editForm(x), tried: false, msg: null }); }} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs">✏️ {tx('Editar', 'Edit')}</button>
            <button type="button" aria-label={`${tx('Eliminar', 'Delete')} ${v.folio}`} onClick={() => setDel({ x, folio: '', reason: '', msg: null, block: deleteBlock(x, en) })} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm">🗑</button>
          </div></td>
        </tr>; })}{!d.items.length && <tr><td colSpan={18} className="p-12 text-center text-slate-400 font-medium">{tx('No hay servicios registrados en la matriz para este cliente.', 'No services recorded in the matrix for this client.')}</td></tr>}</tbody></table></div>
      <div data-testid="service-pager" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <span className="text-slate-600">{rangeText(d, en)}</span>
        <div className="flex flex-wrap items-center gap-2 font-black"><span>{tx('Mostrar', 'Show')}</span><select aria-label={tx('Registros por página', 'Records per page')} value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }} className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white">{PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}</select>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">← {tx('Anterior', 'Previous')}</button><span>{tx('Página', 'Page')} {page} / {last}</span><button type="button" disabled={page >= last} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">{tx('Siguiente', 'Next')} →</button></div>
      </div>
    </div>}
    <p className="text-[10px] text-slate-400 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" />{tx('Fuente: MariaDB (service_orders). El comprador proviene de la validación interna vigente de la requisición vinculada. Editar y eliminar servicios son escrituras operativas bloqueadas hasta su autorización.', 'Source: MariaDB (service_orders). The buyer comes from the current internal validation of the linked requisition. Editing and deleting services are operational writes blocked until authorized.')}</p>

    {doc && <div role="dialog" aria-modal="true" aria-label={tx('Solicitud de servicio', 'Service request')} className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-2 sm:p-6" onClick={() => setDoc(null)}>
      <div className="w-full max-w-5xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-slate-100" onClick={e => e.stopPropagation()}>
        <div className="bg-[#1e385c] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm sm:text-base font-black">{doc.x.folio} · {doc.x.service}</h3><p className="text-[11px] text-blue-100">{tx('Formato de solicitud del servicio', 'Service request format')}</p></div>
          <div className="flex gap-2 text-sm font-black"><button type="button" disabled={!doc.data} onClick={printDoc} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5"><Printer className="w-4 h-4" />{tx('Imprimir / PDF', 'Print / PDF')}</button><button type="button" onClick={() => setDoc(null)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5"><X className="w-4 h-4" />{tx('Cerrar', 'Close')}</button></div></div>
        <div className="p-2 sm:p-5 overflow-auto">{doc.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}{doc.error && <p role="alert" className="text-xs text-rose-700">{doc.error}</p>}
          {doc.data && <iframe title={tx('Solicitud de servicio', 'Service request')} srcDoc={serviceRequestHtml(doc.data, en)} sandbox="" className="w-full max-w-[860px] mx-auto block h-[74vh] bg-white shadow-md border border-slate-300" />}</div>
      </div>
    </div>}

    {edit && <div role="dialog" aria-modal="true" aria-label={tx('Editar servicio', 'Edit service')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900">✏️ {tx('Editar', 'Edit')} {edit.x.folio} · {edit.x.service}</h3><button type="button" aria-label={tx('Cerrar diálogo', 'Close dialog')} onClick={() => setEdit(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <p className="text-[11px] text-slate-500">{edit.x.client_name} · {edit.x.requisition || tx('Sin requisición', 'No requisition')} · {tx('Folio, cliente y requisición no se editan.', 'Folio, client and requisition are not edited.')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['status', tx('Estatus', 'Status'), 'select'], ['required_date', tx('Fecha requerida', 'Required date'), 'date'], ['quantity', `${tx('Cantidad', 'Quantity')} (${edit.x.unit_label})`, 'text'], ['authorization_reference', tx('Referencia de autorización', 'Authorization reference'), 'text'], ['cost', tx('Costo', 'Cost'), 'text'], ['price', tx('Venta', 'Sale'), 'text']].map(([k, label, type]) => <label key={k} className="block"><span className="block text-[11px] font-black mb-1">{label}</span>
          {type === 'select' ? <select aria-label={label} value={edit.f[k]} onChange={e => { const t = e.target.value; setEdit(s => ({ ...s, msg: null, f: { ...s.f, [k]: t } })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm">{mergeOptions(STATUSES, [edit.x.status, ...(d?.statuses || [])]).map(o => <option key={o} value={o}>{o}</option>)}</select>
            : <input type={type} inputMode={['quantity', 'cost', 'price'].includes(k) ? 'decimal' : undefined} aria-label={label} value={edit.f[k]} onChange={e => { const t = e.target.value; setEdit(s => ({ ...s, msg: null, f: { ...s.f, [k]: t } })); }} className={`w-full px-3 py-2.5 border rounded-xl text-sm ${edit.tried && ev.errors[k] ? 'border-rose-400' : 'border-slate-300'}`} />}
          {edit.tried && ev.errors[k] && <span role="alert" className="block text-[10px] text-rose-600 font-semibold mt-1">{ev.errors[k]}</span>}</label>)}</div>
        {edit.tried && ev.ok && ev.warnings.map(w => <p key={w} className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">⚠ {w}</p>)}
        {edit.msg && <p data-testid="service-edit-msg" role={edit.msg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${edit.msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{edit.msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{edit.msg.text}</span></p>}
        <div className="flex justify-end gap-2 text-xs font-black"><button type="button" onClick={() => setEdit(null)} className="px-4 py-2 border border-slate-200 rounded-xl">{tx('Cancelar', 'Cancel')}</button><button type="button" onClick={() => setEdit(s => { const r = validateEdit(s.f, s.x, en); if (r.ok) notify(tx('Servicio no actualizado', 'Service not updated'), editLockedText(s.x, r.changed, en), 'warning'); return { ...s, tried: true, msg: r.ok ? { kind: 'locked', text: editLockedText(s.x, r.changed, en) } : { kind: 'error', text: r.first } }; })} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl">{tx('Guardar cambios', 'Save changes')}</button></div>
      </div>
    </div>}

    {del && <div role="dialog" aria-modal="true" aria-label={tx('Eliminar servicio', 'Delete service')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setDel(null)}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-rose-700">{tx('Eliminar', 'Delete')} {del.x.folio}</h3><button type="button" aria-label={tx('Cerrar diálogo', 'Close dialog')} onClick={() => setDel(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-slate-600">{del.x.service} · {del.x.client_name} · {del.x.status}</p>
        {del.block ? <p role="alert" data-testid="service-delete-block" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{del.block}</p> : <>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx(`Escribe el folio (${del.x.folio}) para confirmar`, `Type the folio (${del.x.folio}) to confirm`)}</span><input type="text" aria-label={tx('Folio a eliminar', 'Folio to delete')} value={del.folio} onChange={e => { const t = e.target.value; setDel(s => ({ ...s, folio: t, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx('Motivo', 'Reason')} *</span><textarea rows={3} aria-label={tx('Motivo de la eliminación', 'Deletion reason')} value={del.reason} maxLength={600} onChange={e => { const t = e.target.value; setDel(s => ({ ...s, reason: t, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
        </>}
        {del.msg && <p data-testid="service-delete-msg" role={del.msg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${del.msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{del.msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{del.msg.text}</span></p>}
        <div className="flex justify-end gap-2 text-xs font-black"><button type="button" onClick={() => setDel(null)} className="px-4 py-2 border border-slate-200 rounded-xl">{tx('Cancelar', 'Cancel')}</button>{!del.block && <button type="button" onClick={() => setDel(s => { const err = deleteError(s.x, s.folio, s.reason, en); return { ...s, msg: err ? { kind: 'error', text: err } : { kind: 'locked', text: deleteLockedText(s.x, en) } }; })} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl">{tx('Eliminar', 'Delete')}</button>}</div>
      </div>
    </div>}
  </div>;
}

export default ServiceMatrix;
