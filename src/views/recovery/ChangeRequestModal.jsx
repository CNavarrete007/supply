import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { getRequisition, getRecoveryCatalogs, createChange } from './api';
import { SOURCES, TYPES, ACTIONS, emptyChange, toChangePayload, validateChange, validateDraft, lineResult, changeOutcome, normQty } from './changeForm.mjs';

// "Modificación controlada de requisición" (diseño original de Cotizaciones › Revisiones). Registra una solicitud R3A
// real (POST /api/v1/recovery/requisitions/{id}/changes) en estado "pendiente de revisión". No aplica el cambio, no
// genera la nueva revisión de la cotización al cliente y no toca RFQ/OC: eso exige revisión independiente (R3B) y las
// escrituras comerciales siguen bloqueadas. Reutilizable por Requisiciones › Control de cambios (INT03-D2).
const newKey = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)));

export function ChangeRequestModal({ requisitionId, context = {}, en = false, onClose, onCreated, onNotify }) {
  const tx = (es, e) => (en ? e : es);
  const [load, setLoad] = useState({ status: 'loading', error: null });
  const [detail, setDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  const read = async (signal) => {
    const [d, c] = await Promise.all([getRequisition(requisitionId, signal), getRecoveryCatalogs(signal)]);
    return { d, cats: (c.categories || []).filter(x => x.active).map(x => x.name) };
  };
  useEffect(() => {
    alive.current = true;
    const c = new AbortController();
    read(c.signal).then(({ d, cats }) => { if (!c.signal.aborted) { setDetail(d); setCategories(cats); setForm(emptyChange(d)); setLoad({ status: 'ready', error: null }); } })
      .catch(e => { if (!c.signal.aborted) setLoad({ status: 'error', error: e }); });
    return () => { alive.current = false; c.abort(); };
  }, [requisitionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadDetail = async () => {
    try { const { d } = await read(); if (!alive.current) return; setDetail(d); setForm(f => ({ ...emptyChange(d), date: f.date, requested_by: f.requested_by, source: f.source, change_type: f.change_type, reference: f.reference, reason: f.reason })); }
    catch (e) { if (alive.current) setMessage(e.message); }
  };

  const close = () => {
    if (busy) return;
    if (pending && !window.confirm(tx('La última solicitud no se confirmó. Si cierras, revisa la matriz de cambios antes de volver a registrarla. ¿Cerrar?', 'The last request was not confirmed. If you close, check the change list before registering it again. Close?'))) return;
    onClose?.();
  };
  useEffect(() => { const k = e => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });

  const locked = !!pending || busy;
  const set = (k, v) => { if (locked) return; setForm(f => ({ ...f, [k]: v })); setErrors(x => ({ ...x, [k]: undefined, changes: undefined })); };
  const setLine = (id, patch) => { if (locked) return; setForm(f => ({ ...f, lines: f.lines.map(l => (l.id === id ? { ...l, ...(patch.action === 'keep' || patch.action === 'cancel' ? { description: l.original.description, quantity: l.original.quantity, unit: l.original.unit, category: l.original.category } : {}), ...patch } : l)) })); setErrors(x => ({ ...x, [`line:${id}`]: undefined, changes: undefined })); };
  const setDraft = (k, v) => { if (locked) return; setForm(f => ({ ...f, draft: { ...f.draft, [k]: v } })); setErrors(x => ({ ...x, draft: undefined })); };
  const addDraft = () => {
    if (locked) return;
    const e = validateDraft(form.draft, en);
    if (e) { setErrors(x => ({ ...x, draft: e })); return; }
    setForm(f => ({ ...f, additions: [...f.additions, { ...f.draft, quantity: normQty(f.draft.quantity) }], draft: { description: '', quantity: '', unit: '', category: '' } }));
    setErrors(x => ({ ...x, draft: undefined, changes: undefined, change_type: undefined }));
  };
  const removeAdd = i => { if (locked) return; setForm(f => ({ ...f, additions: f.additions.filter((_, n) => n !== i) })); };

  const submit = async (ev) => {
    ev?.preventDefault();
    if (inFlight.current || !detail || !form) return;
    if (!pending) {
      const v = validateChange(form, en);
      if (!v.ok) { setErrors(v.errors); setMessage(v.first); return; }
    }
    // The exact key and content are kept until a definite answer: an uncertain retry never duplicates the request.
    const op = pending || { id: requisitionId, version: detail.version, key: newKey(), data: toChangePayload(form) };
    inFlight.current = true; setPending(op); setBusy(true); setMessage('');
    try {
      const out = await createChange(op);
      if (!alive.current) return;
      setPending(null); setDone(out);
      const note = tx(`Solicitud ${out.folio} registrada: Rev. ${out.previous_revision_number} → Rev. ${out.proposed_revision_number}, pendiente de revisión independiente.`, `Request ${out.folio} registered: Rev. ${out.previous_revision_number} → Rev. ${out.proposed_revision_number}, pending independent review.`);
      onNotify?.(tx('Modificación solicitada', 'Change requested'), note, 'success');
      onCreated?.(out);
    } catch (e) {
      if (!alive.current) return;
      const o = changeOutcome(e, en);
      setPending(o.keep ? op : null); setMessage(o.message);
      if (o.reload) await reloadDetail();
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };

  const inp = (err, extra = '') => `w-full bg-white border ${err ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300'} text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500 ${extra}`;
  const lab = (txt, req) => <span className="text-[10px] font-bold text-slate-700 mb-1">{txt}{req ? ' *' : ''}</span>;
  const err = k => (errors[k] ? <span className="text-[10px] text-rose-600 mt-0.5">{errors[k]}</span> : null);
  const catOptions = cur => [...new Set([...(cur ? [cur] : []), ...categories])];
  const rev = Number(detail?.current_revision_number ?? 0);
  const RESULT = { none: [tx('Sin cambio', 'No change'), 'text-blue-700 bg-blue-50'], same: [tx('Sin diferencias', 'No differences'), 'text-slate-600 bg-slate-100'], modified: [tx('Modificada', 'Modified'), 'text-amber-800 bg-amber-50'], cancelled: [tx('Cancelada', 'Cancelled'), 'text-rose-700 bg-rose-50'] };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="sf-change-title" data-testid="change-modal" className="text-xs bg-slate-50 w-full max-w-6xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-gradient-to-r from-[#2B4B9A] to-[#8C3AAA] px-6 py-4 flex justify-between items-start shrink-0 gap-3">
        <div>
          <h2 id="sf-change-title" className="text-white font-black text-lg flex items-center gap-2"><span className="text-xl">🔁</span>{tx('Modificación controlada de requisición', 'Controlled requisition modification')}</h2>
          <p className="text-[11px] text-blue-100 mt-0.5">{[detail?.folio || context.requisition, detail?.client || context.client, context.quoteFolio && `${tx('Cotización', 'Quote')} ${context.quoteFolio}${context.currentRev !== undefined ? ` · Rev. ${context.currentRev}` : ''}`].filter(Boolean).join(' · ')}</p>
        </div>
        <span className="font-bold shrink-0"><button type="button" onClick={close} disabled={busy} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer border border-white/30 disabled:opacity-50">{tx('X Cerrar', 'X Close')}</button></span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {load.status === 'loading' && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Consultando la requisición en MariaDB…', 'Loading the requisition from MariaDB…')}</p>}
        {load.status === 'error' && <p role="alert" className="text-xs text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{load.error?.status === 401 ? tx('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.') : load.error?.status === 403 ? tx('Solo un Master Admin puede solicitar modificaciones.', 'Only a Master Admin can request changes.') : load.error?.message}</p>}

        {done && <div data-testid="change-done" className="bg-white rounded-lg border border-emerald-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-black text-sm"><CheckCircle2 className="w-5 h-5" />{tx('Solicitud registrada', 'Request registered')} · {done.folio}{done.replayed ? ` (${tx('confirmada por reintento seguro', 'confirmed by safe retry')})` : ''}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">{[[tx('Requisición', 'Requisition'), done.requisition_folio], [tx('Revisión', 'Revision'), `Rev. ${done.previous_revision_number} → Rev. ${done.proposed_revision_number}`], [tx('Cambios', 'Changes'), done.change_count], [tx('Estatus', 'Status'), tx('Pendiente de revisión', 'Pending review')], [tx('Requiere reabastecimiento', 'Requires sourcing'), done.requires_sourcing ? tx('Sí', 'Yes') : 'No'], [tx('Confirmación del proveedor', 'Supplier confirmation'), done.requires_supplier_confirmation ? tx('Por evaluar', 'To evaluate') : tx('No requerida', 'Not required')]].map(([k, v]) => <div key={k} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100"><div className="text-[9px] uppercase font-bold text-slate-400">{k}</div><div className="font-bold text-slate-800">{v}</div></div>)}</div>
          <p className="text-[11px] text-slate-600">{tx('El expediente y la cotización vigentes no cambiaron. Un Master Admin distinto debe revisar la solicitud (R3B); la nueva revisión de la cotización al cliente se emite después, cuando las escrituras comerciales estén validadas.', 'The current record and quote did not change. A different Master Admin must review the request (R3B); the new client quote revision is issued later, once commercial writes are validated.')}</p>
          <div className="flex justify-end font-bold"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg">{tx('Cerrar', 'Close')}</button></div>
        </div>}

        {!done && form && <form id="sf-change-form" onSubmit={submit} noValidate className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="mb-4"><h3 className="text-sm font-black text-slate-800">{tx('1. Datos del cambio', '1. Change details')}</h3><p className="text-[10px] text-slate-500 mt-0.5">{tx('Registra quién solicita el cambio y la evidencia que respalda la modificación.', 'Record who requests the change and the evidence supporting it.')}</p></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <label className="flex flex-col">{lab(tx('Folio de cambio', 'Change folio'))}<input type="text" disabled value={tx('Se asigna al registrar (CR-AAAA-####)', 'Assigned on register (CR-YYYY-####)')} className={inp(false, 'cursor-not-allowed')} /></label>
              <label className="flex flex-col">{lab(tx('Revisión actual → nueva', 'Current revision → new'))}<input type="text" disabled value={`Rev. ${rev} → Rev. ${rev + 1}`} className={inp(false, 'cursor-not-allowed')} /></label>
              <label className="flex flex-col">{lab(tx('Fecha del cambio', 'Change date'), true)}<input type="date" value={form.date} onChange={e => set('date', e.target.value)} disabled={locked} className={inp(errors.date)} />{err('date')}</label>
              <label className="flex flex-col">{lab(tx('Solicitado por', 'Requested by'), true)}<input type="text" value={form.requested_by} maxLength={255} onChange={e => set('requested_by', e.target.value)} disabled={locked} placeholder={tx('Nombre de quien solicita', 'Requester name')} className={inp(errors.requested_by)} />{err('requested_by')}</label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <label className="flex flex-col">{lab(tx('Origen', 'Source'), true)}<select value={form.source} onChange={e => set('source', e.target.value)} disabled={locked} className={inp(errors.source, 'cursor-pointer')}><option value="">{tx('Seleccionar…', 'Select…')}</option>{SOURCES.map(([v, e]) => <option key={v} value={v}>{en ? e : v}</option>)}</select>{err('source')}</label>
              <label className="flex flex-col">{lab(tx('Tipo principal', 'Main type'), true)}<select value={form.change_type} onChange={e => set('change_type', e.target.value)} disabled={locked} className={inp(errors.change_type, 'cursor-pointer')}><option value="">{tx('Seleccionar…', 'Select…')}</option>{TYPES.map(([v, e]) => <option key={v} value={v}>{en ? e : v}</option>)}</select>{err('change_type')}</label>
              <label className="flex flex-col">{lab(tx('Referencia / documento', 'Reference / document'))}<input type="text" value={form.reference} maxLength={255} onChange={e => set('reference', e.target.value)} disabled={locked} placeholder={tx('Correo, PO cliente, SO, minuta, folio...', 'Email, client PO, SO, minutes, folio...')} className={inp(errors.reference)} />{err('reference')}</label>
            </div>
            <label className="flex flex-col mb-4">{lab(tx('Motivo / instrucción del cliente', 'Client reason / instruction'), true)}<textarea rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} disabled={locked} placeholder={tx('Describe exactamente lo autorizado originalmente y lo que el cliente solicita modificar.', 'Describe exactly what was originally authorized and what the client asks to change.')} className={inp(errors.reason)} />{err('reason')}</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div className="flex flex-col">{lab(tx('Evidencia', 'Evidence'))}<p className="text-[10px] text-slate-500 leading-snug border border-dashed border-slate-300 rounded p-2 bg-slate-50">{tx('Indica en Referencia / documento el correo, PO, minuta o folio que respalda el cambio. Los archivos de evidencia se vinculan en la conciliación con constancia (R3C3); esta solicitud no adjunta archivos.', 'Use Reference / document for the email, PO, minutes or folio backing the change. Evidence files are linked in the reconciliation record (R3C3); this request attaches no files.')}</p></div>
              <label className="flex flex-col">{lab(tx('Fecha requerida revisada', 'Revised required date'))}<input type="date" value={form.need_date} onChange={e => set('need_date', e.target.value)} disabled={locked} className={inp(errors.need_date)} /><span className="text-[9px] text-slate-400 mt-0.5">{tx('Vigente', 'Current')}: {form.base.need_date || '—'}</span>{err('need_date')}</label>
              <label className="flex flex-col">{lab(tx('Lugar de entrega revisado', 'Revised delivery place'))}<input type="text" value={form.delivery_place} onChange={e => set('delivery_place', e.target.value)} disabled={locked} className={inp(errors.delivery_place)} /><span className="text-[9px] text-slate-400 mt-0.5">{tx('Vigente', 'Current')}: {form.base.delivery_place || '—'}</span>{err('delivery_place')}</label>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            <div className="mb-4"><h3 className="text-sm font-black text-slate-800">{tx('2. Partidas antes y después', '2. Items before and after')}</h3><p className="text-[10px] text-slate-500 mt-0.5">{tx('Las partidas canceladas no se borran; quedan en el historial de la revisión anterior y en el control de cambios.', 'Cancelled items are not deleted; they remain in the previous revision history and in the change log.')}</p></div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[960px] text-left border-collapse text-[10px]">
                <thead><tr className="bg-[#f0f4f8] text-[9px] font-bold text-[#1e4a7a] uppercase tracking-wider">{[tx('Partida', 'Item'), tx('Descripción / especificación nueva', 'New description / specification'), tx('Cant. original', 'Original qty.'), tx('Cant. nueva', 'New qty.'), tx('Unidad', 'Unit'), tx('Categoría', 'Category'), tx('Acción', 'Action'), tx('Resultado', 'Result')].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {form.lines.map((l, n) => { const editable = l.action === 'modify' && !locked; const r = RESULT[lineResult(l)]; return <tr key={l.id} data-testid="change-line" className="border-t border-slate-200 align-top">
                    <td className="px-3 py-2 w-[18%]"><p className="text-[10px] font-black text-slate-900 leading-tight">{n + 1}. {l.original.description}</p><p className="text-[9px] text-slate-400">{l.original.quantity} {l.original.unit} · {l.original.category}</p></td>
                    <td className="px-3 py-2"><input aria-label={tx('Descripción nueva', 'New description')} type="text" value={l.description} disabled={!editable} onChange={e => setLine(l.id, { description: e.target.value })} className={inp(errors[`line:${l.id}`], 'text-[10px] p-1.5')} />{err(`line:${l.id}`)}</td>
                    <td className="px-3 py-2 w-[8%]"><input type="text" disabled value={l.original.quantity} className={inp(false, 'text-[10px] p-1.5 text-center')} /></td>
                    <td className="px-3 py-2 w-[9%]"><input aria-label={tx('Cantidad nueva', 'New quantity')} type="text" inputMode="decimal" value={l.quantity} disabled={!editable} onChange={e => setLine(l.id, { quantity: e.target.value })} className={inp(false, 'text-[10px] p-1.5 text-center')} /></td>
                    <td className="px-3 py-2 w-[9%]"><input aria-label={tx('Unidad', 'Unit')} type="text" value={l.unit} maxLength={128} disabled={!editable} onChange={e => setLine(l.id, { unit: e.target.value })} className={inp(false, 'text-[10px] p-1.5 text-center')} /></td>
                    <td className="px-3 py-2 w-[13%]"><select aria-label={tx('Categoría', 'Category')} value={l.category} disabled={!editable} onChange={e => setLine(l.id, { category: e.target.value })} className={inp(false, 'text-[10px] p-1.5')}>{catOptions(l.category).map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                    <td className="px-3 py-2 w-[10%]"><select aria-label={tx('Acción', 'Action')} value={l.action} disabled={locked} onChange={e => setLine(l.id, { action: e.target.value })} className={inp(false, 'text-[10px] p-1.5 cursor-pointer')}>{ACTIONS.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select></td>
                    <td className="px-3 py-2 w-[8%] text-center"><span className={`text-[9px] font-black px-2 py-1 rounded whitespace-nowrap ${r[1]}`}>{r[0]}</span></td>
                  </tr>; })}
                  {!form.lines.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-[11px] text-slate-400">{tx('La requisición no tiene partidas registradas.', 'The requisition has no items.')}</td></tr>}
                  {form.additions.map((a, i) => <tr key={`add-${i}`} data-testid="change-addition" className="border-t border-slate-200 bg-emerald-50/40">
                    <td className="px-3 py-2 text-[10px] font-black text-emerald-700">{tx('Nueva', 'New')} {i + 1}</td><td className="px-3 py-2 text-[10px]">{a.description}</td><td className="px-3 py-2 text-[10px] text-center">—</td>
                    <td className="px-3 py-2 text-[10px] text-center">{a.quantity}</td><td className="px-3 py-2 text-[10px] text-center">{a.unit}</td><td className="px-3 py-2 text-[10px]">{a.category}</td>
                    <td className="px-3 py-2 text-center"><button type="button" onClick={() => removeAdd(i)} disabled={locked} aria-label={tx('Quitar partida nueva', 'Remove new item')} className="p-1.5 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    <td className="px-3 py-2 text-center"><span className="text-[9px] font-black px-2 py-1 rounded text-emerald-700 bg-emerald-100 whitespace-nowrap">{tx('Alta', 'Added')}</span>{err(`add:${i}`)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="border border-slate-200 border-t-0 rounded-b-lg p-4 bg-[#fafbfc] space-y-3">
              <p className="text-[10px] font-bold text-slate-700">{tx('+ Agregar nueva partida', '+ Add new item')}</p>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <input aria-label={tx('Descripción de la partida nueva', 'New item description')} type="text" value={form.draft.description} onChange={e => setDraft('description', e.target.value)} disabled={locked} placeholder={tx('Descripción / especificación', 'Description / specification')} className={inp(false, 'md:col-span-5')} />
                <input aria-label={tx('Cantidad de la partida nueva', 'New item quantity')} type="text" inputMode="decimal" value={form.draft.quantity} onChange={e => setDraft('quantity', e.target.value)} disabled={locked} placeholder={tx('Cantidad', 'Quantity')} className={inp(false, 'md:col-span-2')} />
                <input aria-label={tx('Unidad de la partida nueva', 'New item unit')} type="text" value={form.draft.unit} maxLength={128} onChange={e => setDraft('unit', e.target.value)} disabled={locked} placeholder={tx('Unidad', 'Unit')} className={inp(false, 'md:col-span-2')} />
                <select aria-label={tx('Categoría de la partida nueva', 'New item category')} value={form.draft.category} onChange={e => setDraft('category', e.target.value)} disabled={locked} className={inp(false, 'md:col-span-3 cursor-pointer')}><option value="">{tx('Categoría…', 'Category…')}</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">{err('draft') || <span className="text-[10px] text-slate-400">{tx('Para agregar partidas el tipo principal debe ser Agregar partida o Cambio de alcance.', 'To add items the main type must be Add item or Scope change.')}</span>}
                <span className="font-bold"><button type="button" onClick={addDraft} disabled={locked} className="bg-[#18bda8] hover:bg-[#139c8a] text-white font-bold text-xs py-2 px-4 rounded transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"><Plus className="w-3.5 h-3.5" />{tx('Agregar partida', 'Add item')}</button></span></div>
            </div>
          </div>
        </form>}
      </div>

      {!done && form && <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3 space-y-2">
        {(message || errors.changes) && <p role="alert" className="text-[11px] text-rose-700 flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{message || errors.changes}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] text-slate-500 max-w-3xl">{tx('Se registra como solicitud pendiente de revisión independiente (otro Master Admin). No se modifica la requisición, la cotización vigente, RFQ ni OC.', 'It is registered as a request pending independent review (another Master Admin). The requisition, current quote, RFQs and POs are not modified.')}</p>
          <div className="flex gap-2 font-bold">
            <button type="button" onClick={close} disabled={busy} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg disabled:opacity-50">{tx('Cancelar', 'Cancel')}</button>
            <button type="submit" form="sf-change-form" disabled={busy} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold rounded-lg flex items-center gap-1.5 disabled:opacity-60">{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{pending ? tx('Reintentar registro', 'Retry register') : tx('Registrar solicitud', 'Register request')}</button>
          </div>
        </div>
      </div>}
    </div>
  </div>;
}

export default ChangeRequestModal;
