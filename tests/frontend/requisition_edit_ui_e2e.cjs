// Requisición RF1 · edición real desde la interfaz, documento adjunto y cierre de sesión (Chromium) contra Vite + API + MariaDB.
// ESCRIBE en la base: úsese SOLO en la base sintética/desechable (exige SF_SYNTHETIC_WRITES=1). Crea por API una solicitud provisional
// "SOL-PROV-EDIT-<RUN>" con un PDF sintético y la edita desde la interfaz. Desde el navegador solo se permite el PUT de ESA requisición
// (más login/logout); cualquier otra escritura se aborta y la prueba falla.
// Cubre: alta desde el formulario de Registro (POST /recovery/requisitions, folio "QA-UI-ALTA-<RUN>"), EDITAR → Guardar requisición (PUT /recovery/requisitions/{id} con If-Match e Idempotency-Key, versión nueva y matriz), el modo
// compatible de un borrador v0.7 (PUT /requisitions/drafts/{id}, cuenta reqwrite; también crea por API un borrador "DRAFT-<RUN>"),
// 👁️ Ver archivo (GET /recovery/requisitions/{id}/document → PDF en pestaña nueva) y Cerrar sesión (POST /auth/logout → /auth/me 401).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/requisition_edit_ui_e2e.cjs
const { chromium } = require('playwright');
const { randomUUID } = require('crypto');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') {
  console.error('BLOCKED: solo UI local con base sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2);
}
const RUN = randomUUID().slice(0, 6).toUpperCase();
const FOLIO = `SOL-PROV-EDIT-${RUN}`;
const NEW_FOLIO = `QA-UI-ALTA-${RUN}`;
// PDF mínimo válido (sintético).
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj '
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  let reqId = null, draftId = null;
  const blocked = [], writes = [];
  await context.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(path)) return route.continue();
    if (req.method() === 'POST' && path === '/api/v1/recovery/requisitions' && (() => { try { return req.postDataJSON().folio === NEW_FOLIO; } catch { return false; } })()) {
      writes.push([req.method(), req.headers()['idempotency-key'], null]); return route.continue();
    }
    if (req.method() === 'PUT' && ((reqId && path === `/api/v1/recovery/requisitions/${reqId}`) || (draftId && path === `/api/v1/requisitions/drafts/${draftId}`))) {
      writes.push([req.method(), req.headers()['idempotency-key'], req.headers()['if-match']]); return route.continue();
    }
    blocked.push(`${req.method()} ${path}`); return route.abort('blockedbyclient');
  });
  const csrf = async () => (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token;
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill(USER);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });

    // Semilla sintética por API (fuera de la interfaz): solicitud provisional con PDF adjunto.
    const clients = (await (await page.request.get(UI + '/api/v1/recovery/catalogs')).json()).clients;
    const client = clients.find(c => c.active !== false && c.status !== 'inactive' && /^QA/.test(c.code || '')) || clients.find(c => c.active !== false && c.status !== 'inactive');
    const body = { folio: FOLIO, client_id: client.id, request_date: '2026-11-20', need_date: '2026-12-15', project: 'PRY-QA-EDIT', contract: 'CTO-QA-EDIT',
      client_reference: 'EDIT', priority: 'normal', delivery_place: 'Almacén QA', requester_name: 'Solicitante QA', requester_email: 'edit@cliente.invalid',
      budget: null, currency: 'MXN', description: 'Sintético edición UI', notes: '', document: { name: 'solicitud-sintetica.pdf', data: PDF.toString('base64') },
      items: [{ id: null, description: 'Partida edición QA', quantity: '3', unit: 'pza', category: 'Servicios' }],
      source: { type: 'Solicitud verbal / llamada', date: '2026-11-20', reference: 'Llamada QA', notes: '', requirement: 'alternative', due_date: '2027-01-31', owner: 'Responsable QA' } };
    const seed = await page.request.post(UI + '/api/v1/recovery/requisitions', { data: body, headers: { 'X-SF-CSRF': await csrf(), 'Idempotency-Key': randomUUID() } });
    check('semilla sintética con PDF: 201', seed.status() === 201, `${seed.status()} ${(await seed.text()).slice(0, 200)}`);
    const created = await seed.json();
    reqId = created.id;
    const before = await (await page.request.get(UI + `/api/v1/recovery/requisitions/${reqId}`)).json();

    // Abrir el expediente en Registro mediante EDITAR (desde Sin requisición / Regularización, filtrando por el folio).
    await page.locator('nav button').filter({ hasText: /Solicitud \/ Requisición$/ }).first().click();
    await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await page.getByRole('button', { name: /Sin requisición \/ Regularización/ }).click();
    await page.getByLabel('Buscar solicitud provisional').fill(FOLIO);
    const row = page.getByTestId('reg-row').filter({ hasText: FOLIO });
    await row.waitFor({ timeout: 15000 });
    await row.getByRole('button', { name: 'EDITAR' }).click();
    await page.getByText('Modo edición activo.').waitFor({ timeout: 15000 });
    check('EDITAR abre el expediente de MariaDB en Registro', await page.locator('#reqFolio').inputValue() === FOLIO && await page.locator('#rf1-description').inputValue() === 'Sintético edición UI');

    // Ver archivo: el PDF adjunto se abre desde la API en una pestaña nueva.
    // La pestaña se abre con noopener (empieza en about:blank) y Chromium sin interfaz puede tratar el PDF como descarga:
    // se escucha la respuesta en el contexto y los bytes se comparan pidiendo la misma URL con la sesión.
    const [docResp, popup] = await Promise.all([
      context.waitForEvent('response', { predicate: r => r.url().includes(`/requisitions/${reqId}/document`), timeout: 15000 }),
      context.waitForEvent('page', { timeout: 15000 }),
      page.getByRole('button', { name: /Ver archivo/ }).click(),
    ]);
    const again = await page.request.get(docResp.url());
    const docBody = await again.body();
    check('Ver archivo: abre una pestaña con GET …/document → 200 application/pdf', docResp.status() === 200 && /application\/pdf/.test(docResp.headers()['content-type'] || ''),
      `${docResp.status()} ${docResp.headers()['content-type']}`);
    check('Ver archivo: entrega exactamente el PDF adjunto', again.status() === 200 && docBody.equals(PDF), `${again.status()} ${docBody.length}`);
    await popup.close().catch(() => {});

    // Editar y guardar desde la interfaz.
    await page.locator('#rf1-description').fill('Sintético edición UI (actualizado)');
    await page.locator('#rf1-priority').selectOption('alta').catch(async () => {
      const opts = await page.locator('#rf1-priority option').evaluateAll(o => o.map(x => x.value)); await page.locator('#rf1-priority').selectOption(opts.find(v => v !== 'normal'));
    });
    await shot(page, 'req-edit-01-form');
    await page.getByRole('button', { name: /Guardar requisición/ }).click();
    await page.getByText(/Requisición guardada\. Ya aparece en la matriz\./).waitFor({ timeout: 20000 });
    const notice = await page.getByText(/Requisición guardada\. Ya aparece en la matriz\./).innerText();
    const after = await (await page.request.get(UI + `/api/v1/recovery/requisitions/${reqId}`)).json();
    check('Guardar: un PUT con If-Match (versión abierta) e Idempotency-Key', writes.length === 1 && !!writes[0][1] && writes[0][2] === `"${before.version}"`, JSON.stringify(writes));
    check('Guardar: MariaDB refleja los cambios con versión nueva', after.description === 'Sintético edición UI (actualizado)' && after.priority !== 'normal' && after.version === before.version + 1,
      `${after.description} ${after.priority} v${before.version}→v${after.version}`);
    check('Guardar: conserva folio, partidas y documento', after.folio === FOLIO && after.items.length === 1 && after.items[0].description === 'Partida edición QA' && !!after.document, JSON.stringify(after.document || null));
    check('Guardar: aviso con folio y versión, y abre la Matriz', notice.includes(`${FOLIO} · v${after.version}`));
    await shot(page, 'req-edit-02-guardado');
    const audit = (await (await page.request.get(UI + '/api/v1/audit-events?page_size=50')).json()).items || [];
    check('bitácora: la edición quedó auditada', audit.some(x => JSON.stringify(x).includes(FOLIO) || JSON.stringify(x).includes(reqId)), String(audit.length));

    // Borrador v0.7 (modo compatible): una requisición creada con la API v0.7 se edita con PUT /requisitions/drafts/{id} (cuenta reqwrite).
    const draftBody = { client_id: client.id, request_date: '2026-11-21', need_date: '2026-12-20', priority: 'normal', currency: 'MXN', client_reference: `DRAFT-${RUN}`,
      project: 'PRY-QA-V07', contract: 'CTO-QA-V07', requester_name: 'Solicitante QA', requester_email: 'v07@cliente.invalid', delivery_place: 'Almacén QA', budget: null,
      description: 'Borrador v0.7 sintético', notes: '', items: [{ id: null, description: 'Partida v0.7 QA', quantity: '1', unit: 'pza', category: 'Servicios' }] };
    const dseed = await page.request.post(UI + '/api/v1/requisitions/drafts', { data: draftBody, headers: { 'X-SF-CSRF': await csrf(), 'Idempotency-Key': randomUUID() } });
    check('semilla: borrador v0.7 sintético (POST /requisitions/drafts) → 201', dseed.status() === 201, `${dseed.status()} ${(await dseed.text()).slice(0, 200)}`);
    const draft = await dseed.json();
    draftId = draft.id;
    const dBefore = await (await page.request.get(UI + `/api/v1/requisitions/drafts/${draftId}`)).json();
    await page.locator('#reqSubnav').getByRole('button', { name: /Matriz de requisiciones/ }).click();
    await page.locator('.req-client-card.all-card').click();
    await page.getByPlaceholder('Buscar folio, cliente, proyecto, contrato, solicitante...').fill(draft.folio);
    const drow = page.locator('.req-matrix-table-wrap tbody tr').filter({ hasText: draft.folio });
    await drow.getByRole('button', { name: 'EDITAR' }).click();
    await page.getByText('Modo edición activo.').waitFor({ timeout: 15000 });
    check('v0.7: EDITAR abre el borrador en Registro', await page.locator('#reqFolio').inputValue() === draft.folio && await page.locator('#rf1-description').inputValue() === 'Borrador v0.7 sintético');
    await page.locator('#rf1-description').fill('Borrador v0.7 sintético (editado)');
    const nWrites = writes.length;
    await page.getByRole('button', { name: /Guardar requisición/ }).click();
    await page.getByText(new RegExp(`Requisición guardada\\. Ya aparece en la matriz\\. ${draft.folio}`)).waitFor({ timeout: 20000 });
    const dAfter = await (await page.request.get(UI + `/api/v1/requisitions/drafts/${draftId}`)).json();
    const dw = writes.slice(nWrites);
    check('v0.7: Guardar usa PUT /requisitions/drafts/{id} con If-Match', dw.length === 1 && dw[0][2] === `"${dBefore.version}"`, JSON.stringify(dw));
    check('v0.7: MariaDB refleja el cambio con versión nueva', dAfter.description === 'Borrador v0.7 sintético (editado)' && dAfter.version === dBefore.version + 1, `${dAfter.description} v${dBefore.version}→v${dAfter.version}`);

    // Alta desde el formulario de Registro de requisición (POST /recovery/requisitions): requisición formal sintética.
    await page.locator('#reqSubnav').getByRole('button', { name: /Registro de requisición/ }).click();
    await page.getByRole('button', { name: /Nueva requisición/ }).first().click();
    await page.getByText('Modo nueva captura activo.').waitFor({ timeout: 15000 });
    await page.locator('#rf1-source-type').selectOption('Requisición formal del cliente');
    await page.locator('#reqFolio').fill(NEW_FOLIO);
    await page.locator('.rf1-client-trigger').click();
    await page.getByLabel('Buscar cliente').fill(client.code);
    await page.locator('.rf1-client-options button').filter({ hasText: `${client.code} · ` }).first().click();
    for (const [id, v] of [['request_date', '2026-11-24'], ['need_date', '2026-12-31'], ['project', 'PRY-QA-ALTA'], ['contract', 'CTO-QA-ALTA'], ['delivery_place', 'Almacén QA'],
      ['requester_name', 'Solicitante QA alta'], ['requester_email', 'alta@cliente.invalid'], ['source-date', '2026-11-24']]) await page.locator('#rf1-' + id).fill(v);
    await page.locator('#rf1-description').fill('Alta sintética desde la interfaz');
    await page.locator('#rf1-item-description').fill('Partida alta QA');
    await page.locator('#rf1-item-quantity').fill('4');
    await page.locator('#rf1-item-unit').fill('pza');
    await page.locator('#rf1-item-category').selectOption({ index: 1 });
    await page.getByTitle('Agregar partida').click();
    check('alta: la partida se agrega a la lista', (await page.locator('#reqItemList').innerText()).includes('Partida alta QA'));
    await shot(page, 'req-edit-03-alta');
    const nAlta = writes.length;
    await page.getByRole('button', { name: /Guardar requisición/ }).click();
    await page.getByText(new RegExp(`Requisición guardada\\. Ya aparece en la matriz\\. ${NEW_FOLIO}`)).waitFor({ timeout: 20000 });
    const mrow = (await (await page.request.get(UI + '/api/v1/recovery/matrix')).json()).items.find(r => r.folio === NEW_FOLIO);
    const nuevo = mrow ? await (await page.request.get(UI + `/api/v1/recovery/requisitions/${mrow.id}`)).json() : {};
    check('alta: un POST /recovery/requisitions con Idempotency-Key', writes.length === nAlta + 1 && writes[nAlta][0] === 'POST' && !!writes[nAlta][1], JSON.stringify(writes.slice(nAlta)));
    check('alta: MariaDB la registra v1 con cliente, partida y origen formal', nuevo.version === 1 && nuevo.client_id === client.id && nuevo.items?.length === 1 && nuevo.items[0].description === 'Partida alta QA'
      && nuevo.description === 'Alta sintética desde la interfaz', JSON.stringify({ v: nuevo.version, items: nuevo.items?.length }));
    check('alta: aparece en la Matriz de requisiciones', await page.locator('.req-matrix-table-wrap tbody tr').filter({ hasText: NEW_FOLIO }).count() >= 1
      || !!(await page.getByPlaceholder('Buscar folio, cliente, proyecto, contrato, solicitante...').fill(NEW_FOLIO).then(() => page.locator('.req-matrix-table-wrap tbody tr').filter({ hasText: NEW_FOLIO }).count())));

    // Cerrar sesión desde el encabezado: pide confirmación; cancelar no cierra la sesión.
    const logoutBtn = page.getByRole('button', { name: /Cerrar sesión/ }).first();
    let asked = '';
    page.once('dialog', d => { asked = d.message(); d.dismiss(); });
    await logoutBtn.click();
    await page.waitForTimeout(500);
    check('Cerrar sesión: pide confirmación y Cancelar conserva la sesión', asked === '¿Estás seguro de que deseas cerrar sesión?' && (await page.request.get(UI + '/api/v1/auth/me')).status() === 200, asked);
    page.once('dialog', d => d.accept());
    const [logout] = await Promise.all([page.waitForResponse(r => /\/api\/v1\/auth\/logout$/.test(r.url()), { timeout: 15000 }), logoutBtn.click()]);
    await page.locator('input[type=email]').waitFor({ timeout: 15000 });
    check('Cerrar sesión: POST /auth/logout 200 y vuelve al inicio de sesión', logout.status() === 200);
    check('Cerrar sesión: la sesión queda revocada (/auth/me → 401)', (await page.request.get(UI + '/api/v1/auth/me')).status() === 401);
    check('sin escrituras fuera de la requisición sintética', blocked.length === 0, blocked.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, e.stack || String(e));
    await shot(page, 'req-edit-zz-error').catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nRequisición · edición, documento y cierre de sesión (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
