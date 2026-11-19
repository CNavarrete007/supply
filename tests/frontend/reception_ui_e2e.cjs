// Recepción y Entrega · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición /api
// que no sea GET (salvo login/logout) se aborta. Valores esperados calculados desde la API (REC-QA-0001/0003/0004,
// ENT-QA-0001 aceptada, firmada y bloqueada; ENT-QA-0002 con aceptación pendiente).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/reception_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ');
const pct = v => `${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`;

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
    const all = await api('/api/v1/reception/matrix?page=1&page_size=50');
    const closure = await api('/api/v1/reception/closure');
    const orders = await api('/api/v1/reception/orders?page=1&page_size=50');
    const rec = f => all.items.find(x => x.folio === f);

    // 3 · Matriz (tarjeta por defecto)
    const first = page.waitForResponse(r => /\/api\/v1\/reception\/matrix\?page=1/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Recepción y Entrega$/ }).click();
    check('matriz consulta MariaDB (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Registro de recepción', 'Entrega al cliente', 'Matriz de recepción y entrega', 'Semáforo de cierre'])
      check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t) }).first().isVisible());
    check('aviso de modo consulta visible', await page.getByText(/Modo consulta MariaDB: registrar recepciones/).isVisible());
    const allCard = flat(await page.getByRole('button', { name: /Todos los clientes/ }).innerText());
    check('tarjeta "Todos": registros, recepciones y entregas', allCard.includes(`${all.total} Registros ${all.summary.receipts} Recepción ${all.summary.deliveries} Entregas`), allCard);
    check('matriz cerrada hasta elegir cliente', await page.getByRole('row').count() === 0);
    check('"Nueva recepción" y "Nueva entrega" bloqueadas', await page.getByRole('button', { name: /Nueva recepción/ }).isDisabled() && await page.getByRole('button', { name: /Nueva entrega/ }).isDisabled());
    await page.getByRole('button', { name: /Todos los clientes/ }).click();
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).waitFor();
    const e1 = flat(await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).innerText());
    check('fila de entrega: OC, requisición, cantidad, aceptación, firma y hash', ['ENTREGA', 'OC-QA-0001', 'QA01-REQ-2026-SF4EA4', '3 entregado', 'Aceptada', 'Firmada y bloqueada', 'SHA-256 7f09511f0159'].every(x => e1.includes(x)), e1);
    const r4 = flat(await page.getByRole('row').filter({ hasText: 'REC-QA-0004' }).innerText());
    check('fila de recepción por partida: avance, calidad y documentos', ['RECEPCIÓN', 'OC-QA-0003 Rev. 1', pct(rec('REC-QA-0004').received_percent), 'Con observaciones', 'Incompleta', 'Sin entrega'].every(x => r4.includes(x)), r4);
    const r1 = flat(await page.getByRole('row').filter({ hasText: 'REC-QA-0001' }).innerText());
    check('recepción histórica muestra aceptación desde su entrega', r1.includes('100% recibido') && r1.includes('Aceptad'), r1);
    check(`${all.total} registros (recepciones + entregas)`, await page.getByText(`${all.total} registros`).isVisible());
    const c2 = all.summary.clients.find(c => c.name === 'Cliente Sintético Dos');
    const byClient = page.waitForResponse(r => new RegExp(`client=${c2.id}`).test(r.url()));
    await page.getByRole('button', { name: /Cliente Sintético Dos/ }).click();
    check('filtro por cliente en el servidor (200)', (await byClient).status() === 200);
    await page.getByText(`${c2.receipts + c2.deliveries} registros`).waitFor();
    check('solo registros del cliente', await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).count() === 0 && await page.getByRole('row').filter({ hasText: 'ENT-QA-0002' }).count() === 1);
    const onlyDel = page.waitForResponse(r => /kind=delivery/.test(r.url()));
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption('delivery');
    check('filtro por tipo en el servidor (200)', (await onlyDel).status() === 200);
    await page.getByText(`${c2.deliveries} registros`).waitFor();
    await shot(page, 'rec_3_matriz');
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption('all');
    await page.getByRole('button', { name: /Todos los clientes/ }).click();
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).waitFor();

    // Formato de entrega (acuse)
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).getByRole('button', { name: 'VER FORMATO' }).click();
    const frame = page.frameLocator('iframe[title="Formato de entrega"]');
    await frame.getByText('Acuse de entrega ENT-QA-0001').waitFor();
    const ft = flat(await frame.locator('body').innerText());
    check('acuse: cliente, lugar, origen, partidas, firmas', ['Cliente Sintético Uno', 'Almacén sintético QA', 'OC-QA-0001 / REC-QA-0001', 'Material sintético · placa', 'QA Comprador', 'Receptor Sintético', 'firmado y bloqueado'].every(x => ft.includes(x)), ft.slice(0, 300));
    check('acuse aislado en iframe sandbox', (await page.locator('iframe[title="Formato de entrega"]').getAttribute('sandbox')) === '');
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Imprimir \/ PDF/ }).click();
    const pop = await popup; await pop.waitForLoadState();
    check('impresión abre el acuse', flat(await pop.locator('body').innerText()).includes('ENT-QA-0001'));
    await pop.close().catch(() => {});
    await shot(page, 'rec_formato');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // Matriz → Registro de recepción (desde una versión anterior de la OC)
    await page.getByRole('row').filter({ hasText: 'REC-QA-0003' }).getByRole('button', { name: 'RECEPCIÓN' }).click();
    await page.getByTestId('receipt-detail').waitFor();
    const o3 = orders.items.find(o => o.folio === 'OC-QA-0003');
    check('abre la OC vigente de la serie (Rev. 1)', (await page.getByRole('combobox', { name: 'Orden de compra' }).inputValue()) === o3.id);
    const od = flat(await page.getByTestId('order-reception').innerText());
    check('ordenado vs recibido de la serie', od.includes(`Recibido: ${pct(o3.received_percent)} (Parcial)`) && od.includes('Instrumento sintético'), od.slice(0, 400));
    const rd = flat(await page.getByTestId('receipt-detail').innerText());
    check('detalle de recepción histórica: 50 % y aceptación pendiente desde la entrega', rd.includes('REC-QA-0003') && rd.includes('50%') && rd.includes('Pendiente (entrega)') && rd.includes('Histórico (encabezado)'), rd.slice(0, 400));

    // 1 · Registro de recepción (diseño): formulario validado contra la OC, fotografías comprimidas; guardar NO escribe
    await page.getByRole('button', { name: /Registro de recepción/ }).click();
    const rfm = page.getByTestId('reception-form'); await rfm.waitFor();
    const rft = flat(await rfm.innerText());
    check('registro: título, explicación, Paso 6 y modo nueva captura', ['Registro de recepción', 'Documenta la recepción física del suministro, cantidad, calidad, documentos y evidencia fotográfica.', 'Paso 6 · Recepción', 'Modo nueva captura activo.'].every(x => rft.includes(x)), rft.slice(0, 300));
    const fld = l => rfm.getByLabel(l, { exact: true });
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    check('registro: valores iniciales del diseño (Total, 100, Conforme, Completa, hoy, folio automático)', await fld('Tipo de recepción').inputValue() === 'total' && await fld('Cantidad / % recibido').inputValue() === '100' && await fld('Inspección de calidad').inputValue() === 'conforme'
      && await fld('Documentación recibida').inputValue() === 'completa' && await fld('Fecha de recepción').inputValue() === today && await fld('Folio de recepción').inputValue() === 'Automático');
    check('registro: opciones del diseño', JSON.stringify(await fld('Tipo de recepción').locator('option').allInnerTexts()) === '["Total","Parcial"]' && JSON.stringify(await fld('Inspección de calidad').locator('option').allInnerTexts()) === '["Conforme","Con observaciones","No conforme"]' && JSON.stringify(await fld('Documentación recibida').locator('option').allInnerTexts()) === '["Completa","Incompleta","No recibida"]');
    await rfm.getByRole('button', { name: /Nueva recepción/ }).click();
    check('registro: sin OC muestra "Selecciona una orden para visualizar su contexto."', await rfm.getByText('Selecciona una orden para visualizar su contexto.').isVisible() && (await page.getByTestId('reception-photo-count').innerText()).trim() === '0 fotografías' && await rfm.getByText('No se han agregado fotografías.').isVisible());
    const opts = await fld('Orden de compra').locator('option').evaluateAll(os => os.map(o => [o.value, o.disabled]));
    check('registro: OC recibidas al 100 % deshabilitadas', orders.items.every(o => opts.some(([v, dis]) => v === o.id && dis === (o.reception === 'complete'))), JSON.stringify(opts));
    await rfm.getByRole('button', { name: /Guardar recepción/ }).click();
    check('registro: guardar sin OC pide seleccionarla', (await page.getByTestId('reception-save-msg').innerText()).includes('Selecciona la orden de compra.'));
    await fld('Orden de compra').selectOption(o3.id);
    await page.getByTestId('order-reception').waitFor();
    check('registro: contexto de la OC (recibido, partidas y pendiente)', flat(await page.getByTestId('order-reception').innerText()).includes(`Recibido: ${pct(o3.received_percent)}`));
    await fld('Tipo de recepción').selectOption('partial');
    check('registro: Parcial pide capturar el %', await fld('Cantidad / % recibido').inputValue() === '');
    await fld('Cantidad / % recibido').fill('60');
    await rfm.getByRole('button', { name: /Guardar recepción/ }).click();
    check('registro: % acumulado mayor a lo ya recibido', (await page.getByTestId('reception-save-msg').innerText()).includes(`mayor al ya registrado (${Number(o3.received_percent)} %)`));
    await fld('Cantidad / % recibido').fill('90');
    await fld('Inspección de calidad').selectOption('observaciones');
    await rfm.getByRole('button', { name: /Guardar recepción/ }).click();
    check('registro: calidad con observaciones exige describirlas', (await page.getByTestId('reception-save-msg').innerText()).includes('Describe las observaciones o la no conformidad'));
    await fld('Observaciones / no conformidad').fill('Dos piezas con empaque dañado (prueba E2E)');
    await fld('Evidencia / remisión / factura').fill('REM-E2E-01');
    const px = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
    await rfm.getByLabel('Fotografías de recepción').setInputFiles([{ name: 'descarga.png', mimeType: 'image/png', buffer: px }, { name: 'etiqueta.png', mimeType: 'image/png', buffer: px }, { name: 'animada.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') }]);
    await page.getByTestId('reception-photo-count').filter({ hasText: '2 fotografías' }).waitFor();
    check('registro: fotografías comprimidas (JPG/PNG/WebP) y GIF rechazado', await page.getByTestId('reception-photo').count() === 2 && (await page.getByTestId('reception-photo-msg').innerText()).includes('animada.gif: solo se aceptan imágenes JPG, PNG o WebP'));
    await page.getByTestId('reception-photo').first().getByRole('button', { name: 'Quitar' }).click();
    check('registro: quitar fotografía', (await page.getByTestId('reception-photo-count').innerText()).trim() === '1 fotografía');
    await rfm.getByRole('button', { name: /Guardar recepción/ }).click();
    const rsm = flat(await page.getByTestId('reception-save-msg').innerText());
    check('registro: validado pero NO guardado ni fotografías subidas', rsm.includes('Datos validados, pero no se guardó la recepción de OC-QA-0003 (90 %, parcial, con observaciones, documentación completa, 1 fotografía(s))') && rsm.includes('Las fotografías no se subieron.'), rsm);
    await shot(page, 'rec_1_registro');
    await rfm.getByRole('button', { name: /REC-QA-0004/ }).click();
    await page.getByTestId('receipt-detail').getByText('REC-QA-0004').waitFor();
    const r4d = flat(await page.getByTestId('receipt-detail').innerText());
    check('recepción por partida: rechazos, motivos y nota de calidad', ['Recepción parcial', 'Piezas rechazadas', 'Calidad con observaciones', 'Documentación incompleta', 'Golpe en carcasa', 'Sin entrega registrada'].every(x => r4d.includes(x)), r4d.slice(0, 500));
    await rfm.getByRole('button', { name: /^.{0,3}Limpiar$/ }).click();
    check('registro: Limpiar conserva la OC y reinicia la captura', await fld('Orden de compra').inputValue() === o3.id && await fld('Cantidad / % recibido').inputValue() === '100' && (await page.getByTestId('reception-photo-count').innerText()).trim() === '0 fotografías' && await page.getByTestId('reception-save-msg').count() === 0);
    await rfm.getByRole('button', { name: /Nueva recepción/ }).click();
    check('registro: Nueva recepción limpia también la OC', await fld('Orden de compra').inputValue() === '');
    await page.setViewportSize({ width: 390, height: 900 });
    check('registro: sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await rfm.getByRole('button', { name: /Ir a entrega/ }).click();
    await page.getByRole('combobox', { name: 'Recepción registrada' }).waitFor();
    check('registro: "Ir a entrega" abre Entrega al cliente', true);

    // 2 · Entrega al cliente
    await page.getByRole('button', { name: /^🚚.*Entrega al cliente/ }).click();
    await page.getByRole('combobox', { name: 'Recepción registrada' }).selectOption(rec('REC-QA-0001').id);
    await page.getByTestId('receipt-deliveries').getByRole('button', { name: /ENT-QA-0001/ }).click();
    await page.getByTestId('delivery-detail').waitFor();
    const dd = flat(await page.getByTestId('delivery-detail').innerText());
    check('detalle de entrega: responsables, evidencia, foto y firma', ['Receptor Sintético', 'QA Comprador', 'Acuse sintético firmado', 'foto-entrega-qa.jpg', 'Fotografía de entrega', 'Firma autógrafa digitalizada', 'Verificada'].every(x => dd.includes(x)), dd.slice(0, 500));
    check('archivos privados sin enlace de descarga', await page.getByTestId('delivery-detail').locator('a[href]').count() === 0);
    check('"Guardar entrega" bloqueado', await page.getByRole('button', { name: /Guardar entrega/ }).isDisabled());
    await shot(page, 'rec_2_entrega');

    // 4 · Semáforo de cierre
    const cl = page.waitForResponse(r => /\/reception\/closure$/.test(r.url()));
    await page.getByRole('button', { name: /Semáforo de cierre/ }).click();
    check('semáforo consulta MariaDB (200)', (await cl).status() === 200);
    for (const [k, t] of [['po_without_receipt', 'OC sin recepción'], ['receipts_pending', 'Recepciones con pendientes'], ['deliveries_missing', 'Entregas no registradas'], ['acceptance_pending', 'Aceptaciones pendientes'], ['ready_to_invoice', 'Listos para facturar']])
      check(`semáforo: ${t} = ${closure.counters[k]}`, flat(await page.getByRole('button', { name: new RegExp(t) }).innerText()).startsWith(String(closure.counters[k])));
    await page.getByRole('button', { name: /Recepciones con pendientes/ }).click();
    const lt = flat(await page.getByTestId('closure-list').innerText());
    check('lista de recepciones con pendientes', closure.receipts_pending.every(r => lt.includes(r.folio)) && lt.includes('Recepción parcial'), lt.slice(0, 300));
    await page.getByRole('button', { name: /Aceptaciones pendientes/ }).click();
    check('lista de aceptaciones pendientes', flat(await page.getByTestId('closure-list').innerText()).includes('ENT-QA-0002'));
    await shot(page, 'rec_4_semaforo');

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
  console.log(`\nRecepción y Entrega UI: ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
