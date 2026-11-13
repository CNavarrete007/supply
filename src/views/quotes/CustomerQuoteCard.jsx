import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, Lock, CheckCircle2, RotateCw, Printer, X } from 'lucide-react';
import { getRfqSetup, listRfqRequisitions, getComparison, getCustomerQuoteSetup } from './api';
import { money, customerQuoteHtml } from './model.mjs';
import { internalReference } from './rfq.mjs';
import { CQ_STATUSES, CURRENCIES, emptyCq, linesFromComparison, priceLine, cqTotals, approvalLevel, validateCq, previewData } from './customerQuoteBuilder.mjs';

// Tarjeta 6 · Cotización formal al cliente (diseño Grupo Gerez). Partidas y costos salen de la adjudicación vigente o
// de la mejor oferta registrada en MariaDB; precio de venta, descuento, IVA, Service Fee y nivel de aprobación se
// calculan aquí. Los costos internos no salen en la vista previa. GUARDAR/EMITIR es una escritura comercial bloqueada.
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
const fmt = (v, en) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '0.00' : Number(v).toLocaleString(en ? 'en-US' : 'es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function CustomerQuoteCard({ en = false, notify, onMatrix, lockText, refresh = 0 }) {
  const tx = (es, e) => (en ? e : es);
  const [form, setForm] = useState(() => emptyCq(localToday()));
  const [lines, setLines] = useState([]);
  const [touched, setTouched] = useState({});
  const [saveTry, setSaveTry] = useState(false);
  const [preview, setPreview] = useState(false);
  const cardRef = useRef(null);
  const setup = useLoad(s => getRfqSetup(s), [refresh]);
  const cqSetup = useLoad(s => getCustomerQuoteSetup(s), [refresh]);
  const reqs = useLoad(s => listRfqRequisitions({ buyer: form.buyer, rfq: 'quoted' }, s), [form.buyer, refresh], !!form.buyer);
  const comp = useLoad(s => getComparison(form.requisition, s), [form.requisition, refresh], !!form.requisition);
  const S = setup.data || {};
  const R = comp.data?.requisition || null;
  const prior = comp.data?.customer_quote || null;
  const policy = (cqSetup.data?.policies || []).find(p => /customer|client|cotiz/i.test(p.applies_to)) || null;

  // A newly loaded requisition brings its items/costs, currency, delivery place and the next revision number.
  useEffect(() => {
    if (!R) return;
    setLines(linesFromComparison(comp.data.lines));
    setForm(f => ({ ...f, currency: CURRENCIES.some(c => c[0] === R.currency) ? R.currency : f.currency, delivery_place: f.delivery_place || R.delivery_place || '', revision: String(prior ? prior.revision + 1 : 0) }));
  }, [R?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = useMemo(() => validateCq(form, lines, en), [form, lines, en]);
  const totals = useMemo(() => cqTotals(lines, form), [lines, form]);
  const level = useMemo(() => approvalLevel(policy, lines, form, totals), [policy, lines, form, totals]);
  useEffect(() => { setSaveTry(false); }, [form, lines]);
  const set = (k, val) => { setForm(f => ({ ...f, [k]: val })); setTouched(x => ({ ...x, [k]: true })); };
  const setLine = (key, patch) => { setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l))); setTouched(x => ({ ...x, [`line:${key}`]: true })); };
  const pickBuyer = val => { const isContact = (S.contacts || []).some(c => c.id === val); setForm(f => ({ ...f, buyer: val, requisition: '', preparer: isContact ? val : f.preparer })); setLines([]); };
  const pickRequisition = id => { setForm(f => ({ ...f, requisition: id, delivery_place: '' })); setLines([]); setTouched(x => ({ ...x, requisition: true })); };
  const clear = () => { setForm(emptyCq(localToday())); setLines([]); setTouched({}); setSaveTry(false); setPreview(false); };
  const refreshFx = () => {
    const fx = cqSetup.data?.fx;
    if (!fx) { notify?.(tx('Tipo de cambio', 'Exchange rate'), tx('No hay un tipo de cambio registrado en MariaDB; captúralo manualmente con su fuente.', 'There is no exchange rate recorded in MariaDB; enter it manually with its source.'), 'warning'); return; }
    setForm(f => ({ ...f, usd_mxn: fx.usd_mxn ? String(Number(fx.usd_mxn)) : f.usd_mxn, eur_mxn: fx.eur_mxn ? String(Number(fx.eur_mxn)) : f.eur_mxn, fx_date: fx.date ? String(fx.date).slice(0, 10) : f.fx_date, fx_source: `${fx.source || tx('Registrado', 'Recorded')} (${fx.folio})` }));
    notify?.(tx('Tipo de cambio actualizado', 'Exchange rate updated'), tx(`Último tipo de cambio registrado en MariaDB (${fx.folio}).`, `Latest exchange rate recorded in MariaDB (${fx.folio}).`), 'success');
  };
  const save = () => {
    setTouched(x => ({ ...x, ...Object.fromEntries(Object.keys(v.errors).map(k => [k, true])) }));
    setSaveTry(true);
    if (!v.ok) { notify?.(tx('Cotización incompleta', 'Incomplete quote'), v.first, 'warning'); setTimeout(() => cardRef.current?.querySelector('[role=alert]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0); return; }
    notify?.(tx('Registro no habilitado', 'Recording not enabled'), tx('La cotización al cliente está validada, pero no se guardó: registrarla y emitirla es una escritura comercial pendiente de autorización.', 'The client quote is validated but was not saved: recording and issuing it is a commercial write pending authorization.'), 'warning');
  };
  const preparerName = (S.contacts || []).find(c => c.id === form.preparer)?.name || '';
  const docHtml = useMemo(() => (preview ? customerQuoteHtml(previewData({ form, lines, totals, req: R, preparerName, en }), en, { preview: true }) : ''), [preview, form, lines, totals, R, preparerName, en]);
  const print = () => {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { notify?.(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; }
    w.document.write(docHtml); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250);
  };

  const err = k => Boolean(touched[k] && v.errors[k]);
  const lbl = (text, req2, k, control, hint, span = '') => <label className={`block text-xs font-medium text-slate-700 ${span}`}>
    <span className="block text-[11px] font-bold text-slate-700 mb-1">{text}{req2 ? ' *' : ''}</span>{control}
    {k && err(k) ? <span role="alert" className="block text-[10px] text-rose-600 mt-1">{v.errors[k]}</span> : hint ? <span className="block text-[9.5px] text-slate-400 mt-1">{hint}</span> : null}
  </label>;
  const ctl = (k, extra = '') => `w-full px-3.5 py-2.5 bg-white border ${k && err(k) ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'} rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400 read-only:bg-slate-100/70 read-only:text-slate-500 ${extra}`;
  const cur = form.currency;
  const origins = [...new Set(lines.map(l => l.cost_currency).filter(Boolean))];
  const srcCount = k => lines.filter(l => l.source === k).length;

  return <div ref={cardRef} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="cq-card">
    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Cotización formal al cliente', 'Formal client quote')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Consolida las partidas adjudicadas, costos internos, gastos y margen para producir el precio de venta que verá el cliente.', 'Consolidates awarded items, internal costs, expenses and margin to produce the selling price the client will see.')}</p></div>
      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200 shrink-0">{tx('Documento comercial externo', 'External commercial document')}</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 border-l-4 border-l-amber-500 text-slate-700"><strong className="text-slate-900">{tx('Información interna:', 'Internal information:')}</strong> {tx('costo del proveedor, gastos y margen solo se muestran durante la elaboración y nunca aparecen en el PDF del cliente.', 'supplier cost, expenses and margin are only shown while preparing and never appear in the client PDF.')}</div>
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 border-l-4 border-l-emerald-500 text-slate-700"><strong className="text-slate-900">{tx('Información visible:', 'Visible information:')}</strong> {tx('el cliente recibe descripción, cantidad, precio unitario de venta, impuestos, total, vigencia y condiciones comerciales.', 'the client receives description, quantity, unit selling price, taxes, total, validity and commercial terms.')}</div>
    </div>
    {(setup.error || cqSetup.error || reqs.error || comp.error) && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{(setup.error || cqSetup.error || reqs.error || comp.error).message}</p>}

    <div className="p-5 border border-slate-200 rounded-2xl space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {lbl(tx('Comprador responsable', 'Responsible buyer'), true, 'buyer', <select aria-label={tx('Comprador responsable', 'Responsible buyer')} value={form.buyer} onChange={e => pickBuyer(e.target.value)} className={ctl('buyer', 'border-blue-500 ring-1 ring-blue-200')}><option value="">{tx('Seleccionar comprador...', 'Select buyer...')}</option>{(S.buyers || []).map(b => <option key={b.key} value={b.key}>{b.key === 'unassigned' ? tx('Sin comprador asignado', 'No buyer assigned') : b.name}</option>)}</select>, tx('Selecciona al comprador responsable de la requisición.', 'Select the buyer responsible for the requisition.'))}
        {lbl(tx('Requisición del cliente', 'Client requisition'), true, 'requisition', <select aria-label={tx('Requisición del cliente', 'Client requisition')} value={form.requisition} disabled={!form.buyer} onChange={e => pickRequisition(e.target.value)} className={ctl('requisition')}><option value="">{form.buyer ? tx('Seleccionar requisición...', 'Select requisition...') : tx('Seleccionar primero un comprador...', 'Select a buyer first...')}</option>{(reqs.data?.items || []).map(r => <option key={r.id} value={r.id}>{r.folio} - {r.client_name}</option>)}</select>, form.buyer ? tx(`${reqs.data?.total ?? '…'} requisición(es) con cotizaciones de proveedor.`, `${reqs.data?.total ?? '…'} requisition(s) with supplier quotes.`) : tx('Solo se muestran requisiciones del comprador seleccionado.', "Only the selected buyer's requisitions are shown."))}
        {lbl(tx('Folio de cotización', 'Quote folio'), false, null, <input aria-label={tx('Folio de cotización', 'Quote folio')} type="text" readOnly value="" placeholder={tx('Automático', 'Automatic')} className={ctl(null)} />)}
        {lbl(tx('Referencia interna', 'Internal reference'), false, null, <input aria-label={tx('Referencia interna', 'Internal reference')} type="text" readOnly value={R ? internalReference(R) : ''} placeholder={tx('Automática desde la requisición', 'Automatic from the requisition')} className={ctl(null)} />)}
        {lbl(tx('Revisión', 'Revision'), true, 'revision', <input aria-label={tx('Revisión', 'Revision')} type="text" inputMode="numeric" value={form.revision} onChange={e => set('revision', e.target.value)} className={ctl('revision')} />, prior ? tx(`Vigente: ${prior.folio} (Rev. ${prior.revision}).`, `Current: ${prior.folio} (Rev. ${prior.revision}).`) : null)}
        {lbl(tx('Fecha de emisión', 'Issue date'), true, 'issue_date', <input aria-label={tx('Fecha de emisión', 'Issue date')} type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)} className={ctl('issue_date')} />)}
        {lbl(tx('Vigencia hasta', 'Valid until'), true, 'valid_until', <input aria-label={tx('Vigencia hasta', 'Valid until')} type="date" value={form.valid_until} min={form.issue_date} onChange={e => set('valid_until', e.target.value)} className={ctl('valid_until')} />)}
        {lbl(tx('Moneda de cotización / cliente', 'Quote / client currency'), true, 'currency', <select aria-label={tx('Moneda de cotización / cliente', 'Quote / client currency')} value={form.currency} onChange={e => set('currency', e.target.value)} className={ctl('currency')}>{CURRENCIES.map(([c, es, e2]) => <option key={c} value={c}>{c} - {en ? e2 : es}</option>)}</select>, tx('Todos los precios visibles al cliente y el PDF se expresarán en esta moneda.', 'All prices visible to the client and the PDF will be in this currency.'))}
        {lbl(tx('Estatus', 'Status'), false, null, <select aria-label={tx('Estatus', 'Status')} value={form.status} onChange={e => set('status', e.target.value)} className={ctl(null)}>{CQ_STATUSES.map(([es, e2]) => <option key={es} value={es}>{en ? e2 : es}</option>)}</select>)}
        {lbl(tx('Comprador', 'Buyer'), true, 'preparer', <select aria-label={tx('Comprador', 'Buyer')} value={form.preparer} onChange={e => set('preparer', e.target.value)} className={ctl('preparer')}><option value="">{tx('Seleccionar comprador...', 'Select buyer...')}</option>{(S.contacts || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
        {lbl(tx('Tiempo de entrega ofrecido', 'Offered delivery time'), false, null, <input aria-label={tx('Tiempo de entrega ofrecido', 'Offered delivery time')} type="text" maxLength={500} value={form.lead_time} onChange={e => set('lead_time', e.target.value)} placeholder={tx('Ej. 10 días hábiles después de la OC', 'E.g. 10 business days after the PO')} className={ctl(null)} />, null, 'sm:col-span-2')}
        {lbl(tx('Lugar de entrega', 'Delivery place'), false, null, <input aria-label={tx('Lugar de entrega', 'Delivery place')} type="text" maxLength={500} value={form.delivery_place} onChange={e => set('delivery_place', e.target.value)} className={ctl(null)} />, null, 'sm:col-span-2')}
        {lbl(tx('Condiciones de pago', 'Payment terms'), false, null, <input aria-label={tx('Condiciones de pago', 'Payment terms')} type="text" maxLength={500} value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder={tx('Ej. Crédito 30 días / anticipo / contra entrega', 'E.g. 30-day credit / advance / on delivery')} className={ctl(null)} />, null, 'sm:col-span-2')}
        {lbl(tx('Garantía', 'Warranty'), false, null, <input aria-label={tx('Garantía', 'Warranty')} type="text" maxLength={500} value={form.warranty} onChange={e => set('warranty', e.target.value)} placeholder={tx('Ej. 12 meses contra defectos de fabricación', 'E.g. 12 months against manufacturing defects')} className={ctl(null)} />, null, 'sm:col-span-2')}
        {lbl(tx('Alcance incluido', 'Included scope'), false, null, <textarea aria-label={tx('Alcance incluido', 'Included scope')} rows={2} maxLength={4000} value={form.inclusions} onChange={e => set('inclusions', e.target.value)} className={ctl(null, 'resize-y')} />, null, 'sm:col-span-2')}
        {lbl(tx('Exclusiones', 'Exclusions'), false, null, <textarea aria-label={tx('Exclusiones', 'Exclusions')} rows={2} maxLength={4000} value={form.exclusions} onChange={e => set('exclusions', e.target.value)} className={ctl(null, 'resize-y')} />, null, 'sm:col-span-2')}
        {lbl(tx('Notas comerciales / Comentarios del PDF', 'Commercial notes / PDF comments'), false, null, <textarea aria-label={tx('Notas comerciales / Comentarios del PDF', 'Commercial notes / PDF comments')} rows={2} maxLength={4000} value={form.notes} onChange={e => set('notes', e.target.value)} className={ctl(null, 'resize-y')} />, tx('Este campo alimenta directamente COMENTARIOS / COMMENTS del PDF. Si se deja vacío, el formato utiliza los textos comerciales predeterminados.', 'This field feeds COMMENTS in the PDF. If empty, the format uses the default commercial texts.'), 'sm:col-span-2 lg:col-span-4')}
      </div>
    </div>

    <div className="p-5 border border-slate-200 rounded-2xl space-y-4" data-testid="cq-fx">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-black text-slate-900"><span aria-hidden="true">💱</span> {tx('Conversión de moneda de costos internos', 'Internal cost currency conversion')}</h4><p className="text-[10.5px] text-slate-500">{tx('Los costos conservan su moneda de origen. El sistema los convierte a la moneda de la cotización antes de aplicar gasto y margen.', 'Costs keep their original currency. The system converts them to the quote currency before applying expenses and margin.')}</p></div>
        <span className="text-sm font-medium"><button type="button" onClick={refreshFx} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><RotateCw className="w-4 h-4" />{tx('Actualizar tipo de cambio', 'Update exchange rate')}</button></span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {lbl(tx('Fecha del tipo de cambio', 'Exchange rate date'), false, null, <input aria-label={tx('Fecha del tipo de cambio', 'Exchange rate date')} type="date" value={form.fx_date} onChange={e => set('fx_date', e.target.value)} className={ctl(null)} />)}
        {lbl('1 USD = MXN', false, 'usd_mxn', <input aria-label="1 USD = MXN" type="text" inputMode="decimal" value={form.usd_mxn} onChange={e => set('usd_mxn', e.target.value)} className={ctl('usd_mxn')} />)}
        {lbl('1 EUR = MXN', false, 'eur_mxn', <input aria-label="1 EUR = MXN" type="text" inputMode="decimal" value={form.eur_mxn} onChange={e => set('eur_mxn', e.target.value)} className={ctl('eur_mxn')} />)}
        {lbl(tx('Fuente / referencia', 'Source / reference'), false, null, <input aria-label={tx('Fuente / referencia', 'Source / reference')} type="text" maxLength={255} value={form.fx_source} onChange={e => set('fx_source', e.target.value)} className={ctl(null)} />)}
      </div>
      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 border-l-4 border-l-blue-600 text-xs text-slate-700"><strong className="text-slate-900">{tx('Moneda del cliente:', 'Client currency:')} {cur} · {tx('Costos de origen:', 'Original costs:')} {origins.join(', ') || cur}</strong><span className="block text-[10.5px] mt-0.5">1 USD = {Number(form.usd_mxn || 0).toFixed(6)} MXN · 1 EUR = {Number(form.eur_mxn || 0).toFixed(6)} MXN. {tx('La conversión se congela al guardar esta revisión.', 'The conversion is frozen when this revision is saved.')}</span></div>
    </div>

    <div className="p-5 border border-slate-200 rounded-2xl space-y-4" data-testid="cq-pricing">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-black text-slate-900">{tx('Construcción del precio de venta', 'Building the selling price')}</h4><p className="text-[10.5px] text-slate-500">{tx('El costo del producto se propone desde la adjudicación o la mejor oferta disponible. La entrega / manipulación se captura por partida. El % margen de ganancia se define individualmente por artículo y se aplica antes del IVA.', 'The product cost comes from the award or the best available offer. Delivery / handling is entered per item. The profit margin % is set per item and applied before VAT.')}</p></div>
        <span data-testid="cq-line-count" className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">{tx(`${lines.length} partida(s)`, `${lines.length} item(s)`)}</span></div>
      {comp.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1150px] text-left border-collapse text-[11px]">
        <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200">{['#', tx('Descripción', 'Description'), tx('Marca / modelo', 'Brand / model'), tx('Cantidad', 'Quantity'), tx('Unidad', 'Unit'), tx('Costo del producto', 'Product cost'), tx('Entrega / manipulación', 'Delivery / handling'), tx('% Margen de ganancia', 'Profit margin %'), tx('Precio venta unitario', 'Unit selling price'), tx('Subtotal cliente', 'Client subtotal')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {!lines.length && <tr><td colSpan={10} className="p-3"><div className="py-8 text-center text-slate-500 border border-slate-200 rounded-xl">{form.requisition ? tx('La requisición no tiene partidas vigentes.', 'The requisition has no active items.') : tx('Selecciona una requisición.', 'Select a requisition.')}</div></td></tr>}
          {lines.map(l => { const p = priceLine(l, form); const e = err(`line:${l.key}`); return <tr key={l.key} data-testid="cq-line" className="align-top">
            <td className="py-2.5 px-3 font-bold text-slate-500">{l.line_number}</td>
            <td className="py-2.5 px-3"><p className="font-bold text-slate-900 leading-tight">{l.description}</p><p className={`text-[10px] mt-0.5 ${l.source === 'award' ? 'text-emerald-700' : l.source === 'offer' ? 'text-amber-700' : 'text-rose-600'}`}>{l.source === 'award' ? tx(`Adjudicación vigente · ${l.supplier}`, `Current award · ${l.supplier}`) : l.source === 'offer' ? tx(`Mejor oferta (sin adjudicar) · ${l.supplier}`, `Best offer (not awarded) · ${l.supplier}`) : tx('Sin costo: falta cotización del proveedor', 'No cost: supplier quote missing')}</p>{e && <p role="alert" className="text-[10px] text-rose-600 mt-1">{v.errors[`line:${l.key}`]}</p>}</td>
            <td className="py-2.5 px-3"><input aria-label={tx(`Marca / modelo partida ${l.line_number}`, `Brand / model item ${l.line_number}`)} type="text" maxLength={255} value={l.brand_model} onChange={ev => setLine(l.key, { brand_model: ev.target.value })} className="w-32 px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500" /></td>
            <td className="py-2.5 px-3"><input aria-label={tx(`Cantidad partida ${l.line_number}`, `Quantity item ${l.line_number}`)} type="text" inputMode="decimal" value={l.qty} onChange={ev => setLine(l.key, { qty: ev.target.value })} className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-center" /></td>
            <td className="py-2.5 px-3">{l.unit}</td>
            <td className="py-2.5 px-3 whitespace-nowrap font-semibold">{p.cost === null ? '—' : money(p.cost, cur, en)}{l.cost_currency && l.cost_currency !== cur && l.cost_unit !== '' && <p className="text-[10px] text-slate-400 font-normal">{money(l.cost_unit, l.cost_currency, en)}</p>}</td>
            <td className="py-2.5 px-3"><input aria-label={tx(`Entrega / manipulación partida ${l.line_number}`, `Delivery / handling item ${l.line_number}`)} type="text" inputMode="decimal" value={l.handling} onChange={ev => setLine(l.key, { handling: ev.target.value })} className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-right" /></td>
            <td className="py-2.5 px-3"><input aria-label={tx(`% margen partida ${l.line_number}`, `Margin % item ${l.line_number}`)} type="text" inputMode="decimal" value={l.margin} onChange={ev => setLine(l.key, { margin: ev.target.value })} placeholder="0" className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-right" /></td>
            <td className="py-2.5 px-3 whitespace-nowrap font-bold">{p.unit === null ? '—' : money(p.unit, cur, en)}</td>
            <td className="py-2.5 px-3 whitespace-nowrap font-black text-emerald-700">{money(p.subtotal, cur, en)}</td>
          </tr>; })}
        </tbody></table></div>
      <div className="p-3 rounded-xl bg-slate-50 border-l-4 border-l-blue-600 text-[11px] text-slate-700"><strong className="text-slate-900">{tx('% margen de ganancia:', 'Profit margin %:')}</strong> {tx('porcentaje de ganancia aplicado a cada partida sobre el costo del producto más la entrega / manipulación. Es independiente del IVA; el IVA se calcula después sobre el subtotal de venta.', 'profit applied to each item over product cost plus delivery / handling. Independent of VAT; VAT is calculated afterwards on the sales subtotal.')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {lbl(tx('Subtotal de pago de terceros', 'Third party payment subtotal'), false, null, <input aria-label={tx('Subtotal de pago de terceros', 'Third party payment subtotal')} type="text" readOnly value={fmt(totals.third, en)} className={ctl(null)} />)}
        {lbl(tx('Descuento %', 'Discount %'), false, 'discount', <input aria-label={tx('Descuento %', 'Discount %')} type="text" inputMode="decimal" value={form.discount} onChange={e => set('discount', e.target.value)} className={ctl('discount')} />, totals.discount ? `-${money(totals.discount, cur, en)}` : null)}
        {lbl(tx('IVA %', 'VAT %'), false, 'vat', <input aria-label={tx('IVA %', 'VAT %')} type="text" inputMode="decimal" value={form.vat} onChange={e => set('vat', e.target.value)} className={ctl('vat')} />, `${tx('IVA', 'VAT')}: ${money(totals.tax + totals.sfTax, cur, en)}`)}
        {lbl(tx('Total general', 'Grand total'), false, null, <input aria-label={tx('Total general', 'Grand total')} type="text" readOnly value={fmt(totals.total, en)} className={ctl(null, 'font-black')} />, cur)}
      </div>
    </div>

    <div className="p-5 border-2 border-purple-300 rounded-2xl space-y-4" data-testid="cq-sf">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-black text-slate-900"><span aria-hidden="true">💼</span> Service Fee</h4><p className="text-[10.5px] text-slate-500">{tx('Opcional. Se calcula como un porcentaje del subtotal de Third Party Payment antes de IVA.', 'Optional. Calculated as a percentage of the Third Party Payment subtotal before VAT.')}</p></div>
        <label className="px-4 py-2 rounded-xl border border-purple-200 bg-purple-50/50 text-xs font-bold text-purple-700 flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.sf_enabled} onChange={e => set('sf_enabled', e.target.checked)} className="w-4 h-4" />{tx('Aplicar Service Fee', 'Apply Service Fee')}</label></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {lbl('Service Fee %', false, 'sf_pct', <input aria-label="Service Fee %" type="text" inputMode="decimal" value={form.sf_pct} disabled={!form.sf_enabled} onChange={e => set('sf_pct', e.target.value)} className={ctl('sf_pct')} />)}
        {lbl(tx('Base para Service Fee', 'Service Fee base'), false, null, <input aria-label={tx('Base para Service Fee', 'Service Fee base')} type="text" readOnly value={fmt(totals.sfBase, en)} className={ctl(null)} />)}
        {lbl(tx('Precio unitario Service Fee', 'Service Fee unit price'), false, null, <input aria-label={tx('Precio unitario Service Fee', 'Service Fee unit price')} type="text" readOnly value={fmt(totals.sfUnit, en)} className={ctl(null)} />)}
        {lbl(tx('Subtotal Service Fee', 'Service Fee subtotal'), false, null, <input aria-label={tx('Subtotal Service Fee', 'Service Fee subtotal')} type="text" readOnly value={fmt(totals.sfSubtotal, en)} className={ctl(null)} />)}
        {lbl(tx('IVA Service Fee', 'Service Fee VAT'), false, null, <input aria-label={tx('IVA Service Fee', 'Service Fee VAT')} type="text" readOnly value={fmt(totals.sfTax, en)} className={ctl(null)} />)}
        {lbl(tx('Total Service Fee', 'Service Fee total'), false, null, <input aria-label={tx('Total Service Fee', 'Service Fee total')} type="text" readOnly value={fmt(totals.sfTotal, en)} className={ctl(null)} />)}
        {lbl(tx('Comentarios del Service Fee', 'Service Fee comments'), false, null, <textarea aria-label={tx('Comentarios del Service Fee', 'Service Fee comments')} rows={2} maxLength={2000} value={form.sf_comments} disabled={!form.sf_enabled} onChange={e => set('sf_comments', e.target.value)} placeholder={tx('Ej. Service fee por coordinación, administración, gestión documental, logística y seguimiento de terceros.', 'E.g. Service fee for coordination, administration, documentation, logistics and third-party follow-up.')} className={ctl(null, 'resize-y')} />, null, 'sm:col-span-2 lg:col-span-4')}
      </div>
    </div>

    <div data-testid="cq-level" className={`p-4 rounded-2xl border border-l-4 flex items-start gap-3 text-xs ${level.status === 'within' ? 'bg-emerald-50/60 border-emerald-200 border-l-emerald-500' : level.status === 'exceeds' ? 'bg-amber-50/70 border-amber-200 border-l-amber-500' : 'bg-slate-50 border-slate-200 border-l-slate-400'}`}>
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white ${level.status === 'within' ? 'bg-emerald-500' : level.status === 'exceeds' ? 'bg-amber-500' : 'bg-slate-400'}`}>{level.status === 'within' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}</span>
      <div>{level.status === 'within' && <><p className="font-black text-slate-900">{tx('Nivel 1 · Solo Comprador', 'Level 1 · Buyer only')}</p><p className="text-slate-700">{tx('Dentro de los límites: solo se requiere la validación electrónica del Comprador.', 'Within limits: only the electronic validation of the Buyer is required.')}</p></>}
        {level.status === 'exceeds' && <><p className="font-black text-slate-900">{tx('Requiere autorización interna adicional', 'Requires additional internal authorization')}</p><p className="text-slate-700">{tx('Motivo:', 'Reason:')} {[level.unitOver && tx('el precio unitario máximo supera el límite por artículo', 'the highest unit price exceeds the per-item limit'), level.docOver && tx('el subtotal supera el límite del documento', 'the subtotal exceeds the document limit')].filter(Boolean).join(tx(' y ', ' and '))}. {tx('Además del Comprador, se requiere revisión y autorización interna antes de enviarla al cliente.', 'Besides the Buyer, internal review and authorization are required before sending it to the client.')}</p></>}
        {level.status === 'no_policy' && <p className="text-slate-700"><strong>{tx('Sin política de aprobación vigente en MariaDB.', 'No current approval policy in MariaDB.')}</strong> {tx('No se puede determinar el nivel de autorización; configúrala en Configuración.', 'The authorization level cannot be determined; set it up in Settings.')}</p>}
        {level.status === 'no_rate' && <p className="text-slate-700">{tx(`Captura el tipo de cambio para evaluar contra la política en ${level.currency}.`, `Enter the exchange rate to evaluate against the policy in ${level.currency}.`)}</p>}
        {(level.status === 'within' || level.status === 'exceeds') && <p className="text-[10.5px] text-slate-500 mt-0.5">{tx('Máx. artículo', 'Max. item')}: {money(level.maxUnit, level.currency, en).replace(` ${level.currency}`, '')} · {tx('Subtotal evaluado', 'Evaluated subtotal')}: {money(level.evaluated, level.currency, en).replace(` ${level.currency}`, '')} · {tx('Límites', 'Limits')}: {money(level.unitLimit, level.currency, en).replace(` ${level.currency}`, '')} / {money(level.docLimit, level.currency, en)}</p>}</div>
    </div>

    <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-black text-slate-900"><span aria-hidden="true">🔒</span> {tx('Aprobación electrónica y control documental', 'Electronic approval and document control')}</h4><span className="px-3 py-1 rounded-full bg-white border border-emerald-200 text-emerald-700 text-[10px] font-bold">{tx('Sin firma gráfica', 'No graphic signature')}</span></div>
      <p className="text-xs text-slate-600">{tx('La cotización al cliente no utiliza firmas gráficas. Comprador, revisión y autorización se controlan mediante usuario autenticado, estado, fecha/hora, revisión y bitácora de Grupo Gerez.', 'The client quote uses no graphic signatures. Buyer, review and authorization are controlled through the authenticated user, status, date/time, revision and the Grupo Gerez log.')}</p>
      <div className="p-3 rounded-xl bg-white border border-emerald-200 border-l-4 border-l-emerald-500 text-xs text-slate-700"><strong className="text-slate-900">{tx('Control del documento:', 'Document control:')}</strong> {tx('el PDF externo se emite sin imágenes de firmas. Las aprobaciones internas permanecen registradas electrónicamente y la cotización solo puede enviarse al cliente mediante el botón ✉️ ENVIAR AL CLIENTE después de quedar autorizada internamente.', 'the external PDF is issued without signature images. Internal approvals stay recorded electronically and the quote can only be sent to the client with the ✉️ SEND TO CLIENT button after internal authorization.')}</div>
    </div>

    <div data-testid="cq-status" className={`p-3.5 rounded-xl border-l-4 text-xs flex items-start gap-2 ${saveTry ? (v.ok ? 'bg-amber-50 border-l-amber-500 text-amber-900' : 'bg-rose-50 border-l-rose-500 text-rose-800') : 'bg-blue-50/60 border-l-blue-600 text-slate-800'}`}>
      {saveTry && (v.ok ? <Lock className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />)}
      <span>{!R ? <strong>{tx('Selecciona una requisición para cargar cliente, partidas, costos adjudicados y moneda.', 'Select a requisition to load client, items, awarded costs and currency.')}</strong>
        : saveTry ? (v.ok ? tx(`Cotización validada: ${lines.length} partida(s), total ${money(totals.total, cur, en)}. No se guardó: registrar y emitir la cotización al cliente es una escritura comercial que sigue bloqueada hasta su autorización.`, `Quote validated: ${lines.length} item(s), total ${money(totals.total, cur, en)}. Not saved: recording and issuing the client quote is a commercial write that stays blocked until authorized.`) : `${tx('No se puede guardar. Pendiente:', 'Cannot save. Pending:')} ${v.first}`)
          : <>{R.folio} · {R.client_name} · {tx(`${lines.length} partida(s): ${srcCount('award')} con adjudicación, ${srcCount('offer')} con mejor oferta, ${srcCount('none')} sin costo.`, `${lines.length} item(s): ${srcCount('award')} awarded, ${srcCount('offer')} best offer, ${srcCount('none')} without cost.`)}{prior && ` ${tx(`Ya existe ${prior.folio} (Rev. ${prior.revision}); esta captura sería la Rev. ${form.revision}.`, `${prior.folio} (Rev. ${prior.revision}) already exists; this capture would be Rev. ${form.revision}.`)}`}</>}</span>
    </div>

    <div className="flex flex-wrap items-center gap-3 text-sm font-medium" data-testid="cq-actions">
      <button type="button" onClick={save} title={lockText} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">💾</span>{tx('Guardar cotización al cliente', 'Save client quote')}</button>
      <button type="button" onClick={clear} className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs text-slate-800 flex items-center gap-2"><span aria-hidden="true">🧹</span>{tx('Limpiar', 'Clear')}</button>
      <button type="button" onClick={() => setPreview(true)} disabled={!R} className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs text-slate-800 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><span aria-hidden="true">👁️</span>{tx('Vista previa', 'Preview')}</button>
      <button type="button" onClick={() => onMatrix?.()} className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs text-slate-800 flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver matriz', 'View matrix')}</button>
    </div>

    {preview && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setPreview(false); }}>
      <div role="dialog" aria-modal="true" aria-label={tx('Vista previa de la cotización al cliente', 'Client quote preview')} data-testid="cq-preview" className="bg-white w-full max-w-5xl h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#1e4a7a] px-5 py-3 flex justify-between items-center gap-3"><h2 className="text-white font-bold text-sm truncate">{tx('Vista previa', 'Preview')} · {R?.folio} · Rev. {form.revision}</h2>
          <div className="flex gap-2 text-xs font-bold"><button type="button" onClick={print} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />{tx('Imprimir PDF', 'Print PDF')}</button><button type="button" onClick={() => setPreview(false)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded flex items-center gap-1.5"><X className="w-3.5 h-3.5" />{tx('Cerrar', 'Close')}</button></div></div>
        <div className="flex-1 overflow-hidden bg-slate-200/50 p-3 sm:p-6"><iframe title={tx('Cotización al cliente', 'Client quote')} srcDoc={docHtml} sandbox="" className="w-full h-full rounded-lg border border-slate-200 bg-white" /></div>
      </div>
    </div>}
  </div>;
}

export default CustomerQuoteCard;
