import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { listInvoices, invoiceDetail, invoiceRequisitions, invoiceContext, invoiceControl } from './api';
import { money, stateLabel, stateTone, statusText, daysOverdue, moneyList, controlCards, acceptLabel, poList, acceptedText } from './model.mjs';
import { clientCards, clientBadge, cardMoney, cardsEmpty, clientCaption, invoiceDeleteBlock, invoiceNumberConfirmed, deleteReasonError } from './invoiceMatrix.mjs';
import { CURRENCIES, STATUSES, FILE_TYPES, emptyInvoice, fromInvoice, contextDefaults, computeTotal, validateInvoice, changedInvoiceFields, previewType, fileSize } from './invoiceForm.mjs';

// Factura · diseño Grupo Gerez (3 tarjetas) conectado a MariaDB en modo consulta.
// GET /api/v1/invoices* (Master Admin). Registrar, editar, cancelar o eliminar facturas y abrir sus archivos privados
// sigue bloqueado hasta su validación integral.
const DASH = '—';
const show = v => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));
const ymd = v => (v ? String(v).slice(0, 10) : DASH);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function useLoad(fn, deps, enabled = true) {
  const [st, setSt] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!enabled) { setSt({ status: 'idle', data: null, error: null }); return undefined; }
    const c = new AbortController();
    setSt(x => ({ ...x, status: 'loading', error: null }));
    fn(c.signal).then(d => !c.signal.aborted && setSt({ status: 'ready', data: d, error: null })).catch(e => !c.signal.aborted && setSt(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, [enabled, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}

export function InvoiceModule({ lang = 'es', language, isEnglish, onNotify }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const LOCK = tx('Modo consulta MariaDB: registrar, editar, cancelar o eliminar facturas y abrir sus archivos privados son operaciones bloqueadas hasta su validación integral.', 'MariaDB read mode: recording, editing, cancelling or deleting invoices and opening their private files are blocked until fully validated.');
  const tabs = [
    [1, '🧾', tx('Registro de factura', 'Invoice Registration'), tx('Datos fiscales de la factura por requisición entregada y aceptada.', 'Invoice tax data per delivered and accepted requisition.')],
    [2, '📋', tx('Matriz de facturas', 'Invoice Matrix'), tx('Consulta facturas, sus OC, acuses y archivos registrados.', 'Review invoices, their POs, acknowledgments and recorded files.')],
    [3, '🚦', tx('Control de facturación', 'Billing Control'), tx('Identifica entregas aceptadas pendientes de factura y vencimientos.', 'Identify accepted deliveries pending invoice and due dates.')],
  ];
  const [tab, setTab] = useState(2);
  const [rev, setRev] = useState(0);
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState('all');
  const [reqId, setReqId] = useState('');
  const [invSel, setInvSel] = useState('');
  const [view, setView] = useState('');
  const [client, setClient] = useState(null); // tarjeta 2: null = tarjetas por cliente; card object = matriz de ese cliente
  const [cardInput, setCardInput] = useState(''); const [cardQ, setCardQ] = useState('');
  const [reqLabel, setReqLabel] = useState(''); // folio when card 1 is opened from the matrix (EDITAR)
  const [del, setDel] = useState(null); const [delNum, setDelNum] = useState(''); const [delReason, setDelReason] = useState(''); const [delMsg, setDelMsg] = useState(null);
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setCardQ(cardInput.trim()), 300); return () => clearTimeout(t); }, [cardInput]);
  const go = id => { setTab(id); setPage(1); setInput(''); setQ(''); };
  const day = today();

  const cardsLd = useLoad(s => listInvoices({ page: 1, page_size: 1, q: cardQ }, s), [cardQ, rev], tab === 2);
  const list = useLoad(s => listInvoices({ page, q, state, client: client?.id }, s), [page, q, state, rev, client?.id], tab === 2 && !!client);
  const reqs = useLoad(s => invoiceRequisitions(s), [rev], tab === 1);
  const ctx = useLoad(s => invoiceContext(reqId, s), [reqId, rev], tab === 1 && !!reqId);
  const ctrl = useLoad(s => invoiceControl(s), [rev], tab === 3);
  const det = useLoad(s => invoiceDetail(view, s), [view, rev], !!view);

  const Err = ({ s }) => (s?.error ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{s.error.message}</p> : null);
  const Wait = ({ s }) => (s?.status === 'loading' ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p> : null);
  const pill = inv => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${stateTone(inv.state)}`}>{statusText(inv, en)}</span>;
  const box = 'bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-5';
  const head = (title, sub, right) => <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900">{title}</h3><p className="text-xs text-slate-400">{sub}</p></div>{right}</div>;
  const field = (k, v) => <div key={k} className="space-y-1"><div className="text-[11px] font-bold text-slate-500">{k}</div><div className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 min-h-[38px] break-words">{v}</div></div>;
  const table = (headers, rows, empty, min = 'min-w-[1100px]') => <div className="overflow-x-auto rounded-2xl border border-slate-200/80"><table className={`w-full text-left border-collapse text-[11px] ${min}`}><thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">{headers.map(h => <th key={h} className="py-3 px-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{rows}{!rows.length && <tr><td colSpan={headers.length} className="py-10 text-center text-xs text-slate-400 font-semibold">{empty}</td></tr>}</tbody></table></div>;
  const fileText = f => (f ? `${f.mime} · ${f.size_bytes < 1024 ? `${f.size_bytes} B` : `${(f.size_bytes / 1024).toFixed(1)} KB`}` : tx('Sin archivo', 'No file'));
  const invRow = (v, actions = true) => <tr key={v.id} className="align-top hover:bg-slate-50/60">
    <td className="py-2.5 px-3 font-black whitespace-nowrap">{v.folio}<div className="text-[10px] text-slate-400 font-medium">{v.invoice_number}</div></td>
    <td className="py-2.5 px-3 font-mono text-[10px] max-w-[160px] truncate" title={v.fiscal_uuid || ''}>{show(v.fiscal_uuid)}</td>
    <td className="py-2.5 px-3 whitespace-nowrap">{v.requisition}</td>
    <td className="py-2.5 px-3 whitespace-nowrap">{show(v.po_folios)}</td>
    <td className="py-2.5 px-3">{v.client_name}<div className="text-[10px] text-slate-400">{show(v.project)}</div></td>
    <td className="py-2.5 px-3">{show(v.issuer)}</td><td className="py-2.5 px-3">{show(v.receiver)}</td>
    <td className="py-2.5 px-3 whitespace-nowrap">{ymd(v.issue_date)}</td>
    <td className={`py-2.5 px-3 whitespace-nowrap ${v.state === 'overdue' ? 'text-rose-600 font-bold' : ''}`}>{ymd(v.due_date)}{v.state === 'overdue' && <div className="text-[10px]">{daysOverdue(v.due_date, day)} {tx('días', 'days')}</div>}</td>
    <td className={`py-2.5 px-3 font-bold whitespace-nowrap ${v.state === 'cancelled' ? 'line-through text-slate-400' : ''}`}>{money(v.total_amount, v.currency, en)}</td>
    <td className="py-2.5 px-3">{pill(v)}</td>
    <td className="py-2.5 px-3 text-[10px] whitespace-nowrap">{fileText(v.file)}{v.acknowledgments > 0 && <div className="text-emerald-700 font-bold">🔒 {v.acknowledgments} {tx('acuse(s)', 'ack(s)')}</div>}</td>
    {actions && <td className="py-2.5 px-3 whitespace-nowrap"><div className="flex gap-1"><button type="button" onClick={() => setView(v.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg">{tx('📄 Ver', '📄 View')}</button><button type="button" disabled title={tx('El archivo es privado: su descarga sigue bloqueada.', 'The file is private: downloading it stays blocked.')} className="px-2 py-1 bg-slate-100 text-slate-400 text-[9px] font-bold rounded-lg cursor-not-allowed">{tx('VER ARCHIVO', 'VIEW FILE')}</button><button type="button" onClick={() => editInvoice(v)} className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-bold rounded-lg">{tx('EDITAR', 'EDIT')}</button><button type="button" onClick={() => { setDel(v); setDelNum(''); setDelReason(''); setDelMsg(null); }} className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded-lg">{tx('ELIMINAR', 'DELETE')}</button></div></td>}
  </tr>;
  const H = [tx('Factura', 'Invoice'), 'UUID', tx('Requisición', 'Requisition'), 'OC', tx('Cliente / Proyecto', 'Client / Project'), tx('Emisor', 'Issuer'), tx('Receptor', 'Receiver'), tx('Emisión', 'Issued'), tx('Vencimiento', 'Due'), 'Total', tx('Estatus', 'Status'), tx('Archivo', 'File')];
  const pager = st => { const last = Math.max(1, Math.ceil((st.data?.total || 0) / (st.data?.page_size || 25))); return <div className="flex justify-between items-center text-xs text-slate-600"><span>{st.data?.total ?? 0} {tx('facturas', 'invoices')} · {tx('Página', 'Page')} {page} / {last}</span><div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>; };
  const notify = (t, m, k = 'info') => { if (typeof onNotify === 'function') onNotify(t, m, k); };
  // ---------- Tarjeta 1: registro (se valida; guardar requiere endpoint de escritura autorizado) ----------
  const cd = ctx.status === 'ready' ? ctx.data : null; // never validate against the previous requisition while loading
  const cur = cd?.invoices?.find(v => v.id === invSel) || null;
  const [form, setForm] = useState(() => emptyInvoice(day));
  const [original, setOriginal] = useState(null);
  const [tried, setTried] = useState(false); const [saveMsg, setSaveMsg] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => { // new capture for the selected requisition, or update mode for the chosen invoice
    if (cur) { const f = fromInvoice(cur, reqId); setForm(f); setOriginal(f); }
    else { // from update mode start clean; within a new capture keep what was typed, but context fields come from the new requisition
      setForm(x => (original ? { ...emptyInvoice(day), requisition: reqId } : { ...x, requisition: reqId, issuer: '', receiver: '', currency: 'MXN' })); setOriginal(null);
    }
    setTried(false); setSaveMsg(null); if (fileRef.current) fileRef.current.value = '';
  }, [reqId, cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // context defaults (new capture only, empty fields)
    if (!cd || cur) return;
    const d = contextDefaults(cd);
    setForm(f => ({ ...f, receiver: f.receiver || d.receiver, issuer: f.issuer || d.issuer, currency: d.currency && CURRENCIES.includes(d.currency) ? d.currency : f.currency }));
  }, [cd, cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- also after "+ Nueva factura" (runs after the reset above)
  const fv = useMemo(() => validateInvoice(form, { readiness: cd?.readiness || null, invoices: cd?.invoices || [], editing: cur, original, today: day }, en), [form, cd, cur, original, day, en]);
  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaveMsg(null); };
  const editInvoice = v => { setReqLabel(v.requisition); setReqId(v.requisition_id); setInvSel(v.id); setTab(1); setView(''); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };
  const newInvoice = () => { clearForm(); setTab(1); };
  const invoiceReq = r => { clearForm(); setReqLabel(r.folio); setReqId(r.id); setTab(1); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }; // FACTURAR
  const openClient = c => { setClient(c); setInput(''); setQ(''); setState('all'); setPage(1); };
  const backToClients = () => { setClient(null); setInput(''); setQ(''); setState('all'); setPage(1); if (!client) setCardInput(''); };
  const cards = useMemo(() => clientCards(cardsLd.data?.summary?.client_cards, en), [cardsLd.data, en]);
  const delBlock = del ? invoiceDeleteBlock(del, en) : null;
  const tryDelete = () => {
    if (delBlock) { setDelMsg({ kind: 'error', text: delBlock }); return; }
    if (!invoiceNumberConfirmed(del, delNum)) { setDelMsg({ kind: 'error', text: tx(`Escribe exactamente el número de factura (${del.invoice_number}) para confirmar.`, `Type the exact invoice number (${del.invoice_number}) to confirm.`) }); return; }
    const re = deleteReasonError(delReason, en); if (re) { setDelMsg({ kind: 'error', text: re }); return; }
    const text = tx(`Datos validados, pero no se eliminó ${del.folio} (${del.invoice_number}): eliminar facturas es una escritura comercial bloqueada hasta su autorización. Si debe anularse, regístrala como Cancelada desde EDITAR.`, `Data validated, but ${del.folio} (${del.invoice_number}) was not deleted: deleting invoices is a commercial write blocked until authorized. If it must be voided, record it as Cancelled from EDIT.`);
    setDelMsg({ kind: 'locked', text }); notify(tx('Eliminación no habilitada', 'Deletion not enabled'), text, 'warning');
  };
  const clearForm = () => { setReqLabel(''); setReqId(''); setInvSel(''); setForm(emptyInvoice(day)); setOriginal(null); setTried(false); setSaveMsg(null); if (fileRef.current) fileRef.current.value = ''; };
  const calcTotal = () => { const t = computeTotal(form); if (t === null) { notify(tx('Calcular total', 'Calculate total'), tx('Captura un subtotal válido (y los impuestos, si aplican).', 'Enter a valid subtotal (and taxes, if any).'), 'warning'); setTried(true); return; } setF('total', t); };
  const viewFile = () => { // local preview only, with a forced safe type (never HTML/SVG in the app origin)
    const type = previewType(form.file); if (!type) { setTried(true); return; }
    const u = URL.createObjectURL(new Blob([form.file], { type }));
    const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  };
  const removeFile = () => { setF('file', null); if (fileRef.current) fileRef.current.value = ''; };
  const saveInvoice = () => {
    if (cur && !changedInvoiceFields(form, original, en).length) { setTried(false); setSaveMsg({ kind: 'info', text: tx('No hay cambios que guardar.', 'There are no changes to save.') }); return; }
    setTried(true);
    if (!fv.ok) { setSaveMsg({ kind: 'error', text: fv.first }); notify(tx('Factura incompleta', 'Incomplete invoice'), fv.first, 'warning'); return; }
    const what = cur ? tx(`la actualización de ${cur.folio} (${changedInvoiceFields(form, original, en).join(', ')})`, `the update of ${cur.folio} (${changedInvoiceFields(form, original, en).join(', ')})`) : tx(`el registro de la factura ${form.number} por ${money(form.total, form.currency, en)}`, `the recording of invoice ${form.number} for ${money(form.total, form.currency, en)}`);
    const text = tx(`Datos validados, pero no se guardó ${what}: registrar o modificar facturas y subir su archivo es una escritura comercial bloqueada hasta su autorización. El archivo no se subió.`, `Data validated, but ${what} was not saved: recording or modifying invoices and uploading their file is a commercial write blocked until authorized. The file was not uploaded.`);
    setSaveMsg({ kind: 'locked', text }); notify(tx('Registro no habilitado', 'Recording not enabled'), text, 'warning');
  };

  return <div className="space-y-6 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{tx('Factura', 'Invoice')}</h2><p className="text-xs text-slate-500">{tx('Administración y seguimiento de facturación electrónica con datos de MariaDB.', 'Electronic invoicing administration and tracking from MariaDB.')}</p></div>
      <div className="flex items-center gap-2"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span><button type="button" onClick={() => setRev(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{tabs.map(([id, icon, title, desc]) => { const on = tab === id; return <button key={id} type="button" aria-pressed={on} onClick={() => go(id)} className={`p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${on ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-transparent shadow-md' : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800 shadow-2xs'}`}><div><div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 ${on ? 'bg-white/20 text-white' : 'bg-blue-50/80 text-blue-600 border border-blue-100'}`}>{icon}</div><h3 className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-900'}`}>{title}</h3><p className={`text-[10px] mt-1 leading-relaxed ${on ? 'text-purple-100' : 'text-slate-400'}`}>{desc}</p></div></button>; })}</div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    {tab === 1 && <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 text-left space-y-5" data-testid="invoice-form">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Datos de la factura', 'Invoice data')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('La factura corresponde a la etapa 8 y debe relacionarse con una entrega aceptada por el cliente.', 'The invoice belongs to stage 8 and must relate to a delivery accepted by the client.')}</p></div>
        <span className="text-[10.5px] font-black text-purple-800 bg-purple-50 border border-purple-100 rounded-full px-3 py-1 shrink-0">{tx('Paso 8 · Factura', 'Step 8 · Invoice')}</span>
      </div>
      {cur ? <div data-testid="invoice-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-purple-200 bg-purple-50/60 text-xs font-black text-purple-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-inner shrink-0" />{tx(`Modo actualización: ${cur.folio} · ${cur.invoice_number} (${statusText(cur, en)}). Modifica la información y presiona Guardar.`, `Update mode: ${cur.folio} · ${cur.invoice_number} (${statusText(cur, en)}). Edit the information and press Save.`)}</div>
        : <div data-testid="invoice-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs font-black text-emerald-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-inner shrink-0" />{tx('Modo nueva captura activo. Completa la información y presiona Guardar. Al terminar, el formulario se limpiará y bloqueará.', 'New capture mode active. Fill in the information and press Save. When finished, the form will be cleared and locked.')}</div>}
      <Wait s={reqs} /><Err s={reqs} />
      {(() => { const lbl = (t, req, k, child, cls = '') => <label className={`block ${cls}`}><span className="block text-[11px] font-black text-slate-900 mb-1.5">{t}{req ? ' *' : ''}</span>{child}{tried && fv.errors[k] && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{fv.errors[k]}</span>}</label>;
        const ctl = k => `w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${tried && fv.errors[k] ? 'border-rose-400' : 'border-slate-300'}`;
        return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {lbl(tx('Requisición entregada y aceptada', 'Delivered and accepted requisition'), true, 'requisition', <select id="inv-req" aria-label={tx('Requisición entregada y aceptada', 'Delivered and accepted requisition')} value={reqId} onChange={e => { setReqId(e.target.value); setInvSel(''); setReqLabel(''); }} className={ctl('requisition')}><option value="">{tx('Seleccionar requisición...', 'Select requisition...')}</option>{reqId && reqs.data && !reqs.data.items.some(r => r.id === reqId) && <option value={reqId}>{cd?.requisition?.folio || reqLabel || reqId}</option>}{(reqs.data?.items || []).map(r => <option key={r.id} value={r.id}>{r.folio} · {r.client_name} · {r.invoiced ? tx('facturada', 'invoiced') : r.ready ? tx('lista para facturar', 'ready to invoice') : tx('entrega/aceptación pendiente', 'delivery/acceptance pending')}</option>)}</select>, 'md:col-span-2')}
          {lbl(tx('Número de factura', 'Invoice number'), true, 'number', <input type="text" aria-label={tx('Número de factura', 'Invoice number')} value={form.number} maxLength={40} placeholder={tx('Ej. A-1058', 'E.g. A-1058')} onChange={e => setF('number', e.target.value)} className={ctl('number')} />)}
          {lbl(tx('UUID / Folio fiscal', 'UUID / Tax folio'), false, 'uuid', <input type="text" aria-label={tx('UUID / Folio fiscal', 'UUID / Tax folio')} value={form.uuid} maxLength={36} placeholder={tx('UUID del CFDI', 'CFDI UUID')} onChange={e => setF('uuid', e.target.value)} className={`${ctl('uuid')} font-mono`} />)}
          {lbl(tx('Fecha de emisión', 'Issue date'), true, 'issue', <input type="date" aria-label={tx('Fecha de emisión', 'Issue date')} value={form.issue} max={day} onChange={e => setF('issue', e.target.value)} className={ctl('issue')} />)}
          {lbl(tx('Fecha de vencimiento', 'Due date'), false, 'due', <input type="date" aria-label={tx('Fecha de vencimiento', 'Due date')} value={form.due} min={form.issue || undefined} onChange={e => setF('due', e.target.value)} className={ctl('due')} />)}
          {lbl(tx('Moneda', 'Currency'), false, 'currency', <select aria-label={tx('Moneda', 'Currency')} value={form.currency} onChange={e => setF('currency', e.target.value)} className={ctl('currency')}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>)}
          {lbl(tx('Estatus', 'Status'), false, 'status', <select aria-label={tx('Estatus', 'Status')} value={form.status} onChange={e => setF('status', e.target.value)} className={ctl('status')}>{STATUSES.map(([v, es, e2]) => <option key={v} value={v}>{en ? e2 : es}</option>)}</select>)}
          {lbl(tx('Emisor / razón social', 'Issuer / legal name'), false, 'issuer', <input type="text" aria-label={tx('Emisor / razón social', 'Issuer / legal name')} value={form.issuer} maxLength={255} onChange={e => setF('issuer', e.target.value)} className={ctl('issuer')} />, 'md:col-span-2')}
          {lbl(tx('Receptor / razón social', 'Receiver / legal name'), false, 'receiver', <input type="text" aria-label={tx('Receptor / razón social', 'Receiver / legal name')} value={form.receiver} maxLength={255} onChange={e => setF('receiver', e.target.value)} className={ctl('receiver')} />, 'md:col-span-2')}
          {lbl('Subtotal', false, 'subtotal', <input type="text" inputMode="decimal" aria-label="Subtotal" value={form.subtotal} onChange={e => setF('subtotal', e.target.value)} className={ctl('subtotal')} />)}
          {lbl(tx('Impuestos', 'Taxes'), false, 'taxes', <input type="text" inputMode="decimal" aria-label={tx('Impuestos', 'Taxes')} value={form.taxes} onChange={e => setF('taxes', e.target.value)} className={ctl('taxes')} />)}
          {lbl('Total', true, 'total', <input type="text" inputMode="decimal" aria-label="Total" value={form.total} onChange={e => setF('total', e.target.value)} className={ctl('total')} />)}
          {lbl(tx('Condiciones / método de pago', 'Terms / payment method'), false, 'terms', <input type="text" aria-label={tx('Condiciones / método de pago', 'Terms / payment method')} value={form.terms} maxLength={255} placeholder={tx('Ej. Transferencia · Crédito 30 días', 'E.g. Transfer · 30-day credit')} onChange={e => setF('terms', e.target.value)} className={ctl('terms')} />)}
          {lbl(tx('Observaciones', 'Notes'), false, 'notes', <textarea rows={3} aria-label={tx('Observaciones', 'Notes')} value={form.notes} maxLength={2100} placeholder={tx('Notas fiscales, referencias, orden de compra, recepción o aclaraciones.', 'Tax notes, references, purchase order, receipt or clarifications.')} onChange={e => setF('notes', e.target.value)} className={ctl('notes')} />, 'md:col-span-4')}
        </div>; })()}

      {!reqId && <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-xl p-3.5 text-xs text-slate-700">{tx('Selecciona una requisición entregada y aceptada para cargar su contexto.', 'Select a delivered and accepted requisition to load its context.')}</div>}
      <Wait s={ctx} /><Err s={ctx} />
      {reqId && cd && <div data-testid="invoice-context" className="space-y-3">
        <div className={`border-l-4 rounded-xl p-3.5 text-xs font-medium ${cd.readiness?.ready ? 'bg-emerald-50/70 border-emerald-500 text-emerald-800' : 'bg-amber-50/70 border-amber-500 text-amber-800'}`}>
          {cd.requisition.folio} · {cd.requisition.client_name}{cd.requisition.project ? ` · ${cd.requisition.project}` : ''} · {tx('OC', 'POs')}: {show(cd.readiness?.purchase_orders)} — {cd.readiness?.ready ? tx('Recibida al 100 % y aceptada por el cliente.', 'Received 100% and accepted by the client.') : `${cd.readiness?.received ? '' : tx('Recepción incompleta. ', 'Incomplete receipt. ')}${cd.readiness?.accepted ? '' : tx('Entrega no aceptada.', 'Delivery not accepted.')}`}
          {cd.deliveries.length > 0 && <div className="text-[11px] mt-1">{tx('Entregas', 'Deliveries')}: {cd.deliveries.map(d => `${d.folio} (${ymd(d.date)} · ${acceptLabel(d.acceptance_status, en)})`).join(' · ')}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="font-bold text-slate-600">{tx('Facturas registradas', 'Recorded invoices')}:</span>
          {cd.invoices.map(v => <button key={v.id} type="button" aria-pressed={cur?.id === v.id} onClick={() => setInvSel(v.id)} className={`px-3 py-2 rounded-xl border text-left ${cur?.id === v.id ? 'border-purple-500 bg-purple-50/50' : 'border-slate-200 hover:border-purple-300 bg-white'}`}><span className="block font-black">{v.folio} · {v.invoice_number}</span><span className="block text-slate-500">{money(v.total_amount, v.currency, en)} · {statusText(v, en)}</span></button>)}
          {!cd.invoices.length && <span className="text-slate-500">{tx('ninguna todavía.', 'none yet.')}</span>}
          {cur && <span className="font-bold"><button type="button" onClick={() => setInvSel('')} className="px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">+ {tx('Nueva factura', 'New invoice')}</button></span>}
        </div>
      </div>}

      <div className="p-4 sm:p-5 border border-dashed border-slate-300 rounded-2xl bg-slate-50/40 space-y-3">
        <div><span className="block text-xs font-black text-slate-900">{tx('Archivo de la factura', 'Invoice file')}{cur ? '' : ' *'}</span><span className="block text-[10px] text-slate-500 mt-0.5">{tx('Adjunta el archivo de la factura. Se permiten PDF, XML o imagen (máx. 10 MB). Se revisa en tu navegador; no se sube mientras el registro esté bloqueado.', 'Attach the invoice file. PDF, XML or image allowed (max 10 MB). It is checked in your browser; it is not uploaded while recording is blocked.')}</span></div>
        <input ref={fileRef} type="file" aria-label={tx('Archivo de la factura', 'Invoice file')} accept={[...FILE_TYPES, '.pdf', '.xml', '.png', '.jpg', '.jpeg'].join(',')} onChange={e => setF('file', e.target.files?.[0] || null)} className="block w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-2 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:text-slate-700 file:font-semibold" />
        <div data-testid="invoice-file" className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600">{form.file ? `${form.file.name} · ${form.file.type || tx('tipo desconocido', 'unknown type')} · ${fileSize(form.file.size)}` : cur?.file ? tx(`Archivo registrado (privado): ${fileText(cur.file)} · revisión ${cur.document_revision_number}. Su descarga sigue bloqueada; adjunta uno nuevo solo para reemplazarlo.`, `Recorded file (private): ${fileText(cur.file)} · revision ${cur.document_revision_number}. Downloading it stays blocked; attach a new one only to replace it.`) : tx('No se ha cargado ningún archivo de factura.', 'No invoice file has been loaded.')}</div>
        {tried && fv.errors.file && <p role="alert" className="text-[10.5px] text-rose-600 font-semibold">{fv.errors.file}</p>}
        <div className="flex flex-wrap gap-2 text-xs font-black"><button type="button" onClick={viewFile} disabled={!previewType(form.file)} title={form.file && !previewType(form.file) ? tx('Tipo de archivo no permitido', 'File type not allowed') : undefined} className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed">👁 {tx('Ver archivo', 'View file')}</button><button type="button" onClick={removeFile} disabled={!form.file} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">🗑 {tx('Quitar archivo', 'Remove file')}</button></div>
      </div>

      {tried && fv.warnings.map(w => <p key={w} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">{w}</p>)}
      {saveMsg && <p role={saveMsg.kind === 'error' ? 'alert' : 'status'} data-testid="invoice-save-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${saveMsg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : saveMsg.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{saveMsg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{saveMsg.text}</span></p>}
      <div className="flex flex-wrap gap-3 pt-1 text-sm font-black">
        <button type="button" onClick={saveInvoice} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">💾</span>{tx('Guardar factura', 'Save invoice')}</button>
        <button type="button" onClick={clearForm} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm flex items-center gap-2"><span aria-hidden="true">🧹</span>{tx('Limpiar', 'Clear')}</button>
        <button type="button" onClick={calcTotal} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2"><span aria-hidden="true">🧮</span>{tx('Calcular total', 'Calculate total')}</button>
        <button type="button" onClick={() => go(2)} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver matriz', 'View matrix')}</button>
      </div>
    </div>}

    {tab === 2 && <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 text-left space-y-5" data-testid="invoice-matrix">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de facturas', 'Invoice matrix')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Concentrado de facturas relacionadas con requisiciones, órdenes de compra y entregas aceptadas.', 'Invoices related to requisitions, purchase orders and accepted deliveries.')}</p></div>
        <span className="text-sm font-black"><button type="button" onClick={newInvoice} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md">+ {tx('Nueva factura', 'New invoice')}</button></span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div><h4 className="text-sm font-black text-slate-900">{tx('Facturas por cliente', 'Invoices by client')}</h4><p className="text-[11px] text-slate-500 mt-0.5">{tx('Selecciona un cliente para abrir únicamente la matriz de facturas de ese cliente.', 'Select a client to open only that client’s invoice matrix.')}</p></div>
        <span className="text-xs font-black self-start"><button type="button" onClick={backToClients} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-2xs">← {tx('Volver a clientes', 'Back to clients')}</button></span>
      </div>

      {!client && <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input type="search" aria-label={tx('Buscar cliente', 'Search client')} value={cardInput} onChange={e => setCardInput(e.target.value)} maxLength={120} placeholder={tx('Buscar cliente, factura, proyecto o RFC...', 'Search client, invoice, project or RFC...')} className="flex-1 min-w-0 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          <span data-testid="invoice-client-badge" className="px-3 py-1 bg-blue-50 text-blue-900 font-black text-[11px] rounded-full border border-blue-100 self-start sm:self-auto whitespace-nowrap">{cardsLd.data ? clientBadge(cardsLd.data.summary?.client_cards, en) : '…'}</span>
        </div>
        <Wait s={cardsLd} /><Err s={cardsLd} />
        {cardsLd.data && (cards.length ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map(c => <div key={c.id} data-testid="invoice-client-card" data-client={c.name} className="relative bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl" />
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br ${c.isAll ? 'from-fuchsia-600 via-purple-600 to-indigo-600' : 'from-fuchsia-600 to-purple-600'}`}>{c.tag}</div>
                <div className="min-w-0"><h5 className="font-black text-xs text-slate-900 uppercase tracking-tight truncate" title={c.name}>{c.name}</h5><p className="text-[11px] text-slate-400 font-medium truncate">{c.isAll ? tx('Vista general', 'Overview') : `RFC ${c.tax_id || tx('sin registrar', 'not recorded')}`}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-50/80 p-2 rounded-xl border border-slate-100 my-2">
                {[[c.invoices, tx('Facturas', 'Invoices'), 'text-slate-800'], [c.pending, tx('Pendientes', 'Pending'), 'text-amber-600'], [c.overdue, tx('Vencidas', 'Overdue'), 'text-rose-600'], [c.paid, tx('Pagadas', 'Paid'), 'text-emerald-600']].map(([n, l, tone]) => <div key={l} className="flex items-baseline gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-100 min-w-0"><span className={`text-sm font-black tabular-nums ${tone}`}>{n}</span><span className="text-[9.5px] font-bold text-slate-500 uppercase truncate">{l}</span></div>)}
              </div>
              <div className="space-y-0.5 text-[10.5px]">
                {cardMoney(c, en).map(m => <div key={m.currency} className="flex flex-wrap justify-between gap-x-2"><span className="font-bold text-slate-700 tabular-nums">{m.invoiced}</span>{m.outstanding && <span className="text-amber-700 font-semibold">{tx('Por cobrar', 'Outstanding')} {m.outstanding}</span>}</div>)}
                {!cardMoney(c, en).length && <div className="text-slate-400">{tx('Sin facturado vigente', 'No active invoiced amount')}</div>}
                <div className="text-slate-400 truncate" title={c.projects || ''}>{c.requisitions} {tx('requisición(es)', 'requisition(s)')}{c.cancelled ? ` · ${c.cancelled} ${tx('cancelada(s)', 'cancelled')}` : ''}{c.projects ? ` · ${c.projects}` : ''}</div>
              </div>
            </div>
            <span className="text-[11px] font-bold"><button type="button" aria-label={`${tx('Abrir matriz', 'Open matrix')}: ${c.name}`} onClick={() => openClient(c)} className="flex items-center justify-between w-full pt-2 text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-3 group-hover:underline"><span>{c.isAll ? tx('Abrir todas', 'Open all') : tx('Abrir matriz', 'Open matrix')}</span><span className="text-xs">➔</span></button></span>
          </div>)}
        </div> : <div data-testid="invoice-cards-empty" className="p-8 border border-dashed border-slate-300 rounded-2xl bg-slate-50/40 text-center text-sm text-slate-600">{cardsEmpty(cardsLd.data.summary?.client_cards, cardQ, en)}</div>)}
      </div>}

      {client && <div className="space-y-4">
        <div data-testid="invoice-client-head" className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-purple-200 bg-purple-50/50">
          <div className="w-10 h-10 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-fuchsia-600 to-purple-600">{client.tag}</div>
          <div className="min-w-0 flex-1"><h4 className="text-sm font-black text-slate-900">{client.name} · {tx('Matriz de facturas', 'Invoice matrix')}</h4><p className="text-[11px] text-slate-600 mt-0.5">{clientCaption(client, en)}</p></div>
        </div>
        <div className="flex flex-wrap gap-3"><div className="relative flex-1 min-w-[240px]"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar', 'Search')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar factura, UUID, requisición, OC o proyecto...', 'Search invoice, UUID, requisition, PO or project...')} className="w-full pl-9 pr-3 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" /></div>
          <select aria-label={tx('Estatus', 'Status')} value={state} onChange={e => { setState(e.target.value); setPage(1); }} className="px-3 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800"><option value="all">{tx('Todos los estatus', 'All statuses')}</option><option value="active">{tx('Vigentes', 'Active')}</option>{['pending', 'overdue', 'paid', 'cancelled'].map(s => <option key={s} value={s}>{stateLabel(s, en)} ({list.data?.summary?.states?.find(x => x.code === s)?.count ?? 0})</option>)}</select></div>
        <Wait s={list} /><Err s={list} />
        <p className="text-[11px] text-slate-500">{tx('Facturado vigente', 'Active invoiced')}: {(list.data?.summary?.money || []).map(m => `${money(m.amount, m.currency, en)} (${m.invoices})`).join('  |  ') || DASH}</p>
        {table([...H, tx('Acciones', 'Actions')], (list.data?.items || []).map(v => invRow(v)), q || state !== 'all' ? tx('Ninguna factura coincide con la búsqueda o el estatus.', 'No invoice matches the search or status.') : tx('Este cliente no tiene facturas registradas.', 'This client has no recorded invoices.'))}
        {pager(list)}
      </div>}
    </div>}

    {del && <div role="dialog" aria-modal="true" aria-label={tx('Eliminar factura', 'Delete invoice')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setDel(null)}>
      <div data-testid="invoice-delete" className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 text-left" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-rose-700">{tx('Eliminar factura', 'Delete invoice')} {del.folio}</h3><button type="button" aria-label={tx('Cerrar', 'Close')} onClick={() => setDel(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-slate-600">{del.invoice_number} · {del.requisition} · {money(del.total_amount, del.currency, en)} · {statusText(del, en)}</p>
        {delBlock ? <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{delBlock}</p> : <>
          <label className="block"><span className="block text-[11px] font-black text-slate-900 mb-1.5">{tx(`Escribe el número de factura (${del.invoice_number}) para confirmar`, `Type the invoice number (${del.invoice_number}) to confirm`)}</span><input type="text" aria-label={tx('Número de factura a eliminar', 'Invoice number to delete')} value={delNum} onChange={e => { setDelNum(e.target.value); setDelMsg(null); }} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
          <label className="block"><span className="block text-[11px] font-black text-slate-900 mb-1.5">{tx('Motivo', 'Reason')} *</span><textarea rows={3} aria-label={tx('Motivo de la eliminación', 'Deletion reason')} value={delReason} maxLength={520} onChange={e => { setDelReason(e.target.value); setDelMsg(null); }} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
        </>}
        {delMsg && <p role={delMsg.kind === 'error' ? 'alert' : 'status'} data-testid="invoice-delete-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${delMsg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{delMsg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{delMsg.text}</span></p>}
        <div className="flex flex-wrap justify-end gap-2 text-xs font-black"><button type="button" onClick={() => setDel(null)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">{tx('Cancelar', 'Cancel')}</button>{!delBlock && <button type="button" onClick={tryDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl">{tx('Eliminar', 'Delete')}</button>}</div>
      </div>
    </div>}

    {tab === 3 && <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 text-left space-y-5" data-testid="invoice-control">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Control de facturación y cierre', 'Billing control and closing')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('El proceso llega al 100% cuando la factura está registrada y no se encuentra cancelada.', 'The process reaches 100% when the invoice is recorded and not cancelled.')}</p></div>
        <span className="text-sm font-black self-start sm:self-auto"><button type="button" onClick={() => go(2)} className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-2xs flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver facturas', 'View invoices')}</button></span>
      </div>
      <Wait s={ctrl} /><Err s={ctrl} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{controlCards(ctrl.data?.counters, ctrl.data?.money || [], en).map(c => <div key={c.key} data-testid={`metric-${c.key}`} className="bg-white border border-slate-200/80 rounded-2xl px-4 pb-4 pt-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[118px]">
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${c.bar}`} />
        <div>{Array.isArray(c.value) ? (ctrl.data ? c.value.map(v => <div key={v} className={`font-black text-slate-900 leading-tight tabular-nums whitespace-nowrap ${c.value.length > 1 ? 'text-[15px]' : 'text-2xl'}`}>{v}</div>) : <span className="text-2xl font-black text-slate-900">…</span>) : <span className="text-2xl font-black text-slate-900 leading-none tabular-nums">{ctrl.data ? c.value : '…'}</span>}</div>
        <div className="mt-2"><p className="text-[11px] text-slate-500 font-medium leading-tight">{c.title}</p><p className={`text-[10.5px] font-black leading-tight mt-1.5 ${c.tone}`}>{c.sub}</p></div>
      </div>)}</div>

      {ctrl.data && <div className="space-y-5">
        <div className="space-y-3">
          <div className="pb-3 border-b border-slate-100"><h4 className="text-sm sm:text-base font-black text-slate-900">{tx('Entregas aceptadas pendientes de factura', 'Accepted deliveries pending invoice')}</h4><p className="text-[11px] text-slate-500 mt-0.5">{tx('Selecciona FACTURAR para abrir el registro con el expediente relacionado.', 'Select INVOICE to open the registration with the related file.')}</p></div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80"><table className="w-full text-left border-collapse text-[11px] min-w-[760px]"><thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">{[tx('Requisición', 'Requisition'), tx('Cliente', 'Client'), tx('Proyecto', 'Project'), 'OC', tx('Entrega aceptada', 'Accepted delivery'), tx('Acción', 'Action')].map(h => <th key={h} className="py-3 px-3 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">{ctrl.data.ready_to_invoice.map(r => <tr key={r.id} data-folio={r.folio} className="align-top hover:bg-slate-50/60">
              <td className="py-3 px-3 font-black whitespace-nowrap">{r.folio}</td><td className="py-3 px-3">{r.client_name}</td><td className="py-3 px-3">{show(r.project)}</td>
              <td className="py-3 px-3 whitespace-nowrap">{poList(r.purchase_orders).map(p => <div key={p}>{p}</div>)}{!poList(r.purchase_orders).length && DASH}</td>
              <td className={`py-3 px-3 ${r.accepted_on ? 'whitespace-nowrap' : 'text-slate-500'}`}>{acceptedText(r.accepted_on, en)}</td>
              <td className="py-3 px-3"><span className="text-[11px] font-black"><button type="button" aria-label={`${tx('Facturar', 'Invoice')} ${r.folio}`} onClick={() => invoiceReq(r)} className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-lg shadow-sm">{tx('FACTURAR', 'INVOICE')}</button></span></td>
            </tr>)}{!ctrl.data.ready_to_invoice.length && <tr><td colSpan={6} className="py-10 text-center text-xs text-slate-500">{tx('No hay entregas aceptadas pendientes de factura.', 'No accepted deliveries pending invoice.')}</td></tr>}</tbody></table></div>
        </div>
        {ctrl.data.overdue.length > 0 && <div className="space-y-2"><h4 className="text-sm font-black text-rose-700">{tx('Facturas vencidas', 'Overdue invoices')}</h4>{table(H, ctrl.data.overdue.map(v => invRow(v, false)), tx('No hay facturas vencidas.', 'No overdue invoices.'))}</div>}
        <p className="text-[11px] text-slate-500">{tx('Saldo por cobrar', 'Outstanding')}: {moneyList(ctrl.data.money, 'outstanding', en).join('  |  ') || DASH} · {tx('Vencido', 'Overdue')}: {moneyList(ctrl.data.money, 'overdue', en).join('  |  ') || DASH}</p>
        <p className="text-[10px] text-slate-400">{tx('Listos para facturar: requisiciones recibidas al 100 % y aceptadas por el cliente, sin factura vigente (misma regla que el Semáforo de Recepción). Vencida: vigente, no pagada y con vencimiento anterior a hoy. Los montos nunca se suman entre monedas y excluyen facturas canceladas.', 'Ready to invoice: requisitions 100% received and accepted by the client, without an active invoice (same rule as the Reception traffic light). Overdue: active, unpaid and due before today. Amounts are never summed across currencies and exclude cancelled invoices.')}</p>
      </div>}
    </div>}

    {view && <div role="dialog" aria-modal="true" aria-label={tx('Detalle de factura', 'Invoice detail')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setView('')}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black">{tx('Factura', 'Invoice')} {det.data?.item?.folio || ''}</h3><button type="button" aria-label={tx('Cerrar', 'Close')} onClick={() => setView('')} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <Wait s={det} /><Err s={det} />
        {det.data && <div data-testid="invoice-detail" className="space-y-3 text-xs">
          <div className="flex flex-wrap gap-2 items-center">{pill(det.data.item)}<span className="text-slate-500">{det.data.item.invoice_number} · {show(det.data.item.fiscal_uuid)}</span></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[[tx('Requisición', 'Requisition'), det.data.item.requisition], [tx('Cliente', 'Client'), det.data.item.client_name], [tx('Emisión', 'Issued'), ymd(det.data.item.issue_date)], [tx('Vencimiento', 'Due'), ymd(det.data.item.due_date)], ['Subtotal', money(det.data.item.subtotal_amount, det.data.item.currency, en)], [tx('Impuestos', 'Taxes'), money(det.data.item.tax_amount, det.data.item.currency, en)], ['Total', money(det.data.item.total_amount, det.data.item.currency, en)], [tx('Conciliación', 'Reconciliation'), det.data.item.reconciliation_status]].map(([k, v]) => field(k, v))}</div>
          <div><strong>{tx('Órdenes de compra', 'Purchase orders')}:</strong> {det.data.purchase_orders.map(p => `${p.folio}${p.version_number > 1 ? ` Rev. ${p.version_number - 1}` : ''}${p.is_primary ? ` (${tx('principal', 'primary')})` : ''} · ${show(p.supplier_name)}`).join(' · ') || DASH}</div>
          <div className="space-y-1"><strong>{tx('Acuses del cliente', 'Client acknowledgments')}</strong>{det.data.acknowledgments.map((a, i) => <div key={i} className="p-2 rounded-xl border border-emerald-200 bg-emerald-50/40">🔒 {show(a.signer)} · {show(a.signer_role)} · {ymd(a.acknowledged_on)} · {show(a.method)} · {show(a.integrity)}{a.document_sha256 && <span className="font-mono text-[10px] text-slate-500"> · SHA-256 {a.document_sha256.slice(0, 12)}…</span>}</div>)}{!det.data.acknowledgments.length && <p className="text-slate-400">{tx('Sin acuses registrados.', 'No acknowledgments recorded.')}</p>}</div>
          <div className="text-[11px] text-slate-500">{tx('Archivo', 'File')}: {fileText(det.data.item.file)} — {tx('privado, sin descarga en este modo.', 'private, no download in this mode.')}</div>
        </div>}
      </div>
    </div>}
  </div>;
}
