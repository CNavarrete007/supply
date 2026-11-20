import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoryCatalog } from './api';
import { CATEGORY_TABS, CATEGORY_STATUSES, HELP, NAME_MAX, DESCRIPTION_MAX, MODE_NOTE, emptyCategory, fromCategory, usageText, usageDetail, filterCategories, validateCategory, categoryWarnings, saveLockedText, deleteBlock, deleteError, deleteLockedText } from './categoryModel.mjs';

// Requisición › Catálogo de categorías (diseño del Apps Script original).
// Lectura real: GET /api/v1/catalogs/categories (estatus y uso). Guardar y Eliminar validan con las reglas del catálogo,
// pero NO escriben: no hay endpoint ni permiso SQL de escritura sobre `categories` (requiere autorización explícita).
export function CategoryCatalog({ onBack }) {
  const [tab, setTab] = useState('form');
  const [mode, setMode] = useState('new');
  const [form, setForm] = useState(emptyCategory);
  const [original, setOriginal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [query, setQuery] = useState('');
  const [load, setLoad] = useState({ status: 'loading', data: null, error: '' });
  const [del, setDel] = useState(null);
  const ctrl = useRef(null);

  const fetchCatalog = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    setLoad(s => ({ ...s, status: 'loading', error: '' }));
    categoryCatalog(c.signal)
      .then(data => { if (!c.signal.aborted) setLoad({ status: 'ready', data, error: '' }); })
      .catch(e => {
        if (c.signal.aborted) return;
        setLoad({ status: 'error', data: null, error: e.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : e.status === 403 ? 'No tienes acceso al catálogo de categorías (solo Master Admin).' : (e.message || 'No se pudo consultar el catálogo de categorías.') });
      });
  }, []);
  useEffect(() => { fetchCatalog(); return () => ctrl.current?.abort(); }, [fetchCatalog]);

  const list = load.data?.items || [];
  const totals = load.data?.totals;
  const rows = useMemo(() => filterCategories(list, query), [list, query]);
  const warnings = useMemo(() => (mode === 'edit' ? categoryWarnings(form, original) : []), [mode, form, original]);

  const startNew = () => { setTab('form'); setMode('new'); setOriginal(null); setForm(emptyCategory()); setMsg(null); };
  const clear = () => { setMode('locked'); setOriginal(null); setForm(emptyCategory()); setMsg(null); };
  const edit = (c, patch = {}) => { setTab('form'); setMode('edit'); setOriginal(c); setForm({ ...fromCategory(c), ...patch }); setMsg(null); setDel(null); };
  const field = (name, value) => { setForm(f => ({ ...f, [name]: value })); setMsg(null); };
  const save = e => {
    e.preventDefault();
    if (mode === 'locked') return;
    const err = validateCategory(form, list, mode === 'edit' ? original : null);
    setMsg(err ? { tone: 'danger', text: err } : { tone: 'warn', text: saveLockedText(form, mode === 'edit' ? original : null) });
  };
  const confirmDelete = () => {
    const err = deleteError(del.cat, del.typed);
    setDel(d => ({ ...d, msg: err ? { tone: 'danger', text: err } : { tone: 'warn', text: deleteLockedText(d.cat) } }));
  };

  const switcher = <div className="sf-cat-switch" role="tablist" aria-label="Catálogo de categorías">
    {CATEGORY_TABS.map(([key, icon, title, desc]) => <button type="button" role="tab" key={key} aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); }}>
      <strong><span aria-hidden="true">{icon}</span> {title}</strong><small>{desc}</small></button>)}
  </div>;

  const loading = load.status !== 'ready' && <div className="card" data-testid="cat-loading">
    {load.status === 'error' ? <><div className="note danger" role="alert">{load.error}</div><div className="toolbar"><button type="button" className="btn ghost" onClick={fetchCatalog}>Reintentar</button></div></>
      : <p className="sf-prov179-small">Cargando categorías de MariaDB…</p>}
  </div>;

  const renderForm = () => {
    const [tone, text] = MODE_NOTE[mode];
    return <div className="card sf-cat-panel" data-testid="cat-form-panel">
      <div className="subsection-header"><div><h3>Alta y actualización de categorías</h3><p>Agrega una categoría cuando no exista en la lista desplegable de partidas.</p></div><span className="badge sf-cat-badge">Catálogo operativo</span></div>
      <div className={'sf-cat-mode ' + tone} role="status" data-testid="cat-mode"><span className="dot" aria-hidden="true" /><b>{text}</b></div>
      {mode === 'edit' && original && <p className="sf-prov179-small" data-testid="cat-editing" style={{ margin: '-6px 0 12px' }}>Editando «{original.name}» · código {original.code} · {usageText(original)} ({usageDetail(original)}){original.imported ? ' · importada del Apps Script' : ''}</p>}
      <form onSubmit={save} noValidate>
        <fieldset className="rf1-fields" disabled={mode === 'locked'}>
          <div className="sf-cat-grid">
            <div className="field"><label htmlFor="cat-name">Nombre de la categoría *</label><input id="cat-name" maxLength={NAME_MAX} placeholder="Ej. Equipos de izaje" value={form.name} onChange={e => field('name', e.target.value)} /></div>
            <div className="field"><label htmlFor="cat-status">Estatus</label><select id="cat-status" value={form.status} onChange={e => field('status', e.target.value)}>{CATEGORY_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field span-all"><label htmlFor="cat-description">Descripción / alcance</label><textarea id="cat-description" maxLength={DESCRIPTION_MAX} placeholder="Indica qué tipos de productos o servicios deben clasificarse aquí." value={form.description} onChange={e => field('description', e.target.value)} /></div>
          </div>
          {warnings.map(w => <div className="sf-prov179-banner warn" key={w} data-testid="cat-warning">{w}</div>)}
        </fieldset>
        {msg && <div className={'note ' + msg.tone} role={msg.tone === 'danger' ? 'alert' : 'status'} data-testid="cat-msg" style={{ marginTop: 12 }}>{msg.text}</div>}
        <div className="toolbar">
          <button type="button" className="btn primary" onClick={startNew}>＋ Nueva categoría</button>
          <button type="submit" className="btn secondary" disabled={mode === 'locked'}>💾 Guardar categoría</button>
          <button type="button" className="btn light" onClick={clear}>🧹 Limpiar</button>
          <button type="button" className="btn ghost" onClick={() => setTab('matrix')}>📋 Ver matriz</button>
          <button type="button" className="btn ghost" onClick={() => onBack?.()}>↩ Regresar a la requisición</button>
        </div>
      </form>
    </div>;
  };

  const renderDelete = () => {
    if (!del) return null;
    const c = del.cat, block = deleteBlock(c);
    return <div className="sf-prov179-overlay" role="dialog" aria-modal="true" aria-labelledby="cat-del-title" onKeyDown={e => { if (e.key === 'Escape') setDel(null); }}>
      <div className="sf-prov179-modal sf-cat-del">
        <div className="sf-prov179-modal-head"><div><h3 id="cat-del-title">🗑️ Eliminar categoría</h3><p>{c.name} · {usageText(c)}</p></div><button type="button" className="btn sm light" aria-label="Cerrar" onClick={() => setDel(null)}>✕</button></div>
        <div className="sf-prov179-modal-body">
          {block ? <div className="sf-prov179-banner warn" data-testid="cat-del-block">{block}</div>
            : <div className="field"><label htmlFor="cat-del-typed">Escribe «{c.name}» para confirmar</label><input id="cat-del-typed" value={del.typed} onChange={e => setDel(d => ({ ...d, typed: e.target.value, msg: null }))} /></div>}
          {del.msg && <div className={'note ' + del.msg.tone} role={del.msg.tone === 'danger' ? 'alert' : 'status'} data-testid="cat-del-msg" style={{ marginTop: 12 }}>{del.msg.text}</div>}
        </div>
        <div className="sf-prov179-modal-foot">
          <button type="button" className="btn light" onClick={() => setDel(null)}>Cerrar</button>
          {block ? (c.active && <button type="button" className="btn secondary" onClick={() => edit(c, { status: 'inactive' })}>Desactivar en su lugar</button>)
            : <button type="button" className="btn danger" onClick={confirmDelete}>Eliminar categoría</button>}
        </div>
      </div>
    </div>;
  };

  const renderMatrix = () => <div className="card sf-cat-panel" data-testid="cat-matrix">
    <div className="subsection-header"><div><h3>Matriz de categorías</h3><p>Solo las categorías activas aparecen en la lista desplegable de las partidas.</p></div><button type="button" className="btn secondary" onClick={startNew}>＋ Nueva categoría</button></div>
    <input className="search sf-cat-search" aria-label="Buscar categoría" placeholder="Buscar categoría..." value={query} onChange={e => setQuery(e.target.value)} />
    {totals && <p className="sf-prov179-small" data-testid="cat-totals" style={{ margin: '0 0 10px' }}>{totals.categories} categoría(s) · {totals.active} activa(s) · {totals.inactive} inactiva(s) · {totals.items} partida(s) clasificadas.</p>}
    {!list.length ? <div className="empty" data-testid="cat-empty">No hay categorías registradas. Agrega la primera con <b>Nueva categoría</b>.</div>
      : <div className="table-wrap"><table className="sf-cat-table"><thead><tr>{['Categoría', 'Descripción', 'Estatus', 'Uso', 'Acciones'].map(t => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{rows.map(c => <tr key={c.code} data-testid="cat-row">
          <td><b>{c.name}</b></td>
          <td>{c.description || '—'}</td>
          <td><span className={'sf-cat-chip' + (c.active ? '' : ' off')}>{c.active ? 'Activa' : 'Inactiva'}</span></td>
          <td title={usageDetail(c)}>{usageText(c)}</td>
          <td><div className="action-buttons sf-cat-actions"><button type="button" className="btn sm light" onClick={() => edit(c)}>EDITAR</button><button type="button" className="btn sm danger" onClick={() => setDel({ cat: c, typed: '', msg: null })}>ELIMINAR</button></div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan={5}><div className="empty">Sin categorías que coincidan con la búsqueda.</div></td></tr>}</tbody></table></div>}
    {totals?.unlinked_items > 0 && <p className="sf-prov179-small" data-testid="cat-unlinked" style={{ marginTop: 10 }}>{totals.unlinked_items} partida(s) histórica(s) conservan una etiqueta que no está en el catálogo (p. ej. tipos de servicio importados) y no se cuentan en ninguna categoría.</p>}
    {renderDelete()}
  </div>;

  const renderHelp = () => <div className="card sf-cat-panel" data-testid="cat-help">
    <div className="subsection-header"><div><h3>{HELP.title}</h3><p>{HELP.subtitle}</p></div><button type="button" className="btn ghost" onClick={startNew}>＋ Agregar categoría</button></div>
    <div className="sf-cat-cards">{HELP.cards.map(([tone, title, text]) => <div className={'sf-cat-card ' + tone} key={title}><b>{title}</b><p>{text}</p></div>)}</div>
    {HELP.rules.map(([title, text]) => <section className="sf-cat-rule" key={title}><h4>{title}</h4><p>{text}</p></section>)}
  </div>;

  return <div className="sf-cat" data-testid="category-catalog">
    {switcher}
    {tab === 'help' ? renderHelp() : loading || (tab === 'matrix' ? renderMatrix() : renderForm())}
  </div>;
}
