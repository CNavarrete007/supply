import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertCircle, Lock, CheckCircle2 } from 'lucide-react';
import { getComparison } from './api';
import { money, label } from './model.mjs';
import { WEIGHTS, scoreQuotes, awardState, initialSelection, awardPreview, awardChanges } from './comparison.mjs';

// Tarjeta 5 · Comparativo y selección preliminar de proveedores (diseño Grupo Gerez) con datos de MariaDB:
// resumen de la requisición, productos, comparativo con puntaje y recomendación, adjudicación por partida e
// interpretación. Guardar la adjudicación (y generar OC) es una escritura comercial bloqueada: aquí solo se prepara.
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
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const qty = v => (num(v) === null ? '—' : num(v).toLocaleString('es-MX', { maximumFractionDigits: 6 }));

export function ComparisonCard({ en = false, notify, requisition = '', onRequisition, onAddCompany, onRegisterSupplier, onOpenOrders, refresh = 0 }) {
  const tx = (es, e) => (en ? e : es);
  const [sub, setSub] = useState('summary');
  const [sel, setSel] = useState({});
  const [saveTry, setSaveTry] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const ordersRef = useRef(null);
  const list = useLoad(s => getComparison('all', s), [refresh]);
  const comp = useLoad(s => getComparison(requisition, s), [requisition, refresh], !!requisition);
  const d = comp.data && comp.data.requisition ? comp.data : null;
  const lines = useMemo(() => (d?.lines || []).filter(l => !l.line_status || l.line_status === 'active'), [d]);
  const ranked = useMemo(() => scoreQuotes(d?.quotes || [], lines), [d, lines]);
  const rec = ranked.find(q => q.recommended) || null;
  useEffect(() => { setSel(initialSelection(d?.lines || [])); setSaveTry(false); setShowOrders(false); }, [d]);
  useEffect(() => { setSaveTry(false); }, [sel]);
  const preview = useMemo(() => awardPreview(lines, sel), [lines, sel]);
  const changes = useMemo(() => awardChanges(lines, sel), [lines, sel]);
  const changePreview = useMemo(() => awardPreview(changes, sel), [changes, sel]);
  const R = d?.requisition;
  const companies = new Set((d?.quotes || []).map(q => q.supplier_id)).size;
  const needed = Math.max(2, R?.min_quotes || 0);

  const SUBS = [['summary', '📌', tx('Resumen de la requisición', 'Requisition summary'), tx('Cliente, proyecto, contrato, partidas y presupuesto estimado.', 'Client, project, contract, items and estimated budget.')],
    ['products', '📦', tx('Productos solicitados', 'Requested products'), tx('Lista de partidas, cantidades, categorías y mejor precio ofertado.', 'Items, quantities, categories and best offered price.')],
    ['compare', '📊', tx('Comparativo de proveedores', 'Supplier comparison'), tx('Resumen de cotizaciones, puntajes y recomendación.', 'Quote summary, scores and recommendation.')],
    ['award', '🧩', tx('Adjudicación por partida', 'Award per item'), tx('Define el proveedor recomendado por partida sin generar todavía un compromiso de compra.', 'Define the recommended supplier per item without creating a purchase commitment yet.')],
    ['interpret', '💡', tx('Interpretación', 'Interpretation'), tx('Cómo leer el comparativo y usar la recomendación.', 'How to read the comparison and use the recommendation.')]];

  const saveAward = () => {
    setSaveTry(true);
    if (preview.errors.some(e => e.code === 'qty')) { notify?.(tx('Adjudicación incompleta', 'Incomplete award'), tx('Revisa la cantidad a comprar de las partidas marcadas.', 'Check the quantity to buy of the highlighted items.'), 'warning'); return; }
    if (!changes.length) { notify?.(tx('Sin cambios', 'No changes'), tx('La selección coincide con la adjudicación vigente.', 'The selection matches the current award.'), 'info'); return; }
    notify?.(tx('Registro no habilitado', 'Recording not enabled'), tx('La adjudicación está preparada, pero no se guardó: adjudicar y generar OC son escrituras comerciales pendientes de autorización.', 'The award is prepared but was not saved: awarding and creating POs are commercial writes pending authorization.'), 'warning');
  };
  const viewOrders = () => { setShowOrders(true); setTimeout(() => ordersRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0); };
  const scoreTone = s => (s >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : s >= 60 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-rose-600 bg-rose-50 border-rose-100');
  const quoteBy = id => (d?.quotes || []).find(q => q.id === id);
  const lineErr = l => saveTry && preview.errors.find(e => e.line === l.line_number);

  return <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="comparison-card">
    <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Comparativo y selección preliminar de proveedores', 'Supplier comparison and preliminary selection')}</h3>
      <p className="text-[11px] text-slate-500 mt-0.5">{tx('Compara las ofertas recibidas y define el proveedor recomendado por partida. Esta etapa no genera todavía una adjudicación definitiva ni una Orden de Compra.', 'Compare the offers received and define the recommended supplier per item. This stage does not yet create a definitive award or a Purchase Order.')}</p></div>

    <div className="text-sm font-medium"><select aria-label={tx('Requisición', 'Requisition')} value={requisition} onChange={e => { onRequisition?.(e.target.value); setSub('summary'); }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs">
      <option value="">{tx('Seleccionar requisición con cotizaciones...', 'Select requisition with quotes...')}</option>
      {requisition && R && !(list.data?.requisitions || []).some(r => r.id === requisition) && <option value={requisition}>{R.folio} - {R.client_name}</option>}
      {(list.data?.requisitions || []).map(r => <option key={r.id} value={r.id}>{r.folio} - {r.client_name}</option>)}
    </select></div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[10.5px] text-slate-500">{tx('Selecciona una requisición para visualizar sus productos y las cotizaciones relacionadas.', 'Select a requisition to see its products and related quotes.')}{list.data ? ` ${tx(`${list.data.requisitions.length} requisición(es) con cotizaciones.`, `${list.data.requisitions.length} requisition(s) with quotes.`)}` : ''}</p>
      <span className="text-sm font-medium"><button type="button" onClick={() => onRegisterSupplier?.()} className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs text-slate-800 flex items-center gap-2"><span aria-hidden="true">🏢</span>{tx('Registrar empresa / proveedor', 'Register company / supplier')}</button></span>
    </div>
    {(list.error || comp.error) && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{(list.error || comp.error).message}</p>}

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">{SUBS.map(([id, icon, title, desc]) => { const on = sub === id; return <button key={id} type="button" aria-pressed={on} data-testid={`cmp-sub-${id}`} onClick={() => setSub(id)}
      className={`text-left p-4 rounded-2xl border min-h-[96px] transition-all ${on ? 'bg-gradient-to-r from-blue-600 to-purple-600 border-transparent text-white shadow-md' : 'bg-white border-slate-200 hover:border-purple-300'}`}>
      <span className={`block text-xs font-black ${on ? 'text-white' : 'text-slate-900'}`}><span aria-hidden="true" className="mr-1.5">{icon}</span>{title}</span>
      <span className={`block text-[10px] leading-snug mt-1 ${on ? 'text-blue-100' : 'text-slate-400'}`}>{desc}</span>
    </button>; })}</div>

    {comp.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
    {!requisition && sub !== 'interpret' && <div data-testid="cmp-empty" className="p-8 border border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('Selecciona una requisición para visualizar sus productos y las cotizaciones relacionadas.', 'Select a requisition to see its products and related quotes.')}</div>}

    {d && sub === 'summary' && <div data-testid="cmp-summary" className="p-5 bg-blue-50/60 border border-blue-100 border-l-4 border-l-blue-600 rounded-2xl text-xs text-slate-800 space-y-2 leading-relaxed">
      <p><strong>{tx('Requisición:', 'Requisition:')}</strong> {R.folio} · {R.client_name}{R.internal_reference ? ` · ${R.internal_reference}` : ''}</p>
      <p><strong>{tx('Proyecto:', 'Project:')}</strong> {R.project || '—'} · <strong>{tx('Contrato:', 'Contract:')}</strong> {R.contract || '—'} · <strong>{tx('Partidas:', 'Items:')}</strong> {R.item_count} · <strong>{tx('Presupuesto estimado:', 'Estimated budget:')}</strong> {num(R.budget_amount) !== null ? money(R.budget_amount, R.currency, en) : '—'}</p>
      <p><strong>{tx('Empresas participantes:', 'Participating companies:')}</strong> {companies}.{companies < needed ? ` ${tx(`Agrega por lo menos ${needed - companies === 1 ? 'otra empresa' : `${needed - companies} empresas más`} para formar un comparativo${R.min_quotes ? ` (la validación ${R.review_folio || ''} pide mínimo ${R.min_quotes})` : ''}.`, `Add at least ${needed - companies} more compan${needed - companies === 1 ? 'y' : 'ies'} to build a comparison${R.min_quotes ? ` (validation ${R.review_folio || ''} requires at least ${R.min_quotes})` : ''}.`)}` : ` ${tx('Comparativo con suficientes ofertas.', 'Comparison with enough offers.')}`}</p>
      {rec && <p><strong>{tx('Recomendación actual:', 'Current recommendation:')}</strong> {rec.supplier_name} · {money(rec.total_amount, rec.currency, en)} · {tx('puntaje', 'score')} {rec.score.toFixed(1)}/100</p>}
      <span className="inline-block pt-1 text-sm font-medium"><button type="button" onClick={() => onAddCompany?.(requisition)} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-md">+ {tx('Agregar otra empresa', 'Add another company')}</button></span>
    </div>}

    {d && sub === 'products' && <div data-testid="cmp-products" className="p-5 border border-slate-200 rounded-2xl space-y-3">
      <div><h4 className="text-sm font-black text-slate-900">{tx('Productos solicitados', 'Requested products')}</h4><p className="text-[10.5px] text-slate-500">{tx(`Partidas vigentes de la requisición ${R.folio} y el mejor precio unitario ofertado (misma moneda).`, `Active items of requisition ${R.folio} and the best offered unit price (same currency).`)}</p></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[820px] text-left border-collapse text-xs">
        <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200">{['#', tx('Descripción', 'Description'), tx('Categoría', 'Category'), tx('Cantidad', 'Quantity'), tx('Unidad', 'Unit'), tx('Ofertas', 'Offers'), tx('Mejor precio ofertado', 'Best offered price')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{lines.map(l => { const offered = (l.offers || []).filter(o => o.offered && num(o.unit_price) !== null); const b = offered.filter(o => o.currency === rec?.currency || !rec).sort((a, c) => num(a.unit_price) - num(c.unit_price))[0]; return <tr key={l.id} data-testid="cmp-product">
          <td className="py-2.5 px-3 font-bold text-slate-500">{l.line_number}</td><td className="py-2.5 px-3 font-bold text-slate-900">{l.description}</td><td className="py-2.5 px-3">{l.category || '—'}</td><td className="py-2.5 px-3">{qty(l.quantity)}</td><td className="py-2.5 px-3">{l.unit_label}</td>
          <td className="py-2.5 px-3">{offered.length}</td><td className="py-2.5 px-3 font-bold">{b ? `${money(b.unit_price, b.currency, en)} · ${b.supplier_name}` : <span className="text-slate-400 font-normal">{tx('Sin ofertas', 'No offers')}</span>}</td></tr>; })}
          {!lines.length && <tr><td colSpan={7} className="py-8 text-center text-slate-400">{tx('La requisición no tiene partidas vigentes.', 'The requisition has no active items.')}</td></tr>}</tbody></table></div>
    </div>}

    {d && sub === 'compare' && <div data-testid="cmp-compare" className="p-5 border border-slate-200 rounded-2xl space-y-3">
      <div><h4 className="text-sm font-black text-slate-900">{tx('Comparativo de cotizaciones por requisición', 'Quote comparison per requisition')}</h4><p className="text-[10.5px] text-slate-500">{tx(`Resumen de las ofertas recibidas para los productos solicitados en la requisición ${R.folio}.`, `Summary of the offers received for the products requested in requisition ${R.folio}.`)}</p></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1050px] text-left border-collapse text-xs">
        <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200">{[tx('Posición', 'Position'), tx('Proveedor', 'Supplier'), tx('Referencia', 'Reference'), tx('Total cotizado', 'Quoted total'), tx('Días de entrega', 'Delivery days'), tx('Técnico', 'Technical'), tx('Documental', 'Documentation'), tx('Pago', 'Payment'), tx('Puntaje', 'Score'), tx('Estatus', 'Status')].map((h, i) => <th key={h} className={`py-3 px-3 ${i >= 8 ? 'text-center' : ''}`}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{ranked.map(q => { const st = awardState(q, lines.length); return <tr key={q.id} data-testid="cmp-quote" className="align-middle">
          <td className="py-3 px-3">{q.recommended ? <span className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">{tx('Recomendada', 'Recommended')}</span> : <span className="text-slate-500">{q.comparable ? `${q.position}.º` : tx('Otra moneda', 'Other currency')}</span>}</td>
          <td className="py-3 px-3 font-black text-slate-900">{q.supplier_name}<div className="text-[10px] font-normal text-slate-400">{q.folio}{q.offered_lines < lines.length ? ` · ${q.offered_lines}/${lines.length} ${tx('partidas', 'items')}` : ''}</div></td>
          <td className="py-3 px-3 text-slate-600">{q.supplier_reference || q.folio}</td>
          <td className="py-3 px-3 font-bold">{money(q.total_amount, q.currency, en)}</td>
          <td className="py-3 px-3">{num(q.lead_days) === null ? '—' : `${qty(q.lead_days)} ${tx('día(s)', 'day(s)')}`}</td>
          <td className="py-3 px-3">{num(q.technical_score) === null ? '—' : `${qty(q.technical_score)}%`}</td>
          <td className="py-3 px-3">{num(q.document_score) === null ? '—' : `${qty(q.document_score)}%`}</td>
          <td className="py-3 px-3 text-slate-600">{q.payment_terms || '—'}</td>
          <td className="py-3 px-3 text-center"><span title={`${tx('Precio', 'Price')} ${q.parts.price} × ${WEIGHTS.price}% · ${tx('Entrega', 'Delivery')} ${q.parts.delivery} × ${WEIGHTS.delivery}% · ${tx('Técnico', 'Technical')} ${q.parts.technical} × ${WEIGHTS.technical}% · ${tx('Documental', 'Documentation')} ${q.parts.documental} × ${WEIGHTS.documental}%`} className={`px-2.5 py-1 text-[11px] font-black rounded-full border ${scoreTone(q.score)}`}>{q.score.toFixed(1)}/100</span></td>
          <td className="py-3 px-3 text-center"><span className="px-3 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full border border-blue-200 whitespace-nowrap">{st === 'total' ? tx('Adjudicada total', 'Fully awarded') : st === 'partial' ? tx('Adjudicada parcial', 'Partially awarded') : (q.legacy_status || label(q.status, en))}</span></td>
        </tr>; })}
          {!ranked.length && <tr><td colSpan={10} className="py-8 text-center text-slate-400">{tx('La requisición no tiene cotizaciones de proveedor registradas.', 'The requisition has no supplier quotes recorded.')}</td></tr>}</tbody></table></div>
      {rec && <div data-testid="cmp-recommendation" className="p-3.5 bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 rounded-xl text-xs text-emerald-900"><strong>{tx('Recomendación actual:', 'Current recommendation:')}</strong> {rec.supplier_name} · {money(rec.total_amount, rec.currency, en)} · {num(rec.lead_days) === null ? '—' : `${qty(rec.lead_days)} ${tx('día(s)', 'day(s)')}`} · {tx('Puntaje', 'Score')} {rec.score.toFixed(1)}/100</div>}
      <p className="text-[10px] text-slate-400">{tx(`Puntaje (criterio provisional de SupplyFlow, por confirmar con el Apps Script): precio por partida ${WEIGHTS.price}% · entrega ${WEIGHTS.delivery}% · técnico ${WEIGHTS.technical}% · documental ${WEIGHTS.documental}%. Solo se comparan ofertas en la misma moneda.`, `Score (provisional SupplyFlow criterion, to be confirmed against the Apps Script): price per item ${WEIGHTS.price}% · delivery ${WEIGHTS.delivery}% · technical ${WEIGHTS.technical}% · documentation ${WEIGHTS.documental}%. Only offers in the same currency are compared.`)}</p>
    </div>}

    {d && sub === 'award' && <div data-testid="cmp-award" className="p-5 border border-slate-200 rounded-2xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-black text-slate-900">{tx('Adjudicación por partida', 'Award per item')}</h4><p className="text-[10.5px] text-slate-500">{tx('Selecciona el proveedor ganador para cada mercancía. El sistema agrupará las partidas y creará una OC independiente por proveedor.', 'Select the winning supplier for each item. The system will group the items and create a separate PO per supplier.')}</p></div>
        <span data-testid="cmp-po-count" className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">{tx(`${(d.orders || []).length} OC vigente(s)`, `${(d.orders || []).length} current PO(s)`)}</span></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1000px] text-left border-collapse text-xs">
        <thead><tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200">{['#', tx('Mercancía / servicio', 'Goods / service'), tx('Cantidad solicitada', 'Requested qty'), tx('Proveedor adjudicado', 'Awarded supplier'), tx('Cantidad a comprar', 'Qty to buy'), tx('Precio unitario adjudicado', 'Awarded unit price')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{lines.map(l => { const s = sel[l.id] || { quote: '', qty: '' }; const offers = (l.offers || []).filter(o => o.offered); const o = offers.find(x => x.quote_id === s.quote); const e = lineErr(l); return <tr key={l.id} data-testid="cmp-award-line" className="align-top">
          <td className="py-3 px-3 font-bold">{l.line_number}</td>
          <td className="py-3 px-3"><p className="font-black text-slate-900 uppercase leading-tight">{l.description}</p>{l.category && <p className="text-[10px] text-slate-400">{l.category}</p>}{l.award && <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">{tx('Adjudicación vigente:', 'Current award:')} {l.award.supplier_name} · {qty(l.award.quantity)} × {money(l.award.unit_price, l.award.currency, en)}</p>}</td>
          <td className="py-3 px-3 whitespace-nowrap">{qty(l.quantity)} {l.unit_label}</td>
          <td className="py-3 px-3 text-xs font-medium"><select aria-label={tx(`Proveedor adjudicado partida ${l.line_number}`, `Awarded supplier item ${l.line_number}`)} value={s.quote} onChange={ev => setSel(x => ({ ...x, [l.id]: { ...s, quote: ev.target.value } }))} className="w-full min-w-[220px] px-3 py-2 bg-white border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"><option value="">{tx('Sin adjudicar', 'Not awarded')}</option>{offers.map(x => <option key={x.quote_id} value={x.quote_id}>{x.supplier_name} · {money(x.unit_price, x.currency, en)}{quoteBy(x.quote_id)?.id === rec?.id ? ` · ${tx('recomendada', 'recommended')}` : ''}</option>)}</select>
            <p className="text-[10px] text-slate-400 mt-1">{tx(`${offers.length} empresa(s) ofrecen esta partida`, `${offers.length} compan${offers.length === 1 ? 'y' : 'ies'} offer this item`)}</p></td>
          <td className="py-3 px-3 text-xs font-medium"><input aria-label={tx(`Cantidad a comprar partida ${l.line_number}`, `Qty to buy item ${l.line_number}`)} type="text" inputMode="decimal" value={s.qty} disabled={!s.quote} onChange={ev => setSel(x => ({ ...x, [l.id]: { ...s, qty: ev.target.value } }))} className={`w-24 px-2 py-2 border rounded-lg outline-none text-center disabled:bg-slate-50 ${e ? 'border-rose-400' : 'border-blue-200'}`} />{e && <p role="alert" className="text-[10px] text-rose-600 mt-1">{e.code === 'qty' ? tx('Cantidad mayor a cero.', 'Quantity above zero.') : tx('Excede lo ofertado.', 'Exceeds the offer.')}</p>}</td>
          <td className="py-3 px-3 text-xs font-medium"><input aria-label={tx(`Precio unitario adjudicado partida ${l.line_number}`, `Awarded unit price item ${l.line_number}`)} type="text" readOnly value={o ? money(o.unit_price, o.currency, en) : ''} placeholder="—" className="w-36 px-2 py-2 border border-blue-200 rounded-lg bg-slate-50 text-right" /></td>
        </tr>; })}
          {!lines.length && <tr><td colSpan={6} className="py-8 text-center text-slate-400">{tx('La requisición no tiene partidas vigentes.', 'The requisition has no active items.')}</td></tr>}</tbody></table></div>
      {changePreview.orders.length > 0 && <div data-testid="cmp-po-preview" className="p-3 rounded-xl border border-dashed border-purple-200 bg-purple-50/30 text-xs space-y-1"><p className="font-bold text-slate-800">{tx('OC que se generarían con los cambios al guardar (vista previa):', 'POs the changes would create when saved (preview):')}</p>{changePreview.orders.map(g => <p key={g.supplier_name + g.currency}>{g.supplier_name} · {g.lines} {tx('partida(s)', 'item(s)')} · {money(g.amount, g.currency, en)} <span className="text-slate-400">({g.quotes.join(', ')})</span></p>)}</div>}
      {saveTry && <div data-testid="cmp-award-check" className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 ${preview.errors.some(x => x.code === 'qty') ? 'bg-rose-50 border-rose-200 text-rose-800' : changes.length ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        {preview.errors.some(x => x.code === 'qty') ? <AlertCircle className="w-4 h-4 shrink-0" /> : changes.length ? <Lock className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
        <span>{preview.errors.some(x => x.code === 'qty') ? tx('No se puede guardar: revisa la cantidad a comprar de las partidas marcadas.', 'Cannot save: check the quantity to buy of the highlighted items.')
          : changes.length ? tx(`Adjudicación preparada: ${changes.length} partida(s) con cambios en ${changePreview.orders.length} OC por proveedor. No se guardó: adjudicar y generar OC son escrituras comerciales que siguen bloqueadas hasta su autorización.`, `Award prepared: ${changes.length} item(s) changed across ${changePreview.orders.length} PO(s) by supplier. Not saved: awarding and creating POs are commercial writes that stay blocked until authorized.`)
            : tx('Sin cambios: la selección coincide con la adjudicación vigente.', 'No changes: the selection matches the current award.')}</span></div>}
      <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
        <button type="button" onClick={saveAward} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center gap-2"><span aria-hidden="true">💾</span>{tx('Guardar adjudicación', 'Save award')}</button>
        <button type="button" onClick={viewOrders} className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs text-slate-800 flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver órdenes generadas', 'View generated orders')}</button>
      </div>
      {showOrders && <div ref={ordersRef} data-testid="cmp-orders" className="space-y-2">
        {(d.orders || []).map(o => <div key={o.id} className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"><div><p className="font-black text-slate-900">{o.folio}{o.version_number > 1 ? ` · Rev. ${o.version_number - 1}` : ''}</p><p className="text-slate-700">{o.supplier_name}</p><p className="text-[10.5px] text-slate-500">{o.item_count} {tx('partida(s)', 'item(s)')} · {money(o.total_amount, o.currency, en)}{o.status ? ` · ${o.status}` : ''}</p></div>
          <span className="font-bold"><button type="button" onClick={() => onOpenOrders?.()} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg">{tx('Abrir en Órdenes de Compra →', 'Open in Purchase Orders →')}</button></span></div>)}
        {!(d.orders || []).length && <p className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">{tx('Esta requisición aún no tiene órdenes de compra vigentes.', 'This requisition has no current purchase orders yet.')}</p>}
      </div>}
    </div>}

    {sub === 'interpret' && <div data-testid="cmp-interpret" className="space-y-3">
      <div className="p-4 bg-blue-50/60 border border-blue-100 border-l-4 border-l-blue-600 rounded-2xl text-xs text-slate-800 leading-relaxed"><strong className="block mb-1 text-slate-900">{tx('Interpretación del comparativo:', 'Interpreting the comparison:')}</strong>{tx('Primero se muestra el contexto de la requisición. Después se presentan las partidas solicitadas y finalmente el comparativo de las cotizaciones de los proveedores sobre esa misma requisición. La recomendación considera el monto total, los días de entrega, el cumplimiento técnico y el cumplimiento documental. La mejor opción no siempre es la más barata: puede existir una oferta con mayor cumplimiento o mejor plazo.', 'First the requisition context is shown. Then the requested items and finally the comparison of supplier quotes for that same requisition. The recommendation considers the total amount, delivery days, technical compliance and documentation. The best option is not always the cheapest: an offer may have better compliance or lead time.')}</div>
      {[[tx('¿Cómo divido una requisición entre varios proveedores?', 'How do I split a requisition among several suppliers?'), tx('Registra en cada cotización únicamente las partidas que ofrece esa empresa. Después abre "Adjudicación por partida", selecciona el proveedor ganador para cada mercancía y presiona "Guardar adjudicación". El sistema agrupa las partidas por proveedor y crea automáticamente una Orden de Compra y su PDF para cada uno (registro pendiente de habilitar en SupplyFlow).', 'Record in each quote only the items that company offers. Then open "Award per item", choose the winning supplier for each item and press "Save award". The system groups the items by supplier and creates one Purchase Order and its PDF for each (recording pending enablement in SupplyFlow).')],
        [tx('¿Qué significa la recomendación?', 'What does the recommendation mean?'), tx(`Es la oferta con mayor puntaje entre las cotizaciones en la misma moneda: precio por partida ${WEIGHTS.price}% (mejor precio unitario de cada partida contra el ofertado; las partidas no ofertadas suman cero), días de entrega ${WEIGHTS.delivery}%, cumplimiento técnico ${WEIGHTS.technical}% y documental ${WEIGHTS.documental}%. Es una guía: no adjudica ni compromete la compra. El criterio es provisional hasta confirmarlo con la fórmula del sistema original.`, `It is the highest-scoring offer among quotes in the same currency: price per item ${WEIGHTS.price}% (best unit price of each item vs the offered one; items not offered score zero), delivery days ${WEIGHTS.delivery}%, technical ${WEIGHTS.technical}% and documentation ${WEIGHTS.documental}%. It is guidance: it does not award or commit the purchase. The criterion is provisional until confirmed with the original system's formula.`)],
        [tx('¿Qué debo revisar antes de elegir?', 'What should I check before choosing?'), tx('Que la cotización siga vigente, que la moneda y los impuestos sean comparables, que el proveedor ofrezca todas las partidas o la cantidad completa (las ofertas parciales se marcan), el tiempo de entrega contra la fecha requerida, el cumplimiento técnico y documental, las condiciones de pago y que el proveedor esté autorizado en el catálogo.', 'That the quote is still valid, that currency and taxes are comparable, that the supplier offers every item or the full quantity (partial offers are flagged), lead time against the required date, technical and documentation compliance, payment terms and that the supplier is authorized in the catalog.')]].map(([qq, a], i) => <details key={qq} open={i === 0} className="group border border-slate-200 rounded-2xl bg-white overflow-hidden"><summary className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer list-none hover:bg-slate-50"><span className="text-xs font-black text-slate-800">{qq}</span><span className="text-slate-400 text-[10px] transition-transform group-open:rotate-180 group-open:text-blue-600">▼</span></summary><div className="px-5 pb-4 pt-2 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">{a}</div></details>)}
    </div>}
  </div>;
}

export default ComparisonCard;
