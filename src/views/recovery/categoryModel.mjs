// Requisición › Catálogo de categorías · lógica pura (diseño del Apps Script original).
// Fuente: GET /api/v1/catalogs/categories (solo lectura). Alta, edición, estatus y eliminación se validan aquí,
// pero no se guardan: no existe endpoint ni permiso SQL de escritura sobre `categories` (requiere autorización).
export const CATEGORY_TABS = [
  ['form', '＋', 'Nueva / editar categoría', 'Captura una categoría nueva o modifica una existente.'],
  ['matrix', '📋', 'Matriz de categorías', 'Consulta, busca, edita, activa o desactiva categorías.'],
  ['help', '💡', '¿Qué significa categoría?', 'Consulta ejemplos y reglas para clasificar partidas.'],
];
export const CATEGORY_STATUSES = [['active', 'Activa'], ['inactive', 'Inactiva']];
export const NAME_MAX = 255; // categories.name VARCHAR(255)
export const DESCRIPTION_MAX = 16000; // categories.description TEXT (utf8mb4)
export const HELP = {
  title: '¿Qué significa categoría?',
  subtitle: 'Es la agrupación general utilizada para clasificar cada partida de la requisición.',
  cards: [
    ['info', 'Ejemplos de bienes', 'Equipos, consumibles, materiales, herramientas, refacciones, tecnología y EPP.'],
    ['warn', 'Ejemplos de servicios', 'Transporte, logística, renta de equipo, mantenimiento, inspección o servicios profesionales.'],
    ['ok', '¿Para qué sirve?', 'Permite filtrar requisiciones, analizar gastos, comparar compras y localizar proveedores especializados.'],
  ],
  rules: [
    ['Regla para elegir una categoría', 'Selecciona la categoría que describa mejor el tipo principal de la partida. Por ejemplo, una eslinga, grillete o equipo de levantamiento puede clasificarse como “Equipos de izaje”; un servicio de traslado debe clasificarse como “Transporte y logística”.'],
    ['¿Qué hago si no existe?', 'Ve a “Nueva / editar categoría”, registra el nombre, una descripción clara y déjala en estatus Activa. Después aparecerá automáticamente en la lista desplegable de la requisición.'],
    ['¿Qué significa Inactiva?', 'La categoría permanece en el historial y en las partidas anteriores, pero deja de aparecer para nuevas partidas. Esta opción es preferible a eliminar una categoría que ya fue utilizada.'],
  ],
};

const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const NAME_CONTROL = /[\x00-\x1f\x7f]/;
const chars = v => [...String(v ?? '')].length;
// Same equivalence as the column collation (utf8mb4_uca1400_nopad_ai_ci): case and accent insensitive.
export const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');

export const emptyCategory = () => ({ code: null, name: '', status: 'active', description: '' });
export const fromCategory = c => ({ code: c.code, name: c.name || '', status: c.active ? 'active' : 'inactive', description: c.description || '' });
export const usageCount = c => (c?.usage?.items || 0) + (c?.usage?.items_by_label || 0);
export const usageText = c => `${usageCount(c)} partida(s)`;
export function usageDetail(c) {
  const u = c?.usage || {};
  const parts = [`${u.items || 0} ligada(s) por categoría`];
  if (u.items_by_label) parts.push(`${u.items_by_label} histórica(s) solo por etiqueta`);
  parts.push(`${u.requisitions || 0} requisición(es)`);
  if (u.suppliers) parts.push(`${u.suppliers} proveedor(es)`);
  if (u.offerings) parts.push(`${u.offerings} suministro(s)`);
  return parts.join(' · ');
}

export function filterCategories(list, query = '') {
  const q = fold(query);
  return [...(list || [])]
    .filter(c => !q || [c.name, c.description, c.code].some(v => fold(v).includes(q)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' }));
}
export const activeNames = list => (list || []).filter(c => c.active).map(c => c.name);

export function changedCategoryFields(form, original) {
  if (!original) return [];
  const o = fromCategory(original), out = [];
  if (clean(form.name) !== clean(o.name)) out.push('Nombre');
  if (form.status !== o.status) out.push('Estatus');
  if (clean(form.description) !== clean(o.description)) out.push('Descripción / alcance');
  return out;
}

/** Returns the first blocking error (Spanish) or null. `list` is the current catalog; `original` the edited category. */
export function validateCategory(form, list = [], original = null) {
  const name = clean(form.name), description = String(form.description ?? '').trim();
  if (!name) return 'Captura el nombre de la categoría.';
  if (chars(name) > NAME_MAX || NAME_CONTROL.test(String(form.name))) return `El nombre admite hasta ${NAME_MAX} caracteres sin caracteres de control.`;
  if (chars(description) > DESCRIPTION_MAX || CONTROL.test(description)) return `La descripción admite hasta ${DESCRIPTION_MAX.toLocaleString('es-MX')} caracteres sin caracteres de control.`;
  if (!CATEGORY_STATUSES.some(([v]) => v === form.status)) return 'Selecciona el estatus de la categoría.';
  const dup = (list || []).find(c => c.code !== (original?.code ?? form.code) && fold(c.name) === fold(name));
  if (dup) return dup.active ? `Ya existe la categoría «${dup.name}». Usa la existente para no duplicar el catálogo.` : `Ya existe la categoría «${dup.name}» en estatus Inactiva. Reactívala desde la matriz en lugar de duplicarla.`;
  if (original && !changedCategoryFields(form, original).length) return 'No hay cambios por guardar.';
  return null;
}

/** Non-blocking consequences shown before saving an edit. */
export function categoryWarnings(form, original) {
  if (!original) return [];
  const n = usageCount(original), out = [];
  if (n && clean(form.name) !== clean(original.name)) out.push(`Las ${n} partida(s) existentes conservan su etiqueta histórica «${original.name}»; las nuevas usarán «${clean(form.name)}».`);
  if (original.active && form.status === 'inactive') out.push(n ? `Dejará de aparecer para nuevas partidas; las ${n} partida(s) existentes la conservan en su historial.` : 'Dejará de aparecer en la lista desplegable de nuevas partidas.');
  if (!original.active && form.status === 'active') out.push('Volverá a aparecer en la lista desplegable de nuevas partidas.');
  return out;
}

export function saveLockedText(form, original) {
  const what = original ? `los cambios de la categoría «${original.name}» (${changedCategoryFields(form, original).join(', ')})` : `la categoría «${clean(form.name)}»`;
  return `Datos validados, pero no se guardó ${what}: SupplyFlow aún no tiene endpoint de escritura del catálogo de categorías (alta, edición y estatus). Habilitarlo requiere tu autorización para permisos INSERT/UPDATE sobre categories.`;
}

/** Deleting is only possible for a category never used: otherwise it must be deactivated (history and foreign keys). */
export function deleteBlock(c) {
  const u = c?.usage || {}, n = usageCount(c);
  if (n) return `«${c.name}» ya fue utilizada en ${n} partida(s) de ${u.requisitions || 0} requisición(es). Desactívala (Inactiva) en lugar de eliminarla: así conserva el historial.`;
  if (u.suppliers || u.offerings) return `«${c.name}» está asignada a ${u.suppliers || 0} proveedor(es) y ${u.offerings || 0} suministro(s). Desactívala (Inactiva) en lugar de eliminarla.`;
  return null;
}
export function deleteError(c, typed) {
  if (deleteBlock(c)) return deleteBlock(c);
  return clean(typed) === clean(c?.name) ? null : `Escribe exactamente «${c?.name}» para confirmar la eliminación.`;
}
export const deleteLockedText = c => `Datos validados, pero no se eliminó la categoría «${c.name}»: SupplyFlow aún no tiene endpoint de escritura del catálogo de categorías. Habilitarlo requiere tu autorización para permisos DELETE sobre categories.`;

export const MODE_NOTE = {
  locked: ['warn', 'Formulario bloqueado. Presiona Nueva categoría para capturar una o usa EDITAR desde la matriz.'],
  new: ['ok', 'Modo nueva captura activo. Completa la información y presiona Guardar. Al terminar, el formulario se limpiará y bloqueará.'],
  edit: ['ok', 'Modo edición activo. Modifica la información y presiona Guardar. Al terminar, el formulario se limpiará y bloqueará.'],
};
