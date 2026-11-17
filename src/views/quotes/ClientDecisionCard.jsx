import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Lock, ChevronLeft, ChevronRight, Mail, X, History } from 'lucide-react';
import { listCustomerQuotes, getCustomerQuote } from './api';
import { money, label } from './model.mjs';
import { statusText, changeTarget } from './cqMatrix.mjs';
import { decisionKpis, decisionCards, quoteReference, decisionActions, editBlock, DECISIONS, CHANNELS, emptyDecision, validateDecision, decisionEffect } from './cqDecision.mjs';

// Tarjeta 9 · Decisión del cliente (control de aprobación). Lee de MariaDB la revisión vigente de cada cotización
// (GET /api/v1/quotes/customer-quotes?scope=current&group=…&client=…) y su historial (GET /customer-quotes/{id}).
// Ver PDF usa el visor formal; MODIFICAR DESDE REQ. abre la modificación controlada R3A (la API decide).
// Enviar al cliente y registrar la decisión son escrituras comerciales bloqueadas: se validan y se explica el motivo.
function useLoad(fn, deps, enabled = true) {
  const [st, setSt] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!enabled) { setSt({ status: 'idle', data: null, error: null }); return undefined; }
    const c = new AbortController();
    setSt(x => ({ ...x, status: 'loading', error: null }));
    fn(c.signal).then(d => !c.signal.aborted && setSt({ status: 'ready', data: d, error: null })).catch(e => !c.signal.aborted && setSt(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, [...deps, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
const PAGE = 25;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const PILL = {
  draft: 'bg-blue-50 text-blue-800 border-blue-200', review: 'bg-amber-50 text-amber-800 border-amber-200', authorized: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  sent: 'bg-violet-50 text-violet-800 border-violet-200', expired: 'bg-rose-50 text-rose-700 border-rose-200', approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  change_requested: 'bg-orange-50 text-orange-800 border-orange-200', rejected: 'bg-rose-100 text-rose-800 border-rose-200',
};

function DecisionHistory({ id, en }) {
  const tx = (es, e) => (en ? e : es);
  const det = useLoad(s => getCustomerQuote(id, s), [id]);
  if (det.status === 'loading') return <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando historial…', 'Loading history…')}</p>;
  if (det.error) return <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{det.error.message}</p>;
  if (!det.data) return null;
  const { decisions = [], versions = [] } = det.data;
  return <div data-testid="cqd-history" className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
    <div className="space-y-1.5"><h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{tx('Decisiones del cliente', 'Client decisions')}</h5>
      {decisions.map((x, i) => <div key={i} className="p-2.5 rounded-xl border border-slate-100 border-l-4 border-l-emerald-500 bg-white"><div className="flex flex-wrap justify-between gap-2"><strong>{label(x.decision_code, en)}</strong><span className="text-slate-500">{String(x.decision_at || '').slice(0, 16)} · {x.decision_channel || '—'} · {x.actor || '—'}</span></div>{x.note && <p className="text-[11px] text-slate-600 mt-1">{x.note}</p>}</div>)}
      {!decisions.length && <p className="text-[11px] text-slate-400">{tx('Sin decisiones registradas para esta revisión.', 'No decisions recorded for this revision.')}</p>}</div>
    <div className="space-y-1.5"><h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{tx('Revisiones', 'Revisions')}</h5>
      {versions.map(v => <div key={v.id} className={`p-2.5 rounded-xl border flex flex-wrap justify-between gap-2 ${v.id === id ? 'border-purple-300 bg-purple-50/40' : 'border-slate-200 bg-white'}`}><span className="font-bold">{v.folio} · v{v.version_number}</span><span>{money(v.total_amount, v.currency, en)}</span><span className="text-slate-500">{label(v.client_decision_status, en)}</span></div>)}</div>
  </div>;
}

export function ClientDecisionCard({ en = false, notify, lockText = '', refresh = 0, onEdit, onOpenPdf, onRequestChange, onBlocked }) {
  const tx = (es, e) => (en ? e : es);
  const [client, setClient] = useState(null); // null = solo tarjetas; 'all' | public id
  const [group, setGroup] = useState('attention');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState({});
  const [notice, setNotice] = useState(null);
  const [dec, setDec] = useState(null); const [form, setForm] = useState(null); const [tried, setTried] = useState(false); const [result, setResult] = useState('');
  const list = useLoad(s => listCustomerQuotes({ scope: 'current', group, client: client || 'all', page, page_size: PAGE }, s), [group, client, page, refresh]);
  const k = useMemo(() => decisionKpis(list.data?.summary?.statuses || []), [list.data]);
  const cards = useMemo(() => decisionCards(list.data?.summary?.client_cards || [], en), [list.data, en]);
  const byId = useMemo(() => Object.fromEntries(cards.map(c => [c.id, c])), [cards]);
  const sel = client ? (byId[client] || { id: client, name: '—', attention: 0 }) : null;
  const rows = list.data?.items || []; const total = list.data?.total || 0; const last = Math.max(1, Math.ceil(total / PAGE));
  const pick = id => { setClient(id); setGroup('attention'); setPage(1); setNotice(null); setOpen({}); };
  const say = (title, msg, kind = 'warning') => { setNotice(msg); notify?.(title, msg, kind); };

  const edit = r => {
    const b = editBlock(r, en);
    if (b) { say(tx('Editar', 'Edit'), b); return; }
    notify?.(tx('Editar cotización', 'Edit quote'), tx(`Se abrió la tarjeta 6. Guardar cambios sobre ${r.folio} es una escritura comercial bloqueada: puedes preparar y validar la propuesta, pero no se registra.`, `Card 6 was opened. Saving changes to ${r.folio} is a blocked commercial write: you can prepare and validate the proposal, but it is not recorded.`), 'info');
    onEdit?.(r);
  };
  const send = r => say(tx('Enviar al cliente', 'Send to client'), tx(`${r.folio}: enviar la cotización al cliente (correo con el PDF y cambio a "Enviada al cliente") es una escritura comercial bloqueada hasta su autorización. No se envió nada.`, `${r.folio}: sending the quote to the client (email with the PDF and change to "Sent to client") is a commercial write blocked until authorized. Nothing was sent.`));
  const modify = r => { const t = changeTarget(r); (t.can_request_change ? onRequestChange : onBlocked)?.(t); };
  const openDecision = r => { setDec(r); setForm(emptyDecision({ ...r, client_contact: byId[r.client_id]?.contact }, today())); setTried(false); setResult(''); };
  const v = useMemo(() => (dec && form ? validateDecision(form, dec, today(), en) : null), [dec, form, en]);
  const setF = (key, val) => { setForm(f => ({ ...f, [key]: val })); setResult(''); };
  const record = () => {
    setTried(true);
    if (!v.ok) { notify?.(tx('Decisión incompleta', 'Incomplete decision'), v.first, 'warning'); return; }
    const msg = tx(`Decisión validada, pero no se registró: registrar la decisión del cliente sobre ${dec.folio} es una escritura comercial bloqueada hasta su autorización.`, `Decision validated but not recorded: recording the client decision on ${dec.folio} is a commercial write blocked until authorized.`);
    setResult(msg); notify?.(tx('Registro no habilitado', 'Recording not enabled'), msg, 'warning');
  };
  const err = key => tried && v?.errors[key] ? <p role="alert" className="text-[10.5px] text-rose-600 font-semibold mt-1">{v.errors[key]}</p> : null;
  const ctl = key => `w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-purple-500 ${tried && v?.errors[key] ? 'border-rose-400' : 'border-slate-300'}`;

  const kpis = [[k.prep, tx('Preparación interna', 'Internal preparation'), tx('Borrador / revisión', 'Draft / review'), 'border-t-purple-600', 'text-purple-700'],
    [k.client, tx('Pendientes del cliente', 'Pending with client'), tx('Enviadas sin respuesta', 'Sent without response'), 'border-t-blue-600', 'text-blue-700'],
    [k.approved, tx('Aprobadas', 'Approved'), tx('Habilitan la compra', 'Enable purchasing'), 'border-t-emerald-600', 'text-emerald-700'],
    [k.change, tx('Modificación', 'Modification'), tx('Requieren nueva revisión', 'Require a new revision'), 'border-t-amber-500', 'text-amber-600'],
    [k.rejected, tx('Rechazadas', 'Rejected'), tx('No autorizadas', 'Not authorized'), 'border-t-rose-600', 'text-rose-600']];
  const groups = [['attention', tx('Por atender', 'To attend')], ['client', tx('Sin respuesta', 'No response')], ['change', tx('Modificación', 'Modification')], ['approved', tx('Aprobadas', 'Approved')], ['rejected', tx('Rechazadas', 'Rejected')], ['all', tx('Todas', 'All')]];

  return <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-5" data-testid="cqd-card">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
      <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Control de aprobación del cliente', 'Client approval control')}</h3><p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{tx('Da seguimiento a la autorización interna, envío, respuesta del cliente y revisiones.', 'Track internal authorization, delivery, client response and revisions.')}</p></div>
      <span className="px-3 py-1 bg-blue-50 text-blue-900 font-bold text-[10.5px] rounded-full border border-blue-100 shrink-0 self-start">{tx('Trazabilidad comercial', 'Commercial traceability')}</span>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">{kpis.map(([n, t, s, b, c]) => <div key={t} data-testid="cqd-kpi" className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 border-t-4 ${b} shadow-2xs`}>
      <div className="text-2xl font-black text-slate-900">{list.data ? n : '…'}</div><div className="text-xs text-slate-500 mt-1">{t}</div><div className={`text-[11px] font-black mt-1.5 ${c}`}>{s}</div></div>)}</div>

    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-purple-50/30 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div><h4 className="text-sm sm:text-base font-black text-slate-900">{tx('Decisiones y aprobación por cliente', 'Decisions and approval by client')}</h4><p className="text-[10.5px] text-slate-500 mt-0.5">{tx('Selecciona un cliente para revisar sus cotizaciones pendientes, mensajes, revisiones y decisiones.', 'Select a client to review its pending quotes, messages, revisions and decisions.')}</p></div>
        <span data-testid="cqd-badge" className="px-3 py-1 bg-blue-50 text-blue-900 font-bold text-[10.5px] rounded-full border border-blue-100 self-start sm:self-auto">{tx(`${cards.length - 1} cliente(s) · ${cards[0]?.attention ?? 0} pendiente(s)`, `${cards.length - 1} client(s) · ${cards[0]?.attention ?? 0} pending`)}</span>
      </div>
      {list.status === 'loading' && !list.data && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {list.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{list.error.message}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{cards.map(c => { const on = client === c.id; return <button key={c.id} type="button" data-testid="cqd-client-card" aria-pressed={on} aria-label={`${c.name}: ${c.attention} ${tx('pendientes', 'pending')}`} onClick={() => pick(c.id)}
        className={`relative text-left p-3.5 rounded-2xl border bg-white shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col gap-3 cursor-pointer ${on ? 'border-purple-500 ring-2 ring-purple-200 bg-gradient-to-br from-white to-pink-50/50' : 'border-slate-200/90'}`}>
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-600 to-pink-500" />
        <span className="flex items-center gap-3 min-w-0"><span className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">{c.tag}</span>
          <span className="min-w-0"><span className="block text-xs font-black text-slate-900 leading-tight line-clamp-2" title={c.name}>{c.name}</span><span className="block text-[10px] text-slate-400 truncate mt-0.5">{c.subtitle}</span></span></span>
        <span className="grid grid-cols-3 gap-1.5">{[[c.attention, tx('Pendientes', 'Pending')], [c.no_response, tx('Sin respuesta', 'No response')], [c.change, tx('Modificar', 'Modify')]].map(([n, t]) => <span key={t} className="block px-1.5 py-2 rounded-xl border border-slate-200/80 bg-white min-w-0"><span className="block text-sm font-black text-slate-900">{n}</span><span className="block text-[8.5px] font-bold text-slate-500 leading-tight">{t}</span></span>)}</span>
        <span className="flex items-center justify-between text-[10px] font-bold text-slate-600"><span>{c.footer}</span><span className="text-purple-600 text-sm">→</span></span>
      </button>; })}
        {list.status === 'ready' && cards.length === 1 && <div className="col-span-full p-8 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{tx('No hay cotizaciones al cliente registradas.', 'No client quotes recorded.')}</div>}
      </div>
      {sel && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl border border-slate-200/80 bg-white/80">
        <div><h5 className="text-xs font-black text-slate-900">{sel.name}</h5><p className="text-[10px] text-slate-500">{tx(`${sel.attention} cotización(es) por atender`, `${sel.attention} quote(s) to attend`)}</p></div>
        <span className="text-xs font-black self-start sm:self-auto"><button type="button" onClick={() => { setClient(null); setNotice(null); }} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">← {tx('Volver a tarjetas', 'Back to cards')}</button></span>
      </div>}
    </div>

    {sel && <div className="space-y-3" data-testid="cqd-list">
      <div className="flex flex-wrap gap-1.5 text-[11px] font-bold" role="group" aria-label={tx('Etapa', 'Stage')}>{groups.map(([g, t]) => <button key={g} type="button" aria-pressed={group === g} onClick={() => { setGroup(g); setPage(1); setOpen({}); }} className={`px-3 py-1.5 rounded-full border transition-colors ${group === g ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t}</button>)}</div>
      {notice && <div role="status" data-testid="cqd-notice" className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{notice}</span></div>}
      {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {rows.map(r => { const a = decisionActions(r); return <div key={r.id} data-testid="cqd-quote" data-folio={r.folio} className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="min-w-0"><h5 className="text-sm sm:text-base font-black text-slate-900">{r.folio} · Rev. {r.revision}</h5>
            <p className="text-xs text-slate-500 mt-0.5">{r.client_name} · {quoteReference(r)} · {money(r.total_amount, r.currency, en)}</p>
            {r.status_key === 'expired' && <p className="text-[11px] text-rose-600 font-semibold mt-0.5">{tx(`Vigencia vencida el ${String(r.valid_until).slice(0, 10)} sin respuesta del cliente.`, `Validity expired on ${String(r.valid_until).slice(0, 10)} without client response.`)}</p>}
            {r.last_decision && <p className="text-[11px] text-slate-500 mt-0.5">{tx('Última decisión', 'Last decision')}: <strong className="text-slate-700">{label(r.last_decision, en)}</strong> · {String(r.last_decision_at || '').slice(0, 16)}</p>}</div>
          <span className={`px-3 py-1 rounded-full text-[10.5px] font-black border whitespace-nowrap self-start ${PILL[r.status_key] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{statusText(r, en)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <button type="button" onClick={() => edit(r)} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm">{tx('Editar', 'Edit')}</button>
          <button type="button" onClick={() => onOpenPdf?.(r.id)} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl">{tx('Ver PDF', 'View PDF')}</button>
          {a.send && <button type="button" onClick={() => send(r)} title={lockText || undefined} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 uppercase"><Mail className="w-3.5 h-3.5" />{tx('Enviar al cliente', 'Send to client')}</button>}
          {a.decide && <button type="button" onClick={() => openDecision(r)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm uppercase">{tx('Registrar decisión', 'Record decision')}</button>}
          {a.modify && <button type="button" onClick={() => modify(r)} className={`px-3 py-1.5 text-white rounded-xl shadow-sm uppercase ${r.can_request_change ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-300 hover:bg-amber-400'}`}>🔄 {tx('Modificar desde req.', 'Modify from req.')}</button>}
          <button type="button" aria-expanded={!!open[r.id]} onClick={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))} className="ml-auto px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl flex items-center gap-1.5"><History className="w-3.5 h-3.5" />{tx('Historial', 'History')}</button>
        </div>
        {open[r.id] && <DecisionHistory id={r.id} en={en} />}
      </div>; })}
      {list.status === 'ready' && !rows.length && <div className="p-10 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">{group === 'attention' ? tx('Sin cotizaciones por atender para esta selección.', 'No quotes to attend for this selection.') : tx('Sin cotizaciones en esta etapa.', 'No quotes in this stage.')}</div>}
      {total > PAGE && <div className="flex justify-between items-center text-xs text-slate-600"><span>{total} {tx('cotizaciones', 'quotes')} · {tx('Página', 'Page')} {page} / {last}</span>
        <div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"><ChevronRight size={16} /></button></div></div>}
    </div>}

    {dec && form && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDec(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sf-cqd-title" data-testid="cqd-decision" className="bg-white w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl shadow-2xl">
        <div className="bg-gradient-to-r from-[#2B4B9A] to-[#8C3AAA] px-5 py-3 flex items-center justify-between gap-3"><h2 id="sf-cqd-title" className="text-white font-black text-sm">{tx('Registrar decisión del cliente', 'Record client decision')}</h2>
          <span className="text-xs font-bold"><button type="button" aria-label={tx('Cerrar', 'Close')} onClick={() => setDec(null)} className="text-white/90 hover:text-white p-1"><X className="w-4 h-4" /></button></span></div>
        <div className="p-5 space-y-3.5 text-xs text-slate-700">
          <p className="font-bold text-slate-900">{dec.folio} · Rev. {dec.revision} · {dec.client_name} · {money(dec.total_amount, dec.currency, en)}</p>
          <div className="text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Decisión del cliente', 'Client decision')} *</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={tx('Decisión del cliente', 'Client decision')}>{DECISIONS.map(([c, es, e]) => <label key={c} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-bold ${form.decision === c ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-slate-200 bg-white'}`}><input type="radio" name="cqd-decision" value={c} checked={form.decision === c} onChange={() => setF('decision', c)} />{en ? e : es}</label>)}</div>{err('decision')}
            {form.decision && <p className="text-[11px] text-slate-500 mt-1.5">{decisionEffect(form.decision, en)}</p>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-medium">
            <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Fecha', 'Date')} *</span><input type="date" aria-label={tx('Fecha de la decisión', 'Decision date')} value={form.date} max={today()} onChange={e => setF('date', e.target.value)} className={ctl('date')} />{err('date')}</label>
            <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Hora', 'Time')}</span><input type="time" aria-label={tx('Hora de la decisión', 'Decision time')} value={form.time} onChange={e => setF('time', e.target.value)} className={ctl('time')} />{err('time')}</label>
            <label className="block"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Canal', 'Channel')} *</span><select aria-label={tx('Canal', 'Channel')} value={form.channel} onChange={e => setF('channel', e.target.value)} className={ctl('channel')}>{CHANNELS.map(([c, es, e]) => <option key={c} value={c}>{en ? e : es}</option>)}</select>{err('channel')}</label>
          </div>
          <label className="block text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Quién decide por el cliente', 'Who decides for the client')} *</span><input type="text" aria-label={tx('Quién decide por el cliente', 'Who decides for the client')} value={form.actor} maxLength={140} onChange={e => setF('actor', e.target.value)} className={ctl('actor')} />{err('actor')}</label>
          <label className="block text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Comentario / motivo', 'Comment / reason')}{['rejected', 'change_requested'].includes(form.decision) ? ' *' : ''}</span><textarea aria-label={tx('Comentario o motivo', 'Comment or reason')} rows={3} value={form.note} maxLength={1100} onChange={e => setF('note', e.target.value)} className={ctl('note')} />{err('note')}</label>
          <label className="block text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Evidencia (PDF, PNG o JPG, máx. 10 MB)', 'Evidence (PDF, PNG or JPG, max 10 MB)')}</span><input type="file" aria-label={tx('Evidencia de la decisión', 'Decision evidence')} accept="application/pdf,image/png,image/jpeg" onChange={e => setF('file', e.target.files?.[0] || null)} className="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-bold hover:file:bg-slate-200" />{err('file')}<span className="block text-[10px] text-slate-400 mt-1">{tx('El archivo solo se valida en el navegador; no se sube mientras el registro esté bloqueado.', 'The file is only validated in the browser; it is not uploaded while recording is blocked.')}</span></label>
          {v?.warnings.map(w => <p key={w} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">{w}</p>)}
          {result && <p role="alert" data-testid="cqd-result" className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{result}</span></p>}
          <div className="flex justify-end gap-2 text-xs font-bold pt-1">
            <button type="button" onClick={() => setDec(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200">{tx('Cancelar', 'Cancel')}</button>
            <button type="button" onClick={record} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{tx('Registrar decisión', 'Record decision')}</button>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}

export default ClientDecisionCard;
