// INT03-D1 · SOLO pruebas locales sintéticas: Vite + proxy /api hacia la API sandbox.
// En Docker el proxy lo hace Nginx (docker/supply-recovery/nginx.conf); este archivo no se usa ahí.
import { defineConfig, mergeConfig } from 'vite';
import original from '../../vite.config.js';
export default mergeConfig(original, defineConfig({
  root: new URL('../..', import.meta.url).pathname,
  publicDir: false,
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': { target: process.env.SF_API || 'http://127.0.0.1:8090', changeOrigin: false } } },
}));
