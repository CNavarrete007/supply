// Matriz General · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda
// petición /api que no sea GET (salvo login/logout) se aborta y hace fallar la prueba.
// Requiere los documentos sintéticos de prueba (OC-QA-0001 vigente + OC-QA-0009 cancelada, REC-QA-0001,
// FAC-QA-0001, adjudicación en ...S082F7) sobre las requisiciones sintéticas QA0x-REQ-2026-S*.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/general_matrix_ui_e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
  // The print window calls print() and close(); keep it open so its content can be inspected.
  await context.addInitScript(() => { window.print = () => {}; window.close = () => { window.__closeRequested = true; }; });
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
    const head = await api('/api/v1/matrix/requisitions?page=1&page_size=1&q=&client=all&has=all');
    const clients = (await api('/api/v1/matrix/clients')).items;
    const qa1 = clients.find(c => c.code === 'QA01');
    let all = []; for (let p = 1; all.length < head.total; p++) all = all.concat((await api(`/api/v1/matrix/requisitions?page=${p}&page_size=50&q=&client=all&has=all`)).items);
    const r1 = all.find(r => r.folio.endsWith('-SF4EA4')); const r2 = all.find(r => r.folio.endsWith('-S082F7'));

    const waits = ['matrix/clients', 'matrix/requisitions\\?page=1&page_size=50', 'recovery/matrix$'].map(ep => page.waitForResponse(r => new RegExp('/api/v1/' + ep).test(r.url()), { timeout: 20000 }).then(r => r.status()).catch(() => 'sin respuesta'));
    await page.locator('nav button').filter({ hasText: /Matriz General$/ }).click();
    const st = await Promise.all(waits);
    check('consulta clientes, requisiciones (páginas de 50) y etapas (200)', st.every(s => s === 200), st.join(','));
    await page.getByText('Matriz general por cliente').waitFor();
    const allCard = page.getByRole('button', { name: /Abrir matriz de todos los clientes/ });
    await page.waitForFunction(() => !document.body.innerText.includes('Consultando requisiciones en MariaDB'), null, { timeout: 20000 });
    const nums = async loc => (await loc.locator('span.text-sm.font-black').allTextContents()).map(Number);
    const allNums = await nums(allCard);
    check('tarjeta "Todos los clientes" = resumen de MariaDB (requisiciones, con OC, con factura)',
      allNums.join() === [head.summary.total, head.summary.with_purchase_order, head.summary.with_invoice].join(), `${allNums} vs ${head.summary.total},${head.summary.with_purchase_order},${head.summary.with_invoice}`);
    check('una tarjeta por cliente registrado', await page.getByText(`${clients.length} de ${clients.length} clientes`).isVisible());
    const qa1Card = page.getByRole('button', { name: `Abrir matriz de ${qa1.name}` });
    const qa1Nums = await nums(qa1Card);
    check('tarjeta del cliente con conteos reales', qa1Nums[0] === qa1.requisitions && qa1Nums[1] === 1 && qa1Nums[2] === 1, qa1Nums.join());
    check('matriz cerrada hasta seleccionar cliente', await page.getByTestId('client-matrix').count() === 0);
    await page.getByLabel('Buscar cliente').fill('PRY-QA02');
    check('búsqueda de tarjetas por proyecto', await page.getByText(`1 de ${clients.length} clientes`).isVisible() && await qa1Card.count() === 0);
    await page.getByLabel('Buscar cliente').fill('');
    await shot(page, 'matriz_1_tarjetas');

    // Matriz del cliente QA01
    await qa1Card.click();
    const matrix = page.getByTestId('client-matrix');
    await matrix.waitFor();
    const qa1Rows = all.filter(r => r.client_id === qa1.id);
    check('matriz del cliente con sus requisiciones', await matrix.getByText(`${qa1Rows.length} requisiciones visibles`).isVisible());
    const row1 = matrix.getByRole('row').filter({ hasText: r1.folio });
    const t1 = (await row1.textContent()).replace(/\s+/g, ' ');
    check('fila con OC, proveedor ganador, recepción, factura, monto, etapa y riesgo reales',
      ['OC-QA-0001', 'Aceros Sintéticos del Norte', 'REC-QA-0001', 'FAC-QA-0001', '$15,000.00 USD', 'Factura', 'Facturado', 'PRY-QA01 · Contrato: CTO-QA01'].every(x => t1.includes(x)), t1);
    check('OC cancelada no aparece como vigente', !t1.includes('OC-QA-0009'));
    const row2 = matrix.getByRole('row').filter({ hasText: r2.folio });
    const t2 = (await row2.textContent()).replace(/\s+/g, ' ');
    const risk2 = r2.need_date < today ? 'Vencido' : 'A tiempo';
    check('proveedor ganador por adjudicación, cotizaciones, etapa y riesgo', ['Instrumentos Europa Sintética', 'por adjudicación', 'Comparativo y autorización', risk2].every(x => t2.includes(x)) && (await row2.locator('td').nth(3).textContent()).trim().startsWith('2'), t2);
    check('Emitir OC bloqueado', await row1.getByRole('button', { name: /Emitir OC/ }).isDisabled());
    await shot(page, 'matriz_2_cliente');
    await matrix.getByLabel('Etapa').selectOption({ label: 'Factura (1)' });
    check('filtro de etapa', await matrix.getByText('1 requisiciones visibles').isVisible() && await row1.count() === 1);
    await matrix.getByLabel('Etapa').selectOption('all');
    await matrix.getByLabel('Documentos').selectOption('supplier_quote');
    check('filtro de documentos', await row2.count() === 1 && await row1.count() === 1 && await matrix.getByText('2 requisiciones visibles').isVisible());
    await matrix.getByLabel('Documentos').selectOption('all');
    await matrix.getByLabel('Buscar en la matriz').fill('fac-qa-0001');
    check('búsqueda por folio de factura', await matrix.getByText('1 requisiciones visibles').isVisible());
    await matrix.getByLabel('Buscar en la matriz').fill('');

    // Detalle existente (con proveedor de la OC)
    const detResp = page.waitForResponse(r => /\/api\/v1\/matrix\/requisitions\/[0-9a-f-]{36}$/.test(r.url()));
    await row1.getByRole('button', { name: /^Ver$/ }).click();
    check('detalle "Ver" (200)', (await detResp).status() === 200);
    const dialog = page.getByRole('dialog');
    await dialog.getByText('OC-QA-0009').waitFor();
    const dtxt = await dialog.textContent();
    check('detalle muestra OC con su proveedor (incluida la cancelada, con su estatus)', dtxt.includes('OC-QA-0001') && dtxt.includes('Aceros Sintéticos del Norte') && dtxt.includes('Cancelada'));
    await dialog.getByRole('button', { name: 'Cerrar detalle' }).click();
    check('cerrar el detalle no cierra la matriz', await matrix.isVisible());

    // CSV
    const [dl] = await Promise.all([page.waitForEvent('download'), matrix.getByRole('button', { name: /Exportar CSV/ }).click()]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    check('CSV con BOM, encabezado y una fila por requisición visible', csv.startsWith('﻿') && lines.length === qa1Rows.length + 1 && lines[0].startsWith('"Requisición","Cliente"') && csv.includes('"OC-QA-0001"'), `${lines.length}`);
    check('nombre de archivo del CSV', dl.suggestedFilename() === `Matriz_QA01_${today}.csv`, dl.suggestedFilename());

    // Impresión
    const [popup] = await Promise.all([page.waitForEvent('popup'), matrix.getByRole('button', { name: /Imprimir/ }).click()]);
    await popup.waitForLoadState();
    await popup.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0);
    const ptxt = await popup.textContent('body');
    check('impresión con las filas filtradas', (await popup.locator('tbody tr').count()) === qa1Rows.length && ptxt.includes('Grupo Gerez') && ptxt.includes(qa1.name) && ptxt.includes('FAC-QA-0001'));
    await popup.close();

    // Fondo cierra la matriz; "Todos los clientes" abre todo
    await page.locator('div.min-h-screen.cursor-pointer').first().click({ position: { x: 8, y: 8 } });
    check('clic en el fondo cierra la matriz', await page.getByTestId('client-matrix').count() === 0);
    await allCard.click();
    await matrix.waitFor();
    check('"Abrir todo" muestra todas las requisiciones', await matrix.getByText(`${head.total} requisiciones visibles`).isVisible());
    check('primera fila = orden del servidor', (await matrix.getByRole('row').nth(1).textContent()).includes(head.items[0].folio));
    await shot(page, 'matriz_3_todos');

    check('sin escrituras a la API', writes.length === 0, writes.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (e) {
    check('flujo sin excepción', false, e.stack || String(e));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/matriz_zz_error.png` }).catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nMatriz General UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
