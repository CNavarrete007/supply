import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Eye, X, FileText,
  AlertTriangle, LockKeyhole, CheckCircle2, ClipboardList, Building2,
} from 'lucide-react';
import { listMatrix, matrixClients, matrixDetail } from '../matrixApi';

const HAS_FILTERS = [
  ['all', 'Todos los documentos', 'All documents'],
  ['review', 'Con revisión', 'With review'],
  ['rfq', 'Con RFQ', 'With RFQ'],
  ['supplier_quote', 'Con oferta de proveedor', 'With supplier quote'],
  ['customer_quote', 'Con cotización al cliente', 'With customer quote'],
  ['purchase_order', 'Con OC', 'With purchase order'],
  ['receipt', 'Con recepción vinculada a OC', 'With PO-linked receipt'],
  ['delivery', 'Con entrega', 'With delivery'],
  ['invoice', 'Con factura', 'With invoice'],
  ['without_purchase_order', 'Sin OC vinculada', 'Without linked PO'],
];

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
function lastMilestone(row, en) {
  if (row?.source_type === 'supplyflow_v07_draft') return en ? 'Draft v0.7 · not approved' : 'Borrador v0.7 · sin aprobar';
  const names = [
    ['invoice_count', en ? 'Invoice recorded' : 'Factura registrada'],
    ['delivery_count', en ? 'Delivery recorded' : 'Entrega registrada'],
    ['receipt_count', en ? 'Receipt recorded' : 'Recepción registrada'],
    ['purchase_order_count', en ? 'PO linked' : 'OC vinculada'],
    ['customer_quote_count', en ? 'Customer quote recorded' : 'Cotización cliente registrada'],
    ['supplier_quote_count', en ? 'Supplier quote recorded' : 'Oferta proveedor registrada'],
    ['rfq_count', en ? 'RFQ recorded' : 'RFQ registrada'],
    ['review_count', en ? 'Review recorded' : 'Revisión registrada'],
  ];
  return names.find(([key]) => Number(row?.[key]) > 0)?.[1] ?? (en ? 'Requisition only' : 'Solo requisición');
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
function Count({ label, count }) {
  return <span className="inline-flex gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700 border border-slate-200">
    <span>{label}</span><strong>{count || 0}</strong>
  </span>;
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

/** Existing App.jsx continues to import GeneralMatrix by name; no navigation rewrite. */
export function GeneralMatrix({ lang = 'es', language, isEnglish }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [client, setClient] = useState('all');
  const [has, setHas] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ items: [], total: 0, summary: {} });
  const [clients, setClients] = useState([]);
  const [clientError, setClientError] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const pageSize = 25;

  useEffect(() => {
    const timer = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 320);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    const controller = new AbortController();
    matrixClients(controller.signal)
      .then(res => { if (!controller.signal.aborted) setClients(res.items || []); })
      .catch(err => { if (!controller.signal.aborted) setClientError(err); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(null);
    listMatrix({ page, pageSize, q, client, has }, controller.signal)
      .then(res => { if (!controller.signal.aborted) setData(res); })
      .catch(err => { if (!controller.signal.aborted) { setError(err);setData({ items: [], total: 0, summary: {} }); } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [page, q, client, has, revision]);
  const rows = Array.isArray(data.items) ? data.items : [];
  const summary = data.summary || {};
  const lastPage = Math.max(1, Math.ceil(Number(data.total || 0) / pageSize));
  const sortedClients = useMemo(() => clients, [clients]);
  return <div className="space-y-6">
    <header className="bg-slate-900 text-white rounded-2xl px-6 py-6 flex flex-wrap gap-4 items-center justify-between">
      <div><h1 className="text-2xl font-black flex items-center gap-3"><ClipboardList size={26}/>{en ? 'General Process Matrix' : 'Matriz General del Proceso'}</h1><p className="text-slate-300 text-sm mt-2">{en ? 'Real imported requisitions and related documents · MariaDB read-only' : 'Requisiciones y documentos migrados reales · MariaDB · solo consulta'}</p></div>
      <button type="button" onClick={() => setRevision(n => n + 1)} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 flex gap-2 items-center"><RefreshCw size={17}/>{en ? 'Refresh' : 'Actualizar'}</button>
    </header>
    <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3" aria-label={en ? 'Requisition summary' : 'Resumen de requisiciones'}>
      {[
        [en ? 'Requisitions' : 'Requisiciones', summary.total],
        [en ? 'With RFQ' : 'Con RFQ', summary.with_rfq],
        [en ? 'With customer quote' : 'Con cotización cliente', summary.with_customer_quote],
        [en ? 'With PO' : 'Con OC', summary.with_purchase_order],
        [en ? 'With delivery' : 'Con entrega', summary.with_delivery],
      ].map(([label,count]) => <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-4"><div className="text-xs text-slate-500 font-semibold">{label}</div><div className="font-black text-3xl text-slate-900 mt-1">{error ? '—' : (count ?? '…')}</div></div>)}
    </section>
    <p className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2 items-start"><CheckCircle2 size={18} className="text-blue-600 shrink-0"/><span>{en ? 'Milestones indicate linked documents, not official workflow statuses. Receipts are linked through purchase orders, not proof of quantity received by requisition line. No cross-currency totals.' : 'Los hitos se infieren de documentos vinculados; no equivalen a estatus oficiales. Las recepciones se vinculan mediante OC y no prueban cantidades recibidas por partida. No se suman importes en diferentes monedas.'}</span></p>
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b flex flex-wrap justify-between items-center gap-3"><h2 className="font-bold text-slate-900 flex items-center gap-2"><Building2 size={18}/>{en ? 'Requisition records' : 'Matriz de requisiciones'}</h2><span className="text-sm text-slate-500">{data.total ?? 0} {en ? 'matches' : 'coincidencias'}</span></div>
      <div className="p-4 grid md:grid-cols-3 gap-3 border-b bg-slate-50">
        <div className="relative"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input type="search" value={searchInput} onChange={ev => setSearchInput(ev.target.value)} aria-label={en ? 'Search requisitions' : 'Buscar requisiciones'} placeholder={en ? 'Folio, client, project, requester...' : 'Folio, cliente, proyecto, solicitante...'} className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm bg-white"/></div>
        <select aria-label={en ? 'Filter by client' : 'Filtrar por cliente'} value={client} onChange={ev => { setClient(ev.target.value);setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"><option value="all">{en ? 'All clients' : 'Todos los clientes'}</option>{sortedClients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.requisitions})</option>)}</select>
        <select aria-label={en ? 'Filter by document' : 'Filtrar por documento'} value={has} onChange={ev => { setHas(ev.target.value);setPage(1); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm">{HAS_FILTERS.map(([value,es,english]) => <option key={value} value={value}>{en ? english : es}</option>)}</select>
      </div>
      <Message error={clientError} en={en}/><Message error={error} en={en}/>
      {busy && <p className="p-6 text-sm text-slate-500">{en ? 'Loading requisitions from MariaDB...' : 'Consultando requisiciones en MariaDB...'}</p>}
      {!busy && !error && <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-700 uppercase text-xs"><tr>{(en ? ['Requisition','Client / project','Description','Related docs','Budget','Required','Observed milestone','Details'] : ['Requisición','Cliente / proyecto','Descripción','Documentos vinculados','Presupuesto','Requerida','Último hito observado','Detalle']).map(text => <th key={text} scope="col" className="px-3 py-3 whitespace-nowrap">{text}</th>)}</tr></thead><tbody>
        {rows.map(row => <tr key={row.id} className="border-t align-top hover:bg-slate-50"><td className="p-3 min-w-[130px]"><strong>{row.folio}</strong><div className="text-xs text-slate-500 mt-1">{ymd(row.request_date)}</div>{row.source_type === 'supplyflow_v07_draft' && <div className="mt-1 text-amber-700 text-xs font-semibold">{en ? 'Draft v0.7' : 'Borrador v0.7'}</div>}</td><td className="p-3 min-w-[220px]"><div className="font-semibold">{row.client_name}</div><div className="text-xs text-slate-500">{show(row.project)}</div></td><td className="p-3 min-w-[240px] max-w-sm"><p className="line-clamp-3">{show(row.description)}</p><div className="text-xs text-slate-500 mt-1">{Number(row.line_count)} {en ? 'lines' : 'partidas'}</div></td><td className="p-3 min-w-[150px]"><div className="flex flex-wrap gap-1"><Count label="RFQ" count={row.rfq_count}/><Count label={en ? 'Supplier' : 'Prov.'} count={row.supplier_quote_count}/><Count label={en ? 'Customer' : 'Cliente'} count={row.customer_quote_count}/><Count label="OC" count={row.purchase_order_count}/><Count label={en ? 'Del.' : 'Ent.'} count={row.delivery_count}/></div></td><td className="p-3 min-w-[140px]">{amount(row.budget_amount,row.currency_code,en)}</td><td className="p-3 whitespace-nowrap">{ymd(row.need_date)}</td><td className="p-3 min-w-[145px]"><span className="bg-blue-50 text-blue-900 border border-blue-200 rounded-lg px-2 py-1 text-xs inline-block">{lastMilestone(row,en)}</span></td><td className="p-3"><button type="button" onClick={() => setDetailId(row.id)} className="border border-blue-200 rounded-lg px-3 py-2 text-blue-700 hover:bg-blue-50 flex items-center gap-2"><Eye size={16}/>{en ? 'View' : 'Ver'}</button></td></tr>)}
        {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">{en ? 'No matching requisitions.' : 'Sin requisiciones para estos filtros.'}</td></tr>}
      </tbody></table></div>}
      <footer className="border-t p-4 flex flex-wrap justify-between items-center gap-3 text-sm text-slate-600"><span>{en ? 'Page' : 'Página'} {page} / {lastPage} · {Number(data.total || 0)} {en ? 'records' : 'registros'}</span><div className="flex gap-2"><button type="button" className="p-2 rounded-lg border disabled:opacity-40" disabled={busy || page <= 1} onClick={() => setPage(n => Math.max(1,n-1))} aria-label={en ? 'Previous' : 'Anterior'}><ChevronLeft size={18}/></button><button type="button" className="p-2 rounded-lg border disabled:opacity-40" disabled={busy || page >= lastPage} onClick={() => setPage(n => n+1)} aria-label={en ? 'Next' : 'Siguiente'}><ChevronRight size={18}/></button></div></footer>
    </div>
    <div className="text-xs text-amber-900 bg-amber-50 rounded-xl border border-amber-200 p-4 flex items-start gap-2"><LockKeyhole size={16} className="shrink-0"/><span>{en ? 'Read-only. Documents retained in import reconciliation, including records with missing parents, are not represented as validated links. Creating, approving, downloading private files and editing remain disabled.' : 'Solo consulta. Los documentos retenidos en conciliación, incluidos los que tienen referencias faltantes, no se presentan como vínculos validados. Crear, aprobar, descargar adjuntos privados y editar siguen deshabilitados.'}</span></div>
    {detailId && <Details id={detailId} en={en} onClose={() => setDetailId(null)}/>}
  </div>;
}
