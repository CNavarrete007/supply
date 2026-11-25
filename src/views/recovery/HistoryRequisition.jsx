import React, { useEffect, useMemo, useRef, useState } from 'react';
import { historyCatalog, createFromHistory } from './api';
import { fillClient, today } from './model.mjs';
import { repeatPolicyView } from '../clients/model.mjs';
import { STEPS, PRIORITIES, CURRENCIES, PRICE_MODES, SOURCING_MODES, HISTORY_FILTERS, emptyHistoryForm, validity, policyDefaults, modeBlock, lineFromHistory, newLine, newItemError, lineWarnings, filterArticles, routeSummary, validateHistoryRequisition, historyPayload, createdText, historySaveError, refreshLines, money, label } from './historyModel.mjs';

// Requisición › Crear desde historial (diseño del Apps Script original).
// Lectura real: clientes y categorías de /recovery/catalogs y GET /api/v1/requisition-history/catalog (política de recompra
// y cotizaciones al cliente aprobadas). "Crear requisición nueva" (25 nov 2026) crea la requisición en MariaDB con
// POST /api/v1/recovery/requisitions/from-history (CSRF + Idempotency-Key; reintentar la MISMA solicitud no la duplica).
const EMPTY_ITEM = { description: '', quantity: '', unit: '', category: '' };
const newKey = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
  : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

export function HistoryRequisition({ clients = [], categories = [], onMatrix, onCreated }) {
  const day = today();
  const [form, setForm] = useState(() => emptyHistoryForm(day));
  const [lines, setLines] = useState([]);
  const [item, setItem] = useState(EMPTY_ITEM);
  const [itemMsg, setItemMsg] = useState('');
  const [filters, setFilters] = useState({ query: '', category: '', state: 'all' });
  const [hist, setHist] = useState({ status: 'idle', data: null, error: '' });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(null); // { sig, key }: la misma solicitud reintentada conserva su Idempotency-Key
  const ctrl = useRef(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const activeClients = useMemo(() => clients.filter(c => c.status === 'active' || c.id === form.client_id).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' })), [clients, form.client_id]);
  const activeCategories = useMemo(() => categories.filter(c => c.active).map(c => c.name), [categories]);
  const client = clients.find(c => c.id === form.client_id);
  const policy = hist.data?.client?.policy || null;
  const items = hist.data?.items || [];
  const shown = useMemo(() => filterArticles(items, filters, policy, day), [items, filters, policy, day]);
  const filterCategories = useMemo(() => [...new Set([...activeCategories, ...items.map(a => a.category).filter(Boolean)])], [activeCategories, items]);
  const chosen = new Set(lines.map(l => l.key));
  const warnings = useMemo(() => lines.flatMap(l => lineWarnings(l, form, policy, day)), [lines, form, policy, day]);
  const summary = routeSummary(lines);

  const field = (name, value) => { setForm(f => ({ ...f, [name]: value })); setMsg(null); };
  const pickClient = id => {
    setMsg(null);
    const c = clients.find(x => x.id === id);
    const removed = lines.filter(l => l.origin === 'history').length;
    setLines(ls => ls.filter(l => l.origin === 'new'));
    setForm(f => (c ? fillClient(f, c, false) : { ...f, client_id: '' }));
    setFilters({ query: '', category: '', state: 'all' });
    ctrl.current?.abort();
    if (removed) setMsg({ tone: 'warn', text: `Se quitaron ${removed} partida(s) del historial del cliente anterior.` });
    if (!c) { setHist({ status: 'idle', data: null, error: '' }); return; }
    const a = new AbortController(); ctrl.current = a;
    setHist({ status: 'loading', data: null, error: '' });
    historyCatalog(c.id, a.signal).then(data => { if (!a.signal.aborted) setHist({ status: 'ready', data, error: '' }); })
      .catch(e => { if (!a.signal.aborted) setHist({ status: 'error', data: null, error: e.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : e.status === 403 ? 'No tienes acceso al historial (solo Master Admin).' : (e.message || 'No se pudo consultar el historial del cliente.') }); });
  };
  const addArticle = a => { if (chosen.has(`h:${a.key}`)) return; setLines(ls => [...ls, lineFromHistory(a, policy, day)]); setMsg(null); };
  const addNew = () => {
    const err = newItemError(item, activeCategories);
    if (err) { setItemMsg(err); return; }
    setLines(ls => [...ls, newLine(item)]); setItem(EMPTY_ITEM); setItemMsg(''); setMsg(null);
  };
  const setLine = (key, patch) => { setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l))); setMsg(null); };
  const clear = () => { ctrl.current?.abort(); pending.current = null; setForm(emptyHistoryForm(day)); setLines([]); setItem(EMPTY_ITEM); setItemMsg(''); setFilters({ query: '', category: '', state: 'all' }); setHist({ status: 'idle', data: null, error: '' }); setMsg(null); };
  // HISTORY_CHANGED: vuelve a consultar el historial y actualiza las partidas (las que ya no existen se quitan).
  const reloadHistory = (text) => {
    if (!client) return;
    const a = new AbortController(); ctrl.current?.abort(); ctrl.current = a;
    historyCatalog(client.id, a.signal).then(data => {
      if (a.signal.aborted) return;
      setHist({ status: 'ready', data, error: '' });
      const r = refreshLines(lines, data.items, data.client?.policy, day);
      setLines(r.lines);
      setMsg({ tone: 'warn', text: text + (r.removed.length ? ` Se quitaron ${r.removed.length} partida(s) que ya no están en el historial aprobado.` : ' Se actualizaron las partidas con el historial vigente; revisa y vuelve a crear.') });
    }).catch(() => {});
  };
  const create = async () => {
    if (saving) return;
    const err = validateHistoryRequisition(form, lines, { policy, day, activeCategories });
    if (err) { setMsg({ tone: 'danger', text: err }); return; }
    const data = historyPayload(form, lines);
    const sig = JSON.stringify(data);
    if (!pending.current || pending.current.sig !== sig) pending.current = { sig, key: newKey() };
    setSaving(true); setMsg({ tone: 'warn', text: 'Creando la requisición en MariaDB…' });
    try {
      const out = await createFromHistory({ data, key: pending.current.key });
      pending.current = null;
      const name = client?.name;
      ctrl.current?.abort();
      setForm(emptyHistoryForm(day)); setLines([]); setItem(EMPTY_ITEM); setItemMsg(''); setFilters({ query: '', category: '', state: 'all' }); setHist({ status: 'idle', data: null, error: '' });
      setMsg({ tone: 'ok', text: createdText(out, name), folio: out.folio });
      onCreated?.(out);
    } catch (e) {
      const r = historySaveError(e.status, e.code, e.message);
      if (!r.retry) pending.current = null;
      if (r.reload) reloadHistory(r.text); else setMsg({ tone: r.tone, text: r.text });
    } finally { setSaving(false); }
  };

  const input = (name, title, props = {}) => <div className={'field ' + (props.span || '')}><label htmlFor={`hist-${name}`}>{title}</label>
    <input id={`hist-${name}`} value={form[name] ?? ''} onChange={e => field(name, e.target.value)} {...(({ span, ...p }) => p)(props)} /></div>;

  const policyNote = () => {
    if (!form.client_id) return 'Selecciona un cliente para consultar su política de recompra.';
    if (hist.status === 'loading') return 'Consultando política de recompra e historial en MariaDB…';
    if (hist.status === 'error') return hist.error;
    if (!policy) return '';
    const p = repeatPolicyView(policy), d = policyDefaults(policy, day);
    if (p.empty) return 'El cliente no tiene política de recompra registrada: cada partida del historial inicia con «Validar precio» y «Validar costo/proveedor histórico».';
    return [`Precio al cliente: ${p.sales.label}`, `Abastecimiento: ${p.sourcing.label}`, p.daysNote || 'Vigencia del precio histórico sin definir',
      p.contractReference ? `Contrato ${p.contractReference}${p.validUntil ? ` (vigente hasta ${p.validUntil})` : ''}` : '', p.margin !== '' ? `Margen mínimo ${p.margin}%` : '',
      d.known ? '' : 'Política heredada sin equivalencia exacta: revisa el tratamiento de cada partida'].filter(Boolean).join(' · ');
  };

  const renderArticle = a => {
    const v = validity(a.last, policy, day), added = chosen.has(`h:${a.key}`), l = a.last || {};
    return <div className="sf-hist-card" key={a.key} data-testid="hist-article">
      <div className="sf-hist-card-head"><b>{a.description}</b>{a.brand_model && <small>{a.brand_model}</small>}</div>
      <div className="sf-hist-chips">{a.category && <span className="sf-hist-chip">{a.category}</span>}<span className={'sf-hist-chip ' + v.state}>{v.label}</span><span className="sf-hist-chip muted">Cotizado {a.occurrences} {a.occurrences === 1 ? 'vez' : 'veces'}</span></div>
      <div className="sf-hist-line">Último precio cliente: <b>{money(l.unit_price, l.currency)}</b> / {a.unit || 'unidad'} · {l.quote_date || '—'}</div>
      <div className="sf-hist-line">Proveedor / costo: {l.supplier || 'Sin proveedor adjudicado'} · {money(l.cost, l.currency)}</div>
      <small className="sf-hist-src">Cotización {l.quote_folio}{l.version_number ? ` v${l.version_number}` : ''} · Req. {l.requisition_folio}</small>
      <button type="button" className={'btn sm ' + (added ? 'light' : 'primary')} disabled={added} onClick={() => addArticle(a)}>{added ? '✓ Agregada' : '＋ Agregar'}</button>
    </div>;
  };

  const renderLine = (l, i) => {
    const last = l.last || {};
    const sel = (kind, modes) => <select aria-label={`${kind === 'price' ? 'Tratamiento precio cliente' : 'Tratamiento proveedor'} ${i + 1}`} value={kind === 'price' ? l.price_mode : l.sourcing_mode} disabled={l.origin === 'new'}
      onChange={e => setLine(l.key, kind === 'price' ? { price_mode: e.target.value } : { sourcing_mode: e.target.value })}>
      {modes.map(([v, t]) => { const b = modeBlock(l, kind, v, policy, day); return <option key={v} value={v} disabled={!!b} title={b || ''}>{t}{b ? ' — no disponible' : ''}</option>; })}
    </select>;
    return <tr key={l.key} data-testid="hist-line">
      <td><b>{l.description}</b>{l.brand_model && <small>{l.brand_model}</small>}<small>{l.category || 'Sin categoría'}</small></td>
      <td>{l.origin === 'new' ? <span className="sf-hist-chip new">Nueva</span> : <><span className="sf-hist-chip">Historial</span><small>{last.quote_folio} · Req. {last.requisition_folio}</small></>}</td>
      <td><input aria-label={`Cantidad nueva ${i + 1}`} inputMode="decimal" className="sf-hist-qty" value={l.quantity} onChange={e => setLine(l.key, { quantity: e.target.value })} /></td>
      <td>{l.unit || '—'}</td>
      <td>{l.origin === 'new' ? '—' : <>{money(last.unit_price, last.currency)}<small>{last.quote_date || ''}</small></>}</td>
      <td>{sel('price', PRICE_MODES)}</td>
      <td>{l.origin === 'new' ? '—' : <>{last.supplier || 'Sin proveedor'}<small>{money(last.cost, last.currency)}</small></>}</td>
      <td>{sel('sourcing', SOURCING_MODES)}</td>
      <td><button type="button" className="btn sm danger" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}>Quitar</button></td>
    </tr>;
  };

  return <div className="card sf-hist" data-testid="history-requisition">
    <div className="sf-hist-banner"><h3>🕘 Nueva requisición desde historial del cliente</h3><p>No copia una requisición completa. Puedes combinar artículos/servicios de operaciones distintas, cambiar cantidades, agregar partidas nuevas y decidir por partida si se respeta el precio al cliente y si el proveedor debe recotizar.</p></div>
    <div className="sf-hist-steps">{STEPS.map(([n, t, d]) => <div className="sf-hist-step" key={n}><span className="num">{n}</span><div><b>{t}</b><small>{d}</small></div></div>)}</div>

    <div className="sf-hist-grid">
      <div className="field span2"><label htmlFor="hist-client">Cliente *</label><select id="hist-client" value={form.client_id} onChange={e => pickClient(e.target.value)}>
        <option value="">Seleccionar cliente...</option>{activeClients.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ''}{c.name}</option>)}</select></div>
      {input('request_date', 'Fecha de solicitud *', { type: 'date', max: '9999-12-31' })}
      {input('need_date', 'Fecha requerida *', { type: 'date', max: '9999-12-31' })}
      {input('project', 'Proyecto *', { maxLength: 255 })}
      {input('contract', 'Contrato *', { maxLength: 255 })}
      {input('client_reference', 'Referencia cliente', { maxLength: 255 })}
      <div className="field"><label htmlFor="hist-priority">Prioridad</label><select id="hist-priority" value={form.priority} onChange={e => field('priority', e.target.value)}>{PRIORITIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
      {input('delivery_place', 'Lugar de entrega *', { span: 'span2' })}
      {input('requester_name', 'Solicitante *', { maxLength: 255 })}
      {input('requester_email', 'Correo solicitante *', { type: 'email', maxLength: 254, autoComplete: 'email' })}
      <div className="field"><label htmlFor="hist-currency">Moneda *</label><select id="hist-currency" value={form.currency} onChange={e => field('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
      {input('budget', 'Presupuesto estimado', { inputMode: 'decimal' })}
      {input('description', 'Descripción general', { span: 'span2' })}
    </div>
    <div className={'sf-hist-policy' + (hist.status === 'error' ? ' error' : '')} data-testid="hist-policy" role={hist.status === 'error' ? 'alert' : 'status'}>{policyNote()}</div>

    <div className="subsection-header sf-hist-section"><div><h3>Catálogo histórico del cliente</h3><p>Se construye con cotizaciones al cliente aprobadas. El historial es referencia; la nueva requisición tendrá un folio independiente.</p></div><span className="badge sf-hist-badge" data-testid="hist-count">{items.length} artículos/servicios</span></div>
    <div className="sf-hist-filters">
      <input className="search" aria-label="Buscar en el historial" placeholder="Buscar descripción, marca, categoría, requisición, cotización o proveedor..." value={filters.query} onChange={e => setFilters(f => ({ ...f, query: e.target.value }))} />
      <select aria-label="Categoría del historial" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}><option value="">Todas las categorías</option>{filterCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
      <select aria-label="Vigencia del historial" value={filters.state} onChange={e => setFilters(f => ({ ...f, state: e.target.value }))}>{HISTORY_FILTERS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
    </div>
    <div className="sf-hist-cards" data-testid="hist-catalog">
      {!form.client_id ? <div className="sf-hist-empty">Selecciona un cliente.</div>
        : hist.status === 'loading' ? <div className="sf-hist-empty">Consultando historial…</div>
        : hist.status === 'error' ? <div className="sf-hist-empty">No se pudo consultar el historial.</div>
        : !items.length ? <div className="sf-hist-empty wide" data-testid="hist-none">El cliente no tiene cotizaciones al cliente aprobadas en MariaDB. Captura las partidas como nuevas.</div>
        : !shown.length ? <div className="sf-hist-empty">Sin artículos con estos filtros.</div>
        : shown.map(renderArticle)}
    </div>
    {hist.data && <p className="sf-prov179-small" data-testid="hist-totals">{hist.data.totals.articles} artículo(s) de {hist.data.totals.lines} partida(s) en {hist.data.totals.approved_quotes} cotización(es) aprobada(s).</p>}

    <div className="subsection-header sf-hist-section"><div><h3>Nueva requisición · partidas seleccionadas</h3><p>Ajusta cantidades y el tratamiento comercial/abastecimiento de cada partida.</p></div><span className="badge sf-hist-badge" data-testid="hist-selected">{lines.length} seleccionadas</span></div>
    <div className="table-wrap"><table className="sf-hist-table"><thead><tr>{['Partida', 'Origen', 'Cantidad nueva', 'Unidad', 'Último precio cliente', 'Tratamiento precio cliente', 'Último proveedor/costo', 'Tratamiento proveedor', 'Acción'].map(t => <th key={t}>{t}</th>)}</tr></thead>
      <tbody>{lines.length ? lines.map(renderLine) : <tr><td colSpan={9}><div className="sf-hist-empty wide">Agrega partidas desde el historial o captura una nueva.</div></td></tr>}</tbody></table></div>
    {lines.length > 0 && <p className="sf-prov179-small" data-testid="hist-summary">{summary.history} del historial · {summary.fresh} nueva(s) · Precio: fijo {summary.fixed}, recotizar {summary.requote}, validar {summary.validate} · Proveedor: reutilizar {summary.reuse}, validar {summary.supplierValidate}, recotizar {summary.supplierRequote}.</p>}
    {warnings.map(w => <div className="sf-prov179-banner warn" key={w} data-testid="hist-warning">{w}</div>)}

    <div className="sf-hist-new">
      <h4>＋ Agregar partida nueva</h4><p>Las partidas nuevas se enrutan a nueva cotización de proveedor y nuevo precio comercial.</p>
      <div className="sf-hist-new-grid">
        <div className="field span2"><label htmlFor="hist-new-description">Descripción / especificación</label><input id="hist-new-description" value={item.description} onChange={e => setItem(x => ({ ...x, description: e.target.value }))} /></div>
        <div className="field"><label htmlFor="hist-new-quantity">Cantidad</label><input id="hist-new-quantity" inputMode="decimal" value={item.quantity} onChange={e => setItem(x => ({ ...x, quantity: e.target.value }))} /></div>
        <div className="field"><label htmlFor="hist-new-unit">Unidad</label><input id="hist-new-unit" placeholder="pza, lote, servicio" maxLength={128} value={item.unit} onChange={e => setItem(x => ({ ...x, unit: e.target.value }))} /></div>
        <div className="field span2"><label htmlFor="hist-new-category">Categoría</label><select id="hist-new-category" value={item.category} onChange={e => setItem(x => ({ ...x, category: e.target.value }))}><option value="">Seleccionar categoría...</option>{activeCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="field span2 sf-hist-add"><button type="button" className="btn ok" onClick={addNew}>＋ Agregar partida nueva</button></div>
      </div>
      {itemMsg && <div className="note danger" role="alert" data-testid="hist-item-msg" style={{ marginTop: 10 }}>{itemMsg}</div>}
    </div>

    {msg && <div className={'note ' + msg.tone} role={msg.tone === 'danger' ? 'alert' : 'status'} data-testid="hist-msg" style={{ marginTop: 14 }}>{msg.text}</div>}
    <div className="toolbar">
      <button type="button" className="btn primary" onClick={create} disabled={saving}>{saving ? '⏳ Creando…' : '💾 Crear requisición nueva'}</button>
      <button type="button" className="btn light" onClick={clear} disabled={saving}>🧹 Limpiar</button>
      <button type="button" className="btn ghost" onClick={() => onMatrix?.()}>📋 Ver matriz</button>
    </div>
  </div>;
}
