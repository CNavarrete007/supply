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
    const low = s => flat(s).toLowerCase();
    const mx = page.getByTestId('reception-matrix');
    const mh = low(await mx.innerText());
    check('matriz: título, explicación y aviso "Matriz unificada" del diseño', ['matriz de recepción y entrega', 'consulta el avance de recepción, calidad, documentos, entrega y aceptación del cliente.', 'matriz unificada:', 'muestra cada recepción física registrada', 'incluso cuando consolida varias requisiciones', 'los formatos de entrega ya no se duplican debajo del formulario.'].every(x => mh.includes(x)), mh.slice(0, 400));
    const cardsApi = all.summary.clients;
    check('matriz: chip "N cliente(s) · M registro(s)"', (await page.getByTestId('matrix-clients-chip').innerText()).trim() === `${cardsApi.length} cliente(s) · ${cardsApi.reduce((n, c) => n + c.receipts + c.deliveries, 0)} registro(s)`);
    const allCard = low(await page.getByRole('button', { name: /Todos los clientes/i }).innerText());
    check('tarjeta "Todos": registros, recepciones, entregas, cartera completa y abrir', allCard.includes(`${all.total} registros ${all.summary.receipts} recepciones ${all.summary.deliveries} entregas`) && allCard.includes('vista general') && allCard.includes('cartera completa') && allCard.includes('abrir →'), allCard);
    check('tarjeta por cliente: "Registros del cliente" y "Cliente"', low(await page.getByTestId('matrix-client-card').nth(1).innerText()).includes('registros del cliente'));
    check('matriz cerrada hasta elegir cliente', await page.getByRole('row').count() === 0);
    check('"+ Nueva recepción" y "+ Nueva entrega" habilitadas (navegan a sus tarjetas)', await mx.getByRole('button', { name: /Nueva recepción/i }).isEnabled() && await mx.getByRole('button', { name: /Nueva entrega/i }).first().isEnabled());
    await page.getByRole('button', { name: /Todos los clientes/i }).click();
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).waitFor();
    check('cliente elegido: "Todos los clientes · N registro(s) visibles"', low(await page.getByTestId('matrix-selected').innerText()).includes(`todos los clientes ${all.total} registro(s) visibles`));
    const rowT = async f => low(await page.getByRole('row').filter({ hasText: f }).innerText());
    const e1 = await rowT('ENT-QA-0001');
    check('fila ENTREGA: folio, OC, requisición, cantidad, partidas, firmada, evidencia, lugar, fotos, aceptación y hash', ['entrega', 'completa · 2026-10-22', 'oc-qa-0001', 'qa01-req-2026-sf4ea4', '3.00 entregado', '1 partida(s) · completa', 'firmada y bloqueada', 'acuse sintético firmado', 'almacén sintético qa', '1 foto(s)', 'aceptado', 'sha-256 7f09511f0159'].every(x => e1.includes(x)), e1);
    check('fila ENTREGA: acciones Ver formato, PDF y Eliminar', ['ver formato', 'pdf', 'eliminar'].every(x => e1.includes(x)) && !e1.includes('nueva entrega'));
    const r4 = await rowT('REC-QA-0004');
    check('fila RECEPCIÓN: avance, formatos, calidad, documentos, fotos, aceptación e integridad', ['recepción', 'oc-qa-0003 rev. 1', `${pct(rec('REC-QA-0004').received_percent)} recibido`, '0 formato(s) de entrega', 'con observaciones', 'incompleta', '0 recepción', 'sin entrega'].every(x => r4.includes(x)), r4);
    check('fila RECEPCIÓN: acciones Recepción, Nueva entrega y Eliminar', ['nueva entrega', 'eliminar'].every(x => r4.includes(x)) && !r4.includes('ver formato'));
    const r3 = await rowT('REC-QA-0003');
    check('recepción con entrega parcial vinculada → "Entrega parcial"', r3.includes('entrega parcial') && r3.includes('1 formato(s) de entrega'), r3);
    const r1 = await rowT('REC-QA-0001');
    check('recepción con entrega completa firmada → "Aceptado" y "Firmas vinculadas"', r1.includes('100% recibido') && r1.includes('aceptado') && r1.includes('firmas vinculadas'), r1);
    check(`${all.total} registros (recepciones + entregas)`, await page.getByText(`${all.total} registros ·`).isVisible());
    const c2 = all.summary.clients.find(c => c.name === 'Cliente Sintético Dos');
    const byClient = page.waitForResponse(r => new RegExp(`client=${c2.id}`).test(r.url()));
    await page.getByRole('button', { name: /Cliente Sintético Dos/i }).click();
    check('filtro por cliente en el servidor (200)', (await byClient).status() === 200);
    await page.getByText(`${c2.receipts + c2.deliveries} registros ·`).waitFor();
    check('solo registros del cliente', await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).count() === 0 && await page.getByRole('row').filter({ hasText: 'ENT-QA-0002' }).count() === 1);
    const onlyDel = page.waitForResponse(r => /kind=delivery/.test(r.url()));
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption('delivery');
    check('filtro por tipo en el servidor (200)', (await onlyDel).status() === 200);
    await page.getByText(`${c2.deliveries} registros ·`).waitFor();
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption('all');
    await page.getByRole('button', { name: /Todos los clientes/i }).click();
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).waitFor();
    await shot(page, 'rec_3_matriz');

    // Formato de entrega Grupo Gerez: vista previa y PDF
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).getByRole('button', { name: /^ver formato$/i }).click();
    const dlg = page.getByRole('dialog', { name: 'Formato de entrega' });
    const frame = page.frameLocator('iframe[title="Formato de entrega"]');
    await frame.getByText('FORMATO DE ENTREGA', { exact: true }).waitFor();
    const dh = flat(await dlg.innerText());
    check('formato: encabezado "ENT · Tipo" y "Vista previa del documento firmado" con ⬇ PDF y Cerrar', dh.includes('ENT-QA-0001 · Completa') && dh.includes('Vista previa del documento firmado') && dh.includes('PDF') && dh.includes('Cerrar'), dh.slice(0, 200));
    const ft = flat(await frame.locator('body').innerText());
    check('formato Grupo Gerez: cliente, lugar, requisición, OC, partida, firmantes e integridad', ['GRUPO GEREZ', 'FORMATO DE ENTREGA', 'DELIVERY NOTE / EVIDENCIA DE ENTREGA', 'Cliente Sintético Uno', 'Lugar: Almacén sintético QA', 'QA01-REQ-2026-SF4EA4', 'Aceptación: Aceptado', 'OC: OC-QA-0001',
      'Material sintético · placa', '3.00', 'ENTREGÓ POR EL CONTRATISTA', 'QA COMPRADOR', 'RECIBIÓ POR EL CLIENTE', 'RECEPTOR SINTÉTICO', 'Firma electrónica registrada', 'ID de control: CTRL-QA-01', 'SHA-256 expediente: 7f09511f015935f96f7c00dfc85cca72ea6c4e20a84b83b35f3b63fcf7abbabb', 'Documento firmado y bloqueado.'].every(x => ft.includes(x)), ft.slice(0, 600));
    check('formato aislado en iframe sandbox con logotipo Grupo Gerez', (await page.locator('iframe[title="Formato de entrega"]').getAttribute('sandbox')) === '' && await frame.locator('img[alt="Grupo Gerez"]').count() === 1);
    await shot(page, 'rec_formato');
    const fs = require('fs'); const os = require('os'); const path = require('path');
    const pdfText = async dl => { const f = path.join(os.tmpdir(), `sf-${Date.now()}.pdf`); await dl.saveAs(f); const t = fs.readFileSync(f).toString('latin1'); fs.unlinkSync(f); return t; };
    let dlP = page.waitForEvent('download');
    await dlg.getByRole('button', { name: /PDF/ }).click();
    let dl = await dlP; let pt = await pdfText(dl);
    check('⬇ PDF descarga el formato Grupo Gerez (ENT-QA-0001.pdf)', dl.suggestedFilename() === 'ENT-QA-0001.pdf' && ['GRUPO GEREZ', 'FORMATO DE ENTREGA', 'ENT-QA-0001', 'CTRL-QA-01'].every(x => pt.includes(x)));
    await dlg.getByRole('button', { name: 'Cerrar', exact: true }).click();
    dlP = page.waitForEvent('download');
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0010' }).getByRole('button', { name: /^pdf$/i }).click();
    dl = await dlP; pt = await pdfText(dl);
    check('PDF desde la fila (ENT-QA-0010.pdf)', dl.suggestedFilename() === 'ENT-QA-0010.pdf' && pt.includes('ENT-QA-0010'));

    // Eliminar: reglas de conservación y escritura bloqueada
    const delDialog = page.getByRole('dialog', { name: 'Eliminar registro' });
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0001' }).getByRole('button', { name: /^eliminar$/i }).click();
    check('eliminar entrega firmada: se conserva como evidencia', (await page.getByTestId('matrix-delete-block').innerText()).includes('firmado y bloqueado') && await delDialog.getByRole('button', { name: 'Eliminar', exact: true }).count() === 0);
    await delDialog.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('row').filter({ hasText: 'REC-QA-0001' }).getByRole('button', { name: /^eliminar$/i }).click();
    check('eliminar recepción con entrega vinculada o histórica: bloqueado', /formato\(s\) de entrega|histórica importada/.test(await page.getByTestId('matrix-delete-block').innerText()));
    await delDialog.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('row').filter({ hasText: 'ENT-QA-0002' }).getByRole('button', { name: /^eliminar$/i }).click();
    await delDialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
    check('eliminar borrador: exige escribir el folio', (await page.getByTestId('matrix-delete-msg').innerText()).includes('Escribe el folio ENT-QA-0002'));
    await delDialog.getByLabel('Folio a eliminar').fill('ent-qa-0002'); await delDialog.getByLabel('Motivo de la eliminación').fill('Captura duplicada (prueba E2E)');
    await delDialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
    check('eliminar borrador: validado pero NO eliminado', (await page.getByTestId('matrix-delete-msg').innerText()).startsWith('Datos validados, pero no se eliminó ENT-QA-0002'));
    await delDialog.getByRole('button', { name: 'Cancelar' }).click();
    check('la entrega sigue en la matriz', await page.getByRole('row').filter({ hasText: 'ENT-QA-0002' }).count() === 1);

    // Nueva entrega desde una recepción: cliente y requisición preseleccionados en la tarjeta 2
    await page.getByRole('row').filter({ hasText: 'REC-QA-0003' }).getByRole('button', { name: /^nueva entrega$/i }).click();
    await page.getByTestId('delivery-preset-msg').waitFor();
    const pm = flat(await page.getByTestId('delivery-preset-msg').innerText());
    check('Nueva entrega (REC-QA-0003): cliente y requisición con saldo preseleccionados', pm.startsWith('Desde REC-QA-0003: se preseleccionó QA02-REQ-2026-SCF210') && await page.getByTestId('delivery-line').count() === 1
      && await page.getByTestId('delivery-form').getByLabel('Cliente', { exact: true }).inputValue() === c2.id, pm);
    await page.getByRole('button', { name: /^📋.*Matriz de recepción y entrega/ }).click();
    await page.getByRole('row').filter({ hasText: 'REC-QA-0010' }).waitFor();
    await page.getByRole('row').filter({ hasText: 'REC-QA-0010' }).getByRole('button', { name: /^nueva entrega$/i }).click();
    await page.getByTestId('delivery-preset-msg').waitFor();
    check('Nueva entrega (REC-QA-0010): avisa que la requisición no tiene saldo', flat(await page.getByTestId('delivery-preset-msg').innerText()).includes('no tiene saldo disponible por entregar') && await page.getByTestId('delivery-line').count() === 0);
    await page.getByRole('button', { name: /^📋.*Matriz de recepción y entrega/ }).click();
    await mx.getByRole('button', { name: /Nueva entrega/i }).first().click();
    await page.getByTestId('delivery-form').waitFor();
    check('"+ Nueva entrega" abre el formato vacío', await page.getByTestId('delivery-form').getByLabel('Cliente', { exact: true }).inputValue() === '' && await page.getByTestId('delivery-preset-msg').count() === 0);
    await page.getByRole('button', { name: /^📋.*Matriz de recepción y entrega/ }).click();
    await page.getByRole('row').filter({ hasText: 'REC-QA-0003' }).waitFor();

    // Matriz → Registro de recepción (desde una versión anterior de la OC)
    await page.getByRole('row').filter({ hasText: 'REC-QA-0003' }).getByRole('button', { name: /^recepción$/i }).click();
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
    await page.getByTestId('delivery-form').waitFor();
    check('registro: "Ir a entrega" abre Entrega al cliente', true);

    // 2 · Entrega al cliente · Formato de entrega (lectura GET /reception/deliverable; guardar y firmar NO escribe)
    const dlv = await api('/api/v1/reception/deliverable?client=all');
    const dos = dlv.clients.find(c => c.name === 'Cliente Sintético Dos');
    const dlv2 = await api(`/api/v1/reception/deliverable?client=${dos.id}`);
    const withBal = dlv2.requisitions.find(r => r.items.some(i => i.available > 0));
    const noBal = dlv2.requisitions.find(r => r.items.every(i => i.available === 0) && r.deliveries.length);
    await page.getByRole('button', { name: /^🚚.*Entrega al cliente/ }).click();
    const dfm = page.getByTestId('delivery-form'); await dfm.waitFor();
    const dfl = n => dfm.getByLabel(n, { exact: true });
    const dhead = flat(await dfm.innerText());
    check('entrega: título, explicación, Paso 7 y aviso NOM-151 del diseño', ['Formato de entrega al cliente', 'Genera un formato firmado para una o varias requisiciones/solicitudes del mismo cliente. Permite entregas parciales o completas y controla el saldo por partida.', 'Paso 7 · Entrega documentada', 'Firma electrónica y NOM-151:', 'Prestador de Servicios de Certificación acreditado'].every(x => dhead.includes(x)));
    const todayB = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    await dfl('Cliente').locator('option').nth(dlv.clients.length).waitFor({ state: 'attached' });
    check('entrega: valores iniciales (Parcial, Recibido parcial sin cierre, hoy) y opciones del diseño', await dfl('Tipo de entrega').inputValue() === 'partial' && await dfl('Aceptación / condición de recepción').inputValue() === 'partial_open' && await dfl('Fecha de entrega').inputValue() === todayB
      && JSON.stringify(await dfl('Tipo de entrega').locator('option').allInnerTexts()) === '["Parcial","Completa"]' && JSON.stringify(await dfl('Aceptación / condición de recepción').locator('option').allInnerTexts()) === '["Recibido parcial sin cierre","Aceptado de conformidad","Aceptado con observaciones","Rechazado / devuelto"]');
    check('entrega: clientes con material recibido desde MariaDB', (await dfl('Cliente').locator('option').count()) === dlv.clients.length + 1 && dlv.clients.length > 0, JSON.stringify(dlv.clients));
    check('entrega: estados vacíos del diseño', ['Selecciona un cliente para mostrar las requisiciones/solicitudes con material recibido.', 'Selecciona una o varias requisiciones con artículos disponibles para entrega.', 'Sin fotografías de entrega.'].every(x => dhead.includes(x)) && (await page.getByTestId('delivery-photo-count').innerText()).trim() === '0 foto(s)'
      && (await page.getByTestId('po-sign-status-deliverer').innerText()) === 'Sin firma' && (await page.getByTestId('po-sign-status-receiver').innerText()) === 'Sin firma');
    await dfm.getByRole('button', { name: /Guardar y firmar formato/ }).click();
    check('entrega: guardar sin cliente pide seleccionarlo', (await page.getByTestId('delivery-save-msg').innerText()).includes('Selecciona el cliente.'));
    const dr = page.waitForResponse(r => r.url().includes(`/reception/deliverable?client=${dos.id}`));
    await dfl('Cliente').selectOption(dos.id);
    check('entrega: requisiciones del cliente consultadas (200)', (await dr).status() === 200);
    await page.getByTestId('delivery-req').nth(dlv2.requisitions.length - 1).waitFor();
    check('entrega: una tarjeta por requisición con material recibido', await page.getByTestId('delivery-req').count() === dlv2.requisitions.length);
    const nb = page.getByTestId('delivery-req').filter({ hasText: noBal.folio });
    check('entrega: requisición sin saldo bloqueada y con su entrega registrada', await nb.getByRole('checkbox').isDisabled() && flat(await nb.innerText()).includes('Sin saldo por entregar') && flat(await nb.innerText()).includes(noBal.deliveries[0].folio));
    await nb.getByRole('button', { name: new RegExp(noBal.deliveries[0].folio) }).click();
    await page.getByRole('dialog', { name: 'Formato de entrega' }).waitFor();
    await page.frameLocator('iframe[title="Formato de entrega"]').getByText(noBal.deliveries[0].folio, { exact: true }).waitFor({ timeout: 60000 });
    check('entrega: la entrega registrada abre su formato (acuse)', true);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await dfm.getByRole('button', { name: /Guardar y firmar formato/ }).click();
    check('entrega: guardar sin requisición pide seleccionarla', (await page.getByTestId('delivery-requisitions').innerText()).includes('Selecciona una o varias requisiciones/solicitudes del cliente.'));
    await page.getByTestId('delivery-req').filter({ hasText: withBal.folio }).getByRole('checkbox').check();
    const line = withBal.items.find(i => i.available > 0);
    await page.getByTestId('delivery-line').first().waitFor();
    const lt2 = flat(await page.getByTestId('delivery-line').first().innerText());
    check('entrega: partida con solicitado, recibido, entregado y disponible de MariaDB', page.getByTestId('delivery-line') && await page.getByTestId('delivery-line').count() === withBal.items.filter(i => i.available > 0).length
      && [withBal.folio, line.description, line.unit_label].every(x => lt2.includes(x)) && (await page.getByTestId('delivery-lines-count').innerText()).trim() === `0 / ${withBal.items.filter(i => i.available > 0).length} partida(s)`, lt2);
    const qIn = dfm.getByLabel(new RegExp(`Cantidad a entregar ${withBal.folio} #${line.line_number}`));
    await qIn.fill(String(line.available + 1));
    await dfm.getByRole('button', { name: /Guardar y firmar formato/ }).click();
    check('entrega: cantidad mayor al saldo marcada en la partida', flat(await page.getByTestId('delivery-line').first().innerText()).includes(`Excede el saldo disponible (${line.available})`));
    await dfl('Tipo de entrega').selectOption('complete');
    const cmp = [await qIn.inputValue(), await qIn.getAttribute('readonly'), await dfl('Aceptación / condición de recepción').inputValue(), await dfl('Aceptación / condición de recepción').locator('option[value="partial_open"]').evaluate(o => o.disabled)];
    check('entrega: Completa carga el saldo, bloquea la captura y cambia la aceptación', cmp[0] === String(line.available) && cmp[1] !== null && cmp[2] === 'accepted' && cmp[3], JSON.stringify(cmp));
    await dfl('Lugar de entrega').fill('Almacén del cliente (prueba E2E)');
    await dfl('Evidencia / remisión / acuse').fill('REM-E2E-ENT-01');
    await dfl('Aceptación / condición de recepción').selectOption('accepted_obs');
    await dfl('Entregó por el contratista').fill('Ana Pérez QA'); await dfl('Puesto de quien entrega').fill('Almacenista');
    await dfl('Recibió por el cliente').fill('ana perez qa'); await dfl('Puesto de quien recibe').fill('Residente de obra');
    await dfl('Correo del receptor').fill('residente@cliente.invalid');
    await dfm.getByRole('button', { name: /Guardar y firmar formato/ }).click();
    const dm1 = flat(await dfm.innerText());
    check('entrega: observaciones obligatorias, firmantes distintos y firmas requeridas', ['Describe las observaciones o el motivo del rechazo', 'Quien entrega y quien recibe deben ser personas distintas.', 'Falta la firma de quien entrega.', 'Falta la firma de quien recibe.'].every(x => dm1.includes(x)), dm1.slice(-900));
    await dfl('Observaciones').fill('Empaque exterior con raspaduras (prueba E2E)');
    await dfl('Recibió por el cliente').fill('Luis Gómez QA');
    check('entrega: confirmación de firma deshabilitada sin firma', await dfm.getByLabel('Confirmación: Firma de quien entrega').isDisabled());
    for (const [role, path] of [['deliverer', [[60, 40], [90, 70], [130, 30], [170, 80]]], ['receiver', [[50, 70], [110, 30], [150, 90], [210, 40]]]]) {
      const cv = page.getByTestId(`po-sign-${role}`).locator('canvas'); await cv.scrollIntoViewIfNeeded(); const bb = await cv.boundingBox();
      await page.mouse.move(bb.x + 30, bb.y + 90); await page.mouse.down(); for (const [dx, dy] of path) await page.mouse.move(bb.x + dx, bb.y + dy, { steps: 4 }); await page.mouse.up();
      await page.getByTestId(`po-sign-status-${role}`).filter({ hasText: 'Firma capturada' }).waitFor();
    }
    await dfm.getByRole('button', { name: /Guardar y firmar formato/ }).click();
    check('entrega: cada firmante debe confirmar su firma electrónica', flat(await dfm.innerText()).includes('Quien entrega debe confirmar su firma electrónica.'));
    await dfm.getByLabel('Confirmación: Firma de quien entrega').check(); await dfm.getByLabel('Confirmación: Firma de quien recibe').check();
    await dfm.getByLabel('Fotografías de entrega').setInputFiles([{ name: 'entrega.png', mimeType: 'image/png', buffer: px }]);
    await page.getByTestId('delivery-photo-count').filter({ hasText: '1 foto(s)' }).waitFor();
    await dfm.getByRole('button', { name: /Guardar y firmar formato/ }).click();
    const dsm = flat(await page.getByTestId('delivery-save-msg').innerText());
    const h = flat(await page.getByTestId('delivery-hashes').innerText());
    const hx = [...h.matchAll(/SHA-256: ([0-9a-f]{64})/g)].map(m => m[1]);
    check('entrega: validado pero NO guardado ni firmado (resumen y huella)', dsm.startsWith(`Datos validados, pero no se guardó ni se firmó el formato de entrega (1 partida(s) de 1 requisición(es) de ${dos.name}, entrega completa, aceptado con observaciones)`) && dsm.includes(`Huella SHA-256 del contenido que se firmaría: ${hx[0]}`), dsm);
    const { deliveryCanonical, sha256Hex } = await import(require('path').resolve(__dirname, '../../src/views/reception/deliveryForm.mjs'));
    const expect = { client: dos.id, type: 'complete', date: todayB, place: 'Almacén del cliente (prueba E2E)', acceptance: 'accepted_obs', requisitions: [withBal.id], qty: { [`${withBal.id}:${line.id}`]: String(line.available) }, evidence: 'REM-E2E-ENT-01', notes: 'Empaque exterior con raspaduras (prueba E2E)', photos: [{}],
      deliverer: 'Ana Pérez QA', delivererPosition: 'Almacenista', receiver: 'Luis Gómez QA', receiverPosition: 'Residente de obra', receiverCompany: '', receiverEmail: 'residente@cliente.invalid' };
    const want = sha256Hex(deliveryCanonical(expect, dlv2.requisitions, dos.name));
    check('entrega: huella del contenido = SHA-256 del formato canónico; firmas con huella propia', hx.length === 3 && hx[0] === want && hx[1] !== hx[2] && h.includes('no se registraron ni constituyen constancia NOM-151'), `${want} | ${h}`);
    await shot(page, 'rec_2_entrega');
    await page.setViewportSize({ width: 390, height: 900 });
    check('entrega: sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await dfm.getByRole('button', { name: 'Limpiar', exact: true }).last().click();
    check('entrega: Limpiar reinicia cliente, partidas, firmas y fotografías', await dfl('Cliente').inputValue() === '' && await page.getByTestId('delivery-line').count() === 0 && (await page.getByTestId('po-sign-status-deliverer').innerText()) === 'Sin firma'
      && (await page.getByTestId('delivery-photo-count').innerText()).trim() === '0 foto(s)' && await page.getByTestId('delivery-save-msg').count() === 0);
    await dfm.getByRole('button', { name: /Matriz recepción/ }).click();
    await page.getByText('Recepciones y entregas por cliente').waitFor();
    check('entrega: "Matriz recepción" abre la matriz', true);

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
