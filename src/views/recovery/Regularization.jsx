import React from 'react';
import { getRegularization, regularize, regularizationDocumentUrl } from './api';
import { REG_METHODS, REG_FILTERS, REG_FILE_TYPES, REG_FILE_LIMIT, regMethodLabel, regRows, regKpis, regChip, regDeadline, stageNumber, nextStep, continueBlock, isImportedRestriction, emptyRegularization, validateRegularization, regularizationPayload, regOutcome, fileSize, today } from './model.mjs';

// INT03-D1 · "Sin requisición / Regularización" (diseño del Apps Script original) conectada al backend R2.
// El servidor es la autoridad: sesión, Master Admin, CSRF, If-Match, Idempotency-Key, alcance del creador y auditoría.
// Regularizar NO crea otra requisición: actualiza el mismo expediente (folio original, versión, evidencia y bitácora).
const PAGE = 15;
const CONTROL = 'regularizar no crea una requisición nueva. El mismo expediente conserva requisición/cotizaciones/OC/recepción/factura y agrega la evidencia documental posterior.';

export class Regularization extends React.Component {
  constructor(props) {
    super(props);
    this.state = { query: '', filter: '', page: 1, open: null, detail: null, loading: false, form: null, pending: null, busy: false, error: '', notice: '', fileUrl: null };
    this.alive = true; this.inFlight = false; this.serial = 0;
  }
  componentDidMount() { this.alive = true; }
  componentWillUnmount() { this.alive = false; this.serial++; if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl); }

  async openRow(row) {
    if (this.inFlight || this.state.pending) return;
    if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl);
    const serial = ++this.serial;
    this.setState({ open: row, detail: null, loading: true, form: null, error: '', notice: '', fileUrl: null });
    try {
      const detail = await getRegularization(row.id);
      if (!this.alive || serial !== this.serial) return;
      this.setState({ detail, form: detail.is_provisional && !detail.regularization ? emptyRegularization(row.regularization_requirement) : null });
    } catch (e) {
      if (this.alive && serial === this.serial) this.setState({ error: e.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : e.message });
    } finally { if (this.alive && serial === this.serial) this.setState({ loading: false }); }
  }
  async reloadDetail(keepForm) {
    const row = this.state.open; if (!row) return;
    try {
      const detail = await getRegularization(row.id);
      if (!this.alive) return;
      this.setState(s => ({ detail, form: detail.is_provisional && !detail.regularization ? (keepForm && s.form ? s.form : emptyRegularization(row.regularization_requirement)) : null }));
    } catch (e) { if (this.alive) this.setState({ error: e.message }); }
  }
  close = () => {
    if (this.inFlight || this.state.busy) return;
    if (this.state.pending && !window.confirm('Hay una regularización sin resultado confirmado. Si cierras, revisa después el estado del expediente antes de capturarla de nuevo. ¿Cerrar?')) return;
    if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl);
    this.serial++;
    this.setState({ open: null, detail: null, form: null, pending: null, error: '', fileUrl: null });
    this.props.onRefresh?.().catch(() => {});
  };
  field(name, value) { if (this.state.pending) return; this.setState(s => ({ form: { ...s.form, [name]: value }, error: '' })); }
  async file(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || this.state.pending) return;
    if (file.size > REG_FILE_LIMIT) { this.setState({ error: 'Límite técnico de este piloto local: 8 MiB por archivo. No se cambió una regla del original.' }); return; }
    if (!REG_FILE_TYPES.includes(file.type)) { this.setState({ error: 'Selecciona un PDF o una imagen PNG, JPEG o WebP. DOC/DOCX siguen pendientes de un contrato de almacenamiento revisado.' }); return; }
    this.setState({ busy: true });
    try {
      const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = () => reject(new Error('No se pudo leer el archivo.')); r.readAsDataURL(file); });
      if (!this.alive) return;
      if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl);
      this.setState(s => ({ form: { ...s.form, evidence: { name: file.name, data, mime: file.type, size: file.size } }, fileUrl: URL.createObjectURL(file), error: '' }));
    } catch (e) { if (this.alive) this.setState({ error: e.message }); } finally { if (this.alive) this.setState({ busy: false }); }
  }
  removeFile = () => { if (this.state.pending) return; if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl); this.setState(s => ({ form: { ...s.form, evidence: null }, fileUrl: null })); };

  submit = async (event) => {
    event.preventDefault();
    const s = this.state; if (this.inFlight || !s.open || !s.detail || !s.form) return;
    const invalid = s.pending ? null : validateRegularization(s.form);
    if (invalid) { this.setState({ error: invalid }); return; }
    // Keep the exact key and content until a definite answer: an uncertain retry can never duplicate.
    const operation = s.pending || { id: s.open.id, version: s.detail.version, key: crypto.randomUUID(), data: regularizationPayload(s.form) };
    this.inFlight = true; this.setState({ pending: operation, busy: true, error: '' });
    try {
      const out = await regularize(operation);
      if (!this.alive) return;
      if (this.state.fileUrl) URL.revokeObjectURL(this.state.fileUrl);
      const message = `Regularización registrada. ${out.folio} · ${out.status} · v${out.version}${out.replayed ? ' (confirmada por reintento seguro)' : ''}. El folio original se conserva.`;
      this.setState({ pending: null, fileUrl: null, notice: message });
      this.props.onNotify?.(message);
      await this.reloadDetail(false);
      this.props.onRefresh?.().catch(() => this.alive && this.setState({ error: 'La regularización fue confirmada, pero no se pudo actualizar la lista. Vuelve a abrir esta tarjeta.' }));
    } catch (e) {
      if (!this.alive) return;
      const outcome = regOutcome(e);
      this.setState({ pending: outcome.keep ? operation : null, error: outcome.message });
      if (outcome.reload) await this.reloadDetail(true);
      if (outcome.reload) this.props.onRefresh?.().catch(() => {});
    } finally { this.inFlight = false; if (this.alive) this.setState({ busy: false }); }
  };

  renderDone(row, reg) {
    const ev = reg.evidence;
    return <div className="note ok" data-testid="reg-done">
      <b>{reg.status || 'Regularizada'}</b>
      <div className="sf-prov179-form" style={{ marginTop: 10 }}>
        <div className="field"><label>Método de regularización</label><div>{regMethodLabel(reg.method)}</div></div>
        <div className="field"><label>Fecha de recepción / validación</label><div>{reg.date}</div></div>
        <div className="field span2"><label>Folio / referencia documental</label><div style={{ overflowWrap: 'anywhere' }}>{reg.reference}</div></div>
        {reg.notes && <div className="field span2"><label>Observaciones</label><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{reg.notes}</div></div>}
        <div className="field span2"><label>Evidencia de regularización</label>{ev ? <div style={{ overflowWrap: 'anywhere' }}>{ev.name} · {fileSize(ev.size)} · SHA-256 {String(ev.sha256 || '').slice(0, 12)}… <a href={regularizationDocumentUrl(row.id)} download>⬇️ Descargar evidencia</a></div> : <div>Sin archivo: base contractual registrada por referencia.</div>}</div>
        {reg.regularized_at_utc && <div className="field span2"><label>Registrada (UTC)</label><div>{reg.regularized_at_utc}</div></div>}
      </div>
      <p className="sf-prov179-small" style={{ marginTop: 8 }}>Evidencia documentada en SupplyFlow con auditoría; no equivale a una confirmación externa del cliente.</p>
    </div>;
  }
  renderForm(row) {
    const s = this.state, f = s.form, locked = !!s.pending || s.busy;
    const mismatch = row.regularization_requirement === 'formal' && f.method !== 'formal';
    return <form onSubmit={this.submit} data-testid="reg-form">
      <fieldset className="rf1-fields" disabled={locked}>
        <div className="sf-prov179-form">
          <div className="field"><label htmlFor="reg-method">Método de regularización *</label><select id="reg-method" value={f.method} onChange={e => this.field('method', e.target.value)}>{REG_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="field"><label htmlFor="reg-date">Fecha de recepción / validación *</label><input id="reg-date" type="date" required value={f.date} max="9999-12-31" onChange={e => this.field('date', e.target.value)} /></div>
          <div className="field span2"><label htmlFor="reg-reference">Folio / referencia documental *</label><input id="reg-reference" required maxLength={255} placeholder="Folio de requisición, PO, correo, cláusula contractual, autorización..." value={f.reference} onChange={e => this.field('reference', e.target.value)} /></div>
          <div className="field span2"><label htmlFor="reg-notes">Observaciones</label><textarea id="reg-notes" maxLength={16000} placeholder="Explica la evidencia y, si corresponde, por qué sustituye la requisición formal." value={f.notes} onChange={e => this.field('notes', e.target.value)} /></div>
          <div className="field span2 sf-prov179-file">
            <label htmlFor="reg-file">Evidencia de regularización</label>
            <input id="reg-file" type="file" accept={REG_FILE_TYPES.join(',')} onChange={e => this.file(e)} style={{ marginTop: 6 }} />
            <div className="sf-prov179-small" data-testid="reg-file-summary" style={{ marginTop: 6 }}>{f.evidence ? `${f.evidence.name} · ${fileSize(f.evidence.size)}` : 'Sin archivo seleccionado.'}{f.method === 'contract' ? ' Opcional para Contrato / Call-off vigente.' : ''}</div>
            <div className="sf-prov179-small">PDF, PNG, JPEG o WebP · máx. 8 MiB · almacenamiento privado con huella SHA-256.</div>
            <div className="toolbar" style={{ margin: '8px 0 0' }}><button type="button" className="btn sm ghost" disabled={!s.fileUrl} onClick={() => window.open(s.fileUrl, '_blank', 'noopener,noreferrer')}>👁 Ver</button><button type="button" className="btn sm danger" disabled={!f.evidence} onClick={this.removeFile}>Quitar</button></div>
          </div>
        </div>
        {mismatch && <div className="sf-prov179-banner warn">El expediente requería requisición formal. Con este método quedará como <b>Regularizada · Evidencia alternativa</b>.</div>}
        <div className="sf-prov179-banner warn" data-testid="reg-control"><b>Control:</b> {CONTROL}</div>
      </fieldset>
      {s.pending && <div className="note warn" style={{ marginTop: 12 }}>Solicitud protegida: se reintentará exactamente el mismo contenido (clave {s.pending.key.slice(0, 8)}…). La captura queda bloqueada hasta obtener un resultado definitivo.</div>}
      <div className="sf-prov179-modal-foot" style={{ margin: '16px -20px -18px' }}>
        <button type="button" className="btn light" onClick={this.close} disabled={s.busy}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={s.busy}>{s.busy ? 'Registrando…' : s.pending ? '🔁 Reintentar registro' : '💾 Cerrar regularización'}</button>
      </div>
    </form>;
  }
  renderModal() {
    const s = this.state, row = s.open; if (!row) return null;
    const reg = s.detail?.regularization;
    return <div className="sf-prov179-overlay" role="dialog" aria-modal="true" aria-labelledby="reg-title" onKeyDown={e => { if (e.key === 'Escape') this.close(); }}>
      <div className="sf-prov179-modal sf-reg-modal">
        <div className="sf-prov179-modal-head"><div><h3 id="reg-title">🧾 {reg ? 'Regularización registrada' : 'Regularizar solicitud provisional'}</h3><p>{row.folio} · {row.client} · Origen: {row.request_source_type || '—'}</p></div><button type="button" className="btn sm light" aria-label="Cerrar" onClick={this.close} disabled={s.busy}>✕</button></div>
        <div className="sf-prov179-modal-body">
          {s.error && <div className="note danger" role="alert" style={{ marginBottom: 12 }}>{s.error}</div>}
          {s.notice && <div className="note ok" role="status" style={{ marginBottom: 12 }}>{s.notice}</div>}
          {s.loading ? <p className="sf-prov179-small">Consultando estado vigente en MariaDB…</p>
            : !s.detail ? <div className="toolbar"><button className="btn ghost" type="button" onClick={() => this.openRow(row)}>Reintentar</button></div>
            : reg ? this.renderDone(row, reg)
            : !s.detail.is_provisional ? <div className="note">El expediente no es provisional; no requiere regularización.</div>
            : s.form ? this.renderForm(row) : null}
          {(reg || (s.detail && !s.form)) && <div className="sf-prov179-modal-foot" style={{ margin: '16px -20px -18px' }}><button type="button" className="btn light" onClick={this.close}>Cerrar</button></div>}
        </div>
      </div>
    </div>;
  }
  renderRow(r) {
    const chip = regChip(r), dl = regDeadline(r), imported = isImportedRestriction(r), done = r.reg_state === 'done';
    const step = nextStep(r.stage_index), blocked = continueBlock(r), canGo = !!step && typeof this.props.onContinue === 'function';
    const requester = [r.requester_name, r.requester_email].filter(Boolean).join(' · ');
    return <tr key={r.id} data-testid="reg-row">
      <td><b>{r.folio}</b>{r.provisional_folio && r.provisional_folio !== r.folio && <small>Prov.: {r.provisional_folio}</small>}{chip && <span className={'sf-prov179-chip ' + chip[0]} data-testid="reg-chip">{chip[1]}</span>}</td>
      <td><b className="sf-reg-client">{r.client}</b><small>{requester || '—'}</small></td>
      <td>{r.request_source_type || '—'}<small>{r.request_source_reference || ''}</small></td>
      <td>{dl.limit && <div>Límite: <b>{dl.limit}</b></div>}<small>{dl.requirement}</small></td>
      <td title={r.stage || ''}>{stageNumber(r)}</td>
      <td><div className="action-buttons sf-reg-actions">
        <button type="button" className="btn sm light" data-testid="reg-edit" disabled={!r.editable} title={r.editable ? 'Abrir el expediente en Registro de requisición' : (r.restriction || 'Edición no disponible')} onClick={() => this.props.onEdit?.(r.id)}>EDITAR</button>
        <button type="button" className="btn sm secondary" data-testid="reg-open" disabled={!done && imported} title={!done && imported ? 'Histórico importado: requiere conciliación y autorización explícita.' : done ? 'Consultar la regularización registrada' : 'Registrar la regularización documental'} onClick={() => this.openRow(r)}>{done ? 'VER REGULARIZACIÓN' : 'REGULARIZAR'}</button>
        <button type="button" className="btn sm primary" data-testid="reg-continue" disabled={!canGo} title={canGo ? `Siguiente paso: ${step.activity} (${step.label})` : (blocked || 'Navegación no disponible')} onClick={() => this.props.onContinue?.(r, step)}>CONTINUAR</button>
      </div></td>
    </tr>;
  }
  render() {
    const s = this.state, day = today();
    const all = this.props.rows || [];
    const k = regKpis(all, day);
    const rows = regRows(all, { query: s.query, state: s.filter, day });
    const pages = Math.max(1, Math.ceil(rows.length / PAGE)), page = Math.min(s.page, pages), slice = rows.slice((page - 1) * PAGE, page * PAGE);
    const kpis = [['info', k.total, 'Solicitudes provisionales', ''], ['warn', k.pending + k.overdue, 'Pendientes de regularización', 'open'], ['danger', k.overdue, 'Regularización vencida', 'overdue'], ['ok', k.done, 'Regularizadas', 'done']];
    return <div className="card sf-prov179-panel sf-reg" data-testid="regularization-panel">
      <div className="subsection-header"><div><h3>Solicitudes sin requisición formal</h3><p>Cada registro conserva un folio interno provisional y puede continuar el flujo comercial/operativo. La regularización documental se controla sin duplicar el expediente.</p></div><span className="badge warn">Control documental</span></div>
      {s.notice && !s.open && <div className="note ok" role="status">{s.notice}</div>}
      <div className="sf-prov179-kpis">
        {kpis.map(([tone, n, label, filter]) =>
          <button type="button" key={label} className={'sf-prov179-kpi sf-reg-kpi ' + tone + (s.filter === filter && filter ? ' active' : '')} onClick={() => this.setState({ filter, page: 1 })} aria-pressed={s.filter === filter}><div className="n">{n}</div><div className="l">{label}</div></button>)}
      </div>
      <div className="sf-reg-filters">
        <input className="search" aria-label="Buscar solicitud provisional" placeholder="Buscar folio, cliente, referencia, solicitante..." value={s.query} onChange={e => this.setState({ query: e.target.value, page: 1 })} />
        <select aria-label="Estado de regularización" value={s.filter} onChange={e => this.setState({ filter: e.target.value, page: 1 })}>{REG_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <div><button type="button" className="btn primary" data-testid="reg-new" disabled={typeof this.props.onNew !== 'function'} onClick={() => this.props.onNew?.()}>＋ Nueva solicitud provisional</button></div>
      </div>
      {s.error && !s.open && <div className="note danger" role="alert">{s.error}</div>}
      {!all.some(r => r.is_provisional) ? <div className="empty" data-testid="reg-empty">No hay solicitudes provisionales. Crea una con <b>Nueva solicitud provisional</b> o desde Registro de requisición con un tipo de entrada distinto a “Requisición formal del cliente”.</div>
        : <div className="table-wrap"><table className="sf-prov179-table sf-reg-table"><thead><tr>{['Expediente', 'Cliente / Solicitante', 'Origen', 'Regularización', 'Etapa', 'Acciones'].map(t => <th key={t}>{t}</th>)}</tr></thead>
          <tbody>{slice.map(r => this.renderRow(r))}
          {!slice.length && <tr><td colSpan={6}><div className="empty">Sin coincidencias con el filtro actual.</div></td></tr>}</tbody></table></div>}
      {pages > 1 && <div className="req-matrix-footer"><div className="req-matrix-summary">Mostrando {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} de {rows.length}</div><div className="req-matrix-pagination"><button className="btn sm ghost" disabled={page <= 1} onClick={() => this.setState({ page: page - 1 })}>‹</button><span className="btn sm ghost active">{page} / {pages}</span><button className="btn sm ghost" disabled={page >= pages} onClick={() => this.setState({ page: page + 1 })}>›</button></div></div>}
      <p className="sf-prov179-small" style={{ marginTop: 10 }}>Solo puede regularizar quien creó el expediente provisional en SupplyFlow (Master Admin); los históricos importados permanecen en consulta. Vencimientos calculados al {day} (hora local).</p>
      {this.renderModal()}
    </div>;
  }
}
