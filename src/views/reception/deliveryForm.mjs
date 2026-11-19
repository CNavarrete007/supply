// Recepción y Entrega · tarjeta 2 "Formato de entrega al cliente" · lógica pura (sin red).
// Datos: GET /reception/deliverable (clientes con material recibido; por requisición y partida: solicitado, recibido,
// entregado y saldo). Registrar la entrega, sus firmas y fotografías es una escritura operativa sin endpoint: el formato se
// valida por completo, se calcula la huella SHA-256 de su contenido y "Guardar y firmar formato" informa que no se guardó.

export const DELIVERY_TYPES = [['partial', 'Parcial', 'Partial'], ['complete', 'Completa', 'Complete']];
export const ACCEPTANCE = [['partial_open', 'Recibido parcial sin cierre', 'Partially received, not closed'], ['accepted', 'Aceptado de conformidad', 'Accepted in conformity'],
  ['accepted_obs', 'Aceptado con observaciones', 'Accepted with observations'], ['rejected', 'Rechazado / devuelto', 'Rejected / returned']];

const clean = v => String(v ?? '').trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = v => ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const r6 = n => Math.round(n * 1e6) / 1e6;
const label = (list, v, en) => { const x = list.find(r => r[0] === v); return x ? (en ? x[2] : x[1]) : clean(v); };

export const emptyDelivery = (today = '') => ({
  client: '', type: 'partial', date: today, place: '', acceptance: 'partial_open', requisitions: [], qty: {}, evidence: '', notes: '', photos: [],
  deliverer: '', delivererPosition: '', receiver: '', receiverPosition: '', receiverCompany: '', receiverEmail: '',
  sigDeliverer: null, sigReceiver: null, consentDeliverer: false, consentReceiver: false,
});

/** Requisition card summary: items, received, delivered and available lines. */
export function requisitionSummary(r) {
  const items = r?.items || [];
  return { items: items.length, received: items.filter(i => i.received > 0).length, delivered: items.filter(i => i.delivered > 0).length, available: items.filter(i => i.available > 0).length,
    availableQty: r6(items.reduce((n, i) => n + (Number(i.available) || 0), 0)) };
}

/** Lines that can be delivered from the selected requisitions (available balance > 0). */
export function deliverableLines(reqs = [], selected = []) {
  return reqs.filter(r => selected.includes(r.id)).flatMap(r => (r.items || []).filter(i => i.available > 0).map(i => ({ ...i, requisition_id: r.id, requisition: r.folio, key: `${r.id}:${i.id}` })));
}

/** Completa: every available balance of the selected requisitions; Parcial keeps the captured quantities. */
export function quantitiesFor(type, lines = [], current = {}) {
  if (type === 'complete') return Object.fromEntries(lines.map(l => [l.key, String(l.available)]));
  return Object.fromEntries(Object.entries(current).filter(([k]) => lines.some(l => l.key === k)));
}

/** Lines actually included (quantity captured > 0). */
export const includedLines = (lines = [], qty = {}) => lines.filter(l => clean(qty[l.key]) !== '' && Number(qty[l.key]) > 0);

/** { ok, errors, warnings, first, lineErrors }. ctx: { reqs, today, safeSig(url) }. */
export function validateDelivery(f, { reqs = [], today = '', safeSig = v => !!v } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = []; const lineErrors = {};
  if (!f.client) errors.client = m('Selecciona el cliente.', 'Select the client.');
  if (!DELIVERY_TYPES.some(t => t[0] === f.type)) errors.type = m('Selecciona el tipo de entrega.', 'Select the delivery type.');
  if (!f.date) errors.date = m('Indica la fecha de entrega.', 'Enter the delivery date.');
  else if (!validDate(f.date)) errors.date = m('Fecha inválida.', 'Invalid date.');
  else if (today && f.date > today) errors.date = m('La fecha de entrega no puede ser futura.', 'The delivery date cannot be in the future.');
  if (!clean(f.place)) errors.place = m('Indica el lugar de entrega.', 'Enter the delivery place.');
  else if (clean(f.place).length > 255) errors.place = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  if (!ACCEPTANCE.some(a => a[0] === f.acceptance)) errors.acceptance = m('Selecciona la aceptación o condición de recepción.', 'Select the acceptance or receipt condition.');
  else if (f.type === 'complete' && f.acceptance === 'partial_open') errors.acceptance = m('Una entrega completa no puede quedar como "Recibido parcial sin cierre".', 'A complete delivery cannot stay as "Partially received, not closed".');
  if (f.client && !(f.requisitions || []).length) errors.requisitions = m('Selecciona una o varias requisiciones/solicitudes del cliente.', 'Select one or more requisitions/requests of the client.');
  const lines = deliverableLines(reqs, f.requisitions || []);
  const inc = includedLines(lines, f.qty || {});
  for (const l of lines) {
    const raw = clean((f.qty || {})[l.key]);
    if (raw === '') continue;
    const n = /^\d{1,12}(\.\d{1,6})?$/.test(raw) ? Number(raw) : null;
    if (n === null || n < 0) lineErrors[l.key] = m('Cantidad inválida.', 'Invalid quantity.');
    else if (n > l.available + 1e-9) lineErrors[l.key] = m(`Excede el saldo disponible (${l.available}).`, `Exceeds the available balance (${l.available}).`);
  }
  if ((f.requisitions || []).length && !lines.length) errors.items = m('Las requisiciones seleccionadas no tienen saldo disponible para entregar.', 'The selected requisitions have no available balance to deliver.');
  else if ((f.requisitions || []).length && !inc.length) errors.items = m('Captura la cantidad a entregar de al menos una partida.', 'Enter the quantity to deliver of at least one line.');
  else if (Object.keys(lineErrors).length) errors.items = m('Revisa las cantidades marcadas en las partidas.', 'Check the quantities marked in the lines.');
  else if (f.type === 'complete' && inc.length && lines.some(l => Math.abs((Number((f.qty || {})[l.key]) || 0) - l.available) > 1e-9)) errors.items = m('En entrega completa se entregan todos los saldos disponibles.', 'A complete delivery delivers every available balance.');
  if (clean(f.evidence).length > 255) errors.evidence = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  if (clean(f.notes).length > 2000) errors.notes = m('Máximo 2000 caracteres.', 'Maximum 2000 characters.');
  else if (['accepted_obs', 'rejected'].includes(f.acceptance) && clean(f.notes).length < 10) errors.notes = m('Describe las observaciones o el motivo del rechazo (mínimo 10 caracteres).', 'Describe the observations or the rejection reason (minimum 10 characters).');
  if ((f.photos || []).length > 8) errors.photos = m('Máximo 8 fotografías.', 'Maximum 8 photos.');
  for (const [k, es, e2] of [['deliverer', 'Indica quién entregó por el contratista.', 'Enter who delivered for the contractor.'], ['delivererPosition', 'Indica el puesto de quien entrega.', 'Enter the position of who delivers.'],
    ['receiver', 'Indica quién recibió por el cliente.', 'Enter who received for the client.'], ['receiverPosition', 'Indica el puesto de quien recibe.', 'Enter the position of who receives.']]) {
    if (!clean(f[k])) errors[k] = m(es, e2);
    else if (clean(f[k]).length > 128) errors[k] = m('Máximo 128 caracteres.', 'Maximum 128 characters.');
  }
  if (!errors.deliverer && !errors.receiver && fold(f.deliverer) === fold(f.receiver)) errors.receiver = m('Quien entrega y quien recibe deben ser personas distintas.', 'Whoever delivers and whoever receives must be different people.');
  if (clean(f.receiverCompany).length > 255) errors.receiverCompany = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  if (clean(f.receiverEmail) && !EMAIL.test(clean(f.receiverEmail))) errors.receiverEmail = m('Correo inválido.', 'Invalid email.');
  if (!safeSig(f.sigDeliverer)) errors.sigDeliverer = m('Falta la firma de quien entrega.', 'The deliverer signature is missing.');
  else if (!f.consentDeliverer) errors.sigDeliverer = m('Quien entrega debe confirmar su firma electrónica.', 'The deliverer must confirm the electronic signature.');
  if (!safeSig(f.sigReceiver)) errors.sigReceiver = m('Falta la firma de quien recibe.', 'The receiver signature is missing.');
  else if (!f.consentReceiver) errors.sigReceiver = m('Quien recibe debe confirmar su firma electrónica.', 'The receiver must confirm the electronic signature.');
  if (!(f.photos || []).length) warnings.push(m('Sin fotografías de entrega (opcional).', 'No delivery photos (optional).'));
  if (!clean(f.evidence)) warnings.push(m('Sin folio de remisión, packing list o acuse.', 'No delivery note, packing list or acknowledgment number.'));
  if (f.type === 'partial' && inc.some(l => Number(f.qty[l.key]) < l.available - 1e-9)) warnings.push(m('Entrega parcial: quedará saldo pendiente por entregar en una o varias partidas.', 'Partial delivery: a pending balance will remain on one or more lines.'));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, lineErrors, first: keys.length ? errors[keys[0]] : '' };
}

/** Canonical content of the format (what both signatures would cover); hashed with SHA-256 by the UI. */
export function deliveryCanonical(f, reqs = [], clientName = '') {
  const lines = includedLines(deliverableLines(reqs, f.requisitions || []), f.qty || {});
  return JSON.stringify({ v: 1, client: clean(clientName), type: f.type, date: f.date, place: clean(f.place), acceptance: f.acceptance,
    items: lines.map(l => ({ requisition: l.requisition, line: l.line_number, description: clean(l.description), unit: clean(l.unit_label), quantity: Number(f.qty[l.key]), balance_after: r6(l.available - Number(f.qty[l.key])) })),
    evidence: clean(f.evidence), notes: clean(f.notes), photos: (f.photos || []).length,
    delivered_by: { name: clean(f.deliverer), position: clean(f.delivererPosition) }, received_by: { name: clean(f.receiver), position: clean(f.receiverPosition), company: clean(f.receiverCompany), email: clean(f.receiverEmail) } });
}

/** Message after a valid "Guardar y firmar formato": nothing is written, uploaded or signed. */
export function deliveryLockedText(f, reqs, clientName, hash, en = false) {
  const lines = includedLines(deliverableLines(reqs, f.requisitions || []), f.qty || {});
  const nReq = new Set(lines.map(l => l.requisition)).size;
  const what = en ? `${lines.length} line(s) of ${nReq} requisition(s) for ${clientName}, ${label(DELIVERY_TYPES, f.type, en).toLowerCase()} delivery, ${label(ACCEPTANCE, f.acceptance, en).toLowerCase()}`
    : `${lines.length} partida(s) de ${nReq} requisición(es) de ${clientName}, entrega ${label(DELIVERY_TYPES, f.type, en).toLowerCase()}, ${label(ACCEPTANCE, f.acceptance, en).toLowerCase()}`;
  return en
    ? `Data validated, but the delivery format was neither saved nor signed (${what}): recording deliveries, signatures and photos is an operational write blocked until authorized. SHA-256 of the content that would be signed: ${hash}.`
    : `Datos validados, pero no se guardó ni se firmó el formato de entrega (${what}): registrar entregas, firmas y fotografías es una escritura operativa bloqueada hasta su autorización. Huella SHA-256 del contenido que se firmaría: ${hash}.`;
}

// SHA-256 (FIPS 180-4) en JS puro: funciona también fuera de contextos seguros (http por IP de red local), donde
// crypto.subtle no existe. Entrada: texto (UTF-8). Salida: 64 caracteres hexadecimales.
const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const ror = (x, n) => (x >>> n) | (x << (32 - n));
export function sha256Hex(text) {
  const msg = new TextEncoder().encode(String(text ?? '')); const len = msg.length;
  const n = Math.ceil((len + 9) / 64) * 64; const buf = new Uint8Array(n); buf.set(msg); buf[len] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(n - 8, Math.floor(len / 0x20000000)); dv.setUint32(n - 4, (len * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]); const W = new Uint32Array(64);
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const x = W[i - 15]; const y = W[i - 2]; W[i] = W[i - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + W[i - 7] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10)); }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) >>> 0;
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
}

/** Hashes that bind the format: content (canonical JSON) and each captured signature image. */
export function deliveryHashes(f, reqs = [], clientName = '') {
  return { content: sha256Hex(deliveryCanonical(f, reqs, clientName)), deliverer: f.sigDeliverer ? sha256Hex(f.sigDeliverer) : '', receiver: f.sigReceiver ? sha256Hex(f.sigReceiver) : '' };
}
