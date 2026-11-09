try {
  const response = await fetch('http://127.0.0.1:5173/', {
    signal: AbortSignal.timeout(2500),
  });
  const html = await response.text();
  if (!response.ok || !html.includes('/src/main.jsx') || !html.includes('/@vite/client')) {
    throw new Error('Vite no devuelve el HTML de desarrollo del proyecto.');
  }
} catch {
  process.exitCode = 1;
}
