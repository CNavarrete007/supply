// Configuración · pestañas 1 a 7 · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta y se reporta. Los valores esperados salen
// de GET /api/v1/settings y /settings/email-log leídos aquí (no del código de la pantalla).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_NONADMIN_USER=<correo>] [SF_SHOTS=<dir>] node tests/frontend/settings_ui_e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const NONADMIN = process.env.SF_NONADMIN_USER || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const LANG = { es: 'Español', en: 'English' };
const EMAIL_LANG = { es: 'Español', en: 'Inglés', document: 'Usar el idioma de documentos para clientes' };
const TABS = ['Identidad y formatos', 'Matriz de parámetros', 'Aprobaciones de cotización', 'Condiciones de cotización', 'Correos automáticos', 'Respaldo e importación', 'Reinicio del sistema'];

async function login(page, email) {
  await page.goto(UI + '/');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.locator('nav button').first().waitFor({ timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 2200 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  let dialogAnswer = null; const dialogs = [];
  page.on('dialog', async d => { dialogs.push(`${d.type()}: ${d.message()}`); if (d.type() === 'prompt') await d.accept(dialogAnswer ?? ''); else if (dialogAnswer === false) await d.dismiss(); else await d.accept(); });
  const T = id => page.getByTestId(id);
  const tab = async i => { await page.locator('button').filter({ hasText: TABS[i - 1] }).first().click(); await page.waitForTimeout(250); };
  const msg = async section => flat(await T(`cfg-msg-${section}`).innerText());
  const save = async label => { await page.locator('button[type=submit]').filter({ hasText: label }).click(); };
  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `settings_${name}.png`), fullPage: true }); };
  try {
    await login(page, 'qa.admin.a@supplyflow.invalid');
    const api = async p => (await page.request.get(UI + p)).json();
    const s = await api('/api/v1/settings');
    const resp = page.waitForResponse(r => r.url().endsWith('/api/v1/settings'));
    await page.locator('nav button').filter({ hasText: /Configuración$/ }).click();
    check('la pantalla consulta GET /api/v1/settings (200)', (await resp).status() === 200);
    await T('cfg-status').filter({ hasText: 'solo lectura' }).waitFor();
    check('aviso: datos de MariaDB (solo lectura) y "Guardar" no guarda', /Datos de MariaDB \(solo lectura\)/i.test(await T('cfg-status').innerText()) && (await T('cfg-status').innerText()).includes('no los guarda'));
    check('sin el aviso genérico de módulo pendiente', !(await page.locator('main').innerText()).includes('Módulo pendiente de integración'));
    const body = flat(await page.locator('main').innerText());
    check('sin datos de demostración del diseño', !/Hornbeck|Hool Energy|compras@grupogerez|REQ-2026-0042/i.test(body));
    await shot('tab1');

    // ---- Pestaña 1 ----
    const val = n => page.locator(`[name=${n}]`).inputValue();
    check('identidad = MariaDB (nombre, texto inferior y empresa)', await val('nombreSistema') === s.identity.system_name && await val('textoInferior') === s.identity.slogan && await val('empresaContratista') === s.identity.company);
    check('idiomas de formatos = MariaDB', await val('idiomaPredeterminado') === LANG[s.identity.document_language] && await val('idiomaClientes') === LANG[s.identity.client_document_language] && await val('idiomaProveedores') === LANG[s.identity.supplier_document_language]);
    if (s.identity.logo.configured) {
      const logo = T('cfg-logo');
      const okImg = await logo.count() ? await logo.evaluate(img => img.complete && img.naturalWidth > 0) : false;
      const missing = (await page.locator('main').innerText()).includes('archivo no disponible en este equipo');
      check('logotipo registrado: se muestra el archivo verificado (o aviso si no está en el equipo)', okImg || missing);
    }
    await save('Guardar identidad e idiomas');
    check('Guardar sin cambios: "Sin cambios por guardar"', (await msg('identity')).includes('Sin cambios por guardar'));
    await page.locator('[name=nombreSistema]').fill('SISTEMA QA EDITADO');
    await page.locator('[name=idiomaProveedores]').selectOption('English');
    await save('Guardar identidad e idiomas');
    const m1 = await msg('identity');
    check('Guardar con cambios: validado y NO guardado, con los campos detectados', m1.includes('Datos validados, pero no se guardó la identidad e idiomas') && m1.includes('Nombre mostrado en el sistema') && m1.includes('Documentos para proveedores') && m1.endsWith('No se guardó nada en MariaDB.'));
    await page.locator('[name=nombreSistema]').fill('');
    await save('Guardar identidad e idiomas');
    check('validación: nombre vacío', (await T('cfg-msg-identity').getAttribute('role')) === 'alert' && (await msg('identity')).includes('Captura nombre mostrado en el sistema'));
    await page.locator('input[type=file][accept^="image/"]').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
    await page.locator('[name=nombreSistema]').fill(s.identity.system_name);
    await save('Guardar identidad e idiomas');
    check('validación: logotipo solo PNG/JPEG/WebP (sin subirlo)', (await msg('identity')).includes('El logotipo debe ser PNG, JPEG o WebP'));

    // ---- Pestaña 2 ----
    await tab(2); await shot('tab2');
    const opts = await page.locator('[name=monedaBase] option:not([disabled])').allInnerTexts();
    check('moneda base: opciones = monedas de MariaDB', JSON.stringify(opts) === JSON.stringify(s.currencies.map(c => c.code)));
    const p = s.parameters;
    check('parámetros = MariaDB', await val('monedaBase') === (p.currency || '') && await val('prefijoRequisicion') === (p.req_prefix || '') && await val('prefijoOrdenCompra') === (p.po_prefix || '')
      && await val('diasAlerta') === String(p.alert_days ?? '') && await val('cotizacionesMinimas') === String(p.min_quotes ?? '') && await val('ivaDefecto') === String(p.tax_pct ?? ''));
    const table = flat(await page.locator('form table').innerText());
    check('tabla de aplicación con los valores leídos', table.includes(`${p.tax_pct}%`) && table.includes(p.req_prefix || '-'));
    await page.locator('[name=ivaDefecto]').fill('150');
    await save('Guardar parámetros');
    check('validación: IVA fuera de rango', (await msg('params')).includes('El IVA debe ser un porcentaje entre 0 y 100'));
    await page.locator('[name=ivaDefecto]').fill('8');
    await save('Guardar parámetros');
    check('parámetros: validado y no guardado (IVA)', (await msg('params')).includes('Cambios detectados: IVA por defecto %. No se guardó nada en MariaDB.'));
    check('pestaña conserva los cambios locales al cambiar de pestaña', (await tab(1), await tab(2), await val('ivaDefecto')) === '8');

    // ---- Pestaña 3 ----
    await tab(3); await shot('tab3');
    const a = s.approvals;
    check('aprobaciones = MariaDB', await val('activarRegla') === (a.enabled === true ? 'Sí, aplicar automáticamente' : a.enabled === false ? 'No, requerir siempre 3 firmas' : '')
      && await val('monedaRegla') === (a.currency || '') && Number(await val('limiteArticulo')) === Number(a.item_limit) && Number(await val('limiteTotal')) === Number(a.total_limit));
    const rc = await page.locator('[name=monedaRegla] option:not([disabled])').allInnerTexts();
    check('moneda de la regla: "código · nombre" del catálogo', JSON.stringify(rc) === JSON.stringify(s.currencies.map(c => `${c.code} · ${c.name}`)));
    const pol = flat(await T('cfg-policy').innerText());
    check('política versionada vigente mostrada (approval_policy_versions)', a.policy ? pol.includes(`Política versionada vigente v${a.policy.version_number}`) : pol.includes('No hay una política versionada'));
    await page.locator('[name=limiteArticulo]').fill(String(Number(a.total_limit || 0) + 1000));
    check('aviso no bloqueante: total menor que artículo', (await T('cfg-policy').innerText()).includes('El límite total es menor que el límite por artículo'));
    await save('Guardar límites de aprobación');
    check('aprobaciones: validado y no guardado', (await msg('approvals')).includes('Límite por artículo') && (await msg('approvals')).includes('No se guardó nada en MariaDB'));

    // ---- Pestaña 4 ----
    await tab(4); await shot('tab4');
    const rows = page.locator('form textarea');
    check('condiciones: filas = MariaDB (ES/EN)', await rows.count() === s.conditions.length * 2 && (s.conditions.length === 0 || await rows.nth(0).inputValue() === s.conditions[0].es));
    const act = s.conditions.filter(c => c.active).length;
    check('contador de condiciones activas', (await page.locator('main').innerText()).includes(`${act} condición(es) activa(s)`));
    const prev = flat(await page.locator('main').innerText());
    check('vista previa sustituye {CURRENCY} por la moneda base', !s.conditions.some(c => c.active && c.es.includes('{CURRENCY}')) || prev.includes(s.conditions.find(c => c.active && c.es.includes('{CURRENCY}')).es.replaceAll('{CURRENCY}', p.currency)));
    const addBtn = page.locator('button').filter({ hasText: 'Agregar condición' });
    for (let i = s.conditions.length; i < 8; i++) await addBtn.click();
    await addBtn.click();
    check('máximo 8 condiciones', await rows.count() === 16 && (await msg('conditions')).includes('máximo 8 condiciones'));
    await save('Guardar condiciones de cotización');
    check('condiciones: validado y no guardado (número de condiciones)', (await msg('conditions')).includes(`Número de condiciones (${s.conditions.length} → 8)`));
    dialogAnswer = true; await page.locator('button').filter({ hasText: 'Restablecer predeterminadas' }).click(); await page.waitForTimeout(200);
    check('Restablecer vuelve a las condiciones de MariaDB', await rows.count() === s.conditions.length * 2 && dialogs.some(d => d.includes('condiciones registradas en MariaDB')));
    await save('Guardar condiciones de cotización');
    check('tras restablecer: sin cambios por guardar', (await msg('conditions')).includes('Sin cambios por guardar'));

    // ---- Pestaña 5 ----
    const hResp = page.waitForResponse(r => r.url().includes('/api/v1/settings/email-log'));
    await tab(5);
    check('historial consulta GET /settings/email-log (200)', (await hResp).status() === 200);
    await page.waitForTimeout(400); await shot('tab5');
    const e = s.email;
    const chk = n => page.locator(`input[name=${n}]`).isChecked();
    check('interruptores = MariaDB', await chk('activarInternos') === e.internal_enabled && await chk('copiarComprador') === e.cc_buyer && await chk('copiarAdministradores') === e.cc_admin
      && await chk('activarCliente') === e.client_enabled && await chk('confirmarRequisicion') === e.req_created && await chk('avisarAvances') === e.process_updates && await chk('avisarCotizacion') === e.quote_client);
    check('remitente, respuesta, idioma y máximo = MariaDB', await val('nombreRemitente') === (e.sender_name || '') && await val('correoResponder') === (e.reply_to || '')
      && await val('idiomaCliente') === (EMAIL_LANG[e.client_language] || '') && await val('maxDestinatarios') === String(e.max_recipients ?? ''));
    const log = await api('/api/v1/settings/email-log?page=1&page_size=10');
    const mailRows = T('cfg-mail-row');
    check('historial: filas = primera página de MariaDB y contador = total', await mailRows.count() === log.items.length && (await page.locator('main').innerText()).includes(`${log.total} registros`));
    if (log.items.length) {
      const r0 = flat(await mailRows.nth(0).innerText());
      check('historial: evento, referencia, destinatarios y resultado reales', r0.includes(log.items[0].event) && r0.includes(log.items[0].reference) && log.items[0].recipients.every(x => r0.includes(`${x.kind}: ${x.address}`)) && r0.includes(log.items[0].status));
    }
    const fOpts = await page.locator('select').filter({ hasText: 'Todos los resultados' }).locator('option').allInnerTexts();
    check('filtro de resultado: opciones = facetas reales', JSON.stringify(fOpts.slice(1)) === JSON.stringify(log.statuses.map(x => `${x.status} (${x.count})`)));
    if (log.statuses.length) {
      const st = log.statuses[log.statuses.length - 1];
      await page.locator('select').filter({ hasText: 'Todos los resultados' }).selectOption(st.status); await page.waitForTimeout(600);
      const shown = await mailRows.allInnerTexts();
      check('filtro aplicado en el servidor', shown.length === Math.min(10, st.count) && shown.every(t => t.includes(st.status)));
      await page.locator('select').filter({ hasText: 'Todos los resultados' }).selectOption('');
    }
    await page.locator('input[placeholder^="Buscar por evento"]').fill('zz-sin-coincidencias-qa'); await page.waitForTimeout(900);
    check('búsqueda sin coincidencias: estado vacío', await mailRows.count() === 0 && (await page.locator('main').innerText()).includes('No hay correos registrados con estos filtros'));
    await page.locator('input[placeholder^="Buscar por evento"]').fill(''); await page.waitForTimeout(900);
    check('paginación: "Página 1 de N"', (await page.locator('main').innerText()).includes(`Página 1 de ${Math.max(1, Math.ceil(log.total / 10))}`));
    await page.locator('button').filter({ hasText: 'Consultar cuota disponible' }).click();
    check('cuota: mensaje honesto (sin servicio de correo conectado)', (await msg('email')).includes('No hay un servicio de envío de correos conectado'));
    await page.locator('[name=correoResponder]').fill('no-es-correo');
    await save('Guardar correos automáticos');
    check('validación: correo para responder', (await msg('email')).includes('Captura un correo válido'));
    await page.locator('[name=correoResponder]').fill(e.reply_to || '');
    await page.locator('input[name=avisarAvances]').click();
    await save('Guardar correos automáticos');
    check('correos: validado y no guardado', (await msg('email')).includes('Avisar avances del proceso') && (await msg('email')).includes('No se guardó nada en MariaDB'));

    // ---- Pestaña 6 ----
    await tab(6); await shot('tab6');
    const t6 = flat(await page.locator('main').innerText());
    check('textos corregidos: MariaDB, sin Google Sheets', t6.includes('MariaDB + Archivo JSON') && !/Google Sheets|Google Apps Script/.test(t6));
    const dl = page.waitForEvent('download');
    await page.locator('button').filter({ hasText: 'Exportar respaldo' }).click();
    const file = path.join(os.tmpdir(), `sf-config-${process.pid}.json`); await (await dl).saveAs(file);
    const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
    check('exportar: JSON con la configuración leída de MariaDB', exp.source === 'MariaDB · organization_settings' && exp.parameters.currency === s.parameters.currency && exp.conditions.length === s.conditions.length && !/password/i.test(JSON.stringify(exp)));
    await page.locator('input[type=file][accept^=".json"]').setInputFiles(file);
    await page.waitForTimeout(300);
    check('importar: verifica el archivo y NO lo aplica', (await msg('backup')).includes('Archivo JSON válido') && (await msg('backup')).includes('No se aplicó'));
    await page.locator('input[type=file][accept^=".json"]').setInputFiles({ name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{malo') });
    await page.waitForTimeout(300);
    check('importar: JSON inválido', (await msg('backup')).includes('formato JSON inválido'));
    fs.unlinkSync(file);

    // ---- Pestaña 7 ----
    await tab(7); await shot('tab7');
    const t7 = flat(await page.locator('main').innerText());
    check('textos corregidos: solo datos de este navegador; MariaDB no se toca', t7.includes('no toca MariaDB') && t7.includes('Limpiar datos de este navegador') && !t7.includes('estado de fábrica'));
    dialogAnswer = 'OTRA'; await page.locator('button').filter({ hasText: 'Limpiar datos de este navegador' }).click(); await page.waitForTimeout(200);
    check('confirmación incorrecta: se cancela', (await msg('reset')).includes('Texto de confirmación incorrecto'));
    dialogAnswer = 'REINICIAR'; await page.locator('button').filter({ hasText: 'Limpiar datos de este navegador' }).click(); await page.waitForTimeout(200);
    check('confirmación correcta: limpia solo el navegador', (await msg('reset')).includes('Los registros de MariaDB no se modificaron'));
    const after = await api('/api/v1/settings');
    check('MariaDB intacta tras todas las acciones', JSON.stringify(after) === JSON.stringify(s));

    // ---- Inglés ----
    await page.locator('header button').filter({ hasText: 'English' }).click(); await page.waitForTimeout(300);
    check('idioma inglés: aviso traducido', (await T('cfg-status').innerText()).toLowerCase().includes('mariadb data (read-only)'));
    await page.locator('header button').filter({ hasText: 'Español' }).click();

    // ---- Usuario sin Master Admin ----
    if (NONADMIN) {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 1400 } }); const p2 = await ctx2.newPage(); p2.on('pageerror', e2 => jsErrors.push(String(e2)));
      await login(p2, NONADMIN);
      const nav = p2.locator('nav button').filter({ hasText: /Configuración$/ });
      if (await nav.count()) {
        await nav.click(); await p2.getByTestId('cfg-status').filter({ hasText: /acceso|leer/ }).waitFor();
        const t = flat(await p2.getByTestId('cfg-status').innerText());
        check('sin Master Admin: error de acceso sin "Reintentar" y sin valores', t.includes('No tienes acceso a este módulo') && !t.includes('Reintentar') && await p2.locator('[name=nombreSistema]').inputValue() === '');
      } else check('sin Master Admin: la opción Configuración no aparece', true);
      await ctx2.close();
    }
  } catch (err) {
    check('ejecución sin excepciones', false, String(err).slice(0, 400));
  } finally {
    check('sin escrituras a la API (todo GET)', writes.length === 0, writes.join(', '));
    check('sin errores de JavaScript', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
    await browser.close();
  }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nConfiguración (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
