import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { strategySetup, strategyRequisition } from './api';
import { ITEM_STRATEGIES, NO_RFQ, isAuthorized, isAssignable, statusLabel, routeOf, requisitionOptions, initialState, autoGroup, addLot, refreshSuggestions, setItem, setLot, toggleSupplier,
  selectSuggested, addSupplier, removeLot, rfqsByLot, lotView, strategyStats, validateStrategy, strategyLockedText, nextRfq, nextRfqText } from './strategyModel.mjs';
import { useLoad } from '../reception/useLoad.js';

// Gestión del Contratista · tarjeta 2 "Estrategia y lotificación de abastecimiento" (diseño Grupo Gerez), conectada a
// MariaDB en modo lectura: requisiciones con validación vigente, partidas, plan de lotificación registrado, RFQ por lote y
// catálogo de proveedores (sugerencias por categoría y suministros). Guardar estrategia y abrir RFQ no escriben.
const DASH = '—';

export function StrategyLots({ en = false, notify = () => {}, onGo, onNavigate, startRequisition = '' }) {
  const tx = (es, e) => (en ? e : es);
  const [reqId, setReqId] = useState(startRequisition || '');
  const [st, setSt] = useState(null);
  const [tried, setTried] = useState(false); const [msg, setMsg] = useState(null); const [pick, setPick] = useState({});
  const setup = useLoad(s => strategySetup(s), []);
  const detail = useLoad(s => strategyRequisition(reqId, s), [reqId], !!reqId);
  const d = detail.status === 'ready' && detail.data?.item?.id === reqId ? detail.data : null;
  const suppliers = setup.data?.suppliers || [];
  useEffect(() => { if (d && setup.data) { setSt(initialState(d, suppliers)); setTried(false); setMsg(null); setPick({}); } }, [d, setup.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = d?.items || [];
  const rfqs = useMemo(() => rfqsByLot(d), [d]);
  const ready = d && st;
  const v = useMemo(() => (ready ? validateStrategy(st, { detail: d, suppliers }, en) : null), [ready, st, d, suppliers, en]);
  const stats = ready ? strategyStats(st, items, rfqs) : { items: 0, lots: 0, suppliers: 0, noRfq: 0, pending: 0 };
  const up = next => { setSt(next); setMsg(null); };
  const supName = id => suppliers.find(s => s.id === id)?.name || id;

  const save = andNext => {
    setTried(true);
    if (!ready) { setMsg({ kind: 'error', text: tx('Selecciona una requisición validada.', 'Select a validated requisition.') }); return; }
    if (!v.ok) { setMsg({ kind: 'error', text: v.first }); return; }
    let text = strategyLockedText(st, d, en);
    if (andNext) {
      const lot = st.lots.find(l => nextRfq(st, l.key, { detail: d, suppliers }, en).supplier);
      if (lot) text += ` ${nextRfqText(nextRfq(st, lot.key, { detail: d, suppliers }, en), d.item.folio, en)}`;
      else text += tx(' No hay RFQ pendientes por abrir.', ' There are no pending RFQs to open.');
    }
    setMsg({ kind: 'locked', text, rfq: andNext }); notify(tx('Estrategia no registrada', 'Strategy not recorded'), text, 'warning');
  };
  const openNext = key => {
    const n = nextRfq(st, key, { detail: d, suppliers }, en);
    setMsg(n.error ? { kind: 'error', text: n.error } : { kind: 'locked', text: nextRfqText(n, d.item.folio, en), rfq: true });
  };

  const steps = [tx('Solicitud', 'Request'), tx('Validación', 'Validation'), tx('Lotificación', 'Lotting'), tx('RFQ por lote', 'RFQ per lot'), tx('Comparativo', 'Comparison')];
  const lbl = (t, req, child, cls = '', err = '') => <label className={`block ${cls}`}><span className="block text-[11px] font-black text-slate-900 mb-1.5">{t}{req ? ' *' : ''}</span>{child}{err && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{err}</span>}</label>;
  const ctl = bad => `w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${bad ? 'border-rose-400' : 'border-slate-300'}`;
  const sectionHead = (title, sub) => <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50"><h4 className="text-sm font-black text-slate-900">{title}</h4><p className="text-[11px] text-slate-500 mt-0.5">{sub}</p></div>;

  return <div className="space-y-5" data-testid="strategy-lots">
    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-4 border-b border-slate-100">
      <div className="min-w-0"><h3 className="text-base sm:text-lg font-black text-slate-900"><span aria-hidden="true">🧩</span> {tx('Estrategia y lotificación de abastecimiento', 'Sourcing strategy and lotting')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Una sola requisición puede generar varios lotes, varias RFQ y varias órdenes de compra sin duplicar la solicitud del cliente.', 'A single requisition can generate several lots, RFQs and purchase orders without duplicating the client request.')}</p></div>
      <span className="text-[10.5px] font-black text-purple-900 bg-purple-100/80 border border-purple-200 rounded-full px-3 py-1 shrink-0">{tx('Paso 3 · Abastecimiento por partida', 'Step 3 · Sourcing per line')}</span>
    </div>
    <div data-testid="strategy-stepper" className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-stretch">{steps.map((s, n) => { const done = n < 2; const cur = n === 2; return <div key={s} className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border text-xs font-black ${done ? 'bg-emerald-50/70 border-emerald-200 text-slate-900' : cur ? 'bg-purple-50 border-purple-300 text-slate-900 ring-1 ring-purple-200' : 'bg-white border-slate-200 text-slate-800'}`}><span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 ${done ? 'bg-emerald-600 text-white' : cur ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}>{n + 1}</span>{s}</div>; })}</div>
    {setup.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
    {setup.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{setup.error.message}</p>}

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {lbl(tx('Requisición validada', 'Validated requisition'), true, <select aria-label={tx('Requisición validada', 'Validated requisition')} value={reqId} onChange={e => { setReqId(e.target.value); setSt(null); setMsg(null); setTried(false); }} className={ctl(tried && !reqId)}><option value="">{tx('Seleccionar requisición...', 'Select requisition...')}</option>{requisitionOptions(setup.data?.requisitions || [], en).map(o => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}</select>, 'md:col-span-2', tried && v?.errors.requisition)}
      {lbl(tx('Responsable de compras', 'Purchasing manager'), false, <input type="text" readOnly aria-label={tx('Responsable de compras', 'Purchasing manager')} value={d ? (d.item.buyer || tx('Sin responsable', 'No manager')).toUpperCase() : ''} placeholder={tx('Desde la validación', 'From the validation')} className="w-full px-3.5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-600 cursor-default" />)}
      {lbl(tx('Mínimo general de cotizaciones', 'General minimum of quotes'), false, <input type="text" inputMode="numeric" aria-label={tx('Mínimo general de cotizaciones', 'General minimum of quotes')} value={st?.minQuotes ?? ''} disabled={!ready} onChange={e => up({ ...st, minQuotes: e.target.value })} className={ctl(tried && v?.errors.minQuotes)} />, '', tried && v?.errors.minQuotes)}
    </div>

    {!reqId ? <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-xl p-3.5 text-xs text-slate-700">{tx('Selecciona una requisición validada para definir la estrategia por partida.', 'Select a validated requisition to define the strategy per line.')}</div>
      : !ready ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5">{detail.error ? <><AlertCircle className="w-4 h-4 text-rose-600" /><span role="alert" className="text-rose-700">{detail.error.message}</span></> : <><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</>}</p>
      : <>
        <div data-testid="strategy-context" className="bg-blue-50/70 border-l-4 border-blue-600 rounded-xl p-3.5 text-xs text-slate-700"><div className="font-black text-slate-900">{d.item.folio} · {String(d.item.client_name || '').toUpperCase()}</div><div>{items.length} {tx('partida(s)', 'line(s)')} · {tx('Proyecto', 'Project')}: {d.item.project || DASH} · {tx('Contrato', 'Contract')}: {d.item.contract || DASH} · {tx('Validación', 'Validation')}: {d.item.review_folio} ({d.item.strategy}, {tx('mín.', 'min.')} {d.item.min_quotes})</div>
          <div className="text-[10.5px] mt-1 text-slate-500">{d.plan ? tx(`Estrategia registrada en MariaDB: versión ${d.plan.version}${d.plan.updated_at ? ` · ${String(d.plan.updated_at).slice(0, 10)}` : ''}.`, `Strategy recorded in MariaDB: version ${d.plan.version}${d.plan.updated_at ? ` · ${String(d.plan.updated_at).slice(0, 10)}` : ''}.`) : tx('Sin estrategia registrada: se propone una agrupación por categoría.', 'No strategy recorded: a grouping by category is proposed.')}{d.rfqs_without_lot.length > 0 && ` ${tx('RFQ previas sin lote', 'Previous RFQs without lot')}: ${d.rfqs_without_lot.map(r => `${r.folio} (${r.supplier_name})`).join(', ')}.`}</div></div>
        <div data-testid="strategy-stats" className="grid grid-cols-2 sm:grid-cols-5 gap-3">{[[stats.items, tx('Partidas', 'Lines')], [stats.lots, tx('Lotes', 'Lots')], [stats.suppliers, tx('Proveedores', 'Suppliers')], [stats.noRfq, tx('Sin RFQ', 'No RFQ')], [stats.pending, tx('RFQ pendientes', 'Pending RFQs')]].map(([n, t]) => <div key={t} className="p-3 rounded-2xl border border-slate-200 bg-white"><div className="text-xl font-black text-slate-900">{n}</div><div className="text-[9.5px] font-black text-slate-600 uppercase mt-1">{t}</div></div>)}</div>
        <div className="flex flex-wrap gap-3 text-sm font-black">
          <button type="button" onClick={() => up(autoGroup(st, items, suppliers))} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">✨</span>{tx('Agrupar automáticamente por categoría', 'Group automatically by category')}</button>
          <button type="button" onClick={() => up(addLot(st))} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm flex items-center gap-2">+ {tx('Nuevo lote', 'New lot')}</button>
          <button type="button" onClick={() => up(refreshSuggestions(st, items, suppliers))} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2"><span aria-hidden="true">↻</span>{tx('Actualizar proveedores sugeridos', 'Refresh suggested suppliers')}</button>
        </div>

        {sectionHead(tx('1. Estrategia por partida', '1. Strategy per line'), tx('Cada artículo puede seguir una ruta distinta aunque pertenezca a la misma requisición.', 'Each item can follow a different route even if it belongs to the same requisition.'))}
        {tried && v.errors.items && <p role="alert" className="text-[11px] text-rose-700 font-semibold">{v.errors.items}</p>}
        <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white"><table className="w-full text-left border-collapse text-[11px] min-w-[900px]"><thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black uppercase tracking-wider text-[10px]">{['#', tx('Descripción', 'Description'), tx('Categoría', 'Category'), tx('Estrategia', 'Strategy'), tx('Lote', 'Lot'), tx('Ruta', 'Route')].map(h => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{items.map(i => { const s = st.items[i.id] || {}; const r = routeOf(s.strategy, en); const le = tried ? v.lineErrors[i.id] : ''; return <tr key={i.id} data-testid="strategy-line" className="align-top">
            <td className="p-3">{i.line_number}</td><td className="p-3 font-black text-slate-900 uppercase">{i.description}{i.sent.length > 0 && <div className="text-[9.5px] font-semibold normal-case text-blue-700 mt-1">{tx('Enviada en', 'Sent in')} {i.sent.map(x => `${x.rfq} (${x.supplier_name})`).join(', ')}</div>}</td><td className="p-3 text-slate-700">{i.category || DASH}</td>
            <td className="p-3 min-w-[200px]"><select aria-label={`${tx('Estrategia', 'Strategy')} #${i.line_number}`} value={s.strategy || ''} onChange={e => up(setItem(st, i.id, { strategy: e.target.value }))} className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs">{ITEM_STRATEGIES.map(([es, e2]) => <option key={es} value={es}>{en ? e2 : es}</option>)}</select></td>
            <td className="p-3 min-w-[220px]"><select aria-label={`${tx('Lote', 'Lot')} #${i.line_number}`} value={s.lot || ''} disabled={s.strategy === NO_RFQ} onChange={e => up(setItem(st, i.id, { lot: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border rounded-xl text-xs disabled:bg-slate-100 ${le ? 'border-rose-400' : 'border-slate-300'}`}><option value="">{s.strategy === NO_RFQ ? tx('— Sin lote (sin RFQ) —', '— No lot (no RFQ) —') : tx('Seleccionar lote...', 'Select lot...')}</option>{st.lots.map(l => <option key={l.key} value={l.key}>{l.name || l.key}</option>)}</select>{le && <span role="alert" className="block text-[10px] text-rose-600 font-semibold mt-1">{le}</span>}</td>
            <td className="p-3"><span className={`inline-block px-2.5 py-1 rounded-full text-[9.5px] font-black border whitespace-nowrap ${r.code === 'rfq' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{r.text}</span></td>
          </tr>; })}{!items.length && <tr><td colSpan={6} className="p-8 text-center text-slate-400">{tx('La requisición no tiene partidas activas.', 'The requisition has no active lines.')}</td></tr>}</tbody></table></div>

        {sectionHead(tx('2. Lotes y proveedores', '2. Lots and suppliers'), tx('Cada lote recibe únicamente las partidas que le corresponden y puede enviarse a proveedores distintos.', 'Each lot receives only its own lines and can be sent to different suppliers.'))}
        <div data-testid="strategy-catalog" className="bg-blue-50/70 border-l-4 border-blue-600 rounded-xl p-3.5 text-[11px] text-slate-700"><strong className="text-slate-900">{tx('Catálogo de proveedores:', 'Supplier catalog:')}</strong> {setup.data.summary.authorized} {tx('Autorizado/Activo', 'Authorized/Active')} · {setup.data.summary.available} {tx('disponible(s) para asignación manual. Las sugerencias se calculan por categoría del proveedor y por sus suministros registrados.', 'available for manual assignment. Suggestions are computed from the supplier category and its registered supplies.')}</div>
        {tried && v.errors.lots && <p role="alert" className="text-[11px] text-rose-700 font-semibold">{v.errors.lots}</p>}
        {!st.lots.length ? <div className="p-8 border border-dashed border-slate-300 rounded-2xl text-center text-sm text-slate-500">{tx('Sin lotes: usa "Agrupar automáticamente por categoría" o "+ Nuevo lote".', 'No lots: use "Group automatically by category" or "+ New lot".')}</div>
          : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{st.lots.map((l, n) => { const lv = lotView(st, l, items, rfqs); const le = tried ? v.lotErrors[l.key] : ''; const options = suppliers.filter(s => isAssignable(s) && !l.suppliers.some(x => x.id === s.id));
            return <div key={l.key} data-testid="strategy-lot" className={`rounded-2xl border p-4 space-y-3 bg-white ${le ? 'border-rose-300' : 'border-slate-200'}`}>
              <div className="flex items-start gap-2"><input type="text" aria-label={`${tx('Nombre del lote', 'Lot name')} ${n + 1}`} value={l.name} maxLength={260} onChange={e => up(setLot(st, l.key, { name: e.target.value }))} className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-900" />
                <span data-testid="strategy-lot-rfq" className={`text-[9.5px] font-black rounded-full px-2.5 py-1 border shrink-0 ${lv.selected && lv.created === lv.selected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{lv.created}/{lv.selected} {tx('RFQ creadas', 'RFQs created')}</span></div>
              <div className="text-[11px] text-slate-500 uppercase">{lv.lines.length ? lv.lines.map(i => `#${i.line_number} ${i.description}`).join(' · ') : tx('Sin partidas asignadas', 'No lines assigned')}</div>
              <div className="grid grid-cols-3 gap-2">{[[lv.lines.length, tx('partidas', 'lines')], [lv.rfqLines, tx('requieren RFQ', 'need RFQ')], [lv.selected, tx('proveedores', 'suppliers')]].map(([x, t]) => <div key={t} className="p-2 rounded-xl border border-slate-200 bg-slate-50/40"><div className="text-sm font-black text-slate-900">{x}</div><div className="text-[9px] text-slate-500">{t}</div></div>)}</div>
              {lbl(tx('Mínimo de cotizaciones', 'Minimum of quotes'), false, <input type="text" inputMode="numeric" aria-label={`${tx('Mínimo de cotizaciones del lote', 'Lot minimum of quotes')} ${n + 1}`} value={l.minQuotes} onChange={e => up(setLot(st, l.key, { minQuotes: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm" />)}
              {l.suppliers.length ? <div className="space-y-2 max-h-64 overflow-y-auto pr-1">{l.suppliers.map(s => { const cat = suppliers.find(x => x.id === s.id); const done = lv.createdIds.has(s.id); return <label key={s.id} data-testid="strategy-supplier" className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${s.selected ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                <input type="checkbox" checked={s.selected} onChange={() => up(toggleSupplier(st, l.key, s.id))} aria-label={`${tx('Seleccionar', 'Select')} ${supName(s.id)}`} className="mt-0.5 w-4 h-4 accent-blue-600" />
                <span className="min-w-0"><span className="block text-[11px] font-black text-slate-900 uppercase">{supName(s.id)}</span><span className="block text-[10px] text-slate-600">{s.suggested ? <><span aria-hidden="true">✨</span> {tx('Sugerido por catálogo', 'Suggested by catalog')}</> : tx('Asignación manual', 'Manual assignment')} · {statusLabel(cat, en)}{cat && !isAuthorized(cat) && <span className="text-amber-700"> · {tx('no autorizado', 'not authorized')}</span>}</span>{done && <span className="block text-[10px] font-black text-emerald-700">{tx('RFQ creada', 'RFQ created')}: {(rfqs[l.key] || []).filter(r => r.supplier_id === s.id).map(r => r.folio).join(', ')}</span>}</span>
              </label>; })}</div>
                : <p className="text-[11px] text-slate-500 p-3 rounded-xl border border-dashed border-slate-300">{tx('No hubo coincidencia automática por categoría/suministro. Usa el selector inferior para asignar un proveedor.', 'No automatic match by category/supply. Use the selector below to assign a supplier.')}</p>}
              <div className="flex flex-wrap gap-2 text-[11px] font-black"><button type="button" onClick={() => up(selectSuggested(st, l.key))} className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl">☑ {tx('Seleccionar sugeridos', 'Select suggested')}</button>{!lv.lines.length && !(rfqs[l.key] || []).length && <button type="button" onClick={() => up(removeLot(st, l.key))} className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl">{tx('Quitar lote', 'Remove lot')}</button>}</div>
              <div className="flex gap-2"><select aria-label={`${tx('Agregar otro proveedor', 'Add another supplier')} ${n + 1}`} value={pick[l.key] || ''} onChange={e => setPick(p => ({ ...p, [l.key]: e.target.value }))} className="flex-1 min-w-0 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm"><option value="">{tx('Agregar otro proveedor...', 'Add another supplier...')}</option>{options.map(s => <option key={s.id} value={s.id}>{s.name} · {statusLabel(s, en)}{s.category ? ` · ${s.category}` : ''}</option>)}</select>
                <span className="text-[11px] font-black"><button type="button" disabled={!pick[l.key]} onClick={() => { up(addSupplier(st, l.key, pick[l.key])); setPick(p => ({ ...p, [l.key]: '' })); }} className="h-full px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl shadow-sm disabled:opacity-50">{tx('Agregar', 'Add')}</button></span></div>
              <span className="text-[11px] font-black inline-block"><button type="button" onClick={() => openNext(l.key)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">{tx('Abrir siguiente RFQ', 'Open next RFQ')}</button></span>
              {le && <p role="alert" className="text-[10.5px] text-rose-600 font-semibold">{le}</p>}
            </div>; })}</div>}
        {tried && v.ok && v.warnings.map(w => <p key={w} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">{w}</p>)}
      </>}

    {msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} data-testid="strategy-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span className="min-w-0">{msg.text}{msg.rfq && onNavigate && <span className="block mt-2 text-[11px] font-black"><button type="button" onClick={() => onNavigate('quotes')} className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg">{tx('Ir a Cotizaciones → Solicitud a proveedores (RFQ)', 'Go to Quotes → Supplier request (RFQ)')}</button></span>}</span></div>}
    <div className="flex flex-wrap gap-3 pt-1 text-sm font-black">
      <button type="button" onClick={() => save(false)} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">💾</span>{tx('Guardar estrategia', 'Save strategy')}</button>
      <button type="button" onClick={() => save(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">💾</span>{tx('Guardar y abrir siguiente RFQ →', 'Save and open next RFQ →')}</button>
      <button type="button" onClick={() => onGo?.('matrix', tx('Matriz de validaciones', 'Validation Matrix'))} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver validaciones', 'View validations')}</button>
    </div>
  </div>;
}

export default StrategyLots;
