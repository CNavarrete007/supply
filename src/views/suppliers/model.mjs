// Proveedores · lógica pura (sin red). La importación es una VISTA PREVIA local: no guarda nada.
// Reglas del diseño original: coincidencia por No. de proveedor, Clave, RFC y razón social; los
// registros incompletos quedarían "En evaluación"; categoría vacía → "Pendiente de actualizar".
import { normalizeHeader, splitMulti } from '../clients/model.mjs';

export { normalizeHeader, splitMulti };

const ALIASES = {
  code: ['provider number', 'supplier number', 'vendor number', 'no de proveedor', 'numero de proveedor', 'no proveedor', 'codigo', 'codigo proveedor'],
  key: ['clave', 'supplier key', 'clave proveedor', 'key'],
  name: ['legal company name', 'legal name', 'company name', 'razon social', 'razon social legal company name'],
  brand: ['brand name', 'nombre comercial', 'trade name', 'marca'],
  rfc: ['rfc', 'tax id', 'rfc tax id', 'id fiscal'],
  category: ['category', 'categoria'],
  currency: ['currency', 'moneda', 'moneda habitual'],
};
const MULTI = {
  emails: /^(email|e mail|correo|correo electronico)( \d+)?$/,
  contacts: /^(contact|contacto)( \d+)?$/,
  phones: /^(phone|telefono|tel)( \d+)?$/,
};

export function mapSupplierHeaders(headers = []) {
  const map = { code: -1, key: -1, name: -1, brand: -1, rfc: -1, category: -1, currency: -1, emails: [], contacts: [], phones: [] };
  const unknown = [];
  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    const single = Object.entries(ALIASES).find(([, list]) => list.includes(n));
    if (single && map[single[0]] === -1) { map[single[0]] = i; return; }
    const multi = Object.entries(MULTI).find(([, re]) => re.test(n));
    if (multi) { map[multi[0]].push(i); return; }
    unknown.push(String(h ?? ''));
  });
  return { map, unknown, recognized: headers.length - unknown.length };
}

/** Comparison key: case, accents, punctuation and spacing are ignored (e.g. "Aceros, S.A." = "ACEROS SA"). */
export const matchKey = v => normalizeHeader(v).replace(/ /g, '');
const cell = (row, i) => (i >= 0 && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CURRENCIES = ['MXN', 'USD', 'EUR'];

/** Index of existing suppliers by the four matching fields of the original rule. */
export function supplierIndex(existing = []) {
  const idx = { code: new Map(), key: new Map(), rfc: new Map(), name: new Map() };
  for (const s of existing) {
    for (const [field, value] of [['code', s.code], ['key', s.supplier_key], ['rfc', s.tax_id], ['name', s.name]]) {
      const k = matchKey(value);
      if (k && !idx[field].has(k)) idx[field].set(k, s);
    }
  }
  return idx;
}

/**
 * Outcomes: new | new_incomplete | existing_skip | existing_update | duplicate_in_file
 * opts: { defaultCategory, defaultCurrency, duplicateMode: 'skip'|'update', newStatus }
 */
export function analyzeSupplierImport(headers = [], rows = [], existing = [], opts = {}) {
  const { map, unknown, recognized } = mapSupplierHeaders(headers);
  const idx = supplierIndex(existing);
  const seen = { code: new Set(), key: new Set(), rfc: new Set(), name: new Set() };
  const defaultCategory = String(opts.defaultCategory || '').trim();
  const out = [];
  rows.forEach((row, i) => {
    if (!Array.isArray(row) || !row.some(c => String(c ?? '').trim() !== '')) return;
    const r = {
      n: i + 1, code: cell(row, map.code), key: cell(row, map.key), name: cell(row, map.name), brand: cell(row, map.brand), rfc: cell(row, map.rfc),
      category: cell(row, map.category) || defaultCategory, currency: (cell(row, map.currency) || String(opts.defaultCurrency || 'MXN')).toUpperCase(),
      emails: [...new Set(map.emails.flatMap(c => splitMulti(row[c])))],
      contacts: [...new Set(map.contacts.flatMap(c => splitMulti(row[c])))],
      phones: [...new Set(map.phones.flatMap(c => splitMulti(row[c])))],
      issues: [], matchedBy: null, matched: null,
    };
    if (!r.code) r.issues.push('code');
    if (!r.name) r.issues.push('name');
    if (!r.category) { r.issues.push('category'); r.category = ''; }
    if (!CURRENCIES.includes(r.currency)) r.issues.push('currency');
    if (r.emails.some(e => !EMAIL.test(e))) r.issues.push('email');
    const keys = { code: matchKey(r.code), key: matchKey(r.key), rfc: matchKey(r.rfc), name: matchKey(r.name) };
    const repeated = Object.entries(keys).find(([f, k]) => k && seen[f].has(k));
    const found = Object.entries(keys).find(([f, k]) => k && idx[f].has(k));
    if (repeated) { r.outcome = 'duplicate_in_file'; r.matchedBy = repeated[0]; }
    else if (found) { r.outcome = opts.duplicateMode === 'update' ? 'existing_update' : 'existing_skip'; r.matchedBy = found[0]; r.matched = idx[found[0]].get(found[1]); }
    else r.outcome = r.issues.length ? 'new_incomplete' : 'new';
    r.statusIfSaved = r.outcome === 'new_incomplete' ? 'under_evaluation' : r.outcome === 'new' ? (opts.newStatus || 'under_evaluation') : null;
    for (const [f, k] of Object.entries(keys)) if (k) seen[f].add(k);
    out.push(r);
  });
  const counts = { total: out.length, new: 0, new_incomplete: 0, existing_skip: 0, existing_update: 0, duplicate_in_file: 0 };
  for (const r of out) counts[r.outcome]++;
  return { rows: out, counts, unknown, recognized, map };
}

export const SUPPLIER_TEMPLATE_HEADERS = ['Provider number', 'Clave', 'Legal / company name', 'Brand name', 'RFC', 'Email', 'Email 2', 'Contact', 'Contact 2', 'Phone', 'Category', 'Currency'];

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fmt = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
export const leadTime = s => (num(s?.lead_time_value) === null ? '' : `${fmt(num(s.lead_time_value))} ${s.lead_time_unit || ''}`.trim());
export const credit = (s, en = false) => [s?.credit_type, num(s?.credit_days) !== null ? `${num(s.credit_days)} ${en ? 'days' : 'días'}` : ''].filter(Boolean).join(' · ');
export const ratingText = (s, scale) => (num(s?.rating) === null ? '' : `${fmt(num(s.rating))}${scale ? ` / ${scale}` : ''}`);

/** Indicators over the COMPLETE supplier list (all pages) plus the server summary. */
export function supplierIndicators(summary, all = []) {
  const statuses = (summary?.statuses || []).map(s => ({ code: s.code, count: Number(s.count) || 0 }));
  const count = (...codes) => statuses.filter(s => codes.includes(s.code)).reduce((n, s) => n + s.count, 0);
  const ratings = all.map(s => num(s.rating)).filter(v => v !== null);
  const cats = new Map();
  for (const s of all) { const c = s.category || 'Sin categoría'; cats.set(c, (cats.get(c) || 0) + 1); }
  return {
    total: Number(summary?.total || 0), authorized: count('authorized'), evaluation: count('evaluation', 'under_evaluation'), suspended: count('suspended'),
    incomplete: Number(summary?.incomplete || 0), statuses,
    rated: ratings.length, avgRating: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null,
    offerings: all.reduce((n, s) => n + (Number(s.offerings_count) || 0), 0), withOfferings: all.filter(s => Number(s.offerings_count) > 0).length,
    categories: [...cats.entries()].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')),
    complete: all.length === Number(summary?.total || 0),
  };
}
