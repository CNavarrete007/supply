// Requisición › Crear desde historial · E2E de interfaz (Chromium) contra Vite + API + MariaDB.
// Uso: SF_UI=http://127.0.0.1:5173 SF_USER=<correo> SF_QA_PASSWORD=<clave> [SF_SHOTS=<dir>] [SF_HISTORY_CLIENT=<código>] node tests/frontend/history_ui_e2e.cjs
// Garantía: toda petición /api que no sea GET se ABORTA (salvo login). Nada se escribe; apta para datos reales.
// Usa el primer cliente activo con historial aprobado (o SF_HISTORY_CLIENT).
const { chromium } = require('playwright');
const path = require('node:path');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const M = await import(path.resolve(__dirname, '../../src/views/recovery/historyModel.mjs'));
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
    const cat = await (await page.request.get(UI + '/api/v1/recovery/catalogs')).json();
    const activeCats = cat.categories.filter(c => c.active).map(c => c.name);
    let client = null, hist = null;
    for (const c of cat.clients.filter(c => c.status === 'active' && (!process.env.SF_HISTORY_CLIENT || c.code === process.env.SF_HISTORY_CLIENT))) {
      const d = await (await page.request.get(UI + '/api/v1/requisition-history/catalog?client=' + c.id)).json();
      if (d.items?.length) { client = c; hist = d; break; }
    }
    const day = M.emptyHistoryForm(new Date().toISOString().slice(0, 10)).request_date;

    await page.locator('nav button').filter({ hasText: /Solicitud \/ Requisición$/ }).first().click();
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.locator('#reqSubnav').getByRole('button', { name: /Crear desde historial/ }).click();
    const root = page.getByTestId('history-requisition');
    await root.waitFor();
    check('aviso RF1 menciona Crear desde historial', await page.getByText('Crear desde historial consulta la política').count() === 1);
    check('banner del original', await root.getByRole('heading', { name: /Nueva requisición desde historial del cliente/ }).count() === 1 && await root.getByText(/^No copia una requisición completa\./).count() === 1);
    check('4 pasos del original', JSON.stringify(await root.locator('.sf-hist-step b').allTextContents()) === JSON.stringify(['Cliente', 'Partidas', 'Ruta por partida', 'Nuevo expediente']));
    const labels = await root.locator('.sf-hist-grid label').allTextContents();
    check('campos generales del original', JSON.stringify(labels) === JSON.stringify(['Cliente *', 'Fecha de solicitud *', 'Fecha requerida *', 'Proyecto *', 'Contrato *', 'Referencia cliente', 'Prioridad', 'Lugar de entrega *', 'Solicitante *', 'Correo solicitante *', 'Moneda *', 'Presupuesto estimado', 'Descripción general']), JSON.stringify(labels));
    check('valores iniciales (fecha de hoy, MXN, Normal, descripción)', await page.locator('#hist-request_date').inputValue() === day && await page.locator('#hist-currency').inputValue() === 'MXN' && await page.locator('#hist-priority').inputValue() === 'normal' && await page.locator('#hist-description').inputValue() === 'Recompra / nueva solicitud construida desde historial');
    check('sin cliente: política y catálogo vacíos', (await root.getByTestId('hist-policy').innerText()) === 'Selecciona un cliente para consultar su política de recompra.' && (await root.getByTestId('hist-catalog').innerText()) === 'Selecciona un cliente.' && (await root.getByTestId('hist-count').innerText()) === '0 artículos/servicios');
    check('categorías del catálogo en filtro y partida nueva', JSON.stringify(await page.locator('#hist-new-category option').allTextContents()) === JSON.stringify(['Seleccionar categoría...', ...activeCats])
      && (await page.getByLabel('Categoría del historial').locator('option').allTextContents())[0] === 'Todas las categorías' && JSON.stringify(await page.getByLabel('Vigencia del historial').locator('option').allTextContents()) === JSON.stringify(['Todo el historial', 'Solo precios vigentes', 'Solo precios vencidos']));
    check('tabla de partidas seleccionadas del original', JSON.stringify(await root.locator('.sf-hist-table thead th').allTextContents()) === JSON.stringify(['Partida', 'Origen', 'Cantidad nueva', 'Unidad', 'Último precio cliente', 'Tratamiento precio cliente', 'Último proveedor/costo', 'Tratamiento proveedor', 'Acción'])
      && (await root.getByTestId('hist-selected').innerText()) === '0 seleccionadas' && await root.getByText('Agrega partidas desde el historial o captura una nueva.').count() === 1);
    check('partida nueva y botones del original', await page.locator('#hist-new-unit').getAttribute('placeholder') === 'pza, lote, servicio'
      && JSON.stringify((await root.locator('.toolbar button').allInnerTexts()).map(t => t.replace(/^\S+\s/, '').trim())) === JSON.stringify(['Crear requisición nueva', 'Limpiar', 'Ver matriz']));
    await root.getByRole('button', { name: /Crear requisición nueva/ }).click();
    check('validación: cliente obligatorio', (await root.getByTestId('hist-msg').innerText()) === 'Selecciona el cliente.');
    await shot(page, 'hist-01-inicio');

    check('existe un cliente activo con historial aprobado', !!client, 'sin historial en esta base');
    if (client) {
      const wait = page.waitForResponse(r => r.url().includes('/requisition-history/catalog?client=' + client.id), { timeout: 20000 });
      await page.locator('#hist-client').selectOption(client.id);
      check('GET historial del cliente → 200', (await wait).status() === 200);
      await root.getByTestId('hist-article').first().waitFor();
      check('datos del cliente precargados', await page.locator('#hist-project').inputValue() === (client.project || '') && await page.locator('#hist-requester_email').inputValue() === (client.email || ''));
      const policyText = await root.getByTestId('hist-policy').innerText();
      check('política de recompra de MariaDB', policyText.length > 0 && !/Selecciona un cliente/.test(policyText), policyText);
      check('catálogo: artículos de MariaDB', await root.getByTestId('hist-article').count() === hist.items.length && (await root.getByTestId('hist-count').innerText()) === `${hist.items.length} artículos/servicios`);
      const a0 = hist.items[0];
      const card = root.getByTestId('hist-article').filter({ hasText: a0.description }).first();
      check('tarjeta: último precio, proveedor y origen', (await card.innerText()).includes(M.money(a0.last.unit_price, a0.last.currency)) && (await card.innerText()).includes(a0.last.supplier || 'Sin proveedor adjudicado') && (await card.innerText()).includes(`Cotización ${a0.last.quote_folio}`));
      await page.getByLabel('Buscar en el historial').fill(a0.last.quote_folio);
      check('búsqueda por cotización', await root.getByTestId('hist-article').count() === M.filterArticles(hist.items, { query: a0.last.quote_folio }, hist.client.policy, day).length);
      await page.getByLabel('Buscar en el historial').fill('');
      await page.getByLabel('Vigencia del historial').selectOption('valid');
      const nValid = M.filterArticles(hist.items, { state: 'valid' }, hist.client.policy, day).length;
      check('filtro de vigencia', nValid ? await root.getByTestId('hist-article').count() === nValid : (await root.getByTestId('hist-catalog').innerText()).includes('Sin artículos'));
      await page.getByLabel('Vigencia del historial').selectOption('all');
      await shot(page, 'hist-02-catalogo');

      await card.getByRole('button', { name: /Agregar/ }).click();
      const line = root.getByTestId('hist-line').first();
      const expected = M.lineFromHistory(a0, hist.client.policy, day);
      check('agregar del historial: línea y tarjeta marcada', await root.getByTestId('hist-line').count() === 1 && (await root.getByTestId('hist-selected').innerText()) === '1 seleccionadas' && await card.getByRole('button', { name: /Agregada/ }).isDisabled());
      const priceSel = page.getByLabel('Tratamiento precio cliente 1'), supSel = page.getByLabel('Tratamiento proveedor 1');
      check('tratamientos por defecto según la política', await priceSel.inputValue() === expected.price_mode && await supSel.inputValue() === expected.sourcing_mode, `${await priceSel.inputValue()}/${await supSel.inputValue()} vs ${expected.price_mode}/${expected.sourcing_mode}`);
      const disabledFixed = await priceSel.locator('option[value=fixed]').evaluate(o => o.disabled);
      check('precio fijo solo con precio histórico vigente', disabledFixed === !!M.modeBlock(expected, 'price', 'fixed', hist.client.policy, day));
      check('cantidad nueva = última cantidad', await page.getByLabel('Cantidad nueva 1').inputValue() === expected.quantity);
      await page.getByLabel('Cantidad nueva 1').fill('3');
      await priceSel.selectOption('requote');
      check('cambiar tratamiento de precio', await priceSel.inputValue() === 'requote');

      // Partida nueva
      await root.getByRole('button', { name: /Agregar partida nueva/ }).last().click();
      check('partida nueva: validación', (await root.getByTestId('hist-item-msg').innerText()).startsWith('Completa descripción'));
      await page.locator('#hist-new-description').fill('Arnés de seguridad QA E2E');
      await page.locator('#hist-new-quantity').fill('2');
      await page.locator('#hist-new-unit').fill('pza');
      await page.locator('#hist-new-category').selectOption(activeCats[0]);
      await root.getByRole('button', { name: /Agregar partida nueva/ }).last().click();
      check('partida nueva: siempre se recotiza', await root.getByTestId('hist-line').count() === 2 && await page.getByLabel('Tratamiento precio cliente 2').isDisabled() && await page.getByLabel('Tratamiento precio cliente 2').inputValue() === 'requote' && await page.getByLabel('Tratamiento proveedor 2').inputValue() === 'requote');

      // Crear: valida y no crea
      await page.locator('#hist-need_date').fill('2030-12-31');
      if (!await page.locator('#hist-project').inputValue()) await page.locator('#hist-project').fill('PRY-QA');
      if (!await page.locator('#hist-contract').inputValue()) await page.locator('#hist-contract').fill('CTO-QA');
      await page.locator('#hist-delivery_place').fill('Almacén QA');
      if (!await page.locator('#hist-requester_name').inputValue()) await page.locator('#hist-requester_name').fill('Solicitante QA');
      if (!await page.locator('#hist-requester_email').inputValue()) await page.locator('#hist-requester_email').fill('qa@cliente.invalid');
      await root.getByRole('button', { name: /Crear requisición nueva/ }).click();
      const created = await root.getByTestId('hist-msg').innerText();
      check('crear: valida y no crea', created.startsWith(`Datos validados, pero no se creó la requisición nueva para «${client.name}» (2 partida(s): 1 del historial y 1 nueva(s)`), created);
      await shot(page, 'hist-03-partidas');
      await root.getByTestId('hist-line').nth(1).getByRole('button', { name: 'Quitar' }).click();
      check('quitar partida', await root.getByTestId('hist-line').count() === 1);

      await root.getByRole('button', { name: /Limpiar/ }).click();
      check('limpiar reinicia todo', await root.getByTestId('hist-line').count() === 0 && await page.locator('#hist-client').inputValue() === '' && (await root.getByTestId('hist-catalog').innerText()) === 'Selecciona un cliente.');
    }
    await root.getByRole('button', { name: /Ver matriz/ }).click();
    check('ver matriz', await page.getByText('Requisiciones por cliente').count() === 1);
    await page.locator('#reqSubnav').getByRole('button', { name: /Crear desde historial/ }).click();
    await page.setViewportSize({ width: 390, height: 860 });
    await page.waitForTimeout(400);
    check('responsive: sin desbordamiento horizontal', await page.evaluate(() => document.querySelector('[data-testid=history-requisition]').getBoundingClientRect().right <= window.innerWidth + 1));
    check('ninguna escritura intentada (solo GET)', blocked.length === 0, blocked.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, e.stack || String(e));
    await shot(page, 'hist-zz-error').catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nCrear desde historial UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
