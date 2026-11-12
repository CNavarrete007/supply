// Proveedores · formulario de alta/actualización (lógica pura, sin red). La validación aquí solo ayuda al usuario:
// el servidor vuelve a validar todo (SupplierInput.php) y es la única autoridad.

// Opciones del diseño. Estatus se guarda como código (valores existentes en MariaDB); crédito y unidad, como texto
// (así están los registros importados). Un valor guardado fuera de estas listas se conserva como "Valor histórico".
export const STATUSES = [['under_evaluation', 'En evaluación', 'Under evaluation'], ['authorized', 'Autorizado', 'Authorized'], ['suspended', 'Suspendido', 'Suspended'], ['inactive', 'Inactivo', 'Inactive']];
export const CURRENCIES = ['MXN', 'USD', 'EUR'];
export const CREDIT_TYPES = [['Contado', 'Contado', 'Cash'], ['Anticipo', 'Anticipo', 'Advance payment'], ['Crédito', 'Crédito', 'Credit'], ['Contra entrega', 'Contra entrega', 'Cash on delivery'],
  ['Parcialidades', 'Parcialidades', 'Installments'], ['Consignación', 'Consignación', 'Consignment'], ['Otro', 'Otro', 'Other']];
export const LEAD_UNITS = [['días hábiles', 'Días hábiles', 'Business days'], ['días naturales', 'Días naturales', 'Calendar days'], ['semanas', 'Semanas', 'Weeks'], ['meses', 'Meses', 'Months']];
export const DEFAULT_SCALE = '100';

const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Stored value → option value (exact or accent/case-insensitive match); otherwise the raw stored value. */
export function optionValue(value, options) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const v = String(value).trim();
  const hit = options.find(([code, es, en]) => code === v || fold(code) === fold(v) || fold(es) === fold(v) || fold(en) === fold(v));
  return hit ? hit[0] : v;
}
const known = (v, options) => !v || options.some(o => o[0] === v);
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : String(Number(v)));
const rows = list => (list.length ? list : ['']);

export function emptyForm() {
  return {
    id: '', version: 0, imported: false, code: '', name: '', tax_id: '', supplier_key: '', contacts: [''], emails: [''], phones: [''], category: '',
    status: 'under_evaluation', currency: 'MXN', credit_type: 'Contado', credit_days: '0', lead_time_value: '0', lead_time_unit: 'días hábiles',
    rating: '80', rating_scale: DEFAULT_SCALE, document_notes: '', notes: '', legacy: { status: '', credit_type: '', lead_time_unit: '' },
    logo: { current: null, next: null, remove: false },
  };
}

/** Form state from GET /api/v1/catalogs/suppliers/{id} → item. */
export function formFromRecord(it) {
  if (!it) return emptyForm();
  const ch = type => (it.channels || []).filter(c => c.type === type).map(c => c.value);
  const status = optionValue(it.status, STATUSES);
  const credit = optionValue(it.credit_type, CREDIT_TYPES);
  const unit = optionValue(it.lead_time_unit, LEAD_UNITS);
  return {
    id: it.id, version: Number(it.version || 1), imported: !!it.imported, code: it.code || '', name: it.name || '', tax_id: it.tax_id || '', supplier_key: it.supplier_key || '',
    contacts: rows((it.contacts || []).map(c => c.name)), emails: rows(ch('email')), phones: rows(ch('phone')), category: it.category || '',
    status: status || 'under_evaluation', currency: CURRENCIES.includes(it.currency) ? it.currency : '', credit_type: credit, credit_days: num(it.credit_days),
    lead_time_value: num(it.lead_time_value), lead_time_unit: unit, rating: num(it.rating), rating_scale: it.rating_scale ? String(Number(it.rating_scale)) : DEFAULT_SCALE,
    document_notes: it.document_notes || '', notes: it.notes || '',
    legacy: { status: known(status, STATUSES) ? '' : status, credit_type: known(credit, CREDIT_TYPES) ? '' : credit, lead_time_unit: known(unit, LEAD_UNITS) ? '' : unit },
    logo: { current: it.logo || null, next: null, remove: false },
  };
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE = /^[0-9+()\-. extEXT]{3,40}$/;
const CODE = /^[\p{L}\p{N}][\p{L}\p{N}._\-/ ]{0,79}$/u;

/** { ok, errors: {field: message} } — mirrors the server rules for immediate feedback. */
export function validateForm(f, en = false) {
  const m = (es, e) => (en ? e : es);
  const t = v => String(v ?? '').trim();
  const errors = {};
  if (!t(f.code)) errors.code = m('El número de proveedor es obligatorio.', 'Supplier number is required.');
  else if (!CODE.test(t(f.code))) errors.code = m('Usa letras, números, punto, guion, diagonal o espacio (máx. 80).', 'Use letters, digits, dot, dash, slash or space (max 80).');
  if (!t(f.name)) errors.name = m('La razón social es obligatoria.', 'Legal name is required.');
  if (!t(f.category)) errors.category = m('La categoría es obligatoria.', 'Category is required.');
  if (t(f.tax_id) && !/^[\p{L}\p{N}&\-. ]{1,64}$/u.test(t(f.tax_id))) errors.tax_id = m('RFC / Tax ID inválido.', 'Invalid tax ID.');
  if (f.emails.map(t).filter(Boolean).some(e => !EMAIL.test(e) || e.length > 254)) errors.emails = m('Revisa el formato de los correos.', 'Check the email format.');
  if (f.phones.map(t).filter(Boolean).some(p => !PHONE.test(p) || !/[0-9]/.test(p))) errors.phones = m('Revisa el formato de los teléfonos.', 'Check the phone format.');
  if (t(f.credit_days) !== '' && (!/^\d+$/.test(t(f.credit_days)) || Number(f.credit_days) > 3650)) errors.credit_days = m('Días entre 0 y 3650.', 'Days between 0 and 3650.');
  if (t(f.lead_time_value) !== '' && (!Number.isFinite(Number(f.lead_time_value)) || Number(f.lead_time_value) < 0 || Number(f.lead_time_value) > 9999)) errors.lead_time_value = m('Tiempo entre 0 y 9999.', 'Time between 0 and 9999.');
  const scale = Number(f.rating_scale || DEFAULT_SCALE);
  if (t(f.rating) !== '' && (!Number.isFinite(Number(f.rating)) || Number(f.rating) < 0 || Number(f.rating) > scale)) errors.rating = m(`Calificación entre 0 y ${scale}.`, `Rating between 0 and ${scale}.`);
  return { ok: Object.keys(errors).length === 0, errors };
}

/** JSON body for POST/PUT. */
export function toPayload(f) {
  const t = v => String(v ?? '').trim();
  const n = v => (t(v) === '' ? null : Number(v));
  return {
    code: t(f.code), name: t(f.name), tax_id: t(f.tax_id), supplier_key: t(f.supplier_key), contacts: f.contacts.map(t).filter(Boolean), emails: f.emails.map(t).filter(Boolean),
    phones: f.phones.map(t).filter(Boolean), category: t(f.category), status: f.status, currency: f.currency, credit_type: f.credit_type, credit_days: n(f.credit_days),
    lead_time_value: n(f.lead_time_value), lead_time_unit: f.lead_time_unit, rating: n(f.rating), document_notes: String(f.document_notes ?? '').trim(), notes: String(f.notes ?? '').trim(),
    logo: f.logo.next ? { data: f.logo.next.dataUrl, name: f.logo.next.name } : f.logo.remove ? { remove: true } : null,
  };
}

/** Saved-state fingerprint (the logo counts as new/removed/unchanged, never its bytes). */
export function payloadSignature(f) {
  const marker = f.logo?.next ? `new:${f.logo.next.name}:${f.logo.next.size}` : f.logo?.remove ? 'remove' : null;
  return JSON.stringify({ ...toPayload({ ...f, logo: { current: null, next: null, remove: false } }), logo: marker });
}

export function missingRequired(f, en = false) {
  const t = v => String(v ?? '').trim();
  return [['code', 'No. de proveedor', 'supplier number'], ['name', 'razón social', 'legal name'], ['category', 'categoría', 'category']].filter(([k]) => !t(f[k])).map(([, es, e]) => (en ? e : es));
}

export const serverField = field => field;

export function saveErrorMessage(status, code, en = false) {
  const m = (es, e) => (en ? e : es);
  if (status === 401) return m('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.');
  if (status === 403 && code === 'CSRF_INVALID') return m('La sesión de seguridad caducó; vuelve a intentar.', 'The security token expired; try again.');
  if (status === 403) return m('No tienes permiso para dar de alta o editar proveedores.', 'You are not allowed to create or edit suppliers.');
  if (code === 'CODE_TAKEN') return m('Ese número de proveedor ya está registrado. Usa otro o selecciónalo para editarlo.', 'That supplier number already exists. Use another one or select it to edit.');
  if (status === 412) return m('Otra persona modificó este proveedor. Recarga la ficha antes de guardar.', 'Someone else changed this supplier. Reload the record before saving.');
  if (code === 'IDEMPOTENCY_CONFLICT' || code === 'IDEMPOTENCY_PENDING') return m('La operación anterior sigue en proceso; espera y reintenta.', 'The previous operation is still running; wait and retry.');
  if (status === 413) return m('El logotipo es demasiado grande.', 'The logo is too large.');
  if (status === 422) return m('Revisa los campos marcados.', 'Check the highlighted fields.');
  if (code === 'CATALOG_WRITE_NOT_PROVISIONED') return m('El guardado de proveedores aún no está habilitado en este equipo: falta aprovisionar la cuenta de escritura del catálogo. No se guardó nada.', 'Saving suppliers is not enabled on this computer yet: the catalog write account is not provisioned. Nothing was saved.');
  return m('No se pudo guardar. No se confirmaron cambios parciales; intenta de nuevo.', 'Could not save. No partial changes were committed; try again.');
}
