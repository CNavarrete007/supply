// Suministros de proveedores · E2E de ESCRITURA desde la interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Crea un proveedor sintético propio (QA-SINT-UO-*) por API y registra/edita sus suministros desde la pantalla: úsese
// SOLO en la base desechable (exige SF_SYNTHETIC_WRITES=1). Desde la interfaz solo se permiten POST/PUT a
// /api/v1/catalogs/supplier-offerings (y login/logout); cualquier otra escritura se aborta y hace fallar la prueba.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/supplies_write_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const RUN = Math.random().toString(36).slice(2, 7).toUpperCase();
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = []; const blocked = [];
  await context.route('**/api/**', route => {
    const r = route.request(); const path = new URL(r.url()).pathname;
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(path)) return route.continue();
    if ((r.method() === 'POST' && path === '/api/v1/catalogs/supplier-offerings') || (r.method() === 'PUT' && /^\/api\/v1\/catalogs\/supplier-offerings\/[0-9a-f-]{36}$/.test(path))) { writes.push(`${r.method()} ${path}`); return route.continue(); }
    blocked.push(`${r.method()} ${path}`); return route.abort('blockedbyclient');
  });
  const api = async p => (await page.request.get(UI + p)).json();
  const lbl = (l, exact = true) => page.getByLabel(l, { exact });
  const csrf = async () => (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token;
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    // Proveedor sintético propio (por API, fuera de la interfaz)
    const supCode = `QA-SINT-UO-${RUN}`;
    const sp = await page.request.post(UI + '/api/v1/catalogs/suppliers', { headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': await csrf(), 'Idempotency-Key': crypto.randomUUID() },
      data: { code: supCode, name: `Grúas Sintéticas ${RUN}`, category: 'Servicios', status: 'authorized' } });
    const supplierId = (await sp.json()).id;
    check('proveedor sintético de la prueba creado', sp.status() === 201 && !!supplierId, String(sp.status()));

    await page.locator('nav button').filter({ hasText: /Suministros de proveedores$/ }).click();
    await page.getByRole('button', { name: /Nuevo suministro/ }).click();
    const form = page.getByTestId('offering-form'); await form.waitFor();
    const status = () => page.getByTestId('autosave-status').innerText();
    check('"Nuevo suministro" abre la ficha en modo alta con valores del diseño', (await page.getByTestId('form-mode').innerText()).includes('Nuevo registro') && await lbl('Tipo').inputValue() === 'product' && await lbl('Categoría').inputValue() === 'Materiales'
      && await lbl('Unidad del tiempo').inputValue() === 'días hábiles' && await lbl('Tipo de crédito').inputValue() === 'Contado' && await lbl('Moneda').inputValue() === 'MXN' && await lbl('Cobertura / lugar de entrega').inputValue() === 'Nacional' && await lbl('Estatus').inputValue() === 'active');
    const opts = async l => (await lbl(l).locator('option').allTextContents()).join('|');
    check('opciones de Tipo, Unidad, Crédito y Estatus según el diseño', await opts('Tipo') === 'Producto|Servicio|Renta|Consumible|Refacción|Equipo|Almacenamiento|Herramienta|Otro/agregar nuevo tipo'
      && await opts('Unidad del tiempo') === 'Días hábiles|Días naturales|Semanas|Meses' && await opts('Tipo de crédito') === 'Contado|Anticipo|Crédito|Contra entrega|Parcialidades|Consignación|Otros' && (await opts('Estatus')).startsWith('Activo'));
    check('categorías del diseño', ['Almacenamiento', 'Consumibles', 'EPP y seguridad', 'Equipos', 'Herramientas', 'Materiales', 'Refacciones', 'Renta de equipo', 'Servicios', 'Tecnología y comunicación', 'Transporte y logística', 'Otros'].every(c => opts('Categoría').then ? true : true) && (await opts('Categoría')).split('|').slice(1).join('|') === 'Almacenamiento|Consumibles|EPP y seguridad|Equipos|Herramientas|Materiales|Refacciones|Renta de equipo|Servicios|Tecnología y comunicación|Transporte y logística|Otros', await opts('Categoría'));
    check('banner: precios únicamente mediante cotización', await page.getByText(/Precios únicamente mediante cotización/).isVisible());
    const before = writes.length;
    await page.getByRole('button', { name: 'Guardar suministro' }).click();
    const errs = await form.locator('p[role=alert]').allTextContents();
    check('obligatorios marcados sin enviar al servidor', writes.length === before && ['Selecciona el proveedor.', 'Captura el producto, servicio o suministro.'].every(x => errs.includes(x)), errs.join(' | '));

    // Captura: el nombre al final (antes, el formulario está incompleto y no se guarda)
    await lbl('Proveedor').selectOption(supplierId);
    await lbl('Tipo').selectOption('__other__');
    await lbl('Nuevo tipo').fill('Grúa titán');
    await lbl('Categoría').selectOption('Transporte y logística');
    await lbl('Marca').fill('MarcaQA'); await lbl('Modelo / referencia').fill('GT-80');
    await lbl('Descripción / alcance / especificación').fill('Servicio de grúa titán 80 t con operador');
    await lbl('Tiempo de entrega').fill('3'); await lbl('Unidad del tiempo').selectOption('semanas');
    await lbl('Tipo de crédito').selectOption('Crédito'); await lbl('Días de crédito').fill('45');
    await lbl('Moneda').selectOption('USD'); await lbl('Pedido mínimo').fill('1 servicio'); await lbl('Vigencia de condiciones').fill('2027-03-31');
    await lbl('Cobertura / lugar de entrega').fill('Tamaulipas'); await lbl('Observaciones comerciales').fill('Alta desde la interfaz (sintética)');
    await wait(1800);
    check('incompleto: nada se guarda y el indicador pide lo que falta', writes.length === before && (await status()).includes('producto, servicio o suministro'), await status());
    const post = page.waitForResponse(r => r.request().method() === 'POST' && /supplier-offerings$/.test(r.url()));
    const name = `QA-UI-S-${RUN} Grúa 80 t`;
    await lbl('Producto, servicio o suministro').fill(name);
    const pr = await post;
    check('alta automática: POST 201 sin pulsar Guardar', pr.status() === 201, String(pr.status()));
    const created = await pr.json();
    await page.getByTestId('form-mode').filter({ hasText: `Editando · ${name}` }).waitFor();
    await page.getByTestId('autosave-status').filter({ hasText: 'Guardado automáticamente en la matriz' }).waitFor();
    check('mensaje de alta', (await page.getByTestId('save-message').innerText()).includes(`Suministro "${name}" registrado en MariaDB y agregado a la matriz.`));
    const d1 = (await api(`/api/v1/catalogs/supplier-offerings/${created.id}`)).item;
    check('MariaDB: datos guardados (tipo nuevo y categoría del diseño como texto)', d1.supplier_id === supplierId && d1.name === name && d1.type === 'Grúa titán' && d1.category === 'Transporte y logística' && d1.brand === 'MarcaQA' && d1.model === 'GT-80' && d1.description.startsWith('Servicio de grúa'), JSON.stringify(d1).slice(0, 300));
    check('MariaDB: condiciones comerciales sin precios', Number(d1.lead_time_value) === 3 && d1.lead_time_unit === 'semanas' && d1.credit_type === 'Crédito' && d1.credit_days === 45 && d1.currency === 'USD' && d1.minimum_order === '1 servicio' && d1.valid_until === '2027-03-31' && d1.coverage === 'Tamaulipas' && d1.status === 'active' && !Object.keys(d1).some(k => /price/.test(k)));
    await wait(1800);
    check('sin cambios nuevos no hay más escrituras', writes.length === before + 1, writes.join(', '));

    // Edición automática (ráfaga = una actualización)
    const put = page.waitForResponse(r => r.request().method() === 'PUT');
    await lbl('Estatus').selectOption('unavailable');
    await lbl('Tipo de crédito').selectOption('Otros');
    await lbl('Días de crédito').fill('');
    const ur = await put;
    check('edición automática: PUT 200 con If-Match de la versión', ur.status() === 200 && ur.request().headers()['if-match'] === `"${created.version}"`);
    await wait(1800);
    check('una ráfaga de cambios = una sola actualización', writes.filter(w => w.startsWith('PUT')).length === 1, writes.join(', '));
    const d2 = (await api(`/api/v1/catalogs/supplier-offerings/${created.id}`)).item;
    check('MariaDB: edición aplicada', d2.status === 'unavailable' && d2.credit_type === 'Otros' && d2.credit_days === null && d2.version > d1.version);

    // Matriz sincronizada
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    await page.getByTestId('last-saved').waitFor();
    await page.getByTestId('last-saved').getByRole('button', { name: 'Mostrar en la matriz' }).click();
    const row = page.locator('tr[data-saved="true"]'); await row.waitFor();
    const rt = (await row.innerText()).replace(/\s+/g, ' ');
    check('matriz: fila actualizada y resaltada', rt.includes(name) && rt.includes('No disponible') && rt.includes('Recién guardado') && rt.includes(`Grúas Sintéticas ${RUN}`), rt);
    await shot(page, 'suministros_w1_matriz');
    await page.getByTestId('last-saved').getByRole('button', { name: 'Abrir ficha' }).click();
    await form.waitFor();
    await page.getByTestId('form-mode').filter({ hasText: name }).waitFor();

    // Guardar al instante; sin cambios
    await lbl('Observaciones comerciales').fill('Cambio con guardado inmediato');
    const put2 = page.waitForResponse(r => r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Guardar suministro' }).click();
    check('"Guardar suministro" guarda al instante (PUT 200)', (await put2).status() === 200);
    await page.getByTestId('autosave-status').filter({ hasText: 'Guardado automáticamente' }).waitFor();
    const n3 = writes.length;
    await page.getByRole('button', { name: 'Guardar suministro' }).click();
    await page.getByTestId('save-message').filter({ hasText: 'Sin cambios pendientes' }).waitFor();
    check('sin cambios: "Guardar suministro" lo indica sin escribir', writes.length === n3);

    // Conflicto: otra sesión guarda primero
    const cur = (await api(`/api/v1/catalogs/supplier-offerings/${created.id}`)).item;
    const other = await page.request.put(UI + `/api/v1/catalogs/supplier-offerings/${created.id}`, { headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': await csrf(), 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${cur.version}"` },
      data: { supplier_id: supplierId, name, type: 'service', category: 'Servicios', status: 'inactive', coverage: 'Nacional (otra sesión)' } });
    check('otra sesión guarda una versión nueva', other.status() === 200);
    const conflict = page.waitForResponse(r => r.request().method() === 'PUT' && r.request().headers()['if-match'] === `"${cur.version}"`);
    await lbl('Marca').fill('MarcaQA-B');
    check('versión vieja → 412', (await conflict).status() === 412);
    await page.getByTestId('save-message').filter({ hasText: 'Otra persona modificó este suministro' }).waitFor();
    const nc = writes.length;
    await lbl('Marca').fill('MarcaQA-C'); await wait(2200);
    check('conflicto: guardado automático en pausa (no reintenta solo)', writes.length === nc && (await status()).includes('en pausa'), await status());
    await page.getByRole('button', { name: 'Recargar ficha' }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Cobertura / lugar de entrega"]')?.value === 'Nacional (otra sesión)');
    check('"Recargar ficha" trae la versión vigente', await lbl('Estatus').inputValue() === 'inactive' && await lbl('Tipo').inputValue() === 'service');

    // Pie: tres botones; Limpiar guarda antes y deja la ficha vacía
    const footer = (await page.getByTestId('form-actions').getByRole('button').allInnerTexts()).map(t => t.replace(/[^\p{L} ]/gu, '').trim());
    check('pie de la ficha con tres botones', footer.join('|') === 'Guardar suministro|Limpiar|Ver matriz', footer.join('|'));
    await lbl('Pedido mínimo').fill('2 servicios');
    const put3 = page.waitForResponse(r => r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    check('"Limpiar" guarda primero lo pendiente', (await put3).status() === 200);
    await page.getByTestId('form-mode').filter({ hasText: 'Nuevo registro' }).waitFor();
    check('"Limpiar" deja el formulario vacío en modo alta', await lbl('Proveedor').inputValue() === '' && await lbl('Producto, servicio o suministro').inputValue() === '' && await lbl('Pedido mínimo').inputValue() === '');
    check('MariaDB conserva lo guardado antes de limpiar', (await api(`/api/v1/catalogs/supplier-offerings/${created.id}`)).item.minimum_order === '2 servicios');

    // Cargar un suministro registrado del proveedor; nombre repetido → 409
    await lbl('Proveedor').selectOption(supplierId);
    const loader = lbl('Cargar suministro registrado'); await loader.waitFor();
    check('selector de suministros registrados del proveedor', (await loader.locator('option').allTextContents()).some(t => t === name));
    const dup = page.waitForResponse(r => r.request().method() === 'POST');
    await lbl('Producto, servicio o suministro').fill(name);
    check('mismo nombre en el mismo proveedor → 409', (await dup).status() === 409);
    await page.getByTestId('save-message').filter({ hasText: 'ya tiene registrado ese producto' }).waitFor();
    await loader.selectOption({ label: name });
    await page.getByTestId('form-mode').filter({ hasText: `Editando · ${name}` }).waitFor();
    check('cargar el suministro registrado abre su ficha para editar', await lbl('Pedido mínimo').inputValue() === '2 servicios');
    await lbl('Cobertura / lugar de entrega').fill('Nacional y Texas');
    const put4 = page.waitForResponse(r => r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    check('"Ver matriz" guarda primero lo pendiente', (await put4).status() === 200);
    await page.getByLabel('Buscar suministros').fill(`QA-UI-S-${RUN}`);
    await page.getByRole('row').filter({ hasText: name }).first().waitFor();
    check('matriz refleja el último cambio', (await api(`/api/v1/catalogs/supplier-offerings/${created.id}`)).item.coverage === 'Nacional y Texas');
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('ninguna otra escritura /api intentada desde la interfaz', blocked.length === 0, blocked.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? `  → ${d}` : ''}`);
  console.log(`\nSuministros · escritura UI: ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
