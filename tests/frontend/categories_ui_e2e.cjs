// Requisición › Catálogo de categorías · E2E de interfaz (Chromium) contra Vite + API + MariaDB.
// Uso: SF_UI=http://127.0.0.1:5173 SF_USER=<correo> SF_QA_PASSWORD=<clave> [SF_SHOTS=<dir>] node tests/frontend/categories_ui_e2e.cjs
// Garantía: toda petición /api que no sea GET se ABORTA (salvo login). Nada se escribe; apto para datos reales.
// Con datos sintéticos usa la categoría inactiva sin uso "QA Inactiva sin uso" para el camino de eliminación.
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const blocked = [];
  await context.route('**/api/**', route => {
    const req = route.request();
    if (req.method() === 'GET' || /\/api\/v1\/auth\/login$/.test(req.url())) return route.continue();
    blocked.push(`${req.method()} ${new URL(req.url()).pathname}`); return route.abort('blockedbyclient');
  });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill(USER);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = await (await page.request.get(UI + '/api/v1/catalogs/categories')).json();
    const items = [...api.items].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    const used = items.find(c => c.usage.items + c.usage.items_by_label > 0 && c.active);
    const unused = items.find(c => !c.usage.items && !c.usage.items_by_label && !c.usage.suppliers && !c.usage.offerings);

    await page.locator('nav button').filter({ hasText: /Solicitud \/ Requisición$/ }).first().click();
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    const waitCat = page.waitForResponse(r => /\/api\/v1\/catalogs\/categories$/.test(r.url()), { timeout: 20000 });
    await page.locator('#reqSubnav').getByRole('button', { name: /Catálogo de categorías/ }).click();
    check('GET /catalogs/categories → 200', (await waitCat).status() === 200);
    const root = page.getByTestId('category-catalog');
    await root.getByTestId('cat-form-panel').waitFor();
    check('aviso RF1 menciona el catálogo en consulta', await page.getByText('Catálogo de categorías en consulta').count() === 1);

    // 1 · Nueva / editar categoría
    check('subpestañas del original', JSON.stringify((await root.getByRole('tab').allInnerTexts()).map(t => t.split('\n').map(x => x.trim()).filter(Boolean)[1])) === JSON.stringify(['Nueva / editar categoría', 'Matriz de categorías', '¿Qué significa categoría?']));
    check('pestaña activa: Nueva / editar', await root.getByRole('tab', { name: /Nueva \/ editar categoría/ }).getAttribute('aria-selected') === 'true');
    const form = root.getByTestId('cat-form-panel');
    check('encabezado y Catálogo operativo', await form.getByRole('heading', { name: 'Alta y actualización de categorías' }).count() === 1 && await form.getByText('Catálogo operativo', { exact: true }).count() === 1
      && await form.getByText('Agrega una categoría cuando no exista en la lista desplegable de partidas.').count() === 1);
    check('modo nueva captura activo', (await form.getByTestId('cat-mode').innerText()).startsWith('Modo nueva captura activo. Completa la información y presiona Guardar.'));
    check('campos y placeholders', await page.locator('#cat-name').getAttribute('placeholder') === 'Ej. Equipos de izaje' && await page.locator('#cat-description').getAttribute('placeholder') === 'Indica qué tipos de productos o servicios deben clasificarse aquí.'
      && JSON.stringify(await page.locator('#cat-status option').allTextContents()) === JSON.stringify(['Activa', 'Inactiva']) && await page.locator('#cat-status').inputValue() === 'active');
    check('botones del original', JSON.stringify((await form.locator('.toolbar button').allInnerTexts()).map(t => t.replace(/^\S+\s/, '').trim())) === JSON.stringify(['Nueva categoría', 'Guardar categoría', 'Limpiar', 'Ver matriz', 'Regresar a la requisición']));
    await form.getByRole('button', { name: /Guardar categoría/ }).click();
    check('validación: nombre obligatorio', (await form.getByTestId('cat-msg').innerText()) === 'Captura el nombre de la categoría.');
    if (used) {
      await page.locator('#cat-name').fill(used.name.toUpperCase());
      await form.getByRole('button', { name: /Guardar categoría/ }).click();
      check('validación: duplicado sin distinguir mayúsculas', (await form.getByTestId('cat-msg').innerText()).startsWith(`Ya existe la categoría «${used.name}»`));
    }
    await page.locator('#cat-name').fill('Equipos de izaje QA E2E');
    await page.locator('#cat-description').fill('Eslingas, grilletes y equipo de levantamiento (sintético).');
    await shot(page, 'cat-01-form');
    await form.getByRole('button', { name: /Guardar categoría/ }).click();
    check('guardar valida y no guarda', (await form.getByTestId('cat-msg').innerText()).startsWith('Datos validados, pero no se guardó la categoría «Equipos de izaje QA E2E»'));
    await form.getByRole('button', { name: /Limpiar/ }).click();
    check('limpiar bloquea el formulario', (await form.getByTestId('cat-mode').innerText()).startsWith('Formulario bloqueado') && await page.locator('#cat-name').isDisabled() && await form.getByRole('button', { name: /Guardar categoría/ }).isDisabled() && await page.locator('#cat-name').inputValue() === '');
    await form.getByRole('button', { name: /Nueva categoría/ }).click();
    check('nueva categoría reactiva la captura', !(await page.locator('#cat-name').isDisabled()));

    // 2 · Matriz de categorías
    await form.getByRole('button', { name: /Ver matriz/ }).click();
    const matrix = root.getByTestId('cat-matrix');
    await matrix.waitFor();
    check('matriz: encabezado del original', await matrix.getByRole('heading', { name: 'Matriz de categorías' }).count() === 1 && await matrix.getByText('Solo las categorías activas aparecen en la lista desplegable de las partidas.').count() === 1
      && await matrix.getByRole('button', { name: /Nueva categoría/ }).count() === 1 && await matrix.getByPlaceholder('Buscar categoría...').count() === 1);
    check('matriz: columnas', JSON.stringify(await matrix.locator('thead th').allTextContents()) === JSON.stringify(['Categoría', 'Descripción', 'Estatus', 'Uso', 'Acciones']));
    const rows = matrix.getByTestId('cat-row');
    check('matriz: una fila por categoría de MariaDB', await rows.count() === items.length, `${await rows.count()} vs ${items.length}`);
    const cells = await rows.first().locator('td').allInnerTexts();
    const f0 = items[0];
    check('matriz: datos reales (nombre, descripción, estatus, uso)', cells[0] === f0.name && cells[1] === (f0.description || '—') && cells[2].toLowerCase() === (f0.active ? 'activa' : 'inactiva') && cells[3] === `${f0.usage.items + f0.usage.items_by_label} partida(s)`, JSON.stringify(cells));
    check('matriz: acciones EDITAR / ELIMINAR', JSON.stringify(await rows.first().getByRole('button').allInnerTexts()) === JSON.stringify(['EDITAR', 'ELIMINAR']));
    await shot(page, 'cat-02-matriz');
    if (used) {
      await matrix.getByLabel('Buscar categoría').fill(used.name.slice(0, 5).toLowerCase());
      check('búsqueda filtra', (await rows.allInnerTexts()).every(t => t.toLowerCase().includes(used.name.slice(0, 5).toLowerCase())) && await rows.count() >= 1);
      await matrix.getByLabel('Buscar categoría').fill('');
      // EDITAR → formulario en modo edición, advertencia al inactivar, guardar sin escribir
      await rows.filter({ hasText: used.name }).getByRole('button', { name: 'EDITAR' }).click();
      await form.waitFor();
      check('editar: modo edición con datos de MariaDB', (await form.getByTestId('cat-mode').innerText()).startsWith('Modo edición activo') && await page.locator('#cat-name').inputValue() === used.name
        && (await form.getByTestId('cat-editing').innerText()).includes(`código ${used.code}`));
      await form.getByRole('button', { name: /Guardar categoría/ }).click();
      check('editar: sin cambios no se envía', (await form.getByTestId('cat-msg').innerText()) === 'No hay cambios por guardar.');
      await page.locator('#cat-status').selectOption('inactive');
      check('editar: advertencia al inactivar una categoría en uso', (await form.getByTestId('cat-warning').first().innerText()).includes('Dejará de aparecer para nuevas partidas'));
      await form.getByRole('button', { name: /Guardar categoría/ }).click();
      check('editar: valida y no guarda', (await form.getByTestId('cat-msg').innerText()).startsWith(`Datos validados, pero no se guardó los cambios de la categoría «${used.name}» (Estatus)`));
      // ELIMINAR una categoría usada → bloqueo y "Desactivar en su lugar"
      await root.getByRole('tab', { name: /Matriz de categorías/ }).click();
      await rows.filter({ hasText: used.name }).getByRole('button', { name: 'ELIMINAR' }).click();
      const dlg = page.getByRole('dialog');
      check('eliminar categoría usada: bloqueado, sugiere Inactiva', (await dlg.getByTestId('cat-del-block').innerText()).includes('Desactívala (Inactiva) en lugar de eliminarla') && await dlg.getByRole('button', { name: 'Eliminar categoría' }).count() === 0);
      await shot(page, 'cat-03-eliminar-bloqueado');
      await dlg.getByRole('button', { name: 'Desactivar en su lugar' }).click();
      check('desactivar en su lugar abre edición con Inactiva', await page.locator('#cat-status').inputValue() === 'inactive' && await page.locator('#cat-name').inputValue() === used.name);
    }
    if (unused) {
      await root.getByRole('tab', { name: /Matriz de categorías/ }).click();
      await rows.filter({ hasText: unused.name }).getByRole('button', { name: 'ELIMINAR' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('button', { name: 'Eliminar categoría' }).click();
      check('eliminar sin uso: exige escribir el nombre', (await dlg.getByTestId('cat-del-msg').innerText()).startsWith(`Escribe exactamente «${unused.name}»`));
      await dlg.locator('#cat-del-typed').fill(unused.name);
      await dlg.getByRole('button', { name: 'Eliminar categoría' }).click();
      check('eliminar sin uso: valida y no elimina', (await dlg.getByTestId('cat-del-msg').innerText()).startsWith(`Datos validados, pero no se eliminó la categoría «${unused.name}»`));
      await dlg.getByRole('button', { name: 'Cerrar' }).first().click();
      check('la categoría sigue en la matriz', await rows.filter({ hasText: unused.name }).count() === 1);
    }

    // 3 · ¿Qué significa categoría?
    await root.getByRole('tab', { name: /¿Qué significa categoría\?/ }).click();
    const help = root.getByTestId('cat-help');
    check('ayuda: tarjetas del original', JSON.stringify(await help.locator('.sf-cat-card b').allTextContents()) === JSON.stringify(['Ejemplos de bienes', 'Ejemplos de servicios', '¿Para qué sirve?']));
    check('ayuda: reglas del original', JSON.stringify(await help.locator('.sf-cat-rule h4').allTextContents()) === JSON.stringify(['Regla para elegir una categoría', '¿Qué hago si no existe?', '¿Qué significa Inactiva?']));
    await shot(page, 'cat-04-ayuda');
    await help.getByRole('button', { name: /Agregar categoría/ }).click();
    check('agregar categoría abre la captura nueva', (await form.getByTestId('cat-mode').innerText()).startsWith('Modo nueva captura activo') && await page.locator('#cat-name').inputValue() === '');

    // Regresar a la requisición
    await form.getByRole('button', { name: /Regresar a la requisición/ }).click();
    check('regresar a la requisición', await page.getByText('Solicitud / Requisición del cliente').count() === 1);

    // Responsive
    await page.locator('#reqSubnav').getByRole('button', { name: /Catálogo de categorías/ }).click();
    await root.getByRole('tab', { name: /Matriz de categorías/ }).click();
    await page.setViewportSize({ width: 390, height: 860 });
    await page.waitForTimeout(400);
    check('responsive: sin desbordamiento horizontal', await page.evaluate(() => document.querySelector('[data-testid=category-catalog]').getBoundingClientRect().right <= window.innerWidth + 1));
    check('ninguna escritura intentada (solo GET)', blocked.length === 0, blocked.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, e.stack || String(e));
    await shot(page, 'cat-zz-error').catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nCatálogo de categorías UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
