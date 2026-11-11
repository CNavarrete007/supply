// Órdenes de Compra · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición /api
// que no sea GET (salvo login/logout) se aborta. Valores esperados calculados desde la API (OC-QA-0001, OC-QA-0003 Rev. 2,
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

    const first = page.waitForResponse(r => /\/api\/v1\/purchase-orders\?page=1&page_size=25/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /Órdenes de Compra$/ }).click();
    check('matriz consulta OC (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Emisión de orden de compra', 'Matriz de órdenes', 'Control de autorización', 'Modificaciones / Enmiendas', 'Revisión y autorización', 'Formato de Orden de Compra'])
      check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t) }).first().isVisible());
    await page.getByText(`${head.total} órdenes (versión vigente)`).waitFor();
    const row3 = page.getByRole('row').filter({ hasText: 'OC-QA-0003' });
    const t3 = (await row3.innerText()).replace(/\s+/g, ' ');
    check('fila: Rev. 2, requisición, proveedor, comprador, monto, avance de la serie', ['Rev. 2', 'QA02-REQ-2026-SCF210', 'Instrumentos Europa Sintética', 'QA Comprador', '$3,900.00 USD', '50% recibido', 'Emitida'].every(x => t3.includes(x)), t3);
    check('solo la versión vigente de cada OC', await page.getByRole('row').filter({ hasText: 'OC-QA-0003' }).count() === 1);
    check('OC cancelada muestra su estatus original', (await page.getByRole('row').filter({ hasText: 'OC-QA-0009' }).innerText()).includes('Cancelada'));
    check('nueva orden, solicitar modificación y eliminar bloqueados', await page.getByRole('button', { name: /Nueva orden/ }).isDisabled() && await row3.getByRole('button', { name: /Solicitar modificaci/i }).isDisabled() && await row3.getByRole('button', { name: /Eliminar OC/i }).isDisabled());
    const buyerCard = page.getByRole('button', { name: /QA Comprador/ });
    const bt = (await buyerCard.innerText()).replace(/\s+/g, ' ');
    const b = head.summary.buyers[0];
    check('tarjeta por comprador: OC, pendientes y recibidas', bt.includes(`${b.count} OC ${b.count - b.received} Pendientes ${b.received} Recibidas`), bt);
    await shot(page, 'oc_1_matriz');
    const byBuyer = page.waitForResponse(r => new RegExp(`buyer=${b.id}`).test(r.url()));
    await buyerCard.click();
    check('filtro por comprador en el servidor (200)', (await byBuyer).status() === 200);
    await page.getByText(`${b.count} órdenes (versión vigente)`).waitFor();
    check('sin la OC que no tiene comprador', await page.getByRole('row').filter({ hasText: 'OC-QA-0009' }).count() === 0);
    await page.getByRole('button', { name: /Todas las órdenes de compra/ }).click();
    const qResp = page.waitForResponse(r => /q=SCF210/.test(r.url()));
    await page.getByLabel('Buscar órdenes').fill('SCF210');
    check('búsqueda por folio de requisición en el servidor', (await qResp).status() === 200);
    await page.getByText('1 órdenes (versión vigente)').waitFor();
    await page.getByLabel('Buscar órdenes').fill('');
    await page.getByText(`${head.total} órdenes (versión vigente)`).waitFor();

    // Formato
    await row3.getByRole('button', { name: /Ver PDF/i }).click();
    const fmt = page.getByTestId('po-format'); await fmt.waitFor();
    const frame = page.frameLocator('iframe[title="Formato de OC"]');
    await frame.getByText('Orden de Compra OC-QA-0003 · Rev. 2').waitFor();
    const ftxt = await frame.locator('body').innerText();
    check('formato: partidas, total, firmas y referencias', ['Instrumento sintético', '$3,900.00 USD', 'QA Comprador', 'QA02-REQ-2026-SCF210'].every(x => ftxt.includes(x)), ftxt.slice(0, 300));
    check('formato: versiones y recepción de la serie', (await fmt.innerText()).includes('Rev. 1') && (await fmt.innerText()).includes('Rev. 2 · Cambio de cantidad') && (await fmt.innerText()).includes('REC-QA-0003'));
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: /Imprimir \/ Guardar PDF/ }).click()]);
    await popup.waitForLoadState(); check('imprimir abre el formato', (await popup.textContent('body')).includes('OC-QA-0003')); await popup.close();
    await shot(page, 'oc_6_formato');

    // Emisión
    await page.getByRole('button', { name: /Emisión de orden de compra/ }).first().click();
    const iss = await api('/api/v1/purchase-orders/issuance');
    await page.getByText('Partidas adjudicadas').waitFor();
    const metric = async l => Number((await page.getByText(l, { exact: true }).locator('xpath=preceding-sibling::div[1]').innerText()).trim());
    check('emisión: métricas desde adjudicaciones reales', await metric('Partidas adjudicadas') === iss.items.reduce((n, i) => n + i.items, 0) && await metric('OC por generar') === iss.items.filter(i => !i.existing_pos).length && await metric('Cotizaciones perdedoras') === iss.losing_quotes);
    check('emisión: crear OC bloqueado', await page.getByRole('button', { name: /Crear OC de este proveedor/ }).first().isDisabled());
    await shot(page, 'oc_2_emision');

    // Control de autorización
    await page.getByRole('button', { name: /Control de autorización/ }).first().click();
    const ca = async l => Number((await page.getByText(l, { exact: true }).locator('xpath=preceding-sibling::span[1]').innerText()).trim());
    check('control: contadores = MariaDB', await ca('adjudicaciones pendientes de OC.') === ctr.awards_without_po && await ca('órdenes generadas automáticamente.') === ctr.auto_generated && await ca('órdenes vencidas sin recepción.') === ctr.overdue_without_receipt);

    // Enmiendas
    await page.getByRole('button', { name: /Modificaciones \/ Enmiendas/ }).first().click();
    await page.getByText('Familias de OC').waitFor();
    const fam = page.locator('div.rounded-2xl').filter({ has: page.getByText('OC-QA-0003', { exact: true }) }).last();
    await fam.getByRole('button', { name: /Historial/i }).click();
    const ftext = (await fam.innerText()).replace(/\s+/g, ' ');
    check('enmiendas: familia con Rev. 1 y Rev. 2 y modificar bloqueado', ftext.includes('Rev. 1') && ftext.includes('Rev. 2') && await fam.getByRole('button', { name: /Modificar OC/i }).isDisabled(), ftext);
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
