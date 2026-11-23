// Servicios Operativos · sección 2 "+ Nueva solicitud" · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta y se reporta. Valores esperados desde la API.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/new_service_request_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const today = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

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
  const modal = page.getByTestId('svc-new-modal');
  const open = async () => { await page.getByTestId('services-tab-2').click(); await modal.waitFor(); };
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const catalogs = await api('/api/v1/recovery/catalogs');
    const types = (await api('/api/v1/services/new-request')).service_types;
    const reqs = (await api('/api/v1/recovery/matrix')).items;
    const c0 = catalogs.clients.find(c => c.code && c.contact && c.email && c.project && c.status === 'active');

    // ---- Paso 1 · Operación ----
    await page.locator('nav button').filter({ hasText: /Servicios Operativos$/ }).click();
    await page.getByTestId('services-tab-2').waitFor();
    const before = await page.getByTestId('services-notice').innerText();
    const loads = Promise.all([page.waitForResponse(r => r.url().endsWith('/api/v1/recovery/catalogs')), page.waitForResponse(r => r.url().endsWith('/api/v1/services/new-request'))]);
    await open();
    const [rc, rt] = await loads;
    check('abre como modal y consulta clientes y tipos de MariaDB (200)', rc.status() === 200 && rt.status() === 200 && await page.getByTestId('svc-new-overlay').isVisible());
    const m1 = flat(await modal.innerText());
    check('encabezado, explicación y 3 pasos del diseño', ['+ Nueva solicitud', 'Define el tipo de operación. Para un servicio, crea primero la requisición maestra y después completa su expediente operativo.', '1 · Operación', '2 · Servicio', '3 · Requisición'].every(x => m1.includes(x)), m1.slice(0, 300));
    check('paso 1 activo; Compra / renta preseleccionada con "✓ Seleccionado"', await page.getByTestId('svc-step-1').getAttribute('aria-current') === 'step'
      && await page.getByTestId('svc-op-purchase').getAttribute('aria-checked') === 'true' && (await page.getByTestId('svc-op-purchase').innerText()).includes('✓ Seleccionado'));
    check('textos de Compra / renta y Servicio', m1.includes('Continúa al flujo actual: requisición, cotización, comparativo, aprobación, OC, recepción, entrega y factura.') && m1.includes('Agua, transporte, Rise X, grúa, montacargas, gasolina, Last Mile u otro servicio operativo/administrativo.'));
    check('pestaña "Nueva solicitud" resaltada mientras el modal está abierto; la sección de fondo no cambia', (await page.getByTestId('services-tab-2').getAttribute('class')).includes('from-blue-600') && (await page.getByTestId('services-notice').innerText()) === before);
    await shot(page, 'nsr-step1');
    await page.getByTestId('svc-new-next').click();
    await page.waitForTimeout(400);
    check('Compra / renta → Continuar: cierra y lleva a Solicitud / Requisición (flujo actual)', !(await modal.count()) && (await page.locator('main, body').first().innerText()).includes('Registro de requisición'));

    await page.locator('nav button').filter({ hasText: /Servicios Operativos$/ }).click();
    await open();
    await page.getByTestId('svc-new-close').click();
    check('× cierra el modal', !(await modal.count()));
    await open();
    await page.keyboard.press('Escape');
    check('Escape cierra el modal', !(await modal.count()));
    await open();
    await page.getByTestId('svc-new-back').click();
    check('← Atrás en el paso 1 cierra el modal', !(await modal.count()));

    // ---- Paso 2 · Servicio ----
    await open();
    await page.getByTestId('svc-op-service').click();
    check('Servicio queda seleccionado (una sola opción)', await page.getByTestId('svc-op-service').getAttribute('aria-checked') === 'true' && await page.getByTestId('svc-op-purchase').getAttribute('aria-checked') === 'false');
    await page.getByTestId('svc-new-next').click();
    await page.getByTestId('svc-new-step2').waitFor();
    const opts = await page.getByTestId('svc-service-option').allInnerTexts();
    const nine = ['Suministro de agua', 'Transporte', 'Transporte de personal', 'Gestión Rise X', 'Servicio de grúa', 'Montacargas', 'Recarga de gasolina', 'Last Mile Deliveries', 'Otro servicio'];
    check('"¿Qué servicio realizará?" con los 9 servicios del original en orden', (await modal.innerText()).includes('¿Qué servicio realizará?') && nine.every((x, i) => flat(opts[i]).endsWith(x)), opts.map(flat).join(' | '));
    const extra = types.filter(t => t.active && !nine.some(n => n.localeCompare(t.name, 'es', { sensitivity: 'base' }) === 0)).length;
    check('más los tipos activos adicionales de service_types', opts.length === 9 + extra, `${opts.length} vs ${9 + extra}`);
    check('ninguno preseleccionado', (await page.locator('[data-testid=svc-service-option][aria-checked=true]').count()) === 0);
    await page.getByTestId('svc-new-next').click();
    check('Continuar sin servicio → "Selecciona el servicio que se realizará."', (await page.getByTestId('svc-new-error').innerText()).includes('Selecciona el servicio que se realizará.'));
    await shot(page, 'nsr-step2');
    await page.locator('[data-testid=svc-service-option][data-key=transporte]').click();
    check('seleccionar Transporte quita el error y marca "✓ Seleccionado"', !(await page.getByTestId('svc-new-error').count()) && (await page.locator('[data-testid=svc-service-option][data-key=transporte]').innerText()).includes('✓ Seleccionado'));
    await page.getByTestId('svc-step-1').click();
    check('la píldora de un paso anterior regresa a ese paso', await page.getByTestId('svc-new-step1').isVisible());
    await page.getByTestId('svc-new-next').click();
    check('la selección del servicio se conserva al volver', await page.locator('[data-testid=svc-service-option][data-key=transporte]').getAttribute('aria-checked') === 'true');
    await page.getByTestId('svc-new-next').click();

    // ---- Paso 3 · Requisición ----
    await page.getByTestId('svc-new-step3').waitFor();
    const m3 = flat(await modal.innerText());
    check('título, nota "Una sola requisición maestra" y nota de Autorización comercial', ['Crear y vincular la requisición del servicio', 'Una sola requisición maestra: el Folio / requisición del cliente y la Referencia interna, sean capturados o generados aquí, se guardarán en Solicitud / Requisición → Matriz de requisiciones y quedarán vinculados al expediente de Servicios Operativos → Matriz. No se crea una requisición duplicada.', 'Autorización comercial: PO, Orden de Servicio, contrato, correo, portal o emergencia se podrá registrar después dentro del expediente del servicio cuando exista.'].every(x => m3.includes(x)), m3.slice(0, 400));
    check('campos del diseño (obligatorios con *)', ['Cliente *', 'Folio / requisición del cliente *', 'Referencia interna', 'Proyecto *', 'Contrato / referencia contractual', 'Fecha de solicitud *', 'Fecha requerida', 'Solicitante del cliente *', 'Correo del solicitante *', 'Lugar de prestación / entrega', 'Descripción / alcance del servicio'].every(x => m3.includes(x)));
    check('fecha de solicitud = hoy por omisión; el resto vacío', await page.getByTestId('svc-request_date').inputValue() === today() && await page.getByTestId('svc-folio').inputValue() === '' && await page.getByTestId('svc-project').inputValue() === '');
    check('ayudas de folio y referencia', m3.includes('Si el cliente ya proporcionó un folio, captúralo manualmente. Si no existe, puedes generarlo y será el mismo número en Solicitud / Requisición.') && m3.includes('Referencia interna de seguimiento. Se guardará en la requisición maestra y se propagará a los documentos relacionados.'));
    await shot(page, 'nsr-step3');
    await page.getByTestId('svc-gen-folio').click();
    check('⚙ Generar folio sin cliente → "Primero selecciona un cliente."', (await page.getByTestId('svc-new-error').innerText()).includes('Primero selecciona un cliente.'));
    await page.getByTestId('svc-new-submit').click();
    check('Crear sin cliente → error en Cliente (campo marcado)', (await page.getByTestId('svc-new-error').innerText()).includes('Selecciona el cliente.') && (await page.getByTestId('svc-client').getAttribute('class')).includes('border-rose-400'));

    await page.getByTestId('svc-client').click();
    const count = await page.getByTestId('svc-client-count').innerText();
    check('selector: búsqueda y "Mostrando N de N · escribe para filtrar" con los clientes reales', count === `Mostrando ${catalogs.clients.length} de ${catalogs.clients.length} · escribe para filtrar`
      && await page.getByTestId('svc-client-search').getAttribute('placeholder') === 'Buscar por número, razón social, RFC o nombre...', count);
    const labels = await page.getByTestId('svc-client-option').allInnerTexts();
    check('opciones "NÚMERO · RAZÓN SOCIAL"', labels.includes(`${c0.code} · ${c0.name}`) && labels.length === catalogs.clients.length);
    await shot(page, 'nsr-picker');
    await page.getByTestId('svc-client-search').fill(c0.code);
    const filtered = await page.getByTestId('svc-client-option').allInnerTexts();
    check('filtra por número de cliente', filtered.length >= 1 && filtered.every(l => l.toLowerCase().includes(c0.code.toLowerCase())) && (await page.getByTestId('svc-client-count').innerText()).startsWith(`Mostrando ${filtered.length} de`));
    await page.getByTestId('svc-client-search').fill('zz-sin-coincidencias-zz');
    check('sin coincidencias → "Sin clientes que coincidan."', (await page.getByTestId('svc-client-menu').innerText()).includes('Sin clientes que coincidan.'));
    await page.getByTestId('svc-client-search').fill(c0.name);
    await page.getByTestId('svc-client-option').filter({ hasText: `${c0.code} · ${c0.name}` }).first().click();
    check('cliente elegido; precarga proyecto, contrato, solicitante y correo de su ficha', (await page.getByTestId('svc-client').innerText()).includes(`${c0.code} · ${c0.name}`)
      && await page.getByTestId('svc-project').inputValue() === c0.project && await page.getByTestId('svc-contract').inputValue() === (c0.contract || '')
      && await page.getByTestId('svc-requester_name').inputValue() === c0.contact && await page.getByTestId('svc-requester_email').inputValue() === c0.email);

    const expFolio = (await api(`/api/v1/recovery/folio?client_id=${c0.id}&date=${today()}&mode=formal`)).folio;
    await page.getByTestId('svc-gen-folio').click();
    await page.waitForFunction(() => document.querySelector('[data-testid=svc-folio]').value !== '');
    const folio = await page.getByTestId('svc-folio').inputValue();
    check('⚙ Generar folio = regla vigente NÚMERO-REQ-AÑO-0000 de Solicitud / Requisición', folio === expFolio && folio.startsWith(`${c0.code.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-REQ-${today().slice(0, 4)}-`), `${folio} vs ${expFolio}`);
    await page.getByTestId('svc-project').fill('Plataforma Ñandú 7');
    const expRef = (await api(`/api/v1/services/new-request/reference?project=${encodeURIComponent('Plataforma Ñandú 7')}&date=${today()}`)).reference;
    await page.getByTestId('svc-gen-reference').click();
    await page.waitForFunction(() => document.querySelector('[data-testid=svc-reference]').value !== '');
    const ref = await page.getByTestId('svc-reference').inputValue();
    check('⚙ Generar referencia = SRV-PROYECTO-AÑO-0000 (sin acentos, desde MariaDB)', ref === expRef && ref.startsWith(`SRV-PLATAFORMA-NANDU-7-${today().slice(0, 4)}-`), `${ref} vs ${expRef}`);

    await page.getByTestId('svc-requester_email').fill('correo-invalido');
    await page.getByTestId('svc-new-submit').click();
    check('correo inválido → error y campo marcado; no se consulta disponibilidad', (await page.getByTestId('svc-new-error').innerText()).includes('Captura un correo válido del solicitante.') && await page.getByTestId('svc-requester_email').getAttribute('aria-invalid') === 'true');
    await page.getByTestId('svc-requester_email').fill(c0.email);
    check('corregir el campo quita el error', !(await page.getByTestId('svc-new-error').count()));

    const dup = reqs[0].folio;
    await page.getByTestId('svc-folio').fill(dup);
    const av = page.waitForResponse(r => r.url().includes('/api/v1/services/new-request/availability'));
    await page.getByTestId('svc-new-submit').click();
    check('folio existente → disponibilidad consultada (200) y bloqueo "ya existe en Solicitud / Requisición"', (await av).status() === 200 && (await page.getByTestId('svc-new-error').innerText()).includes(`El folio ${dup} ya existe en Solicitud / Requisición`));

    await page.getByTestId('svc-folio').fill(folio);
    await page.getByTestId('svc-need_date').fill('2000-01-01');
    await page.getByTestId('svc-place').fill('Muelle 3, terminal QA');
    await page.getByTestId('svc-new-submit').click();
    await page.getByTestId('service-form').waitFor();
    check('Crear requisición y continuar → cierra el modal y redirige a "Nuevo servicio"', !(await modal.count()) && (await page.getByTestId('service-form').innerText()).includes('Nuevo servicio'));
    const link = flat(await page.getByTestId('sf-link-note').innerText());
    check('la requisición queda validada, no creada (escritura bloqueada) y conserva el aviso no bloqueante', link.includes(`Requisición ${folio} validada, no creada.`) && link.includes('no se guardará en MariaDB') && link.includes('La fecha requerida es anterior a la fecha de solicitud.'), link.slice(0, 300));
    check('el formulario hereda requisición, referencia, tipo, cliente, proyecto, fechas y descripción', await page.getByTestId('sf-requisition').inputValue() === folio && await page.getByTestId('sf-reference').inputValue() === ref
      && await page.getByTestId('sf-type').inputValue() === 'transporte' && await page.getByTestId('sf-client_id').inputValue() === c0.id && await page.getByTestId('sf-project').inputValue() === 'Plataforma Ñandú 7'
      && await page.getByTestId('sf-request_date').inputValue() === today() && await page.getByTestId('sf-need_date').inputValue() === '2000-01-01' && await page.getByTestId('sf-description').inputValue() === 'Transporte');
    check('pestaña "Nueva solicitud" resaltada y aviso propio del expediente', (await page.getByTestId('services-tab-2').getAttribute('class')).includes('from-blue-600') && (await page.getByTestId('services-notice').innerText()).includes('Nuevo servicio con datos reales de MariaDB'));
    await shot(page, 'nsr-redirect');
    await page.getByTestId('services-tab-3').click();
    await page.getByTestId('service-matrix').waitFor();
    check('las demás secciones siguen disponibles desde las pestañas', !(await page.getByTestId('service-form').count()));

    // ---- Estados de error / reintento del catálogo ----
    await page.route('**/api/v1/services/new-request', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICES_UNAVAILABLE', message: 'No se pudo consultar el catálogo de servicios.' } }) }));
    await open();
    await page.getByTestId('svc-op-service').click(); await page.getByTestId('svc-new-next').click();
    await page.locator('[data-testid=svc-service-option][data-key=agua]').click(); await page.getByTestId('svc-new-next').click();
    check('error del catálogo (503) → mensaje seguro, Reintentar y "Crear" deshabilitado', (await page.getByTestId('svc-new-state').innerText()).includes('No se pudo consultar el catálogo de servicios.') && await page.getByTestId('svc-new-submit').isDisabled());
    await page.unroute('**/api/v1/services/new-request');
    await page.getByTestId('svc-new-retry').click();
    await page.getByTestId('svc-client').waitFor();
    check('Reintentar carga el formulario', await page.getByTestId('svc-new-submit').isEnabled());
    await page.keyboard.press('Escape');
    await page.route('**/api/v1/recovery/catalogs', r => r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_AUTHENTICATED', message: 'Inicia sesión para continuar.' } }) }));
    await open();
    await page.getByTestId('svc-op-service').click(); await page.getByTestId('svc-new-next').click();
    await page.locator('[data-testid=svc-service-option][data-key=agua]').click(); await page.getByTestId('svc-new-next').click();
    check('sesión expirada (401) → "Tu sesión expiró…" sin Reintentar', (await page.getByTestId('svc-new-state').innerText()).includes('Tu sesión expiró. Inicia sesión nuevamente.') && !(await page.getByTestId('svc-new-retry').count()));
    await page.unroute('**/api/v1/recovery/catalogs');
    await page.keyboard.press('Escape');

    // ---- Teléfono ----
    await page.setViewportSize({ width: 390, height: 844 });
    await open();
    await page.getByTestId('svc-op-service').click(); await page.getByTestId('svc-new-next').click();
    await page.locator('[data-testid=svc-service-option][data-key=grua]').click(); await page.getByTestId('svc-new-next').click();
    await page.getByTestId('svc-client').waitFor();
    const fit = await page.evaluate(() => { const m = document.querySelector('[data-testid=svc-new-modal]'); const o = document.querySelector('[data-testid=svc-new-overlay]'); return m.getBoundingClientRect().right <= window.innerWidth + 0.5 && o.scrollWidth <= o.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1; });
    check('teléfono (390 px): el modal cabe sin desplazamiento horizontal', fit);
    await shot(page, 'nsr-phone');
    await page.keyboard.press('Escape');

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
  console.log(`\nNueva solicitud (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
