// Cotizaciones › Registro de cotización (tarjeta 4) · E2E de interfaz (Chromium) de los GUARDADOS REALES contra Vite + API +
// MariaDB SINTÉTICAS. ESCRIBE: registra una cotización contra una RFQ sintética enviada y sin cotización (folio con prefijo
// SF_RFQ_FOLIO_PREFIX, por omisión RFQ-QW-; la emisión de RFQ sigue bloqueada y en el sandbox se siembran por SQL), la edita
// desde la matriz interna y descarga su PDF. Exige SF_SYNTHETIC_WRITES=1. Comprueba CSRF, Idempotency-Key, que un fallo de red
// no se da por guardado y que el reintento usa la MISMA clave, que el navegador no envía importes, If-Match en la edición, que
// las importadas/sin RFQ no se editan y que nunca se escribe una RFQ, una adjudicación ni una OC.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/supplier_quote_write_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
const PREFIX = process.env.SF_RFQ_FOLIO_PREFIX || 'RFQ-QW-';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const RUN = Math.random().toString(16).slice(2, 8).toUpperCase();
const pdfBytes = label => Buffer.from(`%PDF-1.4\n% SupplyFlow UI ${label}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
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
    const ws = await api('/api/v1/quotes/write-status');
    check('guardado habilitado (write-status OK, 43 permisos)', ws.code === 'OK' && ws.expected_grants === 43, JSON.stringify(ws));
    // RFQ sintética enviada y sin cotización (con su requisición validada y su comprador).
    let fx = null;
    for (const r of (await api('/api/v1/quotes/rfq-requisitions?rfq=with&page=1&page_size=50')).items) {
      const det = await api(`/api/v1/quotes/rfq-requisitions/${r.id}`);
      const f = det.rfqs.find(x => x.folio.startsWith(PREFIX) && !x.quote_folios && ['sent', 'enviada'].includes(x.status));
      if (f) { fx = { req: r, det, rfq: f }; break; }
    }
    if (!fx) throw new Error(`BLOCKED: no hay RFQ sintética ${PREFIX}* enviada y sin cotización (siembra por SQL en el sandbox).`);
    const items = (await api(`/api/v1/quotes/rfqs/${fx.rfq.id}`)).items;

    await page.locator('nav button').filter({ hasText: /Cotizaciones y Comparativo$/ }).click();
    await page.getByRole('button', { name: /Cotizaciones recibidas/ }).click();
    const card = page.getByTestId('quote-card'); await card.waitFor();
    check('sin aviso de guardado no habilitado', await page.getByTestId('quote-write-status').count() === 0);
    await page.getByRole('combobox', { name: 'Comprador responsable' }).locator(`option[value="${fx.req.buyer_key}"]`).waitFor({ state: 'attached', timeout: 15000 });
    await page.getByRole('combobox', { name: 'Comprador responsable' }).selectOption(fx.req.buyer_key);
    await page.getByTestId('rfq-req-modal').waitFor();
    await page.getByTestId('rfq-req-modal').getByRole('searchbox', { name: 'Buscar requisición' }).fill(fx.req.folio);
    await page.getByTestId('rfq-req-option').filter({ hasText: fx.req.folio }).getByRole('button', { name: 'Seleccionar' }).click();
    await page.waitForFunction(n => document.querySelectorAll('select[aria-label="RFQ emitida"] option').length === n + 1, fx.det.rfqs.length);
    const quoted = fx.det.rfqs.filter(x => x.quote_folios);
    const disabled = await page.locator('select[aria-label="RFQ emitida"] option[disabled]').count();
    check('RFQ con cotización: deshabilitadas en la lista («ya cotizada»)', disabled === quoted.length && (!quoted.length || flat(await page.locator('select[aria-label="RFQ emitida"]').innerText()).includes(`ya cotizada: ${quoted[0].quote_folios}`)), `${disabled} / ${quoted.length}`);
    await page.getByRole('combobox', { name: 'RFQ emitida' }).selectOption(fx.rfq.id);
    await page.getByTestId('quote-line').first().waitFor();
    await page.getByLabel('Referencia del proveedor').fill(`PROV-UI-${RUN}`);
    await page.getByLabel('Fecha de cotización').fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel('Días de entrega').fill('9');
    await page.getByRole('combobox', { name: 'Condiciones de pago (SAT / SHCP)' }).selectOption('PUE');
    for (const [n, it] of items.entries()) await page.getByLabel(`Precio unitario partida ${Number(it.line_number)}`).fill(n === 0 ? '123.45' : '10');
    await page.getByLabel('PDF de la cotización').setInputFiles({ name: `oferta-${RUN}.pdf`, mimeType: 'application/pdf', buffer: pdfBytes(`A ${RUN}`) });
    await page.getByText(`oferta-${RUN}.pdf`).waitFor();
    const uiTotal = await page.getByRole('textbox', { name: 'Total de la cotización recibida' }).inputValue();

    // 1) Fallo de red: no se da por guardada; el reintento usa la misma clave.
    let firstKey = '';
    await page.route('**/api/v1/quotes/supplier-quotes', route => { firstKey = route.request().headers()['idempotency-key']; return route.abort('connectionreset'); }, { times: 1 });
    await page.getByRole('button', { name: /Guardar cotización/ }).click();
    await page.getByTestId('quote-result').filter({ hasText: 'No se confirmó' }).waitFor({ timeout: 15000 });
    check('fallo de red: no se da por guardada (pide reintentar sin duplicar)', /sin duplicarla/.test(await page.getByTestId('quote-result').innerText()) && !!firstKey);
    const resp = page.waitForResponse(r => r.url().endsWith('/api/v1/quotes/supplier-quotes') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Guardar cotización/ }).click();
    const r1 = await resp; const h1 = r1.request().headers(); const sent = JSON.parse(r1.request().postData() || '{}'); const b1 = await r1.json();
    check('reintento: POST 201 con CSRF y la MISMA Idempotency-Key; folio COT', r1.status() === 201 && !!h1['x-sf-csrf'] && h1['idempotency-key'] === firstKey && /^COT-\d{4}-\d{4,}$/.test(b1.folio || ''), `${r1.status()} ${JSON.stringify(b1)}`);
    check('el navegador no envía importes; sí partidas, RFQ y PDF en base64', !('total' in sent) && !('subtotal' in sent) && sent.rfq_id === fx.rfq.id && sent.lines.length === items.length && sent.document?.name === `oferta-${RUN}.pdf`
      && Buffer.from(sent.document.data, 'base64').equals(pdfBytes(`A ${RUN}`)), JSON.stringify({ ...sent, document: sent.document && { name: sent.document.name } }).slice(0, 300));
    const fmt = n => Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    check('total del servidor = total calculado en la tarjeta', fmt(b1.total) === uiTotal, `${b1.total} vs ${uiTotal}`);
    await page.getByTestId('quote-result').filter({ hasText: 'registrada en MariaDB' }).waitFor();
    const res1 = flat(await page.getByTestId('quote-result').innerText());
    check('mensaje: folio, proveedor, RFQ, total y PDF', [b1.folio, fx.rfq.folio, fx.rfq.supplier_name, `oferta-${RUN}.pdf`].every(x => res1.includes(x)), res1);
    await page.waitForFunction(([id, f]) => { const o = document.querySelector(`select[aria-label="RFQ emitida"] option[value="${id}"]`); return o && o.disabled && o.textContent.includes(f); }, [fx.rfq.id, b1.folio], { timeout: 15000 });
    check('tras guardar: la RFQ queda «ya cotizada» con el folio y el formulario listo para otra RFQ', (await page.getByRole('combobox', { name: 'RFQ emitida' }).inputValue()) === '' && (await page.getByText(`Último registrado: ${b1.folio}.`).count()) === 1);
    await shot(page, 'cot_4_guardada');
    const d1 = await api(`/api/v1/quotes/supplier-quotes/${b1.id}`);
    check('MariaDB: Recibida, versión 1, editable, PDF y partidas', d1.item.legacy_status === 'Recibida' && d1.item.version === 1 && d1.item.editable === true && d1.item.document?.name === `oferta-${RUN}.pdf`
      && d1.items.length === items.length && Number(d1.items[0].unit_price) === 123.45 && Number(d1.item.lead_days) === 9 && d1.item.payment_terms === 'PUE', JSON.stringify(d1.item).slice(0, 300));

    // 2) Matriz interna → EDITAR abre la tarjeta 4 en modo edición (If-Match).
    await page.getByRole('button', { name: /Ver matriz/ }).click();
    await page.getByRole('button', { name: 'Abrir todas: Todas las cotizaciones' }).click();
    const row = page.locator(`[data-testid="sqm-row"][data-folio="${b1.folio}"]`); await row.waitFor({ timeout: 15000 });
    check('matriz: la cotización con PDF (VER PDF)', flat(await row.innerText()).includes('VER PDF'));
    const detResp = page.waitForResponse(r => r.url().endsWith(`/api/v1/quotes/supplier-quotes/${b1.id}`));
    await row.getByRole('button', { name: 'EDITAR' }).click();
    await detResp;
    await page.getByTestId('quote-edit-banner').filter({ hasText: `Editando ${b1.folio}` }).waitFor();
    check('EDITAR: tarjeta 4 en modo edición con la versión y los datos registrados', (await page.getByTestId('quote-edit-banner').innerText()).includes('versión 1')
      && await page.getByLabel('Días de entrega').inputValue() === '9' && await page.getByRole('combobox', { name: 'RFQ emitida' }).isDisabled() && await page.getByRole('button', { name: /Guardar cambios/ }).isEnabled());
    const dl = await page.request.get(UI + (await page.getByTestId('quote-doc-current').getByRole('link').getAttribute('href')));
    check('PDF registrado: descarga privada idéntica', dl.status() === 200 && dl.headers()['content-type'].startsWith('application/pdf') && (await dl.body()).equals(pdfBytes(`A ${RUN}`)) && /no-store/.test(dl.headers()['cache-control'] || ''));
    await page.getByLabel('Días de entrega').fill('12');
    await page.getByLabel(`Precio unitario partida ${Number(items[0].line_number)}`).fill('120');
    await page.getByLabel('PDF de la cotización').setInputFiles({ name: `oferta-v2-${RUN}.pdf`, mimeType: 'application/pdf', buffer: pdfBytes(`B ${RUN}`) });
    await page.getByText(`oferta-v2-${RUN}.pdf`).first().waitFor();
    const put = page.waitForResponse(r => r.url().endsWith(`/api/v1/quotes/supplier-quotes/${b1.id}`) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /Guardar cambios/ }).click();
    const r2 = await put; const b2 = await r2.json();
    check('edición: PUT 200 con If-Match "1" → versión 2 (días, partidas, importes y PDF)', r2.status() === 200 && r2.request().headers()['if-match'] === '"1"' && b2.version === 2
      && ['lead_days', 'lines', 'total', 'document'].every(k => (b2.changed || []).includes(k)), `${r2.status()} ${JSON.stringify(b2)}`);
    await page.getByTestId('quote-edit-banner').filter({ hasText: 'versión 2' }).waitFor({ timeout: 15000 });
    check('mensaje de cambios guardados y versión nueva en pantalla', /Cambios de .* guardados en MariaDB \(.*días de entrega.*\); versión 2/.test(flat(await page.getByTestId('quote-result').innerText())) && await page.getByLabel('Días de entrega').inputValue() === '12');
    const dl2 = await page.request.get(UI + `/api/v1/quotes/supplier-quotes/${b1.id}/document`);
    check('PDF reemplazado: se descarga el nuevo', (await dl2.body()).equals(pdfBytes(`B ${RUN}`)));
    await shot(page, 'cot_4_edicion');
    await page.getByRole('button', { name: 'Cancelar edición' }).click();
    check('Cancelar edición: vuelve a una captura nueva', await page.getByTestId('quote-edit-banner').count() === 0 && await page.getByRole('combobox', { name: 'Comprador responsable' }).isEnabled() && await page.getByLabel('Días de entrega').inputValue() === '');

    // 3) Las importadas / sin RFQ se conservan: EDITAR muestra el detalle con el motivo.
    const list = await api('/api/v1/quotes/supplier-quotes?page=1&page_size=50');
    const keep = list.items.find(x => x.imported || !x.rfq_folio || x.source_kind !== 'explicit');
    if (keep) {
      await page.getByRole('button', { name: /Matriz interna de proveedores/ }).first().click();
      await page.getByRole('button', { name: 'Abrir todas: Todas las cotizaciones' }).click();
      const kr = page.locator(`[data-testid="sqm-row"][data-folio="${keep.folio}"]`); await kr.waitFor({ timeout: 15000 });
      await kr.getByRole('button', { name: 'EDITAR' }).click();
      await page.getByTestId('sqm-detail').getByText('se conserva como expediente').waitFor({ timeout: 15000 });
      check('importada o sin RFQ: EDITAR muestra el detalle con el motivo (no abre la edición)', await page.getByTestId('quote-edit-banner').count() === 0);
      await page.getByTestId('sqm-detail').getByRole('button', { name: 'Cerrar' }).click();
    }
    check('solo se escribió la cotización (POST/PUT supplier-quotes); nunca RFQ, adjudicación ni OC', writes.length >= 3 && writes.every(w => /^(POST|PUT) \/api\/v1\/quotes\/supplier-quotes(\/[0-9a-f-]{36})?$/.test(w)), writes.join(' | '));
    console.log(`Cotización sintética: ${b1.folio} (${fx.rfq.folio})`);
  } catch (e) {
    check('flujo completo sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nCotizaciones · registro de cotización (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
