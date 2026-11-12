import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Plus, Upload, Search, Download, Edit3, ExternalLink, Table as TableIcon, CheckCircle2, ChevronLeft, ChevronRight, Eye, RefreshCw, AlertCircle, Loader2, KeyRound, X } from 'lucide-react';
import { listCatalog, getCatalogRecord } from '../../catalogApi';
import { matrixClients } from '../../matrixApi';
import { DetailPanel, translateStatus } from '../catalog/shared';
import { analyzeImport, TEMPLATE_HEADERS, initials, clientIndicators } from './model.mjs';
import { emptyForm, formFromRecord, validateForm, toPayload, payloadSignature, missingRequired, serverField, saveErrorMessage, SALES_POLICIES, SOURCING_POLICIES, STATUSES } from './form.mjs';
import { saveClient, fetchLogo, compressLogo } from './clientWriteApi';

// Clientes · diseño Grupo Gerez (4 tarjetas) conectado a MariaDB.
// Lectura real: /api/v1/catalogs/clients[/{id}] y /api/v1/matrix/clients. Sin datos de demostración.
// Alta, edición, eliminación e importación con guardado no existen todavía en el backend: se muestran
// bloqueadas. La importación ofrece una VISTA PREVIA local (no envía ni guarda el archivo).

const T = {
  es: {
    headerTitle: 'Clientes', headerSubtitle: 'Catálogo de clientes registrado en MariaDB.',
    cards: {
      register: { title: 'Registro y actualización', desc: 'Alta y edición de clientes con datos de MariaDB.', emoji: '📝' },
      matrix: { title: 'Matriz de clientes', desc: 'Consulta, búsqueda y detalle de registros.', emoji: '📋' },
      indicators: { title: 'Indicadores de clientes', desc: 'Resumen de actividad, estatus y requisiciones relacionadas.', emoji: '📊' },
      import: { title: 'Importar Excel', desc: 'Validación previa del archivo contra la base compartida.', emoji: '📥' },
    },
    lock: 'El alta y la edición de clientes se guardan en MariaDB con autorización, CSRF, idempotencia, control de versión y bitácora. La eliminación, el guardado de importaciones y el acceso al portal siguen bloqueados.',
    refresh: 'Actualizar', source: 'Fuente: MariaDB',
  },
  en: {
    headerTitle: 'Clients', headerSubtitle: 'Client catalog stored in MariaDB.',
    cards: {
      register: { title: 'Registration & Update', desc: 'Create and edit clients in MariaDB.', emoji: '📝' },
      matrix: { title: 'Client Matrix', desc: 'Query, search and record details.', emoji: '📋' },
      indicators: { title: 'Client Metrics', desc: 'Activity summary, status, and linked requisitions.', emoji: '📊' },
      import: { title: 'Import Excel', desc: 'Pre-validation of the file against the shared database.', emoji: '📥' },
    },
    lock: 'Creating and editing clients is saved to MariaDB with authorization, CSRF, idempotency, version control and audit. Deleting, saving imports and portal access remain blocked.',
    refresh: 'Refresh', source: 'Source: MariaDB',
  },
};
const DASH = '—';
const show = v => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));
const inputCls = 'w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg outline-none text-slate-700';
const OUTCOME = {
  new: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'Nuevo', 'New'],
  new_incomplete: ['bg-amber-50 text-amber-700 border-amber-200', 'Nuevo incompleto', 'New, incomplete'],
  existing_skip: ['bg-slate-100 text-slate-600 border-slate-200', 'Existe · se omitiría', 'Exists · would skip'],
  existing_update: ['bg-blue-50 text-blue-700 border-blue-200', 'Existe · se actualizaría', 'Exists · would update'],
  duplicate_in_file: ['bg-rose-50 text-rose-700 border-rose-200', 'Repetido en archivo', 'Repeated in file'],
};
const ISSUE = { code: ['sin número (provisional)', 'no number (provisional)'], name: ['sin razón social (provisional)', 'no legal name (provisional)'], project: ['sin proyecto', 'no project'], contract: ['sin contrato', 'no contract'], email: ['correo inválido', 'invalid email'] };

function Field({ label, children, required }) {
  return <div><label className="block text-[11px] font-bold text-slate-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</label>{children}</div>;
}
function ReadInput({ value, label }) {
  return <input type="text" readOnly aria-label={label} value={value === DASH ? '' : value} placeholder={DASH} className={inputCls} />;
}

export function ClientsCatalog({ onNavigate = () => {}, onNotify, lang = 'es', language, isEnglish }) {
  const en = isEnglish || lang === 'en' || language === 'en';
  const t = en ? T.en : T.es;
  const tx = (es, e) => (en ? e : es);
  const notify = (title, message, type = 'info') => { if (typeof onNotify === 'function') onNotify(title, message, type); };
  const [tab, setTab] = useState('matrix');
  const [revision, setRevision] = useState(0);
  const [listRev, setListRev] = useState(0); // refresca matriz, selectores e indicadores tras cada guardado (no la ficha)

  // Directorio completo (código, nombre y requisiciones) para selectores, actividad y duplicados.
  const [all, setAll] = useState({ loading: true, error: '', items: [] });
  useEffect(() => {
    const c = new AbortController();
    setAll(a => ({ ...a, loading: true, error: '' }));
    matrixClients(c.signal).then(r => { if (!c.signal.aborted) setAll({ loading: false, error: '', items: r.items || [] }); })
      .catch(e => { if (!c.signal.aborted) setAll({ loading: false, error: e.message || 'Error', items: [] }); });
    return () => c.abort();
  }, [revision, listRev]);

  // ---------- Matriz (paginada en el servidor; lógica existente) ----------
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, summary: { total: 0, statuses: [], incomplete: 0 } });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState(null);
  const pageSize = 25;
  // Solo reinicia la página si la búsqueda cambió (antes, el primer disparo tras montar regresaba a la página 1).
  useEffect(() => { const task = setTimeout(() => { const next = input.trim(); if (next !== q) { setQ(next); setPage(1); } }, 300); return () => clearTimeout(task); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = new AbortController();
    setBusy(true); setError('');
    listCatalog('clients', { page, pageSize, q, status }, c.signal)
      .then(r => { if (!c.signal.aborted) setList(r); })
      .catch(e => { if (!c.signal.aborted) setError(e.status === 401 ? tx('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.') : e.message || tx('Error de consulta.', 'Query error.')); })
      .finally(() => { if (!c.signal.aborted) setBusy(false); });
    return () => c.abort();
  }, [page, q, status, revision, listRev]);
  const summary = list.summary || {};
  const total = Number(list.total || 0);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  // ---------- Ficha (registro en modo consulta) ----------
  const [selectedId, setSelectedId] = useState('');
  const [ficha, setFicha] = useState({ loading: false, error: '', item: null });
  useEffect(() => {
    if (!selectedId) { setFicha({ loading: false, error: '', item: null }); return undefined; }
    const c = new AbortController();
    setFicha({ loading: true, error: '', item: null });
    getCatalogRecord('clients', selectedId, c.signal).then(r => { if (!c.signal.aborted) setFicha({ loading: false, error: '', item: r.item || null }); })
      .catch(e => { if (!c.signal.aborted) setFicha({ loading: false, error: e.message || 'Error', item: null }); });
    return () => c.abort();
  }, [selectedId, revision]);
  const openFicha = id => { setSelectedId(id); setTab('register'); };
  const f = ficha.item;
  const channels = type => (f?.channels || []).filter(x => x.type === type).map(x => x.value);

  // ---------- Formulario de alta/actualización con guardado automático ----------
  // Cada cambio se guarda solo (AUTOSAVE_MS después de la última edición) cuando los obligatorios están completos:
  // primero crea el cliente (POST) y luego lo actualiza (PUT + If-Match). La matriz, los selectores y los indicadores
  // se refrescan tras cada guardado SIN recargar la ficha, para no pisar lo que se esté escribiendo.
  const AUTOSAVE_MS = 1500;
  const [form, setForm] = useState(emptyForm);
  const formRef = useRef(form);
  formRef.current = form;
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [auto, setAuto] = useState({ state: 'idle' }); // idle | incomplete | pending | saving | saved | error | paused
  const [lastSaved, setLastSaved] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const savedSig = useRef(payloadSignature(emptyForm()));
  const keyFor = useRef({ sig: '', key: '' }); // misma clave al reintentar el mismo contenido (el servidor no duplica)
  const inFlight = useRef(null);
  const queued = useRef(false);
  const paused = useRef(false); // conflicto de versión o escritura no habilitada: solo se reintenta con "Guardar cliente"
  const fileRef = useRef(null);
  const newKey = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  // Aplica la ficha cargada salvo que el formulario ya tenga esa versión (la produjo el propio guardado automático).
  useEffect(() => {
    const it = ficha.item;
    if (!it) return;
    const cur = formRef.current;
    if (cur.id === it.id && cur.version >= Number(it.version || 1)) return;
    const next = formFromRecord(it);
    savedSig.current = payloadSignature(next); paused.current = false; keyFor.current = { sig: '', key: '' };
    setForm(next); setErrors({}); setAuto({ state: 'saved', version: next.version, loaded: true });
  }, [ficha.item]);
  useEffect(() => {
    if (!ficha.item?.id || !ficha.item?.logo) { if (!formRef.current.logo.next) setLogoUrl(null); return undefined; }
    const c = new AbortController(); let url = null;
    fetchLogo(ficha.item.id, c.signal).then(u => { url = u; if (!c.signal.aborted) setLogoUrl(u); else if (u) URL.revokeObjectURL(u); }).catch(() => {});
    return () => { c.abort(); if (url) URL.revokeObjectURL(url); };
  }, [ficha.item]);
  const touch = k => setErrors(e => (e[k] ? { ...e, [k]: undefined } : e));
  const set = (k, v) => { setForm(x => ({ ...x, [k]: v })); touch(k); };
  const setPolicy = (k, v) => { setForm(x => ({ ...x, policy: { ...x.policy, [k]: v } })); touch(k); };
  const setRow = (k, i, v) => { setForm(x => ({ ...x, [k]: x[k].map((r, j) => (j === i ? v : r)) })); touch(k); };
  const addRow = k => { setForm(x => (x[k].length >= 20 ? x : { ...x, [k]: [...x[k], ''] })); touch(k); };
  const removeRow = (k, i) => { setForm(x => { const rows = x[k].filter((_, j) => j !== i); return { ...x, [k]: rows.length ? rows : [''] }; }); touch(k); };
  const fieldCls = 'w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400';
  const inp = k => `${fieldCls} ${errors[k] ? 'border-rose-400 bg-rose-50/30' : ''}`;
  const err = k => (errors[k] ? <p className="text-[10px] text-rose-600 mt-1" role="alert">{errors[k]}</p> : null);
  const onLogo = async file => {
    if (!file) return;
    setLogoBusy(true); touch('logo');
    try {
      const next = await compressLogo(file);
      setForm(x => ({ ...x, logo: { ...x.logo, next, remove: false } }));
    } catch (e) {
      setErrors(x => ({ ...x, logo: e.message === 'TYPE' ? tx('Solo se permiten imágenes PNG, JPG o WEBP.', 'Only PNG, JPG or WEBP images are allowed.') : e.message === 'SIZE' ? tx('La imagen es demasiado grande (máx. 8 MB antes de comprimir).', 'The image is too large (max 8 MB before compression).') : tx('No se pudo leer la imagen.', 'The image could not be read.') }));
    } finally { setLogoBusy(false); }
  };

  /** Saves the current form. mode 'auto' (debounced) or 'manual' (button). Returns 'clean'|'saved'|'invalid'|'paused'|'failed'. */
  const runSave = async mode => {
    if (inFlight.current) {
      queued.current = true;
      if (mode === 'manual') { await inFlight.current; return runSave('manual'); }
      return inFlight.current;
    }
    const cur = formRef.current;
    const sig = payloadSignature(cur);
    if (cur.id && sig === savedSig.current) {
      if (mode === 'manual') setSaveMsg({ kind: 'ok', text: tx(`Sin cambios pendientes: ${cur.code} ya está guardado en la matriz (versión ${cur.version}).`, `No pending changes: ${cur.code} is already saved in the matrix (version ${cur.version}).`) });
      return 'clean';
    }
    const v = validateForm(cur, en);
    if (!v.ok) {
      if (mode === 'manual') { setErrors(v.errors); setSaveMsg({ kind: 'error', text: tx('Revisa los campos marcados.', 'Check the highlighted fields.') }); }
      setAuto({ state: 'incomplete' });
      return 'invalid';
    }
    if (mode === 'auto' && paused.current) return 'paused';
    if (keyFor.current.sig !== sig) keyFor.current = { sig, key: newKey() };
    const payload = toPayload(cur);
    const sentLogo = cur.logo;
    setSaving(true); setAuto({ state: 'saving' });
    const job = (async () => {
      try {
        const r = await saveClient({ id: cur.id, version: cur.version, payload, key: keyFor.current.key });
        if (r.ok) {
          const created = !cur.id;
          paused.current = false;
          savedSig.current = payloadSignature({ ...cur, logo: { current: null, next: null, remove: false } });
          setForm(x => ({ ...x, id: r.data.id, version: r.data.version,
            logo: x.logo === sentLogo ? { current: sentLogo.next ? { name: sentLogo.next.name, mime: sentLogo.next.type, size: sentLogo.next.size } : sentLogo.remove ? null : sentLogo.current, next: null, remove: false } : x.logo }));
          if (sentLogo.next) setLogoUrl(sentLogo.next.dataUrl); else if (sentLogo.remove) setLogoUrl(null);
          const at = new Date();
          setLastSaved({ id: r.data.id, code: r.data.code, name: payload.name, version: r.data.version, at, created });
          setAuto({ state: 'saved', version: r.data.version, at });
          setSaveMsg(created || mode === 'manual' ? { kind: 'ok', text: created ? tx(`Cliente ${r.data.code} dado de alta en MariaDB y agregado a la matriz.`, `Client ${r.data.code} created in MariaDB and added to the matrix.`) : tx(`Cambios de ${r.data.code} guardados en la matriz (versión ${r.data.version}).`, `Changes to ${r.data.code} saved to the matrix (version ${r.data.version}).`) } : null);
          if (created || mode === 'manual') notify(tx('Clientes', 'Clients'), created ? tx(`Alta de ${r.data.code}`, `Created ${r.data.code}`) : tx(`Actualización de ${r.data.code}`, `Updated ${r.data.code}`), 'success');
          if (created) setSelectedId(r.data.id);
          setListRev(n => n + 1);
          return 'saved';
        }
        const code = r.data?.error?.code;
        if (r.status === 422 && r.data?.error?.field) setErrors(x => ({ ...x, [serverField(r.data.error.field)]: tx('Valor no aceptado por el servidor.', 'Value rejected by the server.') }));
        if (code === 'CODE_TAKEN') setErrors(x => ({ ...x, code: tx('Número ya registrado.', 'Number already registered.') }));
        // 4xx: el contenido debe corregirse (nueva clave); 5xx/en proceso: se reintenta con la misma clave.
        if (r.status < 500 && !String(code).startsWith('IDEMPOTENCY')) keyFor.current = { sig: '', key: '' };
        if (r.status === 412 || code === 'CATALOG_WRITE_NOT_PROVISIONED') paused.current = true;
        setAuto({ state: 'error' });
        setSaveMsg({ kind: code === 'CATALOG_WRITE_NOT_PROVISIONED' ? 'warn' : 'error', text: saveErrorMessage(r.status, code, en), reload: r.status === 412 });
        return 'failed';
      } catch {
        setAuto({ state: 'error' });
        setSaveMsg({ kind: 'error', text: tx('Sin conexión con el servidor. Puedes reintentar con "Guardar cliente": no se duplicará el registro.', 'No connection to the server. Retry with "Save client": the record will not be duplicated.') });
        return 'failed';
      } finally {
        setSaving(false); inFlight.current = null;
        if (queued.current) { queued.current = false; setTick(n => n + 1); }
      }
    })();
    inFlight.current = job;
    return job;
  };
  // Guardado automático: espera AUTOSAVE_MS sin cambios; nunca envía un formulario incompleto o inválido.
  useEffect(() => {
    const sig = payloadSignature(form);
    if (sig === savedSig.current) { if (!form.id) setAuto({ state: 'idle' }); return undefined; }
    if (!validateForm(form, en).ok) { setAuto({ state: 'incomplete' }); return undefined; }
    if (paused.current) { setAuto({ state: 'paused' }); return undefined; }
    setAuto({ state: 'pending' });
    const timer = setTimeout(() => { runSave('auto'); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [form, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  // Evita cerrar la pestaña con cambios sin guardar o un guardado en curso.
  useEffect(() => {
    const warn = e => { if (inFlight.current || (payloadSignature(formRef.current) !== savedSig.current && validateForm(formRef.current).ok && !paused.current)) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  /** Saves pending valid changes now (before clearing, leaving the card or switching client). */
  const flush = async () => {
    if (inFlight.current) await inFlight.current;
    const cur = formRef.current;
    if (payloadSignature(cur) === savedSig.current) return 'clean';
    if (!validateForm(cur, en).ok) return 'invalid';
    if (paused.current) return 'paused';
    return runSave('auto');
  };
  const newClient = () => { setSelectedId(''); const blank = emptyForm(); savedSig.current = payloadSignature(blank); paused.current = false; keyFor.current = { sig: '', key: '' }; setForm(blank); setErrors({}); setSaveMsg(null); setLogoUrl(null); setAuto({ state: 'idle' }); };
  const clearForm = async () => { if ((await flush()) !== 'failed') newClient(); };
  const goMatrix = async () => { if ((await flush()) !== 'failed') setTab('matrix'); };
  const pickClient = async id => { if ((await flush()) === 'failed') return; if (!id) { newClient(); return; } setSaveMsg(null); setSelectedId(id); };
  const goTab = async id => { if (tab === 'register' && id !== 'register' && (await flush()) === 'failed') return; setTab(id); };
  const save = () => runSave('manual');
  const autoText = (() => {
    const hhmm = d => d.toLocaleTimeString(en ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    switch (auto.state) {
      case 'saving': return tx('Guardando en MariaDB…', 'Saving to MariaDB…');
      case 'pending': return tx('Cambios sin guardar · se guardarán automáticamente…', 'Unsaved changes · saving automatically…');
      case 'saved': return auto.loaded ? tx(`Ficha cargada de la matriz (versión ${auto.version}). Los cambios se guardan automáticamente.`, `Record loaded from the matrix (version ${auto.version}). Changes are saved automatically.`) : tx(`✓ Guardado automáticamente en la matriz · versión ${auto.version} · ${hhmm(auto.at)}`, `✓ Saved automatically to the matrix · version ${auto.version} · ${hhmm(auto.at)}`);
      case 'incomplete': { const m = missingRequired(form, en); return m.length ? tx(`Para guardar automáticamente completa: ${m.join(', ')}.`, `To save automatically, fill in: ${m.join(', ')}.`) : tx('Corrige los campos marcados para guardar automáticamente.', 'Fix the highlighted fields to save automatically.'); }
      case 'paused': return tx('Guardado automático en pausa: revisa el aviso y usa "Guardar cliente".', 'Autosave paused: check the notice and use "Save client".');
      case 'error': return tx('No se pudo guardar automáticamente; revisa el aviso.', 'Could not save automatically; check the notice.');
      default: return tx('El guardado automático inicia al completar No. de cliente, razón social, proyecto y número de contrato.', 'Autosave starts once client number, legal name, project and contract number are filled in.');
    }
  })();

  // ---------- Indicadores ----------
  const [fullList, setFullList] = useState(null);
  useEffect(() => {
    if (tab !== 'indicators') return undefined;
    const c = new AbortController();
    listCatalog('clients', { page: 1, pageSize: 50, q: '', status: 'all' }, c.signal)
      .then(r => { if (!c.signal.aborted) setFullList(Number(r.total) <= (r.items || []).length ? r.items : null); })
      .catch(() => { if (!c.signal.aborted) setFullList(null); });
    return () => c.abort();
  }, [tab, revision, listRev]);
  const ind = useMemo(() => clientIndicators(summary, fullList, all.items), [summary, fullList, all.items]);

  // ---------- Importación (vista previa local) ----------
  const [file, setFile] = useState(null);
  const [sheet, setSheet] = useState({ headers: [], rows: [] });
  const [importError, setImportError] = useState('');
  const [reading, setReading] = useState(false);
  const [opts, setOpts] = useState({ defaultProject: '', defaultContract: '', duplicateMode: 'skip', newStatus: 'active', newPortal: 'disabled' });
  const analysis = useMemo(() => analyzeImport(sheet.headers, sheet.rows, all.items.map(c => c.code), opts), [sheet, all.items, opts]);
  const readFile = async (picked) => {
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
      const headers = (data[0] || []).map((h, i) => (String(h ?? '').trim() || `COLUMNA_${i + 1}`));
      setFile(picked); setSheet({ headers, rows: data.slice(1, 5001) });
      notify(tx('Importador Excel', 'Excel importer'), tx(`Archivo leído localmente (${Math.max(0, data.length - 1)} filas). No se guardó nada.`, `File read locally (${Math.max(0, data.length - 1)} rows). Nothing was saved.`));
    } catch {
      setImportError(tx('No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.', 'The file could not be read. Check it is a valid Excel or CSV file.'));
    } finally { setReading(false); }
  };
  const resetImport = () => { setFile(null); setSheet({ headers: [], rows: [] }); setImportError(''); setOpts({ defaultProject: '', defaultContract: '', duplicateMode: 'skip', newStatus: 'active', newPortal: 'disabled' }); };
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'Plantilla_clientes_SupplyFlow.xlsx');
  };

  const cardKeys = ['register', 'matrix', 'indicators', 'import'];
  const statusOptions = Array.isArray(summary.statuses) ? summary.statuses : [];

  return <div className="space-y-6">
    {/* Header */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{t.headerTitle}</h2><p className="text-xs text-slate-500">{t.headerSubtitle}</p></div>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{t.source}</span>
        <button type="button" onClick={() => setRevision(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{t.refresh}</button>
      </div>
    </div>

    {/* Grid de las 4 Tarjetas Superior */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cardKeys.map(id => { const c = t.cards[id]; const active = tab === id; return <button key={id} type="button" onClick={() => goTab(id)} aria-pressed={active}
        className={`text-left p-5 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-36 border ${active ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-1' : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors ${active ? 'bg-white/20 backdrop-blur-md' : 'bg-blue-50/80 border border-blue-100/50'}`}><span>{c.emoji}</span></div>
        <div><h3 className={`text-sm font-bold tracking-tight ${active ? 'text-white' : 'text-slate-800'}`}>{c.title}</h3><p className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${active ? 'text-blue-100' : 'text-slate-400'}`}>{c.desc}</p></div>
      </button>; })}
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{t.lock}</span></div>

    {/* Contenedor dinámico */}
    <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[400px]">

      {/* TARJETA 1: Registro y actualización (alta/edición real con CSRF, idempotencia, versión y auditoría) */}
      {tab === 'register' && <div className="space-y-6" data-testid="client-form">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
          <div><h3 className="text-base font-black text-slate-800">{tx('Alta y actualización de clientes', 'Client Registration and Update')}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{tx('El número de cliente es único por organización. Selecciona un cliente registrado para editarlo o captura uno nuevo.', 'The client number is unique per organization. Select a registered client to edit it or enter a new one.')}</p></div>
          <div className="flex flex-col items-start sm:items-end gap-1"><span data-testid="form-mode" className={`px-3 py-1 font-bold text-[10px] rounded-full border ${form.id ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{form.id ? `${tx('Editando', 'Editing')} ${form.code || ''} · v${form.version}` : tx('Nuevo registro', 'New record')}</span>
            <span data-testid="autosave-status" aria-live="polite" className={`text-[10px] font-semibold flex items-center gap-1 ${auto.state === 'saved' ? 'text-emerald-600' : auto.state === 'error' || auto.state === 'paused' ? 'text-rose-600' : auto.state === 'pending' || auto.state === 'saving' ? 'text-amber-600' : 'text-slate-400'}`}>{auto.state === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}{autoText}</span></div>
        </div>
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Field label={tx('No. de cliente', 'Client No.')} required>
              <select aria-label={tx('Seleccionar por número de cliente', 'Select by client number')} value={form.id || selectedId} onChange={e => pickClient(e.target.value)} className={`${fieldCls} mb-1.5 font-semibold`}>
                <option value="">{tx('+ Nuevo cliente / captura manual', '+ New client / manual entry')}</option>
                {[...all.items].sort((a, b) => String(a.code).localeCompare(String(b.code), 'es', { numeric: true })).map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
              <input type="text" aria-label={tx('No. de cliente', 'Client No.')} value={form.code} maxLength={80} onChange={e => set('code', e.target.value)} placeholder={tx('Ej. CLI-001, WDS-1001 o código interno', 'e.g. CLI-001, WDS-1001 or internal code')} className={inp('code')} />
              {err('code') || <p className="text-[10px] text-blue-700/70 mt-1">{tx('Selecciona un número registrado para cargar todos los datos del cliente. El número continuará editable.', 'Select a registered number to load all client data. The number stays editable.')}</p>}
            </Field>
            <Field label={tx('Razón social / Legal company name', 'Company Name / Legal Name')} required>
              <select aria-label={tx('Seleccionar por razón social', 'Select by legal name')} value={form.id || selectedId} onChange={e => pickClient(e.target.value)} className={`${fieldCls} mb-1.5 font-semibold`}>
                <option value="">{tx('+ Nueva compañía / captura manual', '+ New company / manual entry')}</option>
                {[...all.items].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" aria-label={tx('Razón social', 'Legal name')} value={form.name} maxLength={255} onChange={e => set('name', e.target.value)} placeholder={tx('Escribe o edita la razón social', 'Type or edit the legal name')} className={inp('name')} />
              {err('name') || <p className="text-[10px] text-blue-700/70 mt-1">{tx('Selecciona una compañía registrada para cargar automáticamente No. de cliente, RFC, proyecto, contrato, contactos, correos y demás datos. Todos los campos seguirán editables.', 'Select a registered company to load client number, tax ID, project, contract, contacts, emails and other data. Every field stays editable.')}</p>}
            </Field>
            <Field label={tx('Nombre comercial / Brand name', 'Commercial Name / Brand Name')}><input type="text" aria-label={tx('Nombre comercial', 'Brand name')} value={form.brand_name} maxLength={255} onChange={e => set('brand_name', e.target.value)} placeholder={tx('Nombre con el que se identifica comercialmente', 'Name used commercially')} className={inp('brand_name')} /></Field>
          </div>
          {all.error && <p role="alert" className="text-[11px] text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{all.error}</p>}
          {ficha.loading && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Consultando ficha en MariaDB…', 'Loading record from MariaDB…')}</p>}
          {ficha.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{ficha.error}</p>}
          {form.id && form.imported && <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-[11px] text-amber-900">{tx('Cliente importado del sistema anterior: al guardar, los cambios quedan registrados en la bitácora con sus valores anteriores.', 'Client imported from the previous system: saving records the changes in the audit log with their previous values.')}{f?.data_incomplete ? tx(' La importación lo marcó con datos incompletos; completa proyecto y contrato.', ' The import flagged it as incomplete; fill in project and contract.') : ''}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label={tx('RFC / Tax ID', 'RFC / Tax ID')}><input type="text" aria-label="RFC" value={form.tax_id} maxLength={64} onChange={e => set('tax_id', e.target.value)} placeholder={tx('RFC o ID fiscal', 'Tax ID')} className={inp('tax_id')} />{err('tax_id')}</Field>
            <Field label={tx('Proyecto', 'Project')} required><input type="text" aria-label={tx('Proyecto', 'Project')} value={form.project} maxLength={255} onChange={e => set('project', e.target.value)} placeholder={tx('Nombre del proyecto', 'Project name')} className={inp('project')} />{err('project')}</Field>
            <Field label={tx('Número de contrato', 'Contract Number')} required><input type="text" aria-label={tx('Número de contrato', 'Contract number')} value={form.contract_reference} maxLength={255} onChange={e => set('contract_reference', e.target.value)} placeholder="Ej. CTR-2026-001" className={inp('contract_reference')} />{err('contract_reference')}</Field>
            <Field label={tx('Teléfono', 'Phone')}><input type="tel" aria-label={tx('Teléfono', 'Phone')} value={form.phone} maxLength={200} onChange={e => set('phone', e.target.value)} placeholder="833-456-7890" className={inp('phone')} />{err('phone')}</Field>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[['contacts', tx('Contactos', 'Contacts'), tx('Nombre del contacto', 'Contact name'), tx('Agregar otro contacto', 'Add another contact'), 'text'], ['emails', tx('Correos electrónicos', 'Email Addresses'), 'correo@empresa.com', tx('Agregar otro correo', 'Add another email'), 'email']].map(([k, label, ph, add, type]) =>
              <Field key={k} label={label}><div className="space-y-2" data-testid={`rows-${k}`}>
                {form[k].map((v, i) => <div key={i} className="flex gap-2"><input type={type} aria-label={`${label} ${i + 1}`} value={v} maxLength={k === 'emails' ? 254 : 255} onChange={e => setRow(k, i, e.target.value)} placeholder={ph} className={inp(k)} />
                  <button type="button" aria-label={`${tx('Quitar', 'Remove')} ${label} ${i + 1}`} onClick={() => removeRow(k, i)} className="w-10 shrink-0 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 flex items-center justify-center"><X className="w-4 h-4" /></button></div>)}
                <button type="button" onClick={() => addRow(k)} disabled={form[k].length >= 20} className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />{add}</button>
                {err(k)}
              </div></Field>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={tx('Estatus', 'Status')}><select aria-label={tx('Estatus', 'Status')} value={form.status} onChange={e => set('status', e.target.value)} className={fieldCls}>{STATUSES.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select></Field>
            <Field label={tx('Portal del cliente', 'Customer Portal')}><select disabled aria-label={tx('Portal del cliente', 'Customer portal')} value={form.portal_enabled ? 'enabled' : 'disabled'} className={`${fieldCls} bg-slate-50 cursor-not-allowed`}><option value="enabled">{tx('Habilitado', 'Enabled')}</option><option value="disabled">{tx('Deshabilitado', 'Disabled')}</option></select></Field>
            <Field label={tx('Clave de acceso al portal', 'Portal Access Key')}>
              <div className="flex gap-2"><input type="text" disabled aria-label={tx('Clave del portal', 'Portal key')} placeholder={tx('Asigna una clave de 4 a 20 caracteres', 'Assign a 4 to 20 character key')} className={`${fieldCls} bg-slate-50 cursor-not-allowed`} />
                <button type="button" disabled title={tx('Requiere el diseño de seguridad del Portal del Cliente', 'Requires the Customer Portal security design')} className="px-3 py-2 bg-slate-200 text-slate-500 text-[11px] font-bold rounded-xl whitespace-nowrap flex items-center gap-1 cursor-not-allowed"><KeyRound className="w-3.5 h-3.5" />{tx('Generar y habilitar', 'Generate & enable')}</button></div>
              <p className="text-[10px] text-amber-600 mt-1 leading-tight">{tx('El portal y su clave se habilitarán con el diseño de seguridad del Portal del Cliente (claves con hash, vencimiento y bitácora). Nunca se guardan claves en texto.', 'The portal and its key will be enabled with the Customer Portal security design (hashed keys, expiry and audit). Keys are never stored in plain text.')}</p>
            </Field>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Field label={tx('Dirección', 'Address')}><input type="text" aria-label={tx('Dirección', 'Address')} value={form.address} maxLength={2000} onChange={e => set('address', e.target.value)} className={inp('address')} /></Field>
            <Field label={tx('Condiciones comerciales', 'Commercial Terms')}><input type="text" aria-label={tx('Condiciones comerciales', 'Commercial terms')} value={form.terms} maxLength={2000} onChange={e => set('terms', e.target.value)} placeholder={tx('Ej. Crédito 30 días', 'e.g. Net 30')} className={inp('terms')} /></Field>
          </div>
          <Field label={tx('Logotipo del cliente', 'Client Logo')}>
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30 flex flex-col sm:flex-row items-start sm:items-center gap-4" data-testid="logo-box">
              <div className="w-24 h-20 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400 font-semibold shrink-0 overflow-hidden">
                {form.logo.next ? <img src={form.logo.next.dataUrl} alt={tx('Vista previa del logotipo', 'Logo preview')} className="max-w-full max-h-full object-contain" />
                  : !form.logo.remove && logoUrl ? <img src={logoUrl} alt={tx('Logotipo actual', 'Current logo')} className="max-w-full max-h-full object-contain" />
                  : <span>{tx('Sin logotipo', 'No logo')}</span>}
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileRef} id="client-logo-file" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => { onLogo(e.target.files?.[0]); e.target.value = ''; }} />
                  <label htmlFor="client-logo-file" className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg cursor-pointer flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />{tx('Elegir archivo', 'Choose file')}</label>
                  <span className="text-[11px] text-slate-500 truncate max-w-[260px]" data-testid="logo-name">{logoBusy ? tx('Procesando imagen…', 'Processing image…') : form.logo.next ? `${form.logo.next.name} · ${Math.round(form.logo.next.size / 1024)} KB` : !form.logo.remove && form.logo.current ? form.logo.current.name || tx('Logotipo registrado', 'Recorded logo') : tx('No se ha seleccionado ningún archivo', 'No file selected')}</span>
                  {(form.logo.next || (form.logo.current && !form.logo.remove)) && <button type="button" onClick={() => setForm(x => ({ ...x, logo: { ...x.logo, next: null, remove: !!x.logo.current } }))} className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg">{tx('Quitar logotipo', 'Remove logo')}</button>}
                  {form.logo.remove && <button type="button" onClick={() => setForm(x => ({ ...x, logo: { ...x.logo, remove: false } }))} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg">{tx('Conservar logotipo', 'Keep logo')}</button>}
                </div>
                <p className="text-[10px] text-slate-400">{tx('Formatos permitidos: PNG, JPG o WEBP. La imagen se comprime antes de guardarse.', 'Allowed formats: PNG, JPG or WEBP. The image is compressed before saving.')}</p>
                {err('logo')}
              </div>
            </div>
          </Field>
          <Field label={tx('Observaciones', 'Notes / Comments')}><textarea rows={3} aria-label={tx('Observaciones', 'Notes')} value={form.notes} maxLength={4000} onChange={e => set('notes', e.target.value)} className={`${inp('notes')} resize-y`} /></Field>

          {/* Política de precios y recompra (clients.repeat_*) */}
          <section aria-label={tx('Política de precios y recompra', 'Pricing and repurchase policy')} data-testid="repeat-policy" className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/40 p-5 space-y-4">
            <div><h4 className="text-sm font-black text-slate-900 flex items-center gap-2"><span aria-hidden="true">🕘</span>{tx('Política de precios y recompra', 'Pricing and repurchase policy')}</h4>
              <p className="text-[11px] text-blue-700/80 mt-1">{tx('Define cómo debe tratar SupplyFlow una nueva solicitud que reutilice artículos o servicios históricos de este cliente. El precio al cliente y el abastecimiento del proveedor se controlan por separado.', 'Defines how SupplyFlow should treat a new request that reuses this client’s historical items or services. Client price and supplier sourcing are controlled separately.')}</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label={tx('Política de precio al cliente', 'Client price policy')}><select aria-label={tx('Política de precio al cliente', 'Client price policy')} value={form.policy.sales} onChange={e => setPolicy('sales', e.target.value)} className={inp('sales')}>
                <option value="">{tx('Sin política registrada', 'No policy recorded')}</option>{form.legacy.sales && <option value={form.legacy.sales}>{tx('Valor histórico', 'Historical value')}: {form.legacy.sales}</option>}
                {SALES_POLICIES.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select>{err('sales')}</Field>
              <Field label={tx('Política de abastecimiento', 'Sourcing policy')}><select aria-label={tx('Política de abastecimiento', 'Sourcing policy')} value={form.policy.sourcing} onChange={e => setPolicy('sourcing', e.target.value)} className={inp('sourcing')}>
                <option value="">{tx('Sin política registrada', 'No policy recorded')}</option>{form.legacy.sourcing && <option value={form.legacy.sourcing}>{tx('Valor histórico', 'Historical value')}: {form.legacy.sourcing}</option>}
                {SOURCING_POLICIES.map(([v, es, e]) => <option key={v} value={v}>{en ? e : es}</option>)}</select>{err('sourcing')}</Field>
              <Field label={tx('Vigencia del precio histórico (días)', 'Historical price validity (days)')}><input type="number" min="0" max="3650" step="1" aria-label={tx('Vigencia del precio histórico (días)', 'Historical price validity (days)')} value={form.policy.days} onChange={e => setPolicy('days', e.target.value)} placeholder="0" className={inp('days')} />{err('days') || <p className="text-[10px] text-blue-700/70 mt-1">{tx('0 = sin vencimiento automático por días; aplican contrato y revisión comercial.', '0 = no automatic expiry by days; contract and commercial review apply.')}</p>}</Field>
              <Field label={tx('Referencia de contrato / Price List', 'Contract reference / Price List')}><input type="text" aria-label={tx('Referencia de contrato / Price List', 'Contract reference / Price List')} value={form.policy.ref} maxLength={255} onChange={e => setPolicy('ref', e.target.value)} placeholder={tx('Ej. Rate Card 2026 / Anexo B', 'e.g. Rate Card 2026 / Annex B')} className={inp('ref')} /></Field>
              <Field label={tx('Vigencia contractual hasta', 'Contract valid until')}><input type="date" aria-label={tx('Vigencia contractual hasta', 'Contract valid until')} value={form.policy.until} onChange={e => setPolicy('until', e.target.value)} className={inp('until')} />{err('until')}</Field>
              <Field label={tx('Margen mínimo de referencia %', 'Minimum reference margin %')}><input type="number" min="0" max="100" step="0.01" aria-label={tx('Margen mínimo de referencia %', 'Minimum reference margin %')} value={form.policy.margin} onChange={e => setPolicy('margin', e.target.value)} placeholder="0" className={inp('margin')} />{err('margin')}</Field>
            </div>
            <div className="rounded-xl border-l-4 border-blue-600 bg-blue-50/70 px-4 py-2.5 text-[11px] text-slate-700"><strong className="text-slate-900">{tx('Regla:', 'Rule:')}</strong> {en ? <>a guaranteed price policy does <u>not</u> imply reusing the supplier cost. You can honor the client price and, at the same time, require new supplier quotations.</> : <>una política de precio garantizado <u>no</u> implica reutilizar el costo del proveedor. Puedes respetar el precio al cliente y, al mismo tiempo, obligar a obtener nuevas cotizaciones de proveedores.</>}</div>
          </section>

          {saveMsg && <div role={saveMsg.kind === 'ok' ? 'status' : 'alert'} data-testid="save-message" className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${saveMsg.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : saveMsg.kind === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{saveMsg.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{saveMsg.text}</span>{saveMsg.reload && <button type="button" onClick={() => { setSaveMsg(null); setRevision(n => n + 1); }} className="ml-auto px-3 py-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-[11px] rounded-lg whitespace-nowrap">{tx('Recargar ficha', 'Reload record')}</button>}</div>}
          <div data-testid="form-actions" className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={save} disabled={saving || logoBusy} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span aria-hidden="true">💾</span>}<span className="text-sm font-bold">{tx('Guardar cliente', 'Save client')}</span></button>
            <button type="button" onClick={clearForm} disabled={saving} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-2"><span aria-hidden="true">🧹</span><span className="text-sm font-bold">{tx('Limpiar', 'Clear')}</span></button>
            <button type="button" onClick={goMatrix} disabled={saving} className="px-5 py-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-xs flex items-center gap-2"><span aria-hidden="true">📋</span><span className="text-sm font-bold">{tx('Ver matriz', 'View matrix')}</span></button>
          </div>
        </div>
      </div>}

      {/* TARJETA 2: Matriz de clientes */}
      {tab === 'matrix' && <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div><h3 className="text-base font-black text-slate-800">{tx('Matriz de clientes', 'Client Matrix')}</h3><p className="text-[11px] text-slate-400 mt-0.5">{tx(`${summary.total ?? 0} clientes registrados · ${total} coincidencias · ${summary.incomplete ?? 0} con información incompleta.`, `${summary.total ?? 0} registered clients · ${total} matches · ${summary.incomplete ?? 0} incomplete.`)}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setTab('import')} className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />{tx('Importar Excel', 'Import Excel')}</button>
            <button type="button" onClick={() => { newClient(); setTab('register'); }} className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />{tx('Nuevo cliente', 'New Client')}</button>
          </div>
        </div>
        {lastSaved && <div data-testid="last-saved" className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900 flex flex-wrap items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{lastSaved.created ? tx('Alta guardada', 'Created') : tx('Cambios guardados', 'Changes saved')}: <strong>{lastSaved.code}</strong> · {lastSaved.name} · {tx('versión', 'version')} {lastSaved.version} · {lastSaved.at.toLocaleTimeString(en ? 'en-US' : 'es-MX')}</span>
          <button type="button" onClick={() => { setInput(lastSaved.code); setQ(lastSaved.code); setPage(1); setStatus('all'); }} className="ml-auto px-3 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg">{tx('Mostrar en la matriz', 'Show in the matrix')}</button>
          <button type="button" onClick={() => openFicha(lastSaved.id)} className="px-3 py-1 bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg">{tx('Abrir ficha', 'Open record')}</button>
        </div>}
        <div className="space-y-3">
          <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="search" value={input} onChange={e => setInput(e.target.value)} aria-label={tx('Buscar en catálogo', 'Search catalog')} placeholder={tx('Buscar por número, razón social, nombre comercial, proyecto, contrato, RFC, contacto o correo...', 'Search by number, company name, brand name, project, contract, Tax ID, contact, or email...')} className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 transition-all" /></div>
          <select aria-label={tx('Estatus', 'Status')} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="w-full md:w-64 px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="all">{tx('Todos los estatus', 'All statuses')}</option>{statusOptions.map(s => <option key={s.code} value={s.code}>{translateStatus(s.code, en)} ({s.count})</option>)}
          </select>
        </div>
        {busy && <div className="p-6 text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{tx('Consultando datos reales...', 'Loading real records...')}</div>}
        {error && <div className="p-6 text-rose-700 text-xs flex gap-2" role="alert"><AlertCircle className="w-4 h-4" />{error}</div>}
        {!busy && !error && <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-xs"><div className="overflow-x-auto"><table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            {[tx('Logo', 'Logo'), tx('No.', 'No.'), tx('Razón social / Marca', 'Company / Brand'), tx('Proyecto', 'Project'), tx('No. Contrato', 'Contract No.'), 'RFC', tx('Contactos y correos', 'Contacts & Emails'), tx('Estatus', 'Status'), 'Portal'].map(h => <th key={h} className="py-3 px-3">{h}</th>)}
            <th className="py-3 px-3 text-center">{tx('Req.', 'Req.')}</th><th className="py-3 px-3 text-center sticky right-0 bg-slate-50 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">{tx('Acciones', 'Actions')}</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {list.items.length === 0 ? <tr><td colSpan={11} className="py-12 text-center text-slate-400"><div className="flex flex-col items-center justify-center space-y-2"><span className="text-3xl">📋</span><p className="font-semibold text-slate-600 text-xs">{tx('No se encontraron clientes.', 'No clients found.')}</p><p className="text-[11px] text-slate-400">{tx('Ajusta la búsqueda o el estatus.', 'Adjust the search or status.')}</p></div></td></tr>
              : list.items.map(c => <tr key={c.id} data-saved={lastSaved?.id === c.id ? 'true' : undefined} className={`transition-colors align-top ${lastSaved?.id === c.id ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-slate-50/50'}`}>
                <td className="py-3 px-3"><div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">{initials(c.name)}</div></td>
                <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">{c.code}{lastSaved?.id === c.id && <div className="text-[9px] font-bold text-emerald-700">✓ {tx('Recién guardado', 'Just saved')}</div>}</td>
                <td className="py-3 px-3 min-w-[180px]"><div className="font-bold text-slate-800">{c.name}</div><div className="text-[10px] text-indigo-600 font-semibold">{c.brand_name || ''}</div>{c.data_incomplete && <div className="text-[10px] text-amber-700 font-semibold">{tx('Información incompleta', 'Incomplete information')}</div>}</td>
                <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{show(c.project)}</td>
                <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{show(c.contract_reference)}</td>
                <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{show(c.tax_id)}</td>
                <td className="py-3 px-3 min-w-[165px]"><div className="space-y-1"><span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md border border-slate-200">{c.primary_contact || tx('Sin contacto', 'No contact')}</span><div className="text-[10px] text-slate-500 font-mono [overflow-wrap:anywhere]">{show(c.primary_email)}</div></div></td>
                <td className="py-3 px-3"><span title={c.legacy_status || ''} className={`px-2 py-0.5 font-bold text-[10px] rounded-full border ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{translateStatus(c.status, en)}</span></td>
                <td className="py-3 px-3"><div className="text-[11px] font-bold text-slate-700">{c.portal_enabled ? tx('Habilitado', 'Enabled') : tx('Deshabilitado', 'Disabled')}</div></td>
                <td className="py-3 px-3 text-center font-bold text-slate-700 tabular-nums">{c.requisition_count}</td>
                <td className="py-3 px-3 sticky right-0 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"><div className="flex flex-col items-stretch gap-1 min-w-[84px]">
                  <button type="button" onClick={() => setDetailId(c.id)} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer border border-blue-100"><Eye className="w-3 h-3" />{tx('Ver', 'View')}</button>
                  <button type="button" onClick={() => openFicha(c.id)} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer"><Edit3 className="w-3 h-3" />{tx('Ficha', 'Record')}</button>
                  <button type="button" disabled={!c.portal_enabled} onClick={() => onNavigate('portal')} title={c.portal_enabled ? tx('Abrir Portal del Cliente', 'Open Customer Portal') : tx('Portal deshabilitado para este cliente', 'Portal disabled for this client')} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer"><ExternalLink className="w-3 h-3" />PORTAL</button>
                </div></td>
              </tr>)}
          </tbody></table></div>
          <div className="p-4 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between text-xs text-slate-600"><div>{tx('Página', 'Page')} {page} / {lastPage} · {total} {tx('coincidencias', 'matches')}</div>
            <div className="flex gap-2"><button type="button" disabled={busy || page <= 1} aria-label={tx('Página anterior', 'Previous page')} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" onClick={() => setPage(n => Math.max(1, n - 1))}><ChevronLeft className="w-4 h-4" /></button><button type="button" disabled={busy || page >= lastPage} aria-label={tx('Página siguiente', 'Next page')} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40" onClick={() => setPage(n => n + 1)}><ChevronRight className="w-4 h-4" /></button></div></div>
        </div>}
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{tx('Registros de la base de datos; sin datos de demostración como respaldo.', 'Database-backed records; no demo fallback.')}</p>
      </div>}

      {/* TARJETA 3: Indicadores de clientes */}
      {tab === 'indicators' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h3 className="text-base font-black text-slate-800">{tx('Indicadores de clientes', 'Client Key Indicators')}</h3><p className="text-[11px] text-slate-400 mt-0.5">{tx('Resumen calculado con la información registrada en MariaDB.', 'Summary calculated from the data stored in MariaDB.')}</p></div>
          <button type="button" onClick={() => setTab('matrix')} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"><span>📋</span>{tx('Consultar matriz', 'View matrix')}</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[[ind.active, tx('Clientes activos', 'Active clients'), 'bg-emerald-50/50 border-l-emerald-500'], [ind.total, tx('Total registrados', 'Total registered'), 'bg-blue-50/50 border-l-blue-600'],
              [ind.incomplete, tx('Con información incompleta', 'With incomplete information'), 'bg-amber-50/50 border-l-amber-500'], [ind.portal === null ? DASH : ind.portal, tx('Portal habilitado', 'Portal enabled'), 'bg-purple-50/50 border-l-purple-500']].map(([n, label, cls]) =>
              <div key={label} className={`p-4 ${cls} border-l-4 rounded-r-xl border border-slate-100/80`}><div className="text-xl font-black text-slate-900 tabular-nums">{n}</div><div className="text-xs text-slate-500 font-medium">{label}</div></div>)}
          </div>
          <div className="p-4 bg-blue-50/50 border-l-4 border-l-blue-600 rounded-r-xl border border-slate-100/80">
            <div className="text-xs font-bold text-slate-900">{tx('Mayor actividad:', 'Highest activity:')}</div>
            {all.loading ? <div className="text-xs text-slate-500 mt-0.5">{tx('Consultando…', 'Loading…')}</div> : ind.top.length ? <div className="mt-1.5 space-y-1">{ind.top.map((c, i) =>
              <div key={c.id} className="text-xs text-slate-600 flex justify-between gap-3"><span className="min-w-0 break-words"><b className="text-blue-700 mr-1">{i + 1}.</b>{c.name}</span><span className="font-bold text-slate-800 shrink-0 tabular-nums">{c.requisitions} {tx('requisiciones', 'requisitions')}</span></div>)}</div>
              : <div className="text-xs text-slate-600 mt-0.5">{tx('Sin datos de actividad aún.', 'No activity data available yet.')}</div>}
            <div className="text-[10px] text-slate-400 mt-2">{tx(`${ind.withRequisitions} de ${all.items.length} cliente(s) tienen requisiciones.`, `${ind.withRequisitions} of ${all.items.length} client(s) have requisitions.`)}</div>
          </div>
          {ind.statuses.length > 0 && <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-2"><div className="text-xs font-bold text-slate-900">{tx('Distribución por estatus', 'Status distribution')}</div>
            {ind.statuses.map(s => <div key={s.code} className="flex items-center gap-3 text-xs"><span className="w-28 text-slate-600 font-semibold">{translateStatus(s.code, en)}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.code === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${ind.total ? s.count * 100 / ind.total : 0}%` }} /></div><span className="w-8 text-right font-black tabular-nums">{s.count}</span></div>)}</div>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {[[tx('Uso del catálogo', 'Catalog Usage'), tx('Relación con requisiciones.', 'Link with requisitions.'), tx('Cada requisición nueva debe quedar asociada con un cliente registrado y activo (validado también en el servidor).', 'Every new requisition must be linked to a registered, active client (also enforced server-side).'), 'bg-blue-50/50 border-l-blue-600'],
            [tx('Control recomendado', 'Recommended Control'), tx('Evita duplicidades.', 'Prevents duplicates.'), tx('MariaDB impide números de cliente repetidos dentro de la organización. La comparación en la base distingue mayúsculas; la vista previa de importación compara sin distinguirlas, como el sistema original.', 'MariaDB prevents repeated client numbers within the organization. The database comparison is case-sensitive; the import preview compares case-insensitively, as in the original system.'), 'bg-amber-50/50 border-l-amber-500'],
            [tx('Estatus del cliente', 'Client Status'), tx('Disponibilidad operativa.', 'Operational availability.'), tx('Solo los clientes activos aparecen para crear nuevas requisiciones; al editar se conserva el cliente original aunque esté inactivo.', 'Only active clients are offered for new requisitions; editing keeps the original client even if inactive.'), 'bg-emerald-50/50 border-l-emerald-500']].map(([title, sub, info, cls]) =>
            <div key={title} className="p-5 bg-white border border-slate-200/80 rounded-2xl flex flex-col justify-between space-y-3"><div><h4 className="text-xs font-bold text-slate-800">{title}</h4><p className="text-[10px] text-slate-400">{sub}</p></div><div className={`p-3 ${cls} border-l-4 rounded-r-xl border border-slate-100/80 text-[11px] text-slate-600 leading-relaxed`}>{info}</div></div>)}
        </div>
      </div>}

      {/* TARJETA 4: Importar Excel (vista previa local, sin guardado) */}
      {tab === 'import' && <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div><h3 className="text-base font-black text-slate-800">{tx('Importación masiva de clientes desde Excel', 'Bulk Client Import from Excel')}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{tx('Analiza el archivo y valida duplicados contra los clientes registrados en MariaDB. La lectura es local: el archivo no se envía ni se guarda.', 'Analyzes the file and checks duplicates against clients stored in MariaDB. Reading is local: the file is not uploaded or saved.')}</p></div>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 font-bold text-[10px] rounded-full border border-purple-200">Excel / XLSX / XLS / CSV</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); readFile(e.dataTransfer?.files?.[0]); }} className="border-2 border-dashed border-blue-200 rounded-2xl p-8 bg-blue-50/20 text-center flex flex-col items-center justify-center transition-colors hover:bg-blue-50/40">
              <div className="w-12 h-12 bg-white rounded-xl shadow-xs border border-slate-100 flex items-center justify-center mb-3 text-2xl">📊</div>
              <h4 className="text-sm font-bold text-slate-800">{tx('Selecciona o arrastra el archivo de clientes', 'Select or drag client file here')}</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm">{tx('Se utiliza la primera hoja del libro. Se analizan hasta 5,000 filas.', 'The first sheet is used. Up to 5,000 rows are analyzed.')}</p>
              <label className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all inline-flex items-center gap-2"><Upload className="w-3.5 h-3.5" />{tx('Seleccionar archivo', 'Select File')}
                <input type="file" className="hidden" accept=".xlsx,.xls,.csv" aria-label={tx('Archivo de clientes', 'Client file')} onChange={e => { readFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
              <p className="text-[11px] text-slate-400 font-medium mt-3">{reading ? tx('Leyendo…', 'Reading…') : file ? file.name : tx('Ningún archivo seleccionado.', 'No file selected.')}</p>
            </div>
            {importError && <p role="alert" className="text-xs text-rose-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{importError}</p>}
            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed"><span className="font-bold text-blue-900">{tx('Columnas reconocidas:', 'Recognized Columns:')}</span> {tx('Client number, Legal / company name, Brand name, RFC, Email y Contact (también Email 2, Email 3, Contact 2, Contact 3, Project y Contract number, y sus equivalentes en español). Una celda puede tener varios valores separados por punto y coma, coma, barra vertical o salto de línea. Conserva Client number y RFC como texto en Excel para no perder ceros iniciales.', 'Client number, Legal / company name, Brand name, RFC, Email and Contact (also Email 2, Email 3, Contact 2, Contact 3, Project and Contract number, and Spanish equivalents). A cell may hold several values separated by semicolon, comma, vertical bar or newline. Keep Client number and Tax ID as text in Excel to preserve leading zeros.')}</div>
            <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl text-[11px] text-slate-600 leading-relaxed"><span className="font-bold text-amber-900">{tx('Importación editable:', 'Editable import:')}</span> {tx('en el sistema original, las filas con datos faltantes se guardaban como registros incompletos e inactivos (número o nombre provisional). Esta vista previa las identifica; el guardado se habilitará con el endpoint de importación.', 'in the original system, rows with missing data were saved as incomplete, inactive records (provisional number or name). This preview flags them; saving will be enabled with the import endpoint.')}</div>
          </div>
          <div className="p-5 bg-slate-50/40 border border-slate-200/70 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-slate-800">{tx('Reglas para la importación', 'Import Rules')}</h4>
            <Field label={tx('Proyecto predeterminado (opcional)', 'Default Project (optional)')}><input type="text" value={opts.defaultProject} onChange={e => setOpts(o => ({ ...o, defaultProject: e.target.value }))} placeholder={tx('Se aplica cuando la fila no incluye Project', 'Applied when row lacks Project')} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" /><p className="text-[10px] text-slate-400 mt-1">{tx('Si permanece vacío, la fila se marca como incompleta.', 'If blank, the row is flagged as incomplete.')}</p></Field>
            <Field label={tx('Número de contrato predeterminado (opcional)', 'Default Contract Number (optional)')}><input type="text" value={opts.defaultContract} onChange={e => setOpts(o => ({ ...o, defaultContract: e.target.value }))} placeholder={tx('Se aplica cuando la fila no incluye Contract number', 'Applied when row lacks Contract number')} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" /><p className="text-[10px] text-slate-400 mt-1">{tx('Si permanece vacío, la fila se marca como incompleta.', 'If blank, the row is flagged as incomplete.')}</p></Field>
            <Field label={tx('Tratamiento de números de cliente existentes', 'Existing Client Numbers Handling')}><select value={opts.duplicateMode} onChange={e => setOpts(o => ({ ...o, duplicateMode: e.target.value }))} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none"><option value="skip">{tx('Omitir duplicados existentes', 'Skip existing duplicates')}</option><option value="update">{tx('Actualizar registros existentes', 'Update existing records')}</option></select></Field>
            <Field label={tx('Estatus para clientes nuevos', 'Status for new clients')}><select value={opts.newStatus} onChange={e => setOpts(o => ({ ...o, newStatus: e.target.value }))} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none"><option value="active">{tx('Activo', 'Active')}</option><option value="inactive">{tx('Inactivo', 'Inactive')}</option></select></Field>
            <Field label={tx('Portal para clientes nuevos', 'Portal for new clients')}><select value={opts.newPortal} onChange={e => setOpts(o => ({ ...o, newPortal: e.target.value }))} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none"><option value="disabled">{tx('Deshabilitado', 'Disabled')}</option><option value="enabled">{tx('Habilitado', 'Enabled')}</option></select><p className="text-[10px] text-slate-400 mt-1 leading-tight">{tx('Si se habilita, el cliente quedaría sin clave hasta configurarla con el endpoint seguro de credenciales.', 'If enabled, the client would have no key until set through the secure credentials endpoint.')}</p></Field>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="button" onClick={downloadTemplate} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"><Download className="w-3.5 h-3.5" />{tx('Descargar plantilla', 'Download template')}</button>
              <button type="button" onClick={resetImport} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5">✏️ {tx('Limpiar', 'Clear')}</button>
              <button type="button" disabled title={t.lock} className="px-4 py-2 bg-slate-200 text-slate-500 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{tx('Guardar en MariaDB', 'Save to MariaDB')}</button>
            </div>
          </div>
        </div>

        {file && sheet.headers.length > 0 && <div className="space-y-4 pt-6 border-t border-slate-100" data-testid="import-preview">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600"><TableIcon className="w-4 h-4" /></div>
              <div><h4 className="text-sm font-extrabold text-slate-900">{tx('Vista previa y validación del archivo', 'File preview and validation')}</h4><p className="text-[11px] text-slate-400">{tx(`Se detectaron ${analysis.counts.total} fila(s); ${analysis.recognized} de ${sheet.headers.length} columna(s) reconocidas.`, `Detected ${analysis.counts.total} row(s); ${analysis.recognized} of ${sheet.headers.length} column(s) recognized.`)}</p></div></div>
            <span className={`text-[11px] font-bold px-3.5 py-1.5 rounded-full border inline-flex items-center gap-1.5 self-start sm:self-auto ${analysis.map.code >= 0 && analysis.map.name >= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}><CheckCircle2 className="w-3.5 h-3.5" />{analysis.map.code >= 0 && analysis.map.name >= 0 ? tx('Archivo estructurado correctamente', 'File properly structured') : tx('Faltan columnas clave (número o razón social)', 'Key columns missing (number or legal name)')}</span>
          </div>
          {all.error && <p className="text-[11px] text-amber-700">{tx('No se pudo consultar el catálogo; la comparación con clientes existentes no está disponible.', 'The catalog could not be queried; comparison with existing clients is unavailable.')}</p>}
          {analysis.unknown.length > 0 && <p className="text-[11px] text-slate-500">{tx('Columnas no reconocidas (se ignoran):', 'Unrecognized columns (ignored):')} {analysis.unknown.join(', ')}</p>}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(OUTCOME).map(([k, [cls, es, e]]) => <div key={k} className={`rounded-xl border px-3 py-2 ${cls}`}><div className="text-lg font-black tabular-nums">{analysis.counts[k]}</div><div className="text-[10px] font-bold">{en ? e : es}</div></div>)}
          </div>
          <p className="text-[11px] text-slate-500">{tx(`Si se guardara: los nuevos quedarían ${opts.newStatus === 'active' ? 'Activos' : 'Inactivos'} con portal ${opts.newPortal === 'enabled' ? 'habilitado' : 'deshabilitado'}; los incompletos quedarían Inactivos para completarse después.`, `If saved: new clients would be ${opts.newStatus === 'active' ? 'Active' : 'Inactive'} with portal ${opts.newPortal === 'enabled' ? 'enabled' : 'disabled'}; incomplete ones would be Inactive to be completed later.`)}</p>
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs"><div className="overflow-x-auto max-h-[380px]"><table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider z-10"><tr>
              {['#', tx('Resultado', 'Result'), tx('No. cliente', 'Client No.'), tx('Razón social', 'Legal name'), tx('Marca', 'Brand'), 'RFC', tx('Proyecto', 'Project'), tx('Contrato', 'Contract'), tx('Correos', 'Emails'), tx('Contactos', 'Contacts'), tx('Observaciones', 'Notes')].map(h => <th key={h} className="py-3 px-4 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {analysis.rows.slice(0, 300).map(r => <tr key={r.n} className="hover:bg-slate-50/60 transition-colors text-slate-700 text-xs">
                <td className="py-3 px-4 font-bold text-blue-600/70 text-center text-[11px]">{r.n}</td>
                <td className="py-3 px-4 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${OUTCOME[r.outcome][0]}`}>{en ? OUTCOME[r.outcome][2] : OUTCOME[r.outcome][1]}</span></td>
                <td className="py-3 px-4 whitespace-nowrap font-bold">{show(r.code)}</td><td className="py-3 px-4 min-w-[200px]">{show(r.name)}</td><td className="py-3 px-4">{show(r.brand)}</td><td className="py-3 px-4 font-mono text-[11px]">{show(r.rfc)}</td>
                <td className="py-3 px-4">{show(r.project)}</td><td className="py-3 px-4">{show(r.contract)}</td><td className="py-3 px-4 text-[11px] min-w-[220px] [overflow-wrap:anywhere]">{r.emails.join(', ') || DASH}</td><td className="py-3 px-4 text-[11px]">{r.contacts.join(', ') || DASH}</td>
                <td className="py-3 px-4 text-[11px] text-amber-700">{r.issues.map(i => ISSUE[i][en ? 1 : 0]).join(' · ')}</td>
              </tr>)}
            </tbody></table></div></div>
          {analysis.rows.length > 300 && <p className="text-[11px] text-slate-400">{tx(`Se muestran 300 de ${analysis.rows.length} filas; los totales consideran todas.`, `Showing 300 of ${analysis.rows.length} rows; totals include all.`)}</p>}
        </div>}
      </div>}
    </div>

    {detailId && <DetailPanel kind="clients" recordId={detailId} en={en} onClose={() => setDetailId(null)} />}
  </div>;
}
