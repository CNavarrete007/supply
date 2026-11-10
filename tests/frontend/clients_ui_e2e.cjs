// Clientes · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda
// petición /api que no sea GET (salvo login/logout) se aborta y hace fallar la prueba.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/clients_ui_e2e.cjs
const { chromium } = require('playwright');
const XLSX = require('xlsx');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const all = await (await page.request.get(UI + '/api/v1/matrix/clients')).json();
    const qa1 = all.items.find(c => c.code === 'QA01'); const qa2 = all.items.find(c => c.code === 'QA02');

    // Matriz (pestaña inicial)
    const listResp = page.waitForResponse(r => /\/api\/v1\/catalogs\/clients\?/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Clientes$/ }).click();
    check('matriz consulta catálogo (200)', (await listResp).status() === 200);
    for (const title of ['Registro y actualización', 'Matriz de clientes', 'Indicadores de clientes', 'Importar Excel'])
      check(`tarjeta "${title}" visible`, await page.getByRole('button', { name: new RegExp(title) }).first().isVisible());
    await page.getByText(qa1.name, { exact: true }).first().waitFor();
    check('matriz muestra clientes reales', await page.getByText(qa2.name, { exact: true }).first().isVisible());
    check('alta y nuevo cliente bloqueados', await page.getByRole('button', { name: /Nuevo cliente/ }).isDisabled());
    await shot(page, 'clientes_1_matriz');
    const searchResp = page.waitForResponse(r => /\/api\/v1\/catalogs\/clients\?.*q=Dos/.test(r.url()));
    await page.getByLabel('Buscar en catálogo').fill('Dos');
    check('búsqueda en servidor (200)', (await searchResp).status() === 200);
    await page.waitForTimeout(300);
    check('búsqueda filtra', await page.getByText(qa1.name, { exact: true }).count() === 0 && await page.getByText(qa2.name, { exact: true }).first().isVisible());
    await page.getByLabel('Buscar en catálogo').fill('');
    await page.getByText(qa1.name, { exact: true }).first().waitFor();
    const detResp = page.waitForResponse(r => /\/api\/v1\/catalogs\/clients\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('row').filter({ hasText: qa1.name }).getByRole('button', { name: /^Ver$/ }).click();
    check('detalle "Ver" (200)', (await detResp).status() === 200);
    await page.getByRole('dialog').getByText('Contacto Cliente QA').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: /^Cerrar$/ }).click();

    // Ficha desde la matriz
    await page.getByRole('row').filter({ hasText: qa1.name }).getByRole('button', { name: /Ficha/ }).click();
    await page.getByLabel('Razón social', { exact: true }).and(page.locator('input')).waitFor();
    await page.waitForFunction(n => [...document.querySelectorAll('input[readonly]')].some(i => i.value === n), qa1.name, { timeout: 10000 });
    const values = await page.locator('input[readonly]').evaluateAll(els => els.map(e => e.value));
    check('ficha carga datos reales', values.includes('QA01') && values.includes(qa1.name) && values.some(v => v.includes('Contacto Cliente QA')) && values.includes('compras@cliente.invalid'), values.join(' | '));
    check('guardar bloqueado y clave del portal no expuesta', await page.getByRole('button', { name: /Guardar cliente/ }).isDisabled() && await page.getByLabel('Clave del portal').inputValue() === '');
    await shot(page, 'clientes_2_ficha');
    await page.getByLabel('Seleccionar por número de cliente').selectOption({ label: 'QA02' });
    await page.waitForFunction(n => [...document.querySelectorAll('input[readonly]')].some(i => i.value === n), qa2.name, { timeout: 10000 });
    check('selector por número carga otra ficha', true);

    // Indicadores
    await page.getByRole('button', { name: /Indicadores de clientes/ }).first().click();
    await page.getByText('Clientes activos', { exact: true }).waitFor();
    const activeVal = await page.getByText('Clientes activos', { exact: true }).locator('xpath=preceding-sibling::div').textContent();
    const summary = (await (await page.request.get(UI + '/api/v1/catalogs/clients?page=1&page_size=1&q=&status=all')).json()).summary;
    const active = (summary.statuses.find(s => s.code === 'active') || { count: 0 }).count;
    check('indicador de activos coincide con MariaDB', Number(activeVal) === Number(active), `${activeVal} vs ${active}`);
    check('mayor actividad con requisiciones reales', await page.getByText(/requisiciones$/).first().isVisible());
    await shot(page, 'clientes_3_indicadores');

    // Importación: Excel real, validación local, sin guardado
    await page.getByRole('button', { name: /Importar Excel/ }).first().click();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Client number', 'Legal / company name', 'Brand name', 'RFC', 'Email', 'Contact', 'Project', 'Contract number'],
      ['qa01', 'Existe con minúsculas', '', '', '', '', 'P', 'C'],
      ['QA77', 'Cliente Nuevo QA', 'Nuevo', 'XAXX010101000', 'nuevo@cliente.invalid; otro@cliente.invalid', 'Ana; Luis', 'PRY-77', 'CTO-77'],
      ['QA78', '', '', '', 'mal-correo', '', '', ''],
      ['QA77', 'Repetido', '', '', '', '', 'P', 'C'],
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    await page.getByLabel('Archivo de clientes').setInputFiles({ name: 'clientes_qa.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) });
    const preview = page.getByTestId('import-preview');
    await preview.waitFor({ timeout: 15000 });
    const txt = await preview.textContent();
    check('importación detecta 4 filas', /Se detectaron 4 fila/.test(txt), txt.slice(0, 200));
    const card = async label => Number((await preview.getByText(label, { exact: true }).first().locator('xpath=preceding-sibling::div').textContent()).trim());
    check('nuevo=1, incompleto=1, existente=1, repetido=1', await card('Nuevo') === 1 && await card('Nuevo incompleto') === 1 && await card('Existe · se omitiría') === 1 && await card('Repetido en archivo') === 1);
    check('valores múltiples separados', txt.includes('nuevo@cliente.invalid, otro@cliente.invalid') && txt.includes('Ana, Luis'));
    await page.getByRole('combobox').filter({ hasText: 'Omitir duplicados existentes' }).selectOption('update');
    check('regla "actualizar existentes" recalcula', await card('Existe · se actualizaría') === 1);
    check('guardar en MariaDB bloqueado', await page.getByRole('button', { name: /Guardar en MariaDB/ }).isDisabled());
    await preview.scrollIntoViewIfNeeded();
    await shot(page, 'clientes_4_importacion');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar plantilla/ }).click()]);
    check('plantilla descargable', dl.suggestedFilename() === 'Plantilla_clientes_SupplyFlow.xlsx');

    check('sin escrituras a la API', writes.length === 0, writes.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/clientes_zz_error.png` }).catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nClientes UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
