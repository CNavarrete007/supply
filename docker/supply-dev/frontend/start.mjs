import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const lockfile = resolve(root, 'package-lock.json');
const manifest = resolve(root, 'package.json');
const stamp = resolve(root, 'node_modules/.supplyflow-install-fingerprint');
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
let activeChild;
let stopSignal;

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    stopSignal = signal;
    activeChild?.kill(signal);
  });
}

function run(command, args) {
  return new Promise((accept, reject) => {
    activeChild = spawn(command, args, { cwd: root, stdio: 'inherit' });
    activeChild.once('error', reject);
    activeChild.once('exit', (code, signal) => {
      activeChild = undefined;
      if (code === 0) accept();
      else reject(new Error(`${command} termino con ${signal || `codigo ${code}`}.`));
    });
  });
}

try {
  if (!existsSync(manifest) || !existsSync(lockfile)) {
    throw new Error('Faltan package.json o package-lock.json originales en los mounts del frontend.');
  }
  const fingerprint = createHash('sha256')
    .update(readFileSync(manifest))
    .update(readFileSync(lockfile))
    .update(`${process.version}:${process.platform}:${process.arch}`)
    .digest('hex');
  const installed = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : '';
  if (installed !== fingerprint || !existsSync(vite)) {
    console.log('[SupplyFlow] Instalando el lock original en el volumen Linux node_modules.');
    await run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund']);
    if (stopSignal) throw new Error('Inicio cancelado.');
    writeFileSync(stamp, `${fingerprint}\n`, { mode: 0o600 });
  } else {
    console.log('[SupplyFlow] Dependencias verificadas por huella de package/lock/Node.');
  }
  console.log('[SupplyFlow] Vite sirve el React original; acceso por http://localhost:8080.');
  await run(process.execPath, [vite, '--config', resolve(root, '.supply-dev/vite.config.mjs')]);
} catch (error) {
  if (!stopSignal) console.error(`[SupplyFlow] ${error.message}`);
  process.exitCode = stopSignal === 'SIGINT' ? 130 : stopSignal === 'SIGTERM' ? 143 : 1;
}
