import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, Plus, CheckCircle2 } from 'lucide-react';
import { listSupplierOfferings, getCatalogRecord } from '../../catalogApi';
import { typeLabel, statusKey, statusLabel, STATUS_TONE, leadTime, credit, supplierCommercial, supplierCards } from './model.mjs';

// Suministros de proveedores · diseño Grupo Gerez (3 tarjetas) conectado a MariaDB en modo consulta.
// Fuente: GET /api/v1/catalogs/supplier-offerings (+ /catalogs/suppliers/{id} para condiciones habituales y calificación).
// Catálogo SIN precios (como en el sistema original). Alta y edición bloqueadas: no hay endpoint de escritura.
const DASH = '—';
const PAGE = 25;
const show = v => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));
const field = 'w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-800 disabled:opacity-100';

async function allOfferings(supplier, signal) {
  let page = 1, items = [], total = 0;
  do {
    const r = await listSupplierOfferings({ page, pageSize: 50, supplier }, signal);
    total = Number(r.total) || 0; items = items.concat(r.items || []); page += 1;
  } while (items.length < total && page <= 100 && !signal?.aborted);
  return items;
}

export function SupplierSupplyCatalog({ lang = 'es', language, isEnglish }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const LOCK = tx('Modo consulta MariaDB: el alta y la edición de suministros se habilitarán cuando exista el endpoint de escritura con autorización, CSRF, idempotencia y auditoría.', 'MariaDB read mode: creating and editing supplies will be enabled once a write endpoint with authorization, CSRF, idempotency and audit exists.');
  const cards = [
    { id: 'register', emoji: '📝', title: tx('Registro de suministro', 'Supply registration'), desc: tx('Consulta lo que el proveedor puede suministrar y sus condiciones.', 'View what the supplier can provide and its terms.') },
    { id: 'matrix', emoji: '📋', title: tx('Matriz de suministros', 'Supplies matrix'), desc: tx('Consulta productos, servicios, entrega y crédito.', 'View products, services, delivery and credit.') },
    { id: 'commercial', emoji: '📊', title: tx('Resumen comercial', 'Commercial summary'), desc: tx('Visualiza las condiciones generales de cada proveedor.', 'See each supplier\'s general terms.') },
  ];
  const [tab, setTab] = useState('matrix');
  const [revision, setRevision] = useState(0);

  // ---------- Matriz (paginada en el servidor) ----------
  const [supplier, setSupplier] = useState('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ status: 'loading', error: null, data: null });
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = new AbortController();
    setList(x => ({ ...x, status: 'loading', error: null }));
    listSupplierOfferings({ page, pageSize: PAGE, q, status, supplier }, c.signal)
      .then(d => { if (!c.signal.aborted) setList({ status: 'ready', error: null, data: d }); })
      .catch(e => { if (!c.signal.aborted) setList(x => ({ ...x, status: 'error', error: e })); });
    return () => c.abort();
  }, [page, q, status, supplier, revision]);
  const d = list.data;
  const sc = useMemo(() => supplierCards(d?.summary), [d?.summary]);
  const lastPage = Math.max(1, Math.ceil((d?.total || 0) / PAGE));
  const pick = id => { setSupplier(id); setPage(1); };

  // ---------- Registro (ficha) y Resumen comercial: suministros completos de un proveedor ----------
  const [selSupplier, setSelSupplier] = useState('');
  const [selOffering, setSelOffering] = useState('');
  const [sup, setSup] = useState({ status: 'idle', error: null, offerings: [], record: null });
  useEffect(() => {
    if (!selSupplier) { setSup({ status: 'idle', error: null, offerings: [], record: null }); return undefined; }
    const c = new AbortController();
    setSup({ status: 'loading', error: null, offerings: [], record: null });
    Promise.all([allOfferings(selSupplier, c.signal), getCatalogRecord('suppliers', selSupplier, c.signal).then(r => r.item).catch(() => null)])
      .then(([offerings, record]) => { if (!c.signal.aborted) setSup({ status: 'ready', error: null, offerings, record }); })
      .catch(e => { if (!c.signal.aborted) setSup({ status: 'error', error: e, offerings: [], record: null }); });
    return () => c.abort();
  }, [selSupplier, revision]);
  const o = sup.offerings.find(x => x.id === selOffering) || null;
  const comm = useMemo(() => supplierCommercial(sup.offerings, sup.record), [sup.offerings, sup.record]);
  const supplierName = id => sc.items.find(s => s.id === id)?.name || sup.record?.name || '';
  const openRecord = row => { setSelSupplier(row.supplier_id); setSelOffering(row.id); setTab('register'); };

  const Err = ({ e }) => (e ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{e.status === 401 ? tx('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.') : e.message}</p> : null);
  const supplierSelect = label => <select aria-label={label} value={selSupplier} onChange={e => { setSelSupplier(e.target.value); setSelOffering(''); }} className="w-full md:w-80 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs">
    <option value="">{tx('Seleccionar proveedor...', 'Select supplier...')}</option>{sc.items.map(s => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}</select>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{tx('Suministro de Proveedores', 'Supplier Supplies')}</h2><p className="text-xs text-slate-500">{tx('Productos, servicios y condiciones que cada proveedor puede suministrar.', 'Products, services and terms each supplier can provide.')}</p></div>
      <div className="flex items-center gap-2"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span>
        <button type="button" onClick={() => setRevision(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button></div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(c => { const active = tab === c.id; return <button key={c.id} type="button" aria-pressed={active} onClick={() => setTab(c.id)} className={`text-left p-5 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-36 border ${active ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-1' : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors ${active ? 'bg-white/20 backdrop-blur-md' : 'bg-blue-50/80 border border-blue-100/50'}`}><span>{c.emoji}</span></div>
        <div><h3 className={`text-sm font-bold tracking-tight ${active ? 'text-white' : 'text-slate-800'}`}>{c.title}</h3><p className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${active ? 'text-blue-100' : 'text-slate-400'}`}>{c.desc}</p></div>
      </button>; })}
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[400px]">
      {/* TARJETA 1: Registro (ficha en modo consulta) */}
      {tab === 'register' && <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100"><div><h3 className="text-lg font-black text-slate-900">{tx('Producto, servicio o suministro del proveedor', 'Supplier product, service or supply')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Consulta exactamente qué puede proveer y bajo qué condiciones comerciales.', 'See exactly what it can provide and under which commercial terms.')}</p></div><span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100 shrink-0">{tx('Catálogo de suministro', 'Supply catalog')}</span></div>
        <div className="p-3 bg-blue-50/60 border-l-4 border-blue-600 rounded-r-xl text-[11px] text-slate-700"><strong className="text-slate-900">{tx('Precios únicamente mediante cotización:', 'Prices only through quotations:')}</strong> {tx('en este catálogo no se capturan precios. El precio unitario, subtotal, impuestos y total se registran cuando se recibe la cotización formal del proveedor en Cotizaciones y Comparativo.', 'no prices are captured here. Unit price, subtotal, taxes and total are recorded when the supplier\'s formal quote is received in Quotes & Comparison.')}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Proveedor', 'Supplier')} *</span>{supplierSelect(tx('Proveedor', 'Supplier'))}</label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Producto, servicio o suministro', 'Product, service or supply')} *</span>
            <select aria-label={tx('Producto, servicio o suministro', 'Product, service or supply')} value={selOffering} onChange={e => setSelOffering(e.target.value)} disabled={sup.status !== 'ready'} className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">{sup.status === 'loading' ? tx('Cargando…', 'Loading…') : selSupplier ? tx(`Selecciona uno de ${sup.offerings.length} suministro(s)`, `Select one of ${sup.offerings.length} supply item(s)`) : tx('Primero selecciona un proveedor', 'Select a supplier first')}</option>{sup.offerings.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        </div>
        <Err e={sup.error} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[[tx('Tipo', 'Type'), o ? typeLabel(o.type, en) : ''], [tx('Categoría', 'Category'), o?.category], [tx('Marca', 'Brand'), o?.brand], [tx('Modelo / referencia', 'Model / reference'), o?.model], [tx('Tiempo de entrega', 'Delivery time'), o ? leadTime(o) : ''], [tx('Tipo de crédito', 'Credit type'), o ? credit(o, en) : ''],
            [tx('Moneda', 'Currency'), o?.currency], [tx('Pedido mínimo', 'Minimum order'), o?.minimum_order], [tx('Vigencia de condiciones', 'Terms valid until'), o?.valid_until ? String(o.valid_until).slice(0, 10) : ''], [tx('Cobertura / lugar de entrega', 'Coverage / delivery place'), o?.coverage], [tx('Estatus', 'Status'), o ? statusLabel(o.status, en) : '']].map(([label, value]) =>
            <label key={label} className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{label}</span><input readOnly aria-label={label} value={value || ''} placeholder={DASH} className={field} /></label>)}
        </div>
        <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Descripción / alcance / especificación', 'Description / scope / specification')}</span><textarea readOnly rows={2} aria-label={tx('Descripción', 'Description')} value={o?.description || ''} placeholder={DASH} className={field} /></label>
        <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Observaciones comerciales', 'Commercial notes')}</span><textarea readOnly rows={2} aria-label={tx('Observaciones comerciales', 'Commercial notes')} value={o?.notes || ''} placeholder={DASH} className={field} /></label>
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <button type="button" disabled title={LOCK} className="px-5 py-2.5 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl flex items-center gap-2 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{tx('Guardar suministro', 'Save supply')}</button>
          <button type="button" onClick={() => { setSelSupplier(''); setSelOffering(''); }} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-2">🧹 {tx('Limpiar', 'Clear')}</button>
          <button type="button" onClick={() => setTab('matrix')} className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-2">📋 {tx('Ver matriz', 'View matrix')}</button>
        </div>
      </div>}

      {/* TARJETA 2: Matriz */}
      {tab === 'matrix' && <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
          <div><h3 className="text-lg font-black text-slate-900">{tx('Matriz de productos, servicios y condiciones', 'Products, services and terms matrix')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Consulta qué suministra cada proveedor y las condiciones ofrecidas.', 'See what each supplier provides and the offered terms.')}</p></div>
          <button type="button" disabled title={LOCK} className="px-4 py-2 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Plus className="w-3.5 h-3.5" />{tx('Nuevo suministro', 'New supply')}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
          <div className="md:col-span-3"><select aria-label={tx('Proveedor', 'Supplier')} value={supplier} onChange={e => pick(e.target.value)} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-purple-500 outline-none shadow-xs"><option value="all">{tx('Todos los proveedores', 'All suppliers')}</option>{sc.items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="md:col-span-6 relative"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar suministros', 'Search supplies')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={tx('Buscar producto, servicio, categoría, marca o modelo...', 'Search product, service, category, brand or model...')} className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 shadow-xs" /></div>
          <div className="md:col-span-3"><select aria-label={tx('Estatus', 'Status')} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-xs font-semibold"><option value="all">{tx('Todos los estatus', 'All statuses')}</option>{(d?.summary?.statuses || []).map(s => <option key={s.code} value={s.code}>{statusLabel(s.code, en)} ({s.count})</option>)}</select></div>
        </div>
        <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center gap-3"><div><h4 className="text-xs font-black text-slate-800">{tx('Tarjetas por proveedor', 'Cards by supplier')}</h4><p className="text-[10px] text-slate-400 font-medium">{tx('Selecciona un proveedor para abrir únicamente sus productos, servicios y condiciones.', 'Select a supplier to open only its products, services and terms.')}</p></div><span className="text-[10px] font-extrabold text-slate-500 whitespace-nowrap">{sc.all.total} {tx('registro(s) cargado(s)', 'record(s) loaded')}</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[{ ...sc.all, name: tx('Vista general', 'General view'), code: tx(`${sc.all.suppliers} proveedores`, `${sc.all.suppliers} suppliers`) }, ...sc.items].map(c => { const on = supplier === c.id; return <button key={c.id} type="button" aria-pressed={on} onClick={() => pick(c.id)} className={`text-left p-3 rounded-xl border bg-white transition-all ${on ? 'border-purple-500 ring-2 ring-purple-500/10 shadow-sm' : 'border-slate-200 hover:border-purple-300'}`}>
              <div className="text-[11px] font-extrabold text-slate-800 truncate" title={c.name}>{c.name}</div><div className="text-[10px] text-slate-400 truncate">{c.code}</div>
              <div className="grid grid-cols-3 gap-1 mt-2 text-center">{[[c.total, tx('Registros', 'Records')], [c.active, tx('Activos', 'Active')], [c.others, tx('Otros', 'Others')]].map(([n, l]) => <div key={l}><span className="block text-sm font-black text-slate-800 tabular-nums">{n}</span><span className="block text-[9px] text-slate-400">{l}</span></div>)}</div>
              <div className="text-[10px] font-bold text-purple-600 text-right mt-1">{c.id === 'all' ? tx('Abrir todos', 'Open all') : tx('Abrir', 'Open')} ›</div>
            </button>; })}
          </div>
        </div>
        <Err e={list.error} />
        {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando suministros en MariaDB…', 'Loading supplies from MariaDB…')}</p>}
        <div className="flex items-center justify-between text-[11px] text-slate-500"><span>{d?.total ?? 0} {tx('registros mostrados', 'records shown')}</span><span>{tx('Página', 'Page')} {page} / {lastPage}</span></div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80"><table className="w-full text-left border-collapse min-w-[900px]">
          <thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">{[tx('Proveedor', 'Supplier'), tx('Producto / servicio', 'Product / service'), tx('Tipo', 'Type'), tx('Categoría', 'Category'), tx('Marca', 'Brand'), tx('Tiempo de entrega', 'Delivery time'), tx('Tipo de crédito', 'Credit type'), tx('Estatus', 'Status')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}<th className="py-3 px-3 text-center">{tx('Ficha', 'Record')}</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {(d?.items || []).map(r => <tr key={r.id} className="hover:bg-slate-50/70 align-top">
              <td className="py-3 px-3"><div className="font-bold text-slate-900">{r.supplier_name}</div><div className="text-[10px] text-slate-400">{r.supplier_code}</div></td>
              <td className="py-3 px-3 min-w-[180px]"><div className="font-semibold text-slate-800">{r.name}</div>{r.model && <div className="text-[10px] text-slate-400">{r.model}</div>}</td>
              <td className="py-3 px-3">{typeLabel(r.type, en)}</td><td className="py-3 px-3">{show(r.category)}</td><td className="py-3 px-3">{show(r.brand)}</td>
              <td className="py-3 px-3 whitespace-nowrap">{show(leadTime(r))}</td><td className="py-3 px-3 whitespace-nowrap">{show(credit(r, en))}</td>
              <td className="py-3 px-3"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${STATUS_TONE[statusKey(r.status)]}`}>{statusLabel(r.status, en)}</span></td>
              <td className="py-3 px-3 text-center"><button type="button" onClick={() => openRecord(r)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md">{tx('Ver', 'View')}</button></td>
            </tr>)}
            {list.status === 'ready' && !d?.items?.length && <tr><td colSpan={9} className="py-12 text-center text-xs text-slate-400 font-semibold">{tx('Sin registros de suministros disponibles.', 'No supply records available.')}</td></tr>}
          </tbody></table></div>
        <div className="flex justify-end gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => Math.max(1, n - 1))} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= lastPage} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{tx('Catálogo sin precios: el precio se registra únicamente con la cotización formal del proveedor.', 'Catalog without prices: the price is recorded only with the supplier\'s formal quote.')}</p>
      </div>}

      {/* TARJETA 3: Resumen comercial */}
      {tab === 'commercial' && <div className="space-y-5" data-testid="commercial-summary">
        <div className="pb-2 border-b border-slate-100"><h3 className="text-lg font-black text-slate-900">{tx('Resumen comercial del proveedor', 'Supplier commercial summary')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Concentra sus productos, tiempos de entrega y condiciones de crédito.', 'Brings together its products, delivery times and credit terms.')}</p></div>
        {supplierSelect(tx('Proveedor del resumen', 'Summary supplier'))}
        <Err e={sup.error} />
        {!selSupplier ? <div className="p-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/40 text-center text-slate-500 text-xs font-medium">{tx('Selecciona un proveedor para consultar su resumen comercial.', 'Select a supplier to view its commercial summary.')}</div>
          : sup.status === 'loading' ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando…', 'Loading…')}</p>
          : <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[[comm.registered, tx('Suministros registrados', 'Registered supplies'), tx(`${comm.active} activos`, `${comm.active} active`), 'border-t-purple-600', 'text-purple-600'],
                [comm.categories.length, tx('Categorías', 'Categories'), comm.generalCategory || DASH, 'border-t-blue-600', 'text-blue-600'],
                [comm.avgDays ?? DASH, tx('Entrega promedio', 'Average delivery'), comm.avgDays === null ? tx('Sin tiempos en días', 'No day-based times') : tx(`Días · ${comm.dayBased} de ${comm.timed} con tiempo en días`, `Days · ${comm.dayBased} of ${comm.timed} in days`), 'border-t-orange-500', 'text-orange-600'],
                [comm.creditDays ?? DASH, tx('Días de crédito habitual', 'Usual credit days'), sup.record?.credit_type || DASH, 'border-t-emerald-600', 'text-emerald-600'],
                [comm.rating ?? DASH, tx('Calificación', 'Rating'), comm.ratingScale ? tx(`de ${comm.ratingScale} puntos`, `out of ${comm.ratingScale}`) : tx('Sin escala registrada', 'No scale recorded'), 'border-t-teal-500', 'text-teal-600']].map(([v, l, sub, cls, color]) =>
                <div key={l} className={`bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 ${cls} shadow-2xs space-y-1`}><span className="text-2xl font-black text-slate-900 block leading-none tabular-nums">{v}</span><span className="text-[11px] text-slate-400 font-medium block">{l}</span><span className={`text-[11px] font-bold block ${color}`}>{sub}</span></div>)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="bg-blue-50/50 p-5 rounded-xl border-l-4 border-l-blue-600 border border-blue-100/60 space-y-1.5 text-xs"><h4 className="font-extrabold text-slate-900 mb-2">{supplierName(selSupplier)}</h4>
                {[[tx('Categoría general:', 'General category:'), comm.generalCategory], [tx('Moneda habitual:', 'Usual currency:'), comm.habitualCurrency], [tx('Entrega habitual:', 'Usual delivery:'), comm.habitualLead], [tx('Crédito habitual:', 'Usual credit:'), comm.habitualCredit]].map(([l, v]) => <p key={l} className="text-slate-600 font-medium">{l} <span className="text-slate-700">{show(v)}</span></p>)}</div>
              <div className="bg-emerald-50/40 p-5 rounded-xl border-l-4 border-l-emerald-600 border border-emerald-100/60 space-y-1.5 text-xs"><h4 className="font-extrabold text-slate-900 mb-2">{tx('Condiciones registradas por suministro', 'Terms registered per supply')}</h4>
                {[[tx('Tipos de crédito:', 'Credit types:'), comm.creditTypes.join(' / ')], [tx('Cobertura:', 'Coverage:'), comm.coverages.join(' / ')], [tx('Monedas:', 'Currencies:'), comm.currencies.join(' / ')], [tx('Productos y servicios activos:', 'Active products and services:'), comm.activeItems.length ? `${comm.activeItems.length} · ${comm.activeItems.slice(0, 6).join(', ')}${comm.activeItems.length > 6 ? '…' : ''}` : '0']].map(([l, v]) => <p key={l} className="text-slate-600 font-medium">{l} <span className="text-slate-700">{show(v)}</span></p>)}</div>
            </div>
          </div>}
      </div>}
    </div>
  </div>;
}
