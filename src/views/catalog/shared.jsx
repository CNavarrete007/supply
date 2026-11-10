// Piezas compartidas por los catálogos de Clientes y Proveedores (solo lectura, datos de MariaDB).
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { getCatalogRecord } from '../../catalogApi';

export const statusNames = {
  active: ['Activo', 'Active'], inactive: ['Inactivo', 'Inactive'], blocked: ['Bloqueado', 'Blocked'],
  authorized: ['Autorizado', 'Authorized'], evaluation: ['En evaluación', 'Under evaluation'],
  under_evaluation: ['En evaluación', 'Under evaluation'], suspended: ['Suspendido', 'Suspended'],
};
export const translateStatus = (status, en) => statusNames[status]?.[en ? 1 : 0] ?? (status || '—');
export const human = (value) => value == null || value === '' ? '—' : String(value);

export function LabelValue({ label, value }) {
  return <div className="min-w-0"><div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div><div className="text-sm text-slate-900 break-words">{human(value)}</div></div>;
}

export function StatusPill({ status, en }) {
  const positive = ['active', 'authorized'].includes(status);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{translateStatus(status, en)}</span>;
}

export function DetailPanel({ kind, recordId, en, onClose }) {
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

