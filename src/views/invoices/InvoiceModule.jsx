import React, { useEffect, useState } from 'react';
import { Lock, Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { listInvoices, invoiceDetail, invoiceRequisitions, invoiceContext, invoiceControl } from './api';
import { money, stateLabel, stateTone, statusText, daysOverdue, moneyList, controlCards, acceptLabel } from './model.mjs';

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

export function InvoiceModule({ lang = 'es', language, isEnglish }) {
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
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = id => { setTab(id); setPage(1); setInput(''); setQ(''); };
  const day = today();

  const list = useLoad(s => listInvoices({ page, q, state }, s), [page, q, state, rev], tab === 2);
  const reqs = useLoad(s => invoiceRequisitions(s), [rev], tab === 1);
  const ctx = useLoad(s => invoiceContext(reqId, s), [reqId, rev], tab === 1 && !!reqId);
  const ctrl = useLoad(s => invoiceControl(s), [rev], tab === 3);
  const det = useLoad(s => invoiceDetail(view, s), [view, rev], !!view);

  const Err = ({ s }) => (s?.error ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{s.error.message}</p> : null);
  const Wait = ({ s }) => (s?.status === 'loading' ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p> : null);
  const pill = inv => <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${stateTone(inv.state)}`}>{statusText(inv, en)}</span>;
  const lockBtn = t => <button type="button" disabled title={LOCK} className="px-3 py-1.5 bg-slate-200 text-slate-500 text-[11px] font-bold rounded-2xl flex items-center gap-1.5 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{t}</button>;
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
    {actions && <td className="py-2.5 px-3 whitespace-nowrap"><div className="flex gap-1"><button type="button" onClick={() => setView(v.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg">{tx('📄 Ver', '📄 View')}</button>{[tx('VER ARCHIVO', 'VIEW FILE'), tx('EDITAR', 'EDIT'), tx('ELIMINAR', 'DELETE')].map(t => <button key={t} type="button" disabled title={LOCK} className="px-2 py-1 bg-slate-100 text-slate-400 text-[9px] font-bold rounded-lg cursor-not-allowed">{t}</button>)}</div></td>}
  </tr>;
  const H = [tx('Factura', 'Invoice'), 'UUID', tx('Requisición', 'Requisition'), 'OC', tx('Cliente / Proyecto', 'Client / Project'), tx('Emisor', 'Issuer'), tx('Receptor', 'Receiver'), tx('Emisión', 'Issued'), tx('Vencimiento', 'Due'), 'Total', tx('Estatus', 'Status'), tx('Archivo', 'File')];
  const pager = st => { const last = Math.max(1, Math.ceil((st.data?.total || 0) / (st.data?.page_size || 25))); return <div className="flex justify-between items-center text-xs text-slate-600"><span>{st.data?.total ?? 0} {tx('facturas', 'invoices')} · {tx('Página', 'Page')} {page} / {last}</span><div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>; };
  const cur = ctx.data?.invoices?.find(v => v.id === invSel) || ctx.data?.invoices?.filter(v => v.state !== 'cancelled').at(-1) || ctx.data?.invoices?.at(-1) || null;

  return <div className="space-y-6 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{tx('Factura', 'Invoice')}</h2><p className="text-xs text-slate-500">{tx('Administración y seguimiento de facturación electrónica con datos de MariaDB.', 'Electronic invoicing administration and tracking from MariaDB.')}</p></div>
      <div className="flex items-center gap-2"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span><button type="button" onClick={() => setRev(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{tabs.map(([id, icon, title, desc]) => { const on = tab === id; return <button key={id} type="button" aria-pressed={on} onClick={() => go(id)} className={`p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${on ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-transparent shadow-md' : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800 shadow-2xs'}`}><div><div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 ${on ? 'bg-white/20 text-white' : 'bg-blue-50/80 text-blue-600 border border-blue-100'}`}>{icon}</div><h3 className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-900'}`}>{title}</h3><p className={`text-[10px] mt-1 leading-relaxed ${on ? 'text-purple-100' : 'text-slate-400'}`}>{desc}</p></div></button>; })}</div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    {tab === 1 && <div className={box}>{head(tx('Datos de la factura', 'Invoice data'), tx('La factura corresponde a la etapa 8 y debe relacionarse con una entrega aceptada por el cliente.', 'The invoice belongs to stage 8 and must relate to a delivery accepted by the client.'), <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2.5 py-1">{tx('Paso 8 • Factura', 'Step 8 • Invoice')}</span>)}
      <Wait s={reqs} /><Err s={reqs} />
      <div className="space-y-1"><label htmlFor="inv-req" className="text-[11px] font-bold text-slate-500">{tx('Requisición entregada y aceptada', 'Delivered and accepted requisition')}</label><select id="inv-req" value={reqId} onChange={e => { setReqId(e.target.value); setInvSel(''); }} className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700"><option value="">{tx('Seleccionar requisición...', 'Select requisition...')}</option>{(reqs.data?.items || []).map(r => <option key={r.id} value={r.id}>{r.folio} · {r.client_name} · {r.invoiced ? tx('facturada', 'invoiced') : r.ready ? tx('lista para facturar', 'ready to invoice') : tx('entrega/aceptación pendiente', 'delivery/acceptance pending')}</option>)}</select></div>
      {!reqId && <div className="bg-blue-50/70 border-l-4 border-blue-500 rounded-r-xl p-3 text-xs text-slate-600 font-medium">{tx('Selecciona una requisición entregada y aceptada para cargar su contexto.', 'Select a delivered and accepted requisition to load its context.')}</div>}
      <Wait s={ctx} /><Err s={ctx} />
      {ctx.data && <div data-testid="invoice-context" className="space-y-4">
        <div className={`border-l-4 rounded-r-xl p-3 text-xs font-medium ${ctx.data.readiness?.ready ? 'bg-emerald-50/70 border-emerald-500 text-emerald-800' : 'bg-amber-50/70 border-amber-500 text-amber-800'}`}>
          {ctx.data.requisition.folio} · {ctx.data.requisition.client_name} · {tx('OC', 'POs')}: {show(ctx.data.readiness?.purchase_orders)} — {ctx.data.readiness?.ready ? tx('Recibida al 100 % y aceptada por el cliente.', 'Received 100% and accepted by the client.') : `${ctx.data.readiness?.received ? '' : tx('Recepción incompleta. ', 'Incomplete receipt. ')}${ctx.data.readiness?.accepted ? '' : tx('Entrega no aceptada.', 'Delivery not accepted.')}`}
          {ctx.data.deliveries.length > 0 && <div className="text-[11px] mt-1">{tx('Entregas', 'Deliveries')}: {ctx.data.deliveries.map(d => `${d.folio} (${ymd(d.date)} · ${acceptLabel(d.acceptance_status, en)})`).join(' · ')}</div>}
        </div>
        {ctx.data.invoices.length > 1 && <div className="flex flex-wrap gap-2">{ctx.data.invoices.map(v => <button key={v.id} type="button" aria-pressed={cur?.id === v.id} onClick={() => setInvSel(v.id)} className={`px-3 py-2 rounded-xl border text-left text-[11px] ${cur?.id === v.id ? 'border-purple-500 bg-purple-50/50' : 'border-slate-200 hover:border-purple-300'}`}><div className="font-black">{v.folio} · {v.invoice_number}</div><div className="text-slate-500">{money(v.total_amount, v.currency, en)} · {statusText(v, en)}</div></button>)}</div>}
        {cur ? <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[[tx('Número de factura', 'Invoice number'), cur.invoice_number], [tx('UUID / Folio fiscal', 'UUID / Tax folio'), show(cur.fiscal_uuid)], [tx('Estatus', 'Status'), statusText(cur, en)]].map(([k, v]) => field(k, v))}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[[tx('Fecha de emisión', 'Issue date'), ymd(cur.issue_date)], [tx('Fecha de vencimiento', 'Due date'), ymd(cur.due_date)], [tx('Moneda', 'Currency'), cur.currency], [tx('Folio interno', 'Internal folio'), cur.folio]].map(([k, v]) => field(k, v))}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[[tx('Emisor / razón social', 'Issuer / legal name'), show(cur.issuer)], [tx('Receptor / razón social', 'Receiver / legal name'), show(cur.receiver)]].map(([k, v]) => field(k, v))}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[['Subtotal', money(cur.subtotal_amount, cur.currency, en)], [tx('Impuestos', 'Taxes'), money(cur.tax_amount, cur.currency, en)], ['Total', money(cur.total_amount, cur.currency, en)], [tx('Condiciones / método de pago', 'Terms / payment method'), show(cur.payment_terms)]].map(([k, v]) => field(k, v))}</div>
          {field(tx('Observaciones', 'Notes'), show(cur.notes))}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/30 text-xs"><strong>{tx('Archivo de la factura', 'Invoice file')}:</strong> {fileText(cur.file)} · {tx('revisión', 'revision')} {cur.document_revision_number}<div className="text-[10px] text-slate-400 mt-1">{tx('El archivo es privado; su consulta queda bloqueada en este modo.', 'The file is private; viewing it is blocked in this mode.')}</div></div>
        </> : <p className="text-xs text-amber-700 font-semibold">{tx('Esta requisición aún no tiene factura registrada.', 'This requisition has no invoice yet.')}</p>}
        <div className="flex flex-wrap gap-2">{lockBtn(tx('Guardar factura', 'Save invoice'))}{lockBtn(tx('Calcular total', 'Calculate total'))}<button type="button" onClick={() => go(2)} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl">{tx('Ver matriz', 'View matrix')}</button></div>
      </div>}
    </div>}

    {tab === 2 && <div className={box}>{head(tx('Matriz de facturas', 'Invoice matrix'), tx('Concentrado de facturas relacionadas con requisiciones, órdenes de compra y entregas aceptadas.', 'Invoices related to requisitions, purchase orders and accepted deliveries.'), lockBtn(tx('Nueva factura', 'New invoice')))}
      <div className="flex flex-wrap gap-3"><div className="relative flex-1 min-w-[240px]"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar', 'Search')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar factura, UUID, requisición, OC, cliente o proyecto...', 'Search invoice, UUID, requisition, PO, client or project...')} className="w-full pl-9 pr-3 p-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500" /></div>
        <select aria-label={tx('Estatus', 'Status')} value={state} onChange={e => { setState(e.target.value); setPage(1); }} className="p-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700"><option value="all">{tx('Todos los estatus', 'All statuses')}</option><option value="active">{tx('Vigentes', 'Active')}</option>{['pending', 'overdue', 'paid', 'cancelled'].map(s => <option key={s} value={s}>{stateLabel(s, en)} ({list.data?.summary?.states?.find(x => x.code === s)?.count ?? 0})</option>)}</select></div>
      <Wait s={list} /><Err s={list} />
      <p className="text-[11px] text-slate-500">{tx('Facturado vigente', 'Active invoiced')}: {(list.data?.summary?.money || []).map(m => `${money(m.amount, m.currency, en)} (${m.invoices})`).join('  |  ') || DASH}</p>
      {table([...H, tx('Acciones', 'Actions')], (list.data?.items || []).map(v => invRow(v)), tx('No hay facturas registradas.', 'No invoices recorded.'))}
      {pager(list)}
    </div>}

    {tab === 3 && <div className={box}>{head(tx('Control de facturación y cierre', 'Billing control and closing'), tx('El proceso llega al 100 % cuando la factura está registrada y no se encuentra cancelada.', 'The process reaches 100% when the invoice is recorded and not cancelled.'), <button type="button" onClick={() => go(2)} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl">{tx('Ver facturas', 'View invoices')}</button>)}
      <Wait s={ctrl} /><Err s={ctrl} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{controlCards(ctrl.data?.counters, ctrl.data?.money || [], en).map(c => <div key={c.key} data-testid={`metric-${c.key}`} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[110px]"><div className={`absolute top-0 left-0 right-0 h-1.5 ${c.bar} rounded-t-2xl`} /><div className="pt-1">{Array.isArray(c.value) ? c.value.map(v => <div key={v} className="text-sm font-black text-slate-900 leading-tight tabular-nums">{v}</div>) : <span className="text-2xl font-black text-slate-900 leading-none tabular-nums">{ctrl.data ? c.value : '…'}</span>}</div><div className="mt-2"><p className="text-[11px] text-slate-400 font-medium leading-tight">{c.title}</p></div></div>)}</div>
      {ctrl.data && <div className="space-y-4">
        <div className="space-y-2"><h4 className="text-xs font-black text-slate-800">{tx('Listos para facturar', 'Ready to invoice')}</h4>{table([tx('Requisición', 'Requisition'), tx('Cliente', 'Client'), tx('Órdenes de compra', 'Purchase orders')], ctrl.data.ready_to_invoice.map(r => <tr key={r.id}><td className="py-2.5 px-3 font-bold">{r.folio}</td><td className="py-2.5 px-3">{r.client_name}</td><td className="py-2.5 px-3">{r.purchase_orders}</td></tr>), tx('No hay entregas aceptadas pendientes de factura.', 'No accepted deliveries pending invoice.'), 'min-w-[480px]')}</div>
        <div className="space-y-2"><h4 className="text-xs font-black text-slate-800">{tx('Facturas vencidas', 'Overdue invoices')}</h4>{table(H, ctrl.data.overdue.map(v => invRow(v, false)), tx('No hay facturas vencidas.', 'No overdue invoices.'))}</div>
        <p className="text-[11px] text-slate-500">{tx('Saldo por cobrar', 'Outstanding')}: {moneyList(ctrl.data.money, 'outstanding', en).join('  |  ') || DASH} · {tx('Vencido', 'Overdue')}: {moneyList(ctrl.data.money, 'overdue', en).join('  |  ') || DASH}</p>
        <p className="text-[10px] text-slate-400">{tx('Vencida: vigente, no pagada y con fecha de vencimiento anterior a hoy. Los montos nunca se suman entre monedas y excluyen facturas canceladas.', 'Overdue: active, unpaid and due before today. Amounts are never summed across currencies and exclude cancelled invoices.')}</p>
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
