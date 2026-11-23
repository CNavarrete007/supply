// SupplyFlow · auditoría de conexión (SOLO LECTURA): recorre los 18 módulos del menú y cada tarjeta/pestaña superior.
// Por pantalla registra los endpoints GET consultados (normalizados), respuestas no exitosas, avisos de error visibles,
// pantallas que se quedan "Cargando", textos de demostración o "pendiente de integración" y errores de JavaScript.
// Toda petición /api que no sea GET (salvo login/logout) se ABORTA: puede ejecutarse contra datos reales sin modificarlos.
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_USER=<correo>] [SF_REPORT=<archivo.json>] node tests/frontend/system_audit_e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const USER = process.env.SF_USER || 'qa.admin.a@supplyflow.invalid';
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const REPORT = process.env.SF_REPORT || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local y SF_QA_PASSWORD.'); process.exit(2); }

const MENU = ['Inicio y Dashboard', 'Flujo del Proceso', 'Portal del Cliente', 'Clientes', 'Proveedores', 'Suministros de proveedores', 'Contratista',
  'Solicitud / Requisición', 'Gestión del Contratista', 'Cotizaciones y Comparativo', 'Órdenes de Compra', 'Recepción y Entrega', 'Factura',
  'Servicios Operativos', 'Matriz General', 'Reportes', 'Usuarios y roles', 'Configuración'];
// Botones que ejecutan acciones (no son tarjetas/pestañas de navegación): no se pulsan en el recorrido.
const ACTION = /guardar|eliminar|borrar|enviar|aprobar|autorizar|registrar|emitir|firmar|rechaz|retirar|cancelar|cerrar|imprimir|descargar|exportar|importar|limpiar|reiniciar|subir|cargar archivo|nueva|nuevo|agregar|crear|editar|actualizar|refrescar|reintentar|ver |ver$|abrir|seleccionar|siguiente|anterior|copiar|generar|validar|solicitar|marcar|vincular|consultar|english|español|⟳|↻|✕|×|\+/i;
const norm = u => { const p = new URL(u).pathname; return p.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '{id}').replace(/\/\d+(?=\/|$)/g, '/{n}'); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await ctx.newPage();
  let cur = null;
  const screens = [];
  const jsErrors = [];
  page.on('pageerror', e => { if (cur) cur.js.push(String(e).slice(0, 200)); else jsErrors.push(String(e)); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const writes = [];
  await ctx.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${norm(r.url())}`); return route.abort('blockedbyclient');
  });
  page.on('response', resp => {
    if (!cur || !resp.url().includes('/api/v1/')) return;
    const k = norm(resp.url());
    cur.api[k] = cur.api[k] || [];
    if (!cur.api[k].includes(resp.status())) cur.api[k].push(resp.status());
  });
  const start = (module, tab) => { cur = { module, tab, api: {}, js: [], alerts: [], loading: false, demo: [] }; screens.push(cur); };
  const settle = async () => {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    for (let i = 0; i < 16; i++) { // hasta 8 s esperando que desaparezca "Cargando"
      const txt = await page.locator('main').innerText().catch(() => '');
      if (!/Cargando|Calculando|Loading/i.test(txt)) break;
      await page.waitForTimeout(500);
    }
    const txt = await page.locator('main').innerText().catch(() => '');
    cur.loading = /Cargando datos|Cargando…|Cargando\.\.\.|Calculando etapas/i.test(txt);
    const clean = txt.replace(/sin datos de demostración|no demo fallback/gi, '');
    cur.demo = ['Módulo pendiente de integración', 'datos de demostración', 'demo data', 'DEMO'].filter(w => clean.includes(w));
    cur.alerts = (await page.locator('main [role=alert]').allInnerTexts().catch(() => [])).map(t => t.replace(/\s+/g, ' ').slice(0, 160)).filter(Boolean);
  };
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill(USER);
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    for (const label of MENU) {
      start(label, '(entrada)');
      await page.locator('nav button').filter({ hasText: new RegExp(`${label.replace(/[/()]/g, m => '\\' + m)}$`) }).first().click();
      await settle();
      // Tarjetas/pestañas superiores: botones visibles en la parte alta de main con texto descriptivo y que no son acciones.
      const tabs = await page.locator('main button:visible').evaluateAll((els, re) => {
        const rx = new RegExp(re, 'i');
        return els.map(e => ({ t: (e.innerText || '').replace(/\s+/g, ' ').trim(), y: e.getBoundingClientRect().top, h: e.getBoundingClientRect().height }))
          .filter(b => b.t.length >= 6 && b.t.length <= 400 && b.y < 1100 && b.h >= 36 && !rx.test(b.t.split(' ').slice(0, 3).join(' ')));
      }, ACTION.source);
      const seen = new Set();
      for (const b of tabs) {
        const key = b.t.split(' ').slice(0, 5).join(' ');
        if (seen.has(key)) continue; seen.add(key);
        // El título y la descripción de una tarjeta quedan pegados en textContent: se tolera la falta de espacio entre palabras.
        const rx = new RegExp(key.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('\\s*'));
        const btn = page.locator('main button:visible').filter({ hasText: rx }).first();
        if (!(await btn.count())) continue;
        start(label, key);
        await btn.click({ timeout: 5000 }).catch(() => { cur.skipped = true; });
        await settle();
        // Cierra modales que se hayan abierto.
        await page.keyboard.press('Escape').catch(() => {});
      }
    }
  } catch (err) {
    jsErrors.push(String(err).slice(0, 300));
  } finally {
    await browser.close();
  }
  const bad = screens.filter(s => s.js.length || s.loading || s.demo.length || Object.values(s.api).some(st => st.some(x => x >= 400)));
  const report = { screens, writes_blocked: writes, js_errors_outside: jsErrors, problems: bad };
  if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  for (const s of screens) {
    const flags = [s.js.length ? `JS:${s.js.length}` : '', s.loading ? 'CARGANDO' : '', s.demo.length ? `DEMO:${s.demo.join('/')}` : '',
      Object.entries(s.api).filter(([, st]) => st.some(x => x >= 400)).map(([k, st]) => `${k}=${st.join('/')}`).join(' ')].filter(Boolean).join(' ');
    console.log(`${flags ? 'REVISAR' : 'OK     '}  ${s.module} › ${s.tab}  [${Object.keys(s.api).length} endpoint(s)]  ${flags}${s.alerts.length ? '  avisos: ' + s.alerts.join(' | ').slice(0, 200) : ''}`);
  }
  console.log(`\nPantallas: ${screens.length} · con problemas: ${bad.length} · escrituras bloqueadas: ${writes.length} · errores fuera de pantalla: ${jsErrors.length}`);
  process.exit(bad.length || jsErrors.length ? 1 : 0);
})();
