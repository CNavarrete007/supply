// Servicios Operativos · formulario "Nuevo servicio" (expediente al que redirige la Nueva solicitud) · E2E de interfaz
// (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición /api que no sea GET (salvo login/logout)
// se aborta y se reporta; los archivos se adjuntan desde memoria y no se suben. Valores esperados desde la API.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/service_form_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name, full = false) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full }); };
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const today = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const money = v => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PDF = { name: 'autorizacion.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% QA sintético\n') };
const PNG = { name: 'ticket.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a9e30000000049454e44ae426082', 'hex') };
const TXT = { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  const T = id => page.getByTestId(id);
  const val = id => T(id).inputValue();
  const toService = async (key, c0) => {
    await page.locator('nav button').filter({ hasText: /Servicios Operativos$/ }).click();
    await T('services-tab-2').click(); await T('svc-new-modal').waitFor();
    await T('svc-op-service').click(); await T('svc-new-next').click();
    await page.locator(`[data-testid=svc-service-option][data-key=${key}]`).click(); await T('svc-new-next').click();
    await T('svc-client').click(); await T('svc-client-search').fill(c0.name);
    await T('svc-client-option').filter({ hasText: `${c0.code} · ${c0.name}` }).first().click();
    await T('svc-gen-folio').click(); await page.waitForFunction(() => document.querySelector('[data-testid=svc-folio]').value !== '');
    await T('svc-gen-reference').click(); await page.waitForFunction(() => document.querySelector('[data-testid=svc-reference]').value !== '');
    const folio = await val('svc-folio'); const ref = await val('svc-reference');
    const k = page.waitForResponse(r => r.url().endsWith('/api/v1/services/new-request/contracting'));
    await T('svc-new-submit').click(); await T('service-form').waitFor();
    return { folio, ref, contracting: await k };
  };
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const catalogs = await api('/api/v1/recovery/catalogs');
    const cat = await api('/api/v1/services/new-request');
    const K = await api('/api/v1/services/new-request/contracting');
    const c0 = catalogs.clients.find(c => c.code && c.contact && c.email && c.project && c.status === 'active');
    const po0 = K.purchase_orders[0]; const s0 = K.suppliers.find(s => s.id === po0.supplier_id);
    const sPOs = K.purchase_orders.filter(o => o.supplier_id === s0.id);

    const { folio, ref, contracting } = await toService('agua', c0);
    check('redirige a "Nuevo servicio" y consulta proveedores y OC de MariaDB (200)', contracting.status() === 200);
    const head = flat(await T('service-form').innerText());
    check('encabezado del diseño: "Nuevo servicio", explicación y badge "Nuevo"', head.startsWith('Nuevo servicio') && head.includes('Los campos específicos cambian automáticamente según el tipo de servicio.') && (await T('sf-new-badge').innerText()) === 'Nuevo');
    check('requisición vinculada y referencia interna de solo lectura con los valores del paso 3', await val('sf-requisition') === folio && await val('sf-reference') === ref && await T('sf-requisition').getAttribute('readonly') !== null && await T('sf-reference').getAttribute('readonly') !== null);
    check('tipo, cliente "NÚMERO · RAZÓN SOCIAL", proyecto, contrato y fecha heredados', await val('sf-type') === 'agua' && (await T('sf-client_id').locator('option:checked').innerText()) === `${c0.code} · ${c0.name}` && await val('sf-project') === c0.project && await val('sf-contract') === (c0.contract || '') && await val('sf-request_date') === today() && await val('sf-need_date') === '');
    const statusOpts = await T('sf-status').locator('option').allInnerTexts();
    check('Estatus = "Solicitado" con los 11 estatus del diseño + los registrados', await val('sf-status') === 'Solicitado' && ['Solicitado', 'Cotizado', 'Autorizado', 'Programado', 'En ejecución', 'Pendiente de información', 'Pendiente de aprobación', 'Completado', 'Listo para facturar', 'Facturado', 'Cancelado', ...cat.statuses].every(x => statusOpts.includes(x)), statusOpts.join('|'));
    check('Responsable con placeholder del diseño', await T('sf-responsible').getAttribute('placeholder') === 'Responsable de la ejecución');
    check('la requisición queda marcada como validada, no creada', (await T('sf-link-note').innerText()).includes(`Requisición ${folio} validada, no creada.`));
    await shot(page, 'sf-top');

    // ---- Autorización comercial ----
    const form = flat(await T('service-form').innerText());
    check('sección "Autorización comercial del cliente" con su nota', form.includes('Autorización comercial del cliente') && form.includes('Se registra cuando exista. No es requisito para crear la requisición ni iniciar el expediente del servicio.'));
    check('autorización por omisión: Documento pendiente, Pendiente de documento, monto 0, MXN', (await T('sf-auth-badge').innerText()) === 'Documento pendiente' && await val('sf-auth_status') === 'Pendiente de documento' && await val('sf-auth_amount') === '0' && await val('sf-auth_currency') === 'MXN' && await val('sf-auth_type') === '');
    const authOpts = await T('sf-auth_type').locator('option').allInnerTexts();
    check('tipos de autorización: "Seleccionar..." + los del original + los registrados', authOpts[0] === 'Seleccionar...' && ['Orden de Servicio (SO) del cliente', 'Correo de autorización', ...cat.authorization_types].every(x => authOpts.includes(x)));
    check('placeholder de Número / referencia', await T('sf-auth_reference').getAttribute('placeholder') === 'PO, SO, contrato, correo, folio...');
    await T('sf-auth_status').selectOption('Autorizada / recibida');
    await T('sf-auth_file').setInputFiles(PDF);
    check('estatus autorizado + documento → "Autorización válida" y "Con documento adjunto" (no se sube)', (await T('sf-auth-badge').innerText()) === 'Autorización válida' && (await T('sf-auth-doc-badge').innerText()) === 'Con documento adjunto' && (await T('sf-auth_file-help').innerText()).includes('autorizacion.pdf'));

    // ---- Contratación de proveedor ----
    check('sección "Contratación de proveedor (opcional)" con su nota', form.includes('Contratación de proveedor (opcional)') && form.includes('Relaciona el servicio con una OC de SupplyFlow cuando necesitas contratar a un tercero para ejecutarlo.'));
    check('ejecución interna por omisión: proveedor y OC bloqueados, botones deshabilitados', (await T('sf-contract-badge').innerText()) === 'Ejecución interna' && await val('sf-requires') === 'no' && await T('sf-supplier_id').isDisabled() && await T('sf-po_id').isDisabled() && await T('sf-manage').isDisabled() && await T('sf-unlink').isDisabled());
    check('textos de ayuda e información de ejecución interna', (await T('sf-requires-help').innerText()) === 'Ejecución con recursos propios. No se requiere proveedor ni Orden de Compra.' && (await T('sf-supplier_id-help').innerText()) === 'Se habilita cuando el servicio requiere contratación externa.' && (await T('sf-po_id-help').innerText()) === 'Bloqueado hasta seleccionar un proveedor externo.'
      && flat(await T('sf-info').innerText()) === 'Ejecución interna. Supply Base ejecutará el servicio con recursos propios; no se requiere una OC a proveedor.' && await val('sf-po_cost') === '0' && await val('sf-po_currency') === '—');
    await shot(page, 'sf-auth-contracting');
    await T('sf-requires').selectOption('yes');
    check('Sí · Requiere proveedor externo → proveedor habilitado con los proveedores reales, "Proveedor por definir"', !(await T('sf-supplier_id').isDisabled()) && (await T('sf-supplier_id').locator('option').count()) === K.suppliers.length + 1 && (await T('sf-contract-badge').innerText()) === 'Proveedor por definir' && await T('sf-manage').isEnabled());
    await T('sf-supplier_id').selectOption(s0.id);
    const poOpts = await T('sf-po_id').locator('option').allInnerTexts();
    check('proveedor con OC → "OC pendiente" y sus OC vigentes', (await T('sf-contract-badge').innerText()) === 'OC pendiente' && poOpts[0] === 'Sin vincular' && poOpts.length === sPOs.length + 1 && poOpts[1].startsWith(`${sPOs[0].folio} · ${money(sPOs[0].total)} ${sPOs[0].currency}`), poOpts.join('|'));
    await T('sf-po_id').selectOption(po0.id);
    check('OC vinculada → costo y moneda de la OC, "Quitar vínculo" habilitado', (await T('sf-contract-badge').innerText()) === 'OC vinculada' && await val('sf-po_cost') === money(po0.total) && await val('sf-po_currency') === po0.currency && await T('sf-unlink').isEnabled() && flat(await T('sf-info').innerText()).startsWith(`OC vinculada. ${po0.folio} · ${s0.name}`));
    await shot(page, 'sf-po-linked');
    await T('sf-unlink').click();
    check('✕ Quitar vínculo deja "Sin vincular" y "OC pendiente"', await val('sf-po_id') === '' && (await T('sf-contract-badge').innerText()) === 'OC pendiente' && await T('sf-unlink').isDisabled());
    await T('sf-requires').selectOption('no');
    check('volver a ejecución interna limpia proveedor y OC', await val('sf-supplier_id') === '' && await T('sf-supplier_id').isDisabled() && (await T('sf-contract-badge').innerText()) === 'Ejecución interna');

    // ---- Importes ----
    check('cantidad 1, unidad "servicio", costo y precio 0; resumen "Costo $0.00 · Venta $0.00 · Margen $0.00 (0.0%)"', await val('sf-quantity') === '1' && await val('sf-unit') === 'servicio' && await val('sf-cost') === '0' && await val('sf-price') === '0' && flat(await T('sf-totals').innerText()) === 'Costo: $0.00 Venta: $0.00 Margen: $0.00 (0.0%)');
    await T('sf-cost').fill('3500'); await T('sf-price').fill('6500');
    check('margen calculado en vivo (verde)', flat(await T('sf-totals').innerText()) === 'Costo: $3,500.00 Venta: $6,500.00 Margen: $3,000.00 (46.2%)' && (await T('sf-totals').locator('b').nth(2).getAttribute('class')).includes('emerald'));
    await T('sf-price').fill('3000');
    check('margen negativo en rojo', flat(await T('sf-totals').innerText()).includes('Margen: $-500.00 (-16.7%)') && (await T('sf-totals').locator('b').nth(2).getAttribute('class')).includes('rose'));

    // ---- Datos específicos (formulario dinámico) ----
    const d1 = flat(await T('sf-details').innerText());
    check('"Datos específicos · Suministro de agua" con "Formulario dinámico" y sus 9 campos', d1.startsWith('Datos específicos · Suministro de agua') && d1.includes('Formulario dinámico')
      && ['Proveedor / pipa', 'Pipa / unidad', 'Placas', 'Operador', 'Volumen entregado (L o m³)', 'Lugar de entrega', 'Ticket / folio', 'Hora inicio', 'Hora término'].every(x => d1.includes(x)) && await T('sf-detail-startTime').getAttribute('type') === 'time' && await T('sf-detail-endTime').getAttribute('type') === 'time');
    await T('sf-detail-plates').fill('QA-123-X');
    check('descripción precargada con el servicio; observaciones con placeholder del diseño', await val('sf-description') === 'Suministro de agua' && await T('sf-notes').getAttribute('placeholder') === 'Incidencias, comentarios, resultado, restricciones...');
    await shot(page, 'sf-details', true);
    await T('sf-type').selectOption('transporte');
    const d2 = flat(await T('sf-details').innerText());
    check('cambiar a Transporte cambia los campos (claves del original) y la descripción no editada', d2.startsWith('Datos específicos · Transporte') && ['Origen', 'Destino', 'Tipo de vehículo', 'Carga', 'POD / folio de entrega', 'Salida', 'Llegada'].every(x => d2.includes(x)) && await T('sf-detail-departure').getAttribute('type') === 'datetime-local' && await val('sf-description') === 'Transporte');
    await T('sf-type').selectOption('rise_x');
    const d3 = flat(await T('sf-details').innerText());
    check('Gestión Rise X con sus campos', d3.startsWith('Datos específicos · Gestión Rise X') && ['Sitio / instalación', 'Usuario de plataforma', 'Objeto de la solicitud', 'Referencia externa', 'Fecha de captura', 'Fecha de aprobación', 'Resultado'].every(x => d3.includes(x)) && await T('sf-detail-captureDate').getAttribute('type') === 'date');
    await T('sf-type').selectOption('grua');
    check('tipo sin formulario documentado → aviso, sin campos inventados', (await T('sf-details-pending').innerText()).includes('«Servicio de grúa» del sistema original no están documentados') && !(await page.locator('[data-testid^=sf-detail-]').count()));
    await T('sf-type').selectOption('agua');
    await T('sf-description').fill('Suministro de agua potable a plataforma QA');

    // ---- Evidencias ----
    check('evidencias: título, explicación y "Sin evidencias cargadas."', flat(await T('sf-evidence-box').innerText()).includes('Evidencias del servicio PDF, imágenes, tickets, POD, capturas de Rise X u otros comprobantes.') && (await T('sf-evidence-list').innerText()) === 'Sin evidencias cargadas.');
    await T('sf-evidence').setInputFiles([PNG, PDF]);
    await T('sf-evidence').setInputFiles([TXT]);
    const ev = await T('sf-evidence-list').innerText();
    check('se listan las evidencias (acumulan) y se marca la no permitida', ev.includes('ticket.png') && ev.includes('autorizacion.pdf') && ev.includes('notas.txt') && ev.includes('adjunta PDF o imagen'));
    await T('sf-quantity').fill('0');
    await T('sf-save').click();
    check('Guardar con cantidad 0 → error y campo marcado', (await T('sf-error').innerText()).includes('La cantidad debe ser mayor a cero') && await T('sf-quantity').getAttribute('aria-invalid') === 'true');
    await T('sf-quantity').fill('2');
    await T('sf-save').click();
    check('Guardar con archivo no permitido → error de evidencias', (await T('sf-error').innerText()).includes('«notas.txt»: adjunta PDF o imagen'));
    await T('sf-evidence-list').getByRole('button', { name: 'Quitar notas.txt' }).click();
    check('quitar una evidencia', (await T('sf-evidence-list').locator('li').count()) === 2);

    // ---- Guardar (bloqueado) ----
    await T('sf-save').click();
    await T('sf-result').waitFor();
    const seq = cat.service_folio_sequences[today().slice(0, 4)] || 0;
    const expFolio = `SRV-${today().slice(0, 4)}-${String(seq + 1).padStart(5, '0')}`;
    check('Guardar servicio → "Datos validados, pero no se guardó el servicio" con folio sugerido y requisición', (await T('sf-locked').innerText()) === `Datos validados, pero no se guardó el servicio (folio sugerido ${expFolio}): el alta del expediente en service_orders requiere un endpoint de escritura y el permiso INSERT, que no están autorizados, y la requisición ${folio} tampoco se creó. Los archivos no se subieron. No se guardó nada en MariaDB.`);
    const sm = flat(await T('sf-summary').innerText());
    check('resumen del expediente (folio, requisición, tipo, cliente, autorización, importes, datos específicos, evidencias)', [expFolio, folio, 'Suministro de agua', `${c0.code} · ${c0.name}`, 'Autorizada / recibida', 'Ejecución interna', '2 servicio', 'costo $3,500.00', 'venta $3,000.00', 'margen $-500.00', 'legacy_suministro_de_agua · 1/9 capturados', '2 archivo(s), no subidos'].every(x => sm.includes(x)), sm.slice(0, 500));
    check('avisos: margen negativo y autorización sin referencia (hay documento → no)', (await T('sf-warnings').innerText()).includes('Margen negativo') && !(await T('sf-warnings').innerText()).includes('sin número / referencia ni documento'));
    await shot(page, 'sf-result', true);
    await T('sf-price').fill('6500');
    check('editar después de guardar oculta el resultado anterior', !(await T('sf-result').count()));

    // ---- Limpiar ----
    await T('sf-requires').selectOption('yes'); await T('sf-supplier_id').selectOption(s0.id);
    await T('sf-clear').click();
    check('🧹 Limpiar restablece la captura y conserva la requisición vinculada', await val('sf-requisition') === folio && await val('sf-type') === 'agua' && await val('sf-cost') === '0' && await val('sf-price') === '0' && await val('sf-quantity') === '1'
      && await val('sf-requires') === 'no' && await val('sf-auth_status') === 'Pendiente de documento' && (await T('sf-evidence-list').innerText()) === 'Sin evidencias cargadas.' && await val('sf-detail-plates') === '' && await val('sf-description') === 'Suministro de agua');

    // ---- Estados de error ----
    await page.route('**/api/v1/services/new-request/contracting', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICES_UNAVAILABLE', message: 'No se pudieron consultar proveedores y órdenes de compra.' } }) }));
    await toService('transporte', c0);
    check('error de proveedores/OC (503) → mensaje seguro y Reintentar; el formulario sigue disponible', (await T('sf-load-error').innerText()).includes('No se pudieron consultar proveedores y órdenes de compra.') && await T('sf-type').isEnabled());
    await page.unroute('**/api/v1/services/new-request/contracting');
    await T('sf-retry').click();
    await page.waitForFunction(() => !document.querySelector('[data-testid=sf-load-error]'));
    check('Reintentar carga proveedores y OC', true);

    // ---- Gestionar contratación / OC ----
    await T('sf-requires').selectOption('yes');
    await T('sf-manage').click();
    await page.waitForTimeout(500);
    await page.getByText('Emisión de orden de compra').first().waitFor({ timeout: 10000 });
    check('🛒 Gestionar contratación / OC lleva a Órdenes de Compra', !(await T('service-form').count()));

    // ---- Teléfono ----
    await page.setViewportSize({ width: 390, height: 844 });
    await toService('last_mile', c0);
    const fit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check('teléfono (390 px): Last Mile sin desplazamiento horizontal', fit && (await T('sf-details').innerText()).includes('Fecha y hora de entrega'));
    await shot(page, 'sf-phone');

    check('ninguna escritura enviada (solo GET)', writes.length === 0, writes.join(', '));
    check('sin errores de JavaScript', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 300));
  } catch (e) {
    check('ejecución sin excepciones', false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nNuevo servicio (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
