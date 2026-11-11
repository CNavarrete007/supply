// Factura · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición /api que no sea
// GET (salvo login/logout) se aborta. Valores esperados calculados desde la API (FAC-QA-0001 vencida con acuse, FAC-QA-0002
// cancelada y FAC-QA-0003 pagada en MXN).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/invoices_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ');
const money = (v, c) => `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))} ${c}`;

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
    const list = await api('/api/v1/invoices?page=1&page_size=50');
    const ctrl = await api('/api/v1/invoices/control');
    const inv = f => list.items.find(x => x.folio === f);

    // 2 · Matriz (tarjeta por defecto)
    const first = page.waitForResponse(r => /\/api\/v1\/invoices\?page=1/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /^.{0,3}Factura$/ }).click();
    check('matriz consulta MariaDB (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Registro de factura', 'Matriz de facturas', 'Control de facturación']) check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t) }).first().isVisible());
    check('aviso de modo consulta visible', await page.getByText(/Modo consulta MariaDB: registrar, editar, cancelar/).isVisible());
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).waitFor();
    const f1 = inv('FAC-QA-0001');
    const r1 = flat(await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).innerText());
    check('fila: número, UUID, requisición, OC, cliente/proyecto, emisor, total, estatus original y acuse', [f1.invoice_number, f1.fiscal_uuid, f1.requisition, 'OC-QA-0001', f1.client_name, 'PRY-QA01', 'Grupo Gerez QA', money(f1.total_amount, 'USD'), 'Pendiente de pago', '1 acuse(s)'].every(x => r1.includes(x)), r1);
    check('vencida en rojo con días de atraso', (await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).locator('td.text-rose-600').count()) === 1 && /\d+ días/.test(r1));
    check('cancelada muestra su estatus original', flat(await page.getByRole('row').filter({ hasText: 'FAC-QA-0002' }).innerText()).includes('Cancelada'));
    const sumTxt = flat(await page.getByText(/^Facturado vigente/).innerText());
    check('facturado vigente por moneda (sin canceladas, sin mezclar)', list.summary.money.every(m => sumTxt.includes(money(m.amount, m.currency))) && !sumTxt.includes(money(3480, 'USD')), sumTxt);
    check('nueva / ver archivo / editar / eliminar bloqueados', await page.getByRole('button', { name: /Nueva factura/ }).isDisabled() && await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).getByRole('button', { name: 'ELIMINAR' }).isDisabled() && await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).getByRole('button', { name: 'VER ARCHIVO' }).isDisabled());
    const byState = page.waitForResponse(r => /\/invoices\?.*state=overdue/.test(r.url()));
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('overdue');
    check('filtro por estatus en el servidor (200)', (await byState).status() === 200);
    await page.getByText(`${ctrl.counters.overdue} facturas`).waitFor();
    check('solo vencidas', await page.getByRole('row').filter({ hasText: 'FAC-QA-0003' }).count() === 0);
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('all');
    const searched = page.waitForResponse(r => /\/invoices\?.*q=B-0003/.test(r.url()));
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('B-0003');
    check('búsqueda en el servidor (200)', (await searched).status() === 200);
    await page.getByText('1 facturas').waitFor();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('');
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).waitFor();
    await shot(page, 'fac_2_matriz');

    // Detalle
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).getByRole('button', { name: /Ver$/ }).click();
    await page.getByTestId('invoice-detail').waitFor();
    const dt = flat(await page.getByTestId('invoice-detail').innerText());
    check('detalle: OC principal, acuse con firmante, rol, método e integridad', ['OC-QA-0001 (principal)', 'Aceros Sintéticos del Norte', 'Receptor Sintético', 'Cuentas por pagar', 'Acuse de recibo de factura', 'verified', 'privado, sin descarga'].every(x => dt.includes(x)), dt.slice(0, 500));
    check('sin enlaces de descarga', await page.getByTestId('invoice-detail').locator('a[href]').count() === 0);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // 1 · Registro de factura (contexto de la requisición)
    await page.getByRole('button', { name: /Registro de factura/ }).click();
    const reqs = await api('/api/v1/invoices/requisitions');
    const r = reqs.items.find(x => x.folio === 'QA01-REQ-2026-SF4EA4');
    await page.getByLabel('Requisición entregada y aceptada').selectOption(r.id);
    await page.getByTestId('invoice-context').waitFor();
    const chips = flat(await page.getByTestId('invoice-context').innerText());
    check('requisición con varias facturas permite elegir (FAC-QA-0001/0002/0003)', ['FAC-QA-0001', 'FAC-QA-0002', 'FAC-QA-0003'].every(x => chips.includes(x)), chips.slice(0, 300));
    await page.getByTestId('invoice-context').getByRole('button', { name: /FAC-QA-0001/ }).click();
    await page.getByTestId('invoice-context').getByText(f1.fiscal_uuid).waitFor();
    const ct = flat(await page.getByTestId('invoice-context').innerText());
    check('contexto: recibida y aceptada, entrega y datos de la factura vigente', ['Recibida al 100 % y aceptada por el cliente.', 'ENT-QA-0001', f1.invoice_number, f1.fiscal_uuid, 'Grupo Gerez QA', money(f1.total_amount, 'USD'), 'Transferencia · Crédito 30 días'].every(x => ct.includes(x)), ct.slice(0, 600));
    check('entrega con aceptación traducida', ct.includes('ENT-QA-0001 (2026-10-22 · Aceptada)'));
    check('"Guardar factura" bloqueado', await page.getByRole('button', { name: /Guardar factura/ }).isDisabled());
    const r2 = reqs.items.find(x => !x.ready);
    if (r2) { await page.getByLabel('Requisición entregada y aceptada').selectOption(r2.id); await page.getByTestId('invoice-context').getByText(r2.folio).first().waitFor(); check('requisición no lista: advierte recepción/aceptación pendiente', flat(await page.getByTestId('invoice-context').innerText()).match(/Recepción incompleta|Entrega no aceptada/)); }
    await shot(page, 'fac_1_registro');

    // 3 · Control
    const cl = page.waitForResponse(r => /\/invoices\/control$/.test(r.url()));
    await page.getByRole('button', { name: /Control de facturación/ }).click();
    check('control consulta MariaDB (200)', (await cl).status() === 200);
    for (const [k, t] of [['ready_to_invoice', 'Listos para facturar'], ['active', 'Facturas vigentes'], ['pending_payment', 'Pendientes de pago'], ['overdue', 'Vencidas'], ['paid', 'Pagadas']])
      check(`métrica ${t} = ${ctrl.counters[k]}`, flat(await page.getByTestId(`metric-${k}`).innerText()).startsWith(String(ctrl.counters[k])));
    const tot = flat(await page.getByTestId('metric-total').innerText());
    check('total facturado por moneda', ctrl.money.every(m => tot.includes(money(m.invoiced, m.currency))), tot);
    for (const v of ctrl.overdue) check(`lista de vencidas incluye ${v.folio}`, (await page.getByRole('row').filter({ hasText: v.folio }).count()) === 1);
    await shot(page, 'fac_3_control');

    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin escrituras /api intentadas', writes.length === 0, writes.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? `  → ${d}` : ''}`);
  console.log(`\nFactura UI: ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
