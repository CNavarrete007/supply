import React, { useCallback, useEffect, useRef, useState } from 'react';
import { changeOverview, getChange, getChangeReview, getChangeImpact, getCommercialReconciliation, getCommercialExecutions, decideChange, withdrawChange } from './api';
import { FLOW_FILTERS, BOARD_PAGE, STATUS, TREATMENTS, EXECUTION_STATE, flowChip, boardKpis, boardQuery, quoteCell, poCell, impactCell, requestCell, changeCell, revisionText, detailMode, diffRows, applyBlockers, dependencyList, emptyDecision, validateDecision, decisionPayload, decisionOutcome, decisionNotice, validateWithdraw, withdrawOutcome, MAX_REASON } from './changeControl.mjs';

// Requisición › Control de cambios (diseño "Control de modificaciones / Change Requests" del Apps Script original).
// Lectura: GET /api/v1/requisition-changes (tablero, estados del flujo derivados de R3) y los GET de R3 para el detalle.
// Escrituras reales ya validadas (INT02): R3B decisión (otro Master Admin) y retiro R3A (solicitante), con CSRF + If-Match
// + Idempotency-Key. R3C2/R3C3 (conciliación y evidencia comercial) se muestran solo en consulta.
const newKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\./g, ''));
const settle = p => p.then(v => ({ ok: true, v }), e => ({ ok: false, e }));
const errText = e => (e?.status === 401 ? 'Tu sesión expiró. Inicia sesión nuevamente.' : e?.status === 403 ? 'Solo un Master Admin puede consultar el Control de cambios.' : e?.message || 'No se pudo consultar MariaDB.');

function ChangeDetail({ row, onClose, onChanged, onNotify }) {
  const mode = detailMode(row);
  const [load, setLoad] = useState({ status: 'loading', error: '' });
  const [data, setData] = useState({});
  const [form, setForm] = useState(emptyDecision());
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const alive = useRef(true);

  const read = useCallback(async () => {
    if (mode === 'imported') return {};
    if (mode === 'owner') return { detail: await getChange(row.id) };
    const [review, impact, rec, exe] = await Promise.all([settle(getChangeReview(row.id)), settle(getChangeImpact(row.id)), settle(getCommercialReconciliation(row.id)), settle(getCommercialExecutions(row.id))]);
    if (!review.ok) throw review.e;
    return { detail: review.v, impact: impact.ok ? impact.v : null, rec: rec.ok ? rec.v : null, exe: exe.ok ? exe.v : null };
  }, [mode, row.id]);
  const reload = useCallback(() => read().then(d => { if (alive.current) { setData(d); setLoad({ status: 'ready', error: '' }); } })
    .catch(e => { if (alive.current) setLoad({ status: 'error', error: errText(e) }); }), [read]);
  useEffect(() => { alive.current = true; reload(); return () => { alive.current = false; }; }, [reload]);

  const close = () => { if (busy) return; if (pending && !window.confirm('Hay una operación sin resultado confirmado. Revisa el estado de la solicitud antes de repetirla. ¿Cerrar?')) return; onClose(); };
  useEffect(() => { const k = e => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });

  const run = async (kind) => {
    if (busy) return;
    let op = pending;
    if (!op) {
      if (kind === 'decide') {
        const ctx = { requisition_version: data.impact?.requisition_version };
        const v = validateDecision(form, ctx);
        if (!v.ok) { setMsg({ tone: 'danger', text: v.first }); return; }
        op = { kind, id: row.id, version: data.impact?.change_version ?? row.version, key: newKey(), data: decisionPayload(form, ctx) };
      } else {
        const e = validateWithdraw(reason);
        if (e) { setMsg({ tone: 'danger', text: e }); return; }
        op = { kind, id: row.id, version: data.detail?.version ?? row.version, key: newKey(), data: { reason: reason.trim() } };
      }
    }
    setPending(op); setBusy(true); setMsg(null);
    try {
      const out = op.kind === 'decide' ? await decideChange(op) : await withdrawChange(op);
      if (!alive.current) return;
      const text = op.kind === 'decide' ? decisionNotice(out) : `Solicitud ${out.folio || row.folio} retirada${out.replayed ? ' (confirmada por reintento seguro)' : ''}. La requisición no cambió.`;
      setPending(null); setMsg({ tone: 'ok', text }); onNotify?.(text); onChanged?.();
      setForm(emptyDecision()); setReason('');
    } catch (e) {
      if (!alive.current) return;
      const o = op.kind === 'decide' ? decisionOutcome(e) : withdrawOutcome(e);
      setPending(o.keep ? op : null); setMsg({ tone: 'danger', text: o.message });
      if (o.reload) { reload(); onChanged?.(); }
    } finally { if (alive.current) setBusy(false); }
  };

  const d = data.detail || {};
  const rows = diffRows(d.changes || []);
  const deps = data.impact ? dependencyList(data.impact.dependencies || {}).filter(x => x.present) : [];
  const blockers = applyBlockers(data.impact);
  const treatments = data.rec?.latest_assessment?.treatments || null;
  const executions = data.exe?.items || [];
  const [tone, label] = flowChip(row);
  const locked = !!pending || busy;
  const summary = [['Cambio', `${row.folio}${row.change_type ? ` · ${row.change_type}` : ''}`], ['Requisición', row.requisition_folio], ['Cliente', row.client || '—'], ['Revisión', revisionText(row)],
    ['Fecha / solicitado por', `${String(row.request_date || '').slice(0, 10)} · ${row.requested_by || '—'}${row.requester_name ? ` (registró ${row.requester_name})` : ''}`],
    ['Origen', `${row.source || '—'}${row.reference ? ` · ${row.reference}` : ''}`], ['Motivo', d.reason || d.request_reason || row.reason || '—'], ['Impacto', row.impact || '—'],
    ['Resolución', row.resolved_by ? `${row.resolved_by} · ${String(row.resolved_at || '').slice(0, 16)}` : '—']];
  return <div className="sf-prov179-overlay" role="dialog" aria-modal="true" aria-labelledby="chg-title">
    <div className="sf-prov179-modal sf-chg-modal">
      <div className="sf-prov179-modal-head"><div><h3 id="chg-title">🔁 {row.folio} · {row.requisition_folio}</h3><p>{row.client || '—'} · {revisionText(row)} · <span className={'sf-prov179-chip ' + tone}>{label}</span> <span className="sf-prov179-chip info">{STATUS[row.status_code]?.[1] || row.status_code}</span></p></div>
        <button type="button" className="btn sm light" aria-label="Cerrar" onClick={close} disabled={busy}>✕</button></div>
      <div className="sf-prov179-modal-body">
        {msg && <div className={'note ' + msg.tone} role={msg.tone === 'danger' ? 'alert' : 'status'} data-testid="chg-msg" style={{ marginBottom: 12 }}>{msg.text}</div>}
        <div className="sf-chg-summary">{summary.map(([k, v]) => <div key={k}><label>{k}</label><div>{v}</div></div>)}</div>
        {mode === 'imported' ? <div className="note" style={{ marginTop: 12 }}>Solicitud importada del sistema original: se conserva su estado; el detalle por partida no está disponible.</div>
          : load.status === 'loading' ? <p className="sf-prov179-small" style={{ marginTop: 12 }}>Consultando la solicitud en MariaDB…</p>
          : load.status === 'error' ? <div className="note danger" role="alert" style={{ marginTop: 12 }}>{load.error} <button type="button" className="btn sm ghost" onClick={reload}>Reintentar</button></div>
          : <>
            <h4 className="sf-chg-h">Partidas antes / después</h4>
            {rows.length ? <div className="table-wrap"><table className="sf-chg-diff" data-testid="chg-diff"><thead><tr>{['#', 'Acción', 'Elemento', 'Antes', 'Después', 'Abasto', 'Resolución'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(x => <tr key={x.n}><td>{x.n}</td><td>{x.action}</td><td>{x.target}</td><td>{x.before}</td><td><b>{x.after}</b></td><td>{x.sourcing ? 'Requiere' : '—'}</td><td>{x.resolution}</td></tr>)}</tbody></table></div>
              : <p className="sf-prov179-small">Sin partidas registradas en la solicitud.</p>}
            {mode === 'review' && <>
              <h4 className="sf-chg-h">Impacto y dependencias</h4>
              {data.impact ? <div data-testid="chg-impact">{deps.length ? <div className="sf-chg-chips">{deps.map(x => <span className="sf-prov179-chip pending" key={x.key}>{x.label}{x.count > 1 ? ` (${x.count})` : ''}</span>)}</div> : <p className="sf-prov179-small">Sin documentos ni planes dependientes.</p>}
                {blockers.map(b => <div className="sf-prov179-banner warn" key={b}>{b}</div>)}</div> : <p className="sf-prov179-small">Impacto no disponible.</p>}
              <h4 className="sf-chg-h">Conciliación comercial (R3C2) y evidencia (R3C3) · solo consulta</h4>
              <div className="sf-prov179-small" data-testid="chg-commercial">
                {treatments ? <ul className="sf-chg-list">{Object.entries(treatments).map(([k, v]) => <li key={k}><b>{k}</b>: {TREATMENTS[v?.treatment] || TREATMENTS[v] || (typeof v === 'string' ? v : JSON.stringify(v))}</li>)}</ul> : <p>Sin evaluación comercial registrada.</p>}
                {executions.length ? <ul className="sf-chg-list">{executions.map(x => <li key={x.id}>{x.document_kind} · {x.action_code} · {x.reference_text || ''} · {EXECUTION_STATE[x.state] || x.state || ''}</li>)}</ul> : <p>Sin constancias de ejecución registradas.</p>}
                <p>Emitir, autorizar o enmendar cotizaciones y OC sigue bloqueado: estos registros no son confirmación externa.</p>
              </div>
            </>}
            {row.reviewable && mode === 'review' && <div className="sf-chg-form" data-testid="chg-decision">
              <h4 className="sf-chg-h">Revisión independiente (R3B)</h4>
              {/* Inputs lock while a result is uncertain; the retry button stays outside so the SAME operation can be resent. */}
              <fieldset className="rf1-fields" disabled={locked}>
                <div className="sf-chg-radios">{[['approve', 'Aprobar y aplicar'], ['reject', 'Rechazar']].map(([v, l]) => <label key={v}><input type="radio" name="chg-decision" value={v} checked={form.decision === v} onChange={() => { setForm(f => ({ ...f, decision: v })); setMsg(null); }} /> {l}</label>)}</div>
                <div className="field"><label htmlFor="chg-reason">Motivo de la decisión *</label><textarea id="chg-reason" maxLength={MAX_REASON} value={form.reason} onChange={e => { setForm(f => ({ ...f, reason: e.target.value })); setMsg(null); }} /></div>
                {form.decision === 'approve' && <label className="sf-chg-ack"><input type="checkbox" checked={form.ack} onChange={e => { const ack = e.target.checked; setForm(f => ({ ...f, ack })); setMsg(null); }} /> Confirmo que aprobar solo genera la Rev. de la requisición; no modifica cotizaciones, RFQ ni OC.</label>}
              </fieldset>
              <div className="toolbar"><button type="button" className="btn primary" onClick={() => run('decide')} disabled={busy || (!!pending && pending.kind !== 'decide')}>{busy ? 'Registrando…' : pending ? '🔁 Reintentar decisión' : '✅ Registrar decisión'}</button></div>
            </div>}
            {row.withdrawable && mode === 'owner' && <div className="sf-chg-form" data-testid="chg-withdraw">
              <h4 className="sf-chg-h">Retirar solicitud</h4>
              <fieldset className="rf1-fields" disabled={locked}>
                <div className="field"><label htmlFor="chg-withdraw-reason">Motivo del retiro *</label><textarea id="chg-withdraw-reason" maxLength={MAX_REASON} value={reason} onChange={e => { setReason(e.target.value); setMsg(null); }} /></div>
              </fieldset>
              <div className="toolbar"><button type="button" className="btn danger" onClick={() => run('withdraw')} disabled={busy || (!!pending && pending.kind !== 'withdraw')}>{busy ? 'Registrando…' : pending ? '🔁 Reintentar retiro' : 'Retirar solicitud'}</button></div>
            </div>}
            {pending && <div className="note warn" style={{ marginTop: 10 }}>Operación protegida: se reintentará exactamente el mismo contenido (clave {pending.key.slice(0, 8)}…).</div>}
          </>}
      </div>
      <div className="sf-prov179-modal-foot"><button type="button" className="btn light" onClick={close} disabled={busy}>Cerrar</button></div>
    </div>
  </div>;
}

export function ChangeControl({ onNotify }) {
  const [state, setState] = useState('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [board, setBoard] = useState({ status: 'loading', data: null, error: '' });
  const [open, setOpen] = useState(null);
  useEffect(() => { const h = setTimeout(() => { setQ(input); setPage(1); }, 300); return () => clearTimeout(h); }, [input]);
  useEffect(() => {
    const c = new AbortController();
    setBoard(b => ({ ...b, status: 'loading', error: '' }));
    changeOverview(boardQuery({ state, q, page }), c.signal).then(data => { if (!c.signal.aborted) setBoard({ status: 'ready', data, error: '' }); })
      .catch(e => { if (!c.signal.aborted) setBoard({ status: 'error', data: null, error: errText(e) }); });
    return () => c.abort();
  }, [state, q, page, tick]);
  const d = board.data, items = d?.items || [];
  const pick = s => { setState(s); setPage(1); };

  return <div className="card sf-prov179-panel sf-chg" data-testid="change-control">
    <div className="subsection-header"><div><h3>🔁 Control de modificaciones / Change Requests</h3><p>Conserva la requisición original, genera Rev. N y reabre únicamente las etapas realmente afectadas.</p></div><span className="badge info sf-chg-badge">Requisición → Cotización Rev. N → OC Rev. N</span></div>
    <div className="note warn" data-testid="chg-usage"><b>Uso:</b> desde Matriz de requisiciones pulsa <b>SOLICITAR MODIFICACIÓN</b>. La revisión autorizada no se elimina ni se sobrescribe.</div>
    <div className="sf-prov179-kpis">{boardKpis(d?.kpis).map(k => <button type="button" key={k.label} className={'sf-prov179-kpi sf-reg-kpi ' + k.tone + (state === k.filter && k.filter !== 'all' ? ' active' : '')} aria-pressed={state === k.filter} onClick={() => pick(k.filter)}><div className="n">{k.n}</div><div className="l">{k.label}</div></button>)}</div>
    <div className="sf-reg-filters">
      <input className="search" aria-label="Buscar solicitud de cambio" placeholder="Buscar CR, requisición, cliente, motivo o estado..." value={input} onChange={e => setInput(e.target.value)} />
      <select aria-label="Estado del cambio" value={FLOW_FILTERS.some(f => f[0] === state) ? state : 'all'} onChange={e => pick(e.target.value)}>{FLOW_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>
    {board.status === 'error' && <div className="note danger" role="alert">{board.error} <button type="button" className="btn sm ghost" onClick={() => setTick(n => n + 1)}>Reintentar</button></div>}
    <div className="table-wrap"><table className="sf-prov179-table sf-chg-table"><thead><tr>{['Cambio', 'Requisición', 'Cliente', 'Revisión', 'Fecha / solicitado por', 'Origen', 'Impacto', 'Cotización cliente', 'OC / enmienda', 'Estado', 'Acciones'].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{board.status === 'loading' && !items.length ? <tr><td colSpan={11}><div className="empty">Consultando solicitudes en MariaDB…</div></td></tr>
        : !items.length ? <tr><td colSpan={11}><div className="empty" data-testid="chg-empty">{d?.kpis?.total ? 'Sin solicitudes con estos filtros.' : 'No hay modificaciones registradas.'}</div></td></tr>
        : items.map(r => { const c = changeCell(r), rq = requestCell(r), im = impactCell(r), qc = quoteCell(r), pc = poCell(r), [tone, label] = flowChip(r);
          return <tr key={r.id} data-testid="chg-row">
            <td><b>{c.main}</b><small>{c.sub}</small></td>
            <td>{r.requisition_folio}</td>
            <td>{r.client || '—'}{r.client_code && <small>{r.client_code}</small>}</td>
            <td>{revisionText(r)}</td>
            <td>{rq.main}<small>{rq.sub}</small></td>
            <td>{r.source || '—'}<small>{r.reference || ''}</small></td>
            <td>{im.main}{im.chips.length > 0 && <span className="sf-chg-chips">{im.chips.map(x => <span className="sf-prov179-chip info" key={x}>{x}</span>)}</span>}</td>
            <td>{qc.main}<small>{qc.sub}</small></td>
            <td>{pc.main}<small>{pc.sub}</small></td>
            <td><span className={'sf-prov179-chip ' + tone} data-testid="chg-state">{label}</span></td>
            <td><div className="action-buttons sf-chg-actions"><button type="button" className="btn sm light" onClick={() => setOpen(r)}>VER</button>
              {r.reviewable && <button type="button" className="btn sm secondary" onClick={() => setOpen(r)}>REVISAR</button>}
              {r.withdrawable && <button type="button" className="btn sm danger" onClick={() => setOpen(r)}>RETIRAR</button>}</div></td>
          </tr>; })}</tbody></table></div>
    {d && d.pages > 1 && <div className="req-matrix-footer"><div className="req-matrix-summary">Mostrando {(d.page - 1) * BOARD_PAGE + 1}–{Math.min(d.page * BOARD_PAGE, d.total)} de {d.total}</div><div className="req-matrix-pagination"><button className="btn sm ghost" disabled={d.page <= 1} onClick={() => setPage(d.page - 1)}>‹</button><span className="btn sm ghost active">{d.page} / {d.pages}</span><button className="btn sm ghost" disabled={d.page >= d.pages} onClick={() => setPage(d.page + 1)}>›</button></div></div>}
    {open && <ChangeDetail row={open} onClose={() => setOpen(null)} onChanged={() => setTick(n => n + 1)} onNotify={onNotify} />}
  </div>;
}
