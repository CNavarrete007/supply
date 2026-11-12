// Suministros de proveedores · formulario de alta/actualización (lógica pura, sin red). Catálogo SIN precios.
// La validación aquí solo ayuda al usuario: el servidor vuelve a validar todo (OfferingInput.php).

export const OTHER_TYPE = '__other__';
// Tipo: se guarda como código (como la mayoría de los registros existentes); "Otro/agregar nuevo tipo" guarda el texto capturado.
export const TYPES = [['product', 'Producto', 'Product'], ['service', 'Servicio', 'Service'], ['rent', 'Renta', 'Rent'], ['consumable', 'Consumible', 'Consumable'],
  ['spare_part', 'Refacción', 'Spare part'], ['equipment', 'Equipo', 'Equipment'], ['storage', 'Almacenamiento', 'Storage'], ['tool', 'Herramienta', 'Tool']];
export const CATEGORIES = ['Almacenamiento', 'Consumibles', 'EPP y seguridad', 'Equipos', 'Herramientas', 'Materiales', 'Refacciones', 'Renta de equipo', 'Servicios',
  'Tecnología y comunicación', 'Transporte y logística', 'Otros'];
export const LEAD_UNITS = [['días hábiles', 'Días hábiles', 'Business days'], ['días naturales', 'Días naturales', 'Calendar days'], ['semanas', 'Semanas', 'Weeks'], ['meses', 'Meses', 'Months']];
export const CREDIT_TYPES = [['Contado', 'Contado', 'Cash'], ['Anticipo', 'Anticipo', 'Advance payment'], ['Crédito', 'Crédito', 'Credit'], ['Contra entrega', 'Contra entrega', 'Cash on delivery'],
  ['Parcialidades', 'Parcialidades', 'Installments'], ['Consignación', 'Consignación', 'Consignment'], ['Otros', 'Otros', 'Other']];
export const CURRENCIES = ['MXN', 'USD', 'EUR'];
export const STATUSES = [['active', 'Activo', 'Active'], ['inactive', 'Inactivo', 'Inactive'], ['unavailable', 'No disponible', 'Unavailable']];

const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function optionValue(value, options) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const v = String(value).trim();
  const hit = options.find(([code, es, en]) => code === v || fold(es) === fold(v) || fold(en) === fold(v));
  return hit ? hit[0] : v;
}
const known = (v, options) => !v || options.some(o => o[0] === v);
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : String(Number(v)));

export function emptyForm(supplierId = '') {
  return {
    id: '', version: 0, supplier_id: supplierId, name: '', type: 'product', type_other: '', category: 'Materiales', brand: '', model: '', description: '',
    lead_time_value: '', lead_time_unit: 'días hábiles', credit_type: 'Contado', credit_days: '', currency: 'MXN', minimum_order: '', valid_until: '',
    coverage: 'Nacional', status: 'active', notes: '', legacy: { type: '', lead_time_unit: '', credit_type: '', status: '' }, logo: { current: null, next: null, remove: false },
  };
}

/**
 * Form state from GET /api/v1/catalogs/supplier-offerings/{id} → item. A stored value outside the lists is kept as
 * "Valor histórico" (not overwritten unless the user picks another option); a stored label of a known type (p. ej.
 * "Servicio") is also kept as is.
 */
export function formFromRecord(it) {
  if (!it) return emptyForm();
  const rawType = it.type ? String(it.type) : '';
  const typeIsCode = TYPES.some(o => o[0] === rawType);
  const unit = optionValue(it.lead_time_unit, LEAD_UNITS);
  const credit = optionValue(it.credit_type, CREDIT_TYPES);
  const status = optionValue(it.status, STATUSES);
  return {
    id: it.id, version: Number(it.version || 1), supplier_id: it.supplier_id || '', name: it.name || '', type: rawType ? rawType : 'product', type_other: '',
    category: it.category || '', brand: it.brand || '', model: it.model || '', description: it.description || '', lead_time_value: num(it.lead_time_value),
    lead_time_unit: unit, credit_type: credit, credit_days: it.credit_days === null || it.credit_days === undefined ? '' : String(it.credit_days),
    currency: CURRENCIES.includes(it.currency) ? it.currency : '', minimum_order: it.minimum_order || '', valid_until: it.valid_until ? String(it.valid_until).slice(0, 10) : '',
    coverage: it.coverage || '', status: status || 'active', notes: it.notes || '',
    legacy: { type: rawType && !typeIsCode ? rawType : '', lead_time_unit: known(unit, LEAD_UNITS) ? '' : unit, credit_type: known(credit, CREDIT_TYPES) ? '' : credit, status: known(status, STATUSES) ? '' : status },
    logo: { current: null, next: null, remove: false },
  };
}

const typeValue = f => (f.type === OTHER_TYPE ? String(f.type_other ?? '').trim() : f.type);

export function validateForm(f, en = false) {
  const m = (es, e) => (en ? e : es);
  const t = v => String(v ?? '').trim();
  const errors = {};
  if (!t(f.supplier_id)) errors.supplier_id = m('Selecciona el proveedor.', 'Select the supplier.');
  if (!t(f.name)) errors.name = m('Captura el producto, servicio o suministro.', 'Enter the product, service or supply.');
  else if (t(f.name).length > 500) errors.name = m('Máximo 500 caracteres.', 'Max 500 characters.');
  if (f.type === OTHER_TYPE && !t(f.type_other)) errors.type_other = m('Escribe el nuevo tipo.', 'Type the new type.');
  if (t(f.type_other).length > 64) errors.type_other = m('Máximo 64 caracteres.', 'Max 64 characters.');
  if (t(f.lead_time_value) !== '' && (!Number.isFinite(Number(f.lead_time_value)) || Number(f.lead_time_value) < 0 || Number(f.lead_time_value) > 9999)) errors.lead_time_value = m('Tiempo entre 0 y 9999.', 'Time between 0 and 9999.');
  if (t(f.credit_days) !== '' && (!/^\d+$/.test(t(f.credit_days)) || Number(f.credit_days) > 3650)) errors.credit_days = m('Días entre 0 y 3650.', 'Days between 0 and 3650.');
  if (f.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(f.valid_until)) errors.valid_until = m('Fecha inválida.', 'Invalid date.');
  return { ok: Object.keys(errors).length === 0, errors };
}

/** JSON body for POST/PUT (never a price). */
export function toPayload(f) {
  const t = v => String(v ?? '').trim();
  const n = v => (t(v) === '' ? null : Number(v));
  return {
    supplier_id: t(f.supplier_id), name: t(f.name), type: typeValue(f), category: t(f.category), brand: t(f.brand), model: t(f.model), description: String(f.description ?? '').trim(),
    lead_time_value: n(f.lead_time_value), lead_time_unit: f.lead_time_unit, credit_type: f.credit_type, credit_days: n(f.credit_days), currency: f.currency,
    minimum_order: t(f.minimum_order), valid_until: f.valid_until || null, coverage: String(f.coverage ?? '').trim(), status: f.status, notes: String(f.notes ?? '').trim(),
  };
}

export const payloadSignature = f => JSON.stringify(toPayload(f));

export function missingRequired(f, en = false) {
  const t = v => String(v ?? '').trim();
  return [['supplier_id', 'proveedor', 'supplier'], ['name', 'producto, servicio o suministro', 'product, service or supply']].filter(([k]) => !t(f[k])).map(([, es, e]) => (en ? e : es));
}

export const serverField = field => ({ type: 'type_other' }[field] || field);

export function saveErrorMessage(status, code, en = false) {
  const m = (es, e) => (en ? e : es);
  if (status === 401) return m('Tu sesión expiró. Inicia sesión nuevamente.', 'Your session expired. Sign in again.');
  if (status === 403 && code === 'CSRF_INVALID') return m('La sesión de seguridad caducó; vuelve a intentar.', 'The security token expired; try again.');
  if (status === 403) return m('No tienes permiso para registrar o editar suministros.', 'You are not allowed to create or edit supplies.');
  if (code === 'DUPLICATE_OFFERING') return m('Este proveedor ya tiene registrado ese producto, servicio o suministro. Selecciónalo para editarlo o usa otro nombre.', 'This supplier already has that product, service or supply. Select it to edit or use another name.');
  if (status === 412) return m('Otra persona modificó este suministro. Recarga la ficha antes de guardar.', 'Someone else changed this supply. Reload the record before saving.');
  if (code === 'IDEMPOTENCY_CONFLICT' || code === 'IDEMPOTENCY_PENDING') return m('La operación anterior sigue en proceso; espera y reintenta.', 'The previous operation is still running; wait and retry.');
  if (status === 422) return m('Revisa los campos marcados.', 'Check the highlighted fields.');
  if (code === 'CATALOG_WRITE_NOT_PROVISIONED') return m('El guardado de suministros aún no está habilitado en este equipo: falta aprovisionar la cuenta de escritura del catálogo. No se guardó nada.', 'Saving supplies is not enabled on this computer yet: the catalog write account is not provisioned. Nothing was saved.');
  return m('No se pudo guardar. No se confirmaron cambios parciales; intenta de nuevo.', 'Could not save. No partial changes were committed; try again.');
}
