// Hook: monedas activas de esta base para los selectores que guardan una moneda (null mientras carga o si no hay acceso).
import { useEffect, useState } from 'react';
import { loadCurrencies } from './currencies.mjs';

export function useCurrencyCodes() {
  const [codes, setCodes] = useState(null);
  useEffect(() => {
    let alive = true;
    loadCurrencies().then(c => { if (alive) setCodes(c); });
    return () => { alive = false; };
  }, []);
  return codes;
}
