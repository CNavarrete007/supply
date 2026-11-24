// Monedas · los selectores que guardan una moneda (Proveedores, Suministros, Registro de requisición) ofrecen SOLO las monedas
// dadas de alta en la base (GET /api/v1/catalogs/currencies), y un rechazo del servidor por moneda se explica en el campo.
// SOLO LECTURA: el rechazo se SIMULA en el navegador (route.fulfill) y cualquier otra escritura se aborta.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_USER=<correo>] [SF_SHOTS=<dir>] node tests/frontend/currencies_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const PREF = ['MXN', 'USD', 'EUR'];
const order = codes => [...codes].sort((a, b) => ((PREF.indexOf(a) + 1) || 9) - ((PREF.indexOf(b) + 1) || 9) || a.localeCompare(b));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  let rejectCurrency = false; const blocked = [];
  await context.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(path)) return route.continue();
    if (rejectCurrency && req.method() === 'POST' && path === '/api/v1/catalogs/suppliers') {
      return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INVALID_VALUE', field: 'currency',
        message: 'La moneda elegida no está dada de alta en el catálogo de monedas de esta base. Elige una de la lista; no se guardaron cambios.' } }) });
    }
    blocked.push(`${req.method()} ${path}`); return route.abort('blockedbyclient');
  });
  const nav = label => page.locator('nav button').filter({ hasText: new RegExp(`${label}$`) }).first().click();
  const values = sel => sel.locator('option').evaluateAll(o => o.map(x => x.value).filter(Boolean));
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill(USER);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const items = (await (await page.request.get(UI + '/api/v1/catalogs/currencies')).json()).items;
    const active = order(items.filter(i => i.active).map(i => i.code));
    check('GET /catalogs/currencies: monedas activas', active.length > 0, JSON.stringify(items));

    await nav('Proveedores'); await page.getByRole('button', { name: /Nuevo proveedor/ }).first().click();
    const sup = page.getByLabel('Moneda habitual', { exact: true });
    await page.waitForFunction(n => document.querySelectorAll('select[aria-label="Moneda habitual"] option[value]:not([value=""])').length === n, active.length, { timeout: 10000 }).catch(() => {});
    check('Proveedores: solo monedas dadas de alta', JSON.stringify(await values(sup)) === JSON.stringify(active), JSON.stringify(await values(sup)));

    await nav('Suministros de proveedores'); await page.getByRole('button', { name: /Nuevo suministro/ }).first().click();
    const off = page.getByTestId('offering-form').getByLabel('Moneda', { exact: true });
    await page.waitForTimeout(500);
    check('Suministros: solo monedas dadas de alta', JSON.stringify(await values(off)) === JSON.stringify(active), JSON.stringify(await values(off)));

    await nav('Solicitud \\/ Requisición');
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.getByRole('button', { name: /Nueva requisición/ }).first().click();
    await page.waitForTimeout(500);
    check('Registro de requisición: solo monedas dadas de alta', JSON.stringify(await values(page.locator('#rf1-currency'))) === JSON.stringify(active), JSON.stringify(await values(page.locator('#rf1-currency'))));

    // Rechazo del servidor por moneda (simulado): el aviso lo explica y el campo Moneda queda marcado.
    rejectCurrency = true;
    await nav('Proveedores'); await page.getByRole('button', { name: /Nuevo proveedor/ }).first().click();
    await page.getByLabel('No. de proveedor', { exact: true }).fill('QA-MONEDA-SIMULADA');
    await page.getByLabel('Razón social', { exact: true }).fill('Proveedor simulado (no se envía al servidor)');
    await page.getByLabel('Categoría', { exact: true }).fill('Materiales');
    await sup.selectOption(active[active.length - 1]);
    await page.getByTestId('save-message').waitFor({ timeout: 15000 });
    const msg = await page.getByTestId('save-message').innerText();
    check('rechazo por moneda: el aviso lo explica (no «intenta de nuevo»)', msg.includes('La moneda elegida no está dada de alta') && !msg.includes('intenta de nuevo'), msg);
    const fieldErr = await page.getByTestId('supplier-form').locator('p[role=alert]').allInnerTexts();
    check('rechazo por moneda: el campo Moneda queda marcado', fieldErr.some(t => t.includes('Valor no aceptado por el servidor')) && (await sup.getAttribute('class')).includes('border-rose'), JSON.stringify(fieldErr));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/monedas-rechazo.png` });

    check('ninguna escritura llegó al servidor', blocked.length === 0, blocked.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, e.stack || String(e));
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nMonedas (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
