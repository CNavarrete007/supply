import React, { useState } from 'react';
import { Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { smartRules } from './api';
import { RULES_NOTE_ES, RULES_NOTE_EN, ruleRows, blockText, truncatedText } from './rulesModel.mjs';
import { useLoad } from '../reception/useLoad.js';

// Gestión del Contratista · tarjeta 4 "Reglas inteligentes" (diseño Grupo Gerez), conectada a MariaDB en modo lectura:
// requisiciones sin validación, validaciones vigentes con bloqueo y requisiciones listas para cotizar. Cada contador se
// despliega con su lista y acciones de navegación (Validar, Ver en matriz, Estrategia). No escribe nada.
const TONE = { amber: 'bg-amber-50/70 border-l-amber-500', red: 'bg-rose-50/70 border-l-rose-500', green: 'bg-emerald-50/70 border-l-emerald-500' };
const ymd = v => (v ? String(v).slice(0, 10) : '—');

export function SmartRules({ en = false, onGo, onStart }) {
  const tx = (es, e) => (en ? e : es);
  const [open, setOpen] = useState('');
  const rules = useLoad(s => smartRules(s), []);
  const d = rules.data;
  const th = h => <th key={h} className="p-2.5 whitespace-nowrap">{h}</th>;
  const btn = (label, onClick) => <span className="text-[10px] font-black uppercase"><button type="button" onClick={onClick} className="uppercase px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg">{label}</button></span>;
  const list = key => {
    if (key === 'without_validation') return <table className="w-full text-left border-collapse text-[11px] min-w-[760px]"><thead><tr className="bg-white/70 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px]">{[tx('Requisición', 'Requisition'), tx('Cliente', 'Client'), tx('Proyecto', 'Project'), tx('Partidas', 'Lines'), tx('Solicitada', 'Requested'), tx('Requerida', 'Needed'), ''].map(th)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{d.without_validation.map(x => <tr key={x.id} data-testid="rule-item"><td className="p-2.5 font-black text-slate-900">{x.folio}</td><td className="p-2.5">{x.client_name}</td><td className="p-2.5">{x.project || '—'}</td><td className="p-2.5">{x.item_count}</td><td className="p-2.5">{ymd(x.request_date)}</td><td className="p-2.5">{ymd(x.need_date)}</td><td className="p-2.5 text-right">{btn(tx('Validar', 'Validate'), () => onStart?.('register', x.id))}</td></tr>)}</tbody></table>;
    const rows = d[key];
    return <table className="w-full text-left border-collapse text-[11px] min-w-[900px]"><thead><tr className="bg-white/70 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px]">{[tx('Folio interno', 'Internal folio'), tx('Requisición', 'Requisition'), tx('Responsable', 'Manager'), key === 'blocked' ? tx('Motivo del bloqueo', 'Block reason') : tx('Estrategia', 'Strategy'), tx('Mín. cotizaciones', 'Min. quotes'), 'RFQ', ''].map(th)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map(x => <tr key={x.id} data-testid="rule-item"><td className="p-2.5 font-black text-slate-900">{x.folio}</td><td className="p-2.5"><div className="font-semibold">{x.requisition}</div><div className="text-[9.5px] text-slate-500">{x.client_name}</div></td><td className="p-2.5 uppercase">{x.buyer || '—'}</td>
        <td className="p-2.5">{key === 'blocked' ? <span className="text-rose-700 font-semibold">{blockText(x, en)}</span> : x.strategy}</td><td className="p-2.5">{x.min_quotes}</td><td className="p-2.5">{x.rfq_count}</td>
        <td className="p-2.5 text-right whitespace-nowrap">{key === 'blocked' ? btn(tx('Ver en matriz', 'View in matrix'), () => onGo?.('matrix', tx('Matriz de validaciones', 'Validation Matrix'))) : btn(tx('Estrategia', 'Strategy'), () => onStart?.('strategy', x.requisition_id))}</td></tr>)}</tbody></table>;
  };

  return <div className="space-y-5" data-testid="smart-rules">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
      <div className="min-w-0"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Reglas inteligentes', 'Smart rules')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Validaciones previas antes de avanzar a la etapa de cotización.', 'Pre-validations before moving to the quoting stage.')}</p></div>
      <span className="text-sm font-black shrink-0"><button type="button" onClick={() => onGo?.('matrix', tx('Matriz de validaciones', 'Validation Matrix'))} className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl shadow-xs flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver validaciones', 'View validations')}</button></span>
    </div>
    {rules.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
    {rules.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{rules.error.message}</p>}
    {d && <div className="space-y-3">{ruleRows(d.counters, en).map(r => { const on = open === r.key; const shown = r.key === 'without_validation' ? d.without_validation.length : d[r.key].length; return <div key={r.key} data-testid={`rule-${r.key}`} className={`rounded-xl border border-slate-200/60 border-l-4 ${TONE[r.tone]}`}>
      <button type="button" aria-expanded={on} disabled={!r.count} onClick={() => setOpen(on ? '' : r.key)} className="w-full p-3.5 flex items-center justify-between gap-3 text-left text-xs text-slate-700 disabled:cursor-default">
        <span><span className="font-black text-slate-900">{r.count}</span> {r.text}</span>{r.count > 0 && (on ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />)}</button>
      {on && <div className="px-3.5 pb-3.5 space-y-2"><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{list(r.key)}</div>{truncatedText(shown, r.count, en) && <p className="text-[10px] text-slate-500">{truncatedText(shown, r.count, en)}</p>}</div>}
    </div>; })}</div>}
    <p className="text-[11px] text-slate-500 leading-relaxed">{en ? RULES_NOTE_EN : RULES_NOTE_ES}</p>
  </div>;
}

export default SmartRules;
