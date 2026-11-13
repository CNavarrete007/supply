import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, Loader2, AlertCircle, Printer, X, Zap, ClipboardList, Eraser } from 'lucide-react';
import { getRfqSetup, listRfqRequisitions, getRfqRequisition } from './api';
import { getCatalogRecord } from '../../catalogApi';
import { RFQ_STATUSES, CURRENCY_NAMES, BLOCKED_SUPPLIER, emptyRfq, nextRfqFolio, internalReference, fromRequisition, currencyFor, validateRfq, sentToSupplier, previewDoc, rfqDocHtml } from './rfq.mjs';

// Tarjeta 2 · Solicitud de cotización a proveedores (RFQ), diseño Grupo Gerez. Todo el formulario se alimenta de MariaDB
// (validaciones del contratista, requisiciones validadas y sus partidas, proveedores, contactos de compras) y genera la
// vista previa del formato SIN precios. Guardar/enviar la RFQ es una escritura comercial bloqueada: nada se registra.
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function useLoad(fn, deps, enabled = true) {
  const [st, setSt] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!enabled) { setSt({ status: 'idle', data: null, error: null }); return undefined; }
    const c = new AbortController();
    setSt(x => ({ ...x, status: 'loading', error: null }));
    fn(c.signal).then(d => !c.signal.aborted && setSt({ status: 'ready', data: d, error: null })).catch(e => !c.signal.aborted && setSt(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, [...deps, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
const qty = v => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('es-MX', { maximumFractionDigits: 6 }) : String(v ?? '—'));

export function RfqRequestCard({ en = false, notify, onOpenMatrix, lockText, refresh = 0 }) {
  const tx = (es, e) => (en ? e : es);
  const [form, setForm] = useState(() => emptyRfq(localToday(), en));
  const [errors, setErrors] = useState({});
  const [generated, setGenerated] = useState(false);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(false);
  const [mInput, setMInput] = useState(''); const [mq, setMq] = useState('');
  useEffect(() => { const t = setTimeout(() => setMq(mInput.trim()), 300); return () => clearTimeout(t); }, [mInput]);

  const setup = useLoad(s => getRfqSetup(s), [refresh]);
  const reqs = useLoad(s => listRfqRequisitions({ buyer: form.buyer, q: mq }, s), [form.buyer, mq, refresh], !!form.buyer);
  const req = useLoad(s => getRfqRequisition(form.requisition, s), [form.requisition, refresh], !!form.requisition);
  const sup = useLoad(s => getCatalogRecord('suppliers', form.supplier, s), [form.supplier], !!form.supplier);

  const S = setup.data || {};
  const supplierOpt = (S.suppliers || []).find(x => x.id === form.supplier) || null;
  const contact = (S.contacts || []).find(x => x.id === form.contact) || null;
  const R = req.data?.item || null;
  const items = req.data?.items || [];
  const folio = nextRfqFolio(S.folios || {}, form.issue_date);

  // A newly loaded requisition fills delivery place / required date and includes all its lines (as in the design).
  useEffect(() => { if (!R) return; setForm(f => fromRequisition(f, R)); setSelected(items.map(i => i.id)); }, [R?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(x => ({ ...x, [k]: undefined })); };
  const pickBuyer = v => {
    const isContact = (S.contacts || []).some(c => c.id === v);
    setForm(f => ({ ...f, buyer: v, requisition: '', contact: isContact ? v : f.contact }));
    setGenerated(false); setSelected([]); setErrors(x => ({ ...x, buyer: undefined, requisition: undefined }));
    setMInput(''); setMq('');
    if (v) setModal(true);
  };
  const pickRequisition = id => { set('requisition', id); setModal(false); };
  const pickSupplier = v => { const o = (S.suppliers || []).find(x => x.id === v); setForm(f => ({ ...f, supplier: v, currency: v ? currencyFor(o) : f.currency })); setErrors(x => ({ ...x, supplier: undefined, currency: undefined })); };

  const generate = e => {
    e.preventDefault();
    const v = validateRfq(form, { supplier: supplierOpt }, en);
    setErrors(v.errors);
    if (!v.ok) { notify?.(tx('Solicitud incompleta', 'Incomplete request'), v.first, 'warning'); return; }
    setGenerated(true);
    notify?.(tx('Partidas habilitadas', 'Items enabled'), tx(`Se habilitaron las partidas para ${supplierOpt?.name || ''}.`, `Items enabled for ${supplierOpt?.name || ''}.`), 'success');
  };
  const doc = useMemo(() => previewDoc({ form, folio, req: R, items, selected, supplier: sup.data?.item ? { ...sup.data.item, name: sup.data.item.name || supplierOpt?.name } : supplierOpt, contact }, en), [form, folio, R, items, selected, sup.data, supplierOpt, contact, en]);
  const html = useMemo(() => rfqDocHtml(doc, en), [doc, en]);
  const print = () => {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { notify?.(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250);
  };
  const toggle = id => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const lbl = (t, req2, hint, k, control) => <label className="block text-xs font-medium text-slate-700">
    <span className="block text-[11px] font-bold text-slate-700 mb-1">{t}{req2 && <span className="text-red-500"> *</span>}</span>{control}
    {k && errors[k] ? <span role="alert" className="block text-[10px] text-rose-600 mt-1">{errors[k]}</span> : hint ? <span className="block text-[9.5px] text-slate-400 mt-1">{hint}</span> : null}
  </label>;
  const ctl = (k, extra = '') => `w-full px-3.5 py-2.5 bg-white border ${errors[k] ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs disabled:bg-slate-100/70 disabled:text-slate-500 ${extra}`;
  const loadErr = s => (s.error ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{s.error.message}</p> : null);
  const sentSame = R ? items.filter(i => selected.includes(i.id) && sentToSupplier(i, supplierOpt?.name).length) : [];

  return <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="rfq-card">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Solicitud de cotización a proveedores · RFQ', 'Request for Quotation from Suppliers · RFQ')}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{tx('Genera un documento independiente para cada proveedor. La RFQ contiene requisitos, cantidades y fechas, pero nunca precios.', 'Generate a separate document for each supplier. The RFQ contains requirements, quantities and dates, but never prices.')}</p></div>
      <span className="px-3 py-1 bg-purple-50 text-purple-700 font-bold text-[10px] rounded-full border border-purple-100 shrink-0">{tx('Etapa de abastecimiento', 'Sourcing stage')}</span>
    </div>
    <div className="p-3 bg-emerald-50/40 border-l-4 border-l-emerald-500 border border-emerald-100 rounded-xl text-xs text-slate-700 font-medium"><span className="font-bold text-slate-800">{tx('Paso 1:', 'Step 1:')} </span>{tx('Completa los datos de la solicitud y haz clic en', 'Complete the request details and click')} <strong className="text-purple-700">"{tx('Generar', 'Generate')}"</strong> {tx('para habilitar la selección de partidas y visualizar la vista previa del documento.', 'to enable item selection and see the document preview.')}</div>
    {setup.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}{loadErr(setup)}

    <form onSubmit={generate} noValidate className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6">{lbl(tx('Comprador responsable', 'Responsible buyer'), true, tx('Al seleccionar un comprador se abrirá una ventana con sus requisiciones validadas disponibles para RFQ.', 'Selecting a buyer opens a window with their validated requisitions available for RFQ.'), 'buyer',
          <select aria-label={tx('Comprador responsable', 'Responsible buyer')} value={form.buyer} onChange={e => pickBuyer(e.target.value)} className={ctl('buyer', 'border-blue-400/80')}><option value="">{tx('Seleccionar comprador...', 'Select buyer...')}</option>{(S.buyers || []).map(b => <option key={b.key} value={b.key}>{b.key === 'unassigned' ? tx('Sin comprador asignado', 'No buyer assigned') : b.name} ({b.requisitions})</option>)}</select>)}</div>
        <div className="md:col-span-6">{lbl(tx('Requisición validada', 'Validated requisition'), true, form.buyer ? tx(`${reqs.data?.total ?? '…'} requisición(es) validada(s) de este comprador.`, `${reqs.data?.total ?? '…'} validated requisition(s) for this buyer.`) : tx('Selecciona un comprador para consultar sus requisiciones.', 'Select a buyer to see their requisitions.'), 'requisition',
          <div className="flex gap-2"><select aria-label={tx('Requisición validada', 'Validated requisition')} value={form.requisition} disabled={!form.buyer} onChange={e => set('requisition', e.target.value)} className={ctl('requisition')}><option value="">{form.buyer ? tx('Seleccionar requisición...', 'Select requisition...') : tx('Selecciona primero un comprador...', 'Select a buyer first...')}</option>{R && !(reqs.data?.items || []).some(x => x.id === R.id) && <option value={R.id}>{R.folio} · {R.client_name}</option>}{(reqs.data?.items || []).map(r => <option key={r.id} value={r.id}>{r.folio} · {r.client_name}{r.description ? ` · ${r.description}` : ''}</option>)}</select>
            <span className="shrink-0 font-bold"><button type="button" onClick={() => setModal(true)} disabled={!form.buyer} className="h-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Search className="w-4 h-4" />{tx('Ver requisiciones', 'View requisitions')}</button></span></div>)}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6">{lbl(tx('Proveedor invitado', 'Invited supplier'), true, supplierOpt && !['authorized', 'active'].includes(supplierOpt.status) && !BLOCKED_SUPPLIER.has(supplierOpt.status) ? tx('Proveedor en evaluación: confirma su alta antes de adjudicar.', 'Supplier under evaluation: confirm it before awarding.') : null, 'supplier',
          <select aria-label={tx('Proveedor invitado', 'Invited supplier')} value={form.supplier} onChange={e => pickSupplier(e.target.value)} className={ctl('supplier')}><option value="">{tx('Seleccionar proveedor...', 'Select supplier...')}</option>{(S.suppliers || []).map(s => <option key={s.id} value={s.id} disabled={BLOCKED_SUPPLIER.has(s.status)}>{s.code} - {s.name}{BLOCKED_SUPPLIER.has(s.status) ? ` (${s.status === 'suspended' ? tx('suspendido', 'suspended') : tx('inactivo', 'inactive')})` : ''}</option>)}</select>)}</div>
        <div className="md:col-span-3">{lbl(tx('Folio RFQ', 'RFQ folio'), false, tx('Previsto; se confirma al guardar.', 'Expected; confirmed on save.'), null, <input aria-label={tx('Folio RFQ', 'RFQ folio')} type="text" disabled value={folio} className={ctl('', 'cursor-not-allowed')} />)}</div>
        <div className="md:col-span-3">{lbl(tx('Referencia interna', 'Internal reference'), false, null, null, <input aria-label={tx('Referencia interna', 'Internal reference')} type="text" disabled value={internalReference(R)} placeholder="—" className={ctl('', 'cursor-not-allowed font-bold')} />)}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3">{lbl(tx('Fecha de emisión', 'Issue date'), true, null, 'issue_date', <input aria-label={tx('Fecha de emisión', 'Issue date')} type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className={ctl('issue_date')} />)}</div>
        <div className="md:col-span-3">{lbl(tx('Fecha límite de respuesta', 'Response deadline'), true, null, 'deadline', <input aria-label={tx('Fecha límite de respuesta', 'Response deadline')} type="date" value={form.deadline} min={form.issue_date} onChange={e => set('deadline', e.target.value)} className={ctl('deadline')} />)}</div>
        <div className="md:col-span-6">{lbl(tx('Moneda solicitada', 'Requested currency'), true, tx('Se toma automáticamente de la moneda habitual del proveedor y puede modificarse para esta RFQ.', "Taken from the supplier's usual currency; it can be changed for this RFQ."), 'currency',
          <select aria-label={tx('Moneda solicitada', 'Requested currency')} value={form.currency} onChange={e => set('currency', e.target.value)} className={ctl('currency')}>{(S.currencies || ['MXN', 'USD', 'EUR']).map(c => <option key={c} value={c}>{c} - {CURRENCY_NAMES[c]?.[en ? 1 : 0] || c}</option>)}</select>)}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6">{lbl(tx('Lugar de entrega', 'Delivery place'), false, null, null, <input aria-label={tx('Lugar de entrega', 'Delivery place')} type="text" maxLength={500} value={form.delivery_place} onChange={e => set('delivery_place', e.target.value)} className={ctl('')} />)}</div>
        <div className="md:col-span-3">{lbl(tx('Fecha requerida', 'Required date'), false, null, null, <input aria-label={tx('Fecha requerida', 'Required date')} type="date" value={form.required_date} onChange={e => set('required_date', e.target.value)} className={ctl('')} />)}</div>
        <div className="md:col-span-3">{lbl(tx('Contacto de compras', 'Purchasing contact'), true, null, 'contact',
          <select aria-label={tx('Contacto de compras', 'Purchasing contact')} value={form.contact} onChange={e => set('contact', e.target.value)} className={ctl('contact')}><option value="">{tx('Seleccionar contacto...', 'Select contact...')}</option>{(S.contacts || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3">{lbl(tx('Estatus', 'Status'), false, null, null, <select aria-label={tx('Estatus', 'Status')} value={form.status} onChange={e => set('status', e.target.value)} className={ctl('')}>{RFQ_STATUSES.map(([v, es, e2]) => <option key={v} value={v}>{en ? e2 : es}</option>)}</select>)}</div>
        <div className="md:col-span-9">{lbl(tx('Documentación solicitada', 'Requested documentation'), false, null, null, <textarea aria-label={tx('Documentación solicitada', 'Requested documentation')} rows={2} maxLength={4000} value={form.docs} onChange={e => set('docs', e.target.value)} placeholder={tx('Ficha técnica, certificados, permisos, garantía, tiempos de entrega...', 'Datasheet, certificates, permits, warranty, lead times...')} className={ctl('', 'resize-y')} />)}</div>
      </div>
      {lbl(tx('Condiciones e instrucciones', 'Conditions and instructions'), false, null, 'conditions', <textarea aria-label={tx('Condiciones e instrucciones', 'Conditions and instructions')} rows={3} maxLength={4000} value={form.conditions} onChange={e => set('conditions', e.target.value)} placeholder={tx('Indicar vigencia, impuestos, condiciones de pago, plazo, alcance y exclusiones.', 'Indicate validity, taxes, payment terms, lead time, scope and exclusions.')} className={ctl('conditions', 'resize-y')} />)}
      <div className="flex justify-end pt-3 border-t border-slate-200/60 text-xs font-bold"><button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"><Zap className="w-4 h-4 text-amber-300" />{tx('Generar Solicitud y Partidas', 'Generate Request and Items')}</button></div>
    </form>

    {!generated && <div data-testid="rfq-hidden" className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
      <div className="text-2xl">📋</div><h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">{tx('Partidas y vista previa del formato ocultas', 'Items and format preview hidden')}</h4>
      <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">{tx('Rellena los campos superiores de la solicitud (Comprador, Requisición, Proveedor) y presiona el botón', 'Fill in the top fields (Buyer, Requisition, Supplier) and press')} <strong className="text-blue-600">"{tx('Generar Solicitud y Partidas', 'Generate Request and Items')}"</strong> {tx('para desplegar la asignación de partidas y la vista previa del documento final.', 'to show the item assignment and the final document preview.')}</p>
    </div>}

    {generated && <div className="space-y-6">
      <div data-testid="rfq-items" className="p-4 border border-slate-200/80 rounded-2xl bg-slate-50/40 space-y-3">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div><h4 className="text-xs font-black text-slate-900">{tx('Partidas que se enviarán a este proveedor', 'Items that will be sent to this supplier')}</h4><p className="text-[10.5px] text-slate-500">{tx('La requisición conserva todas sus partidas; aquí seleccionas únicamente las que cotizará el proveedor invitado.', 'The requisition keeps all its items; here you select only those the invited supplier will quote.')}</p></div>
          <span className="px-2.5 py-1 bg-blue-100/70 text-blue-800 text-[10px] font-bold rounded-full">{tx(`${selected.length} seleccionada(s) de ${items.length}`, `${selected.length} selected of ${items.length}`)}</span>
        </div>
        <div className="p-3 bg-emerald-50/60 border-l-4 border-l-emerald-500 border border-emerald-100 rounded-xl text-xs text-slate-700"><span className="font-bold text-slate-800">{tx('Flujo recomendado:', 'Recommended flow:')}</span> {tx('usa una sola requisición y genera varias RFQ independientes —una por proveedor— con las partidas que correspondan.', 'use a single requisition and generate several independent RFQs —one per supplier— with the corresponding items.')}{R ? ` ${tx('Validación', 'Validation')} ${R.review_folio}: ${R.strategy} · ${tx('mínimo', 'minimum')} ${R.min_quotes} ${tx('cotización(es)', 'quote(s)')}.` : ''}</div>
        {req.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando partidas…', 'Loading items…')}</p>}{loadErr(req)}
        {R?.has_po && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{tx('Esta requisición ya tiene orden de compra registrada.', 'This requisition already has a purchase order.')}</p>}
        {sentSame.length > 0 && <p role="alert" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{tx(`${sentSame.length} partida(s) seleccionada(s) ya se enviaron a este proveedor (${[...new Set(sentSame.flatMap(i => sentToSupplier(i, supplierOpt?.name).map(x => x.rfq)))].join(', ')}).`, `${sentSame.length} selected item(s) were already sent to this supplier (${[...new Set(sentSame.flatMap(i => sentToSupplier(i, supplierOpt?.name).map(x => x.rfq)))].join(', ')}).`)}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold"><button type="button" onClick={() => setSelected(items.map(i => i.id))} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs">{tx('Seleccionar todas', 'Select all')}</button><span className="text-[10.5px] font-normal text-slate-400">{tx('Modo manual: una misma partida puede enviarse a varios proveedores para comparar ofertas.', 'Manual mode: the same item can be sent to several suppliers to compare offers.')}</span></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200">{[tx('Incluir', 'Include'), '#', tx('Descripción / especificación', 'Description / specification'), tx('Categoría', 'Category'), tx('Cantidad', 'Quantity'), tx('Unidad', 'Unit'), tx('Ya enviada a', 'Already sent to')].map(h => <th key={h} className="py-2.5 px-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {!items.length && <tr><td colSpan={7} className="py-10 text-center text-slate-400">{req.status === 'loading' ? '…' : tx('La requisición no tiene partidas vigentes.', 'The requisition has no active items.')}</td></tr>}
              {items.map(i => { const on = selected.includes(i.id); return <tr key={i.id} data-testid="rfq-line" className="hover:bg-slate-50/70">
                <td className="py-2.5 px-3"><label className="inline-flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-600"><input type="checkbox" checked={on} onChange={() => toggle(i.id)} aria-label={tx(`Incluir partida ${i.line_number}`, `Include item ${i.line_number}`)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />{on ? tx('Disponible', 'Included') : tx('Excluido', 'Excluded')}</label></td>
                <td className="py-2.5 px-3 font-bold text-slate-500">{i.line_number}</td><td className="py-2.5 px-3 font-bold text-slate-900">{i.description}</td><td className="py-2.5 px-3 text-slate-600">{i.category || '—'}</td>
                <td className="py-2.5 px-3 font-bold text-slate-800">{qty(i.quantity)}</td><td className="py-2.5 px-3 text-slate-600">{i.unit}</td>
                <td className="py-2.5 px-3 text-[10.5px]">{i.sent_to?.length ? i.sent_to.map(x => <div key={x.rfq + x.supplier_name}><span className="font-bold">{x.rfq}</span> · {x.supplier_name}</div>) : <span className="text-slate-400">{tx('Ninguna RFQ', 'No RFQ')}</span>}</td>
              </tr>; })}
            </tbody>
          </table>
        </div>
        {(req.data?.rfqs || []).length > 0 && <p className="text-[10.5px] text-slate-500">{tx('RFQ registradas de esta requisición:', 'RFQs recorded for this requisition:')} {req.data.rfqs.map(r => `${r.folio} · ${r.supplier_name}`).join(' | ')}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60 text-xs font-bold">
          <button type="button" disabled title={lockText} className="px-3.5 py-2 bg-slate-200 text-slate-500 rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{tx('Guardar y siguiente RFQ →', 'Save and next RFQ →')}</button>
          <button type="button" onClick={() => setSelected([])} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5"><Eraser className="w-3.5 h-3.5" />{tx('Limpiar selección', 'Clear selection')}</button>
          <button type="button" onClick={() => onOpenMatrix?.()} className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />{tx('Ver matriz', 'View matrix')}</button>
          <button type="button" onClick={print} disabled={!selected.length} className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-700 rounded-xl border border-blue-200 shadow-2xs flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-3.5 h-3.5" />{tx('Imprimir vista previa', 'Print preview')}</button>
        </div>
        <p className="text-[10.5px] text-amber-800 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />{tx('Guardar o enviar la RFQ registra una escritura comercial que sigue bloqueada hasta su validación integral: esta vista previa no se guarda en MariaDB ni se envía al proveedor.', 'Saving or sending the RFQ is a commercial write that stays blocked until its integral validation: this preview is not stored in MariaDB nor sent to the supplier.')}</p>
      </div>

      <div className="p-4 sm:p-6 bg-slate-100/70 border border-slate-200/80 rounded-2xl space-y-4 shadow-2xs">
        <div className="flex justify-between items-start border-b border-slate-200 pb-3 gap-3"><div><h4 className="text-sm font-black text-slate-900">{tx('Formato de Solicitud de Cotización', 'Request for Quotation Form')}</h4><p className="text-[11px] text-slate-500 mt-0.5">{tx('Vista previa del documento que se enviará al proveedor seleccionado.', 'Preview of the document to be sent to the selected supplier.')}</p></div><span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold text-[10px] rounded-full shrink-0">{tx('Sin precios', 'No prices')}</span></div>
        <iframe data-testid="rfq-preview" title={tx('Formato de Solicitud de Cotización', 'Request for Quotation Form')} srcDoc={html} sandbox="" className="w-full h-[760px] rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>}

    {modal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sf-rfq-reqs" data-testid="rfq-req-modal" className="bg-white w-full max-w-5xl max-h-[88vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs">
        <div className="bg-gradient-to-r from-[#2B4B9A] to-[#8C3AAA] px-5 py-3 flex justify-between items-start gap-3">
          <div><h2 id="sf-rfq-reqs" className="text-white font-black text-sm">🔍 {tx('Requisiciones validadas disponibles para RFQ', 'Validated requisitions available for RFQ')}</h2><p className="text-[11px] text-blue-100">{(S.buyers || []).find(b => b.key === form.buyer)?.name || tx('Sin comprador asignado', 'No buyer assigned')}</p></div>
          <span className="font-bold shrink-0"><button type="button" onClick={() => setModal(false)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded border border-white/30 flex items-center gap-1"><X className="w-3.5 h-3.5" />{tx('Cerrar', 'Close')}</button></span>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="relative font-medium"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar requisición', 'Search requisition')} value={mInput} onChange={e => setMInput(e.target.value)} maxLength={120} placeholder={tx('Buscar folio, cliente, referencia, descripción o validación...', 'Search folio, client, reference, description or validation...')} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
          {reqs.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}{loadErr(reqs)}
          {reqs.status === 'ready' && !(reqs.data?.items || []).length && <p className="text-center text-slate-400 py-8">{tx('No hay requisiciones validadas para este comprador.', 'There are no validated requisitions for this buyer.')}</p>}
          <div className="space-y-2">{(reqs.data?.items || []).map(r => <div key={r.id} data-testid="rfq-req-option" className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${form.requisition === r.id ? 'border-purple-400 bg-purple-50/40' : 'border-slate-200'}`}>
            <div className="min-w-0 flex-1"><div className="font-black text-slate-900">{r.folio} · <span className="text-slate-700">{r.client_name}</span></div>
              <div className="text-[10.5px] text-slate-500 truncate">{[r.internal_reference, r.project, r.description].filter(Boolean).join(' · ')}</div>
              <div className="flex flex-wrap gap-1 mt-1 text-[9.5px] font-bold"><span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{r.review_folio} · {r.strategy}</span><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{r.item_count} {tx('partida(s)', 'item(s)')}</span><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{r.rfq_count} RFQ · {r.quote_count} {tx('cotización(es)', 'quote(s)')} / {tx('mín.', 'min.')} {r.min_quotes}</span>{r.has_po && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{tx('Con OC', 'With PO')}</span>}</div></div>
            <span className="font-bold"><button type="button" onClick={() => pickRequisition(r.id)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">{tx('Seleccionar', 'Select')}</button></span>
          </div>)}</div>
          {(reqs.data?.total || 0) > (reqs.data?.items || []).length && <p className="text-[10.5px] text-slate-400">{tx(`Se muestran ${reqs.data.items.length} de ${reqs.data.total}; usa la búsqueda para acotar.`, `Showing ${reqs.data.items.length} of ${reqs.data.total}; use search to narrow down.`)}</p>}
        </div>
      </div>
    </div>}
  </div>;
}

export default RfqRequestCard;
