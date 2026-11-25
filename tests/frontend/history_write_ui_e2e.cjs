// Requisición › Crear desde historial · E2E de interfaz (Chromium) del ALTA REAL contra Vite + API + MariaDB SINTÉTICAS.
// ESCRIBE: crea una requisición nueva desde el historial del primer cliente activo con historial aprobado (no se puede eliminar).
// Exige SF_SYNTHETIC_WRITES=1. Comprueba el POST con CSRF e Idempotency-Key, que un fallo de red NO se da por creado y que el
// reintento usa la MISMA clave (sin duplicar), la matriz con la marca «Desde historial» y la edición en Registro con el cliente
// y el origen bloqueados.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/history_write_ui_e2e.cjs
const { chromium } = require('playwright');
const path = require('node:path');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };
const RUN = Math.random().toString(16).slice(2, 8).toUpperCase();

(async () => {
  const M = await import(path.resolve(__dirname, '../../src/views/recovery/historyModel.mjs'));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const posts = []; page.on('request', r => { if (r.method() === 'POST' && /from-history/.test(r.url())) posts.push(r); });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill(USER);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const cat = await api('/api/v1/recovery/catalogs');
    const activeCats = cat.categories.filter(c => c.active).map(c => c.name);
    let client = null, hist = null;
    for (const c of cat.clients.filter(c => c.status === 'active')) {
      const d = await api('/api/v1/requisition-history/catalog?client=' + c.id);
      if (d.items?.some(a => a.unit && activeCats.includes(a.category))) { client = c; hist = d; break; }
    }
    if (!client) throw new Error('sin cliente activo con historial aprobado utilizable en la base sintética');
    const a0 = hist.items.find(a => a.unit && activeCats.includes(a.category));
    const before = (await api('/api/v1/recovery/matrix')).total;

    await page.locator('nav button').filter({ hasText: /Solicitud \/ Requisición$/ }).first().click();
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.locator('#reqSubnav').getByRole('button', { name: /Crear desde historial/ }).click();
    const root = page.getByTestId('history-requisition'); await root.waitFor();
    await page.locator('#hist-client').selectOption(client.id);
    await root.getByTestId('hist-article').first().waitFor();
    await root.getByTestId('hist-article').filter({ hasText: a0.description }).first().getByRole('button', { name: /Agregar/ }).click();
    await page.getByLabel('Cantidad nueva 1').fill('4');
    await page.getByLabel('Tratamiento precio cliente 1').selectOption('validate');
    await page.locator('#hist-new-description').fill(`Servicio nuevo sintético ${RUN}`);
    await page.locator('#hist-new-quantity').fill('1');
    await page.locator('#hist-new-unit').fill('servicio');
    await page.locator('#hist-new-category').selectOption(activeCats[0]);
    await root.getByRole('button', { name: /Agregar partida nueva/ }).last().click();
    await page.locator('#hist-need_date').fill('2030-12-31');
    for (const [id, v] of [['project', 'PRY-QA'], ['contract', 'CTO-QA'], ['requester_name', 'Solicitante QA'], ['requester_email', 'qa@cliente.invalid']]) {
      if (!await page.locator(`#hist-${id}`).inputValue()) await page.locator(`#hist-${id}`).fill(v);
    }
    await page.locator('#hist-delivery_place').fill(`Almacén QA ${RUN}`);
    await page.locator('#hist-client_reference').fill(`UI-HIST-${RUN}`);

    // 1) Fallo de red: no se da por creada y conserva la clave.
    let firstKey = '';
    await page.route('**/api/v1/recovery/requisitions/from-history', route => { firstKey = route.request().headers()['idempotency-key']; return route.abort('connectionreset'); }, { times: 1 });
    await root.getByRole('button', { name: /Crear requisición nueva/ }).click();
    await page.waitForFunction(() => /No se confirmó el resultado/.test(document.querySelector('[data-testid=hist-msg]')?.textContent || ''), null, { timeout: 15000 });
    check('fallo de red: NO se da por creada y se ofrece reintentar', (await root.getByTestId('hist-msg').innerText()).startsWith('No se confirmó el resultado') && await root.getByTestId('hist-line').count() === 2);
    // 2) Reintento: misma Idempotency-Key, 201.
    const resp = page.waitForResponse(r => r.request().method() === 'POST' && /from-history/.test(r.url()));
    await root.getByRole('button', { name: /Crear requisición nueva/ }).click();
    const r = await resp; const out = await r.json();
    const h = r.request().headers();
    check('reintento: POST 201 con CSRF y la MISMA Idempotency-Key', r.status() === 201 && !!h['x-sf-csrf'] && h['idempotency-key'] === firstKey && /^[0-9a-f-]{36}$/.test(firstKey), `${r.status()} ${JSON.stringify(out)} ${h['idempotency-key']} vs ${firstKey}`);
    const body = JSON.parse(r.request().postData());
    check('el navegador solo envía referencia, cantidad y ruta del historial (no precio, costo ni proveedor)', body.items[0].origin === 'history' && !('unit_price' in body.items[0]) && !('supplier' in body.items[0]) && body.items[0].quantity === '4' && body.items[0].price_mode === 'validate');
    await root.getByTestId('hist-msg').filter({ hasText: 'creada en MariaDB' }).waitFor({ timeout: 10000 });
    const msg = await root.getByTestId('hist-msg').innerText();
    check('mensaje de confirmación con el folio asignado', msg.startsWith(`Requisición ${out.folio} creada en MariaDB para «${client.name}»: 2 partida(s) (1 del historial y 1 nueva(s)`), msg);
    check('formulario limpio tras crear', await root.getByTestId('hist-line').count() === 0 && await page.locator('#hist-client').inputValue() === '');
    await shot(page, 'hist-write-01-creada');
    const mx = await api('/api/v1/recovery/matrix');
    check('una sola requisición creada (el reintento no duplicó)', mx.total === before + 1 && mx.items.filter(x => x.client_reference === `UI-HIST-${RUN}`).length === 1);

    // 3) Matriz: marca «Desde historial» y etapa normal.
    await root.getByRole('button', { name: /Ver matriz/ }).click();
    await page.getByText('Requisiciones por cliente').waitFor();
    await page.locator('.req-matrix-toolbar input.search').fill(out.folio).catch(() => {});
    const row = page.locator('tr').filter({ hasText: out.folio }).first();
    await row.waitFor({ timeout: 15000 }).catch(() => {});
    if (!await row.count()) { await page.getByText(client.name).first().click(); await row.waitFor({ timeout: 15000 }); }
    check('matriz: fila con «Desde historial» y etapa «Requisición recibida»', (await row.getByTestId('rf1-history-chip').count()) === 1 && (await row.innerText()).includes('Requisición recibida'), (await row.innerText()).slice(0, 300));
    await shot(page, 'hist-write-02-matriz');

    // 4) Registro: editar conserva cliente y origen.
    await row.getByRole('button', { name: /^editar$/i }).first().click();
    await page.getByTestId('rf1-history-note').waitFor({ timeout: 15000 });
    check('Registro: aviso y cliente/origen bloqueados', await page.locator('.rf1-client-trigger').isDisabled() && await page.locator('#rf1-source-type').isDisabled());
    await shot(page, 'hist-write-03-registro');
    await page.setViewportSize({ width: 390, height: 860 });
    check('responsive: sin desbordamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e.stack || e).slice(0, 500));
    await shot(page, 'hist-write-zz-error').catch(() => {});
  }
  check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nCrear desde historial · alta real (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
