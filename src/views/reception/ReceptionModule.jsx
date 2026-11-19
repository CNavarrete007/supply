import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Search, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, Printer, X } from 'lucide-react';
import { receptionMatrix, receptionOrders, receptionOrder, receiptDetail, deliveryDetail, receptionClosure } from './api';
import { label, tone, isAccepted, reasonLabel, pct, qty, shortHash, bytes, closureCards, deliveryHtml } from './model.mjs';
import { RECEPTION_TYPES, QUALITY, DOCUMENTATION, PHOTO_MAX, emptyReception, withType, orderOptions, validateReception, receptionLockedText, outstanding } from './receptionForm.mjs';
import { compressPhotos, openPhoto } from './photos.js';
import { DeliveryFormat } from './DeliveryFormat.jsx';
import { useLoad } from './useLoad.js';

// Recepción y Entrega · diseño Grupo Gerez (4 tarjetas) conectado a MariaDB en modo consulta.
// GET /api/v1/reception/* (Master Admin). Registrar recepciones, entregas, firmas o fotografías sigue bloqueado.
const DASH = '—';
const show = v => (v === null || v === undefined || String(v).trim() === '' ? DASH : String(v));
const ymd = v => (v ? String(v).slice(0, 10) : DASH);

export function ReceptionModule({ lang = 'es', isEnglish, onNotify }) {
  const en = Boolean(isEnglish || lang === 'en');
  const tx = (es, e) => (en ? e : es);
  const notify = (t, m, k = 'info') => { if (typeof onNotify === 'function') onNotify(t, m, k); };
  const LOCK = tx('Modo consulta MariaDB: registrar recepciones, entregas, firmas y fotografías son escrituras operativas bloqueadas hasta su validación integral.', 'MariaDB read mode: recording receipts, deliveries, signatures and photos are operational writes blocked until fully validated.');
  const tabs = [
    [1, '📦', tx('Registro de recepción', 'Reception Registration'), tx('Documenta cantidades recibidas, calidad, documentos y fotografías.', 'Document received quantities, quality, documents and photos.')],
    [2, '🚚', tx('Entrega al cliente', 'Client Delivery'), tx('Registra fecha, responsables, aceptación, evidencia y fotografías.', 'Log date, managers, acceptance, evidence and photos.')],
    [3, '📋', tx('Matriz de recepción y entrega', 'Reception & Delivery Matrix'), tx('Consulta ambas etapas del proceso.', 'Review both process stages.')],
    [4, '🚦', tx('Semáforo de cierre', 'Closing Traffic Light'), tx('Identifica OC pendientes, entregas faltantes, desviaciones y cierres.', 'Identify pending POs, missing deliveries, deviations and closures.')],
  ];
  const [tab, setTab] = useState(3);
  const [rev, setRev] = useState(0);
  const [input, setInput] = useState(''); const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [client, setClient] = useState(null); // null = matrix closed (design: opens on a client card)
  const [kind, setKind] = useState('all');
  const [poId, setPoId] = useState(''); const [recId, setRecId] = useState('');
  const [format, setFormat] = useState('');
  const [closureKey, setClosureKey] = useState('po_without_receipt');
  useEffect(() => { const t = setTimeout(() => { const n = input.trim(); if (n !== q) { setQ(n); setPage(1); } }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = id => { setTab(id); setPage(1); setInput(''); setQ(''); setKind('all'); };

  const matrix = useLoad(s => receptionMatrix({ page, q, kind, client: client || 'all' }, s), [page, q, kind, client, rev], tab === 3);
  const orders = useLoad(s => receptionOrders({ status: 'all' }, s), [rev], tab === 1);
  const order = useLoad(s => receptionOrder(poId, s), [poId, rev], tab === 1 && !!poId);
  const receipt = useLoad(s => receiptDetail(recId, s), [recId, rev], tab === 1 && !!recId);
  const fmt = useLoad(s => deliveryDetail(format, s), [format, rev], !!format);
  const closure = useLoad(s => receptionClosure(s), [rev], tab === 4);

  const Err = ({ s }) => (s?.error ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{s.error.message}</p> : null);
  const Wait = ({ s }) => (s?.status === 'loading' ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p> : null);
  const pill = (code, txt) => <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${tone(code)}`}>{txt || label(code, en)}</span>;
  const lockBtn = t => <button type="button" disabled title={LOCK} className="px-3 py-1.5 bg-slate-200 text-slate-500 text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{t}</button>;
  const box = 'bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-5';
  const head = (title, sub, right) => <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><h3 className="text-base font-bold text-slate-900">{title}</h3><p className="text-xs text-slate-400">{sub}</p></div>{right}</div>;
  const field = (k, v) => <div key={k} className="p-3 rounded-xl border border-slate-200 bg-slate-50/40"><div className="text-[10px] font-bold text-slate-400 uppercase">{k}</div><div className="text-xs font-semibold text-slate-800 break-words">{v}</div></div>;
  const table = (headers, rows, empty, min = 'min-w-[900px]') => <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white"><table className={`w-full text-left border-collapse text-[10px] ${min}`}><thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">{headers.map(h => <th key={h} className="p-2.5 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{rows}{!rows.length && <tr><td colSpan={headers.length} className="p-8 text-center text-slate-400">{empty}</td></tr>}</tbody></table></div>;
  const searchBox = ph => <div className="relative flex-1 min-w-[240px]"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label={tx('Buscar', 'Search')} value={input} onChange={e => setInput(e.target.value)} maxLength={120} placeholder={ph} className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>;
  const pager = st => { const last = Math.max(1, Math.ceil((st.data?.total || 0) / (st.data?.page_size || 25))); return <div className="flex justify-between items-center text-xs text-slate-600"><span>{st.data?.total ?? 0} {tx('registros', 'records')} · {tx('Página', 'Page')} {page} / {last}</span><div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={page <= 1} onClick={() => setPage(n => n - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={page >= last} onClick={() => setPage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>; };
  const evidence = d => <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div className="p-3 rounded-xl border border-slate-200 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase">{tx('Fotografías y documentos', 'Photos and documents')}</div>{d.files.map((f, i) => <div key={i} className="text-[11px] flex flex-wrap justify-between gap-2"><span className="font-semibold">{f.name || DASH}</span><span className="text-slate-500">{label(f.role, en)} · {bytes(f.size_bytes)} · {f.scan_status}</span></div>)}{!d.files.length && <p className="text-[11px] text-slate-400">{tx('Sin archivos vinculados.', 'No linked files.')}</p>}<p className="text-[10px] text-slate-400">{tx('Los archivos privados no se descargan desde esta vista.', 'Private files are not downloadable from this view.')}</p></div>
    <div className="p-3 rounded-xl border border-slate-200 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase">{tx('Firmas / integridad', 'Signatures / integrity')}</div>{d.signatures.map((s, i) => <div key={i} className="text-[11px]"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">🔒 {show(s.signer)} · {label(s.role, en)}</span>{pill(s.integrity, label(s.integrity, en))}</div><div className="text-[10px] text-slate-500">{s.method} · {String(s.signed_at || '').slice(0, 16)}{s.document_sha256 && <span className="font-mono"> · {shortHash(s.document_sha256)}</span>}</div></div>)}{!d.signatures.length && <p className="text-[11px] text-slate-400">{tx('Sin firmas registradas.', 'No signatures recorded.')}</p>}</div>
  </div>;
  const receiptView = d => <div data-testid="receipt-detail" className="space-y-3 border-t border-slate-100 pt-4">
    <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-black text-slate-900">{d.item.folio}</h4>{pill(d.item.status)}{pill(d.item.capture_grain)}</div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[
      [tx('Orden de compra', 'Purchase order'), `${d.item.po_folio}${d.item.po_version > 1 ? ` · Rev. ${d.item.po_version - 1}` : ''} · ${d.item.supplier_name}`],
      [tx('Fecha de recepción', 'Receipt date'), ymd(d.item.date)], [tx('Tipo de recepción', 'Receipt type'), d.item.legacy_type || (d.item.received_percent >= 100 ? tx('Total', 'Total') : tx('Parcial', 'Partial'))],
      [tx('Cantidad / recibido', 'Quantity / received'), pct(d.item.received_percent)], [tx('Inspección de calidad', 'Quality inspection'), show(d.item.quality_result)],
      [tx('Documentación recibida', 'Documentation received'), show(d.item.documentation_result)], [tx('Aceptación del cliente', 'Client acceptance'), d.item.acceptance ? `${label(d.item.acceptance, en)} (${d.item.acceptance_source === 'delivery' ? tx('entrega', 'delivery') : tx('histórico', 'historical')})` : tx('Sin entrega registrada', 'No delivery recorded')],
      [tx('Observaciones', 'Notes'), show(d.item.notes)]].map(([k, v]) => field(k, v))}</div>
    {d.item.pending_reasons.length > 0 && <div className="flex flex-wrap gap-1.5">{d.item.pending_reasons.map(r => <span key={r}>{pill('pending', reasonLabel(r, en))}</span>)}</div>}
    {d.items.length > 0 && table(['#', tx('Descripción', 'Description'), tx('Ordenado', 'Ordered'), tx('Recibido', 'Received'), tx('Aceptado', 'Accepted'), tx('Rechazado', 'Rejected'), tx('Nota de calidad', 'Quality note')], d.items.map(i => <tr key={i.line_number}><td className="p-2.5">{i.line_number}</td><td className="p-2.5 font-semibold">{i.description}</td><td className="p-2.5">{qty(i.ordered)} {i.unit_label}</td><td className="p-2.5">{qty(i.received)}</td><td className="p-2.5">{qty(i.accepted)}</td><td className={`p-2.5 ${i.rejected > 0 ? 'text-rose-600 font-bold' : ''}`}>{qty(i.rejected)}</td><td className="p-2.5">{show(i.quality_note)}</td></tr>), '', 'min-w-[640px]')}
    {d.item.capture_grain === 'legacy_header_only' && <p className="text-[11px] text-slate-400">{tx('Recepción histórica importada a nivel encabezado: no tiene partidas capturadas.', 'Historical receipt imported at header level: no captured line items.')}</p>}
    {evidence(d)}
  </div>;
  // ---------- Tarjeta 1: registro de recepción (se valida; guardar y subir fotografías requieren endpoint autorizado) ----------
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const [rf, setRf] = useState(() => emptyReception(today));
  const [rTried, setRTried] = useState(false); const [rMsg, setRMsg] = useState(null); const [photoMsg, setPhotoMsg] = useState('');
  const photoRef = useRef(null);
  const rv = useMemo(() => validateReception({ ...rf, po: poId }, { order: order.status === 'ready' ? order.data : null, today }, en), [rf, poId, order, today, en]);
  const setR = (k, v) => { setRf(f => ({ ...f, [k]: v })); setRMsg(null); };
  const resetReception = keepPo => { setRf(emptyReception(today)); setRTried(false); setRMsg(null); setPhotoMsg(''); if (photoRef.current) photoRef.current.value = ''; if (!keepPo) { setPoId(''); setRecId(''); } };
  const addPhotos = async files => {
    const { photos, errors } = await compressPhotos(files, rf.photos.length, en);
    setRf(f => ({ ...f, photos: [...f.photos, ...photos].slice(0, PHOTO_MAX) })); setRMsg(null); setPhotoMsg(errors.join(' '));
    if (photoRef.current) photoRef.current.value = '';
  };
  const viewPhoto = openPhoto;
  const saveReception = () => {
    setRTried(true);
    if (!rv.ok) { setRMsg({ kind: 'error', text: rv.first }); return; }
    const text = receptionLockedText(order.data, rf, en);
    setRMsg({ kind: 'locked', text }); notify(tx('Recepción no registrada', 'Receipt not recorded'), text, 'warning');
  };
  const printFormat = () => { if (!fmt.data) return; const w = window.open('', '_blank', 'width=900,height=1000'); if (!w) { notify(tx('Imprimir', 'Print'), tx('El navegador bloqueó la ventana; permite ventanas emergentes.', 'The browser blocked the window; allow pop-ups.'), 'warning'); return; } w.document.write(deliveryHtml(fmt.data, en)); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 250); };
  const cards = matrix.data?.summary?.clients || [];
  const allCard = { id: 'all', name: tx('Todos los clientes', 'All customers'), receipts: cards.reduce((n, c) => n + c.receipts, 0), deliveries: cards.reduce((n, c) => n + c.deliveries, 0) };
  const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return <div className="space-y-6 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-900">{tx('Recepción y Entrega', 'Reception and Delivery')}</h2><p className="text-xs text-slate-500">{tx('Control de entradas, salidas y confirmación de entregas de mercancía con datos de MariaDB.', 'Control of inputs, outputs and delivery confirmation from MariaDB.')}</p></div>
      <div className="flex items-center gap-2"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span><button type="button" onClick={() => setRev(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {tabs.map(([id, icon, title, desc]) => { const on = tab === id; return <button key={id} type="button" aria-pressed={on} onClick={() => go(id)} className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${on ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-transparent shadow-md' : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-800 shadow-2xs'}`}>
        <div><div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 ${on ? 'bg-white/20 text-white' : 'bg-blue-50/80 text-blue-600 border border-blue-100'}`}>{icon}</div><h3 className={`text-xs font-bold ${on ? 'text-white' : 'text-slate-900'}`}>{title}</h3><p className={`text-[10px] mt-1 leading-relaxed ${on ? 'text-purple-100' : 'text-slate-400'}`}>{desc}</p></div>
      </button>; })}
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>

    {tab === 1 && <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 text-left space-y-5" data-testid="reception-form">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="min-w-0 flex-1"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Registro de recepción', 'Reception registration')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Documenta la recepción física del suministro, cantidad, calidad, documentos y evidencia fotográfica.', 'Document the physical receipt of the supply, quantity, quality, documents and photo evidence.')}</p></div>
        <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-100/80 border border-emerald-200 rounded-full px-3 py-1 shrink-0">{tx('Paso 6 · Recepción', 'Step 6 · Receipt')}</span>
      </div>
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs font-black text-emerald-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-inner shrink-0" />{tx('Modo nueva captura activo. Completa la información y presiona Guardar. Al terminar, el formulario se limpiará y bloqueará.', 'New capture mode active. Fill in the information and press Save. When finished, the form will be cleared and locked.')}</div>
      <Wait s={orders} /><Err s={orders} />
      {(() => { const lbl = (t, req, k, child, cls = '') => <label className={`block ${cls}`}><span className="block text-[11px] font-black text-slate-900 mb-1.5">{t}{req ? ' *' : ''}</span>{child}{rTried && rv.errors[k] && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{rv.errors[k]}</span>}</label>;
        const ctl = k => `w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${rTried && rv.errors[k] ? 'border-rose-400' : 'border-slate-300'}`;
        return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {lbl(tx('Orden de compra', 'Purchase order'), true, 'po', <select aria-label={tx('Orden de compra', 'Purchase order')} value={poId ? (order.data?.item?.id ?? poId) : ''} onChange={e => { setPoId(e.target.value); setRecId(''); setRMsg(null); }} className={ctl('po')}><option value="">{tx('Seleccionar...', 'Select...')}</option>{orderOptions(orders.data?.items || [], en).map(o => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}</select>, 'md:col-span-2')}
          {lbl(tx('Folio de recepción', 'Receipt folio'), false, 'folio', <input type="text" readOnly aria-label={tx('Folio de recepción', 'Receipt folio')} value={tx('Automático', 'Automatic')} className="w-full px-3.5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-default" />)}
          {lbl(tx('Fecha de recepción', 'Receipt date'), true, 'date', <input type="date" aria-label={tx('Fecha de recepción', 'Receipt date')} value={rf.date} max={today} onChange={e => setR('date', e.target.value)} className={ctl('date')} />)}
          {lbl(tx('Tipo de recepción', 'Receipt type'), false, 'type', <select aria-label={tx('Tipo de recepción', 'Receipt type')} value={rf.type} onChange={e => { setRf(f => withType(f, e.target.value)); setRMsg(null); }} className={ctl('type')}>{RECEPTION_TYPES.map(([v, es, e2]) => <option key={v} value={v}>{en ? e2 : es}</option>)}</select>)}
          {lbl(tx('Cantidad / % recibido', 'Quantity / % received'), false, 'qty', <input type="text" inputMode="decimal" aria-label={tx('Cantidad / % recibido', 'Quantity / % received')} value={rf.qty} onChange={e => setR('qty', e.target.value)} className={ctl('qty')} />)}
          {lbl(tx('Inspección de calidad', 'Quality inspection'), false, 'quality', <select aria-label={tx('Inspección de calidad', 'Quality inspection')} value={rf.quality} onChange={e => setR('quality', e.target.value)} className={ctl('quality')}>{QUALITY.map(([v, es, e2]) => <option key={v} value={v}>{en ? e2 : es}</option>)}</select>)}
          {lbl(tx('Documentación recibida', 'Documentation received'), false, 'docs', <select aria-label={tx('Documentación recibida', 'Documentation received')} value={rf.docs} onChange={e => setR('docs', e.target.value)} className={ctl('docs')}>{DOCUMENTATION.map(([v, es, e2]) => <option key={v} value={v}>{en ? e2 : es}</option>)}</select>)}
          {lbl(tx('Evidencia / remisión / factura', 'Evidence / delivery note / invoice'), false, 'evidence', <input type="text" aria-label={tx('Evidencia / remisión / factura', 'Evidence / delivery note / invoice')} value={rf.evidence} maxLength={255} placeholder={tx('Número de remisión, factura, packing list, certificado...', 'Delivery note, invoice, packing list, certificate number...')} onChange={e => setR('evidence', e.target.value)} className={ctl('evidence')} />, 'md:col-span-2')}
          {lbl(tx('Observaciones / no conformidad', 'Notes / non-compliance'), rf.quality !== 'conforme', 'notes', <textarea rows={3} aria-label={tx('Observaciones / no conformidad', 'Notes / non-compliance')} value={rf.notes} maxLength={2100} onChange={e => setR('notes', e.target.value)} className={ctl('notes')} />, 'md:col-span-2')}
        </div>; })()}

      <div data-testid="reception-photos" className="p-4 sm:p-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 space-y-3">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-2 pb-3 border-b border-slate-200/70"><div><h4 className="text-sm font-black text-slate-900">{tx('Fotografías de recepción', 'Receipt photos')}</h4><p className="text-[11px] text-slate-500 mt-0.5">{tx('Agrega imágenes de descarga, inspección, cantidades, daños, etiquetas o documentos recibidos.', 'Add images of unloading, inspection, quantities, damage, labels or documents received.')}</p></div><span data-testid="reception-photo-count" className="text-[10.5px] font-black text-blue-900 bg-blue-100/80 border border-blue-200 rounded-full px-3 py-1 shrink-0">{rf.photos.length} {rf.photos.length === 1 ? tx('fotografía', 'photo') : tx('fotografías', 'photos')}</span></div>
        <input ref={photoRef} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label={tx('Fotografías de recepción', 'Receipt photos')} onChange={e => addPhotos(e.target.files)} className="block w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-2 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:text-slate-700 file:font-semibold" />
        <p className="text-[10px] text-slate-500">{tx(`Máximo recomendado: ${PHOTO_MAX} fotografías. Las imágenes se comprimen automáticamente (lado mayor ≤ 1600 px, JPG) y no se suben mientras el registro esté bloqueado.`, `Recommended maximum: ${PHOTO_MAX} photos. Images are compressed automatically (longest edge ≤ 1600 px, JPG) and are not uploaded while recording is blocked.`)}</p>
        {photoMsg && <p role="alert" data-testid="reception-photo-msg" className="text-[11px] text-rose-700 font-semibold">{photoMsg}</p>}
        {rTried && rv.errors.photos && <p role="alert" className="text-[11px] text-rose-700 font-semibold">{rv.errors.photos}</p>}
        {rf.photos.length ? <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">{rf.photos.map(p => <figure key={p.id} data-testid="reception-photo" className="bg-white rounded-xl border border-slate-200 p-1.5 space-y-1">
            <button type="button" onClick={() => viewPhoto(p)} aria-label={`${tx('Ver fotografía', 'View photo')} ${p.name}`} className="block w-full"><img src={p.data} alt={p.name} className="w-full h-20 object-cover rounded-lg" /></button>
            <figcaption className="text-[9.5px] text-slate-600 truncate" title={p.name}>{p.name}</figcaption><div className="text-[9px] text-slate-400">{p.w}×{p.h} · {bytes(p.size)}</div>
            <span className="text-[10px] font-black block"><button type="button" onClick={() => setR('photos', rf.photos.filter(x => x.id !== p.id))} className="w-full px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md">{tx('Quitar', 'Remove')}</button></span>
          </figure>)}</div>
          : <div className="p-8 border border-dashed border-slate-300 rounded-2xl bg-white/60 text-center text-sm text-slate-500">{tx('No se han agregado fotografías.', 'No photos have been added.')}</div>}
      </div>

      <Wait s={order} /><Err s={order} />
      {!poId ? <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-xl p-3.5 text-xs text-slate-700">{tx('Selecciona una orden para visualizar su contexto.', 'Select an order to view its context.')}</div>
        : order.data && <div data-testid="order-reception" className="space-y-3">
          <div className={`border-l-4 rounded-xl p-3.5 text-xs ${order.data.item.reception === 'complete' ? 'bg-emerald-50/70 border-emerald-500 text-emerald-900' : 'bg-blue-50/70 border-blue-600 text-slate-700'}`}><strong>{order.data.item.folio}{order.data.item.version_number > 1 ? ` · Rev. ${order.data.item.version_number - 1}` : ''}</strong> · {order.data.item.supplier_name} · {show(order.data.item.requisitions)} · {show(order.data.item.client_name)} · {tx('Compromiso', 'Commitment')}: {ymd(order.data.item.commitment_date)} · {tx('Recibido', 'Received')}: <strong>{pct(order.data.item.received_percent)}</strong> ({label(order.data.item.reception, en)})</div>
          {table(['#', tx('Descripción', 'Description'), tx('Ordenado', 'Ordered'), tx('Recibido (serie)', 'Received (series)'), tx('Rechazado', 'Rejected'), tx('Pendiente', 'Outstanding')], order.data.items.map(i => <tr key={i.line_number}><td className="p-2.5">{i.line_number}</td><td className="p-2.5 font-semibold">{i.description}</td><td className="p-2.5">{qty(i.quantity)} {i.unit_label}</td><td className="p-2.5">{qty(i.received)}</td><td className="p-2.5">{qty(i.rejected)}</td><td className="p-2.5 font-bold">{qty(outstanding(i))}</td></tr>), tx('La OC no tiene partidas registradas.', 'The PO has no recorded line items.'), 'min-w-[640px]')}
          <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="font-bold text-slate-600">{tx('Recepciones registradas', 'Recorded receipts')}:</span>{order.data.receipts.map(r => <button key={r.id} type="button" aria-pressed={recId === r.id} onClick={() => setRecId(recId === r.id ? '' : r.id)} className={`px-3 py-2 rounded-xl border text-left ${recId === r.id ? 'border-purple-500 bg-purple-50/50' : 'border-slate-200 hover:border-purple-300 bg-white'}`}><span className="block font-black">{r.folio}</span><span className="block text-slate-500">{ymd(r.date)} · {pct(r.received_percent)}</span></button>)}{!order.data.receipts.length && <span className="text-slate-500">{tx('ninguna todavía.', 'none yet.')}</span>}</div>
          <Wait s={receipt} /><Err s={receipt} />
          {receipt.data && receiptView(receipt.data)}
        </div>}

      {rTried && rv.ok && rv.warnings.map(w => <p key={w} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">⚠ {w}</p>)}
      {rMsg && <p role={rMsg.kind === 'error' ? 'alert' : 'status'} data-testid="reception-save-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${rMsg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{rMsg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{rMsg.text}</span></p>}
      <div className="flex flex-wrap gap-3 pt-1 text-sm font-black">
        <button type="button" onClick={() => resetReception(false)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2">+ {tx('Nueva recepción', 'New receipt')}</button>
        <button type="button" onClick={saveReception} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">📦</span>{tx('Guardar recepción', 'Save receipt')}</button>
        <button type="button" onClick={() => resetReception(true)} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm flex items-center gap-2"><span aria-hidden="true">🧹</span>{tx('Limpiar', 'Clear')}</button>
        <button type="button" onClick={() => go(2)} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">🚚</span>{tx('Ir a entrega', 'Go to delivery')}</button>
        <button type="button" onClick={() => go(3)} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Ver matriz', 'View matrix')}</button>
      </div>
    </div>}

    {tab === 2 && <DeliveryFormat en={en} today={today} rev={rev} notify={notify} onMatrix={() => go(3)} onViewFormat={setFormat} />}

    {tab === 3 && <div className={box}>
      {head(tx('Matriz de recepción y entrega', 'Reception and delivery matrix'), tx('Registros de recepción de materiales y entregas a clientes con sus acuses y firmas.', 'Material receipts and client deliveries with acknowledgments and signatures.'), <div className="flex gap-2">{lockBtn(tx('Nueva recepción', 'New receipt'))}{lockBtn(tx('Nueva entrega', 'New delivery'))}</div>)}
      <div><h3 className="text-sm font-bold text-slate-900">{tx('Recepciones y entregas por cliente', 'Receipts and deliveries by customer')}</h3><p className="text-[11px] text-slate-500">{tx('Selecciona un cliente para consultar únicamente sus registros.', 'Select a client to view only their records.')}</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{[allCard, ...cards].map(c => { const on = (client || null) === c.id; return <button key={c.id} type="button" aria-pressed={on} onClick={() => { setClient(c.id); setPage(1); }} className={`text-left bg-white rounded-2xl p-3 border transition-all relative overflow-hidden flex flex-col justify-between ${on ? 'border-purple-600 ring-2 ring-purple-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300 shadow-xs'}`}>
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-600 via-indigo-600 to-emerald-500 rounded-l-2xl" />
        <div className="pl-1.5"><div className="flex items-center gap-2.5 mb-2"><div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">{c.id === 'all' ? 'ALL' : initials(c.name)}</div><div className="min-w-0"><h4 className="text-[11px] font-bold text-slate-900 leading-tight truncate">{c.name}</h4><p className="text-[10px] text-slate-500">{c.id === 'all' ? tx('Cartera completa', 'Full portfolio') : tx('Cliente', 'Client')}</p></div></div>
          <div className="grid grid-cols-3 gap-1 my-2.5">{[[c.receipts + c.deliveries, tx('Registros', 'Records')], [c.receipts, tx('Recepción', 'Reception')], [c.deliveries, tx('Entregas', 'Deliveries')]].map(([n, l]) => <div key={l} className="bg-slate-50 border border-slate-100 rounded-xl p-1.5 text-center"><span className="text-xs font-bold text-slate-900 block">{n}</span><span className="text-[9px] text-slate-500 font-medium">{l}</span></div>)}</div></div>
        <div className="pl-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500 font-medium"><span>{c.id === 'all' ? tx('Vista general', 'Overview') : tx('Expediente', 'Records')}</span><span className="font-bold text-purple-700">{tx('Abrir →', 'Open →')}</span></div>
      </button>; })}</div>
      <Wait s={matrix} /><Err s={matrix} />
      {client && <>
        <div className="bg-purple-500/5 border border-purple-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><h3 className="text-xs font-bold text-slate-900">{client === 'all' ? tx('Todos los clientes', 'All customers') : `${tx('Cliente', 'Client')}: ${cards.find(c => c.id === client)?.name || ''}`}</h3><button type="button" aria-label={tx('Cerrar matriz', 'Close matrix')} onClick={() => setClient(null)} className="p-1.5 rounded-lg hover:bg-purple-100 text-slate-500"><X className="w-4 h-4" /></button></div>
        <div className="flex flex-wrap gap-3">{searchBox(tx('Buscar folio, OC, recepción, requisición, proveedor o cliente...', 'Search folio, PO, receipt, requisition, supplier or client...'))}<select aria-label={tx('Tipo', 'Type')} value={kind} onChange={e => { setKind(e.target.value); setPage(1); }} className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"><option value="all">{tx('Recepciones y entregas', 'Receipts and deliveries')}</option><option value="receipt">{tx('Solo recepciones', 'Receipts only')} ({matrix.data?.summary?.receipts ?? '…'})</option><option value="delivery">{tx('Solo entregas', 'Deliveries only')} ({matrix.data?.summary?.deliveries ?? '…'})</option></select></div>
        {table([tx('Tipo', 'Type'), 'Folio', 'OC', tx('Requisición / solicitudes', 'Requisition / requests'), tx('Cliente', 'Client'), tx('Cantidad / avance', 'Quantity / progress'), tx('Calidad / estado', 'Quality / condition'), tx('Documentos / evidencia', 'Documents / evidence'), tx('Fotos', 'Photos'), tx('Aceptación', 'Acceptance'), tx('Firma / integridad', 'Signature / integrity'), tx('Acciones', 'Actions')], (matrix.data?.items || []).map(r => { const del = r.kind === 'delivery'; return <tr key={`${r.kind}-${r.id}`} className="hover:bg-slate-50">
          <td className="p-2.5 whitespace-nowrap">{del ? <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-2 py-0.5 rounded-full">🚚 {tx('ENTREGA', 'DELIVERY')}</span> : <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">📦 {tx('RECEPCIÓN', 'RECEIVING')}</span>}</td>
          <td className="p-2.5 whitespace-nowrap"><div className="font-bold text-slate-900">{r.folio}</div><div className="text-[9px] text-slate-400">{del ? `${label(r.delivery_type, en)} · ${ymd(r.date)}` : ymd(r.date)}</div></td>
          <td className="p-2.5 whitespace-nowrap text-slate-600 font-medium leading-tight">{(del ? show(r.po_folios) : `${r.po_folio}${r.po_version > 1 ? ` Rev. ${r.po_version - 1}` : ''}`).split(', ').map(x => <div key={x}>{x}</div>)}</td>
          <td className="p-2.5"><div className="font-bold text-slate-900">{show(r.requisitions)}</div>{!del && <div className="text-[9px] text-slate-400">{r.supplier_name}</div>}</td>
          <td className="p-2.5 font-semibold text-slate-700">{show(r.client_name)}</td>
          <td className="p-2.5 whitespace-nowrap"><div className="font-bold text-slate-900">{del ? `${qty(r.delivered_qty)} ${tx('entregado', 'delivered')}` : `${pct(r.received_percent)} ${tx('recibido', 'received')}`}</div><div className="text-[9px] text-slate-400">{del ? `${r.item_count} ${tx('partida(s)', 'item(s)')}` : `${r.delivery_count} ${tx('formato(s) de entrega', 'delivery form(s)')}`}</div></td>
          <td className="p-2.5">{del ? pill(r.status) : r.quality_result ? pill(r.quality_result, r.quality_result) : <span className="text-slate-400">{DASH}</span>}</td>
          <td className="p-2.5"><div className="font-semibold text-slate-800">{del ? (r.evidence_text ? tx('Acuse', 'Acknowledgment') : DASH) : show(r.documentation_result)}</div><div className="text-[9px] text-slate-400 max-w-[150px] truncate" title={del ? r.evidence_text || '' : r.notes || ''}>{del ? show(r.evidence_text) : show(r.notes)}</div></td>
          <td className="p-2.5 whitespace-nowrap"><span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded-full">{r.file_count} {tx('archivo(s)', 'file(s)')}</span></td>
          <td className="p-2.5">{del ? pill(r.acceptance_status) : r.acceptance ? pill(r.acceptance, isAccepted(r.acceptance) ? tx('Aceptado', 'Accepted') : label(r.acceptance, en)) : <span className="text-[9px] text-slate-400">{tx('Sin entrega', 'No delivery')}</span>}</td>
          <td className="p-2.5 whitespace-nowrap"><div className="flex flex-col gap-0.5">{del ? (r.locked ? pill('signed', `🔒 ${tx('Firmada y bloqueada', 'Signed and locked')}`) : pill('pending', tx('Sin bloqueo', 'Unlocked'))) : (r.signature_count ? pill('signed', `🔒 ${r.signature_count} ${tx('firma(s)', 'signature(s)')}`) : <span className="text-[9px] text-slate-400">{tx('Sin firmas', 'No signatures')}</span>)}{del && r.document_sha256 && <span className="text-[8px] font-mono text-slate-400">{shortHash(r.document_sha256)}</span>}</div></td>
          <td className="p-2.5 whitespace-nowrap text-center">{del ? <button type="button" onClick={() => setFormat(r.id)} className="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white text-[9px] font-bold rounded-lg">{tx('VER FORMATO', 'VIEW FORMAT')}</button> : <button type="button" onClick={() => { setTab(1); setPoId(r.po_id); setRecId(r.id); }} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded-lg">{tx('RECEPCIÓN', 'RECEPTION')}</button>}</td>
        </tr>; }), tx('Sin datos registrados para este cliente.', 'No data recorded for this client.'), 'min-w-[1200px]')}
        {pager(matrix)}
      </>}
    </div>}

    {tab === 4 && <div className={box}>{head(tx('Semáforo de cierre', 'Closing traffic light'), tx('Condiciones necesarias para cerrar una requisición y completar el ciclo de suministro.', 'Conditions necessary to close a requisition and complete the supply cycle.'), <button type="button" onClick={() => { go(3); setClient('all'); }} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl shadow-2xs flex items-center gap-1.5"><span>📋</span>{tx('Ver recepción y entrega', 'View reception and delivery')}</button>)}
      <Wait s={closure} /><Err s={closure} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">{closureCards(closure.data?.counters, en).map(c => <button key={c.key} type="button" aria-pressed={closureKey === c.key} onClick={() => setClosureKey(c.key)} className={`text-left bg-white border rounded-2xl p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between ${closureKey === c.key ? 'border-purple-400 ring-2 ring-purple-500/10' : 'border-slate-200/80 hover:border-slate-300'}`}><div className={`absolute top-0 left-0 right-0 h-1.5 ${c.bar} rounded-t-2xl`} /><div className="pt-1"><span className="text-2xl font-black text-slate-900 leading-none tabular-nums">{closure.data ? c.count : '…'}</span></div><p className="text-[11px] text-slate-500 font-medium mt-3">{c.title}</p></button>)}</div>
      {closure.data && <div data-testid="closure-list" className="space-y-2">
        {closureKey === 'po_without_receipt' && table(['OC', tx('Proveedor', 'Supplier'), tx('Requisición', 'Requisition'), tx('Cliente', 'Client'), tx('Compromiso', 'Commitment')], closure.data.po_without_receipt.map(o => <tr key={o.id}><td className="p-2.5 font-bold">{o.folio}{o.version_number > 1 ? ` Rev. ${o.version_number - 1}` : ''}</td><td className="p-2.5">{o.supplier_name}</td><td className="p-2.5">{show(o.requisitions)}</td><td className="p-2.5">{show(o.client_name)}</td><td className="p-2.5">{ymd(o.commitment_date)}</td></tr>), tx('Todas las OC vigentes tienen recepción.', 'Every current PO has a receipt.'), 'min-w-[640px]')}
        {(closureKey === 'receipts_pending' || closureKey === 'deliveries_missing') && table([tx('Recepción', 'Receipt'), 'OC', tx('Cliente', 'Client'), tx('Fecha', 'Date'), tx('Recibido', 'Received'), closureKey === 'receipts_pending' ? tx('Pendientes', 'Pending items') : tx('Aceptación', 'Acceptance')], closure.data[closureKey].map(r => <tr key={r.id}><td className="p-2.5 font-bold">{r.folio}</td><td className="p-2.5">{r.po_folio}</td><td className="p-2.5">{show(r.client_name)}</td><td className="p-2.5">{ymd(r.date)}</td><td className="p-2.5">{pct(r.received_percent)}</td><td className="p-2.5"><div className="flex flex-wrap gap-1">{closureKey === 'receipts_pending' ? r.pending_reasons.map(x => <span key={x}>{pill('pending', reasonLabel(x, en))}</span>) : pill('pending', tx('Sin entrega registrada', 'No delivery recorded'))}</div></td></tr>), closureKey === 'receipts_pending' ? tx('No hay recepciones con pendientes.', 'No receipts with pending items.') : tx('Todas las recepciones tienen entrega registrada.', 'Every receipt has a delivery recorded.'), 'min-w-[640px]')}
        {closureKey === 'acceptance_pending' && table([tx('Documento', 'Document'), tx('Cliente', 'Client'), tx('Fecha', 'Date'), tx('Referencias', 'References'), tx('Aceptación', 'Acceptance')], closure.data.acceptance_pending.map(r => <tr key={`${r.kind}-${r.id}`}><td className="p-2.5 font-bold">{r.kind === 'delivery' ? '🚚' : '📦'} {r.folio}</td><td className="p-2.5">{show(r.client_name)}</td><td className="p-2.5">{ymd(r.date)}</td><td className="p-2.5">{show(r.references)}</td><td className="p-2.5">{pill(r.acceptance)}</td></tr>), tx('No hay aceptaciones pendientes.', 'No pending acceptances.'), 'min-w-[640px]')}
        {closureKey === 'ready_to_invoice' && table([tx('Requisición', 'Requisition'), tx('Cliente', 'Client'), tx('Órdenes de compra', 'Purchase orders')], closure.data.ready_to_invoice.map(r => <tr key={r.id}><td className="p-2.5 font-bold">{r.folio}</td><td className="p-2.5">{r.client_name}</td><td className="p-2.5">{r.purchase_orders}</td></tr>), tx('No hay requisiciones listas para facturar.', 'No requisitions ready to invoice.'), 'min-w-[480px]')}
        <p className="text-[10px] text-slate-400">{tx('Listos para facturar: todas las OC vigentes de la requisición recibidas al 100 % con entrega aceptada y sin factura activa (misma regla que la etapa 6 de la matriz original).', 'Ready to invoice: every current PO of the requisition received at 100% with accepted delivery and no active invoice (same rule as stage 6 of the original matrix).')}</p>
      </div>}
    </div>}

    {format && <div role="dialog" aria-modal="true" aria-label={tx('Formato de entrega', 'Delivery format')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setFormat('')}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100"><h3 className="text-sm font-black">{tx('Formato de entrega', 'Delivery format')} {fmt.data?.item?.folio || ''}</h3><div className="flex gap-2"><button type="button" onClick={printFormat} disabled={!fmt.data} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" />{tx('Imprimir / PDF', 'Print / PDF')}</button><button type="button" aria-label={tx('Cerrar', 'Close')} onClick={() => setFormat('')} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div></div>
        <div className="p-4 overflow-auto"><Wait s={fmt} /><Err s={fmt} />{fmt.data && <iframe title={tx('Formato de entrega', 'Delivery format')} srcDoc={deliveryHtml(fmt.data, en)} sandbox="" className="w-full h-[70vh] rounded-xl border border-slate-200 bg-white" />}</div>
      </div>
    </div>}
  </div>;
}
