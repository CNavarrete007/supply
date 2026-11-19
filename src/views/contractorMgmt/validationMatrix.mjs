// Gestión del Contratista · tarjeta 3 "Matriz de validaciones internas" · lógica pura (sin red).
// Datos: GET /api/v1/contractor-management/validations (validaciones de requisition_reviews con requisición, responsable,
// resultados, estrategia y "¿puede cotizar?"; tarjetas por responsable). Editar, eliminar y registrar la fuente de costo
// son escrituras sin endpoint: se validan y se informa que no se guardaron.

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const SOLE_SOURCE = 'Fuente única justificada';
export const PAGE_SIZES = [10, 25, 50];
export const CURRENCIES = ['MXN', 'USD', 'EUR'];

export const initials = n => clean(n).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '—';

/** Header chip: "6 responsable(s) · 34 validación(es)". */
export const matrixChip = (summary, en = false) => {
  const b = (summary?.buyers || []).length; const v = Number(summary?.validations) || 0;
  return en ? `${b} manager(s) · ${v} validation(s)` : `${b} responsable(s) · ${v} validación(es)`;
};

/** Cards by purchasing manager, "Todas las validaciones" first. */
export function buyerCards(summary, en = false) {
  const m = (es, e) => (en ? e : es);
  const all = { key: 'all', badge: 'TOD', name: m('Todas las validaciones', 'All validations'), sub: m('Vista general', 'Overview'), total: Number(summary?.validations) || 0, can: Number(summary?.can_quote) || 0, blocked: Number(summary?.blocked) || 0, foot: m('Abrir todas', 'Open all') };
  return [all, ...(summary?.buyers || []).map(b => ({ key: b.key, badge: b.key === 'unassigned' ? '—' : initials(b.name), name: b.key === 'unassigned' ? m('Sin responsable', 'No manager') : clean(b.name).toUpperCase(),
    sub: m('Responsable de compras', 'Purchasing manager'), total: b.total, can: b.can_quote, blocked: b.blocked, foot: m('Abrir responsable', 'Open manager') }))];
}

const tone = v => (/^(conforme|disponible|compliant|available)$/.test(fold(v)) ? 'green' : /^(no conforme|no disponible|non-compliant|not available)$/.test(fold(v)) ? 'red' : /^(pendiente|pending)$/.test(fold(v)) ? 'gray' : 'amber');

/** Display model of a row (columns of the design). */
export function matrixRow(x, en = false) {
  const m = (es, e) => (en ? e : es);
  return {
    id: x?.id, folio: clean(x?.folio), folioSub: [clean(x?.created_at).slice(0, 10), x?.latest === false ? m('Histórica (sustituida)', 'Historical (superseded)') : ''].filter(Boolean).join(' · '),
    requisition: clean(x?.requisition), requisitionSub: [clean(x?.client_reference), clean(x?.client_name)].filter(Boolean).join(' · '),
    reference: clean(x?.internal_reference) || '—', buyer: clean(x?.buyer).toUpperCase() || m('SIN RESPONSABLE', 'NO MANAGER'),
    technical: { text: clean(x?.technical) || '—', tone: tone(x?.technical) }, contract: { text: clean(x?.contract) || '—', tone: tone(x?.contract) }, budget: { text: clean(x?.budget) || '—', tone: tone(x?.budget) },
    strategy: clean(x?.strategy) || '—', sole: fold(x?.strategy) === fold(SOLE_SOURCE), canQuote: x?.can_quote ? { text: m('Sí', 'Yes'), tone: 'green' } : { text: m('No (Bloqueado)', 'No (Blocked)'), tone: 'red' },
  };
}

/** Why a validation cannot be deleted; null when the confirmation dialog applies. */
export function deleteBlock(x, en = false) {
  const m = (es, e) => (en ? e : es);
  if (x?.imported) return m(`No se elimina ${x.folio}: es una validación importada del sistema original y se conserva como expediente.`, `${x?.folio} is not deleted: it is a validation imported from the original system and is kept as a record.`);
  const down = [[x?.rfq_count, 'RFQ'], [x?.quote_count, m('cotización(es)', 'quote(s)')], [x?.po_count, 'OC']].filter(([n]) => Number(n) > 0).map(([n, t]) => `${n} ${t}`);
  if (x?.latest !== false && down.length) return m(`No se elimina ${x.folio}: es la validación vigente de ${x.requisition}, que ya tiene ${down.join(', ')}; se conserva como soporte de esos documentos.`, `${x.folio} is not deleted: it is the current validation of ${x.requisition}, which already has ${down.join(', ')}; it is kept as support of those documents.`);
  return null;
}

export function deleteError(x, folio, reason, en = false) {
  const m = (es, e) => (en ? e : es);
  if (clean(folio).toUpperCase() !== clean(x?.folio).toUpperCase()) return m(`Escribe el folio ${x?.folio} para confirmar.`, `Type the folio ${x?.folio} to confirm.`);
  if (clean(reason).length < 10) return m('Indica el motivo de la eliminación (mínimo 10 caracteres).', 'Enter the deletion reason (minimum 10 characters).');
  if (clean(reason).length > 500) return m('Máximo 500 caracteres.', 'Maximum 500 characters.');
  return '';
}
export const deleteLockedText = (x, en = false) => (en
  ? `Data validated, but ${x?.folio} was not deleted: deleting internal validations is a write blocked until authorized.`
  : `Datos validados, pero no se eliminó ${x?.folio}: eliminar validaciones internas es una escritura bloqueada hasta su autorización.`);

/** "Editar": values for card 1 in edit mode. */
export const editPreset = x => ({ id: x.id, folio: clean(x.folio), requisition: x.requisition_id, buyer: x.buyer_person_id || '', buyerName: clean(x.buyer), technical: clean(x.technical), contract: clean(x.contract),
  budget: clean(x.budget), strategy: clean(x.strategy), minQuotes: String(x.min_quotes ?? ''), deadline: clean(x.deadline).slice(0, 10), criteria: clean(x.criteria), notes: clean(x.notes) });

/** "Registrar fuente de costo" (sole source): cost per line, currency and the documented source of the cost. */
export const emptyCostSource = (lines = []) => ({ source: '', notes: '', lines: Object.fromEntries(lines.map(l => [l.line_number, { cost: '', currency: 'MXN' }])) });

export function validateCostSource(f, lines = [], en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const lineErrors = {};
  if (clean(f.source).length < 5) errors.source = m('Describe la fuente del costo (mínimo 5 caracteres): cotización única, lista de precios, contrato, precio histórico...', 'Describe the cost source (minimum 5 characters): single quote, price list, contract, historical price...');
  else if (clean(f.source).length > 255) errors.source = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  if (clean(f.notes).length > 1000) errors.notes = m('Máximo 1000 caracteres.', 'Maximum 1000 characters.');
  let n = 0;
  for (const l of lines) {
    const v = f.lines?.[l.line_number] || {}; const raw = clean(v.cost);
    if (!raw) continue;
    if (!/^\d{1,14}(\.\d{1,6})?$/.test(raw) || Number(raw) <= 0) lineErrors[l.line_number] = m('Costo inválido (mayor a 0, hasta 6 decimales).', 'Invalid cost (greater than 0, up to 6 decimals).');
    else if (!CURRENCIES.includes(v.currency)) lineErrors[l.line_number] = m('Moneda inválida.', 'Invalid currency.');
    else n += 1;
  }
  if (Object.keys(lineErrors).length) errors.lines = m('Revisa los costos marcados.', 'Check the marked costs.');
  else if (!n) errors.lines = m('Captura el costo de al menos una partida.', 'Enter the cost of at least one line.');
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, lineErrors, captured: n, first: keys.length ? errors[keys[0]] : '' };
}

export function costSourceLockedText(x, f, lines = [], en = false) {
  const n = lines.filter(l => clean(f.lines?.[l.line_number]?.cost)).length;
  return en
    ? `Data validated, but the cost source of ${clean(x?.requisition)} (${clean(x?.folio)}) was not recorded (${n} line(s), source: ${clean(f.source)}): recording costs is a commercial write blocked until authorized.`
    : `Datos validados, pero no se registró la fuente de costo de ${clean(x?.requisition)} (${clean(x?.folio)}; ${n} partida(s), fuente: ${clean(f.source)}): registrar costos es una escritura comercial bloqueada hasta su autorización.`;
}

/** "1-10 de 34 registros". */
export function rangeText(data, en = false) {
  const t = Number(data?.total) || 0; const p = Number(data?.page) || 1; const s = Number(data?.page_size) || 10;
  const a = t ? (p - 1) * s + 1 : 0; const b = Math.min(t, p * s);
  return en ? `${a}-${b} of ${t} records` : `${a}-${b} de ${t} registros`;
}
