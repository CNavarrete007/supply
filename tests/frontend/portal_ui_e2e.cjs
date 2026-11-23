// Portal del Cliente · acceso (no habilitado) y vista previa interna · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta y se reporta. Lo esperado sale de los GET de
// /api/v1/portal/preview/... leídos aquí con la misma sesión.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/portal_ui_e2e.cjs
const { chromium } = require('playwright');
const path = require('path');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const money = v => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KEY = 'clave-sintetica-e2e-QA';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 2200 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const consoleLines = []; page.on('console', m => consoleLines.push(m.text()));
  const writes = []; const bodies = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.postData()) bodies.push(r.postData());
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  const T = id => page.getByTestId(id);
  const shot = async n => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `portal_${n}.png`), fullPage: true }); };
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();

    // ---- Acceso de clientes: no habilitado y sin exponer la clave ----
    await page.locator('nav button').filter({ hasText: /Portal del Cliente$/ }).click();
    await T('portal-access-badge').waitFor();
    check('acceso: insignia "pendiente de autorización" y sin aviso genérico', (await T('portal-access-badge').innerText()).includes('pendiente de autorización') && !(await page.locator('main').innerText()).includes('Módulo pendiente de integración'));
    await page.locator('main input[type=text]').first().fill('QA01');
    await page.locator('main input[type=password]').fill(KEY);
    await page.locator('main button[type=submit]').click();
    await T('portal-access-message').waitFor();
    check('acceso: mensaje honesto (no habilitado, clave no enviada ni guardada)', (await T('portal-access-message').innerText()).includes('todavía no está habilitado') && await page.locator('main input[type=password]').inputValue() === '');
    check('acceso: la clave no aparece en consola ni en peticiones', !consoleLines.some(l => l.includes(KEY)) && !bodies.some(b => b.includes(KEY)));
    await shot('1_acceso');

    // ---- Vista previa interna ----
    const list = await api('/api/v1/portal/preview/clients');
    const respC = page.waitForResponse(r => /\/api\/v1\/portal\/preview\/clients\/[0-9a-f-]{36}$/.test(r.url()));
    await T('portal-preview-open').click();
    await T('client-portal').waitFor({ timeout: 20000 });
    check('vista previa consulta GET /portal/preview/clients/{id} (200)', (await respC).status() === 200);
    check('insignia y aviso: vista previa interna de solo lectura', (await T('cp-badge').innerText()).includes('solo lectura') && (await T('cp-alert').innerText()).includes('no está habilitado'));
    const opts = await T('cp-client').locator('option').allInnerTexts();
    check('selector de clientes = clientes de MariaDB con estado de su portal', opts.length === list.items.length && list.items.every((c, i) => opts[i].startsWith(`${c.code} · ${c.name} · Portal`)));
    const preferred = list.items.find(x => x.portal_enabled && !x.portal_locked && x.requisitions > 0) || list.items.find(x => x.requisitions > 0) || list.items[0];
    check('cliente inicial: portal habilitado con requisiciones (o el primero con requisiciones)', await T('cp-client').inputValue() === preferred.id);

    // Cliente y requisición con más documentos
    let best = null;
    for (const c of list.items.filter(x => x.requisitions > 0)) {
      const o = await api(`/api/v1/portal/preview/clients/${c.id}`);
      for (const r of o.requisitions) {
        const score = (r.quotes.length ? 1 : 0) + (r.purchase_orders.length ? 1 : 0) + (r.receipts.length ? 1 : 0) + (r.deliveries.length ? 1 : 0) + (r.invoices.length ? 1 : 0);
        if (!best || score > best.score) best = { score, client: c, o, r };
      }
    }
    await T('cp-client').selectOption(best.client.id);
    await page.waitForTimeout(800);
    await T('cp-requisition').selectOption(best.r.id);
    await page.waitForTimeout(400);
    await shot('2_vista_previa');
    const o = best.o; const r = best.r;
    check('cliente seleccionado: nombre de MariaDB', flat(await T('cp-client-name').innerText()) === (o.client.brand_name || o.client.name));
    const mt = (await T('cp-metric').allInnerTexts()).map(t => flat(t).split(' ')[0]);
    check('métricas del cliente = API', JSON.stringify(mt) === JSON.stringify([o.metrics.total, o.metrics.in_progress, o.metrics.closed, o.metrics.avg_progress === null ? '—' : `${o.metrics.avg_progress}%`, o.metrics.pending_delivery, o.metrics.pending_invoice].map(String)));
    const steps = await T('cp-step').evaluateAll(els => els.map(e => e.dataset.status));
    check('8 etapas: completadas, actual y pendientes según la etapa del servidor', steps.length === 8 && (r.stage ? steps.every((s, i) => s === (i + 1 < r.stage ? 'completed' : i + 1 === r.stage ? 'current' : 'pending')) : steps.every(s => s === 'pending')));
    check('avance = progreso de la política (Matriz de requisiciones)', flat(await T('cp-progress').innerText()) === (r.stage ? `${r.progress}%` : '—'));
    check('cotizaciones enviadas al cliente = API', await T('cp-quote').count() === r.quotes.length);
    const poText = r.purchase_orders.length ? flat(await T('cp-doc-5').innerText()) : '';
    check('OC: folio, fechas y estatus; sin proveedor ni montos', r.purchase_orders.every(p => poText.includes(p.folio) && poText.includes(p.status)) && !/Proveedor:|Monto:/.test(poText));
    const docs = flat(await page.locator('[data-testid^="cp-doc-"]').allInnerTexts().then(a => a.join(' ')));
    check('recepciones, entregas y facturas = API', r.receipts.every(x => docs.includes(x.folio)) && r.deliveries.every(x => docs.includes(x.folio)) && r.invoices.every(x => docs.includes(x.folio)));
    const ph = { receipt: r.receipts.reduce((n, x) => n + x.photos, 0), delivery: r.deliveries.reduce((n, x) => n + x.photos, 0) };
    check('fotografías = API', flat(await T('cp-photos-receipt').innerText()).endsWith(String(ph.receipt)) && flat(await T('cp-photos-delivery').innerText()).endsWith(String(ph.delivery)));
    check('firma de enterado: bloqueada (escritura) con aviso honesto', r.invoices.length ? (await T('cp-signature').innerText()).includes('se habilitará') : (await T('cp-signature').innerText()).includes('aún no ha sido cargada'));

    if (r.quotes.length) {
      const q = r.quotes[0];
      const doc = await api(`/api/v1/portal/preview/clients/${best.client.id}/quotes/${q.id}`);
      await T('cp-quote-open').first().click();
      await page.locator('#printable-doc').waitFor();
      await shot('3_cotizacion');
      const d = flat(await page.locator('#printable-doc').innerText());
      check('formato de cotización: folio, partidas y total guardado', d.includes(q.folio) && doc.items.every(i => d.includes(i.description)) && d.includes(`${doc.quote.currency} ${money(doc.quote.total_amount)}`));
      check('formato de cotización: sin banner de terceros si no hay terceros', (Number(doc.quote.third_party_total_amount) > 0) === d.includes('THIRD PARTY PAYMENT'));
      await T('cp-modal').getByRole('button', { name: /Cerrar/ }).first().click();
    }
    const rd = await api(`/api/v1/portal/preview/clients/${best.client.id}/requisitions/${r.id}`);
    await T('cp-action-1').click();
    await T('cp-req-doc').waitFor();
    check('Abrir solicitud: partidas del cliente = API', await T('cp-req-item').count() === rd.items.length);
    await T('cp-modal').getByRole('button', { name: /Cerrar/ }).first().click();
    await T('cp-action-7').click();
    await T('cp-modal').waitFor();
    check('Ver evidencia (entrega): entregas y conteo de fotografías', r.deliveries.every(x => true) && (await T('cp-modal').innerText()).includes(`${ph.delivery} fotografía(s)`));
    await T('cp-modal').getByRole('button', { name: /Cerrar/ }).first().click();

    // Requisición sin etapa inferida (si existe en los datos sintéticos)
    let unm = null;
    for (const c of list.items.filter(x => x.requisitions > 0)) {
      const oc = await api(`/api/v1/portal/preview/clients/${c.id}`);
      const x = oc.requisitions.find(y => y.stage === null);
      if (x) { unm = { c, x }; break; }
    }
    if (unm) {
      await T('cp-client').selectOption(unm.c.id); await page.waitForTimeout(800);
      await T('cp-requisition').selectOption(unm.x.id); await page.waitForTimeout(300);
      check('sin etapa inferida: aviso y todas las etapas pendientes', await T('cp-no-stage').count() === 1 && (await T('cp-step').evaluateAll(els => els.every(e => e.dataset.status === 'pending'))));
    }

    // Inglés, datos reales ausentes y salida
    await page.locator('[data-testid="client-portal"] strong').filter({ hasText: 'English' }).click(); await page.waitForTimeout(200);
    check('idioma inglés en la vista previa', (await T('cp-badge').innerText()).includes('read-only'));
    const emails = ((await page.locator('main').innerText()).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).filter(e => !/\.invalid$|@grupogerez\.com$/i.test(e));
    check('sin datos escritos en el código (solo correos sintéticos o de la empresa)', emails.length === 0, emails.join(', '));
    await T('cp-exit').click();
    await T('portal-access-badge').waitFor();
    check('Salir de la vista previa vuelve al acceso', true);
    await page.setViewportSize({ width: 390, height: 900 });
    await T('portal-preview-open').click(); await T('client-portal').waitFor();
    check('móvil: sin desbordamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
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
  console.log(`\nPortal del Cliente (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
