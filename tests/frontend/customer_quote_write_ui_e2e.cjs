// Cotizaciones › Cotización formal al cliente (tarjeta 6) · E2E de interfaz (Chromium) del BORRADOR INTERNO REAL contra Vite + API +
// MariaDB SINTÉTICAS. ESCRIBE: crea por la API su requisición sintética, su validación, dos RFQ enviadas (MXN y USD) y dos cotizaciones
// de proveedor; desde la tarjeta 6 guarda la cotización al cliente como borrador, la reabre, la edita (If-Match) y comprueba la
// matriz (tarjeta 8). Exige SF_SYNTHETIC_WRITES=1. Comprueba CSRF, Idempotency-Key, que un fallo de red no se da por guardado y
// que el reintento usa la MISMA clave, que el navegador no envía precios ni totales (el servidor los recalcula y coinciden con la
// tarjeta), 412 cuando otra sesión guardó antes (se recarga la versión vigente) y que nunca se escribe una RFQ, una cotización de
// proveedor, una adjudicación ni una OC ni se envía a revisión/autoriza/envía la cotización al cliente.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/customer_quote_write_ui_e2e.cjs
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const { randomUUID } = require('crypto');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const RUN = Math.random().toString(16).slice(2, 8).toUpperCase();
const fmt = n => Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  const cq = await import(pathToFileURL(path.join(__dirname, '../../src/views/quotes/customerQuoteBuilder.mjs')).href);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = []; const sent = [];
  page.on('request', r => {
    if (r.method() === 'GET' || !/\/api\/v1\/(quotes|purchase-orders|recovery|contractor-management)/.test(r.url())) return;
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
    if (/\/api\/v1\/quotes\/customer-quotes/.test(r.url())) sent.push({ method: r.method(), path: new URL(r.url()).pathname, headers: r.headers(), body: r.postDataJSON() });
  });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const ws = await api('/api/v1/quotes/write-status');
    check('guardado habilitado (write-status OK, 111 permisos)', ws.code === 'OK' && ws.expected_grants === 111, JSON.stringify(ws));
    // Fixtures propios por la API (page.request no cuenta como escritura de la interfaz).
    const post = async (p, data) => { const csrf = (await api('/api/v1/auth/csrf')).csrf_token; const r = await page.request.post(UI + p, { headers: { 'X-SF-CSRF': csrf, 'Idempotency-Key': randomUUID() }, data }); return [r.status(), await r.json().catch(() => ({}))]; };
    const must = ([s, o], what) => { if (s !== 200 && s !== 201) throw new Error(`BLOCKED: ${what} (${s} ${JSON.stringify(o)})`); return o; };
    const day = new Date().toISOString().slice(0, 10); const year = new Date().getFullYear();
    const cat = await api('/api/v1/recovery/catalogs'); const client = cat.clients.find(c => c.status === 'active' && c.code); const cats = cat.categories.filter(c => c.active).map(c => c.name);
    const rfolio = (await api(`/api/v1/recovery/folio?client_id=${client.id}&date=${day}&mode=formal`)).folio;
    const req = must(await post('/api/v1/recovery/requisitions', { folio: rfolio, client_id: client.id, request_date: day, need_date: `${year + 1}-04-01`, project: `PRY-CQUI-${RUN}`, contract: 'CTO-QA',
      client_reference: `CQUI-${RUN}`, priority: 'normal', delivery_place: 'Almacén sintético CQ UI', requester_name: 'Solicitante QA', requester_email: 'qa@cliente.invalid', budget: '', currency: 'MXN',
      description: `Requisición sintética cotización al cliente UI ${RUN}`, notes: null, source: { type: 'Requisición formal del cliente', date: day, reference: null, notes: null, requirement: 'formal', due_date: null, owner: null },
      items: [{ id: null, description: `Bomba UI ${RUN}`, quantity: '10', unit: 'pza', category: cats[0] }, { id: null, description: `Instalación UI ${RUN}`, quantity: '2', unit: 'servicio', category: cats[0] }], document: null }), 'requisición');
    const vbuyer = (await api('/api/v1/contractor-management/validation-setup')).buyers.find(b => b.has_user && b.with_access);
    must(await post('/api/v1/contractor-management/validations', { requisition_id: req.id, buyer_id: vbuyer.id, technical: 'Conforme', contract: 'Conforme', budget: 'Disponible',
      strategy: 'Competencia abierta', min_quotes: '2', deadline: `${year + 1}-01-15`, criteria: 'Precio y plazo', notes: `Validación sintética CQ UI ${RUN}` }), 'validación');
    const rsetup = await api('/api/v1/quotes/rfq-setup'); const sups = rsetup.suppliers.filter(x => ['authorized', 'active'].includes(x.status));
    const reqLines = (await api(`/api/v1/quotes/rfq-requisitions/${req.id}`)).items;
    for (const [n, cur, prices] of [[0, 'MXN', ['100', '500']], [1, 'USD', ['6', '600']]]) {
      const f = must(await post('/api/v1/quotes/rfqs', { requisition_id: req.id, supplier_id: sups[n].id, contact_id: rsetup.contacts[0].id, issue_date: day, deadline: day, required_date: null,
        currency: cur, delivery_place: '', docs: '', conditions: '', status: 'sent', items: reqLines.map(l => l.id) }), 'RFQ');
      const items = (await api(`/api/v1/quotes/rfqs/${f.id}`)).items;
      must(await post('/api/v1/quotes/supplier-quotes', { rfq_id: f.id, supplier_reference: `P-UI-${RUN}-${n}`, quote_date: day, valid_until: null, vat: '16', currency: cur, lead_days: '5', payment: 'PPD',
        technical: '100', documentation: '100', notes: '', document: null, lines: items.map((i, k) => ({ line_number: Number(i.line_number), offered: true, qty: String(Math.round(Number(i.quantity))), price: prices[k] })) }), 'cotización de proveedor');
    }
    const det = await api(`/api/v1/quotes/rfq-requisitions/${req.id}`);
    const cmp = await api(`/api/v1/quotes/comparison?requisition=${req.id}`);
    check('fixtures: requisición sin cotización al cliente previa', cmp.customer_quote === null, JSON.stringify(cmp.customer_quote));
    writes.splice(0);

    // Tarjeta 6: comprador → requisición sintética.
    await page.locator('nav button').filter({ hasText: /Cotizaciones y Comparativo$/ }).click();
    await page.getByRole('button', { name: /^6.*Cotización al cliente/ }).click();
    const card = page.getByTestId('cq-card'); await card.waitFor();
    check('sin aviso de guardado no habilitado', await page.getByTestId('quote-write-status').count() === 0);
    const buyerSel = page.getByRole('combobox', { name: 'Comprador responsable' });
    await buyerSel.locator(`option[value="${det.item.buyer_key}"]`).waitFor({ state: 'attached', timeout: 15000 });
    await buyerSel.selectOption(det.item.buyer_key);
    const reqSel = page.getByRole('combobox', { name: 'Requisición del cliente' });
    await reqSel.locator(`option[value="${req.id}"]`).waitFor({ state: 'attached', timeout: 15000 });
    check('selector: la requisición sintética se ofrece para guardar (sin marca de bloqueo)', (await reqSel.locator(`option[value="${req.id}"]`).getAttribute('data-kind')) === 'new');
    await reqSel.selectOption(req.id);
    await page.getByTestId('cq-line').nth(1).waitFor();
    check('nueva captura: Rev. 0, folio automático, estatus Borrador fijo, sin bloqueo ni edición',
      (await page.getByRole('textbox', { name: 'Revisión' }).inputValue()) === '0' && (await page.getByRole('textbox', { name: 'Folio de cotización' }).inputValue()) === ''
      && await page.getByRole('combobox', { name: 'Estatus' }).isDisabled() && (await page.getByRole('combobox', { name: 'Estatus' }).inputValue()) === 'Borrador'
      && await page.getByTestId('cq-block').count() === 0 && await page.getByTestId('cq-edit-banner').count() === 0);
    // Captura: margen, manipulación, marca, comprador, tipo de cambio USD y Service Fee.
    const lines = cq.linesFromComparison(cmp.lines, { usd_mxn: '18.5' }); // la tarjeta elige la mejor oferta en MXN con el tipo de cambio capturado
    await page.getByLabel('% margen partida 1').fill('20'); await page.getByLabel('Entrega / manipulación partida 1').fill('150'); await page.getByLabel('Marca / modelo partida 1').fill(`ACME UI ${RUN}`);
    await page.getByLabel('% margen partida 2').fill('10');
    await page.getByRole('combobox', { name: 'Comprador', exact: true }).selectOption({ index: 1 });
    await page.getByRole('textbox', { name: '1 USD = MXN' }).fill('18.5');
    await page.getByLabel('Service Fee %').fill('5');
    await page.getByLabel('Tiempo de entrega ofrecido').fill(`5 días hábiles ${RUN}`);
    const f = { ...cq.emptyCq(day), currency: await page.getByRole('combobox', { name: 'Moneda de cotización / cliente' }).inputValue(), usd_mxn: '18.5', eur_mxn: await page.getByRole('textbox', { name: '1 EUR = MXN' }).inputValue(), sf_pct: '5' };
    const priced = lines.map((l, i) => ({ ...l, margin: i ? '10' : '20', handling: i ? '0' : '150' }));
    const t = cq.cqTotals(priced, f);
    check('tarjeta: total general calculado', (await page.getByRole('textbox', { name: 'Total general', exact: true }).inputValue()) === fmt(t.total), `${t.total}`);
    check('estado: lista para guardarse como borrador interno', flat(await page.getByTestId('cq-status').innerText()).includes('Lista para guardarse como borrador interno'));

    // 1) Fallo de red: no se da por guardado; el reintento usa la MISMA Idempotency-Key.
    await page.route('**/api/v1/quotes/customer-quotes', r => r.abort());
    await page.getByRole('button', { name: /Guardar cotización al cliente/ }).click();
    await page.locator('[data-testid="cq-result"][data-kind="error"]').waitFor();
    check('fallo de red: «No se confirmó», sin folio', flat(await page.getByTestId('cq-result').innerText()).startsWith('No se confirmó el guardado') && (await page.getByRole('textbox', { name: 'Folio de cotización' }).inputValue()) === '');
    await page.unroute('**/api/v1/quotes/customer-quotes');
    const created = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/v1\/quotes\/customer-quotes$/.test(r.url()));
    await page.getByRole('button', { name: /Guardar cotización al cliente/ }).click();
    const cr = await created; const out = await cr.json();
    const [p1, p2] = sent.filter(x => x.method === 'POST');
    check('alta: 201 con folio COT-AAAA-NNNN y Rev. 0', cr.status() === 201 && new RegExp(`^COT-${year}-\\d{4}$`).test(out.folio) && out.revision === 0, JSON.stringify(out));
    check('reintento con la MISMA Idempotency-Key y CSRF', p1 && p2 && p1.headers['idempotency-key'] === p2.headers['idempotency-key'] && /^[0-9a-f-]{36}$/.test(p2.headers['idempotency-key']) && !!p2.headers['x-sf-csrf']);
    check('el navegador no envía precios, totales ni estatus', p2 && !/unit_price|subtotal|"total|status|cost/.test(JSON.stringify(p2.body)) && p2.body.requisition_id === req.id && p2.body.lines.length === 2, JSON.stringify(p2 && p2.body).slice(0, 300));
    check('el servidor recalcula el mismo total que la tarjeta', Math.abs(Number(out.total) - t.total) < 0.005, `${out.total} vs ${t.total}`);
    await page.locator('[data-testid="cq-result"][data-kind="ok"]').waitFor();
    check('mensaje: guardada como borrador interno, no enviada', flat(await page.getByTestId('cq-result').innerText()).includes(`${out.folio} (Rev. 0) guardada en MariaDB como borrador interno`) && flat(await page.getByTestId('cq-result').innerText()).includes('No se envió a revisión ni al cliente'));
    // 2) Se reabre como borrador editable (versión 1).
    await page.getByTestId('cq-edit-banner').waitFor();
    await page.locator(`select[aria-label="Requisición del cliente"] option[value="${req.id}"][data-kind="draft"]`).waitFor({ state: 'attached' });
    check('selector: la requisición ahora indica «borrador … (editar)»', flat(await reqSel.locator(`option[value="${req.id}"]`).innerText()).includes(`borrador ${out.folio} (editar)`));
    check('se abre en modo edición: folio, Rev. 0, versión 1', flat(await page.getByTestId('cq-edit-banner').innerText()).startsWith(`Editando el borrador ${out.folio} · Rev. 0 · versión 1`) && (await page.getByRole('textbox', { name: 'Folio de cotización' }).inputValue()) === out.folio);
    check('el borrador conserva lo capturado (margen, manipulación, marca, entrega)', (await page.getByLabel('% margen partida 1').inputValue()) === '20' && (await page.getByLabel('Entrega / manipulación partida 1').inputValue()) === '150'
      && (await page.getByLabel('Marca / modelo partida 1').inputValue()) === `ACME UI ${RUN}` && (await page.getByLabel('Tiempo de entrega ofrecido').inputValue()) === `5 días hábiles ${RUN}`);
    const cmp2 = await api(`/api/v1/quotes/comparison?requisition=${req.id}`);
    check('comparativo: la requisición tiene su borrador editable (no importado, sin aprobación)', cmp2.customer_quote && cmp2.customer_quote.editable_draft === true && cmp2.customer_quote.internal_approval_status === 'not_requested' && cmp2.customer_quote.imported === false);
    await shot(page, 'cot_6_borrador_guardado');

    // 3) Edición con If-Match "1" → versión 2.
    await page.getByLabel('% margen partida 2').fill('25');
    const updated = page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\/v1\/quotes\/customer-quotes\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('button', { name: /Guardar cotización al cliente/ }).click();
    const ur = await updated; const uo = await ur.json();
    const put1 = sent.filter(x => x.method === 'PUT')[0];
    const t2 = cq.cqTotals(priced.map((l, i) => (i ? { ...l, margin: '25' } : l)), f);
    check('edición: PUT con If-Match "1" → 200 versión 2, total recalculado', ur.status() === 200 && put1.headers['if-match'] === '"1"' && uo.version === 2 && Math.abs(Number(uo.total) - t2.total) < 0.005 && !('requisition_id' in put1.body), JSON.stringify(uo));
    await page.locator('[data-testid="cq-edit-banner"]', { hasText: 'versión 2' }).waitFor();
    check('mensaje de borrador actualizado', flat(await page.getByTestId('cq-result').innerText()).includes(`Borrador ${out.folio} (Rev. 0) actualizado en MariaDB`));
    const draft = await api(`/api/v1/quotes/customer-quotes/${out.id}/draft`);
    check('GET …/draft: margen 25 en la partida 2, total del servidor', draft.item.version === 2 && Number(draft.items.find(i => Number(i.line_number) === 2).margin) === 25 && Math.abs(Number(draft.item.total_amount) - t2.total) < 0.005);

    // 4) Otra sesión guarda antes (versión 3): el guardado de la tarjeta (If-Match 2) → 412 y se recarga la versión vigente.
    const csrf = (await api('/api/v1/auth/csrf')).csrf_token;
    const other = await page.request.put(`${UI}/api/v1/quotes/customer-quotes/${out.id}`, { headers: { 'X-SF-CSRF': csrf, 'Idempotency-Key': randomUUID(), 'If-Match': '"2"' }, data: { ...put1.body, notes: `Nota de otra sesión ${RUN}`, lines: put1.body.lines.map((l, i) => (i ? { ...l, margin: '30' } : l)) } });
    check('otra sesión guarda la versión 3 (API)', other.status() === 200 && (await other.json()).version === 3);
    await page.getByLabel('% margen partida 1').fill('22');
    const stale = page.waitForResponse(r => r.request().method() === 'PUT' && /customer-quotes\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('button', { name: /Guardar cotización al cliente/ }).click();
    check('versión vieja: 412', (await stale).status() === 412);
    await page.locator('[data-testid="cq-edit-banner"]', { hasText: 'versión 3' }).waitFor();
    check('412: aviso y se carga la versión vigente (margen 30, nota de la otra sesión)', flat(await page.getByTestId('cq-result').innerText()).startsWith('Otra sesión modificó este borrador') && (await page.getByLabel('% margen partida 2').inputValue()) === '30'
      && (await page.getByLabel('% margen partida 1').inputValue()) === '20' && (await page.getByLabel('Notas comerciales / Comentarios del PDF').inputValue()) === `Nota de otra sesión ${RUN}`);

    // 5) Limpiar en edición vuelve a lo guardado.
    await page.getByLabel('% margen partida 1').fill('99');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    check('Limpiar en edición vuelve a lo guardado en MariaDB', (await page.getByLabel('% margen partida 1').inputValue()) === '20' && await page.getByTestId('cq-edit-banner').count() === 1);

    // 6) Tarjeta 8: el borrador aparece en la matriz como Borrador.
    await page.getByRole('button', { name: /Matriz de cotizaciones al cliente/ }).click();
    await page.getByTestId('cqm-client-card').first().waitFor();
    await page.getByRole('button', { name: /Abrir todas/ }).click();
    await page.getByRole('searchbox', { name: 'Buscar cotización al cliente' }).fill(out.folio);
    const row = page.locator(`[data-testid="cqm-row"][data-folio="${out.folio}"]`).filter({ hasText: req.folio });
    await row.first().waitFor({ timeout: 15000 });
    const draft3 = await api(`/api/v1/quotes/customer-quotes/${out.id}/draft`); const r8 = flat(await row.first().innerText());
    check('tarjeta 8: el borrador en la matriz (Rev. 0, Borrador, total vigente, decisión «Sin registrar»)', r8.includes('Rev. 0') && r8.includes('Borrador') && r8.includes(fmt(Number(draft3.item.total_amount))) && r8.includes('Sin registrar') && !r8.includes('not_recorded'), r8);
    await shot(page, 'cot_8_borrador_en_matriz');

    // Alcance: solo POST/PUT de cotizaciones al cliente desde la interfaz.
    check('la interfaz solo escribió el borrador (2 POST + 2 PUT); nada de RFQ, proveedor, adjudicación, OC ni emisión', writes.length === 4 && writes.every(w => /^(POST \/api\/v1\/quotes\/customer-quotes|PUT \/api\/v1\/quotes\/customer-quotes\/[0-9a-f-]{36})$/.test(w)), writes.join(' | '));
    const cmp3 = await api(`/api/v1/quotes/comparison?requisition=${req.id}`);
    check('sigue como borrador interno (draft, sin aprobación ni decisión)', cmp3.customer_quote.document_status === 'draft' && cmp3.customer_quote.client_decision_status === 'not_recorded' && cmp3.customer_quote.editable_draft === true);
    check('sin errores de JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo completo sin excepciones', false, String(e && e.stack || e).slice(0, 600));
  } finally {
    await browser.close();
  }
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'} · ${n}${ok || !d ? '' : ` — ${d}`}`);
  console.log(`Cotizaciones · borrador de cotización al cliente (UI): ${results.length - failed.length}/${results.length} ${failed.length ? 'FAIL' : 'PASS'}`);
  process.exit(failed.length ? 1 : 0);
})();
