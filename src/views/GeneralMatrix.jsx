import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Eye, X, FileText, Printer, FileDown,
  AlertTriangle, LockKeyhole, CheckCircle2, ClipboardList, Loader2,
} from 'lucide-react';
import { matrixDetail } from '../matrixApi';
import { useMatrixData } from './generalMatrix/useMatrixData';
import {
  P2P_STAGES, PENDING_STAGE, localToday, riskOf, RISKS, stageLabel, clientCards, filterCards, filterRows,
  stageCounts, DOC_FILTERS, money, projectLine, matrixCsv, matrixPrintHtml,
} from './generalMatrix/model.mjs';

const DOC_GROUPS = [
  ['reviews', 'Revisiones', 'Reviews'],
  ['rfqs', 'Solicitudes a proveedores (RFQ)', 'Supplier RFQs'],
  ['supplier_quotes', 'Cotizaciones de proveedor', 'Supplier quotes'],
  ['customer_quotes', 'Cotizaciones al cliente / versiones', 'Customer quotes / versions'],
  ['purchase_orders', 'Órdenes de compra / versiones', 'Purchase orders / versions'],
  ['receipts', 'Recepciones', 'Receipts'],
  ['deliveries', 'Entregas', 'Deliveries'],
  ['invoices', 'Facturas', 'Invoices'],
];

function show(value) { return value == null || value === '' ? '—' : String(value); }
function amount(value, currency, en) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${value} ${currency || ''}`.trim();
  const text = new Intl.NumberFormat(en ? 'en-US' : 'es-MX', { maximumFractionDigits: 6 }).format(numeric);
  return `${text} ${currency || ''}`.trim();
}
function ymd(value) {
  return value ? String(value).slice(0, 10) : '—';
}
function Message({ error, en }) {
  if (!error) return null;
  return <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm flex items-center gap-2">
    <AlertTriangle size={17}/>{error.status === 401 ? (en ? 'Your session expired. Sign in again.' : 'Tu sesión expiró. Inicia sesión nuevamente.') : error.message}
  </div>;
}
function InfoPair({ label, children }) {
  return <div><dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</dt><dd className="text-sm text-slate-800 mt-1 break-words">{children || '—'}</dd></div>;
}
function Details({ id, en, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);setError(null);setData(null);
    matrixDetail(id, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(err => { if (!controller.signal.aborted) setError(err); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [id]);
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const row = data?.item;
  const lines = data?.lines || [];
  const documents = data?.documents || {};
  return <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/60" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={en ? 'Requisition details' : 'Detalle de requisición'} className="bg-white h-full w-full max-w-3xl overflow-y-auto shadow-2xl">
      <div className="sticky top-0 z-10 bg-slate-900 text-white p-5 flex justify-between items-center">
        <div className="min-w-0"><h2 className="font-bold text-lg truncate">{en ? 'Requisition details' : 'Detalle de requisición'} · {row?.folio || '…'}</h2><p className="text-xs text-slate-300">{en ? 'Read-only · MariaDB' : 'Solo consulta · MariaDB'}</p></div>
        <button type="button" className="p-2 rounded-lg hover:bg-slate-700" aria-label={en ? 'Close details' : 'Cerrar detalle'} onClick={onClose}><X size={22}/></button>
      </div>
      <div className="p-5 space-y-6">
        {busy && <p className="text-sm text-slate-500">{en ? 'Loading real details...' : 'Consultando detalle real...'}</p>}
        <Message error={error} en={en}/>
        {row && <>
          <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 rounded-xl border p-4">
            {row.source_type === 'supplyflow_v07_draft' && <div className="sm:col-span-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 font-semibold text-sm">{en ? 'New v0.7 draft; not formally approved or released.' : 'Borrador nuevo v0.7; sin aprobación ni liberación formal.'}</div>}
            <InfoPair label={en ? 'Client' : 'Cliente'}>{show(row.client_name)}</InfoPair>
            <InfoPair label={en ? 'Requester' : 'Solicitante'}>{show(row.requester_name)}</InfoPair>
            <InfoPair label={en ? 'Date' : 'Fecha solicitud'}>{ymd(row.request_date)}</InfoPair>
            <InfoPair label={en ? 'Required by' : 'Fecha requerida'}>{ymd(row.need_date)}</InfoPair>
            <InfoPair label={en ? 'Project' : 'Proyecto'}>{show(row.project)}</InfoPair>
            <InfoPair label={en ? 'Contract' : 'Contrato'}>{show(row.contract_reference)}</InfoPair>
            <InfoPair label={en ? 'Priority' : 'Prioridad'}>{show(row.priority_code)}</InfoPair>
            <InfoPair label={en ? 'Budget (not actual spending)' : 'Presupuesto (no gasto real)'}>{amount(row.budget_amount, row.currency_code, en)}</InfoPair>
            <InfoPair label={en ? 'Client reference' : 'Referencia cliente'}>{show(row.client_reference)}</InfoPair>
            <InfoPair label={en ? 'Delivery location' : 'Lugar de entrega'}>{show(row.delivery_place)}</InfoPair>
            <div className="sm:col-span-2"><InfoPair label={en ? 'Description' : 'Descripción'}>{show(row.description)}</InfoPair></div>
            {row.notes && <div className="sm:col-span-2"><InfoPair label={en ? 'Notes' : 'Notas'}>{row.notes}</InfoPair></div>}
          </div>
          <section className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><ClipboardList size={18}/>{en ? 'Requisition lines' : 'Partidas de requisición'} ({lines.length})</h3>
            <div className="border rounded-xl overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-700"><tr><th className="p-3">#</th><th className="p-3">{en ? 'Description' : 'Descripción'}</th><th className="p-3">{en ? 'Quantity' : 'Cantidad'}</th><th className="p-3">{en ? 'Status' : 'Estatus'}</th></tr></thead><tbody>{lines.map(line => <tr key={line.id} className="border-t align-top"><td className="p-3">{line.line_number}</td><td className="p-3 min-w-[230px]">{line.description}</td><td className="p-3 whitespace-nowrap">{amount(line.quantity, line.unit_label, en)}</td><td className="p-3">{show(line.line_status)}</td></tr>)}</tbody></table>{!lines.length && <div className="p-4 text-sm text-slate-500">{en ? 'No lines linked.' : 'Sin partidas vinculadas.'}</div>}</div>
          </section>
          <section className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileText size={18}/>{en ? 'Related document records' : 'Registros documentales vinculados'}</h3>
            {DOC_GROUPS.map(([key, es, english]) => {
              const group = documents[key] || [];
              return <div className="border rounded-xl overflow-hidden" key={key}>
                <div className="px-4 py-3 flex justify-between items-center bg-slate-50 border-b"><h4 className="font-semibold text-slate-800 text-sm">{en ? english : es}</h4><span className="text-xs text-slate-500">{group.length}</span></div>
                {group.length ? <div className="divide-y">{group.map((doc,i) => <div key={`${key}-${doc.id ?? i}`} className="px-4 py-3 text-sm flex flex-wrap gap-3 justify-between items-start"><div><p className="font-semibold">{show(doc.folio)}</p><p className="text-xs text-slate-500">{show(doc.supplier || doc.strategy)} {doc.date && `· ${ymd(doc.date)}`}</p>{doc.legacy_status && <p className="text-xs text-slate-500">{en ? 'Legacy' : 'Legado'}: {doc.legacy_status}</p>}</div><div className="text-right"><div className="text-slate-700">{show(doc.status)}</div>{doc.approval_status && <p className="text-xs text-slate-500">{en ? 'Approval' : 'Aprobación'}: {doc.approval_status}</p>}{doc.internal_approval_status && <p className="text-xs text-slate-500">{en ? 'Internal approval' : 'Aprobación interna'}: {doc.internal_approval_status}</p>}{doc.client_decision_status && <p className="text-xs text-slate-500">{en ? 'Client decision' : 'Decisión cliente'}: {doc.client_decision_status}</p>}{doc.amount != null && <div className="font-semibold">{amount(doc.amount, doc.currency, en)}</div>}{doc.capture_grain === 'legacy_header_only' && <p className="text-xs text-amber-700">{en ? 'Legacy header-only receipt' : 'Recepción histórica solo de cabecera'}</p>}</div></div>)}</div> : <div className="px-4 py-3 text-xs text-slate-400">{en ? 'No linked records in operational tables.' : 'Sin registros vinculados en las tablas operativas.'}</div>}
              </div>;
            })}
          </section>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <h4 className="font-bold text-amber-900 text-sm flex gap-2 items-center"><AlertTriangle size={17}/>{en ? 'Limits of the migrated history' : 'Limitaciones del histórico migrado'}</h4>
            {(en ? [
              'Milestones indicate existing linked documents; they do not prove workflow approval or completion.',
              'Unresolved source references remain under reconciliation and are not shown as confirmed links.',
              'Legacy receipts may have only header percentages, without confirmed received quantities by line.',
              'Private PDF files and signatures are not downloadable in this release.',
            ] : data.notes).map((note,i) => <p className="text-xs text-amber-900" key={i}>{note}</p>)}
          </div>
        </>}
      </div>
    </section>
  </div>;
}

// ---------------------------------------------------------------------------------------------------------
// Matriz General · diseño Grupo Gerez (tarjetas por cliente + matriz consolidada) conectado a MariaDB.
// Fuentes (solo GET): /matrix/clients, /matrix/requisitions (todas las páginas de 50) y /recovery/matrix
// (etapas de la política apps-script-eight-stage-matrix). Sin datos de demostración. "Emitir OC" bloqueado:
// la emisión de OC no está habilitada en el backend (escrituras comerciales aún sin validación integral).
const PAGE = 25;
const STAGE_BADGE = ['bg-emerald-100 text-emerald-800', 'bg-slate-100 text-slate-700', 'bg-sky-100 text-sky-800', 'bg-blue-100/80 text-blue-900', 'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800', 'bg-slate-200 text-slate-800'];
const RISK_BADGE = { overdue: 'bg-blue-100 text-blue-700', on_time: 'bg-emerald-100 text-emerald-700', no_date: 'bg-amber-100 text-amber-800', delivered: 'bg-teal-100 text-teal-700', closed: 'bg-slate-100 text-slate-700', pending: 'bg-amber-100 text-amber-800' };
const pill = 'px-2.5 py-1 rounded-full text-[10px] font-bold inline-block whitespace-nowrap';
const RefList = ({ items }) => (items && items.length ? <div className="whitespace-pre leading-tight">{items.join('\n')}</div> : <span className="text-slate-400">—</span>);

export function GeneralMatrix({ lang = 'es', language, isEnglish, onNotify }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const notify = (title, message, type = 'info') => { if (typeof onNotify === 'function') onNotify(title, message, type); };
  const [revision, setRevision] = useState(0);
  const [detailId, setDetailId] = useState(null);
  const { clients, reqs, stages, rows, ready, stagesDenied } = useMatrixData(revision);

  const day = localToday();
  const cards = useMemo(() => clientCards(clients.items, rows, day), [clients.items, rows, day]);
  const [cardTerm, setCardTerm] = useState('');
  const shownCards = useMemo(() => filterCards(cards.items, cardTerm), [cards.items, cardTerm]);
  const [selected, setSelected] = useState(null);
  const [term, setTerm] = useState('');
  const [stage, setStage] = useState('all');
  const [doc, setDoc] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [selected, term, stage, doc]);
  const scope = useMemo(() => filterRows(rows, { client: selected || 'ALL' }), [rows, selected]);
  const counts = useMemo(() => stageCounts(scope), [scope]);
  const visible = useMemo(() => filterRows(rows, { client: selected || 'ALL', term, stage, doc }), [rows, selected, term, stage, doc]);
  const lastPage = Math.max(1, Math.ceil(visible.length / PAGE));
  const pageRows = visible.slice((page - 1) * PAGE, page * PAGE);
  const current = selected && selected !== 'ALL' ? cards.items.find(c => c.id === selected) : null;
  const clientTitle = current?.name || tx('Todos los clientes', 'All clients');
  const num = v => (ready ? v : '…');
  const stop = e => e.stopPropagation();
  const open = (e, id) => { e.stopPropagation(); setSelected(id); };

  const exportCsv = e => {
    e.stopPropagation();
    if (!visible.length) { notify(tx('Exportar CSV', 'Export CSV'), tx('No hay requisiciones para este cliente o filtro.', 'No requisitions for this client or filter.'), 'warning'); return; }
    const url = URL.createObjectURL(new Blob([matrixCsv(visible, en, day)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `Matriz_${String(current?.code || 'GENERAL').replace(/[^\w-]+/g, '_')}_${day}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    notify(tx('Exportar CSV', 'Export CSV'), tx(`Se exportaron ${visible.length} requisiciones (generado en tu navegador).`, `${visible.length} requisitions exported (generated in your browser).`));
  };
  const print = e => {
    e.stopPropagation();
    if (!visible.length) { notify(tx('Imprimir', 'Print'), tx('No hay requisiciones para este cliente o filtro.', 'No requisitions for this client or filter.'), 'warning'); return; }
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { notify(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana de impresión; permite ventanas emergentes para este sitio.', 'The browser blocked the print window; allow pop-ups for this site.'), 'warning'); return; }
    w.document.write(matrixPrintHtml(visible, { en, clientTitle, day }));
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  };

  const renderCard = (item, isAll = false) => {
    const isSelected = selected === item.id;
    return <div key={item.id} role="button" tabIndex={0} aria-pressed={isSelected} aria-label={`${tx('Abrir matriz de', 'Open matrix for')} ${isAll ? tx('todos los clientes', 'all clients') : item.name}`}
      onClick={e => open(e, item.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e, item.id); } }}
      className={`group relative bg-white border rounded-2xl p-3.5 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-sm bg-gradient-to-b from-blue-50/30 to-white' : 'border-slate-200/90 hover:border-blue-300'}`}>
      <div>
        <div className="flex items-start gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">{isAll ? tx('TC', 'AC') : item.badge}</div>
          <div className="min-w-0 flex-1">
            <h4 title={isAll ? undefined : item.name} className="text-[11px] font-extrabold text-slate-800 leading-tight tracking-tight uppercase truncate group-hover:text-blue-600 transition-colors">{isAll ? tx('Todos los clientes', 'All clients') : item.name}</h4>
            {isAll ? <p className="text-[10px] text-slate-400 font-medium">{item.clients} {tx('clientes', 'clients')}</p> : <p className="text-[10px] text-slate-400 font-medium truncate">No. {item.code}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 py-1.5 border-y border-slate-100 mb-2">
          {[[item.requisitions, tx('Requisiciones', 'Requisitions')], [item.withPO, tx('Con OC', 'With PO')], [item.withInvoice, tx('Con factura', 'With Invoice')]].map(([n, label]) =>
            <div key={label} className="text-center"><span className="block text-sm font-black text-slate-800 tabular-nums">{num(n)}</span><span className="text-[9px] text-slate-400 block font-medium -mt-0.5 leading-tight">{label}</span></div>)}
        </div>
      </div>
      <div>
        {isAll
          ? <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5"><span>{num(item.overdue)} {tx('vencidas', 'overdue')}</span><span className="font-semibold text-slate-600" title={tx('Antigüedad promedio, desde la fecha de solicitud, de las requisiciones abiertas (sin factura).', 'Average age since request date of open requisitions (not invoiced).')}>{tx('Prom.', 'Avg.')} {ready ? (item.avgAge === null ? '—' : `${item.avgAge}d`) : '…'}</span></div>
          : <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 pt-0.5"><span>{num(item.projects)} {tx('proyectos', 'projects')} · {num(item.contracts)} {tx('contratos', 'contracts')}</span><span className="shrink-0">{num(item.overdue)} {tx('vencidas', 'overdue')}</span></div>}
        <div className="flex items-center justify-end text-[10px] font-bold text-slate-500 group-hover:text-blue-600 mt-2 transition-colors"><span>{isAll ? tx('Abrir todo', 'Open all') : tx('Abrir cliente', 'Open client')}</span><ChevronRight className="w-3 h-3 ml-0.5" /></div>
      </div>
    </div>;
  };

  return <>
    <div onClick={() => setSelected(null)} className="space-y-6 bg-slate-100/60 p-4 sm:p-6 rounded-3xl min-h-screen cursor-pointer">
      <div className="flex flex-wrap items-center justify-between gap-3 cursor-default" onClick={stop}>
        <div><h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{tx('Matriz general del proceso', 'General Process Matrix')}</h2><p className="text-xs text-slate-500 mt-0.5">{tx('Vista consolidada de cada requisición y sus documentos relacionados.', 'Consolidated view of each requisition and its related documents.')}</p></div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span>
          <button type="button" onClick={() => setRevision(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button>
        </div>
      </div>

      <div onClick={stop} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 cursor-default">
        <div><h3 className="text-sm font-bold text-slate-800">{tx('Matriz general por cliente', 'General Matrix by Client')}</h3><p className="text-xs text-slate-400">{tx('Selecciona un cliente para abrir su matriz consolidada. Haz clic en el fondo fuera de las tarjetas para cerrarla.', 'Select a client to open their consolidated matrix. Click the background outside the cards to close it.')}</p></div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="search" aria-label={tx('Buscar cliente', 'Search client')} placeholder={tx('Buscar cliente, proyecto, contrato o RFC...', 'Search client, project, contract, or RFC...')} value={cardTerm} onChange={e => setCardTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" /></div>
          <div className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-2 rounded-xl border border-blue-100 shrink-0 self-start sm:self-auto">{shownCards.length} {tx('de', 'of')} {cards.items.length} {tx('clientes', 'clients')}</div>
        </div>
        {clients.status === 'error' && <Message error={clients.error} en={en} />}
        {reqs.status === 'error' && <Message error={reqs.error} en={en} />}
        {reqs.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx(`Consultando requisiciones en MariaDB… ${reqs.items.length}${reqs.total ? ` de ${reqs.total}` : ''}`, `Loading requisitions from MariaDB… ${reqs.items.length}${reqs.total ? ` of ${reqs.total}` : ''}`)}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3.5 pt-2">
          {!cardTerm.trim() && renderCard(cards.all, true)}
          {shownCards.map(item => renderCard(item))}
        </div>
        {clients.status === 'ready' && cardTerm.trim() && !shownCards.length && <p className="text-xs text-slate-400 text-center py-4">{tx('Ningún cliente coincide con la búsqueda.', 'No client matches the search.')}</p>}
      </div>

      {selected !== null && <div onClick={stop} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 cursor-default" data-testid="client-matrix">
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="min-w-0"><h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{clientTitle} · {tx('Matriz general del proceso', 'General Process Matrix')}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{visible.length} {tx('requisiciones visibles', 'visible requisitions')}{ready ? '' : tx(' (cargando…)', ' (loading…)')} · {visible.filter(r => r.purchase_order_count > 0).length} {tx('con OC', 'with PO')} · {visible.filter(r => r.invoice_count > 0).length} {tx('con factura', 'with invoice')}</p></div>
          <button type="button" onClick={() => setSelected(null)} aria-label={tx('Cerrar matriz', 'Close matrix')} title={tx('Cerrar matriz', 'Close matrix')} className="inline-flex items-center justify-center text-xs font-semibold text-slate-700 hover:bg-slate-200 p-2 rounded-lg transition-colors cursor-pointer">❌</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 min-w-[min(100%,560px)] max-w-4xl">
            <input type="search" aria-label={tx('Buscar en la matriz', 'Search the matrix')} placeholder={tx('Buscar folio, cliente, proyecto, OC, proveedor...', 'Search folio, client, project, PO, supplier...')} value={term} onChange={e => setTerm(e.target.value)} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs" />
            <select aria-label={tx('Etapa', 'Stage')} value={stage} onChange={e => setStage(e.target.value)} className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs md:min-w-[200px]">
              <option value="all">{tx('Todas las etapas', 'All stages')}</option>
              {P2P_STAGES.map((s, i) => <option key={s[0]} value={String(i)}>{en ? s[1] : s[0]} ({counts.counts[i]})</option>)}
              {counts.pending > 0 && <option value={PENDING_STAGE}>{stageLabel(null, en)} ({counts.pending})</option>}
            </select>
            <select aria-label={tx('Documentos', 'Documents')} value={doc} onChange={e => setDoc(e.target.value)} className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs md:min-w-[180px]">
              {DOC_FILTERS.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto whitespace-nowrap">
            <button type="button" onClick={print} className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"><Printer className="w-3.5 h-3.5" />{tx('Imprimir', 'Print')}</button>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs shadow-emerald-600/20 cursor-pointer"><FileDown className="w-3.5 h-3.5" />{tx('Exportar CSV', 'Export CSV')}</button>
          </div>
        </div>
        {stagesDenied && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{tx('Las etapas requieren acceso al módulo de Requisiciones; el riesgo se estima con la fecha requerida y los documentos registrados.', 'Stages require access to the Requisitions module; risk is estimated from the required date and recorded documents.')}</p>}
        {stages.status === 'error' && !stagesDenied && <Message error={stages.error} en={en} />}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead><tr className="bg-slate-50/90 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <th className="py-3 px-2.5">{tx('Requisición', 'Requisition')}</th><th className="py-3 px-2.5">{tx('Cliente / Proyecto', 'Client / Project')}</th><th className="py-3 px-2.5 whitespace-nowrap">{tx('Folio interno', 'Internal folio')}</th>
              <th className="py-3 px-2.5 text-center">{tx('Cotizaciones', 'Quotes')}</th><th className="py-3 px-2.5">{tx('Proveedor ganador', 'Winning supplier')}</th><th className="py-3 px-2.5">{tx('OC', 'PO')}</th>
              <th className="py-3 px-2.5">{tx('Recepción', 'Reception')}</th><th className="py-3 px-2.5">{tx('Factura', 'Invoice')}</th><th className="py-3 px-2.5" title={tx('Presupuesto de la requisición; no es gasto real.', 'Requisition budget; not actual spending.')}>{tx('Monto', 'Amount')}</th>
              <th className="py-3 px-2.5 whitespace-nowrap">{tx('Fecha requerida', 'Required date')}</th><th className="py-3 px-2.5">{tx('Etapa', 'Stage')}</th>
              <th className="py-3 px-2.5 text-center sticky right-0 bg-slate-50 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">{tx('Riesgo / Acción', 'Risk / Action')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
              {pageRows.map(r => { const ref = r.references || {}; const risk = riskOf(r, day); return <tr key={r.id} className="hover:bg-slate-50/70 transition-colors align-top">
                <td className="py-3 px-2.5 whitespace-nowrap"><div className="font-black text-slate-900">{r.folio}</div>{r.client_reference && <div className="text-[9.5px] text-slate-400">{tx('Ref. cliente', 'Client ref.')}: {r.client_reference}</div>}{r.source_type === 'supplyflow_v07_draft' && <div className="text-[9.5px] text-amber-700 font-semibold">{tx('Borrador v0.7', 'Draft v0.7')}</div>}</td>
                <td className="py-3 px-2.5 min-w-[180px] max-w-[240px]"><p className="font-extrabold text-slate-800 leading-tight uppercase text-[10.5px]">{r.client_name}</p><p className="text-[9.5px] text-slate-400 font-medium mt-0.5">{projectLine(r, en) || '—'}</p></td>
                <td className="py-3 px-2.5 text-slate-500 whitespace-nowrap">{show(r.internal_reference)}</td>
                <td className="py-3 px-2.5 text-center"><div className="font-bold text-slate-800">{Number(r.supplier_quote_count) || 0}</div>{r.rfq_count > 0 && <div className="text-[9.5px] text-slate-400 whitespace-nowrap">RFQ {r.rfq_count}</div>}</td>
                <td className="py-3 px-2.5 text-slate-600 font-semibold text-[10.5px] min-w-[140px]"><RefList items={ref.winning_suppliers} />{ref.winning_supplier_source === 'award' && <div className="text-[9.5px] text-slate-400 font-medium">{tx('por adjudicación', 'by award')}</div>}</td>
                <td className="py-3 px-2.5 text-slate-600 font-medium text-[10px] whitespace-nowrap"><RefList items={ref.purchase_orders} /></td>
                <td className="py-3 px-2.5 text-slate-500 whitespace-nowrap"><RefList items={ref.receipts} /></td>
                <td className="py-3 px-2.5 text-slate-500 whitespace-nowrap"><RefList items={ref.invoices} /></td>
                <td className="py-3 px-2.5 font-bold text-slate-800 whitespace-nowrap">{money(r.budget_amount, r.currency_code, en)}</td>
                <td className="py-3 px-2.5 text-slate-600 font-semibold whitespace-nowrap">{ymd(r.need_date)}</td>
                <td className="py-3 px-2.5 whitespace-nowrap">{r.stage_index === undefined ? <span className="text-slate-400" title={tx('Etapa no disponible', 'Stage not available')}>—</span> : <span className={`${pill} ${r.stage_index === null ? 'bg-amber-100 text-amber-800' : STAGE_BADGE[r.stage_index]}`}>{stageLabel(r.stage_index, en)}</span>}</td>
                <td className="py-3 px-2.5 sticky right-0 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"><div className="flex flex-col items-stretch gap-1 whitespace-nowrap min-w-[96px]">
                  <span className={`${pill} text-center ${RISK_BADGE[risk]}`}>{RISKS[risk][en ? 1 : 0]}</span>
                  <button type="button" onClick={() => setDetailId(r.id)} className="px-2 py-1 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"><Eye className="w-3 h-3" />{tx('Ver', 'View')}</button>
                  <button type="button" disabled title={tx('Emisión de OC deshabilitada: las escrituras comerciales (RFQ, cotizaciones y OC) siguen bloqueadas hasta su validación integral.', 'PO issuance disabled: commercial writes (RFQ, quotes and POs) remain blocked until fully validated.')} className="px-2 py-1 bg-slate-200 text-slate-500 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-not-allowed"><LockKeyhole className="w-3 h-3" />{tx('Emitir OC', 'Issue PO')}</button>
                </div></td>
              </tr>; })}
              {!pageRows.length && <tr><td colSpan={12} className="py-8 text-center text-slate-400 text-xs font-semibold">{ready ? tx('No se encontraron requisiciones para este cliente o filtro seleccionado.', 'No requisitions found for this client or selected filter.') : tx('Consultando requisiciones…', 'Loading requisitions…')}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-between text-xs text-slate-600"><span>{tx('Página', 'Page')} {page} / {lastPage} · {visible.length} {tx('registros', 'records')}</span>
          <div className="flex gap-2"><button type="button" className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(n => Math.max(1, n - 1))} aria-label={tx('Anterior', 'Previous')}><ChevronLeft size={16} /></button><button type="button" className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(n => n + 1)} aria-label={tx('Siguiente', 'Next')}><ChevronRight size={16} /></button></div></div>
        <p className="text-[11px] text-slate-600 bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 items-start"><CheckCircle2 size={16} className="text-blue-600 shrink-0" /><span>{tx('Etapas calculadas por el servidor con la política de 8 etapas del proceso original. OC, recepción y factura excluyen documentos cancelados o sustituidos; el proveedor ganador es el de la OC vigente o, si aún no hay OC, el de la adjudicación. El monto es el presupuesto de la requisición, no gasto real. Las recepciones se vinculan mediante OC y no prueban cantidades recibidas por partida.', 'Stages computed by the server with the original eight-stage policy. PO, reception and invoice exclude cancelled or superseded documents; the winning supplier is the one on the current PO or, if there is no PO yet, the awarded one. Amount is the requisition budget, not actual spending. Receipts are linked through POs and do not prove quantities received per line.')}</span></p>
        <div className="text-[11px] text-amber-900 bg-amber-50 rounded-xl border border-amber-200 p-3 flex items-start gap-2"><LockKeyhole size={15} className="shrink-0" /><span>{tx('Solo consulta. Emitir OC, aprobar, editar y descargar adjuntos privados siguen deshabilitados; los documentos en conciliación (referencias faltantes) no se presentan como vínculos validados.', 'Read-only. Issuing POs, approving, editing and downloading private files remain disabled; documents under reconciliation (missing references) are not shown as validated links.')}</span></div>
      </div>}
    </div>
    {detailId && <Details id={detailId} en={en} onClose={() => setDetailId(null)} />}
  </>;
}
