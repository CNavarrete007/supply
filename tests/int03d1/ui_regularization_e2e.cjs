// INT03-D1 · E2E de interfaz real (Chromium) contra Vite + API + MariaDB SINTETICAS.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SHOTS=<dir> node tests/int03d1/ui_regularization_e2e.cjs
// Crea expedientes provisionales sintéticos vía el endpoint RF1 existente. Nunca usar con datos reales.
const { chromium } = require('playwright');
const crypto = require('node:crypto');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);

async function csrf(page) { return (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token; }
async function createProvisional(page, clientId, requirement, folio, due) {
  const body = { folio, client_id: clientId, request_date: '2026-11-01', need_date: '2026-11-30', project: 'PRY-QA-UI', contract: 'CTO-QA-UI',
    client_reference: 'UI', priority: 'normal', delivery_place: 'Almacén QA', requester_name: 'Solicitante UI', requester_email: 'ui@cliente.invalid',
    budget: null, currency: 'MXN', description: 'Sintético UI INT03-D1', notes: '', document: null,
    items: [{ id: null, description: 'Partida UI', quantity: '2', unit: 'pza', category: 'Servicios' }],
    source: { type: 'Solicitud verbal / llamada', date: '2026-11-01', reference: 'Llamada QA', notes: '', requirement, due_date: requirement === 'contract' ? null : due, owner: 'Responsable QA' } };
  const r = await page.request.post(UI + '/api/v1/recovery/requisitions', { data: body, headers: { 'X-SF-CSRF': await csrf(page), 'Idempotency-Key': crypto.randomUUID() } });
  if (r.status() !== 201) throw new Error('seed failed ' + r.status() + ' ' + await r.text());
  return r.json();
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); }
const modal = page => page.getByRole('dialog');
const rowOf = (page, folio) => page.getByTestId('reg-row').filter({ hasText: folio });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.getByText('Solicitud / Requisición').first().waitFor({ timeout: 20000 });

    const cat = await (await page.request.get(UI + '/api/v1/recovery/catalogs')).json();
    const clientId = cat.clients.find(c => c.code === 'QA02').id;
    const tag = crypto.randomBytes(3).toString('hex').toUpperCase();
    const overdue = await createProvisional(page, clientId, 'formal', `SOL-PROV-UI-${tag}-1`, '2026-11-02');
    const contract = await createProvisional(page, clientId, 'contract', `SOL-PROV-UI-${tag}-2`, null);
    const stale = await createProvisional(page, clientId, 'alternative', `SOL-PROV-UI-${tag}-3`, '2026-12-15');

    await page.getByText('Solicitud / Requisición').first().click();
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.getByRole('button', { name: /Sin requisición \/ Regularización/ }).click();
    await page.getByTestId('regularization-panel').waitFor();
    await rowOf(page, overdue.folio).waitFor();
    check('tarjeta carga provisionales desde MariaDB', await rowOf(page, overdue.folio).count() === 1);
    check('aviso RF1 actualizado', await page.getByText('Regularización (R2) conectadas a MariaDB').count() === 1);
    check('expediente vencido marcado', (await rowOf(page, overdue.folio).textContent()).includes('Vencida'));
    await page.getByRole('button', { name: /Vencidas/ }).first().click();
    check('KPI filtra vencidas', await rowOf(page, contract.folio).count() === 0 && await rowOf(page, overdue.folio).count() === 1);
    await page.getByRole('button', { name: /Solicitudes provisionales/ }).click();
    await page.getByLabel('Buscar solicitud provisional').fill(`UI-${tag}`);
    check('búsqueda por folio', await page.getByTestId('reg-row').count() === 3);
    await shot(page, '01-regularizacion-lista');

    // Validation (client side) then real success with PDF evidence.
    await rowOf(page, overdue.folio).getByRole('button', { name: /Regularizar/ }).click();
    await modal(page).getByTestId('reg-form').waitFor();
    check('método por defecto = requisición formal', await page.locator('#reg-method').inputValue() === 'formal');
    await page.locator('#reg-reference').fill('REQ-CLIENTE-UI-0001');
    await page.getByRole('button', { name: /Registrar regularización/ }).click();
    check('validación: evidencia obligatoria', await modal(page).getByRole('alert').textContent().then(t => /evidencia/i.test(t)));
    await page.locator('#reg-file').setInputFiles({ name: 'requisicion-formal-ui.pdf', mimeType: 'application/pdf', buffer: PDF });
    await page.locator('#reg-notes').fill('Recibida por correo del cliente (sintético).');
    await shot(page, '02-regularizacion-formulario');
    await page.getByRole('button', { name: /Registrar regularización/ }).click();
    await modal(page).getByTestId('reg-done').waitFor({ timeout: 15000 });
    const doneText = await modal(page).getByTestId('reg-done').textContent();
    check('éxito: estado Regularizada · Requisición formal', doneText.includes('Regularizada · Requisición formal') && doneText.includes('REQ-CLIENTE-UI-0001'));
    check('éxito: folio original en aviso', (await modal(page).getByRole('status').textContent()).includes(overdue.folio));
    const href = await modal(page).getByRole('link', { name: /Descargar evidencia/ }).getAttribute('href');
    const dl = await page.request.get(UI + href);
    check('descarga de evidencia autorizada e íntegra', dl.status() === 200 && Buffer.compare(await dl.body(), PDF) === 0);
    await shot(page, '03-regularizacion-exito');
    await modal(page).getByRole('button', { name: 'Cerrar' }).last().click();
    await page.waitForTimeout(500);
    check('lista refleja Regularizada', (await rowOf(page, overdue.folio).textContent()).includes('Regularizada'));

    // Uncertain network result: server applies, browser loses the response; retry reuses the SAME key -> replayed.
    const keys = [];
    let dropFirst = true;
    await page.route('**/regularization', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      keys.push(route.request().headers()['idempotency-key']);
      if (dropFirst) { dropFirst = false; await route.fetch(); return route.abort('connectionreset'); }
      return route.continue();
    });
    await rowOf(page, contract.folio).getByRole('button', { name: /Regularizar/ }).click();
    await modal(page).getByTestId('reg-form').waitFor();
    check('método por defecto = base contractual', await page.locator('#reg-method').inputValue() === 'contract');
    await page.locator('#reg-reference').fill('CTO-QA-UI Call-off 07');
    await page.getByRole('button', { name: /Registrar regularización/ }).click();
    await modal(page).getByText('No se confirmó el resultado').waitFor({ timeout: 15000 });
    check('resultado incierto conserva solicitud', await page.getByRole('button', { name: /Reintentar registro/ }).count() === 1 && await page.locator('#reg-reference').isDisabled());
    await shot(page, '04-regularizacion-incierto');
    await page.getByRole('button', { name: /Reintentar registro/ }).click();
    await modal(page).getByTestId('reg-done').waitFor({ timeout: 15000 });
    check('reintento usa la misma Idempotency-Key', keys.length === 2 && keys[0] === keys[1]);
    check('reintento confirmado sin duplicar (replayed)', (await modal(page).getByRole('status').textContent()).includes('reintento seguro'));
    check('contractual sin archivo', (await modal(page).getByTestId('reg-done').textContent()).includes('Sin archivo'));
    await page.unroute('**/regularization');
    await modal(page).getByRole('button', { name: 'Cerrar' }).last().click();

    // Stale version: another tab regularizes first -> 412 with reload; nothing overwritten.
    await rowOf(page, stale.folio).getByRole('button', { name: /Regularizar/ }).click();
    await modal(page).getByTestId('reg-form').waitFor();
    check('método por defecto = evidencia alternativa (correo)', await page.locator('#reg-method').inputValue() === 'email');
    const other = await page.request.post(UI + `/api/v1/recovery/requisitions/${stale.id}/regularization`, {
      data: { method: 'portal', date: '2026-11-09', reference: 'PORTAL-OTRA-PESTAÑA', notes: null, evidence: { name: 'portal.pdf', data: PDF.toString('base64') } },
      headers: { 'X-SF-CSRF': await csrf(page), 'Idempotency-Key': crypto.randomUUID(), 'If-Match': '"1"' } });
    check('otra pestaña regulariza primero', other.status() === 200);
    await page.locator('#reg-reference').fill('CORREO-UI');
    await page.locator('#reg-file').setInputFiles({ name: 'correo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await page.getByRole('button', { name: /Registrar regularización/ }).click();
    await modal(page).getByText('cambió desde que lo abriste').waitFor({ timeout: 15000 });
    await modal(page).getByTestId('reg-done').waitFor({ timeout: 15000 });
    check('412: recarga versión vigente sin sobrescribir', (await modal(page).getByTestId('reg-done').textContent()).includes('PORTAL-OTRA-PESTAÑA'));
    await shot(page, '05-regularizacion-412');
    await modal(page).getByRole('button', { name: 'Cerrar' }).last().click();

    // Other cards still work.
    await page.getByRole('button', { name: /Matriz de requisiciones/ }).click();
    check('Matriz sigue operando', await page.getByText('Requisiciones por cliente').count() === 1);
    await page.getByRole('button', { name: /Registro de requisición/ }).click();
    check('Registro sigue operando', await page.getByText('Solicitud / Requisición del cliente').count() === 1);

    // Mobile layout.
    await page.setViewportSize({ width: 390, height: 860 });
    await page.getByRole('button', { name: /Sin requisición \/ Regularización/ }).click();
    await page.getByTestId('regularization-panel').waitFor();
    const overflow = await page.evaluate(() => document.querySelector('[data-testid=regularization-panel]').getBoundingClientRect().right <= window.innerWidth + 1);
    check('responsive: panel dentro del ancho móvil', overflow);
    await shot(page, '06-regularizacion-movil');

    // 401: session lost.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await context.clearCookies();
    await rowOf(page, overdue.folio).getByRole('button', { name: /Ver regularización/ }).click();
    await modal(page).getByText('Tu sesión expiró').waitFor({ timeout: 15000 });
    check('401: sesión expirada informada', true);
    check('sin errores JavaScript en página', pageErrors.length === 0, pageErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
    await shot(page, 'zz-error').catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nUI E2E INT03-D1: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
