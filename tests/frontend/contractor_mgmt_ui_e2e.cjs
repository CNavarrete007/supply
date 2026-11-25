// Gestión del Contratista · tarjeta 1 "Registro de validación" · E2E de interfaz (Chromium) contra Vite + API + MariaDB
// SINTÉTICAS. Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta; los guardados (que ya escriben) se
// intentan y, sin respuesta, NO deben darse por guardados. El guardado real: contractor_mgmt_write_ui_e2e.cjs. Valores desde la API.
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
    await page.getByTestId('validation-save-msg').filter({ hasText: /No se confirmó/ }).waitFor({ timeout: 15000 });
    const sm = flat(await page.getByTestId('validation-save-msg').innerText());
    check('guardar: intenta el POST y, sin respuesta, NO lo da por guardado', writes.at(-1) === 'POST /api/v1/contractor-management/validations' && sm.startsWith('No se confirmó el guardado') && !/guardada en MariaDB/.test(sm), `${writes.join(',')} · ${sm}`);
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
    // Las pruebas de escritura agregan requisiciones con plan propio: se eligen explícitamente el fixture con plan y RFQ y el sin plan con OC.
    const withPlan = okReq.find(r => r.plan_count > 0 && r.rfq_count > 0) || okReq.find(r => r.plan_count > 0);
    const noPlan = okReq.find(r => r.plan_count === 0 && r.has_po) || okReq.find(r => r.plan_count === 0);
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
    // La base sintética acumula proveedores (las pruebas de Proveedores no pueden eliminarlos): para provocar la advertencia
    // de mínimo deben quedar menos de 20 seleccionados en el lote 1, sin depender de cuántos sugiera el catálogo.
    const boxes = page.getByTestId('strategy-lot').first().locator('input[type=checkbox][aria-label^="Seleccionar "]');
    let selected = 0; for (let i = 0; i < await boxes.count(); i++) if (await boxes.nth(i).isChecked()) selected++;
    for (let i = 0; selected >= 20 && i < await boxes.count(); i++) if (await boxes.nth(i).isChecked()) { await boxes.nth(i).uncheck(); selected--; }
    await sg.getByLabel('Mínimo de cotizaciones del lote 1').fill('20');
    await sg.getByRole('button', { name: 'Guardar estrategia', exact: true }).click();
    await page.getByTestId('strategy-msg').filter({ hasText: /No se confirmó/ }).waitFor({ timeout: 15000 });
    const sv = flat(await page.getByTestId('strategy-msg').innerText());
    check('guardar estrategia: intenta el PUT, sin respuesta NO lo da por guardado; advertencia de mínimo', writes.at(-1) === `PUT /api/v1/contractor-management/strategy/${noPlan.id}` && sv.startsWith('No se confirmó el guardado') && flat(await sg.innerText()).includes('el mínimo configurado es 20. Puedes guardar, pero documenta la excepción si continúas así.'), `${writes.at(-1)} · ${sv}`);
    await sg.getByTestId('strategy-lot').first().getByRole('button', { name: 'Abrir siguiente RFQ' }).click();
    check('abrir siguiente RFQ: no escribe e indica la siguiente RFQ', flat(await page.getByTestId('strategy-msg').innerText()).includes('Siguiente RFQ del lote') && flat(await page.getByTestId('strategy-msg').innerText()).includes('No se abrió'));
    await shot(page, 'cm_2_strategy');
    await sg.getByRole('button', { name: /Ver validaciones/ }).click();
    await page.getByText('Matriz de validaciones internas').first().waitFor();
    check('Ver validaciones abre la matriz', true);

    // 3 · Matriz de validaciones internas
    const mxa = await api('/api/v1/contractor-management/validations?page=1&page_size=50');
    const vm = page.getByTestId('validation-matrix'); await vm.waitFor();
    await page.getByTestId('validation-matrix-chip').waitFor();
    const m0 = flat(await vm.innerText());
    check('matriz: título, explicación, "+ Nueva validación" y tarjetas por responsable del diseño', ['Matriz de validaciones internas', 'Consulta si cada requisición puede o no pasar a cotización.', 'Tarjetas por responsable', 'Selecciona un responsable para abrir únicamente sus validaciones internas.'].every(x => m0.includes(x)) && await vm.getByRole('button', { name: /Nueva validación/ }).isVisible(), m0.slice(0, 300));
    check('matriz: chip "N responsable(s) · M validación(es)"', (await page.getByTestId('validation-matrix-chip').innerText()).trim() === `${mxa.summary.buyers.length} responsable(s) · ${mxa.summary.validations} validación(es)`);
    const mc = page.getByTestId('validation-buyer-card');
    check('matriz: tarjeta "Todas" + una por responsable con validaciones, puede cotizar y bloqueadas', await mc.count() === mxa.summary.buyers.length + 1
      && flat(await mc.first().innerText()).includes(`TOD Todas las validaciones Vista general ${mxa.summary.validations} Validaciones ${mxa.summary.can_quote} Puede cotizar ${mxa.summary.blocked} Bloqueadas Abrir todas`), flat(await mc.first().innerText()));
    check('matriz cerrada hasta elegir tarjeta', await page.getByTestId('validation-row').count() === 0);
    const vr = page.waitForResponse(r => /\/contractor-management\/validations\?/.test(r.url()) && /buyer=all/.test(r.url()));
    await mc.first().click();
    check('matriz: consulta en el servidor (200)', (await vr).status() === 200);
    await page.getByTestId('validation-row').first().waitFor();
    check('matriz: "Todas las validaciones · N registro(s)" y Volver a tarjetas', flat(await page.getByTestId('validation-matrix-selected').innerText()).includes(`Todas las validaciones ${mxa.total} registro(s)`) && await page.getByTestId('validation-row').count() === Math.min(10, mxa.total));
    const r0 = mxa.items[0]; const rowEl = page.getByTestId('validation-row').filter({ hasText: r0.folio });
    const rt = flat(await rowEl.innerText()).toLowerCase();
    check('matriz: fila con folio, requisición, responsable, resultados, estrategia y ¿puede cotizar?', [r0.folio, r0.requisition, (r0.buyer || '').toUpperCase(), r0.technical, r0.contract, r0.budget, r0.strategy, r0.can_quote ? 'Sí' : 'No (Bloqueado)'].every(x => rt.includes(String(x).toLowerCase())) && ['editar', 'eliminar'].every(x => rt.includes(x)), rt);
    check('matriz: paginación del diseño', flat(await page.getByTestId('validation-matrix-pager').innerText()).includes(`1-${Math.min(10, mxa.total)} de ${mxa.total} registros`) && flat(await page.getByTestId('validation-matrix-pager').innerText()).includes(`Página 1 / ${Math.max(1, Math.ceil(mxa.total / 10))}`));
    const bk = mxa.summary.buyers[0];
    const vb = page.waitForResponse(r => r.url().includes(`buyer=${bk.key}`));
    await mc.nth(1).click();
    check('matriz: filtro por responsable en el servidor (200)', (await vb).status() === 200);
    await page.getByTestId('validation-matrix-selected').filter({ hasText: `${bk.total} registro(s)` }).waitFor();
    check('matriz: solo validaciones del responsable', await page.getByTestId('validation-row').count() === Math.min(10, bk.total));
    await page.getByRole('button', { name: /Volver a tarjetas/ }).click();
    check('Volver a tarjetas cierra la matriz', await page.getByTestId('validation-row').count() === 0);
    await mc.first().click(); await page.getByTestId('validation-row').first().waitFor();
    // Eliminar: vigente con documentos posteriores → se conserva
    const keep = mxa.items.find(x => x.latest && (x.rfq_count + x.quote_count + x.po_count) > 0);
    await page.getByTestId('validation-row').filter({ hasText: keep.folio }).getByRole('button', { name: /^eliminar$/i }).click();
    check('eliminar: validación vigente con RFQ/OC se conserva', (await page.getByTestId('validation-delete-block').innerText()).includes(`es la validación vigente de ${keep.requisition}`));
    await page.getByRole('dialog', { name: 'Eliminar validación' }).getByRole('button', { name: 'Cancelar' }).click();
    // Editar: tarjeta 1 en modo edición
    await page.getByTestId('validation-row').filter({ hasText: r0.folio }).getByRole('button', { name: /^editar$/i }).click();
    const fe = page.getByTestId('validation-register'); await fe.waitFor();
    await fe.getByLabel('Requisición', { exact: true }).locator(`option[value="${r0.requisition_id}"]`).waitFor({ state: 'attached' });
    await page.getByTestId('validation-history').waitFor();
    const ev = [(await page.getByTestId('validation-mode').innerText()).includes(`Modo edición activo: ${r0.folio}`), await fe.getByLabel('Folio interno', { exact: true }).inputValue() === r0.folio,
      await fe.getByLabel('Requisición', { exact: true }).inputValue() === r0.requisition_id, await fe.getByLabel('Requisición', { exact: true }).isDisabled(), await fe.getByLabel('Validación técnica', { exact: true }).inputValue() === r0.technical,
      await fe.getByLabel('Número mínimo de cotizaciones', { exact: true }).inputValue() === String(r0.min_quotes), await fe.getByLabel('Fecha límite de cotización', { exact: true }).inputValue() === String(r0.deadline || '').slice(0, 10),
      await fe.getByLabel('Responsable de compras', { exact: true }).inputValue() === (r0.buyer_person_id || '')];
    check('editar: tarjeta 1 en modo edición con los datos registrados', ev.every(Boolean), JSON.stringify(ev));
    await fe.getByRole('button', { name: /Guardar cambios/ }).click();
    check('editar: sin cambios no se guarda', (await page.getByTestId('validation-save-msg').innerText()).includes('Sin cambios por guardar.'));
    await fe.getByLabel('Observaciones internas / justificación', { exact: true }).fill('Cambio de prueba E2E en la validación');
    await fe.getByRole('button', { name: /Guardar cambios/ }).click();
    await page.getByTestId('validation-save-msg').filter({ hasText: /No se confirmó/ }).waitFor({ timeout: 15000 });
    check('editar: intenta el PUT con la validación y, sin respuesta, NO lo da por guardado', writes.at(-1) === `PUT /api/v1/contractor-management/validations/${r0.id}` && flat(await page.getByTestId('validation-save-msg').innerText()).startsWith('No se confirmó el guardado'), `${writes.at(-1)} · ${flat(await page.getByTestId('validation-save-msg').innerText())}`);
    await fe.getByRole('button', { name: /Nueva validación/ }).click();
    await page.getByTestId('validation-mode').filter({ hasText: 'Modo nueva captura activo' }).waitFor();
    check('"+ Nueva validación" sale del modo edición', await fe.getByLabel('Folio interno', { exact: true }).inputValue() === 'Automático' && await fe.getByLabel('Requisición', { exact: true }).inputValue() === '');
    // Fuente única simulada (sin datos sintéticos de ese tipo): Registrar fuente de costo y eliminar un borrador
    const sole = { ...mxa.items.find(x => x.rfq_count === 0 && x.po_count === 0 && x.quote_count === 0) || mxa.items[0], strategy: 'Fuente única justificada', rfq_count: 0, quote_count: 0, po_count: 0, latest: true, imported: false };
    await page.route('**/api/v1/contractor-management/validations?*', async route => { const res = await route.fetch(); const body = await res.json(); body.items = body.items.map(x => (x.id === sole.id ? sole : x)); await route.fulfill({ response: res, json: body }); });
    await page.getByRole('button', { name: /Matriz de validaciones/ }).first().click();
    await page.getByTestId('validation-buyer-card').first().click();
    const sr = page.getByTestId('validation-row').filter({ hasText: sole.folio }); await sr.waitFor();
    check('fuente única: chip FUENTE ÚNICA y botón Registrar fuente de costo', flat(await sr.innerText()).toUpperCase().includes('FUENTE ÚNICA') && await sr.getByRole('button', { name: /Registrar fuente de costo/i }).isVisible());
    await sr.getByRole('button', { name: /Registrar fuente de costo/i }).click();
    const cd = page.getByRole('dialog', { name: 'Registrar fuente de costo' });
    await cd.getByLabel('Costo unitario #1').waitFor();
    await cd.getByRole('button', { name: 'Registrar fuente de costo' }).click();
    check('fuente de costo: exige fuente y costo', (await page.getByTestId('validation-cost-msg').innerText()).includes('Describe la fuente del costo'));
    await cd.getByLabel('Costo unitario #1').fill('125.50'); await cd.getByLabel('Moneda #1').selectOption('USD'); await cd.getByLabel('Fuente del costo', { exact: true }).fill('Cotización única del distribuidor autorizado');
    await cd.getByRole('button', { name: 'Registrar fuente de costo' }).click();
    check('fuente de costo: validada pero NO registrada', flat(await page.getByTestId('validation-cost-msg').innerText()).startsWith(`Datos validados, pero no se registró la fuente de costo de ${sole.requisition} (${sole.folio}; 1 partida(s), fuente: Cotización única del distribuidor autorizado)`));
    await cd.getByRole('button', { name: 'Cancelar' }).click();
    await sr.getByRole('button', { name: /^eliminar$/i }).click();
    const dd = page.getByRole('dialog', { name: 'Eliminar validación' });
    await dd.getByLabel('Folio a eliminar').fill(sole.folio.toLowerCase()); await dd.getByLabel('Motivo de la eliminación').fill('Validación capturada por error (E2E)');
    await dd.getByRole('button', { name: 'Eliminar', exact: true }).click();
    check('eliminar: validado pero NO eliminado', (await page.getByTestId('validation-delete-msg').innerText()).startsWith(`Datos validados, pero no se eliminó ${sole.folio}`));
    await dd.getByRole('button', { name: 'Cancelar' }).click();
    await page.unroute('**/api/v1/contractor-management/validations?*');
    await shot(page, 'cm_3_matrix');
    await vm.getByRole('button', { name: /Nueva validación/ }).click();
    await page.getByTestId('validation-register').waitFor();
    check('"+ Nueva validación" de la matriz abre el registro vacío', await page.getByTestId('validation-register').getByLabel('Folio interno', { exact: true }).inputValue() === 'Automático');
    // 4 · Reglas inteligentes
    const rua = await api('/api/v1/contractor-management/rules');
    const rr = page.waitForResponse(r => r.url().includes('/api/v1/contractor-management/rules'));
    await page.getByRole('button', { name: /Reglas inteligentes/ }).first().click();
    check('reglas: consulta MariaDB (200)', (await rr).status() === 200);
    const sr4 = page.getByTestId('smart-rules'); await page.getByTestId('rule-ready').waitFor();
    const r4 = flat(await sr4.innerText());
    check('reglas: título, explicación, Ver validaciones y nota del diseño', ['Reglas inteligentes', 'Validaciones previas antes de avanzar a la etapa de cotización.', 'Para avanzar, las validaciones técnica y contractual deben ser conformes o con observaciones aceptables, y el presupuesto debe estar disponible o parcialmente disponible.'].every(x => r4.includes(x)) && await sr4.getByRole('button', { name: /Ver validaciones/ }).isVisible(), r4.slice(0, 300));
    check('reglas: contadores reales en el orden del diseño', flat(await page.getByTestId('rule-without_validation').innerText()) === `${rua.counters.without_validation} requisiciones sin validación.` && flat(await page.getByTestId('rule-blocked').innerText()) === `${rua.counters.blocked} validaciones con bloqueo.` && flat(await page.getByTestId('rule-ready').innerText()) === `${rua.counters.ready} requisiciones listas para cotizar.`);
    check('reglas: aviso propio de la tarjeta conectada', (await page.getByTestId('contractor-mgmt-notice').innerText()).includes('Reglas inteligentes conectadas a MariaDB'));
    await page.getByTestId('rule-blocked').getByRole('button').first().click();
    check('reglas: bloqueadas se despliegan con el motivo', await page.getByTestId('rule-blocked').getByTestId('rule-item').count() === Math.min(100, rua.counters.blocked) && flat(await page.getByTestId('rule-blocked').innerText()).includes(rua.blocked[0].folio));
    await page.getByTestId('rule-without_validation').getByRole('button').first().click();
    const nv = rua.without_validation[0];
    check('reglas: sin validación se despliega', await page.getByTestId('rule-without_validation').getByTestId('rule-item').count() === Math.min(100, rua.counters.without_validation));
    await page.getByTestId('rule-without_validation').getByTestId('rule-item').filter({ hasText: nv.folio }).getByRole('button', { name: /validar/i }).click();
    await page.getByTestId('validation-register').waitFor();
    await page.getByTestId('validation-context').waitFor();
    await page.getByTestId('validation-register').getByLabel('Requisición', { exact: true }).locator(`option[value="${nv.id}"]`).waitFor({ state: 'attached' });
    check('Validar abre el registro con la requisición preseleccionada', await page.getByTestId('validation-register').getByLabel('Requisición', { exact: true }).inputValue() === nv.id);
    await page.getByRole('button', { name: /Reglas inteligentes/ }).first().click();
    await page.getByTestId('rule-ready').getByRole('button').first().click();
    const rd = rua.ready[0];
    await page.getByTestId('rule-ready').getByTestId('rule-item').filter({ hasText: rd.folio }).getByRole('button', { name: /estrategia/i }).click();
    await page.getByTestId('strategy-context').waitFor();
    await page.getByTestId('strategy-lots').getByLabel('Requisición validada', { exact: true }).locator(`option[value="${rd.requisition_id}"]`).waitFor({ state: 'attached' });
    check('Estrategia abre la lotificación con la requisición preseleccionada', await page.getByTestId('strategy-lots').getByLabel('Requisición validada', { exact: true }).inputValue() === rd.requisition_id);
    await page.getByRole('button', { name: /Registro de validación/ }).first().click();
    check('volver por la tarjeta superior limpia la preselección', await page.getByTestId('validation-register').getByLabel('Requisición', { exact: true }).inputValue() === '');
    await page.getByRole('button', { name: /Reglas inteligentes/ }).first().click(); await page.getByTestId('rule-ready').waitFor();
    await shot(page, 'cm_4_rules');
    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e.stack || e).slice(0, 600));
  }
  check('solo se intentaron los guardados esperados (validación, estrategia y edición); ninguna RFQ', writes.length === 3 && writes.every(w => /^(POST \/api\/v1\/contractor-management\/validations|PUT \/api\/v1\/contractor-management\/(strategy|validations)\/[0-9a-f-]{36})$/.test(w)), writes.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nGestión del Contratista UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
