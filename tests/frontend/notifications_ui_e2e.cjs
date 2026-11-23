// Campana de notificaciones · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta y se reporta. Lo esperado sale de
// GET /api/v1/notifications leído aquí con la misma sesión.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_OTHER_USER=<correo>] [SF_SHOTS=<dir>] node tests/frontend/notifications_ui_e2e.cjs
const { chromium } = require('playwright');
const path = require('path');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const OTHER = process.env.SF_OTHER_USER || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const MODULE_TITLE = { purchase_order: 'Órdenes de Compra', customer_quote_version: 'Cotizaciones', requisition: 'Requisición', service_order: 'Servicios Operativos' };

async function login(page, email) {
  await page.goto(UI + '/');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.locator('nav button').first().waitFor({ timeout: 20000 });
}

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
  const T = id => page.getByTestId(id);
  try {
    const first = page.waitForResponse(r => r.url().includes('/api/v1/notifications'), { timeout: 20000 });
    await login(page, 'qa.admin.a@supplyflow.invalid');
    check('la campana consulta GET /api/v1/notifications (200)', (await first).status() === 200);
    const api = async q => (await page.request.get(UI + '/api/v1/notifications' + q)).json();
    const all = await api('?page=1&page_size=10');
    if (all.summary.unread > 0) {
      await T('nb-badge').waitFor();
      check('contador = no leídas en MariaDB', flat(await T('nb-badge').innerText()) === String(all.summary.unread));
    } else check('sin no leídas: sin contador', await T('nb-badge').count() === 0);

    await T('nb-button').click();
    await T('nb-panel').waitFor();
    if (all.items.length) await T('nb-item').first().waitFor();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'notifications_panel.png') });
    check('resumen: "N sin leer · M en MariaDB"', flat(await T('nb-summary').innerText()) === `${all.summary.unread} sin leer · ${all.summary.total} en MariaDB`);
    const items = await T('nb-item').allInnerTexts();
    check('lista = primera página del usuario (título y mensaje reales)', items.length === all.items.length && all.items.every((x, k) => flat(items[k]).includes(x.title) && (!x.message || flat(items[k]).includes(flat(x.message)))));
    const readFlags = await T('nb-item').evaluateAll(els => els.map(e => e.dataset.read));
    check('no leídas resaltadas según is_read', JSON.stringify(readFlags) === JSON.stringify(all.items.map(x => (x.is_read ? '1' : '0'))));
    check('remitente visible', all.items.filter(x => x.sender_name).every(x => items.some(t => t.includes(`De: ${x.sender_name}`))));
    check('aviso honesto: solo lectura, marcar como leída requiere autorización', (await T('nb-note').innerText()).includes('pendiente de autorización'));
    check('"Ver más" solo si hay más de una página', (await T('nb-more').count() > 0) === (all.total > all.items.length));

    // Filtro "No leídas"
    const unread = await api('?status=unread&page=1&page_size=10');
    await T('nb-filter-unread').click(); await page.waitForTimeout(500);
    const ui = await T('nb-item').evaluateAll(els => els.map(e => e.dataset.read));
    check('filtro "No leídas": solo no leídas de MariaDB', ui.length === unread.items.length && ui.every(v => v === '0'));
    await T('nb-filter-all').click(); await page.waitForTimeout(500);

    // Documento ligado → módulo
    const linked = all.items.find(x => x.entity && MODULE_TITLE[x.entity.kind]);
    if (linked) {
      const k = all.items.indexOf(linked);
      await T('nb-item').nth(k).getByTestId('nb-entity').click(); await page.waitForTimeout(500);
      check('el documento ligado abre su módulo y cierra el panel', (await page.locator('header').innerText()).includes(MODULE_TITLE[linked.entity.kind].split(' ')[0]) && await T('nb-panel').count() === 0,
        `${linked.entity.kind} → ${flat(await page.locator('header').innerText()).slice(0, 80)}`);
    }

    // Avisos de esta sesión (no se guardan): Flujo del Proceso genera uno al cambiar de pestaña
    await page.locator('nav button').filter({ hasText: /Flujo del Proceso$/ }).click();
    await page.locator('button').filter({ hasText: 'Rutas especiales' }).first().click(); await page.waitForTimeout(300);
    await T('nb-badge').waitFor();
    check('aviso de la sesión suma 1 al contador', flat(await T('nb-badge').innerText()) === String(all.summary.unread + 1));
    await T('nb-button').click(); await T('nb-local').waitFor();
    check('sección "En esta sesión (no se guardan)"', (await T('nb-local').innerText()).toLowerCase().includes('en esta sesión (no se guardan)'));
    await T('nb-local-read').click(); await page.waitForTimeout(200);
    check('"Marcar leídas" solo limpia los avisos de la sesión (MariaDB sin cambios)',
      (all.summary.unread === 0 ? await T('nb-badge').count() === 0 : flat(await T('nb-badge').innerText()) === String(all.summary.unread)) && (await api('?page=1&page_size=1')).summary.unread === all.summary.unread);
    await page.mouse.click(700, 700); await page.waitForTimeout(200);
    check('clic fuera cierra el panel', await T('nb-panel').count() === 0);

    // Inglés
    await page.locator('header button').filter({ hasText: 'English' }).click(); await T('nb-button').click(); await T('nb-panel').waitFor();
    check('idioma inglés', flat(await T('nb-summary').innerText()) === `${all.summary.unread} unread · ${all.summary.total} in MariaDB` && (await T('nb-note').innerText()).includes('pending authorization'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check('Escape cierra el panel', await T('nb-panel').count() === 0);
    await page.locator('header button').filter({ hasText: 'Español' }).click();

    if (OTHER) {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p2 = await ctx2.newPage(); p2.on('pageerror', e2 => jsErrors.push(String(e2)));
      await login(p2, OTHER);
      const mine = await (await p2.request.get(UI + '/api/v1/notifications?page=1&page_size=10')).json();
      await p2.getByTestId('nb-button').click(); await p2.getByTestId('nb-panel').waitFor(); await p2.waitForTimeout(500);
      const t2 = await p2.getByTestId('nb-item').allInnerTexts();
      check('otro usuario (sin Master Admin) ve solo sus notificaciones', t2.length === mine.items.length && !all.items.some(x => t2.some(t => t.includes(x.title))));
      await ctx2.close();
    }
  } catch (err) {
    check('ejecución sin excepciones', false, String(err).slice(0, 400));
  } finally {
    check('sin escrituras a la API (todo GET)', writes.length === 0, writes.join(', '));
    check('sin errores de JavaScript', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
    await browser.close();
  }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [nm, ok, dd] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${nm.padEnd(w)}  ${ok ? '' : dd}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nNotificaciones (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
