import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Search, Loader2, AlertCircle, RotateCw, Plus, Eraser, BarChart3, ClipboardList, Eye, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { getRfqSetup, listRfqRequisitions, getRfqRequisition, getRfq } from './api';
import { money, label } from './model.mjs';
import { internalReference } from './rfq.mjs';
import { RequisitionPickerModal } from './RequisitionPickerModal';
import { PAYMENT_METHODS, PDF_MAX_BYTES, emptyQuote, clearCapture, linesFromRfq, lineAmounts, quoteTotals, qtyNote, validateQuote, isPdfHeader } from './supplierQuote.mjs';

// Tarjeta 4 · Registro de cotización (oferta recibida del proveedor) con el diseño Grupo Gerez. Comprador, requisición
// con RFQ, RFQ emitida, proveedor y partidas salen de MariaDB; importes, IVA y totales se calculan aquí. GUARDAR la
// cotización es una escritura comercial bloqueada: nada se registra y el PDF solo se ve en este navegador.
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

export function SupplierQuoteCard({ en = false, notify, onCompare, onMatrix, lockText, refresh = 0 }) {
  const tx = (es, e) => (en ? e : es);
  const [form, setForm] = useState(emptyQuote);
  const [lines, setLines] = useState([]);
  const [touched, setTouched] = useState({});
  const [modal, setModal] = useState(false);
  const [mInput, setMInput] = useState(''); const [mq, setMq] = useState('');
  const [reload, setReload] = useState(0);
  const [pdf, setPdf] = useState(null); const [pdfError, setPdfError] = useState(''); const [showPdf, setShowPdf] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => setMq(mInput.trim()), 300); return () => clearTimeout(t); }, [mInput]);
  useEffect(() => () => { if (pdf?.url) URL.revokeObjectURL(pdf.url); }, [pdf]);

  const setup = useLoad(s => getRfqSetup(s), [refresh, reload]);
  const reqs = useLoad(s => listRfqRequisitions({ buyer: form.buyer, q: mq, rfq: 'with' }, s), [form.buyer, mq, refresh, reload], !!form.buyer);
  const req = useLoad(s => getRfqRequisition(form.requisition, s), [form.requisition, refresh, reload], !!form.requisition);
  const rfq = useLoad(s => getRfq(form.rfq, s), [form.rfq, refresh], !!form.rfq);
  const S = setup.data || {};
  const R = req.data?.item || null;
  const rfqOpt = (req.data?.rfqs || []).find(x => x.id === form.rfq) || null;
  const F = rfq.data?.item || null;

  // A newly loaded RFQ brings its items (all offered, quoted qty = requested) and its requested currency.
  useEffect(() => { if (!F || !rfq.data) return; setLines(linesFromRfq(rfq.data.items)); setForm(f => ({ ...f, currency: ['MXN', 'USD', 'EUR'].includes(F.currency) ? F.currency : f.currency })); }, [F?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = useMemo(() => validateQuote(form, lines, en), [form, lines, en]);
  const totals = useMemo(() => quoteTotals(lines, form.vat), [lines, form.vat]);
  const set = (k, val) => { setForm(f => ({ ...f, [k]: val })); setTouched(t => ({ ...t, [k]: true })); };
  const pickBuyer = val => { setForm(f => ({ ...emptyQuote(), buyer: val, currency: f.currency })); setLines([]); setTouched({}); setMInput(''); setMq(''); if (val) setModal(true); };
  const pickRequisition = id => { setForm(f => ({ ...f, requisition: id, rfq: '' })); setLines([]); setModal(false); };
  const pickRfq = id => { setForm(f => ({ ...f, rfq: id })); setLines([]); setTouched(t => ({ ...t, rfq: true })); };
  const setLine = (key, patch) => { setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l))); setTouched(t => ({ ...t, [`line:${key}`]: true })); };
  const removePdf = () => { setPdf(null); setShowPdf(false); setPdfError(''); if (fileRef.current) fileRef.current.value = ''; };
  const newQuote = () => { setForm(emptyQuote()); setLines([]); setTouched({}); removePdf(); };
  const clear = () => { setForm(f => clearCapture(f)); setLines(linesFromRfq(rfq.data?.items || [])); setTouched({}); removePdf(); };
  const choosePdf = async e => {
    const file = e.target.files?.[0]; setPdfError('');
    if (!file) return;
    if (file.size > PDF_MAX_BYTES) { setPdfError(tx('El PDF supera 10 MB.', 'The PDF exceeds 10 MB.')); e.target.value = ''; return; }
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (!isPdfHeader(head)) { setPdfError(tx('Solo se permiten archivos PDF válidos.', 'Only valid PDF files are allowed.')); e.target.value = ''; return; }
    if (pdf?.url) URL.revokeObjectURL(pdf.url);
    setPdf({ name: file.name, size: file.size, url: URL.createObjectURL(new Blob([file], { type: 'application/pdf' })) }); setShowPdf(false);
  };

  const err = k => Boolean(touched[k] && v.errors[k]);
  const lbl = (text, req2, k, control, hint) => <label className="block text-xs font-medium text-slate-700">
    <span className="block text-[11px] font-bold text-slate-700 mb-1">{text}{req2 && <span className="text-red-500"> *</span>}</span>{control}
    {k && err(k) ? <span role="alert" className="block text-[10px] text-rose-600 mt-1">{v.errors[k]}</span> : hint ? <span className="block text-[9.5px] text-slate-400 mt-1">{hint}</span> : null}
  </label>;
  const ctl = (k, extra = '') => `w-full px-3.5 py-2.5 bg-slate-100/70 border ${k && err(k) ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} rounded-xl outline-none focus:bg-white focus:border-purple-500 disabled:text-slate-500 read-only:text-slate-500 ${extra}`;
  const loadErr = s => (s.error ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{s.error.message}</p> : null);
  const cur = form.currency;

  return <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="quote-card">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Registro de cotización', 'Quote record')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Captura las ofertas recibidas para generar el comparativo.', 'Capture the offers received to build the comparison.')}</p></div>
      <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-[10px] rounded-full border border-blue-100 shrink-0">{tx('Paso 3 · Cotización', 'Step 3 · Quote')}</span>
    </div>
    {loadErr(setup)}

    <form onSubmit={e => e.preventDefault()} noValidate className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5">{lbl(tx('Comprador responsable', 'Responsible buyer'), true, 'buyer',
          <div className="flex gap-2"><select aria-label={tx('Comprador responsable', 'Responsible buyer')} value={form.buyer} onChange={e => pickBuyer(e.target.value)} className={ctl('buyer', 'bg-white')}><option value="">{tx('Seleccionar comprador...', 'Select buyer...')}</option>{(S.buyers || []).map(b => <option key={b.key} value={b.key}>{b.key === 'unassigned' ? tx('Sin comprador asignado', 'No buyer assigned') : b.name}</option>)}</select>
            <button type="button" title={tx('Recargar', 'Reload')} aria-label={tx('Recargar compradores y requisiciones', 'Reload buyers and requisitions')} onClick={() => setReload(n => n + 1)} className="px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 shrink-0">{setup.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}</button></div>,
          tx('Al escoger un comprador se abrirá una ventana con sus requisiciones validadas que ya tienen RFQ.', 'Choosing a buyer opens a window with their validated requisitions that already have an RFQ.'))}</div>
        <div className="md:col-span-4">{lbl(tx('Requisición validada', 'Validated requisition'), true, 'requisition',
          <input aria-label={tx('Requisición validada', 'Validated requisition')} type="text" readOnly value={R ? `${R.folio} · ${R.client_name}` : ''} placeholder={tx('Selecciona primero un comprador...', 'Select a buyer first...')} className={ctl('requisition', 'cursor-default')} />,
          form.buyer ? tx(`${reqs.data?.total ?? '…'} requisición(es) con RFQ de este comprador.`, `${reqs.data?.total ?? '…'} requisition(s) with RFQ for this buyer.`) : tx('Selecciona un comprador para consultar sus requisiciones.', 'Select a buyer to see their requisitions.'))}</div>
        <div className="md:col-span-3 flex items-start pt-5 text-sm font-bold"><button type="button" onClick={() => setModal(true)} disabled={!form.buyer} className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Search className="w-4 h-4" />{tx('Ver requisiciones', 'View requisitions')}</button></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6">{lbl(tx('RFQ emitida', 'Issued RFQ'), true, 'rfq',
          <select aria-label={tx('RFQ emitida', 'Issued RFQ')} value={form.rfq} disabled={!form.requisition} onChange={e => pickRfq(e.target.value)} className={ctl('rfq', form.requisition ? 'bg-white' : 'cursor-not-allowed')}><option value="">{form.requisition ? tx('Seleccionar RFQ...', 'Select RFQ...') : tx('Selecciona primero una requisición...', 'Select a requisition first...')}</option>{(req.data?.rfqs || []).map(x => <option key={x.id} value={x.id}>{x.folio} · {x.supplier_name} · {label(x.status, en)}{x.quote_folios ? ` · ${tx('respondida', 'answered')}: ${x.quote_folios}` : ''}</option>)}</select>)}</div>
        <div className="md:col-span-6">{lbl(tx('Proveedor de la RFQ', 'RFQ supplier'), false, null, <input aria-label={tx('Proveedor de la RFQ', 'RFQ supplier')} type="text" readOnly value={rfqOpt ? `${rfqOpt.supplier_code} - ${rfqOpt.supplier_name}` : ''} placeholder={tx('Automático desde la RFQ', 'Automatic from the RFQ')} className={ctl(null, 'font-bold cursor-default')} />)}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {lbl(tx('Folio de cotización', 'Quote folio'), false, null, <input aria-label={tx('Folio de cotización', 'Quote folio')} type="text" readOnly placeholder={tx('Automático', 'Automatic')} value="" className={ctl(null, 'cursor-default')} />, tx('Se asigna al guardar.', 'Assigned on save.'))}
        {lbl(tx('Referencia interna', 'Internal reference'), false, null, <input aria-label={tx('Referencia interna', 'Internal reference')} type="text" readOnly value={internalReference(R)} placeholder={tx('Automática desde la requisición', 'Automatic from the requisition')} className={ctl(null, 'font-semibold cursor-default')} />)}
        {lbl(tx('Referencia del proveedor', 'Supplier reference'), false, 'supplier_reference', <input aria-label={tx('Referencia del proveedor', 'Supplier reference')} type="text" maxLength={128} value={form.supplier_reference} onChange={e => set('supplier_reference', e.target.value)} className={ctl('supplier_reference')} />)}
        {lbl(tx('Fecha de cotización', 'Quote date'), true, 'quote_date', <input aria-label={tx('Fecha de cotización', 'Quote date')} type="date" value={form.quote_date} onChange={e => set('quote_date', e.target.value)} className={ctl('quote_date')} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {lbl(tx('Vigencia hasta', 'Valid until'), false, 'valid_until', <input aria-label={tx('Vigencia hasta', 'Valid until')} type="date" value={form.valid_until} min={form.quote_date || undefined} onChange={e => set('valid_until', e.target.value)} className={ctl('valid_until')} />)}
        {lbl(tx('Subtotal calculado', 'Calculated subtotal'), true, null, <input aria-label={tx('Subtotal calculado', 'Calculated subtotal')} type="text" readOnly value={totals.subtotal.toLocaleString(en ? 'en-US' : 'es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className={ctl(null, 'cursor-default font-bold')} />)}
        {lbl(tx('IVA %', 'VAT %'), false, 'vat', <input aria-label={tx('IVA %', 'VAT %')} type="text" inputMode="decimal" value={form.vat} onChange={e => set('vat', e.target.value)} className={ctl('vat')} />)}
        {lbl(tx('Moneda', 'Currency'), false, 'currency', <select aria-label={tx('Moneda', 'Currency')} value={form.currency} onChange={e => set('currency', e.target.value)} className={ctl('currency', 'bg-white')}>{['MXN', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}</select>, F ? tx(`Moneda solicitada en la RFQ: ${F.currency}`, `Currency requested in the RFQ: ${F.currency}`) : null)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {lbl(tx('Total de la cotización recibida', 'Total of the quote received'), false, null, <input aria-label={tx('Total de la cotización recibida', 'Total of the quote received')} type="text" readOnly value={totals.total.toLocaleString(en ? 'en-US' : 'es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className={ctl(null, 'cursor-default font-bold')} />, tx('Subtotal + IVA de las partidas ofertadas.', 'Subtotal + VAT of the offered items.'))}
        {lbl(tx('Días de entrega', 'Delivery days'), true, 'lead_days', <input aria-label={tx('Días de entrega', 'Delivery days')} type="text" inputMode="numeric" value={form.lead_days} onChange={e => set('lead_days', e.target.value)} placeholder="0" className={ctl('lead_days')} />)}
        {lbl(tx('Condiciones de pago (SAT / SHCP)', 'Payment terms (SAT / SHCP)'), false, null, <select aria-label={tx('Condiciones de pago (SAT / SHCP)', 'Payment terms (SAT / SHCP)')} value={form.payment} onChange={e => set('payment', e.target.value)} className={ctl(null, 'bg-white')}><option value="">{tx('Seleccionar método...', 'Select method...')}</option>{PAYMENT_METHODS.map(([c, es, e2]) => <option key={c} value={c}>{en ? e2 : es}</option>)}</select>)}
        {lbl(tx('Cumplimiento técnico %', 'Technical compliance %'), false, 'technical', <input aria-label={tx('Cumplimiento técnico %', 'Technical compliance %')} type="text" inputMode="decimal" value={form.technical} onChange={e => set('technical', e.target.value)} className={ctl('technical')} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3">{lbl(tx('Documentación %', 'Documentation %'), false, 'documentation', <input aria-label={tx('Documentación %', 'Documentation %')} type="text" inputMode="decimal" value={form.documentation} onChange={e => set('documentation', e.target.value)} className={ctl('documentation')} />)}</div>
        <div className="md:col-span-9">{lbl(tx('Comentarios', 'Comments'), false, 'notes', <textarea aria-label={tx('Comentarios', 'Comments')} rows={2} maxLength={4000} value={form.notes} onChange={e => set('notes', e.target.value)} className={ctl('notes', 'resize-y')} />)}</div>
      </div>
    </form>

    <div data-testid="quote-items" className="p-4 border border-dashed border-slate-300 rounded-2xl bg-slate-50/50 space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 pb-2 border-b border-slate-200">
        <div><h4 className="text-sm font-black text-slate-900">{tx('Partidas cotizadas por esta empresa', 'Items quoted by this company')}</h4><p className="text-[10.5px] text-slate-500">{tx('Marca únicamente los artículos incluidos en la oferta y captura el precio unitario recibido. El sistema muestra importe sin IVA, IVA e importe total por artículo.', 'Mark only the items included in the offer and enter the unit price received. The system shows amount before VAT, VAT and total per item.')}</p></div>
        <span data-testid="quote-offered" className="px-2.5 py-1 bg-blue-100/70 text-blue-800 text-[10px] font-black rounded-full shrink-0">{tx(`${totals.offered} partidas cotizadas`, `${totals.offered} items quoted`)}</span>
      </div>
      {rfq.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando partidas de la RFQ…', 'Loading RFQ items…')}</p>}{loadErr(rfq)}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
        <table className="w-full text-left border-collapse min-w-[1100px] text-[11px]">
          <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200">{[tx('Ofrece', 'Offers'), tx('Partida', 'Item'), tx('Descripción', 'Description'), tx('Cantidad solicitada', 'Requested qty'), tx('Cantidad cotizada', 'Quoted qty'), tx('Unidad', 'Unit'), tx('Precio unitario recibido', 'Unit price received'), tx('Importe sin IVA', 'Amount before VAT'), tx('IVA', 'VAT'), tx('Total con IVA', 'Total incl. VAT')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {!lines.length && <tr><td colSpan={10} className="p-3"><div className="py-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">{form.rfq ? tx('La RFQ no tiene partidas registradas.', 'The RFQ has no items.') : tx('Selecciona una requisición y un proveedor para cargar los artículos de su RFQ.', 'Select a requisition and a supplier to load the items of its RFQ.')}</div></td></tr>}
            {lines.map(l => { const a = lineAmounts(l, form.vat); const note = qtyNote(l); const e = err(`line:${l.key}`); return <tr key={l.key} data-testid="quote-line" className={`align-top ${l.offered ? '' : 'opacity-60'}`}>
              <td className="py-2.5 px-3 text-center"><input type="checkbox" checked={l.offered} onChange={ev => setLine(l.key, { offered: ev.target.checked })} aria-label={tx(`Ofrece partida ${l.line_number}`, `Offers item ${l.line_number}`)} className="w-4 h-4 text-blue-600 rounded border-slate-300" /></td>
              <td className="py-2.5 px-3 font-bold text-slate-800">{l.line_number}</td>
              <td className="py-2.5 px-3"><p className="font-bold text-slate-800 leading-tight">{l.description}</p>{l.category && <p className="text-[10px] text-slate-500 mt-0.5">{l.category}</p>}{e && <p role="alert" className="text-[10px] text-rose-600 mt-1">{v.errors[`line:${l.key}`]}</p>}</td>
              <td className="py-2.5 px-3 text-center">{l.requested}</td>
              <td className="py-2.5 px-3 text-xs"><input aria-label={tx(`Cantidad cotizada partida ${l.line_number}`, `Quoted qty item ${l.line_number}`)} type="text" inputMode="decimal" value={l.qty} disabled={!l.offered} onChange={ev => setLine(l.key, { qty: ev.target.value })} className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-purple-500 disabled:bg-slate-100" />{note && <div className={`text-[9.5px] font-bold mt-0.5 ${note === 'partial' ? 'text-amber-700' : 'text-rose-600'}`}>{note === 'partial' ? tx('Parcial', 'Partial') : tx('Excede lo solicitado', 'Exceeds request')}</div>}</td>
              <td className="py-2.5 px-3">{l.unit}</td>
              <td className="py-2.5 px-3 text-xs"><input aria-label={tx(`Precio unitario partida ${l.line_number}`, `Unit price item ${l.line_number}`)} type="text" inputMode="decimal" value={l.price} disabled={!l.offered} onChange={ev => setLine(l.key, { price: ev.target.value })} placeholder="0.00" className="w-28 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-purple-500 disabled:bg-slate-100" /></td>
              <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{money(a.subtotal, cur, en)}</td>
              <td className="py-2.5 px-3 whitespace-nowrap">{money(a.tax, cur, en)}<p className="text-[10px] text-slate-400">{Number(form.vat || 0).toFixed(2)}%</p></td>
              <td className="py-2.5 px-3 font-bold text-emerald-600 whitespace-nowrap">{money(a.total, cur, en)}</td>
            </tr>; })}
          </tbody>
          {lines.length > 0 && <tfoot><tr className="bg-slate-50 font-black text-slate-900 border-t border-slate-200"><td colSpan={7} className="py-2.5 px-3 text-right uppercase text-[10px]">{tx('Totales', 'Totals')}</td><td className="py-2.5 px-3 whitespace-nowrap">{money(totals.subtotal, cur, en)}</td><td className="py-2.5 px-3 whitespace-nowrap">{money(totals.tax, cur, en)}</td><td className="py-2.5 px-3 whitespace-nowrap text-emerald-700">{money(totals.total, cur, en)}</td></tr></tfoot>}
        </table>
      </div>
      {lines.length > 0 && err('lines') && <p role="alert" className="text-[11px] text-rose-700">{v.errors.lines}</p>}
    </div>

    <div data-testid="quote-rfq-banner" className="p-3.5 bg-emerald-50/70 border-l-4 border-l-emerald-500 border border-emerald-100 rounded-xl text-xs text-slate-700">
      {!rfqOpt ? <><strong className="text-slate-900">{tx('Sin RFQ seleccionada.', 'No RFQ selected.')}</strong> {tx('Selecciona primero comprador, requisición y una RFQ emitida.', 'First select buyer, requisition and an issued RFQ.')}</>
        : <><strong className="text-slate-900">{rfqOpt.folio}</strong> · {rfqOpt.supplier_name} · {tx('emitida', 'issued')} {rfqOpt.request_date || '—'} · {tx('límite', 'deadline')} {rfqOpt.deadline || '—'} · {rfqOpt.item_count} {tx('partida(s)', 'item(s)')} · {tx('moneda', 'currency')} {rfqOpt.currency}
          {rfqOpt.quote_folios && <span className="block mt-1 text-amber-800 font-semibold">{tx(`Esta RFQ ya tiene cotización registrada (${rfqOpt.quote_folios}); una nueva captura sería otra oferta del mismo proveedor.`, `This RFQ already has a recorded quote (${rfqOpt.quote_folios}); a new capture would be another offer from the same supplier.`)}</span>}</>}
    </div>

    <div className="p-4 border border-slate-200/80 rounded-2xl bg-slate-50/40 space-y-3">
      <div><h4 className="text-xs font-black text-slate-900">{tx('PDF de la cotización', 'Quote PDF')}</h4><p className="text-[10.5px] text-slate-500">{tx('Adjunta el PDF de la oferta del proveedor para consulta directa desde la matriz.', "Attach the supplier's offer PDF for direct consultation from the matrix.")}</p></div>
      <label className="p-2 bg-white border border-slate-200 rounded-xl flex items-center gap-3 text-xs cursor-pointer">
        <span className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg font-semibold text-slate-700 shrink-0">{tx('Elegir archivo', 'Choose file')}</span>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={choosePdf} aria-label={tx('PDF de la cotización', 'Quote PDF')} className="sr-only" />
        <span className={pdf ? 'text-emerald-700 font-bold truncate' : 'text-slate-500'}>{pdf ? `${pdf.name} · ${(pdf.size / 1024).toLocaleString('es-MX', { maximumFractionDigits: 1 })} KB` : tx('No se ha seleccionado ningún archivo', 'No file selected')}</span>
      </label>
      {pdfError && <p role="alert" className="text-[11px] text-rose-700">{pdfError}</p>}
      {showPdf && pdf ? <iframe data-testid="quote-pdf" title={tx('Vista previa del PDF', 'PDF preview')} src={pdf.url} className="w-full h-96 border border-slate-200 rounded-xl bg-white" />
        : <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-500">{pdf ? tx('PDF cargado en este navegador. Haz clic en "Ver PDF" para previsualizarlo.', 'PDF loaded in this browser. Click "View PDF" to preview it.') : tx('No se ha cargado el PDF de la cotización.', 'The quote PDF has not been loaded.')}</div>}
      <div className="flex gap-2 text-xs font-bold">
        <button type="button" onClick={() => setShowPdf(s => !s)} disabled={!pdf} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-1.5 disabled:opacity-50"><Eye className="w-3.5 h-3.5" />{showPdf ? tx('Ocultar PDF', 'Hide PDF') : tx('Ver PDF', 'View PDF')}</button>
        <button type="button" onClick={removePdf} disabled={!pdf} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1.5 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" />{tx('Quitar PDF', 'Remove PDF')}</button>
      </div>
      <p className="text-[10px] text-slate-400">{tx('El PDF solo se muestra en este navegador; se guardará junto con la cotización cuando se habilite su registro.', 'The PDF is only shown in this browser; it will be stored with the quote once recording is enabled.')}</p>
    </div>

    <div data-testid="quote-check" className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 ${v.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
      {v.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span>{v.ok ? tx(`Captura completa: ${totals.offered} partida(s), total ${money(totals.total, cur, en)}. Lista para guardarse cuando se habilite el registro.`, `Capture complete: ${totals.offered} item(s), total ${money(totals.total, cur, en)}. Ready to be saved once recording is enabled.`) : `${tx('Pendiente:', 'Pending:')} ${v.first}`}</span>
    </div>

    <div className="flex flex-wrap items-center gap-2 text-sm font-black">
      <button type="button" onClick={newQuote} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-1.5"><Plus className="w-4 h-4" />{tx('Nueva cotización', 'New quote')}</button>
      <button type="button" disabled title={lockText} className="px-4 py-2.5 bg-slate-200 text-slate-500 rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Lock className="w-4 h-4" /><Save className="w-4 h-4" />{tx('Guardar cotización', 'Save quote')}</button>
      <button type="button" onClick={clear} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5"><Eraser className="w-4 h-4" />{tx('Limpiar', 'Clear')}</button>
      <button type="button" onClick={() => onCompare?.(form.requisition)} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5"><BarChart3 className="w-4 h-4" />{tx('Ver comparativo', 'View comparison')}</button>
      <button type="button" onClick={() => onMatrix?.()} className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5"><ClipboardList className="w-4 h-4" />{tx('Ver matriz', 'View matrix')}</button>
    </div>
    <p className="text-[10.5px] text-amber-800 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />{tx('Guardar la cotización registra una escritura comercial que sigue bloqueada hasta su validación integral: esta captura no se guarda en MariaDB.', 'Saving the quote is a commercial write that stays blocked until its integral validation: this capture is not stored in MariaDB.')}</p>

    {modal && <RequisitionPickerModal en={en} title={tx('Requisiciones validadas con RFQ emitida', 'Validated requisitions with issued RFQ')} buyerName={(S.buyers || []).find(b => b.key === form.buyer)?.name}
      search={mInput} onSearch={setMInput} state={reqs} selectedId={form.requisition} onPick={pickRequisition} onClose={() => setModal(false)}
      emptyText={tx('Este comprador no tiene requisiciones validadas con RFQ emitida.', 'This buyer has no validated requisitions with an issued RFQ.')} />}
  </div>;
}

export default SupplierQuoteCard;
