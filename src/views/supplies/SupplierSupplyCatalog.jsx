import React, { useEffect, useMemo, useState } from 'react';
import { Lock, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, Plus, CheckCircle2 } from 'lucide-react';
import { listSupplierOfferings, getCatalogRecord, listCatalog, getSupplierOffering } from '../../catalogApi';
import { typeLabel, statusKey, statusLabel, STATUS_TONE, leadTime, credit, supplierCommercial, supplierCards, avatarText } from './model.mjs';
import { emptyForm, formFromRecord, validateForm, toPayload, payloadSignature, missingRequired, serverField, saveErrorMessage, TYPES, OTHER_TYPE, CATEGORIES as OFF_CATEGORIES, LEAD_UNITS, CREDIT_TYPES, CURRENCIES as OFF_CURRENCIES, STATUSES as OFF_STATUSES } from './form.mjs';
import { useCatalogAutosave } from '../catalog/useCatalogAutosave';

// Suministros de proveedores · diseño Grupo Gerez (3 tarjetas) conectado a MariaDB en modo consulta.
// Fuente: GET /api/v1/catalogs/supplier-offerings (+ /catalogs/suppliers/{id} para condiciones habituales y calificación).
// Catálogo SIN precios (como en el sistema original). Alta y edición reales con guardado automático
// (POST/PUT /api/v1/catalogs/supplier-offerings); la matriz se refresca tras cada guardado.
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

export function SupplierSupplyCatalog({ lang = 'es', language, isEnglish, onNotify }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const notify = (title, message, type = 'info') => { if (typeof onNotify === 'function') onNotify(title, message, type); };
  const LOCK = tx('El alta y la edición de suministros se guardan en MariaDB automáticamente, con autorización, CSRF, idempotencia, control de versión y bitácora. Este catálogo no lleva precios: se registran solo con la cotización formal.', 'Creating and editing supplies is saved to MariaDB automatically, with authorization, CSRF, idempotency, version control and audit. This catalog has no prices: they are recorded only with the formal quotation.');
  const cards = [
    { id: 'register', emoji: '📝', title: tx('Registro de suministro', 'Supply registration'), desc: tx('Registra qué puede suministrar el proveedor y sus condiciones.', 'Record what the supplier can provide and its terms.') },
    { id: 'matrix', emoji: '📋', title: tx('Matriz de suministros', 'Supplies matrix'), desc: tx('Consulta productos, servicios, entrega y crédito.', 'View products, services, delivery and credit.') },
    { id: 'commercial', emoji: '📊', title: tx('Resumen comercial', 'Commercial summary'), desc: tx('Visualiza las condiciones generales de cada proveedor.', 'See each supplier\'s general terms.') },
  ];
  const [tab, setTab] = useState('matrix');
  const [revision, setRevision] = useState(0);
  const [listRev, setListRev] = useState(0); // refresca matriz y resumen tras cada guardado (no la ficha)

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
  }, [page, q, status, supplier, revision, listRev]);
  const d = list.data;
  const sc = useMemo(() => supplierCards(d?.summary), [d?.summary]);
  const lastPage = Math.max(1, Math.ceil((d?.total || 0) / PAGE));
  const [open, setOpen] = useState(false); // la tabla se abre desde una tarjeta, el selector, la búsqueda o los filtros (diseño)
  const pick = (id, show = true) => { setSupplier(id); setPage(1); if (show) setOpen(true); };
  const sameName = s => sc.items.filter(x => x.name === s.name).length > 1;

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
  }, [selSupplier, revision, listRev]);
  const comm = useMemo(() => supplierCommercial(sup.offerings, sup.record), [sup.offerings, sup.record]);
  const supplierName = id => sc.items.find(s => s.id === id)?.name || sup.record?.name || '';

  // ---------- Ficha editable con guardado automático (ver ../catalog/useCatalogAutosave.js) ----------
  // Proveedores completos (no solo los que ya tienen suministros) para dar de alta el primero de un proveedor.
  const [suppliersAll, setSuppliersAll] = useState({ loading: false, error: null, items: [] });
  useEffect(() => {
    if (tab !== 'register') return undefined;
    const c = new AbortController();
    setSuppliersAll(x => ({ ...x, loading: true, error: null }));
    (async () => {
      let p = 1, items = [], total = 0;
      do {
        const r = await listCatalog('suppliers', { page: p, pageSize: 50, q: '', status: 'all' }, c.signal);
        total = Number(r.total) || 0; items = items.concat(r.items || []); p += 1;
      } while (items.length < total && p <= 80 && !c.signal.aborted);
      return items.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    })().then(items => { if (!c.signal.aborted) setSuppliersAll({ loading: false, error: null, items }); })
      .catch(e => { if (!c.signal.aborted) setSuppliersAll(x => ({ ...x, loading: false, error: e })); });
    return () => c.abort();
  }, [tab, revision]);
  const [selectedId, setSelectedId] = useState('');
  const [ficha, setFicha] = useState({ loading: false, error: null, item: null });
  useEffect(() => {
    if (!selectedId) { setFicha({ loading: false, error: null, item: null }); return undefined; }
    const c = new AbortController();
    setFicha(x => ({ ...x, loading: true, error: null }));
    getSupplierOffering(selectedId, c.signal).then(r => { if (!c.signal.aborted) setFicha({ loading: false, error: null, item: r.item || null }); })
      .catch(e => { if (!c.signal.aborted) setFicha({ loading: false, error: e, item: null }); });
    return () => c.abort();
  }, [selectedId, revision]);
  const af = useCatalogAutosave({ kind: 'supplier-offerings', ficha, setSelectedId, onSaved: () => setListRev(n => n + 1), notify, tx, en,
    model: { emptyForm, formFromRecord, validateForm, toPayload, payloadSignature, missingRequired, serverField, saveErrorMessage },
    text: {
      created: name => tx(`Suministro "${name}" registrado en MariaDB y agregado a la matriz.`, `Supply "${name}" saved in MariaDB and added to the matrix.`),
      updated: (name, v) => tx(`Cambios de "${name}" guardados en la matriz.`, `Changes to "${name}" saved to the matrix.`),
      noChanges: name => tx(`Sin cambios pendientes: "${name}" ya está guardado en la matriz.`, `No pending changes: "${name}" is already saved in the matrix.`),
      notifyTitle: tx('Suministros', 'Supplies'), entity: tx('suministro', 'supply'),
      idle: tx('El guardado automático inicia al seleccionar el proveedor y capturar el producto, servicio o suministro.', 'Autosave starts once the supplier and the product, service or supply are filled in.'),
    } });
  const { form, saving, saveMsg, setSaveMsg, auto, lastSaved, set, save, flush, newRecord, clearForm, pickRecord, autoText, inp, err } = af;
  const goTab = async id => { if (tab === 'register' && id !== 'register' && (await flush()) === 'failed') return; setTab(id); };
  const goMatrix = async () => { if ((await flush()) !== 'failed') setTab('matrix'); };
  const openRecord = async row => { await pickRecord(row.id); setTab('register'); };
  // Suministros ya registrados del proveedor elegido (para cargar uno y editarlo).
  const [supplierOfferings, setSupplierOfferings] = useState([]);
  useEffect(() => {
    if (tab !== 'register' || !form.supplier_id) { setSupplierOfferings([]); return undefined; }
    const c = new AbortController();
    allOfferings(form.supplier_id, c.signal).then(items => { if (!c.signal.aborted) setSupplierOfferings(items); }).catch(() => { if (!c.signal.aborted) setSupplierOfferings([]); });
    return () => c.abort();
  }, [tab, form.supplier_id, listRev, revision]);
  const categoryOptions = useMemo(() => [...new Set([...OFF_CATEGORIES, ...(form.category ? [form.category] : [])])].sort((a, b) => (a === 'Otros') - (b === 'Otros') || a.localeCompare(b, 'es')), [form.category]);

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
      {cards.map(c => { const active = tab === c.id; return <button key={c.id} type="button" aria-pressed={active} onClick={() => goTab(c.id)} className={`text-left p-5 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-36 border ${active ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-1' : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors ${active ? 'bg-white/20 backdrop-blur-md' : 'bg-blue-50/80 border border-blue-100/50'}`}><span>{c.emoji}</span></div>
        <div><h3 className={`text-sm font-bold tracking-tight ${active ? 'text-white' : 'text-slate-800'}`}>{c.title}</h3><p className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${active ? 'text-blue-100' : 'text-slate-400'}`}>{c.desc}</p></div>
      </button>; })}
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[400px]">
      {/* TARJETA 1: Registro (alta/edición real con guardado automático; catálogo sin precios) */}
      {tab === 'register' && <div className="space-y-5" data-testid="offering-form">
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
          <div><h3 className="text-lg font-black text-slate-900">{tx('Producto, servicio o suministro del proveedor', 'Supplier product, service or supply')}</h3>
            <p className="text-xs text-blue-700/80 mt-0.5">{tx('Registra exactamente qué puede proveer y bajo qué condiciones comerciales.', 'Record exactly what the supplier can provide and under which commercial terms.')}</p>
            <span data-testid="autosave-status" aria-live="polite" className={`mt-1 text-[10px] font-semibold flex items-center gap-1 ${auto.state === 'saved' ? 'text-emerald-700' : auto.state === 'error' || auto.state === 'paused' ? 'text-rose-600' : auto.state === 'saving' || auto.state === 'pending' ? 'text-blue-700' : 'text-slate-500'}`}>{auto.state === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}{autoText}</span></div>
          <div className="flex flex-col items-end gap-1"><span className="px-3 py-1 bg-purple-50 text-purple-700 font-bold text-[10px] rounded-full border border-purple-100 whitespace-nowrap">{tx('Catálogo de suministro', 'Supply catalog')}</span>
            <span data-testid="form-mode" className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{form.id ? `${tx('Editando', 'Editing')} · ${form.name}` : tx('Nuevo registro', 'New record')}</span></div>
        </div>
        <div className="p-4 bg-emerald-50/50 border border-emerald-200/70 rounded-xl text-[11px] text-slate-700"><strong className="block text-slate-900">{tx('Precios únicamente mediante cotización:', 'Prices only through quotations:')}</strong>{tx('En este catálogo no se capturan precios. El precio unitario, subtotal, impuestos y total se registran cuando se recibe la cotización formal del proveedor en Cotizaciones y Comparativo.', 'No prices are captured in this catalog. Unit price, subtotal, taxes and total are recorded when the supplier\'s formal quotation is received in Quotes and Comparison.')}</div>
        {ficha.loading && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Consultando suministro en MariaDB…', 'Loading supply from MariaDB…')}</p>}
        <Err e={ficha.error} /><Err e={suppliersAll.error} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Proveedor', 'Supplier')} <span className="text-rose-500">*</span></span>
            <select aria-label={tx('Proveedor', 'Supplier')} value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} className={inp('supplier_id')}>
              <option value="">{suppliersAll.loading ? tx('Cargando proveedores…', 'Loading suppliers…') : tx('Seleccionar proveedor...', 'Select supplier...')}</option>
              {form.supplier_id && !suppliersAll.items.some(s => s.id === form.supplier_id) && <option value={form.supplier_id}>{ficha.item?.supplier_name || form.supplier_id}</option>}
              {suppliersAll.items.map(s => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}</select>{err('supplier_id')}</label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Producto, servicio o suministro', 'Product, service or supply')} <span className="text-rose-500">*</span></span>
            <input type="text" aria-label={tx('Producto, servicio o suministro', 'Product, service or supply')} value={form.name} maxLength={500} onChange={e => set('name', e.target.value)} placeholder={tx('Ej. Contenedor offshore de 10 pies, transporte local, EPP...', 'e.g. 10 ft offshore container, local transport, PPE...')} className={inp('name')} />{err('name')}
            {form.supplier_id && supplierOfferings.length > 0 && <select aria-label={tx('Cargar suministro registrado', 'Load recorded supply')} value={form.id && supplierOfferings.some(x => x.id === form.id) ? form.id : ''} onChange={e => { if (e.target.value) pickRecord(e.target.value); }} className="mt-1.5 w-full px-3 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
              <option value="">{tx(`Editar uno de los ${supplierOfferings.length} suministros registrados de este proveedor…`, `Edit one of this supplier's ${supplierOfferings.length} recorded supplies…`)}</option>{supplierOfferings.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Tipo', 'Type')}</span>
            <select aria-label={tx('Tipo', 'Type')} value={form.type} onChange={e => set('type', e.target.value)} className={inp('type')}>
              {form.legacy.type && <option value={form.legacy.type}>{tx('Valor histórico', 'Historical value')}: {form.legacy.type}</option>}{TYPES.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}<option value={OTHER_TYPE}>{tx('Otro/agregar nuevo tipo', 'Other/add new type')}</option></select>
            {form.type === OTHER_TYPE && <input type="text" aria-label={tx('Nuevo tipo', 'New type')} value={form.type_other} maxLength={64} onChange={e => set('type_other', e.target.value)} placeholder={tx('Escribe el nuevo tipo', 'Type the new type')} className={`${inp('type_other')} mt-1.5`} />}{err('type_other')}</label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Categoría', 'Category')}</span>
            <select aria-label={tx('Categoría', 'Category')} value={form.category} onChange={e => set('category', e.target.value)} className={inp('category')}>
              <option value="">{tx('Seleccionar categoría...', 'Select category...')}</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Marca', 'Brand')}</span><input type="text" aria-label={tx('Marca', 'Brand')} value={form.brand} maxLength={255} onChange={e => set('brand', e.target.value)} className={inp('brand')} /></label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Modelo / referencia', 'Model / reference')}</span><input type="text" aria-label={tx('Modelo / referencia', 'Model / reference')} value={form.model} maxLength={255} onChange={e => set('model', e.target.value)} className={inp('model')} /></label>
        </div>
        <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Descripción / alcance / especificación', 'Description / scope / specification')}</span><textarea rows={3} aria-label={tx('Descripción / alcance / especificación', 'Description / scope / specification')} value={form.description} maxLength={4000} onChange={e => set('description', e.target.value)} className={`${inp('description')} resize-y`} /></label>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Tiempo de entrega', 'Delivery time')}</span><input type="number" min="0" max="9999" step="0.5" aria-label={tx('Tiempo de entrega', 'Delivery time')} value={form.lead_time_value} onChange={e => set('lead_time_value', e.target.value)} className={inp('lead_time_value')} />{err('lead_time_value')}</label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Unidad del tiempo', 'Time unit')}</span><select aria-label={tx('Unidad del tiempo', 'Time unit')} value={form.lead_time_unit} onChange={e => set('lead_time_unit', e.target.value)} className={inp('lead_time_unit')}>
            {!form.lead_time_unit && <option value="">{tx('Sin unidad registrada', 'No unit recorded')}</option>}{form.legacy.lead_time_unit && <option value={form.legacy.lead_time_unit}>{tx('Valor histórico', 'Historical value')}: {form.legacy.lead_time_unit}</option>}{LEAD_UNITS.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select></label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Tipo de crédito', 'Credit type')}</span><select aria-label={tx('Tipo de crédito', 'Credit type')} value={form.credit_type} onChange={e => set('credit_type', e.target.value)} className={inp('credit_type')}>
            {!form.credit_type && <option value="">{tx('Sin tipo registrado', 'No type recorded')}</option>}{form.legacy.credit_type && <option value={form.legacy.credit_type}>{tx('Valor histórico', 'Historical value')}: {form.legacy.credit_type}</option>}{CREDIT_TYPES.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select></label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Días de crédito', 'Credit days')}</span><input type="number" min="0" max="3650" step="1" aria-label={tx('Días de crédito', 'Credit days')} value={form.credit_days} onChange={e => set('credit_days', e.target.value)} className={inp('credit_days')} />{err('credit_days')}</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Moneda', 'Currency')}</span><select aria-label={tx('Moneda', 'Currency')} value={form.currency} onChange={e => set('currency', e.target.value)} className={inp('currency')}>
            {!form.currency && <option value="">{tx('Sin moneda registrada', 'No currency recorded')}</option>}{OFF_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Pedido mínimo', 'Minimum order')}</span><input type="text" aria-label={tx('Pedido mínimo', 'Minimum order')} value={form.minimum_order} maxLength={255} onChange={e => set('minimum_order', e.target.value)} placeholder={tx('Ej. 10 piezas, 1 lote, $5,000', 'e.g. 10 pieces, 1 lot, $5,000')} className={inp('minimum_order')} /></label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Vigencia de condiciones', 'Terms valid until')}</span><input type="date" aria-label={tx('Vigencia de condiciones', 'Terms valid until')} value={form.valid_until} onChange={e => set('valid_until', e.target.value)} className={inp('valid_until')} />{err('valid_until')}</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block md:col-span-2"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Cobertura / lugar de entrega', 'Coverage / delivery place')}</span><input type="text" aria-label={tx('Cobertura / lugar de entrega', 'Coverage / delivery place')} value={form.coverage} maxLength={2000} onChange={e => set('coverage', e.target.value)} className={inp('coverage')} /></label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Estatus', 'Status')}</span><select aria-label={tx('Estatus', 'Status')} value={form.status} onChange={e => set('status', e.target.value)} className={inp('status')}>
            {form.legacy.status && <option value={form.legacy.status}>{tx('Valor histórico', 'Historical value')}: {form.legacy.status}</option>}{OFF_STATUSES.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select></label>
        </div>
        <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Observaciones comerciales', 'Commercial notes')}</span><textarea rows={3} aria-label={tx('Observaciones comerciales', 'Commercial notes')} value={form.notes} maxLength={4000} onChange={e => set('notes', e.target.value)} className={`${inp('notes')} resize-y`} /></label>
        {saveMsg && <div role={saveMsg.kind === 'ok' ? 'status' : 'alert'} data-testid="save-message" className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${saveMsg.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : saveMsg.kind === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{saveMsg.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{saveMsg.text}</span>{saveMsg.reload && <button type="button" onClick={() => { setSaveMsg(null); setRevision(n => n + 1); }} className="ml-auto px-3 py-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-[11px] rounded-lg whitespace-nowrap">{tx('Recargar ficha', 'Reload record')}</button>}</div>}
        <div data-testid="form-actions" className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <button type="button" onClick={save} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 active:scale-95 disabled:opacity-50 text-white rounded-xl shadow-md shadow-purple-500/20 flex items-center gap-2">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span aria-hidden="true">💾</span>}<span className="text-sm font-bold">{tx('Guardar suministro', 'Save supply')}</span></button>
          <button type="button" onClick={clearForm} disabled={saving} className="px-5 py-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 rounded-xl border border-slate-200 flex items-center gap-2"><span aria-hidden="true">🪄</span><span className="text-sm font-bold">{tx('Limpiar', 'Clear')}</span></button>
          <button type="button" onClick={goMatrix} disabled={saving} className="px-5 py-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2"><span aria-hidden="true">📋</span><span className="text-sm font-bold">{tx('Ver matriz', 'View matrix')}</span></button>
        </div>
      </div>}

      {/* TARJETA 2: Matriz (tarjetas por proveedor; la tabla se abre desde una tarjeta, la búsqueda o los filtros) */}
      {tab === 'matrix' && <div className="space-y-4" data-testid="offerings-matrix">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
          <div><h3 className="text-lg font-black text-slate-900">{tx('Matriz de productos, servicios y condiciones', 'Products, services and terms matrix')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Consulta qué suministra cada proveedor y las condiciones ofrecidas.', 'See what each supplier provides and the offered terms.')}</p></div>
          <button type="button" onClick={async () => { if ((await flush()) === 'failed') return; newRecord(); af.setForm(x => ({ ...x, supplier_id: supplier !== 'all' ? supplier : '' })); setTab('register'); }} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 hover:opacity-95 active:scale-95 text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-500/25"><Plus className="w-4 h-4" /><span className="text-sm font-black">{tx('Nuevo suministro', 'New supply')}</span></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4"><select aria-label={tx('Proveedor', 'Supplier')} value={supplier} onChange={e => pick(e.target.value, e.target.value !== 'all')} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 font-black focus:ring-2 focus:ring-purple-500/30 outline-none shadow-xs"><option value="all">{tx('Todos los proveedores', 'All suppliers')}</option>{sc.items.map(s => <option key={s.id} value={s.id}>{s.name}{sameName(s) ? ` · ${s.code}` : ''}</option>)}</select></div>
          <div className="md:col-span-5"><input type="search" aria-label={tx('Buscar suministros', 'Search supplies')} value={input} onChange={e => { setInput(e.target.value); if (e.target.value.trim()) setOpen(true); }} maxLength={120} placeholder={tx('Buscar producto, servicio, categoría, marca o modelo...', 'Search product, service, category, brand or model...')} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 outline-none text-slate-700 shadow-xs" /></div>
          <div className="md:col-span-3"><select aria-label={tx('Estatus', 'Status')} value={status} onChange={e => { setStatus(e.target.value); setPage(1); if (e.target.value !== 'all') setOpen(true); }} className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-xs focus:ring-2 focus:ring-purple-500/30"><option value="all">{tx('Todos los estatus', 'All statuses')}</option>{OFF_STATUSES.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select></div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-purple-50/50 p-4 space-y-3" data-testid="supplier-cards">
          <div className="flex justify-between items-start gap-3"><div><h4 className="text-sm font-black text-slate-900">{tx('Tarjetas por proveedor', 'Cards by supplier')}</h4><p className="text-[10px] text-slate-500 font-medium">{tx('Selecciona un proveedor para abrir únicamente sus productos, servicios y condiciones.', 'Select a supplier to open only its products, services and terms.')}</p></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {[{ ...sc.all, name: tx('Todos los proveedores', 'All suppliers'), avatar: 'TOD' }, ...sc.items].map(c => { const on = open && supplier === c.id; const all = c.id === 'all'; return <button key={c.id} type="button" aria-pressed={on} onClick={() => pick(c.id, true)} className={`relative text-left bg-white rounded-2xl border p-3.5 pl-4 overflow-hidden flex flex-col gap-3 transition-all hover:shadow-md ${on ? 'border-purple-300 ring-2 ring-purple-500/25 shadow-md' : 'border-slate-200/80 shadow-xs'}`}>
              <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-purple-600 to-fuchsia-600" />
              <div className="flex items-center gap-3 min-w-0"><div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">{c.avatar || avatarText(c.name)}</div>
                <div className="min-w-0"><div className="text-xs font-black text-slate-900 truncate" title={c.name}>{c.name}</div><div className="text-[10px] text-slate-400 truncate">{all ? tx('Vista general', 'General view') : `${tx('Proveedor', 'Supplier')} · ${c.code}`}</div></div></div>
              <div className="grid grid-cols-3 gap-1.5">{[[c.total, tx('Registros', 'Records')], [c.active, tx('Activos', 'Active')], [c.others, tx('Otros', 'Others')]].map(([n, l]) => <div key={l} className="rounded-xl border border-slate-200/80 bg-white px-2 py-1.5"><span className="block text-sm font-black text-slate-900 tabular-nums leading-tight">{n}</span><span className="block text-[9px] font-bold text-slate-500">{l}</span></div>)}</div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-600"><span>{all ? tx('Abrir todos', 'Open all') : tx('Abrir proveedor', 'Open supplier')}</span><span className="text-indigo-600 text-sm leading-none">→</span></div>
            </button>; })}
          </div>
        </div>
        {lastSaved && <div data-testid="last-saved" className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900 flex flex-wrap items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{lastSaved.created ? tx('Alta guardada', 'Created') : tx('Cambios guardados', 'Changes saved')}: <strong>{lastSaved.name}</strong> · {lastSaved.at.toLocaleTimeString(en ? 'en-US' : 'es-MX')}</span>
          <button type="button" onClick={() => { setInput(lastSaved.name); setQ(lastSaved.name); setPage(1); setStatus('all'); setSupplier('all'); setOpen(true); }} className="ml-auto px-3 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg">{tx('Mostrar en la matriz', 'Show in matrix')}</button>
          <button type="button" onClick={() => openRecord({ id: lastSaved.id })} className="px-3 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg">{tx('Abrir ficha', 'Open record')}</button>
        </div>}
        <Err e={list.error} />
        {open && <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs p-4 space-y-3" data-testid="offerings-table">
          <div className="flex justify-between items-center gap-3 p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
            <div className="min-w-0"><h4 className="text-sm font-black text-slate-900 truncate">{supplier === 'all' ? tx('Todos los proveedores', 'All suppliers') : sc.items.find(s => s.id === supplier)?.name || tx('Proveedor', 'Supplier')}</h4>
              <p className="text-[10px] font-semibold text-slate-500">{list.status === 'loading' ? tx('Consultando suministros en MariaDB…', 'Loading supplies from MariaDB…') : `${d?.total ?? 0} ${tx('registros mostrados', 'records shown')}`}{lastPage > 1 ? ` · ${tx('Página', 'Page')} ${page} / ${lastPage}` : ''}</p></div>
            <button type="button" aria-label={tx('Cerrar matriz', 'Close matrix')} onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold flex items-center justify-center shadow-xs shrink-0">✕</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200/80"><table className="w-full text-left border-collapse min-w-[1000px]">
            <thead><tr className="bg-slate-50/80 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">{[tx('Proveedor', 'Supplier'), tx('Producto / servicio', 'Product / service'), tx('Tipo', 'Type'), tx('Categoría', 'Category'), tx('Marca', 'Brand'), tx('Tiempo de entrega', 'Delivery time'), tx('Tipo de crédito', 'Credit type'), tx('Estatus', 'Status')].map(h => <th key={h} className="py-3 px-3">{h}</th>)}<th className="py-3 px-3 text-center">{tx('Ficha', 'Record')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {(d?.items || []).map(r => <tr key={r.id} data-saved={lastSaved?.id === r.id ? 'true' : undefined} className={`align-top ${lastSaved?.id === r.id ? 'bg-emerald-50/70' : 'hover:bg-slate-50/70'}`}>
                <td className="py-3 px-3"><div className="font-bold text-slate-900">{r.supplier_name}</div><div className="text-[10px] text-slate-400">{r.supplier_code}</div></td>
                <td className="py-3 px-3 min-w-[180px]"><div className="font-semibold text-slate-800">{r.name}</div>{lastSaved?.id === r.id && <div className="text-[9px] font-bold text-emerald-700">✓ {tx('Recién guardado', 'Just saved')}</div>}{r.model && <div className="text-[10px] text-slate-400">{r.model}</div>}</td>
                <td className="py-3 px-3">{typeLabel(r.type, en)}</td><td className="py-3 px-3">{show(r.category)}</td><td className="py-3 px-3">{show(r.brand)}</td>
                <td className="py-3 px-3 whitespace-nowrap">{show(leadTime(r))}</td><td className="py-3 px-3 whitespace-nowrap">{show(credit(r, en))}</td>
                <td className="py-3 px-3"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${STATUS_TONE[statusKey(r.status)]}`}>{statusLabel(r.status, en)}</span></td>
                <td className="py-3 px-3 text-center"><button type="button" onClick={() => openRecord(r)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md">{tx('Ver', 'View')}</button></td>
              </tr>)}
              {list.status === 'ready' && !d?.items?.length && <tr><td colSpan={9} className="py-12 text-center text-xs text-slate-400 font-semibold">{tx('Sin registros de suministros disponibles.', 'No supply records available.')}</td></tr>}
            </tbody></table></div>
          {lastPage > 1 && <div className="flex justify-end gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => Math.max(1, n - 1))} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= lastPage} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div>}
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{tx('Catálogo sin precios: el precio se registra únicamente con la cotización formal del proveedor.', 'Catalog without prices: the price is recorded only with the supplier\'s formal quote.')}</p>
        </div>}
        <div data-testid="matrix-footer" className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200/80 bg-white text-[11px] text-slate-600">
          <span>{list.status === 'loading' && !d ? tx('Consultando…', 'Loading…') : <><strong className="text-slate-900">{d?.total ?? 0}</strong> {tx('suministros encontrados.', 'supplies found.')}</>}</span>
          <span className="flex items-center gap-1.5 font-bold text-emerald-700"><span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{tx('Matriz optimizada', 'Optimized matrix')}</span>
        </div>
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
