import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, X, FileText, Printer, FileDown,
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
// (etapa y avance de la política apps-script-eight-stage-matrix). Sin datos de demostración. Solo consulta:
// emitir OC, aprobar o editar siguen bloqueados (escrituras comerciales aún sin validación integral).
const PAGE = 50;
const STAGE_BADGE = ['bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-blue-100 text-blue-800', 'bg-blue-100 text-blue-800', 'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800', 'bg-teal-100 text-teal-800', 'bg-violet-100 text-violet-800'];
const RISK_BADGE = { overdue: 'bg-blue-100 text-blue-800', on_time: 'bg-emerald-100 text-emerald-700', no_date: 'bg-amber-100 text-amber-800', delivered: 'bg-teal-100 text-teal-700', closed: 'bg-slate-100 text-slate-700', pending: 'bg-amber-100 text-amber-800' };
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
  const close = e => { e?.stopPropagation(); setSelected(null); };

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
    const pct = item.avgProgress;
    return <div key={item.id} role="button" tabIndex={0} aria-pressed={isSelected} data-testid="matrix-client-card" aria-label={`${tx('Abrir matriz de', 'Open matrix for')} ${isAll ? tx('todos los clientes', 'all clients') : item.name}`}
      onClick={e => open(e, item.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e, item.id); } }}
      className={`group relative rounded-2xl border p-4 pl-5 cursor-pointer transition-all duration-200 flex flex-col gap-3 overflow-hidden hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isAll ? 'bg-gradient-to-br from-white via-white to-pink-50/70' : 'bg-white'} ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 shadow-sm' : 'border-slate-200/90 hover:border-blue-300'}`}>
      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-purple-600 to-pink-500" />
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">{isAll ? tx('ALL', 'ALL') : item.badge}</div>
        <div className="min-w-0 flex-1">
          <h4 title={isAll ? undefined : item.name} className={`text-[12.5px] font-black text-slate-900 leading-tight tracking-tight line-clamp-2 group-hover:text-blue-700 transition-colors ${isAll ? '' : 'uppercase'}`}>{isAll ? tx('Todos los clientes', 'All clients') : item.name}</h4>
          <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{isAll ? `${item.clients} ${tx('clientes', 'clients')}` : `No. ${item.code}`}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[[item.requisitions, tx('Requisiciones', 'Requisitions')], [item.withPO, tx('Con OC', 'With PO')], [item.withInvoice, tx('Con factura', 'With invoice')]].map(([n, label]) =>
          <div key={label} className="rounded-xl border border-slate-200/80 bg-white px-2 py-2 min-w-0"><span data-testid="card-num" className="block text-base font-black text-slate-900 tabular-nums">{num(n)}</span><span className="block text-[8.5px] text-slate-500 font-semibold leading-tight">{label}</span></div>)}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-600 font-medium">
        {isAll ? <><span>{num(item.overdue)} {tx('vencidas', 'overdue')}</span><span className="font-bold text-slate-700" title={tx('Avance promedio de las requisiciones según la etapa (política de 8 etapas).', 'Average requisition progress by stage (8-stage policy).')}>{tx('Prom.', 'Avg.')} {pct === null || pct === undefined ? '—' : `${num(pct)}%`}</span></>
          : <><span className="truncate">{num(item.projects)} {tx('proyectos', 'projects')} · {num(item.contracts)} {tx('contratos', 'contracts')}</span><span className="shrink-0">{num(item.overdue)} {tx('vencidas', 'overdue')}</span></>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-200/80 overflow-hidden" role="progressbar" aria-label={tx('Avance promedio', 'Average progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} title={pct === null || pct === undefined ? tx('Avance no disponible', 'Progress not available') : `${tx('Avance promedio', 'Average progress')}: ${pct}%`}>
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600" style={{ width: `${ready && pct ? Math.min(100, pct) : 0}%` }} /></div>
        <span className="text-[10.5px] font-black text-blue-700 whitespace-nowrap group-hover:text-purple-700">{isAll ? tx('Abrir todo', 'Open all') : tx('Abrir cliente', 'Open client')} →</span>
      </div>
    </div>;
  };

  return <>
    <div onClick={() => setSelected(null)} className="space-y-6 min-h-screen cursor-pointer" data-testid="matrix-page">
      <div onClick={stop} className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 cursor-default">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">{tx('Matriz general del proceso', 'General process matrix')}</h2><p className="text-xs text-slate-500 mt-0.5">{tx('Vista consolidada de cada requisición y sus documentos relacionados.', 'Consolidated view of each requisition and its related documents.')}</p></div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span>
            <span className="text-xs font-bold"><button type="button" onClick={() => setRevision(n => n + 1)} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-2xs flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button></span>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm sm:text-base font-black text-slate-900">{tx('Matriz general por cliente', 'General matrix by client')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Selecciona un cliente para abrir la matriz consolidada únicamente para ese cliente.', 'Select a client to open the consolidated matrix for that client only.')}</p></div>
          {selected !== null && <span className="text-xs font-black"><button type="button" onClick={close} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-2xs">← {tx('Volver a clientes', 'Back to clients')}</button></span>}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 text-sm"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="search" aria-label={tx('Buscar cliente', 'Search client')} placeholder={tx('Buscar cliente, proyecto, contrato o RFC...', 'Search client, project, contract or tax ID...')} value={cardTerm} onChange={e => setCardTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" /></div>
          <span className="px-3 py-1.5 bg-blue-50 text-blue-900 text-[11px] font-black rounded-full border border-blue-100 shrink-0 self-start sm:self-auto">{shownCards.length} {tx('de', 'of')} {cards.items.length} {tx('clientes', 'clients')}</span>
        </div>
        {clients.status === 'error' && <Message error={clients.error} en={en} />}
        {reqs.status === 'error' && <Message error={reqs.error} en={en} />}
        {reqs.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx(`Consultando requisiciones en MariaDB… ${reqs.items.length}${reqs.total ? ` de ${reqs.total}` : ''}`, `Loading requisitions from MariaDB… ${reqs.items.length}${reqs.total ? ` of ${reqs.total}` : ''}`)}</p>}
        <div className="max-h-[560px] overflow-y-auto pr-1 -mr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 p-0.5">
            {!cardTerm.trim() && renderCard(cards.all, true)}
            {shownCards.map(item => renderCard(item))}
          </div>
          {clients.status === 'ready' && cardTerm.trim() && !shownCards.length && <p className="text-xs text-slate-400 text-center py-4">{tx('Ningún cliente coincide con la búsqueda.', 'No client matches the search.')}</p>}
        </div>
      </div>

      {selected !== null && <div onClick={stop} className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 cursor-default" data-testid="client-matrix">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 to-purple-50/40">
          <div className="min-w-0"><h2 className="text-sm font-black text-slate-900 tracking-tight">{clientTitle} · {tx('Matriz general', 'General matrix')}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{visible.length} {tx('requisiciones visibles', 'visible requisitions')}{ready ? '' : tx(' (cargando…)', ' (loading…)')} · {visible.filter(r => r.purchase_order_count > 0).length} {tx('con OC', 'with PO')} · {visible.filter(r => r.invoice_count > 0).length} {tx('con factura', 'with invoice')}</p></div>
          <span className="text-xs font-black"><button type="button" onClick={close} aria-label={tx('Cambiar cliente', 'Change client')} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-2xs">← {tx('Cambiar cliente', 'Change client')}</button></span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="search" aria-label={tx('Buscar en la matriz', 'Search the matrix')} placeholder={tx('Buscar folio, cliente, proyecto, OC, proveedor...', 'Search folio, client, project, PO, supplier...')} value={term} onChange={e => setTerm(e.target.value)} className="flex-1 min-w-[260px] px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          <select aria-label={tx('Etapa', 'Stage')} value={stage} onChange={e => setStage(e.target.value)} className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-52">
            <option value="all">{tx('Todas las etapas', 'All stages')}</option>
            {P2P_STAGES.map((s, i) => <option key={s[0]} value={String(i)}>{en ? s[1] : s[0]} ({counts.counts[i]})</option>)}
            {counts.pending > 0 && <option value={PENDING_STAGE}>{stageLabel(null, en)} ({counts.pending})</option>}
          </select>
          <select aria-label={tx('Documentos', 'Documents')} value={doc} onChange={e => setDoc(e.target.value)} className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-56">
            {DOC_FILTERS.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}
          </select>
          <div className="flex items-center gap-2 text-sm font-black whitespace-nowrap">
            <button type="button" onClick={print} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-2xs"><Printer className="w-4 h-4" />{tx('Imprimir', 'Print')}</button>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20"><FileDown className="w-4 h-4" />{tx('Exportar CSV', 'Export CSV')}</button>
          </div>
        </div>
        {stagesDenied && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{tx('Las etapas requieren acceso al módulo de Requisiciones; el riesgo se estima con la fecha requerida y los documentos registrados.', 'Stages require access to the Requisitions module; risk is estimated from the required date and recorded documents.')}</p>}
        {stages.status === 'error' && !stagesDenied && <Message error={stages.error} en={en} />}
        <div className="overflow-auto max-h-[640px] rounded-2xl border border-slate-200/80 shadow-2xs">
          <table className="w-full text-left border-collapse min-w-[1280px]">
            <thead className="sticky top-0 z-10"><tr className="bg-slate-50 text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <th className="py-3 px-3">{tx('Requisición', 'Requisition')}</th><th className="py-3 px-3">{tx('Cliente / Proyecto', 'Client / Project')}</th><th className="py-3 px-3">{tx('Folio interno', 'Internal folio')}</th>
              <th className="py-3 px-3">{tx('Cotizaciones', 'Quotes')}</th><th className="py-3 px-3">{tx('Proveedor ganador', 'Winning supplier')}</th><th className="py-3 px-3">{tx('OC', 'PO')}</th>
              <th className="py-3 px-3">{tx('Recepción', 'Reception')}</th><th className="py-3 px-3">{tx('Factura', 'Invoice')}</th><th className="py-3 px-3" title={tx('Presupuesto de la requisición; no es gasto real.', 'Requisition budget; not actual spending.')}>{tx('Monto', 'Amount')}</th>
              <th className="py-3 px-3">{tx('Fecha requerida', 'Required date')}</th><th className="py-3 px-3">{tx('Etapa', 'Stage')}</th><th className="py-3 px-3">{tx('Riesgo', 'Risk')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {pageRows.map(r => { const ref = r.references || {}; const risk = riskOf(r, day); return <tr key={r.id} className="hover:bg-slate-50/70 transition-colors align-top">
                <td className="py-3.5 px-3 whitespace-nowrap"><span className="text-xs font-black"><button type="button" onClick={() => setDetailId(r.id)} aria-label={`${tx('Ver detalle de', 'View details of')} ${r.folio}`} title={tx('Ver detalle', 'View details')} className="text-slate-900 hover:text-blue-700 hover:underline text-left">{r.folio}</button></span>
                  {r.client_reference && r.client_reference !== r.folio && <div className="text-[10px] text-slate-400">{tx('Ref. cliente', 'Client ref.')}: {r.client_reference}</div>}{r.source_type === 'supplyflow_v07_draft' && <div className="text-[10px] text-amber-700 font-semibold">{tx('Borrador v0.7', 'Draft v0.7')}</div>}</td>
                <td className="py-3.5 px-3 min-w-[200px] max-w-[260px]"><p className="text-slate-800 leading-snug uppercase">{r.client_name}</p><p className="text-[10px] text-slate-500 mt-0.5">{projectLine(r, en) || '—'}</p></td>
                <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">{show(r.internal_reference)}</td>
                <td className="py-3.5 px-3"><div>{Number(r.supplier_quote_count) || 0}</div>{r.rfq_count > 0 && <div className="text-[10px] text-slate-400 whitespace-nowrap">RFQ {r.rfq_count}</div>}</td>
                <td className="py-3.5 px-3 min-w-[150px] uppercase"><RefList items={ref.winning_suppliers} />{ref.winning_supplier_source === 'award' && <div className="text-[10px] text-slate-400 normal-case">{tx('por adjudicación', 'by award')}</div>}</td>
                <td className="py-3.5 px-3 whitespace-nowrap"><RefList items={ref.purchase_orders} /></td>
                <td className="py-3.5 px-3 whitespace-nowrap"><RefList items={ref.receipts} /></td>
                <td className="py-3.5 px-3 whitespace-nowrap"><RefList items={ref.invoices} /></td>
                <td className="py-3.5 px-3 whitespace-nowrap">{money(r.budget_amount, r.currency_code, en)}</td>
                <td className="py-3.5 px-3 whitespace-nowrap">{ymd(r.need_date)}</td>
                <td className="py-3.5 px-3 whitespace-nowrap">{r.stage_index === undefined ? <span className="text-slate-400" title={tx('Etapa no disponible', 'Stage not available')}>—</span> : <span className={`${pill} ${r.stage_index === null ? 'bg-amber-100 text-amber-800' : STAGE_BADGE[r.stage_index]}`}>{stageLabel(r.stage_index, en)}</span>}</td>
                <td className="py-3.5 px-3 whitespace-nowrap"><span className={`${pill} ${RISK_BADGE[risk]}`}>{RISKS[risk][en ? 1 : 0]}</span></td>
              </tr>; })}
              {!pageRows.length && <tr><td colSpan={12} className="py-8 text-center text-slate-400 text-xs font-semibold">{ready ? tx('No se encontraron requisiciones para este cliente o filtro seleccionado.', 'No requisitions found for this client or selected filter.') : tx('Consultando requisiciones…', 'Loading requisitions…')}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-between text-xs text-slate-600"><span>{tx('Página', 'Page')} {page} / {lastPage} · {visible.length} {tx('registros', 'records')} · {tx('Haz clic en el folio para ver el detalle.', 'Click the folio to view details.')}</span>
          <div className="flex gap-2"><button type="button" className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(n => Math.max(1, n - 1))} aria-label={tx('Anterior', 'Previous')}><ChevronLeft size={16} /></button><button type="button" className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(n => Math.min(lastPage, n + 1))} aria-label={tx('Siguiente', 'Next')}><ChevronRight size={16} /></button></div></div>
        <p className="text-[11px] text-slate-600 bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 items-start"><CheckCircle2 size={16} className="text-blue-600 shrink-0" /><span>{tx('Etapas y avance calculados por el servidor con la política de 8 etapas del proceso original. OC, recepción y factura excluyen documentos cancelados o sustituidos; el proveedor ganador es el de la OC vigente o, si aún no hay OC, el de la adjudicación vigente.', 'Stages and progress computed by the server with the original 8-stage policy. PO, receipt and invoice exclude cancelled or superseded documents; the winning supplier is the current PO supplier or, without a PO yet, the current award.')}</span></p>
        <div className="text-[11px] text-amber-900 bg-amber-50 rounded-xl border border-amber-200 p-3 flex items-start gap-2"><LockKeyhole size={15} className="shrink-0" /><span>{tx('Solo consulta. Emitir OC, aprobar, editar y descargar adjuntos privados siguen deshabilitados; los documentos en conciliación (referencias faltantes) no se presentan como vínculos validados.', 'Read-only. Issuing POs, approving, editing and downloading private attachments remain disabled; documents under reconciliation (missing references) are not presented as validated links.')}</span></div>
      </div>}
    </div>
    {detailId && <Details id={detailId} en={en} onClose={() => setDetailId(null)} />}
  </>;
}
