import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, Printer, Eye, X } from 'lucide-react';
import { listPurchaseOrders, poIssuance, poTasks, poDetail } from './api';
import { money, opLabel, statusTone, progressOf, buyerCards, poPrintHtml } from './model.mjs';
import { issuanceOptions, winningSuppliers, supplierTotal, toGenerate, validateIssuance, issuanceLockedText } from './poIssuance.mjs';

// Órdenes de Compra · diseño Grupo Gerez (6 tarjetas) conectado a MariaDB en modo consulta.
// GET /api/v1/purchase-orders[/issuance|/tasks|/{id}] (Master Admin). Emitir, autorizar, modificar y eliminar OC siguen
// bloqueados: son escrituras comerciales que requieren validación integral (regla del proyecto).
const DASH = '—';
const PAGE = 25;
const show = v => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));
const ymd = v => (v ? String(v).slice(0, 10) : DASH);

export function PurchaseOrdersModule({ lang = 'es', language, isEnglish, onNotify }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const notify = (t, m, k = 'info') => { if (typeof onNotify === 'function') onNotify(t, m, k); };
  const LOCK = tx('Modo consulta MariaDB: emitir, autorizar, modificar y eliminar órdenes de compra son escrituras comerciales que permanecen bloqueadas hasta su validación integral.', 'MariaDB read mode: issuing, authorizing, amending and deleting purchase orders are commercial writes that remain blocked until fully validated.');
  const cards = [
    [1, '🛒', tx('Emisión de orden de compra', 'Purchase Order Issuance'), tx('Adjudicaciones listas para OC y OC ya generadas.', 'Awards ready for PO and POs already generated.')],
    [2, '📋', tx('Matriz de órdenes', 'Orders Matrix'), tx('Consulta, imprime y da seguimiento a las OC.', 'View, print and track POs.')],
    [3, '✅', tx('Control de autorización', 'Authorization Control'), tx('Cotizaciones seleccionadas y órdenes pendientes.', 'Selected quotes and pending orders.')],
    [4, '🔁', tx('Modificaciones / Enmiendas', 'Modifications / Amendments'), tx('Rev. N de OC, historial y conciliaciones.', 'PO Rev. N, history and reconciliations.')],
    [5, '🔔', tx('Revisión y autorización', 'Review & Authorization'), tx('Mis tareas y solicitudes de modificación.', 'My tasks and modification requests.')],
    [6, '📰', tx('Formato de Orden de Compra', 'Purchase Order Format'), tx('Vista formal con partidas, montos y firmas.', 'Formal view with line items, amounts and signatures.')],
  ];
  const [tab, setTab] = useState(2);
  const [revision, setRevision] = useState(0);

  // Matriz (servidor)
  const [buyer, setBuyer] = useState('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ status: 'loading', error: null, data: null });
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = new AbortController();
    setList(x => ({ ...x, status: 'loading', error: null }));
    listPurchaseOrders({ page, pageSize: PAGE, q, status, buyer, sort }, c.signal)
      .then(d => { if (!c.signal.aborted) setList({ status: 'ready', error: null, data: d }); })
      .catch(e => { if (!c.signal.aborted) setList(x => ({ ...x, status: 'error', error: e })); });
    return () => c.abort();
  }, [page, q, status, buyer, sort, revision]);
  const d = list.data; const sum = d?.summary; const ctr = sum?.counters || {};
  const bc = useMemo(() => buyerCards(sum), [sum]);
  const lastPage = Math.max(1, Math.ceil((d?.total || 0) / PAGE));

  // Emisión, tareas y enmiendas (bajo demanda)
  const [iss, setIss] = useState({ status: 'idle', data: null, error: null });
  const [tasks, setTasks] = useState({ status: 'idle', data: null, error: null });
  const [fam, setFam] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    const c = new AbortController();
    if (tab === 1 || tab === 3) { setIss(x => ({ ...x, status: 'loading' })); poIssuance(c.signal).then(v => !c.signal.aborted && setIss({ status: 'ready', data: v, error: null })).catch(e => !c.signal.aborted && setIss({ status: 'error', data: null, error: e })); }
    if (tab === 5) { setTasks(x => ({ ...x, status: 'loading' })); poTasks(c.signal).then(v => !c.signal.aborted && setTasks({ status: 'ready', data: v, error: null })).catch(e => !c.signal.aborted && setTasks({ status: 'error', data: null, error: e })); }
    if (tab === 4) { setFam(x => ({ ...x, status: 'loading' })); listPurchaseOrders({ pageSize: 50, scope: 'all', sort: 'recent' }, c.signal).then(v => !c.signal.aborted && setFam({ status: 'ready', data: v, error: null })).catch(e => !c.signal.aborted && setFam({ status: 'error', data: null, error: e })); }
    return () => c.abort();
  }, [tab, revision]);
  // 1 · Emisión: requisición aprobada → proveedores ganadores (1 OC por proveedor). Crear OC valida y no escribe.
  const [issReq, setIssReq] = useState(''); const [issMsg, setIssMsg] = useState(null);
  const io = useMemo(() => issuanceOptions(iss.data || {}, en), [iss.data, en]);
  const issOpt = io.options.find(o => o.id === issReq && o.ready) || null;
  const winners = useMemo(() => winningSuppliers(iss.data || {}, issOpt ? issReq : ''), [iss.data, issReq, issOpt]);
  const createPOs = () => {
    const v = validateIssuance(issOpt, winners, en);
    if (!v.ok) { setIssMsg({ kind: 'error', items: v.errors, warnings: v.warnings }); return; }
    const text = issuanceLockedText(issOpt, v.orders, en);
    setIssMsg({ kind: 'locked', items: [text], warnings: v.warnings }); notify(tx('Emisión no habilitada', 'Issuance not enabled'), text, 'warning');
  };
  const families = useMemo(() => {
    const m = new Map();
    for (const po of fam.data?.items || []) { const f = m.get(po.series_id) || { id: po.series_id, folio: po.folio, versions: [] }; f.versions.push(po); m.set(po.series_id, f); }
    return [...m.values()].map(f => ({ ...f, versions: f.versions.sort((a, b) => a.version_number - b.version_number) })).sort((a, b) => b.versions.length - a.versions.length || String(a.folio).localeCompare(String(b.folio)));
  }, [fam.data]);
  const [openFamily, setOpenFamily] = useState('');

  // Detalle / formato
  const [detailId, setDetailId] = useState('');
  const [det, setDet] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!detailId) { setDet({ status: 'idle', data: null, error: null }); return undefined; }
    const c = new AbortController();
    setDet({ status: 'loading', data: null, error: null });
    poDetail(detailId, c.signal).then(v => !c.signal.aborted && setDet({ status: 'ready', data: v, error: null })).catch(e => !c.signal.aborted && setDet({ status: 'error', data: null, error: e }));
    return () => c.abort();
  }, [detailId, revision]);
  const openFormat = id => { setDetailId(id); setTab(6); };
  const print = () => {
    if (!det.data) return;
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { notify(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; }
    w.document.write(poPrintHtml(det.data, en)); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250);
  };

  const Err = ({ e }) => (e ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{e.message}</p> : null);
  const Loading = ({ on }) => (on ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p> : null);
  const pill = code => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${statusTone(code)}`}>{opLabel(code, en)}</span>;
  const lockBtn = (label, cls = '') => <button type="button" disabled title={LOCK} className={`px-2.5 py-1 bg-slate-200 text-slate-400 text-[10px] font-black rounded-lg uppercase cursor-not-allowed flex items-center justify-center gap-1 ${cls}`}><Lock className="w-3 h-3" />{label}</button>;
  const box = 'bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5';

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{tx('Órdenes de Compra', 'Purchase Orders')}</h2><p className="text-xs text-slate-500">{tx('Administración de órdenes de compra, seguimiento de pedidos y proveedores.', 'Purchase orders administration, tracking and vendors.')}</p></div>
      <div className="flex items-center gap-2"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span><button type="button" onClick={() => setRevision(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {cards.map(([id, icon, title, desc]) => { const on = tab === id; return <button key={id} type="button" aria-pressed={on} onClick={() => setTab(id)} className={`p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[130px] border ${on ? 'bg-gradient-to-r from-[#2563eb] via-[#7c3aed] to-[#c026d3] text-white border-transparent shadow-lg shadow-purple-500/20 scale-[1.01]' : 'bg-white text-slate-800 border-slate-200/90 hover:border-[#60a5fa] hover:ring-1 hover:ring-[#60a5fa] hover:shadow-lg hover:shadow-blue-500/15'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base mb-3 ${on ? 'bg-white/20 text-white backdrop-blur-md' : 'bg-[#eef2ff] text-blue-600 border border-blue-100/50'}`}><span>{icon}</span></div>
        <div><h3 className={`text-xs font-bold leading-snug ${on ? 'text-white' : 'text-slate-900'}`}>{title}</h3><p className={`text-[11px] mt-1 leading-normal ${on ? 'text-white/80' : 'text-slate-400'}`}>{desc}</p></div>
      </button>; })}
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    {/* 1 · EMISIÓN (consulta) */}
    {tab === 1 && <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5" data-testid="po-issuance">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="min-w-0 flex-1"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Orden de compra', 'Purchase order')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Las nuevas OC se generan desde la adjudicación definitiva: una Orden de Compra por cada proveedor ganador, únicamente después de la aprobación del cliente.', 'New POs are generated from the definitive award: one Purchase Order per winning vendor, only after the client’s approval.')}</p></div>
        <span className="text-[10.5px] font-black text-amber-800 bg-amber-100/80 border border-amber-200 rounded-full px-3 py-1 shrink-0">{tx('Paso 5 · Orden de compra', 'Step 5 · Purchase order')}</span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/30 p-4 sm:p-5 space-y-5">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-4 border-b border-slate-200/70">
          <div className="min-w-0 flex-1"><h4 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2"><span aria-hidden="true">🛒</span>{tx('Órdenes de Compra por proveedor adjudicado', 'Purchase Orders by awarded vendor')}</h4><p className="text-[11px] text-slate-500 mt-0.5">{tx('SupplyFlow muestra únicamente requisiciones con Cotización al Cliente APROBADA y únicamente proveedores con adjudicación definitiva. Las cotizaciones perdedoras no aparecen aquí.', 'SupplyFlow only shows requisitions with an APPROVED client quote and only vendors with a definitive award. Losing quotes do not appear here.')}</p></div>
          <span className="text-[10.5px] font-black text-purple-800 bg-purple-100/80 border border-purple-200 rounded-full px-3 py-1 shrink-0">{tx('1 requisición → 1 OC por proveedor', '1 requisition → 1 PO per vendor')}</span>
        </div>
        <Loading on={iss.status === 'loading'} /><Err e={iss.error} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block"><span className="block text-[11px] font-black text-slate-900 mb-1.5">{tx('Requisición aprobada por el cliente', 'Requisition approved by the client')} *</span>
            <select aria-label={tx('Requisición aprobada por el cliente', 'Requisition approved by the client')} value={issReq} onChange={e => { setIssReq(e.target.value); setIssMsg(null); }} className="w-full px-3.5 py-3 bg-white border border-blue-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">{tx('Seleccionar requisición...', 'Select requisition...')}</option>
              {io.options.map(o => <option key={o.id} value={o.id} disabled={!o.ready}>{o.label}</option>)}
            </select>
            <span className="block text-[11px] text-slate-600 mt-1.5">{tx('La requisición debe tener aprobación del cliente y adjudicación definitiva por partida.', 'The requisition must have the client’s approval and a definitive award per item.')}</span></label>
          <label className="block"><span className="block text-[11px] font-black text-slate-900 mb-1.5">{tx('Regla de emisión', 'Issuance rule')}</span>
            <input type="text" readOnly aria-label={tx('Regla de emisión', 'Issuance rule')} value={tx('Agrupar todas las partidas ganadas del mismo proveedor en una sola OC', 'Group all items won by the same vendor into a single PO')} className="w-full px-3.5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-default" />
            <span className="block text-[11px] text-slate-600 mt-1.5">{tx('No se seleccionan cotizaciones individuales. Se utiliza el proveedor ganador de cada partida.', 'Individual quotes are not selected. The winning vendor of each item is used.')}</span></label>
        </div>
        {io.waiting.length > 0 && <p data-testid="po-iss-waiting" className="text-[11px] text-slate-500">{tx(`${io.waiting.length} requisición(es) con adjudicación esperan la aprobación del cliente y no se muestran: ${io.waiting.map(r => r.folio).join(', ')}.`, `${io.waiting.length} requisition(s) with an award are awaiting the client’s approval and are not shown: ${io.waiting.map(r => r.folio).join(', ')}.`)}</p>}
        {iss.status === 'ready' && !io.options.some(o => o.ready) && <p className="text-[11px] text-amber-800">{tx('No hay requisiciones aprobadas por el cliente con adjudicación definitiva.', 'There are no client-approved requisitions with a definitive award.')}</p>}

        {!issOpt ? <div data-testid="po-iss-empty" className="max-w-sm p-6 border border-dashed border-slate-300 rounded-2xl bg-white text-center text-sm text-slate-600 leading-relaxed">{tx(`Selecciona una requisición aprobada. Aquí no se muestran las ${io.quotesReceived} cotizaciones recibidas: solo aparecerán los proveedores ganadores de la adjudicación definitiva.`, `Select an approved requisition. The ${io.quotesReceived} quotes received are not shown here: only the winning vendors of the definitive award will appear.`)}</div>
          : <div className="space-y-4">
            <div data-testid="po-iss-context" className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3.5 rounded-xl bg-emerald-50/70 border-l-4 border-emerald-500 text-xs text-emerald-900">
              <span className="font-black">{issOpt.req.folio}</span><span>{issOpt.req.client_name}</span>{issOpt.req.project && <span>{tx('Proyecto', 'Project')}: {issOpt.req.project}</span>}
              <span>{tx('Cotización al cliente aprobada', 'Approved client quote')}: <strong>{issOpt.req.customer_quote}</strong></span>
              <span>{tx(`${issOpt.req.quotes_received} cotización(es) recibida(s) · ${winners.length} proveedor(es) ganador(es)`, `${issOpt.req.quotes_received} quote(s) received · ${winners.length} winning vendor(s)`)}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{winners.map(sp => <div key={sp.id} data-testid="po-iss-supplier" data-supplier={sp.name} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{tx('Proveedor ganador', 'Winning vendor')}</div><div className="text-sm font-black text-slate-900 truncate" title={sp.name}>{sp.name}</div></div>
                {sp.generated ? <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">✓ {tx('OC generada', 'PO generated')}: {sp.po}</span> : <span className="text-[10.5px] font-black text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">{tx('OC por generar', 'PO to generate')}</span>}</div>
              <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-[11px] min-w-[420px]"><thead><tr className="bg-slate-50 text-[9.5px] font-extrabold text-slate-500 uppercase">{['#', tx('Descripción', 'Description'), tx('Cant.', 'Qty'), tx('P. unitario', 'Unit price'), tx('Importe', 'Amount')].map(h => <th key={h} className="py-2 px-2.5">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">{sp.lines.map(l => <tr key={`${l.line_number}-${l.quote_folio}`}><td className="py-2 px-2.5">{l.line_number}</td><td className="py-2 px-2.5">{l.description}</td><td className="py-2 px-2.5 whitespace-nowrap">{Number(l.quantity)} {l.unit_label}</td><td className="py-2 px-2.5 whitespace-nowrap">{money(l.unit_price, l.currency, en)}</td><td className="py-2 px-2.5 whitespace-nowrap font-bold">{money(l.subtotal, l.currency, en)}</td></tr>)}</tbody></table></div>
              <div className="flex flex-wrap justify-between gap-2 text-[11px]"><span className="text-slate-500">{tx('Cotización ganadora', 'Winning quote')}: {sp.quotes.join(', ') || DASH} · {sp.lines.length} {tx('partida(s)', 'item(s)')}</span><span className="font-black text-slate-900">Total: {supplierTotal(sp, en) || DASH}</span></div>
            </div>)}</div>
          </div>}

        {issMsg && <div data-testid="po-iss-msg" role={issMsg.kind === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl border text-xs space-y-1 ${issMsg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{issMsg.items.map(t => <p key={t} className="flex items-start gap-2">{issMsg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{t}</span></p>)}{issMsg.warnings.map(w => <p key={w} className="text-amber-800">⚠ {w}</p>)}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/70">
          <span data-testid="po-iss-count" className="text-xs text-slate-700"><strong className="font-black">{issOpt ? toGenerate(winners) : 0}</strong> {tx('OC por generar', 'POs to generate')}</span>
          <span className="text-sm font-black"><button type="button" onClick={createPOs} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">🛒</span>{tx('Crear una OC por cada proveedor', 'Create one PO per vendor')}</button></span>
        </div>
      </div>
    </div>}

    {/* 2 · MATRIZ */}
    {tab === 2 && <div className={box}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Matriz de órdenes de compra', 'Purchase orders matrix')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Monto, compromiso, estatus y avance de recepción; el formato de cada OC se genera aquí.', 'Amount, commitment, status and receipt progress; each PO format is generated here.')}</p></div>{lockBtn(tx('Nueva orden', 'New order'), 'px-4 py-2 text-xs normal-case')}</div>
      <div><h4 className="text-xs font-black text-slate-800">{tx('Órdenes de compra por comprador', 'Purchase orders by buyer')}</h4><p className="text-[10px] text-slate-400">{tx('Selecciona un comprador para consultar únicamente sus órdenes.', 'Select a buyer to view only their orders.')}</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[{ id: 'all', name: tx('Todas las órdenes de compra', 'All purchase orders'), sub: tx(`${bc.items.length} comprador(es)`, `${bc.items.length} buyer(s)`), count: ctr.total || 0, received: ctr.received || 0 }, ...bc.items.map(b => ({ ...b, sub: b.email })), ...(bc.none.count ? [{ id: 'none', name: tx('Sin comprador asignado', 'No buyer assigned'), sub: '', count: bc.none.count, received: null }] : [])].map(c => { const on = buyer === c.id; return <button key={c.id} type="button" aria-pressed={on} onClick={() => { setBuyer(c.id); setPage(1); }} className={`text-left bg-white rounded-2xl p-3 border relative overflow-hidden ${on ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 via-rose-500 to-purple-600" /><div className="pl-1.5"><div className="text-[11px] font-bold text-slate-900 truncate" title={c.name}>{c.name}</div><div className="text-[10px] text-slate-500 truncate">{c.sub || ' '}</div>
            <div className="grid grid-cols-3 gap-1 my-2">{[[c.count, 'OC'], [c.received === null ? DASH : c.count - c.received, tx('Pendientes', 'Pending')], [c.received === null ? DASH : c.received, tx('Recibidas', 'Received')]].map(([n, l]) => <div key={l} className="bg-slate-50 border border-slate-100 rounded-xl p-1.5 text-center"><span className="text-xs font-bold text-slate-900 block">{n}</span><span className="text-[9px] text-slate-500">{l}</span></div>)}</div></div></button>; })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar órdenes', 'Search orders')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar OC, requisición, referencia, proveedor o responsable...', 'Search PO, requisition, reference, vendor or responsible...')} className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <select aria-label={tx('Estatus', 'Status')} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="md:col-span-3 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"><option value="all">{tx('Todos los estatus', 'All statuses')}</option>{(sum?.statuses || []).map(s => <option key={s.code} value={s.code}>{opLabel(s.code, en)} ({s.count})</option>)}</select>
        <select aria-label={tx('Orden', 'Sort')} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="md:col-span-3 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"><option value="recent">{tx('Más recientes primero', 'Most recent first')}</option><option value="oldest">{tx('Más antiguas primero', 'Oldest first')}</option><option value="amount">{tx('Mayor monto primero', 'Highest amount first')}</option></select>
      </div>
      <Loading on={list.status === 'loading'} /><Err e={list.error} />
      <div className="flex justify-between text-[11px] text-slate-500"><span>{d?.total ?? 0} {tx('órdenes (versión vigente)', 'orders (current version)')}</span><span>{(sum?.money || []).map(m => `${money(m.amount, m.currency, en)} · ${m.orders} OC`).join('  |  ') || DASH}</span></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80"><table className="w-full text-left border-collapse min-w-[1250px]">
        <thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">{[tx('OC', 'PO'), tx('Requisición', 'Requisition'), tx('Referencia interna', 'Internal ref.'), tx('Proveedor', 'Vendor'), tx('Comprador', 'Buyer'), tx('Preparó / Revisó', 'Prepared'), tx('Autorizó', 'Authorized'), tx('Monto', 'Amount'), tx('Emisión', 'Issued'), tx('Estatus', 'Status'), tx('Avance', 'Progress'), tx('Flujo de aprobación', 'Approval flow')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}<th className="py-3 px-3 text-center sticky right-0 bg-slate-50 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">{tx('Acciones', 'Actions')}</th></tr></thead>
        <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
          {(d?.items || []).map(po => { const pr = progressOf(po); return <tr key={po.id} className="align-top hover:bg-slate-50/70">
            <td className="py-3 px-3 whitespace-nowrap"><div className="font-black text-slate-900">{po.folio}</div>{po.version_number > 1 && <div className="text-[10px] text-purple-700 font-bold">Rev. {po.version_number}</div>}{po.auto_generated && <div className="text-[10px] text-slate-400">{tx('Generada automáticamente', 'Auto-generated')}</div>}</td>
            <td className="py-3 px-3 min-w-[140px]"><div>{show(po.requisitions)}</div><div className="text-[10px] text-slate-400">{show(po.clients)}</div></td>
            <td className="py-3 px-3">{show(po.internal_reference)}</td>
            <td className="py-3 px-3 min-w-[160px]"><div className="font-semibold text-slate-800">{po.supplier_name}</div><div className="text-[10px] text-slate-400">{po.supplier_code}</div></td>
            <td className="py-3 px-3">{show(po.buyer_name)}</td><td className="py-3 px-3">{show(po.preparer_name)}</td><td className="py-3 px-3">{show(po.authorizer_name)}</td>
            <td className="py-3 px-3 font-bold whitespace-nowrap">{money(po.total_amount, po.currency, en)}</td>
            <td className="py-3 px-3 whitespace-nowrap">{ymd(po.order_date)}{po.commitment_date && <div className="text-[10px] text-slate-400">{tx('Compromiso', 'Commit')}: {ymd(po.commitment_date)}</div>}</td>
            <td className="py-3 px-3">{pill(po.operational_status)}{po.legacy_status && <div className="text-[10px] text-slate-500 mt-0.5">{po.legacy_status}</div>}</td>
            <td className="py-3 px-3 min-w-[90px]">{pr.pct === null ? <span className="text-[10px] text-slate-500">{po.receipt_count} {tx('recepción(es)', 'receipt(s)')}</span> : <><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pr.pct}%` }} /></div><div className="text-[10px] text-slate-500 mt-0.5">{Math.round(pr.pct)}% {tx('recibido', 'received')}</div></>}</td>
            <td className="py-3 px-3"><div>{opLabel(po.approval_status, en)}</div>{po.responsible_name && <div className="text-[10px] text-slate-400">{tx('Responsable', 'Owner')}: {po.responsible_name}</div>}</td>
            <td className="py-3 px-3 sticky right-0 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"><div className="flex flex-col gap-1 min-w-[110px]">
              <button type="button" onClick={() => openFormat(po.id)} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 text-[10px] font-black rounded-lg uppercase flex items-center justify-center gap-1"><Eye className="w-3 h-3" />{tx('Ver PDF', 'View PDF')}</button>
              {lockBtn(tx('Solicitar modificación', 'Request change'))}{lockBtn(tx('Eliminar OC', 'Delete PO'))}</div></td>
          </tr>; })}
          {list.status === 'ready' && !d?.items?.length && <tr><td colSpan={13} className="py-12 text-center text-xs text-slate-400 font-semibold">{tx('No hay órdenes de compra para el filtro.', 'No purchase orders for the filter.')}</td></tr>}
        </tbody></table></div>
      <div className="flex justify-between items-center text-xs text-slate-600"><span>{tx('Página', 'Page')} {page} / {lastPage}</span><div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= lastPage} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
    </div>}

    {/* 3 · CONTROL DE AUTORIZACIÓN */}
    {tab === 3 && <div className={box}>
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Control de autorización', 'Authorization control')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Revisiones previas y alertas para la emisión de órdenes.', 'Prior reviews and alerts for issuing orders.')}</p></div><button type="button" onClick={() => setTab(2)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl">{tx('Ver órdenes', 'View orders')}</button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[[ctr.preselected_quotes, tx('cotizaciones preseleccionadas o adjudicadas.', 'preselected or awarded quotes.'), 'border-l-blue-600 bg-blue-50/40'], [ctr.awards_without_po, tx('adjudicaciones pendientes de OC.', 'awards pending PO.'), 'border-l-amber-500 bg-amber-50/40'], [ctr.auto_generated, tx('órdenes generadas automáticamente.', 'auto-generated orders.'), 'border-l-emerald-500 bg-emerald-50/40'], [ctr.overdue_without_receipt, tx('órdenes vencidas sin recepción.', 'overdue orders without receipt.'), 'border-l-rose-500 bg-rose-50/40']].map(([n, l, cls]) =>
          <div key={l} className={`p-4 rounded-xl border border-slate-100 border-l-4 ${cls}`}><span className="text-2xl font-black text-slate-900 tabular-nums">{d ? n ?? 0 : '…'}</span><p className="text-xs text-slate-600 font-medium mt-1">{l}</p></div>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">{[[ctr.without_buyer, tx('OC sin comprador asignado', 'POs without buyer')], [ctr.reconciliation_pending, tx('OC con conciliación pendiente', 'POs pending reconciliation')], [ctr.change_pending, tx('OC con cambio pendiente', 'POs with pending change')]].map(([n, l]) => <div key={l} className="p-3 rounded-xl border border-slate-200 flex justify-between"><span className="text-slate-600 font-medium">{l}</span><strong className="tabular-nums">{d ? n ?? 0 : '…'}</strong></div>)}</div>
      <p className="text-[11px] text-slate-400">{tx('Conteos sobre la versión vigente de cada OC (las canceladas y sustituidas no cuentan como vencidas).', 'Counts over the current version of each PO (cancelled and superseded are not counted as overdue).')}</p>
    </div>}

    {/* 4 · ENMIENDAS */}
    {tab === 4 && <div className={box}>
      <div className="pb-3 border-b border-slate-100"><h3 className="text-base font-extrabold text-slate-900">{tx('Modificaciones / Enmiendas de Orden de Compra', 'Purchase Order modifications / amendments')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Cada Rev. N conserva la OC anterior; incluye cambios, cancelaciones y conciliación con recepción y factura.', 'Each Rev. N keeps the previous PO; includes changes, cancellations and reconciliation with receipt and invoice.')}</p></div>
      <Loading on={fam.status === 'loading'} /><Err e={fam.error} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[[families.length, tx('Familias de OC', 'PO families')], [families.filter(f => f.versions.length > 1).length, tx('Con revisión / enmienda', 'With revision / amendment')], [ctr.change_pending ?? 0, tx('Cambios pendientes', 'Pending changes')], [ctr.reconciliation_pending ?? 0, tx('Conciliación requerida', 'Reconciliation required')]].map(([n, l]) => <div key={l} className="p-4 rounded-xl border border-slate-200 bg-white"><div className="text-2xl font-black text-slate-900 tabular-nums">{n}</div><div className="text-[11px] text-slate-500 font-bold">{l}</div></div>)}</div>
      {(fam.data?.total || 0) > 50 && <p className="text-[11px] text-amber-700">{tx('Se muestran las 50 versiones más recientes.', 'Showing the 50 most recent versions.')}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">{families.map(f => { const last = f.versions[f.versions.length - 1]; const on = openFamily === f.id; return <div key={f.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2"><div className="flex justify-between gap-2"><span className="text-sm font-black text-slate-900">{f.folio}</span><span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">Rev. {last.version_number}</span></div><div className="text-[11px] text-slate-500">{last.supplier_name}</div><div className="text-xs font-bold">{money(last.total_amount, last.currency, en)}</div>
        <div className="flex gap-1.5"><button type="button" onClick={() => setOpenFamily(on ? '' : f.id)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg uppercase">{on ? tx('Ocultar', 'Hide') : tx('Historial', 'History')}</button>{lockBtn(tx('Modificar OC', 'Modify PO'))}</div>
        {on && <ul className="space-y-1 pt-2 border-t border-slate-100">{f.versions.map(v => <li key={v.id} className="text-[10px] text-slate-600 flex justify-between gap-2"><span>Rev. {v.version_number} · {ymd(v.order_date)}</span><span className="font-bold">{money(v.total_amount, v.currency, en)}</span><button type="button" onClick={() => openFormat(v.id)} className="text-blue-700 font-bold">{tx('Ver', 'View')}</button></li>)}</ul>}</div>; })}</div>
      {fam.status === 'ready' && !families.length && <p className="text-xs text-slate-400 text-center py-8">{tx('No hay órdenes de compra registradas.', 'No purchase orders recorded.')}</p>}
    </div>}

    {/* 5 · REVISIÓN Y AUTORIZACIÓN (mis tareas) */}
    {tab === 5 && <div className={box}>
      <div className="pb-3 border-b border-slate-100"><h3 className="text-base font-extrabold text-slate-900">{tx('Revisión y autorización', 'Review & authorization')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Órdenes en las que eres el responsable actual y solicitudes de modificación asignadas a ti.', 'Orders where you are the current owner and modification requests assigned to you.')}</p></div>
      <Loading on={tasks.status === 'loading'} /><Err e={tasks.error} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2"><h4 className="text-xs font-black text-slate-800">{tx('Mis órdenes por atender', 'My orders to handle')} · {tasks.data?.responsible?.length ?? 0}</h4>{(tasks.data?.responsible || []).map(po => <div key={po.id} className="p-3 rounded-xl border border-slate-200 flex justify-between gap-2 text-xs"><div><div className="font-black">{po.folio}{po.version_number > 1 ? ` · Rev. ${po.version_number}` : ''}</div><div className="text-[10px] text-slate-500">{po.supplier_name} · {opLabel(po.approval_status, en)}</div></div><div className="flex flex-col items-end gap-1"><strong>{money(po.total_amount, po.currency, en)}</strong><button type="button" onClick={() => openFormat(po.id)} className="text-[10px] text-blue-700 font-bold">{tx('Ver formato', 'View format')}</button></div></div>)}{tasks.status === 'ready' && !tasks.data?.responsible?.length && <p className="text-[11px] text-slate-400">{tx('Sin órdenes asignadas.', 'No orders assigned.')}</p>}</div>
        <div className="space-y-2"><h4 className="text-xs font-black text-slate-800">{tx('Solicitudes de modificación asignadas', 'Assigned modification requests')} · {tasks.data?.modification_requests?.length ?? 0}</h4>{(tasks.data?.modification_requests || []).map(m => <div key={m.folio} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1"><div className="flex justify-between"><strong>{m.folio}</strong><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusTone(m.status)}`}>{opLabel(m.status, en)}</span></div><div className="text-[11px] text-slate-600">{m.purchase_order_folio} · {show(m.change_type)} · {tx('urgencia', 'urgency')} {show(m.urgency)}</div><div className="text-[10px] text-slate-500">{m.reason}</div><div className="flex gap-1.5 pt-1">{lockBtn(tx('Aprobar', 'Approve'))}{lockBtn(tx('Rechazar', 'Reject'))}</div></div>)}{tasks.status === 'ready' && !tasks.data?.modification_requests?.length && <p className="text-[11px] text-slate-400">{tx('Sin solicitudes asignadas.', 'No requests assigned.')}</p>}</div>
      </div>
    </div>}

    {/* 6 · FORMATO */}
    {tab === 6 && <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Formato de Orden de Compra', 'Purchase Order format')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Selecciona una OC desde la matriz ("Ver PDF") o desde esta lista.', 'Pick a PO from the matrix ("View PDF") or from this list.')}</p></div>
        <div className="flex items-center gap-2"><select aria-label={tx('Orden de compra', 'Purchase order')} value={detailId} onChange={e => setDetailId(e.target.value)} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"><option value="">{tx('Seleccionar OC…', 'Select PO…')}</option>{(d?.items || []).map(po => <option key={po.id} value={po.id}>{po.folio}{po.version_number > 1 ? ` · Rev. ${po.version_number}` : ''} · {po.supplier_name}</option>)}{detailId && !(d?.items || []).some(po => po.id === detailId) && <option value={detailId}>{det.data?.item?.folio || detailId}</option>}</select>
          <button type="button" onClick={print} disabled={!det.data} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />{tx('Imprimir / Guardar PDF', 'Print / Save PDF')}</button>{detailId && <button type="button" aria-label={tx('Cerrar vista', 'Close view')} onClick={() => setDetailId('')} className="p-2 rounded-xl border border-slate-200"><X className="w-4 h-4" /></button>}</div></div>
      <Loading on={det.status === 'loading'} /><Err e={det.error} />
      {!detailId && <div className="p-12 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('Selecciona una orden de compra para ver su formato.', 'Select a purchase order to view its format.')}</div>}
      {det.data && <div data-testid="po-format" className="space-y-3"><iframe title={tx('Formato de OC', 'PO format')} srcDoc={poPrintHtml(det.data, en)} sandbox="" className="w-full h-[900px] rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-slate-200"><h4 className="font-black mb-1">{tx('Versiones', 'Versions')} · {det.data.versions.length}</h4>{det.data.versions.map(v => <div key={v.id} className="flex justify-between text-[11px]"><span>Rev. {v.version_number} {v.amendment_type ? `· ${v.amendment_type}` : ''}</span><span>{money(v.total_amount, v.currency, en)}</span></div>)}</div>
          <div className="p-3 rounded-xl border border-slate-200"><h4 className="font-black mb-1">{tx('Recepciones', 'Receipts')} · {det.data.receipts.length}</h4>{det.data.receipts.map(r => <div key={r.folio} className="flex justify-between text-[11px]"><span>{r.folio} · {ymd(r.date)}</span><span>{r.received_percent !== null ? `${Math.round(Number(r.received_percent))}%` : show(r.status)}</span></div>)}</div>
          <div className="p-3 rounded-xl border border-slate-200"><h4 className="font-black mb-1">{tx('Facturas', 'Invoices')} · {det.data.invoices.length}</h4>{det.data.invoices.map(i => <div key={i.folio} className="flex justify-between text-[11px]"><span>{i.folio} · {ymd(i.date)}</span><span>{money(i.total_amount, i.currency, en)}</span></div>)}</div>
        </div></div>}
    </div>}
  </div>;
}
