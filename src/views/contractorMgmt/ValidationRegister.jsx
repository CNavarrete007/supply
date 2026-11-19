import React, { useMemo, useState } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { validationSetup, validationRequisition } from './api';
import { TECH_RESULTS, CONTRACT_RESULTS, BUDGET_RESULTS, STRATEGIES, emptyValidation, clearKeepingRequisition, canQuote, blockReasons, requisitionOptions, buyerOptions, validateValidation, validationLockedText, nextStepBlock, fromPreset, editLockedText } from './validationForm.mjs';
import { useLoad } from '../reception/useLoad.js';

// Gestión del Contratista · tarjeta 1 "Registro de validación" (diseño Grupo Gerez) conectada a MariaDB en modo lectura.
// Requisiciones, responsables de compras (personal del contratista activo) y contexto con las validaciones registradas
// (requisition_reviews). "Guardar validación" valida todo y no escribe: registrar validaciones sigue bloqueado.
const DASH = '—';
const ymd = v => (v ? String(v).slice(0, 10) : DASH);
const money = (v, cur) => (v === null || v === undefined ? DASH : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur || ''}`.trim());

export function ValidationRegister({ en = false, notify = () => {}, onGo, edit = null, onExitEdit, startRequisition = '' }) {
  const tx = (es, e) => (en ? e : es);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const [f, setF] = useState(() => (edit ? fromPreset(edit) : { ...emptyValidation(), requisition: startRequisition || '' }));
  const [tried, setTried] = useState(false); const [msg, setMsg] = useState(null);
  const setup = useLoad(s => validationSetup(s), []);
  const detail = useLoad(s => validationRequisition(f.requisition, s), [f.requisition], !!f.requisition);
  const d = detail.status === 'ready' && detail.data?.item?.id === f.requisition ? detail.data : null;
  const buyers = setup.data?.buyers || [];
  const v = useMemo(() => validateValidation(f, { req: d?.item || null, reviews: d?.reviews || [], today, buyers, edit }, en), [f, d, today, buyers, edit, en]);
  const err = k => (tried ? v.errors[k] : '');
  const set = (k, val) => { setF(x => ({ ...x, [k]: val })); setMsg(null); };

  const save = () => {
    setTried(true);
    if (!v.ok) { setMsg({ kind: 'error', text: v.first }); return; }
    const b = buyers.find(x => x.id === f.buyer);
    const text = edit ? editLockedText(f, edit, en) : validationLockedText(f, d?.item || setup.data?.requisitions?.find(r => r.id === f.requisition), b?.name || DASH, en);
    setMsg({ kind: 'locked', text }); notify(edit ? tx('Cambios no registrados', 'Changes not recorded') : tx('Validación no registrada', 'Validation not recorded'), text, 'warning');
  };
  const next = () => {
    const block = nextStepBlock(f, en);
    if (block) { setMsg({ kind: 'error', text: block }); return; }
    onGo?.('strategy', tx('Estrategia y lotificación', 'Strategy & Lotting'));
  };

  const lbl = (t, req, k, child, cls = '', help = '') => <label className={`block ${cls}`}><span className="block text-[11px] font-black text-slate-900 mb-1.5">{t}{req ? ' *' : ''}</span>{child}{help && <span className="block text-[9.5px] text-slate-500 mt-1">{help}</span>}{err(k) && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{err(k)}</span>}</label>;
  const ctl = k => `w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${err(k) ? 'border-rose-400' : 'border-slate-300'}`;
  const ro = 'w-full px-3.5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-default';
  const sel = (k, label, list) => lbl(label, false, k, <select aria-label={label} value={f[k]} onChange={e => set(k, e.target.value)} className={ctl(k)}>{list.map(([es, e2]) => <option key={es} value={es}>{en ? e2 : es}</option>)}</select>);
  const pill = (ok, yes, no) => <span className={`inline-block px-2.5 py-1 rounded-full text-[9.5px] font-black border whitespace-nowrap ${ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{ok ? yes : no}</span>;
  const res = x => { const k = String(x || '').toLowerCase(); const tone = /^(conforme|disponible)$/.test(k) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : /^(no conforme|no disponible)$/.test(k) ? 'bg-rose-50 text-rose-700 border-rose-200' : /pendiente/.test(k) ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-200'; return <span className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] font-black border whitespace-nowrap ${tone}`}>{x || DASH}</span>; };

  return <div className="space-y-5" data-testid="validation-register">
    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-4 border-b border-slate-100">
      <div className="min-w-0"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Gestión interna del contratista', 'Internal contractor management')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Este es el paso intermedio antes de cotizar y emitir la orden de compra.', 'This is the intermediate step before quoting and issuing the purchase order.')}</p></div>
      <span className="text-[10.5px] font-black text-blue-900 bg-blue-100/80 border border-blue-200 rounded-full px-3 py-1 shrink-0">{tx('Paso 2 · Validación interna', 'Step 2 · Internal validation')}</span>
    </div>
    {edit ? <div data-testid="validation-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-purple-200 bg-purple-50/60 text-xs font-black text-purple-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-300 to-purple-600 shadow-inner shrink-0" />{tx(`Modo edición activo: ${edit.folio}. Modifica la información y presiona Guardar; "+ Nueva validación" sale de la edición.`, `Edit mode active: ${edit.folio}. Change the information and press Save; "+ New validation" leaves edit mode.`)}{!edit.buyer && edit.buyerName && <span className="font-semibold text-purple-800"> {tx('Responsable registrado', 'Recorded manager')}: {edit.buyerName}.</span>}</div>
      : <div data-testid="validation-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs font-black text-emerald-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-inner shrink-0" />{tx('Modo nueva captura activo. Completa la información y presiona Guardar. Al terminar, el formulario se limpiará y bloqueará.', 'New capture mode active. Fill in the information and press Save. When finished, the form will be cleared and locked.')}</div>}
    {setup.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
    {setup.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{setup.error.message}</p>}

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {lbl(tx('Requisición', 'Requisition'), true, 'requisition', <select aria-label={tx('Requisición', 'Requisition')} value={f.requisition} disabled={!!edit} onChange={e => { set('requisition', e.target.value); }} className={`${ctl('requisition')} disabled:bg-slate-100`}><option value="">{tx('Seleccionar...', 'Select...')}</option>{requisitionOptions(setup.data?.requisitions || [], en).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>, 'md:col-span-2')}
      {lbl(tx('Folio interno', 'Internal folio'), false, 'folio', <input type="text" readOnly aria-label={tx('Folio interno', 'Internal folio')} value={edit ? edit.folio : tx('Automático', 'Automatic')} className={`${ro} ${edit ? 'font-black text-slate-800' : ''}`} />)}
      {lbl(tx('Referencia interna', 'Internal reference'), false, 'ref', <input type="text" readOnly aria-label={tx('Referencia interna', 'Internal reference')} value={!f.requisition ? '' : d ? (d.item.internal_reference || tx('Sin referencia interna registrada', 'No internal reference recorded')) : '…'} placeholder={tx('Automática desde la requisición', 'Automatic from the requisition')} className={`${ro} font-black placeholder:text-slate-500`} />)}
      {lbl(tx('Responsable de compras', 'Purchasing manager'), true, 'buyer', <select aria-label={tx('Responsable de compras', 'Purchasing manager')} value={f.buyer} onChange={e => set('buyer', e.target.value)} className={ctl('buyer')}><option value="">{tx('Selecciona responsable de compras...', 'Select purchasing manager...')}</option>{buyerOptions(buyers, en).map(o => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}</select>, '', tx('Personal del contratista activo registrado en Contratista → Personal / contactos.', 'Personnel of the active contractor recorded in Contractor → Personnel / contacts.'))}
      {sel('technical', tx('Validación técnica', 'Technical validation'), TECH_RESULTS)}
      {sel('contract', tx('Validación contractual', 'Contractual validation'), CONTRACT_RESULTS)}
      {sel('budget', tx('Disponibilidad presupuestal', 'Budget availability'), BUDGET_RESULTS)}
      {sel('strategy', tx('Estrategia de compra', 'Purchase strategy'), STRATEGIES)}
      {lbl(tx('Número mínimo de cotizaciones', 'Minimum number of quotes'), false, 'minQuotes', <input type="text" inputMode="numeric" aria-label={tx('Número mínimo de cotizaciones', 'Minimum number of quotes')} value={f.minQuotes} onChange={e => set('minQuotes', e.target.value)} className={ctl('minQuotes')} />)}
      {lbl(tx('Fecha límite de cotización', 'Quotation deadline'), false, 'deadline', <input type="date" aria-label={tx('Fecha límite de cotización', 'Quotation deadline')} value={f.deadline} min={today} onChange={e => set('deadline', e.target.value)} className={ctl('deadline')} />)}
      <div className="hidden md:block" />
      {lbl(tx('Criterios de evaluación', 'Evaluation criteria'), false, 'criteria', <input type="text" aria-label={tx('Criterios de evaluación', 'Evaluation criteria')} value={f.criteria} maxLength={1100} onChange={e => set('criteria', e.target.value)} className={ctl('criteria')} />, 'md:col-span-2')}
      {lbl(tx('Observaciones internas / justificación', 'Internal notes / justification'), false, 'notes', <textarea rows={3} aria-label={tx('Observaciones internas / justificación', 'Internal notes / justification')} value={f.notes} maxLength={2100} onChange={e => set('notes', e.target.value)} className={ctl('notes')} />, 'md:col-span-4')}
    </div>

    {!f.requisition ? <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-xl p-3.5 text-xs text-slate-700">{tx('Selecciona una requisición para revisar su contexto.', 'Select a requisition to review its context.')}</div>
      : <div data-testid="validation-context" className="space-y-3">
        {detail.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
        {detail.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{detail.error.message}</p>}
        {d && <>
          <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed"><strong className="text-slate-900">{d.item.folio}</strong> · {d.item.client_name} · {d.item.project || DASH} · {tx('Solicitada', 'Requested')}: {ymd(d.item.request_date)} · {tx('Requerida', 'Needed')}: {ymd(d.item.need_date)} · {tx('Prioridad', 'Priority')}: {d.item.priority} · {tx('Presupuesto', 'Budget')}: {money(d.item.budget_amount, d.item.currency)} · {tx('Solicitante', 'Requester')}: {d.item.requester_name || DASH} · {tx('Entrega', 'Delivery')}: {d.item.delivery_place || DASH}
            <div className="mt-1.5 flex flex-wrap gap-1.5">{[[d.items.length, tx('partida(s)', 'line(s)')], [d.item.rfq_count, 'RFQ'], [d.item.quote_count, tx('cotización(es)', 'quote(s)')], [d.item.po_count, 'OC']].map(([n, t]) => <span key={t} className="px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[10px] font-black text-blue-900">{n} {t}</span>)}</div></div>
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white"><table className="w-full text-left border-collapse text-[10.5px] min-w-[560px]"><thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">{['#', tx('Descripción', 'Description'), tx('Cantidad', 'Quantity'), tx('Unidad', 'Unit'), tx('Categoría', 'Category')].map(h => <th key={h} className="p-2.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{d.items.map(i => <tr key={i.line_number}><td className="p-2.5">{i.line_number}</td><td className="p-2.5 font-semibold text-slate-800">{i.description}</td><td className="p-2.5">{i.quantity}</td><td className="p-2.5">{i.unit_label}</td><td className="p-2.5">{i.category || DASH}</td></tr>)}{!d.items.length && <tr><td colSpan={5} className="p-6 text-center text-slate-400">{tx('La requisición no tiene partidas activas.', 'The requisition has no active lines.')}</td></tr>}</tbody></table></div>
          <div data-testid="validation-history" className="space-y-2">
            <h4 className="text-xs font-black text-slate-900">{tx('Validaciones registradas', 'Recorded validations')} ({d.reviews.length})</h4>
            {d.reviews.length ? <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white"><table className="w-full text-left border-collapse text-[10.5px] min-w-[980px]"><thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">{[tx('Folio interno', 'Internal folio'), tx('Responsable', 'Manager'), tx('Técnica', 'Technical'), tx('Contractual', 'Contractual'), tx('Presupuesto', 'Budget'), tx('Estrategia', 'Strategy'), tx('Mín. cotizaciones', 'Min. quotes'), tx('Fecha límite', 'Deadline'), tx('¿Puede cotizar?', 'Can quote?')].map(h => <th key={h} className="p-2.5 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{d.reviews.map(r => <tr key={r.id} className="align-top"><td className="p-2.5 font-black text-slate-900 whitespace-nowrap">{r.folio}<div className="text-[9px] text-slate-400 font-normal">{ymd(r.created_at)}</div></td><td className="p-2.5">{r.buyer || DASH}</td><td className="p-2.5">{res(r.technical)}</td><td className="p-2.5">{res(r.contract)}</td><td className="p-2.5">{res(r.budget)}</td><td className="p-2.5">{r.strategy}<div className="text-[9px] text-slate-500 max-w-[220px]">{r.criteria}</div></td><td className="p-2.5">{r.min_quotes}</td><td className="p-2.5 whitespace-nowrap">{ymd(r.deadline)}</td><td className="p-2.5">{pill(canQuote(r), tx('Sí', 'Yes'), tx('No (Bloqueado)', 'No (Blocked)'))}{!canQuote(r) && <div className="text-[9px] text-rose-600 mt-1">{blockReasons(r, en)}</div>}{r.notes && <div className="text-[9px] text-slate-500 mt-1 max-w-[220px]">{r.notes}</div>}</td></tr>)}</tbody></table></div>
              : <p className="text-[11px] text-slate-500">{tx('Sin validaciones registradas para esta requisición.', 'No validations recorded for this requisition.')}</p>}
          </div>
        </>}
      </div>}

    {f.requisition && <div data-testid="validation-verdict" className={`p-3 rounded-xl border text-xs font-semibold ${v.canQuote ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{tx('Con esta captura, ¿puede pasar a cotización?', 'With this capture, can it move to quoting?')} <strong>{v.canQuote ? tx('Sí', 'Yes') : `${tx('No', 'No')} (${blockReasons(f, en)})`}</strong></div>}
    {tried && v.ok && v.warnings.map(w => <p key={w} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">⚠ {w}</p>)}
    {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} data-testid="validation-save-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{msg.text}</span></p>}
    <div className="flex flex-wrap gap-3 pt-1 text-sm font-black">
      <button type="button" onClick={() => { if (edit) { onExitEdit?.(); return; } setF(emptyValidation()); setTried(false); setMsg(null); }} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2">+ {tx('Nueva validación', 'New validation')}</button>
      <button type="button" onClick={save} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">💾</span>{edit ? tx('Guardar cambios', 'Save changes') : tx('Guardar validación', 'Save validation')}</button>
      <button type="button" onClick={next} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">➡</span>{tx('Siguiente paso', 'Next step')}</button>
      <button type="button" onClick={() => { setF(x => (edit ? fromPreset(edit) : clearKeepingRequisition(x))); setTried(false); setMsg(null); }} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm flex items-center gap-2"><span aria-hidden="true">🧹</span>{tx('Limpiar', 'Clear')}</button>
      <button type="button" onClick={() => onGo?.('matrix', tx('Matriz de validaciones', 'Validation Matrix'))} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver matriz', 'View matrix')}</button>
    </div>
  </div>;
}

export default ValidationRegister;
