// Catálogos · ficha con guardado automático (extraído de Clientes y parametrizado para proveedores).
// Cada cambio se guarda solo (AUTOSAVE_MS después de la última edición) cuando el formulario es válido: primero crea el
// registro (POST) y luego lo actualiza (PUT + If-Match). Tras cada guardado se avisa a la vista (onSaved) para refrescar
// matriz, selectores e indicadores SIN recargar la ficha, así no se pisa lo que se está escribiendo.
import React, { useEffect, useRef, useState } from 'react';
import { saveCatalogRecord, fetchCatalogLogo, compressLogo } from './writeApi';

export const AUTOSAVE_MS = 1500;
const newKey = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
  : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

/**
 * @param {object} o
 * @param {'clients'|'suppliers'} o.kind
 * @param {{item:object|null}} o.ficha                     record loaded from GET /catalogs/{kind}/{id}
 * @param {(id:string)=>void} o.setSelectedId
 * @param {(saved:object)=>void} o.onSaved                  refresh lists (never the ficha)
 * @param {object} o.model  { emptyForm, formFromRecord, validateForm, toPayload, payloadSignature, missingRequired, serverField, saveErrorMessage }
 * @param {object} o.text   { created(code), updated(code, version), noChanges(code, version), notifyTitle, idle, entity }
 */
export function useCatalogAutosave({ kind, ficha, setSelectedId, onSaved, notify, tx, en, model, text }) {
  const { emptyForm, formFromRecord, validateForm, toPayload, payloadSignature, missingRequired, serverField, saveErrorMessage } = model;
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
  const paused = useRef(false); // conflicto de versión o escritura no habilitada: solo se reintenta con el botón Guardar

  // Aplica la ficha cargada salvo que el formulario ya tenga esa versión (la produjo el propio guardado automático).
  useEffect(() => {
    const it = ficha.item;
    if (!it) return;
    const cur = formRef.current;
    if (cur.id === it.id && cur.version >= Number(it.version || 1)) return;
    const next = formFromRecord(it);
    savedSig.current = payloadSignature(next); paused.current = false; keyFor.current = { sig: '', key: '' };
    setForm(next); setErrors({}); setAuto({ state: 'saved', version: next.version, loaded: true });
  }, [ficha.item]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ficha.item?.id || !ficha.item?.logo) { if (!formRef.current.logo.next) setLogoUrl(null); return undefined; }
    const c = new AbortController(); let url = null;
    fetchCatalogLogo(kind, ficha.item.id, c.signal).then(u => { url = u; if (!c.signal.aborted) setLogoUrl(u); else if (u) URL.revokeObjectURL(u); }).catch(() => {});
    return () => { c.abort(); if (url) URL.revokeObjectURL(url); };
  }, [ficha.item, kind]);

  const touch = k => setErrors(e => (e[k] ? { ...e, [k]: undefined } : e));
  const set = (k, v) => { setForm(x => ({ ...x, [k]: v })); touch(k); };
  const setNested = (group, k, v) => { setForm(x => ({ ...x, [group]: { ...x[group], [k]: v } })); touch(k); };
  const setRow = (k, i, v) => { setForm(x => ({ ...x, [k]: x[k].map((r, j) => (j === i ? v : r)) })); touch(k); };
  const addRow = k => { setForm(x => (x[k].length >= 20 ? x : { ...x, [k]: [...x[k], ''] })); touch(k); };
  const removeRow = (k, i) => { setForm(x => { const rows = x[k].filter((_, j) => j !== i); return { ...x, [k]: rows.length ? rows : [''] }; }); touch(k); };
  const fieldCls = 'w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400';
  const inp = k => `${fieldCls} ${errors[k] ? 'border-rose-400 bg-rose-50/30' : ''}`;
  const err = k => (errors[k] ? React.createElement('p', { className: 'text-[10px] text-rose-600 mt-1', role: 'alert' }, errors[k]) : null);
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

  /** mode 'auto' (debounced) or 'manual' (button). Returns 'clean'|'saved'|'invalid'|'paused'|'failed'. */
  const runSave = async mode => {
    if (inFlight.current) {
      queued.current = true;
      if (mode === 'manual') { await inFlight.current; return runSave('manual'); }
      return inFlight.current;
    }
    const cur = formRef.current;
    const sig = payloadSignature(cur);
    if (cur.id && sig === savedSig.current) {
      if (mode === 'manual') setSaveMsg({ kind: 'ok', text: text.noChanges(cur.code, cur.version) });
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
        const r = await saveCatalogRecord(kind, { id: cur.id, version: cur.version, payload, key: keyFor.current.key });
        if (r.ok) {
          const created = !cur.id;
          paused.current = false;
          savedSig.current = payloadSignature({ ...cur, logo: { current: null, next: null, remove: false } });
          setForm(x => ({ ...x, id: r.data.id, version: r.data.version,
            logo: x.logo === sentLogo ? { current: sentLogo.next ? { name: sentLogo.next.name, mime: sentLogo.next.type, size: sentLogo.next.size } : sentLogo.remove ? null : sentLogo.current, next: null, remove: false } : x.logo }));
          if (sentLogo.next) setLogoUrl(sentLogo.next.dataUrl); else if (sentLogo.remove) setLogoUrl(null);
          const at = new Date();
          const saved = { id: r.data.id, code: r.data.code, name: payload.name, version: r.data.version, at, created };
          setLastSaved(saved);
          setAuto({ state: 'saved', version: r.data.version, at });
          setSaveMsg(created || mode === 'manual' ? { kind: 'ok', text: created ? text.created(r.data.code) : text.updated(r.data.code, r.data.version) } : null);
          if (created || mode === 'manual') notify(text.notifyTitle, created ? tx(`Alta de ${r.data.code}`, `Created ${r.data.code}`) : tx(`Actualización de ${r.data.code}`, `Updated ${r.data.code}`), 'success');
          if (created) setSelectedId(r.data.id);
          onSaved(saved);
          return 'saved';
        }
        const code = r.data?.error?.code;
        if (r.status === 422 && r.data?.error?.field) setErrors(x => ({ ...x, [serverField(r.data.error.field)]: tx('Valor no aceptado por el servidor.', 'Value rejected by the server.') }));
        if (code === 'CODE_TAKEN') setErrors(x => ({ ...x, code: tx('Número ya registrado.', 'Number already registered.') }));
        // 4xx: el contenido debe corregirse (nueva clave); 5xx/en proceso: se reintenta con la misma clave.
        if (r.status < 500 && !String(code).startsWith('IDEMPOTENCY')) keyFor.current = { sig: '', key: '' };
        if (r.status === 412 || code === 'CATALOG_WRITE_NOT_PROVISIONED') paused.current = true;
        setAuto({ state: 'error' });
        setSaveMsg({ kind: code === 'CATALOG_WRITE_NOT_PROVISIONED' ? 'warn' : 'error', text: r.status === 422 && r.data?.error?.message && code === 'INVALID_VALUE' ? r.data.error.message : saveErrorMessage(r.status, code, en), reload: r.status === 412 });
        return 'failed';
      } catch {
        setAuto({ state: 'error' });
        setSaveMsg({ kind: 'error', text: tx('Sin conexión con el servidor. Puedes reintentar con el botón Guardar: no se duplicará el registro.', 'No connection to the server. Retry with the Save button: the record will not be duplicated.') });
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** Saves pending valid changes now (before clearing, leaving the card or switching record). */
  const flush = async () => {
    if (inFlight.current) await inFlight.current;
    const cur = formRef.current;
    if (payloadSignature(cur) === savedSig.current) return 'clean';
    if (!validateForm(cur, en).ok) return 'invalid';
    if (paused.current) return 'paused';
    return runSave('auto');
  };
  const newRecord = () => { setSelectedId(''); const blank = emptyForm(); savedSig.current = payloadSignature(blank); paused.current = false; keyFor.current = { sig: '', key: '' }; setForm(blank); setErrors({}); setSaveMsg(null); setLogoUrl(null); setAuto({ state: 'idle' }); };
  const clearForm = async () => { if ((await flush()) !== 'failed') newRecord(); };
  const pickRecord = async id => { if ((await flush()) === 'failed') return; if (!id) { newRecord(); return; } setSaveMsg(null); setSelectedId(id); };
  const save = () => runSave('manual');
  const autoText = (() => {
    const hhmm = d => d.toLocaleTimeString(en ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    switch (auto.state) {
      case 'saving': return tx('Guardando en MariaDB…', 'Saving to MariaDB…');
      case 'pending': return tx('Cambios sin guardar · se guardarán automáticamente…', 'Unsaved changes · saving automatically…');
      case 'saved': return auto.loaded ? tx(`Ficha cargada de la matriz (versión ${auto.version}). Los cambios se guardan automáticamente.`, `Record loaded from the matrix (version ${auto.version}). Changes are saved automatically.`) : tx(`✓ Guardado automáticamente en la matriz · versión ${auto.version} · ${hhmm(auto.at)}`, `✓ Saved automatically to the matrix · version ${auto.version} · ${hhmm(auto.at)}`);
      case 'incomplete': { const m = missingRequired(form, en); return m.length ? tx(`Para guardar automáticamente completa: ${m.join(', ')}.`, `To save automatically, fill in: ${m.join(', ')}.`) : tx('Corrige los campos marcados para guardar automáticamente.', 'Fix the highlighted fields to save automatically.'); }
      case 'paused': return tx(`Guardado automático en pausa: revisa el aviso y usa "Guardar ${text.entity}".`, `Autosave paused: check the notice and use the Save button.`);
      case 'error': return tx('No se pudo guardar automáticamente; revisa el aviso.', 'Could not save automatically; check the notice.');
      default: return text.idle;
    }
  })();
  return { form, setForm, errors, setErrors, saving, saveMsg, setSaveMsg, auto, lastSaved, logoUrl, logoBusy, set, setNested, setRow, addRow, removeRow,
    onLogo, save, flush, newRecord, clearForm, pickRecord, autoText, inp, err, fieldCls };
}
