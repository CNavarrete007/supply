import React, { useEffect, useState } from 'react';
import { Lock, Loader2, AlertCircle, Search, X } from 'lucide-react';
import { validationsMatrix, validationRequisition } from './api';
import { PAGE_SIZES, CURRENCIES, matrixChip, buyerCards, matrixRow, deleteBlock, deleteError, deleteLockedText, editPreset, emptyCostSource, validateCostSource, costSourceLockedText, rangeText } from './validationMatrix.mjs';
import { useLoad } from '../reception/useLoad.js';

// Gestión del Contratista · tarjeta 3 "Matriz de validaciones internas" (diseño Grupo Gerez), conectada a MariaDB en modo
// lectura (requisition_reviews). Editar abre la tarjeta 1 en modo edición; Eliminar y Registrar fuente de costo validan y
// no escriben.
const TONES = { green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-800 border-amber-200', red: 'bg-rose-50 text-rose-700 border-rose-200', gray: 'bg-slate-100 text-slate-600 border-slate-200', blue: 'bg-blue-50 text-blue-800 border-blue-200' };
const chip = c => <span className={`inline-block px-2.5 py-1 rounded-full text-[9.5px] font-black border whitespace-nowrap ${TONES[c.tone] || TONES.gray}`}>{c.text}</span>;

export function ValidationMatrix({ en = false, notify = () => {}, onEdit, onNew }) {
  const tx = (es, e) => (en ? e : es);
  const [buyer, setBuyer] = useState(null); // null = cards only (the matrix opens on a card)
  const [page, setPage] = useState(1); const [size, setSize] = useState(10);
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [rev] = useState(0);
  const [del, setDel] = useState(null); const [cost, setCost] = useState(null);
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useLoad(s => validationsMatrix({ page_size: 10 }, s), [rev]);
  const list = useLoad(s => validationsMatrix({ page, page_size: size, buyer: buyer || 'all', q }, s), [page, size, buyer, q, rev], !!buyer);
  const cards = summary.data ? buyerCards(summary.data.summary, en) : [];
  const last = Math.max(1, Math.ceil((list.data?.total || 0) / size));

  const openCost = async x => {
    setCost({ x, status: 'loading', lines: [], f: emptyCostSource([]), tried: false, msg: null });
    try { const d = await validationRequisition(x.requisition_id); setCost(c => c && c.x.id === x.id ? { ...c, status: 'ready', lines: d.items, f: emptyCostSource(d.items) } : c); }
    catch (e) { setCost(c => c && { ...c, status: 'error', msg: { kind: 'error', text: e.message } }); }
  };
  const saveCost = () => setCost(c => { const v = validateCostSource(c.f, c.lines, en); const msg = v.ok ? { kind: 'locked', text: costSourceLockedText(c.x, c.f, c.lines, en) } : { kind: 'error', text: v.first }; if (v.ok) notify(tx('Fuente de costo no registrada', 'Cost source not recorded'), msg.text, 'warning'); return { ...c, tried: true, msg }; });
  const cv = cost ? validateCostSource(cost.f, cost.lines, en) : null;

  return <div className="space-y-5" data-testid="validation-matrix">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
      <div className="min-w-0"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de validaciones internas', 'Internal validation matrix')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Consulta si cada requisición puede o no pasar a cotización.', 'Check whether each requisition can move to quoting.')}</p></div>
      <span className="text-sm font-black shrink-0"><button type="button" onClick={() => onNew?.()} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md">+ {tx('Nueva validación', 'New validation')}</button></span>
    </div>

    <div className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4 bg-gradient-to-br from-white to-purple-50/30">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2"><div><h4 className="text-base font-black text-slate-900">{tx('Tarjetas por responsable', 'Cards by manager')}</h4><p className="text-[11px] text-slate-500">{tx('Selecciona un responsable para abrir únicamente sus validaciones internas.', 'Select a manager to open only their internal validations.')}</p></div>{summary.data && <span data-testid="validation-matrix-chip" className="text-[10.5px] font-black text-blue-900 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 shrink-0">{matrixChip(summary.data.summary, en)}</span>}</div>
      {summary.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {summary.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{summary.error.message}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">{cards.map(c => { const on = buyer === c.key; return <button key={c.key} type="button" aria-pressed={on} data-testid="validation-buyer-card" onClick={() => { setBuyer(c.key); setPage(1); }} className={`relative overflow-hidden text-left rounded-2xl border p-3.5 pl-4 bg-white transition-all ${on ? 'border-cyan-600 ring-2 ring-cyan-500/20 shadow-md bg-gradient-to-br from-white to-pink-50/50' : 'border-slate-200 hover:border-slate-300 shadow-xs'}`}>
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 via-purple-600 to-pink-500" />
        <div className="flex items-start gap-2.5 mb-3"><span className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-600 via-indigo-600 to-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0">{c.badge}</span><span className="min-w-0"><span className="block text-[11.5px] font-black text-slate-900 leading-tight">{c.name}</span><span className="block text-[10px] text-slate-500 mt-0.5">{c.sub}</span></span></div>
        <div className="grid grid-cols-3 gap-1.5 mb-3">{[[c.total, tx('Validaciones', 'Validations')], [c.can, tx('Puede cotizar', 'Can quote')], [c.blocked, tx('Bloqueadas', 'Blocked')]].map(([n, t]) => <span key={t} className="block min-w-0 bg-white border border-slate-200 rounded-xl px-1.5 py-1.5"><span className="block text-sm font-black text-slate-900">{n}</span><span className="block text-[8px] leading-tight font-black text-slate-600">{t}</span></span>)}</div>
        <span className="flex items-center justify-between text-[10px] font-black text-slate-700"><span>{c.foot}</span><span className="text-cyan-700 text-sm">→</span></span>
      </button>; })}</div>
      {buyer && <div data-testid="validation-matrix-selected" className="rounded-2xl border border-slate-200 bg-white p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0"><h4 className="text-sm font-black text-slate-900">{cards.find(c => c.key === buyer)?.name || ''}</h4><p className="text-[10.5px] text-slate-500">{list.data?.total ?? '…'} {tx('registro(s)', 'record(s)')}</p></div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:flex-1"><div className="relative flex-1 min-w-[220px] max-w-md"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar validación', 'Search validation')} value={input} maxLength={120} onChange={e => setInput(e.target.value)} placeholder={tx('Buscar por folio, requisición, referencia o responsable...', 'Search by folio, requisition, reference or manager...')} className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/20" /></div>
          <span className="text-xs font-black"><button type="button" onClick={() => { setBuyer(null); setInput(''); setQ(''); }} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl">← {tx('Volver a tarjetas', 'Back to cards')}</button></span></div>
      </div>}
    </div>

    {buyer && <>
      {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
      {list.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{list.error.message}</p>}
      <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white"><table className="w-full text-left border-collapse text-[11px] min-w-[1300px]"><thead><tr className="bg-blue-50/60 border-b border-slate-200 text-slate-800 font-black uppercase tracking-wider text-[10px]">{[tx('Folio interno', 'Internal folio'), tx('Requisición', 'Requisition'), tx('Referencia interna', 'Internal reference'), tx('Responsable', 'Manager'), tx('Técnica', 'Technical'), tx('Contractual', 'Contractual'), tx('Presupuesto', 'Budget'), tx('Estrategia', 'Strategy'), tx('¿Puede cotizar?', 'Can quote?'), tx('Acciones', 'Actions')].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{(list.data?.items || []).map(x => { const v = matrixRow(x, en); return <tr key={x.id} data-testid="validation-row" className="align-top hover:bg-slate-50/60">
          <td className="p-3 whitespace-nowrap"><div className="font-black text-slate-900">{v.folio}</div>{v.folioSub && <div className="text-[9px] text-slate-500">{v.folioSub}</div>}</td>
          <td className="p-3"><div className="text-slate-800 font-semibold">{v.requisition}</div>{v.requisitionSub && <div className="text-[9px] text-slate-500">{v.requisitionSub}</div>}</td>
          <td className="p-3">{chip({ text: v.reference, tone: v.reference === '—' ? 'gray' : 'blue' })}</td>
          <td className="p-3 text-slate-800 min-w-[150px]">{v.buyer}</td>
          <td className="p-3">{chip(v.technical)}</td><td className="p-3">{chip(v.contract)}</td><td className="p-3">{chip(v.budget)}</td>
          <td className="p-3 min-w-[130px]">{v.sole ? <><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-black border bg-orange-50 text-orange-800 border-orange-300"><span className="w-2 h-2 rounded-full bg-orange-500" />{tx('FUENTE ÚNICA', 'SOLE SOURCE')}</span><div className="text-[9.5px] text-slate-600 mt-1">{v.strategy}</div></> : <span className="text-slate-800">{v.strategy}</span>}</td>
          <td className="p-3">{chip(v.canQuote)}</td>
          <td className="p-3"><div className="flex flex-wrap gap-1.5 min-w-[190px] text-[11px] font-black uppercase">
            <button type="button" onClick={() => onEdit?.(editPreset(x))} className="uppercase px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg">{tx('Editar', 'Edit')}</button>
            <button type="button" onClick={() => setDel({ x, folio: '', reason: '', msg: null, block: deleteBlock(x, en) })} className="uppercase px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm">{tx('Eliminar', 'Delete')}</button>
            {v.sole && <button type="button" onClick={() => openCost(x)} className="uppercase px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg shadow-sm">💲 {tx('Registrar fuente de costo', 'Record cost source')}</button>}
          </div></td>
        </tr>; })}{list.status === 'ready' && !list.data.items.length && <tr><td colSpan={10} className="p-10 text-center"><p className="font-black text-slate-600 text-xs">{tx('Sin validaciones registradas', 'No validations recorded')}</p><p className="text-[11px] text-slate-400 mt-1">{tx('Haz clic en "+ Nueva validación" para dar de alta un registro en el sistema.', 'Click "+ New validation" to add a record.')}</p></td></tr>}</tbody></table></div>
      <div data-testid="validation-matrix-pager" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <span className="text-slate-600">{rangeText(list.data, en)}</span>
        <div className="flex flex-wrap items-center gap-2 font-black"><span>{tx('Mostrar', 'Show')}</span><select aria-label={tx('Registros por página', 'Records per page')} value={size} onChange={e => { setSize(Number(e.target.value)); setPage(1); }} className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white">{PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}</select>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">← {tx('Anterior', 'Previous')}</button><span>{tx('Página', 'Page')} {page} / {last}</span><button type="button" disabled={page >= last} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">{tx('Siguiente', 'Next')} →</button></div>
      </div>
    </>}
    <p className="text-[10px] text-slate-400 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" />{tx('Fuente: MariaDB (requisition_reviews). ¿Puede cotizar? = técnica y contractual conformes o con observaciones y presupuesto disponible o parcial. Editar, eliminar y registrar la fuente de costo son escrituras bloqueadas hasta su autorización.', 'Source: MariaDB (requisition_reviews). Can quote? = technical and contractual compliant or with observations and budget available or partial. Editing, deleting and recording the cost source are writes blocked until authorized.')}</p>

    {del && <div role="dialog" aria-modal="true" aria-label={tx('Eliminar validación', 'Delete validation')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setDel(null)}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-rose-700">{tx('Eliminar', 'Delete')} {del.x.folio}</h3><button type="button" aria-label={tx('Cerrar diálogo', 'Close dialog')} onClick={() => setDel(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-slate-600">{del.x.requisition} · {del.x.buyer || '—'} · {del.x.strategy}</p>
        {del.block ? <p role="alert" data-testid="validation-delete-block" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{del.block}</p> : <>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx(`Escribe el folio (${del.x.folio}) para confirmar`, `Type the folio (${del.x.folio}) to confirm`)}</span><input type="text" aria-label={tx('Folio a eliminar', 'Folio to delete')} value={del.folio} onChange={e => { const t = e.target.value; setDel(d => ({ ...d, folio: t, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx('Motivo', 'Reason')} *</span><textarea rows={3} aria-label={tx('Motivo de la eliminación', 'Deletion reason')} value={del.reason} maxLength={600} onChange={e => { const t = e.target.value; setDel(d => ({ ...d, reason: t, msg: null })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
        </>}
        {del.msg && <p data-testid="validation-delete-msg" role={del.msg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${del.msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{del.msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{del.msg.text}</span></p>}
        <div className="flex justify-end gap-2 text-xs font-black"><button type="button" onClick={() => setDel(null)} className="px-4 py-2 border border-slate-200 rounded-xl">{tx('Cancelar', 'Cancel')}</button>{!del.block && <button type="button" onClick={() => setDel(d => { const err = deleteError(d.x, d.folio, d.reason, en); return { ...d, msg: err ? { kind: 'error', text: err } : { kind: 'locked', text: deleteLockedText(d.x, en) } }; })} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl">{tx('Eliminar', 'Delete')}</button>}</div>
      </div>
    </div>}

    {cost && <div role="dialog" aria-modal="true" aria-label={tx('Registrar fuente de costo', 'Record cost source')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setCost(null)}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-orange-700">💲 {tx('Registrar fuente de costo', 'Record cost source')} · {cost.x.requisition}</h3><button type="button" aria-label={tx('Cerrar diálogo', 'Close dialog')} onClick={() => setCost(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
        <p className="text-[11px] text-slate-600">{tx('Fuente única justificada: sin competencia de cotizaciones, documenta el costo de cada partida y de dónde proviene (cotización única del proveedor, lista de precios, contrato, precio histórico).', 'Justified sole source: without competing quotes, document the cost of each line and where it comes from (single supplier quote, price list, contract, historical price).')} {cost.x.folio} · {cost.x.buyer || '—'}</p>
        {cost.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
        {cost.status === 'ready' && <>
          <div className="border border-slate-200 rounded-xl overflow-x-auto"><table className="w-full text-left border-collapse text-[11px] min-w-[560px]"><thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px]">{['#', tx('Descripción', 'Description'), tx('Cantidad', 'Quantity'), tx('Costo unitario', 'Unit cost'), tx('Moneda', 'Currency')].map(h => <th key={h} className="p-2.5">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{cost.lines.map(l => { const lv = cost.f.lines[l.line_number] || {}; const le = cost.tried ? cv.lineErrors[l.line_number] : ''; return <tr key={l.line_number} className="align-top"><td className="p-2.5">{l.line_number}</td><td className="p-2.5 font-semibold">{l.description}</td><td className="p-2.5">{l.quantity} {l.unit_label}</td>
              <td className="p-2.5"><input type="text" inputMode="decimal" aria-label={`${tx('Costo unitario', 'Unit cost')} #${l.line_number}`} value={lv.cost} onChange={e => { const t = e.target.value; setCost(c => ({ ...c, msg: null, f: { ...c.f, lines: { ...c.f.lines, [l.line_number]: { ...c.f.lines[l.line_number], cost: t } } } })); }} className={`w-28 px-2 py-1.5 border rounded-lg ${le ? 'border-rose-400' : 'border-slate-300'}`} />{le && <span role="alert" className="block text-[10px] text-rose-600 font-semibold mt-1">{le}</span>}</td>
              <td className="p-2.5"><select aria-label={`${tx('Moneda', 'Currency')} #${l.line_number}`} value={lv.currency} onChange={e => { const t = e.target.value; setCost(c => ({ ...c, msg: null, f: { ...c.f, lines: { ...c.f.lines, [l.line_number]: { ...c.f.lines[l.line_number], currency: t } } } })); }} className="px-2 py-1.5 border border-slate-300 rounded-lg">{CURRENCIES.map(cu => <option key={cu} value={cu}>{cu}</option>)}</select></td></tr>; })}</tbody></table></div>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx('Fuente del costo', 'Cost source')} *</span><input type="text" aria-label={tx('Fuente del costo', 'Cost source')} value={cost.f.source} maxLength={260} placeholder={tx('Cotización única del proveedor, lista de precios, contrato, precio histórico...', 'Single supplier quote, price list, contract, historical price...')} onChange={e => { const t = e.target.value; setCost(c => ({ ...c, msg: null, f: { ...c.f, source: t } })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
          <label className="block"><span className="block text-[11px] font-black mb-1">{tx('Observaciones', 'Notes')}</span><textarea rows={2} aria-label={tx('Observaciones de la fuente de costo', 'Cost source notes')} value={cost.f.notes} maxLength={1100} onChange={e => { const t = e.target.value; setCost(c => ({ ...c, msg: null, f: { ...c.f, notes: t } })); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" /></label>
        </>}
        {cost.msg && <p data-testid="validation-cost-msg" role={cost.msg.kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${cost.msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{cost.msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{cost.msg.text}</span></p>}
        <div className="flex justify-end gap-2 text-xs font-black"><button type="button" onClick={() => setCost(null)} className="px-4 py-2 border border-slate-200 rounded-xl">{tx('Cancelar', 'Cancel')}</button>{cost.status === 'ready' && <button type="button" onClick={saveCost} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl">{tx('Registrar fuente de costo', 'Record cost source')}</button>}</div>
      </div>
    </div>}
  </div>;
}

export default ValidationMatrix;
