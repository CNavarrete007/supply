import React, { useMemo, useRef, useState } from 'react';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { receptionDeliverable } from './api';
import { label, tone, qty, bytes } from './model.mjs';
import { PHOTO_MAX } from './receptionForm.mjs';
import { DELIVERY_TYPES, ACCEPTANCE, emptyDelivery, requisitionSummary, deliverableLines, quantitiesFor, includedLines, validateDelivery, deliveryHashes, deliveryLockedText } from './deliveryForm.mjs';
import { compressPhotos, openPhoto } from './photos.js';
import { useLoad } from './useLoad.js';
import { SignaturePad } from '../purchaseOrders/SignaturePad.jsx';
import { safeSignature, signatureStatus } from '../purchaseOrders/poFormat.mjs';

// Recepción y Entrega · tarjeta 2 "Formato de entrega al cliente" (diseño Grupo Gerez).
// Datos reales: GET /api/v1/reception/deliverable (clientes con material recibido; por requisición y partida: solicitado,
// recibido, entregado y saldo; entregas ya registradas). Registrar la entrega, firmas y fotografías es una escritura
// operativa sin endpoint autorizado: el formato se valida completo, se calculan sus huellas SHA-256 y no se guarda nada.
const r6 = n => Math.round(n * 1e6) / 1e6;

export function DeliveryFormat({ en = false, today = '', rev = 0, notify = () => {}, onMatrix, onViewFormat }) {
  const tx = (es, e) => (en ? e : es);
  const [f, setF] = useState(() => emptyDelivery(today));
  const [tried, setTried] = useState(false); const [msg, setMsg] = useState(null); const [photoMsg, setPhotoMsg] = useState(''); const [sigMsg, setSigMsg] = useState('');
  const [hashes, setHashes] = useState(null);
  const photoRef = useRef(null);
  const clients = useLoad(s => receptionDeliverable('all', s), [rev]);
  const data = useLoad(s => receptionDeliverable(f.client, s), [f.client, rev], !!f.client);
  const reqs = (data.status === 'ready' && data.data?.client === f.client ? data.data.requisitions : null) || [];
  const clientName = (clients.data?.clients || []).find(c => c.id === f.client)?.name || '';
  const lines = useMemo(() => deliverableLines(reqs, f.requisitions), [reqs, f.requisitions]);
  const v = useMemo(() => validateDelivery(f, { reqs, today, safeSig: safeSignature }, en), [f, reqs, today, en]);
  const err = k => (tried ? v.errors[k] : '');

  const touch = () => { setMsg(null); setHashes(null); };
  const set = (k, val) => { setF(x => ({ ...x, [k]: val })); touch(); };
  // Completa: every available balance of the selected requisitions; Parcial keeps captured quantities still valid.
  const withLines = (next, list = reqs) => ({ ...next, qty: quantitiesFor(next.type, deliverableLines(list, next.requisitions), next.qty) });
  const setType = type => { setF(x => withLines({ ...x, type, acceptance: type === 'complete' && x.acceptance === 'partial_open' ? 'accepted' : x.acceptance })); touch(); };
  const setClient = id => { setF(x => ({ ...x, client: id, requisitions: [], qty: {} })); touch(); };
  const toggleReq = id => { setF(x => withLines({ ...x, requisitions: x.requisitions.includes(id) ? x.requisitions.filter(r => r !== id) : [...x.requisitions, id] })); touch(); };
  const setQty = (key, val) => { setF(x => ({ ...x, qty: { ...x.qty, [key]: val } })); touch(); };
  const reset = () => { setF(emptyDelivery(today)); setTried(false); setMsg(null); setPhotoMsg(''); setSigMsg(''); setHashes(null); if (photoRef.current) photoRef.current.value = ''; };
  const addPhotos = async files => {
    const { photos, errors } = await compressPhotos(files, f.photos.length, en);
    setF(x => ({ ...x, photos: [...x.photos, ...photos].slice(0, PHOTO_MAX) })); touch(); setPhotoMsg(errors.join(' '));
    if (photoRef.current) photoRef.current.value = '';
  };
  const save = () => {
    setTried(true);
    if (!v.ok) { setMsg({ kind: 'error', text: v.first }); setHashes(null); return; }
    const h = deliveryHashes(f, reqs, clientName); setHashes(h);
    const text = deliveryLockedText(f, reqs, clientName, h.content, en);
    setMsg({ kind: 'locked', text }); notify(tx('Formato de entrega no registrado', 'Delivery format not recorded'), text, 'warning');
  };

  const Wait = ({ s }) => (s?.status === 'loading' ? <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p> : null);
  const Err = ({ s }) => (s?.error ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{s.error.message}</p> : null);
  const pill = (code, txt) => <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${tone(code)}`}>{txt || label(code, en)}</span>;
  const lbl = (t, req, k, child, cls = '') => <label className={`block ${cls}`}><span className="block text-[11px] font-black text-slate-900 mb-1.5">{t}{req ? ' *' : ''}</span>{child}{err(k) && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{err(k)}</span>}</label>;
  const ctl = k => `w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 ${err(k) ? 'border-rose-400' : 'border-slate-300'}`;
  const section = (n, title, sub, right) => <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-slate-100"><div><h4 className="text-sm font-black text-slate-900">{n ? `${n}. ` : ''}{title}</h4>{sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}</div>{right}</div>;
  const empty = text => <div className="p-8 border border-dashed border-slate-300 rounded-2xl bg-slate-50/40 text-center text-sm text-slate-500">{text}</div>;
  const totalAfter = l => r6(l.available - (Number(f.qty[l.key]) || 0));
  const inc = includedLines(lines, f.qty);

  return <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 text-left space-y-5" data-testid="delivery-form">
    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-4 border-b border-slate-100">
      <div className="min-w-0 flex-1"><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Formato de entrega al cliente', 'Client delivery format')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Genera un formato firmado para una o varias requisiciones/solicitudes del mismo cliente. Permite entregas parciales o completas y controla el saldo por partida.', 'Generates a signed format for one or several requisitions/requests of the same client. Allows partial or complete deliveries and controls the balance per line.')}</p></div>
      <span className="text-[10.5px] font-black text-purple-800 bg-purple-100/80 border border-purple-200 rounded-full px-3 py-1 shrink-0">{tx('Paso 7 · Entrega documentada', 'Step 7 · Documented delivery')}</span>
    </div>
    <div data-testid="delivery-nom151" className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-[11.5px] text-amber-900 leading-relaxed"><strong>{tx('Firma electrónica y NOM-151:', 'Electronic signature and NOM-151:')}</strong> {tx('SupplyFlow vincula el contenido del formato con las firmas de quien entrega y quien recibe mediante huellas SHA-256 y bloquea el registro firmado. Para una constancia de conservación NOM-151-SCFI-2016, debe registrarse la constancia emitida por un Prestador de Servicios de Certificación acreditado.', 'SupplyFlow binds the format content to the signatures of whoever delivers and whoever receives with SHA-256 fingerprints and locks the signed record. For a NOM-151-SCFI-2016 preservation certificate, the certificate issued by an accredited Certification Service Provider must be recorded.')}</div>

    <Wait s={clients} /><Err s={clients} />
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
      {lbl(tx('Cliente', 'Client'), true, 'client', <select aria-label={tx('Cliente', 'Client')} value={f.client} onChange={e => setClient(e.target.value)} className={ctl('client')}><option value="">{tx('Seleccionar...', 'Select...')}</option>{(clients.data?.clients || []).map(c => <option key={c.id} value={c.id}>{c.name} · {c.requisitions} {tx('requisición(es)', 'requisition(s)')}</option>)}</select>, 'md:col-span-2')}
      {lbl(tx('Tipo de entrega', 'Delivery type'), true, 'type', <select aria-label={tx('Tipo de entrega', 'Delivery type')} value={f.type} onChange={e => setType(e.target.value)} className={ctl('type')}>{DELIVERY_TYPES.map(([k, es, e2]) => <option key={k} value={k}>{en ? e2 : es}</option>)}</select>)}
      {lbl(tx('Fecha de entrega', 'Delivery date'), true, 'date', <input type="date" aria-label={tx('Fecha de entrega', 'Delivery date')} value={f.date} max={today} onChange={e => set('date', e.target.value)} className={ctl('date')} />)}
      {lbl(tx('Lugar de entrega', 'Delivery place'), true, 'place', <input type="text" aria-label={tx('Lugar de entrega', 'Delivery place')} value={f.place} maxLength={255} placeholder={tx('Sitio, terminal, almacén, oficina, instalación...', 'Site, terminal, warehouse, office, facility...')} onChange={e => set('place', e.target.value)} className={ctl('place')} />, 'md:col-span-2')}
      {lbl(tx('Aceptación / condición de recepción', 'Acceptance / receipt condition'), false, 'acceptance', <select aria-label={tx('Aceptación / condición de recepción', 'Acceptance / receipt condition')} value={f.acceptance} onChange={e => set('acceptance', e.target.value)} className={ctl('acceptance')}>{ACCEPTANCE.map(([k, es, e2]) => <option key={k} value={k} disabled={f.type === 'complete' && k === 'partial_open'}>{en ? e2 : es}</option>)}</select>, 'md:col-span-3')}
    </div>

    <div data-testid="delivery-requisitions" className="space-y-3">
      {section(1, tx('Requisiciones / solicitudes a incluir', 'Requisitions / requests to include'), tx('Solo se muestran requisiciones del cliente con material recibido en órdenes de compra vigentes.', 'Only requisitions of the client with material received on current purchase orders are shown.'), f.client && <span className="text-[10.5px] font-black text-purple-900 bg-purple-100/80 border border-purple-200 rounded-full px-3 py-1">{f.requisitions.length} {tx('seleccionada(s)', 'selected')}</span>)}
      <Wait s={data} /><Err s={data} />
      {err('requisitions') && <p role="alert" className="text-[11px] text-rose-700 font-semibold">{err('requisitions')}</p>}
      {!f.client ? empty(tx('Selecciona un cliente para mostrar las requisiciones/solicitudes con material recibido.', 'Select a client to show the requisitions/requests with received material.'))
        : data.status === 'ready' && !reqs.length ? empty(tx('El cliente no tiene requisiciones con material recibido.', 'The client has no requisitions with received material.'))
        : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{reqs.map(r => { const s = requisitionSummary(r); const on = f.requisitions.includes(r.id); const none = !s.available;
          return <div key={r.id} data-testid="delivery-req" className={`rounded-2xl border p-3.5 space-y-2 transition-all ${on ? 'border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/30' : 'border-slate-200 bg-white'} ${none ? 'opacity-80' : ''}`}>
            <label className={`flex items-start gap-2.5 ${none ? 'cursor-not-allowed' : 'cursor-pointer'}`}><input type="checkbox" checked={on} disabled={none && !on} onChange={() => toggleReq(r.id)} aria-label={`${tx('Incluir', 'Include')} ${r.folio}`} className="mt-0.5 w-4 h-4 accent-purple-600" />
              <span className="min-w-0"><span className="block text-xs font-black text-slate-900 break-all">{r.folio}</span><span className="block text-[10.5px] text-slate-500">{r.project || '—'} · {r.purchase_orders || '—'}</span></span></label>
            <div className="grid grid-cols-3 gap-1 text-center">{[[s.items, tx('Partidas', 'Lines')], [s.available, tx('Con saldo', 'With balance')], [qty(s.availableQty), tx('Disponible', 'Available')]].map(([n, t]) => <div key={t} className="bg-slate-50 border border-slate-100 rounded-xl p-1.5"><span className="block text-xs font-bold text-slate-900">{n}</span><span className="text-[9px] text-slate-500">{t}</span></div>)}</div>
            {none && <p className="text-[10.5px] font-semibold text-emerald-700">{tx('Sin saldo por entregar: todo lo recibido ya se entregó o falta recibir material.', 'No balance to deliver: everything received was delivered or material is still to be received.')}</p>}
            {r.deliveries?.length > 0 && <div className="flex flex-wrap items-center gap-1.5 text-[10px]"><span className="font-bold text-slate-500">{tx('Entregas registradas', 'Recorded deliveries')}:</span>{r.deliveries.map(d => <button key={d.id} type="button" onClick={() => onViewFormat?.(d.id)} title={tx('Ver formato registrado', 'View recorded format')} className="px-2 py-0.5 rounded-lg border border-slate-200 hover:border-purple-400 bg-white font-bold text-slate-700 flex items-center gap-1">{d.locked ? '🔒 ' : ''}{d.folio} · {String(d.date || '').slice(0, 10)} {d.cancelled ? pill('cancelled', tx('Cancelada', 'Cancelled')) : pill(d.acceptance_status)}</button>)}</div>}
          </div>; })}</div>}
    </div>

    <div data-testid="delivery-lines" className="space-y-3">
      {section(2, tx('Partidas a entregar', 'Lines to deliver'), f.type === 'complete' ? tx('Entrega completa: se cargan automáticamente todos los saldos disponibles de las requisiciones seleccionadas.', 'Complete delivery: every available balance of the selected requisitions is loaded automatically.') : tx('Entrega parcial: captura la cantidad a entregar por partida; lo no entregado queda como saldo pendiente.', 'Partial delivery: enter the quantity to deliver per line; what is not delivered stays as a pending balance.'), lines.length > 0 && <span data-testid="delivery-lines-count" className="text-[10.5px] font-black text-blue-900 bg-blue-100/80 border border-blue-200 rounded-full px-3 py-1">{inc.length} / {lines.length} {tx('partida(s)', 'line(s)')}</span>)}
      {err('items') && <p role="alert" className="text-[11px] text-rose-700 font-semibold">{err('items')}</p>}
      {!lines.length ? empty(tx('Selecciona una o varias requisiciones con artículos disponibles para entrega.', 'Select one or more requisitions with items available for delivery.'))
        : <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white"><table className="w-full text-left border-collapse text-[10.5px] min-w-[980px]"><thead><tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">{[tx('Requisición', 'Requisition'), '#', tx('Descripción', 'Description'), tx('Unidad', 'Unit'), tx('Solicitado', 'Requested'), tx('Recibido', 'Received'), tx('Entregado', 'Delivered'), tx('Disponible', 'Available'), tx('A entregar', 'To deliver'), tx('Saldo después', 'Balance after')].map(h => <th key={h} className="p-2.5 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{lines.map(l => { const le = tried ? v.lineErrors[l.key] : ''; return <tr key={l.key} data-testid="delivery-line" className="align-top">
            <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{l.requisition}</td><td className="p-2.5">{l.line_number}</td><td className="p-2.5 font-semibold text-slate-800">{l.description}<div className="text-[9px] text-slate-400">{l.purchase_orders}</div></td><td className="p-2.5">{l.unit_label}</td>
            <td className="p-2.5">{qty(l.requested)}</td><td className="p-2.5">{qty(l.received)}</td><td className="p-2.5">{qty(l.delivered)}</td><td className="p-2.5 font-bold text-emerald-700">{qty(l.available)}</td>
            <td className="p-2.5 min-w-[150px]"><div className="flex items-center gap-1.5"><input type="text" inputMode="decimal" aria-label={`${tx('Cantidad a entregar', 'Quantity to deliver')} ${l.requisition} #${l.line_number}`} value={f.qty[l.key] ?? ''} readOnly={f.type === 'complete'} placeholder="0" onChange={e => setQty(l.key, e.target.value)} className={`w-24 px-2 py-1.5 border rounded-lg text-xs ${f.type === 'complete' ? 'bg-slate-100 text-slate-600' : 'bg-white'} ${le ? 'border-rose-400' : 'border-slate-300'}`} />
              {f.type === 'partial' && <span className="text-[9.5px] font-black"><button type="button" onClick={() => setQty(l.key, String(l.available))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700">{tx('Todo', 'All')}</button></span>}</div>
              {le && <span role="alert" className="block text-[10px] text-rose-600 font-semibold mt-1">{le}</span>}</td>
            <td className="p-2.5 font-bold">{qty(Math.max(0, totalAfter(l)))}</td>
          </tr>; })}</tbody></table></div>}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {lbl(tx('Evidencia / remisión / acuse', 'Evidence / delivery note / acknowledgment'), false, 'evidence', <input type="text" aria-label={tx('Evidencia / remisión / acuse', 'Evidence / delivery note / acknowledgment')} value={f.evidence} maxLength={255} placeholder={tx('Folio, remisión, packing list, referencia...', 'Folio, delivery note, packing list, reference...')} onChange={e => set('evidence', e.target.value)} className={ctl('evidence')} />)}
      {lbl(tx('Observaciones', 'Notes'), ['accepted_obs', 'rejected'].includes(f.acceptance), 'notes', <textarea rows={3} aria-label={tx('Observaciones', 'Notes')} value={f.notes} maxLength={2100} onChange={e => set('notes', e.target.value)} className={ctl('notes')} />)}
    </div>

    <div data-testid="delivery-photos" className="p-4 sm:p-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 space-y-3">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-2 pb-3 border-b border-slate-200/70"><div><h4 className="text-sm font-black text-slate-900">{tx('Fotografías de entrega', 'Delivery photos')}</h4><p className="text-[11px] text-slate-500 mt-0.5">{tx('Opcional: material entregado, sitio, acuse firmado, etiquetas o condiciones de entrega.', 'Optional: delivered material, site, signed acknowledgment, labels or delivery conditions.')}</p></div><span data-testid="delivery-photo-count" className="text-[10.5px] font-black text-blue-900 bg-blue-100/80 border border-blue-200 rounded-full px-3 py-1 shrink-0">{f.photos.length} {tx('foto(s)', 'photo(s)')}</span></div>
      <input ref={photoRef} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label={tx('Fotografías de entrega', 'Delivery photos')} onChange={e => addPhotos(e.target.files)} className="block w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-2 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:text-slate-700 file:font-semibold" />
      <p className="text-[10px] text-slate-500">{tx(`Máximo ${PHOTO_MAX} fotografías. Se comprimen automáticamente (lado mayor ≤ 1600 px, JPG) y no se suben mientras el registro esté bloqueado.`, `Maximum ${PHOTO_MAX} photos. They are compressed automatically (longest edge ≤ 1600 px, JPG) and are not uploaded while recording is blocked.`)}</p>
      {photoMsg && <p role="alert" data-testid="delivery-photo-msg" className="text-[11px] text-rose-700 font-semibold">{photoMsg}</p>}
      {f.photos.length ? <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">{f.photos.map(p => <figure key={p.id} data-testid="delivery-photo" className="bg-white rounded-xl border border-slate-200 p-1.5 space-y-1">
          <button type="button" onClick={() => openPhoto(p)} aria-label={`${tx('Ver fotografía', 'View photo')} ${p.name}`} className="block w-full"><img src={p.data} alt={p.name} className="w-full h-20 object-cover rounded-lg" /></button>
          <figcaption className="text-[9.5px] text-slate-600 truncate" title={p.name}>{p.name}</figcaption><div className="text-[9px] text-slate-400">{p.w}×{p.h} · {bytes(p.size)}</div>
          <span className="text-[10px] font-black block"><button type="button" onClick={() => set('photos', f.photos.filter(x => x.id !== p.id))} className="w-full px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md">{tx('Quitar', 'Remove')}</button></span>
        </figure>)}</div>
        : <div className="p-6 border border-dashed border-slate-300 rounded-2xl bg-white/60 text-center text-sm text-slate-500">{tx('Sin fotografías de entrega.', 'No delivery photos.')}</div>}
    </div>

    <div data-testid="delivery-signers" className="space-y-4">
      {section(3, tx('Firmantes del formato', 'Format signers'), tx('Quien entrega y quien recibe deben ser personas distintas; cada uno firma y confirma su firma electrónica.', 'Whoever delivers and whoever receives must be different people; each signs and confirms the electronic signature.'))}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lbl(tx('Entregó por el contratista', 'Delivered by the contractor'), true, 'deliverer', <input type="text" aria-label={tx('Entregó por el contratista', 'Delivered by the contractor')} value={f.deliverer} maxLength={128} placeholder={tx('Nombre completo', 'Full name')} onChange={e => set('deliverer', e.target.value)} className={ctl('deliverer')} />)}
        {lbl(tx('Puesto de quien entrega', 'Position of who delivers'), true, 'delivererPosition', <input type="text" aria-label={tx('Puesto de quien entrega', 'Position of who delivers')} value={f.delivererPosition} maxLength={128} placeholder={tx('Puesto / área', 'Position / area')} onChange={e => set('delivererPosition', e.target.value)} className={ctl('delivererPosition')} />)}
        {lbl(tx('Recibió por el cliente', 'Received by the client'), true, 'receiver', <input type="text" aria-label={tx('Recibió por el cliente', 'Received by the client')} value={f.receiver} maxLength={128} placeholder={tx('Nombre completo', 'Full name')} onChange={e => set('receiver', e.target.value)} className={ctl('receiver')} />)}
        {lbl(tx('Puesto de quien recibe', 'Position of who receives'), true, 'receiverPosition', <input type="text" aria-label={tx('Puesto de quien recibe', 'Position of who receives')} value={f.receiverPosition} maxLength={128} placeholder={tx('Puesto / área', 'Position / area')} onChange={e => set('receiverPosition', e.target.value)} className={ctl('receiverPosition')} />)}
        {lbl(tx('Empresa del receptor', 'Receiver company'), false, 'receiverCompany', <input type="text" aria-label={tx('Empresa del receptor', 'Receiver company')} value={f.receiverCompany} maxLength={255} placeholder={clientName || tx('Empresa', 'Company')} onChange={e => set('receiverCompany', e.target.value)} className={ctl('receiverCompany')} />)}
        {lbl(tx('Correo del receptor', 'Receiver email'), false, 'receiverEmail', <input type="email" aria-label={tx('Correo del receptor', 'Receiver email')} value={f.receiverEmail} maxLength={190} placeholder="correo@empresa.com" onChange={e => set('receiverEmail', e.target.value)} className={ctl('receiverEmail')} />)}
      </div>
      {sigMsg && <p role="alert" className="text-[11px] text-rose-700 font-semibold">{sigMsg}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[
        ['deliverer', 'sigDeliverer', 'consentDeliverer', tx('Firma de quien entrega', 'Signature of who delivers'), f.deliverer || tx('Entregó por el contratista', 'Delivered by the contractor'), tx('Confirmo que esta firma electrónica me identifica como persona que entrega y expresa mi conformidad con el contenido del formato.', 'I confirm that this electronic signature identifies me as the person who delivers and expresses my agreement with the content of the format.')],
        ['receiver', 'sigReceiver', 'consentReceiver', tx('Firma de quien recibe', 'Signature of who receives'), f.receiver || tx('Recibió por el cliente', 'Received by the client'), tx('Confirmo que esta firma electrónica me identifica como receptor y expresa la recepción/conformidad indicada en este formato.', 'I confirm that this electronic signature identifies me as the receiver and expresses the receipt/agreement indicated in this format.')],
      ].map(([role, sk, ck, title, who, consent]) => <div key={role} className="space-y-2">
        <SignaturePad role={role} en={en} title={title} description={who} value={f[sk]} status={signatureStatus(!!safeSignature(f[sk]), null, en)} onChange={url => { set(sk, url); setSigMsg(''); if (!url) set(ck, false); }} onError={setSigMsg} />
        <label className="flex items-start gap-2 text-[11px] text-slate-700"><input type="checkbox" checked={f[ck]} disabled={!safeSignature(f[sk])} onChange={e => set(ck, e.target.checked)} aria-label={`${tx('Confirmación', 'Confirmation')}: ${title}`} className="mt-0.5 w-4 h-4 accent-purple-600" /><span>{consent}</span></label>
        {err(sk) && <p role="alert" className="text-[10.5px] text-rose-600 font-semibold">{err(sk)}</p>}
      </div>)}</div>
    </div>

    {tried && v.ok && v.warnings.map(w => <p key={w} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">⚠ {w}</p>)}
    {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} data-testid="delivery-save-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs break-words ${msg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>{msg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span className="min-w-0">{msg.text}</span></p>}
    {hashes && <div data-testid="delivery-hashes" className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-[10.5px] text-slate-700 space-y-1 break-all">{[[tx('Contenido del formato', 'Format content'), hashes.content], [tx('Firma de quien entrega', 'Signature of who delivers'), hashes.deliverer], [tx('Firma de quien recibe', 'Signature of who receives'), hashes.receiver]].map(([k, h]) => <div key={k}><span className="font-bold">{k} · SHA-256:</span> <code>{h}</code></div>)}<div className="text-slate-500">{tx('Huellas calculadas en este navegador; no se registraron ni constituyen constancia NOM-151.', 'Fingerprints computed in this browser; they were not recorded and are not a NOM-151 certificate.')}</div></div>}
    <div className="flex flex-wrap gap-3 pt-1 text-sm font-black">
      <button type="button" onClick={save} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md flex items-center gap-2"><span aria-hidden="true">🚚</span>{tx('Guardar y firmar formato', 'Save and sign format')}</button>
      <button type="button" onClick={reset} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm flex items-center gap-2"><span aria-hidden="true">🧹</span>{tx('Limpiar', 'Clear')}</button>
      <button type="button" onClick={() => onMatrix?.()} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl flex items-center gap-2"><span aria-hidden="true">📋</span>{tx('Matriz recepción', 'Reception matrix')}</button>
    </div>
  </div>;
}

export default DeliveryFormat;
