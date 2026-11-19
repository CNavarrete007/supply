// Recepción y Entrega · Formato de entrega (vista previa y PDF) con la identidad Grupo Gerez.
// Datos: GET /api/v1/reception/deliveries/{id} (encabezado, partidas, origen OC/recepción, evidencia y firmas). Solo lectura:
// las imágenes de firma quedan en almacenamiento privado y no se descargan; el formato muestra la firma registrada, su
// método, fecha y huella. Todos los valores del HTML se escapan.
import { escapeHtml } from '../generalMatrix/model.mjs';
import { PO_FORMAT } from '../purchaseOrders/poPdf.mjs';
import { label } from './model.mjs';
import { qty2 } from './receptionMatrix.mjs';

const clean = v => String(v ?? '').trim();
const dash = v => clean(v) || '—';
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isPartial = v => /^(partial|parcial)/.test(fold(v));
const typeText = (v, en) => (isPartial(v) ? (en ? 'Partial' : 'Parcial') : /^(complete|completa|total)/.test(fold(v)) ? (en ? 'Complete' : 'Completa') : label(v, en));
const acceptText = (v, en) => (/^(accepted|aceptad)/.test(fold(v)) ? (en ? 'Accepted' : 'Aceptado') : /reject|rechaz/.test(fold(v)) ? (en ? 'Rejected' : 'Rechazado') : label(v, en));
const stamp = v => clean(v).replace(/(\.\d+)$/, '').slice(0, 19);
const uniq = list => [...new Set(list.map(clean).filter(Boolean))];

/** Signature of a slot: receiver (client) or deliverer (contractor), by role. */
const RECEIVER = /receiv|recib|client|acknowledg|acuse/i;
const DELIVERER = /deliver|entreg|contract|supplier|proveedor|buyer|compr/i;

/** Pure model shared by the HTML preview and the PDF. */
export function formatModel(d, en = false) {
  const v = d?.item || {};
  const L = (es, e) => (en ? e : es);
  const sources = d?.sources || [];
  const sigs = d?.signatures || [];
  const ocOf = req => uniq(sources.filter(s => clean(s.requisition) === clean(req)).map(s => s.po_folio)).join(', ') || uniq(sources.map(s => s.po_folio)).join(', ') || '—';
  const sigFor = re => sigs.find(s => re.test(clean(s.role))) || null;
  const recv = sigFor(RECEIVER); const deliv = sigs.find(s => s !== recv && DELIVERER.test(clean(s.role))) || null;
  const slot = (title, name, position, s) => ({ title, name: dash(name).toUpperCase(), position: clean(position).toUpperCase(),
    sig: s ? { text: s.has_image ? L('Firma manuscrita registrada (imagen en resguardo privado)', 'Handwritten signature recorded (image in private storage)') : L('Firma electrónica registrada', 'Electronic signature recorded'),
      when: stamp(s.signed_at), method: clean(s.method), hash: clean(s.signature_sha256 || s.document_sha256), signer: clean(s.signer) } : null });
  const last = [...sigs].sort((a, b) => clean(b.signed_at).localeCompare(clean(a.signed_at)))[0] || null;
  return {
    folio: dash(v.folio), date: clean(v.date).slice(0, 10) || '—', type: typeText(v.delivery_type, en), locked: !!v.locked,
    client: dash(v.client_name), place: dash(v.delivery_place), requisitions: dash(v.requisitions), acceptance: acceptText(v.acceptance_status, en), ocs: dash(v.po_folios),
    rows: (d?.items || []).map(i => ({ req: dash(i.requisition), oc: ocOf(i.requisition), item: clean(i.line_number) || '—', desc: dash(i.description), unit: clean(i.unit_label).toUpperCase() || '—',
      requested: qty2(i.requested), delivered: qty2(i.delivered), balance: qty2(i.balance) })),
    evidence: [clean(v.evidence_text), clean(v.notes)].filter(Boolean).join(' · ') || '—',
    receipts: dash(v.receipt_folios),
    signers: [slot(L('ENTREGÓ POR EL CONTRATISTA', 'DELIVERED BY THE CONTRACTOR'), v.delivered_by, v.delivered_by_position, deliv),
      slot(L('RECIBIÓ POR EL CLIENTE', 'RECEIVED BY THE CLIENT'), v.received_by, v.received_by_position, recv)],
    control: { id: clean(v.control_reference) || clean(v.id) || '—', signedAt: last ? stamp(last.signed_at) : '', method: last ? clean(last.method) : '', hash: clean(v.document_sha256) || clean(last?.document_sha256) },
  };
}

export const deliveryPdfName = d => `${clean(d?.item?.folio) || 'ENT'}.pdf`;

/** HTML document of the format (iframe preview, sandbox=""). */
export function deliveryFormatHtml(d, en = false, { logoUrl = '/image_923273.svg' } = {}) {
  const f = formatModel(d, en);
  const L = (es, e) => (en ? e : es);
  const e = escapeHtml;
  const rows = f.rows.map(r => `<tr><td>${e(r.req)}</td><td class="sm">${e(r.oc)}</td><td class="c">${e(r.item)}</td><td>${e(r.desc)}</td><td class="c">${e(r.unit)}</td><td class="n">${e(r.requested)}</td><td class="n b">${e(r.delivered)}</td><td class="n">${e(r.balance)}</td></tr>`).join('')
    || `<tr><td colspan="8" class="c muted">${L('Sin partidas registradas.', 'No lines recorded.')}</td></tr>`;
  const signer = s => `<div class="sig"><div class="st">${e(s.title)}</div><div class="mark">${s.sig ? `<div class="ok">✔ ${e(s.sig.text)}</div><div class="muted">${e(s.sig.when)}${s.sig.method ? ` · ${e(s.sig.method)}` : ''}</div>${s.sig.hash ? `<div class="mono">SHA-256 ${e(s.sig.hash.slice(0, 16))}…</div>` : ''}` : `<div class="muted">[ ${L('Sin firma registrada', 'No signature recorded')} ]</div>`}</div><div class="line"></div><div class="sn">${e(s.name)}</div><div class="sp">${e(s.position || '—')}</div></div>`;
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="utf-8"><title>${e(f.folio)}</title><style>
@page { size: letter; margin: 1.2cm; } * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; padding: 24px 30px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 10px; background: #fff; }
.hd { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid #1e385c; }
.brand { display: flex; align-items: center; gap: 10px; min-width: 190px; } .brand img { width: 46px; height: 46px; object-fit: contain; }
.brand .n { font-size: 16px; font-weight: 900; color: #ea580c; letter-spacing: .5px; } .brand .t { font-size: 7px; font-weight: 700; color: #64748b; letter-spacing: 1px; }
.ttl { text-align: center; flex: 1; } .ttl h1 { margin: 0; font-size: 19px; letter-spacing: .5px; } .ttl div { margin-top: 4px; font-size: 8.5px; color: #1e385c; letter-spacing: .6px; }
.meta { text-align: right; min-width: 150px; font-size: 8.5px; color: #475569; line-height: 1.7; } .meta .f { font-size: 11px; font-weight: 800; color: #1d4ed8; }
.box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 3px; padding: 9px 11px; margin-top: 14px; }
.lbl { font-size: 8px; font-weight: 800; color: #1e385c; letter-spacing: .4px; text-transform: uppercase; margin-bottom: 4px; }
.cl { display: flex; justify-content: space-between; gap: 12px; } .cl .nm { font-size: 12px; font-weight: 800; margin-bottom: 3px; } .cl .r { text-align: right; font-weight: 700; line-height: 1.8; }
table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 9px; } th { background: #e2e8f0; color: #0f172a; font-size: 7.5px; text-transform: uppercase; padding: 7px 5px; border: 1px solid #94a3b8; }
td { padding: 9px 5px; border: 1px solid #94a3b8; vertical-align: top; } .c { text-align: center; } .n { text-align: right; } .b { font-weight: 800; } .sm { font-size: 8px; }
.sigs { display: flex; gap: 18px; margin-top: 16px; } .sig { flex: 1; border: 1px solid #cbd5e1; border-radius: 3px; padding: 10px 14px 12px; text-align: center; }
.st { font-size: 8px; font-weight: 800; color: #1e385c; } .mark { height: 70px; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.ok { color: #047857; font-weight: 700; font-size: 9px; } .line { border-top: 1px solid #1e385c; margin: 4px 26px 6px; } .sn { font-weight: 800; font-size: 9px; } .sp { font-size: 7.5px; color: #64748b; margin-top: 2px; }
.muted { color: #64748b; } .mono { font-family: monospace; font-size: 7.5px; color: #64748b; word-break: break-all; }
.ctl { line-height: 1.8; font-size: 8px; } .ctl .id { color: #1d4ed8; } .warn { color: #b45309; font-weight: 700; }
.foot { margin-top: 18px; text-align: center; font-size: 7.5px; color: #94a3b8; }
</style></head><body>
<div class="hd"><div class="brand"><img src="${e(logoUrl)}" alt="Grupo Gerez"><div><div class="n">${e(PO_FORMAT.company)}</div><div class="t">${PO_FORMAT.tagline.map(e).join('<br>')}</div></div></div>
<div class="ttl"><h1>${L('FORMATO DE ENTREGA', 'DELIVERY FORMAT')}</h1><div>DELIVERY NOTE / ${L('EVIDENCIA DE ENTREGA', 'DELIVERY EVIDENCE')}</div></div>
<div class="meta"><div class="f">${e(f.folio)}</div><div>${L('Fecha', 'Date')}: ${e(f.date)}</div><div>${L('Tipo', 'Type')}: ${e(f.type)}</div></div></div>
<div class="box"><div class="lbl">${L('Cliente', 'Client')}</div><div class="cl"><div><div class="nm">${e(f.client)}</div><div>${L('Lugar', 'Place')}: ${e(f.place)}</div><div>${L('Requisiciones / solicitudes', 'Requisitions / requests')}: ${e(f.requisitions)}</div></div>
<div class="r"><div>${L('Aceptación', 'Acceptance')}: ${e(f.acceptance)}</div><div>OC: ${e(f.ocs)}</div><div class="muted">${L('Recepción', 'Receipt')}: ${e(f.receipts)}</div></div></div></div>
<table><thead><tr><th>${L('Req./Sol.', 'Req./Req.')}</th><th>OC</th><th>Item</th><th>${L('Descripción', 'Description')}</th><th>${L('Unidad', 'Unit')}</th><th>${L('Solicitado', 'Requested')}</th><th>${L('Entregado', 'Delivered')}</th><th>${L('Saldo', 'Balance')}</th></tr></thead><tbody>${rows}</tbody></table>
<div class="box"><div class="lbl">${L('Evidencia / observaciones', 'Evidence / notes')}</div><div>${e(f.evidence)}</div></div>
<div class="sigs">${f.signers.map(signer).join('')}</div>
<div class="box ctl"><div class="lbl">${L('Control electrónico e integridad', 'Electronic control and integrity')}</div>
<div class="id">${L('ID de control', 'Control ID')}: ${e(f.control.id)}</div>
<div>${f.control.signedAt ? `${L('Firmado', 'Signed')}: ${e(f.control.signedAt)} · ${L('Método', 'Method')}: ${e(f.control.method || '—')}` : L('Sin firma registrada.', 'No signature recorded.')}</div>
<div class="mono">${L('SHA-256 expediente', 'Record SHA-256')}: ${e(f.control.hash || '—')}</div>
<div class="${f.locked ? '' : 'warn'}">${f.locked ? L('Documento firmado y bloqueado.', 'Signed and locked document.') : L('Registro sin bloqueo de firma.', 'Record not signature-locked.')}</div></div>
<div class="foot">${e(PO_FORMAT.company)} · ${e(PO_FORMAT.address)} · ${e(PO_FORMAT.site)}</div>
</body></html>`;
}

const NAVY = [30, 56, 92]; const ORANGE = [234, 88, 12]; const INK = [15, 23, 42]; const GRAY = [100, 116, 139]; const LINE = [148, 163, 184]; const SOFT = [248, 250, 252]; const BLUE = [29, 78, 216];

/** PDF of the format (jsPDF injected so the module stays testable in Node). `logo`: PNG data URL or null. */
export function buildDeliveryPdf(JsPDF, d, en = false, logo = null) {
  const f = formatModel(d, en);
  const L = (es, e) => (en ? e : es);
  const doc = new JsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const M = 36; const CW = W - 2 * M; let y = M;
  const font = (size, style = 'normal', color = INK) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };
  const room = h => { if (y + h > H - 48) { doc.addPage(); y = M; } };
  doc.setProperties({ title: `${L('Formato de entrega', 'Delivery format')} ${f.folio}`, subject: PO_FORMAT.company, creator: 'SupplyFlow' });

  // Encabezado: logotipo Grupo Gerez, título y folio
  if (logo) { try { doc.addImage(logo, 'PNG', M, y, 40, 40); } catch { /* logotipo opcional */ } }
  font(13, 'bold', ORANGE); doc.text(PO_FORMAT.company, M + 46, y + 18);
  font(5.8, 'bold', GRAY); doc.text(PO_FORMAT.tagline, M + 46, y + 27);
  font(16, 'bold'); doc.text(L('FORMATO DE ENTREGA', 'DELIVERY FORMAT'), W / 2 + 20, y + 18, { align: 'center' });
  font(7.5, 'normal', NAVY); doc.text(`DELIVERY NOTE / ${L('EVIDENCIA DE ENTREGA', 'DELIVERY EVIDENCE')}`, W / 2 + 20, y + 30, { align: 'center' });
  font(10, 'bold', BLUE); doc.text(f.folio, W - M, y + 10, { align: 'right' });
  font(7.5, 'normal', GRAY); doc.text(`${L('Fecha', 'Date')}: ${f.date}`, W - M, y + 23, { align: 'right' }); doc.text(`${L('Tipo', 'Type')}: ${f.type}`, W - M, y + 34, { align: 'right' });
  y += 48; doc.setFillColor(...NAVY); doc.rect(M, y, CW, 2.6, 'F'); y += 14;

  // Cliente
  const leftLines = [...doc.splitTextToSize(`${L('Lugar', 'Place')}: ${f.place}`, CW * 0.6), ...doc.splitTextToSize(`${L('Requisiciones / solicitudes', 'Requisitions / requests')}: ${f.requisitions}`, CW * 0.6)];
  const rightLines = [`${L('Aceptación', 'Acceptance')}: ${f.acceptance}`, ...doc.splitTextToSize(`OC: ${f.ocs}`, CW * 0.34)];
  const ch = 34 + Math.max(leftLines.length, rightLines.length) * 10;
  doc.setFillColor(...SOFT); doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.rect(M, y, CW, ch, 'FD');
  font(7, 'bold', NAVY); doc.text(L('CLIENTE', 'CLIENT'), M + 9, y + 12);
  font(10.5, 'bold'); doc.text(doc.splitTextToSize(f.client, CW * 0.6)[0], M + 9, y + 25);
  font(7.5, 'normal', GRAY); doc.text(leftLines, M + 9, y + 37);
  font(7.5, 'bold'); doc.text(rightLines, W - M - 9, y + 25, { align: 'right' });
  y += ch + 12;

  // Partidas
  const cols = [[L('REQ./SOL.', 'REQ.'), 0.2, 'left'], ['OC', 0.12, 'left'], ['ITEM', 0.05, 'center'], [L('DESCRIPCIÓN', 'DESCRIPTION'), 0.28, 'left'], [L('UNIDAD', 'UNIT'), 0.07, 'center'], [L('SOLICITADO', 'REQUESTED'), 0.09, 'right'], [L('ENTREGADO', 'DELIVERED'), 0.1, 'right'], [L('SALDO', 'BALANCE'), 0.09, 'right']];
  const cellFont = i => font(i === 1 ? 6.8 : i === 0 ? 7.2 : 7.8, i === 6 ? 'bold' : 'normal');
  // Long tokens without spaces (folios) are cut by measured width so they never invade the next column.
  const fit = (text, w) => doc.splitTextToSize(String(text), w).flatMap(line => { const out = []; let cur = ''; for (const ch of line) { if (cur && doc.getTextWidth(cur + ch) > w) { out.push(cur); cur = ch; } else cur += ch; } return [...out, cur]; });
  const xs = []; let cx = M; cols.forEach(c => { xs.push(cx); cx += c[1] * CW; });
  const head = () => {
    doc.setFillColor(226, 232, 240); doc.setDrawColor(...LINE); doc.rect(M, y, CW, 20, 'FD');
    font(6.5, 'bold'); cols.forEach((c, i) => { const w = c[1] * CW; const tx = c[2] === 'right' ? xs[i] + w - 4 : c[2] === 'center' ? xs[i] + w / 2 : xs[i] + 4; doc.text(c[0], tx, y + 13, { align: c[2] }); if (i) doc.line(xs[i], y, xs[i], y + 20); });
    y += 20;
  };
  head();
  const rows = f.rows.length ? f.rows : [{ req: '', oc: '', item: '', desc: L('Sin partidas registradas.', 'No lines recorded.'), unit: '', requested: '', delivered: '', balance: '' }];
  rows.forEach(r => {
    const cells = [r.req, r.oc, r.item, r.desc, r.unit, r.requested, r.delivered, r.balance].map((v, i) => { cellFont(i); return fit(v, cols[i][1] * CW - 8); });
    const h = Math.max(22, Math.max(...cells.map(c => c.length)) * 9 + 12);
    if (y + h > H - 48) { doc.addPage(); y = M; head(); }
    doc.setDrawColor(...LINE); doc.rect(M, y, CW, h, 'S');
    cells.forEach((c, i) => { const w = cols[i][1] * CW; const tx = cols[i][2] === 'right' ? xs[i] + w - 4 : cols[i][2] === 'center' ? xs[i] + w / 2 : xs[i] + 4; cellFont(i); doc.text(c, tx, y + 13, { align: cols[i][2] }); if (i) doc.line(xs[i], y, xs[i], y + h); });
    y += h;
  });
  y += 12;

  // Evidencia / observaciones
  const ev = doc.splitTextToSize(f.evidence, CW - 18); const eh = 24 + ev.length * 10;
  room(eh); doc.setFillColor(...SOFT); doc.setDrawColor(...LINE); doc.rect(M, y, CW, eh, 'FD');
  font(7, 'bold', NAVY); doc.text(L('EVIDENCIA / OBSERVACIONES', 'EVIDENCE / NOTES'), M + 9, y + 12); font(7.8, 'normal'); doc.text(ev, M + 9, y + 24); y += eh + 12;

  // Firmas
  room(124); const sw = (CW - 16) / 2;
  f.signers.forEach((s, i) => {
    const x = M + i * (sw + 16); const mid = x + sw / 2;
    doc.setDrawColor(...LINE); doc.rect(x, y, sw, 116, 'S');
    font(7, 'bold', NAVY); doc.text(s.title, mid, y + 13, { align: 'center' });
    if (s.sig) {
      font(7.5, 'bold', [4, 120, 87]); doc.text(doc.splitTextToSize(s.sig.text, sw - 24), mid, y + 34, { align: 'center' });
      font(6.5, 'normal', GRAY); doc.text(doc.splitTextToSize(`${s.sig.when}${s.sig.method ? ` · ${s.sig.method}` : ''}`, sw - 24), mid, y + 52, { align: 'center' });
      if (s.sig.hash) { font(6, 'normal', GRAY); doc.text(`SHA-256 ${s.sig.hash.slice(0, 16)}…`, mid, y + 62, { align: 'center' }); }
    } else { font(7, 'italic', GRAY); doc.text(`[ ${L('Sin firma registrada', 'No signature recorded')} ]`, mid, y + 46, { align: 'center' }); }
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.7); doc.line(x + 24, y + 78, x + sw - 24, y + 78); doc.setLineWidth(0.6);
    font(8, 'bold'); doc.text(doc.splitTextToSize(s.name, sw - 24)[0], mid, y + 92, { align: 'center' });
    font(6.5, 'normal', GRAY); doc.text(doc.splitTextToSize(s.position || '—', sw - 24)[0], mid, y + 103, { align: 'center' });
  });
  y += 128;

  // Control electrónico e integridad
  const hashLines = doc.splitTextToSize(`${L('SHA-256 expediente', 'Record SHA-256')}: ${f.control.hash || '—'}`, CW - 18);
  const kh = 62 + hashLines.length * 9;
  room(kh); doc.setFillColor(...SOFT); doc.setDrawColor(...LINE); doc.rect(M, y, CW, kh, 'FD');
  font(7, 'bold', NAVY); doc.text(L('CONTROL ELECTRÓNICO E INTEGRIDAD', 'ELECTRONIC CONTROL AND INTEGRITY'), M + 9, y + 12);
  font(7, 'normal', BLUE); doc.text(`${L('ID de control', 'Control ID')}: ${f.control.id}`, M + 9, y + 25);
  font(7, 'normal'); doc.text(doc.splitTextToSize(f.control.signedAt ? `${L('Firmado', 'Signed')}: ${f.control.signedAt} · ${L('Método', 'Method')}: ${f.control.method || '—'}` : L('Sin firma registrada.', 'No signature recorded.'), CW - 18), M + 9, y + 36);
  font(6.5, 'normal', GRAY); doc.text(hashLines, M + 9, y + 47);
  font(7, 'bold', f.locked ? [4, 120, 87] : [180, 83, 9]); doc.text(f.locked ? L('Documento firmado y bloqueado.', 'Signed and locked document.') : L('Registro sin bloqueo de firma.', 'Record not signature-locked.'), M + 9, y + 50 + hashLines.length * 9);

  // Pie: Grupo Gerez y paginación
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg); font(6.8, 'normal', [148, 163, 184]);
    doc.text(`${PO_FORMAT.company} · ${PO_FORMAT.address}`, W / 2, H - 22, { align: 'center' });
    if (pages > 1) doc.text(`${pg}/${pages}`, W - M, H - 22, { align: 'right' });
  }
  return doc;
}
