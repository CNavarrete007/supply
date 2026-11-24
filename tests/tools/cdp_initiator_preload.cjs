// SupplyFlow · precarga de medición para las pruebas Playwright (solo desarrollo local con datos sintéticos).
// Por cada petición /api que hace el navegador registra método, ruta (sin query ni cuerpo) y los archivos /src/ de la pila de
// llamadas (incluida la asíncrona) que la originaron; las navegaciones a /api (window.open) se marcan como «(ventana nueva)».
// No cambia el comportamiento de las pruebas: solo escucha eventos CDP. Salida: JSON por línea en $SF_INITIATOR_LOG.
// Uso: SF_INITIATOR_LOG=<archivo> node -r ./tests/tools/cdp_initiator_preload.cjs tests/frontend/<prueba>.cjs
// (o NODE_OPTIONS="--require <ruta absoluta>" para toda la suite). Luego: tests/class_connection_audit.py --initiator-log <archivo>.
const fs = require('fs');
const LOG = process.env.SF_INITIATOR_LOG;
const TEST = (process.argv[1] || '').replace(/^.*\/tests\//, 'tests/');
let pw;
try { pw = require('playwright'); } catch { pw = null; }
if (pw && LOG && !pw.__sfInitiator) {
  pw.__sfInitiator = true;
  const files = st => {
    const out = [];
    for (let s = st; s; s = s.parent) for (const f of s.callFrames || []) {
      const m = /\/(src\/[^?#]+)/.exec(f.url || '');
      if (m && !m[1].includes('node_modules') && !out.includes(m[1])) out.push(m[1]);
    }
    return out;
  };
  const attach = async (ctx, page) => {
    try {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Debugger.enable').catch(() => {});
      await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 }).catch(() => {});
      await cdp.send('Network.enable');
      cdp.on('Network.requestWillBeSent', e => {
        let u; try { u = new URL(e.request.url); } catch { return; }
        if (!u.pathname.startsWith('/api/')) return;
        fs.appendFileSync(LOG, JSON.stringify({ test: TEST, method: e.request.method, path: u.pathname, files: files(e.initiator && e.initiator.stack) }) + '\n');
      });
    } catch { /* página cerrada */ }
  };
  const origLaunch = pw.chromium.launch.bind(pw.chromium);
  pw.chromium.launch = async (...a) => {
    const browser = await origLaunch(...a);
    const origNew = browser.newContext.bind(browser);
    browser.newContext = async (...b) => {
      const ctx = await origNew(...b);
      const seen = new WeakSet();
      const origCtxPage = ctx.newPage.bind(ctx);
      ctx.newPage = async (...c) => { const p = await origCtxPage(...c); seen.add(p); await attach(ctx, p); return p; };
      ctx.on('page', p => { if (!seen.has(p)) { seen.add(p); attach(ctx, p); } }); // ventanas emergentes
      // Navegaciones a /api (p. ej. window.open de «Ver archivo»): no tienen pila de script; se registran como ventana nueva.
      ctx.on('request', r => {
        try {
          const u = new URL(r.url());
          if (r.isNavigationRequest() && u.pathname.startsWith('/api/')) fs.appendFileSync(LOG, JSON.stringify({ test: TEST, method: r.method(), path: u.pathname, files: ['(ventana nueva)'], nav: true }) + '\n');
        } catch { /* ignorar */ }
      });
      return ctx;
    };
    const origPage = browser.newPage.bind(browser);
    browser.newPage = async (...b) => { const p = await origPage(...b); await attach(p.context(), p); return p; };
    return browser;
  };
}
