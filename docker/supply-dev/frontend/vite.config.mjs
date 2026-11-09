import { defineConfig, mergeConfig } from 'vite';
import originalConfig from '../vite.config.js';

// Extiende la configuracion original; no altera plugins, package, lock ni src.
export default defineConfig(async (environment) => {
  const original = typeof originalConfig === 'function'
    ? await originalConfig(environment)
    : await originalConfig;
  return mergeConfig(original || {}, {
    root: process.cwd(),
    cacheDir: 'node_modules/.vite',
    // El proyecto recibido no tiene public/. Sus assets usados estan en src/ y el SVG raiz.
    publicDir: false,
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['localhost', '127.0.0.1'],
      watch: { usePolling: true, interval: 250 },
      ws: { clientPort: 8080 },
      fs: { strict: true, allow: [process.cwd()] },
    },
  });
});
