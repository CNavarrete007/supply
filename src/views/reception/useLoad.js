import { useEffect, useState } from 'react';

// GET con AbortController: { status: idle|loading|ready|error, data, error }. Compartido por las tarjetas de Recepción y Entrega.
export function useLoad(fn, deps, enabled = true) {
  const [st, setSt] = useState({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!enabled) { setSt({ status: 'idle', data: null, error: null }); return undefined; }
    const c = new AbortController();
    setSt(x => ({ ...x, status: 'loading', error: null }));
    fn(c.signal).then(d => !c.signal.aborted && setSt({ status: 'ready', data: d, error: null })).catch(e => !c.signal.aborted && setSt(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, [enabled, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
