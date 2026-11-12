// Clientes · formulario de alta/actualización (lógica pura, sin red). La validación aquí solo ayuda al usuario:
// el servidor vuelve a validar todo (ClientInput.php) y es la única autoridad.

// Opciones del diseño original (Política de precios y recompra). Se guardan como códigos de ≤ 32 caracteres.
export const SALES_POLICIES = [
  ['quote_required', 'Precio sujeto a nueva cotización', 'Price subject to a new quotation'],
  ['guaranteed', 'Precio al cliente garantizado', 'Guaranteed client price'],
  ['mixed', 'Mixta / por partida', 'Mixed / per item'],
  ['contract', 'Contrato / Price List / Rate Card', 'Contract / Price List / Rate Card'],
  ['manual', 'Revisión manual', 'Manual review'],
];
export const SOURCING_POLICIES = [
  ['requote_always', 'Recotizar proveedores siempre', 'Always re-quote suppliers'],
  ['validate_history', 'Validar costo/proveedor histórico', 'Validate historical cost/supplier'],
  ['reuse_if_valid', 'Reutilizar proveedor/costo si está vigente', 'Reuse supplier/cost if still valid'],
];
export const STATUSES = [['active', 'Activo', 'Active'], ['inactive', 'Inactivo', 'Inactive'], ['blocked', 'Bloqueado', 'Blocked']];
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const LOGO_MAX_SOURCE_BYTES = 8 * 1024 * 1024;   // archivo elegido (antes de comprimir)
export const LOGO_MAX_BYTES = 400 * 1024;               // límite del servidor tras comprimir

const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Stored policy value → catalog code when it is a known code or its label (legacy label values); else the raw value. */
export function policyCode(value, options) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const v = String(value).trim();
  const hit = options.find(([code, es, en]) => code === v || fold(es) === fold(v) || fold(en) === fold(v));
  return hit ? hit[0] : v;
}
export const policyLabel = (code, options, en = false) => options.find(o => o[0] === code)?.[en ? 2 : 1] ?? code;

const blankRows = (list, min = 2) => [...list, ...Array(Math.max(0, min - list.length)).fill('')];

export function emptyForm() {
  return {
    id: '', version: 0, imported: false, code: '', name: '', brand_name: '', tax_id: '', project: '', contract_reference: '', phone: '',
    contacts: ['', ''], emails: ['', ''], status: 'active', portal_enabled: false, address: '', terms: '', notes: '',
    policy: { sales: '', sourcing: '', days: '', ref: '', until: '', margin: '' }, legacy: { sales: '', sourcing: '' },
    logo: { current: null, next: null, remove: false },
  };
}

/** Form state from GET /api/v1/catalogs/clients/{id} → item. */
export function formFromRecord(it) {
  if (!it) return emptyForm();
  const ch = type => (it.channels || []).filter(c => c.type === type).map(c => c.value);
  const rp = it.repeat_policy || {};
  const sales = policyCode(rp.sales_policy, SALES_POLICIES);
  const sourcing = policyCode(rp.sourcing_policy, SOURCING_POLICIES);
  const margin = rp.min_margin_pct === null || rp.min_margin_pct === undefined || rp.min_margin_pct === '' ? '' : String(Number(rp.min_margin_pct));
  return {
    id: it.id, version: Number(it.version || 1), imported: !!it.imported, code: it.code || '', name: it.name || '', brand_name: it.brand_name || '',
    tax_id: it.tax_id || '', project: it.project || '', contract_reference: it.contract_reference || '', phone: ch('phone').join(' / '),
    contacts: blankRows((it.contacts || []).map(c => c.name)), emails: blankRows(ch('email')),
    status: ['active', 'inactive', 'blocked'].includes(it.status) ? it.status : 'active', portal_enabled: !!it.portal_enabled,
    address: it.address || '', terms: it.terms || '', notes: it.notes || '',
    policy: { sales, sourcing, days: rp.price_validity_days === null || rp.price_validity_days === undefined ? '' : String(rp.price_validity_days), ref: rp.contract_reference || '', until: rp.contract_valid_until ? String(rp.contract_valid_until).slice(0, 10) : '', margin },
    // A stored value outside the catalog is kept untouched unless the user picks another option.
    legacy: { sales: SALES_POLICIES.some(o => o[0] === sales) ? '' : sales, sourcing: SOURCING_POLICIES.some(o => o[0] === sourcing) ? '' : sourcing },
    logo: { current: it.logo || null, next: null, remove: false },
  };
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE = /^[0-9+()\-. extEXT]{3,40}$/;
const CODE = /^[\p{L}\p{N}][\p{L}\p{N}._\-/ ]{0,79}$/u;

/** { ok, errors: {field: message} } — mirrors the server rules for immediate feedback. */
export function validateForm(f, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {};
  const t = v => String(v ?? '').trim();
  if (!t(f.code)) errors.code = m('El número de cliente es obligatorio.', 'Client number is required.');
  else if (!CODE.test(t(f.code))) errors.code = m('Usa letras, números, punto, guion, diagonal o espacio (máx. 80).', 'Use letters, digits, dot, dash, slash or space (max 80).');
  if (!t(f.name)) errors.name = m('La razón social es obligatoria.', 'Legal name is required.');
  else if (t(f.name).length > 255) errors.name = m('Máximo 255 caracteres.', 'Max 255 characters.');
  if (!t(f.project)) errors.project = m('El proyecto es obligatorio.', 'Project is required.');
  if (!t(f.contract_reference)) errors.contract_reference = m('El número de contrato es obligatorio.', 'Contract number is required.');
  if (t(f.tax_id) && !/^[\p{L}\p{N}&\-. ]{1,64}$/u.test(t(f.tax_id))) errors.tax_id = m('RFC / Tax ID inválido.', 'Invalid tax ID.');
  const phones = t(f.phone).split(/\s*[/,;]\s*/).filter(Boolean);
  if (phones.some(p => !PHONE.test(p) || !/[0-9]/.test(p)) || phones.length > 10) errors.phone = m('Teléfono inválido (separa varios con "/").', 'Invalid phone (separate several with "/").');
  const emails = f.emails.map(t).filter(Boolean);
  if (emails.some(e => !EMAIL.test(e) || e.length > 254)) errors.emails = m('Revisa el formato de los correos.', 'Check the email format.');
  if (emails.length > 20 || f.contacts.map(t).filter(Boolean).length > 20) errors.contacts = m('Máximo 20 contactos y 20 correos.', 'Max 20 contacts and 20 emails.');
  const p = f.policy;
  if (p.days !== '' && (!/^\d+$/.test(String(p.days)) || Number(p.days) > 3650)) errors.days = m('Días entre 0 y 3650.', 'Days between 0 and 3650.');
  if (p.margin !== '' && (!Number.isFinite(Number(p.margin)) || Number(p.margin) < 0 || Number(p.margin) > 100)) errors.margin = m('Margen entre 0 y 100.', 'Margin between 0 and 100.');
  if (p.until && !/^\d{4}-\d{2}-\d{2}$/.test(p.until)) errors.until = m('Fecha inválida.', 'Invalid date.');
  return { ok: Object.keys(errors).length === 0, errors };
}

/** JSON body for POST/PUT (the portal and its key are never sent). */
export function toPayload(f) {
  const t = v => String(v ?? '').trim();
  const p = f.policy;
  return {
    code: t(f.code), name: t(f.name), brand_name: t(f.brand_name), tax_id: t(f.tax_id), project: t(f.project), contract_reference: t(f.contract_reference),
    phone: t(f.phone), contacts: f.contacts.map(t).filter(Boolean), emails: f.emails.map(t).filter(Boolean), status: f.status,
    address: String(f.address ?? '').trim(), terms: String(f.terms ?? '').trim(), notes: String(f.notes ?? '').trim(),
    repeat_policy: { sales_policy: p.sales, sourcing_policy: p.sourcing, price_validity_days: p.days === '' ? null : Number(p.days), contract_reference: t(p.ref), contract_valid_until: p.until || null, min_margin_pct: p.margin === '' ? null : Number(p.margin) },
    logo: f.logo.next ? { data: f.logo.next.dataUrl, name: f.logo.next.name } : f.logo.remove ? { remove: true } : null,
  };
}

/** Field from a server 422 (`error.field`, e.g. "repeat_policy.min_margin_pct") → form error key. */
export function serverField(field) {
  const map = { 'repeat_policy.price_validity_days': 'days', 'repeat_policy.min_margin_pct': 'margin', 'repeat_policy.contract_valid_until': 'until', 'repeat_policy.sales_policy': 'sales', 'repeat_policy.sourcing_policy': 'sourcing', phone: 'phone', emails: 'emails', contacts: 'contacts' };
  return map[field] || field;
}

/** Human message for a save failure (status + server code). */
export function saveErrorMessage(status, code, en = false) {
  const m = (es, e) => (en ? e : es);
  if (status === 401) return m('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.');
  if (status === 403 && code === 'CSRF_INVALID') return m('La sesión de seguridad caducó; vuelve a intentar.', 'The security token expired; try again.');
  if (status === 403) return m('No tienes permiso para dar de alta o editar clientes.', 'You are not allowed to create or edit clients.');
  if (code === 'CODE_TAKEN') return m('Ese número de cliente ya está registrado. Usa otro o selecciónalo para editarlo.', 'That client number already exists. Use another one or select it to edit.');
  if (status === 412) return m('Otra persona modificó este cliente. Recarga la ficha antes de guardar.', 'Someone else changed this client. Reload the record before saving.');
  if (code === 'IDEMPOTENCY_CONFLICT' || code === 'IDEMPOTENCY_PENDING') return m('La operación anterior sigue en proceso; espera y reintenta.', 'The previous operation is still running; wait and retry.');
  if (status === 413) return m('El logotipo es demasiado grande.', 'The logo is too large.');
  if (status === 422) return m('Revisa los campos marcados.', 'Check the highlighted fields.');
  if (code === 'CATALOG_WRITE_NOT_PROVISIONED') return m('El guardado de clientes aún no está habilitado en este equipo: falta aprovisionar la cuenta de escritura del catálogo. No se guardó nada.', 'Saving clients is not enabled on this computer yet: the catalog write account is not provisioned. Nothing was saved.');
  return m('No se pudo guardar. No se confirmaron cambios parciales; intenta de nuevo.', 'Could not save. No partial changes were committed; try again.');
}
