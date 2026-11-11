import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Download, Info, Loader2, LockKeyhole, Printer, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { useMatrixData } from './generalMatrix/useMatrixData';
import {
  DEFAULT_COMPANY, P2P_STAGES, PENDING_STAGE, localToday, money, stageLabel, reportRows, reportMetrics, moneyLines,
  executiveSummary, conclusions, poCell, reportCsv, reportPrintHtml,
} from './reports/model.mjs';
import { riskOf } from './generalMatrix/model.mjs';

// Reportes · "Generador de reporte gerencial" (diseño Grupo Gerez) con datos reales de MariaDB.
// Mismas fuentes y reglas que la Matriz General (solo GET). Montos por moneda, sin conversión; "Comprado" = OC
// vigentes contadas una vez; "Ahorro / desviación" solo sobre requisiciones con presupuesto y OC en la misma moneda.
const PAGE = 25;
const EMPTY = { from: '', to: '', client: 'all', stage: 'all' };
const inputCls = 'w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs';
const TONE = { warning: [TriangleAlert, 'text-amber-600'], ok: [CheckCircle2, 'text-emerald-600'], info: [Info, 'text-blue-600'] };

export function Reports({ onNotify, lang = 'es', language, isEnglish }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const notify = (title, message, type = 'info') => { if (typeof onNotify === 'function') onNotify(title, message, type); };
  const [revision, setRevision] = useState(0);
  const { clients, reqs, stages, rows, ready, stagesDenied } = useMatrixData(revision);
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(null); // null = reporte aún no generado (como en el diseño)
  const [issued, setIssued] = useState('');
  const [page, setPage] = useState(1);
  const invalidRange = !!(draft.from && draft.to && draft.from > draft.to);
  const day = localToday();

  const scoped = useMemo(() => (applied ? reportRows(rows, applied) : []), [rows, applied]);
  const m = useMemo(() => reportMetrics(scoped, day), [scoped, day]);
  const lastPage = Math.max(1, Math.ceil(scoped.length / PAGE));
  const pageRows = scoped.slice((page - 1) * PAGE, page * PAGE);
  const clientName = id => clients.items.find(c => c.id === id)?.name;
  const subtitleOf = f => (f.client === 'all' ? `${DEFAULT_COMPANY} · ${tx('Todos los clientes', 'All clients')}` : clientName(f.client) || '—');
  const stageText = s => (s === 'all' ? tx('Todas', 'All') : s === PENDING_STAGE ? stageLabel(null, en) : stageLabel(Number(s), en));
  const scopeTextOf = f => `${tx('Periodo (fecha de solicitud)', 'Period (request date)')}: ${f.from || tx('inicio', 'start')} — ${f.to || tx('sin límite', 'no limit')} · ${tx('Etapa', 'Stage')}: ${stageText(f.stage)}`;
  const stamp = () => new Date().toLocaleString(en ? 'en-US' : 'es-MX');

  const generate = () => {
    if (invalidRange) return null;
    const f = { ...draft }; const at = stamp();
    setApplied(f); setIssued(at); setPage(1);
    return { f, at };
  };
  const print = () => {
    const g = applied && JSON.stringify(applied) === JSON.stringify(draft) ? { f: applied, at: issued } : generate();
    if (!g) return;
    if (!ready) { notify(tx('Imprimir / PDF', 'Print / PDF'), tx('Los datos aún se están cargando desde MariaDB.', 'Data is still loading from MariaDB.'), 'warning'); return; }
    const list = reportRows(rows, g.f);
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { notify(tx('Imprimir / PDF', 'Print / PDF'), tx('El navegador bloqueó la ventana de impresión; permite ventanas emergentes para este sitio.', 'The browser blocked the print window; allow pop-ups for this site.'), 'warning'); return; }
    w.document.write(reportPrintHtml(list, reportMetrics(list, day), { en, title: tx('Reporte Gerencial de Suministro', 'Supply Management Report'), subtitle: subtitleOf(g.f), issued: g.at, scopeText: scopeTextOf(g.f), day }));
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  };
  const exportCsv = () => {
    if (!applied) return;
    const url = URL.createObjectURL(new Blob([reportCsv(scoped, en, day)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `Reporte_gerencial_${day}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    notify(tx('Exportar CSV', 'Export CSV'), tx(`Se exportaron ${scoped.length} requisiciones del reporte (generado en tu navegador).`, `${scoped.length} report requisitions exported (generated in your browser).`));
  };

  const renderMoney = (map, pick, empty, negativeRed = false) => {
    const keys = Object.keys(map);
    if (!keys.length) return <><span className="block text-lg font-black text-slate-400">—</span><span className="block text-[10px] text-slate-400 font-medium leading-tight">{empty}</span></>;
    return moneyLines(map, en, pick).map((line, i) => <span key={line} className={`block font-black tabular-nums leading-tight ${i ? 'text-sm mt-0.5' : 'text-base'} ${negativeRed && line.startsWith('-') ? 'text-rose-600' : 'text-slate-900'}`}>{line}</span>);
  };

  return <div className="space-y-6">
    {/* CABECERA PRINCIPAL */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{tx('Generador de reporte gerencial', 'Management Report Generator')}</h2><p className="text-xs text-slate-500 mt-0.5">{tx('Filtra el periodo y genera una vista ejecutiva imprimible.', 'Filter the period and generate a printable executive view.')}</p></div>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span>
        <button type="button" onClick={() => setRevision(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar datos', 'Refresh data')}</button>
      </div>
    </div>

    <form onSubmit={e => { e.preventDefault(); generate(); }} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
      {/* FILTROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <label className="space-y-1.5 block"><span className="block text-[11px] font-bold text-slate-700">{tx('Desde', 'From')}</span><input type="date" aria-label={tx('Desde', 'From')} value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} className={inputCls} /></label>
        <label className="space-y-1.5 block"><span className="block text-[11px] font-bold text-slate-700">{tx('Hasta', 'To')}</span><input type="date" aria-label={tx('Hasta', 'To')} value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} className={inputCls} /></label>
        <label className="space-y-1.5 block"><span className="block text-[11px] font-bold text-slate-700">{tx('Cliente', 'Client')}</span><select aria-label={tx('Cliente', 'Client')} value={draft.client} onChange={e => setDraft(d => ({ ...d, client: e.target.value }))} className={`${inputCls} font-medium truncate`}><option value="all">{tx('Todos', 'All')}</option>{clients.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="space-y-1.5 block"><span className="block text-[11px] font-bold text-slate-700">{tx('Etapa', 'Stage')}</span><select aria-label={tx('Etapa', 'Stage')} value={draft.stage} onChange={e => setDraft(d => ({ ...d, stage: e.target.value }))} className={`${inputCls} font-medium`}>
          <option value="all">{tx('Todas', 'All')}</option>{P2P_STAGES.map((s, i) => <option key={s[0]} value={String(i)}>{en ? s[1] : s[0]}</option>)}<option value={PENDING_STAGE}>{stageLabel(null, en)}</option></select></label>
      </div>
      <p className="text-[10px] text-slate-400">{tx('El periodo se aplica a la fecha de solicitud; una requisición sin fecha queda fuera de periodos delimitados (misma regla que el Dashboard).', 'The period applies to the request date; undated requisitions are excluded from bounded periods (same rule as the Dashboard).')}</p>
      {invalidRange && <p role="alert" className="text-xs font-semibold text-rose-700">{tx('La fecha inicial es mayor que la final.', 'Start date exceeds end date.')}</p>}
      {clients.status === 'error' && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{clients.error?.message}</p>}
      {reqs.status === 'error' && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{reqs.error?.status === 401 ? tx('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.') : reqs.error?.message}</p>}
      {stages.status === 'error' && !stagesDenied && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{stages.error?.message}</p>}
      {stagesDenied && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{tx('Las etapas requieren acceso al módulo de Requisiciones; sin ellas, "Cerradas" y el filtro de etapa no pueden calcularse.', 'Stages require access to the Requisitions module; without them, "Closed" and the stage filter cannot be computed.')}</p>}
      {reqs.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx(`Consultando requisiciones en MariaDB… ${reqs.items.length}${reqs.total ? ` de ${reqs.total}` : ''}`, `Loading requisitions from MariaDB… ${reqs.items.length}${reqs.total ? ` of ${reqs.total}` : ''}`)}</p>}

      {/* BOTONES DE ACCIÓN */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={invalidRange} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition-colors shadow-sm shadow-blue-600/20 cursor-pointer"><Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />{tx('Generar reporte', 'Generate report')}</button>
        <button type="button" onClick={print} disabled={invalidRange} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"><Printer className="w-4 h-4 text-slate-600" />{tx('Imprimir / PDF', 'Print / PDF')}</button>
        <button type="button" onClick={exportCsv} disabled={!applied || !ready} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"><Download className="w-4 h-4 text-slate-600" />{tx('Exportar CSV', 'Export CSV')}</button>
        <button type="button" onClick={() => { setDraft(EMPTY); setApplied(null); }} className="px-3 py-2.5 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl">{tx('Limpiar filtros', 'Clear filters')}</button>
      </div>
    </form>

    {/* REPORTE EJECUTIVO GENERADO */}
    {applied && <div className="space-y-4" data-testid="management-report">
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0"><h2 className="text-xl font-extrabold tracking-tight">{tx('Reporte Gerencial de Suministro', 'Supply Management Report')}</h2>
          <p className="text-xs text-blue-100 mt-1 font-medium">{subtitleOf(applied)}</p><p className="text-[11px] text-blue-100/90 mt-0.5">{scopeTextOf(applied)}</p></div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl sm:text-right border border-white/20 shrink-0"><span className="block text-[10px] text-blue-100 font-medium">{tx('Fecha de emisión', 'Issue Date')}</span><span className="text-xs font-bold">{issued}</span></div>
      </div>
      {!ready && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Completando la consulta; las cifras se actualizan al terminar.', 'Completing the query; figures update when finished.')}</p>}

      {/* TARJETAS DE KPIS CON BORDE SUPERIOR DE COLOR */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[[m.total, tx('Requisiciones', 'Requisitions'), 'border-t-blue-600'], [m.closed, tx('Cerradas', 'Closed'), 'border-t-emerald-500', tx('Etapa Factura', 'Invoice stage')], [m.overdue, tx('Vencidas', 'Overdue'), 'border-t-rose-500', tx('Requerida antes de hoy y sin entrega', 'Required before today and not delivered')]].map(([v, label, cls, hint]) =>
          <div key={label} title={hint} className={`bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 ${cls} shadow-2xs`}><span className="block text-2xl font-black text-slate-900 tabular-nums">{v}</span><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span></div>)}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-purple-600 shadow-2xs" title={tx('Suma de presupuestos registrados por moneda; sin presupuesto no cuenta como cero.', 'Sum of recorded budgets per currency; missing budgets are not zero.')}>{renderMoney(m.budget, undefined, tx('Sin presupuestos registrados', 'No recorded budgets'))}<span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tx('Presupuesto', 'Budget')}</span></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-orange-500 shadow-2xs" title={tx('OC vigentes (última versión, sin canceladas ni sustituidas), contadas una sola vez.', 'Current POs (latest version, excluding cancelled/superseded), counted once.')}>{renderMoney(m.purchased, x => x.amount, tx('Sin OC vigentes', 'No current POs'))}<span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tx('Comprado', 'Purchased')}</span></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-teal-600 shadow-2xs" title={tx('Presupuesto − OC, solo en requisiciones con presupuesto y OC en la misma moneda. Positivo = ahorro; negativo = sobrecosto.', 'Budget − POs, only for requisitions with budget and POs in the same currency. Positive = saving; negative = overrun.')}>{renderMoney(m.deviation, x => x.deviation, tx('Sin base comparable', 'No comparable basis'), true)}<span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{tx('Ahorro / desviación', 'Savings / Variance')}</span></div>
      </div>

      {/* TARJETA RESUMEN EJECUTIVO */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1.5"><h3 className="text-xs font-black text-slate-900 tracking-tight">{tx('Resumen ejecutivo', 'Executive Summary')}</h3><p className="text-xs text-slate-600 leading-relaxed">{executiveSummary(m, en)}</p></div>

      {/* TABLA MATRIZ DETALLADA */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-black text-slate-900">{tx('Detalle de requisiciones', 'Requisition detail')} <span className="text-slate-400 font-semibold">· {scoped.length}</span></h3><span className="text-[10px] text-slate-400">{tx('La impresión y el CSV incluyen todas las filas.', 'Print and CSV include every row.')}</span></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left border-collapse">
            <thead><tr className="bg-slate-50/90 text-[10px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              {[tx('Requisición', 'Requisition'), tx('Cliente', 'Client'), tx('Proyecto', 'Project'), tx('Monto est.', 'Est. amount'), tx('OC', 'PO'), tx('Recepción', 'Reception'), tx('Etapa', 'Stage'), tx('Fecha requerida', 'Required date')].map(h => <th key={h} className="py-3 px-3.5 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-700">
              {pageRows.map(r => { const pos = r.references?.purchase_order_totals || []; const overdue = riskOf(r, day) === 'overdue'; return <tr key={r.id} className="hover:bg-slate-50/70 transition-colors align-top">
                <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">{r.folio}</td>
                <td className="py-3 px-3.5 font-bold text-slate-800 uppercase text-[10px] min-w-[180px]">{r.client_name}</td>
                <td className="py-3 px-3.5 text-slate-600">{r.project || '—'}</td>
                <td className="py-3 px-3.5 font-bold text-slate-800 whitespace-nowrap">{money(r.budget_amount, r.currency_code, en)}</td>
                <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">{poCell(r, en)}{pos.length > 0 && <div className="text-[9.5px] text-slate-400">{pos.map(p => p.folio).join(' · ')}</div>}</td>
                <td className="py-3 px-3.5 text-slate-500 whitespace-pre">{(r.references?.receipts || []).join('\n') || '—'}</td>
                <td className="py-3 px-3.5 text-slate-700 font-semibold whitespace-nowrap">{stageLabel(r.stage_index, en)}</td>
                <td className={`py-3 px-3.5 whitespace-nowrap ${overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}`} title={overdue ? tx('Vencida', 'Overdue') : undefined}>{r.need_date ? String(r.need_date).slice(0, 10) : '—'}</td>
              </tr>; })}
              {!pageRows.length && <tr><td colSpan={8} className="py-8 text-center text-slate-400 text-xs font-semibold">{ready ? tx('No hay requisiciones para los filtros seleccionados.', 'No requisitions for the selected filters.') : tx('Consultando requisiciones…', 'Loading requisitions…')}</td></tr>}
            </tbody>
          </table>
        </div>
        {scoped.length > PAGE && <div className="flex items-center justify-between gap-3 text-xs text-slate-600"><span>{tx('Página', 'Page')} {page} / {lastPage}</span><div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => Math.max(1, n - 1))} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= lastPage} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>}
      </div>

      {/* TARJETA CONCLUSIONES */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2" data-testid="report-conclusions">
        <h3 className="text-xs font-black text-slate-900 tracking-tight">{tx('Conclusiones', 'Conclusions')}</h3>
        <ul className="space-y-1.5">{conclusions(m, en).map(c => { const [Icon, color] = TONE[c.tone]; return <li key={c.text} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed"><Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} /><span>{c.text}</span></li>; })}</ul>
        <p className="text-[10px] text-slate-400 pt-1">{tx('Conclusiones generadas con reglas sobre las cifras de este reporte; no sustituyen el análisis del área de Compras.', 'Conclusions generated by rules over this report\'s figures; they do not replace the Purchasing team\'s analysis.')}</p>
      </div>
      <div className="text-[11px] text-amber-900 bg-amber-50 rounded-xl border border-amber-200 p-3 flex items-start gap-2"><LockKeyhole size={15} className="shrink-0" /><span>{tx('Solo consulta. Montos por moneda sin conversión; "Comprado" no equivale a pagado. Las OC compartidas con requisiciones fuera del filtro se cuentan completas. Los documentos en conciliación no se presentan como vínculos validados.', 'Read-only. Amounts per currency without conversion; "Purchased" is not "paid". POs shared with requisitions outside the filter are counted in full. Documents under reconciliation are not shown as validated links.')}</span></div>
    </div>}
  </div>;
}
