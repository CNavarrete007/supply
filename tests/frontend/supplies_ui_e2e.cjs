// Suministros de proveedores · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda
// petición /api que no sea GET (salvo login/logout) se aborta y hace fallar la prueba. Los valores esperados se
// calculan desde la API (requiere suministros sintéticos de PRV-QA-02, PRV-QA-03 y PRV-QA-07).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/supplies_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
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
    const api = async p => (await page.request.get(UI + p)).json();
    const head = await api('/api/v1/catalogs/supplier-offerings?page=1&page_size=50');
    const aceros = head.summary.suppliers.find(s => s.code === 'PRV-QA-02');

    const first = page.waitForResponse(r => /\/api\/v1\/catalogs\/supplier-offerings\?page=1&page_size=25/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Suministros de proveedores$/ }).click();
    check('matriz consulta suministros (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Registro de suministro', 'Matriz de suministros', 'Resumen comercial']) check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t) }).first().isVisible());
    await page.getByText(`${head.total} registros mostrados`).waitFor();
    check('tarjeta "Vista general" con totales reales', (await page.getByRole('button', { name: /Vista general/ }).innerText()).replace(/\s+/g, ' ').includes(`${head.summary.total} Registros`));
    const card = page.getByRole('button', { name: new RegExp(aceros.name) });
    check('tarjeta por proveedor (registros/activos/otros)', (await card.innerText()).replace(/\s+/g, ' ').includes(`${aceros.total} Registros ${aceros.active} Activos ${aceros.total - aceros.active} Otros`));
    const row = page.getByRole('row').filter({ hasText: 'Placa A36' });
    const rt = (await row.innerText()).replace(/\s+/g, ' ');
    check('fila con tipo, categoría, marca, entrega, crédito y estatus reales', ['Aceros Sintéticos del Norte', 'Producto', 'Materiales', 'AceroQA', '5 días hábiles', 'Crédito · 30 días', 'Activo'].every(x => rt.includes(x)), rt);
    check('nuevo suministro bloqueado', await page.getByRole('button', { name: /Nuevo suministro/ }).isDisabled());
    await shot(page, 'suministros_1_matriz');
    const byCard = page.waitForResponse(r => new RegExp(`supplier=${aceros.id}`).test(r.url()));
    await card.click();
    check('tarjeta filtra por proveedor en el servidor (200)', (await byCard).status() === 200);
    await page.getByText(`${aceros.total} registros mostrados`).waitFor();
    check('solo suministros del proveedor', await page.getByRole('row').filter({ hasText: 'Manómetro' }).count() === 0);
    await page.getByRole('button', { name: /Vista general/ }).click();
    const stResp = page.waitForResponse(r => /status=unavailable/.test(r.url()));
    await page.getByLabel('Estatus').selectOption('unavailable');
    check('filtro de estatus en el servidor (200)', (await stResp).status() === 200);
    await page.getByText('1 registros mostrados').waitFor();
    check('estatus "No disponible" traducido', (await page.getByRole('row').filter({ hasText: 'Compresor 5 HP' }).innerText()).includes('No disponible'));
    await page.getByLabel('Estatus').selectOption('all');
    const qResp = page.waitForResponse(r => /q=termopar/i.test(r.url()));
    await page.getByLabel('Buscar suministros').fill('termopar');
    check('búsqueda en el servidor (200)', (await qResp).status() === 200);
    await page.getByText('1 registros mostrados').waitFor();
    await page.getByLabel('Buscar suministros').fill('');
    await page.getByText(`${head.total} registros mostrados`).waitFor();

    // Ficha desde la matriz
    await page.getByRole('row').filter({ hasText: 'Placa A36' }).getByRole('button', { name: /^Ver$/ }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('input[readonly]')].some(i => i.value === 'A36-1/4'));
    const vals = await page.locator('input[readonly]').evaluateAll(els => els.map(e => e.value));
    check('ficha con datos reales', ['Producto', 'Materiales', 'AceroQA', 'A36-1/4', '5 días hábiles', 'Crédito · 30 días', 'MXN', '1 tonelada', '2026-12-31', 'Nacional', 'Activo'].every(x => vals.includes(x)), vals.join(' | '));
    check('banner "precios únicamente mediante cotización" y guardar bloqueado', await page.getByText(/Precios únicamente mediante cotización/).isVisible() && await page.getByRole('button', { name: /Guardar suministro/ }).isDisabled());
    await shot(page, 'suministros_2_ficha');

    // Resumen comercial
    await page.getByRole('button', { name: /Resumen comercial/ }).first().click();
    await page.getByLabel('Proveedor del resumen').selectOption(aceros.id);
    const sum = page.getByTestId('commercial-summary');
    await sum.getByText('Suministros registrados').waitFor();
    const kpi = async l => (await sum.getByText(l, { exact: true }).locator('xpath=preceding-sibling::span[1]').innerText()).trim();
    const sup = (await api(`/api/v1/catalogs/suppliers/${aceros.id}`)).item;
    check('KPIs: registrados, categorías, entrega promedio (solo días), crédito y calificación', await kpi('Suministros registrados') === String(aceros.total) && await kpi('Categorías') === '2' && await kpi('Entrega promedio') === '4' && await kpi('Días de crédito habitual') === String(sup.credit_days) && Number(await kpi('Calificación')) === Number(sup.rating),
      `${await kpi('Suministros registrados')}|${await kpi('Categorías')}|${await kpi('Entrega promedio')}|${await kpi('Días de crédito habitual')}|${await kpi('Calificación')}`);
    const st = await sum.innerText();
    const line = label => (st.split('\n').find(l => l.startsWith(label)) || '');
    const same = (text, list) => text.split(': ')[1]?.split(' / ').sort().join('|') === [...list].sort().join('|');
    check('detalle: moneda, entrega y crédito habituales, tipos de crédito y cobertura', line('Moneda habitual:') === `Moneda habitual: ${sup.currency}` && line('Crédito habitual:').includes(`${sup.credit_days} días`)
      && same(line('Tipos de crédito:'), ['Crédito', 'Contado']) && same(line('Cobertura:'), ['Nacional', 'Tamaulipas']) && st.includes('2 de 3 con tiempo en días'), st.split('\n').slice(-12).join(' | '));
    await shot(page, 'suministros_3_resumen');

    check('sin escrituras a la API', writes.length === 0, writes.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/suministros_zz_error.png` }).catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nSuministros UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
