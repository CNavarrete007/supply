// Inicio y Dashboard · indicadores ampliados (servicios, Service-to-Cash, Service Fee, abastecimiento por lotes, proveedores,
// recompra, enmiendas, compradores y funciones de OC) · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS.
// Solo lectura: toda petición /api que no sea GET (salvo login/logout) se aborta. Valores esperados desde GET /analytics/overview.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/main_dashboard_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const flat = s => String(s).replace(/\s+/g, ' ').trim();
const fc = n => new Intl.NumberFormat('es-MX').format(Number(n) || 0);
const fa = (n, c) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: c || 'MXN', maximumFractionDigits: 2 }).format(Number(n) || 0);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  const T = id => page.getByTestId(id);
  const card = async label => flat(await page.locator('div').filter({ has: page.locator(`p:text-is("${label}")`) }).last().innerText());
  try {
    await page.goto(UI + '/');
    const first = page.waitForResponse(r => r.url().includes('/api/v1/analytics/overview'));
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    const resp = await first;
    const o = await resp.json();
    check('el Dashboard consulta analytics/overview (200) con los bloques ampliados', resp.status() === 200 && ['services', 'service_fee', 'sourcing', 'supplier_activity', 'repeat', 'po_amendments', 'buyers', 'po_roles', 'invoices'].every(k => k in o));
    await T('dash-services').waitFor({ timeout: 20000 });
    const body = flat(await page.locator('main').innerText());
    check('ya no hay tarjetas con «Pendiente de integración» (salvo pagos)', !/Pendiente de integraci[oó]n/.test(body.replace(/estatus de pago de cada factura está pendiente de integración/i, '')) && body.includes('Pagadas · sin registro de pagos'), (body.match(/.{60}Pendiente de integraci.{40}/) || [''])[0]);

    // ---- Tarjetas superiores ----
    const sv = o.services; const fee = o.service_fee;
    const top = flat(await page.locator('main').innerText());
    check('tarjeta Servicios = total de servicios y abiertos', top.includes(`${fc(sv.total)} Servicios Service-to-Cash · ${fc(sv.open)} abierto(s)`));
    const money = {}; for (const x of o.financial.customer_quotes) money[x.currency_code] = 1;
    const cur = Object.keys(money).sort((a, b) => (a === 'MXN' ? -1 : b === 'MXN' ? 1 : a.localeCompare(b)))[0] || '';
    const feeCur = fee.by_currency.find(x => x.currency_code === cur && x.with_fee > 0);
    check('tarjeta Service fee = Service Fee de la moneda seleccionada', top.includes(`${fa(feeCur ? feeCur.fee_amount : 0, cur || 'MXN')} Service fee ${fc(fee.with_fee)} de ${fc(fee.versions)} cotización(es)`), top.match(/.{30}Service fee.{60}/)?.[0]);

    check('lectura ejecutiva: servicios activos (abiertos) reales', top.includes(`servicio(s) activo(s)`) && top.includes(`${fc(sv.open)} servicio(s) activo(s)`));
    const prog = (() => { const tot = sv.stages.reduce((a, n) => a + n, 0); return tot ? Math.round(sv.stages.reduce((a, n, i) => a + n * [10, 22, 36, 50, 64, 76, 90, 100][i], 0) / tot) : null; })();
    check('avance del ciclo: Service-to-Cash y Service fee aplicado', top.includes(`Service-to-Cash ${prog === null ? '—' : prog + '%'}`) && top.includes(`Service fee aplicado ${fee.versions ? Math.round(fee.with_fee * 100 / fee.versions) + '%' : '—'}`));
    check('Ahorro y Desempeño: evaluados reales; ahorro y costo sin estimar', (await card('Evaluados')).startsWith(fc(o.supplier_activity.evaluated)) && top.includes('no se estiman'));
    check('nota del mapa de abastecimiento actualizada', top.includes('Las cifras reales por lote, partida, proveedor y RFQ están en las tarjetas de arriba.'));
    // ---- Abastecimiento por lotes ----
    const sc = await page.getByTestId('dash-sourcing-card').allInnerTexts();
    const src = o.sourcing;
    const exp = [[src.to_batch, 'Por lotificar'], [src.batched, 'Requisiciones lotificadas'], [src.items_with_rfq, 'Partidas con RFQ'], [src.assigned_suppliers, 'Proveedores asignados'], [src.pending_rfqs, 'RFQ pendientes'], [src.parallel, 'Rutas paralelas']];
    check('abastecimiento por lotes: 6 tarjetas con los valores reales', sc.length === 6 && exp.every(([n, l], i) => flat(sc[i]).startsWith(`${fc(n)} ${l}`)), sc.map(flat).join(' | '));
    check('nota del abastecimiento ya no dice «no hay endpoint»', !body.includes('todavía no hay un endpoint de consulta'));

    // ---- Proveedores, servicios, Service-to-Cash, Service Fee ----
    const sup = o.supplier_activity.suppliers;
    if (sup.length) {
      const st = flat(await T('dash-suppliers').innerText());
      check('proveedores con mayor actividad: nombre, RFQ, ofertas y adjudicadas', sup.every(s => st.includes(`${s.name} ${fc(s.rfqs)} ${fc(s.quotes)} ${fc(s.awards)}`)), st.slice(0, 300));
    } else check('proveedores con mayor actividad: estado vacío', body.includes('Sin RFQ, ofertas ni adjudicaciones para este filtro.'));
    const ds = flat(await T('dash-services').innerText());
    check('panel Servicios Operativos: servicios, abiertos, ejecutados y facturados', ds.startsWith(`${fc(sv.total)} Servicios ${fc(sv.open)} Abiertos ${fc(sv.executed)} Ejecutados ${fc(sv.invoiced)} Facturados`), ds);
    const s2c = flat(await T('dash-s2c').innerText());
    check('Service-to-Cash: 8 etapas en orden con sus conteos', sv.stage_names.every((n, i) => s2c.includes(`${i + 1}. ${n} ${fc(sv.stages[i])}`)), s2c);
    check('«Servicios autorizados» = servicios con autorización válida', (await card('Servicios autorizados')).startsWith(fc(sv.authorized)));
    check('Cotización + Service Fee: con Service Fee y aprobadas por cliente', (await card('Con Service Fee')).startsWith(fc(fee.with_fee)) && (await card('Aprobadas por cliente')).startsWith(fc(fee.approved)));

    // ---- Recompra, enmiendas, rutas y políticas ----
    const rp = o.repeat;
    const r3 = flat(await page.locator('main').innerText());
    check('recompra: precios respetados, por recotizar y precio comercial pendiente', r3.includes(`${fc(rp.honored)} Precios respetados`) && r3.includes(`${fc(rp.requote)} Partidas por recotizar`) && r3.includes(`${fc(rp.price_pending)} Precio comercial pendiente`));
    check('enmiendas de OC: versiones enmendadas y solicitudes', r3.includes(`${fc(o.po_amendments.amended_versions)} Enmiendas de OC Versiones enmendadas · ${fc(o.po_amendments.requests_total)} solicitud(es)`));
    if (rp.items) {
      const pr = flat(await T('dash-price-routes').innerText());
      check('rutas de precio al cliente por tratamiento', rp.price_modes.every(m => pr.includes(fc(m.n))) && /Precio fijo|Nuevo precio|Validar precio/.test(pr), pr);
      check('rutas de abastecimiento por tratamiento', /Reutilizar|Validar costo|Recotizar proveedor/.test(flat(await T('dash-supply-routes').innerText())));
    } else check('rutas: estado vacío sin partidas desde historial', body.includes('Sin partidas desde historial en este filtro.'));
    const pol = flat(await T('dash-client-policies').innerText());
    check('políticas de clientes de venta y abasto', pol.includes('Venta ·') && pol.includes('Abasto ·') && rp.client_policies.sales.every(x => pol.includes(fc(x.n))), pol.slice(0, 300));

    // ---- Compradores y segregación de funciones ----
    if (o.buyers.items.length) {
      const bt = flat(await T('dash-req-buyers').innerText());
      check('compradores de requisiciones (validación interna): nombre, requisiciones y con OC', o.buyers.items.every(x => bt.includes(`${x.name || 'Sin comprador asignado'} ${fc(x.requisitions)} ${fc(x.with_po)} con OC`)), bt);
    } else check('compradores de requisiciones: estado vacío', body.includes('Sin requisiciones validadas en este filtro.'));
    for (const [k, id] of [['buyer', 'dash-po-buyer'], ['preparer', 'dash-po-preparer'], ['authorizer', 'dash-po-authorizer']]) {
      const list = o.po_roles[k];
      if (!list.length) { check(`funciones de OC · ${k}: estado vacío`, true); continue; }
      const tx = flat(await T(id).innerText());
      check(`funciones de OC · ${k}: personas y OC`, list.every(x => tx.includes(`${x.name || 'Sin asignar'} ${fc(x.orders)}`)), tx);
    }
    if (SHOTS) { await page.screenshot({ path: `${SHOTS}/main-dash-top.png` }); }

    // ---- Filtro de cliente ----
    const cl = await (await page.request.get(UI + '/api/v1/services/matrix?page=1&page_size=1&client=all&buyer=all')).json();
    const c0 = cl.summary.clients[0];
    if (c0) {
      const filt = page.waitForResponse(r => r.url().includes('/api/v1/analytics/overview') && r.url().includes(c0.id));
      await page.locator('select').filter({ has: page.locator(`option[value="${c0.id}"]`) }).first().selectOption(c0.id);
      const oc = await (await filt).json();
      await page.waitForFunction(n => (document.querySelector('[data-testid=dash-services]')?.innerText || '').trim().startsWith(n), fc(oc.services.total));
      check('filtro de cliente: los indicadores ampliados se recalculan en el servidor', oc.services.total === c0.services && flat(await T('dash-services').innerText()).startsWith(`${fc(oc.services.total)} Servicios`));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    check('teléfono (390 px): sin desplazamiento horizontal de la página', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
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
  console.log(`\nInicio y Dashboard · indicadores ampliados (UI): ${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
