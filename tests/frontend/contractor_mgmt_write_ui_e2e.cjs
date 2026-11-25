// Gestión del Contratista · E2E de interfaz (Chromium) de los GUARDADOS REALES contra Vite + API + MariaDB SINTÉTICAS.
// ESCRIBE: crea una requisición sintética (Registro), registra su validación interna, la edita desde la matriz y guarda su
// estrategia (plan versionado). Exige SF_SYNTHETIC_WRITES=1. Comprueba CSRF, Idempotency-Key, que un fallo de red no se da por
// guardado y que el reintento usa la MISMA clave, If-Match en la edición y en la estrategia, y que nunca se abre una RFQ.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/contractor_mgmt_write_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const RUN = Math.random().toString(16).slice(2, 8).toUpperCase();

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = []; page.on('request', r => { if (r.method() !== 'GET' && /contractor-management|rfq/.test(r.url())) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    // Requisición sintética propia (Registro RF1) con 2 partidas.
    const cat = await api('/api/v1/recovery/catalogs');
    const client = cat.clients.find(c => c.status === 'active' && c.code);
    const cats = cat.categories.filter(c => c.active).map(c => c.name);
    const day = new Date().toISOString().slice(0, 10);
    const folio = (await api(`/api/v1/recovery/folio?client_id=${client.id}&date=${day}&mode=formal`)).folio;
    const csrf = (await api('/api/v1/auth/csrf')).csrf_token;
    const rr = await page.request.post(UI + '/api/v1/recovery/requisitions', { headers: { 'X-SF-CSRF': csrf, 'Idempotency-Key': require('crypto').randomUUID() }, data: {
      folio, client_id: client.id, request_date: day, need_date: `${new Date().getFullYear() + 1}-04-01`, project: `PRY-UI-${RUN}`, contract: 'CTO-QA', client_reference: `UI-GC-${RUN}`, priority: 'normal',
      delivery_place: 'Almacén sintético', requester_name: 'Solicitante QA', requester_email: 'qa@cliente.invalid', budget: '', currency: 'MXN', description: `Requisición sintética UI ${RUN}`, notes: null,
      source: { type: 'Requisición formal del cliente', date: day, reference: null, notes: null, requirement: 'formal', due_date: null, owner: null },
      items: [{ id: null, description: `Guantes UI ${RUN}`, quantity: '6', unit: 'par', category: cats[0] }, { id: null, description: `Lentes UI ${RUN}`, quantity: '4', unit: 'pza', category: cats[0] }], document: null } });
    const req = await rr.json();
    if (rr.status() !== 201) throw new Error(`no se pudo crear la requisición sintética: ${rr.status()} ${JSON.stringify(req)}`);
    const ws = await api('/api/v1/contractor-management/write-status');
    check('guardado habilitado (write-status OK)', ws.code === 'OK', JSON.stringify(ws));

    await page.locator('nav button').filter({ hasText: /Gestión del Contratista$/ }).click();
    const fm = page.getByTestId('validation-register'); await fm.waitFor();
    const fld = l => fm.getByLabel(l, { exact: true });
    check('sin aviso de guardado no habilitado', await page.getByTestId('mgmt-write-status').count() === 0);
    await fld('Requisición').locator(`option[value="${req.id}"]`).waitFor({ state: 'attached', timeout: 15000 });
    await fld('Requisición').selectOption(req.id);
    await page.getByTestId('validation-history').waitFor();
    const setup = await api('/api/v1/contractor-management/validation-setup');
    const buyer = setup.buyers.find(b => b.has_user && b.with_access);
    await fld('Responsable de compras').selectOption(buyer.id);
    await fld('Validación técnica').selectOption('Conforme');
    await fld('Validación contractual').selectOption('Conforme');
    await fld('Disponibilidad presupuestal').selectOption('Disponible');
    await fld('Observaciones internas / justificación').fill(`Validación UI ${RUN}`);

    // 1) Fallo de red: no se da por guardada; el reintento usa la misma clave.
    let firstKey = '';
    await page.route('**/api/v1/contractor-management/validations', route => { firstKey = route.request().headers()['idempotency-key']; return route.abort('connectionreset'); }, { times: 1 });
    await fm.getByRole('button', { name: /Guardar validación/ }).click();
    await page.getByTestId('validation-save-msg').filter({ hasText: /No se confirmó/ }).waitFor({ timeout: 15000 });
    check('fallo de red: NO se da por guardada', (await page.getByTestId('validation-save-msg').innerText()).startsWith('No se confirmó el guardado'));
    const p1 = page.waitForResponse(r => r.request().method() === 'POST' && /\/contractor-management\/validations$/.test(r.url()));
    await fm.getByRole('button', { name: /Guardar validación/ }).click();
    const r1 = await p1; const b1 = await r1.json(); const h1 = r1.request().headers();
    check('reintento: POST 201 con CSRF y la MISMA Idempotency-Key; folio SCI', r1.status() === 201 && !!h1['x-sf-csrf'] && h1['idempotency-key'] === firstKey && /^SCI-\d{4}-\d{4,}$/.test(b1.folio || ''), `${r1.status()} ${JSON.stringify(b1)}`);
    await page.getByTestId('validation-save-msg').filter({ hasText: 'guardada en MariaDB' }).waitFor({ timeout: 10000 });
    const m1 = flat(await page.getByTestId('validation-save-msg').innerText());
    check('mensaje con folio y veredicto; formulario limpio', m1.startsWith(`Validación interna ${b1.folio} de ${folio} guardada en MariaDB`) && m1.includes('puede cotizar') && await fld('Requisición').inputValue() === '', m1);
    await shot(page, 'cmw-01-validacion');

    // 2) Edición desde la matriz (If-Match).
    await fm.getByRole('button', { name: /Ver matriz/ }).click();
    await page.getByText('Matriz de validaciones internas').first().waitFor();
    await page.getByRole('button', { name: /Abrir todas/ }).first().click().catch(() => {});
    await page.getByLabel('Buscar validación', { exact: true }).fill(b1.folio);
    const row = page.getByTestId('validation-row').filter({ hasText: b1.folio }).first();
    await row.waitFor({ timeout: 15000 });
    await row.getByRole('button', { name: /^editar$/i }).click();
    const fe = page.getByTestId('validation-register'); await fe.waitFor();
    await page.getByTestId('validation-mode').filter({ hasText: `Modo edición activo: ${b1.folio}` }).waitFor();
    await fe.getByLabel('Número mínimo de cotizaciones', { exact: true }).fill('2');
    const p2 = page.waitForResponse(r => r.request().method() === 'PUT' && /\/contractor-management\/validations\//.test(r.url()));
    await fe.getByRole('button', { name: /Guardar cambios/ }).click();
    const r2 = await p2; const b2 = await r2.json();
    check('edición: PUT 200 con If-Match "1", versión 2 y campo cambiado', r2.status() === 200 && r2.request().headers()['if-match'] === '"1"' && b2.version === 2 && JSON.stringify(b2.changed) === '["min_quotes"]', `${r2.status()} ${JSON.stringify(b2)}`);
    await page.getByTestId('validation-save-msg').filter({ hasText: 'guardados en MariaDB' }).waitFor({ timeout: 10000 });
    check('edición: mensaje de cambios guardados', flat(await page.getByTestId('validation-save-msg').innerText()) === `Cambios de ${b1.folio} guardados en MariaDB (mínimo de cotizaciones); versión 2.`);
    await fe.getByRole('button', { name: /Guardar cambios/ }).click();
    check('edición: guardar otra vez sin cambios no escribe', (await page.getByTestId('validation-save-msg').innerText()).includes('Sin cambios por guardar.') && writes.filter(w => w.startsWith('PUT /api/v1/contractor-management/validations/')).length === 1);
    await shot(page, 'cmw-02-edicion');

    // 3) Estrategia y lotificación: plan versión 1.
    await page.getByRole('button', { name: /Estrategia y lotificación/ }).first().click();
    const sg = page.getByTestId('strategy-lots'); await sg.waitFor();
    const sfl = l => sg.getByLabel(l, { exact: true });
    await sfl('Requisición validada').locator(`option[value="${req.id}"]`).waitFor({ state: 'attached', timeout: 15000 });
    await sfl('Requisición validada').selectOption(req.id);
    await page.getByTestId('strategy-context').filter({ hasText: folio }).waitFor();
    const lots = await page.getByTestId('strategy-lot').count();
    for (let i = 1; i <= lots; i++) {
      const lot = page.getByTestId('strategy-lot').nth(i - 1);
      if (await lot.locator('input[type=checkbox]:checked').count()) continue;
      const sel = sg.getByLabel(`Agregar otro proveedor ${i}`);
      await sel.selectOption(await sel.locator('option').nth(1).getAttribute('value'));
      await lot.getByRole('button', { name: 'Agregar', exact: true }).click();
    }
    const p3 = page.waitForResponse(r => r.request().method() === 'PUT' && /\/contractor-management\/strategy\//.test(r.url()));
    await sg.getByRole('button', { name: 'Guardar estrategia', exact: true }).click();
    const r3 = await p3; const b3 = await r3.json();
    check('estrategia: PUT 200 con If-Match "0" y plan versión 1', r3.status() === 200 && r3.request().headers()['if-match'] === '"0"' && b3.plan_version === 1 && b3.rfq_lines === 2, `${r3.status()} ${JSON.stringify(b3)}`);
    await page.getByTestId('strategy-msg').filter({ hasText: 'guardada en MariaDB como versión 1' }).waitFor({ timeout: 15000 });
    await page.getByTestId('strategy-context').filter({ hasText: 'Estrategia registrada en MariaDB: versión 1' }).waitFor({ timeout: 15000 });
    check('estrategia: aviso de guardado y plan registrado recargado', true);
    const sd = await api(`/api/v1/contractor-management/strategy/${req.id}`);
    check('MariaDB: plan v1 con todas las partidas en lotes y proveedor seleccionado', sd.plan?.version === 1 && sd.plan.lots.flatMap(l => l.items).length === 2 && sd.plan.lots.every(l => l.suppliers.some(s => s.selected)), JSON.stringify(sd.plan).slice(0, 300));
    await sg.getByTestId('strategy-lot').first().getByRole('button', { name: 'Abrir siguiente RFQ' }).click();
    check('abrir siguiente RFQ: no escribe (sin RFQ)', flat(await page.getByTestId('strategy-msg').innerText()).includes('No se abrió') && !writes.some(w => /rfq/i.test(w)));
    await shot(page, 'cmw-03-estrategia');
    await page.setViewportSize({ width: 390, height: 900 });
    check('responsive: sin desbordamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e.stack || e).slice(0, 600));
    await shot(page, 'cmw-zz-error').catch(() => {});
  }
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nGestión del Contratista · guardados reales (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
