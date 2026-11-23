// Servicios Operativos · sección 1 "Dashboard" · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta. Las cifras esperadas se calculan aquí,
// de forma independiente, a partir de GET /api/v1/services/matrix (no se reutiliza el código de la pantalla).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/service_dashboard_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const today = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const money = v => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 2600 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  const T = id => page.getByTestId(id);
  const txt = async id => flat(await T(id).innerText());
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const all = async (q = '') => { const rows = []; let p = 1; let first; do { const r = await api(`/api/v1/services/matrix?page=${p}&page_size=50&buyer=all${q}`); first = first || r; rows.push(...r.items); if (rows.length >= r.total) break; p += 1; } while (p <= 40); return { rows, first }; };
    const { rows, first } = await all('&client=all');
    const cat = await api('/api/v1/services/new-request');
    // Moneda principal: la de más servicios (MXN en empate); las demás no se suman y la pantalla muestra el código.
    const byCur = {}; rows.forEach(x => { const c = x.currency || ''; byCur[c] = (byCur[c] || 0) + 1; });
    const curs = Object.entries(byCur).sort((a, b) => b[1] - a[1] || (a[0] === 'MXN' ? -1 : b[0] === 'MXN' ? 1 : 0) || a[0].localeCompare(b[0]));
    const mainCur = curs[0] ? curs[0][0] : ''; const multi = curs.length > 1;
    const main = rows.filter(x => (x.currency || '') === mainCur);
    const mm = v => `${money(v)}${multi && mainCur ? ` ${mainCur}` : ''}`;
    const sum = (list, k) => list.reduce((n, x) => n + Number(x[k] || 0), 0);

    const resp = page.waitForResponse(r => r.url().includes('/api/v1/services/matrix'));
    await page.locator('nav button').filter({ hasText: /Servicios Operativos$/ }).click();
    check('el Dashboard consulta la Matriz de MariaDB (200)', (await resp).status() === 200);
    await T('sd-kpi-services').waitFor();
    const page1 = flat(await T('service-dashboard').innerText());
    check('sin datos de demostración (clientes, folios ni meses fijos del mock)', !/Hornbeck Offshore|Hool Energy|SRV-2026-00001|Oct 25 Nov 25 Dic 25/.test(page1));
    check('aviso propio: panel conectado a MariaDB (solo lectura)', (await T('services-notice').innerText()).includes('Panel ejecutivo conectado a MariaDB (solo lectura)'));
    const active = cat.service_types.filter(t => t.active);
    check('encabezado "Servicios configurados" con los tipos activos reales', (await T('services-types-count').innerText()) === `${active.length} tipo(s) activo(s)` && (await T('services-types-list').innerText()) === active.map(t => t.name).join(' · '));
    check('origen: total de servicios de MariaDB', (await txt('sd-source')).includes(`${rows.length} servicio(s) en el periodo · ${rows.length} con este cliente/servicio en MariaDB`));

    // ---- KPIs ----
    const open = rows.filter(x => x.is_open).length;
    const exec = rows.filter(x => x.is_done || /^(completado|listo para facturar|facturado)$/i.test(x.status)).length;
    const inv = rows.filter(x => (x.invoices || '').trim() || /^facturado$/i.test(x.status)).length;
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    check('KPI Servicios = total de la Matriz', (await txt('sd-kpi-services')).startsWith(`${rows.length} 📦`));
    check('KPI Activos = servicios abiertos y % del total', (await txt('sd-kpi-active')).startsWith(`${open} ⚙️`) && (await txt('sd-kpi-active')).endsWith(`${pct(open, rows.length)}% del total`));
    check('KPI Ejecutados y Facturados', (await txt('sd-kpi-executed')).startsWith(`${exec} ✅`) && (await txt('sd-kpi-invoiced')).startsWith(`${inv} 🧾`));
    const sp = sum(main, 'price'); const sc = sum(main, 'cost');
    check('KPI Ingresos, Costos y Margen = sumas reales de venta y costo (moneda principal)', (await txt('sd-kpi-income')).startsWith(mm(sp)) && (await txt('sd-kpi-cost')).startsWith(mm(sc)) && (await txt('sd-kpi-margin')).startsWith(mm(sp - sc))
      && (await txt('sd-kpi-margin')).includes(`${(sp > 0 ? ((sp - sc) / sp) * 100 : 0).toFixed(1)}% de margen`), `${money(sp)} ${money(sc)}`);
    check('otras monedas se informan aparte, sin sumarse', !multi || curs.slice(1).every(([c]) => flat(page1).includes(`${c || 'sin moneda'}: venta`)));
    const evid = rows.filter(x => x.evidence_count > 0).length;
    check('barras: expediente con evidencia y conversión a factura', (await txt('sd-bar-evidence')).includes(`${pct(evid, rows.length)}%`) && (await txt('sd-bar-invoice')).includes(`${pct(inv, rows.length)}%`));

    // ---- Tendencia, estatus, tipos, clientes ----
    const t0 = today(); const y = Number(t0.slice(0, 4)); const mo = Number(t0.slice(5, 7));
    const months = await T('sd-trend').locator('[data-month]').evaluateAll(els => els.map(e => e.getAttribute('data-month')));
    const expMonths = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(y, mo - 12 + i, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; });
    check('tendencia: últimos 12 meses terminando en el mes actual', JSON.stringify(months) === JSON.stringify(expMonths) && (await txt('sd-trend')).endsWith(`${MONTHS[mo - 1]} ${String(y).slice(2)}`), months.join(','));
    const st = {}; rows.forEach(x => { st[x.status] = (st[x.status] || 0) + 1; });
    const grid = await txt('sd-status-grid');
    check('estado operativo: conteo por cada estatus real', Object.entries(st).every(([k, n]) => grid.includes(`${n} ${k}`)) && (await txt('sd-donut')).startsWith(`${rows.length} servicios`), grid);
    const types = [...new Set(rows.map(x => x.service))];
    const tc = await txt('sd-type-count');
    check('servicios por tipo: los tipos reales con su volumen', types.every(t => tc.includes(t) && tc.includes(String(rows.filter(x => x.service === t).length))), tc);
    const topIncome = Object.entries(main.reduce((m, x) => ({ ...m, [x.client_name]: (m[x.client_name] || 0) + Number(x.price || 0) }), {})).sort((a, b) => b[1] - a[1])[0];
    check('top clientes por ingreso (moneda principal)', !topIncome || (await txt('sd-top-clients')).includes(money(topIncome[1])));
    const ext = rows.filter(x => x.requires_supplier).length; const linked = rows.filter(x => x.requires_supplier && x.supplier_po).length;
    check('contratación externa: interna, con proveedor, con OC y OC pendiente', (await txt('sd-ext-internal')).startsWith(String(rows.length - ext)) && (await txt('sd-ext-external')).startsWith(String(ext)) && (await txt('sd-ext-linked')).startsWith(String(linked)) && (await txt('sd-ext-pending')).startsWith(String(ext - linked)));
    check('embudo: Solicitudes = total y Facturados', (await txt('sd-funnel')).startsWith(`Solicitudes ${rows.length}`) && (await txt('sd-funnel')).endsWith(`Facturados ${inv}`));
    check('autorización: "Con documento adjunto" sin dato inventado', (await txt('sd-auth')).includes('Con documento adjunto sin registro'));
    const overdue = rows.filter(x => x.is_open && x.required_date && x.required_date.slice(0, 10) < t0).length;
    check('indicadores de gestión: vencidos, margen negativo, proveedor externo y con evidencia', (await txt('sd-m-overdue')).endsWith(String(overdue)) && (await txt('sd-m-negative')).endsWith(String(rows.filter(x => !/cancel/i.test(x.status) && Number(x.price) - Number(x.cost) < 0).length))
      && (await txt('sd-m-external')).endsWith(String(ext)) && (await txt('sd-m-evidence')).endsWith(String(evid)));
    const alerts = await txt('sd-alerts');
    check('alertas reales por folio (sin el texto de demostración)', rows.some(x => alerts.includes(x.folio)) || alerts.includes('Sin alertas para este filtro.'));
    if (SHOTS) await T('service-dashboard').screenshot({ path: `${SHOTS}/sd-all.png` });

    // ---- Filtros ----
    const clientOpts = await T('sd-client').locator('option').allInnerTexts();
    check('filtro de clientes con los clientes reales con servicios', clientOpts[0] === 'Todos los clientes' && first.summary.clients.every(c => clientOpts.includes(c.name)) && clientOpts.length === first.summary.clients.length + 1);
    const c0 = first.summary.clients[0];
    const r1 = page.waitForResponse(r => r.url().includes(`client=${c0.id}`));
    await T('sd-client').selectOption(c0.id);
    check('filtrar por cliente consulta MariaDB con ese cliente (200)', (await r1).status() === 200);
    await page.waitForFunction(n => document.querySelector('[data-testid=sd-kpi-services]')?.innerText.trim().startsWith(String(n)), c0.services);
    check('KPI Servicios del cliente = servicios del cliente', (await txt('sd-kpi-services')).startsWith(String(c0.services)));
    await T('sd-client').selectOption('all');
    await page.waitForFunction(n => document.querySelector('[data-testid=sd-kpi-services]')?.innerText.trim().startsWith(String(n)), rows.length);
    const s0 = types[0];
    const r2 = page.waitForResponse(r => r.url().includes(`service=${encodeURIComponent(s0).replace(/%20/g, '+')}`) || r.url().includes(`service=${encodeURIComponent(s0)}`));
    await T('sd-service').selectOption(s0);
    await r2;
    const ns = rows.filter(x => x.service === s0).length;
    await page.waitForFunction(n => document.querySelector('[data-testid=sd-kpi-services]')?.innerText.trim().startsWith(String(n)), ns);
    check('filtrar por tipo de servicio (en el servidor)', (await txt('sd-kpi-services')).startsWith(String(ns)));
    await T('sd-service').selectOption('');
    await page.waitForFunction(n => document.querySelector('[data-testid=sd-kpi-services]')?.innerText.trim().startsWith(String(n)), rows.length);
    const ym = t0.slice(0, 7); const yy = t0.slice(0, 4);
    await T('sd-period').selectOption('month');
    check('periodo "Mes actual" por fecha de solicitud', (await txt('sd-kpi-services')).startsWith(String(rows.filter(x => (x.date || '').slice(0, 7) === ym).length)));
    await T('sd-period').selectOption('year');
    check('periodo "Año actual"', (await txt('sd-kpi-services')).startsWith(String(rows.filter(x => (x.date || '').slice(0, 4) === yy).length)));
    check('la tendencia de 12 meses no cambia con el periodo', JSON.stringify(await T('sd-trend').locator('[data-month]').evaluateAll(els => els.map(e => e.getAttribute('data-month')))) === JSON.stringify(expMonths));
    await T('sd-period').selectOption('all');

    // ---- Error y reintento ----
    await page.route('**/api/v1/services/matrix**', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICES_UNAVAILABLE', message: 'No se pudo consultar la matriz de servicios.' } }) }));
    await T('sd-client').selectOption(c0.id);
    await T('sd-error').waitFor();
    check('error (503) → mensaje seguro y Reintentar', (await txt('sd-error')).includes('No se pudo consultar la matriz de servicios.') && await T('sd-retry').isVisible());
    await page.unroute('**/api/v1/services/matrix**');
    await T('sd-retry').click();
    await T('sd-kpi-services').waitFor();
    check('Reintentar vuelve a cargar el panel', (await txt('sd-kpi-services')).startsWith(String(c0.services)));

    // ---- Teléfono ----
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    check('teléfono (390 px): sin desplazamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    check('ninguna escritura enviada (solo GET)', writes.length === 0, writes.join(', '));
    check('sin errores de JavaScript', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 300));
  } catch (e) {
    check('ejecución sin excepciones', false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
  const w = Math.max(...results.map(r => r[0].length));
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(w)}  ${ok ? '' : d}`);
  const failed = results.filter(r => !r[1]).length;
  console.log(`\nDashboard de servicios (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
