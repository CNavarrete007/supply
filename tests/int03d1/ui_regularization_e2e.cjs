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
    const open = await createProvisional(page, clientId, 'alternative', `SOL-PROV-UI-${tag}-4`, '2027-01-31');

    await page.getByText('Solicitud / Requisición').first().click();
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.getByRole('button', { name: /Sin requisición \/ Regularización/ }).click();
    await page.getByTestId('regularization-panel').waitFor();
    await rowOf(page, overdue.folio).waitFor();
    check('tarjeta carga provisionales desde MariaDB', await rowOf(page, overdue.folio).count() === 1);
    check('aviso RF1 actualizado', await page.getByText('Regularización (R2) conectadas a MariaDB').count() === 1);
    check('expediente vencido marcado', (await rowOf(page, overdue.folio).getByTestId('reg-chip').textContent()) === 'Regularización vencida');
    // Diseño original: encabezado, insignia, KPI, filtros y columnas.
    const panel = page.getByTestId('regularization-panel');
    check('diseño: título y control documental', await panel.getByRole('heading', { name: 'Solicitudes sin requisición formal' }).count() === 1 && await panel.getByText('Control documental', { exact: true }).count() === 1);
    check('diseño: 4 KPI del original', (await Promise.all(['Solicitudes provisionales', 'Pendientes de regularización', 'Regularización vencida', 'Regularizadas'].map(l => panel.getByRole('button', { name: new RegExp(l) }).count()))).every(n => n === 1));
    check('diseño: columnas', JSON.stringify(await panel.locator('thead th').allTextContents()) === JSON.stringify(['Expediente', 'Cliente / Solicitante', 'Origen', 'Regularización', 'Etapa', 'Acciones']));
    check('diseño: filtro de estados', JSON.stringify(await panel.getByLabel('Estado de regularización').locator('option').allTextContents()) === JSON.stringify(['Todos los estados', 'Pendientes', 'Vencidas', 'Regularizadas']));
    check('diseño: búsqueda y nueva solicitud', await panel.getByPlaceholder('Buscar folio, cliente, referencia, solicitante...').count() === 1 && await panel.getByRole('button', { name: /Nueva solicitud provisional/ }).count() === 1);
    const contractRow = rowOf(page, contract.folio);
    check('chip contractual = estado del servidor', (await contractRow.getByTestId('reg-chip').textContent()) === 'Pendiente validar base contractual');
    check('columna regularización: contractual sin límite', (await contractRow.locator('td').nth(3).textContent()) === 'Base contractual / Call-off (sin requisición formal)');
    check('columna regularización: límite + requisito', (await rowOf(page, overdue.folio).locator('td').nth(3).textContent()) === 'Límite: 2026-11-02Debe recibirse requisición formal');
    check('cliente / solicitante y origen', (await rowOf(page, overdue.folio).locator('td').nth(1).textContent()).includes('Solicitante UI · ui@cliente.invalid') && (await rowOf(page, overdue.folio).locator('td').nth(2).textContent()) === 'Solicitud verbal / llamadaLlamada QA');
    check('etapa del expediente', (await rowOf(page, overdue.folio).locator('td').nth(4).textContent()) === 'Etapa 1');
    check('acciones EDITAR · REGULARIZAR · CONTINUAR', JSON.stringify(await rowOf(page, open.folio).getByRole('button').allTextContents()) === JSON.stringify(['EDITAR', 'REGULARIZAR', 'CONTINUAR']));
    await page.getByLabel('Buscar solicitud provisional').fill(`UI-${tag}`);
    await page.getByLabel('Estado de regularización').selectOption('open');
    check('filtro Pendientes incluye vencidas', await page.getByTestId('reg-row').count() === 4);
    await page.getByLabel('Estado de regularización').selectOption('');
    await page.getByLabel('Buscar solicitud provisional').fill('');
    await page.getByRole('button', { name: /Regularización vencida/ }).first().click();
    check('KPI filtra vencidas', await rowOf(page, contract.folio).count() === 0 && await rowOf(page, overdue.folio).count() === 1);
    await page.getByRole('button', { name: /Solicitudes provisionales/ }).click();
    await page.getByLabel('Buscar solicitud provisional').fill(`UI-${tag}`);
    check('búsqueda por folio', await page.getByTestId('reg-row').count() === 4);
    await shot(page, '01-regularizacion-lista');

    // Validation (client side) then real success with PDF evidence.
    await rowOf(page, overdue.folio).getByRole('button', { name: 'REGULARIZAR' }).click();
    await modal(page).getByTestId('reg-form').waitFor();
    check('método por defecto = requisición formal', await page.locator('#reg-method').inputValue() === 'formal');
    check('modal: subtítulo folio · cliente · origen', (await modal(page).locator('#reg-title + p').textContent()).includes(`${overdue.folio} · `) && (await modal(page).locator('#reg-title + p').textContent()).endsWith('Origen: Solicitud verbal / llamada'));
    check('modal: métodos del original', JSON.stringify(await page.locator('#reg-method option').allTextContents()) === JSON.stringify(['Requisición formal recibida', 'PO del cliente', 'Correo de autorización', 'Confirmación en portal del cliente', 'Contrato / Call-off vigente', 'Autorización gerencial', 'Emergencia documentada', 'Otra evidencia autorizada']));
    check('modal: etiquetas del original', await modal(page).getByText('Fecha de recepción / validación *').count() === 1 && await modal(page).getByText('Folio / referencia documental *').count() === 1 && await page.locator('#reg-notes').getAttribute('placeholder') === 'Explica la evidencia y, si corresponde, por qué sustituye la requisición formal.');
    check('modal: evidencia y control', (await modal(page).getByTestId('reg-file-summary').textContent()).startsWith('Sin archivo seleccionado.') && (await modal(page).getByTestId('reg-control').textContent()).startsWith('Control: regularizar no crea una requisición nueva.'));
    await page.locator('#reg-reference').fill('REQ-CLIENTE-UI-0001');
    await page.getByRole('button', { name: /Cerrar regularización/ }).click();
    check('validación: evidencia obligatoria', await modal(page).getByRole('alert').textContent().then(t => /evidencia/i.test(t)));
    await page.locator('#reg-file').setInputFiles({ name: 'requisicion-formal-ui.pdf', mimeType: 'application/pdf', buffer: PDF });
    await page.locator('#reg-notes').fill('Recibida por correo del cliente (sintético).');
    await shot(page, '02-regularizacion-formulario');
    await page.getByRole('button', { name: /Cerrar regularización/ }).click();
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
    await rowOf(page, contract.folio).getByRole('button', { name: 'REGULARIZAR' }).click();
    await modal(page).getByTestId('reg-form').waitFor();
    check('método por defecto = base contractual', await page.locator('#reg-method').inputValue() === 'contract');
    await page.locator('#reg-reference').fill('CTO-QA-UI Call-off 07');
    await page.getByRole('button', { name: /Cerrar regularización/ }).click();
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
    await rowOf(page, stale.folio).getByRole('button', { name: 'REGULARIZAR' }).click();
    await modal(page).getByTestId('reg-form').waitFor();
    check('método por defecto = evidencia alternativa (correo)', await page.locator('#reg-method').inputValue() === 'email');
    const other = await page.request.post(UI + `/api/v1/recovery/requisitions/${stale.id}/regularization`, {
      data: { method: 'portal', date: '2026-11-09', reference: 'PORTAL-OTRA-PESTAÑA', notes: null, evidence: { name: 'portal.pdf', data: PDF.toString('base64') } },
      headers: { 'X-SF-CSRF': await csrf(page), 'Idempotency-Key': crypto.randomUUID(), 'If-Match': '"1"' } });
    check('otra pestaña regulariza primero', other.status() === 200);
    await page.locator('#reg-reference').fill('CORREO-UI');
    await page.locator('#reg-file').setInputFiles({ name: 'correo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await page.getByRole('button', { name: /Cerrar regularización/ }).click();
    await modal(page).getByText('cambió desde que lo abriste').waitFor({ timeout: 15000 });
    await modal(page).getByTestId('reg-done').waitFor({ timeout: 15000 });
    check('412: recarga versión vigente sin sobrescribir', (await modal(page).getByTestId('reg-done').textContent()).includes('PORTAL-OTRA-PESTAÑA'));
    await shot(page, '05-regularizacion-412');
    await modal(page).getByRole('button', { name: 'Cerrar' }).last().click();

    // EDITAR abre el mismo expediente en Registro (RF1, sin escritura).
    const blockedWrites = [];
    const watch = req => { if (req.url().includes('/api/') && !['GET', 'HEAD'].includes(req.method())) blockedWrites.push(req.method() + ' ' + new URL(req.url()).pathname); };
    page.on('request', watch);
    check('EDITAR deshabilitado en regularizada', await rowOf(page, overdue.folio).getByRole('button', { name: 'EDITAR' }).isDisabled());
    await rowOf(page, open.folio).getByRole('button', { name: 'EDITAR' }).click();
    await page.getByText('Modo edición activo.').waitFor({ timeout: 15000 });
    check('EDITAR carga el expediente en Registro', await page.locator('#reqFolio').inputValue() === open.folio);
    await page.getByRole('button', { name: /Limpiar/ }).click();
    // Nueva solicitud provisional: captura RF1 con tipo de entrada no formal y folio SOL-PROV del servidor.
    await page.getByRole('button', { name: /Sin requisición \/ Regularización/ }).click();
    await page.getByRole('button', { name: /Nueva solicitud provisional/ }).click();
    await page.getByText('Modo nueva captura activo.').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => /^SOL-PROV-\d{4}-\d{4}$/.test(document.querySelector('#reqFolio')?.value || ''), null, { timeout: 15000 });
    check('Nueva solicitud provisional prepara captura', await page.locator('#rf1-source-type').inputValue() === 'Correo del cliente' && /^SOL-PROV-/.test(await page.locator('#reqFolio').inputValue()));
    await shot(page, '07-nueva-solicitud-provisional');
    await page.getByRole('button', { name: /Limpiar/ }).click();
    // CONTINUAR: etapa 1 → Validación interna en Gestión del Contratista.
    await page.getByRole('button', { name: /Sin requisición \/ Regularización/ }).click();
    check('CONTINUAR indica el siguiente paso', (await rowOf(page, open.folio).getByRole('button', { name: 'CONTINUAR' }).getAttribute('title')) === 'Siguiente paso: Validación interna (Gestión del Contratista)');
    await rowOf(page, open.folio).getByRole('button', { name: 'CONTINUAR' }).click();
    await page.getByTestId('contractor-mgmt-notice').waitFor({ timeout: 15000 });
    check('CONTINUAR abre Gestión del Contratista', true);
    page.off('request', watch);
    check('EDITAR / Nueva / CONTINUAR sin escrituras', blockedWrites.length === 0, blockedWrites.join(', '));
    await page.locator('nav button').filter({ hasText: /Solicitud \/ Requisición$/ }).first().click();
    await page.getByRole('button', { name: /Sin requisición \/ Regularización/ }).waitFor();

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
    await rowOf(page, overdue.folio).getByRole('button', { name: 'VER REGULARIZACIÓN' }).click();
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
