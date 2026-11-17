import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Lock, ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react';
import { listCustomerQuotes, getComparison, listAwards } from './api';
import { money, label } from './model.mjs';
import { statusText } from './cqMatrix.mjs';
import { AWARD_STEPS, eligibleRef, awardBadge, recommendedByLine, definitiveInit, chosenOffer, validateAward } from './definitiveAward.mjs';

// Tarjeta 10 · Adjudicación definitiva. Elegibles = revisión vigente de cotizaciones al cliente APROBADAS
// (GET /api/v1/quotes/customer-quotes?scope=current&group=approved), con partidas, partidas adjudicadas y OC vigentes.
// El detalle usa el comparativo (GET /quotes/comparison?requisition=…): ofertas, recomendado y adjudicación vigente.
// Confirmar la adjudicación definitiva (y generar OC) es una escritura comercial bloqueada: se valida y se explica.
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
const PAGE = 25;
const STEP = {
  done: ['bg-slate-50/70 border-slate-200', 'bg-blue-100 text-blue-700', 'text-slate-500'],
  gate: ['bg-amber-50 border-amber-300', 'bg-amber-100 text-amber-800', 'text-amber-700'],
  current: ['bg-purple-50 border-purple-300', 'bg-purple-600 text-white', 'text-purple-700'],
  next: ['bg-emerald-50/70 border-emerald-200', 'bg-emerald-600 text-white', 'text-emerald-700'],
};
const fmtQty = v => { const x = Number(v); return Number.isFinite(x) ? x.toLocaleString('es-MX', { maximumFractionDigits: 4 }) : '—'; };

export function DefinitiveAwardCard({ en = false, notify, refresh = 0, onOpenComparison, onOpenOrders }) {
  const tx = (es, e) => (en ? e : es);
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState(null);
  const [sel, setSel] = useState({}); const [tried, setTried] = useState(false); const [result, setResult] = useState(null);
  const [showAwards, setShowAwards] = useState(false);
  const list = useLoad(s => listCustomerQuotes({ scope: 'current', group: 'approved', page, page_size: PAGE }, s), [page, refresh]);
  const cmp = useLoad(s => getComparison(picked.requisition_id, s), [picked?.requisition_id, refresh], !!picked);
  const awards = useLoad(s => listAwards({ page: 1, page_size: 50, status: 'current' }, s), [refresh], showAwards);
  const rows = list.data?.items || []; const total = list.data?.total || 0; const last = Math.max(1, Math.ceil(total / PAGE));
  const d = cmp.data; const lines = useMemo(() => (d?.lines || []).filter(l => !l.line_status || l.line_status === 'active'), [d]);
  const rec = useMemo(() => recommendedByLine(d?.lines || [], d?.quotes || []), [d]);
  useEffect(() => { setSel(definitiveInit(d?.lines || [], rec.byLine)); setTried(false); setResult(null); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasPO = (d?.orders || []).length > 0;
  const approved = !!picked && picked.status_key === 'approved' && (!d?.customer_quote || d.customer_quote.id === picked.id);
  const v = useMemo(() => validateAward({ lines, selection: sel, recommended: rec.byLine, approved, hasPO }, en), [lines, sel, rec, approved, hasPO, en]);
  const noOffers = d && !lines.some(l => (l.offers || []).some(o => o.offered));
  const setLine = (id, patch) => { setSel(x => ({ ...x, [id]: { ...x[id], ...patch } })); setResult(null); };
  const pick = r => { setPicked(p => (p?.id === r.id ? null : r)); };
  const confirm = () => {
    setTried(true);
    if (!v.ok) { notify?.(tx('Adjudicación incompleta', 'Incomplete award'), v.first, 'warning'); setResult(null); return; }
    if (!v.changed.length) { setResult({ kind: 'same', msg: tx('La adjudicación vigente ya coincide con la selección: no hay cambios que confirmar.', 'The current award already matches the selection: there are no changes to confirm.') }); return; }
    const msg = tx(`Adjudicación validada (${v.changed.length} partida(s) por confirmar), pero no se registró: confirmar la adjudicación definitiva y generar la OC son escrituras comerciales bloqueadas hasta su autorización.`,
      `Award validated (${v.changed.length} item(s) to confirm) but not recorded: confirming the definitive award and generating the PO are commercial writes blocked until authorized.`);
    setResult({ kind: 'locked', msg }); notify?.(tx('Registro no habilitado', 'Recording not enabled'), msg, 'warning');
  };

  return <div className="relative bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5 overflow-hidden" data-testid="award-card">
    <span className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" />
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2"><span aria-hidden="true">🏆</span>{tx('Adjudicación definitiva', 'Definitive award')}</h3>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{tx('Confirma al proveedor ganador únicamente después de que el cliente haya aceptado la cotización comercial.', 'Confirm the winning supplier only after the client has accepted the commercial quote.')}</p></div>
      <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-bold text-[10.5px] rounded-full border border-emerald-200 shrink-0 self-start">{tx('Posterior a aceptación', 'After acceptance')}</span>
    </div>

    <ol className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label={tx('Flujo de adjudicación', 'Award flow')}>{AWARD_STEPS.map(([n, es, e, ses, se, kind], i) => { const [box, dot, sub] = STEP[kind]; return <li key={n} data-testid="award-step" className={`relative p-3.5 rounded-2xl border ${box}`}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${dot}`}>{n}</span>
      <span className="block text-sm font-black text-slate-900 mt-2 leading-tight">{en ? e : es}</span><span className={`block text-[11px] mt-0.5 ${sub}`}>{en ? se : ses}</span>
      {i < AWARD_STEPS.length - 1 && <span aria-hidden="true" className="hidden xl:block absolute -right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">→</span>}
    </li>; })}</ol>

    <div className="p-3.5 bg-blue-50/60 border-l-4 border-blue-600 rounded-r-xl text-xs text-slate-700 leading-relaxed" data-testid="award-rule"><span className="font-bold text-slate-900">{tx('Regla:', 'Rule:')}</span> {tx('antes de la aceptación del cliente existe únicamente una', 'before client acceptance there is only a')} <strong className="text-slate-900">{tx('selección preliminar', 'preliminary selection')}</strong>{tx('. La adjudicación definitiva confirma al proveedor después de contar con respaldo comercial del cliente.', '. The definitive award confirms the supplier once the client has given commercial backing.')}</div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-2.5">
        <h4 className="text-sm sm:text-base font-black text-slate-900">{tx('Cotizaciones aceptadas elegibles', 'Eligible accepted quotes')}</h4>
        {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
        {list.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{list.error.message}</p>}
        {rows.map(r => { const b = awardBadge(r, en); const on = picked?.id === r.id; return <button key={r.id} type="button" data-testid="award-eligible" data-folio={r.folio} aria-pressed={on} onClick={() => pick(r)}
          className={`w-full text-left grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-center gap-2 p-3.5 rounded-xl border transition-all cursor-pointer ${on ? 'border-purple-400 ring-2 ring-purple-100 bg-purple-50/30' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
          <span className="min-w-0"><span className="block text-sm font-black text-slate-900 truncate">{eligibleRef(r)}</span><span className="block text-[11px] text-slate-500 truncate">{r.client_name}</span></span>
          <span className="min-w-0"><span className="block text-sm font-black text-slate-900">{r.folio}</span><span className="block text-[11px] text-slate-500">Rev. {r.revision} · {statusText(r, en)}</span></span>
          <span className={`justify-self-start sm:justify-self-end px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap ${b.tone}`}>{b.text}</span>
        </button>; })}
        {list.status === 'ready' && !rows.length && <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('No hay cotizaciones aprobadas por el cliente. La adjudicación definitiva espera la aceptación (tarjeta 9).', 'There are no client-approved quotes. The definitive award waits for acceptance (card 9).')}</div>}
        {total > PAGE && <div className="flex justify-between items-center text-xs text-slate-600 pt-1"><span>{total} {tx('elegibles', 'eligible')} · {tx('Página', 'Page')} {page} / {last}</span>
          <div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(x => x - 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(x => x + 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronRight size={16} /></button></div></div>}
      </div>
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3 self-start">
        <h4 className="text-sm sm:text-base font-black text-slate-900">{tx('Qué se valida en esta etapa', 'What is validated at this stage')}</h4>
        <p className="text-sm text-slate-700 leading-relaxed">{tx('Proveedor definitivo, oferta utilizada, moneda, costo, plazo y justificación cuando el proveedor definitivo sea distinto al recomendado inicialmente.', 'Definitive supplier, offer used, currency, cost, lead time and justification when the definitive supplier differs from the one initially recommended.')}</p>
        <span className="block text-sm font-black"><button type="button" onClick={() => onOpenComparison?.(picked?.requisition_id || '')} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">📊</span>{tx('Abrir comparativo', 'Open comparison')}</button></span>
        <p className="text-[10.5px] text-slate-400">{picked ? tx(`Abre el comparativo de ${picked.requisition}.`, `Opens the comparison of ${picked.requisition}.`) : tx('Selecciona una cotización elegible para revisar y confirmar su adjudicación por partida.', 'Select an eligible quote to review and confirm its award per item.')}</p>
      </div>
    </div>

    {picked && <div className="p-4 sm:p-5 rounded-2xl border border-purple-200 bg-purple-50/20 space-y-4" data-testid="award-detail">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div><h4 className="text-sm sm:text-base font-black text-slate-900">{eligibleRef(picked)} · {picked.requisition}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{picked.client_name} · {picked.folio} Rev. {picked.revision} · {statusText(picked, en)}{picked.last_decision_at ? ` ${tx('el', 'on')} ${String(picked.last_decision_at).slice(0, 10)}` : ''} · {money(picked.total_amount, picked.currency, en)}</p></div>
        <span className="text-xs font-bold self-start"><button type="button" aria-label={tx('Cerrar detalle', 'Close detail')} onClick={() => setPicked(null)} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"><X className="w-4 h-4" /></button></span>
      </div>
      {cmp.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando comparativo…', 'Loading comparison…')}</p>}
      {cmp.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{cmp.error.message}</p>}
      {d && <>
        {tried && v.errors.gate && <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{v.errors.gate}</p>}
        {hasPO && <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900"><span className="font-bold">{tx('OC vigentes:', 'Current POs:')}</span>{d.orders.map(o => <span key={o.id} className="px-2 py-0.5 rounded-full bg-white border border-sky-200 font-bold">{o.folio} · {o.supplier_name} · {money(o.total_amount, o.currency, en)} · {o.status}</span>)}
          <span className="text-xs font-bold ml-auto"><button type="button" onClick={() => onOpenOrders?.()} className="px-3 py-1 rounded-lg bg-white border border-sky-300 hover:bg-sky-100">{tx('Ver órdenes de compra', 'View purchase orders')}</button></span></div>}
        {noOffers ? <div className="p-6 border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-500 bg-white">{tx('La requisición no tiene ofertas de proveedor registradas. Registra las cotizaciones recibidas (tarjeta 4) y compáralas antes de adjudicar.', 'The requisition has no supplier offers recorded. Record the received quotes (card 4) and compare them before awarding.')}</div>
          : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left border-collapse min-w-[840px] text-xs">
            <thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">{['#', tx('Partida', 'Item'), tx('Recomendado', 'Recommended'), tx('Proveedor definitivo', 'Definitive supplier'), tx('Oferta utilizada', 'Offer used'), tx('Costo unitario', 'Unit cost'), tx('Importe', 'Amount'), tx('Plazo', 'Lead time'), tx('Estado', 'Status')].map(h => <th key={h} className="py-3 px-2.5 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">{lines.map(l => { const s = sel[l.id] || {}; const o = chosenOffer(l, s); const r = rec.byLine[l.id]; const differs = r && o && r.quote_id !== o.quote_id;
              const changed = (l.award?.quote_id || '') !== (o?.quote_id || ''); return <React.Fragment key={l.id}>
              <tr data-testid="award-line" className="align-top">
                <td className="py-3 px-2.5 font-black">{l.line_number}</td>
                <td className="py-3 px-2.5 min-w-[140px]"><div className="font-semibold text-slate-900">{l.description}</div><div className="text-[10.5px] text-slate-400">{fmtQty(s.qty)} {l.unit_label}</div></td>
                <td className="py-3 px-2.5 min-w-[130px]">{r ? <><div className="font-semibold">{r.supplier_name}</div><div className="text-[10.5px] text-slate-400">{r.quote_folio}</div><span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9.5px] font-bold">{tx('Recomendado', 'Recommended')}</span></> : <span className="text-slate-400">{tx('Sin ofertas', 'No offers')}</span>}</td>
                <td className="py-3 px-2.5 text-xs font-medium min-w-[180px]"><select aria-label={tx(`Proveedor definitivo partida ${l.line_number}`, `Definitive supplier item ${l.line_number}`)} value={s.quote || ''} onChange={e => setLine(l.id, { quote: e.target.value })} className={`w-full px-2.5 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-purple-500 ${tried && v.errors[l.id] ? 'border-rose-400' : 'border-slate-300'}`}>
                  <option value="">{tx('Seleccionar proveedor…', 'Select supplier…')}</option>
                  {(l.offers || []).filter(x => x.offered).map(x => <option key={x.quote_id} value={x.quote_id}>{x.supplier_name} · {x.quote_folio} · {money(x.unit_price, x.currency, en)}</option>)}
                </select></td>
                <td className="py-3 px-2.5 font-semibold whitespace-nowrap">{o?.quote_folio || '—'}</td>
                <td className="py-3 px-2.5 whitespace-nowrap">{o ? money(o.unit_price, o.currency, en) : '—'}</td>
                <td className="py-3 px-2.5 font-black whitespace-nowrap">{o ? money(Number(s.qty) * Number(o.unit_price), o.currency, en) : '—'}</td>
                <td className="py-3 px-2.5 whitespace-nowrap">{o && o.lead_days !== null && o.lead_days !== undefined ? tx(`${fmtQty(o.lead_days)} días`, `${fmtQty(o.lead_days)} days`) : '—'}</td>
                <td className="py-3 px-2.5 whitespace-nowrap">{l.award && !changed ? <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">{tx('Adjudicada vigente', 'Current award')}</span> : changed && o ? <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">{l.award ? tx('Cambio', 'Change') : tx('Por confirmar', 'To confirm')}</span> : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">{tx('Sin adjudicar', 'Not awarded')}</span>}</td>
              </tr>
              {(differs || (tried && v.errors[l.id])) && <tr><td colSpan={9} className="px-3 pb-3 pt-0">
                {differs && <label className="block text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx(`Justificación: el proveedor definitivo es distinto al recomendado (${r.supplier_name})`, `Justification: the definitive supplier differs from the recommended one (${r.supplier_name})`)} *</span>
                  <textarea aria-label={tx(`Justificación partida ${l.line_number}`, `Justification item ${l.line_number}`)} rows={2} maxLength={1000} value={s.why || ''} onChange={e => setLine(l.id, { why: e.target.value })} className={`w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-purple-500 ${tried && v.errors[l.id] ? 'border-rose-400' : 'border-slate-300'}`} /></label>}
                {tried && v.errors[l.id] && <p role="alert" className="text-[10.5px] text-rose-600 font-semibold mt-1">{v.errors[l.id]}</p>}
              </td></tr>}
            </React.Fragment>; })}</tbody></table></div>}
        {!noOffers && v.orders.length > 0 && <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1" data-testid="award-orders"><p className="font-bold text-slate-800">{tx('Compromiso por proveedor (base de la OC):', 'Commitment per supplier (PO basis):')}</p>
          {v.orders.map(g => <p key={`${g.supplier}|${g.currency}`} className="text-slate-600">{g.supplier} · {g.lines} {tx('partida(s)', 'item(s)')} · {money(g.amount, g.currency, en)} · {g.quotes.join(', ')}</p>)}</div>}
        {result && <p role="status" data-testid="award-result" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${result.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{result.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{result.msg}</span></p>}
        {!noOffers && <div className="flex flex-wrap justify-end gap-2 text-xs font-bold">
          <button type="button" onClick={() => { setSel(definitiveInit(d.lines, rec.byLine)); setTried(false); setResult(null); }} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl">{tx('Restablecer', 'Reset')}</button>
          <button type="button" onClick={confirm} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{tx('Confirmar adjudicación definitiva', 'Confirm definitive award')}</button>
        </div>}
      </>}
    </div>}

    <div className="rounded-2xl border border-slate-200/80">
      <span className="block text-xs font-bold"><button type="button" aria-expanded={showAwards} onClick={() => setShowAwards(x => !x)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-2xl">{tx('Adjudicaciones vigentes registradas', 'Current recorded awards')}<ChevronDown className={`w-4 h-4 transition-transform ${showAwards ? 'rotate-180' : ''}`} /></button></span>
      {showAwards && <div className="px-4 pb-4 space-y-2" data-testid="award-current">
        {awards.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
        {awards.error && <p role="alert" className="text-xs text-rose-700">{awards.error.message}</p>}
        {awards.data && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left border-collapse min-w-[900px] text-[11px]">
          <thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">{[tx('Requisición', 'Requisition'), tx('Partida', 'Item'), tx('Proveedor ganador', 'Winning supplier'), tx('Cotización', 'Quote'), tx('Cantidad', 'Qty'), tx('Precio unitario', 'Unit price'), tx('Importe', 'Amount'), tx('Origen', 'Source'), 'OC'].map(h => <th key={h} className="py-2.5 px-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">{awards.data.items.map(a => <tr key={a.id} className="align-top"><td className="py-2.5 px-3 font-bold">{a.requisition}<div className="text-[10px] text-slate-400 font-normal">{a.client_name}</div></td><td className="py-2.5 px-3">{a.line_number} · {a.description}</td><td className="py-2.5 px-3 font-semibold">{a.supplier_name}</td><td className="py-2.5 px-3">{a.quote_folio}</td><td className="py-2.5 px-3">{fmtQty(a.quantity)}</td><td className="py-2.5 px-3">{money(a.unit_price, a.currency, en)}</td><td className="py-2.5 px-3 font-bold">{money(a.subtotal_amount, a.currency, en)}</td><td className="py-2.5 px-3">{label(a.source_kind, en)}</td><td className="py-2.5 px-3">{a.purchase_orders || <span className="text-amber-700 font-semibold">{tx('Pendiente de OC', 'PO pending')}</span>}</td></tr>)}
            {!awards.data.items.length && <tr><td colSpan={9} className="py-8 text-center text-slate-400">{tx('Sin adjudicaciones vigentes.', 'No current awards.')}</td></tr>}</tbody></table></div>}
      </div>}
    </div>
  </div>;
}

export default DefinitiveAwardCard;
