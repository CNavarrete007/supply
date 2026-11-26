import React, { useEffect, useState } from 'react';
import { quoteWriteStatus } from './api';
import { quoteNotice } from './quoteWriteStatus.mjs';

// Aviso al abrir Registro de cotización (tarjeta 4) cuando el guardado en MariaDB no está habilitado en este equipo.
export function QuoteWriteStatus({ en = false }) {
  const [status, setStatus] = useState(null);
  useEffect(() => { let alive = true; quoteWriteStatus().then(s => { if (alive) setStatus(s); }); return () => { alive = false; }; }, []);
  const n = quoteNotice(status, en);
  if (!n) return null;
  return <div role="alert" data-testid="quote-write-status" data-code={n.code} className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
    <span aria-hidden="true" className="text-base leading-none">⚠️</span>
    <div className="space-y-1"><p className="font-bold">{n.title}</p><p>{n.text}</p>{n.action && <p className="text-amber-800">{n.action}</p>}</div>
  </div>;
}
