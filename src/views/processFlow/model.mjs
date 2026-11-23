// Flujo del Proceso · textos y cálculos de presentación sobre GET /api/v1/analytics/process-flow (sin reglas de negocio nuevas:
// las etapas y los indicadores los calcula el servidor con la evidencia de MariaDB).

/** "N proceso(s)"; sin dato → "— proceso(s)". */
export const processCount = (n, es = true) => `${Number.isFinite(n) ? n : '—'} ${es ? 'proceso(s)' : 'process(es)'}`;

/** Motivo de cada cuello de botella (código del servidor → texto ES/EN). */
const P2P_REASONS = {
  request: ['pendiente de validación interna.', 'pending internal validation.'],
  validation_blocked: ['la validación interna no permite cotizar.', 'internal validation does not allow quoting.'],
  lots: ['validada; falta definir lotes y rutas.', 'validated; lots and routes pending.'],
  rfq: ['lotes definidos; RFQ por emitir.', 'lots defined; RFQ to be issued.'],
  offers: ['RFQ enviada; faltan ofertas registradas.', 'RFQ sent; missing registered bids.'],
  compare: ['ofertas recibidas; comparativo y adjudicación pendientes.', 'bids received; comparison and award pending.'],
  quote: ['adjudicada; cotización al cliente pendiente.', 'awarded; client quote pending.'],
  review: ['cotización en borrador; revisión comercial pendiente.', 'draft quote; commercial review pending.'],
  authorize: ['cotización revisada; autorización comercial pendiente.', 'quote reviewed; commercial approval pending.'],
  send: ['cotización autorizada; envío al cliente pendiente.', 'quote authorized; sending to client pending.'],
  decision: ['cotización enviada; esperando decisión del cliente.', 'quote sent; awaiting client decision.'],
  po: ['cotización aprobada; OC a proveedor pendiente.', 'quote approved; supplier PO pending.'],
  rejected: ['cotización rechazada por el cliente.', 'quote rejected by the client.'],
  change_requested: ['el cliente solicitó modificaciones a la cotización.', 'the client requested quote changes.'],
  receipt: ['OC emitida; recepción pendiente.', 'PO issued; receiving pending.'],
  delivery: ['recibida; entrega o aceptación del cliente pendiente.', 'received; client delivery or acceptance pending.'],
  invoice: ['entregada y aceptada; factura pendiente.', 'delivered and accepted; invoice pending.'],
  history: ['expediente desde historial: etapa no inferida.', 'history-based file: stage not inferred.'],
  change: ['con control de cambios: etapa no inferida.', 'under change control: stage not inferred.'],
};
const S2C_REASONS = {
  link: ['sin requisición vinculada o fecha de solicitud.', 'no linked requisition or request date.'],
  authorization: ['autorización comercial del cliente pendiente.', 'client commercial authorization pending.'],
  planning: ['pendiente de planeación y programación.', 'planning and scheduling pending.'],
  supplier_po: ['requiere proveedor; OC pendiente.', 'requires supplier; PO pending.'],
  execution: ['pendiente de ejecución.', 'execution pending.'],
  evidence: ['ejecutado; falta evidencia y aceptación.', 'executed; evidence and acceptance missing.'],
  closure: ['validación y cierre comercial pendientes.', 'validation and commercial closure pending.'],
};

/** Texto del cuello de botella: "FOLIO: motivo." (las ofertas se detallan cuando faltan). */
export function bottleneckText(item, route = 'p2p', es = true) {
  const table = route === 'p2p' ? P2P_REASONS : S2C_REASONS;
  const pair = table[item.reason] || ['etapa pendiente.', 'pending stage.'];
  let text = pair[es ? 0 : 1];
  if (item.reason === 'offers' && Number.isFinite(item.offers) && Number.isFinite(item.min_offers)) {
    text = es ? `RFQ enviada; ${item.offers} de ${item.min_offers} oferta(s) mínimas registradas.` : `RFQ sent; ${item.offers} of ${item.min_offers} minimum bid(s) registered.`;
  }
  return `${item.folio}: ${text}`;
}

/** Detalle del cuello de botella: cliente · etapa · antigüedad. */
export function bottleneckMeta(item, stageNames = [], es = true) {
  const parts = [item.client_name || ''];
  if (item.service) parts.push(item.service);
  parts.push(item.stage ? `${es ? 'Etapa' : 'Stage'} ${item.stage}${stageNames[item.stage - 1] ? ` · ${stageNames[item.stage - 1]}` : ''}` : (es ? 'Sin etapa inferida' : 'No inferred stage'));
  if (Number.isFinite(item.days)) parts.push(es ? `${item.days} día(s) desde la solicitud` : `${item.days} day(s) since request`);
  return parts.filter(Boolean).join(' · ');
}

/** Comprobación de coherencia: cada grupo de la política de 8 etapas = suma de sus etapas de 15. */
export function groupTotals(stages = [], groupOf = []) {
  const out = Array(8).fill(0);
  stages.forEach((n, i) => { if (groupOf[i] !== undefined) out[groupOf[i]] += Number(n) || 0; });
  return out;
}

/** KPI de la pestaña Indicadores según la ruta activa (P2P o Service-to-Cash). */
export function indicatorCards(data, route = 'p2p', es = true) {
  if (route === 'services') {
    const s = data?.services || {};
    return [
      [s.total, es ? 'Servicios' : 'Services', es ? 'Expedientes registrados' : 'Registered files'],
      [s.pending_auth, es ? 'Autorización pendiente' : 'Pending authorization', es ? 'Regularizar antes de facturar' : 'Regularize before billing'],
      [s.pending_po, es ? 'OC proveedor pendiente' : 'Pending vendor PO', es ? 'Solo cuando requiere tercero' : 'Only if 3rd party required'],
      [s.executed, es ? 'Ejecutados' : 'Executed', es ? 'Completados / listos' : 'Completed / ready'],
      [s.ready, es ? 'Listos para facturar' : 'Ready to invoice', es ? 'Sin factura registrada' : 'No invoice yet'],
      [s.invoiced, es ? 'Facturados' : 'Invoiced', es ? 'Cierre comercial' : 'Commercial closure'],
    ];
  }
  const i = data?.indicators || {};
  return [
    [i.rfq_to_issue, es ? 'RFQ por emitir' : 'RFQs to issue', es ? 'Validadas sin RFQ' : 'Validated w/o RFQ'],
    [i.insufficient_bids, es ? 'Ofertas insuficientes' : 'Insufficient bids', es ? 'Revisar mínimo' : 'Check minimum'],
    [i.awaiting_client, es ? 'Pendientes del cliente' : 'Pending client', es ? 'Esperando decisión' : 'Awaiting decision'],
    [i.approved_without_po, es ? 'Aprobadas sin OC' : 'Approved w/o PO', es ? 'Emitir compra' : 'Issue PO'],
    [i.po_without_receipt, es ? 'OC sin recepción' : 'PO w/o receiving', es ? 'Seguimiento a proveedor' : 'Follow-up vendor'],
    [i.receipts_without_delivery, es ? 'Recepciones sin entrega' : 'Receiving w/o delivery', es ? 'Pendientes del cliente' : 'Pending client'],
  ];
}

/** Valor de un KPI: número o "—" mientras no hay datos. */
export const kpiValue = v => (Number.isFinite(v) ? String(v) : '—');
