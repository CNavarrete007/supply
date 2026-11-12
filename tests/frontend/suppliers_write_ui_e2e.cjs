// Proveedores · E2E de ESCRITURA desde la interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Crea y edita
// proveedores QA-UIP-*: úsese SOLO en la base desechable (exige SF_SYNTHETIC_WRITES=1). Solo se permiten POST/PUT a
// /api/v1/catalogs/suppliers (y login/logout); cualquier otra escritura se aborta y hace fallar la prueba.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/suppliers_write_ui_e2e.cjs
const { chromium } = require('playwright');
const zlib = require('zlib');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const RUN = Math.random().toString(36).slice(2, 7).toUpperCase();
const wait = ms => new Promise(r => setTimeout(r, ms));

function png(w, h, [r, g, b]) {
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())])));
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = table[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = []; const blocked = [];
  await context.route('**/api/**', route => {
    const r = route.request(); const path = new URL(r.url()).pathname;
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(path)) return route.continue();
    if ((r.method() === 'POST' && path === '/api/v1/catalogs/suppliers') || (r.method() === 'PUT' && /^\/api\/v1\/catalogs\/suppliers\/[0-9a-f-]{36}$/.test(path))) { writes.push(`${r.method()} ${path}`); return route.continue(); }
    blocked.push(`${r.method()} ${path}`); return route.abort('blockedbyclient');
  });
  const api = async p => (await page.request.get(UI + p)).json();
  const lbl = (l, exact = true) => page.getByLabel(l, { exact });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    await page.locator('nav button').filter({ hasText: /Proveedores$/ }).click();
    await page.getByRole('button', { name: /Nuevo proveedor/ }).first().click();
    const form = page.getByTestId('supplier-form'); await form.waitFor();
    const status = () => page.getByTestId('autosave-status').innerText();
    check('"Nuevo proveedor" abre la ficha en modo alta con valores del diseño', (await page.getByTestId('form-mode').innerText()).includes('Nuevo registro') && await lbl('Estatus').inputValue() === 'under_evaluation' && await lbl('Moneda habitual').inputValue() === 'MXN'
      && await lbl('Tipo de crédito habitual').inputValue() === 'Contado' && await lbl('Unidad del tiempo de entrega').inputValue() === 'días hábiles' && await lbl('Calificación inicial').inputValue() === '80');
    check('opciones de los selectores según el diseño', (await lbl('Estatus').locator('option').allTextContents()).join('|') === 'En evaluación|Autorizado|Suspendido|Inactivo'
      && (await lbl('Tipo de crédito habitual').locator('option').allTextContents()).join('|') === 'Contado|Anticipo|Crédito|Contra entrega|Parcialidades|Consignación|Otro'
      && (await lbl('Moneda habitual').locator('option').allTextContents()).join('|') === 'MXN|USD|EUR' && (await lbl('Unidad del tiempo de entrega').locator('option').allTextContents()).join('|') === 'Días hábiles|Días naturales|Semanas|Meses');
    check('indicador explica cuándo inicia el guardado automático', (await status()).includes('No. de proveedor, razón social y categoría'));

    const before = writes.length;
    await page.getByRole('button', { name: 'Guardar proveedor' }).click();
    const errs = await form.locator('p[role=alert]').allTextContents();
    check('obligatorios marcados sin enviar al servidor', writes.length === before && ['El número de proveedor es obligatorio.', 'La razón social es obligatoria.', 'La categoría es obligatoria.'].every(x => errs.includes(x)), errs.join(' | '));

    const code = `QA-UIP-${RUN}`;
    await lbl('Correos electrónicos 1').fill('no-es-correo'); // bloquea el guardado automático mientras se captura
    await lbl('No. de proveedor').fill(code);
    await lbl('Razón social').fill(`Proveedor UI ${RUN}`);
    await lbl('RFC').fill('XEXX010101000');
    await lbl('Clave').fill(`CLV-${RUN}`);
    await lbl('Contactos 1').fill('Rosa UI');
    await page.getByRole('button', { name: 'Agregar otro contacto' }).click();
    await lbl('Contactos 2').fill('Iván UI');
    await lbl('Teléfonos 1').fill('81-1000-2000');
    await page.getByRole('button', { name: 'Agregar otro teléfono' }).click();
    await lbl('Teléfonos 2').fill('81-3000-4000');
    await lbl('Categoría').fill('Materiales');
    await lbl('Moneda habitual').selectOption('USD');
    await lbl('Tipo de crédito habitual').selectOption('Crédito');
    await lbl('Días de crédito').fill('30');
    await lbl('Tiempo de entrega habitual').fill('5');
    await lbl('Unidad del tiempo de entrega').selectOption('semanas');
    await lbl('Calificación inicial').fill('85');
    await lbl('Documentos / certificaciones').fill('ISO 9001 vigente');
    await lbl('Observaciones').fill('Alta desde la interfaz (sintética)');
    await page.locator('#supplier-logo-file').setInputFiles({ name: 'logo-prov.png', mimeType: 'image/png', buffer: png(600, 200, [16, 185, 129]) });
    await page.getByTestId('logo-box').locator('img').waitFor();
    check('logotipo elegido: vista previa y compresión', /logo-prov\.(webp|png) · \d+ KB/.test(await page.getByTestId('logo-name').innerText()));
    await wait(2200);
    check('correo inválido: nada se guarda automáticamente', writes.length === before && (await status()).includes('Corrige los campos marcados'), await status());
    const post = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/v1\/catalogs\/suppliers$/.test(r.url()));
    await lbl('Correos electrónicos 1').fill('rosa@ui.invalid');
    const pr = await post;
    check('alta automática: POST 201 sin pulsar Guardar', pr.status() === 201, String(pr.status()));
    const created = await pr.json();
    await page.getByTestId('form-mode').filter({ hasText: `Editando ${code} · v1` }).waitFor();
    await page.getByTestId('autosave-status').filter({ hasText: 'Guardado automáticamente en la matriz · versión 1' }).waitFor();
    check('mensaje de alta e indicador "guardado automáticamente"', (await page.getByTestId('save-message').innerText()).includes(`Proveedor ${code} dado de alta en MariaDB y agregado a la matriz.`));
    const d1 = (await api(`/api/v1/catalogs/suppliers/${created.id}`)).item;
    check('MariaDB: datos guardados', d1.code === code && d1.name === `Proveedor UI ${RUN}` && d1.supplier_key === `CLV-${RUN}` && d1.tax_id === 'XEXX010101000' && d1.category === 'Materiales' && d1.status === 'under_evaluation' && d1.currency === 'USD', JSON.stringify(d1).slice(0, 300));
    check('MariaDB: crédito, entrega, calificación y documentos', d1.credit_type === 'Crédito' && Number(d1.credit_days) === 30 && Number(d1.lead_time_value) === 5 && d1.lead_time_unit === 'semanas' && Number(d1.rating) === 85 && String(d1.rating_scale) === '100' && d1.document_notes === 'ISO 9001 vigente');
    check('MariaDB: contactos, correos y teléfonos', d1.contacts.map(c => c.name).join() === 'Rosa UI,Iván UI' && d1.channels.filter(c => c.type === 'email').map(c => c.value).join() === 'rosa@ui.invalid' && d1.channels.filter(c => c.type === 'phone').map(c => c.value).join() === '81-1000-2000,81-3000-4000');
    const logo = await page.request.get(UI + `/api/v1/catalogs/suppliers/${created.id}/logo`);
    check('logotipo guardado y servido como imagen', logo.status() === 200 && /^image\/(webp|png)$/.test(logo.headers()['content-type']));
    await wait(2000);
    check('sin cambios nuevos no hay más escrituras', writes.length === before + 1, writes.join(', '));

    // Edición automática (ráfaga de cambios = una sola actualización)
    const put = page.waitForResponse(r => r.request().method() === 'PUT');
    await lbl('Razón social').fill(`Proveedor UI ${RUN} editado`);
    await lbl('Estatus').selectOption('authorized');
    await page.getByRole('button', { name: 'Quitar Contactos 1' }).click();
    await lbl('Tipo de crédito habitual').selectOption('Parcialidades');
    const ur = await put;
    check('edición automática: PUT 200 con If-Match "1"', ur.status() === 200 && ur.request().headers()['if-match'] === '"1"');
    await page.getByTestId('form-mode').filter({ hasText: `Editando ${code} · v2` }).waitFor();
    await wait(1800);
    check('una ráfaga de cambios = una sola actualización', writes.filter(w => w.startsWith('PUT')).length === 1, writes.join(', '));
    const d2 = (await api(`/api/v1/catalogs/suppliers/${created.id}`)).item;
    check('MariaDB: edición aplicada', d2.name.endsWith('editado') && d2.status === 'authorized' && d2.contacts.map(c => c.name).join() === 'Iván UI' && d2.credit_type === 'Parcialidades');

    // Matriz sincronizada
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    await page.getByTestId('last-saved').waitFor();
    check('matriz: aviso del último guardado', (await page.getByTestId('last-saved').innerText()).includes(code));
    await page.getByTestId('last-saved').getByRole('button', { name: 'Mostrar en la matriz' }).click();
    const row = page.locator('tr[data-saved="true"]'); await row.waitFor();
    const rowTxt = (await row.innerText()).replace(/\s+/g, ' ');
    check('matriz: fila actualizada y resaltada', rowTxt.includes(`Proveedor UI ${RUN} editado`) && rowTxt.includes('Autorizado') && rowTxt.includes('Recién guardado') && rowTxt.includes('Parcialidades'), rowTxt);
    await shot(page, 'proveedores_w1_matriz');
    await page.getByTestId('last-saved').getByRole('button', { name: 'Abrir ficha' }).click();
    await form.waitFor();

    // Guardar al instante, sin cambios
    await lbl('Observaciones').fill('Cambio con guardado inmediato');
    const put2 = page.waitForResponse(r => r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Guardar proveedor' }).click();
    check('"Guardar proveedor" guarda al instante (PUT 200)', (await put2).status() === 200);
    await page.getByTestId('form-mode').filter({ hasText: 'v3' }).waitFor();
    const n3 = writes.length;
    await page.getByRole('button', { name: 'Guardar proveedor' }).click();
    await page.getByTestId('save-message').filter({ hasText: 'Sin cambios pendientes' }).waitFor();
    check('sin cambios: "Guardar proveedor" lo indica sin escribir', writes.length === n3);

    // Conflicto: otra sesión guarda primero
    const token = (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token;
    const other = await page.request.put(UI + `/api/v1/catalogs/suppliers/${created.id}`, { headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': token, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': '"3"' },
      data: { code, name: `Proveedor UI ${RUN} (otra sesión)`, category: 'Materiales', status: 'suspended', contacts: [], emails: [], phones: [] } });
    check('otra sesión guarda v4', other.status() === 200);
    const conflict = page.waitForResponse(r => r.request().method() === 'PUT' && r.request().headers()['if-match'] === '"3"');
    await lbl('Clave').fill(`CLV-${RUN}-B`);
    check('versión vieja → 412', (await conflict).status() === 412);
    await page.getByTestId('save-message').filter({ hasText: 'Otra persona modificó este proveedor' }).waitFor();
    const nc = writes.length;
    await lbl('Clave').fill(`CLV-${RUN}-C`); // otro cambio después del conflicto: no debe reintentar solo
    await wait(2200);
    check('conflicto: guardado automático en pausa (no reintenta solo)', writes.length === nc && (await status()).includes('en pausa'), await status());
    await page.getByRole('button', { name: 'Recargar ficha' }).click();
    await page.getByTestId('form-mode').filter({ hasText: 'v4' }).waitFor();
    check('"Recargar ficha" trae la versión vigente', (await lbl('Razón social').inputValue()).endsWith('(otra sesión)') && await lbl('Estatus').inputValue() === 'suspended');

    // Pie: tres botones; Limpiar guarda antes y deja la ficha vacía
    const footer = (await page.getByTestId('form-actions').getByRole('button').allInnerTexts()).map(t => t.replace(/[^\p{L} ]/gu, '').trim());
    check('pie de la ficha con tres botones', footer.join('|') === 'Guardar proveedor|Limpiar|Ver matriz', footer.join('|'));
    await lbl('Documentos / certificaciones').fill('Certificado actualizado');
    const put3 = page.waitForResponse(r => r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    check('"Limpiar" guarda primero lo pendiente', (await put3).status() === 200);
    await page.getByTestId('form-mode').filter({ hasText: 'Nuevo registro' }).waitFor();
    check('"Limpiar" deja el formulario vacío en modo alta', await lbl('No. de proveedor').inputValue() === '' && await lbl('Razón social').inputValue() === '' && await lbl('Documentos / certificaciones').inputValue() === '');
    check('MariaDB conserva lo guardado antes de limpiar', (await api(`/api/v1/catalogs/suppliers/${created.id}`)).item.document_notes === 'Certificado actualizado');

    // Número duplicado → 409; corregido → alta
    const dup = page.waitForResponse(r => r.request().method() === 'POST');
    await lbl('No. de proveedor').fill(code); await lbl('Razón social').fill('Duplicado UI'); await lbl('Categoría').fill('Servicios');
    check('número duplicado → 409', (await dup).status() === 409);
    await page.getByTestId('save-message').filter({ hasText: 'Ese número de proveedor ya está registrado' }).waitFor();
    check('campo de número marcado', (await form.innerText()).includes('Número ya registrado.'));
    const ok2 = page.waitForResponse(r => r.request().method() === 'POST');
    await lbl('No. de proveedor').fill(`${code}-2`);
    check('número corregido → alta automática 201', (await ok2).status() === 201);
    await page.getByTestId('form-mode').filter({ hasText: `Editando ${code}-2 · v1` }).waitFor();
    await lbl('Categoría').fill('Categoría nueva QA');
    const put4 = page.waitForResponse(r => r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    check('"Ver matriz" guarda primero lo pendiente', (await put4).status() === 200);
    await page.getByLabel('Buscar en catálogo').fill(`${code}-2`);
    await page.getByRole('row').filter({ hasText: `${code}-2` }).first().waitFor();
    check('matriz refleja el segundo proveedor con su categoría nueva', (await page.getByRole('row').filter({ hasText: `${code}-2` }).first().innerText()).includes('Categoría nueva QA'));
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('ninguna otra escritura /api intentada', blocked.length === 0, blocked.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? `  → ${d}` : ''}`);
  console.log(`\nProveedores · escritura UI: ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
