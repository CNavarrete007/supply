// Requisición › Catálogo de categorías · pruebas de la lógica pura. Ejecutar: node --test tests/frontend/category_catalog.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_TABS, HELP, emptyCategory, fromCategory, usageCount, usageText, usageDetail, filterCategories, activeNames, changedCategoryFields, validateCategory, categoryWarnings, payloadOf, savedText, writeErrorText, deleteBlock, deleteError, deletedText, fold, MODE_NOTE } from '../../src/views/recovery/categoryModel.mjs';

const cat = (o) => ({ code: o.code || 'cat_x', name: o.name || 'Consumibles', description: 'description' in o ? o.description : `Descripción de ${o.name || 'Consumibles'}.`, active: o.active ?? true, imported: false,
  usage: { items: 0, items_by_label: 0, requisitions: 0, suppliers: 0, offerings: 0, ...(o.usage || {}) } });
const LIST = [cat({ code: 'cat_con', name: 'Consumibles', description: 'Materiales de consumo frecuente o reposición periódica.', usage: { items: 106, requisitions: 70, suppliers: 6, offerings: 11 } }),
  cat({ code: 'cat_tec', name: 'Tecnología y comunicaciones', usage: { items: 2, items_by_label: 1, requisitions: 2 } }),
  cat({ code: 'cat_old', name: 'Equipos de izaje', active: false }),
  cat({ code: 'cat_trl', name: 'Transporte y logística', description: null })];

test('design: three sub-tabs, help content and mode notes of the original', () => {
  assert.deepEqual(CATEGORY_TABS.map(t => t[2]), ['Nueva / editar categoría', 'Matriz de categorías', '¿Qué significa categoría?']);
  assert.deepEqual(HELP.cards.map(c => c[1]), ['Ejemplos de bienes', 'Ejemplos de servicios', '¿Para qué sirve?']);
  assert.deepEqual(HELP.rules.map(r => r[0]), ['Regla para elegir una categoría', '¿Qué hago si no existe?', '¿Qué significa Inactiva?']);
  assert.match(MODE_NOTE.new[1], /^Modo nueva captura activo\./);
});

test('usage: linked lines plus historical lines with the same label', () => {
  assert.equal(usageCount(LIST[1]), 3);
  assert.equal(usageText(LIST[0]), '106 partida(s)');
  assert.equal(usageDetail(LIST[1]), '2 ligada(s) por categoría · 1 histórica(s) solo por etiqueta · 2 requisición(es)');
  assert.match(usageDetail(LIST[0]), /6 proveedor\(es\) · 11 suministro\(s\)$/);
  assert.equal(usageText({}), '0 partida(s)');
});

test('search is case/accent insensitive over name, description and code; sorted by name', () => {
  assert.deepEqual(filterCategories(LIST, 'TECNOLOGIA').map(c => c.code), ['cat_tec']);
  assert.deepEqual(filterCategories(LIST, 'consumo').map(c => c.code), ['cat_con']);
  assert.deepEqual(filterCategories(LIST, 'cat_trl').map(c => c.code), ['cat_trl']);
  assert.deepEqual(filterCategories(LIST).map(c => c.name), ['Consumibles', 'Equipos de izaje', 'Tecnología y comunicaciones', 'Transporte y logística']);
  assert.deepEqual(activeNames(LIST), ['Consumibles', 'Tecnología y comunicaciones', 'Transporte y logística']);
  assert.equal(fold('  Logística   Ñandú '), 'logistica nandu');
});

test('validation: required name, limits, duplicates (case/accent insensitive, inactive hint), status', () => {
  const ok = { ...emptyCategory(), name: 'Equipos de buceo', description: 'Trajes y tanques.' };
  assert.equal(validateCategory(ok, LIST), null);
  assert.match(validateCategory({ ...ok, name: '   ' }, LIST), /nombre/);
  assert.match(validateCategory({ ...ok, name: 'x'.repeat(256) }, LIST), /255/);
  assert.equal(validateCategory({ ...ok, name: 'ñ'.repeat(255) }, LIST), null);
  assert.match(validateCategory({ ...ok, name: 'a\u0007b' }, LIST), /control/);
  assert.match(validateCategory({ ...ok, description: 'x'.repeat(16001) }, LIST), /16,000/);
  assert.match(validateCategory({ ...ok, name: 'tecnologia Y COMUNICACIONES' }, LIST), /Ya existe la categoría «Tecnología y comunicaciones»\. Usa la existente/);
  assert.match(validateCategory({ ...ok, name: 'equipos de IZAJE' }, LIST), /Inactiva\. Reactívala/);
  assert.match(validateCategory({ ...ok, status: 'archived' }, LIST), /estatus/);
});

test('edit: own name is not a duplicate, changes are required, changed fields listed', () => {
  const orig = LIST[0];
  assert.match(validateCategory(fromCategory(orig), LIST, orig), /No hay cambios/);
  const f = { ...fromCategory(orig), name: 'CONSUMIBLES', status: 'inactive' };
  assert.equal(validateCategory(f, LIST, orig), null);
  assert.deepEqual(changedCategoryFields(f, orig), ['Nombre', 'Estatus']);
  assert.deepEqual(changedCategoryFields({ ...fromCategory(LIST[3]), description: '  ' }, LIST[3]), []);
  assert.match(validateCategory({ ...fromCategory(orig), name: 'Transporte y logistica' }, LIST, orig), /Ya existe/);
});

test('edit warnings: rename keeps historical labels; deactivate/reactivate consequences', () => {
  const orig = LIST[0];
  const w = categoryWarnings({ ...fromCategory(orig), name: 'Consumibles generales', status: 'inactive' }, orig);
  assert.equal(w.length, 2);
  assert.match(w[0], /106 partida\(s\) existentes conservan su etiqueta histórica «Consumibles»; las nuevas usarán «Consumibles generales»/);
  assert.match(w[1], /Dejará de aparecer para nuevas partidas/);
  assert.deepEqual(categoryWarnings({ ...fromCategory(LIST[2]), status: 'active' }, LIST[2]), ['Volverá a aparecer en la lista desplegable de nuevas partidas.']);
  assert.deepEqual(categoryWarnings({ ...fromCategory(LIST[3]), status: 'inactive' }, LIST[3]), ['Dejará de aparecer en la lista desplegable de nuevas partidas.']);
});

test('save: payload like the server (CategoryInput) and success text from MariaDB', () => {
  assert.deepEqual(payloadOf({ ...emptyCategory(), name: ' Equipos  de buceo ', description: '  Alcance  ' }), { name: 'Equipos de buceo', description: 'Alcance', status: 'active' });
  assert.equal(savedText({ code: 'cat_equipos_de_buceo' }, { ...emptyCategory(), name: 'Equipos de buceo' }), 'Categoría «Equipos de buceo» registrada en MariaDB con el código cat_equipos_de_buceo. Ya aparece en la lista de categorías de las partidas.');
  assert.equal(savedText({ code: 'cat_x' }, { ...emptyCategory(), name: 'Inactiva QA', status: 'inactive' }), 'Categoría «Inactiva QA» registrada en MariaDB con el código cat_x.');
  assert.equal(savedText({ code: 'cat_con' }, { ...fromCategory(LIST[0]), status: 'inactive' }, LIST[0]), 'Cambios de «Consumibles» guardados en MariaDB (Estatus).');
});

test('server errors: tone, text and whether the same operation may be retried', () => {
  assert.deepEqual(writeErrorText({ status: 409, code: 'DUPLICATE_CATEGORY', message: 'Ya existe la categoría «X».' }), ['danger', 'Ya existe la categoría «X».', false]);
  assert.equal(writeErrorText({ status: 412, code: 'STALE_VERSION', message: 'La categoría cambió desde que se abrió.' })[0], 'warn');
  assert.match(writeErrorText({ status: 412, message: 'La categoría cambió.' }, 'eliminar')[1], /vuelve a eliminar/);
  assert.match(writeErrorText({ status: 412, message: 'La categoría cambió.' }, 'guardar')[1], /versión vigente de MariaDB; vuelve a aplicar tus cambios/);
  assert.equal(writeErrorText({ status: 503, code: 'CATALOG_WRITE_NOT_PROVISIONED', message: 'El guardado de categorías aún no está habilitado en este equipo.' })[2], false);
  assert.deepEqual(writeErrorText({ status: 503, code: 'CATEGORY_WRITE_UNAVAILABLE', message: 'No se pudo guardar.' }).slice(0, 1).concat(writeErrorText({ status: 503 })[2]), ['danger', true]);
  assert.equal(writeErrorText({ status: 0, message: 'Failed to fetch' })[2], true);
  assert.match(writeErrorText({ status: 401 })[1], /sesión expiró/);
  assert.match(writeErrorText({ status: 403, code: 'FORBIDDEN' })[1], /Master Admin/);
});

test('delete: used categories must be deactivated; unused ones require typing the name', () => {
  assert.match(deleteBlock(LIST[0]), /106 partida\(s\) de 70 requisición\(es\)\. Desactívala \(Inactiva\)/);
  assert.match(deleteBlock(LIST[1]), /3 partida\(s\)/);
  assert.match(deleteBlock(cat({ name: 'Solo proveedores', usage: { suppliers: 2 } })), /2 proveedor\(es\) y 0 suministro\(s\)/);
  assert.equal(deleteBlock(LIST[3]), null);
  assert.match(deleteError(LIST[3], 'transporte'), /Escribe exactamente «Transporte y logística»/);
  assert.equal(deleteError(LIST[3], ' Transporte y logística '), null);
  assert.match(deleteError(LIST[0], 'Consumibles'), /Desactívala/);
  assert.equal(deletedText(LIST[3]), 'Categoría «Transporte y logística» eliminada de MariaDB (nunca se usó).');
});
