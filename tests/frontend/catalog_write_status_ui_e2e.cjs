// Catálogos · aviso de guardado no habilitado (Clientes, Proveedores, Suministros, Categorías) · E2E de interfaz (Chromium).
// SOLO LECTURA: la respuesta de GET /api/v1/catalogs/write-status y la de un POST de cliente se SIMULAN en el navegador
// (route.fulfill) para cubrir cada causa sin tocar la configuración del servidor; cualquier otra escritura se aborta.
// Comprueba: sin aviso cuando el guardado está habilitado (estado real), el aviso de cada causa en las 4 pantallas y que, si el
// servidor rechaza un guardado por configuración, el guardado automático se pausa (un solo intento) con un mensaje claro.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_USER=<correo>] [SF_EXPECT_REAL_OK=1] [SF_SHOTS=<dir>] node tests/frontend/catalog_write_status_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const STATUS = code => ({ enabled: false, code, expected_grants: 33, missing_grants: code === 'CATALOG_WRITE_GRANTS_INCOMPLETE' ? ['INSERT clients', 'UPDATE clients'] : [], read_only: true });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  let mockStatus = null, mockPost = null; const posts = [], blocked = [];
  await context.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path === '/api/v1/catalogs/write-status' && mockStatus) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockStatus) });
    if (req.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(path)) return route.continue();
    if (req.method() === 'POST' && path === '/api/v1/catalogs/clients' && mockPost) { posts.push(Date.now()); return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify(mockPost) }); }
    blocked.push(`${req.method()} ${path}`); return route.abort('blockedbyclient');
  });
  const nav = label => page.locator('nav button').filter({ hasText: new RegExp(`${label}$`) }).first().click();
  const banner = () => page.getByTestId('catalog-write-status');
  const openClients = async () => { await nav('Clientes'); await page.getByRole('button', { name: /Nuevo cliente/ }).first().click(); await page.getByTestId('client-form').waitFor(); };
  const fresh = async () => { await page.reload(); await page.locator('nav button').first().waitFor({ timeout: 20000 }); }; // reinicia la caché del estado
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill(USER);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });

    // Estado REAL del servidor.
    const real = await (await page.request.get(UI + '/api/v1/catalogs/write-status')).json();
    await openClients();
    await page.waitForTimeout(800);
    if (real.enabled) check('estado real habilitado: Clientes sin aviso', await banner().count() === 0);
    else check(`estado real ${real.code}: Clientes muestra el aviso`, (await banner().getAttribute('data-code')) === real.code);
    if (process.env.SF_EXPECT_REAL_OK === '1') check('estado real: OK', real.code === 'OK', real.code);

    // API iniciada sin el overlay: aviso en las cuatro pantallas.
    mockStatus = STATUS('CATALOG_WRITE_NOT_PROVISIONED'); await fresh();
    await openClients(); await banner().waitFor({ timeout: 10000 });
    const t = await banner().innerText();
    check('Clientes: aviso al abrir la ficha (sin overlay)', t.includes('El guardado de clientes no está habilitado en este equipo') && t.includes('compose.supply-catalogwrite.yml')
      && t.includes('docs/clientes/ALTA_EDICION_CLIENTES.md'), t);
    check('el aviso está arriba de la ficha (antes de capturar)', await page.evaluate(() => {
      const b = document.querySelector('[data-testid=catalog-write-status]'), f = document.querySelector('[data-testid=client-form] input');
      return !!b && !!f && b.getBoundingClientRect().top < f.getBoundingClientRect().top;
    }));
    await shot(page, 'status-01-clientes');
    await nav('Proveedores'); await page.getByRole('button', { name: /Nuevo proveedor/ }).first().click(); await banner().waitFor({ timeout: 10000 });
    check('Proveedores: aviso con la entidad correcta', (await banner().innerText()).includes('El guardado de proveedores no está habilitado'));
    await nav('Suministros de proveedores'); await page.getByRole('button', { name: /Nuevo suministro/ }).first().click(); await banner().waitFor({ timeout: 10000 });
    check('Suministros: aviso con la entidad correcta', (await banner().innerText()).includes('El guardado de suministros no está habilitado'));
    await nav('Solicitud \\/ Requisición');
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.locator('#reqSubnav').getByRole('button', { name: /Catálogo de categorías/ }).click();
    await banner().waitFor({ timeout: 10000 });
    check('Categorías: aviso con el estilo del módulo', (await banner().innerText()).includes('El guardado de categorías no está habilitado') && (await banner().getAttribute('class')).includes('note warn'));
    await shot(page, 'status-02-categorias');

    // Cuenta rechazada y permisos incompletos (Clientes).
    mockStatus = STATUS('CATALOG_WRITE_ACCOUNT_REJECTED'); await fresh(); await openClients(); await banner().waitFor({ timeout: 10000 });
    check('cuenta rechazada: aviso específico', (await banner().innerText()).includes('MariaDB rechazó la cuenta de escritura del catálogo') && (await banner().innerText()).includes('provision y verify'));
    mockStatus = STATUS('CATALOG_WRITE_GRANTS_INCOMPLETE'); await fresh(); await openClients(); await banner().waitFor({ timeout: 10000 });
    check('permisos incompletos: lista los que faltan', (await banner().innerText()).includes('Faltan 2 de 33 permisos (INSERT clients, UPDATE clients)'));

    // El servidor rechaza el guardado por configuración: un solo intento automático, mensaje claro y pausa.
    mockStatus = { enabled: true, code: 'OK', expected_grants: 33, missing_grants: [], read_only: true };
    mockPost = { error: { code: 'CATALOG_WRITE_ACCOUNT_REJECTED', message: 'MariaDB rechazó la cuenta de escritura del catálogo.' } };
    await fresh(); await openClients();
    check('sin aviso previo cuando el estado es OK', await banner().count() === 0);
    await page.getByLabel('No. de cliente', { exact: true }).fill('QA-AVISO-SIMULADO');
    await page.getByLabel('Razón social', { exact: true }).fill('Cliente simulado (no se envía al servidor)');
    await page.getByLabel('Proyecto', { exact: true }).fill('PRY-SIM');
    await page.getByLabel('Número de contrato', { exact: true }).fill('CTR-SIM');
    await page.getByTestId('save-message').waitFor({ timeout: 10000 });
    await page.waitForTimeout(4000); // tiempo suficiente para que un reintento automático ocurriera
    const msg = await page.getByTestId('save-message').innerText();
    check('al guardar: mensaje de configuración (no «intenta de nuevo»)', msg.includes('MariaDB rechazó la cuenta de escritura del catálogo. No se guardó nada.') && !msg.includes('intenta de nuevo'), msg);
    check('guardado automático en pausa: un solo intento', posts.length === 1, String(posts.length));
    await shot(page, 'status-03-guardado-rechazado');
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    await page.waitForTimeout(1200);
    check('«Guardar cliente» permite reintentar a mano', posts.length === 2, String(posts.length));

    check('ninguna escritura llegó al servidor', blocked.length === 0, blocked.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, e.stack || String(e));
    await shot(page, 'status-zz-error').catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nCatálogos · aviso de guardado (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
