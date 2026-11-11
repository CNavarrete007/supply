import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Plus, Upload, Search, Download, Edit3, Trash2, Table as TableIcon, CheckCircle2, ChevronLeft, ChevronRight, Eye, RefreshCw, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { listCatalog, getCatalogRecord } from '../../catalogApi';
import { DetailPanel, translateStatus } from '../catalog/shared';
import { initials } from '../clients/model.mjs';
import { analyzeSupplierImport, SUPPLIER_TEMPLATE_HEADERS, supplierIndicators, leadTime, ratingText, CURRENCIES } from './model.mjs';

// Proveedores · diseño Grupo Gerez (4 tarjetas) conectado a MariaDB.
// Lectura real: /api/v1/catalogs/suppliers[/{id}]. Sin datos de demostración. Alta, edición, eliminación
// e importación con guardado no existen todavía en el backend: se muestran bloqueadas. La importación es
// una VISTA PREVIA local (el archivo no se envía ni se guarda).

const DASH = '—';
const show = v => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));
const inputCls = 'w-full text-xs bg-slate-50/50 border border-slate-200 rounded-xl p-2.5 outline-none text-slate-700';
const PAGE = 25;
const OUTCOME = {
  new: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Nuevo', 'New'],
  new_incomplete: ['bg-amber-50 text-amber-700 border-amber-200', 'Nuevo incompleto', 'New, incomplete'],
  existing_skip: ['bg-slate-100 text-slate-600 border-slate-200', 'Existe · se omitiría', 'Exists · would skip'],
  existing_update: ['bg-blue-50 text-blue-700 border-blue-200', 'Existe · se actualizaría', 'Exists · would update'],
  duplicate_in_file: ['bg-rose-50 text-rose-700 border-rose-200', 'Repetido en archivo', 'Repeated in file'],
};
const MATCH = { code: ['No. de proveedor', 'Supplier No.'], key: ['Clave', 'Code'], rfc: ['RFC', 'Tax ID'], name: ['Razón social', 'Legal name'] };
const ISSUE = { code: ['sin número (provisional)', 'no number (provisional)'], name: ['sin razón social (provisional)', 'no legal name (provisional)'], category: ['categoría: Pendiente de actualizar', 'category: Pending update'], currency: ['moneda no reconocida', 'unrecognized currency'], email: ['correo inválido', 'invalid email'] };
const statusTone = s => (['authorized', 'active'].includes(s) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ['evaluation', 'under_evaluation'].includes(s) ? 'bg-amber-50 text-amber-700 border-amber-200' : ['suspended', 'blocked'].includes(s) ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200');

// Estatus normalizado + estatus original importado, solo si aporta algo distinto (p. ej. "Pendiente de actualizar").
const statusLabel = (s, en) => { const t = translateStatus(s.status, en); const l = String(s.legacy_status || '').trim(); return l && l.toLowerCase() !== t.toLowerCase() ? `${t} · ${l}` : t; };

function Field({ label, children, required, span = '' }) {
  return <div className={span}><label className="block text-xs font-bold text-slate-700 mb-1">{label}{required && <span className="text-purple-600"> *</span>}</label>{children}</div>;
}
function ReadInput({ value, label }) {
  return <input type="text" readOnly aria-label={label} value={value === DASH ? '' : value} placeholder={DASH} className={inputCls} />;
}

export function SuppliersCatalog({ onNotify, lang = 'es', language, isEnglish }) {
  const en = isEnglish || lang === 'en' || language === 'en';
  const tx = (es, e) => (en ? e : es);
  const notify = (title, message, type = 'info') => { if (typeof onNotify === 'function') onNotify(title, message, type); };
  const LOCK = tx('Modo consulta MariaDB: el alta, la edición, la eliminación y el guardado de importaciones se habilitarán cuando existan endpoints de escritura con autorización, CSRF, idempotencia y auditoría.', 'MariaDB read mode: create, edit, delete and saving imports will be enabled once write endpoints with authorization, CSRF, idempotency and audit exist.');
  const cards = [
    { id: 'register', emoji: '📝', title: tx('Registro y actualización', 'Registration and update'), desc: tx('Ficha completa del proveedor seleccionado.', 'Full record of the selected supplier.') },
    { id: 'matrix', emoji: '📋', title: tx('Matriz de proveedores', 'Suppliers Matrix'), desc: tx('Consulta, búsqueda, filtros y detalle.', 'Lookup, search, filters and details.') },
    { id: 'indicators', emoji: '📊', title: tx('Evaluación e indicadores', 'Evaluation and indicators'), desc: tx('Calificaciones, estatus y situación de los proveedores.', 'Ratings, status, and supplier overview.') },
    { id: 'import', emoji: '📥', title: tx('Importar Excel', 'Import Excel'), desc: tx('Validación previa del archivo contra la base compartida.', 'Pre-validation of the file against the shared database.') },
  ];
  const [tab, setTab] = useState('matrix');
  const [revision, setRevision] = useState(0);

  // ---------- Matriz (paginada en el servidor; lógica existente) ----------
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, summary: { total: 0, statuses: [], incomplete: 0 } });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState(null);
  // Solo reinicia la página si la búsqueda cambió (antes, el primer disparo tras montar regresaba a la página 1).
  useEffect(() => { const task = setTimeout(() => { const next = input.trim(); if (next !== q) { setQ(next); setPage(1); } }, 300); return () => clearTimeout(task); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = new AbortController();
    setBusy(true); setError('');
    listCatalog('suppliers', { page, pageSize: PAGE, q, status }, c.signal)
      .then(r => { if (!c.signal.aborted) setList(r); })
      .catch(e => { if (!c.signal.aborted) setError(e.status === 401 ? tx('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.') : e.message || tx('Error de consulta.', 'Query error.')); })
      .finally(() => { if (!c.signal.aborted) setBusy(false); });
    return () => c.abort();
  }, [page, q, status, revision]);
  const summary = list.summary || {};
  const total = Number(list.total || 0);
  const lastPage = Math.max(1, Math.ceil(total / PAGE));

  // ---------- Catálogo completo (páginas de 50, solo lectura) para ficha, indicadores e importación ----------
  const [all, setAll] = useState({ status: 'idle', error: '', items: [], total: 0 });
  const loadedRev = useRef(-1);
  const needAll = tab !== 'matrix';
  useEffect(() => {
    if (!needAll || loadedRev.current === revision) return undefined;
    const c = new AbortController();
    (async () => {
      setAll(a => ({ ...a, status: 'loading', error: '' }));
      try {
        let p = 1, items = [], tot = 0;
        do {
          const r = await listCatalog('suppliers', { page: p, pageSize: 50, q: '', status: 'all' }, c.signal);
          tot = Number(r.total) || 0; items = items.concat(r.items || []); p += 1;
          if (!c.signal.aborted) setAll(a => ({ ...a, items, total: tot }));
        } while (items.length < tot && p <= 80 && !c.signal.aborted);
        if (!c.signal.aborted) { loadedRev.current = revision; setAll({ status: 'ready', error: '', items, total: tot }); }
      } catch (e) { if (!c.signal.aborted) setAll(a => ({ ...a, status: 'error', error: e.message || 'Error' })); }
    })();
    return () => c.abort();
  }, [needAll, revision]);
  const allReady = all.status === 'ready';

  // ---------- Ficha (registro en modo consulta) ----------
  const [selectedId, setSelectedId] = useState('');
  const [ficha, setFicha] = useState({ loading: false, error: '', item: null });
  useEffect(() => {
    if (!selectedId) { setFicha({ loading: false, error: '', item: null }); return undefined; }
    const c = new AbortController();
    setFicha({ loading: true, error: '', item: null });
    Promise.resolve().then(() => getCatalogRecord('suppliers', selectedId, c.signal)).then(r => { if (!c.signal.aborted) setFicha({ loading: false, error: '', item: r.item || null }); })
      .catch(e => { if (!c.signal.aborted) setFicha({ loading: false, error: e.message || 'Error', item: null }); });
    return () => c.abort();
  }, [selectedId, revision]);
  const f = ficha.item;
  const channels = type => (f?.channels || []).filter(x => x.type === type).map(x => x.value);
  const byCode = useMemo(() => [...all.items].sort((a, b) => String(a.code).localeCompare(String(b.code), 'es', { numeric: true })), [all.items]);
  const byName = useMemo(() => [...all.items].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')), [all.items]);

  // ---------- Indicadores ----------
  const ind = useMemo(() => supplierIndicators(summary, all.items), [summary, all.items]);

  // ---------- Importación (vista previa local) ----------
  const [file, setFile] = useState(null);
  const [sheet, setSheet] = useState({ headers: [], rows: [] });
  const [importError, setImportError] = useState('');
  const [reading, setReading] = useState(false);
  const defaultRules = { duplicateMode: 'skip', defaultCategory: '', newStatus: 'under_evaluation', defaultCurrency: 'MXN' };
  const [rules, setRules] = useState(defaultRules);
  const analysis = useMemo(() => analyzeSupplierImport(sheet.headers, sheet.rows, all.items, rules), [sheet, all.items, rules]);
  const readFile = async picked => {
    if (!picked) return;
    setImportError('');
    if (!/\.(xlsx|xls|csv)$/i.test(picked.name)) { setImportError(tx('Selecciona un archivo .xlsx, .xls o .csv.', 'Select an .xlsx, .xls or .csv file.')); return; }
    if (picked.size > 10 * 1024 * 1024) { setImportError(tx('El archivo excede 10 MB.', 'The file exceeds 10 MB.')); return; }
    setReading(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await picked.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) : [];
      setFile(picked); setSheet({ headers: (data[0] || []).map((h, i) => (String(h ?? '').trim() || `COLUMNA_${i + 1}`)), rows: data.slice(1, 5001) });
      notify(tx('Importador Excel', 'Excel importer'), tx(`Archivo de proveedores leído localmente (${Math.max(0, data.length - 1)} filas). No se guardó nada.`, `Supplier file read locally (${Math.max(0, data.length - 1)} rows). Nothing was saved.`));
    } catch {
      setImportError(tx('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.', 'The file could not be read. Check it is a valid Excel or CSV file.'));
    } finally { setReading(false); }
  };
  const resetImport = () => { setFile(null); setSheet({ headers: [], rows: [] }); setImportError(''); setRules(defaultRules); };
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([SUPPLIER_TEMPLATE_HEADERS]), 'Proveedores');
    XLSX.writeFile(wb, 'Plantilla_proveedores_SupplyFlow.xlsx');
  };
  const statusOptions = Array.isArray(summary.statuses) ? summary.statuses : [];
  const AllState = () => (all.status === 'loading' ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx(`Consultando catálogo completo… ${all.items.length}${all.total ? ` de ${all.total}` : ''}`, `Loading full catalog… ${all.items.length}${all.total ? ` of ${all.total}` : ''}`)}</p>
    : all.status === 'error' ? <p role="alert" className="text-[11px] text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{all.error}</p> : null);

  return <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{tx('Proveedores', 'Suppliers')}</h2><p className="text-xs text-slate-500">{tx('Registro, matriz, evaluación e importación de proveedores registrados en MariaDB.', 'Registration, matrix, evaluation and import of suppliers stored in MariaDB.')}</p></div>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span>
        <button type="button" onClick={() => setRevision(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button>
      </div>
    </div>

    {/* Grid de las 4 Tarjetas */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => { const active = tab === card.id; return <button key={card.id} type="button" onClick={() => setTab(card.id)} aria-pressed={active}
        className={`text-left p-5 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-36 border ${active ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-1' : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors ${active ? 'bg-white/20 backdrop-blur-md' : 'bg-blue-50/80 border border-blue-100/50'}`}><span>{card.emoji}</span></div>
        <div><h3 className={`text-sm font-bold tracking-tight ${active ? 'text-white' : 'text-slate-800'}`}>{card.title}</h3><p className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${active ? 'text-blue-100' : 'text-slate-400'}`}>{card.desc}</p></div>
      </button>; })}
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    {/* Contenedor dinámico */}
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[400px]">

      {/* TAB 1: Registro (ficha en modo consulta) */}
      {tab === 'register' && <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div><h3 className="text-base font-black text-slate-800">{tx('Alta y actualización de proveedores', 'Supplier Registration and Updates')}</h3><p className="text-[11px] text-slate-400 mt-0.5">{tx('El número de proveedor es único por organización en MariaDB. Selecciona un proveedor para ver su ficha completa.', 'The supplier number is unique per organization in MariaDB. Select a supplier to view its full record.')}</p></div>
          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100 shrink-0">{tx('Modo consulta', 'Read mode')}</span>
        </div>
        <AllState />
        {ficha.loading && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Consultando ficha en MariaDB…', 'Loading record from MariaDB…')}</p>}
        {ficha.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{ficha.error}</p>}
        {f?.data_incomplete && <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-[11px] text-amber-900">{tx('Proveedor con datos pendientes de actualizar en la importación original.', 'Supplier with data pending update in the original import.')}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label={tx('No. de proveedor', 'Supplier No.')} required>
            <select aria-label={tx('Seleccionar por número de proveedor', 'Select by supplier number')} value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={!allReady} className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-2 focus:ring-2 focus:ring-purple-500 focus:outline-none">
              <option value="">{allReady ? tx('Selecciona un número registrado', 'Select a registered number') : tx('Cargando…', 'Loading…')}</option>
              {byCode.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
            <ReadInput value={show(f?.code)} label={tx('No. de proveedor', 'Supplier No.')} />
            <p className="text-[10px] text-slate-400 mt-1">{tx('Selecciona un número registrado para cargar todos los datos disponibles.', 'Select a registered number to load all available data.')}</p>
          </Field>
          <Field label={tx('Razón social', 'Company Name / Legal Name')} required>
            <select aria-label={tx('Seleccionar por razón social', 'Select by legal name')} value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={!allReady} className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-2 focus:ring-2 focus:ring-purple-500 focus:outline-none">
              <option value="">{allReady ? tx('Selecciona una razón social', 'Select a legal name') : tx('Cargando…', 'Loading…')}</option>
              {byName.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ReadInput value={show(f?.name)} label={tx('Razón social', 'Legal name')} />
            <p className="text-[10px] text-slate-400 mt-1">{tx('Carga No. de proveedor, Clave, RFC, contacto, correo, teléfono, categoría, condiciones y demás datos.', 'Loads Supplier No., Code, Tax ID, contact, email, phone, category, terms and other data.')}</p>
          </Field>
          <Field label={tx('RFC / Tax ID', 'Tax ID / RFC')}><ReadInput value={show(f?.tax_id)} label="RFC" /></Field>
          <Field label={tx('Clave', 'Code')}><ReadInput value={show(f?.supplier_key)} label={tx('Clave', 'Code')} /></Field>
          <Field label={tx('Contactos', 'Contacts')} span="md:col-span-2"><div className="space-y-2">{(f?.contacts?.length ? f.contacts : [null]).map((p, i) => <ReadInput key={p?.id || i} value={p ? `${p.name}${p.position ? ` · ${p.position}` : ''}${p.is_primary ? tx(' · principal', ' · primary') : ''}` : DASH} label={tx('Contacto', 'Contact')} />)}</div></Field>
          <Field label={tx('Correos electrónicos', 'Email addresses')} span="md:col-span-2"><div className="space-y-2">{(f && channels('email').length ? channels('email') : [DASH]).map((v, i) => <ReadInput key={i} value={v} label="Email" />)}</div></Field>
          <Field label={tx('Teléfonos', 'Phone numbers')}><div className="space-y-2">{(f && channels('phone').length ? channels('phone') : [DASH]).map((v, i) => <ReadInput key={i} value={v} label={tx('Teléfono', 'Phone')} />)}</div></Field>
          <Field label={tx('Categoría', 'Category')} required><ReadInput value={show(f?.category)} label={tx('Categoría', 'Category')} /></Field>
          <Field label={tx('Estatus', 'Status')}><ReadInput value={f ? statusLabel(f, en) : DASH} label={tx('Estatus', 'Status')} /></Field>
          <Field label={tx('Moneda habitual', 'Default Currency')}><ReadInput value={show(f?.currency)} label={tx('Moneda', 'Currency')} /></Field>
          <Field label={tx('Tipo de crédito habitual', 'Default Credit Type')}><ReadInput value={show(f?.credit_type)} label={tx('Tipo de crédito', 'Credit type')} /></Field>
          <Field label={tx('Días de crédito', 'Credit Days')}><ReadInput value={show(f?.credit_days)} label={tx('Días de crédito', 'Credit days')} /></Field>
          <Field label={tx('Tiempo de entrega habitual', 'Default Delivery Time')}><ReadInput value={f && f.lead_time_value !== null && f.lead_time_value !== undefined ? String(Number(f.lead_time_value)) : DASH} label={tx('Tiempo de entrega', 'Delivery time')} /></Field>
          <Field label={tx('Unidad del tiempo de entrega', 'Delivery Time Unit')}><ReadInput value={show(f?.lead_time_unit)} label={tx('Unidad', 'Unit')} /></Field>
          <Field label={tx('Calificación', 'Rating')}><ReadInput value={f ? show(ratingText(f, f.rating_scale)) : DASH} label={tx('Calificación', 'Rating')} /></Field>
          <Field label={tx('Documentos / certificaciones', 'Documents / Certifications')} span="md:col-span-2"><ReadInput value={show(f?.document_notes)} label={tx('Documentos', 'Documents')} /></Field>
          <Field label={tx('Logotipo del proveedor', 'Supplier Logo')} span="md:col-span-3">
            <div className="border border-blue-100 bg-blue-50/20 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="w-36 h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-lg font-black shadow-inner">{f ? initials(f.name) : tx('Sin logotipo', 'No logo')}</div>
              <p className="text-[10px] text-slate-400">{tx('La base importada no incluye logotipos; se muestran las iniciales. La carga de imágenes requiere almacenamiento privado con validación en el servidor.', 'The imported database has no logos; initials are shown. Uploading images requires private storage with server-side validation.')}</p>
            </div>
          </Field>
          <Field label={tx('Observaciones', 'Notes / Observations')} span="md:col-span-3"><textarea rows={3} readOnly value={f?.notes || ''} placeholder={DASH} className="w-full text-xs bg-slate-50/50 border border-slate-200 rounded-xl p-2.5 outline-none text-slate-700" /></Field>
        </div>
        <div className="pt-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled title={LOCK} className="bg-slate-200 text-slate-500 text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{tx('Guardar proveedor', 'Save Supplier')}</button>
          <button type="button" onClick={() => setSelectedId('')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"><span>🧹</span>{tx('Limpiar', 'Clear')}</button>
          <button type="button" onClick={() => setTab('matrix')} className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"><span>📋</span>{tx('Ver matriz', 'View Matrix')}</button>
        </div>
      </div>}

      {/* TAB 2: Matriz */}
      {tab === 'matrix' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h3 className="text-lg font-black text-slate-900">{tx('Matriz de proveedores', 'Suppliers Matrix')}</h3><p className="text-xs text-slate-400 mt-0.5">{tx(`${summary.total ?? 0} proveedores registrados · ${total} coincidencias · ${summary.incomplete ?? 0} con datos pendientes de actualizar.`, `${summary.total ?? 0} registered suppliers · ${total} matches · ${summary.incomplete ?? 0} pending update.`)}</p></div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setTab('import')} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"><Download className="w-4 h-4" />{tx('Importar Excel', 'Import Excel')}</button>
            <button type="button" disabled title={LOCK} className="bg-slate-200 text-slate-500 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Plus className="w-4 h-4" />{tx('Nuevo proveedor', 'New Supplier')}</button>
          </div>
        </div>
        <div className="relative"><Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={input} onChange={e => setInput(e.target.value)} aria-label={tx('Buscar en catálogo', 'Search catalog')} placeholder={tx('Buscar por número, razón social, RFC, contacto o correo...', 'Search by number, company name, Tax ID, contact, or email...')} className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50/50 border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700" /></div>
        <div><select aria-label={tx('Estatus', 'Status')} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer">
          <option value="all">{tx('Todos los estatus', 'All Statuses')}</option>{statusOptions.map(s => <option key={s.code} value={s.code}>{translateStatus(s.code, en)} ({s.count})</option>)}
        </select></div>
        {busy && <div className="p-6 text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Consultando datos reales...', 'Loading real records...')}</div>}
        {error && <div className="p-6 text-rose-700 text-xs flex gap-2" role="alert"><AlertCircle className="w-4 h-4" />{error}</div>}
        {!busy && !error && <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white"><div className="overflow-x-auto"><table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-50/60 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {[tx('Logo', 'Logo'), tx('No./Clave', 'No./Code'), tx('Proveedor', 'Supplier'), 'RFC', tx('Categoría', 'Category'), tx('Estatus', 'Status'), tx('Suministros', 'Supplies')].map(h => <th key={h} className="py-3 px-2 leading-tight">{h}</th>)}
            <th className="py-3 px-2 leading-tight text-center">{tx('Entrega habitual', 'Default delivery')}</th><th className="py-3 px-2 leading-tight">{tx('Crédito habitual', 'Default credit')}</th><th className="py-3 px-2 leading-tight text-center">{tx('Calificación', 'Rating')}</th>
            <th className="py-3 px-2 leading-tight text-center" title={tx('Conteo de OC por proveedor: pendiente de integración', 'PO count per supplier: pending integration')}>{tx('OC', 'PO')}</th>
            <th className="py-3 px-2 leading-tight text-center sticky right-0 bg-slate-50 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">{tx('Acciones', 'Actions')}</th>
          </tr></thead>
          <tbody>
            {list.items.length ? list.items.map(s => <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs text-slate-700 align-top">
              <td className="py-3 px-2"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-[10px] text-slate-500 font-bold">{initials(s.name)}</div></td>
              <td className="py-3 px-2 whitespace-nowrap"><div className="font-bold text-slate-900">{s.code}</div>{s.supplier_key && <div className="text-[10px] text-slate-500">{s.supplier_key}</div>}</td>
              <td className="py-3 px-2 min-w-[160px]"><div className="font-semibold text-slate-800">{s.name}</div>{s.primary_contact && <div className="text-[10px] text-slate-500">{s.primary_contact}</div>}{s.primary_email && <div className="text-[10px] text-slate-400 font-mono [overflow-wrap:anywhere]">{s.primary_email}</div>}{s.data_incomplete && <div className="text-[10px] text-amber-700 font-semibold">{tx('Datos pendientes de actualizar', 'Data pending update')}</div>}</td>
              <td className="py-3 px-2 font-mono text-[11px] whitespace-nowrap">{show(s.tax_id)}</td>
              <td className="py-3 px-2">{show(s.category)}</td>
              <td className="py-3 px-2"><span title={s.legacy_status || ''} className={`border text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusTone(s.status)}`}>{translateStatus(s.status, en)}</span></td>
              <td className="py-3 px-2 text-center tabular-nums">{Number(s.offerings_count) || 0}</td>
              <td className="py-3 px-2 text-center min-w-[72px]">{show(leadTime(s))}</td>
              <td className="py-3 px-2 min-w-[72px]">{s.credit_type || (s.credit_days !== null && s.credit_days !== undefined) ? <><div>{show(s.credit_type)}</div>{s.credit_days !== null && s.credit_days !== undefined && <div className="text-[10px] text-slate-500 whitespace-nowrap">{Number(s.credit_days)} {tx('días', 'days')}</div>}</> : DASH}</td>
              <td className="py-3 px-2 text-center font-bold text-purple-700 whitespace-nowrap">{show(ratingText(s))}</td>
              <td className="py-3 px-2 text-center text-slate-400">{DASH}</td>
              <td className="py-3 px-2 sticky right-0 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"><div className="flex flex-col items-stretch gap-1 min-w-[76px]">
                <button type="button" onClick={() => setDetailId(s.id)} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 border border-blue-100 cursor-pointer"><Eye className="w-3 h-3" />{tx('Ver', 'View')}</button>
                <button type="button" onClick={() => { setSelectedId(s.id); setTab('register'); }} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 cursor-pointer"><Edit3 className="w-3 h-3" />{tx('Ficha', 'Record')}</button>
                <button type="button" disabled title={tx('No conviene eliminar proveedores relacionados con documentos del proceso; la baja (marcar Inactivo) se habilitará con el endpoint de escritura.', 'Suppliers linked to process documents should not be deleted; deactivation will be enabled with the write endpoint.')} className="px-2 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 cursor-not-allowed"><Trash2 className="w-3 h-3" />{tx('Eliminar', 'Delete')}</button>
              </div></td>
            </tr>) : <tr><td colSpan={12} className="py-16 text-center"><div className="flex flex-col items-center justify-center space-y-2"><span className="text-3xl">📋</span><h4 className="text-xs font-bold text-slate-700">{tx('No se encontraron proveedores.', 'No suppliers found.')}</h4><p className="text-[11px] text-slate-400">{tx('Ajusta la búsqueda o el estatus.', 'Adjust the search or status.')}</p></div></td></tr>}
          </tbody></table></div>
          <div className="p-4 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between text-xs text-slate-600"><div>{tx('Página', 'Page')} {page} / {lastPage} · {total} {tx('coincidencias', 'matches')}</div>
            <div className="flex gap-2"><button type="button" disabled={busy || page <= 1} aria-label={tx('Página anterior', 'Previous page')} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" onClick={() => setPage(n => Math.max(1, n - 1))}><ChevronLeft className="w-4 h-4" /></button><button type="button" disabled={busy || page >= lastPage} aria-label={tx('Página siguiente', 'Next page')} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" onClick={() => setPage(n => n + 1)}><ChevronRight className="w-4 h-4" /></button></div></div>
        </div>}
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{tx('Registros de la base de datos; sin datos de demostración como respaldo. La columna OC queda pendiente de integración.', 'Database-backed records; no demo fallback. The PO column is pending integration.')}</p>
      </div>}

      {/* TAB 3: Indicadores */}
      {tab === 'indicators' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h3 className="text-lg font-black text-slate-900">{tx('Evaluación e indicadores de proveedores', 'Supplier Evaluation and KPIs')}</h3><p className="text-xs text-slate-400 mt-0.5">{tx('Resumen del estatus, calificación y utilización del catálogo registrado en MariaDB.', 'Summary of status, rating and catalog usage stored in MariaDB.')}</p></div>
          <button type="button" onClick={() => setTab('matrix')} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start"><span>📋</span>{tx('Consultar matriz', 'View Matrix')}</button>
        </div>
        <AllState />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[[ind.authorized, tx('Autorizados', 'Authorized'), 'bg-emerald-50/40 border-l-emerald-500'], [ind.evaluation, tx('En evaluación', 'Under Evaluation'), 'bg-amber-50/40 border-l-amber-500'], [ind.suspended, tx('Suspendidos', 'Suspended'), 'bg-rose-50/40 border-l-rose-500']].map(([n, label, cls]) =>
            <div key={label} className={`${cls} border-l-4 border border-slate-100 rounded-2xl p-4`}><span className="text-sm font-black text-slate-900 block tabular-nums">{n}</span><span className="text-xs text-slate-600 font-medium">{label}</span></div>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-sky-50/30 border-l-4 border-l-sky-500 border border-slate-100 rounded-2xl p-4"><span className="text-xs font-bold text-slate-900 block">{tx('Calificación promedio:', 'Average Rating:')}</span><span className="text-xs text-slate-600 font-semibold mt-1 block">{allReady ? (ind.avgRating === null ? tx('Sin calificaciones registradas', 'No ratings recorded') : tx(`${ind.avgRating} (${ind.rated} proveedor(es) calificado(s); escala según el registro)`, `${ind.avgRating} (${ind.rated} rated supplier(s); scale per record)`)) : DASH}</span></div>
          <div className="bg-sky-50/30 border-l-4 border-l-blue-600 border border-slate-100 rounded-2xl p-4"><span className="text-xs font-bold text-slate-900 block">{tx('Productos y servicios registrados:', 'Registered Products & Services:')}</span><span className="text-xs text-slate-600 font-semibold mt-1 block">{allReady ? tx(`${ind.offerings} (en ${ind.withOfferings} proveedor(es))`, `${ind.offerings} (across ${ind.withOfferings} supplier(s))`) : DASH}</span></div>
        </div>
        <div className="bg-amber-50/40 border-l-4 border-l-amber-500 border border-slate-100 rounded-2xl p-4"><span className="text-xs font-black text-slate-900 block tabular-nums">{ind.incomplete}</span><span className="text-xs text-slate-600 font-medium">{tx('Proveedor(es) con datos pendientes de actualización.', 'Supplier(s) with pending updates.')}</span></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-2"><div className="text-xs font-bold text-slate-900">{tx('Distribución por estatus', 'Status distribution')} <span className="text-slate-400 font-medium">· {ind.total}</span></div>
            {ind.statuses.map(s => <div key={s.code} className="flex items-center gap-3 text-xs"><span className="w-32 text-slate-600 font-semibold">{translateStatus(s.code, en)}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${statusTone(s.code).includes('emerald') ? 'bg-emerald-500' : statusTone(s.code).includes('amber') ? 'bg-amber-500' : statusTone(s.code).includes('rose') ? 'bg-rose-500' : 'bg-slate-400'}`} style={{ width: `${ind.total ? s.count * 100 / ind.total : 0}%` }} /></div><span className="w-10 text-right font-black tabular-nums">{s.count}</span></div>)}
            {!ind.statuses.length && <p className="text-[11px] text-slate-400">{DASH}</p>}</div>
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-2"><div className="text-xs font-bold text-slate-900">{tx('Proveedores por categoría', 'Suppliers by category')}</div>
            {allReady ? ind.categories.slice(0, 8).map(c => <div key={c.name} className="flex items-center gap-3 text-xs"><span className="w-40 text-slate-600 font-semibold truncate" title={c.name}>{c.name}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-500" style={{ width: `${ind.categories[0] ? c.count * 100 / ind.categories[0].count : 0}%` }} /></div><span className="w-10 text-right font-black tabular-nums">{c.count}</span></div>) : <p className="text-[11px] text-slate-400">{DASH}</p>}
            {allReady && ind.categories.length > 8 && <p className="text-[10px] text-slate-400">{tx(`+${ind.categories.length - 8} categoría(s) más.`, `+${ind.categories.length - 8} more category(ies).`)}</p>}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {[[tx('Proveedor autorizado', 'Authorized Supplier'), tx('Disponibilidad operativa.', 'Operational availability.'), tx('Puede participar en cotizaciones y ser seleccionado para una orden de compra.', 'Can participate in quotes and be selected for Purchase Orders.'), 'bg-emerald-50/50 border-l-emerald-500'],
            [tx('Proveedor en evaluación', 'Supplier Under Evaluation'), tx('Seguimiento documental.', 'Documentary tracking.'), tx('Debe completar validaciones comerciales, fiscales, técnicas, de calidad o HSE.', 'Must complete commercial, tax, technical, quality, or HSE validations.'), 'bg-amber-50/50 border-l-amber-500'],
            [tx('Proveedor suspendido', 'Suspended Supplier'), tx('Bloqueo preventivo.', 'Preventive block.'), tx('No debe utilizarse para nuevas cotizaciones u órdenes hasta levantar la suspensión.', 'Must not be used for new quotes or purchase orders until suspension is lifted.'), 'bg-rose-50/50 border-l-rose-500']].map(([title, sub, desc, cls]) =>
            <div key={title} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4"><div><h4 className="text-sm font-bold text-slate-900">{title}</h4><p className="text-[11px] text-slate-400 mt-0.5">{sub}</p></div><div className={`${cls} border-l-4 border border-slate-100 rounded-xl p-3`}><p className="text-[11px] text-slate-600 font-medium leading-relaxed">{desc}</p></div></div>)}
        </div>
        <p className="text-[10px] text-slate-400">{tx('Reglas del proceso original. Su validación automática se aplicará cuando Cotizaciones y Órdenes de Compra estén conectadas a MariaDB.', 'Rules from the original process. Automatic enforcement will apply once Quotes and Purchase Orders are connected to MariaDB.')}</p>
      </div>}

      {/* TAB 4: Importar (vista previa local, sin guardado) */}
      {tab === 'import' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h3 className="text-lg font-black text-slate-900">{tx('Importación masiva de proveedores desde Excel', 'Bulk Import Suppliers from Excel')}</h3><p className="text-xs text-slate-400 mt-0.5">{tx('Analiza el archivo y valida duplicados contra los proveedores registrados en MariaDB. La lectura es local: el archivo no se envía ni se guarda.', 'Analyzes the file and checks duplicates against suppliers stored in MariaDB. Reading is local: the file is not uploaded or saved.')}</p></div>
          <span className="bg-purple-50 text-purple-700 text-[10px] font-extrabold px-3 py-1.5 rounded-full border border-purple-100 self-start">Excel / XLSX / XLS / CSV</span>
        </div>
        <AllState />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); readFile(e.dataTransfer?.files?.[0]); }} className="border-2 border-dashed border-blue-200 bg-blue-50/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-blue-50/30">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-3"><FileSpreadsheet className="w-6 h-6 text-purple-600" /></div>
              <h4 className="text-sm font-bold text-slate-800">{tx('Selecciona o arrastra el archivo de proveedores', 'Select or drag supplier file here')}</h4>
              <p className="text-[11px] text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">{tx('Se utiliza la primera hoja del libro. Se analizan hasta 5,000 filas.', 'The first worksheet is used. Up to 5,000 rows are analyzed.')}</p>
              <label className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-500/20 inline-flex items-center gap-2"><Upload className="w-3.5 h-3.5" /><span>{tx('Seleccionar archivo', 'Select file')}</span>
                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" aria-label={tx('Archivo de proveedores', 'Supplier file')} onChange={e => { readFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
              <span className="text-[11px] text-slate-400 mt-3 font-medium">{reading ? tx('Leyendo…', 'Reading…') : file ? file.name : tx('Ningún archivo seleccionado.', 'No file selected.')}</span>
            </div>
            {importError && <p role="alert" className="text-xs text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{importError}</p>}
            <div className="bg-sky-50/40 border border-sky-100 rounded-2xl p-4 text-[11px] text-slate-600 leading-relaxed"><strong className="text-slate-900">{tx('Columnas reconocidas:', 'Recognized Columns:')}</strong> {tx('Provider number, Clave, Legal / company name, Brand name, RFC, Email y Contact; también Email 2, Email 3, Contact 2, Contact 3, Phone, Category y Currency, y sus equivalentes en español. Una celda puede tener varios valores separados por punto y coma, coma, barra vertical o salto de línea. Conserva Provider number y RFC como texto en Excel para no perder ceros iniciales.', 'Provider number, Clave, Legal / company name, Brand name, Tax ID, Email and Contact; also Email 2, Email 3, Contact 2, Contact 3, Phone, Category and Currency, and Spanish equivalents. A cell may hold several values separated by semicolon, comma, pipe or line break. Keep Provider number and Tax ID as text in Excel to preserve leading zeros.')}</div>
            <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-[11px] text-slate-600 leading-relaxed"><strong className="text-slate-900">{tx('Importación editable:', 'Editable import:')}</strong> {tx('en el sistema original, las filas con datos faltantes se guardaban como registros incompletos En evaluación. Esta vista previa los identifica; el guardado se habilitará con el endpoint de importación.', 'in the original system, rows with missing data were saved as incomplete records Under Evaluation. This preview flags them; saving will be enabled with the import endpoint.')}</div>
          </div>
          <div className="lg:col-span-5 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold text-slate-900">{tx('Reglas para la importación', 'Import Rules')}</h4>
              <Field label={tx('Tratamiento de proveedores existentes', 'Existing Suppliers Treatment')}><select value={rules.duplicateMode} onChange={e => setRules(r => ({ ...r, duplicateMode: e.target.value }))} className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer font-medium"><option value="skip">{tx('Omitir duplicados existentes', 'Skip existing duplicates')}</option><option value="update">{tx('Actualizar datos existentes', 'Update existing data')}</option></select><p className="text-[10px] text-slate-400 mt-1">{tx('La coincidencia se verifica por No. de proveedor, Clave, RFC y razón social (sin distinguir mayúsculas, acentos ni puntuación).', 'Matches are verified by Supplier No., Code, Tax ID and Company Name (case, accent and punctuation insensitive).')}</p></Field>
              <Field label={tx('Categoría predeterminada (opcional)', 'Default Category (optional)')}><input type="text" value={rules.defaultCategory} onChange={e => setRules(r => ({ ...r, defaultCategory: e.target.value }))} placeholder={tx('Ej. General', 'e.g. General')} className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 placeholder:text-slate-400" /><p className="text-[10px] text-slate-400 mt-1">{tx('Si permanece vacía, se guardaría “Pendiente de actualizar”.', 'If left blank, “Pending update” would be stored.')}</p></Field>
              <Field label={tx('Estatus para proveedores nuevos', 'Status for New Suppliers')}><select value={rules.newStatus} onChange={e => setRules(r => ({ ...r, newStatus: e.target.value }))} className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer font-medium"><option value="under_evaluation">{tx('En evaluación', 'Under Evaluation')}</option><option value="authorized">{tx('Autorizado', 'Authorized')}</option><option value="inactive">{tx('Inactivo', 'Inactive')}</option></select><p className="text-[10px] text-slate-400 mt-1">{tx('Los registros incompletos siempre quedarían En evaluación.', 'Incomplete records would always be Under Evaluation.')}</p></Field>
              <Field label={tx('Moneda habitual predeterminada', 'Default Currency')}><select value={rules.defaultCurrency} onChange={e => setRules(r => ({ ...r, defaultCurrency: e.target.value }))} className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer font-medium">{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-2 pt-2">
              <button type="button" onClick={downloadTemplate} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"><Download className="w-3.5 h-3.5" />{tx('Descargar plantilla', 'Download Template')}</button>
              <button type="button" onClick={resetImport} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"><span>✏️</span>{tx('Limpiar', 'Clear')}</button>
              <button type="button" disabled title={LOCK} className="2xl:col-span-2 bg-slate-200 text-slate-500 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{tx('Guardar en MariaDB', 'Save to MariaDB')}</button>
            </div>
          </div>
        </div>

        {file && sheet.headers.length > 0 && <div className="pt-6 border-t border-slate-200/80 space-y-4" data-testid="import-preview">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600"><TableIcon className="w-4 h-4" /></div>
              <div><h4 className="text-sm font-extrabold text-slate-900">{tx('Vista previa y validación del archivo', 'File preview and validation')}</h4><p className="text-[11px] text-slate-400">{tx(`Se detectaron ${analysis.counts.total} fila(s); ${analysis.recognized} de ${sheet.headers.length} columna(s) reconocidas.`, `Detected ${analysis.counts.total} row(s); ${analysis.recognized} of ${sheet.headers.length} column(s) recognized.`)}</p></div></div>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full border inline-flex items-center gap-1.5 self-start sm:self-auto ${analysis.map.code >= 0 && analysis.map.name >= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}><CheckCircle2 className="w-3.5 h-3.5" />{analysis.map.code >= 0 && analysis.map.name >= 0 ? tx('Archivo estructurado correctamente', 'File structured correctly') : tx('Faltan columnas clave (número o razón social)', 'Key columns missing (number or legal name)')}</span>
          </div>
          {!allReady && <p className="text-[11px] text-amber-700">{tx('La comparación con proveedores existentes se completa cuando termina de cargarse el catálogo.', 'Comparison with existing suppliers completes once the catalog finishes loading.')}</p>}
          {analysis.unknown.length > 0 && <p className="text-[11px] text-slate-500">{tx('Columnas no reconocidas (se ignoran):', 'Unrecognized columns (ignored):')} {analysis.unknown.join(', ')}</p>}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Object.entries(OUTCOME).map(([k, [cls, es, e]]) => <div key={k} className={`rounded-xl border px-3 py-2 ${cls}`}><div className="text-lg font-black tabular-nums">{analysis.counts[k]}</div><div className="text-[10px] font-bold">{en ? e : es}</div></div>)}</div>
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm"><div className="overflow-x-auto max-h-[380px]"><table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-md border-b border-slate-200/80 text-[10px] font-bold text-slate-600 uppercase tracking-wider z-10"><tr>
              {['#', tx('Resultado', 'Result'), tx('No. proveedor', 'Supplier No.'), tx('Clave', 'Code'), tx('Razón social', 'Legal name'), 'RFC', tx('Categoría', 'Category'), tx('Moneda', 'Currency'), tx('Correos', 'Emails'), tx('Contactos', 'Contacts'), tx('Observaciones', 'Notes')].map(h => <th key={h} className="py-2.5 px-4 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {analysis.rows.slice(0, 300).map(r => <tr key={r.n} className="hover:bg-blue-50/30 transition-colors text-slate-700">
                <td className="py-2.5 px-4 font-bold text-slate-400 text-center text-[10px]">{r.n}</td>
                <td className="py-2.5 px-4 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${OUTCOME[r.outcome][0]}`}>{en ? OUTCOME[r.outcome][2] : OUTCOME[r.outcome][1]}</span>{r.matchedBy && <div className="text-[10px] text-slate-400 mt-0.5">{tx('por', 'by')} {MATCH[r.matchedBy][en ? 1 : 0]}{r.matched ? ` · ${r.matched.code}` : ''}</div>}</td>
                <td className="py-2.5 px-4 whitespace-nowrap font-bold">{show(r.code)}</td><td className="py-2.5 px-4 whitespace-nowrap">{show(r.key)}</td><td className="py-2.5 px-4 min-w-[200px]">{show(r.name)}</td><td className="py-2.5 px-4 font-mono text-[11px]">{show(r.rfc)}</td>
                <td className="py-2.5 px-4">{r.category || tx('Pendiente de actualizar', 'Pending update')}</td><td className="py-2.5 px-4">{r.currency}</td>
                <td className="py-2.5 px-4 text-[11px] min-w-[200px] [overflow-wrap:anywhere]">{r.emails.join(', ') || DASH}</td><td className="py-2.5 px-4 text-[11px]">{r.contacts.join(', ') || DASH}</td>
                <td className="py-2.5 px-4 text-[11px] text-amber-700">{r.issues.map(i => ISSUE[i][en ? 1 : 0]).join(' · ')}</td>
              </tr>)}
            </tbody></table></div>
            {analysis.rows.length > 300 && <div className="bg-slate-50/80 border-t border-slate-200/80 px-4 py-2 text-center text-[10px] font-semibold text-slate-500">{tx(`Mostrando 300 de ${analysis.rows.length} filas; los totales consideran todas.`, `Showing 300 of ${analysis.rows.length} rows; totals include all.`)}</div>}
          </div>
        </div>}
      </div>}
    </div>

    {detailId && <DetailPanel kind="suppliers" recordId={detailId} en={en} onClose={() => setDetailId(null)} />}
  </div>;
}
