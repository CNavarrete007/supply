// Requisición › Catálogo de categorías · E2E de interfaz (Chromium) contra Vite + API + MariaDB.
// Uso: SF_UI=http://127.0.0.1:5173 SF_USER=<correo> SF_QA_PASSWORD=<clave> [SF_SYNTHETIC_WRITES=1] [SF_SHOTS=<dir>] node tests/frontend/categories_ui_e2e.cjs
// Sin SF_SYNTHETIC_WRITES: toda petición /api que no sea GET se ABORTA (salvo login); comprueba que la pantalla no da por guardado
// lo que el servidor no confirmó y ofrece Reintentar. Nada se escribe; apto para datos reales.
// Con SF_SYNTHETIC_WRITES=1 (SOLO base sintética/desechable): además da de alta, edita, inactiva y elimina desde la interfaz una
// categoría "Categoría Sintética UI <RUN>" (respuesta perdida + Reintentar con la misma clave, versión vencida, lista de partidas,
// bitácora). Solo se dejan pasar escrituras sobre esa categoría; las de categorías reales se abortan igual que en modo lectura.
const { chromium } = require('playwright');
const { randomUUID } = require('crypto');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
const WRITES = process.env.SF_SYNTHETIC_WRITES === '1';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local y SF_QA_PASSWORD.'); process.exit(2); }
const C = '/api/v1/catalogs/categories';
const RUN = randomUUID().slice(0, 6).toUpperCase();
const SYNTH = `Categoría Sintética UI ${RUN}`;
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const blocked = [];            // escrituras abortadas (nunca llegan al servidor)
  const passed = [];             // escrituras sintéticas que sí llegaron al servidor: [método, clave de idempotencia]
  const synthCodes = new Set();  // códigos de la categoría sintética de esta corrida
  let loseNextResponse = false;  // simula una respuesta perdida DESPUÉS de que el servidor procesó la operación
  const synthetic = req => {
    if (!WRITES || !new URL(req.url()).pathname.startsWith(C)) return false;
    if (req.method() === 'POST') { try { return String(req.postDataJSON()?.name || '').startsWith(SYNTH); } catch { return false; } }
    return synthCodes.has(decodeURIComponent(new URL(req.url()).pathname.slice(C.length + 1)));
  };
  await context.route('**/api/**', async route => {
    const req = route.request();
    if (req.method() === 'GET' || /\/api\/v1\/auth\/login$/.test(req.url())) return route.continue();
    if (synthetic(req)) {
      passed.push([req.method(), req.headers()['idempotency-key']]);
      if (loseNextResponse) { loseNextResponse = false; await route.fetch(); return route.abort('connectionreset'); }
      return route.continue();
    }
    blocked.push(`${req.method()} ${new URL(req.url()).pathname}`); return route.abort('blockedbyclient');
  });
  const apiCats = async () => (await (await page.request.get(UI + C)).json()).items;
  const apiWrite = async (method, code, version, data) => {
    const tok = (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token;
    return page.request.fetch(UI + C + '/' + encodeURIComponent(code), { method, data, headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': tok, 'Idempotency-Key': randomUUID(), 'If-Match': `"${version}"` } });
  };
  let expectedBlocked = 0;
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
    check('aviso RF1: catálogo de categorías conectado', await page.getByText('Catálogo de categorías conectado').count() === 1);

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
    await form.getByRole('button', { name: /Guardar categoría/ }).click(); expectedBlocked++;
    await form.getByTestId('cat-retry').waitFor({ timeout: 10000 });
    check('guardar sin confirmación del servidor: no se da por guardado y ofrece Reintentar', (await form.getByTestId('cat-msg').innerText()).startsWith('No se confirmó la operación')
      && await page.locator('#cat-name').inputValue() === 'Equipos de izaje QA E2E' && !(await page.locator('#cat-name').isDisabled()));
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
      await form.getByRole('button', { name: /Guardar categoría/ }).click(); expectedBlocked++;
      await form.getByTestId('cat-retry').waitFor({ timeout: 10000 });
      check('editar categoría real: abortado, sigue en edición y ofrece Reintentar', (await form.getByTestId('cat-msg').innerText()).startsWith('No se confirmó la operación')
        && (await form.getByTestId('cat-mode').innerText()).startsWith('Modo edición activo') && await page.locator('#cat-status').inputValue() === 'inactive');
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
      await dlg.getByRole('button', { name: 'Eliminar categoría' }).click(); expectedBlocked++;
      await dlg.getByRole('button', { name: 'Reintentar eliminación' }).waitFor({ timeout: 10000 });
      check('eliminar categoría real: abortado, no se da por eliminada y ofrece reintentar', (await dlg.getByTestId('cat-del-msg').innerText()).startsWith('No se confirmó la operación'));
      await dlg.getByRole('button', { name: 'Cerrar' }).first().click();
      check('la categoría sigue en la matriz y en MariaDB', await rows.filter({ hasText: unused.name }).count() === 1 && (await apiCats()).some(c => c.code === unused.code));
    }

    // 3 · ¿Qué significa categoría?
    await root.getByRole('tab', { name: /¿Qué significa categoría\?/ }).click();
    const help = root.getByTestId('cat-help');
    check('ayuda: tarjetas del original', JSON.stringify(await help.locator('.sf-cat-card b').allTextContents()) === JSON.stringify(['Ejemplos de bienes', 'Ejemplos de servicios', '¿Para qué sirve?']));
    check('ayuda: reglas del original', JSON.stringify(await help.locator('.sf-cat-rule h4').allTextContents()) === JSON.stringify(['Regla para elegir una categoría', '¿Qué hago si no existe?', '¿Qué significa Inactiva?']));
    await shot(page, 'cat-04-ayuda');
    await help.getByRole('button', { name: /Agregar categoría/ }).click();
    check('agregar categoría abre la captura nueva', (await form.getByTestId('cat-mode').innerText()).startsWith('Modo nueva captura activo') && await page.locator('#cat-name').inputValue() === '');

    // 4 · Escritura real desde la interfaz (SOLO base sintética: SF_SYNTHETIC_WRITES=1)
    if (WRITES) {
      const opts = () => page.locator('#rf1-item-category option').allTextContents();
      const optionShown = (want) => page.waitForFunction(([n, w]) => [...document.querySelectorAll('#rf1-item-category option')].some(o => o.textContent === n) === w, [SYNTH, want], { timeout: 10000 }).catch(() => {});
      const openMatrixOn = async () => {
        await root.getByRole('tab', { name: /Matriz de categorías/ }).click();
        await matrix.getByLabel('Buscar categoría').fill(SYNTH);
        return rows.filter({ hasText: SYNTH });
      };
      // 4.1 Alta: la primera respuesta se pierde DESPUÉS de procesarse → Reintentar con la misma clave no duplica.
      await page.locator('#cat-name').fill(`  ${SYNTH}  `);
      await page.locator('#cat-description').fill('Alcance sintético de la prueba de interfaz.');
      loseNextResponse = true;
      await form.getByRole('button', { name: /Guardar categoría/ }).click();
      await form.getByTestId('cat-retry').waitFor({ timeout: 10000 });
      check('alta: respuesta perdida → no se da por guardada y ofrece Reintentar', (await form.getByTestId('cat-msg').innerText()).startsWith('No se confirmó la operación'));
      await form.getByTestId('cat-retry').click();
      await form.getByTestId('cat-msg').filter({ hasText: 'registrada en MariaDB' }).waitFor({ timeout: 10000 });
      const mine = (await apiCats()).filter(c => c.name === SYNTH);
      mine.forEach(c => synthCodes.add(c.code));
      const created = mine[0] || {};
      check('alta: Reintentar usa la misma clave y no duplica (una sola categoría en MariaDB)', mine.length === 1 && passed.length === 2 && !!passed[0][1] && passed[0][1] === passed[1][1], JSON.stringify(passed));
      check('alta: mensaje con el código y formulario limpio y bloqueado', (await form.getByTestId('cat-msg').innerText()) === `Categoría «${SYNTH}» registrada en MariaDB con el código ${created.code}. Ya aparece en la lista de categorías de las partidas.`
        && (await form.getByTestId('cat-mode').innerText()).startsWith('Formulario bloqueado') && await page.locator('#cat-name').inputValue() === '');
      check('alta: en MariaDB activa, sin uso y con el nombre normalizado', created.active === true && created.description === 'Alcance sintético de la prueba de interfaz.' && Object.values(created.usage || {}).every(n => !n));
      await shot(page, 'cat-05-alta');
      await form.getByRole('button', { name: /Regresar a la requisición/ }).click();
      await optionShown(true);
      check('Registro de requisición: la nueva categoría ya se ofrece en las partidas (sin recargar)', (await opts()).includes(SYNTH));
      await page.locator('#reqSubnav').getByRole('button', { name: /Catálogo de categorías/ }).click();
      await root.getByTestId('cat-form-panel').waitFor();

      // 4.2 Edición: inactivar y cambiar la descripción.
      const synthRow = await openMatrixOn();
      await synthRow.waitFor();
      const c0 = await synthRow.locator('td').allInnerTexts();
      check('matriz: la nueva categoría aparece Activa con 0 partida(s)', c0[0] === SYNTH && c0[1] === 'Alcance sintético de la prueba de interfaz.' && c0[2].toLowerCase() === 'activa' && c0[3] === '0 partida(s)', JSON.stringify(c0));
      await synthRow.getByRole('button', { name: 'EDITAR' }).click();
      await page.locator('#cat-status').selectOption('inactive');
      await page.locator('#cat-description').fill('Alcance sintético actualizado.');
      await form.getByRole('button', { name: /Guardar categoría/ }).click();
      await form.getByTestId('cat-msg').filter({ hasText: 'guardados en MariaDB' }).waitFor({ timeout: 10000 });
      const edited = (await apiCats()).find(c => c.code === created.code) || {};
      check('editar: cambios guardados en MariaDB (inactiva, descripción) con versión nueva', (await form.getByTestId('cat-msg').innerText()).startsWith(`Cambios de «${SYNTH}» guardados en MariaDB`)
        && edited.active === false && edited.description === 'Alcance sintético actualizado.' && edited.version !== created.version, JSON.stringify(edited));
      await form.getByRole('button', { name: /Regresar a la requisición/ }).click();
      await optionShown(false);
      check('Registro de requisición: la categoría inactiva deja de ofrecerse', !(await opts()).includes(SYNTH));
      await page.locator('#reqSubnav').getByRole('button', { name: /Catálogo de categorías/ }).click();
      await root.getByTestId('cat-form-panel').waitFor();

      // 4.3 Versión vencida: otro usuario la cambia mientras está abierta en edición → no se sobrescribe.
      await (await openMatrixOn()).getByRole('button', { name: 'EDITAR' }).click();
      const other = await apiWrite('PUT', created.code, edited.version, { name: SYNTH, description: 'Cambio concurrente sintético.', status: 'active' });
      check('cambio concurrente (otra sesión): 200', other.status() === 200);
      await page.locator('#cat-description').fill('Cambio que debe rechazarse.');
      await form.getByRole('button', { name: /Guardar categoría/ }).click();
      await form.getByTestId('cat-msg').filter({ hasText: 'versión vigente' }).waitFor({ timeout: 10000 });
      check('versión vencida: no sobrescribe y abre la versión vigente para reaplicar cambios', (await form.getByTestId('cat-msg').innerText()).includes('Se abrió la versión vigente de MariaDB')
        && (await form.getByTestId('cat-mode').innerText()).startsWith('Modo edición activo') && await page.locator('#cat-description').inputValue() === 'Cambio concurrente sintético.'
        && await page.locator('#cat-status').inputValue() === 'active' && (await apiCats()).find(c => c.code === created.code)?.description === 'Cambio concurrente sintético.');
      await form.getByRole('button', { name: /Limpiar/ }).click();

      // 4.4 Eliminación de una categoría nunca usada, con confirmación por nombre.
      await (await openMatrixOn()).getByRole('button', { name: 'ELIMINAR' }).click();
      const dlg2 = page.getByRole('dialog');
      await dlg2.locator('#cat-del-typed').fill(SYNTH);
      await dlg2.getByRole('button', { name: 'Eliminar categoría' }).click();
      await matrix.getByTestId('cat-notice').waitFor({ timeout: 10000 });
      await rows.filter({ hasText: SYNTH }).first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
      check('eliminar: aviso, cierra el diálogo y la fila desaparece', (await matrix.getByTestId('cat-notice').innerText()) === `Categoría «${SYNTH}» eliminada de MariaDB (nunca se usó).`
        && await rows.filter({ hasText: SYNTH }).count() === 0 && await page.getByRole('dialog').count() === 0);
      check('eliminar: ya no existe en MariaDB', !(await apiCats()).some(c => c.code === created.code));
      const log = (await (await page.request.get(UI + '/api/v1/audit-events?module=catalogs&page_size=50')).json()).items || [];
      const acts = new Set(log.filter(x => (x.changes || []).some(ch => String(ch.value || '').includes(created.code))).map(x => x.action));
      check('bitácora: alta, edición y eliminación auditadas', ['category.create', 'category.update', 'category.delete'].every(a => acts.has(a)), [...acts].join(','));
      await matrix.getByLabel('Buscar categoría').fill('');
      await root.getByRole('tab', { name: /Nueva \/ editar categoría/ }).click();
    }

    // Regresar a la requisición
    await form.getByRole('button', { name: /Regresar a la requisición/ }).click();
    check('regresar a la requisición', await page.getByText('Solicitud / Requisición del cliente').count() === 1);

    // Responsive
    await page.locator('#reqSubnav').getByRole('button', { name: /Catálogo de categorías/ }).click();
    await root.getByRole('tab', { name: /Matriz de categorías/ }).click();
    await page.setViewportSize({ width: 390, height: 860 });
    await page.waitForTimeout(400);
    check('responsive: sin desbordamiento horizontal', await page.evaluate(() => document.querySelector('[data-testid=category-catalog]').getBoundingClientRect().right <= window.innerWidth + 1));
    check('escrituras sobre categorías reales: todas abortadas antes de llegar al servidor', blocked.length === expectedBlocked && blocked.every(b => b.includes(C)), blocked.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, e.stack || String(e));
    await shot(page, 'cat-zz-error').catch(() => {});
  } finally {
    if (WRITES) { // limpieza si algo falló a medias: solo la categoría sintética de esta corrida y sin uso
      try {
        for (const c of (await apiCats()).filter(c => c.name.startsWith(SYNTH) && Object.values(c.usage || {}).every(n => !n))) await apiWrite('DELETE', c.code, c.version);
        check('sin categorías sintéticas al terminar', !(await apiCats()).some(c => c.name.startsWith(SYNTH)));
      } catch (e) { check('limpieza de la categoría sintética', false, String(e)); }
    }
    await browser.close();
  }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nCatálogo de categorías UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
