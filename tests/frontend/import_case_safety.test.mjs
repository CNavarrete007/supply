// Seguridad de imports en Windows/macOS (sistemas de archivos que no distinguen mayúsculas).
// Un import relativo sin extensión es ambiguo si en la carpeta existen dos archivos cuyo nombre solo difiere en
// mayúsculas/extensión (p. ej. ChangeControl.jsx y changeControl.mjs): Vite prueba .mjs antes que .jsx y en Windows
// carga el archivo equivocado aunque en Linux funcione. También falla si el import no coincide exactamente en mayúsculas.
// Ejecutar: node --test tests/frontend/import_case_safety.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src');
const EXT = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']; // orden de resolve.extensions de Vite
const IMPORT = /(?:import|export)[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]/g;

function* sources(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* sources(p);
    else if (/\.(jsx?|mjs)$/.test(e.name)) yield p;
  }
}

test('relative imports resolve to one file regardless of letter case', () => {
  const problems = [];
  for (const file of sources(ROOT)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[1] || m[2];
      const target = path.resolve(path.dirname(file), spec);
      const dir = path.dirname(target), base = path.basename(target);
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const names = fs.readdirSync(dir);
      const ext = path.extname(base);
      const where = `${path.relative(ROOT, file)} → '${spec}'`;
      if ([...EXT, '.css'].includes(ext)) {
        const same = names.filter(n => n.toLowerCase() === base.toLowerCase());
        if (same.length && !same.includes(base)) problems.push(`${where}: mayúsculas distintas de ${same.join(', ')}`);
        continue;
      }
      const candidates = names.filter(n => EXT.includes(path.extname(n)) && path.basename(n, path.extname(n)).toLowerCase() === base.toLowerCase());
      if (candidates.length > 1) problems.push(`${where}: ambiguo en Windows (${candidates.join(', ')}); usa la extensión explícita`);
      else if (candidates.length === 1 && path.basename(candidates[0], path.extname(candidates[0])) !== base) problems.push(`${where}: mayúsculas distintas de ${candidates[0]}`);
    }
  }
  assert.deepEqual(problems, []);
});
