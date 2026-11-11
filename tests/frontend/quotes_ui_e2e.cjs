// Cotizaciones y Comparativo · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda
// petición /api que no sea GET (salvo login/logout) se aborta. Valores esperados calculados desde la API (RFQ-QA-0001/0004,
// COT-QA-0001..0004, CQ-QA-0001 con su revisión R1 aprobada y la adjudicación vigente COT-QA-0004).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/quotes_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ');
const usd = v => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await context.addInitScript(() => { window.print = () => {}; window.close = () => {}; });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const rfqs = await api('/api/v1/quotes/rfqs?page=1&page_size=50');
    const sqs = await api('/api/v1/quotes/supplier-quotes?page=1&page_size=50');
    const cqAll = await api('/api/v1/quotes/customer-quotes?page=1&page_size=50&scope=all');
    const cqCur = await api('/api/v1/quotes/customer-quotes?page=1&page_size=50');
    const aw = await api('/api/v1/quotes/awards?page=1&page_size=50');
    const comp = await api('/api/v1/quotes/comparison?requisition=all');

    // 3 · Matriz de RFQ (tarjeta por defecto)
    const first = page.waitForResponse(r => /\/api\/v1\/quotes\/rfqs\?page=1/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Cotizaciones y Comparativo$/ }).click();
    check('matriz de RFQ consulta MariaDB (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Revisiones/modificaciones', 'Solicitud a proveedores (RFQ)', 'Matriz de RFQ', 'Cotizaciones recibidas', 'Comparativo y selección preliminar', 'Cotización al cliente', 'Formato para el cliente', 'Matriz de cotizaciones al cliente', 'Decisión del cliente', 'Adjudicación definitiva', 'Matriz interna de proveedores'])
      check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t.replace(/[()]/g, '\\$&')) }).first().isVisible());
    check('aviso de modo consulta visible', await page.getByText(/Modo consulta MariaDB: enviar RFQ/).isVisible());
    await page.getByRole('row').filter({ hasText: rfqs.items[0].folio }).waitFor();
    const counters = flat(await page.locator('text=RFQ registradas').locator('..').innerText());
    check('contador de RFQ registradas desde el servidor', counters.includes(String(rfqs.summary.total)), counters);
    const overdue = rfqs.items.find(r => !r.responded && r.deadline < new Date().toISOString().slice(0, 10));
    const answered = rfqs.items.find(r => r.responded);
    check('RFQ vencida sin respuesta marcada', overdue && flat(await page.getByRole('row').filter({ hasText: overdue.folio }).innerText()).includes('Vencida'));
    check('RFQ respondida muestra la cotización', answered && flat(await page.getByRole('row').filter({ hasText: answered.folio }).innerText()).includes(`Respondida · ${answered.quote_folio}`));
    check('"Nueva RFQ" bloqueada', await page.getByRole('button', { name: /Nueva RFQ/ }).isDisabled());
    const searched = page.waitForResponse(r => /\/quotes\/rfqs\?.*q=RFQ-QA-0004/.test(r.url()));
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('RFQ-QA-0004');
    check('búsqueda en el servidor (200)', (await searched).status() === 200);
    await page.getByText('1 registros').waitFor();
    await shot(page, 'cot_3_matriz_rfq');

    // 2 · Documento de RFQ sin precios
    await page.getByRole('button', { name: /Solicitud a proveedores \(RFQ\)/ }).click();
    const rfqDoc = page.waitForResponse(r => /\/quotes\/rfqs\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('combobox', { name: 'RFQ' }).selectOption({ label: `${rfqs.items[0].folio} · ${rfqs.items[0].supplier_name}` });
    check('detalle de RFQ (200)', (await rfqDoc).status() === 200);
    const doc = flat(await page.getByTestId('rfq-doc').innerText());
    check('RFQ: proveedor, requisición, partida y sin precios', [rfqs.items[0].supplier_name, rfqs.items[0].requisition, 'Material sintético', 'no incluye precios'].every(x => doc.includes(x)) && !/\$\d/.test(doc), doc.slice(0, 200));
    check('"Generar y enviar RFQ" bloqueado', await page.getByRole('button', { name: /Generar y enviar RFQ/ }).isDisabled());

    // 4 · Cotizaciones recibidas con tarjetas por proveedor
    await page.getByRole('button', { name: /Cotizaciones recibidas/ }).click();
    await page.getByRole('row').filter({ hasText: 'COT-QA-0004' }).waitFor();
    const r4 = flat(await page.getByRole('row').filter({ hasText: 'COT-QA-0004' }).innerText());
    const q4 = sqs.items.find(x => x.folio === 'COT-QA-0004');
    check('cotización adjudicada: proveedor, total y estatus', [q4.supplier_name, usd(q4.total_amount), 'Adjudicada'].every(x => r4.includes(x)), r4);
    const sup = sqs.summary.suppliers.find(s => s.total > 1) || sqs.summary.suppliers[0];
    const bySup = page.waitForResponse(r => new RegExp(`supplier=${sup.id}`).test(r.url()));
    await page.getByRole('button', { name: new RegExp(sup.name) }).first().click();
    check('filtro por proveedor en el servidor (200)', (await bySup).status() === 200);
    await page.getByText(`${sup.total} registros`).waitFor();
    check('solo cotizaciones del proveedor', (await page.getByRole('row').filter({ hasText: 'COT-QA' }).count()) === sup.total);
    check('"Capturar cotización" bloqueado', await page.getByRole('button', { name: /Capturar cotización/ }).isDisabled());
    await shot(page, 'cot_4_recibidas');

    // 5 · Comparativo
    await page.getByRole('button', { name: /Comparativo y selección preliminar/ }).click();
    const req = comp.requisitions.find(r => r.quotes > 1) || comp.requisitions[0];
    const cmp = page.waitForResponse(r => new RegExp(`/quotes/comparison\\?requisition=${req.id}`).test(r.url()));
    await page.getByRole('combobox', { name: 'Requisición' }).selectOption(req.id);
    const cmpJson = await (await cmp).json();
    const ct = flat(await page.getByTestId('comparison').innerText());
    const offers = cmpJson.lines[0].offers.filter(o => o.offered);
    const cheapest = offers.reduce((m, o) => (Number(o.unit_price) < Number(m.unit_price) ? o : m));
    check('comparativo: todas las ofertas de la partida', offers.every(o => ct.includes(o.supplier_name)), ct.slice(0, 300));
    const bestCard = flat(await page.getByTestId('comparison').locator('div.border-emerald-400').first().innerText());
    check('mejor precio resaltado (menor unitario)', bestCard.includes(cheapest.supplier_name) && bestCard.includes('Mejor precio'), bestCard);
    check('adjudicación registrada visible en el comparativo', ct.includes('Adjudicada'));
    check('"Guardar selección" bloqueado', await page.getByRole('button', { name: /Guardar selección/ }).isDisabled());
    await shot(page, 'cot_5_comparativo');

    // 6 · Cotización al cliente (sin costos internos)
    const cur = cqCur.items[0];
    await page.getByRole('button', { name: /^6.*Cotización al cliente/ }).click();
    const cqDet = page.waitForResponse(r => /\/quotes\/customer-quotes\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('combobox', { name: 'Cotización al cliente' }).selectOption(cur.id);
    const cqJson = await (await cqDet).json();
    const cq = flat(await page.getByTestId('client-quote').innerText());
    check('cotización al cliente: cliente, total y decisión', [cur.client_name, usd(cur.total_amount), 'Aprobada'].every(x => cq.includes(x)), cq.slice(0, 300));
    check('la API del cliente no expone costos', !JSON.stringify(cqJson).match(/cost|margin|supplier_unit/i));
    check('"Emitir cotización" bloqueado', await page.getByRole('button', { name: /Emitir cotización/ }).isDisabled());

    // 7 · Formato para el cliente
    await page.getByRole('button', { name: /Formato para el cliente/ }).click();
    await page.getByRole('combobox', { name: 'Cotización al cliente' }).selectOption(cur.id);
    const frame = page.frameLocator('iframe[title="Formato para el cliente"]');
    await frame.getByText(`Cotización ${cur.folio}`).first().waitFor();
    const ft = flat(await frame.locator('body').innerText());
    check('formato: folio, cliente, total y firmas registradas', [cur.folio, cur.client_name, usd(cur.total_amount), 'Elaboró', cur.prepared_by].every(x => ft.includes(x)), ft.slice(0, 300));
    check('formato aislado en iframe sandbox', (await page.locator('iframe[title="Formato para el cliente"]').getAttribute('sandbox')) === '');
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Imprimir \/ PDF/ }).click();
    const pop = await popup;
    await pop.waitForLoadState();
    check('impresión abre el formato del cliente', flat(await pop.locator('body').innerText()).includes(cur.folio));
    await pop.close().catch(() => {});
    await shot(page, 'cot_7_formato');

    // 8 · Matriz de cotizaciones al cliente (versión vigente)
    await page.getByRole('button', { name: /Matriz de cotizaciones al cliente/ }).click();
    await page.getByRole('row').filter({ hasText: cur.folio }).waitFor();
    const r8 = flat(await page.getByRole('row').filter({ hasText: cur.folio }).innerText());
    check('matriz cliente: versión vigente vN / total', r8.includes(`v${cur.version_number} / ${cur.versions}`) && r8.includes(cur.series), r8);
    const old = cqAll.items.find(v => v.series === cur.series && v.id !== cur.id);
    check('versión sustituida no aparece en la matriz vigente', !old || await page.getByRole('row').filter({ hasText: new RegExp(`^\\s*${old.folio}\\s`) }).count() === 0);
    const byDec = page.waitForResponse(r => /\/customer-quotes\?.*decision=approved/.test(r.url()));
    await page.getByRole('combobox', { name: 'Decisión' }).selectOption('approved');
    check('filtro por decisión en el servidor (200)', (await byDec).status() === 200);

    // 1 · Revisiones / modificaciones
    const scoped = page.waitForResponse(r => /\/customer-quotes\?.*scope=all/.test(r.url()));
    await page.getByRole('button', { name: /Revisiones\/modificaciones/ }).click();
    check('historial pide todas las versiones (200)', (await scoped).status() === 200);
    await page.getByText(`${cqAll.items.filter(v => v.series === cur.series).length} versión(es)`).first().waitFor();
    const hist = flat(await page.getByText(cur.series, { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').innerText());
    check('serie con versiones y decisiones (cambios solicitados → aprobada)', !old || (hist.includes(old.folio) && hist.includes('Cambios solicitados') && hist.includes('Aprobada')), hist);
    check('"Nueva revisión" bloqueada', await page.getByRole('button', { name: /Nueva revisión/ }).isDisabled());
    await shot(page, 'cot_1_revisiones');

    // 9 · Decisión del cliente
    await page.getByRole('button', { name: /Decisión del cliente/ }).click();
    const client = cqCur.summary.clients[0];
    const cc = flat(await page.getByRole('button', { name: new RegExp(client.name) }).first().innerText());
    check('tarjeta por cliente: cotizaciones y pendientes', cc.includes(`${client.total} cotización(es)`) && cc.includes(`${client.pending} por decidir`), cc);
    await page.getByRole('combobox', { name: 'Cotización al cliente' }).selectOption(cur.id);
    await page.getByTestId('decisions').waitFor();
    const dt = flat(await page.getByTestId('decisions').innerText());
    check('historial de decisión con canal y responsable', ['Aprobada', 'email', 'QA Admin A', 'Aprobación sintética'].every(x => dt.includes(x)), dt);
    check('"Registrar decisión" bloqueado', await page.getByRole('button', { name: /Registrar decisión/ }).isDisabled());

    // 10 · Adjudicación definitiva
    await page.getByRole('button', { name: /Adjudicación definitiva/ }).click();
    const a0 = aw.items[0];
    await page.getByRole('row').filter({ hasText: a0.quote_folio }).first().waitFor();
    const r10 = flat(await page.getByRole('row').filter({ hasText: a0.quote_folio }).first().innerText());
    check('adjudicación: proveedor, partida, importe y OC', [a0.supplier_name, a0.description, usd(a0.subtotal_amount), a0.purchase_orders ? a0.purchase_orders : 'Pendiente de OC'].every(x => r10.includes(x)), r10);
    check('"Confirmar adjudicación" bloqueado', await page.getByRole('button', { name: /Confirmar adjudicación/ }).isDisabled());

    // 11 · Matriz interna con costos
    await page.getByRole('button', { name: /Matriz interna de proveedores/ }).click();
    await page.getByRole('row').filter({ hasText: 'COT-QA-0004' }).waitFor();
    const sqDet = page.waitForResponse(r => /\/quotes\/supplier-quotes\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('combobox', { name: 'Cotización de proveedor' }).selectOption(q4.id);
    check('detalle interno (200)', (await sqDet).status() === 200);
    const it = flat(await page.getByTestId('internal-quote').innerText());
    check('partidas internas con precio unitario del proveedor', it.includes('Material sintético') && it.includes(usd(q4.total_amount)), it);
    await shot(page, 'cot_11_interna');

    // Responsive
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin escrituras /api intentadas', writes.length === 0, writes.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? `  → ${d}` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
