// Proveedores · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda
// petición /api que no sea GET (salvo login/logout) se aborta y hace fallar la prueba.
// Requiere los proveedores sintéticos PRV-QA-01..07 y PRV-QA-B001..B055 (más de 50 para probar la carga por páginas).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/suppliers_ui_e2e.cjs
const { chromium } = require('playwright');
const XLSX = require('xlsx');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const readonlyValues = page => page.locator('input[readonly]').evaluateAll(els => els.map(e => e.value));
const waitValue = (page, v) => page.waitForFunction(x => [...document.querySelectorAll('input[readonly]')].some(i => i.value === x), v, { timeout: 15000 });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  const listCalls = [];
  page.on('request', r => { if (/\/api\/v1\/catalogs\/suppliers\?/.test(r.url())) listCalls.push(new URL(r.url()).search); });
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
    const api = async p => (await page.request.get(UI + p)).json();
    const head = await api('/api/v1/catalogs/suppliers?page=1&page_size=1&q=&status=all');
    const total = head.summary.total;
    check('base sintética con más de 50 proveedores', total > 50, String(total));

    // Matriz (pestaña inicial)
    const listResp = page.waitForResponse(r => /\/api\/v1\/catalogs\/suppliers\?page=1&page_size=25/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Proveedores$/ }).click();
    check('matriz consulta catálogo (200)', (await listResp).status() === 200);
    // Clic inmediato en "siguiente" (antes de que se dispare el debounce de la búsqueda): la página 2 debe conservarse.
    const p2 = page.waitForResponse(r => /\/api\/v1\/catalogs\/suppliers\?page=2&page_size=25/.test(r.url()));
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    check('página 2 (200)', (await p2).status() === 200);
    await page.waitForTimeout(700);
    check('la página 2 se conserva tras el debounce de búsqueda', await page.getByText(/^Página 2 \//).isVisible());
    await page.getByRole('button', { name: 'Página anterior' }).click();
    for (const title of ['Registro y actualización', 'Matriz de proveedores', 'Evaluación e indicadores', 'Importar Excel'])
      check(`tarjeta "${title}" visible`, await page.getByRole('button', { name: new RegExp(title) }).first().isVisible());
    const row = page.getByRole('row').filter({ hasText: 'Aceros Sintéticos del Norte' });
    await row.waitFor();
    const rowText = (await row.textContent()).replace(/\s+/g, ' ');
    check('fila con datos reales (clave, RFC, categoría, estatus, suministros, entrega, crédito, calificación)',
      ['PRV-QA-02', 'ACS', 'ASN010101AB1', 'Materiales', 'Autorizado', '5 días hábiles', 'Crédito', '30 días', '4.6', 'Laura Ficticia', 'ventas@aceros.invalid'].every(t => rowText.includes(t)), rowText);
    check('columna suministros = conteo real de ofertas', (await row.locator('td').nth(6).textContent()).trim() === '3');
    check('paginación en servidor', await page.getByText(new RegExp(`Página 1 / ${Math.ceil(total / 25)}`)).isVisible());
    check('nuevo proveedor y eliminar bloqueados', await page.getByRole('button', { name: /Nuevo proveedor/ }).isDisabled() && await row.getByRole('button', { name: /Eliminar/ }).isDisabled());
    await shot(page, 'proveedores_1_matriz');
    const searchResp = page.waitForResponse(r => /\/api\/v1\/catalogs\/suppliers\?.*q=Europa/.test(r.url()));
    await page.getByLabel('Buscar en catálogo').fill('Europa');
    check('búsqueda en servidor (200)', (await searchResp).status() === 200);
    await page.getByText('Instrumentos Europa Sintética', { exact: true }).waitFor();
    check('búsqueda filtra', await page.getByText('Aceros Sintéticos del Norte', { exact: true }).count() === 0);
    await page.getByLabel('Buscar en catálogo').fill('');
    await row.waitFor();
    const stResp = page.waitForResponse(r => /\/api\/v1\/catalogs\/suppliers\?.*status=suspended/.test(r.url()));
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('suspended');
    check('filtro de estatus en servidor (200)', (await stResp).status() === 200);
    await page.getByText('Servicios Ficticios de Mantenimiento', { exact: true }).waitFor();
    check('filtro muestra solo suspendidos', await page.getByText('Aceros Sintéticos del Norte', { exact: true }).count() === 0);
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('all');
    await row.waitFor();
    const detResp = page.waitForResponse(r => /\/api\/v1\/catalogs\/suppliers\/[0-9a-f-]{36}$/.test(r.url()));
    await row.getByRole('button', { name: /^Ver$/ }).click();
    check('detalle "Ver" (200)', (await detResp).status() === 200);
    await page.getByRole('dialog').getByText('Mario Prueba').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: /^Cerrar$/ }).click();

    // Ficha desde la matriz
    await row.getByRole('button', { name: /Ficha/ }).click();
    await waitValue(page, 'Aceros Sintéticos del Norte');
    const v = await readonlyValues(page);
    const expected = ['PRV-QA-02', 'ACS', 'ASN010101AB1', 'Laura Ficticia · Ventas · principal', 'Mario Prueba · Crédito y cobranza', 'ventas@aceros.invalid', 'cxc@aceros.invalid', '+52 81 0000 0001', 'Materiales', 'Autorizado', 'MXN', 'Crédito', '30', '5', 'días hábiles', '4.6 / 5', 'Opinión SAT vigente; ISO 9001 (sintético)'];
    const missing = expected.filter(x => !v.includes(x));
    check('ficha carga todos los datos reales', missing.length === 0, `faltan: ${missing.join(' | ')}`);
    check('observaciones del registro', await page.locator('textarea[readonly]').inputValue() === 'Proveedor sintético para QA de matriz.');
    check('guardar bloqueado', await page.getByRole('button', { name: /Guardar proveedor/ }).isDisabled());
    // Catálogo completo cargado por páginas de 50 (sin superar el límite del servidor)
    await page.waitForFunction(n => document.querySelectorAll('select[aria-label="Seleccionar por número de proveedor"] option').length === n + 1, total, { timeout: 20000 });
    check('selectores con el catálogo completo (páginas de 50)', listCalls.some(s => s.includes('page=2&page_size=50')) && !listCalls.some(s => /page_size=([5-9]\d|\d{3,})/.test(s) && !s.includes('page_size=50')));
    await shot(page, 'proveedores_2_ficha');
    const sel = await api('/api/v1/catalogs/suppliers?page=1&page_size=5&q=Instrumentos&status=all');
    await page.getByLabel('Seleccionar por razón social').selectOption(sel.items[0].id);
    await waitValue(page, 'XEXX010101000');
    const v2 = await readonlyValues(page);
    check('selector por razón social carga otra ficha', ['PRV-QA-07', 'EUR', 'Crédito', '60', 'semanas', '5 / 5', 'sales@instrumentos.invalid'].every(x => v2.includes(x)), v2.join(' | '));
    const inc = await api('/api/v1/catalogs/suppliers?page=1&page_size=5&q=Incompleto&status=all');
    await page.getByLabel('Seleccionar por razón social').selectOption(inc.items[0].id);
    await waitValue(page, 'PRV-QA-06');
    check('ficha incompleta: aviso y estatus heredado', await page.getByText('Proveedor con datos pendientes de actualizar').isVisible() && (await readonlyValues(page)).includes('En evaluación · Pendiente de actualizar'));

    // Indicadores
    await page.getByRole('button', { name: /Evaluación e indicadores/ }).first().click();
    await page.getByText('Autorizados', { exact: true }).waitFor();
    const num = async label => Number((await page.getByText(label, { exact: true }).locator('xpath=preceding-sibling::span').textContent()).trim());
    const cnt = code => Number((head.summary.statuses.find(s => s.code === code) || { count: 0 }).count);
    check('autorizados / en evaluación / suspendidos coinciden con MariaDB',
      await num('Autorizados') === cnt('authorized') && await num('En evaluación') === cnt('under_evaluation') + cnt('evaluation') && await num('Suspendidos') === cnt('suspended'),
      `${await num('Autorizados')}/${await num('En evaluación')}/${await num('Suspendidos')}`);
    let all = []; for (let p = 1; all.length < total; p++) all = all.concat((await api(`/api/v1/catalogs/suppliers?page=${p}&page_size=50&q=&status=all`)).items);
    const rated = all.filter(s => s.rating !== null).map(s => Number(s.rating));
    const avg = Math.round(rated.reduce((a, b) => a + b, 0) / rated.length * 10) / 10;
    const offers = all.reduce((n, s) => n + s.offerings_count, 0);
    await page.getByText(new RegExp(`proveedor\\(es\\) calificado`)).waitFor({ timeout: 20000 });
    const body = await page.locator('main').textContent();
    check('calificación promedio sobre el catálogo completo', body.includes(`${avg} (${rated.length} proveedor(es) calificado(s)`), `${avg}/${rated.length}`);
    check('productos y servicios registrados', body.includes(`${offers} (en ${all.filter(s => s.offerings_count > 0).length} proveedor(es))`), String(offers));
    check('pendientes de actualización', body.includes(String(head.summary.incomplete)) && body.includes('Proveedor(es) con datos pendientes de actualización.'));
    check('distribución por categoría', await page.getByText('Proveedores por categoría').isVisible() && body.includes('Fletes'));
    await shot(page, 'proveedores_3_indicadores');

    // Importación: Excel real, validación local, sin guardado
    await page.getByRole('button', { name: /Importar Excel/ }).first().click();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Provider number', 'Clave', 'Legal / company name', 'RFC', 'Email', 'Contact', 'Phone', 'Category', 'Currency'],
      ['prv-qa-02', '', 'Existe por número', '', '', '', '', 'Materiales', 'MXN'],
      ['NUEVO-RFC', '', 'Existe por RFC', 'epi020202cd2', '', '', '', 'Equipos', 'USD'],
      ['PRV-QA-90', 'N90', 'Proveedor Nuevo QA', 'PNQ900101AA0', 'v1@nuevo.invalid; v2@nuevo.invalid', 'Ana; Luis', '+52 55 0000 0090', 'Materiales', 'usd'],
      ['PRV-QA-91', '', 'Sin categoría QA', '', '', '', '', '', ''],
      ['PRV-QA-92', '', 'Correo malo QA', '', 'mal-correo', '', '', 'Servicios', 'MXN'],
      ['PRV-QA-90', '', 'Repetido en archivo', '', '', '', '', 'Materiales', 'MXN'],
    ]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');
    await page.getByLabel('Archivo de proveedores').setInputFiles({ name: 'proveedores_qa.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) });
    const preview = page.getByTestId('import-preview');
    await preview.waitFor({ timeout: 15000 });
    const txt = await preview.textContent();
    check('importación detecta 6 filas y 9 columnas', /Se detectaron 6 fila\(s\); 9 de 9 columna/.test(txt), txt.slice(0, 200));
    const card = async label => Number((await preview.getByText(label, { exact: true }).first().locator('xpath=preceding-sibling::div').textContent()).trim());
    check('nuevo=1, incompleto=2, existente=2, repetido=1',
      await card('Nuevo') === 1 && await card('Nuevo incompleto') === 2 && await card('Existe · se omitiría') === 2 && await card('Repetido en archivo') === 1);
    check('coincidencia por No. de proveedor y por RFC', txt.includes('por No. de proveedor · PRV-QA-02') && txt.includes('por RFC · PRV-QA-03'));
    check('valores múltiples y moneda normalizada', txt.includes('v1@nuevo.invalid, v2@nuevo.invalid') && txt.includes('Ana, Luis') && txt.includes('USD'));
    await page.getByRole('combobox').filter({ hasText: 'Omitir duplicados existentes' }).selectOption('update');
    check('regla "actualizar existentes" recalcula', await card('Existe · se actualizaría') === 2);
    await page.getByPlaceholder('Ej. General').fill('General');
    check('categoría predeterminada completa la fila sin categoría', await card('Nuevo') === 2 && await card('Nuevo incompleto') === 1);
    check('guardar en MariaDB bloqueado', await page.getByRole('button', { name: /Guardar en MariaDB/ }).isDisabled());
    await preview.scrollIntoViewIfNeeded();
    await shot(page, 'proveedores_4_importacion');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar plantilla/ }).click()]);
    check('plantilla descargable', dl.suggestedFilename() === 'Plantilla_proveedores_SupplyFlow.xlsx');

    check('sin escrituras a la API', writes.length === 0, writes.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/proveedores_zz_error.png` }).catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nProveedores UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
