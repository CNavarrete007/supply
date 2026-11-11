// SupplyFlow · Prueba de humo de los 6 módulos conectados a MariaDB (SOLO LECTURA).
// Objetivo: después de cualquier cambio de frontend, demostrar que cada módulo sigue llamando a
// sus endpoints reales, recibe 200, no muestra errores y presenta datos que vienen de la base.
//
// Uso: SF_UI=http://127.0.0.1:5173 SF_USER=<correo> SF_QA_PASSWORD=<clave> [SF_SHOTS=<dir>] node tests/frontend/modules_smoke_e2e.cjs
// Garantía de solo lectura: toda petición /api que no sea GET se ABORTA (salvo login/logout),
// por lo que puede ejecutarse contra datos reales sin modificarlos.
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local y SF_QA_PASSWORD.'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const api = p => new RegExp('/api/v1/' + p);

// Contract per module: sidebar label, endpoints that MUST answer 200, and how to obtain a value from
// MariaDB (via the same API) that MUST appear on screen. Optional `detail`: endpoint opened by "Ver".
const MODULES = [
  { label: 'Clientes', endpoints: ['catalogs/clients\\?', 'matrix/clients'], detail: 'catalogs/clients/[0-9a-f-]{36}',
    expect: async r => (await r('/api/v1/catalogs/clients?page=1&page_size=25&q=&status=all')).items?.[0]?.name },
  { label: 'Proveedores', endpoints: ['catalogs/suppliers\\?'], detail: 'catalogs/suppliers/[0-9a-f-]{36}',
    expect: async r => (await r('/api/v1/catalogs/suppliers?page=1&page_size=25&q=&status=all')).items?.[0]?.name },
  // Matriz General: tarjetas por cliente; la matriz se abre con la tarjeta "Todos los clientes" (diseño clase_matriz_general).
  { label: 'Matriz General', endpoints: ['matrix/requisitions\\?', 'matrix/clients', 'recovery/matrix$'], detail: 'matrix/requisitions/[0-9a-f-]{36}',
    prepare: async page => page.getByRole('button', { name: /Abrir matriz de todos los clientes|Open matrix for all clients/ }).click(),
    expect: async r => (await r('/api/v1/matrix/requisitions?page=1&page_size=25&q=&client=all&has=all')).items?.[0]?.folio },
  // Reportes: generador gerencial (clase_reportes) con las fuentes de la Matriz General; el reporte se genera con el botón.
  { label: 'Reportes', endpoints: ['matrix/requisitions\\?', 'matrix/clients', 'recovery/matrix$'],
    prepare: async page => page.getByRole('button', { name: /Generar reporte|Generate report/ }).click(),
    expect: async r => (await r('/api/v1/matrix/requisitions?page=1&page_size=25&q=&client=all&has=all')).items?.[0]?.folio },
  { label: 'Usuarios y roles', endpoints: ['users\\?', 'roles$', 'users/functions$'],
    expect: async r => (await r('/api/v1/users?page=1')).items?.[0]?.name },
  // Dashboard is the landing page: visit it last so it remounts and its requests are observed.
  { label: 'Inicio y Dashboard', endpoints: ['analytics/overview', 'analytics/requisitions\\?', 'matrix/clients', 'recovery/matrix$', 'catalogs/clients\\?page=1&page_size=1', 'catalogs/suppliers\\?page=1&page_size=1', 'recovery/changes$', 'recovery/changes/review-queue'],
    expect: async r => (await r('/api/v1/analytics/overview')).top_clients?.[0]?.name },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const blocked = [];
  await context.route('**/api/**', route => {
    const req = route.request();
    if (req.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(req.url())) return route.continue();
    blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
    return route.abort('blockedbyclient');
  });
  const getJson = async path => (await page.request.get(UI + path)).json();
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill(USER);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    check('login con sesión de servidor', true);

    for (const m of MODULES) {
      const expected = await m.expect(getJson).catch(() => undefined);
      const waits = m.endpoints.map(ep => page.waitForResponse(r => api(ep).test(r.url()) && r.request().method() === 'GET', { timeout: 20000 })
        .then(r => ({ ep, status: r.status() })).catch(() => ({ ep, status: 'sin respuesta' })));
      const button = page.locator('nav button').filter({ hasText: new RegExp(m.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });
      await button.first().click();
      const responses = await Promise.all(waits);
      const bad = responses.filter(r => r.status !== 200);
      check(`${m.label}: endpoints 200 (${m.endpoints.length})`, !bad.length, bad.map(b => `${b.ep}=${b.status}`).join(' '));
      await page.waitForTimeout(800);
      if (m.prepare) await m.prepare(page);
      const alerts = await page.locator('main [role=alert]:visible, [role=alert]:visible').count();
      check(`${m.label}: sin mensajes de error`, alerts === 0, `${alerts} alerta(s)`);
      if (expected) {
        // Any VISIBLE occurrence (e.g. the first match may be a hidden <option> of a client filter).
        const matches = page.getByText(String(expected), { exact: false });
        let shown = false;
        for (let i = 0, n = await matches.count(); i < n && !shown; i++) shown = await matches.nth(i).isVisible().catch(() => false);
        check(`${m.label}: muestra dato real de MariaDB`, shown, `no se ve "${expected}"`);
      } else {
        check(`${m.label}: muestra dato real de MariaDB`, true, 'sin registros para comparar');
      }
      if (m.detail && expected) {
        const wait = page.waitForResponse(r => api(m.detail).test(r.url()), { timeout: 15000 }).then(r => r.status()).catch(() => 'sin respuesta');
        await page.getByRole('button', { name: /^(Ver|View)$/ }).first().click();
        const status = await wait;
        check(`${m.label}: detalle "Ver" responde 200`, status === 200, String(status));
        await page.waitForTimeout(500);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${m.label.replace(/\W+/g, '_')}_detalle.png` });
        // Close ONLY inside the detail dialog (never the header's "Cerrar sesión").
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: /^(Cerrar|Cerrar detalle|Close|Close details)$/ }).first().click();
        await dialog.waitFor({ state: 'detached', timeout: 10000 });
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${m.label.replace(/\W+/g, '_')}.png` });
    }
    check('ninguna escritura intentada (solo GET)', blocked.length === 0, blocked.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nMódulos conectados: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
