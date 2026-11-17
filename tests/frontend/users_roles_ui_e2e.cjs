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
    const active = users.filter(u => u.status === 'active').length;
    check('encabezado: "N activos · M operativos" y columnas del diseño', (await page.getByTestId('users-badge').innerText()) === `${active} activos · ${users.length} operativos`
      && JSON.stringify((await page.getByTestId('users-matrix').locator('thead th').allInnerTexts()).map(x => x.trim().toUpperCase())) === JSON.stringify(['USUARIO', 'PUESTO / EMPRESA', 'FUNCIONES OPERATIVAS', 'ROL / ACCESO', 'ESTATUS', 'ÚLTIMO ACCESO', 'ACCIONES']));
    const la = buyer.last_login_at ? new Date(String(buyer.last_login_at).replace(' ', 'T').replace(/(\.\d{3})\d*$/, '$1') + 'Z').toLocaleString('es-MX') : 'Sin accesos registrados';
    check('último acceso en formato local (dd/mm/aaaa, h:mm:ss)', rb.includes(la), `${la} | ${rb}`);
    check('acciones EDITAR, BLOQUEAR y ELIMINAR habilitadas', await row(buyer.name).getByRole('button', { name: 'Editar' }).isEnabled() && await row(buyer.name).getByRole('button', { name: 'Bloquear' }).isEnabled() && await row(buyer.name).getByRole('button', { name: 'Eliminar' }).isEnabled());
    // BLOQUEAR: motivo obligatorio; validado pero no aplicado
    await row(buyer.name).getByRole('button', { name: 'Bloquear' }).click();
    const dlg = page.getByTestId('user-action'); await dlg.waitFor();
    await dlg.getByRole('button', { name: 'Sí, bloquear' }).click();
    check('bloquear exige motivo (mínimo 10)', await dlg.getByText('Describe el motivo (mínimo 10 caracteres).').count() === 1);
    await dlg.getByRole('textbox', { name: 'Motivo' }).fill('Baja temporal sintética de prueba');
    await dlg.getByRole('button', { name: 'Sí, bloquear' }).click();
    check('bloquear validado pero NO aplicado (sin endpoint)', (await dlg.getByTestId('user-action-msg').innerText()).includes('no se aplicó el bloqueo') && writes.length === 0);
    await dlg.getByRole('button', { name: 'Cancelar' }).click();
    // Protección: no bloquear la propia cuenta
    await row('QA Admin A').getByRole('button', { name: 'Bloquear' }).click();
    check('no puedes bloquear tu propia cuenta', (await page.getByTestId('user-action').innerText()).includes('No puedes bloquear tu propia cuenta.'));
    await page.getByTestId('user-action').getByRole('button', { name: 'Entendido' }).click();
    // ELIMINAR: con historial no se elimina
    await row(buyer.name).getByRole('button', { name: 'Eliminar' }).click();
    check('eliminar usuario con historial: no se elimina, usar Bloquear', /No se elimina: tiene historial .* usa BLOQUEAR/.test(await page.getByTestId('user-action').innerText()) && await page.getByTestId('user-action').getByRole('button', { name: 'Sí, eliminar' }).count() === 0);
    await page.getByTestId('user-action').getByRole('button', { name: 'Entendido' }).click();
    await page.getByLabel('Buscar usuarios').fill('autorizo');
    check('búsqueda por función', await page.getByText('1 mostrados').isVisible() && await row('QA Admin A').count() === 1);
    await page.getByLabel('Buscar usuarios').fill('');
    await shot(page, 'usuarios_1_matriz');

    // Usuarios · alta y actualización (formulario del diseño; guardar valida y queda bloqueado: no hay endpoint de escritura)
    await row(buyer.name).getByRole('button', { name: 'Editar' }).click();
    await page.getByTestId('user-form').waitFor();
    await page.getByLabel('Nombre completo').waitFor();
    const val = async l => page.getByLabel(l, { exact: true }).inputValue();
    const form = page.getByTestId('user-form');
    check('formulario del diseño: encabezado, modo actualización y botón Guardar habilitado', (await form.innerText()).includes('Alta y actualización de usuarios') && /Modo actualización: QA/.test(await page.getByTestId('user-mode').innerText()) && await page.getByRole('button', { name: /Guardar usuario/ }).isEnabled());
    check('ficha con datos reales (editable)', await val('Nombre completo') === buyer.name && await val('Usuario / correo') === buyer.email && await val('Rol de acceso') === buyer.role_codes[0] && await val('Estatus') === 'active'
      && (await page.getByLabel('Contraseña', { exact: true }).getAttribute('placeholder')) === 'Déjala vacía para conservar la contraseña actual');
    const bf = ((await (await page.request.get(UI + '/api/v1/users/functions')).json()).items || []).find(x => x.id === buyer.id) || {};
    const buyerDocs = (bf.po_buyer || 0) + (bf.review_buyer || 0) + (bf.rfq_contact || 0); // misma suma que usersRoles/model.mjs
    check('función comprador marcada con sus documentos', await page.getByLabel('🛒 Comprador', { exact: true }).isChecked() && await page.getByText(`${buyerDocs} documento(s)`).isVisible() && !(await page.getByLabel('✅ Autorizó', { exact: true }).isChecked()));
    check('permisos de documento: estado registrado en MariaDB', !(await page.getByLabel('Autorizar Orden de Compra').isChecked()));
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    check('actualización sin cambios: "No hay cambios que guardar"', (await page.getByTestId('user-save-msg').innerText()).includes('No hay cambios que guardar'));
    await page.getByLabel('Teléfono', { exact: true }).fill('833 555 0101');
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    check('datos obligatorios faltantes en el registro (puesto) se exigen al guardar', buyer.position ? true : await form.getByText('Indica el puesto de trabajo.').count() >= 1);
    await page.getByLabel('Puesto de trabajo').fill(buyer.position || 'Comprador');
    await page.getByLabel('Autorizar Orden de Compra').check();
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    const sm = await page.getByTestId('user-save-msg').innerText();
    check('actualización válida: lista los cambios y NO se guarda (sin endpoint de escritura)', sm.includes('no se guardó') && sm.includes('teléfono') && sm.includes('permisos por documento') && (buyer.position ? true : sm.includes('puesto')) && writes.length === 0, sm);
    await page.getByLabel('Usuario / correo', { exact: true }).fill('qa.admin.a@supplyflow.invalid');
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    check('correo duplicado rechazado', await form.getByText('Ya existe un usuario con ese correo.').count() >= 1);
    await shot(page, 'usuarios_2_ficha');
    // Protección: el usuario de la sesión no puede quitarse Master Admin
    await page.getByLabel('Seleccionar usuario').selectOption(users.find(u => u.email === 'qa.admin.a@supplyflow.invalid').id);
    await page.getByLabel('Rol de acceso', { exact: true }).selectOption('buyer');
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    check('sin autobloqueo: no puedes quitarte Master Admin a ti mismo', await form.getByText(/a ti mismo/).count() >= 1);
    // Nueva captura
    await page.getByRole('button', { name: 'Limpiar' }).click();
    check('Limpiar: modo nueva captura con formulario vacío', /Modo nueva captura activo/.test(await page.getByTestId('user-mode').innerText()) && await val('Nombre completo') === '' && await val('Seleccionar usuario') === '');
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    const req = await Promise.all(['Indica el nombre completo.', 'Indica el usuario / correo.', 'Indica el puesto de trabajo.', 'Selecciona el rol de acceso.', 'La contraseña es obligatoria al habilitar el acceso al sistema.'].map(t => form.getByText(t, { exact: true }).count()));
    check('obligatorios: nombre, correo, puesto, rol y contraseña', req.every(n => n >= 1), req.join(','));
    await page.getByLabel('Nombre completo').fill('Persona Sintética QA');
    await page.getByLabel('Usuario / correo', { exact: true }).fill('persona.qa@supplyflow.invalid');
    await page.getByLabel('Puesto de trabajo').fill('Analista de compras');
    await page.getByLabel('Rol de acceso', { exact: true }).selectOption('buyer');
    await page.getByLabel('Contraseña', { exact: true }).fill('corta');
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    check('contraseña mínima de 8 caracteres', await form.getByText('La contraseña debe tener mínimo 8 caracteres.').count() >= 1);
    await page.getByLabel('Permitir acceso al sistema').uncheck();
    check('sin acceso: la contraseña se deshabilita y deja de ser obligatoria', await page.getByLabel('Contraseña', { exact: true }).isDisabled());
    await page.getByLabel('Fotografía del personal').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex') });
    check('fotografía: vista previa y "Eliminar fotografía" habilitado', await form.getByRole('img', { name: 'Vista previa de la fotografía' }).count() === 1 && await page.getByRole('button', { name: 'Eliminar fotografía' }).isEnabled());
    await page.getByRole('button', { name: /Guardar usuario/ }).click();
    const nm = await page.getByTestId('user-save-msg').innerText();
    check('alta válida: NO se guarda y la contraseña no se envía', nm.includes('no se guardó el alta de Persona Sintética QA') && nm.includes('no se envió') && writes.length === 0, nm);
    await page.getByRole('button', { name: 'Eliminar fotografía' }).click();
    check('Eliminar fotografía vuelve a las iniciales', await form.getByRole('img', { name: 'Vista previa de la fotografía' }).count() === 0);
    await shot(page, 'usuarios_3_alta');

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
