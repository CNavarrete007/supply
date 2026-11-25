// Usuarios y roles · «Acceso y rol Master Admin» + primer inicio de sesión con contraseña temporal · E2E (Chromium) contra
// Vite + API + MariaDB SINTÉTICAS. ESCRIBE credenciales y roles del usuario objetivo sintético (por omisión
// qa.reviewer.c@supplyflow.invalid) y lo deja SIN rol al terminar. Exige SF_SYNTHETIC_WRITES=1.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... SF_SYNTHETIC_WRITES=1 [SF_ACCESS_TARGET=<correo>] [SF_SHOTS=<dir>] node tests/frontend/user_access_ui_e2e.cjs
const { chromium } = require('playwright');
const crypto = require('node:crypto');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const TARGET = process.env.SF_ACCESS_TARGET || 'qa.reviewer.c@supplyflow.invalid';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD || process.env.SF_SYNTHETIC_WRITES !== '1' || !TARGET.endsWith('.invalid')) { console.error('BLOCKED: solo UI local sintética, SF_QA_PASSWORD, SF_SYNTHETIC_WRITES=1 y objetivo .invalid.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const REASON = 'Segundo Master Admin para revisión independiente (sintético UI).';

async function signIn(browser, email, password) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  page.jsErrors = []; page.on('pageerror', e => page.jsErrors.push(String(e)));
  await page.goto(UI + '/');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('button[type=submit]').first().click();
  return { context, page };
}

(async () => {
  const browser = await chromium.launch();
  let A, C;
  try {
    A = await signIn(browser, 'qa.admin.a@supplyflow.invalid', PASSWORD);
    const pa = A.page; await pa.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await pa.request.get(UI + p)).json();
    const findTarget = async () => (await api('/api/v1/users?page=1')).items.find(u => u.email === TARGET);
    let t = await findTarget();
    if (!t) throw new Error('no existe el usuario objetivo sintético ' + TARGET);
    if (t.role_codes.includes('master_admin')) { // estado inicial limpio, por la API
      const csrf = (await api('/api/v1/auth/csrf')).csrf_token;
      await pa.request.post(`${UI}/api/v1/users/${t.id}/access`, { data: { action: 'revoke_master_admin', actor_password: PASSWORD, reason: REASON }, headers: { 'X-SF-CSRF': csrf, 'Idempotency-Key': crypto.randomUUID(), 'If-Match': `"${t.version}"` } });
      t = await findTarget();
    }
    await pa.locator('nav button').filter({ hasText: /Usuarios y roles$/ }).click();
    await pa.getByRole('button', { name: /Alta y actualización: ficha/ }).click();
    await pa.getByLabel('Seleccionar usuario').selectOption(t.id);
    const panel = pa.getByTestId('user-access'); await panel.waitFor();
    check('panel: estado actual (sin rol Master Admin) y sin aviso de cuenta', (await panel.getByTestId('access-role').innerText()) === 'Sin rol Master Admin' && await panel.getByTestId('access-status').count() === 0);
    await panel.getByText('Habilitar como Master Admin', { exact: true }).click();
    await panel.getByRole('button', { name: /Aplicar/ }).click();
    check('validación en el navegador: motivo obligatorio, sin enviar', (await panel.getByTestId('access-msg').innerText()).includes('Escribe el motivo'));
    await panel.getByLabel('Motivo del cambio de acceso').fill(REASON);
    await panel.getByLabel('Tu contraseña para confirmar').fill(PASSWORD + 'x');
    await panel.getByLabel('Confirmo que es una persona distinta').check();
    await panel.getByRole('button', { name: /Aplicar/ }).click();
    await panel.getByTestId('access-msg').filter({ hasText: /Tu contraseña no es correcta/ }).waitFor({ timeout: 15000 });
    check('reautenticación: contraseña incorrecta, no se aplica y se borra el campo', await panel.getByLabel('Tu contraseña para confirmar').inputValue() === '' && (await findTarget()).version === t.version);
    await panel.getByLabel('Tu contraseña para confirmar').fill(PASSWORD);
    const resp = pa.waitForResponse(r => r.request().method() === 'POST' && /\/access$/.test(r.url()));
    await panel.getByRole('button', { name: /Aplicar/ }).click();
    const r1 = await resp; const h = r1.request().headers();
    check('POST con CSRF, If-Match e Idempotency-Key', r1.status() === 200 && !!h['x-sf-csrf'] && /^"\d+"$/.test(h['if-match'] || '') && !!h['idempotency-key']);
    await panel.getByTestId('access-msg').filter({ hasText: /ya es Master Admin/ }).waitFor({ timeout: 15000 });
    if (!await panel.getByTestId('access-temp').count()) { // ya tenía contraseña: se restablece para probar el primer acceso
      await panel.getByText('Restablecer contraseña temporal', { exact: true }).click();
      await panel.getByLabel('Motivo del cambio de acceso').fill(REASON);
      await panel.getByLabel('Tu contraseña para confirmar').fill(PASSWORD);
      await panel.getByRole('button', { name: /Aplicar/ }).click();
    }
    await panel.getByTestId('access-temp').waitFor({ timeout: 15000 });
    const temp = (await panel.getByTestId('access-temp-value').innerText()).trim();
    check('contraseña temporal visible una vez, con vencimiento e instrucciones', /^([A-Za-z2-9]{4}-){3}[A-Za-z2-9]{4}$/.test(temp) && (await panel.getByTestId('access-temp').innerText()).includes('se muestra una sola vez'));
    await panel.getByTestId('access-role').filter({ hasText: 'Master Admin' }).waitFor({ timeout: 15000 });
    check('panel actualizado desde MariaDB: Master Admin y temporal pendiente', (await panel.getByTestId('access-credential').innerText()).startsWith('Temporal'));
    await shot(pa, 'access-01-temporal');
    await panel.getByRole('button', { name: /Ya la entregué/ }).click();
    check('«Ya la entregué · ocultar» la retira de la pantalla', await panel.getByTestId('access-temp').count() === 0);

    // Primer inicio de sesión del nuevo Master Admin.
    C = await signIn(browser, TARGET, temp);
    const pc = C.page;
    await pc.getByTestId('password-change').waitFor({ timeout: 15000 });
    check('login con contraseña temporal: pide elegir una nueva (sin entrar)', (await pc.getByRole('heading', { name: 'Elige tu nueva contraseña' }).count()) === 1 && await pc.locator('nav button').count() === 0);
    await pc.getByLabel('Nueva contraseña', { exact: true }).fill('corta1');
    await pc.getByLabel('Confirmar nueva contraseña').fill('corta1');
    await pc.getByRole('button', { name: /Guardar y entrar/ }).click();
    check('regla de contraseña en el navegador', (await pc.getByTestId('password-change-error').innerText()).includes('entre 12 y 128'));
    const newpw = 'Revisor-' + crypto.randomBytes(5).toString('hex') + '-7Q';
    await pc.getByLabel('Nueva contraseña', { exact: true }).fill(newpw);
    await pc.getByLabel('Confirmar nueva contraseña').fill(newpw);
    await shot(pc, 'access-02-cambio');
    await pc.getByRole('button', { name: /Guardar y entrar/ }).click();
    await pc.locator('nav button').first().waitFor({ timeout: 20000 });
    const me = await (await pc.request.get(UI + '/api/v1/auth/me')).json();
    check('guarda la nueva contraseña y entra como Master Admin', JSON.stringify(me.user.roles.map(r => r.code)) === '["master_admin"]');
    await pc.locator('nav button').filter({ hasText: /Solicitud \/ Requisición$/ }).first().click();
    await pc.getByText('Cargando datos de MariaDB').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await pc.locator('#reqSubnav').getByRole('button', { name: /Control de cambios/ }).click();
    await pc.getByTestId('change-control').waitFor({ timeout: 15000 });
    check('el nuevo Master Admin abre Control de cambios', await pc.getByTestId('change-control').isVisible());
    await shot(pc, 'access-03-nuevo-admin');

    // Retirar el rol (estado final limpio). El nuevo admin cambió su contraseña (versión nueva): con la ficha sin actualizar,
    // el servidor responde 412 y el panel recarga; tras «Actualizar» se aplica con la versión vigente.
    await panel.getByText('Retirar Master Admin', { exact: true }).click();
    await panel.getByLabel('Motivo del cambio de acceso').fill('Fin de la prueba sintética de acceso (UI).');
    await panel.getByLabel('Tu contraseña para confirmar').fill(PASSWORD);
    await panel.getByRole('button', { name: /Aplicar/ }).click();
    await panel.getByTestId('access-msg').filter({ hasText: /cambió desde que abriste la ficha/ }).waitFor({ timeout: 15000 });
    check('versión vencida (el usuario cambió su contraseña): 412, no se aplica y se recarga', (await findTarget()).role_codes.includes('master_admin'));
    await pa.getByRole('button', { name: /Actualizar/ }).first().click();
    await pa.waitForTimeout(800);
    await pa.getByLabel('Seleccionar usuario').selectOption(t.id);
    await panel.getByText('Retirar Master Admin', { exact: true }).click();
    await panel.getByLabel('Motivo del cambio de acceso').fill('Fin de la prueba sintética de acceso (UI).');
    await panel.getByLabel('Tu contraseña para confirmar').fill(PASSWORD);
    await panel.getByRole('button', { name: /Aplicar/ }).click();
    await panel.getByTestId('access-msg').filter({ hasText: /ya no es Master Admin/ }).waitFor({ timeout: 15000 });
    check('retirar Master Admin: el nuevo admin pierde la sesión', (await pc.request.get(UI + '/api/v1/auth/me')).status() === 401);
    await pa.getByLabel('Seleccionar usuario').selectOption((await api('/api/v1/auth/me')).user.public_id);
    check('propia cuenta: sin acciones y con aviso', (await pa.getByTestId('access-note').innerText()).includes('propia cuenta') && await pa.getByTestId('access-form').count() === 0);
    await pa.setViewportSize({ width: 390, height: 900 });
    check('responsive: sin desbordamiento horizontal', await pa.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    // Enlace voluntario «¿Cambiar contraseña?» en el login.
    const L = await browser.newContext(); const pl = await L.newPage();
    await pl.goto(UI + '/'); await pl.getByRole('button', { name: '¿Cambiar contraseña?' }).click();
    check('login: «¿Cambiar contraseña?» abre el formulario con contraseña actual', await pl.getByLabel('Contraseña actual').count() === 1);
    await pl.getByRole('button', { name: 'Cancelar' }).click();
    check('cancelar regresa al inicio de sesión', await pl.getByRole('button', { name: '¿Cambiar contraseña?' }).count() === 1);
    await L.close();
    check('sin errores JavaScript', !pa.jsErrors.length && !pc.jsErrors.length, [...pa.jsErrors, ...pc.jsErrors].join(' | ').slice(0, 400));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e.stack || e).slice(0, 500));
    if (A) await shot(A.page, 'access-zz-error').catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nUsuarios · acceso Master Admin (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
