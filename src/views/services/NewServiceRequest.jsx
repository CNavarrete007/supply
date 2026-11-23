import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { serviceRequestCatalog, serviceRequestReference, serviceRequestAvailability, requisitionClients, requisitionFolio } from './api';
import { OPERATIONS, STEPS, serviceOptions, clientLabel, filterClients, emptyRequest, applyClient, validateRequest, requestWarnings,
  folioTakenError, serviceRequisition, lockedText, httpMessage, localToday, validDate } from './newRequestModel.mjs';

// Servicios Operativos · sección 2 "+ Nueva solicitud" (diseño del original): modal de 3 pasos.
//  1 · Operación: Compra / renta continúa en Solicitud / Requisición (flujo real RF1); Servicio sigue al paso 2.
//  2 · Servicio: los 9 servicios del original vinculados al catálogo service_types de MariaDB.
//  3 · Requisición: clientes reales, ⚙ Generar folio (regla vigente de Solicitud / Requisición) y referencia interna
//      (SRV-PROYECTO-AÑO-0000), validación completa y verificación de folio duplicado en MariaDB.
// "Crear requisición y continuar" valida pero NO crea: el alta de la requisición maestra de servicio no tiene endpoint
// de escritura autorizado (el alta RF1 fija route_code 'supply'). No se escribe nada en MariaDB.

export function NewServiceRequest({ open, onClose, en = false, notify = () => {}, onNavigate, onOpenMatrix }) {
  const tx = (es, e) => (en ? e : es);
  const [step, setStep] = useState(1);
  const [operation, setOperation] = useState('purchase');
  const [serviceKey, setServiceKey] = useState('');
  const [form, setForm] = useState(() => emptyRequest());
  const [cat, setCat] = useState({ status: 'idle' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const generatedFolio = useRef('');
  const serial = useRef(0);
  const pickerRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = () => {
    const id = ++serial.current;
    setCat({ status: 'loading' });
    Promise.all([requisitionClients(), serviceRequestCatalog()])
      .then(([c, s]) => { if (id === serial.current) setCat({ status: 'ready', clients: c.clients || [], types: s.service_types || [] }); })
      .catch(e => { if (id === serial.current) setCat({ status: 'error', error: httpMessage(e, en), code: e.status }); });
  };

  useEffect(() => {
    if (!open) return undefined;
    setStep(1); setOperation('purchase'); setServiceKey(''); setForm(emptyRequest(localToday()));
    setError(null); setResult(null); setPicker(false); setSearch(''); setBusy(''); generatedFolio.current = '';
    load();
    return () => { serial.current += 1; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') { if (picker) setPicker(false); else closeRef.current?.(); } };
    const onDown = e => { if (picker && pickerRef.current && !pickerRef.current.contains(e.target)) setPicker(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); document.body.style.overflow = prev; };
  }, [open, picker]);

  const options = useMemo(() => serviceOptions(cat.types || []), [cat.types]);
  const option = options.find(o => o.key === serviceKey) || null;
  const clients = cat.clients || [];
  const client = clients.find(c => c.id === form.client_id) || null;
  const list = useMemo(() => filterClients(clients, search), [clients, search]);

  if (!open) return null;

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (error && (error.field === k || !error.field)) setError(null); };
  const focus = field => { if (field) setTimeout(() => document.getElementById(`svc-${field}`)?.focus(), 0); };
  const fail = err => { setError(err); focus(err?.field); };
  const go = n => { setError(null); setResult(null); setPicker(false); setStep(n); };

  const pick = c => {
    const next = applyClient(form, c, client, generatedFolio.current);
    if (next.folio !== form.folio) generatedFolio.current = '';
    setForm(next); setPicker(false); setSearch('');
    if (error?.field === 'client_id') setError(null);
  };

  const generateFolio = async () => {
    if (!form.client_id) return fail({ field: 'client_id', message: tx('Primero selecciona un cliente.', 'Select a client first.') });
    if (!validDate(form.request_date)) return fail({ field: 'request_date', message: tx('Captura una fecha de solicitud válida para generar el folio.', 'Enter a valid request date to generate the folio.') });
    setBusy('folio'); setError(null);
    try {
      const r = await requisitionFolio({ client: form.client_id, date: form.request_date });
      generatedFolio.current = r.folio; setForm(f => ({ ...f, folio: r.folio }));
    } catch (e) { fail({ field: 'folio', message: httpMessage(e, en) }); } finally { setBusy(''); }
  };

  const generateReference = async () => {
    if (!validDate(form.request_date)) return fail({ field: 'request_date', message: tx('Captura una fecha de solicitud válida para generar la referencia.', 'Enter a valid request date to generate the reference.') });
    if ([...form.project.trim()].length > 255) return fail({ field: 'project', message: tx('El proyecto admite hasta 255 caracteres.', 'The project accepts up to 255 characters.') });
    setBusy('reference'); setError(null);
    try {
      const r = await serviceRequestReference({ project: form.project.trim(), date: form.request_date });
      setForm(f => ({ ...f, reference: r.reference }));
    } catch (e) { fail({ field: 'reference', message: httpMessage(e, en) }); } finally { setBusy(''); }
  };

  const nextFromOperation = () => {
    if (operation === 'purchase') {
      notify(tx('Nueva solicitud', 'New request'), tx('Compra / renta continúa en Solicitud / Requisición → Registro de requisición.', 'Purchase / rental continues in Request / Requisition → Requisition registration.'), 'info');
      closeRef.current?.();
      if (typeof onNavigate === 'function') onNavigate('requisition');
      return;
    }
    go(2);
  };

  const nextFromService = () => {
    if (!option) return fail({ field: 'service', message: tx('Selecciona el servicio que se realizará.', 'Select the service to perform.') });
    go(3);
  };

  const submit = async () => {
    const err = validateRequest(form, { clients, option, en });
    if (err) return fail(err);
    setBusy('submit'); setError(null);
    try {
      const availability = await serviceRequestAvailability({ folio: form.folio.trim(), reference: form.reference.trim() });
      const taken = folioTakenError(availability, en);
      if (taken) return fail(taken);
      const record = serviceRequisition(form, option, client);
      setResult({ record, warnings: requestWarnings(form, { client, option, availability, en }) });
      notify(tx('Requisición de servicio no creada', 'Service requisition not created'), tx(`${record.folio} · ${record.service_type}: datos validados; la creación está bloqueada hasta autorizar su endpoint de escritura.`, `${record.folio} · ${record.service_type}: data validated; creation is blocked until its write endpoint is authorized.`), 'warning');
    } catch (e) { fail({ field: null, message: httpMessage(e, en) }); } finally { setBusy(''); }
  };

  const fieldCls = k => `w-full min-w-0 h-11 px-3 rounded-xl border bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${error?.field === k ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'}`;
  const label = (k, text) => <label htmlFor={`svc-${k}`} className="block text-[11px] font-extrabold text-slate-800 mb-1.5">{text}</label>;
  const input = (k, text, props = {}) => (
    <div className={`text-[13px] ${props.wrap || ''}`}>
      {label(k, text)}
      <input id={`svc-${k}`} data-testid={`svc-${k}`} value={form[k]} onChange={e => set(k, e.target.value)} className={fieldCls(k)} aria-invalid={error?.field === k || undefined} type={props.type || 'text'} placeholder={props.placeholder} />
    </div>
  );
  const back = (onClick, text = tx('← Atrás', '← Back')) => <button type="button" data-testid="svc-new-back" onClick={onClick} className="px-6 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 shadow-sm"><span className="text-[13px] font-extrabold">{text}</span></button>;
  const primary = (onClick, text, testid, disabled = false) => <button type="button" data-testid={testid} onClick={onClick} disabled={disabled} className="px-6 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white shadow-md shadow-blue-500/30"><span className="text-[13px] font-black">{text}</span></button>;
  const errorBar = error && <div role="alert" data-testid="svc-new-error" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] font-semibold text-rose-700">{error.message}</div>;
  const badge = <span className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-black rounded-full px-2.5 py-0.5 shadow-sm">✓ {tx('Seleccionado', 'Selected')}</span>;
  const footer = (left, right) => <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-200">{left}{right}</div>;

  const catalogState = cat.status !== 'ready' && (
    <div data-testid="svc-new-state" className={`mt-5 rounded-2xl border px-5 py-6 text-[13px] ${cat.status === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {cat.status === 'error'
        ? <div className="flex flex-wrap items-center justify-between gap-3"><span><b>{tx('No se pudieron cargar los catálogos.', 'The catalogs could not be loaded.')}</b> {cat.error}</span>{cat.code !== 401 && cat.code !== 403 && <button type="button" data-testid="svc-new-retry" onClick={load} className="px-4 h-9 rounded-xl bg-white border border-rose-200 text-rose-700"><span className="font-black text-[12px]">{tx('Reintentar', 'Retry')}</span></button>}</div>
        : tx('Cargando clientes y tipos de servicio de MariaDB…', 'Loading clients and service types from MariaDB…')}
    </div>
  );

  const resultView = result && (() => {
    const r = result.record;
    const rows = [
      [tx('Folio / requisición del cliente', 'Client folio / requisition'), r.folio], [tx('Referencia interna', 'Internal reference'), r.internal_reference || '—'],
      [tx('Cliente', 'Client'), r.client], [tx('Servicio', 'Service'), `${option?.icon || ''} ${r.service_type}`.trim()], [tx('Ruta', 'Route'), tx('Servicio (no compra / renta)', 'Service (not purchase / rental)')],
      [tx('Proyecto', 'Project'), r.project], [tx('Contrato / referencia contractual', 'Contract / contractual reference'), r.contract || '—'],
      [tx('Fecha de solicitud', 'Request date'), r.request_date], [tx('Fecha requerida', 'Required date'), r.need_date || '—'],
      [tx('Solicitante del cliente', 'Client requester'), r.requester_name], [tx('Correo del solicitante', 'Requester email'), r.requester_email],
      [tx('Lugar de prestación / entrega', 'Service / delivery place'), r.delivery_place || '—'], [tx('Prioridad · moneda', 'Priority · currency'), `Normal · ${r.currency}`],
    ];
    const item = r.items[0];
    return (
      <div data-testid="svc-new-result" className="mt-5 space-y-4">
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 flex gap-2"><span aria-hidden="true">🔒</span><span data-testid="svc-new-locked">{lockedText(en)}</span></div>
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-[12px] font-black text-slate-800">{tx('Requisición maestra que se registraría · Solicitud / Requisición → Matriz de requisiciones', 'Master requisition that would be registered · Request / Requisition → Requisitions matrix')}</div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 p-4 text-[12px]" data-testid="svc-new-summary">
            {rows.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">{k}</dt><dd className="font-semibold text-slate-900 break-words">{v}</dd></div>)}
          </dl>
          <div className="border-t border-slate-200 px-4 py-3 text-[12px] text-slate-700" data-testid="svc-new-item"><b>{tx('Partida 1:', 'Line 1:')}</b> {item.description} · 1 {tx('servicio', 'service')} · {tx('Categoría', 'Category')}: {item.category}</div>
        </div>
        <div className="rounded-xl border-l-4 border-blue-600 bg-blue-50/80 px-4 py-3 text-[12px] text-slate-700 leading-relaxed">
          <b>{tx('Después:', 'Next:')}</b> {tx('expediente operativo en ', 'operational file in ')}<b>{tx('Servicios Operativos → Matriz', 'Operational Services → Matrix')}</b>{tx(', vinculado a esta requisición (folio SRV-AAAA-00000 al crear el expediente). La autorización comercial (PO, Orden de Servicio, contrato, correo, portal o emergencia), el costo, la venta y las evidencias se registran ahí.', ', linked to this requisition (folio SRV-YYYY-00000 when the file is created). Commercial authorization (PO, Service Order, contract, email, portal or emergency), cost, sale and evidence are registered there.')}
        </div>
        {result.warnings.length > 0 && <ul data-testid="svc-new-warnings" className="rounded-xl border border-amber-200 bg-amber-50/60 py-3 pl-8 pr-4 text-[12px] text-amber-900 list-disc space-y-1">{result.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        {footer(back(() => setResult(null), tx('← Corregir datos', '← Edit data')),
          <div className="flex flex-wrap justify-end gap-2">
            {typeof onOpenMatrix === 'function' && <button type="button" data-testid="svc-new-matrix" onClick={() => { closeRef.current?.(); onOpenMatrix(); }} className="px-5 h-12 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800"><span className="text-[13px] font-extrabold">{tx('Ver Matriz de servicios', 'View services matrix')}</span></button>}
            {primary(() => closeRef.current?.(), tx('Cerrar', 'Close'), 'svc-new-done')}
          </div>)}
      </div>
    );
  })();

  return createPortal(
    <div data-testid="svc-new-overlay" className="fixed inset-0 z-[80] bg-slate-900/55 backdrop-blur-[2px] overflow-y-auto p-3 sm:p-6 flex items-start sm:items-center justify-center">
      <div role="dialog" aria-modal="true" aria-labelledby="svc-new-title" data-testid="svc-new-modal"
        className={`relative w-full ${step === 3 ? 'max-w-[1060px]' : 'max-w-[980px]'} bg-white rounded-[28px] shadow-2xl px-5 sm:px-7 py-6 text-slate-800 my-auto`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="svc-new-title" className="text-[22px] font-black text-slate-900 flex items-center gap-2"><span className="text-2xl leading-none" aria-hidden="true">+</span>{tx('Nueva solicitud', 'New request')}</h2>
            <p className="text-[13px] text-slate-500 mt-1">{tx('Define el tipo de operación. Para un servicio, crea primero la requisición maestra y después completa su expediente operativo.', 'Define the type of operation. For a service, first create the master requisition and then complete its operational file.')}</p>
          </div>
          <button type="button" aria-label={tx('Cerrar', 'Close')} data-testid="svc-new-close" onClick={() => closeRef.current?.()} className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 grid place-items-center"><span className="text-xl font-black leading-none">×</span></button>
        </div>
        <hr className="my-4 border-slate-200" />

        <div className="grid grid-cols-3 gap-2 sm:gap-4" data-testid="svc-new-steps">
          {STEPS.map(([es, e], i) => {
            const n = i + 1; const active = n === step; const can = n < step;
            return <button key={n} type="button" data-testid={`svc-step-${n}`} aria-current={active ? 'step' : undefined} onClick={() => can && go(n)} tabIndex={can ? 0 : -1}
              className={`h-10 rounded-xl border transition-[background-color,box-shadow] ${active ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25' : `bg-slate-100/80 text-slate-700 border-slate-200 ${can ? 'hover:bg-slate-200 cursor-pointer' : 'cursor-default'}`}`}><span className="text-[11px] sm:text-xs font-extrabold">{en ? e : es}</span></button>;
          })}
        </div>

        {step === 1 && (
          <div data-testid="svc-new-step1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5" role="radiogroup" aria-label={tx('Tipo de operación', 'Operation type')}>
              {OPERATIONS.map(o => {
                const sel = operation === o.id;
                return (
                  <button type="button" role="radio" aria-checked={sel} key={o.id} data-testid={`svc-op-${o.id}`} onClick={() => { setOperation(o.id); setError(null); }}
                    className={`relative text-left rounded-2xl border-2 p-5 min-h-[140px] transition-[border-color,box-shadow] ${sel ? 'border-blue-600 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/80 shadow-md shadow-blue-500/10' : 'border-slate-200 bg-gradient-to-b from-white to-slate-50/70 hover:border-slate-300'}`}>
                    {sel && badge}
                    <span className="block text-[28px] leading-none mb-3" aria-hidden="true">{o.icon}</span>
                    <span className="block font-black text-slate-900 text-[15px]">{en ? o.en : o.es}</span>
                    <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{en ? o.descEn : o.descEs}</span>
                  </button>
                );
              })}
            </div>
            {errorBar}
            {footer(back(() => closeRef.current?.()), primary(nextFromOperation, tx('Continuar →', 'Continue →'), 'svc-new-next'))}
          </div>
        )}

        {step === 2 && (
          <div data-testid="svc-new-step2">
            <h3 className="font-black text-slate-900 text-[15px] mt-5 mb-3">{tx('¿Qué servicio realizará?', 'Which service will be performed?')}</h3>
            <div id="svc-service" tabIndex={-1} className="grid grid-cols-1 md:grid-cols-2 gap-3 outline-none" role="radiogroup" aria-label={tx('Servicio', 'Service')}>
              {options.map(o => {
                const sel = serviceKey === o.key;
                return (
                  <button type="button" role="radio" aria-checked={sel} key={o.key} data-testid="svc-service-option" data-key={o.key} onClick={() => { setServiceKey(o.key); setError(null); }}
                    className={`relative text-left rounded-2xl border-2 px-4 py-4 min-h-[88px] transition-[border-color,box-shadow] ${sel ? 'border-blue-600 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/80 shadow-md shadow-blue-500/10' : 'border-slate-200 bg-gradient-to-b from-white to-slate-50/70 hover:border-slate-300'}`}>
                    {sel && badge}
                    <span className="block text-[24px] leading-none mb-2" aria-hidden="true">{o.icon}</span>
                    <span className="block font-black text-slate-900 text-[13px]">{o.label}</span>
                  </button>
                );
              })}
            </div>
            {cat.status === 'loading' && <p className="text-[11px] text-slate-500 mt-2">{tx('Vinculando con el catálogo de tipos de servicio de MariaDB…', 'Linking with the MariaDB service-type catalog…')}</p>}
            {errorBar}
            {footer(back(() => go(1)), primary(nextFromService, tx('Continuar →', 'Continue →'), 'svc-new-next'))}
          </div>
        )}

        {step === 3 && !result && (
          <div data-testid="svc-new-step3">
            <h3 className="font-black text-slate-900 text-[15px] mt-5 mb-3">{tx('Crear y vincular la requisición del servicio', 'Create and link the service requisition')}</h3>
            <div className="rounded-xl border-l-4 border-blue-600 bg-blue-50/80 px-4 py-3 text-[12px] text-slate-700 leading-relaxed">
              {en
                ? <><b>A single master requisition:</b> the <b>Client folio / requisition</b> and the <b>Internal reference</b>, entered or generated here, are stored in <b>Request / Requisition → Requisitions matrix</b> and linked to the <b>Operational Services → Matrix</b> file. No duplicate requisition is created.</>
                : <><b>Una sola requisición maestra:</b> el <b>Folio / requisición del cliente</b> y la <b>Referencia interna</b>, sean capturados o generados aquí, se guardarán en <b>Solicitud / Requisición → Matriz de requisiciones</b> y quedarán vinculados al expediente de <b>Servicios Operativos → Matriz</b>. No se crea una requisición duplicada.</>}
            </div>
            {catalogState || (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="relative md:col-span-2" ref={pickerRef}>
                  {label('client_id', tx('Cliente *', 'Client *'))}
                  <button id="svc-client_id" type="button" data-testid="svc-client" aria-haspopup="listbox" aria-expanded={picker} onClick={() => setPicker(p => !p)}
                    className={`${fieldCls('client_id')} flex items-center justify-between text-left text-slate-900`}>
                    <span className="truncate font-black text-[15px]">{client ? clientLabel(client) : tx('Seleccionar cliente...', 'Select client...')}</span><span className="text-slate-500 text-sm ml-2" aria-hidden="true">v</span>
                  </button>
                  {picker && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 text-[13px]" data-testid="svc-client-menu">
                      <input autoFocus value={search} onChange={e => setSearch(e.target.value)} data-testid="svc-client-search" aria-label={tx('Buscar cliente', 'Search client')}
                        placeholder={tx('Buscar por número, razón social, RFC o nombre...', 'Search by number, legal name, tax ID or name...')} className="w-full h-10 px-3 rounded-lg border-2 border-blue-500/70 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-100" />
                      <p className="text-[10px] text-slate-500 mt-1 mb-1 px-1" data-testid="svc-client-count">{tx(`Mostrando ${list.length} de ${clients.length} · escribe para filtrar`, `Showing ${list.length} of ${clients.length} · type to filter`)}</p>
                      <ul role="listbox" className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {list.map(c => <li key={c.id}><button type="button" role="option" aria-selected={c.id === form.client_id} data-testid="svc-client-option" onClick={() => pick(c)} className={`w-full text-left px-2.5 py-2 text-slate-800 hover:bg-blue-50 ${c.id === form.client_id ? 'bg-blue-50' : ''}`}><span className="text-[12px] font-extrabold">{clientLabel(c)}</span></button></li>)}
                        {!list.length && <li className="px-2.5 py-3 text-[12px] text-slate-500">{tx('Sin clientes que coincidan.', 'No matching clients.')}</li>}
                      </ul>
                    </div>
                  )}
                </div>
                <div>
                  {label('folio', tx('Folio / requisición del cliente *', 'Client folio / requisition *'))}
                  <div className="flex gap-2 text-[13px]">
                    <input id="svc-folio" data-testid="svc-folio" value={form.folio} onChange={e => { generatedFolio.current = ''; set('folio', e.target.value); }} className={fieldCls('folio')} aria-invalid={error?.field === 'folio' || undefined} placeholder="Ej. 1990000141" />
                    <button type="button" data-testid="svc-gen-folio" onClick={generateFolio} disabled={!!busy} className="shrink-0 h-11 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/30 disabled:opacity-60 whitespace-nowrap"><span className="text-[11px] font-black">⚙ {busy === 'folio' ? '…' : tx('Generar', 'Generate')}</span></button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{tx('Si el cliente ya proporcionó un folio, captúralo manualmente. Si no existe, puedes generarlo y será el mismo número en Solicitud / Requisición.', 'If the client already provided a folio, enter it manually. Otherwise generate it; it will be the same number in Request / Requisition.')}</p>
                </div>
                <div>
                  {label('reference', tx('Referencia interna', 'Internal reference'))}
                  <div className="flex gap-2 text-[13px]">
                    <input id="svc-reference" data-testid="svc-reference" value={form.reference} onChange={e => set('reference', e.target.value)} className={fieldCls('reference')} aria-invalid={error?.field === 'reference' || undefined} placeholder="Ej. SRV-TRION-2026-0001" />
                    <button type="button" data-testid="svc-gen-reference" onClick={generateReference} disabled={!!busy} className="shrink-0 h-11 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-fuchsia-500/30 disabled:opacity-60 whitespace-nowrap"><span className="text-[11px] font-black">⚙ {busy === 'reference' ? '…' : tx('Generar', 'Generate')}</span></button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{tx('Referencia interna de seguimiento. Se guardará en la requisición maestra y se propagará a los documentos relacionados.', 'Internal tracking reference. It is stored in the master requisition and carried to related documents.')}</p>
                </div>
                {input('project', tx('Proyecto *', 'Project *'), { placeholder: tx('Proyecto / instalación', 'Project / site') })}
                {input('contract', tx('Contrato / referencia contractual', 'Contract / contractual reference'), { placeholder: tx('Contrato', 'Contract') })}
                {input('request_date', tx('Fecha de solicitud *', 'Request date *'), { type: 'date' })}
                {input('need_date', tx('Fecha requerida', 'Required date'), { type: 'date' })}
                {input('requester_name', tx('Solicitante del cliente *', 'Client requester *'), { placeholder: tx('Nombre de la persona solicitante', 'Requester name') })}
                {input('requester_email', tx('Correo del solicitante *', 'Requester email *'), { type: 'email', placeholder: 'solicitante@cliente.com' })}
                {input('place', tx('Lugar de prestación / entrega', 'Service / delivery place'), { wrap: 'md:col-span-2', placeholder: tx('Patio, terminal, plataforma, instalación...', 'Yard, terminal, platform, site...') })}
                <div className="md:col-span-4 text-[13px]">
                  {label('description', tx('Descripción / alcance del servicio', 'Service description / scope'))}
                  <textarea id="svc-description" data-testid="svc-description" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder={tx('Describe la necesidad del cliente y el alcance inicial del servicio.', "Describe the client's need and the initial scope of the service.")}
                    className={`${fieldCls('description')} h-auto py-2.5 resize-y`} />
                  {option && <p className="text-[11px] text-slate-500 mt-1">{tx(`Servicio seleccionado: ${option.icon} ${option.label}. Si la descripción queda vacía, la partida usará «${option.label}».`, `Selected service: ${option.icon} ${option.label}. If left empty, the line uses "${option.label}".`)}</p>}
                </div>
              </div>
            )}
            <div className="mt-4 rounded-xl border-l-4 border-blue-600 bg-blue-50/80 px-4 py-3 text-[12px] text-slate-700">
              <b>{tx('Autorización comercial:', 'Commercial authorization:')}</b> {tx('PO, Orden de Servicio, contrato, correo, portal o emergencia se podrá registrar después dentro del expediente del servicio cuando exista.', 'PO, Service Order, contract, email, portal or emergency can be registered later in the service file when it exists.')}
            </div>
            {errorBar}
            {footer(back(() => go(2)), primary(submit, busy === 'submit' ? tx('Verificando…', 'Checking…') : tx('Crear requisición y continuar →', 'Create requisition and continue →'), 'svc-new-submit', !!busy || cat.status !== 'ready'))}
          </div>
        )}

        {step === 3 && resultView}
      </div>
    </div>,
    document.body
  );
}
