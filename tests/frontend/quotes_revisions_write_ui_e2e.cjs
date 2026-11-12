// Cotizaciones › Revisiones/modificaciones · E2E de ESCRITURA (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// "Solicitar modificación" registra una solicitud R3A real (POST /api/v1/recovery/requisitions/{id}/changes) sobre la
// requisición RF1 sintética de la familia CQ-QA-*: prueba validación, 412 por versión vieja, reintento idempotente tras
// una respuesta perdida, bloqueo por solicitud pendiente y por otro Master Admin, y que NO cambian la requisición ni la
// cotización. Al final RETIRA la solicitud (queda en la bitácora como "withdrawn") para poder repetir la prueba.
// Úsese SOLO en la base desechable (exige SF_SYNTHETIC_WRITES=1). Desde la interfaz solo se permite ese POST.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_QA_USER_B=...] [SF_SHOTS=<dir>] node tests/frontend/quotes_revisions_write_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const USER_A = 'qa.admin.a@supplyflow.invalid';
const USER_B = process.env.SF_QA_USER_B || 'qa.admin.b@supplyflow.invalid';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ');
const MARK = 'E2E-QA-REV';
const RUN = `${MARK}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const uuid = () => require('crypto').randomUUID();

async function login(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  return { context, page };
}
async function signIn(page, email) {
  await page.goto(UI + '/');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.locator('nav button').first().waitFor({ timeout: 20000 });
}
const apiOf = page => ({
  get: async p => (await page.request.get(UI + p)).json(),
  post: async (p, body, headers = {}) => {
    const tok = (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token;
    const r = await page.request.post(UI + p, { data: body, headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': tok, 'Idempotency-Key': uuid(), ...headers } });
    return { status: r.status(), body: await r.json().catch(() => ({})) };
  },
});
async function openRevisions(page) {
  await page.locator('nav button').filter({ hasText: /Cotizaciones y Comparativo$/ }).click();
  await page.getByRole('button', { name: /Revisiones\/modificaciones/ }).click();
  await page.getByTestId('rev-family').first().waitFor();
}

(async () => {
  const browser = await chromium.launch();
  const { context, page } = await login(browser);
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const posts = []; const blocked = []; let mode = 'pass'; let reqId = '';
  await context.route('**/api/**', async route => {
    const r = route.request(); const path = new URL(r.url()).pathname;
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(path)) return route.continue();
    if (r.method() === 'POST' && reqId && path === `/api/v1/recovery/requisitions/${reqId}/changes`) {
      const h = r.headers(); posts.push({ key: h['idempotency-key'], ifMatch: h['if-match'], mode, body: r.postDataJSON() });
      if (mode === 'stale') return route.continue({ headers: { ...h, 'if-match': '"999999"' } });
      if (mode === 'drop') { await route.fetch(); return route.abort('connectionreset'); } // the server committed; the answer is lost
      return route.continue();
    }
    blocked.push(`${r.method()} ${path}`); return route.abort('blockedbyclient');
  });
  const A = apiOf(page);
  let cr = null;
  try {
    await signIn(page, USER_A);
    // Precondición: familia sintética con requisición RF1 propia (QA*, Cliente Sintético*), sin solicitudes ajenas pendientes.
    let fams = await A.get('/api/v1/quotes/revisions?page=1&page_size=50');
    let f = fams.items.find(x => /^QA/.test(x.requisition) && /Sint[eé]tico/.test(x.client_name) && (x.can_request_change || x.change_block === 'pending_change'));
    if (!f) { console.error('BLOCKED: no hay familia de cotización sintética sobre una requisición RF1 propia (semilla de sandbox).'); process.exit(2); }
    reqId = f.requisition_id;
    if (f.change_block === 'pending_change') { // residuo de una ejecución anterior de ESTA prueba: se retira; si es ajeno, se detiene
      const prev = (await A.get(`/api/v1/recovery/changes?requisition_id=${reqId}`)).items.find(c => c.status_code === 'pending_review');
      if (!prev || !String(prev.reference_text || '').startsWith(MARK)) { console.error(`BLOCKED: ${f.requisition} tiene una solicitud pendiente que no creó esta prueba.`); process.exit(2); }
      await A.post(`/api/v1/recovery/changes/${prev.id}/withdraw`, { reason: 'Limpieza de prueba E2E anterior' }, { 'If-Match': `"${prev.version}"` });
      fams = await A.get('/api/v1/quotes/revisions?page=1&page_size=50'); f = fams.items.find(x => x.id === f.id);
    }
    check('precondición: familia sintética elegible para solicitar modificación', f.can_request_change === true, f.change_block);
    const reqBefore = await A.get(`/api/v1/recovery/requisitions/${reqId}`);
    const cqBefore = await A.get(`/api/v1/quotes/customer-quotes/${f.current_id}`);
    const changesBefore = (await A.get(`/api/v1/recovery/changes?requisition_id=${reqId}`)).items.length;
    const line0 = reqBefore.items[0];
    const newQty = String(Number(line0.quantity) + 2);

    await openRevisions(page);
    const card = page.getByTestId('rev-family').filter({ hasText: f.current_folio });
    await card.getByRole('button', { name: 'SOLICITAR MODIFICACIÓN' }).click();
    const modal = page.getByTestId('change-modal'); await modal.getByTestId('change-line').first().waitFor();
    const L = re => modal.getByLabel(re);

    // 1) Validación local: "Agregar partida" exige una alta; nada se envía.
    await L(/Solicitado por/).fill('QA Solicitante Cliente');
    await L(/^Origen/).selectOption('Correo del cliente');
    await L(/Tipo principal/).selectOption('Agregar partida');
    await L(/Referencia/).fill(RUN);
    await L(/Motivo/).fill('El cliente solicita dos piezas adicionales (prueba sintética).');
    await modal.getByRole('button', { name: 'Registrar solicitud' }).click();
    await modal.getByText('El tipo Agregar partida requiere al menos una partida nueva.').first().waitFor();
    check('validación: Agregar partida sin altas no se envía', posts.length === 0);
    await L('Cantidad de la partida nueva').fill('0'); await L('Descripción de la partida nueva').fill('Partida QA'); await L('Unidad de la partida nueva').fill('pza');
    await modal.getByRole('button', { name: 'Agregar partida' }).click();
    check('validación: partida nueva con cantidad cero rechazada', await modal.getByText(/Cantidad mayor a cero/).count() >= 1 && await modal.getByTestId('change-addition').count() === 0);

    // 2) Cambio de cantidad en la partida 1 → 412 (versión vieja forzada): no se registra nada y se recarga la requisición.
    await L(/Tipo principal/).selectOption('Cambio de cantidad');
    const row = modal.getByTestId('change-line').first();
    await row.getByLabel('Acción').selectOption('modify');
    await row.getByLabel('Cantidad nueva').fill(newQty);
    check('partida modificada marcada', flat(await row.innerText()).includes('Modificada'));
    mode = 'stale';
    const r412 = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/requisitions/${reqId}/changes`));
    await modal.getByRole('button', { name: 'Registrar solicitud' }).click();
    check('versión vieja: el servidor responde 412', (await r412).status() === 412);
    await modal.getByText(/La requisición cambió desde que abriste el formulario/).waitFor();
    check('412: no se creó ninguna solicitud', (await A.get(`/api/v1/recovery/changes?requisition_id=${reqId}`)).items.length === changesBefore);
    check('412: el formulario recarga las partidas vigentes', (await row.getByLabel('Acción').inputValue()) === 'keep' && (await L(/Referencia/).inputValue()) === RUN);

    // 3) Respuesta perdida → mensaje incierto → reintento con la MISMA clave → réplica idempotente (una sola solicitud).
    await row.getByLabel('Acción').selectOption('modify');
    await row.getByLabel('Cantidad nueva').fill(newQty);
    mode = 'drop';
    await modal.getByRole('button', { name: 'Registrar solicitud' }).click();
    await modal.getByText(/No se confirmó el resultado/).waitFor();
    check('respuesta perdida: el formulario queda bloqueado para reintentar lo mismo', await modal.getByRole('button', { name: 'Reintentar registro' }).isVisible() && await L(/Motivo/).isDisabled());
    mode = 'pass';
    const replay = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/requisitions/${reqId}/changes`));
    await modal.getByRole('button', { name: 'Reintentar registro' }).click();
    const rep = await replay; const repBody = await rep.json();
    check('reintento: 200 con replayed=true', rep.status() === 200 && repBody.replayed === true, JSON.stringify(repBody).slice(0, 200));
    check('reintento: misma Idempotency-Key y versión; el 412 usó otra clave', posts.length === 3 && posts[1].key === posts[2].key && posts[0].key !== posts[1].key && posts[1].ifMatch === `"${reqBefore.version}"`, JSON.stringify(posts.map(p => [p.mode, p.key, p.ifMatch])));
    check('payload: solo la diferencia real de la partida', JSON.stringify(posts[2].body.items) === JSON.stringify([{ action: 'modify', id: line0.id, description: line0.description, quantity: newQty, unit: line0.unit, category: line0.category }]) && JSON.stringify(posts[2].body.header) === '{}');
    await modal.getByTestId('change-done').waitFor();
    const done = flat(await modal.getByTestId('change-done').innerText());
    check('confirmación: folio CR, Rev. actual → propuesta y reintento seguro', done.includes(repBody.folio) && done.includes(`Rev. ${repBody.previous_revision_number} → Rev. ${repBody.proposed_revision_number}`) && done.includes('confirmada por reintento seguro'), done);
    await shot(page, 'cot_rev_solicitud');

    // 4) Efectos: exactamente una solicitud pendiente; requisición y cotización intactas.
    const list = (await A.get(`/api/v1/recovery/changes?requisition_id=${reqId}`)).items;
    cr = list.find(c => c.folio === repBody.folio);
    check('una sola solicitud nueva, pendiente de revisión, con la referencia capturada', list.length === changesBefore + 1 && cr && cr.status_code === 'pending_review' && cr.reference_text === RUN && cr.change_type === 'Cambio de cantidad' && cr.source_label === 'Correo del cliente' && cr.requested_by_snapshot === 'QA Solicitante Cliente');
    const det = cr && await A.get(`/api/v1/recovery/changes/${cr.id}`);
    check('detalle del cambio: antes/después de la partida', det && det.changes.length === 1 && det.changes[0].change_kind === 'modify' && Number(det.changes[0].before_snapshot.quantity) === Number(line0.quantity) && det.changes[0].after_snapshot.quantity === newQty);
    const reqAfter = await A.get(`/api/v1/recovery/requisitions/${reqId}`);
    check('la requisición NO cambió (versión, revisión y partidas)', reqAfter.version === reqBefore.version && reqAfter.current_revision_number === reqBefore.current_revision_number && JSON.stringify(reqAfter.items) === JSON.stringify(reqBefore.items));
    const cqAfter = await A.get(`/api/v1/quotes/customer-quotes/${f.current_id}`);
    check('la cotización al cliente NO cambió (sin nueva revisión ni total distinto)', cqAfter.item.total_amount === cqBefore.item.total_amount && cqAfter.versions.length === cqBefore.versions.length);

    // 5) La familia muestra la solicitud pendiente y ya no admite otra.
    await modal.getByRole('button', { name: 'Cerrar' }).last().click();
    await card.getByText(`${repBody.folio} · en revisión`).waitFor();
    check('tarjeta: solicitud pendiente visible', true);
    await card.getByRole('button', { name: 'SOLICITAR MODIFICACIÓN' }).click();
    await page.getByTestId('rev-blocked').waitFor();
    check('segunda solicitud bloqueada mientras hay una pendiente', flat(await page.getByTestId('rev-blocked').innerText()).includes(`${repBody.folio} pendiente de revisión independiente`));
    await page.getByRole('button', { name: 'Entendido' }).click();

    // 6) Otro Master Admin: la interfaz explica el bloqueo y el servidor también lo impide (409 READ_ONLY_RECORD).
    const b = await login(browser);
    await signIn(b.page, USER_B);
    const B = apiOf(b.page);
    const fb = (await B.get('/api/v1/quotes/revisions?page=1&page_size=50')).items.find(x => x.id === f.id);
    check('otro Master Admin: familia no elegible (not_owner)', fb && fb.can_request_change === false && fb.change_block === 'not_owner');
    await openRevisions(b.page);
    await b.page.getByTestId('rev-family').filter({ hasText: f.current_folio }).getByRole('button', { name: 'SOLICITAR MODIFICACIÓN' }).click();
    await b.page.getByTestId('rev-blocked').waitFor();
    check('otro Master Admin: motivo de bloqueo visible', flat(await b.page.getByTestId('rev-blocked').innerText()).includes('Solo quien capturó la requisición RF1'));
    const direct = await B.post(`/api/v1/recovery/requisitions/${reqId}/changes`, { date: '2026-11-12', requested_by: 'QA B', source: 'Otro', change_type: 'Cambio de cantidad', reference: RUN, reason: 'Intento ajeno', header: {}, items: [{ action: 'cancel', id: line0.id }] }, { 'If-Match': `"${reqBefore.version}"` });
    check('otro Master Admin: el servidor rechaza la solicitud (409 READ_ONLY_RECORD)', direct.status === 409 && direct.body?.error?.code === 'READ_ONLY_RECORD', JSON.stringify(direct));
    await b.context.close();
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  // Limpieza: retirar la solicitud creada (queda en bitácora como retirada).
  try {
    if (cr) {
      const cur = await A.get(`/api/v1/recovery/changes/${cr.id}`);
      const w = await A.post(`/api/v1/recovery/changes/${cr.id}/withdraw`, { reason: 'Limpieza de prueba E2E sintética' }, { 'If-Match': `"${cur.version}"` });
      check('limpieza: solicitud retirada (200)', w.status === 200, JSON.stringify(w).slice(0, 200));
      const fa = (await A.get('/api/v1/quotes/revisions?page=1&page_size=50')).items.find(x => x.requisition_id === reqId);
      check('limpieza: la familia vuelve a admitir solicitudes', fa && fa.can_request_change === true && !fa.pending_change);
    }
  } catch (e) { check('limpieza sin excepciones', false, String(e).slice(0, 300)); }
  check('sin escrituras /api fuera del POST R3A permitido', blocked.length === 0, blocked.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? `  → ${d}` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
