// Gestión del Contratista · tarjeta 1 "Registro de validación" · E2E de interfaz (Chromium) contra Vite + API + MariaDB
// SINTÉTICAS. Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta. Valores esperados desde la API.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/contractor_mgmt_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ');

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
    const setup = await api('/api/v1/contractor-management/validation-setup');
    const reviewed = setup.requisitions.find(r => r.review_count > 0 && r.rfq_count > 0);
    const fresh = setup.requisitions.find(r => r.review_count === 0 && r.rfq_count === 0 && r.po_count === 0);
    const buyer = setup.buyers.find(b => b.has_user && b.with_access);

    const first = page.waitForResponse(r => r.url().includes('/api/v1/contractor-management/validation-setup'));
    await page.locator('nav button').filter({ hasText: /Gestión del Contratista$/ }).click();
    check('consulta MariaDB al abrir (200)', (await first).status() === 200);
    const fm = page.getByTestId('validation-register'); await fm.waitFor();
    const fld = l => fm.getByLabel(l, { exact: true });
    await fld('Requisición').locator('option').nth(setup.requisitions.length).waitFor({ state: 'attached' });
    const t0 = flat(await fm.innerText());
    check('título, explicación, Paso 2 y modo nueva captura del diseño', ['Gestión interna del contratista', 'Este es el paso intermedio antes de cotizar y emitir la orden de compra.', 'Paso 2 · Validación interna', 'Modo nueva captura activo. Completa la información y presiona Guardar.', 'Selecciona una requisición para revisar su contexto.', 'Personal del contratista activo registrado en Contratista → Personal / contactos.'].every(x => t0.includes(x)), t0.slice(0, 300));
    check('sin aviso genérico; aviso propio de la tarjeta conectada', await page.getByText('Módulo pendiente de integración').count() === 0 && (await page.getByTestId('contractor-mgmt-notice').innerText()).includes('Registro de validación conectado a MariaDB'));
    check('valores iniciales: Automático, Pendiente ×3, Competencia abierta, 3 y criterios', await fld('Folio interno').inputValue() === 'Automático' && await fld('Validación técnica').inputValue() === 'Pendiente' && await fld('Validación contractual').inputValue() === 'Pendiente'
      && await fld('Disponibilidad presupuestal').inputValue() === 'Pendiente' && await fld('Estrategia de compra').inputValue() === 'Competencia abierta' && await fld('Número mínimo de cotizaciones').inputValue() === '3'
      && await fld('Criterios de evaluación').inputValue() === 'Precio, plazo, calidad, cumplimiento documental' && await fld('Referencia interna').getAttribute('placeholder') === 'Automática desde la requisición');
    check('opciones del diseño', JSON.stringify(await fld('Validación técnica').locator('option').allInnerTexts()) === '["Pendiente","Conforme","Con observaciones","No conforme"]'
      && JSON.stringify(await fld('Disponibilidad presupuestal').locator('option').allInnerTexts()) === '["Pendiente","Disponible","Parcial","No disponible"]'
      && JSON.stringify(await fld('Estrategia de compra').locator('option').allInnerTexts()) === '["Competencia abierta","Proveedor preferente","Compra urgente","Fuente única justificada"]');
    check(`requisiciones reales en el selector (${setup.requisitions.length})`, await fld('Requisición').locator('option').count() === setup.requisitions.length + 1);
    check(`responsables = personal activo del contratista (${setup.buyers.length})`, await fld('Responsable de compras').locator('option').count() === setup.buyers.length + 1);
    await shot(page, 'cm_1_empty');
    await fm.getByRole('button', { name: /Guardar validación/ }).click();
    check('guardar sin requisición la pide', (await page.getByTestId('validation-save-msg').innerText()).includes('Selecciona la requisición.'));
    await fm.getByRole('button', { name: /Siguiente paso/ }).click();
    check('Siguiente paso sin requisición se bloquea', (await page.getByTestId('validation-save-msg').innerText()).includes('Selecciona una requisición para continuar.'));

    // Requisición con validación registrada: contexto e historial
    const dr = page.waitForResponse(r => r.url().includes(`/contractor-management/requisitions/${reviewed.id}`));
    await fld('Requisición').selectOption(reviewed.id);
    check('contexto de la requisición consultado (200)', (await dr).status() === 200);
    await page.getByTestId('validation-history').waitFor();
    const det = await api(`/api/v1/contractor-management/requisitions/${reviewed.id}`);
    const ctx = flat(await page.getByTestId('validation-context').innerText());
    check('contexto: folio, cliente, proyecto, partidas y documentos posteriores', [det.item.folio, det.item.client_name, `${det.items.length} partida(s)`, `${det.item.rfq_count} RFQ`, `${det.item.po_count} OC`, det.items[0].description].every(x => ctx.includes(x)), ctx.slice(0, 400));
    const last = det.reviews[0];
    const hist = flat(await page.getByTestId('validation-history').innerText());
    check('validaciones registradas con folio, responsable, resultados y ¿puede cotizar?', [`Validaciones registradas (${det.reviews.length})`, last.folio, last.buyer, last.technical, last.contract, last.budget, last.strategy].every(x => hist.includes(x)) && /Sí|No \(Bloqueado\)/.test(hist), hist.slice(0, 400));
    check('referencia interna automática desde la requisición', await fld('Referencia interna').inputValue() === (det.item.internal_reference || 'Sin referencia interna registrada'));
    await shot(page, 'cm_1_context');

    // Captura: validaciones del formulario
    await fld('Responsable de compras').selectOption(buyer.id);
    await fld('Número mínimo de cotizaciones').fill('0');
    await fld('Disponibilidad presupuestal').selectOption('No disponible');
    await fm.getByRole('button', { name: /Guardar validación/ }).click();
    const e1 = flat(await fm.innerText());
    check('errores: mínimo de cotizaciones y justificación sin presupuesto', e1.includes('Captura un número entero de 1 a 20.') && e1.includes('Justifica la fuente única o el resultado no conforme / sin presupuesto'), e1.slice(-600));
    check('veredicto en vivo: no puede pasar a cotización', (await page.getByTestId('validation-verdict').innerText()).includes('No (técnica pendiente, contractual pendiente, presupuesto no disponible)'));
    await fm.getByRole('button', { name: /Siguiente paso/ }).click();
    check('Siguiente paso bloqueado con el motivo', (await page.getByTestId('validation-save-msg').innerText()).includes('No puede avanzar a Estrategia y lotificación: técnica pendiente'));
    await fld('Validación técnica').selectOption('Conforme'); await fld('Validación contractual').selectOption('Con observaciones'); await fld('Disponibilidad presupuestal').selectOption('Parcial');
    await fld('Número mínimo de cotizaciones').fill('3');
    await fld('Fecha límite de cotización').fill('2020-01-01');
    await fm.getByRole('button', { name: /Guardar validación/ }).click();
    check('fecha límite anterior a hoy rechazada', flat(await fm.innerText()).includes('La fecha límite de cotización no puede ser anterior a hoy.'));
    const future = await page.evaluate(() => { const d = new Date(Date.now() + 5 * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    await fld('Fecha límite de cotización').fill(future);
    await fld('Observaciones internas / justificación').fill('Validación sintética de prueba E2E');
    check('veredicto en vivo: sí puede pasar a cotización', (await page.getByTestId('validation-verdict').innerText()).includes('Sí'));
    await fm.getByRole('button', { name: /Guardar validación/ }).click();
    const sm = flat(await page.getByTestId('validation-save-msg').innerText());
    check('guardar: validado pero NO guardado (resumen)', sm.startsWith(`Datos validados, pero no se guardó la validación interna de ${reviewed.folio} (técnica conforme, contractual con observaciones, presupuesto parcial, competencia abierta, 3 cotización(es), responsable ${buyer.name}, puede cotizar)`), sm);
    const warn = flat(await fm.innerText());
    check('advertencias: historial y documentos posteriores', warn.includes(`ya tiene ${det.reviews.length} validación(es) registrada(s)`) && warn.includes('La requisición ya avanzó'), warn.slice(-800));
    await shot(page, 'cm_1_saved');
    await fm.getByRole('button', { name: /Limpiar/ }).click();
    check('Limpiar conserva la requisición y restablece la captura', await fld('Requisición').inputValue() === reviewed.id && await fld('Responsable de compras').inputValue() === '' && await fld('Validación técnica').inputValue() === 'Pendiente' && await page.getByTestId('validation-save-msg').count() === 0);
    await fm.getByRole('button', { name: /Nueva validación/ }).click();
    check('Nueva validación limpia también la requisición', await fld('Requisición').inputValue() === '' && await page.getByTestId('validation-context').count() === 0);

    // Requisición sin validación: Siguiente paso navega a Estrategia y lotificación
    await fld('Requisición').selectOption(fresh.id);
    await page.getByTestId('validation-history').waitFor();
    check('requisición sin validaciones', (await page.getByTestId('validation-history').innerText()).includes('Sin validaciones registradas para esta requisición.'));
    await fld('Validación técnica').selectOption('Conforme'); await fld('Validación contractual').selectOption('Conforme'); await fld('Disponibilidad presupuestal').selectOption('Disponible');
    await fm.getByRole('button', { name: /Siguiente paso/ }).click();
    await page.getByTestId('strategy-lots').waitFor();
    check('Siguiente paso abre Estrategia y lotificación (conectada)', (await page.getByTestId('contractor-mgmt-notice').innerText()).includes('Estrategia y lotificación conectada a MariaDB'));
    await page.getByRole('button', { name: /Registro de validación/ }).first().click();
    await page.getByTestId('validation-register').getByRole('button', { name: /Ver matriz/ }).click();
    await page.getByText('Matriz de validaciones internas').first().waitFor();
    check('Ver matriz abre Matriz de validaciones', true);
    // 2 · Estrategia y lotificación
    const tset = await api('/api/v1/contractor-management/strategy-setup');
    const okReq = tset.requisitions.filter(r => ['Conforme', 'Con observaciones'].includes(r.technical) && ['Conforme', 'Con observaciones'].includes(r.contract_result) && ['Disponible', 'Parcial'].includes(r.budget));
    const withPlan = okReq.find(r => r.plan_count > 0); const noPlan = okReq.find(r => r.plan_count === 0);
    const blocked = tset.requisitions.find(r => !okReq.includes(r));
    const ss = await api(`/api/v1/contractor-management/strategy/${withPlan.id}`);
    const sn = await api(`/api/v1/contractor-management/strategy/${noPlan.id}`);
    await page.getByRole('button', { name: /Estrategia y lotificación/ }).first().click();
    const sg = page.getByTestId('strategy-lots'); await sg.waitFor();
    const sfl = l => sg.getByLabel(l, { exact: true });
    await sfl('Requisición validada').locator('option').nth(tset.requisitions.length).waitFor({ state: 'attached' });
    const s0 = flat(await sg.innerText());
    check('estrategia: título, explicación, Paso 3 y pasos del diseño', ['Estrategia y lotificación de abastecimiento', 'Una sola requisición puede generar varios lotes, varias RFQ y varias órdenes de compra sin duplicar la solicitud del cliente.', 'Paso 3 · Abastecimiento por partida', 'Selecciona una requisición validada para definir la estrategia por partida.'].every(x => s0.includes(x))
      && flat(await page.getByTestId('strategy-stepper').innerText()) === '1 Solicitud 2 Validación 3 Lotificación 4 RFQ por lote 5 Comparativo', s0.slice(0, 300));
    check(`estrategia: requisiciones con validación vigente (${tset.requisitions.length}); bloqueadas deshabilitadas`, await sfl('Requisición validada').locator('option').count() === tset.requisitions.length + 1
      && (!blocked || await sfl('Requisición validada').locator(`option[value="${blocked.id}"]`).evaluate(o => o.disabled)));
    const sr1 = page.waitForResponse(r => r.url().includes(`/contractor-management/strategy/${withPlan.id}`));
    await sfl('Requisición validada').selectOption(withPlan.id);
    check('estrategia: detalle consultado (200)', (await sr1).status() === 200);
    await page.getByTestId('strategy-lot').first().waitFor();
    const lot0 = ss.plan.lots[0];
    const sctx = flat(await page.getByTestId('strategy-context').innerText());
    check('estrategia: responsable, mínimo y contexto con plan registrado', await sfl('Responsable de compras').inputValue() === String(ss.item.buyer).toUpperCase() && await sfl('Mínimo general de cotizaciones').inputValue() === String(ss.plan.min_quotes)
      && sctx.includes(`${ss.items.length} partida(s)`) && sctx.includes(`Contrato: ${ss.item.contract}`) && sctx.includes(`Estrategia registrada en MariaDB: versión ${ss.plan.version}`), sctx);
    const lc = flat(await page.getByTestId('strategy-lot').first().innerText());
    check('estrategia: lote registrado con sus proveedores y RFQ creadas', await sg.getByLabel('Nombre del lote 1').inputValue() === lot0.name && (await page.getByTestId('strategy-lot-rfq').first().innerText()).trim() === `${lot0.rfqs.length}/${lot0.suppliers.filter(x => x.selected).length} RFQ creadas`
      && lc.includes('RFQ creada: ' + lot0.rfqs[0].folio), lc);
    const stt = flat(await page.getByTestId('strategy-stats').innerText()).toLowerCase();
    check('estrategia: métricas del diseño', stt.includes(`${ss.items.length} partidas`) && stt.includes('1 lotes') && stt.includes(`${lot0.suppliers.filter(x => x.selected).length} proveedores`) && stt.includes(`${lot0.suppliers.filter(x => x.selected).length - lot0.rfqs.length} rfq pendientes`), stt);
    await sg.getByRole('button', { name: /Abrir siguiente RFQ/ }).first().click();
    const nr = flat(await page.getByTestId('strategy-msg').innerText());
    check('Abrir siguiente RFQ: siguiente proveedor sin RFQ del lote, sin abrirla (bloqueada)', nr.includes(`Siguiente RFQ del lote «${lot0.name}»`) && nr.includes('No se abrió') && await page.getByTestId('strategy-msg').getByRole('button', { name: /Ir a Cotizaciones/ }).isVisible(), nr);
    // Requisición sin plan: propuesta por categoría y sugerencias del catálogo
    await sfl('Requisición validada').selectOption(noPlan.id);
    await page.getByTestId('strategy-context').filter({ hasText: noPlan.folio }).waitFor();
    check('sin plan: propuesta agrupada por categoría', flat(await page.getByTestId('strategy-context').innerText()).includes('Sin estrategia registrada: se propone una agrupación por categoría.') && await page.getByTestId('strategy-lot').count() === new Set(sn.items.map(i => i.category || 'Sin categoría')).size);
    const sugg = tset.suppliers.filter(x => ['authorized', 'active'].includes(x.status) && [x.category, ...x.offering_categories].some(c => c && c.toLowerCase() === String(sn.items[0].category).toLowerCase()));
    check(`sin plan: proveedores sugeridos por categoría/suministros (${sugg.length})`, await page.getByTestId('strategy-lot').first().getByTestId('strategy-supplier').count() === sugg.length && (sugg.length === 0 || flat(await page.getByTestId('strategy-lot').first().innerText()).includes('Sugerido por catálogo')));
    check('catálogo: autorizados y disponibles', flat(await page.getByTestId('strategy-catalog').innerText()).includes(`${tset.summary.authorized} Autorizado/Activo · ${tset.summary.available} disponible(s) para asignación manual`));
    await sg.getByRole('button', { name: /Nuevo lote/ }).click();
    check('+ Nuevo lote agrega un lote vacío', await page.getByTestId('strategy-lot').count() === new Set(sn.items.map(i => i.category || 'Sin categoría')).size + 1 && flat(await page.getByTestId('strategy-lot').last().innerText()).toLowerCase().includes('sin partidas asignadas'));
    await sg.getByLabel('Estrategia #1').selectOption('Precio histórico auto');
    check('Precio histórico auto: ruta sin RFQ y sin lote', flat(await page.getByTestId('strategy-line').first().innerText()).includes('Precio histórico (sin RFQ)') && await sg.getByLabel('Lote #1').isDisabled() && flat(await page.getByTestId('strategy-stats').innerText()).toLowerCase().includes('1 sin rfq'));
    await sg.getByLabel('Estrategia #1').selectOption('Competencia abierta');
    await sg.getByRole('button', { name: 'Guardar estrategia', exact: true }).click();
    check('guardar: partida sin lote marcada', flat(await sg.innerText()).includes('Asigna la partida a un lote.'));
    await sg.getByRole('button', { name: /Agrupar automáticamente por categoría/ }).click();
    const addSel = sg.getByLabel('Agregar otro proveedor 1');
    const manual = await addSel.locator('option').nth(1).getAttribute('value');
    await addSel.selectOption(manual); await page.getByTestId('strategy-lot').first().getByRole('button', { name: 'Agregar', exact: true }).click();
    check('agregar proveedor manual', flat(await page.getByTestId('strategy-lot').first().innerText()).includes('Asignación manual'));
    await sg.getByLabel('Mínimo de cotizaciones del lote 1').fill('20');
    await sg.getByRole('button', { name: 'Guardar estrategia', exact: true }).click();
    const sv = flat(await page.getByTestId('strategy-msg').innerText());
    check('guardar estrategia: validado pero NO guardado, con advertencia de mínimo', sv.startsWith(`Datos validados, pero no se guardó la estrategia de ${noPlan.folio}`) && flat(await sg.innerText()).includes('el mínimo configurado es 20. Puedes guardar, pero documenta la excepción si continúas así.'), sv);
    await sg.getByRole('button', { name: /Guardar y abrir siguiente RFQ/ }).click();
    check('guardar y abrir siguiente RFQ: no escribe e indica la siguiente RFQ', flat(await page.getByTestId('strategy-msg').innerText()).includes('Siguiente RFQ del lote'));
    await shot(page, 'cm_2_strategy');
    await sg.getByRole('button', { name: /Ver validaciones/ }).click();
    await page.getByText('Matriz de validaciones internas').first().waitFor();
    check('Ver validaciones abre la matriz', true);
    await page.getByRole('button', { name: /Registro de validación/ }).first().click();
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin escrituras /api intentadas', writes.length === 0, writes.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nGestión del Contratista UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
