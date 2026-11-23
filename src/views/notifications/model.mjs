// Campana · presentación de las notificaciones de MariaDB (sin reglas de negocio: el servidor filtra por destinatario).

/** Documento ligado → módulo de la barra lateral (id de pestaña de App.jsx) y etiqueta corta. */
const KINDS = {
  purchase_order: ['purchase_orders', 'OC', 'PO'],
  purchase_order_modification_request: ['purchase_orders', 'Modificación OC', 'PO change'],
  requisition: ['requisition', 'Requisición', 'Requisition'],
  requisition_change_request: ['requisition', 'Cambio', 'Change'],
  review: ['contractor_mgmt', 'Validación', 'Validation'],
  rfq: ['quotes', 'RFQ', 'RFQ'],
  supplier_quote: ['quotes', 'Oferta', 'Bid'],
  customer_quote: ['quotes', 'Cotización', 'Quote'],
  customer_quote_version: ['quotes', 'Cotización', 'Quote'],
  goods_receipt: ['reception', 'Recepción', 'Receipt'],
  delivery: ['reception', 'Entrega', 'Delivery'],
  invoice: ['invoice', 'Factura', 'Invoice'],
  service_order: ['operational_services', 'Servicio', 'Service'],
  client: ['clients', 'Cliente', 'Client'],
  supplier: ['suppliers', 'Proveedor', 'Supplier'],
};
export const entityModule = entity => (entity && KINDS[entity.kind] ? KINDS[entity.kind][0] : null);
export function entityLabel(entity, es = true) {
  if (!entity) return '';
  const k = KINDS[entity.kind];
  const name = k ? k[es ? 1 : 2] : entity.kind;
  return entity.folio ? `${name} ${entity.folio}` : name;
}

/** Fecha guardada en UTC (DATETIME sin zona) → hora local legible; "hace N min/h" si es de las últimas 24 h. */
export function whenText(value, es = true, now = new Date()) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1') + (/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return String(value);
  const min = Math.floor((now - d) / 60000);
  if (min >= 0 && min < 60) return es ? `hace ${Math.max(1, min)} min` : `${Math.max(1, min)} min ago`;
  if (min >= 60 && min < 1440) return es ? `hace ${Math.floor(min / 60)} h` : `${Math.floor(min / 60)} h ago`;
  return d.toLocaleString(es ? 'es-MX' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
}

/** Contador de la campana: no leídas en MariaDB + mensajes de esta sesión sin leer. */
export const badgeCount = (serverUnread, local = []) => (Number(serverUnread) || 0) + local.filter(n => !n.read).length;
export const badgeText = n => (n > 99 ? '99+' : String(n));
