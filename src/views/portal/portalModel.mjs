// Portal del Cliente · presentación de la vista previa interna (las reglas de visibilidad y etapas las aplica el servidor).

const str = v => (v === null || v === undefined ? '' : String(v));
export const money = v => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');

/** Estado del portal del cliente según clients.portal_enabled / portal_locked. */
export function portalState(c, es = true) {
  if (!c) return '';
  if (!c.portal_enabled) return es ? 'Portal deshabilitado' : 'Portal disabled';
  return c.portal_locked ? (es ? 'Portal bloqueado' : 'Portal locked') : (es ? 'Portal habilitado' : 'Portal enabled');
}
export const clientOption = (c, es = true) => `${c.code} · ${c.name} · ${portalState(c, es)}`;
export const requisitionOption = (r, es = true) => `${r.folio} · ${str(r.project) || (es ? 'Sin proyecto' : 'No project')} · ${r.stage ? `${es ? 'Etapa' : 'Stage'} ${r.stage}` : (es ? 'Sin etapa inferida' : 'No inferred stage')}`;

/** Estado de cada una de las 8 etapas respecto de la etapa actual (null = sin etapa inferida: todas pendientes). */
export const stageStatus = (id, current) => (!current ? 'pending' : id < current ? 'completed' : id === current ? 'current' : 'pending');

/** Fotografías de recepción y de entrega de una requisición. */
export const photoTotals = r => ({ receipt: (r?.receipts || []).reduce((n, x) => n + (x.photos || 0), 0), delivery: (r?.deliveries || []).reduce((n, x) => n + (x.photos || 0), 0) });

/** Respuesta de /portal/preview/.../quotes/{id} → datos del formato comercial (precios de venta; sin costos). */
export function quoteDocument(api) {
  const q = api?.quote || {};
  const items = (api?.items || []).map(i => ({ id: i.line_number, desc: str(i.description), brand: str(i.brand_model) || '—', qty: i.quantity, unit: str(i.unit_label),
    price: i.unit_price, subtotal: i.line_subtotal ?? (Number(i.quantity) * Number(i.unit_price)) }));
  const third = Number(q.third_party_total_amount) > 0;
  return {
    folio: str(q.folio), revision: q.revision ?? 0, fecha: str(q.quote_date), vigencia: str(q.valid_until), moneda: str(q.currency), status: str(q.status_label),
    cliente: { empresa: str(q.client_name), contacto: str(q.client_contact) || '—', correo: str(q.client_email) || '—', telefono: str(q.client_phone) || '—',
      proyecto: str(q.project) || '—', contrato: str(q.contract) || '—', referencia: str(q.client_reference) || '—' },
    items,
    condiciones: { lugarEntrega: str(q.delivery_place) || '—', tiempoEntrega: str(q.lead_time_text) || '—', pago: str(q.payment_terms) || '—', garantia: str(q.warranty_text) || '—',
      alcance: str(q.inclusions_text) || '—', exclusiones: str(q.exclusions_text) || '—', notas: str(q.notes) || '—' },
    totales: { subtotal: q.subtotal_amount, descuento: Number(q.discount_amount) > 0 ? q.discount_amount : null, ivaPct: q.tax_rate_pct, iva: q.tax_amount, total: q.total_amount,
      terceros: third ? { base: q.third_party_taxable_amount, iva: q.third_party_tax_amount, total: q.third_party_total_amount } : null,
      fee: q.service_fee_enabled ? { pct: q.service_fee_rate_pct, subtotal: q.service_fee_subtotal_amount, iva: q.service_fee_tax_amount, total: q.service_fee_total_amount } : null },
    firmas: { comprador: { nombre: str(q.prepared_by) || '—', puesto: str(q.prepared_by_position) || '' }, reviso: { nombre: str(q.reviewed_by) || '—', puesto: str(q.reviewed_by_position) || '' },
      autorizo: { nombre: str(q.approved_by) || '—', puesto: str(q.approved_by_position) || '' } },
    emisor: api?.issuer || null,
  };
}
