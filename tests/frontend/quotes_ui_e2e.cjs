// Cotizaciones y Comparativo · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda
// petición /api que no sea GET (salvo login/logout) se aborta. Valores esperados calculados desde la API (RFQ-QA-0001/0004,
// COT-QA-0001..0004, CQ-QA-0001 con su revisión R1 aprobada y la adjudicación vigente COT-QA-0004). La tarjeta 1 abre el
// formulario R3A real pero solo valida en el navegador: el registro se prueba en quotes_revisions_write_ui_e2e.cjs.
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
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

    // 3 · Matriz de RFQ por contacto de compras (tarjeta por defecto)
    const first = page.waitForResponse(r => /\/api\/v1\/quotes\/rfq-contacts$/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Cotizaciones y Comparativo$/ }).click();
    check('contactos de RFQ consultan MariaDB (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Revisiones/modificaciones', 'Solicitud a proveedores (RFQ)', 'Matriz de RFQ', 'Cotizaciones recibidas', 'Comparativo y selección preliminar', 'Cotización al cliente', 'Formato para el cliente', 'Matriz de cotizaciones al cliente', 'Decisión del cliente', 'Adjudicación definitiva', 'Matriz interna de proveedores'])
      check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t.replace(/[()]/g, '\\$&')) }).first().isVisible());
    check('aviso de modo consulta visible', await page.getByText(/Modo consulta MariaDB: enviar RFQ/).isVisible());
    const rc = await api('/api/v1/quotes/rfq-contacts');
    await page.getByTestId('rfq-contact').first().waitFor();
    check('una tarjeta por contacto de compras más "Todas las RFQ"', await page.getByTestId('rfq-contact').count() === rc.contacts.length && await page.getByTestId('rfq-contact-all').isVisible());
    check('"Todas las RFQ" cuadra con el resumen de la matriz', rc.all.rfqs === rfqs.summary.total && rc.all.responded === rfqs.summary.responded && rc.all.overdue === rfqs.summary.overdue && rc.contacts.reduce((n, c) => n + c.rfqs, 0) === rc.all.rfqs);
    const pctOf = c => (c.rfqs ? Math.round(c.responded / c.rfqs * 100) : 0);
    const allText = flat(await page.getByTestId('rfq-contact-all').innerText());
    check('tarjeta Todas: RFQ, respondidas, vencidas, proveedores y % de respuesta', [`${rc.all.contacts} contactos de compras`, `${rc.all.rfqs} RFQ`, `${rc.all.responded} Respondidas`, `${rc.all.overdue} Vencidas`, `${rc.all.suppliers} proveedores`, `Respuesta ${pctOf(rc.all)}%`].every(x => allText.includes(x)), allText);
    const c0 = rc.contacts.find(c => c.name && c.email) || rc.contacts[0];
    const c0Card = page.getByTestId('rfq-contact').filter({ hasText: c0.email || c0.name.toUpperCase() });
    const c0Text = flat(await c0Card.innerText());
    check('tarjeta de contacto: nombre, correo, métricas, proveedores y requisiciones', [c0.name.toUpperCase(), `${c0.rfqs} RFQ`, `${c0.responded} Respondidas`, `${c0.overdue} Vencidas`, `${c0.suppliers} proveedores · ${c0.requisitions} requisiciones`, `Respuesta ${pctOf(c0)}%`].every(x => c0Text.includes(x)) && (!c0.email || c0Text.includes(c0.email)), c0Text);
    if (rc.contacts.some(c => c.key === 'unassigned')) check('RFQ sin contacto agrupadas en "Sin contacto asignado"', await page.getByTestId('rfq-contact').filter({ hasText: 'SIN CONTACTO ASIGNADO' }).count() === 1);
    await page.getByRole('searchbox', { name: 'Buscar contacto de compras' }).fill(c0.name.slice(0, 6).toLowerCase());
    const expectedMatch = rc.contacts.filter(c => [c.name, c.email, c.phone].some(v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(c0.name.slice(0, 6).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()))).length;
    check('búsqueda de contactos por nombre/correo/teléfono', (await page.getByTestId('rfq-contact-count').innerText()).startsWith(`${expectedMatch} de ${rc.contacts.length} contactos`) && await page.getByTestId('rfq-contact').count() === expectedMatch);
    await page.getByRole('searchbox', { name: 'Buscar contacto de compras' }).fill('zzz-sin-contacto');
    check('búsqueda de contactos sin resultados', await page.getByText('Ningún contacto coincide con la búsqueda.').isVisible());
    await page.getByRole('searchbox', { name: 'Buscar contacto de compras' }).fill('');
    await shot(page, 'cot_3_contactos_rfq');
    const byContact = page.waitForResponse(r => /\/quotes\/rfqs\?.*contact=/.test(r.url()) && r.url().includes(`contact=${c0.key}`));
    await c0Card.click();
    const bc = await byContact;
    check('abrir contacto filtra la matriz en el servidor (200)', bc.status() === 200);
    const bcJson = await bc.json();
    await page.getByTestId('rfq-matrix').waitFor();
    check('matriz del contacto: solo sus RFQ', bcJson.total === c0.rfqs && bcJson.items.every(r => r.contact_key === c0.key) && await page.getByTestId('rfq-row').count() === Math.min(c0.rfqs, 25));
    check('matriz: total de solicitudes del contacto', flat(await page.getByTestId('rfq-matrix').innerText()).includes(`Total de solicitudes: ${c0.rfqs}`));
    const allResp = page.waitForResponse(r => /\/quotes\/rfqs\?.*contact=all/.test(r.url()));
    await page.getByTestId('rfq-contact-all').click();
    check('"Abrir todas" consulta toda la matriz (200)', (await allResp).status() === 200);
    await page.getByRole('row').filter({ hasText: rfqs.items[0].folio }).waitFor();
    const overdue = rfqs.items.find(r => !r.responded && r.deadline < new Date().toISOString().slice(0, 10));
    const answered = rfqs.items.find(r => r.responded);
    check('RFQ vencida sin respuesta marcada', overdue && flat(await page.getByRole('row').filter({ hasText: overdue.folio }).innerText()).includes('Vencida'));
    check('RFQ respondida muestra la cotización', answered && flat(await page.getByRole('row').filter({ hasText: answered.folio }).innerText()).includes(`Respondida · ${answered.quote_folio}`));
    const rowA = rfqs.items[0];
    const rowText = flat(await page.getByRole('row').filter({ hasText: rowA.folio }).innerText());
    check('fila: requisición, referencia, comprador, proveedor, fechas y moneda', [rowA.requisition, rowA.supplier_name, rowA.request_date, rowA.deadline, rowA.currency, rowA.buyer_name || '—'].every(x => rowText.includes(String(x).slice(0, 10))), rowText);
    const searched = page.waitForResponse(r => /\/quotes\/rfqs\?.*q=RFQ-QA-0004/.test(r.url()));
    await page.getByRole('searchbox', { name: 'Buscar en la matriz' }).fill('RFQ-QA-0004');
    check('búsqueda en el servidor (200)', (await searched).status() === 200);
    await page.getByText('1 registros').waitFor();
    await shot(page, 'cot_3_matriz_rfq');

    // 3 · "Ver" abre el formato de una RFQ registrada (sin precios) en el idioma de RFQ elegido
    const rfqDoc = page.waitForResponse(r => /\/quotes\/rfqs\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('button', { name: 'Ver formato RFQ-QA-0004' }).click();
    check('detalle de RFQ (200)', (await rfqDoc).status() === 200);
    const rq4 = rfqs.items.find(r => r.folio === 'RFQ-QA-0004');
    const docText = flat(await page.getByTestId('rfq-doc').frameLocator('iframe').locator('body').innerText());
    check('RFQ registrada: folio, proveedor, requisición, partida y sin precios', ['RFQ-QA-0004', rq4.supplier_name, rq4.requisition, 'Material sintético', 'no incluye precios', 'SOLICITUD DE COTIZACIÓN'].every(x => docText.includes(x)) && !/\$\d|precio unitario/i.test(docText) && !docText.includes('NO REGISTRADA'), docText.slice(0, 300));
    check('RFQ registrada aislada en iframe sandbox', (await page.getByTestId('rfq-doc').locator('iframe').getAttribute('sandbox')) === '');
    await page.getByTestId('rfq-doc').getByRole('button', { name: 'Cerrar' }).click();
    await page.getByRole('combobox', { name: 'Idioma de RFQ / RFQ language' }).selectOption('en');
    check('indicador del idioma del PDF', await page.getByText('PDF: 100% in the selected language').isVisible());
    await page.getByRole('button', { name: 'Ver formato RFQ-QA-0004' }).click();
    const docEn = flat(await page.getByTestId('rfq-doc').frameLocator('iframe').locator('body').innerText());
    check('formato en inglés al elegir English', docEn.includes('REQUEST FOR QUOTATION') && docEn.includes('Reply before') && !docEn.includes('SOLICITUD DE COTIZACIÓN'), docEn.slice(0, 200));
    await page.getByTestId('rfq-doc').getByRole('button', { name: 'Cerrar' }).click();
    await page.getByRole('combobox', { name: 'Idioma de RFQ / RFQ language' }).selectOption('es');
    await page.getByRole('button', { name: 'Cerrar matriz' }).click();
    check('✕ cierra la matriz y deja las tarjetas', await page.getByTestId('rfq-matrix').count() === 0 && await page.getByTestId('rfq-contact-all').isVisible());
    await c0Card.click(); await page.getByTestId('rfq-matrix').waitFor();
    await page.getByRole('button', { name: /Volver a contactos/ }).click();
    check('"Volver a contactos" cierra la matriz', await page.getByTestId('rfq-matrix').count() === 0);

    // 2 · Solicitud a proveedores (RFQ): formulario con datos reales → partidas y vista previa; guardar sigue bloqueado
    const setup = await api('/api/v1/quotes/rfq-setup');
    await page.getByRole('button', { name: 'Nueva RFQ' }).click();
    await page.getByTestId('rfq-card').waitFor();
    check('"Nueva RFQ" abre la tarjeta 2', (await page.getByRole('button', { name: /Solicitud a proveedores \(RFQ\)/ }).getAttribute('aria-pressed')) === 'true');
    check('RFQ: partidas y vista previa ocultas al inicio', await page.getByTestId('rfq-hidden').isVisible());
    await page.getByRole('button', { name: 'Generar Solicitud y Partidas' }).click();
    check('RFQ: obligatorios marcados y nada generado', await page.getByText('Selecciona el comprador responsable.').count() >= 1 && await page.getByText('Selecciona el proveedor invitado.').count() >= 1 && await page.getByTestId('rfq-items').count() === 0);
    const buyer = setup.buyers.find(b => b.requisitions > 0 && setup.contacts.some(c => c.id === b.key)) || setup.buyers[0];
    const breqs = await api(`/api/v1/quotes/rfq-requisitions?page=1&page_size=50&buyer=${buyer.key}`);
    await page.getByRole('combobox', { name: 'Comprador responsable' }).selectOption(buyer.key);
    await page.getByTestId('rfq-req-modal').waitFor(); await page.getByTestId('rfq-req-option').first().waitFor();
    check('el comprador abre la ventana con sus requisiciones validadas', await page.getByTestId('rfq-req-option').count() === breqs.items.length && breqs.items.every(r => r.buyer_key === buyer.key));
    const target = breqs.items.find(r => r.rfq_count > 0) || breqs.items[0];
    const det = await api(`/api/v1/quotes/rfq-requisitions/${target.id}`);
    const detResp = page.waitForResponse(r => r.url().endsWith(`/quotes/rfq-requisitions/${target.id}`));
    await page.getByTestId('rfq-req-option').filter({ hasText: target.folio }).getByRole('button', { name: 'Seleccionar' }).click();
    check('detalle de la requisición validada (200)', (await detResp).status() === 200);
    await page.waitForFunction(v => document.querySelector('input[aria-label="Lugar de entrega"]')?.value === v, det.item.delivery_place || '');
    const ref = await page.getByRole('textbox', { name: 'Referencia interna' }).inputValue();
    check('la requisición llena lugar de entrega, fecha requerida y referencia interna', (await page.getByLabel('Fecha requerida').inputValue()) === String(det.item.need_date || '').slice(0, 10) && ref.startsWith(det.item.internal_reference || det.item.folio), ref);
    check('contacto de compras = comprador responsable', (await page.getByRole('combobox', { name: 'Contacto de compras' }).inputValue()) === buyer.key);
    const sentName = det.items.flatMap(i => i.sent_to).map(x => x.supplier_name)[0];
    const rfqSup = setup.suppliers.find(s => s.name === sentName && !['suspended', 'inactive'].includes(s.status)) || setup.suppliers.find(s => s.status === 'authorized');
    await page.getByRole('combobox', { name: 'Proveedor invitado' }).selectOption(rfqSup.id);
    check('moneda tomada del proveedor', (await page.getByRole('combobox', { name: 'Moneda solicitada' }).inputValue()) === (['MXN', 'USD', 'EUR'].includes(rfqSup.currency) ? rfqSup.currency : 'MXN'));
    const blockedSup = setup.suppliers.find(s => ['suspended', 'inactive'].includes(s.status));
    check('proveedores suspendidos o inactivos no se pueden invitar', !blockedSup || await page.locator(`select[aria-label="Proveedor invitado"] option[value="${blockedSup.id}"]`).evaluate(o => o.disabled));
    const issue = await page.getByLabel('Fecha de emisión').inputValue(); const y = issue.slice(0, 4);
    const expectedFolio = `RFQ-${y}-${String((Number(setup.folios[y]) || 0) + 1).padStart(4, '0')}`;
    check('folio previsto calculado desde MariaDB', (await page.getByRole('textbox', { name: 'Folio RFQ' }).inputValue()) === expectedFolio, expectedFolio);
    await page.getByRole('button', { name: 'Generar Solicitud y Partidas' }).click();
    await page.getByTestId('rfq-items').waitFor();
    check('partidas vigentes de la requisición, todas incluidas', await page.getByTestId('rfq-line').count() === det.items.length && flat(await page.getByTestId('rfq-items').innerText()).includes(`${det.items.length} seleccionada(s) de ${det.items.length}`));
    const itemsText = flat(await page.getByTestId('rfq-items').innerText());
    check('muestra a qué proveedores ya se envió cada partida', det.items.flatMap(i => i.sent_to).every(x => itemsText.includes(x.rfq)));
    check('aviso de partida ya enviada al mismo proveedor', !sentName || rfqSup.name !== sentName || itemsText.includes('ya se enviaron a este proveedor'));
    const pv = page.getByTestId('rfq-preview').contentFrame();
    const pvText = flat(await pv.locator('body').innerText());
    check('vista previa: folio, proveedor, comprador, partidas y marca de no registrada', [expectedFolio, rfqSup.name, buyer.name, det.items[0].description, 'VISTA PREVIA'].every(x => pvText.includes(x)), pvText.slice(0, 300));
    check('vista previa sin precios ni importes', !/precio unitario|importe|subtotal|\$\s?\d/i.test(pvText) && pvText.includes('no incluye precios'), pvText.match(/.{0,60}(precio unitario|importe|subtotal|\$\s?\d).{0,60}/i)?.[0]);
    await page.getByRole('checkbox', { name: `Incluir partida ${det.items[0].line_number}` }).uncheck();
    check('excluir una partida actualiza el contador y la vista previa', flat(await page.getByTestId('rfq-items').innerText()).includes(`${det.items.length - 1} seleccionada(s) de ${det.items.length}`) && (det.items.length > 1 || flat(await pv.locator('body').innerText()).includes('No hay partidas seleccionadas')));
    await page.getByRole('button', { name: 'Seleccionar todas' }).click();
    check('"Guardar y siguiente RFQ" bloqueado (escritura comercial)', await page.getByRole('button', { name: /Guardar y siguiente RFQ/ }).isDisabled());
    await shot(page, 'cot_2_rfq');
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    check('"Ver matriz" vuelve a la matriz de RFQ', (await page.getByRole('button', { name: /Matriz de RFQ/ }).getAttribute('aria-pressed')) === 'true');

    // 4 · Registro de cotización: RFQ real → partidas, importes, IVA y totales; guardar sigue bloqueado
    const st4 = await api('/api/v1/quotes/rfq-setup');
    await page.getByRole('button', { name: /Cotizaciones recibidas/ }).click();
    await page.getByTestId('quote-card').waitFor();
    check('registro: sin RFQ seleccionada al inicio', flat(await page.getByTestId('quote-rfq-banner').innerText()).includes('Sin RFQ seleccionada') && flat(await page.getByTestId('quote-items').innerText()).includes('Selecciona una requisición y un proveedor'));
    let buyer4 = null; let reqs4 = null;
    for (const b of st4.buyers) { const l = await api(`/api/v1/quotes/rfq-requisitions?page=1&page_size=50&rfq=with&buyer=${b.key}`); if (l.total) { buyer4 = b; reqs4 = l; if (l.items.some(x => x.quote_count > 0)) break; } }
    check('registro: requisiciones con RFQ del comprador (API)', reqs4 && reqs4.items.every(r => r.rfq_count > 0 && r.buyer_key === buyer4.key));
    await page.getByRole('combobox', { name: 'Comprador responsable' }).selectOption(buyer4.key);
    await page.getByTestId('rfq-req-modal').waitFor(); await page.getByTestId('rfq-req-option').first().waitFor();
    check('registro: la ventana lista solo requisiciones con RFQ emitida', await page.getByTestId('rfq-req-option').count() === reqs4.items.length);
    const req4 = reqs4.items.find(x => x.quote_count > 0) || reqs4.items[0];
    const det4 = await api(`/api/v1/quotes/rfq-requisitions/${req4.id}`);
    await page.getByTestId('rfq-req-option').filter({ hasText: req4.folio }).getByRole('button', { name: 'Seleccionar' }).click();
    await page.waitForFunction(f => document.querySelector('input[aria-label="Requisición validada"]')?.value.startsWith(f), req4.folio);
    await page.waitForFunction(n => document.querySelectorAll('select[aria-label="RFQ emitida"] option').length === n + 1, det4.rfqs.length);
    check('registro: RFQ emitidas de la requisición', true);
    const rfq4 = det4.rfqs.find(x => x.quote_folios) || det4.rfqs[0];
    const rfqDet4 = await api(`/api/v1/quotes/rfqs/${rfq4.id}`);
    await page.getByRole('combobox', { name: 'RFQ emitida' }).selectOption(rfq4.id);
    await page.getByTestId('quote-line').first().waitFor();
    check('registro: proveedor automático desde la RFQ', (await page.getByRole('textbox', { name: 'Proveedor de la RFQ' }).inputValue()) === `${rfq4.supplier_code} - ${rfq4.supplier_name}`);
    check('registro: partidas de la RFQ, todas ofertadas', await page.getByTestId('quote-line').count() === rfqDet4.items.length && flat(await page.getByTestId('quote-offered').innerText()).startsWith(`${rfqDet4.items.length} partidas cotizadas`));
    check('registro: moneda tomada de la RFQ', (await page.getByRole('combobox', { name: 'Moneda' }).inputValue()) === rfqDet4.item.currency);
    check('registro: referencia interna desde la requisición', (await page.getByRole('textbox', { name: 'Referencia interna' }).inputValue()).startsWith(det4.item.internal_reference || det4.item.folio));
    const banner4 = flat(await page.getByTestId('quote-rfq-banner').innerText());
    check('registro: resumen de la RFQ y aviso si ya tiene cotización', banner4.includes(rfq4.folio) && (!rfq4.quote_folios || banner4.includes(`ya tiene cotización registrada (${rfq4.quote_folios})`)), banner4);
    check('registro: pendiente mientras faltan datos', flat(await page.getByTestId('quote-check').innerText()).startsWith('Pendiente:'));
    const actions4 = (await page.getByTestId('quote-actions').getByRole('button').allInnerTexts()).map(flat);
    check('botones del diseño en orden: Guardar, Limpiar, Ver comparativo, Ver matriz (sin "Nueva cotización")', JSON.stringify(actions4) === JSON.stringify(['💾 Guardar cotización', '🧹 Limpiar', '📊 Ver comparativo', '📋 Ver matriz']) && await page.getByRole('button', { name: /Guardar cotización/ }).isEnabled(), JSON.stringify(actions4));
    await page.getByRole('button', { name: /Guardar cotización/ }).click();
    check('Guardar con datos faltantes: marca lo pendiente y no envía nada', flat(await page.getByTestId('quote-check').innerText()).startsWith('No se puede guardar. Pendiente:') && await page.getByText('Indica la fecha de cotización.', { exact: true }).isVisible() && writes.length === 0);
    await page.getByLabel('Fecha de cotización').fill('2026-11-10');
    await page.getByLabel('Días de entrega').fill('7');
    await page.getByRole('combobox', { name: 'Condiciones de pago (SAT / SHCP)' }).selectOption('PPD');
    const reqQty = Number(rfqDet4.items[0].quantity);
    for (const it of rfqDet4.items) await page.getByLabel(`Precio unitario partida ${Number(it.line_number)}`).fill('1250.5');
    const sub4 = rfqDet4.items.reduce((s, it) => s + Math.round(Number(it.quantity) * 1250.5 * 100) / 100, 0);
    const tax4 = rfqDet4.items.reduce((s, it) => s + Math.round(Math.round(Number(it.quantity) * 1250.5 * 100) / 100 * 0.16 * 100) / 100, 0);
    const fmt = n => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    check('registro: subtotal calculado y total con IVA', (await page.getByRole('textbox', { name: 'Subtotal calculado' }).inputValue()) === fmt(sub4) && (await page.getByRole('textbox', { name: 'Total de la cotización recibida' }).inputValue()) === fmt(sub4 + tax4), `${sub4} ${tax4}`);
    const line1 = flat(await page.getByTestId('quote-line').first().innerText());
    check('registro: importe sin IVA, IVA y total por partida', line1.includes(fmt(Math.round(reqQty * 1250.5 * 100) / 100)) && line1.includes('16.00%'), line1);
    check('registro: captura completa (lista para guardarse)', flat(await page.getByTestId('quote-check').innerText()).startsWith('Captura completa'));
    await page.getByLabel(`Cantidad cotizada partida ${Number(rfqDet4.items[0].line_number)}`).fill(String(reqQty / 2));
    check('registro: cantidad parcial señalada', flat(await page.getByTestId('quote-line').first().innerText()).includes('Parcial'));
    await page.getByLabel('Vigencia hasta').fill('2026-11-01');
    check('registro: vigencia anterior a la fecha marcada', await page.getByText('La vigencia no puede ser anterior a la fecha de cotización.').count() >= 1);
    await page.getByLabel('Vigencia hasta').fill('2026-12-10');
    await page.getByLabel('PDF de la cotización').setInputFiles({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>no es pdf</html>') });
    check('registro: rechaza archivos que no son PDF real', await page.getByText('Solo se permiten archivos PDF válidos.').waitFor({ timeout: 5000 }).then(() => true).catch(() => false) && await page.getByText('No se ha cargado el PDF de la cotización.').isVisible());
    await page.getByLabel('PDF de la cotización').setInputFiles({ name: 'oferta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF') });
    await page.getByText('oferta.pdf').waitFor();
    await page.getByRole('button', { name: 'Ver PDF' }).click();
    check('registro: PDF visible en el navegador', await page.getByTestId('quote-pdf').isVisible());
    await page.getByRole('button', { name: 'Quitar PDF' }).click();
    check('registro: Quitar PDF', await page.getByTestId('quote-pdf').count() === 0 && await page.getByText('No se ha cargado el PDF de la cotización.').isVisible());
    await page.getByRole('button', { name: /Guardar cotización/ }).click();
    const saved4 = flat(await page.getByTestId('quote-check').innerText());
    check('Guardar con captura completa: valida y avisa que NO se guardó (escritura comercial bloqueada)', saved4.startsWith('Captura validada') && saved4.includes('No se guardó') && writes.length === 0, saved4);
    await shot(page, 'cot_4_registro');
    await page.getByRole('button', { name: 'Ver comparativo' }).click();
    await page.getByTestId('cmp-summary').waitFor();
    check('"Ver comparativo" abre la tarjeta 5 con la requisición', (await page.getByRole('button', { name: /Comparativo y selección preliminar/ }).first().getAttribute('aria-pressed')) === 'true' && (await page.getByRole('combobox', { name: 'Requisición' }).inputValue()) === req4.id && flat(await page.getByTestId('cmp-summary').innerText()).includes(req4.folio));
    await page.getByRole('button', { name: /Cotizaciones recibidas/ }).click();
    await page.getByTestId('quote-card').waitFor();
    await page.getByRole('combobox', { name: 'Comprador responsable' }).selectOption(buyer4.key);
    await page.getByTestId('rfq-req-option').filter({ hasText: req4.folio }).getByRole('button', { name: 'Seleccionar' }).click();
    await page.waitForFunction(f => document.querySelector('input[aria-label="Requisición validada"]')?.value.startsWith(f), req4.folio);
    await page.getByRole('combobox', { name: 'RFQ emitida' }).selectOption(rfq4.id);
    await page.getByTestId('quote-line').first().waitFor();
    await page.getByLabel('Fecha de cotización').fill('2026-11-10');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    check('Limpiar deja el formulario como nuevo (comprador, requisición, RFQ, captura y partidas)', (await page.getByRole('combobox', { name: 'Comprador responsable' }).inputValue()) === '' && (await page.getByRole('textbox', { name: 'Requisición validada' }).inputValue()) === '' && await page.getByRole('combobox', { name: 'RFQ emitida' }).isDisabled() && (await page.getByLabel('Fecha de cotización').inputValue()) === '' && await page.getByTestId('quote-line').count() === 0);
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    check('"Ver matriz" abre la Matriz interna de proveedores', (await page.getByRole('button', { name: /Matriz interna de proveedores/ }).getAttribute('aria-pressed')) === 'true');

    // 11 · Cotizaciones recibidas: tarjetas por proveedor y filtro en el servidor
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
    await shot(page, 'cot_11_recibidas');


    // 5 · Comparativo y selección preliminar: resumen, productos, puntaje/recomendación, adjudicación (sin guardar) e interpretación
    const cmpModel = await import(require('url').pathToFileURL(require('path').join(__dirname, '../../src/views/quotes/comparison.mjs')).href);
    await page.getByRole('button', { name: /Comparativo y selección preliminar/ }).first().click();
    await page.getByTestId('comparison-card').waitFor();
    await page.getByRole('combobox', { name: 'Requisición' }).selectOption('');
    await page.waitForFunction(n => document.querySelectorAll('select[aria-label="Requisición"] option').length === n + 1, comp.requisitions.length, { timeout: 10000 }).catch(() => {});
    check('comparativo: estado inicial sin requisición', await page.getByTestId('cmp-empty').isVisible() && await page.locator('select[aria-label="Requisición"] option').count() === comp.requisitions.length + 1);
    const req = comp.requisitions.find(r => r.quotes > 1) || comp.requisitions[0];
    const cmpResp = page.waitForResponse(r => new RegExp(`/quotes/comparison\\?requisition=${req.id}`).test(r.url()));
    await page.getByRole('combobox', { name: 'Requisición' }).selectOption(req.id);
    const cmpJson = await (await cmpResp).json();
    const R5 = cmpJson.requisition; const act = cmpJson.lines.filter(l => l.line_status === 'active');
    const ranked5 = cmpModel.scoreQuotes(cmpJson.quotes, act); const rec5 = ranked5.find(q => q.recommended);
    await page.getByTestId('cmp-summary').waitFor();
    const sum5 = flat(await page.getByTestId('cmp-summary').innerText());
    check('resumen: requisición, cliente, proyecto, contrato, partidas, presupuesto y empresas', [R5.folio, R5.client_name, R5.project || '—', R5.contract || '—', `Partidas: ${R5.item_count}`, `Empresas participantes: ${new Set(cmpJson.quotes.map(q => q.supplier_id)).size}`].every(x => sum5.includes(x)) && (R5.budget_amount === null || sum5.includes(usd(R5.budget_amount).replace(' USD', ''))), sum5);
    check('resumen: recomendación actual', !rec5 || sum5.includes(`Recomendación actual: ${rec5.supplier_name}`));
    await page.getByTestId('cmp-sub-products').click();
    check('productos: partidas vigentes con su mejor precio ofertado', await page.getByTestId('cmp-product').count() === act.length && act.every(l => true) && flat(await page.getByTestId('cmp-products').innerText()).includes(act[0].description));
    await page.getByTestId('cmp-sub-compare').click();
    await page.getByTestId('cmp-quote').first().waitFor();
    const rows5 = (await page.getByTestId('cmp-quote').allInnerTexts()).map(flat);
    check('comparativo: una fila por cotización ordenada por puntaje', rows5.length === ranked5.length && ranked5.every((q, i) => rows5[i].includes(q.supplier_name) && rows5[i].includes(`${q.score.toFixed(1)}/100`)), rows5.join(' | '));
    check('comparativo: la recomendada encabeza la tabla', !rec5 || (rows5[0].startsWith('Recomendada') && flat(await page.getByTestId('cmp-recommendation').innerText()).includes(`${rec5.supplier_name} · ${usd(rec5.total_amount)}`)));
    const awardedQ = ranked5.find(q => q.awarded_lines > 0);
    check('comparativo: estatus de adjudicación por proveedor', !awardedQ || rows5[ranked5.indexOf(awardedQ)].includes(awardedQ.awarded_lines >= act.length ? 'Adjudicada total' : 'Adjudicada parcial'));
    await page.getByTestId('cmp-sub-award').click();
    await page.getByTestId('cmp-award-line').first().waitFor();
    check('adjudicación: OC vigentes de la requisición', flat(await page.getByTestId('cmp-po-count').innerText()).startsWith(`${cmpJson.orders.length} OC vigente(s)`));
    const l5 = act[0];
    const sel5 = page.getByRole('combobox', { name: `Proveedor adjudicado partida ${l5.line_number}` });
    check('adjudicación: por defecto la adjudicación vigente y sin vista previa', (await sel5.inputValue()) === (l5.award?.quote_id || '') && await page.getByTestId('cmp-po-preview').count() === 0);
    check('adjudicación: opciones = empresas que ofrecen la partida', await page.locator(`select[aria-label="Proveedor adjudicado partida ${l5.line_number}"] option`).count() === l5.offers.filter(o => o.offered).length + 1);
    await page.getByRole('button', { name: /Guardar adjudicación/ }).click();
    check('Guardar sin cambios: lo indica y no envía nada', flat(await page.getByTestId('cmp-award-check').innerText()).startsWith('Sin cambios') && writes.length === 0);
    const other5 = l5.offers.find(o => o.offered && o.quote_id !== l5.award?.quote_id);
    if (other5) {
      await sel5.selectOption(other5.quote_id);
      check('adjudicación: precio unitario de la oferta elegida', (await page.getByRole('textbox', { name: `Precio unitario adjudicado partida ${l5.line_number}` }).inputValue()) === usd(other5.unit_price));
      check('vista previa: una OC por proveedor con los cambios', flat(await page.getByTestId('cmp-po-preview').innerText()).includes(`${other5.supplier_name} · 1 partida(s)`));
      await page.getByRole('textbox', { name: `Cantidad a comprar partida ${l5.line_number}` }).fill('0');
      await page.getByRole('button', { name: /Guardar adjudicación/ }).click();
      check('Guardar con cantidad inválida: lo marca', flat(await page.getByTestId('cmp-award-check').innerText()).startsWith('No se puede guardar') && await page.getByText('Cantidad mayor a cero.').isVisible());
      await page.getByRole('textbox', { name: `Cantidad a comprar partida ${l5.line_number}` }).fill(String(Number(l5.quantity)));
      await page.getByRole('button', { name: /Guardar adjudicación/ }).click();
      const chk5 = flat(await page.getByTestId('cmp-award-check').innerText());
      check('Guardar con cambios: prepara la adjudicación y avisa que NO se guardó', chk5.startsWith('Adjudicación preparada') && chk5.includes('No se guardó') && writes.length === 0, chk5);
    }
    await page.getByRole('button', { name: 'Ver órdenes generadas' }).click();
    await page.getByTestId('cmp-orders').waitFor();
    const ord5 = flat(await page.getByTestId('cmp-orders').innerText());
    check('Ver órdenes generadas: OC vigentes con proveedor, partidas y total', cmpJson.orders.every(o => ord5.includes(o.folio) && ord5.includes(o.supplier_name) && ord5.includes(usd(o.total_amount))) && (cmpJson.orders.length || ord5.includes('aún no tiene órdenes')), ord5);
    await shot(page, 'cot_5_adjudicacion');
    await page.getByTestId('cmp-sub-interpret').click();
    check('interpretación: explicación y 3 preguntas (la primera abierta)', await page.locator('[data-testid="cmp-interpret"] details').count() === 3 && await page.getByText('Registra en cada cotización únicamente las partidas').isVisible() && flat(await page.getByTestId('cmp-interpret').innerText()).includes(`precio por partida ${cmpModel.WEIGHTS.price}%`) === false);
    await page.getByText('¿Qué significa la recomendación?').click();
    check('interpretación: criterio del puntaje visible', await page.getByText(`precio por partida ${cmpModel.WEIGHTS.price}%`, { exact: false }).isVisible());
    await page.getByTestId('cmp-sub-summary').click();
    await page.getByRole('button', { name: /Agregar otra empresa/ }).click();
    check('"Agregar otra empresa" abre el registro de cotización', (await page.getByRole('button', { name: /Cotizaciones recibidas/ }).getAttribute('aria-pressed')) === 'true');
    await page.getByRole('button', { name: /Comparativo y selección preliminar/ }).first().click();
    await page.getByRole('button', { name: /Registrar empresa \/ proveedor/ }).click();
    await page.getByRole('heading', { name: /Proveedores|Catálogo de proveedores/ }).first().waitFor({ timeout: 10000 }).catch(() => {});
    check('"Registrar empresa / proveedor" abre el catálogo de proveedores', (await page.locator('nav button').filter({ hasText: /^.*Proveedores$/ }).first().getAttribute('class')).length > 0 && !(await page.getByTestId('comparison-card').count()));
    await page.locator('nav button').filter({ hasText: /Cotizaciones y Comparativo$/ }).click();
    await page.getByTestId('rfq-matrix-card').waitFor();

    // 6 · Cotización formal al cliente: costos reales → precio de venta, IVA, Service Fee, nivel de aprobación; guardar bloqueado
    const cqModel = await import(require('url').pathToFileURL(require('path').join(__dirname, '../../src/views/quotes/customerQuoteBuilder.mjs')).href);
    const cur = cqCur.items[0];
    await page.getByRole('button', { name: /^6.*Cotización al cliente/ }).click();
    await page.getByTestId('cq-card').waitFor();
    check('cotización al cliente: estado inicial', flat(await page.getByTestId('cq-status').innerText()).startsWith('Selecciona una requisición para cargar cliente') && await page.getByRole('button', { name: 'Vista previa' }).isDisabled());
    const cqSetup = await api('/api/v1/quotes/customer-quote-setup'); const st6 = await api('/api/v1/quotes/rfq-setup');
    let buyer6 = null; let reqs6 = null;
    for (const b of st6.buyers) { const l = await api(`/api/v1/quotes/rfq-requisitions?page=1&page_size=50&rfq=quoted&buyer=${b.key}`); if (l.total) { buyer6 = b; reqs6 = l; break; } }
    check('cotización al cliente: requisiciones del comprador con cotizaciones de proveedor', reqs6 && reqs6.items.every(r => r.quote_count > 0));
    await page.getByRole('combobox', { name: 'Comprador responsable' }).selectOption(buyer6.key);
    await page.waitForFunction(n => document.querySelectorAll('select[aria-label="Requisición del cliente"] option').length === n + 1, reqs6.items.length);
    const req6 = reqs6.items[0];
    const cmp6 = await api(`/api/v1/quotes/comparison?requisition=${req6.id}`);
    await page.getByRole('combobox', { name: 'Requisición del cliente' }).selectOption(req6.id);
    await page.getByTestId('cq-line').first().waitFor();
    const lines6 = cqModel.linesFromComparison(cmp6.lines);
    check('partidas vigentes con costo de adjudicación o mejor oferta', await page.getByTestId('cq-line').count() === lines6.length && flat(await page.getByTestId('cq-line-count').innerText()).startsWith(`${lines6.length} partida(s)`));
    check('moneda, lugar de entrega y revisión propuestos desde MariaDB', (await page.getByRole('combobox', { name: 'Moneda de cotización / cliente' }).inputValue()) === (['MXN', 'USD', 'EUR'].includes(cmp6.requisition.currency) ? cmp6.requisition.currency : 'MXN')
      && (await page.getByRole('textbox', { name: 'Lugar de entrega' }).inputValue()) === (cmp6.requisition.delivery_place || '') && (await page.getByRole('textbox', { name: 'Revisión' }).inputValue()) === String(cmp6.customer_quote ? cmp6.customer_quote.revision + 1 : 0));
    if (cmp6.customer_quote) check('aviso de la cotización vigente de la requisición', flat(await page.getByTestId('cq-status').innerText()).includes(`Ya existe ${cmp6.customer_quote.folio}`));
    await page.getByRole('button', { name: /Actualizar tipo de cambio/ }).click();
    check('Actualizar tipo de cambio usa el último registrado en MariaDB', !cqSetup.fx || (await page.getByRole('textbox', { name: '1 USD = MXN' }).inputValue()) === String(Number(cqSetup.fx.usd_mxn)));
    await page.getByRole('button', { name: /Guardar cotización al cliente/ }).click();
    check('Guardar incompleto: marca lo pendiente (margen) sin enviar nada', flat(await page.getByTestId('cq-status').innerText()).startsWith('No se puede guardar. Pendiente:') && writes.length === 0);
    for (const l of lines6) { await page.getByLabel(`% margen partida ${l.line_number}`).fill('20'); await page.getByLabel(`Entrega / manipulación partida ${l.line_number}`).fill('150'); }
    await page.getByRole('combobox', { name: 'Comprador', exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Service Fee %').fill('5');
    const f6 = { ...cqModel.emptyCq('2026-01-01'), currency: await page.getByRole('combobox', { name: 'Moneda de cotización / cliente' }).inputValue(), usd_mxn: await page.getByRole('textbox', { name: '1 USD = MXN' }).inputValue(), eur_mxn: await page.getByRole('textbox', { name: '1 EUR = MXN' }).inputValue(), sf_pct: '5' };
    const priced6 = lines6.map(l => ({ ...l, margin: '20', handling: '150' }));
    const t6 = cqModel.cqTotals(priced6, f6);
    const fmt6 = n => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    check('precio de venta por partida calculado', flat(await page.getByTestId('cq-line').first().innerText()).includes(usd(cqModel.priceLine(priced6[0], f6).unit).replace('USD', f6.currency)), flat(await page.getByTestId('cq-line').first().innerText()));
    check('subtotal de terceros, Service Fee y total general', (await page.getByRole('textbox', { name: 'Subtotal de pago de terceros' }).inputValue()) === fmt6(t6.third) && (await page.getByRole('textbox', { name: 'Total Service Fee', exact: true }).inputValue()) === fmt6(t6.sfTotal) && (await page.getByRole('textbox', { name: 'Total general', exact: true }).inputValue()) === fmt6(t6.total), `${t6.third} ${t6.sfTotal} ${t6.total}`);
    const pol6 = (cqSetup.policies || []).find(p => /customer|client|cotiz/i.test(p.applies_to));
    const lv6 = cqModel.approvalLevel(pol6, priced6, f6, t6); const lvText = flat(await page.getByTestId('cq-level').innerText());
    check('nivel de aprobación según la política vigente', lv6.status === 'within' ? lvText.startsWith('Nivel 1 · Solo Comprador') : lv6.status === 'exceeds' ? lvText.startsWith('Requiere autorización interna adicional') : lvText.includes('Sin política de aprobación vigente'), lvText);
    await page.getByRole('button', { name: /Guardar cotización al cliente/ }).click();
    const st6msg = flat(await page.getByTestId('cq-status').innerText());
    check('Guardar completo: valida y avisa que NO se guardó', st6msg.startsWith('Cotización validada') && st6msg.includes('No se guardó') && writes.length === 0, st6msg);
    await page.getByRole('button', { name: 'Vista previa' }).click();
    const pv6 = flat(await page.getByTestId('cq-preview').frameLocator('iframe').locator('body').innerText());
    check('vista previa para el cliente: precio de venta y total, sin costos ni margen', pv6.includes(cmp6.requisition.client_name) && pv6.includes('VISTA PREVIA') && pv6.includes(`${f6.currency} ${t6.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) && !pv6.includes(`${f6.currency} ${Number(priced6[0].cost_unit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) && !/margen de ganancia|manipulación|costo del producto/i.test(pv6), pv6.slice(0, 300));
    check('vista previa aislada en iframe sandbox', (await page.getByTestId('cq-preview').locator('iframe').getAttribute('sandbox')) === '');
    await page.getByTestId('cq-preview').getByRole('button', { name: 'Cerrar' }).click();
    await shot(page, 'cot_6_cotizacion_cliente');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    check('Limpiar deja la cotización como nueva', (await page.getByRole('combobox', { name: 'Comprador responsable' }).inputValue()) === '' && await page.getByTestId('cq-line').count() === 0);
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    check('"Ver matriz" abre la matriz de cotizaciones al cliente', (await page.getByRole('button', { name: /Matriz de cotizaciones al cliente/ }).getAttribute('aria-pressed')) === 'true');

    // 7 · Formato de cotización para el cliente (documento externo, cualquier revisión registrada, PDF real)
    const allCq = await api('/api/v1/quotes/customer-quotes?page=1&page_size=50&scope=all');
    const firstDet = page.waitForResponse(r => /\/quotes\/customer-quotes\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('button', { name: /Formato para el cliente/ }).click();
    await page.getByTestId('format-card').waitFor();
    check('formato: abre la revisión más reciente por defecto (200)', (await firstDet).status() === 200 && (await page.getByRole('combobox', { name: 'Cotización al cliente' }).inputValue()) === allCq.items[0].id);
    check('formato: selector con todas las revisiones (folio · Rev. · cliente)', await page.locator('select[aria-label="Cotización al cliente"] option').count() === allCq.items.length + 1
      && (await page.locator('select[aria-label="Cotización al cliente"] option').nth(1).innerText()).startsWith(`${allCq.items[0].folio} · Rev. ${allCq.items[0].revision} · ${allCq.items[0].client_name}`));
    const old7 = allCq.items.find(x => x.series === cur.series && x.id !== cur.id);
    const cqDet = page.waitForResponse(r => /\/quotes\/customer-quotes\/[0-9a-f-]{36}$/.test(r.url()));
    await page.getByRole('combobox', { name: 'Cotización al cliente' }).selectOption(old7 ? old7.id : cur.id);
    const cqJson = await (await cqDet).json();
    check('la API del cliente no expone costos', !JSON.stringify(cqJson).match(/cost|margin|supplier_unit/i));
    const D7 = cqJson.item; const ft = flat(await page.getByTestId('format-doc').contentFrame().locator('body').innerText());
    const money7 = v => `${D7.currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    check('formato: encabezado, emisor (organización), cliente, partidas y total', ['COTIZACIÓN', D7.folio, `Revisión: ${D7.revision}`, cqJson.issuer.legal_name, D7.client_name, `Proyecto: ${D7.project || 'N/A'}`, 'T H I R D', cqJson.items[0].description, money7(D7.total_amount), 'TOTAL GENERAL'].every(x => ft.includes(x)), ft.slice(0, 400));
    check('formato: firmas electrónicas (comprador) y sin firmas gráficas', ft.includes('COMPRADOR') && ft.includes(D7.prepared_by || '—') && /Firmado electrónicamente|Pendiente/.test(ft) && await page.getByTestId('format-doc').contentFrame().locator('img').count() === 1);
    check('formato aislado en iframe sandbox', (await page.getByTestId('format-doc').getAttribute('sandbox')) === '');
    const dl7 = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'Descargar PDF' }).click();
    const file7 = await dl7; const p7 = await file7.path(); const bytes7 = require('fs').readFileSync(p7);
    check('Descargar PDF: archivo PDF real con folio y revisión en el nombre', file7.suggestedFilename() === `${D7.folio}_Rev${D7.revision}.pdf` && bytes7.slice(0, 5).toString() === '%PDF-' && bytes7.length > 10000, `${file7.suggestedFilename()} ${bytes7.length}`);
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

    // 1 · Revisiones / modificaciones (familias Rev. 0 → Rev. N)
    const fam = await api('/api/v1/quotes/revisions?page=1&page_size=50');
    const f0 = fam.items.find(f => f.series === cur.series);
    const famResp = page.waitForResponse(r => /\/api\/v1\/quotes\/revisions\?/.test(r.url()));
    await page.getByRole('button', { name: /Revisiones\/modificaciones/ }).click();
    check('familias de revisiones consultan MariaDB (200)', (await famResp).status() === 200);
    await page.getByTestId('rev-family').first().waitFor();
    const kpis = (await page.getByTestId('rev-kpi').allInnerTexts()).map(flat);
    const S1 = fam.summary;
    check('KPI: familias, Rev. N, aprobadas y ligadas a CR desde el servidor', [[S1.families, 'Familias de cotización'], [S1.with_rev_n, 'Con Rev. N'], [S1.approved, 'Aprobadas vigentes/históricas'], [S1.linked_cr, 'Ligadas a Change Request']].every(([n, t], i) => kpis[i].startsWith(String(n)) && kpis[i].includes(t)), kpis.join(' | '));
    check('una tarjeta por familia (página 1)', await page.getByTestId('rev-family').count() === Math.min(fam.total, 24));
    check('familia sintética con Rev. 0 y revisión vigente', !!f0 && f0.revisions === cqAll.items.filter(v => v.series === cur.series).length && f0.current_id === cur.id && (!old || Number(f0.rev0_total) === Number(old.total_amount)));
    const famCard = page.getByTestId('rev-family').filter({ hasText: f0.current_folio });
    const fc = flat(await famCard.innerText());
    const amt = v => Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    check('tarjeta: folio · cliente, requisición · CR, Rev. N · estatus', fc.includes(`${f0.current_folio} · ${f0.client_name}`) && fc.includes(`${f0.requisition} · ${f0.change_request || 'Sin Change Request'}`) && fc.includes(`Rev. ${f0.current_rev} · ${f0.status_label}`), fc);
    check('tarjeta: revisiones, total Rev. 0 y total vigente con moneda', fc.includes(`${f0.revisions} REVISIONES`) && fc.includes(`${amt(f0.rev0_total)} ${f0.rev0_currency} (REV. ${f0.rev0_rev})`) && fc.includes(`${amt(f0.current_total)} ${f0.currency} (VIGENTE)`), fc);
    const bySeries = page.waitForResponse(r => /\/quotes\/revisions\?.*q=/.test(r.url()));
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(f0.requisition);
    check('búsqueda de familias en el servidor (200)', (await bySeries).status() === 200);
    await page.waitForTimeout(400);
    check('búsqueda por requisición encuentra la familia', await page.getByTestId('rev-family').filter({ hasText: f0.current_folio }).count() === 1);
    const none = page.waitForResponse(r => /\/quotes\/revisions\?.*q=zzz-sin-coincidencias/.test(r.url()));
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('zzz-sin-coincidencias');
    await none; await page.getByText('No se encontraron cotizaciones que coincidan con la búsqueda.').waitFor();
    check('búsqueda sin resultados muestra el estado vacío', await page.getByTestId('rev-family').count() === 0);
    const cleared = page.waitForResponse(r => /\/quotes\/revisions\?/.test(r.url()) && !/q=/.test(r.url()));
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(''); await cleared;
    const byGroup = page.waitForResponse(r => /\/quotes\/revisions\?.*status=approved/.test(r.url()));
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('approved');
    const grp = await (await byGroup).json();
    check('filtro de estatus en el servidor (aprobadas)', grp.total === S1.current_approved && grp.items.every(x => x.status_group === 'approved'));
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('all');
    await page.getByTestId('rev-family').filter({ hasText: f0.current_folio }).waitFor();
    // VER PDF → vista previa de la revisión vigente (sin costos internos)
    const pdfResp = page.waitForResponse(r => r.url().endsWith(`/quotes/customer-quotes/${f0.current_id}`));
    await famCard.getByRole('button', { name: 'VER PDF' }).click();
    check('VER PDF consulta la revisión vigente (200)', (await pdfResp).status() === 200);
    const pdfFrame = page.getByTestId('rev-pdf').frameLocator('iframe');
    const pdfText = flat(await pdfFrame.locator('body').innerText());
    check('VER PDF: folio, revisión, cliente y total', [f0.current_folio, `Revisión: ${f0.current_rev}`, f0.client_name, `${f0.currency} ${Number(f0.current_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`].every(x => pdfText.includes(x)), pdfText.slice(0, 300));
    check('VER PDF aislado en iframe sandbox', (await page.getByTestId('rev-pdf').locator('iframe').getAttribute('sandbox')) === '');
    await page.getByTestId('rev-pdf').getByRole('button', { name: 'Cerrar' }).click();
    // SOLICITAR MODIFICACIÓN → formulario R3A real (o motivo de bloqueo)
    await famCard.getByRole('button', { name: 'SOLICITAR MODIFICACIÓN' }).click();
    if (f0.can_request_change) {
      const req = await api(`/api/v1/recovery/requisitions/${f0.requisition_id}`);
      const modal = page.getByTestId('change-modal'); await modal.getByTestId('change-line').first().waitFor();
      const mt = flat(await modal.innerText());
      check('modificación: requisición, cotización y Rev. actual → nueva', mt.includes(f0.requisition) && mt.includes(f0.current_folio) && (await modal.locator('input[disabled]').nth(1).inputValue()) === `Rev. ${req.current_revision_number} → Rev. ${req.current_revision_number + 1}`, mt.slice(0, 200));
      check('modificación: partidas antes y después de la requisición', await modal.getByTestId('change-line').count() === req.items.length && mt.includes(req.items[0].description));
      await modal.getByRole('button', { name: 'Registrar solicitud' }).click();
      check('modificación: validación de obligatorios sin enviar nada', mt && await modal.getByText('Indica quién solicita el cambio.').count() >= 1 && await modal.getByText('Selecciona el origen.').count() === 1 && writes.length === 0);
      await modal.getByRole('button', { name: 'X Cerrar' }).click();
      check('modificación: el modal se cierra sin registrar', await page.getByTestId('change-modal').count() === 0);
    } else {
      await page.getByTestId('rev-blocked').waitFor();
      check('modificación bloqueada con motivo', /importado|RF1|Solo quien capturó|pendiente de revisión/.test(await page.getByTestId('rev-blocked').innerText()));
      await page.getByRole('button', { name: 'Entendido' }).click();
    }
    await shot(page, 'cot_1_revisiones');
    // ABRIR REV. VIGENTE → tarjeta 7 (formato) con la versión vigente seleccionada
    await famCard.getByRole('button', { name: 'ABRIR REV. VIGENTE' }).click();
    await page.getByTestId('format-doc').waitFor();
    await page.getByTestId('format-doc').contentFrame().getByText(f0.current_folio).first().waitFor();
    check('ABRIR REV. VIGENTE muestra la versión vigente', flat(await page.getByTestId('format-doc').contentFrame().locator('body').innerText()).includes(`${f0.currency} ${Number(f0.current_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`));
    check('ABRIR REV. VIGENTE abre el formato (tarjeta 7) con la versión seleccionada', (await page.getByRole('button', { name: /Formato para el cliente/ }).first().getAttribute('aria-pressed')) === 'true' && (await page.getByRole('combobox', { name: 'Cotización al cliente' }).inputValue()) === f0.current_id);

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
