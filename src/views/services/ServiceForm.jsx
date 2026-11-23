import React, { useMemo, useRef, useState } from 'react';
import { serviceRequestCatalog, serviceContracting } from './api';
import { useLoad } from '../reception/useLoad.js';
import { clientLabel, httpMessage } from './newRequestModel.mjs';
import { STATUS_OPTIONS, AUTH_TYPES, AUTH_STATUSES, CURRENCIES, REQUIRES, initialService, authBadge, contractingState, poLabel, totals, totalsText,
  nextServiceFolio, detailFields, fileProblem, fileSize, validateService, serviceWarnings, serviceRecord, lockedServiceText, money } from './serviceFormModel.mjs';
import { mergeOptions } from './serviceMatrix.mjs';

// Servicios Operativos · formulario "Nuevo servicio" (expediente operativo del diseño original). Se abre al validar el
// paso 3 de "+ Nueva solicitud" con la requisición vinculada. Datos reales: tipos y estatus registrados
// (GET /services/new-request), clientes (GET /recovery/catalogs, ya cargados en el asistente) y proveedores con sus OC
// vigentes (GET /services/new-request/contracting). "Guardar servicio" valida y NO guarda (service_orders sin endpoint
// de escritura ni permiso INSERT); los archivos no se suben.
const TONES = { green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-800 border-amber-200', red: 'bg-rose-50 text-rose-700 border-rose-200', gray: 'bg-slate-100 text-slate-600 border-slate-200', blue: 'bg-blue-50 text-blue-800 border-blue-200', violet: 'bg-violet-50 text-violet-800 border-violet-200' };
const Badge = ({ b, testid }) => <span data-testid={testid} className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border whitespace-nowrap ${TONES[b.tone] || TONES.gray}`}>{b.text}</span>;

export function ServiceForm({ draft, en = false, notify = () => {}, onNavigate }) {
  const tx = (es, e) => (en ? e : es);
  const record = draft.record;
  const [form, setForm] = useState(() => initialService(record));
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const evidenceRef = useRef(null);
  const authFileRef = useRef(null);
  const resultRef = useRef(null);
  const catalog = useLoad(s => Promise.all([serviceRequestCatalog(s), serviceContracting(s)]).then(([c, k]) => ({ c, k })), [reload]);
  const cat = catalog.data?.c; const contracting = catalog.data?.k || { suppliers: [], purchase_orders: [] };
  const options = draft.options; const clients = draft.clients;
  const option = options.find(o => o.key === form.type) || null;
  const client = clients.find(c => c.id === form.client_id) || null;
  const statuses = useMemo(() => STATUS_OPTIONS(cat?.statuses), [cat]);
  const authTypes = useMemo(() => mergeOptions(AUTH_TYPES, cat?.authorization_types || []), [cat]);
  const authStatuses = useMemo(() => mergeOptions(AUTH_STATUSES, cat?.authorization_statuses || []), [cat]);
  const cs = contractingState(form, contracting);
  const tot = totalsText(totals(form)); const margin = totals(form).margin;
  const fields = detailFields(form.type);
  const ready = catalog.status === 'ready';

  const touch = k => { setResult(null); if (error && (error.field === k || !error.field)) setError(null); };
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); touch(k); };
  const setType = key => {
    const prev = options.find(o => o.key === form.type); const next = options.find(o => o.key === key);
    setForm(f => ({ ...f, type: key, description: !f.description.trim() || f.description === prev?.label ? (next?.label || '') : f.description }));
    touch('type');
  };
  const setRequires = v => { setForm(f => ({ ...f, requires: v, supplier_id: v === 'yes' ? f.supplier_id : '', po_id: v === 'yes' ? f.po_id : '' })); touch('requires'); };
  const setSupplier = v => { setForm(f => ({ ...f, supplier_id: v, po_id: '' })); touch('supplier_id'); };
  const setDetail = (k, v) => { setForm(f => ({ ...f, details: { ...f.details, [k]: v } })); touch(`detail-${k}`); };
  const addEvidence = files => {
    const list = [...(files || [])];
    setForm(f => ({ ...f, evidence: [...f.evidence, ...list.filter(x => !f.evidence.some(y => y.name === x.name && y.size === x.size))] }));
    touch('evidence');
    if (evidenceRef.current) evidenceRef.current.value = '';
  };
  const removeEvidence = i => { setForm(f => ({ ...f, evidence: f.evidence.filter((_, j) => j !== i) })); touch('evidence'); };
  const clear = () => {
    setForm(initialService(record)); setError(null); setResult(null);
    if (evidenceRef.current) evidenceRef.current.value = ''; if (authFileRef.current) authFileRef.current.value = '';
    notify(tx('Nuevo servicio', 'New service'), tx('Se limpió la captura; la requisición vinculada se conserva.', 'The capture was cleared; the linked requisition is kept.'), 'info');
  };
  const manage = () => {
    notify(tx('Contratación / OC', 'Contracting / PO'), tx('La contratación y la OC al proveedor se gestionan en Órdenes de Compra. El servicio no se guardó.', 'Contracting and the supplier PO are managed in Purchase Orders. The service was not saved.'), 'info');
    if (typeof onNavigate === 'function') onNavigate('purchase_orders');
  };
  const save = () => {
    const err = validateService(form, { options, clients, contracting });
    if (err) { setError(err); setResult(null); setTimeout(() => document.getElementById(`sf-${err.field}`)?.focus(), 0); return; }
    const rec = serviceRecord(form, { draft: record, option, client, contracting, sequences: cat?.service_folio_sequences });
    setError(null);
    setResult({ rec, warnings: serviceWarnings(form, { draft: record, contracting, option }) });
    notify(tx('Servicio no guardado', 'Service not saved'), tx(`${rec.folio} · ${rec.service_type}: datos validados; el alta del expediente está bloqueada hasta autorizar su endpoint de escritura.`, `${rec.folio} · ${rec.service_type}: data validated; creating the file is blocked until its write endpoint is authorized.`), 'warning');
    setTimeout(() => resultRef.current?.scrollIntoView?.({ block: 'nearest' }), 0);
  };

  const cls = (k, extra = '') => `w-full min-w-0 h-11 px-3 rounded-xl border text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${error?.field === k ? 'border-rose-400 focus:ring-rose-200 bg-white' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100 bg-white'} ${extra}`;
  const label = (k, text) => <label htmlFor={`sf-${k}`} className="block text-[11px] font-extrabold text-slate-800 mb-1.5">{text}</label>;
  const cell = (k, text, control, help, wrap = '') => <div className={`text-[14px] ${wrap}`}>{label(k, text)}{control}{help && <p className="text-[11px] text-slate-500 mt-1 leading-snug" data-testid={`sf-${k}-help`}>{help}</p>}</div>;
  const input = (k, text, props = {}) => cell(k, text, <input id={`sf-${k}`} data-testid={`sf-${k}`} type={props.type || 'text'} inputMode={props.inputMode} value={form[k]} placeholder={props.placeholder} onChange={e => set(k, e.target.value)} className={cls(k)} aria-invalid={error?.field === k || undefined} />, props.help, props.wrap);
  const select = (k, text, opts, props = {}) => cell(k, text, (
    <select id={`sf-${k}`} data-testid={`sf-${k}`} value={form[k]} disabled={props.disabled} onChange={e => (props.onChange || (v => set(k, v)))(e.target.value)} className={cls(k)} aria-invalid={error?.field === k || undefined}>
      {props.placeholder !== undefined && <option value="">{props.placeholder}</option>}
      {opts.map(o => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
    </select>), props.help, props.wrap);
  // index.css aplica `font: inherit` a los input fuera de las capas de Tailwind: el peso se hereda del contenedor.
  const readonly = (k, text, value) => cell(k, text, <div className="font-black"><input id={`sf-${k}`} data-testid={`sf-${k}`} readOnly value={value} className="w-full min-w-0 h-11 px-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-900 focus:outline-none" /></div>);
  const section = (icon, title, note, badges) => (
    <div className="mt-6 mb-3">
      <div className="flex flex-wrap items-baseline gap-x-1.5"><span aria-hidden="true">{icon}</span><h3 className="text-[15px] font-black text-slate-900">{title}</h3><span className="text-[11px] text-slate-600">{note}</span></div>
      <div className="flex flex-wrap gap-1.5 mt-1">{badges}</div>
    </div>
  );

  return (
    <div data-testid="service-form" className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 text-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-slate-900">{tx('Nuevo servicio', 'New service')}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{tx('Los campos específicos cambian automáticamente según el tipo de servicio.', 'Specific fields change automatically with the service type.')}</p>
        </div>
        <Badge b={{ text: tx('Nuevo', 'New'), tone: 'blue' }} testid="sf-new-badge" />
      </div>
      <hr className="my-4 border-slate-200" />

      <div data-testid="sf-link-note" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900 flex gap-2">
        <span aria-hidden="true">🔒</span>
        <span><b>{tx(`Requisición ${record.folio} validada, no creada.`, `Requisition ${record.folio} validated, not created.`)}</b> {tx('El alta de requisiciones de servicio y de su expediente está bloqueada hasta autorizar sus endpoints de escritura. Puedes completar y validar el servicio; no se guardará en MariaDB.', 'Creating service requisitions and their file is blocked until their write endpoints are authorized. You can complete and validate the service; it will not be stored in MariaDB.')}
          {draft.warnings?.length > 0 && <span className="block mt-1">{draft.warnings.join(' ')}</span>}</span>
      </div>

      {catalog.status === 'error' && (
        <div data-testid="sf-load-error" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-700 flex flex-wrap items-center justify-between gap-2">
          <span><b>{tx('No se pudieron cargar proveedores, OC y catálogos.', 'Suppliers, POs and catalogs could not be loaded.')}</b> {httpMessage(catalog.error, en)}</span>
          {![401, 403].includes(catalog.error?.status) && <button type="button" data-testid="sf-retry" onClick={() => setReload(n => n + 1)} className="px-4 h-9 rounded-xl bg-white border border-rose-200 text-rose-700"><span className="font-black text-[12px]">{tx('Reintentar', 'Retry')}</span></button>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
        {select('type', tx('Tipo de servicio *', 'Service type *'), options.map(o => [o.key, o.label]), { onChange: setType })}
        {readonly('requisition', tx('Requisición vinculada', 'Linked requisition'), record.folio)}
        {readonly('reference', tx('Referencia interna', 'Internal reference'), record.internal_reference || '—')}
        {select('client_id', tx('Cliente *', 'Client *'), clients.map(c => [c.id, clientLabel(c)]), { placeholder: tx('Seleccionar cliente...', 'Select client...') })}
        {input('project', tx('Proyecto', 'Project'))}
        {input('contract', tx('Contrato / referencia', 'Contract / reference'))}
        {input('request_date', tx('Fecha de solicitud *', 'Request date *'), { type: 'date' })}
        {input('need_date', tx('Fecha requerida', 'Required date'), { type: 'date' })}
        {input('responsible', tx('Responsable', 'Responsible'), { placeholder: tx('Responsable de la ejecución', 'Person in charge of execution') })}
        {select('status', tx('Estatus', 'Status'), statuses)}
      </div>

      {section('💼', tx('Autorización comercial del cliente', 'Client commercial authorization'), tx('Se registra cuando exista. No es requisito para crear la requisición ni iniciar el expediente del servicio.', 'Registered when it exists. Not required to create the requisition or start the service file.'),
        authBadge(form.auth_status, !!form.auth_file).map((b, i) => <Badge key={b.text} b={b} testid={i ? 'sf-auth-doc-badge' : 'sf-auth-badge'} />))}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
        {select('auth_type', tx('Tipo de autorización', 'Authorization type'), authTypes, { placeholder: tx('Seleccionar...', 'Select...') })}
        {select('auth_status', tx('Estatus de autorización', 'Authorization status'), authStatuses)}
        {input('auth_reference', tx('Número / referencia', 'Number / reference'), { placeholder: tx('PO, SO, contrato, correo, folio...', 'PO, SO, contract, email, folio...') })}
        {input('auth_date', tx('Fecha de autorización', 'Authorization date'), { type: 'date' })}
        {input('auth_amount', tx('Monto autorizado', 'Authorized amount'), { inputMode: 'decimal' })}
        {select('auth_currency', tx('Moneda', 'Currency'), CURRENCIES)}
        {input('auth_valid_until', tx('Vigencia / fecha límite', 'Validity / deadline'), { type: 'date' })}
        {cell('auth_file', tx('Documento de autorización', 'Authorization document'), (
          <input id="sf-auth_file" data-testid="sf-auth_file" ref={authFileRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp,image/gif" onChange={e => set('auth_file', e.target.files?.[0] || null)}
            className={`${cls('auth_file', 'h-11 py-2 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-slate-100 file:px-2 file:text-slate-800')}`} />
        ), form.auth_file ? `${form.auth_file.name} · ${fileSize(form.auth_file.size)} (no se sube)` : null)}
      </div>

      {section('🛒', tx('Contratación de proveedor (opcional)', 'Supplier contracting (optional)'), tx('Relaciona el servicio con una OC de SupplyFlow cuando necesitas contratar a un tercero para ejecutarlo.', 'Link the service to a SupplyFlow PO when a third party must perform it.'),
        <Badge b={cs.badge} testid="sf-contract-badge" />)}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3 items-start">
        {select('requires', tx('¿Requiere proveedor externo?', 'External supplier required?'), REQUIRES, { onChange: setRequires, help: cs.requiresHelp })}
        {select('supplier_id', tx('Proveedor externo', 'External supplier'), contracting.suppliers.map(s => [s.id, s.code ? `${s.code} · ${s.name}` : s.name]), { placeholder: ready ? tx('Seleccionar proveedor...', 'Select supplier...') : tx('Cargando proveedores…', 'Loading suppliers…'), disabled: !cs.external || !ready, onChange: setSupplier, help: cs.supplierHelp })}
        {select('po_id', tx('OC emitida al proveedor', 'PO issued to the supplier'), cs.orders.map(o => [o.id, poLabel(o)]), { placeholder: tx('Sin vincular', 'Not linked'), disabled: !cs.supplier, help: cs.poHelp, wrap: 'lg:col-span-2' })}
        {readonly('po_cost', tx('Costo OC relacionado', 'Related PO cost'), cs.po ? money(cs.poCost) : '0')}
        {readonly('po_currency', tx('Moneda OC', 'PO currency'), cs.poCurrency)}
        <div className="sm:col-span-2 flex flex-col items-stretch sm:items-end justify-end gap-2 lg:-mt-6">
          <button type="button" data-testid="sf-manage" disabled={!cs.canManage} onClick={manage} className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed"><span className="text-[13px] font-black">🛒 {tx('Gestionar contratación / OC', 'Manage contracting / PO')}</span></button>
          <button type="button" data-testid="sf-unlink" disabled={!cs.canUnlink} onClick={() => set('po_id', '')} className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed"><span className="text-[13px] font-black">✕ {tx('Quitar vínculo', 'Remove link')}</span></button>
        </div>
      </div>
      <div data-testid="sf-info" className="mt-3 rounded-xl border-l-4 border-blue-600 bg-blue-50/80 px-4 py-2.5 text-[13px] text-slate-800"><b>{cs.info[0]}</b> {cs.info[1]}</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3 mt-6">
        {input('quantity', tx('Cantidad', 'Quantity'), { inputMode: 'decimal' })}
        {input('unit', tx('Unidad', 'Unit'))}
        {input('cost', tx('Costo interno', 'Internal cost'), { inputMode: 'decimal' })}
        {input('price', tx('Precio al cliente', 'Client price'), { inputMode: 'decimal' })}
      </div>
      <div data-testid="sf-totals" className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-[11px] text-slate-700 flex flex-wrap gap-x-5 gap-y-1">
        <span>{tx('Costo', 'Cost')}: <b className="text-slate-900">{tot.cost}</b></span>
        <span>{tx('Venta', 'Sale')}: <b className="text-slate-900">{tot.price}</b></span>
        <span>{tx('Margen', 'Margin')}: <b className={margin < 0 ? 'text-rose-600' : 'text-emerald-700'}>{tot.margin}</b></span>
      </div>

      <div data-testid="sf-details" className="mt-4 rounded-2xl border border-dashed border-blue-300 bg-gradient-to-br from-white to-violet-50/50 p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-[15px] font-black text-slate-900">{tx('Datos específicos', 'Specific data')} · {option?.label || '—'}</h3>
          <Badge b={{ text: tx('Formulario dinámico', 'Dynamic form'), tone: 'violet' }} />
        </div>
        {fields ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
            {fields.map(([k, text, type]) => cell(`detail-${k}`, text, <input id={`sf-detail-${k}`} data-testid={`sf-detail-${k}`} type={type || 'text'} value={form.details[k] || ''} onChange={e => setDetail(k, e.target.value)} className={cls(`detail-${k}`)} />))}
          </div>
        ) : (
          <p data-testid="sf-details-pending" className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{tx(`Los campos específicos de «${option?.label}» del sistema original no están documentados (no hay capturas ni registros con este tipo). Comparte la captura de «Datos específicos · ${option?.label}» para replicarlos; mientras tanto registra el detalle en Descripción / alcance u Observaciones.`, `The original specific fields for "${option?.label}" are not documented yet. Share the screenshot to replicate them; meanwhile use Description / scope or Notes.`)}</p>
        )}
      </div>

      <div className="mt-4 text-[14px]">
        {label('description', tx('Descripción / alcance', 'Description / scope'))}
        <textarea id="sf-description" data-testid="sf-description" rows={3} value={form.description} onChange={e => set('description', e.target.value)} className={cls('description', 'h-auto py-2.5 resize-y')} />
      </div>
      <div className="mt-3 text-[14px]">
        {label('notes', tx('Observaciones', 'Notes'))}
        <textarea id="sf-notes" data-testid="sf-notes" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={tx('Incidencias, comentarios, resultado, restricciones...', 'Incidents, comments, result, restrictions...')} className={cls('notes', 'h-auto py-2.5 resize-y')} />
      </div>

      <div data-testid="sf-evidence-box" className="mt-4 rounded-2xl border border-dashed border-blue-300 bg-blue-50/30 p-4">
        <h3 className="text-[15px] font-black text-slate-900"><span aria-hidden="true">📎</span> {tx('Evidencias del servicio', 'Service evidence')}</h3>
        <p className="text-[11px] text-slate-600 mt-0.5 mb-2">{tx('PDF, imágenes, tickets, POD, capturas de Rise X u otros comprobantes.', 'PDF, images, tickets, POD, Rise X screenshots or other proof.')}</p>
        <div className="text-[14px]">
          <input id="sf-evidence" data-testid="sf-evidence" ref={evidenceRef} type="file" multiple accept=".pdf,image/png,image/jpeg,image/webp,image/gif" onChange={e => addEvidence(e.target.files)}
            className={cls('evidence', 'h-12 py-2.5 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-slate-100 file:px-2 file:text-slate-800')} />
        </div>
        <ul data-testid="sf-evidence-list" className="mt-2 space-y-1 text-[11px] text-slate-600">
          {form.evidence.length ? form.evidence.map((f, i) => {
            const p = fileProblem(f);
            return <li key={`${f.name}-${f.size}`} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${p ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white'}`}><span className="truncate">📄 {f.name} · {fileSize(f.size)}{p ? ` · ${p}` : ''}</span><button type="button" aria-label={tx(`Quitar ${f.name}`, `Remove ${f.name}`)} onClick={() => removeEvidence(i)} className="shrink-0 text-slate-500 hover:text-rose-600"><span className="font-black text-[12px]">✕</span></button></li>;
          }) : <li>{tx('Sin evidencias cargadas.', 'No evidence uploaded.')}</li>}
        </ul>
      </div>

      {error && <div role="alert" data-testid="sf-error" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-700">{error.message}</div>}
      <div className="flex flex-wrap gap-2 mt-5">
        <button type="button" data-testid="sf-save" onClick={save} className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30"><span className="text-[14px] font-black">💾 {tx('Guardar servicio', 'Save service')}</span></button>
        <button type="button" data-testid="sf-clear" onClick={clear} className="h-11 px-5 rounded-xl bg-white hover:bg-slate-50 border border-slate-100 text-slate-800 shadow-md"><span className="text-[14px] font-black">🧹 {tx('Limpiar', 'Clear')}</span></button>
      </div>

      {result && (
        <div ref={resultRef} data-testid="sf-result" className="mt-4 space-y-3">
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 flex gap-2"><span aria-hidden="true">🔒</span><span data-testid="sf-locked">{lockedServiceText(result.rec.folio, result.rec.requisition)}</span></div>
          <dl data-testid="sf-summary" className="rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5 p-4 text-[12px]">
            {[[tx('Folio del servicio', 'Service folio'), result.rec.folio], [tx('Requisición vinculada', 'Linked requisition'), result.rec.requisition], [tx('Tipo', 'Type'), result.rec.service_type], [tx('Cliente', 'Client'), result.rec.client],
              [tx('Estatus', 'Status'), result.rec.status], [tx('Autorización', 'Authorization'), `${result.rec.authorization.type || '—'} · ${result.rec.authorization.status}`], [tx('Proveedor / OC', 'Supplier / PO'), result.rec.requires_supplier ? `${result.rec.supplier || tx('Por definir', 'Pending')} · ${result.rec.supplier_po || tx('OC pendiente', 'PO pending')}` : tx('Ejecución interna', 'Internal execution')],
              [tx('Importes', 'Amounts'), `${result.rec.quantity} ${result.rec.unit} · ${tx('costo', 'cost')} ${money(result.rec.cost)} · ${tx('venta', 'sale')} ${money(result.rec.price)} · ${tx('margen', 'margin')} ${money(result.rec.margin)}`],
              [tx('Datos específicos', 'Specific data'), `${result.rec.detail_schema_code} · ${Object.values(result.rec.details).filter(Boolean).length}/${Object.keys(result.rec.details).length} ${tx('capturados', 'filled')}`], [tx('Evidencias', 'Evidence'), result.rec.evidence.length ? `${result.rec.evidence.length} ${tx('archivo(s), no subidos', 'file(s), not uploaded')}` : '0']]
              .map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">{k}</dt><dd className="font-semibold text-slate-900 break-words">{v}</dd></div>)}
          </dl>
          {result.warnings.length > 0 && <ul data-testid="sf-warnings" className="rounded-xl border border-amber-200 bg-amber-50/60 py-3 pl-8 pr-4 text-[12px] text-amber-900 list-disc space-y-1">{result.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}
      <p className="sr-only" data-testid="sf-next-folio">{nextServiceFolio(cat?.service_folio_sequences, form.request_date)}</p>
    </div>
  );
}
