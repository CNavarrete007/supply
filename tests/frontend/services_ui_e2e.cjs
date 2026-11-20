// Servicios Operativos · sección 3 "Matriz de servicios" · E2E de interfaz (Chromium) contra Vite + API + MariaDB
// SINTÉTICAS. Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta. Valores esperados desde la API.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/services_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ');
const low = s => flat(s).toLowerCase();

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  await context.addInitScript(() => { window.print = () => {}; });
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
    const all = await api('/api/v1/services/matrix?page=1&page_size=50');
    const c0 = all.summary.clients.find(c => c.services > 1) || all.summary.clients[0];
    const cd = await api(`/api/v1/services/matrix?page=1&page_size=50&client=${c0.id}`);

    await page.locator('nav button').filter({ hasText: /Servicios Operativos$/ }).click();
    const first = page.waitForResponse(r => r.url().includes('/api/v1/services/matrix'));
    await page.getByRole('button', { name: /^📑\s*Matriz$/ }).click();
    check('matriz consulta MariaDB (200)', (await first).status() === 200);
    const sm = page.getByTestId('service-matrix'); await page.getByTestId('service-clients-chip').waitFor();
    const t0 = flat(await sm.innerText());
    check('título, explicación, Excel/CSV y paso 1/2 del diseño', ['Matriz de servicios', 'Consulta, filtra, edita y controla todos los servicios.', 'Excel/CSV', 'Servicios por cliente → comprador', 'Paso 1: selecciona el cliente. Paso 2: selecciona el comprador vinculado a la requisición/validación.'].every(x => t0.includes(x)), t0.slice(0, 300));
    check('aviso propio (sin aviso genérico)', await page.getByText('Módulo pendiente de integración').count() === 0 && (await page.getByTestId('services-notice').innerText()).includes('Matriz de servicios conectada a MariaDB'));
    const so = await sm.getByLabel('Servicio', { exact: true }).locator('option').allInnerTexts();
    const sto = await sm.getByLabel('Estatus', { exact: true }).locator('option').allInnerTexts();
    check('filtros del diseño: 8 servicios y 8 estatus (+ los de MariaDB)', JSON.stringify(so.slice(0, 9)) === JSON.stringify(['Todos los servicios', 'Suministro de agua', 'Transporte', 'Transporte de personal', 'Gestión Rise X', 'Servicio de grúa', 'Montacargas', 'Recarga de gasolina', 'Last Mile Deliveries'])
      && JSON.stringify(sto.slice(0, 9)) === JSON.stringify(['Todos los estatus', 'Solicitado', 'Programado', 'En ejecución', 'Pendiente de información', 'Pendiente de aprobación', 'Completado', 'Facturado', 'Cancelado']) && all.statuses.every(s => sto.some(o => o.toLowerCase() === s.toLowerCase())), JSON.stringify(sto));
    check('chip "N cliente(s) · M servicio(s)"', (await page.getByTestId('service-clients-chip').innerText()).trim() === `${all.summary.clients.length} cliente(s) · ${all.total} servicio(s)`);
    const cc = page.getByTestId('service-client-card');
    check('tarjeta por cliente: servicios, compradores, abiertos y con evidencia', await cc.count() === all.summary.clients.length && low(await cc.filter({ hasText: c0.name.toUpperCase() }).innerText()).includes(`${c0.services} servicios ${c0.buyers} compradores ${c0.open} abiertos ${c0.with_evidence} con evidencia`), low(await cc.first().innerText()));
    check('matriz cerrada hasta elegir cliente', await page.getByTestId('service-row').count() === 0);
    const cr = page.waitForResponse(r => r.url().includes(`client=${c0.id}`));
    await cc.filter({ hasText: c0.name.toUpperCase() }).click();
    check('paso 1: filtro por cliente en el servidor (200)', (await cr).status() === 200);
    await page.getByTestId('service-row').first().waitFor();
    check('cliente elegido: "N servicio(s) · ahora selecciona comprador" y Volver a tarjetas', flat(await page.getByTestId('service-client-selected').innerText()).includes(`${c0.services} servicio(s) · ahora selecciona comprador`));
    const bc = page.getByTestId('service-buyer-card');
    check('paso 2: Todos los compradores + uno por comprador de la validación vinculada', await bc.count() === cd.summary.buyers.length + 1 && (await page.getByTestId('service-buyers-chip').innerText()).trim() === `${cd.summary.buyers.length} comprador(es)`
      && low(await bc.first().innerText()).includes(`todos los compradores ${c0.name.toLowerCase()}`) && low(await page.getByTestId('service-client-selected').locator('xpath=..').innerText()).includes('derivado de gestión del contratista'));
    check(`matriz del cliente: ${cd.total} servicio(s)`, await page.getByTestId('service-row').count() === Math.min(10, cd.total) && flat(await page.getByTestId('service-pager').innerText()).includes(`1-${Math.min(10, cd.total)} de ${cd.total} registros`));
    const x0 = cd.items.find(x => x.evidence_count > 0) || cd.items[0];
    const r0 = low(await page.getByTestId('service-row').filter({ hasText: x0.folio }).innerText());
    check('fila: folio, requisición, servicio, autorización, OC, facturación, estatus, importes y responsable', [x0.folio, x0.service, x0.authorization_type || 'sin autorización', x0.status, `${x0.quantity} ${x0.unit_label}`, String(x0.evidence_count)].every(y => r0.includes(String(y).toLowerCase())) && ['solicitud', 'editar'].every(y => r0.includes(y)), r0);
    const b1 = cd.summary.buyers[0];
    const brq = page.waitForResponse(r => r.url().includes(`buyer=${b1.key}`));
    await bc.nth(1).click();
    check('paso 2: filtro por comprador en el servidor (200)', (await brq).status() === 200);
    await page.getByTestId('service-pager').filter({ hasText: `de ${b1.services} registros` }).waitFor();
    check('solo servicios del comprador', await page.getByTestId('service-row').count() === Math.min(10, b1.services));
    await bc.first().click(); await page.getByTestId('service-pager').filter({ hasText: `de ${cd.total} registros` }).waitFor();
    const st = page.waitForResponse(r => /status=/.test(r.url()));
    await sm.getByLabel('Estatus', { exact: true }).selectOption(x0.status);
    check('filtro de estatus en el servidor (200)', (await st).status() === 200);
    await page.getByTestId('service-row').first().waitFor();
    check('filtro de estatus aplicado', (await page.getByTestId('service-row').allInnerTexts()).every(t => t.includes(x0.status)));
    await sm.getByLabel('Estatus', { exact: true }).selectOption('');
    await page.getByTestId('service-pager').filter({ hasText: `de ${cd.total} registros` }).waitFor();
    const sq = page.waitForResponse(r => r.url().includes('/services/matrix') && r.url().includes(`q=${encodeURIComponent(x0.folio)}`));
    await sm.getByLabel('Buscar servicio').fill(x0.folio);
    await sq;
    await page.getByTestId('service-pager').filter({ hasText: 'de 1 registros' }).waitFor();
    check('búsqueda en el servidor', await page.getByTestId('service-row').count() === 1);
    await sm.getByLabel('Buscar servicio').fill('');
    await page.getByTestId('service-pager').filter({ hasText: `de ${cd.total} registros` }).waitFor();
    await shot(page, 'srv_matrix');
    // Excel/CSV
    const dlP = page.waitForEvent('download');
    await sm.getByRole('button', { name: /Excel\/CSV/ }).click();
    const dl = await dlP; const fs = require('fs'); const f = `${require('os').tmpdir()}/srv-${Date.now()}.csv`; await dl.saveAs(f); const csv = fs.readFileSync(f, 'utf8'); fs.unlinkSync(f);
    check('Excel/CSV descarga los servicios filtrados (cliente)', /^servicios-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()) && csv.split('\r\n').length === cd.total + 1 && csv.includes('Folio,Requisición,Referencia interna') && cd.items.every(x => csv.includes(x.folio)));
    // Solicitud
    await page.getByTestId('service-row').filter({ hasText: x0.folio }).getByRole('button', { name: /Solicitud/ }).click();
    const frame = page.frameLocator('iframe[title="Solicitud de servicio"]');
    await frame.getByText('SOLICITUD DE SERVICIO').waitFor();
    const ft = flat(await frame.locator('body').innerText());
    check('Solicitud: formato Grupo Gerez con cliente, autorización, ejecución, importes y evidencias', ['GRUPO GEREZ', 'SOLICITUD DE SERVICIO', x0.folio, x0.client_name, x0.service].every(y => ft.includes(y)) && (x0.evidence_count === 0 || ft.toLowerCase().includes('evidencias registradas')), ft.slice(0, 400));
    check('Solicitud aislada en iframe sandbox', (await page.locator('iframe[title="Solicitud de servicio"]').getAttribute('sandbox')) === '');
    const pop = page.waitForEvent('popup');
    await page.getByRole('dialog', { name: 'Solicitud de servicio' }).getByRole('button', { name: /Imprimir/ }).click();
    const pw = await pop; await pw.waitForLoadState();
    check('Imprimir / PDF abre la solicitud', flat(await pw.locator('body').innerText()).includes(x0.folio));
    await pw.close().catch(() => {});
    await page.getByRole('dialog', { name: 'Solicitud de servicio' }).getByRole('button', { name: 'Cerrar', exact: true }).click();
    // Editar
    await page.getByTestId('service-row').filter({ hasText: x0.folio }).getByRole('button', { name: /Editar/ }).click();
    const ed = page.getByRole('dialog', { name: 'Editar servicio' });
    await ed.getByRole('button', { name: 'Guardar cambios' }).click();
    check('editar: sin cambios no se guarda', (await page.getByTestId('service-edit-msg').innerText()).includes('Sin cambios por guardar.'));
    await ed.getByLabel(/^Cantidad/).fill('0');
    await ed.getByRole('button', { name: 'Guardar cambios' }).click();
    check('editar: cantidad inválida', flat(await ed.innerText()).includes('Cantidad inválido(a).'));
    await ed.getByLabel(/^Cantidad/).fill(String(x0.quantity)); await ed.getByLabel('Venta', { exact: true }).fill(String(Number(x0.price) + 100));
    await ed.getByRole('button', { name: 'Guardar cambios' }).click();
    check('editar: validado pero NO guardado', flat(await page.getByTestId('service-edit-msg').innerText()).startsWith(`Datos validados, pero no se guardaron los cambios de ${x0.folio} (venta)`));
    await ed.getByRole('button', { name: 'Cancelar' }).click();
    // Eliminar
    await page.getByTestId('service-row').filter({ hasText: x0.folio }).getByRole('button', { name: `Eliminar ${x0.folio}` }).click();
    const dd = page.getByRole('dialog', { name: 'Eliminar servicio' });
    if (x0.evidence_count > 0 || x0.invoices || x0.supplier_po || x0.imported) check('eliminar: servicio con evidencias/factura/OC se conserva', (await page.getByTestId('service-delete-block').innerText()).includes('que deben conservarse') || (await page.getByTestId('service-delete-block').innerText()).includes('importado'));
    await dd.getByRole('button', { name: 'Cancelar' }).click();
    const free = cd.items.find(x => !x.evidence_count && !x.invoices && !x.supplier_po && !x.imported);
    if (free) {
      await page.getByTestId('service-row').filter({ hasText: free.folio }).getByRole('button', { name: `Eliminar ${free.folio}` }).click();
      await dd.getByLabel('Folio a eliminar').fill(free.folio.toLowerCase()); await dd.getByLabel('Motivo de la eliminación').fill('Captura duplicada (prueba E2E)');
      await dd.getByRole('button', { name: 'Eliminar', exact: true }).click();
      check('eliminar: validado pero NO eliminado', (await page.getByTestId('service-delete-msg').innerText()).startsWith(`Datos validados, pero no se eliminó ${free.folio}`));
      await dd.getByRole('button', { name: 'Cancelar' }).click();
    }
    await page.getByRole('button', { name: /Volver a tarjetas/ }).click();
    check('Volver a tarjetas cierra la matriz', await page.getByTestId('service-row').count() === 0);
    // 4 · Formatos y Reportes
    await page.locator('main').getByRole('button', { name: /^📈\s*Reportes$/ }).click();
    const rp = page.getByTestId('service-reports'); await rp.waitFor();
    const fl = l => page.getByTestId('service-report-filters').getByLabel(l, { exact: true });
    await rp.getByLabel('Solicitud de servicio', { exact: true }).locator('option').nth(all.total).waitFor({ state: 'attached' });
    const rt = flat(await rp.innerText());
    check('reportes: centro documental, botones y tipos del diseño', ['Centro documental', 'Formatos y Reportes de Servicios Operativos', 'Genera documentos operativos, entregables al cliente y análisis gerencial', 'Imprimir', 'Generar PDF', 'Exportar datos', 'Aplicar filtros',
      'Formato de Solicitud', 'Documento individual del servicio', 'Por Partidas', 'Detalle línea por línea', 'General', 'Consolidado operativo y financiero', 'Hacia el Cliente', 'Sin costo interno ni margen', 'Gerencial', 'Rentabilidad, riesgos y tendencias', 'Selecciona una solicitud de servicio para generar su formato.'].every(x => rt.includes(x)), rt.slice(0, 300));
    check('reportes: aviso propio de la sección conectada', (await page.getByTestId('services-notice').innerText()).includes('Formatos y reportes con datos reales de MariaDB'));
    const ro = await fl('Estatus').locator('option').allInnerTexts();
    check('reportes: filtros (clientes reales, 8 servicios, 11 estatus del diseño)', await fl('Cliente').locator('option').count() === all.summary.clients.length + 1 && (await fl('Servicio').locator('option').allInnerTexts()).length >= 9
      && JSON.stringify(ro.slice(0, 12)) === JSON.stringify(['Todos', 'Solicitado', 'Cotizado', 'Autorizado', 'Programado', 'En ejecución', 'Pendiente de información', 'Pendiente de aprobación', 'Completado', 'Listo para facturar', 'Facturado', 'Cancelado']), JSON.stringify(ro));
    const so2 = await rp.getByLabel('Solicitud de servicio', { exact: true }).locator('option').allInnerTexts();
    check('reportes: solicitudes reales "FOLIO · Servicio · CLIENTE"', so2.length === all.total + 1 && all.items.every(x => so2.includes(`${x.folio} · ${x.service} · ${x.client_name.toUpperCase()}`)));
    await rp.getByRole('button', { name: 'Generar formato' }).click();
    check('reportes: generar formato sin solicitud la pide', (await page.getByTestId('service-report-msg').innerText()).includes('Selecciona una solicitud de servicio.'));
    const sx = all.items[0];
    await rp.getByLabel('Solicitud de servicio', { exact: true }).selectOption(sx.id);
    await rp.getByRole('button', { name: 'Generar formato' }).click();
    const rf = page.frameLocator('iframe[title="Vista previa del reporte"]');
    await rf.getByText('SOLICITUD DE SERVICIO').waitFor();
    const ftx = flat(await rf.locator('body').innerText());
    check('reportes: contenido del formato', ['GRUPO GEREZ', 'SOLICITUD DE SERVICIO', sx.folio, sx.client_name, sx.service].every(y => ftx.includes(y)), ftx.slice(0, 300));
    let dlp = page.waitForEvent('download');
    await rp.getByRole('button', { name: /Descargar PDF/ }).click();
    let dl2 = await dlp;
    check('reportes: Descargar PDF del formato (FOLIO.pdf)', dl2.suggestedFilename() === `${sx.folio}.pdf`);
    const pp = page.waitForEvent('popup');
    await rp.getByRole('button', { name: /^🖨 Imprimir$/ }).first().click();
    const pw2 = await pp; await pw2.waitForLoadState();
    check('reportes: Imprimir abre el formato', flat(await pw2.locator('body').innerText()).includes(sx.folio)); await pw2.close().catch(() => {});
    // General con filtros reales
    const ck = all.summary.clients[0];
    const ccx = await api(`/api/v1/services/matrix?page=1&page_size=50&client=${ck.id}`);
    await fl('Cliente').selectOption(ck.id);
    const ar = page.waitForResponse(r => r.url().includes(`client=${ck.id}`) && r.url().includes('/services/matrix'));
    await page.getByTestId('service-report-filters').getByRole('button', { name: 'Aplicar filtros' }).click();
    check('reportes: Aplicar filtros consulta MariaDB (200)', (await ar).status() === 200);
    await page.getByTestId('service-report-kind').filter({ hasText: 'General' }).click();
    await page.getByTestId('service-report-count').filter({ hasText: `${ccx.total} servicio(s)` }).waitFor();
    await rp.getByRole('button', { name: 'Generar reporte' }).click();
    await rf.getByText('REPORTE GENERAL DE SERVICIOS').waitFor();
    const gt = flat(await rf.locator('body').innerText());
    check('reportes: General con indicadores y agrupaciones del cliente filtrado', gt.includes(`Cliente: ${ck.name}`) && gt.toLowerCase().includes('por estatus') && gt.toLowerCase().includes('por tipo de servicio') && ccx.items.every(x => gt.includes(x.service)), gt.slice(0, 400));
    // Hacia el Cliente sin costo ni margen + exportación
    await page.getByTestId('service-report-kind').filter({ hasText: 'Hacia el Cliente' }).click();
    await rp.getByRole('button', { name: 'Generar reporte' }).click();
    await rf.getByText('REPORTE DE SERVICIOS AL CLIENTE').waitFor();
    const ct = flat(await rf.locator('body').innerText());
    check('reportes: Hacia el Cliente sin costo interno ni margen', !/costo|margen/i.test(ct.replace(/no incluye costo interno ni margen/i, '')) && ccx.items.every(x => ct.includes(x.folio)), ct.slice(0, 400));
    dlp = page.waitForEvent('download');
    await rp.getByRole('button', { name: /Exportar datos/ }).click();
    dl2 = await dlp; const fs2 = require('fs'); const f2 = `${require('os').tmpdir()}/srvr-${Date.now()}.csv`; await dl2.saveAs(f2); const csv2 = fs2.readFileSync(f2, 'utf8'); fs2.unlinkSync(f2);
    check('reportes: Exportar datos del cliente sin costo, margen, OC ni comprador', csv2.split('\r\n').length === ccx.total + 1 && !/Costo|Margen|OC proveedor|Comprador/.test(csv2.split('\r\n')[0]));
    // Por Partidas y Gerencial
    await page.getByTestId('service-report-kind').filter({ hasText: 'Por Partidas' }).click();
    await rp.getByRole('button', { name: 'Generar reporte' }).click();
    await rf.getByText('REPORTE DE SERVICIOS POR PARTIDAS').waitFor();
    check('reportes: Por Partidas con una fila por servicio', (await rf.locator('table.t tbody tr:not(.tot)').count()) === ccx.total);
    await page.getByTestId('service-report-kind').filter({ hasText: 'Gerencial' }).click();
    await rp.getByRole('button', { name: 'Generar reporte' }).click();
    await rf.getByText('REPORTE GERENCIAL DE SERVICIOS').waitFor();
    const mt = flat(await rf.locator('body').innerText()).toLowerCase();
    check('reportes: Gerencial con rentabilidad, riesgos y tendencia', ['rentabilidad por tipo de servicio', 'rentabilidad por cliente', 'riesgos', 'tendencia mensual', 'servicios en riesgo'].every(x => mt.includes(x)));
    dlp = page.waitForEvent('download');
    await rp.getByRole('button', { name: /Generar PDF/ }).click();
    dl2 = await dlp;
    check('reportes: Generar PDF del reporte gerencial', dl2.suggestedFilename() === 'REPORTE-GERENCIAL-DE-SERVICIOS.pdf');
    await fl('Desde').fill('2026-12-01'); await fl('Hasta').fill('2026-11-01');
    await page.getByTestId('service-report-filters').getByRole('button', { name: 'Aplicar filtros' }).click();
    check('reportes: rango de fechas inválido', (await page.getByTestId('service-report-msg').innerText()).includes('"Desde" no puede ser posterior a "Hasta".'));
    await shot(page, 'srv_reports');
    await page.locator('main').getByRole('button', { name: /^📊\s*Dashboard$/ }).click();
    check('otras secciones: aviso de pendiente de integración', (await page.getByTestId('services-notice').innerText()).includes('Sección pendiente de integración'));
    await page.locator('main').getByRole('button', { name: /^📑\s*Matriz$/ }).click(); await page.getByTestId('service-clients-chip').waitFor();
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin escrituras /api intentadas', writes.length === 0, writes.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nServicios Operativos UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
