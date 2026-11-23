// Requisición › Control de cambios · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/int03d1/ui_change_control_e2e.cjs
// Crea requisiciones RF1 y solicitudes R3A sintéticas por los endpoints existentes; retira una (A, solicitante) y aprueba
// otra (B, Master Admin distinto). Nunca usar con datos reales.
const { chromium } = require('playwright');
const crypto = require('node:crypto');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const today = new Date().toISOString().slice(0, 10);

async function login(browser, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.jsErrors = []; page.on('pageerror', e => page.jsErrors.push(String(e)));
  await page.goto(UI + '/');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.locator('nav button').first().waitFor({ timeout: 20000 });
  return { context, page };
}
async function csrf(page) { return (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token; }
async function seedRequisition(page, clientId, folio) {
  const body = { folio, client_id: clientId, request_date: today, need_date: '2030-12-31', project: 'PRY-QA-CC', contract: 'CTO-QA-CC', client_reference: 'CC', priority: 'normal',
    delivery_place: 'Almacén QA', requester_name: 'Solicitante CC', requester_email: 'cc@cliente.invalid', budget: null, currency: 'MXN', description: 'Sintético Control de cambios', notes: '', document: null,
    items: [{ id: null, description: 'Partida CC sintética', quantity: '2', unit: 'pza', category: 'Materiales' }],
    source: { type: 'Requisición formal del cliente', date: today, reference: '', notes: '', requirement: 'formal', due_date: null, owner: '' } };
  const r = await page.request.post(UI + '/api/v1/recovery/requisitions', { data: body, headers: { 'X-SF-CSRF': await csrf(page), 'Idempotency-Key': crypto.randomUUID() } });
  if (r.status() !== 201) throw new Error('seed requisition ' + r.status() + ' ' + await r.text());
  const out = await r.json();
  return (await (await page.request.get(UI + '/api/v1/recovery/requisitions/' + out.id)).json());
}
async function seedChange(page, req, tag) {
  const item = req.items[0];
  const body = { date: today, requested_by: 'Cliente QA CC', source: 'Correo del cliente', change_type: 'Cambio de cantidad', reference: `CC-UI-${tag}`, reason: 'El cliente solicita una pieza adicional (sintético).',
    header: {}, items: [{ action: 'modify', id: item.id, description: item.description, quantity: '3', unit: item.unit, category: item.category }] };
  const r = await page.request.post(UI + `/api/v1/recovery/requisitions/${req.id}/changes`, { data: body, headers: { 'X-SF-CSRF': await csrf(page), 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${req.version}"` } });
  if (r.status() !== 201) throw new Error('seed change ' + r.status() + ' ' + await r.text());
  return r.json();
}
async function openCard(page) {
  await page.locator('nav button').filter({ hasText: /Solicitud \/ Requisición$/ }).first().click();
  await page.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  await page.locator('#reqSubnav').getByRole('button', { name: /Control de cambios/ }).click();
  await page.getByTestId('change-control').waitFor();
}
const rowOf = (page, folio) => page.getByTestId('chg-row').filter({ hasText: folio });
async function search(page, text) {
  const wait = page.waitForResponse(r => r.url().includes('/api/v1/requisition-changes?') && r.url().includes('q='), { timeout: 15000 }).catch(() => null);
  await page.getByLabel('Buscar solicitud de cambio').fill(text);
  await wait; await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch();
  let A, B;
  try {
    A = await login(browser, 'qa.admin.a@supplyflow.invalid');
    const pa = A.page;
    const cat = await (await pa.request.get(UI + '/api/v1/recovery/catalogs')).json();
    const clientId = cat.clients.find(c => c.code === 'QA02').id;
    const tag = crypto.randomBytes(3).toString('hex').toUpperCase();
    const req1 = await seedRequisition(pa, clientId, `QA02-REQ-CC-${tag}-1`);
    const req2 = await seedRequisition(pa, clientId, `QA02-REQ-CC-${tag}-2`);

    // Diseño del original
    await openCard(pa);
    const card = pa.getByTestId('change-control');
    check('diseño: título, subtítulo y flujo Rev. N', await card.getByRole('heading', { name: /Control de modificaciones \/ Change Requests/ }).count() === 1
      && await card.getByText('Conserva la requisición original, genera Rev. N y reabre únicamente las etapas realmente afectadas.').count() === 1 && await card.getByText('Requisición → Cotización Rev. N → OC Rev. N').count() === 1);
    check('diseño: aviso de uso', (await card.getByTestId('chg-usage').innerText()).startsWith('Uso: desde Matriz de requisiciones pulsa SOLICITAR MODIFICACIÓN.'));
    check('diseño: 4 KPI', JSON.stringify(await card.locator('.sf-prov179-kpi .l').allTextContents()) === JSON.stringify(['Cambios registrados', 'Pendientes de cliente', 'Cambios aprobados', 'Con intervención adicional']));
    check('diseño: búsqueda y estados del original', await card.getByPlaceholder('Buscar CR, requisición, cliente, motivo o estado...').count() === 1
      && JSON.stringify((await pa.getByLabel('Estado del cambio').locator('option').allTextContents()).slice(0, 5)) === JSON.stringify(['Todos los estados', 'Pendiente de aprobación del cliente', 'Cambio aprobado', 'Reabastecimiento parcial requerido', 'Conciliación de OC/recepción requerida']));
    check('diseño: columnas', JSON.stringify(await card.locator('thead th').allTextContents()) === JSON.stringify(['Cambio', 'Requisición', 'Cliente', 'Revisión', 'Fecha / solicitado por', 'Origen', 'Impacto', 'Cotización cliente', 'OC / enmienda', 'Estado', 'Acciones']));
    const approvedBefore = Number((await card.locator('.sf-prov179-kpi .n').nth(2).innerText()) || 0);

    // SOLICITAR MODIFICACIÓN desde la Matriz abre el modal R3A existente (sin registrar nada aquí)
    await pa.locator('#reqSubnav').getByRole('button', { name: /Matriz de requisiciones/ }).click();
    await pa.locator('.req-client-card.all-card').click();
    await pa.getByPlaceholder('Buscar folio, cliente, proyecto, contrato, solicitante...').fill(req1.folio);
    const mrow = pa.locator('.req-matrix-table-wrap tbody tr').filter({ hasText: req1.folio });
    await mrow.getByRole('button', { name: 'SOLICITAR MODIFICACIÓN' }).click();
    await pa.getByTestId('change-modal').waitFor({ timeout: 15000 });
    check('Matriz: SOLICITAR MODIFICACIÓN abre el modal R3A', (await pa.getByTestId('change-modal').innerText()).includes(req1.folio));
    await shot(pa, 'cc-01-modal-r3a');
    await pa.getByTestId('change-modal').getByRole('button', { name: /Cerrar/ }).first().click();
    await pa.getByTestId('change-modal').waitFor({ state: 'detached', timeout: 10000 });

    const cr1 = await seedChange(pa, req1, `${tag}-1`);
    const cr2 = await seedChange(pa, req2, `${tag}-2`);
    await openCard(pa);
    await search(pa, `CC-${tag}`);
    check('tablero: solicitudes de MariaDB', await rowOf(pa, cr1.folio).count() === 1 && await rowOf(pa, cr2.folio).count() === 1);
    check('estado: pendiente de revisión independiente', (await rowOf(pa, cr1.folio).getByTestId('chg-state').innerText()) === 'Pendiente de revisión independiente');
    check('independencia: el solicitante no ve REVISAR', JSON.stringify(await rowOf(pa, cr1.folio).getByRole('button').allInnerTexts()) === JSON.stringify(['VER', 'RETIRAR']));
    const cells = await rowOf(pa, cr1.folio).locator('td').allInnerTexts();
    check('fila: requisición, revisión, origen, cotización y OC', cells[1] === req1.folio && cells[3] === 'Rev. 0 → Rev. 1' && cells[5].startsWith('Correo del cliente') && cells[7] === 'Sin cotización al cliente' && cells[8] === 'Sin OC', JSON.stringify(cells));
    await shot(pa, 'cc-02-tablero');

    // Retiro por el solicitante (R3A withdraw real)
    await rowOf(pa, cr2.folio).getByRole('button', { name: 'RETIRAR' }).click();
    const dlg = pa.getByRole('dialog');
    await dlg.getByTestId('chg-diff').waitFor({ timeout: 15000 });
    check('detalle del solicitante: partidas antes / después', (await dlg.getByTestId('chg-diff').innerText()).includes('Modificar'));
    await dlg.getByRole('button', { name: 'Retirar solicitud' }).click();
    check('retiro: motivo obligatorio', (await dlg.getByTestId('chg-msg').innerText()) === 'Escribe el motivo del retiro.');
    await pa.locator('#chg-withdraw-reason').fill('El cliente canceló la solicitud de cambio (sintético).');
    await dlg.getByRole('button', { name: 'Retirar solicitud' }).click();
    await dlg.getByTestId('chg-msg').filter({ hasText: 'retirada' }).waitFor({ timeout: 15000 });
    check('retiro registrado en MariaDB', (await dlg.getByTestId('chg-msg').innerText()).startsWith(`Solicitud ${cr2.folio} retirada`));
    await dlg.getByRole('button', { name: 'Cerrar' }).last().click();
    await pa.waitForTimeout(600);
    check('tablero refleja Retirada', (await rowOf(pa, cr2.folio).getByTestId('chg-state').innerText()) === 'Retirada');

    // Revisión independiente por B (R3B decision real) con reintento seguro
    B = await login(browser, 'qa.admin.b@supplyflow.invalid');
    const pb = B.page;
    await openCard(pb);
    await search(pb, cr1.folio);
    check('revisor: ve REVISAR', await rowOf(pb, cr1.folio).getByRole('button', { name: 'REVISAR' }).count() === 1);
    await rowOf(pb, cr1.folio).getByRole('button', { name: 'REVISAR' }).click();
    const dlb = pb.getByRole('dialog');
    await dlb.getByTestId('chg-decision').waitFor({ timeout: 15000 });
    check('revisor: impacto y conciliación (solo consulta)', await dlb.getByTestId('chg-impact').count() === 1 && (await dlb.getByTestId('chg-commercial').innerText()).includes('sigue bloqueado'));
    await dlb.getByRole('button', { name: /Registrar decisión/ }).click();
    check('decisión: elegir aprobar o rechazar', (await dlb.getByTestId('chg-msg').innerText()) === 'Selecciona Aprobar y aplicar o Rechazar.');
    await dlb.getByLabel('Aprobar y aplicar').check();
    await pb.locator('#chg-reason').fill('Cambio validado con el cliente (sintético).');
    await dlb.getByRole('button', { name: /Registrar decisión/ }).click();
    check('decisión: confirmar alcance', (await dlb.getByTestId('chg-msg').innerText()).startsWith('Confirma expresamente'));
    await dlb.getByText(/Confirmo que aprobar solo genera/).click();
    await shot(pb, 'cc-03-revision');
    const keys = []; let dropFirst = true;
    await pb.route('**/decision', async route => {
      keys.push(route.request().headers()['idempotency-key']);
      if (dropFirst) { dropFirst = false; await route.fetch(); return route.abort('connectionreset'); }
      return route.continue();
    });
    await dlb.getByRole('button', { name: /Registrar decisión/ }).click();
    await dlb.getByTestId('chg-msg').filter({ hasText: 'No se confirmó el resultado' }).waitFor({ timeout: 15000 });
    check('resultado incierto conserva la operación', await dlb.getByRole('button', { name: /Reintentar decisión/ }).count() === 1);
    await dlb.getByRole('button', { name: /Reintentar decisión/ }).click();
    await dlb.getByTestId('chg-msg').filter({ hasText: 'aprobada y aplicada' }).waitFor({ timeout: 15000 });
    const notice = await dlb.getByTestId('chg-msg').innerText();
    check('aprobación aplicada sin duplicar (misma Idempotency-Key)', keys.length === 2 && keys[0] === keys[1] && notice.includes('reintento seguro') && notice.includes('Rev. 1'), notice);
    await pb.unroute('**/decision');
    await dlb.getByRole('button', { name: 'Cerrar' }).last().click();
    await pb.waitForTimeout(600);
    const st = await rowOf(pb, cr1.folio).getByTestId('chg-state').innerText();
    check('tablero refleja el cambio aprobado', ['Cambio aprobado', 'Reabastecimiento parcial requerido'].includes(st), st);
    const req1now = await (await pa.request.get(UI + '/api/v1/recovery/requisitions/' + req1.id)).json();
    check('requisición en Rev. 1 con la cantidad nueva', Number(req1now.current_revision_number) === 1 && Number(req1now.items[0].quantity) === 3, JSON.stringify({ rev: req1now.current_revision_number, q: req1now.items[0]?.quantity }));
    await search(pb, '');
    check('KPI Cambios aprobados aumentó', Number(await pb.getByTestId('change-control').locator('.sf-prov179-kpi .n').nth(2).innerText()) === approvedBefore + 1);
    await pb.getByTestId('change-control').locator('.sf-prov179-kpi').nth(2).click();
    await pb.waitForTimeout(800);
    check('KPI filtra aprobados', await rowOf(pb, cr1.folio).count() === 1 && await rowOf(pb, cr2.folio).count() === 0);
    await pb.getByLabel('Estado del cambio').selectOption('withdrawn');
    await search(pb, `CC-${tag}`);
    check('filtro Retirada', await rowOf(pb, cr2.folio).count() === 1 && await rowOf(pb, cr1.folio).count() === 0);
    await pb.getByLabel('Estado del cambio').selectOption('all');
    await search(pb, 'Cambio aprobado');
    check('búsqueda por estado', await rowOf(pb, cr1.folio).count() === 1 || st !== 'Cambio aprobado');

    await pa.setViewportSize({ width: 390, height: 860 });
    await pa.waitForTimeout(400);
    check('responsive: sin desbordamiento horizontal', await pa.evaluate(() => document.querySelector('[data-testid=change-control]').getBoundingClientRect().right <= window.innerWidth + 1));
    check('sin errores JavaScript', !pa.jsErrors.length && !pb.jsErrors.length, [...pa.jsErrors, ...pb.jsErrors].join(' | '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, e.stack || String(e));
    if (A) await shot(A.page, 'cc-zz-error-a').catch(() => {});
    if (B) await shot(B.page, 'cc-zz-error-b').catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nControl de cambios UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
