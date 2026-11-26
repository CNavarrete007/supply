// Cotizaciones › Solicitud a proveedores (RFQ, tarjeta 2) y Matriz de RFQ (tarjeta 3) · E2E de interfaz (Chromium) de los
// GUARDADOS REALES contra Vite + API + MariaDB SINTÉTICAS. ESCRIBE: crea por la API su requisición sintética y su validación,
// registra desde la tarjeta 2 una RFQ en Borrador (con fallo de red y reintento con la MISMA Idempotency-Key) y otra Enviada,
// marca el borrador como enviado desde la tarjeta 3 (If-Match) y comprueba que la tarjeta 4 ya puede cotizarlas. Exige
// SF_SYNTHETIC_WRITES=1. Comprueba CSRF, partidas elegidas, que no se envían precios ni correos y que nunca se escribe una
// cotización, una adjudicación ni una OC desde estas tarjetas.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/rfq_write_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const RUN = Math.random().toString(16).slice(2, 8).toUpperCase();

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await context.addInitScript(() => { window.print = () => {}; window.close = () => {}; });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = []; page.on('request', r => { if (r.method() !== 'GET' && /\/api\/v1\/(quotes|purchase-orders)/.test(r.url())) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const post = async (path, data) => { const csrf = (await api('/api/v1/auth/csrf')).csrf_token; const r = await page.request.post(UI + path, { headers: { 'X-SF-CSRF': csrf, 'Idempotency-Key': require('crypto').randomUUID() }, data }); return [r.status(), await r.json()]; };
    const ws = await api('/api/v1/quotes/write-status');
    check('guardado habilitado (write-status OK, 52 permisos)', ws.code === 'OK' && ws.expected_grants === 52, JSON.stringify(ws));
    // Requisición sintética propia (Registro RF1) con 3 partidas y su validación interna (Gestión del Contratista).
    const day = new Date().toISOString().slice(0, 10); const year = new Date().getFullYear();
    const cat = await api('/api/v1/recovery/catalogs'); const client = cat.clients.find(c => c.status === 'active' && c.code); const cats = cat.categories.filter(c => c.active).map(c => c.name);
    const rfolio = (await api(`/api/v1/recovery/folio?client_id=${client.id}&date=${day}&mode=formal`)).folio;
    const [rs, req] = await post('/api/v1/recovery/requisitions', { folio: rfolio, client_id: client.id, request_date: day, need_date: `${year + 1}-04-01`, project: `PRY-RFQUI-${RUN}`, contract: 'CTO-QA',
      client_reference: `RFQUI-${RUN}`, priority: 'normal', delivery_place: 'Almacén sintético UI', requester_name: 'Solicitante QA', requester_email: 'qa@cliente.invalid', budget: '', currency: 'MXN',
      description: `Requisición sintética RFQ UI ${RUN}`, notes: null, source: { type: 'Requisición formal del cliente', date: day, reference: null, notes: null, requirement: 'formal', due_date: null, owner: null },
      items: [{ id: null, description: `Válvula UI ${RUN}`, quantity: '8', unit: 'pza', category: cats[0] }, { id: null, description: `Manguera UI ${RUN}`, quantity: '12', unit: 'm', category: cats[0] },
        { id: null, description: `Abrazadera UI ${RUN}`, quantity: '30', unit: 'pza', category: cats[0] }], document: null });
    if (rs !== 201) throw new Error(`no se pudo crear la requisición sintética: ${rs} ${JSON.stringify(req)}`);
    const vbuyer = (await api('/api/v1/contractor-management/validation-setup')).buyers.find(b => b.has_user && b.with_access);
    const [vs, vr] = await post('/api/v1/contractor-management/validations', { requisition_id: req.id, buyer_id: vbuyer.id, technical: 'Conforme', contract: 'Conforme', budget: 'Disponible',
      strategy: 'Competencia abierta', min_quotes: '2', deadline: `${year + 1}-01-15`, criteria: 'Precio y plazo', notes: `Validación sintética RFQ UI ${RUN}` });
    if (vs !== 201) throw new Error(`no se pudo registrar la validación: ${vs} ${JSON.stringify(vr)}`);
    const det = await api(`/api/v1/quotes/rfq-requisitions/${req.id}`);
    const setup = await api('/api/v1/quotes/rfq-setup');
    const sups = setup.suppliers.filter(x => ['authorized', 'active'].includes(x.status));
    const contact = setup.contacts[0];

    // 1) Tarjeta 2: comprador → requisición → proveedor → contacto → Generar → partidas.
    await page.locator('nav button').filter({ hasText: /Cotizaciones y Comparativo$/ }).click();
    await page.getByRole('button', { name: /Solicitud a proveedores \(RFQ\)/ }).click();
    await page.getByTestId('rfq-card').waitFor();
    check('sin aviso de guardado no habilitado', await page.getByTestId('quote-write-status').count() === 0);
    const fld = l => page.getByRole('combobox', { name: l, exact: true });
    await fld('Comprador responsable').locator(`option[value="${det.item.buyer_key}"]`).waitFor({ state: 'attached', timeout: 15000 });
    await fld('Comprador responsable').selectOption(det.item.buyer_key);
    await page.getByTestId('rfq-req-modal').waitFor();
    await page.getByTestId('rfq-req-modal').getByRole('searchbox', { name: 'Buscar requisición' }).fill(det.item.folio);
    await page.getByTestId('rfq-req-option').filter({ hasText: det.item.folio }).getByRole('button', { name: 'Seleccionar' }).click();
    await page.waitForFunction(id => document.querySelector('select[aria-label="Requisición validada"]')?.value === id, req.id);
    const statusOpts = (await fld('Estatus').locator('option').allInnerTexts()).map(flat);
    check('estatus al registrar: solo Borrador o Enviada', JSON.stringify(statusOpts) === JSON.stringify(['Borrador', 'Enviada']), statusOpts.join('|'));
    const fillFor = async (sup, status) => {
      await fld('Proveedor invitado').selectOption(sup.id);
      await fld('Contacto de compras').selectOption(contact.id);
      await fld('Estatus').selectOption(status);
      await page.getByRole('button', { name: 'Generar Solicitud y Partidas' }).click();
      await page.getByTestId('rfq-line').first().waitFor();
    };
    await fillFor(sups[0], 'draft');
    await page.getByRole('checkbox', { name: `Incluir partida ${det.items[1].line_number}` }).uncheck();

    // 2) Fallo de red: no se da por guardada; el reintento usa la misma clave.
    let firstKey = '';
    await page.route('**/api/v1/quotes/rfqs', route => { if (route.request().method() !== 'POST') return route.continue(); firstKey = route.request().headers()['idempotency-key']; return route.abort('connectionreset'); }, { times: 1 });
    await page.getByRole('button', { name: /Guardar y siguiente RFQ/ }).click();
    await page.getByTestId('rfq-result').filter({ hasText: 'No se confirmó' }).waitFor({ timeout: 15000 });
    check('fallo de red: no se da por guardada (pide repetir sin duplicar)', /sin duplicarla/.test(await page.getByTestId('rfq-result').innerText()) && !!firstKey && await page.getByTestId('rfq-items').isVisible());
    const resp = page.waitForResponse(r => r.url().endsWith('/api/v1/quotes/rfqs') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Guardar y siguiente RFQ/ }).click();
    const r1 = await resp; const h1 = r1.request().headers(); const sent = JSON.parse(r1.request().postData() || '{}'); const b1 = await r1.json();
    check('reintento: POST 201 con CSRF y la MISMA Idempotency-Key; folio RFQ', r1.status() === 201 && !!h1['x-sf-csrf'] && h1['idempotency-key'] === firstKey && /^RFQ-\d{4}-\d{4,}$/.test(b1.folio || '') && b1.status === 'borrador', `${r1.status()} ${JSON.stringify(b1)}`);
    check('cuerpo: partidas elegidas en orden, Borrador, sin precios', JSON.stringify(sent.items) === JSON.stringify([det.items[0].id, det.items[2].id]) && sent.status === 'draft' && sent.supplier_id === sups[0].id
      && sent.contact_id === contact.id && !/price|precio/i.test(JSON.stringify(sent)), JSON.stringify(sent).slice(0, 300));
    await page.getByTestId('rfq-result').filter({ hasText: 'registrada en MariaDB' }).waitFor();
    const res1 = flat(await page.getByTestId('rfq-result').innerText());
    check('mensaje: folio, proveedor, Borrador y cómo marcarla enviada; lista para el siguiente proveedor', [b1.folio, sups[0].name, 'Borrador', 'márcala como enviada'].every(x => res1.includes(x))
      && await fld('Proveedor invitado').inputValue() === '' && await page.getByTestId('rfq-hidden').isVisible() && await fld('Requisición validada').inputValue() === req.id, res1);
    await shot(page, 'cot_2_rfq_guardada');

    // 3) Siguiente RFQ: otro proveedor, Enviada, todas las partidas.
    await fillFor(sups[1], 'sent');
    check('la partida ya enviada muestra la RFQ registrada', flat(await page.getByTestId('rfq-line').first().innerText()).includes(b1.folio) && !flat(await page.getByTestId('rfq-line').nth(1).innerText()).includes(b1.folio));
    check('siguiente RFQ: conserva la selección de partidas anterior (2 de 3)', flat(await page.getByTestId('rfq-items').innerText()).includes('2 seleccionada(s) de 3'));
    await page.getByRole('button', { name: 'Seleccionar todas' }).click();
    const resp2 = page.waitForResponse(r => r.url().endsWith('/api/v1/quotes/rfqs') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Guardar y siguiente RFQ/ }).click();
    const r2 = await resp2; const b2 = await r2.json();
    check('segunda RFQ: 201 Enviada con folio consecutivo y 3 partidas', r2.status() === 201 && b2.status === 'enviada' && b2.items === 3 && Number(b2.folio.split('-')[2]) === Number(b1.folio.split('-')[2]) + 1, JSON.stringify(b2));
    await page.getByTestId('rfq-result').filter({ hasText: b2.folio }).waitFor();
    check('mensaje de Enviada: imprimir desde la Matriz de RFQ', /Imprímela desde la Matriz de RFQ/.test(await page.getByTestId('rfq-result').innerText()));

    // 4) Tarjeta 3: el borrador se marca como enviado (If-Match); la enviada no ofrece la acción.
    await page.getByTestId('rfq-result').getByRole('button', { name: 'Ver en la matriz' }).click();
    await page.getByTestId('rfq-contact-all').click();
    await page.getByRole('searchbox', { name: 'Buscar en la matriz' }).fill(req.folio || det.item.folio);
    const row1 = page.getByTestId('rfq-row').filter({ hasText: b1.folio }); await row1.waitFor({ timeout: 15000 });
    const row2 = page.getByTestId('rfq-row').filter({ hasText: b2.folio }); await row2.waitFor();
    check('matriz: el borrador dice «Por enviar» y ofrece «Marcar enviada»; la enviada no', flat(await row1.innerText()).includes('Por enviar') && await row1.getByRole('button', { name: /Marcar enviada/ }).count() === 1
      && await row2.getByRole('button', { name: /Marcar enviada/ }).count() === 0, flat(await row1.innerText()));
    await row1.getByRole('button', { name: /Ver formato/ }).click();
    const doc = flat(await page.getByTestId('rfq-doc').locator('iframe').contentFrame().locator('body').innerText());
    check('formato registrado: folio, proveedor, partidas elegidas, sin precios ni marca de vista previa', [b1.folio, sups[0].name, det.items[0].description, det.items[2].description].every(x => doc.includes(x))
      && !doc.includes(det.items[1].description) && !doc.includes('VISTA PREVIA') && !/precio unitario|\$\s?\d/i.test(doc), doc.slice(0, 300));
    await page.getByTestId('rfq-doc').getByRole('button', { name: 'Cerrar' }).click();
    await row1.getByRole('button', { name: /Marcar enviada/ }).click();
    await page.getByTestId('rfq-mark').waitFor();
    check('confirmación: SupplyFlow no envía correos, solo registra el estatus', /no envía correos/.test(await page.getByTestId('rfq-mark').innerText()));
    const mresp = page.waitForResponse(r => /\/api\/v1\/quotes\/rfqs\/[0-9a-f-]{36}\/mark-sent$/.test(r.url()));
    await page.getByTestId('rfq-mark').getByRole('button', { name: /Sí, ya la envié/ }).click();
    const m = await mresp; const mb = await m.json();
    check('marcar enviada: POST 200 con If-Match "1" → Enviada, versión 2', m.status() === 200 && m.request().headers()['if-match'] === '"1"' && mb.status === 'enviada' && mb.version === 2, `${m.status()} ${JSON.stringify(mb)}`);
    await page.getByTestId('rfq-mark').waitFor({ state: 'detached' });
    await page.waitForFunction(f => [...document.querySelectorAll('[data-testid="rfq-row"]')].some(r => r.textContent.includes(f) && r.textContent.includes('Enviada') && !r.textContent.includes('Marcar enviada')), b1.folio, { timeout: 15000 });
    check('matriz actualizada: Enviada y sin «Marcar enviada»', true);
    await shot(page, 'cot_3_rfq_enviada');

    // 5) Tarjeta 4: las dos RFQ (ya enviadas) se pueden cotizar.
    await page.getByRole('button', { name: /Cotizaciones recibidas/ }).click();
    await page.getByTestId('quote-card').waitFor();
    await page.getByRole('combobox', { name: 'Comprador responsable' }).selectOption(det.item.buyer_key);
    await page.getByTestId('rfq-req-modal').getByRole('searchbox', { name: 'Buscar requisición' }).fill(det.item.folio);
    await page.getByTestId('rfq-req-option').filter({ hasText: det.item.folio }).getByRole('button', { name: 'Seleccionar' }).click();
    await page.waitForFunction(n => document.querySelectorAll('select[aria-label="RFQ emitida"] option').length >= n + 1, 2);
    const opts = await page.locator('select[aria-label="RFQ emitida"] option').evaluateAll(os => os.map(o => ({ t: o.textContent, d: o.disabled })));
    check('tarjeta 4: ambas RFQ disponibles para registrar su cotización', [b1.folio, b2.folio].every(f => opts.some(o => o.t.includes(f) && !o.d)), JSON.stringify(opts));
    check('solo se escribieron RFQ (POST rfqs y mark-sent); nunca cotización, adjudicación ni OC', writes.length === 4 && writes.every(w => /^POST \/api\/v1\/quotes\/rfqs(\/[0-9a-f-]{36}\/mark-sent)?$/.test(w)), writes.join(' | '));
    console.log(`RFQ sintéticas: ${b1.folio} (Borrador → Enviada), ${b2.folio} (Enviada) de ${det.item.folio}`);
  } catch (e) {
    check('flujo completo sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nCotizaciones · registro de RFQ (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
