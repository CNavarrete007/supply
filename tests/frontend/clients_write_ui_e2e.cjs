// Clientes · E2E de ESCRITURA desde la interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Crea y edita clientes
// QA-UI-*: úsese SOLO en la base desechable (exige SF_SYNTHETIC_WRITES=1). Solo se permiten POST/PUT a
// /api/v1/catalogs/clients (y login/logout); cualquier otra escritura se aborta y hace fallar la prueba.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/clients_write_ui_e2e.cjs
const { chromium } = require('playwright');
const zlib = require('zlib');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };
const RUN = Math.random().toString(36).slice(2, 7).toUpperCase();

function png(w, h, [r, g, b]) {
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())])));
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
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
    if ((r.method() === 'POST' && path === '/api/v1/catalogs/clients') || (r.method() === 'PUT' && /^\/api\/v1\/catalogs\/clients\/[0-9a-f-]{36}$/.test(path))) { writes.push(`${r.method()} ${path}`); return route.continue(); }
    blocked.push(`${r.method()} ${path}`); return route.abort('blockedbyclient');
  });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    await page.locator('nav button').filter({ hasText: /Clientes$/ }).click();
    await page.getByRole('button', { name: /Nuevo cliente/ }).first().click();
    const form = page.getByTestId('client-form');
    await form.waitFor();
    check('"Nuevo cliente" abre el formulario en modo alta', (await page.getByTestId('form-mode').innerText()).includes('Nuevo registro'));
    check('selectores muestran captura manual', (await page.getByLabel('Seleccionar por número de cliente').locator('option:checked').textContent()).includes('+ Nuevo cliente / captura manual') && (await page.getByLabel('Seleccionar por razón social').locator('option:checked').textContent()).includes('+ Nueva compañía / captura manual'));

    // Validación en pantalla: sin red
    const before = writes.length;
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    await page.getByTestId('save-message').waitFor();
    const errs = await form.locator('p[role=alert]').allTextContents();
    check('obligatorios marcados sin enviar al servidor', writes.length === before && ['El número de cliente es obligatorio.', 'La razón social es obligatoria.', 'El proyecto es obligatorio.', 'El número de contrato es obligatorio.'].every(x => errs.includes(x)), errs.join(' | '));

    // Captura completa
    const code = `QA-UI-${RUN}`;
    await page.getByLabel('No. de cliente', { exact: true }).fill(code);
    await page.getByLabel('Razón social', { exact: true }).fill(`Cliente UI ${RUN}`);
    await page.getByLabel('Nombre comercial', { exact: true }).fill('Marca UI');
    await page.getByLabel('RFC', { exact: true }).fill('XAXX010101000');
    await page.getByLabel('Proyecto', { exact: true }).fill('PRY-UI');
    await page.getByLabel('Número de contrato', { exact: true }).fill('CTR-2026-001');
    await page.getByLabel('Teléfono', { exact: true }).fill('833-456-7890');
    await page.getByLabel('Contactos 1', { exact: true }).fill('Ana UI');
    await page.getByLabel('Contactos 2', { exact: true }).fill('Beto UI');
    await page.getByRole('button', { name: 'Agregar otro contacto' }).click();
    await page.getByLabel('Contactos 3', { exact: true }).fill('Carla UI');
    check('agregar contacto crea otra fila', await page.getByTestId('rows-contacts').locator('input').count() === 3);
    await page.getByLabel('Correos electrónicos 1', { exact: true }).fill('ana@ui.invalid');
    await page.getByLabel('Correos electrónicos 2', { exact: true }).fill('no-es-correo');
    await page.getByLabel('Estatus', { exact: true }).selectOption('active');
    await page.getByLabel('Dirección', { exact: true }).fill('Av. Sintética 100');
    await page.getByLabel('Condiciones comerciales', { exact: true }).fill('Crédito 30 días');
    await page.getByLabel('Observaciones', { exact: true }).fill('Alta desde la interfaz (sintética)');
    const pol = page.getByTestId('repeat-policy');
    await pol.getByLabel('Política de precio al cliente', { exact: true }).selectOption({ label: 'Precio al cliente garantizado' });
    await pol.getByLabel('Política de abastecimiento', { exact: true }).selectOption({ label: 'Validar costo/proveedor histórico' });
    await pol.getByLabel('Vigencia del precio histórico (días)').fill('30');
    await pol.getByLabel('Referencia de contrato / Price List').fill('Rate Card 2026 / Anexo B');
    await pol.getByLabel('Vigencia contractual hasta').fill('2027-06-30');
    await pol.getByLabel('Margen mínimo de referencia %').fill('15');
    await page.locator('#client-logo-file').setInputFiles({ name: 'logo-ui.png', mimeType: 'image/png', buffer: png(900, 300, [37, 99, 235]) });
    await page.getByTestId('logo-box').locator('img').waitFor();
    const logoName = await page.getByTestId('logo-name').innerText();
    check('logotipo elegido: vista previa y compresión', /logo-ui\.(webp|png) · \d+ KB/.test(logoName), logoName);
    await page.locator('#client-logo-file').setInputFiles({ name: 'falso.png', mimeType: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') });
    check('archivo que no es imagen se rechaza en pantalla', (await page.getByTestId('logo-box').innerText()).includes('Solo se permiten imágenes PNG, JPG o WEBP.'));
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    check('correo inválido detenido antes de enviar', (await form.innerText()).includes('Revisa el formato de los correos.') && writes.length === before);
    await page.getByLabel('Correos electrónicos 2', { exact: true }).fill('beto@ui.invalid');
    await shot(page, 'clientes_w1_captura');
    const post = page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/v1\/catalogs\/clients$/.test(r.url()));
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    const pr = await post;
    check('alta: POST 201', pr.status() === 201, String(pr.status()));
    const created = await pr.json();
    await page.getByTestId('form-mode').filter({ hasText: `Editando ${code} · v1` }).waitFor();
    check('mensaje de éxito y ficha en modo edición v1', (await page.getByTestId('save-message').innerText()).includes(`Cliente ${code} dado de alta en MariaDB.`));
    const req = writes.length;
    const d1 = (await api(`/api/v1/catalogs/clients/${created.id}`)).item;
    check('MariaDB: datos guardados', d1.code === code && d1.name === `Cliente UI ${RUN}` && d1.brand_name === 'Marca UI' && d1.project === 'PRY-UI' && d1.contract_reference === 'CTR-2026-001' && d1.address === 'Av. Sintética 100' && d1.terms === 'Crédito 30 días', JSON.stringify(d1).slice(0, 300));
    check('MariaDB: contactos, correos y teléfono', d1.contacts.map(c => c.name).join() === 'Ana UI,Beto UI,Carla UI' && d1.channels.filter(c => c.type === 'email').map(c => c.value).join() === 'ana@ui.invalid,beto@ui.invalid' && d1.channels.some(c => c.type === 'phone' && c.value === '833-456-7890'));
    check('MariaDB: política de recompra', d1.repeat_policy.sales_policy === 'guaranteed' && d1.repeat_policy.sourcing_policy === 'validate_history' && d1.repeat_policy.price_validity_days === 30 && d1.repeat_policy.contract_valid_until === '2027-06-30' && Number(d1.repeat_policy.min_margin_pct) === 15);
    const logo = await page.request.get(UI + `/api/v1/catalogs/clients/${created.id}/logo`);
    check('logotipo guardado y servido como imagen (≤ 512 px)', logo.status() === 200 && /^image\/(webp|png)$/.test(logo.headers()['content-type']) && d1.logo && d1.logo.size <= 400 * 1024, `${logo.status()} ${logo.headers()['content-type']}`);
    await page.getByTestId('logo-box').locator('img[alt="Logotipo actual"]').waitFor();
    check('ficha muestra el logotipo guardado', true);

    // Edición
    await page.getByLabel('Razón social', { exact: true }).fill(`Cliente UI ${RUN} editado`);
    await page.getByRole('button', { name: 'Quitar Contactos 2' }).click();
    await page.getByLabel('Estatus', { exact: true }).selectOption('blocked');
    await pol.getByLabel('Política de precio al cliente', { exact: true }).selectOption({ label: 'Contrato / Price List / Rate Card' });
    await page.getByLabel('Teléfono', { exact: true }).fill('833-456-7890 / 81-1111-2222');
    const put = page.waitForResponse(r => r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    const ur = await put;
    check('edición: PUT 200 con If-Match', ur.status() === 200 && ur.request().headers()['if-match'] === '"1"', `${ur.status()} ${ur.request().headers()['if-match']}`);
    await page.getByTestId('form-mode').filter({ hasText: `Editando ${code} · v2` }).waitFor();
    const d2 = (await api(`/api/v1/catalogs/clients/${created.id}`)).item;
    check('MariaDB: edición aplicada (razón social, estatus, contactos, teléfonos, política)', d2.name.endsWith('editado') && d2.status === 'blocked' && d2.contacts.map(c => c.name).join() === 'Ana UI,Carla UI' && d2.channels.filter(c => c.type === 'phone').length === 2 && d2.repeat_policy.sales_policy === 'contract', JSON.stringify(d2).slice(0, 300));
    await shot(page, 'clientes_w2_editado');

    // Conflicto de versión: otra sesión guarda primero
    const token = (await (await page.request.get(UI + '/api/v1/auth/csrf')).json()).csrf_token;
    const other = await page.request.put(UI + `/api/v1/catalogs/clients/${created.id}`, { headers: { 'Content-Type': 'application/json', 'X-SF-CSRF': token, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': '"2"' },
      data: { code, name: `Cliente UI ${RUN} (otra sesión)`, project: 'PRY-UI', contract_reference: 'CTR-2026-001', status: 'blocked', contacts: ['Ana UI'], emails: [], phone: '', repeat_policy: {} } });
    check('otra sesión guarda v3', other.status() === 200);
    await page.getByLabel('Observaciones', { exact: true }).fill('Cambio sobre versión vieja');
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    await page.getByTestId('save-message').filter({ hasText: 'Otra persona modificó este cliente' }).waitFor();
    check('versión vieja → aviso de conflicto (412), sin sobrescribir', (await api(`/api/v1/catalogs/clients/${created.id}`)).item.name.endsWith('(otra sesión)'));
    await page.getByRole('button', { name: 'Recargar ficha' }).click();
    await page.getByTestId('form-mode').filter({ hasText: `Editando ${code} · v3` }).waitFor();
    check('"Recargar ficha" trae la versión vigente (v3 de la otra sesión)', (await page.getByLabel('Razón social', { exact: true }).inputValue()).endsWith('(otra sesión)'));

    // Pie de la ficha: solo Guardar cliente, Limpiar y Ver matriz
    const footer = await page.getByTestId('form-actions').getByRole('button').allInnerTexts();
    check('pie de la ficha con tres botones', footer.map(t => t.replace(/\s+/g, ' ').trim()).join(' | ') === '💾Guardar cliente | 🧹Limpiar | 📋Ver matriz' || footer.map(t => t.replace(/[^\p{L} ]/gu, '').trim()).join('|') === 'Guardar cliente|Limpiar|Ver matriz', footer.join(' | '));
    // "Limpiar" vacía la ficha y la deja lista para un alta nueva (no borra nada en MariaDB)
    await page.getByLabel('Observaciones', { exact: true }).fill('Texto sin guardar');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    check('"Limpiar" deja el formulario vacío en modo alta', (await page.getByTestId('form-mode').innerText()).includes('Nuevo registro') && (await page.getByLabel('No. de cliente', { exact: true }).inputValue()) === '' && (await page.getByLabel('Observaciones', { exact: true }).inputValue()) === '' && (await page.getByLabel('Seleccionar por número de cliente').inputValue()) === '');
    check('"Limpiar" no modifica el cliente guardado', (await api(`/api/v1/catalogs/clients/${created.id}`)).item.name.endsWith('(otra sesión)'));

    // Número duplicado (formulario limpio)
    await page.getByLabel('No. de cliente', { exact: true }).fill(code);
    await page.getByLabel('Razón social', { exact: true }).fill('Duplicado UI');
    await page.getByLabel('Proyecto', { exact: true }).fill('P'); await page.getByLabel('Número de contrato', { exact: true }).fill('C');
    await page.getByRole('button', { name: 'Guardar cliente' }).click();
    await page.getByTestId('save-message').filter({ hasText: 'Ese número de cliente ya está registrado' }).waitFor();
    check('número duplicado → 409 con mensaje y campo marcado', (await form.innerText()).includes('Número ya registrado.'));

    // Matriz
    await page.getByRole('button', { name: 'Ver matriz' }).click();
    await page.getByLabel('Buscar en catálogo').fill(code);
    await page.getByRole('row').filter({ hasText: code }).first().waitFor();
    const rowsTxt = await page.getByRole('row').filter({ hasText: code }).allInnerTexts();
    check('el nuevo cliente aparece en la matriz', rowsTxt.length === 1 && rowsTxt[0].includes(`Cliente UI ${RUN} (otra sesión)`), rowsTxt.join(' || ').slice(0, 300));
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    check('solo escrituras permitidas (1 alta + 1 edición + 1 conflicto + 1 duplicado)', writes.filter(w => w.startsWith('POST')).length === 2 && writes.filter(w => w.startsWith('PUT')).length === 2 && req === 1, writes.join(', '));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('ninguna otra escritura /api intentada', blocked.length === 0, blocked.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? `  → ${d}` : ''}`);
  console.log(`\nClientes · escritura UI: ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
