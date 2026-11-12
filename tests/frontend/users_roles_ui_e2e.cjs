// Usuarios y roles · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición
// /api que no sea GET (salvo login/logout) se aborta y hace fallar la prueba. Requiere los usuarios sintéticos QA y los
// datos de prueba del sandbox (OC-QA-0001 con comprador/preparó/autorizó, RFQ-QA-0001 y el evento sintético user.block).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/users_roles_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = []; const auditCalls = [];
  page.on('request', r => { if (/\/api\/v1\/audit-events/.test(r.url())) auditCalls.push(new URL(r.url()).search); });
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
    const users = (await api('/api/v1/users?page=1')).items;
    const roles = (await api('/api/v1/roles')).items;
    const buyer = users.find(u => u.email === 'qa.buyer@supplyflow.invalid');

    const waits = ['users\\?page=1', 'roles$', 'users/functions$'].map(ep => page.waitForResponse(r => new RegExp('/api/v1/' + ep).test(r.url()), { timeout: 20000 }).then(r => r.status()).catch(() => 'sin respuesta'));
    await page.locator('nav button').filter({ hasText: /Usuarios y roles$/ }).click();
    const st = await Promise.all(waits);
    check('consulta usuarios, roles y funciones observadas (200)', st.every(s => s === 200), st.join(','));
    for (const t of ['Usuarios', 'Matriz de usuarios', 'Roles y permisos', 'Resumen de acceso', 'Bitácora de actividad'])
      check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(`^.{0,4}${t}`) }).first().isVisible());

    // Matriz (pestaña inicial)
    await page.getByText(`${users.length} mostrados`).waitFor();
    const row = name => page.getByRole('row').filter({ hasText: name });
    const rb = (await row(buyer.name).innerText()).replace(/\s+/g, ' ');
    let allShown = true; for (const u of users) allShown = allShown && await row(u.email).count() === 1;
    check('matriz con todos los usuarios reales, rol y acceso', allShown && rb.includes(buyer.email) && rb.includes('Comprador') && rb.includes('Acceso habilitado'), rb);
    check('funciones observadas en documentos', rb.includes('🛒 Comprador') && (await row('QA Admin A').innerText()).includes('✅ Autorizó') && (await row('QA Admin B').innerText()).includes('✍️ Preparó / Revisó'));
    check('bloquear y eliminar deshabilitados', await row(buyer.name).getByRole('button', { name: /Bloquear/i }).isDisabled() && await row(buyer.name).getByRole('button', { name: /Eliminar/i }).isDisabled());
    await page.getByLabel('Buscar usuarios').fill('autorizo');
    check('búsqueda por función', await page.getByText('1 mostrados').isVisible() && await row('QA Admin A').count() === 1);
    await page.getByLabel('Buscar usuarios').fill('');
    await shot(page, 'usuarios_1_matriz');

    // Ficha
    await row(buyer.name).getByRole('button', { name: /Ficha/i }).click();
    await page.getByLabel('Nombre completo').waitFor();
    const val = async l => page.getByLabel(l, { exact: true }).inputValue();
    check('ficha con datos reales', await val('Nombre completo') === buyer.name && await val('Usuario / correo') === buyer.email && await val('Rol de acceso') === 'Comprador' && (await val('Credencial')).startsWith('Credencial activada'));
    const bf = ((await (await page.request.get(UI + '/api/v1/users/functions')).json()).items || []).find(x => x.id === buyer.id) || {};
    const buyerDocs = (bf.po_buyer || 0) + (bf.review_buyer || 0) + (bf.rfq_contact || 0); // misma suma que usersRoles/model.mjs
    check('función comprador marcada con sus documentos', await page.getByLabel('🛒 Comprador', { exact: true }).isChecked() && await page.getByText(`${buyerDocs} documento(s)`).isVisible() && !(await page.getByLabel('✅ Autorizó', { exact: true }).isChecked()));
    check('permisos de documento sin registros y guardar bloqueado', !(await page.getByLabel('Autorizar Orden de Compra').isChecked()) && await page.getByRole('button', { name: /Guardar usuario/ }).isDisabled());
    await shot(page, 'usuarios_2_ficha');

    // Roles
    await page.getByRole('button', { name: /Roles y permisos/ }).first().click();
    const master = roles.find(r => r.code === 'master_admin');
    const card = name => page.locator('div.rounded-2xl').filter({ has: page.getByRole('heading', { name: new RegExp(`^${name}`) }) }).last();
    check('catálogo con roles reales y conteo de usuarios', (await card(master.name).innerText()).includes(`${master.users} usuario(s)`) && (await card(master.name).innerText()).includes('7 secciones') && (await card('Comprador').innerText()).includes('0 secciones'));
    await card(master.name).getByRole('button', { name: /^Ver$/ }).click();
    check('rol: acceso efectivo por sección', await val('Nombre del rol') === `${master.name} (master_admin)` && await page.getByLabel('Clientes', { exact: true }).isChecked() && !(await page.getByLabel('Flujo del Proceso', { exact: true }).isChecked()));
    await shot(page, 'usuarios_3_roles');

    // Resumen
    await page.getByRole('button', { name: /Resumen de acceso/ }).first().click();
    const kpi = async l => Number((await page.getByText(l, { exact: true }).locator('xpath=preceding-sibling::div[1]').innerText()).trim());
    check('resumen: personas, con acceso, compradores, preparó, autorizadores, inactivos',
      await kpi('Personas') === users.length && await kpi('Con acceso') === users.filter(u => u.access_enabled && u.credential_state === 'local_validated' && u.status === 'active').length && await kpi('Compradores') === 1 && await kpi('Preparó / Revisó') === 1 && await kpi('Autorizadores') === 1 && await kpi('Inactivos / sin acceso') === 0);
    check('recomendación de administradores con el conteo real', await page.getByText(/Hay 2 cuenta\(s\) Master Admin activa\(s\)/).isVisible());
    await shot(page, 'usuarios_4_resumen');

    // Bitácora
    const first = page.waitForResponse(r => /\/api\/v1\/audit-events\?page=1&page_size=25$/.test(r.url()));
    await page.getByRole('button', { name: /Bitácora de actividad/ }).first().click();
    check('bitácora consulta el servidor (200)', (await first).status() === 200);
    const log = page.getByTestId('audit-log');
    await log.locator('tbody tr').first().waitFor();
    const sum = (await api('/api/v1/audit-events?page_size=1')).summary;
    check('KPI movimientos totales = MariaDB', Number((await page.getByText('Movimientos totales', { exact: true }).locator('xpath=preceding-sibling::div[1]').innerText()).trim()) === sum.total, String(sum.total));
    check('25 movimientos por página', await log.locator('tbody tr').count() === 25);
    const blockResp = page.waitForResponse(r => /action=user\.block/.test(r.url()));
    await page.getByLabel('Bitácora acción').selectOption('user.block');
    check('filtro de acción en el servidor (200)', (await blockResp).status() === 200);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="audit-log"] tbody tr').length === 1);
    const ev = await log.locator('tbody tr').first().innerText();
    check('cambios con valores sensibles protegidos', ev.includes('password_hash: [protegido]') && ev.includes('status: active → blocked') && !ev.includes('no-debe-verse'), ev);
    await page.getByLabel('Bitácora acción').selectOption('all');
    const actorResp = page.waitForResponse(r => new RegExp(`actor=${buyer.id}`).test(r.url()));
    await page.getByLabel('Bitácora usuario').selectOption(buyer.id);
    check('filtro por usuario en el servidor', (await actorResp).status() === 200);
    await page.getByLabel('Bitácora usuario').selectOption('all');
    const qResp = page.waitForResponse(r => /q=regulariz/.test(r.url()));
    await page.getByLabel('Buscar en bitácora').fill('regulariz');
    check('búsqueda con espera (debounce) en el servidor', (await qResp).status() === 200);
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await page.getByLabel('Bitácora desde').fill('2026-11-10');
    await page.getByLabel('Bitácora hasta').fill('2026-11-01');
    check('rango de fechas inválido no consulta', await page.getByText('La fecha inicial es mayor que la final.').isVisible());
    await page.getByLabel('Bitácora hasta').fill('2026-11-30');
    await page.waitForResponse(r => /from=2026-11-\d\d\+\d\d%3A\d\d%3A\d\d.*to=2026-12-0[01]|from=2026-11-\d\d\+\d\d%3A\d\d%3A\d\d&to=/.test(r.url())).catch(() => null);
    check('filtro de fechas enviado como límites UTC', auditCalls.some(s => /from=2026-11-(09|10)\+\d\d%3A\d\d%3A\d\d/.test(s)), auditCalls.slice(-3).join(' | '));
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await log.locator('tbody tr').nth(1).waitFor();
    await shot(page, 'usuarios_5_bitacora');

    check('sin escrituras a la API', writes.length === 0, writes.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/usuarios_zz_error.png` }).catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nUsuarios y roles UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
