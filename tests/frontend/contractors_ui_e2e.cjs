// Contratista · tarjeta 2 "Matriz de contratistas" · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta. Valores esperados desde la API.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/contractors_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const low = s => String(s).replace(/\s+/g, ' ').toLowerCase();

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
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const all = await api('/api/v1/contractors');
    const org = all.items[0];
    const staffApi = await api(`/api/v1/contractors/${org.id}/personnel`);

    await page.locator('nav button').filter({ hasText: /^[^A-Za-z]*Contratista$/ }).click();
    const first = page.waitForResponse(r => /\/api\/v1\/contractors\?/.test(r.url()));
    await page.getByRole('button', { name: /Matriz de contratistas/ }).first().click();
    check('matriz consulta MariaDB (200)', (await first).status() === 200);
    const mx = page.getByTestId('contractors-matrix');
    await page.getByTestId('contractor-row').first().waitFor();
    const head = low(await mx.innerText());
    check('título y explicación del diseño', head.includes('matriz de contratistas') && head.includes('cada empresa conserva sus datos generales y logotipo. selecciona una como activa para documentos y operaciones.'));
    check('"+ Nuevo contratista", buscador y filtro de estatus', await mx.getByRole('button', { name: /Nuevo contratista/ }).isVisible() && await mx.getByPlaceholder('Buscar por empresa, RFC, correo o dirección...').isVisible()
      && JSON.stringify(await mx.getByLabel('Estatus').locator('option').allInnerTexts()) === '["Todos los estatus","Activo","Inactivo"]');
    check('sin aviso genérico de "pendiente de integración"; aviso propio de escrituras bloqueadas', await page.getByText('Módulo pendiente de integración').count() === 0 && (await page.getByTestId('contractors-lock').innerText()).includes('conectada a MariaDB (solo lectura)'));
    check('sin datos de demostración (CME / ISA)', !head.includes('cme estructuras') && !head.includes('isa piping'));
    const hdr = low(await mx.locator('thead').innerText());
    check('columnas del diseño', ['logo', 'empresa', 'rfc / tax id', 'contacto general', 'dirección', 'responsable', 'personal', 'estatus', 'uso', 'acciones'].every(x => hdr.includes(x)), hdr);
    check(`una fila por empresa de la sesión (${all.total})`, await page.getByTestId('contractor-row').count() === all.total);
    const row = low(await page.getByTestId('contractor-row').first().innerText());
    const fold = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,]/g, '').toLowerCase();
    check('fila: nombre "Trámites Aduanales Gerez S.C" y la razón social registrada en MariaDB cuando difiere', row.includes('trámites aduanales gerez s.c') && (fold(org.legal_name) === 'tramites aduanales gerez sc' ? await page.getByTestId('contractor-registered').count() === 0 : row.includes(`razón social registrada en mariadb: ${org.legal_name.toLowerCase()}`)), row);
    check('fila: responsable, personal, estatus y uso', [org.responsible ? org.responsible.name.toLowerCase() : 'sin responsable', `${org.personnel} persona(s)`, 'activo', 'contratista activo', `${org.usage.requisitions} requisición(es)`].every(x => row.includes(x)), row);
    check('logotipo Grupo Gerez cargado', await page.getByTestId('contractor-row').first().locator('img').evaluate(i => i.complete && i.naturalWidth > 0) && row.includes('logotipo institucional grupo gerez'));
    check('acciones Activo, Editar, Personal y Eliminar', ['activo', 'editar', 'personal', 'eliminar'].every(x => row.includes(x)));
    await shot(page, 'contractors_matrix');

    const byQ = page.waitForResponse(r => /\/api\/v1\/contractors\?q=zzz-no-existe/.test(r.url()));
    await mx.getByLabel('Buscar contratista').fill('zzz-no-existe');
    check('búsqueda en el servidor (200)', (await byQ).status() === 200);
    await mx.getByText('Sin contratistas con este filtro.').waitFor();
    check('búsqueda sin resultados: estado vacío', await page.getByTestId('contractor-row').count() === 0);
    await mx.getByLabel('Buscar contratista').fill(org.legal_name.slice(0, 6));
    await page.getByTestId('contractor-row').first().waitFor();
    await mx.getByLabel('Buscar contratista').fill('zzz-no-existe');
    await mx.getByText('Sin contratistas con este filtro.').waitFor();
    await mx.getByLabel('Buscar contratista').fill('Trámites Aduanales');
    await page.getByTestId('contractor-row').first().waitFor();
    check('búsqueda por el nombre mostrado ("Trámites Aduanales") encuentra la empresa', await page.getByTestId('contractor-row').count() === 1);
    const byS = page.waitForResponse(r => /status=inactive/.test(r.url()));
    await mx.getByLabel('Estatus').selectOption('inactive');
    check('filtro de estatus en el servidor (200)', (await byS).status() === 200);
    await mx.getByText('Sin contratistas con este filtro.').waitFor();
    check('estatus Inactivo: sin la empresa activa', await page.getByTestId('contractor-row').count() === 0);
    await mx.getByLabel('Estatus').selectOption('all');
    await mx.getByLabel('Buscar contratista').fill('');
    await page.getByTestId('contractor-row').first().waitFor();

    const r0 = page.getByTestId('contractor-row').first();
    await r0.getByRole('button', { name: /activo/i }).click();
    check('Activo: ya es el contratista activo de la sesión', (await page.getByTestId('contractors-msg').innerText()).includes('ya es el contratista activo para documentos y operaciones'));
    const pr = page.waitForResponse(r => /\/personnel$/.test(r.url()));
    await r0.getByRole('button', { name: /^personal$/i }).click();
    check('Personal consulta MariaDB (200)', (await pr).status() === 200);
    const st = page.getByTestId('contractor-personnel'); await st.waitFor();
    const stt = low(await st.innerText());
    check('Personal: personas de la organización con roles y acceso', staffApi.items.every(p => stt.includes(p.name.toLowerCase())) && stt.includes('con acceso') && await st.locator('tbody tr').count() === Math.max(1, staffApi.total), stt.slice(0, 300));
    check('Personal: sin contraseñas ni identificadores internos', !/password|hash/i.test(JSON.stringify(staffApi)));
    await shot(page, 'contractors_personnel');
    await page.getByRole('button', { name: 'Cerrar personal' }).click();
    await r0.getByRole('button', { name: /^eliminar$/i }).click();
    check('Eliminar: bloqueado, contratista activo y titular de documentos', (await page.getByTestId('contractor-delete-block').innerText()).includes('es el contratista activo de esta sesión'));
    await page.getByRole('dialog', { name: 'Eliminar contratista' }).getByRole('button', { name: 'Cerrar', exact: true }).click();
    await r0.getByRole('button', { name: /^editar$/i }).click();
    await page.locator('input[name="companyName"]').waitFor();
    check('Editar precarga la tarjeta 1 (Trámites Aduanales Gerez S.C y datos reales)', await page.locator('input[name="companyName"]').inputValue() === 'Trámites Aduanales Gerez S.C' && await page.locator('input[name="rfc"]').inputValue() === (org.tax_identifier || ''));
    await page.getByRole('button', { name: /Guardar contratista/ }).click();
    await page.locator('header button').filter({ hasText: '🔔' }).click();
    await page.getByText('Contratista no guardado').first().waitFor();
    check('Guardar contratista valida y NO guarda (sin falso "guardado correctamente")', await page.getByText(/no se guardó "/).count() > 0 && await page.getByText(/guardó .* correctamente/).count() === 0);
    await page.locator('header button').filter({ hasText: '🔔' }).click();
    await page.getByRole('button', { name: /Matriz de contratistas/ }).first().click();
    await page.getByTestId('contractor-row').first().waitFor();
    check('la matriz no cambia tras guardar (sigue siendo MariaDB)', await page.getByTestId('contractor-row').count() === all.total);
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.setViewportSize({ width: 1440, height: 1000 });
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin escrituras /api intentadas', writes.length === 0, writes.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nContratista UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
