// Contratista · "Datos de mi empresa" · E2E de interfaz (Chromium) del guardado REAL contra Vite + API + MariaDB SINTÉTICAS.
// ESCRIBE en la organización de la sesión (exige SF_SYNTHETIC_WRITES=1) y al final restaura la razón social, RFC, teléfono, correo,
// domicilio y logotipo originales por la API. Si la empresa ya tenía logotipo, se omiten los pasos de logotipo.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_SHOTS=<dir>] node tests/frontend/contractors_write_ui_e2e.cjs
const { chromium } = require('playwright');
const zlib = require('zlib');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1') { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD y SF_SYNTHETIC_WRITES=1.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const RUN = Math.random().toString(16).slice(2, 8).toUpperCase();

function png(w, h, rgb) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t), d])) >>> 0); return Buffer.concat([len, Buffer.from(t), d, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const puts = []; page.on('request', r => { if (r.method() !== 'GET' && /\/api\/v1\/contractors/.test(r.url())) puts.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  let orig = null; let had = false; let oid = '';
  const api = async p => (await page.request.get(UI + p)).json();
  const current = async () => (await api('/api/v1/contractors')).items.find(x => x.id === oid);
  const apiPut = async (body, version) => {
    const t = (await api('/api/v1/auth/csrf')).csrf_token;
    return page.request.put(`${UI}/api/v1/contractors/${oid}`, { data: body, headers: { 'X-SF-CSRF': t, 'Idempotency-Key': require('crypto').randomUUID(), 'If-Match': `"${version}"` } });
  };
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const org = (await api('/api/v1/contractors')).items[0];
    oid = org.id; had = !!org.has_logo;
    orig = { legal_name: org.legal_name, tax_id: org.tax_identifier || '', phone: org.phone || '', email: org.email || '', address: org.postal_address || '' };
    const ws = await api('/api/v1/catalogs/write-status');
    check('guardado de catálogos habilitado (35 permisos)', ws.code === 'OK' && ws.expected_grants === 35, JSON.stringify(ws));

    await page.locator('nav button').filter({ hasText: /^[^A-Za-z]*Contratista$/ }).click();
    await page.getByRole('button', { name: /Matriz de contratistas/ }).first().click();
    const row = page.getByTestId('contractor-row').first(); await row.waitFor();
    await row.getByRole('button', { name: /^editar$/i }).click();
    await page.locator('input[name="companyName"]').waitFor();
    check('EDITAR: razón social registrada, modo edición, sin aviso de guardado', await page.locator('input[name="companyName"]').inputValue() === org.legal_name
      && (await page.getByTestId('company-mode').innerText()).includes('Editando') && await page.getByTestId('catalog-write-status').count() === 0);

    // Validación en el navegador: no envía nada.
    await page.locator('input[name="phone"]').fill('llamar a recepción');
    await page.getByRole('button', { name: /Guardar contratista/ }).click();
    await page.getByTestId('company-err-phone').waitFor();
    check('teléfono inválido: aviso en el campo y sin PUT', (await page.getByTestId('company-err-phone').innerText()).includes('Teléfono inválido') && puts.length === 0, puts.join(','));

    await page.locator('input[name="phone"]').fill('+52 55 0000 0000');
    check('al corregir el campo desaparece su aviso', await page.getByTestId('company-err-phone').count() === 0 && await page.getByTestId('company-msg').count() === 0);

    const NEW = { name: `${org.legal_name} UI ${RUN}`.slice(0, 255), rfc: `UIQ${RUN}`, phone: '+52 55 8000 1234', email: `ui.${RUN.toLowerCase()}@supplyflow.invalid`, address: 'Av. Sintética 200\nPiso 3, CDMX' };
    await page.locator('input[name="companyName"]').fill(NEW.name);
    await page.locator('input[name="rfc"]').fill(NEW.rfc);
    await page.locator('input[name="phone"]').fill(NEW.phone);
    await page.locator('input[name="email"]').fill(NEW.email);
    await page.locator('textarea[name="address"]').fill(NEW.address);
    await shot(page, 'contractor_company_edit');
    const img = png(48, 24, [162, 33, 183]);
    if (!had) {
      await page.getByRole('button', { name: /Agregar logotipo/ }).click();
      await page.locator('input[type=file]').setInputFiles({ name: `logo-${RUN}.png`, mimeType: 'image/png', buffer: img });
      await page.getByTestId('company-logo-preview').waitFor();
      check('logotipo: vista previa en Identidad y logotipo', await page.getByTestId('company-logo-preview').isVisible());
    }
    const put1 = page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\/v1\/contractors\//.test(r.url()));
    await page.getByRole('button', { name: had ? /Guardar contratista$/ : /Guardar contratista y logotipo/ }).click();
    const r1 = await put1; const b1 = await r1.json();
    check('guardar: PUT 200 con CSRF, If-Match e Idempotency-Key', r1.status() === 200 && !!r1.request().headers()['x-sf-csrf'] && /^"\d+"$/.test(r1.request().headers()['if-match'] || '') && !!r1.request().headers()['idempotency-key'], `${r1.status()} ${JSON.stringify(b1)}`);
    check('cambios confirmados por el servidor', ['legal_name', 'tax_id', 'phone', 'email', 'address', ...(had ? [] : ['logo_file'])].every(k => (b1.changed || []).includes(k)), JSON.stringify(b1.changed));
    await page.getByTestId('contractors-msg').waitFor();
    check('vuelve a la matriz con el aviso de guardado', (await page.getByTestId('contractors-msg').innerText()).includes('Datos de la empresa guardados en MariaDB'));
    await page.getByTestId('contractor-registered').waitFor();
    // La matriz se recarga tras guardar: esperar a que muestre el dato nuevo (antes podía leerse la versión anterior).
    await page.getByTestId('contractor-registered').filter({ hasText: NEW.name }).waitFor({ timeout: 15000 }).catch(() => {});
    await page.getByTestId('contractor-row').first().filter({ hasText: NEW.rfc }).waitFor({ timeout: 15000 }).catch(() => {});
    check('la matriz muestra la razón social guardada y el RFC', (await page.getByTestId('contractor-registered').innerText()).includes(NEW.name) && (await page.getByTestId('contractor-row').first().innerText()).includes(NEW.rfc));
    const c1 = await current();
    check('MariaDB: datos guardados tal cual (domicilio con salto de línea)', c1.legal_name === NEW.name && c1.tax_identifier === NEW.rfc && c1.phone === NEW.phone && c1.email === NEW.email && c1.postal_address === NEW.address && c1.version === b1.version, JSON.stringify(c1).slice(0, 300));
    if (!had) {
      await page.getByTestId('contractor-row-logo-stored').waitFor({ timeout: 10000 });
      check('matriz: muestra el logotipo guardado', c1.logo_stored === true && await page.getByTestId('contractor-row-logo-stored').isVisible());
    }
    await shot(page, 'contractor_company_saved');

    // Versión vencida: otra sesión cambia los datos mientras la ficha está abierta.
    await page.getByTestId('contractor-row').first().getByRole('button', { name: /^editar$/i }).click();
    await page.locator('input[name="companyName"]').waitFor();
    if (!had) {
      await page.getByRole('button', { name: /Agregar logotipo/ }).click();
      await page.getByTestId('company-logo-preview').waitFor({ timeout: 10000 });
      check('EDITAR de nuevo: carga el logotipo guardado', await page.getByTestId('company-logo-preview').isVisible());
      await page.getByRole('button', { name: /Datos del contratista/ }).first().click();
    }
    const bump = await apiPut({ legal_name: NEW.name, tax_id: NEW.rfc, phone: '+52 55 8000 9999', email: NEW.email, address: NEW.address }, c1.version);
    check('(otra sesión cambia el teléfono)', bump.status() === 200);
    await page.locator('input[name="email"]').fill(`otro.${RUN.toLowerCase()}@supplyflow.invalid`);
    const put2 = page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\/v1\/contractors\//.test(r.url()));
    await page.getByRole('button', { name: /Guardar contratista$/ }).click();
    check('versión vencida: 412 y aviso para reabrir', (await put2).status() === 412 && (await page.getByTestId('company-msg').innerText()).includes('Otra persona modificó'));
    const c2 = await current();
    check('la versión vencida no sobrescribió nada', c2.phone === '+52 55 8000 9999' && c2.email === NEW.email);

    if (!had) {
      // Quitar el logotipo desde la interfaz.
      await page.getByRole('button', { name: /Matriz de contratistas/ }).first().click();
      await page.getByTestId('contractor-row').first().getByRole('button', { name: /^editar$/i }).click();
      await page.getByRole('button', { name: /Agregar logotipo/ }).click();
      await page.getByTestId('company-logo-preview').waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: /Quitar logotipo de la empresa/ }).click();
      const put3 = page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\/v1\/contractors\//.test(r.url()));
      await page.getByRole('button', { name: /Guardar contratista y logotipo/ }).click();
      const r3 = await put3; const b3 = await r3.json();
      check('quitar logotipo: PUT 200 solo con el logotipo', r3.status() === 200 && JSON.stringify(b3.changed) === '["logo_file"]', JSON.stringify(b3));
      check('MariaDB: sin logotipo', (await current()).has_logo === false);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByTestId('contractor-row').first().getByRole('button', { name: /^editar$/i }).click();
    check('sin desbordamiento horizontal en móvil (edición)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.setViewportSize({ width: 1440, height: 1000 });
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  try {
    if (orig) {
      const cur = await current();
      const body = { ...orig, ...(!had && cur.has_logo ? { logo: { remove: true } } : {}) };
      const r = await apiPut(body, cur.version);
      const fin = await current();
      check('restauración de los datos originales', r.status() === 200 && fin.legal_name === orig.legal_name && (fin.tax_identifier || '') === orig.tax_id && (fin.phone || '') === orig.phone
        && (fin.email || '') === orig.email && (fin.postal_address || '') === orig.address && fin.has_logo === had, `${r.status()}`);
    }
  } catch (e) { check('restauración de los datos originales', false, String(e).slice(0, 300)); }
  check('sin POST/DELETE de empresas', puts.every(x => x.startsWith('PUT ')), puts.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nContratista · datos de la empresa (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
