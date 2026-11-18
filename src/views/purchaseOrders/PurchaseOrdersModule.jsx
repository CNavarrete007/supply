import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, Printer, Eye, X } from 'lucide-react';
import { listPurchaseOrders, poIssuance, poTasks, poDetail } from './api';
import { PO_STATES, poState, buyerCardList, filterBuyers, buyersBadge, rangeText, buyerCaption, editBlock, requestBlock, modifyBlock, deleteBlock, folioConfirmed, REQUEST_TYPES, URGENCIES, IMPACTS, emptyRequest, approverOptions, validateRequest, requestLockedText, validateEdit, editForm } from './poMatrix.mjs';
import { allUsers, authMe } from '../usersRoles/api.js';
import { buildPoPdf, pdfName } from './poPdf.mjs';
import { money, opLabel, statusTone, progressOf, poPrintHtml, revLabel } from './model.mjs';
import { issuanceOptions, winningSuppliers, supplierTotal, toGenerate, validateIssuance, issuanceLockedText } from './poIssuance.mjs';

// Órdenes de Compra · diseño Grupo Gerez (6 tarjetas) conectado a MariaDB en modo consulta.
// GET /api/v1/purchase-orders[/issuance|/tasks|/{id}] (Master Admin). Emitir, autorizar, modificar y eliminar OC siguen
// bloqueados: son escrituras comerciales que requieren validación integral (regla del proyecto).
const DASH = '—';
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

  // Matriz (servidor): tarjetas por comprador → matriz paginada del comprador elegido
  const [buyerSel, setBuyerSel] = useState(null);
  const [bInput, setBInput] = useState('');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [stF, setStF] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const pdfEn = en; // el PDF y el Formato usan el idioma de la aplicación (sin selector propio en la matriz)
  const [list, setList] = useState({ status: 'loading', error: null, data: null });
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = new AbortController();
    setList(x => ({ ...x, status: 'loading', error: null }));
    listPurchaseOrders(buyerSel ? { page, pageSize, q, state: stF, buyer: buyerSel.id, sort } : { page: 1, pageSize: 1 }, c.signal)
      .then(d => { if (!c.signal.aborted) setList({ status: 'ready', error: null, data: d }); })
      .catch(e => { if (!c.signal.aborted) setList(x => ({ ...x, status: 'error', error: e })); });
    return () => c.abort();
  }, [page, q, stF, buyerSel?.id, sort, pageSize, revision]);
  const d = list.data; const sum = d?.summary; const ctr = sum?.counters || {};
  const lastPage = Math.max(1, Math.ceil((d?.total || 0) / pageSize));
  const bCards = useMemo(() => buyerCardList(sum, en), [sum, en]);
  const shownCards = useMemo(() => filterBuyers(bCards, bInput), [bCards, bInput]);
  const openBuyer = c => { setBuyerSel(c); setInput(''); setQ(''); setStF('all'); setPage(1); setActMsg(null); };
  const backToBuyers = () => { if (!buyerSel) setBInput(''); setBuyerSel(null); setInput(''); setQ(''); setStF('all'); setPage(1); setActMsg(null); };

  // Acciones por OC: PDF real en el navegador; editar/solicitar/modificar/eliminar se validan y no escriben.
  const [actMsg, setActMsg] = useState(null); const [pdfBusy, setPdfBusy] = useState('');
  const [reqDlg, setReqDlg] = useState(null); const [editDlg, setEditDlg] = useState(null); const [delDlg, setDelDlg] = useState(null);
  const pdfOf = async (po, mode) => {
    const w = mode === 'view' ? window.open('', '_blank') : null;
    setPdfBusy(`${po.id}:${mode}`);
    try {
      const [{ jsPDF }, det] = await Promise.all([import('jspdf'), poDetail(po.id)]);
      const doc = buildPoPdf(jsPDF, det, pdfEn);
      if (mode === 'download') doc.save(pdfName(det.item));
      else if (w) { w.location.href = URL.createObjectURL(doc.output('blob')); }
      else { notify(tx('Ver PDF', 'View PDF'), tx('El navegador bloqueó la ventana; se descargará el PDF.', 'The browser blocked the window; the PDF will be downloaded.'), 'warning'); doc.save(pdfName(det.item)); }
    } catch (e) { if (w) w.close(); setActMsg({ kind: 'error', text: e.message || tx('No se pudo generar el PDF.', 'The PDF could not be generated.') }); }
    finally { setPdfBusy(''); }
  };
  const onEdit = async po => {
    const b = editBlock(po, en); if (b) { setActMsg({ kind: 'info', folio: po.folio, text: b }); return; }
    setActMsg(null); setEditDlg({ po, det: null, form: null, msg: null });
    try { const det = await poDetail(po.id); setEditDlg(x => x && x.po.id === po.id ? { ...x, det: det.item, form: editForm(det.item) } : x); }
    catch (e) { setEditDlg(x => x && { ...x, msg: { kind: 'error', text: e.message } }); }
  };
  const saveEdit = () => setEditDlg(x => { const v = validateEdit(x.form, x.det, en); return { ...x, msg: v.ok ? { kind: 'locked', text: tx(`Datos validados, pero no se guardaron los cambios de ${x.po.folio} (${v.changed.join(', ')}): editar órdenes de compra es una escritura comercial bloqueada hasta su autorización.`, `Data validated, but the changes to ${x.po.folio} (${v.changed.join(', ')}) were not saved: editing purchase orders is a commercial write blocked until authorized.`) } : { kind: v.errors.none ? 'info' : 'error', text: v.first } }; });
  // Autorizadores de la solicitud (usuarios activos con acceso, sin quien solicita): se consultan una vez, al abrir el diálogo.
  const [people, setPeople] = useState({ status: 'idle', users: [], me: null, error: null });
  const loadPeople = () => {
    if (people.status === 'loading' || people.status === 'ready') return;
    setPeople(x => ({ ...x, status: 'loading', error: null }));
    Promise.all([allUsers(), authMe()]).then(([u, m]) => setPeople({ status: 'ready', users: u.items || [], me: m?.user || null, error: null }))
      .catch(e => setPeople({ status: 'error', users: [], me: null, error: e }));
  };
  const approvers = useMemo(() => approverOptions(people.users, people.me, reqDlg?.po), [people.users, people.me, reqDlg?.po]);
  useEffect(() => { // preselect the PO's current authorizer once the users are loaded
    if (!reqDlg || reqDlg.form.approver || !approvers[0]?.current) return;
    setReqDlg(x => (x && !x.form.approver ? { ...x, form: { ...x.form, approver: approvers[0].id } } : x));
  }, [approvers, reqDlg?.po?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const onRequest = po => { const b = requestBlock(po, en); if (b) { setActMsg({ kind: 'info', folio: po.folio, text: b }); return; } setActMsg(null); loadPeople(); setReqDlg({ po, form: emptyRequest(), msg: null, tried: false }); };
  const setReq = (k, v) => setReqDlg(x => ({ ...x, form: { ...x.form, [k]: v }, msg: null }));
  const sendRequest = () => setReqDlg(x => {
    const v = validateRequest(x.form, { approvers, me: people.me }, en);
    if (!v.ok) return { ...x, tried: true, errors: v.errors, msg: { kind: 'error', text: v.first } };
    const text = requestLockedText(x.po, x.form, approvers.find(a => a.id === x.form.approver), en);
    notify(tx('Solicitud no registrada', 'Request not recorded'), text, 'warning');
    return { ...x, tried: true, errors: {}, msg: { kind: 'locked', text } };
  });
  const onModify = po => { const b = modifyBlock(po, en); setActMsg({ kind: b ? 'info' : 'locked', folio: po.folio, text: b || tx(`Solicitud ${po.mod_approved} aprobada, pero no se generó la nueva revisión de ${po.folio}: modificar OC es una escritura comercial bloqueada (la Rev. N volvería a revisión/autorización).`, `Request ${po.mod_approved} is approved, but the new revision of ${po.folio} was not generated: modifying POs is a commercial write blocked (Rev. N would go back to review/authorization).`) }); };
  const onDelete = po => { setActMsg(null); setDelDlg({ po, folio: '', reason: '', msg: null, block: deleteBlock(po, en) }); };
  const tryDelete = () => setDelDlg(x => {
    if (x.block) return { ...x, msg: { kind: 'error', text: x.block } };
    if (!folioConfirmed(x.po, x.folio)) return { ...x, msg: { kind: 'error', text: tx(`Escribe exactamente el folio (${x.po.folio}) para confirmar.`, `Type the exact folio (${x.po.folio}) to confirm.`) } };
    if (String(x.reason).trim().length < 10) return { ...x, msg: { kind: 'error', text: tx('Describe el motivo (mínimo 10 caracteres).', 'Describe the reason (minimum 10 characters).') } };
    return { ...x, msg: { kind: 'locked', text: tx(`Datos validados, pero no se eliminó ${x.po.folio}: eliminar órdenes de compra es una escritura comercial bloqueada hasta su autorización.`, `Data validated, but ${x.po.folio} was not deleted: deleting purchase orders is a commercial write blocked until authorized.`) } };
  });

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
    w.document.write(poPrintHtml(det.data, pdfEn)); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250);
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
    {tab === 2 && <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5" data-testid="po-matrix">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="min-w-0 flex-1"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de órdenes de compra', 'Purchase orders matrix')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Organiza las órdenes primero por comprador y abre después la matriz paginada del responsable seleccionado.', 'Organizes orders first by buyer and then opens the paginated matrix of the selected owner.')}</p></div>
        <span className="text-sm font-black shrink-0"><button type="button" onClick={() => setTab(1)} title={tx('Las nuevas OC se generan desde la adjudicación definitiva (Emisión de orden de compra).', 'New POs are generated from the definitive award (Purchase Order Issuance).')} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-md">+ {tx('Nueva orden', 'New order')}</button></span>
      </div>
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div><h4 className="text-sm sm:text-base font-black text-slate-900">{tx('Órdenes de compra por comprador', 'Purchase orders by buyer')}</h4><p className="text-[11px] text-slate-500 mt-0.5">{tx('Selecciona un comprador para consultar únicamente sus órdenes de compra.', 'Select a buyer to view only their purchase orders.')}</p></div>
        <span className="text-xs font-black self-start"><button type="button" onClick={backToBuyers} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-2xs">← {tx('Volver a compradores', 'Back to buyers')}</button></span>
      </div>
      <Loading on={list.status === 'loading'} /><Err e={list.error} />

      {!buyerSel && <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input type="search" aria-label={tx('Buscar comprador', 'Search buyer')} value={bInput} onChange={e => setBInput(e.target.value)} maxLength={120} placeholder={tx('Buscar comprador, correo, teléfono o puesto...', 'Search buyer, email, phone or position...')} className="flex-1 min-w-0 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <span data-testid="po-buyer-badge" className="px-3 py-1 bg-amber-50 text-amber-900 font-black text-[11px] rounded-full border border-amber-200 self-start sm:self-auto whitespace-nowrap">{sum ? buyersBadge(sum, en) : '…'}</span>
        </div>
        {sum && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {shownCards.map(c => <button key={c.id} type="button" data-testid="po-buyer-card" data-buyer={c.name} aria-label={`${tx('Abrir órdenes de', 'Open orders of')} ${c.name}`} onClick={() => openBuyer(c)} className={`relative text-left bg-white rounded-2xl border border-slate-200/90 p-3.5 pl-4 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between ${c.isAll && !c.isNone ? 'bg-gradient-to-br from-white to-purple-50/60' : ''}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 via-orange-500 to-purple-600" />
            <div>
              <div className="flex items-start gap-3 mb-3"><div className="w-10 h-10 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-amber-500 to-orange-600">{c.tag}</div>
                <div className="min-w-0"><div className={`text-xs font-black text-slate-900 leading-tight ${c.isAll ? '' : 'uppercase'}`}>{c.name}</div><div className="text-[10px] text-slate-500 truncate" title={c.sub}>{c.sub || ' '}</div></div></div>
              <div className="grid grid-cols-3 gap-1.5">{[[c.count, 'OC'], [c.pending ?? DASH, tx('Pendientes', 'Pending')], [c.received ?? DASH, tx('Recibidas', 'Received')]].map(([n, l]) => <div key={l} className="bg-white border border-slate-200 rounded-xl px-2 py-1.5"><span className="block text-sm font-black text-slate-900 tabular-nums">{n}</span><span className="block text-[9px] text-slate-500">{l}</span></div>)}</div>
            </div>
            {c.isAll ? <div className="flex justify-between text-[10px] text-slate-600 mt-3 pt-2"><span>{c.isNone ? tx('Órdenes sin comprador', 'Orders without buyer') : tx('Vista general', 'Overview')}</span><span aria-hidden="true">→</span></div>
              : <div className="mt-3 space-y-1.5"><div className="flex justify-between gap-2 text-[10px] text-slate-600"><span>{c.meta}</span><span className="font-bold text-slate-800 whitespace-nowrap">{c.amount}</span></div>
                <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500 to-purple-600" style={{ width: `${c.pct}%` }} /></div><span className="text-[10px] font-black text-slate-700 whitespace-nowrap">{c.pct}% {tx('recibido', 'received')}</span></div></div>}
          </button>)}
          {shownCards.every(c => c.isAll) && bInput.trim() && <div className="col-span-full p-6 border border-dashed border-slate-300 rounded-2xl text-center text-sm text-slate-600">{tx(`Ningún comprador coincide con "${bInput.trim()}".`, `No buyer matches "${bInput.trim()}".`)}</div>}
        </div>}
      </div>}

      {buyerSel && <div className="space-y-4">
        <div data-testid="po-buyer-head" className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/80 via-white to-purple-50/50">
          <div><h4 className="text-sm font-black text-slate-900">{buyerSel.name}</h4><p className="text-[10.5px] text-slate-600">{buyerCaption(buyerSel, d?.total ?? 0, sum?.buyers?.length ?? 0, en)}</p></div>
          <span className="text-xs font-black"><button type="button" onClick={backToBuyers} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-2xs">← {tx('Cambiar comprador', 'Change buyer')}</button></span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <input type="search" aria-label={tx('Buscar órdenes', 'Search orders')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar OC, requisición, referencia, proveedor o responsable...', 'Search PO, requisition, reference, vendor or responsible...')} className="md:col-span-5 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <select aria-label={tx('Estatus', 'Status')} value={stF} onChange={e => { setStF(e.target.value); setPage(1); }} className="md:col-span-3 px-3 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800"><option value="all">{tx('Todos los estatus', 'All statuses')}</option>{PO_STATES.map(([k, es, e2]) => <option key={k} value={k}>{en ? e2 : es} ({sum?.states?.find(x => x.code === k)?.count ?? 0})</option>)}</select>
          <select aria-label={tx('Orden', 'Sort')} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} className="md:col-span-3 px-3 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800"><option value="recent">{tx('Más recientes primero', 'Most recent first')}</option><option value="oldest">{tx('Más antiguas primero', 'Oldest first')}</option><option value="amount">{tx('Mayor monto primero', 'Highest amount first')}</option></select>
          <label className="md:col-span-1 flex items-center gap-2 text-[10px] font-black text-slate-700">{tx('Filas', 'Rows')}<select aria-label={tx('Filas por página', 'Rows per page')} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="flex-1 px-2 py-3 bg-white border border-slate-300 rounded-xl text-xs">{[15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 text-[10.5px] text-slate-700 leading-relaxed">
          <strong>{tx('Vista por comprador:', 'Buyer view:')}</strong> <strong>{tx('VER PDF', 'VIEW PDF')}</strong> {tx('genera el formato de la Orden de Compra.', 'generates the Purchase Order format.')} <strong>{tx('EDITAR', 'EDIT')}</strong> {tx('abre la orden para modificarla.', 'opens the order to modify it.')} <strong>{tx('AVANCE', 'PROGRESS')}</strong> {tx('refleja el porcentaje recibido de la OC.', 'reflects the received percentage of the PO.')} <strong>{tx('ELIMINAR', 'DELETE')}</strong> {tx('borra la orden después de confirmar.', 'deletes the order after confirming.')}<br />
          <strong>{tx('SOLICITAR MODIFICACIÓN', 'REQUEST CHANGE')}</strong> {tx('requiere aprobación previa. Solo después se habilita', 'requires prior approval. Only then is')} <strong>{tx('MODIFICAR OC', 'MODIFY PO')}</strong>{tx('; la Rev. N vuelve a revisión/autorización.', ' enabled; Rev. N goes back to review/authorization.')}
        </div>
        {actMsg && <div data-testid="po-action-msg" role={actMsg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 p-3 rounded-xl border text-xs ${actMsg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : actMsg.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}><span className="flex items-start gap-2">{actMsg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{actMsg.folio ? <strong>{actMsg.folio}: </strong> : null}{actMsg.text}</span></span><button type="button" aria-label={tx('Cerrar aviso', 'Close notice')} onClick={() => setActMsg(null)} className="p-1 rounded hover:bg-white/60"><X className="w-3.5 h-3.5" /></button></div>}
        <div className="overflow-auto max-h-[70vh] rounded-2xl border border-slate-200/80"><table className="w-full text-left border-collapse min-w-[1700px]">
          <thead className="sticky top-0 z-10"><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">{[tx('OC', 'PO'), tx('Requisición', 'Requisition'), tx('Referencia interna', 'Internal ref.'), tx('Proveedor', 'Vendor'), tx('Comprador', 'Buyer'), tx('Preparó / Revisó', 'Prepared / Reviewed'), tx('Autorizó', 'Authorized'), tx('Partidas', 'Items'), tx('Monto', 'Amount'), tx('Emisión', 'Issued'), tx('Compromiso', 'Commitment'), tx('Estatus', 'Status'), tx('PDF automático', 'Automatic PDF'), tx('Avance', 'Progress')].map(h => <th key={h} className="py-3 px-3 bg-slate-50">{h}</th>)}<th className="py-3 px-3 text-center sticky right-0 bg-slate-50 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">{tx('Acciones', 'Actions')}</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
            {(d?.items || []).map(po => { const pr = progressOf(po); const st = poState(po, en); const busy = k => pdfBusy === `${po.id}:${k}`; return <tr key={po.id} data-folio={po.folio} className="align-top hover:bg-slate-50/70">
              <td className="py-3 px-3 whitespace-nowrap"><div className="font-black text-slate-900">{po.folio}</div><span className="inline-block mt-1 text-[9px] font-black text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-1.5 py-0.5">{revLabel(po)}</span>{po.auto_generated && <div className="text-[10px] text-slate-400">{tx('Generada automáticamente', 'Auto-generated')}</div>}</td>
              <td className="py-3 px-3 min-w-[130px]"><div>{show(po.requisitions)}</div><div className="text-[10px] text-slate-400">{show(po.clients)}</div></td>
              <td className="py-3 px-3">{show(po.internal_reference)}</td>
              <td className="py-3 px-3 min-w-[150px] uppercase">{po.supplier_name}</td>
              <td className="py-3 px-3 font-bold min-w-[120px]">{show(po.buyer_name)}</td><td className="py-3 px-3 font-bold min-w-[120px]">{show(po.preparer_name)}</td><td className="py-3 px-3 font-bold min-w-[120px]">{show(po.authorizer_name)}</td>
              <td className="py-3 px-3 min-w-[130px]"><div className="font-black text-slate-900">{po.item_count}</div><div className="text-[9.5px] text-slate-500 uppercase leading-snug">{show(po.item_summary)}</div></td>
              <td className="py-3 px-3 whitespace-nowrap font-bold">{money(po.total_amount, po.currency, en)}</td>
              <td className="py-3 px-3 whitespace-nowrap">{ymd(po.order_date)}</td><td className="py-3 px-3 whitespace-nowrap">{ymd(po.commitment_date)}</td>
              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${st.tone}`}>{st.text}</span>{po.mod_pending && <div className="text-[9.5px] text-amber-700 font-bold mt-1">{tx('Modificación pendiente', 'Change pending')}: {po.mod_pending}</div>}</td>
              <td className="py-3 px-3"><div className="flex flex-col gap-1.5 min-w-[118px] text-[10px] font-black">
                <span className="text-[9.5px]"><button type="button" onClick={() => openFormat(po.id)} className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 rounded-full">{tx('Formato PDF', 'PDF format')}</button></span>
                <button type="button" disabled={!!pdfBusy} onClick={() => pdfOf(po, 'view')} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg uppercase flex items-center justify-center gap-1 disabled:opacity-60">{busy('view') ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}{tx('Ver PDF', 'View PDF')}</button>
                <button type="button" disabled={!!pdfBusy} onClick={() => pdfOf(po, 'download')} className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg uppercase whitespace-nowrap disabled:opacity-60">{busy('download') ? '…' : '↓'} {tx('Descargar PDF', 'Download PDF')}</button></div></td>
              <td className="py-3 px-3 min-w-[100px]">{pr.pct === null ? <span className="text-[10px] text-slate-500">{po.receipt_count} {tx('recepción(es)', 'receipt(s)')}</span> : <><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pr.pct}%` }} /></div><div className="text-[10px] text-slate-500 mt-0.5">{Math.round(pr.pct)}% {tx('recibido', 'received')}</div></>}</td>
              <td className="py-3 px-3 sticky right-0 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"><div className="flex flex-col gap-1 min-w-[150px] text-[9.5px] font-black uppercase">
                <button type="button" onClick={() => onEdit(po)} className="uppercase px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">{tx('Editar', 'Edit')}</button>
                <button type="button" onClick={() => onRequest(po)} className="uppercase px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">{tx('Solicitar modificación', 'Request change')}</button>
                <button type="button" onClick={() => onModify(po)} disabled={!!modifyBlock(po, en)} title={modifyBlock(po, en) || ''} className="uppercase px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">{tx('Modificar OC', 'Modify PO')}</button>
                <button type="button" onClick={() => onDelete(po)} className="uppercase px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg">{tx('Eliminar', 'Delete')}</button></div></td>
            </tr>; })}
            {list.status === 'ready' && !d?.items?.length && <tr><td colSpan={15} className="py-12 text-center text-xs text-slate-400 font-semibold">{tx('No hay órdenes de compra para el filtro.', 'No purchase orders for the filter.')}</td></tr>}
          </tbody></table></div>
        <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-slate-600"><span data-testid="po-range" className="font-bold text-blue-900">{rangeText(page, pageSize, d?.total ?? 0, en)}</span>
          <div className="flex items-center gap-2"><span>{tx('Página', 'Page')} {page} / {lastPage}</span><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= lastPage} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
        <p className="text-[10.5px] text-slate-500">{tx('Monto vigente por moneda', 'Current amount per currency')}: {(sum?.money || []).map(m => `${money(m.amount, m.currency, en)} · ${m.orders} OC`).join('  |  ') || DASH}</p>
      </div>}
    </div>}

    {reqDlg && <div role="dialog" aria-modal="true" aria-label={tx('Solicitud de modificación de Orden de Compra', 'Purchase Order change request')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-4" onClick={() => setReqDlg(null)}>
      <div data-testid="po-request" className="bg-slate-50 rounded-3xl w-full max-w-4xl max-h-[94vh] overflow-auto text-left shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 text-white rounded-t-3xl">
          <div><h3 className="text-base sm:text-lg font-black">{tx('Solicitud de modificación de Orden de Compra', 'Purchase Order change request')}</h3><p className="text-[11px] text-white/85">{tx('La OC permanece bloqueada hasta que la solicitud sea aprobada.', 'The PO stays locked until the request is approved.')}</p></div>
          <span className="text-xs font-black shrink-0"><button type="button" onClick={() => setReqDlg(null)} className="px-3 py-2 rounded-xl border border-white/40 bg-white/15 hover:bg-white/25 flex items-center gap-1.5"><X className="w-4 h-4" />{tx('Cerrar', 'Close')}</button></span>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div data-testid="po-request-context" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[
            [reqDlg.po.folio, `${revLabel(reqDlg.po)} · ${poState(reqDlg.po, en).text}`],
            [show(reqDlg.po.requisitions), show(reqDlg.po.clients)],
            [String(reqDlg.po.supplier_name || DASH).toUpperCase(), `${reqDlg.po.currency || ''} · ${money(reqDlg.po.total_amount, reqDlg.po.currency, en)}`],
            [String(reqDlg.po.authorizer_name || DASH).toUpperCase(), tx('Autorizador actual de la OC', 'Current PO authorizer')],
          ].map(([a, b], i) => <div key={i} className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-w-0"><div className="text-[11px] font-black text-slate-900 truncate" title={a}>{a}</div><div className="text-[9.5px] font-bold text-slate-500 truncate" title={b}>{b}</div></div>)}</div>
          <div className="p-3 rounded-xl bg-amber-50 border-l-4 border-amber-500 text-[10.5px] text-amber-900 leading-relaxed"><strong>{tx('Control obligatorio:', 'Mandatory control:')}</strong> {tx('enviar esta solicitud', 'sending this request')} <u>{tx('no modifica', 'does not modify')}</u> {tx('la OC. La persona autorizadora primero decide si permite el cambio. Después de aprobarse se habilita MODIFICAR OC y la nueva Rev. N deberá pasar nuevamente por el flujo normal de revisión y autorización.', 'the PO. The approver first decides whether to allow the change. Once approved, MODIFY PO is enabled and the new Rev. N must go through the normal review and authorization flow again.')}</div>
          {(() => { const err = k => reqDlg.tried && reqDlg.errors?.[k]; const ctl = k => `w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${err(k) ? 'border-rose-400' : 'border-slate-300'}`;
            const lbl = (t, req, k, child, cls = '') => <label className={`block ${cls}`}><span className="block text-[11px] font-black text-slate-900 mb-1.5">{t}{req ? ' *' : ''}</span>{child}{err(k) && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{reqDlg.errors[k]}</span>}</label>;
            return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lbl(tx('Tipo de modificación', 'Change type'), true, 'type', <select aria-label={tx('Tipo de modificación', 'Change type')} value={reqDlg.form.type} onChange={e => setReq('type', e.target.value)} className={ctl('type')}>{REQUEST_TYPES.map(([k, es, e2]) => <option key={k} value={k}>{en ? e2 : es}</option>)}</select>)}
              {lbl(tx('Urgencia', 'Urgency'), true, 'urgency', <select aria-label={tx('Urgencia', 'Urgency')} value={reqDlg.form.urgency} onChange={e => setReq('urgency', e.target.value)} className={ctl('urgency')}>{URGENCIES.map(([k, es, e2]) => <option key={k} value={k}>{en ? e2 : es}</option>)}</select>)}
              {lbl(tx('Autoriza la modificación', 'Change approved by'), true, 'approver', <select aria-label={tx('Autoriza la modificación', 'Change approved by')} value={reqDlg.form.approver} onChange={e => setReq('approver', e.target.value)} disabled={people.status === 'loading'} className={ctl('approver')}><option value="">{people.status === 'loading' ? tx('Consultando usuarios…', 'Loading users…') : tx('Seleccionar autorizador...', 'Select approver...')}</option>{approvers.map(a => <option key={a.id} value={a.id}>{String(a.name).toUpperCase()} · {a.email}</option>)}</select>)}
              {lbl(tx('Referencia / evidencia', 'Reference / evidence'), false, 'reference', <input type="text" aria-label={tx('Referencia / evidencia', 'Reference / evidence')} value={reqDlg.form.reference} maxLength={255} placeholder={tx('Correo, Change Request, PO cliente, minuta, ticket...', 'Email, Change Request, client PO, minutes, ticket...')} onChange={e => setReq('reference', e.target.value)} className={ctl('reference')} />, 'md:col-span-2')}
              {lbl(tx('Impacto estimado', 'Estimated impact'), false, 'impact', <select aria-label={tx('Impacto estimado', 'Estimated impact')} value={reqDlg.form.impact} onChange={e => setReq('impact', e.target.value)} className={ctl('impact')}>{IMPACTS.map(([k, es, e2]) => <option key={k} value={k}>{en ? e2 : es}</option>)}</select>)}
              {lbl(tx('Motivo / justificación', 'Reason / justification'), true, 'reason', <textarea rows={4} aria-label={tx('Motivo / justificación', 'Reason / justification')} maxLength={1100} value={reqDlg.form.reason} placeholder={tx('Explica por qué se solicita autorización para modificar la OC y qué instrucción o evento originó el cambio.', 'Explain why authorization to modify the PO is requested and which instruction or event caused the change.')} onChange={e => setReq('reason', e.target.value)} className={ctl('reason')} />, 'md:col-span-3')}
            </div>; })()}
          {people.status === 'error' && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{tx('No se pudo consultar la lista de autorizadores', 'The approver list could not be loaded')}: {people.error?.message}</p>}
          {people.status === 'ready' && !approvers.length && <p className="text-xs text-amber-800">{tx('No hay otro usuario activo con acceso que pueda autorizar la modificación.', 'There is no other active user with access who can authorize the change.')}</p>}
          {reqDlg.msg && <p data-testid="po-request-msg" role={reqDlg.msg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${reqDlg.msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{reqDlg.msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{reqDlg.msg.text}</span></p>}
          <div className="flex flex-wrap justify-end gap-3 text-sm font-black"><button type="button" onClick={() => setReqDlg(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl">{tx('Cancelar', 'Cancel')}</button><button type="button" onClick={sendRequest} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">📨</span>{tx('Enviar para aprobación', 'Send for approval')}</button></div>
        </div>
      </div>
    </div>}

    {editDlg && <div role="dialog" aria-modal="true" aria-label={tx('Editar orden de compra', 'Edit purchase order')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setEditDlg(null)}>
      <div data-testid="po-edit" className="bg-white rounded-2xl w-full max-w-xl p-5 space-y-4 text-left" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-amber-700">{tx('Editar', 'Edit')} {editDlg.po.folio} · {revLabel(editDlg.po)}</h3><button type="button" aria-label={tx('Cerrar', 'Close')} onClick={() => setEditDlg(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        {!editDlg.form ? <Loading on={!editDlg.msg} /> : <div className="grid grid-cols-2 gap-3">
          {[['commitment', tx('Fecha compromiso', 'Commitment date'), 'date'], ['reference', tx('Referencia interna', 'Internal reference'), 'text'], ['place', tx('Lugar de entrega', 'Delivery place'), 'text']].map(([k, l, t]) => <label key={k} className={`block ${k === 'place' ? 'col-span-2' : ''}`}><span className="block text-[11px] font-black mb-1">{l}</span><input type={t} aria-label={l} value={editDlg.form[k]} onChange={e => { const v = e.target.value; setEditDlg(x => ({ ...x, form: { ...x.form, [k]: v }, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>)}
          {[['terms', tx('Condiciones', 'Terms')], ['notes', tx('Notas', 'Notes')]].map(([k, l]) => <label key={k} className="block col-span-2"><span className="block text-[11px] font-black mb-1">{l}</span><textarea rows={2} aria-label={l} value={editDlg.form[k]} onChange={e => { const v = e.target.value; setEditDlg(x => ({ ...x, form: { ...x.form, [k]: v }, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>)}
        </div>}
        {editDlg.msg && <p data-testid="po-edit-msg" role={editDlg.msg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${editDlg.msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : editDlg.msg.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{editDlg.msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{editDlg.msg.text}</span></p>}
        <div className="flex justify-end gap-2 text-xs font-black"><button type="button" onClick={() => setEditDlg(null)} className="px-4 py-2 border border-slate-200 rounded-xl">{tx('Cancelar', 'Cancel')}</button><button type="button" disabled={!editDlg.form} onClick={saveEdit} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-50">{tx('Guardar cambios', 'Save changes')}</button></div>
      </div>
    </div>}

    {delDlg && <div role="dialog" aria-modal="true" aria-label={tx('Eliminar orden de compra', 'Delete purchase order')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setDelDlg(null)}>
      <div data-testid="po-delete" className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 text-left" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-rose-700">{tx('Eliminar', 'Delete')} {delDlg.po.folio} · {revLabel(delDlg.po)}</h3><button type="button" aria-label={tx('Cerrar', 'Close')} onClick={() => setDelDlg(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-slate-600">{delDlg.po.supplier_name} · {money(delDlg.po.total_amount, delDlg.po.currency, en)} · {poState(delDlg.po, en).text}</p>
        {delDlg.block ? <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{delDlg.block}</p> : <>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx(`Escribe el folio (${delDlg.po.folio}) para confirmar`, `Type the folio (${delDlg.po.folio}) to confirm`)}</span><input type="text" aria-label={tx('Folio a eliminar', 'Folio to delete')} value={delDlg.folio} onChange={e => { const v = e.target.value; setDelDlg(x => ({ ...x, folio: v, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx('Motivo', 'Reason')} *</span><textarea rows={3} aria-label={tx('Motivo de la eliminación', 'Deletion reason')} value={delDlg.reason} onChange={e => { const v = e.target.value; setDelDlg(x => ({ ...x, reason: v, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label></>}
        {delDlg.msg && <p data-testid="po-delete-msg" role={delDlg.msg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${delDlg.msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{delDlg.msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{delDlg.msg.text}</span></p>}
        <div className="flex justify-end gap-2 text-xs font-black"><button type="button" onClick={() => setDelDlg(null)} className="px-4 py-2 border border-slate-200 rounded-xl">{tx('Cancelar', 'Cancel')}</button>{!delDlg.block && <button type="button" onClick={tryDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl">{tx('Eliminar', 'Delete')}</button>}</div>
      </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">{families.map(f => { const last = f.versions[f.versions.length - 1]; const on = openFamily === f.id; return <div key={f.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2"><div className="flex justify-between gap-2"><span className="text-sm font-black text-slate-900">{f.folio}</span><span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">{revLabel(last)}</span></div><div className="text-[11px] text-slate-500">{last.supplier_name}</div><div className="text-xs font-bold">{money(last.total_amount, last.currency, en)}</div>
        <div className="flex gap-1.5"><button type="button" onClick={() => setOpenFamily(on ? '' : f.id)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg uppercase">{on ? tx('Ocultar', 'Hide') : tx('Historial', 'History')}</button>{lockBtn(tx('Modificar OC', 'Modify PO'))}</div>
        {on && <ul className="space-y-1 pt-2 border-t border-slate-100">{f.versions.map(v => <li key={v.id} className="text-[10px] text-slate-600 flex justify-between gap-2"><span>{revLabel(v)} · {ymd(v.order_date)}</span><span className="font-bold">{money(v.total_amount, v.currency, en)}</span><button type="button" onClick={() => openFormat(v.id)} className="text-blue-700 font-bold">{tx('Ver', 'View')}</button></li>)}</ul>}</div>; })}</div>
      {fam.status === 'ready' && !families.length && <p className="text-xs text-slate-400 text-center py-8">{tx('No hay órdenes de compra registradas.', 'No purchase orders recorded.')}</p>}
    </div>}

    {/* 5 · REVISIÓN Y AUTORIZACIÓN (mis tareas) */}
    {tab === 5 && <div className={box}>
      <div className="pb-3 border-b border-slate-100"><h3 className="text-base font-extrabold text-slate-900">{tx('Revisión y autorización', 'Review & authorization')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Órdenes en las que eres el responsable actual y solicitudes de modificación asignadas a ti.', 'Orders where you are the current owner and modification requests assigned to you.')}</p></div>
      <Loading on={tasks.status === 'loading'} /><Err e={tasks.error} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2"><h4 className="text-xs font-black text-slate-800">{tx('Mis órdenes por atender', 'My orders to handle')} · {tasks.data?.responsible?.length ?? 0}</h4>{(tasks.data?.responsible || []).map(po => <div key={po.id} className="p-3 rounded-xl border border-slate-200 flex justify-between gap-2 text-xs"><div><div className="font-black">{po.folio} · {revLabel(po)}</div><div className="text-[10px] text-slate-500">{po.supplier_name} · {opLabel(po.approval_status, en)}</div></div><div className="flex flex-col items-end gap-1"><strong>{money(po.total_amount, po.currency, en)}</strong><button type="button" onClick={() => openFormat(po.id)} className="text-[10px] text-blue-700 font-bold">{tx('Ver formato', 'View format')}</button></div></div>)}{tasks.status === 'ready' && !tasks.data?.responsible?.length && <p className="text-[11px] text-slate-400">{tx('Sin órdenes asignadas.', 'No orders assigned.')}</p>}</div>
        <div className="space-y-2"><h4 className="text-xs font-black text-slate-800">{tx('Solicitudes de modificación asignadas', 'Assigned modification requests')} · {tasks.data?.modification_requests?.length ?? 0}</h4>{(tasks.data?.modification_requests || []).map(m => <div key={m.folio} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1"><div className="flex justify-between"><strong>{m.folio}</strong><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusTone(m.status)}`}>{opLabel(m.status, en)}</span></div><div className="text-[11px] text-slate-600">{m.purchase_order_folio} · {show(m.change_type)} · {tx('urgencia', 'urgency')} {show(m.urgency)}</div><div className="text-[10px] text-slate-500">{m.reason}</div><div className="flex gap-1.5 pt-1">{lockBtn(tx('Aprobar', 'Approve'))}{lockBtn(tx('Rechazar', 'Reject'))}</div></div>)}{tasks.status === 'ready' && !tasks.data?.modification_requests?.length && <p className="text-[11px] text-slate-400">{tx('Sin solicitudes asignadas.', 'No requests assigned.')}</p>}</div>
      </div>
    </div>}

    {/* 6 · FORMATO */}
    {tab === 6 && <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Formato de Orden de Compra', 'Purchase Order format')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Selecciona una OC desde la matriz ("Ver PDF") o desde esta lista.', 'Pick a PO from the matrix ("View PDF") or from this list.')}</p></div>
        <div className="flex items-center gap-2"><select aria-label={tx('Orden de compra', 'Purchase order')} value={detailId} onChange={e => setDetailId(e.target.value)} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"><option value="">{tx('Seleccionar OC…', 'Select PO…')}</option>{(d?.items || []).map(po => <option key={po.id} value={po.id}>{po.folio} · {revLabel(po)} · {po.supplier_name}</option>)}{detailId && !(d?.items || []).some(po => po.id === detailId) && <option value={detailId}>{det.data?.item?.folio || detailId}</option>}</select>
          <button type="button" onClick={print} disabled={!det.data} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />{tx('Imprimir / Guardar PDF', 'Print / Save PDF')}</button>{detailId && <button type="button" aria-label={tx('Cerrar vista', 'Close view')} onClick={() => setDetailId('')} className="p-2 rounded-xl border border-slate-200"><X className="w-4 h-4" /></button>}</div></div>
      <Loading on={det.status === 'loading'} /><Err e={det.error} />
      {!detailId && <div className="p-12 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('Selecciona una orden de compra para ver su formato.', 'Select a purchase order to view its format.')}</div>}
      {det.data && <div data-testid="po-format" className="space-y-3"><iframe title={tx('Formato de OC', 'PO format')} srcDoc={poPrintHtml(det.data, pdfEn)} sandbox="" className="w-full h-[900px] rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-slate-200"><h4 className="font-black mb-1">{tx('Versiones', 'Versions')} · {det.data.versions.length}</h4>{det.data.versions.map(v => <div key={v.id} className="flex justify-between text-[11px]"><span>{revLabel(v)} {v.amendment_type ? `· ${v.amendment_type}` : ''}</span><span>{money(v.total_amount, v.currency, en)}</span></div>)}</div>
          <div className="p-3 rounded-xl border border-slate-200"><h4 className="font-black mb-1">{tx('Recepciones', 'Receipts')} · {det.data.receipts.length}</h4>{det.data.receipts.map(r => <div key={r.folio} className="flex justify-between text-[11px]"><span>{r.folio} · {ymd(r.date)}</span><span>{r.received_percent !== null ? `${Math.round(Number(r.received_percent))}%` : show(r.status)}</span></div>)}</div>
          <div className="p-3 rounded-xl border border-slate-200"><h4 className="font-black mb-1">{tx('Facturas', 'Invoices')} · {det.data.invoices.length}</h4>{det.data.invoices.map(i => <div key={i.folio} className="flex justify-between text-[11px]"><span>{i.folio} · {ymd(i.date)}</span><span>{money(i.total_amount, i.currency, en)}</span></div>)}</div>
        </div></div>}
    </div>}
  </div>;
}
