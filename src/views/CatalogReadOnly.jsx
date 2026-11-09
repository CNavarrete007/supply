import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, ChevronLeft, ChevronRight, Eye, LockKeyhole, RefreshCw, Search, Truck, X } from 'lucide-react';
import { getCatalogRecord, listCatalog } from '../catalogApi';

const statusNames = {
  active: ['Activo', 'Active'], inactive: ['Inactivo', 'Inactive'], blocked: ['Bloqueado', 'Blocked'],
  authorized: ['Autorizado', 'Authorized'], evaluation: ['En evaluación', 'Under evaluation'],
  under_evaluation: ['En evaluación', 'Under evaluation'], suspended: ['Suspendido', 'Suspended'],
};
const translateStatus = (status, en) => statusNames[status]?.[en ? 1 : 0] ?? (status || '—');
const human = (value) => value == null || value === '' ? '—' : String(value);

function LabelValue({ label, value }) {
  return <div className="min-w-0"><div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div><div className="text-sm text-slate-900 break-words">{human(value)}</div></div>;
}

function StatusPill({ status, en }) {
  const positive = ['active', 'authorized'].includes(status);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{translateStatus(status, en)}</span>;
}

function DetailPanel({ kind, recordId, en, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null); setError('');
    getCatalogRecord(kind, recordId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setDetail(data.item || null); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'Error.'); });
    return () => controller.abort();
  }, [kind, recordId]);
  const contactGroups = useMemo(() => ({
    email: (detail?.channels || []).filter(x => x.type === 'email'),
    phone: (detail?.channels || []).filter(x => x.type === 'phone'),
  }), [detail]);
  const isClient = kind === 'clients';
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" aria-label={en ? 'Record details' : 'Detalle del registro'} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <button aria-label={en ? 'Close details' : 'Cerrar detalle'} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
    <section className="relative w-full max-w-xl h-full overflow-y-auto bg-white p-6 shadow-2xl space-y-6">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div><h2 className="text-xl font-black text-slate-900">{en ? 'Record details' : 'Detalle del registro'}</h2><p className="text-xs text-slate-500 mt-1">{en ? 'Imported data · read only' : 'Datos importados · solo consulta'}</p></div>
        <button aria-label={en ? 'Close' : 'Cerrar'} type="button" onClick={onClose} className="rounded-lg border px-3 py-2"><X size={18} /></button>
      </div>
      {error && <p role="alert" className="flex gap-2 text-red-700"><AlertCircle size={18} />{error}</p>}
      {!error && !detail && <p className="text-slate-500">{en ? 'Loading details...' : 'Consultando detalle...'}</p>}
      {detail && <>
        <header><p className="text-xs text-slate-500">{human(detail.code)}</p><h3 className="text-xl font-bold text-slate-900 break-words">{detail.name}</h3><div className="mt-2"><StatusPill status={detail.status} en={en}/></div></header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <LabelValue label={en ? 'Tax ID' : 'RFC / Identificador fiscal'} value={detail.tax_id}/>
          {isClient ? <><LabelValue label={en ? 'Brand' : 'Nombre comercial'} value={detail.brand_name}/><LabelValue label={en ? 'Project' : 'Proyecto'} value={detail.project}/><LabelValue label={en ? 'Contract' : 'Contrato'} value={detail.contract_reference}/></>
            : <><LabelValue label={en ? 'Supplier key' : 'Clave de proveedor'} value={detail.supplier_key}/><LabelValue label={en ? 'Category' : 'Categoría'} value={detail.category}/><LabelValue label={en ? 'Currency' : 'Moneda'} value={detail.currency}/><LabelValue label={en ? 'Credit terms' : 'Tipo de crédito'} value={detail.credit_type}/><LabelValue label={en ? 'Credit days' : 'Días de crédito'} value={detail.credit_days}/><LabelValue label={en ? 'Lead time' : 'Tiempo de entrega'} value={detail.lead_time_value ? `${detail.lead_time_value} ${detail.lead_time_unit || ''}` : null}/><LabelValue label={en ? 'Rating' : 'Calificación'} value={detail.rating}/></>}
          <LabelValue label={en ? 'Incomplete record' : 'Datos pendientes'} value={detail.data_incomplete ? (en ? 'Yes' : 'Sí') : (en ? 'No' : 'No')}/>
          {isClient && <LabelValue label={en ? 'Portal enabled' : 'Portal habilitado'} value={detail.portal_enabled ? (en ? 'Yes' : 'Sí') : 'No'}/>}
        </div>
        {isClient && <div className="grid grid-cols-1 gap-4"><LabelValue label={en ? 'Address' : 'Dirección'} value={detail.address}/><LabelValue label={en ? 'Commercial terms' : 'Condiciones comerciales'} value={detail.terms}/></div>}
        <div><h4 className="font-bold text-slate-900 mb-3">{en ? 'Contacts' : 'Contactos'}</h4>{detail.contacts?.length ? <ul className="space-y-2">{detail.contacts.map(person => <li key={person.id} className="border rounded-lg p-3 text-sm"><strong>{person.name}</strong>{person.position && <span className="ml-2 text-slate-500">· {person.position}</span>}</li>)}</ul> : <p className="text-sm text-slate-500">{en ? 'No named contacts in the import.' : 'No hay contactos con nombre en la importación.'}</p>}</div>
        <div><h4 className="font-bold text-slate-900 mb-3">{en ? 'Contact channels' : 'Medios de contacto'}</h4><div className="space-y-2 text-sm">{['email','phone'].map(type => <div key={type}><p className="text-xs font-semibold uppercase text-slate-500 mb-1">{type === 'email' ? 'Email' : (en ? 'Phone' : 'Teléfono')}</p>{contactGroups[type].length ? contactGroups[type].map((channel, i) => <div key={`${type}-${i}`} className="break-all text-slate-700">{channel.value}</div>) : <div className="text-slate-400">—</div>}</div>)}</div></div>
        <LabelValue label={en ? 'Notes' : 'Observaciones'} value={detail.notes}/>
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">{en ? 'Private attachments, edits and portal credentials are not available in this stage.' : 'Los adjuntos privados, las ediciones y las claves del portal no están disponibles en esta etapa.'}</p>
      </>}
    </section>
  </div>;
}

export function CatalogReadOnly({ kind = 'clients', lang = 'es', language, isEnglish }) {
  const en = isEnglish || lang === 'en' || language === 'en';
  const client = kind === 'clients';
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState({ items: [], total: 0, summary: { total: 0, statuses: [], incomplete: 0 } });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState(null);
  const pageSize = 25;

  useEffect(() => {
    const task = setTimeout(() => { setQ(input.trim()); setPage(1); }, 300);
    return () => clearTimeout(task);
  }, [input]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    listCatalog(kind, { page, pageSize, q, status }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err.status === 401 ? (en ? 'Your session expired. Sign in again.' : 'Tu sesión expiró. Inicia sesión nuevamente.') : err.message || 'Error de consulta.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [kind, page, q, status, revision]);

  const summary = data?.summary || {};
  const total = Number(data?.total || 0);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const statusOptions = Array.isArray(summary.statuses) ? summary.statuses : [];
  const validRows = Array.isArray(data.items) ? data.items : [];
  const title = client ? (en ? 'Clients' : 'Clientes') : (en ? 'Suppliers' : 'Proveedores');
  const Logo = client ? Building2 : Truck;

  return <section className="space-y-6">
    <header className="rounded-2xl bg-slate-900 text-white p-6 flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-black flex gap-3 items-center"><Logo size={26}/> {title}</h1><p className="text-sm text-slate-300 mt-1">{en ? 'Imported records from MariaDB · read-only catalog' : 'Registros importados desde MariaDB · catálogo de solo consulta'}</p></div>
      <button type="button" onClick={() => setRevision(n => n + 1)} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 flex items-center gap-2"><RefreshCw size={16}/>{en ? 'Refresh' : 'Actualizar'}</button>
    </header>
    <div className="grid sm:grid-cols-3 gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="text-xs uppercase text-slate-500 font-semibold">{en ? 'Total imported' : 'Total importados'}</div><div className="text-3xl font-black text-slate-900 mt-1">{summary.total ?? 0}</div></div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="text-xs uppercase text-slate-500 font-semibold">{en ? 'Matches' : 'Coincidencias'}</div><div className="text-3xl font-black text-slate-900 mt-1">{total}</div></div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="text-xs uppercase text-slate-500 font-semibold">{en ? 'Incomplete records' : 'Registros incompletos'}</div><div className="text-3xl font-black text-slate-900 mt-1">{summary.incomplete ?? 0}</div></div>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-2 text-sm text-amber-900"><LockKeyhole size={18} className="shrink-0"/><span>{en ? 'Create, edit, delete and Excel import are disabled until the backend write contracts are approved.' : 'Altas, edición, eliminación e importación Excel están deshabilitadas hasta validar las operaciones de escritura del backend.'}</span></div>
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="border-b p-4 flex flex-wrap gap-3 justify-between items-center"><h2 className="font-bold text-slate-900">{en ? 'Directory' : 'Matriz de registros'}</h2><div className="flex flex-wrap gap-3 w-full sm:w-auto">
        <div className="relative flex-1 min-w-[210px]"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input type="search" value={input} aria-label={en ? 'Search catalog' : 'Buscar en catálogo'} onChange={event => setInput(event.target.value)} placeholder={en ? 'Search by name, code or tax ID' : 'Buscar nombre, clave, RFC, contacto'} className="border rounded-lg py-2 pl-10 pr-3 w-full text-sm"/></div>
        <select aria-label={en ? 'Status' : 'Estatus'} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 bg-white text-sm"><option value="all">{en ? 'All statuses' : 'Todos los estatus'}</option>{statusOptions.map(item => <option key={item.code} value={item.code}>{translateStatus(item.code, en)} ({item.count})</option>)}</select>
      </div></div>
      {busy && <div className="p-6 text-sm text-slate-500">{en ? 'Loading real records...' : 'Consultando datos reales...'}</div>}
      {error && <div className="p-6 text-red-700 text-sm flex gap-2" role="alert"><AlertCircle size={18}/>{error}</div>}
      {!busy && !error && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{[en ? 'Code' : 'Clave',en ? 'Company' : 'Razón social',client ? (en ? 'Project / Contract' : 'Proyecto / Contrato') : (en ? 'Category / Currency' : 'Categoría / Moneda'),en ? 'Contact' : 'Contacto',en ? 'Status' : 'Estatus',client ? (en ? 'Requisitions' : 'Requisiciones') : (en ? 'Offerings' : 'Suministros'),en ? 'Details' : 'Detalle'].map(head => <th key={head} className="p-3 whitespace-nowrap">{head}</th>)}</tr></thead><tbody>
        {validRows.map(item => <tr key={item.id} className="border-t hover:bg-slate-50 align-top"><td className="p-3 font-semibold text-slate-900">{item.code}</td><td className="p-3 min-w-[230px]"><div className="font-semibold text-slate-900">{item.name}</div><div className="text-xs text-slate-500">{human(item.tax_id)}</div>{item.data_incomplete && <span className="text-xs text-amber-700">{en ? 'Incomplete information' : 'Información incompleta'}</span>}</td><td className="p-3 text-slate-600"><div>{human(client ? item.project : item.category)}</div><div className="text-xs text-slate-500 mt-1">{human(client ? item.contract_reference : item.currency)}</div></td><td className="p-3"><div>{human(item.primary_contact)}</div><div className="text-xs text-slate-500 break-all">{human(item.primary_email)}</div></td><td className="p-3"><StatusPill status={item.status} en={en}/></td><td className="p-3 text-slate-700 tabular-nums">{client ? item.requisition_count : item.offerings_count}</td><td className="p-3"><button type="button" onClick={() => setDetailId(item.id)} className="text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg px-3 py-2 flex gap-2 items-center whitespace-nowrap"><Eye size={16}/>{en ? 'View' : 'Ver'}</button></td></tr>)}
        {validRows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">{en ? 'No matching records.' : 'No se encontraron registros.'}</td></tr>}
      </tbody></table></div>}
      <div className="p-4 border-t flex flex-wrap gap-3 items-center justify-between text-sm text-slate-600"><div>{en ? 'Page' : 'Página'} {page} / {lastPage} · {total} {en ? 'matches' : 'coincidencias'} {busy && <span aria-live="polite">· …</span>}</div><div className="flex gap-2"><button type="button" disabled={busy || page <= 1} aria-label={en ? 'Previous page' : 'Página anterior'} className="rounded-lg border p-2 disabled:opacity-40" onClick={() => setPage(n => Math.max(1, n-1))}><ChevronLeft size={18}/></button><button type="button" disabled={busy || page >= lastPage} aria-label={en ? 'Next page' : 'Página siguiente'} className="rounded-lg border p-2 disabled:opacity-40" onClick={() => setPage(n => n+1)}><ChevronRight size={18}/></button></div></div>
    </div>
    <div className="text-xs text-slate-500 flex gap-2 items-center"><CheckCircle2 size={16}/>{en ? 'Database-backed records; no demo fallback.' : 'Registros de la base de datos; sin datos de demostración como respaldo.'}</div>
    {detailId && <DetailPanel kind={kind} recordId={detailId} en={en} onClose={() => setDetailId(null)}/>}
  </section>;
}

export function ClientsCatalog(props) { return <CatalogReadOnly {...props} kind="clients"/>; }
export function SuppliersCatalog(props) { return <CatalogReadOnly {...props} kind="suppliers"/>; }
