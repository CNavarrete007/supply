// Flujo del Proceso · 7 pestañas · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta y se reporta. Cada cifra de la pantalla se compara
// con GET /api/v1/analytics/process-flow leído aquí (las reglas del endpoint se verifican en tests/process_flow_http_check.py).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_NONADMIN_USER=<correo>] [SF_SHOTS=<dir>] node tests/frontend/process_flow_ui_e2e.cjs
const { chromium } = require('playwright');
const path = require('path');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const NONADMIN = process.env.SF_NONADMIN_USER || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const TABS = ['Mapa interactivo', 'Flujo de servicios', 'Detalle por etapa', 'Flujo comercial detallado', 'Rutas especiales', 'Matriz del proceso', 'Indicadores y cuellos de botella'];
const n = v => `${v} proceso(s)`;

async function login(page, email) {
  await page.goto(UI + '/');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.locator('nav button').first().waitFor({ timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 2400 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  const T = id => page.getByTestId(id);
  const texts = async id => (await T(id).allInnerTexts()).map(flat);
  const firstNum = s => (s.match(/^(\S+)/) || [])[1];
  const tab = async i => { await page.locator('button').filter({ hasText: TABS[i - 1] }).first().click(); await page.waitForTimeout(300); };
  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `process_flow_${name}.png`), fullPage: true }); };
  try {
    await login(page, 'qa.admin.a@supplyflow.invalid');
    const d = await (await page.request.get(UI + '/api/v1/analytics/process-flow')).json();
    const resp = page.waitForResponse(r => r.url().endsWith('/api/v1/analytics/process-flow'));
    await page.locator('nav button').filter({ hasText: /Flujo del Proceso$/ }).click();
    check('la pantalla consulta GET /api/v1/analytics/process-flow (200)', (await resp).status() === 200);
    await T('pf-status').filter({ hasText: 'solo lectura' }).waitFor({ timeout: 20000 });
    const st = flat(await T('pf-status').innerText());
    check('aviso: datos de MariaDB (solo lectura) con totales reales', st.includes(`${d.p2p.total} requisición(es) de compra/renta y ${d.services.total} servicio(s)`)
      && (d.p2p.unmapped === 0 || st.includes(`${d.p2p.unmapped} expediente(s) desde historial o con control de cambios`)));
    check('sin el aviso genérico de módulo pendiente', !(await page.locator('main').innerText()).includes('Módulo pendiente de integración'));
    await shot('1_mapa');

    // ---- 1 Mapa ----
    const mk = (await texts('pf-map-kpi')).map(firstNum);
    check('mapa: KPI = API (total, abiertos, pendientes cliente, cerrados, desviaciones)', JSON.stringify(mk) === JSON.stringify([d.p2p.total, d.p2p.open, d.p2p.pending_client, d.p2p.closed, d.p2p.deviations].map(String)), mk.join(','));
    check('mapa: "Situación actual" de las 15 etapas = API', JSON.stringify(await texts('pf-map-stage-count')) === JSON.stringify(d.p2p.stages.map(n)));

    // ---- 2 Servicios ----
    await tab(2); await shot('2_servicios');
    const sk = (await texts('pf-svc-kpi')).map(firstNum);
    const s = d.services;
    check('servicios: KPI = API', JSON.stringify(sk) === JSON.stringify([s.total, s.pending_auth, s.pending_po, s.executed, s.ready, s.invoiced].map(String)), sk.join(','));
    check('servicios: procesos por etapa (8) = API', JSON.stringify(await texts('pf-svc-stage-count')) === JSON.stringify(s.stages.map(n)));
    const svcText = flat(await page.locator('main').innerText());
    check('servicios: tarjetas con control y criterio de avance (sin campos vacíos)', svcText.includes('Cliente/proyecto válido y solicitud sin duplicados.') && svcText.includes('Autorización confirmada o emergencia registrada.'));

    // ---- 3 Detalle por etapa ----
    await tab(3);
    check('detalle P2P: contador de las 15 etapas = API', JSON.stringify(await texts('pf-detail-count')) === JSON.stringify(d.p2p.stages.map(n)));
    await page.locator('h4').filter({ hasText: /^Service-to-Cash$/ }).first().click(); await page.waitForTimeout(200);
    check('detalle S2C: contador de las 8 etapas = API', JSON.stringify(await texts('pf-detail-count')) === JSON.stringify(s.stages.map(n)));
    check('detalle: 15 etapas en el selector P2P (no 14)', (await page.locator('main').innerText()).includes('Compra / renta · 15 etapas'));

    // ---- 4 Comercial ----
    await tab(4); await shot('4_comercial');
    const c = d.commercial;
    check('comercial: KPI = API', JSON.stringify((await texts('pf-com-kpi')).map(firstNum)) === JSON.stringify([c.pending_rfqs, c.customer_quotes, c.awaiting_client, c.approved_without_po, c.issued_pos, c.deliveries_without_invoice].map(String)));
    check('comercial: registros relacionados de las 15 etapas = API', JSON.stringify(await texts('pf-com-related')) === JSON.stringify(d.related.map(String)));
    check('comercial: "15 etapas con compuertas"', (await page.locator('main').innerText()).includes('15 etapas con compuertas'));

    // ---- 5 Rutas especiales ----
    await tab(5);
    const sp = d.special;
    check('rutas especiales: KPI = API', JSON.stringify((await texts('pf-special-kpi')).map(firstNum)) === JSON.stringify([sp.history_items, sp.pending_supplier, sp.pending_client_price, sp.change_requests, sp.po_amendments].map(String)));

    // ---- 6 Matriz ----
    await tab(6);
    const mt = flat(await page.locator('main').innerText());
    check('matriz: 23 etapas controladas (15 + 8)', mt.includes('23 etapas controladas · 2 rutas') && mt.includes('Compras/Rentas (15 etapas) y Servicios Operativos (8 etapas)'));

    // ---- 7 Indicadores ----
    await tab(7);
    await page.locator('h4').filter({ hasText: /^Procure-to-Pay$/ }).first().click(); await page.waitForTimeout(200); await shot('7_indicadores');
    const i = d.indicators;
    check('indicadores P2P: KPI = API', JSON.stringify((await texts('pf-ind-kpi')).map(firstNum)) === JSON.stringify([i.rfq_to_issue, i.insufficient_bids, i.awaiting_client, i.approved_without_po, i.po_without_receipt, i.receipts_without_delivery].map(String)));
    const bl = await texts('pf-bottleneck');
    check('cuellos P2P: filas = API (folio real, sin folios fijos del diseño)', bl.length === d.bottlenecks.p2p.length && d.bottlenecks.p2p.every((x, k) => bl[k].startsWith(`${x.folio}:`)));
    check('cuellos P2P: nota "N de M" con el total de abiertos', flat(await T('pf-bottleneck-note').innerText()).startsWith(`${d.bottlenecks.p2p.length} de ${d.bottlenecks.p2p_total} proceso(s) abierto(s)`));
    const off = d.bottlenecks.p2p.find(x => x.reason === 'offers');
    if (off) check('cuellos P2P: ofertas registradas vs mínimo', bl.some(t => t.includes(`${off.folio}: RFQ enviada; ${off.offers} de ${off.min_offers} oferta(s) mínimas registradas.`)));
    await page.locator('h4').filter({ hasText: /^Service-to-Cash$/ }).first().click(); await page.waitForTimeout(200);
    check('indicadores S2C: KPI de servicios = API', JSON.stringify((await texts('pf-ind-kpi')).map(firstNum)) === JSON.stringify([s.total, s.pending_auth, s.pending_po, s.executed, s.ready, s.invoiced].map(String)));
    const bs = await texts('pf-bottleneck');
    check('cuellos S2C: filas = API', bs.length === d.bottlenecks.services.length && d.bottlenecks.services.every((x, k) => bs[k].startsWith(`${x.folio}:`)));

    // ---- Inglés ----
    await page.locator('header button').filter({ hasText: 'English' }).click(); await page.waitForTimeout(300);
    check('idioma inglés: aviso y contadores traducidos', (await T('pf-status').innerText()).toLowerCase().includes('mariadb data (read-only)') && (await texts('pf-ind-kpi'))[0].includes('Services'));
    await page.locator('header button').filter({ hasText: 'Español' }).click();

    if (NONADMIN) {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 1400 } }); const p2 = await ctx2.newPage(); p2.on('pageerror', e2 => jsErrors.push(String(e2)));
      await login(p2, NONADMIN);
      const nav = p2.locator('nav button').filter({ hasText: /Flujo del Proceso$/ });
      if (await nav.count()) {
        await nav.click(); await p2.getByTestId('pf-status').filter({ hasText: /acceso/ }).waitFor();
        const t = flat(await p2.getByTestId('pf-status').innerText());
        check('sin Master Admin: error de acceso sin "Reintentar" y KPI sin datos', t.includes('No tienes acceso a este módulo') && !t.includes('Reintentar') && (await p2.getByTestId('pf-map-kpi').first().innerText()).startsWith('—'));
      } else check('sin Master Admin: la opción no aparece', true);
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
  console.log(`\nFlujo del Proceso (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
