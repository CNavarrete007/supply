// Clientes · lógica pura (sin red). La validación de importación es una VISTA PREVIA local:
// no guarda nada; reproduce las reglas descritas en el diseño original para revisar un archivo antes
// de que exista un endpoint de importación con autorización y auditoría en el servidor.

export const STATUS_ES = { active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado' };
export const STATUS_EN = { active: 'Active', inactive: 'Inactive', blocked: 'Blocked' };
export const statusLabel = (code, en) => (en ? STATUS_EN : STATUS_ES)[code] || code || '—';

export function normalizeHeader(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Columnas reconocidas por el diseño original (Client number, Legal / company name, Brand name, RFC,
// Email, Email 2, Email 3, Contact, Contact 2, Contact 3, Project, Contract number) y sus equivalentes en español.
const ALIASES = {
  code: ['client number', 'client no', 'no de cliente', 'numero de cliente', 'no cliente', 'codigo', 'codigo cliente', 'clave'],
  name: ['legal company name', 'legal name', 'company name', 'razon social', 'razon social legal company name'],
  brand: ['brand name', 'nombre comercial', 'commercial name', 'marca'],
  rfc: ['rfc', 'tax id', 'rfc tax id', 'id fiscal'],
  project: ['project', 'proyecto'],
  contract: ['contract number', 'contract', 'numero de contrato', 'no de contrato', 'contrato'],
};
const MULTI = { emails: /^(email|e mail|correo|correo electronico)( \d+)?$/, contacts: /^(contact|contacto)( \d+)?$/ };

export function mapHeaders(headers = []) {
  const map = { code: -1, name: -1, brand: -1, rfc: -1, project: -1, contract: -1, emails: [], contacts: [] };
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

export const splitMulti = v => String(v ?? '').split(/[;,|\n\r]+/).map(x => x.trim()).filter(Boolean);
const cell = (row, i) => (i >= 0 && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param existingCodes iterable of client numbers already in MariaDB
 * @param opts { defaultProject, defaultContract, duplicateMode: 'skip'|'update' }
 * Outcomes: new | new_incomplete | existing_skip | existing_update | duplicate_in_file | empty
 */
export function analyzeImport(headers = [], rows = [], existingCodes = [], opts = {}) {
  const { map, unknown, recognized } = mapHeaders(headers);
  const existing = new Set([...existingCodes].map(c => String(c).trim().toUpperCase()));
  const seen = new Set();
  const out = [];
  rows.forEach((row, idx) => {
    if (!Array.isArray(row) || !row.some(c => String(c ?? '').trim() !== '')) return;
    const r = {
      n: idx + 1, code: cell(row, map.code), name: cell(row, map.name), brand: cell(row, map.brand), rfc: cell(row, map.rfc),
      project: cell(row, map.project) || String(opts.defaultProject || '').trim(),
      contract: cell(row, map.contract) || String(opts.defaultContract || '').trim(),
      emails: [...new Set(map.emails.flatMap(i => splitMulti(row[i])))],
      contacts: [...new Set(map.contacts.flatMap(i => splitMulti(row[i])))],
      issues: [],
    };
    if (!r.code) r.issues.push('code');
    if (!r.name) r.issues.push('name');
    if (!r.project) r.issues.push('project');
    if (!r.contract) r.issues.push('contract');
    if (r.emails.some(e => !EMAIL.test(e))) r.issues.push('email');
    const key = r.code.toUpperCase();
    if (r.code && seen.has(key)) r.outcome = 'duplicate_in_file';
    else if (r.code && existing.has(key)) r.outcome = opts.duplicateMode === 'update' ? 'existing_update' : 'existing_skip';
    else r.outcome = r.issues.length ? 'new_incomplete' : 'new';
    if (r.code) seen.add(key);
    out.push(r);
  });
  const counts = { total: out.length, new: 0, new_incomplete: 0, existing_skip: 0, existing_update: 0, duplicate_in_file: 0 };
  for (const r of out) counts[r.outcome]++;
  return { rows: out, counts, unknown, recognized, map };
}

export const TEMPLATE_HEADERS = ['Client number', 'Legal / company name', 'Brand name', 'RFC', 'Email', 'Email 2', 'Contact', 'Contact 2', 'Project', 'Contract number'];

export function initials(name = '') {
  return String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w && !/^(s|de|del|la|el|y|sa|cv|rl|sab)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '—';
}

/** Indicators from the catalog summary + (optional) a complete list (only when total <= page size). */
export function clientIndicators(summary, fullList, activity = []) {
  const statuses = summary?.statuses || [];
  const count = code => Number(statuses.find(s => s.code === code)?.count || 0);
  const total = Number(summary?.total || 0);
  const complete = Array.isArray(fullList) && fullList.length === total;
  const top = [...activity].filter(a => Number(a.requisitions) > 0).sort((a, b) => b.requisitions - a.requisitions || String(a.name).localeCompare(String(b.name)));
  return {
    total, active: count('active'), inactive: count('inactive'), blocked: count('blocked'), incomplete: Number(summary?.incomplete || 0),
    statuses: statuses.map(s => ({ code: s.code, count: Number(s.count) || 0 })),
    portal: complete ? fullList.filter(c => c.portal_enabled).length : null,
    withRequisitions: top.length, top: top.slice(0, 5),
  };
}

// ---------------- Política de precios y recompra (clients.repeat_*) ----------------
// Los códigos se muestran tal como están guardados en MariaDB. Solo se traducen las etiquetas que aparecen
// en el diseño del sistema original; no se inventan códigos ni opciones adicionales.
const KNOWN_POLICY_LABELS = {
  'precio sujeto a nueva cotizacion': ['Precio sujeto a nueva cotización', 'Price subject to a new quotation'],
  'recotizar proveedores siempre': ['Recotizar proveedores siempre', 'Always re-quote suppliers'],
};
const plain = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** { value, label, known, empty } for a stored policy value. */
export function policyOption(value, en = false) {
  if (value === null || value === undefined || String(value).trim() === '') return { value: '', label: en ? 'No policy recorded' : 'Sin política registrada', known: false, empty: true };
  const k = KNOWN_POLICY_LABELS[plain(value)];
  return { value: String(value), label: k ? k[en ? 1 : 0] : String(value), known: !!k, empty: false };
}

const decimal = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const trimNum = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** View model of the client's repeat-purchase policy (read-only). */
export function repeatPolicyView(p = {}, en = false) {
  const days = p?.price_validity_days;
  const margin = decimal(p?.min_margin_pct);
  const sales = policyOption(p?.sales_policy, en);
  const sourcing = policyOption(p?.sourcing_policy, en);
  return {
    sales, sourcing,
    days: days === null || days === undefined ? '' : String(days),
    daysNote: days === 0 ? (en ? 'No automatic expiry by days' : 'Sin vencimiento automático por días') : days > 0 ? (en ? `Historical price valid for ${days} days` : `Precio histórico vigente por ${days} días`) : '',
    contractReference: p?.contract_reference || '',
    validUntil: p?.contract_valid_until ? String(p.contract_valid_until).slice(0, 10) : '',
    margin: margin === null ? '' : trimNum(margin),
    updatedAt: p?.updated_at || '',
    empty: sales.empty && sourcing.empty && (days === null || days === undefined) && !p?.contract_reference && !p?.contract_valid_until && margin === null,
  };
}
