import React, { useEffect, useState } from 'react';
import { loadWriteStatus, writeStatusNotice } from './writeStatus.mjs';

// Aviso al abrir un catálogo cuando el guardado en MariaDB no está habilitado en este equipo (no aparece si todo está bien).
// variant 'tailwind' (Clientes, Proveedores, Suministros) o 'legacy' (Catálogo de categorías, estilos .note).
export function CatalogWriteStatus({ entity, en = false, variant = 'tailwind' }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    loadWriteStatus().then(s => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, []);
  const n = writeStatusNotice(status, entity, en);
  if (!n) return null;
  if (variant === 'legacy') {
    return <div className="note warn" role="alert" data-testid="catalog-write-status" data-code={n.code} style={{ marginBottom: 12 }}>
      <b>{n.title}.</b> {n.text}{n.action ? <> {n.action}</> : null}
    </div>;
  }
  return <div role="alert" data-testid="catalog-write-status" data-code={n.code} className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
    <span aria-hidden="true" className="text-base leading-none">⚠️</span>
    <div className="space-y-1"><p className="font-bold">{n.title}</p><p>{n.text}</p>{n.action && <p className="text-amber-800">{n.action}</p>}</div>
  </div>;
}
