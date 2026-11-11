// Reportes · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición /api
// que no sea GET (salvo login/logout) se aborta y hace fallar la prueba. Los valores esperados se calculan en la
// prueba a partir de la propia API (no se fijan cifras), con los documentos sintéticos de la Matriz General
// (OC-QA-0001 vigente en ...SF4EA4 con presupuesto USD; OC-QA-0003 en ...SCF210 con presupuesto MXN). Los importes de esas OC
// se toman de la versión vigente que devuelve /api/v1/purchase-orders (fuente independiente del reporte).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/reports_ui_e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const fmt = (n, c) => `${n < 0 ? '-' : ''}$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))} ${c}`;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1, acceptDownloads: true });
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
    let all = []; for (let p = 1; all.length < head.total; p++) all = all.concat((await api(`/api/v1/matrix/requisitions?page=${p}&page_size=50&q=&client=all&has=all`)).items);
    const stageById = new Map((await api('/api/v1/recovery/matrix')).items.map(x => [x.id, x.stage_index]));
    const clients = (await api('/api/v1/matrix/clients')).items; const qa2 = clients.find(c => c.code === 'QA02');
    const expect = rows => {
      const budget = {}; for (const r of rows) if (r.budget_amount !== null) budget[r.currency_code] = (budget[r.currency_code] || 0) + Number(r.budget_amount);
      return { total: rows.length, closed: rows.filter(r => stageById.get(r.id) === 7).length,
        overdue: rows.filter(r => { const s = stageById.get(r.id); return s !== null && s !== undefined && s < 6 && r.need_date && r.need_date < today; }).length, budget };
    };
    const pos = (await api('/api/v1/purchase-orders?page=1&page_size=50')).items; const poTotal = f => Number(pos.find(x => x.folio === f).total_amount);
    const po1 = poTotal('OC-QA-0001'), po3 = poTotal('OC-QA-0003');
    const kpi = async label => (await page.getByTestId('management-report').getByText(label, { exact: true }).locator('xpath=..').innerText()).replace(/\s+/g, ' ').trim();

    const waits = ['matrix/clients', 'matrix/requisitions\\?page=1&page_size=50', 'recovery/matrix$'].map(ep => page.waitForResponse(r => new RegExp('/api/v1/' + ep).test(r.url()), { timeout: 20000 }).then(r => r.status()).catch(() => 'sin respuesta'));
    await page.locator('nav button').filter({ hasText: /Reportes$/ }).click();
    const st = await Promise.all(waits);
    check('consulta clientes, requisiciones (páginas de 50) y etapas (200)', st.every(s => s === 200), st.join(','));
    await page.getByText('Generador de reporte gerencial').waitFor();
    check('reporte oculto hasta generarlo', await page.getByTestId('management-report').count() === 0);
    await page.waitForFunction(() => !document.body.innerText.includes('Consultando requisiciones en MariaDB'), null, { timeout: 20000 });

    // Reporte general
    await page.getByRole('button', { name: /Generar reporte/ }).click();
    const rep = page.getByTestId('management-report');
    await rep.waitFor();
    const e = expect(all);
    check('KPI requisiciones / cerradas / vencidas = MariaDB', (await kpi('Requisiciones')).startsWith(String(e.total)) && (await kpi('Cerradas')).startsWith(String(e.closed)) && (await kpi('Vencidas')).startsWith(String(e.overdue)),
      `${await kpi('Requisiciones')} | ${await kpi('Cerradas')} | ${await kpi('Vencidas')} vs ${e.total}/${e.closed}/${e.overdue}`);
    const budgetText = await kpi('Presupuesto');
    check('presupuesto por moneda, sin mezclar', Object.entries(e.budget).every(([c, v]) => budgetText.includes(fmt(v, c))), budgetText);
    check('comprado = OC vigentes únicas (sin la cancelada)', (await kpi('Comprado')).includes(fmt(po1 + po3, 'USD')), await kpi('Comprado'));
    check('ahorro/desviación solo comparable (USD: 15,000 − OC-QA-0001)', (await kpi('Ahorro / desviación')).includes(fmt(15000 - po1, 'USD')) && !(await kpi('Ahorro / desviación')).includes('MXN'), await kpi('Ahorro / desviación'));
    const summary = await rep.getByText(/Durante el periodo se gestionaron/).innerText();
    check('resumen ejecutivo con cifras reales', summary.includes(`gestionaron ${e.total} requisiciones`) && summary.includes(`Se cerraron ${e.closed} procesos`) && summary.includes(`${e.overdue} solicitudes vencidas`) && summary.includes(`${fmt(po1 + po3, 'USD')} (2 OC)`), summary);
    const concl = await page.getByTestId('report-conclusions').innerText();
    check('conclusiones generadas de los datos', (e.overdue ? concl.includes(`Priorizar las ${e.overdue} requisiciones vencidas`) : concl.includes('No hay requisiciones vencidas')) && concl.includes('En USD, el monto comprado se mantiene dentro'), concl);
    check('primera fila = orden del servidor', (await rep.locator('tbody tr').first().innerText()).includes(head.items[0].folio));
    await shot(page, 'reportes_1_general');
    const r1 = all.find(r => r.folio.endsWith('-SF4EA4'));
    const pageWith = Math.floor(all.indexOf(r1) / 25);
    for (let i = 0; i < pageWith; i++) await rep.getByRole('button', { name: 'Página siguiente' }).click();
    const row1 = (await rep.getByRole('row').filter({ hasText: r1.folio }).innerText()).replace(/\s+/g, ' ');
    check('fila con monto est., OC (conteo · importe), folio, recepción y etapa', ['$15,000.00 USD', `1 OC · ${fmt(po1, 'USD')}`, 'OC-QA-0001', 'REC-QA-0001', 'Factura'].every(x => row1.includes(x)), row1);

    // Filtro por cliente: OC en USD con presupuesto MXN → sin base comparable
    await page.getByLabel('Cliente').selectOption(qa2.id);
    await page.getByRole('button', { name: /Generar reporte/ }).click();
    const e2 = expect(all.filter(r => r.client_id === qa2.id));
    await page.waitForFunction(n => document.querySelector('[data-testid="management-report"]')?.innerText.includes(`gestionaron ${n} requisiciones`), e2.total);
    check('filtro de cliente: subtítulo y conteo', (await rep.innerText()).includes(qa2.name) && (await kpi('Requisiciones')).startsWith(String(e2.total)));
    check('sin base comparable cuando las monedas difieren', (await kpi('Ahorro / desviación')).includes('Sin base comparable') && (await kpi('Comprado')).includes(fmt(po3, 'USD')) && (await page.getByTestId('report-conclusions').innerText()).includes('no tienen presupuesto comparable'));
    await shot(page, 'reportes_2_cliente');

    // Filtro por etapa y periodo
    await page.getByLabel('Cliente').selectOption('all');
    await page.getByLabel('Etapa').selectOption({ label: 'Factura' });
    await page.getByRole('button', { name: /Generar reporte/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="management-report"]')?.innerText.includes('gestionaron 1 requisiciones'));
    check('filtro de etapa (Factura = 1)', (await rep.locator('tbody tr').count()) === 1);
    await page.getByLabel('Etapa').selectOption('all');
    const from = '2026-10-01', to = '2026-10-31';
    const inRange = all.filter(r => r.request_date && r.request_date >= from && r.request_date <= to).length;
    await page.getByLabel('Desde').fill(from); await page.getByLabel('Hasta').fill(to);
    await page.getByRole('button', { name: /Generar reporte/ }).click();
    await page.waitForFunction(n => document.querySelector('[data-testid="management-report"]')?.innerText.includes(`gestionaron ${n} requisiciones`), inRange);
    check('filtro de periodo por fecha de solicitud', (await kpi('Requisiciones')).startsWith(String(inRange)) && (await rep.innerText()).includes(`${from} — ${to}`));

    // CSV e impresión del alcance generado
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar CSV/ }).click()]);
    const lines = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').split('\r\n');
    check('CSV con todas las filas del reporte', lines.length === inRange + 1 && lines[0].startsWith('"Requisición","Cliente","Proyecto","Monto est.","OC"'), String(lines.length));
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: /Imprimir \/ PDF/ }).click()]);
    await popup.waitForLoadState();
    const ptxt = await popup.textContent('body');
    check('impresión: portada, KPIs, resumen, tabla y conclusiones', ptxt.includes('Reporte Gerencial de Suministro') && ptxt.includes('Resumen ejecutivo') && ptxt.includes('Conclusiones') && (await popup.locator('tbody tr').count()) === inRange);
    await popup.close();

    // Validación de rango
    await page.getByLabel('Desde').fill('2026-12-31');
    check('rango inválido bloquea la generación', await page.getByText('La fecha inicial es mayor que la final.').isVisible() && await page.getByRole('button', { name: /Generar reporte/ }).isDisabled());
    check('sin escrituras a la API', writes.length === 0, writes.join(', '));
    check('sin errores JavaScript', jsErrors.length === 0, jsErrors.join(' | '));
  } catch (err) {
    check('flujo sin excepción', false, err.stack || String(err));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/reportes_zz_error.png` }).catch(() => {});
  } finally { await browser.close(); }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nReportes UI: ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
