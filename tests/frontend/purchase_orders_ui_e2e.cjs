// Órdenes de Compra · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición /api
// que no sea GET (salvo login/logout) se aborta. Valores esperados calculados desde la API (OC-QA-0001, OC-QA-0003 Rev. 1 = versión 2,
// OC-QA-0009 cancelada, solicitud MOD-QA-0001 asignada a QA Admin A y la adjudicación sintética sin OC).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/purchase_orders_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const money = (v, c) => `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))} ${c}`;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  await context.addInitScript(() => { window.print = () => {}; window.close = () => {}; });
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
    const head = await api('/api/v1/purchase-orders?page=1&page_size=50');
    const ctr = head.summary.counters;

    const first = page.waitForResponse(r => /\/api\/v1\/purchase-orders\?page=1&page_size=1&/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Órdenes de Compra$/ }).click();
    check('matriz consulta OC (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Emisión de orden de compra', 'Matriz de órdenes', 'Control de autorización', 'Modificaciones / Enmiendas', 'Revisión y autorización', 'Formato de Orden de Compra'])
      check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t) }).first().isVisible());
    // 2 · Matriz (diseño): compradores → matriz paginada del comprador elegido
    const mx = page.getByTestId('po-matrix');
    await mx.getByTestId('po-buyer-card').first().waitFor();
    const mxt = (await mx.innerText()).replace(/\s+/g, ' ');
    check('matriz: textos del diseño', ['Matriz de órdenes de compra', 'Organiza las órdenes primero por comprador', 'Órdenes de compra por comprador', 'Selecciona un comprador para consultar únicamente sus órdenes de compra.'].every(x => mxt.includes(x)), mxt.slice(0, 300));
    check('sin selector de idioma de la OC (el PDF usa el idioma de la aplicación)', !mxt.includes('Idioma de Orden de Compra') && await page.locator('#po-pdf-lang').count() === 0);
    check('matriz: "+ Nueva orden" y "← Volver a compradores" habilitados', await mx.getByRole('button', { name: /Nueva orden/ }).isEnabled() && await mx.getByRole('button', { name: /Volver a compradores/ }).isEnabled());
    check('matriz: buscador de compradores del diseño', await mx.getByRole('searchbox', { name: 'Buscar comprador' }).getAttribute('placeholder') === 'Buscar comprador, correo, teléfono o puesto...');
    const nB = head.summary.buyers.length; const comp = n => `${n} comprador${n === 1 ? '' : 'es'}`;
    check(`matriz: contador "${comp(nB)} · ${ctr.total} OC"`, (await page.getByTestId('po-buyer-badge').innerText()).trim() === `${comp(nB)} · ${ctr.total} OC`);
    const allCard = mx.locator('[data-testid="po-buyer-card"][data-buyer="Todas las órdenes de compra"]');
    const at = (await allCard.innerText()).replace(/\s+/g, ' ');
    check('tarjeta "Todas": OC, pendientes, recibidas y vista general', at.includes(`${ctr.total} OC ${ctr.total - ctr.received} Pendientes ${ctr.received} Recibidas`) && at.includes('Vista general'), at);
    const b = head.summary.buyers[0];
    const buyerCard = mx.locator(`[data-testid="po-buyer-card"][data-buyer="${b.name}"]`);
    const bt = (await buyerCard.innerText()).replace(/\s+/g, ' ');
    const bAmount = b.money.length === 1 ? money(b.money[0].amount, b.money[0].currency) : `${b.money.length} monedas`;
    check('tarjeta por comprador: correo, OC/pendientes/recibidas, proveedores, requisiciones, monto y % recibido', [b.email, `${b.count} OC ${b.count - b.received} Pendientes ${b.received} Recibidas`, `${b.suppliers} proveedores · ${b.requisitions} requisiciones`, bAmount, `${Math.round(b.received / b.count * 100)}% recibido`].every(x => bt.includes(x)), bt);
    check('tarjeta "Sin comprador asignado" cuando aplica', !ctr.without_buyer || await mx.locator('[data-testid="po-buyer-card"][data-buyer="Sin comprador asignado"]').count() === 1);
    await mx.getByRole('searchbox', { name: 'Buscar comprador' }).fill('zz-no-existe');
    check('búsqueda de compradores sin coincidencias', await mx.getByText('Ningún comprador coincide con "zz-no-existe".').isVisible() && await mx.getByTestId('po-buyer-card').count() === 1 + (ctr.without_buyer ? 1 : 0));
    await mx.getByRole('searchbox', { name: 'Buscar comprador' }).fill(b.email.slice(0, 6));
    check('búsqueda de compradores por correo', await buyerCard.count() === 1);
    await mx.getByRole('button', { name: /Volver a compradores/ }).click();
    check('"Volver a compradores" limpia la búsqueda', await mx.getByRole('searchbox', { name: 'Buscar comprador' }).inputValue() === '');
    await shot(page, 'oc_2_compradores');

    const allResp = page.waitForResponse(r => /\/purchase-orders\?page=1&page_size=15&.*buyer=all/.test(r.url()));
    await allCard.click();
    check('"Todas" abre la matriz paginada (15 filas) en el servidor (200)', (await allResp).status() === 200);
    await page.getByTestId('po-range').filter({ hasText: `de ${head.total} órdenes de compra` }).waitFor();
    check('encabezado: "Todas las órdenes de compra" con registros y compradores', (await page.getByTestId('po-buyer-head').innerText()).replace(/\s+/g, ' ').includes(`${head.total} registros de ${comp(nB)}`));
    check('rango "Mostrando 1–N de N órdenes de compra"', (await page.getByTestId('po-range').innerText()).trim() === `Mostrando 1–${Math.min(15, head.total)} de ${head.total} órdenes de compra`);
    check('aviso de acciones del diseño', (await mx.innerText()).includes('SOLICITAR MODIFICACIÓN requiere aprobación previa. Solo después se habilita MODIFICAR OC'));
    const row3 = mx.locator('tr[data-folio="OC-QA-0003"]');
    const p3 = head.items.find(x => x.folio === 'OC-QA-0003');
    const t3 = (await row3.innerText()).replace(/\s+/g, ' ');
    check('fila: Rev. N (Rev. 0 = original), requisición, proveedor, comprador, partidas, monto, avance y solicitud pendiente', [`Rev. ${p3.version_number - 1}`, 'QA02-REQ-2026-SCF210', 'INSTRUMENTOS EUROPA SINTÉTICA', 'QA Comprador', `${p3.item_count}`, 'INSTRUMENTO SINTÉTICO', '$3,900.00 USD', '50% recibido', 'Emitida', 'MOD-QA-0001'].every(x => t3.toUpperCase().includes(x.toUpperCase())), t3);
    check('solo la versión vigente de cada OC', await mx.locator('tr[data-folio="OC-QA-0003"]').count() === 1);
    check('OC cancelada (estatus original) con su pill', (await mx.locator('tr[data-folio="OC-QA-0009"]').innerText()).includes('Cancelada'));
    const byState = page.waitForResponse(r => /\/purchase-orders\?.*state=cancelled/.test(r.url()));
    await mx.getByRole('combobox', { name: 'Estatus' }).selectOption('cancelled');
    check('filtro de estatus del diseño en el servidor (200)', (await byState).status() === 200);
    await page.getByTestId('po-range').filter({ hasText: /de 1 órdenes de compra|No hay/ }).waitFor();
    check('solo canceladas', await mx.locator('tr[data-folio]').count() === head.summary.states.find(x => x.code === 'cancelled').count && await mx.locator('tr[data-folio="OC-QA-0009"]').count() === 1);
    const optLabels = await mx.getByRole('combobox', { name: 'Estatus' }).locator('option').allInnerTexts();
    check('estatus del diseño en el filtro', ['Emitida', 'Enviada al proveedor', 'Aceptada', 'Parcialmente recibida', 'Cancelada', 'Borrador', 'Recibida', 'Sustituida'].every(x => optLabels.some(o => o.startsWith(x))), optLabels.join('|'));
    await mx.getByRole('combobox', { name: 'Estatus' }).selectOption('all');
    const qResp = page.waitForResponse(r => /q=SCF210/.test(r.url()));
    await page.getByLabel('Buscar órdenes').fill('SCF210');
    check('búsqueda por folio de requisición en el servidor', (await qResp).status() === 200);
    await page.getByTestId('po-range').filter({ hasText: 'de 1 órdenes de compra' }).waitFor();
    await page.getByLabel('Buscar órdenes').fill('');
    await page.getByTestId('po-range').filter({ hasText: `de ${head.total} órdenes de compra` }).waitFor();
    const rowsResp = page.waitForResponse(r => /page_size=25/.test(r.url()));
    await mx.getByRole('combobox', { name: 'Filas por página' }).selectOption('25');
    check('filas por página en el servidor (25)', (await rowsResp).status() === 200);
    await shot(page, 'oc_2_matriz');

    // Acciones: SOLICITAR MODIFICACIÓN con solicitud pendiente, EDITAR emitida, MODIFICAR sin aprobación, ELIMINAR protegido
    await row3.getByRole('button', { name: /Solicitar modificación/i }).click();
    check('solicitar modificación con otra pendiente: no procede', (await page.getByTestId('po-action-msg').innerText()).includes('Ya existe una solicitud pendiente (MOD-QA-0001)'));
    const row1 = mx.locator('tr[data-folio="OC-QA-0001"]');
    await row1.getByRole('button', { name: /^Editar$/i }).click();
    check('EDITAR una OC autorizada remite a SOLICITAR MODIFICACIÓN', (await page.getByTestId('po-action-msg').innerText()).includes('ya fue autorizada/emitida'));
    check('MODIFICAR OC deshabilitado sin solicitud aprobada', await row1.getByRole('button', { name: /Modificar OC/i }).isDisabled());
    await row1.getByRole('button', { name: /Solicitar modificación/i }).click();
    const rq = page.getByTestId('po-request'); await rq.waitFor();
    const po1 = head.items.find(x => x.folio === 'OC-QA-0001');
    const rqt = (await rq.innerText()).replace(/\s+/g, ' ');
    check('solicitud: encabezado y control obligatorio del diseño', ['Solicitud de modificación de Orden de Compra', 'La OC permanece bloqueada hasta que la solicitud sea aprobada.', 'Control obligatorio:', 'no modifica', 'la nueva Rev. N deberá pasar nuevamente por el flujo normal de revisión y autorización'].every(x => rqt.includes(x)), rqt.slice(0, 400));
    const rctx = (await page.getByTestId('po-request-context').innerText()).replace(/\s+/g, ' ');
    check('solicitud: contexto (OC y Rev., requisición, proveedor y monto, autorizador actual)', ['OC-QA-0001', 'Rev. 0', po1.requisitions, String(po1.supplier_name).toUpperCase(), money(po1.total_amount, po1.currency), String(po1.authorizer_name || '—').toUpperCase(), 'Autorizador actual de la OC'].every(x => rctx.includes(x)), rctx);
    const apSel = rq.getByRole('combobox', { name: 'Autoriza la modificación' });
    await page.waitForFunction(() => { const s = document.querySelector('[data-testid="po-request"] select[aria-label="Autoriza la modificación"]'); return s && !s.disabled && s.options.length > 1; });
    const users = []; for (let p = 1; ; p++) { const r = await api(`/api/v1/users?page=${p}`); users.push(...r.items); if (users.length >= r.total || !r.items.length) break; }
    const me = (await api('/api/v1/auth/me')).user;
    const eligible = users.filter(u => u.status === 'active' && u.access_enabled && u.credential_state === 'local_validated' && u.id !== me.public_id);
    const apOpts = await apSel.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
    check('autoriza la modificación: usuarios activos con acceso, sin quien solicita', apOpts.length === eligible.length && eligible.every(u => apOpts.includes(u.id)) && !apOpts.includes(me.public_id), JSON.stringify(apOpts));
    check('solicitud: valores iniciales del diseño (Cantidad, Normal, sin impacto)', await rq.getByRole('combobox', { name: 'Tipo de modificación' }).inputValue() === 'quantity' && await rq.getByRole('combobox', { name: 'Urgencia' }).inputValue() === 'normal' && await rq.getByRole('combobox', { name: 'Impacto estimado' }).inputValue() === 'none');
    check('placeholders del diseño', await rq.getByRole('textbox', { name: 'Referencia / evidencia' }).getAttribute('placeholder') === 'Correo, Change Request, PO cliente, minuta, ticket...' && /Explica por qué se solicita autorización/.test(await rq.getByRole('textbox', { name: 'Motivo / justificación' }).getAttribute('placeholder')));
    const curAuth = eligible.find(u => u.name.toLowerCase() === String(po1.authorizer_name || '').toLowerCase());
    check('autorizador actual preseleccionado solo si puede autorizar', await apSel.inputValue() === (curAuth ? curAuth.id : ''));
    await apSel.selectOption('');
    await rq.getByRole('button', { name: /Enviar para aprobación/ }).click();
    check('solicitud: exige autorizador', (await page.getByTestId('po-request-msg').innerText()).includes('Selecciona quién autoriza la modificación.'));
    const ap = eligible[0];
    await apSel.selectOption(ap.id);
    await rq.getByRole('textbox', { name: 'Referencia / evidencia' }).fill('Correo del proveedor 18/11 (prueba E2E sintética)');
    await rq.getByRole('combobox', { name: 'Impacto estimado' }).selectOption('schedule');
    await rq.getByRole('combobox', { name: 'Tipo de modificación' }).selectOption('date');
    await rq.getByRole('textbox', { name: 'Motivo / justificación' }).fill('corto');
    await rq.getByRole('button', { name: /Enviar para aprobación/ }).click();
    check('solicitud: exige justificación (mín. 10)', (await page.getByTestId('po-request-msg').innerText()).includes('mínimo 10 caracteres'));
    await rq.getByRole('textbox', { name: 'Motivo / justificación' }).fill('Proveedor solicita nueva fecha de entrega (prueba E2E sintética)');
    await rq.getByRole('button', { name: /Enviar para aprobación/ }).click();
    check('solicitud validada pero NO registrada (tipo y autorizador)', (await page.getByTestId('po-request-msg').innerText()).includes(`Datos validados, pero no se registró la solicitud de modificación de OC-QA-0001 (Fecha de entrega, autoriza ${ap.name})`));
    await shot(page, 'oc_2_solicitud');
    await rq.getByRole('button', { name: 'Cancelar' }).click();
    await row1.getByRole('button', { name: /^Eliminar$/i }).click();
    const p1 = head.items.find(x => x.folio === 'OC-QA-0001');
    check('ELIMINAR con recepciones/facturas: no procede', (await page.getByTestId('po-delete').innerText()).includes(`${p1.receipt_count} recepción(es)`) && await page.getByTestId('po-delete').getByRole('button', { name: 'Eliminar', exact: true }).count() === 0);
    await page.getByTestId('po-delete').getByRole('button', { name: 'Cancelar' }).click();

    // PDF real (jsPDF) en el idioma de la aplicación
    const dl = page.waitForEvent('download');
    await row3.getByRole('button', { name: /Descargar PDF/i }).click();
    const file = await dl; const pdfPath = await file.path(); const pdfRaw = require('fs').readFileSync(pdfPath).toString('latin1');
    check('DESCARGAR PDF: archivo con folio, revisión, partidas y total', file.suggestedFilename() === `OC-QA-0003-Rev${p3.version_number - 1}.pdf` && pdfRaw.startsWith('%PDF') && ['ORDEN DE COMPRA', 'P-COP-01-01', `OC-QA-0003 · Rev. ${p3.version_number - 1}`, 'Instrumento sint', '3,900.00 USD', 'INFORMACI', 'AUTORIZ'].every(x => pdfRaw.includes(x)), file.suggestedFilename());
    const pop = context.waitForEvent('page');
    await row3.getByRole('button', { name: /Ver PDF/i }).click();
    const pv = await pop; await pv.waitForURL(/^blob:|about:blank/, { timeout: 8000 }).catch(() => {});
    check('VER PDF abre el PDF generado en otra pestaña', !!pv); await pv.close().catch(() => {});

    // Cambiar comprador → tarjeta del comprador filtra en el servidor
    await mx.getByRole('button', { name: /Cambiar comprador/ }).click();
    const byBuyer = page.waitForResponse(r => new RegExp(`buyer=${b.id}`).test(r.url()));
    await buyerCard.click();
    check('filtro por comprador en el servidor (200)', (await byBuyer).status() === 200);
    await page.getByTestId('po-range').filter({ hasText: `de ${b.count} órdenes de compra` }).waitFor();
    check('sin la OC que no tiene comprador', await mx.locator('tr[data-folio="OC-QA-0009"]').count() === 0);

    // Formato (tarjeta 6) desde "Formato PDF"
    await mx.locator('tr[data-folio="OC-QA-0003"]').getByRole('button', { name: 'Formato PDF' }).click();
    const fmt = page.getByTestId('po-format'); await fmt.waitFor();
    const frame = page.frameLocator('iframe[title="Formato de OC"]');
    await frame.getByText(`Orden de Compra OC-QA-0003 · Rev. ${p3.version_number - 1}`).waitFor();
    const ftxt = await frame.locator('body').innerText();
    check('formato: partidas, total, firmas y referencias', ['Instrumento sintético', '$3,900.00 USD', 'QA Comprador', 'QA02-REQ-2026-SCF210'].every(x => ftxt.includes(x)), ftxt.slice(0, 300));
    check('formato: versiones (Rev. 0 original) y recepción de la serie', (await fmt.innerText()).includes('Rev. 0') && (await fmt.innerText()).includes('Rev. 1 · Cambio de cantidad') && (await fmt.innerText()).includes('REC-QA-0003'));
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: /Imprimir \/ Guardar PDF/ }).click()]);
    await popup.waitForLoadState(); check('imprimir abre el formato', (await popup.textContent('body')).includes('OC-QA-0003')); await popup.close();
    await shot(page, 'oc_6_formato');

    // 1 · Emisión de orden de compra (diseño): requisición aprobada → proveedores ganadores; crear OC valida y no escribe
    await page.getByRole('button', { name: /Emisión de orden de compra/ }).first().click();
    const iss = await api('/api/v1/purchase-orders/issuance');
    const ib = page.getByTestId('po-issuance');
    await ib.waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-testid="po-issuance"]')?.innerText.includes('Consultando MariaDB'));
    const ibt = (await ib.innerText()).replace(/\s+/g, ' ');
    check('emisión: textos del diseño', ['Orden de compra', 'Las nuevas OC se generan desde la adjudicación definitiva', 'Paso 5 · Orden de compra', 'Órdenes de Compra por proveedor adjudicado', 'Las cotizaciones perdedoras no aparecen aquí.', '1 requisición → 1 OC por proveedor', 'La requisición debe tener aprobación del cliente y adjudicación definitiva por partida.', 'No se seleccionan cotizaciones individuales. Se utiliza el proveedor ganador de cada partida.'].every(x => ibt.includes(x)), ibt.slice(0, 300));
    check('emisión: regla de emisión fija', await ib.getByRole('textbox', { name: 'Regla de emisión' }).inputValue() === 'Agrupar todas las partidas ganadas del mismo proveedor en una sola OC');
    const sel1 = ib.getByRole('combobox', { name: 'Requisición aprobada por el cliente' });
    const approved = iss.requisitions.filter(r => r.client_approved), ready1 = approved.filter(r => r.awarded_items > 0);
    const optVals = await sel1.locator('option').evaluateAll(os => os.map(o => [o.value, o.disabled]));
    check('emisión: solo requisiciones con Cotización al Cliente aprobada (sin adjudicación: deshabilitada)', optVals.length === approved.length + 1 && approved.every(r => optVals.some(([v, dis]) => v === r.id && dis === !(r.awarded_items > 0))), JSON.stringify(optVals));
    const waiting = iss.requisitions.filter(r => !r.client_approved && r.awarded_items > 0);
    check('emisión: con adjudicación sin aprobación del cliente no se ofrecen', waiting.every(r => !optVals.some(([v]) => v === r.id)) && (!waiting.length || (await page.getByTestId('po-iss-waiting').innerText()).includes(waiting[0].folio)));
    const qr = ready1.reduce((n, r) => n + r.quotes_received, 0);
    check('emisión: estado vacío del diseño con cotizaciones recibidas', (await page.getByTestId('po-iss-empty').innerText()).includes(`Aquí no se muestran las ${qr} cotizaciones recibidas`));
    check('emisión: "0 OC por generar" sin selección', (await page.getByTestId('po-iss-count').innerText()).replace(/\s+/g, ' ').trim() === '0 OC por generar');
    await ib.getByRole('button', { name: /Crear una OC por cada proveedor/ }).click();
    check('emisión: crear sin requisición pide seleccionarla', (await page.getByTestId('po-iss-msg').innerText()).includes('Selecciona una requisición aprobada por el cliente.'));
    const rq1 = ready1.find(r => iss.items.some(i => i.requisition_id === r.id && i.active_pos)) || ready1[0];
    if (rq1) {
      await sel1.selectOption(rq1.id);
      await ib.getByTestId('po-iss-supplier').first().waitFor();
      const cx1 = (await page.getByTestId('po-iss-context').innerText()).replace(/\s+/g, ' ');
      check('emisión: contexto con cotización al cliente aprobada y cotizaciones recibidas', [rq1.folio, rq1.client_name, rq1.customer_quote, `${rq1.quotes_received} cotización(es) recibida(s)`].every(x => cx1.includes(x)), cx1);
      const win1 = iss.items.filter(i => i.requisition_id === rq1.id);
      check('emisión: una tarjeta por proveedor ganador (sin perdedoras)', await ib.getByTestId('po-iss-supplier').count() === win1.length);
      for (const w of win1) {
        const card = ib.locator(`[data-testid="po-iss-supplier"][data-supplier="${w.supplier_name}"]`);
        const ct = (await card.innerText()).replace(/\s+/g, ' ');
        const ls = iss.lines.filter(l => l.requisition_id === rq1.id && l.supplier_id === w.supplier_id);
        check(`emisión: ${w.supplier_name} con partidas adjudicadas, importes y estado de OC`, ls.every(l => ct.includes(l.description) && ct.includes(money(l.subtotal, l.currency)) && ct.includes(l.quote_folio)) && (w.active_pos ? ct.includes(`OC generada: ${w.active_pos}`) : ct.includes('OC por generar')), ct);
      }
      const pend1 = win1.filter(i => !i.active_pos).length;
      check(`emisión: "${pend1} OC por generar"`, (await page.getByTestId('po-iss-count').innerText()).replace(/\s+/g, ' ').trim() === `${pend1} OC por generar`);
      if (!pend1) { await ib.getByRole('button', { name: /Crear una OC por cada proveedor/ }).click(); check('emisión: todas generadas no se duplican', (await page.getByTestId('po-iss-msg').innerText()).includes('ya fueron generadas')); }
      await shot(page, 'oc_1_emision');
      // Escenario con OC pendiente: misma respuesta real del servidor, pero sin la OC ya generada (solo en el navegador de la prueba).
      const sim = JSON.parse(JSON.stringify(iss)); sim.items.forEach(i => { if (i.requisition_id === rq1.id) { i.active_pos = null; i.existing_pos = null; } });
      await context.route('**/api/v1/purchase-orders/issuance', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sim) }));
      await page.getByRole('button', { name: /Actualizar/ }).first().click();
      await page.getByTestId('po-iss-count').filter({ hasText: `${win1.length} OC por generar` }).waitFor();
      await ib.getByRole('button', { name: /Crear una OC por cada proveedor/ }).click();
      const lm = (await page.getByTestId('po-iss-msg').innerText()).replace(/\s+/g, ' ');
      check('emisión (OC pendiente): valida y NO genera; una OC por proveedor con su total', lm.includes(`Datos validados, pero ${win1.length === 1 ? 'no se generó la OC' : `no se generaron las ${win1.length} OC`} de ${rq1.folio}`) && win1.every(w => lm.includes(w.supplier_name)) && lm.includes('escritura comercial bloqueada'), lm);
      await shot(page, 'oc_1_emision_pendiente');
      await context.unroute('**/api/v1/purchase-orders/issuance');
      await page.getByRole('button', { name: /Actualizar/ }).first().click();
    } else check('emisión: sin requisiciones listas', ibt.includes('No hay requisiciones aprobadas por el cliente con adjudicación definitiva.'));
    await shot(page, 'oc_2_emision');

    // 3 · Control de autorización (diseño): cuatro alertas con conteo del servidor y detalle desplegable
    const iss3 = await api('/api/v1/purchase-orders/issuance');
    const ctr3 = (await api('/api/v1/purchase-orders?page=1&page_size=1')).summary.counters;
    await page.getByRole('button', { name: /Control de autorización/ }).first().click();
    const cv3 = page.getByTestId('po-control'); await cv3.waitFor();
    const cvt3 = (await cv3.innerText()).replace(/\s+/g, ' ');
    check('control: título, subtítulo y "Ver órdenes"', cvt3.includes('Control de autorización') && cvt3.includes('Revisiones previas y alertas para la emisión de órdenes.') && await cv3.getByRole('button', { name: /Ver órdenes/ }).isEnabled());
    const bar = async k => (await page.getByTestId(`po-alert-${k}`).getByRole('button').first().innerText()).replace(/\s+/g, ' ');
    for (const [k, c, t] of [['preselected', 'preselected_quotes', 'cotizaciones preseleccionadas o adjudicadas.'], ['awards', 'awards_without_po', 'adjudicaciones pendientes de OC.'], ['auto', 'auto_generated', 'órdenes generadas automáticamente con PDF.'], ['overdue', 'overdue_without_receipt', 'órdenes vencidas sin recepción.']])
      check(`control: "${ctr3[c]} ${t}" = MariaDB`, (await bar(k)).startsWith(`${ctr3[c]} ${t}`), await bar(k));
    check('control: barras en el orden y colores del diseño', (await cv3.locator('[data-testid^="po-alert-"]:not([data-testid^="po-alert-detail"])').evaluateAll(es => es.map(e => [e.dataset.testid, [...e.classList].find(c => /^border-l-(emerald|amber|blue|rose)/.test(c))]))).map(x => x.join(':')).join() === 'po-alert-preselected:border-l-emerald-600,po-alert-awards:border-l-amber-500,po-alert-auto:border-l-blue-600,po-alert-overdue:border-l-rose-600');
    check('control: el detalle cuadra con el conteo (cotizaciones, OC automáticas, vencidas, partidas sin OC)', iss3.alerts.preselected_quotes.length === ctr3.preselected_quotes && iss3.alerts.auto_generated.length === ctr3.auto_generated && iss3.alerts.overdue_without_receipt.length === ctr3.overdue_without_receipt
      && iss3.items.filter(i => !i.active_pos).reduce((n, i) => n + i.items, 0) === ctr3.awards_without_po);
    await page.getByTestId('po-alert-preselected').getByRole('button').first().click();
    const dp = (await page.getByTestId('po-alert-detail-preselected').innerText()).replace(/\s+/g, ' ');
    check('control: detalle de cotizaciones preseleccionadas/adjudicadas (sin "No seleccionada")', iss3.alerts.preselected_quotes.every(q => dp.includes(q.folio) && dp.includes(q.supplier_name)) && !dp.includes('No seleccionada'), dp.slice(0, 300));
    await page.getByTestId('po-alert-auto').getByRole('button').first().click();
    const da = (await page.getByTestId('po-alert-detail-auto').innerText()).replace(/\s+/g, ' ');
    check('control: detalle de OC automáticas con VER PDF', iss3.alerts.auto_generated.every(p => da.includes(p.folio)) && (await page.getByTestId('po-alert-detail-auto').getByRole('button', { name: /Ver PDF/ }).count()) === iss3.alerts.auto_generated.length, da.slice(0, 300));
    if (iss3.alerts.auto_generated.length) {
      const popA = context.waitForEvent('page'); await page.getByTestId('po-alert-detail-auto').getByRole('button', { name: /Ver PDF/ }).first().click();
      const pa = await popA; check('control: VER PDF desde la alerta abre el PDF de la OC', !!pa); await pa.close().catch(() => {});
    }
    await page.getByTestId('po-alert-overdue').getByRole('button').first().click();
    const dov = (await page.getByTestId('po-alert-detail-overdue').innerText()).replace(/\s+/g, ' ');
    check('control: detalle de vencidas sin recepción (o vacío)', iss3.alerts.overdue_without_receipt.length ? iss3.alerts.overdue_without_receipt.every(p => dov.includes(p.folio) && dov.includes('días')) : dov.includes('Sin documentos en esta alerta.'), dov.slice(0, 200));
    await page.getByTestId('po-alert-awards').getByRole('button').first().click();
    const daw = (await page.getByTestId('po-alert-detail-awards').innerText()).replace(/\s+/g, ' ');
    const pend3 = iss3.items.filter(i => !i.active_pos);
    check('control: adjudicaciones sin OC con requisición, proveedor y aprobación del cliente', pend3.every(i => daw.includes(i.folio) && daw.includes(i.supplier_name)) && pend3.every(i => iss3.requisitions.find(r => r.id === i.requisition_id)?.client_approved || daw.includes('Espera aprobación del cliente')), daw.slice(0, 300));
    await shot(page, 'oc_3_control');
    await cv3.getByRole('button', { name: /Ver órdenes/ }).click();
    check('control: "Ver órdenes" abre la Matriz de órdenes', await page.getByText('Matriz de órdenes de compra').first().isVisible());

    // Enmiendas
    await page.getByRole('button', { name: /Modificaciones \/ Enmiendas/ }).first().click();
    await page.getByText('Familias de OC').waitFor();
    const fam = page.locator('div.rounded-2xl').filter({ has: page.getByText('OC-QA-0003', { exact: true }) }).last();
    await fam.getByRole('button', { name: /Historial/i }).click();
    const ftext = (await fam.innerText()).replace(/\s+/g, ' ');
    check('enmiendas: familia con Rev. 0 y Rev. 1 y modificar bloqueado', ftext.includes('Rev. 0') && ftext.includes('Rev. 1') && await fam.getByRole('button', { name: /Modificar OC/i }).isDisabled(), ftext);
    await shot(page, 'oc_4_enmiendas');

    // Mis tareas
    const tResp = page.waitForResponse(r => /\/api\/v1\/purchase-orders\/tasks$/.test(r.url()));
    await page.getByRole('button', { name: /Revisión y autorización/ }).first().click();
    check('tareas (200)', (await tResp).status() === 200);
    await page.getByText('MOD-QA-0001').waitFor();
    check('tareas: OC a cargo y solicitud asignada; aprobar/rechazar bloqueados', (await page.getByText(/Mis órdenes por atender · \d+/).innerText()).match(/· (\d+)/)[1] >= 1 && await page.getByRole('button', { name: /Aprobar/ }).isDisabled());
    await shot(page, 'oc_5_tareas');

    check('sin escrituras a la API', writes.length === 0, writes.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/oc_zz_error.png` }).catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nÓrdenes de Compra UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
