import React, { useState } from 'react';
import { GitMerge, ArrowRight, ChevronDown, ChevronUp, Map, Zap, Route } from 'lucide-react';

export function ProcessFlow({ onNavigate = () => {}, onNotify, lang = 'es' }) {
  const isEs = lang === 'es';

  const [activeSubTab, setActiveSubTab] = useState('mapa');
  
  // Estado para desplegar el flujo al hacer clic ('p2p' | 'services' | null) en la pestaña mapa
  const [selectedRoute, setSelectedRoute] = useState('p2p');
  
  // Estado para la etapa seleccionada dentro del flujo Procure-to-Pay (Compra/Renta)
  const [selectedStage, setSelectedStage] = useState(1);

  // Estado para la etapa seleccionada dentro del flujo Service-to-Cash (Servicios Operativos)
  const [selectedServiceStage, setSelectedServiceStage] = useState(1);

  // Estado para la ruta activa dentro del sub-tab "Detalle por etapa", "Matriz del proceso" e "Indicadores" ('p2p' | 'services')
  const [detailRoute, setDetailRoute] = useState('p2p');

  // Estado para desplegar el detalle completo en el Flujo Comercial Detallado
  const [expandedCommercialStage, setExpandedCommercialStage] = useState(null);

  // Función auxiliar para formatear valores de texto o arreglos
  const formatFieldValue = (val) => {
    if (Array.isArray(val)) return val.join(', ');
    return val || '-';
  };

  // Función para cambiar de sub-tab y notificar si se requiere
  const handleTabChange = (tabId, tabTitle) => {
    setActiveSubTab(tabId);
    if (onNotify) {
      onNotify(
        isEs ? 'Flujo de Proceso' : 'Process Flow', 
        isEs ? `Visualizando sección: ${tabTitle}` : `Viewing section: ${tabTitle}`
      );
    }
  };

  const tabs = [
    { 
      id: 'mapa', 
      icon: '🗺️', 
      title: isEs ? 'Mapa interactivo' : 'Interactive Map', 
      desc: isEs ? 'Vista general del proceso, etapas, avances y estado actual.' : 'Process overview, stages, progress, and current status.' 
    },
    { 
      id: 'servicios', 
      icon: '🚚', 
      title: isEs ? 'Flujo de servicios' : 'Service Flow', 
      desc: isEs ? 'Solicitud, autorización comercial, ejecución, evidencia, OC proveedor y facturación.' : 'Request, commercial authorization, execution, evidence, vendor PO, and billing.' 
    },
    { 
      id: 'etapa', 
      icon: '🧩', 
      title: isEs ? 'Detalle por etapa' : 'Stage Detail', 
      desc: isEs ? 'Entradas, actividades, controles, salidas, responsables y evidencia.' : 'Inputs, activities, controls, outputs, responsible parties, and evidence.' 
    },
    { 
      id: 'comercial', 
      icon: '🔄', 
      title: isEs ? 'Flujo comercial detallado' : 'Detailed Commercial Flow', 
      desc: isEs ? 'RFQ, ofertas, comparativo, cotización al cliente, aprobación y compra.' : 'RFQ, bids, comparison, client quote, approval, and purchase.' 
    },
    { 
      id: 'especiales', 
      icon: '⚡', 
      title: isEs ? 'Rutas especiales' : 'Special Routes', 
      desc: isEs ? 'Historial/recompra, política por partida, cambios y enmiendas de OC.' : 'History/repurchase, line-item policy, changes, and PO amendments.' 
    },
    { 
      id: 'matriz', 
      icon: '📋', 
      title: isEs ? 'Matriz del proceso' : 'Process Matrix', 
      desc: isEs ? 'Matriz detallada tipo SIPOC / control operativo del flujo.' : 'Detailed SIPOC / operational control matrix.' 
    },
    { 
      id: 'indicadores', 
      icon: '📊', 
      title: isEs ? 'Indicadores y cuellos de botella' : 'KPIs & Bottlenecks', 
      desc: isEs ? 'Alertas, documentos, desvíos y oportunidades de mejora.' : 'Alerts, documents, deviations, and improvement opportunities.' 
    },
  ];

  // Las 14 etapas del flujo Procure-to-Pay (Compra/Renta)
  const p2pStages = [
    { 
      id: 1, 
      title: isEs ? 'Solicitud / requisición' : 'Request / Requisition', 
      desc: isEs ? 'Registrar la necesidad del cliente como un solo expediente.' : 'Record the clients need as a single file.', 
      count: isEs ? '218 proceso(s)' : '218 process(es)', 
      color: 'border-blue-500 text-blue-600 bg-blue-50',
      badge: isEs ? 'Cliente a Interno' : 'Client to Internal',
      badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      numBadgeColor: 'bg-blue-600 text-white',
      entradas: isEs ? ['Cliente, proyecto, contrato, partidas, cantidades y fecha requerida.'] : ['Client, project, contract, line items, quantities and required date.'],
      actividades: isEs ? ['Capturar solicitud y partidas.'] : ['Capture request and line items.'],
      controles: isEs ? ['Datos mínimos y partidas completas.'] : ['Minimum data and complete line items.'],
      salidas: isEs ? ['Requisición trazable.'] : ['Traceable requisition.'],
      evidencias: isEs ? ['Solicitud / requisición'] : ['Request / Requisition'],
      responsable: isEs ? 'Comercial / Compras' : 'Commercial / Purchasing',
      criterio: isEs ? 'Solicitud guardada.' : 'Request saved.'
    },
    { 
      id: 2, 
      title: isEs ? 'Validación interna' : 'Internal Validation', 
      desc: isEs ? 'Confirmar viabilidad técnica, contractual, presupuestal y responsable.' : 'Confirm technical, contractual, and budgetary feasibility.', 
      count: isEs ? '2 proceso(s)' : '2 process(es)', 
      color: 'border-teal-500 text-teal-600 bg-teal-50',
      badge: isEs ? 'Interno/confidencial' : 'Internal/Confidential',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      numBadgeColor: 'bg-teal-600 text-white',
      entradas: isEs ? ['Requisición registrada.'] : ['Registered requisition.'],
      actividades: isEs ? ['Validar alcance, contrato, presupuesto y estrategia general.'] : ['Validate scope, contract, budget, and overall strategy.'],
      controles: isEs ? ['Validación conforme.'] : ['Internal compliance.'],
      salidas: isEs ? ['Requisición liberada para definir abastecimiento.'] : ['Released requisition to define sourcing.'],
      evidencias: isEs ? ['Validación interna'] : ['Internal validation'],
      responsable: isEs ? 'Compras / Técnico / Presupuesto' : 'Purchasing / Technical / Budget',
      criterio: isEs ? 'Validación lista para cotizar.' : 'Validation ready to quote.'
    },
    { 
      id: 3, 
      title: isEs ? 'Estrategia y lotificación por partida' : 'Strategy and subdivision by lot', 
      desc: isEs ? 'Separar las partidas en lotes y definir la ruta de cada artículo.' : 'Separate the items into batches and define the route for each item.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-purple-500 text-purple-600 bg-purple-50',
      badge: isEs ? 'Proveedor a Interno' : 'Supplier to Internal',
      badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
      numBadgeColor: 'bg-purple-600 text-white',
      entradas: isEs ? ['Requisición validada y catálogo de proveedores/suministros.'] : ['Validated requisition and supplier/supplies catalog.'],
      actividades: isEs ? ['Agrupar por categoría, asignar estrategia, proveedores y mínimo de ofertas por lote.'] : ['Group by category, assign strategy, suppliers and minimum bids per lot.'],
      controles: isEs ? ['Cada partida tiene lote y estrategia; los lotes RFQ tienen proveedor.'] : ['Each item has lot and strategy; RFQ lots have assigned supplier.'],
      salidas: isEs ? ['Plan de abastecimiento por partida.'] : ['Line item sourcing plan.'],
      evidencias: isEs ? ['RFQ PDF'] : ['RFQ PDF'],
      responsable: isEs ? 'Comprador' : 'Purchaser',
      criterio: isEs ? 'Lotes guardados y rutas definidas.' : 'Lots saved and routes defined.'
    },
    { 
      id: 4, 
      title: isEs ? 'RFQ por lote y proveedor' : 'RFQ by lot and supplier', 
      desc: isEs ? 'Solicitar únicamente las partidas que corresponden a cada proveedor.' : 'Request only the line items that correspond to each supplier.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-indigo-500 text-indigo-600 bg-indigo-50',
      badge: isEs ? 'Interno/confidencial' : 'Internal/Confidential',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      numBadgeColor: 'bg-indigo-600 text-white',
      entradas: isEs ? ['Estrategia definida.'] : ['Defined strategy.'],
      actividades: isEs ? ['Generar y enviar RFQ por lote.'] : ['Generate and send RFQ by lot.'],
      controles: isEs ? ['RFQ sin precios visibles.'] : ['RFQ without visible prices.'],
      salidas: isEs ? ['RFQ enviadas.'] : ['Sent RFQs.'],
      evidencias: isEs ? ['Cotización del proveedor'] : ['Supplier quote'],
      responsable: isEs ? 'Compras' : 'Purchasing',
      criterio: isEs ? 'RFQ notificada a proveedores.' : 'RFQ notified to suppliers.'
    },
    { 
      id: 5, 
      title: isEs ? 'Recepción de ofertas' : 'Receipt of offers', 
      desc: isEs ? 'Registrar las respuestas de cada proveedor por lote.' : 'Record the responses from each supplier for each batch.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-pink-500 text-pink-600 bg-pink-50',
      badge: isEs ? 'Interno/confidencial' : 'Internal/Confidential',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      numBadgeColor: 'bg-pink-600 text-white',
      entradas: isEs ? ['RFQ enviadas.'] : ['Sent RFQs.'],
      actividades: isEs ? ['Capturar ofertas recibidas.'] : ['Capture received bids.'],
      controles: isEs ? ['Verificar validez de ofertas.'] : ['Verify validity of bids.'],
      salidas: isEs ? ['Ofertas registradas.'] : ['Registered bids.'],
      evidencias: isEs ? ['Comparativo interno'] : ['Internal comparison'],
      responsable: isEs ? 'Compras / Proveedor' : 'Purchasing / Supplier',
      criterio: isEs ? 'Mínimo de ofertas alcanzado.' : 'Minimum bids count met.'
    },
    { 
      id: 6, 
      title: isEs ? 'Comparativo y adjudicación por partida' : 'Comparative analysis and award by line item', 
      desc: isEs ? 'Elegir la mejor alternativa sin obligar a adjudicar todo el lote al mismo proveedor.' : 'Selecting the best alternative without being compelled to award the entire lot to the same supplier.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-purple-500 text-purple-600 bg-purple-50',
      badge: isEs ? 'Interno hasta revisar' : 'Internal until review',
      badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
      numBadgeColor: 'bg-purple-600 text-white',
      entradas: isEs ? ['Ofertas completas.'] : ['Complete bids.'],
      actividades: isEs ? ['Evaluar y adjudicar partidas.'] : ['Evaluate and award line items.'],
      controles: isEs ? ['Justificación de elección.'] : ['Selection justification.'],
      salidas: isEs ? ['Cuadro comparativo firmado.'] : ['Signed comparative matrix.'],
      evidencias: isEs ? ['Cotización en borrador'] : ['Draft quote'],
      responsable: isEs ? 'Compras / Área técnica' : 'Purchasing / Technical area',
      criterio: isEs ? 'Partidas adjudicadas.' : 'Line items awarded.'
    },
    { 
      id: 7, 
      title: isEs ? 'Cotización al cliente' : 'Quote for the client', 
      desc: isEs ? 'Consolidar todos los lotes en una sola propuesta comercial.' : 'Consolidate all lots into a single commercial proposal.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-violet-500 text-violet-600 bg-violet-50',
      badge: isEs ? 'Interno/confidencial' : 'Internal/Confidential',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      numBadgeColor: 'bg-violet-600 text-white',
      entradas: isEs ? ['Partidas adjudicadas y márgenes.'] : ['Awarded line items and margins.'],
      actividades: isEs ? ['Elaborar cotización borrador.'] : ['Draft client quotation.'],
      controles: isEs ? ['Precios e impuestos correctos.'] : ['Correct prices and taxes.'],
      salidas: isEs ? ['Cotización lista para revisión.'] : ['Quote ready for review.'],
      evidencias: isEs ? ['Evidencia de revisión'] : ['Review evidence'],
      responsable: isEs ? 'Elaborador comercial' : 'Commercial Drafter',
      criterio: isEs ? 'Propuesta comercial generada.' : 'Commercial proposal generated.'
    },
    { 
      id: 8, 
      title: isEs ? 'Revisión comercial' : 'Commercial Review',
      desc: isEs ? 'Revisar contenido y condiciones de la cotización.' : 'Review the content and terms of the quote.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-purple-600 text-purple-700 bg-purple-50',
      badge: isEs ? 'Interno/confidencial' : 'Internal/Confidential',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
      numBadgeColor: 'bg-purple-700 text-white',
      entradas: isEs ? ['Cotización borrador.'] : ['Draft quote.'],
      actividades: isEs ? ['Verificar términos y condiciones.'] : ['Verify terms and conditions.'],
      controles: isEs ? ['Firma de revisión comercial.'] : ['Commercial review signature.'],
      salidas: isEs ? ['Cotización revisada.'] : ['Reviewed quotation.'],
      evidencias: isEs ? ['Autorización y firma'] : ['Approval and signature'],
      responsable: isEs ? 'Revisor comercial' : 'Commercial Reviewer',
      criterio: isEs ? 'Revisión aprobada.' : 'Review approved.'
    },
    { 
      id: 9, 
      title: isEs ? 'Autorización comercial' : 'Commercial authorization', 
      desc: isEs ? 'Autorizar internamente la revisión vigente.' : 'Internally authorize the current revision.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
      badge: isEs ? 'Cliente' : 'Client',
      badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      numBadgeColor: 'bg-emerald-600 text-white',
      entradas: isEs ? ['Cotización revisada.'] : ['Reviewed quote.'],
      actividades: isEs ? ['Aprobar y firmar cotización.'] : ['Approve and sign quote.'],
      controles: isEs ? ['Permisos de autorización.'] : ['Authorization permissions.'],
      salidas: isEs ? ['Cotización autorizada.'] : ['Authorized quotation.'],
      evidencias: isEs ? ['PDF y evidencia de envío'] : ['PDF & dispatch evidence'],
      responsable: isEs ? 'Autorizador comercial' : 'Commercial Approver',
      criterio: isEs ? 'Autorización otorgada.' : 'Authorization granted.'
    },
    { 
      id: 10, 
      title: isEs ? 'Envío al cliente' : 'Shipment to the customer', 
      desc: isEs ? 'Enviar manualmente la cotización autorizada.' : 'Send authorized quotation to client.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-emerald-600 text-emerald-700 bg-emerald-50',
      badge: isEs ? 'Cliente' : 'Client',
      badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      numBadgeColor: 'bg-emerald-700 text-white',
      entradas: isEs ? ['Cotización autorizada.'] : ['Authorized quote.'],
      actividades: isEs ? ['Enviar PDF por correo/portal.'] : ['Send PDF via email/portal.'],
      controles: isEs ? ['Confirmación de entrega.'] : ['Delivery confirmation.'],
      salidas: isEs ? ['Cotización en manos del cliente.'] : ['Quote delivered to client.'],
      evidencias: isEs ? ['Decisión del cliente'] : ['Client decision document'],
      responsable: isEs ? 'Área comercial' : 'Commercial Dept.',
      criterio: isEs ? 'Envío registrado.' : 'Dispatch logged.'
    },
    { 
      id: 11, 
      title: isEs ? 'Decisión del cliente' : 'Customer decision', 
      desc: isEs ? 'Registrar aprobación, rechazo o solicitud de modificación.' : 'Record approval, rejection, or a request for modification.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-orange-500 text-orange-600 bg-orange-50',
      badge: isEs ? 'Proveedor' : 'Supplier',
      badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
      numBadgeColor: 'bg-orange-600 text-white',
      entradas: isEs ? ['Cotización enviada.'] : ['Sent quote.'],
      actividades: isEs ? ['Registrar respuesta del cliente.'] : ['Log client response.'],
      controles: isEs ? ['Aprobación formal/OC de cliente.'] : ['Formal approval/Client PO.'],
      salidas: isEs ? ['Estatus de aprobación.'] : ['Approval status.'],
      evidencias: isEs ? ['OC y firmas'] : ['PO and signatures'],
      responsable: isEs ? 'Cliente / Área comercial' : 'Client / Commercial Dept.',
      criterio: isEs ? 'Cotización aprobada.' : 'Quote approved.'
    },
    { 
      id: 12, 
      title: isEs ? 'Órdenes de compra por proveedor' : 'Purchase orders by supplier', 
      desc: isEs ? 'Generar una o varias OC según los proveedores adjudicados.' : 'Generate one or more purchase orders (POs) based on the awarded suppliers.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-teal-600 text-teal-700 bg-teal-50',
      badge: isEs ? 'Interno / Operativo' : 'Internal / Operational',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      numBadgeColor: 'bg-teal-600 text-white',
      entradas: isEs ? ['Cotización aprobada por cliente.'] : ['Quote approved by client.'],
      actividades: isEs ? ['Generar, revisar y emitir OC a proveedores.'] : ['Generate, review, and issue vendor POs.'],
      controles: isEs ? ['Importes y condiciones de pago.'] : ['Amounts and payment terms.'],
      salidas: isEs ? ['OC emitidas a proveedores.'] : ['Issued vendor POs.'],
      evidencias: isEs ? ['Formato de recepción / Remisión sellada'] : ['Receiving slip / Stamped delivery note'],
      responsable: isEs ? 'Compras' : 'Purchasing',
      criterio: isEs ? 'OC confirmada por proveedor.' : 'PO confirmed by vendor.'
    },
    { 
      id: 13, 
      title: isEs ? 'Recepción por OC y partida' : 'Reception by OC and departure', 
      desc: isEs ? 'Controlar cantidades, calidad y documentos recibidos de múltiples proveedores.' : 'Monitor the quantities, quality, and documents received from multiple suppliers.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-slate-700 text-slate-800 bg-slate-100',
      badge: isEs ? 'Cliente' : 'Client',
      badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      numBadgeColor: 'bg-slate-700 text-white',
      entradas: isEs ? ['Mercancía enviada por proveedor.'] : ['Goods shipped by supplier.'],
      actividades: isEs ? ['Inspeccionar y registrar recepción (GRN).'] : ['Inspect and log receiving (GRN).'],
      controles: isEs ? ['Confrontar vs OC e inspección de calidad.'] : ['Match vs PO & quality check.'],
      salidas: isEs ? ['Entrada a almacén confirmada.'] : ['Warehouse entry confirmed.'],
      evidencias: isEs ? ['POD / Remisión firmada'] : ['POD / Signed slip'],
      responsable: isEs ? 'Almacén / Inspector' : 'Warehouse / Inspector',
      criterio: isEs ? 'Bienes inspeccionados y aceptados.' : 'Goods inspected and accepted.'
    },
    { 
      id: 14, 
      title: isEs ? 'Entrega consolidada al cliente' : 'Consolidated delivery to the customer', 
      desc: isEs ? 'Entregar partidas disponibles de una o varias requisiciones.' : 'Deliver available items from requisitions.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-rose-600 text-rose-700 bg-rose-50',
      badge: isEs ? 'Cliente / Administración' : 'Client / Admin',
      badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
      numBadgeColor: 'bg-rose-600 text-white',
      entradas: isEs ? ['Bienes recibidos en almacén.'] : ['Goods received in warehouse.'],
      actividades: isEs ? ['Entregar al cliente y recabar firma.'] : ['Deliver to client and obtain POD.'],
      controles: isEs ? ['Acuse firmado por cliente.'] : ['Signed acceptance from client.'],
      salidas: isEs ? ['Prueba de entrega (POD).'] : ['Proof of Delivery (POD).'],
      evidencias: isEs ? ['Factura (CFDI) / Comprobante fiscal'] : ['Invoice (CFDI) / Tax receipt'],
      responsable: isEs ? 'Logística / Operaciones' : 'Logistics / Operations',
      criterio: isEs ? 'Conformidad firmada.' : 'Acceptance signed.'
    },
    { 
      id: 15, 
      title: isEs ? 'Factura y cierre' : 'Invoice and closing', 
      desc: isEs ? 'Registrar factura y cerrar el expediente.' : 'Register the invoice and close the file.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-rose-600 text-rose-700 bg-rose-50',
      badge: isEs ? 'Cliente / Administración' : 'Client / Admin',
      badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
      numBadgeColor: 'bg-rose-600 text-white',
      entradas: isEs ? ['POD y expediente P2P.'] : ['POD and P2P file.'],
      actividades: isEs ? ['Facturar al cliente y registrar pago.'] : ['Bill client and record payment.'],
      controles: isEs ? ['3-Way Matching exacto.'] : ['Exact 3-Way Matching.'],
      salidas: isEs ? ['Factura timbrada y expediente cerrado.'] : ['Stamped invoice and closed file.'],
      evidencias: isEs ? ['Factura (CFDI) / Comprobante fiscal'] : ['Invoice (CFDI) / Tax receipt'],
      responsable: isEs ? 'Administración / Finanzas' : 'Administration / Finance',
      criterio: isEs ? 'Factura cobrada y expediente cerrado.' : 'Invoice paid and file closed.'
    },
  ];

  // Las 8 etapas del flujo Service-to-Cash (Servicios Operativos)
  const serviceStages = [
    { 
      id: 1, 
      title: isEs ? 'Requisición / solicitud del servicio' : 'Service requisition / request', 
      desc: isEs ? 'Registrar la necesidad original del cliente y vincular el expediente de Servicio Operativo con la requisición maestra de Grupo Gerez.' : 'Record the clients original need and link the Operational Service file to the Grupo Gerez master requisition.', 
      count: isEs ? '1 proceso(s)' : '1 process(es)', 
      color: 'border-blue-500 text-blue-600 bg-blue-50',
      badgeColor: 'bg-blue-600 text-white',
      numBadgeColor: 'bg-blue-600 text-white',
      entradas: isEs ? ['Cliente, proyecto, alcance, fecha requerida y tipo de servicio.'] : ['Client, project, scope, required date, and service type.'],
      actividades: isEs ? ['Crear la requisición maestra y generar folio de servicio.'] : ['Create master requisition and generate service folio.'],
      controles: isEs ? ['Cliente/proyecto válido y solicitud sin duplicados.'] : ['Valid client/project and no duplicate requests.'],
      salidas: isEs ? ['Requisición de servicio registrada.'] : ['Registered service requisition.'],
      responsable: isEs ? 'Comercial / Operaciones' : 'Commercial / Operations',
      criterio: isEs ? 'Datos mínimos completos.' : 'Complete minimum data.'
    },
    { 
      id: 2, 
      title: isEs ? 'Autorización comercial del cliente' : 'Customer commercial authorization', 
      desc: isEs ? 'Registrar la evidencia comercial cuando exista, sin impedir la creación inicial de la requisición del servicio.' : 'Record commercial evidence where it exists, without preventing the initial creation of the service requisition.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-purple-500 text-purple-600 bg-purple-50',
      badgeColor: 'bg-purple-600 text-white',
      numBadgeColor: 'bg-purple-600 text-white',
      entradas: isEs ? ['Solicitud registrada y modalidad de autorización.'] : ['Registered request and authorization method.'],
      actividades: isEs ? ['Verificar tipo de autorización y cargar respaldo.'] : ['Verify authorization type and upload backup.'],
      controles: isEs ? ['Monto autorizado coincide con tarifa pactada.'] : ['Authorized amount matches agreed rate.'],
      salidas: isEs ? ['Servicio autorizado comercialmente.'] : ['Commercially authorized service.'],
      responsable: isEs ? 'Comercial' : 'Commercial',
      criterio: isEs ? 'Autorización confirmada o emergencia registrada.' : 'Authorization confirmed or emergency logged.'
    },
    { 
      id: 3, 
      title: isEs ? 'Planeación y programación' : 'Planning and scheduling', 
      desc: isEs ? 'Definir cuándo, dónde y con qué recursos se ejecutará el servicio.' : 'Define when, where, and with what resources the service will be carried out.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-cyan-500 text-cyan-600 bg-cyan-50',
      badgeColor: 'bg-cyan-600 text-white',
      numBadgeColor: 'bg-cyan-600 text-white',
      entradas: isEs ? ['Servicio autorizado y disponibilidad de equipo/personal.'] : ['Authorized service and equipment/personnel availability.'],
      actividades: isEs ? ['Asignar fecha/hora y designar operador/cuadrilla.'] : ['Assign date/time and designate operator/crew.'],
      controles: isEs ? ['Capacidad y disponibilidad sin traslapes.'] : ['Capacity and availability without overlaps.'],
      salidas: isEs ? ['Orden de trabajo programada.'] : ['Scheduled work order.'],
      responsable: isEs ? 'Operaciones' : 'Operations',
      criterio: isEs ? 'Recursos y fecha definidos.' : 'Resources and date defined.'
    },
    { 
      id: 4, 
      title: isEs ? 'Proveedor / OC cuando aplique' : 'Supplier / PO when applicable', 
      desc: isEs ? 'Controlar la contratación de terceros cuando el servicio no se ejecuta completamente con recursos propios.' : 'Oversee the engagement of third parties when the service is not carried out entirely using internal resources.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-orange-500 text-orange-600 bg-orange-50',
      badgeColor: 'bg-orange-500 text-white',
      numBadgeColor: 'bg-orange-500 text-white',
      entradas: isEs ? ['Requerimiento de recurso externo.'] : ['External resource requirement.'],
      actividades: isEs ? ['Evaluar necesidad de tercero y generar OC.'] : ['Evaluate third-party need and issue PO.'],
      controles: isEs ? ['No confundir OC proveedor con autorización cliente.'] : ['Do not confuse vendor PO with client approval.'],
      salidas: isEs ? ['OC de proveedor emitida.'] : ['Issued vendor PO.'],
      responsable: isEs ? 'Compras' : 'Purchasing',
      criterio: isEs ? 'OC vinculada o marcado No requiere proveedor.' : 'PO linked or marked No vendor required.'
    },
    { 
      id: 5, 
      title: isEs ? 'Ejecución del servicio' : 'Service Execution', 
      desc: isEs ? 'Ejecutar el servicio autorizado/programado y registrar la operación real.' : 'Execute the authorized/scheduled service and record the actual operation.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-teal-500 text-teal-600 bg-teal-50',
      badgeColor: 'bg-teal-500 text-white',
      numBadgeColor: 'bg-teal-500 text-white',
      entradas: isEs ? ['Orden de trabajo programada.'] : ['Scheduled work order.'],
      actividades: isEs ? ['Desplegar servicio en campo y registrar tiempos.'] : ['Deploy field service and log times.'],
      controles: isEs ? ['Alcance, tiempos y normas de seguridad.'] : ['Scope, timings, and safety standards.'],
      salidas: isEs ? ['Servicio concluido físicamente.'] : ['Service physically completed.'],
      responsable: isEs ? 'Operaciones / Supervisor' : 'Operations / Supervisor',
      criterio: isEs ? 'Servicio ejecutado.' : 'Service executed.'
    },
    { 
      id: 6, 
      title: isEs ? 'Evidencia y aceptación' : 'Evidence and Acceptance', 
      desc: isEs ? 'Integrar evidencia suficiente de la ejecución y documentar la conformidad del cliente cuando corresponda.' : 'Gather sufficient evidence of execution and document client concurrence where applicable.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
      badgeColor: 'bg-emerald-600 text-white',
      numBadgeColor: 'bg-emerald-600 text-white',
      entradas: isEs ? ['Servicio ejecutado y remisión de campo.'] : ['Executed service and field ticket.'],
      actividades: isEs ? ['Recopilar firma del cliente y adjuntar tickets/POD.'] : ['Collect client signature and attach tickets/POD.'],
      controles: isEs ? ['Firma legible de cliente y fotos.'] : ['Legible client signature and photos.'],
      salidas: isEs ? ['Expediente operativo completo.'] : ['Complete operational file.'],
      responsable: isEs ? 'Operaciones / Cliente' : 'Operations / Client',
      criterio: isEs ? 'Evidencia completa y conformidad.' : 'Complete evidence and conformity.'
    },
    { 
      id: 7, 
      title: isEs ? 'Validación y cierre comercial' : 'Validation and commercial closure', 
      desc: isEs ? 'Verificar que el expediente tenga autorización, cantidades, costo, precio de venta y margen antes de facturar.' : 'Verify that the file includes authorization, quantities, cost, selling price, and margin before invoicing.', 
      count: isEs ? '0 proceso(s)' : '0 process(es)', 
      color: 'border-violet-500 text-violet-600 bg-violet-50',
      badgeColor: 'bg-violet-600 text-white',
      numBadgeColor: 'bg-violet-600 text-white',
      entradas: isEs ? ['Evidencia completa y firmada.'] : ['Signed complete evidence.'],
      actividades: isEs ? ['Conciliar cantidades ejecutadas y calcular pre-factura.'] : ['Reconcile executed quantities and calculate pre-invoice.'],
      controles: isEs ? ['Sin desviaciones de precio y margen validado.'] : ['No price deviations and validated margin.'],
      salidas: isEs ? ['Pre-factura conciliada.'] : ['Reconciled pre-invoice.'],
      responsable: isEs ? 'Comercial / Administración' : 'Commercial / Administration',
      criterio: isEs ? 'Listo para facturar.' : 'Ready to bill.'
    },
    { 
      id: 8, 
      title: isEs ? 'Factura, cobro y cierre' : 'Invoicing, collection, and closing', 
      desc: isEs ? 'Relacionar la factura al servicio y controlar el expediente hasta su cierre comercial.' : 'Link the invoice to the service and monitor the file until its commercial closure.', 
      count: isEs ? '1 proceso(s)' : '1 process(es)', 
      color: 'border-rose-500 text-rose-600 bg-rose-50',
      badgeColor: 'bg-rose-600 text-white',
      numBadgeColor: 'bg-rose-600 text-white',
      entradas: isEs ? ['Pre-factura validada.'] : ['Validated pre-invoice.'],
      actividades: isEs ? ['Generar/timbrar CFDI y registrar cobro.'] : ['Generate tax invoice and log payment.'],
      controles: isEs ? ['Evitar doble facturación; coincidir monto.'] : ['Avoid double billing; match amount.'],
      salidas: isEs ? ['Factura enviada y expediente cerrado.'] : ['Sent invoice and file closed.'],
      responsable: isEs ? 'Administración / Finanzas' : 'Administration / Finance',
      criterio: isEs ? 'Factura registrada / cobrada.' : 'Invoice registered / collected.'
    },
  ];

  const process15Stages = [
    { id: 1, title: isEs ? 'Solicitud / requisición' : 'Request / Requisition', percent: '7%', desc: isEs ? 'Registrar la necesidad del cliente como un solo expediente.' : 'Register client demand as a single file.', compuerta: isEs ? 'Solicitud guardada.' : 'Request saved.', border: 'border-l-blue-600', badgeBg: 'bg-blue-50 text-blue-700', numBg: 'bg-blue-600' },
    { id: 2, title: isEs ? 'Validación interna' : 'Internal Validation', percent: '13%', desc: isEs ? 'Confirmar viabilidad técnica, contractual, presupuestal y responsable.' : 'Confirm technical, contractual, and budgetary feasibility.', compuerta: isEs ? 'Validación lista para cotizar.' : 'Ready to quote validation.', border: 'border-l-sky-500', badgeBg: 'bg-sky-50 text-sky-700', numBg: 'bg-sky-500' },
    { id: 3, title: isEs ? 'Estrategia y lotificación por partida' : 'Strategy & Lotting by Item', percent: '20%', desc: isEs ? 'Separar las partidas en lotes y definir la ruta de cada artículo.' : 'Separate items into lots and set item routing.', compuerta: isEs ? 'Lotes guardados y rutas definidas.' : 'Lots saved & routes defined.', border: 'border-l-indigo-500', badgeBg: 'bg-indigo-50 text-indigo-700', numBg: 'bg-indigo-500' },
    { id: 4, title: isEs ? 'RFQ por lote y proveedor' : 'RFQ by Lot & Vendor', percent: '27%', desc: isEs ? 'Solicitar únicamente las partidas que corresponden a cada proveedor.' : 'Request only line items corresponding to each vendor.', compuerta: isEs ? 'RFQ requeridas creadas o excepción documentada.' : 'Required RFQs created or documented exception.', border: 'border-l-purple-600', badgeBg: 'bg-purple-50 text-purple-700', numBg: 'bg-purple-600' },
    { id: 5, title: isEs ? 'Recepción de ofertas' : 'Bids Reception', percent: '33%', desc: isEs ? 'Registrar las respuestas de cada proveedor por lote.' : 'Register responses from vendors per lot.', compuerta: isEs ? 'Ofertas suficientes o excepción.' : 'Sufficient bids or exception.', border: 'border-l-blue-500', badgeBg: 'bg-blue-50 text-blue-700', numBg: 'bg-blue-500' },
    { id: 6, title: isEs ? 'Comparativo y adjudicación por partida' : 'Comparison & Item Awarding', percent: '40%', desc: isEs ? 'Elegir la mejor alternativa sin obligar a adjudicar todo el lote al mismo proveedor.' : 'Pick best option without forcing entire lot to single vendor.', compuerta: isEs ? 'Partidas resueltas.' : 'Items resolved.', border: 'border-l-rose-500', badgeBg: 'bg-rose-50 text-rose-700', numBg: 'bg-rose-500' },
    { id: 7, title: isEs ? 'Cotización al cliente' : 'Client Quotation', percent: '47%', desc: isEs ? 'Consolidar todos los lotes en una sola propuesta comercial.' : 'Consolidate all lots into a single commercial proposal.', compuerta: isEs ? 'Cotización completa.' : 'Quote complete.', border: 'border-l-purple-500', badgeBg: 'bg-purple-50 text-purple-700', numBg: 'bg-purple-500' },
    { id: 8, title: isEs ? 'Revisión comercial' : 'Commercial Review', percent: '53%', desc: isEs ? 'Revisar contenido y condiciones de la cotización.' : 'Review contents and terms of the quote.', compuerta: isEs ? 'Revisión concluida.' : 'Review completed.', border: 'border-l-indigo-600', badgeBg: 'bg-indigo-50 text-indigo-700', numBg: 'bg-indigo-600' },
    { id: 9, title: isEs ? 'Autorización comercial' : 'Commercial Approval', percent: '60%', desc: isEs ? 'Autorizar internamente la revisión vigente.' : 'Internally authorize active revision.', compuerta: isEs ? 'Autorización vigente.' : 'Active authorization.', border: 'border-l-purple-700', badgeBg: 'bg-purple-50 text-purple-700', numBg: 'bg-purple-700' },
    { id: 10, title: isEs ? 'Envío al cliente' : 'Send to Client', percent: '67%', desc: isEs ? 'Enviar manualmente la cotización autorizada.' : 'Send authorized quotation to client.', compuerta: isEs ? 'Envío confirmado.' : 'Dispatch confirmed.', border: 'border-l-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700', numBg: 'bg-emerald-500' },
    { id: 11, title: isEs ? 'Decisión del cliente' : 'Client Decision', percent: '73%', desc: isEs ? 'Registrar aprobación, rechazo o solicitud de modificación.' : 'Log client approval, rejection, or edit request.', compuerta: isEs ? 'Cotización aprobada.' : 'Quote approved.', border: 'border-l-teal-500', badgeBg: 'bg-teal-50 text-teal-700', numBg: 'bg-teal-500' },
    { id: 12, title: isEs ? 'Órdenes de compra por proveedor' : 'Purchase Orders by Vendor', percent: '80%', desc: isEs ? 'Generar una o varias OC según los proveedores adjudicados.' : 'Generate POs based on awarded vendors.', compuerta: isEs ? 'OC vigentes autorizadas.' : 'Valid POs authorized.', border: 'border-l-amber-500', badgeBg: 'bg-amber-50 text-amber-700', numBg: 'bg-amber-500' },
    { id: 13, title: isEs ? 'Recepción por OC y partida' : 'Receiving by PO & Item', percent: '87%', desc: isEs ? 'Controlar cantidades, calidad y documentos recibidos de múltiples proveedores.' : 'Control qty, quality, and docs from vendors.', compuerta: isEs ? 'Recepción suficiente para entrega.' : 'Sufficient receiving for delivery.', border: 'border-l-teal-600', badgeBg: 'bg-teal-50 text-teal-700', numBg: 'bg-teal-600' },
    { id: 14, title: isEs ? 'Entrega consolidada al cliente' : 'Consolidated Client Delivery', percent: '93%', desc: isEs ? 'Entregar partidas disponibles de una o varias requisiciones.' : 'Deliver available items from requisitions.', compuerta: isEs ? 'Entrega aceptada.' : 'Delivery accepted.', border: 'border-l-slate-800', badgeBg: 'bg-slate-100 text-slate-800', numBg: 'bg-slate-800' },
    { id: 15, title: isEs ? 'Factura y cierre' : 'Invoice & Closure', percent: '100%', desc: isEs ? 'Registrar factura y cerrar el expediente.' : 'Log invoice and close process file.', compuerta: isEs ? 'Factura registrada.' : 'Invoice logged.', border: 'border-l-rose-700', badgeBg: 'bg-rose-50 text-rose-700', numBg: 'bg-rose-700' }
  ];

  // Las 14 arquitecturas / módulos del sistema Grupo Gerez
  const systemModules = [
    { id: 1, name: isEs ? 'Flujo del Proceso' : 'Process Flow', desc: isEs ? 'Mapa integral Procure-to-Pay y Service-to-Cash.' : 'Comprehensive Procure-to-Pay and Service-to-Cash map.', icon: '🧭' },
    { id: 2, name: isEs ? 'Clientes' : 'Clients', desc: isEs ? 'Clientes, proyectos, contratos y portal.' : 'Clients, projects, contracts, and portal.', icon: '🏢' },
    { id: 3, name: isEs ? 'Proveedores' : 'Suppliers', desc: isEs ? 'Catálogo, evaluación y condiciones.' : 'Vendor catalog, evaluation, and terms.', icon: '🚚' },
    { id: 4, name: isEs ? 'Suministros de proveedores' : 'Supplier Supplies', desc: isEs ? 'Productos, servicios, crédito y tiempos.' : 'Products, services, credit, and lead times.', icon: '📦' },
    { id: 5, name: isEs ? 'Contratista' : 'Contractor', desc: isEs ? 'Identidad, contactos y datos de la empresa.' : 'Company identity, contacts, and info.', icon: '🏗️' },
    { id: 6, name: isEs ? 'Solicitud / Requisición' : 'Request / Requisition', desc: isEs ? 'Punto de entrada para compras/rentas.' : 'Entry point for purchases/rentals.', icon: '📝' },
    { id: 7, name: isEs ? 'Gestión del Contratista' : 'Contractor Management', desc: isEs ? 'Validación técnica, contractual y estrategia.' : 'Technical validation, contracts, and strategy.', icon: '🔍' },
    { id: 8, name: isEs ? 'Cotizaciones y Comparativo' : 'Quotes & Comparison', desc: isEs ? 'RFQ, ofertas, comparativo y propuesta.' : 'RFQ, bids, comparison, and proposal.', icon: '📊' },
    { id: 9, name: isEs ? 'Órdenes de Compra' : 'Purchase Orders', desc: isEs ? 'OC emitidas por la empresa a proveedores.' : 'POs issued to suppliers.', icon: '🛒' },
    { id: 10, name: isEs ? 'Recepción y Entrega' : 'Receiving & Delivery', desc: isEs ? 'Recepción, inspección, entrega y aceptación.' : 'Receiving, inspection, delivery, and acceptance.', icon: '📦' },
    { id: 11, name: isEs ? 'Factura' : 'Invoice', desc: isEs ? 'Factura, archivo fiscal, seguimiento y pago.' : 'Invoice, tax file, tracking, and payment.', icon: '🧾' },
    { id: 12, name: isEs ? 'Servicios Operativos' : 'Operational Services', desc: isEs ? 'Agua, Transporte, Grúas, Montacargas, Last Mile.' : 'Water, Transport, Cranes, Forklifts, Last Mile.', icon: '🚚' },
    { id: 13, name: isEs ? 'Matriz General' : 'General Matrix', desc: isEs ? 'Trazabilidad consolidada de procesos.' : 'Consolidated process traceability.', icon: '📄' },
    { id: 14, name: isEs ? 'Reportes' : 'Reports', desc: isEs ? 'Indicadores, análisis ejecutivo e impresión.' : 'KPIs, executive analytics, and reports.', icon: '📈' },
  ];

  // Obtener la información de las etapas según la ruta activa
  const currentDetailStages = detailRoute === 'p2p' ? p2pStages : serviceStages;

  return (
    <div className="space-y-6 transition-all duration-300">
      {/* Definición de Keyframes de Animaciones */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Encabezado Principal */}
      <div className="flex items-center justify-between animate-fadeIn">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isEs ? 'Flujo de Proceso' : 'Process Flow'}
          </h2>
          <p className="text-xs text-slate-500">
            {isEs ? 'Seguimiento y etapas de los procesos operacionales.' : 'Tracking and stages of operational processes.'}
          </p>
        </div>
      </div>

      {/* Grid de Cuadros de Selección (Botones Superiores) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tabs.map((tab, idx) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id, tab.title)}
              style={{ animationDelay: `${idx * 50}ms` }}
              className={`p-5 rounded-2xl text-left transition-all duration-300 shadow-sm border transform hover:-translate-y-1 active:scale-[0.98] animate-fadeIn ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent ring-2 ring-purple-400/30 shadow-md'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80 hover:shadow-md'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-base mb-3.5 transition-transform duration-300 ${
                  isActive
                    ? 'bg-white/20 backdrop-blur-md scale-105'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}
              >
                {tab.id === 'especiales' ? <Zap className="w-5 h-5 text-amber-500 fill-amber-500" /> : tab.icon}
              </div>
              <h3 className={`text-sm font-bold transition-colors ${isActive ? 'text-white' : 'text-slate-900'}`}>
                {tab.title}
              </h3>
              <p
                className={`text-xs mt-1.5 leading-relaxed transition-colors ${
                  isActive ? 'text-blue-100' : 'text-slate-500'
                }`}
              >
                {tab.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* CONTENIDO 1: MAPA INTERACTIVO */}
      {activeSubTab === 'mapa' && (
        <div className="space-y-6 animate-fadeIn bg-[#F8F9FE] p-6 rounded-3xl">
          
          {/* ENCABEZADO Y KPIS PRINCIPALES */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {isEs 
                    ? 'Mapa integral de Grupo Gerez - flujo guiado y abastecimiento paralelo' 
                    : 'Grupo Gerez Comprehensive Map - guided flow & parallel sourcing'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isEs 
                    ? 'Dos rutas controladas desde una Nueva Solicitud: Compra / renta o Servicio Operativo, ambas con trazabilidad comercial, documental y financiera.' 
                    : 'Two controlled routes from a New Request: Purchase / Rent or Operational Service, both with commercial, document, and financial traceability.'}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-[11px] rounded-full border border-blue-100 whitespace-nowrap">
                Procure-to-Pay + Service-to-Cash
              </span>
            </div>

            <div className="flex flex-col xl:flex-row gap-5 bg-[#F8FAFC] p-5 rounded-2xl border border-slate-100">
              {/* Caja de Objetivo */}
              <div className="xl:w-1/3 bg-blue-50/60 p-5 rounded-xl border border-blue-100 border-l-4 border-l-blue-600">
                <h4 className="text-sm font-bold text-blue-900 mb-2">
                  {isEs ? 'Objetivo del flujo' : 'Flow Objective'}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isEs 
                    ? 'Grupo Gerez administra dos rutas independientes desde una Nueva Solicitud: Procure-to-Pay para Compra/Renta y Service-to-Cash para Servicios. Los módulos del sistema son la arquitectura que soporta esas rutas; no deben confundirse con etapas.' 
                    : 'Grupo Gerez manages two independent routes from a New Request: Procure-to-Pay for Purchase/Rent and Service-to-Cash for Services. System modules form the supporting architecture; they must not be confused with stages.'}
                </p>
              </div>

              {/* Tarjetas de KPI */}
              <div className="xl:w-2/3 grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { val: '0', title: isEs ? 'Requisiciones totales' : 'Total Requisitions', sub: isEs ? 'Expedientes creados' : 'Files created', color: 'border-t-blue-600', text: 'text-blue-700' },
                  { val: '0', title: isEs ? 'Procesos abiertos' : 'Open Processes', sub: isEs ? 'En etapa activa' : 'In active stage', color: 'border-t-purple-500', text: 'text-purple-700' },
                  { val: '0', title: isEs ? 'Pendientes cliente' : 'Pending Client', sub: isEs ? 'Cotización enviada' : 'Quote dispatched', color: 'border-t-emerald-500', text: 'text-emerald-700' },
                  { val: '0', title: isEs ? 'Procesos cerrados' : 'Closed Processes', sub: isEs ? 'Factura registrada' : 'Invoice registered', color: 'border-t-slate-800', text: 'text-slate-900' },
                  { val: '0', title: isEs ? 'Desviaciones activas' : 'Active Deviations', sub: isEs ? 'Recepción / entrega' : 'Receiving / delivery', color: 'border-t-rose-500', text: 'text-rose-600' }
                ].map((kpi, idx) => (
                  <div key={idx} className={`bg-white p-4 rounded-xl border border-slate-200 border-t-4 ${kpi.color} shadow-sm flex flex-col justify-center`}>
                    <span className={`text-2xl font-bold ${kpi.text} mb-1`}>{kpi.val}</span>
                    <p className="text-xs font-bold text-slate-900 leading-tight">{kpi.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{kpi.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center">
              <span className="font-bold mr-2 text-slate-900">
                {isEs ? 'Nueva lógica de abastecimiento:' : 'New sourcing logic:'} 
              </span> 
              {isEs 
                ? 'Dos rutas, no 14 etapas. "Flujo del Proceso" representa rutas de negocio. La tarjeta de Servicios Operativos es una ruta independiente.' 
                : 'Two routes, not 14 stages. "Process Flow" represents business routes. The Operational Services card is an independent route.'}
            </div>
          </div>

          {/* DIAGRAMA DE NUEVA LÓGICA DE ABASTECIMIENTO */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <p className="text-xs font-bold text-slate-800">
              {isEs ? 'Nueva lógica de abastecimiento:' : 'New sourcing logic:'}{' '}
              <span className="font-normal text-slate-500">
                {isEs 
                  ? 'una requisición puede abrir varios lotes en paralelo. Cada lote puede consultar proveedores distintos y después todas las rutas se consolidan nuevamente en la cotización al cliente.' 
                  : 'a requisition can open multiple parallel lots. Each lot can query different vendors, and all routes consolidate back into the client quote.'}
              </span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-6 px-4 bg-[#FAFAFE] rounded-xl border border-slate-100 overflow-x-auto">
              <div className="px-5 py-2.5 bg-white rounded-2xl border border-blue-200 text-xs font-bold text-slate-800 shadow-2xs whitespace-nowrap">
                {isEs ? '1 Solicitud' : '1 Request'}
              </div>
              
              <span className="text-purple-400 font-bold text-xs">→</span>

              <div className="px-5 py-2.5 bg-white rounded-2xl border border-blue-200 text-xs font-bold text-slate-800 shadow-2xs whitespace-nowrap">
                {isEs ? '2 Validación' : '2 Validation'}
              </div>

              <span className="text-purple-400 font-bold text-xs">→</span>

              <div className="px-5 py-2.5 bg-purple-50/60 rounded-2xl border border-purple-300 text-xs font-bold text-purple-700 shadow-2xs whitespace-nowrap">
                {isEs ? '3 Lotificación' : '3 Lotting'}
              </div>

              <span className="text-purple-400 font-bold text-xs">→</span>

              <div className="p-3 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="px-4 py-2 bg-white rounded-xl text-[11px] font-bold text-slate-800 border border-slate-100 shadow-2xs text-center whitespace-nowrap">
                  {isEs ? 'EPP → RFQ propios' : 'PPE → Own RFQ'}
                </div>
                <div className="px-4 py-2 bg-white rounded-xl text-[11px] font-bold text-slate-800 border border-slate-100 shadow-2xs text-center whitespace-nowrap">
                  {isEs ? 'Oficina → RFQ propios' : 'Office → Own RFQ'}
                </div>
                <div className="px-4 py-2 bg-white rounded-xl text-[11px] font-bold text-slate-800 border border-slate-100 shadow-2xs text-center whitespace-nowrap">
                  {isEs ? 'Herramientas → RFQ propios' : 'Tools → Own RFQ'}
                </div>
                <div className="px-4 py-2 bg-white rounded-xl text-[11px] font-bold text-slate-800 border border-slate-100 shadow-2xs text-center whitespace-nowrap">
                  {isEs ? 'Histórico / fuente única → ruta directa' : 'History / single source → direct route'}
                </div>
              </div>

              <span className="text-purple-400 font-bold text-xs">→</span>

              <div className="px-5 py-2.5 bg-white rounded-2xl border border-blue-200 text-xs font-bold text-slate-800 shadow-2xs whitespace-nowrap">
                {isEs ? 'Consolidación' : 'Consolidation'}
              </div>
            </div>
          </div>

          {/* GRILLA DE ETAPAS DEL PROCESO */}
          <div className="space-y-4 animate-fadeIn">
            <h4 className="text-base font-bold text-slate-900 px-1">
              {isEs ? 'Etapas del Proceso' : 'Process Stages'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {process15Stages.map((stage) => {
                const isStageActive = selectedStage === stage.id;
                return (
                  <div
                    key={stage.id}
                    onClick={() => setSelectedStage(stage.id)}
                    className={`bg-white p-5 rounded-2xl border border-l-4 ${stage.border} transition-all duration-300 cursor-pointer flex flex-col justify-between h-full shadow-xs hover:shadow-md ${
                      isStageActive ? 'ring-2 ring-blue-400/30 scale-[1.01]' : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-2xs ${stage.numBg}`}>
                            {stage.id}
                          </span>
                          <h5 className="text-sm font-bold text-slate-900 leading-snug">{stage.title}</h5>
                        </div>
                        <span className={`px-2.5 py-1 font-black text-[11px] rounded-full shrink-0 shadow-2xs ${stage.badgeBg}`}>
                          {stage.percent}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">{stage.desc}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 bg-slate-50/50 p-2.5 rounded-xl mt-auto">
                      <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
                          {isEs ? 'SITUACIÓN ACTUAL' : 'CURRENT STATUS'}
                        </span>
                        <p className="text-xs font-bold text-slate-700 truncate">
                          {isEs ? '0 proceso(s)' : '0 process(es)'}
                        </p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
                          {isEs ? 'COMPUERTA' : 'GATEWAY'}
                        </span>
                        <p className="text-xs font-bold text-slate-700 truncate" title={stage.compuerta}>
                          {stage.compuerta}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ARQUITECTURA OPERATIVA DEL SISTEMA */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-8 animate-fadeIn">
            <div className="mb-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h4 className="text-lg font-black text-slate-900">
                  {isEs ? 'Arquitectura operativa de Grupo Gerez' : 'Grupo Gerez Operational Architecture'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {isEs 
                    ? 'Arquitectura del sistema: estos 14 módulos soportan las rutas Procure-to-Pay y Service-to-Cash. No representan una secuencia de etapas.' 
                    : 'System architecture: these 14 modules support Procure-to-Pay and Service-to-Cash routes. They do not represent a sequence of stages.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-indigo-600 tracking-tight leading-none">
                  14
                </span>
                <div>
                  <h5 className="text-xs font-bold text-slate-900">
                    {isEs ? '14 módulos operativos activos.' : '14 active operational modules.'}
                  </h5>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEs 
                      ? 'Los módulos son componentes funcionales de Grupo Gerez. Las etapas pertenecen a cada ruta de negocio y se muestran arriba por separado.' 
                      : 'Modules are functional components of Grupo Gerez. Stages belong to each business route and are displayed separately above.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {systemModules.map((mod) => (
                <div 
                  key={mod.id} 
                  className={`p-4 bg-white rounded-xl border border-slate-200 flex flex-col h-full relative transition-all duration-300 hover:shadow-md ${mod.id === 12 ? 'border-purple-400 shadow-sm' : ''}`}
                >
                  <span className={`absolute top-3 left-3 text-[10px] font-bold ${mod.id === 12 ? 'text-purple-600' : 'text-blue-600'}`}>
                    {mod.id}
                  </span>
                  <div className="mt-4 mb-2">
                    <span className="text-xl inline-block bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                      {mod.icon}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900">{mod.name}</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed flex-grow">
                    {mod.desc}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 border-l-4 border-l-blue-500">
                <h6 className="text-[11px] font-bold text-slate-900 mb-1">
                  {isEs ? 'Entradas mínimas' : 'Minimum Inputs'}
                </h6>
                <p className="text-[10px] text-slate-600">
                  {isEs ? 'Solicitud, partidas, proyecto, presupuesto, fecha requerida y catálogo de proveedores.' : 'Request, line items, project, budget, required date, and vendor catalog.'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 border-l-4 border-l-amber-500">
                <h6 className="text-[11px] font-bold text-slate-900 mb-1">
                  {isEs ? 'Controles clave' : 'Key Controls'}
                </h6>
                <p className="text-[10px] text-slate-600">
                  {isEs ? 'Validación antes de cotizar; adjudicación por partida; aprobación del cliente antes de OC.' : 'Pre-quote validation; line-item award; client approval prior to PO.'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500">
                <h6 className="text-[11px] font-bold text-slate-900 mb-1">
                  {isEs ? 'Salidas esperadas' : 'Expected Outputs'}
                </h6>
                <p className="text-[10px] text-slate-600">
                  {isEs ? 'Compras: OC, recepción, entrega y factura. Servicios: programación, ejecución y factura.' : 'Purchases: PO, receiving, delivery, and invoice. Services: scheduling, execution, and invoice.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO 2: FLUJO DE SERVICIOS */}
      {activeSubTab === 'servicios' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {isEs ? 'Flujo integral de Servicios Operativos' : 'Comprehensive Operational Services Flow'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEs 
                    ? 'Ruta comercial y operativa para Agua, Transporte, Gestión Rise X, Grúas, Montacargas, Gasolina, Last Mile y otros servicios.' 
                    : 'Commercial and operational route for Water, Transport, Rise X Management, Cranes, Forklifts, Fuel, Last Mile, and other services.'}
                </p>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 bg-purple-100 text-purple-700 font-bold text-[10px] rounded-full border border-purple-200 animate-pulse">
                Service-to-Cash
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border-l-4 border-l-emerald-500 rounded-xl text-xs text-slate-700 leading-relaxed transition-all duration-300 hover:shadow-xs">
              <span className="font-bold text-emerald-900">{isEs ? 'Regla principal:' : 'Main rule:'}</span>{' '}
              {isEs 
                ? 'La autorización comercial del cliente y la OC emitida por Grupo Gerez al proveedor son documentos distintos. Un servicio puede ejecutarse sin OC a proveedor cuando se realiza con recursos propios, pero siempre debe quedar identificado cómo lo autorizó el cliente.' 
                : 'Client commercial authorization and Grupo Gerez PO to the supplier are distinct documents. A service can be executed without a vendor PO when using internal resources, but client approval must always be documented.'}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { val: '1', title: isEs ? 'Servicios' : 'Services', sub: isEs ? 'Expedientes registrados' : 'Registered files', border: 'border-t-blue-500', text: 'text-blue-600' },
              { val: '0', title: isEs ? 'Autorización pendiente' : 'Pending Authorization', sub: isEs ? 'Regularizar antes de facturar' : 'Regularize before billing', border: 'border-t-amber-500', text: 'text-amber-600' },
              { val: '0', title: isEs ? 'OC proveedor pendiente' : 'Pending Vendor PO', sub: isEs ? 'Solo cuando requiere tercero' : 'Only if 3rd party required', border: 'border-t-orange-500', text: 'text-orange-600' },
              { val: '1', title: isEs ? 'Ejecutados' : 'Executed', sub: isEs ? 'Completados / listos' : 'Completed / ready', border: 'border-t-emerald-500', text: 'text-emerald-600' },
              { val: '1', title: isEs ? 'Listos para facturar' : 'Ready to Invoice', sub: isEs ? 'Autorización válida' : 'Valid authorization', border: 'border-t-purple-500', text: 'text-purple-600' },
              { val: '0', title: isEs ? 'Facturados' : 'Invoiced', sub: isEs ? 'Cierre comercial' : 'Commercial closure', border: 'border-t-rose-500', text: 'text-rose-600' }
            ].map((stat, idx) => (
              <div key={idx} className={`bg-white p-4 rounded-2xl border border-slate-200/80 border-t-4 ${stat.border} shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md`}>
                <span className="text-2xl font-black text-slate-900">{stat.val}</span>
                <p className="text-xs font-bold text-slate-800 mt-1 leading-tight">{stat.title}</p>
                <p className={`text-[10px] font-bold ${stat.text} mt-0.5`}>{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {serviceStages.map((stage, idx) => (
              <div 
                key={stage.id} 
                style={{ animationDelay: `${idx * 40}ms` }}
                className={`bg-white rounded-2xl border border-slate-200/80 border-t-4 ${stage.borderColor} p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-md animate-fadeIn`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${stage.badgeColor} transition-transform duration-300 hover:scale-110`}>
                        {stage.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{stage.title}</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                      {stage.percentage}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{stage.desc}</p>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 transition-colors duration-200 hover:bg-slate-100/70">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {isEs ? 'CONTROL' : 'CONTROL'}
                      </span>
                      <p className="text-[11px] font-medium text-slate-700 leading-tight">{stage.control}</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 transition-colors duration-200 hover:bg-slate-100/70">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {isEs ? 'AVANZA CUANDO' : 'ADVANCES WHEN'}
                      </span>
                      <p className="text-[11px] font-medium text-slate-700 leading-tight">{stage.avanza}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 transition-all duration-300 hover:shadow-md">
              <h4 className="text-sm font-black text-slate-900">
                {isEs ? 'Modalidades de autorización del cliente' : 'Client Authorization Modes'}
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-blue-50/50 border-l-4 border-l-blue-500 rounded-xl text-slate-700 transition-transform duration-200 hover:translate-x-1">
                  <span className="font-bold text-slate-900">PO / Orden de Servicio:</span> {isEs ? 'registra número, fecha, monto y archivo.' : 'logs number, date, amount, and file.'}
                </div>
                <div className="p-3 bg-blue-50/50 border-l-4 border-l-blue-500 rounded-xl text-slate-700 transition-transform duration-200 hover:translate-x-1">
                  <span className="font-bold text-slate-900">Frame Agreement / Contrato:</span> {isEs ? 'registra contrato y Call Off cuando exista.' : 'logs contract and Call Off when available.'}
                </div>
                <div className="p-3 bg-blue-50/50 border-l-4 border-l-blue-500 rounded-xl text-slate-700 transition-transform duration-200 hover:translate-x-1">
                  <span className="font-bold text-slate-900">{isEs ? 'Correo / Portal:' : 'Email / Portal:'}</span> {isEs ? 'conserva evidencia de la autorización.' : 'preserves approval proof.'}
                </div>
                <div className="p-3 bg-amber-50/50 border-l-4 border-l-amber-500 rounded-xl text-slate-700 transition-transform duration-200 hover:translate-x-1">
                  <span className="font-bold text-slate-900">{isEs ? 'Emergencia verbal:' : 'Verbal Emergency:'}</span> {isEs ? 'permite ejecutar, pero queda pendiente de regularización comercial.' : 'allows execution, pending commercial regularization.'}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 transition-all duration-300 hover:shadow-md">
              <h4 className="text-sm font-black text-slate-900">
                {isEs ? 'Cuándo se requiere OC a proveedor' : 'When Vendor PO is Required'}
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-emerald-50/50 border-l-4 border-l-emerald-500 rounded-xl text-slate-700 transition-transform duration-200 hover:translate-x-1">
                  <span className="font-bold text-emerald-900">{isEs ? 'No requiere OC:' : 'No PO Required:'}</span> {isEs ? 'cuando el servicio se ejecuta con recursos propios.' : 'when service is executed with own resources.'}
                </div>
                <div className="p-3 bg-blue-50/50 border-l-4 border-l-blue-500 rounded-xl text-slate-700 transition-transform duration-200 hover:translate-x-1">
                  <span className="font-bold text-blue-900">{isEs ? 'Sí requiere OC:' : 'PO Required:'}</span> {isEs ? 'cuando se contrata pipa, transportista, grúa, montacargas u otro tercero.' : 'when hiring tanker, carrier, crane, forklift, or 3rd party.'}
                </div>
                <div className="p-3 bg-amber-50/50 border-l-4 border-l-amber-500 rounded-xl text-slate-700 transition-transform duration-200 hover:translate-x-1">
                  <span className="font-bold text-amber-900">{isEs ? 'Separación documental:' : 'Document Separation:'}</span> {isEs ? 'la OC a proveedor controla el costo. La autorización del cliente controla el ingreso y derecho a facturar.' : 'vendor PO controls cost. Client authorization controls revenue and billing rights.'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div>
              <h4 className="text-base font-black text-slate-900">
                {isEs ? 'Matriz de control del servicio' : 'Service Control Matrix'}
              </h4>
              <p className="text-xs text-slate-500">
                {isEs ? 'Qué debe existir antes de avanzar desde la solicitud hasta facturación.' : 'Prerequisites required to advance from request to invoicing.'}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 whitespace-nowrap">{isEs ? 'ETAPA' : 'STAGE'}</th>
                    <th className="p-3 whitespace-nowrap">{isEs ? 'ENTRADA' : 'INPUT'}</th>
                    <th className="p-3 whitespace-nowrap">{isEs ? 'ACTIVIDAD' : 'ACTIVITY'}</th>
                    <th className="p-3 whitespace-nowrap">{isEs ? 'CONTROL' : 'CONTROL'}</th>
                    <th className="p-3 whitespace-nowrap">{isEs ? 'EVIDENCIA' : 'EVIDENCE'}</th>
                    <th className="p-3 whitespace-nowrap">{isEs ? 'RESPONSABLE' : 'RESPONSIBLE'}</th>
                    <th className="p-3 whitespace-nowrap">{isEs ? 'CRITERIO DE AVANCE' : 'ADVANCE CRITERIA'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {serviceStages.map((stg) => (
                    <tr key={stg.id} className="hover:bg-slate-50/90 transition-colors duration-150">
                      <td className="p-3 font-bold text-center">
                        <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${stg.badgeColor}`}>
                          {stg.id}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{stg.title}</td>
                      <td className="p-3 min-w-[180px]">{stg.entrada}</td>
                      <td className="p-3 min-w-[200px]">{stg.actividad}</td>
                      <td className="p-3 min-w-[180px]">{stg.control}</td>
                      <td className="p-3 min-w-[180px]">{stg.evidenciaMatriz}</td>
                      <td className="p-3 font-medium text-slate-800 whitespace-nowrap">{stg.responsable}</td>
                      <td className="p-3 min-w-[180px] font-medium text-slate-700">{stg.criterio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO 3: DETALLE POR ETAPA (MODIFICADO EN FORMA DE LISTA VERTICAL) */}
      {activeSubTab === 'etapa' && (
        <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
          {/* Encabezado con título y botón de Matriz */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {isEs ? 'Detalle operacional por etapa' : 'Operational Stage Detail'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isEs 
                  ? 'Descripción minuciosa de cada fase con sus objetivos, entradas, actividades, controles, salidas, responsables y criterios para avanzar.' 
                  : 'Detailed breakdown of each stage including objectives, inputs, activities, controls, outputs, managers, and advance criteria.'}
              </p>
            </div>
            <button 
              onClick={() => setActiveSubTab('matriz')}
              className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition-all duration-200 cursor-pointer"
            >
              📋 {isEs ? 'Ver matriz del proceso' : 'View process matrix'}
            </button>
          </div>

          {/* Botones de Selección de Ruta (P2P vs Service-to-Cash) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              onClick={() => setDetailRoute('p2p')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between shadow-xs transform hover:-translate-y-0.5 ${
                detailRoute === 'p2p'
                  ? 'border-2 border-purple-600 bg-purple-50/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg transition-transform duration-300 hover:scale-110">
                  📦
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Procure-to-Pay</h4>
                  <p className="text-xs text-slate-500">
                    {isEs ? 'Compra / renta · 14 etapas' : 'Purchase / rent · 14 stages'}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${
                detailRoute === 'p2p' 
                  ? 'bg-purple-100 text-purple-700 border-purple-200' 
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                P2P
              </span>
            </div>

            <div 
              onClick={() => setDetailRoute('services')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between shadow-xs transform hover:-translate-y-0.5 ${
                detailRoute === 'services'
                  ? 'border-2 border-purple-600 bg-purple-50/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center text-lg transition-transform duration-300 hover:scale-110">
                  🚚
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Service-to-Cash</h4>
                  <p className="text-xs text-slate-500">
                    {isEs ? 'Servicios Operativos · 8 etapas' : 'Operational Services · 8 stages'}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${
                detailRoute === 'services' 
                  ? 'bg-purple-100 text-purple-700 border-purple-200' 
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                S2C
              </span>
            </div>
          </div>

          {/* Banner de Ruta Activa */}
          <div className="p-3.5 bg-purple-50/70 border-l-4 border-l-purple-600 rounded-xl text-xs text-purple-900 transition-all duration-300 hover:shadow-2xs">
            <span className="font-bold">
              {isEs ? 'Ruta activa:' : 'Active route:'} {detailRoute === 'p2p' ? 'Procure-to-Pay' : 'Service-to-Cash'}.
            </span>{' '}
            {detailRoute === 'p2p'
              ? (isEs ? 'Estas 14 etapas abarcan desde la requisición del cliente, cotizaciones, adjudicación, OC a proveedores, recepción e inspección hasta la entrega, factura y cierre.' : 'These 14 stages range from client requisition, quotes, award, vendor POs, receiving, inspection to delivery, invoicing, and closure.')
              : (isEs ? 'Estas 8 etapas son independientes del Procure-to-Pay y corresponden exclusivamente a Servicios Operativos, desde la requisición vinculada hasta factura, cobro y cierre.' : 'These 8 stages are independent from Procure-to-Pay and apply strictly to Operational Services, from request to invoice, payment, and closure.')}
          </div>

          {/* LISTA DE TARJETAS VERTICALES DE ETAPAS (ACOMOCADAS HACIA ABAJO) */}
          <div className="space-y-6 pt-2">
            {currentDetailStages.map((stg) => {
              const badgeBg = stg.numBadgeColor || 'bg-blue-600 text-white';
              const borderLeftClass = 
                stg.id % 3 === 1 ? 'border-l-blue-600' :
                stg.id % 3 === 2 ? 'border-l-teal-600' : 'border-l-purple-600';

              const entradaText = formatFieldValue(stg.entradas || stg.entrada);
              const actividadText = formatFieldValue(stg.actividades || stg.actividad);
              const controlText = formatFieldValue(stg.controles || stg.control);
              const salidaText = formatFieldValue(stg.salidas || stg.salida);
              const responsableText = stg.responsable || '-';
              const criterioText = stg.criterio || '-';
              const countText = stg.count || (isEs ? '0 proceso(s)' : '0 process(es)');

              return (
                <div 
                  key={stg.id}
                  className={`bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 ${borderLeftClass} space-y-4 hover:shadow-md transition-all duration-200`}
                >
                  {/* Encabezado de la Tarjeta de la Etapa */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${badgeBg}`}>
                          {stg.id}
                        </span>
                        <h4 className="text-base font-bold text-slate-900">
                          {stg.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 pl-11">
                        {stg.desc}
                      </p>
                    </div>

                    {/* Badge con Contador de Procesos */}
                    <span className="px-3 py-1 bg-slate-100/90 text-slate-800 text-xs font-bold rounded-full border border-slate-200/80 shrink-0 shadow-2xs">
                      {countText}
                    </span>
                  </div>

                  {/* Cuadrícula de 6 Cajas (2 columnas x 3 filas) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {/* ENTRADA */}
                    <div className="bg-[#F9FAFC] p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                        {isEs ? 'ENTRADA' : 'INPUT'}
                      </span>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        {entradaText}
                      </p>
                    </div>

                    {/* ACTIVIDAD */}
                    <div className="bg-[#F9FAFC] p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                        {isEs ? 'ACTIVIDAD' : 'ACTIVITY'}
                      </span>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        {actividadText}
                      </p>
                    </div>

                    {/* CONTROL */}
                    <div className="bg-[#F9FAFC] p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                        {isEs ? 'CONTROL' : 'CONTROL'}
                      </span>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        {controlText}
                      </p>
                    </div>

                    {/* SALIDA */}
                    <div className="bg-[#F9FAFC] p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                        {isEs ? 'SALIDA' : 'OUTPUT'}
                      </span>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        {salidaText}
                      </p>
                    </div>

                    {/* RESPONSABLE */}
                    <div className="bg-[#F9FAFC] p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                        {isEs ? 'RESPONSABLE' : 'RESPONSIBLE'}
                      </span>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        {responsableText}
                      </p>
                    </div>

                    {/* CRITERIO DE AVANCE */}
                    <div className="bg-[#F9FAFC] p-3.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                        {isEs ? 'CRITERIO DE AVANCE' : 'ADVANCE CRITERIA'}
                      </span>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed">
                        {criterioText}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTENIDO 4: FLUJO COMERCIAL DETALLADO */}
      {activeSubTab === 'comercial' && (
        <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {isEs ? 'Flujo comercial y de abastecimiento ampliado' : 'Extended Commercial & Sourcing Flow'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEs 
                  ? 'Distingue claramente los documentos internos, los documentos enviados a proveedores y la propuesta formal que recibe el cliente.' 
                  : 'Clearly distinguishes internal documents, supplier dispatches, and formal client proposals.'}
              </p>
            </div>
            <span className="self-start sm:self-auto px-3.5 py-1.5 bg-purple-100 text-purple-700 font-bold text-xs rounded-full border border-purple-200 shadow-2xs animate-pulse">
              {isEs ? '14 etapas con compuertas' : '14 gated stages'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { val: '0', title: isEs ? 'RFQ pendientes' : 'Pending RFQs', sub: isEs ? 'Borrador o sin respuesta' : 'Draft or no reply', text: 'text-purple-600' },
              { val: '0', title: isEs ? 'Cotizaciones al cliente' : 'Client Quotations', sub: isEs ? 'Todas las revisiones' : 'All revisions', text: 'text-purple-600' },
              { val: '0', title: isEs ? 'Pendientes del cliente' : 'Pending Client', sub: isEs ? 'Enviadas sin decisión' : 'Sent w/o decision', text: 'text-blue-600' },
              { val: '0', title: isEs ? 'Aprobadas sin OC' : 'Approved w/o PO', sub: isEs ? 'Requieren emitir compra' : 'Require PO issue', text: 'text-orange-600' },
              { val: '0', title: isEs ? 'OC emitidas' : 'Issued POs', sub: isEs ? 'Compromisos a proveedores' : 'Supplier commitments', text: 'text-emerald-600' },
              { val: '0', title: isEs ? 'Entregas sin factura' : 'Deliveries w/o Invoice', sub: isEs ? 'Listas para cierre' : 'Ready for closure', text: 'text-slate-500' }
            ].map((kpi, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <span className="text-2xl font-black text-slate-900">{kpi.val}</span>
                <p className="text-xs font-bold text-slate-800">{kpi.title}</p>
                <p className={`text-[10px] ${kpi.text} font-medium`}>{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50/40 border border-blue-100/80 rounded-2xl p-3.5 flex flex-wrap items-center gap-6 text-xs text-slate-700 transition-all duration-300 hover:shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
              <span><strong className="text-slate-900">{isEs ? 'Interno/confidencial:' : 'Internal/Confidential:'}</strong> {isEs ? 'costos, comparativo, margen y adjudicación.' : 'costs, comparison, margin, and award.'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span><strong className="text-slate-900">{isEs ? 'Proveedor:' : 'Supplier:'}</strong> {isEs ? 'RFQ, respuesta y orden de compra.' : 'RFQ, bid reply, and purchase order.'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span><strong className="text-slate-900">{isEs ? 'Cliente:' : 'Client:'}</strong> {isEs ? 'cotización comercial, decisión, entrega y factura.' : 'commercial quotation, decision, delivery, and invoice.'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {p2pStages.map((stage, idx) => {
              const isExpanded = expandedCommercialStage === stage.id;
              return (
                <div 
                  key={stage.id} 
                  style={{ animationDelay: `${idx * 30}ms` }}
                  className={`bg-white rounded-2xl border transition-all duration-300 shadow-xs overflow-hidden flex flex-col justify-between transform hover:-translate-y-1 hover:shadow-md animate-fadeIn ${
                    isExpanded ? 'border-purple-400 ring-2 ring-purple-300/30 shadow-md scale-[1.01]' : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 transition-transform duration-300 hover:scale-110">
                          {stage.id}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                          {stage.title}
                        </h4>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-purple-600' : ''}`} />
                    </div>

                    <div className="pt-1">
                      <span className="text-2xl font-black text-slate-900 leading-none">0</span>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        {isEs ? 'REGISTROS RELACIONADOS' : 'RELATED RECORDS'}
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${stage.badgeColor}`}>
                        {stage.badge}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 transition-colors duration-200 hover:bg-slate-100/80">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                          {isEs ? 'RESPONSABLE' : 'RESPONSIBLE'}
                        </span>
                        <p className="text-slate-800 font-medium leading-tight line-clamp-2">{stage.responsable}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 transition-colors duration-200 hover:bg-slate-100/80">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                          {isEs ? 'DOCUMENTO / EVIDENCIA' : 'DOC / EVIDENCE'}
                        </span>
                        <p className="text-slate-800 font-medium leading-tight line-clamp-2">{stage.evidencias[0]}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 transition-colors duration-200 hover:bg-slate-100/80">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                          {isEs ? 'COMPUERTA' : 'GATEWAY'}
                        </span>
                        <p className="text-slate-800 font-medium leading-tight line-clamp-2">{stage.controles[0]}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 transition-colors duration-200 hover:bg-slate-100/80">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">
                          {isEs ? 'SALIDA' : 'OUTPUT'}
                        </span>
                        <p className="text-slate-800 font-medium leading-tight line-clamp-2">{stage.salidas[0]}</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setExpandedCommercialStage(isExpanded ? null : stage.id)}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border-t border-slate-100 text-[11px] font-bold text-blue-600 flex items-center justify-between transition-colors duration-200 active:bg-slate-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      {isEs ? 'VER DETALLE COMPLETO' : 'VIEW FULL DETAIL'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-purple-50/30 border-t border-purple-100 space-y-3 text-xs animate-fadeIn">
                      <div>
                        <span className="font-bold text-slate-800 block mb-1">
                          {isEs ? 'Actividades clave:' : 'Key activities:'}
                        </span>
                        <ul className="list-disc list-inside text-slate-600 space-y-1">
                          {stage.actividades.map((act, i) => (
                            <li key={i}>{act}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="pt-2 border-t border-purple-100/60">
                        <span className="font-bold text-slate-800 block mb-1">
                          {isEs ? 'Criterio de Liberación:' : 'Release Criteria:'}
                        </span>
                        <p className="text-slate-600 italic">{stage.criterio}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTENIDO 5: RUTAS ESPECIALES */}
      {activeSubTab === 'especiales' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {isEs ? 'Rutas especiales de Procure-to-Pay' : 'Procure-to-Pay Special Routes'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isEs 
                  ? 'No sustituyen la ruta normal; permiten reutilización controlada, recotización selectiva, cambios posteriores y revisiones sin perder trazabilidad.' 
                  : 'They do not replace standard routes; they allow controlled reuse, selective re-quoting, post-changes, and revisions with full traceability.'}
              </p>
            </div>
            <span className="self-start sm:self-auto px-3.5 py-1 bg-purple-100 text-purple-700 font-bold text-[11px] rounded-full shrink-0 border border-purple-200">
              {isEs ? 'Por expediente y por partida' : 'Per file and line item'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { count: '0', label: isEs ? 'Reposiciones historial' : 'History replacements' },
              { count: '0', label: isEs ? 'Pendientes proveedor' : 'Pending vendor' },
              { count: '0', label: isEs ? 'Pendientes precio cliente' : 'Pending client price' },
              { count: '0', label: isEs ? 'Change Requests' : 'Change Requests' },
              { count: '0', label: isEs ? 'Enmiendas OC' : 'PO Amendments' },
            ].map((kpi, index) => (
              <div key={index} className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200/60 text-center">
                <div className="text-xl font-black text-slate-900">{kpi.count}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🟦</span>
                <h4 className="text-sm font-bold text-slate-800">{isEs ? 'Ruta normal' : 'Standard route'}</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                {isEs ? 'Para una necesidad nueva o cuando la política exige volver a cotizar completamente.' : 'For new demands or when policy requires full re-quoting.'}
              </p>
              <div className="pt-2 text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-1.5">
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Requisición' : 'Requisition'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Validación' : 'Validation'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">RFQ</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Comparativo' : 'Comparison'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Cotización cliente' : 'Client quote'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'OC' : 'PO'}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🕒</span>
                <h4 className="text-sm font-bold text-slate-800">{isEs ? 'Requisición desde historial' : 'Requisition from history'}</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                {isEs ? 'Combina artículos/servicios de operaciones anteriores y partidas nuevas.' : 'Combines items/services from previous operations with new line items.'}
              </p>
              <div className="pt-2 text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-1.5">
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Cliente + política' : 'Client + policy'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Seleccionar partidas' : 'Select items'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Ruta por partida' : 'Item routing'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'RFQ parcial' : 'Partial RFQ'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Nueva cotización' : 'New quote'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'OC por proveedor' : 'PO per vendor'}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🔁</span>
                <h4 className="text-sm font-bold text-slate-800">{isEs ? 'Modificación de solicitud autorizada' : 'Modification of authorized request'}</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                {isEs ? 'Se usa Change Request; no se borra ni se sobrescribe la requisición/cotización original.' : 'Uses Change Request; original requisition/quote is not deleted or overwritten.'}
              </p>
              <div className="pt-2 text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-1.5">
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">CR</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">REQ Rev. N</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Impacto selectivo' : 'Selective impact'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">COT Rev. N</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Aprobación cliente' : 'Client approval'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">OC Rev. N</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">🛒</span>
                <h4 className="text-sm font-bold text-slate-800">{isEs ? 'Enmienda de Orden de Compra' : 'Purchase Order Amendment'}</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                {isEs ? 'La OC original queda histórica y se genera una revisión N.' : 'Original PO remains historic and a revision N is generated.'}
              </p>
              <div className="pt-2 text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-1.5">
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">OC Rev. 0</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Cambio aprobado' : 'Approved change'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Conciliación' : 'Reconciliation'}</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">OC Rev. 1</span> →
                <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Autorización' : 'Authorization'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/70 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">🧾</span>
              <h4 className="text-sm font-bold text-slate-800">{isEs ? 'Solicitud sin requisición formal' : 'Request without formal requisition'}</h4>
            </div>
            <p className="text-[11px] text-slate-500">
              {isEs 
                ? 'Cuando el cliente solicita por correo, llamada, mensaje, portal, PO directa o emergencia, SupplyFlow crea un folio interno provisional.' 
                : 'When requested via email, call, portal, direct PO, or emergency, SupplyFlow creates a temporary internal folio.'}
            </p>
            <div className="text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-1.5">
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200 font-bold text-slate-800">SOL PROV</span> →
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Validación' : 'Validation'}</span> →
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'Cotización cliente' : 'Client quote'}</span> →
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200">{isEs ? 'OC' : 'PO'}</span> →
              <span className="bg-white px-2 py-1 rounded-md border border-slate-200 font-bold text-slate-800">{isEs ? 'Regularización' : 'Regularization'}</span>
            </div>
            <div>
              <button 
                onClick={() => onNavigate && onNavigate('requisition')}
                className="mt-2 px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm active:scale-95 cursor-pointer"
              >
                {isEs ? 'Abrir solicitudes provisionales' : 'Open provisional requests'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">{isEs ? 'Matriz de decisión por partida' : 'Item Decision Matrix'}</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100/70 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">{isEs ? 'SITUACIÓN' : 'SITUATION'}</th>
                    <th className="p-3">{isEs ? 'PRECIO AL CLIENTE' : 'CLIENT PRICE'}</th>
                    <th className="p-3">{isEs ? 'PROVEEDOR/COSTO' : 'VENDOR/COST'}</th>
                    <th className="p-3">¿RFQ?</th>
                    <th className="p-3">{isEs ? 'RESULTADO' : 'RESULT'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-800">{isEs ? 'Cliente exige respetar precio' : 'Client enforces price lock'}</td>
                    <td className="p-3">{isEs ? 'Fijo/garantizado' : 'Fixed/Guaranteed'}</td>
                    <td className="p-3">{isEs ? 'Puede recotizarse' : 'Can be re-quoted'}</td>
                    <td className="p-3">{isEs ? 'Según política' : 'Per policy'}</td>
                    <td className="p-3">{isEs ? 'Mismo precio cliente; costo/margen actualizado' : 'Same client price; cost/margin updated'}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-800">{isEs ? 'Rate Card / contrato vigente' : 'Rate Card / Active contract'}</td>
                    <td className="p-3">{isEs ? 'Tarifa contractual' : 'Contractual rate'}</td>
                    <td className="p-3">{isEs ? 'Reutilizar o validar' : 'Reuse or validate'}</td>
                    <td className="p-3">{isEs ? 'Solo si se requiere' : 'Only if needed'}</td>
                    <td className="p-3">{isEs ? 'Nueva cotización cliente con tarifa contractual' : 'New client quote with contractual rate'}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-800">{isEs ? 'Artículo histórico sin precio vigente' : 'Historical item without current price'}</td>
                    <td className="p-3">{isEs ? 'Recalcular' : 'Recalculate'}</td>
                    <td className="p-3">{isEs ? 'Nueva cotización/validación' : 'New quote/validation'}</td>
                    <td className="p-3">{isEs ? 'Sí o validación rápida' : 'Yes or quick check'}</td>
                    <td className="p-3">{isEs ? 'Nuevo costo y nuevo precio comercial' : 'New cost and new commercial price'}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-800">{isEs ? 'Partida completamente nueva' : 'Completely new item'}</td>
                    <td className="p-3">{isEs ? 'Nuevo precio' : 'New price'}</td>
                    <td className="p-3">{isEs ? 'Nueva cotización' : 'New quote'}</td>
                    <td className="p-3">{isEs ? 'Sí' : 'Yes'}</td>
                    <td className="p-3">{isEs ? 'Ruta normal para esa partida' : 'Standard route for that item'}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-800">{isEs ? 'Cambio posterior a aprobación' : 'Post-approval modification'}</td>
                    <td className="p-3">{isEs ? 'Revisión de cotización' : 'Quote revision'}</td>
                    <td className="p-3">{isEs ? 'Reutiliza o recotiza según impacto' : 'Reuse or re-quote per impact'}</td>
                    <td className="p-3">{isEs ? 'Solo partidas afectadas' : 'Affected items only'}</td>
                    <td className="p-3">{isEs ? 'REQ/COT/OC Rev.N sin borrar histórico' : 'REQ/COT/PO Rev.N retaining history'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🔐</span>
                <h4 className="text-base font-bold text-slate-900">{isEs ? 'Control previo para modificar una OC' : 'Pre-control to amend a PO'}</h4>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                {isEs ? 'Doble control' : 'Dual control'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isEs ? 'OC vigente → Solicitud MOD-OC → aprobación previa → edición/enmienda → Rev. N → nueva revisión/autorización → Emitida.' : 'Active PO → MOD-PO Request → pre-approval → edit/amend → Rev. N → review/authorization → Issued.'}
            </p>
            
            <div className="p-3.5 bg-emerald-50/70 border-l-4 border-emerald-500 rounded-r-xl text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900">{isEs ? '1. Autorizar la modificación' : '1. Authorize modification'}</span> {isEs ? 'confirma que está permitido cambiar la OC.' : 'confirms PO changes are permitted.'} <span className="font-bold text-slate-900">{isEs ? '2. Autorizar la Rev. N' : '2. Authorize Rev. N'}</span> {isEs ? 'confirma el contenido final modificado. Una aprobación no sustituye a la otra.' : 'confirms modified final content. One approval does not replace the other.'}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO 6: MATRIZ DEL PROCESO */}
      {activeSubTab === 'matriz' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {isEs ? 'Matriz integral de procesos · Procure-to-Pay + Service-to-Cash' : 'Comprehensive Process Matrix · Procure-to-Pay + Service-to-Cash'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isEs 
                  ? 'La matriz ya contempla las dos rutas de SupplyFlow: Compras/Rentas (14 etapas) y Servicios Operativos (8 etapas), con entradas, actividades, controles, salidas, evidencia y responsables.' 
                  : 'The matrix covers both SupplyFlow routes: Purchases/Rentals (14 stages) and Operational Services (8 stages), with inputs, activities, controls, outputs, evidence, and managers.'}
              </p>
            </div>
            <span className="self-start sm:self-auto px-3.5 py-1 bg-slate-800 text-white font-bold text-[11px] rounded-full shrink-0 shadow-2xs">
              {isEs ? '22 etapas controladas · 2 rutas' : '22 controlled stages · 2 routes'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              onClick={() => setDetailRoute('p2p')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center gap-3.5 shadow-2xs transform hover:-translate-y-0.5 active:scale-[0.99] ${
                detailRoute === 'p2p'
                  ? 'bg-blue-50/40 border-blue-500 ring-2 ring-blue-400/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0 transition-transform duration-300 hover:scale-110">
                📦
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Procure-to-Pay</h4>
                <p className="text-xs text-slate-500">{isEs ? 'Compras / Rentas · 14 etapas' : 'Purchases / Rentals · 14 stages'}</p>
              </div>
            </div>

            <div 
              onClick={() => setDetailRoute('services')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center gap-3.5 shadow-2xs transform hover:-translate-y-0.5 active:scale-[0.99] ${
                detailRoute === 'services'
                  ? 'bg-purple-50/40 border-purple-500 ring-2 ring-purple-400/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center text-xl shrink-0 transition-transform duration-300 hover:scale-110">
                🚚
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Service-to-Cash</h4>
                <p className="text-xs text-slate-500">{isEs ? 'Servicios Operativos · 8 etapas' : 'Operational Services · 8 stages'}</p>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs text-blue-900 transition-all duration-300 hover:shadow-xs">
            <span className="font-bold">{isEs ? 'Ruta activa:' : 'Active route:'}</span> {detailRoute === 'p2p' ? 'Procure-to-Pay · Compras / Rentas · 14 etapas' : 'Service-to-Cash · Servicios Operativos · 8 etapas'}.
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 min-w-[180px]">{isEs ? 'ETAPA' : 'STAGE'}</th>
                  <th className="p-3.5 min-w-[200px]">{isEs ? 'OBJETIVO' : 'OBJECTIVE'}</th>
                  <th className="p-3.5 min-w-[150px]">{isEs ? 'ENTRADAS' : 'INPUTS'}</th>
                  <th className="p-3.5 min-w-[180px]">{isEs ? 'ACTIVIDADES CLAVE' : 'KEY ACTIVITIES'}</th>
                  <th className="p-3.5 min-w-[170px]">{isEs ? 'CONTROLES / VALIDACIONES' : 'CONTROLS / VALIDATIONS'}</th>
                  <th className="p-3.5 min-w-[140px]">{isEs ? 'SALIDAS' : 'OUTPUTS'}</th>
                  <th className="p-3.5 min-w-[160px]">{isEs ? 'EVIDENCIA / REGISTROS' : 'EVIDENCE / RECORDS'}</th>
                  <th className="p-3.5 min-w-[160px]">{isEs ? 'RESPONSABLE' : 'RESPONSIBLE'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-[11px]">
                {currentDetailStages.map((stg) => (
                  <tr key={stg.id} className="hover:bg-slate-50/90 transition-colors duration-150">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${stg.numBadgeColor}`}>
                          {stg.id}
                        </span>
                        <span className="leading-tight">{stg.title}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 leading-relaxed">{stg.desc}</td>
                    <td className="p-3.5 text-slate-600 leading-relaxed">
                      <ul className="space-y-1">
                        {stg.entradas?.map((e, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-slate-400 font-bold">•</span>
                            <span>{e}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3.5 text-slate-600 leading-relaxed">
                      <ul className="space-y-1">
                        {stg.actividades?.map((a, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-slate-400 font-bold">•</span>
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3.5 text-slate-600 leading-relaxed">
                      <ul className="space-y-1">
                        {stg.controles?.map((c, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-slate-400 font-bold">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3.5 text-slate-600 leading-relaxed">
                      <ul className="space-y-1">
                        {stg.salidas?.map((s, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-slate-400 font-bold">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3.5 text-slate-600 leading-relaxed">
                      <ul className="space-y-1">
                        {stg.evidencias?.map((ev, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-slate-400 font-bold">•</span>
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800 leading-tight">
                      {stg.responsable}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO 7: INDICADORES Y CUELLOS DE BOTELLA */}
      {activeSubTab === 'indicadores' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isEs ? 'Indicadores, cuellos de botella y control documental' : 'KPIs, Bottlenecks, and Document Control'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEs ? 'Panel dinámico para identificar dónde se concentra la operación, qué está pendiente y qué documentos deben existir.' : 'Dynamic dashboard to identify operational concentrations, pending items, and document requirements.'}
              </p>
            </div>
            <button 
              onClick={() => setActiveSubTab('mapa')}
              className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition-all duration-200 cursor-pointer"
            >
              <Map className="w-3.5 h-3.5 text-blue-600" />
              <span>{isEs ? 'Regresar al mapa' : 'Back to map'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div 
              onClick={() => setDetailRoute('p2p')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between transform hover:-translate-y-0.5 active:scale-[0.99] ${
                detailRoute === 'p2p'
                  ? 'bg-blue-50/20 border-blue-500 ring-2 ring-blue-400/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0 transition-transform duration-300 hover:scale-110">
                  📦
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Procure-to-Pay</h4>
                  <p className="text-xs text-slate-500">{isEs ? 'Compras / Rentas · 14 etapas' : 'Purchases / Rentals · 14 stages'}</p>
                </div>
              </div>
            </div>

            <div 
              onClick={() => setDetailRoute('services')}
              className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between transform hover:-translate-y-0.5 active:scale-[0.99] ${
                detailRoute === 'services'
                  ? 'bg-purple-50/20 border-purple-500 ring-2 ring-purple-400/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center text-xl shrink-0 transition-transform duration-300 hover:scale-110">
                  🚚
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Service-to-Cash</h4>
                  <p className="text-xs text-slate-500">{isEs ? 'Servicios Operativos · 8 etapas' : 'Operational Services · 8 stages'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl text-xs text-blue-900 font-medium transition-all duration-300 hover:shadow-xs">
            <span className="font-bold">{isEs ? 'Ruta activa:' : 'Active route:'}</span> {detailRoute === 'p2p' ? 'Procure-to-Pay' : 'Service-to-Cash'}.
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { val: '1', title: isEs ? 'RFQ por emitir' : 'RFQs to issue', sub: isEs ? 'Validadas sin RFQ' : 'Validated w/o RFQ', border: 'border-t-blue-500', text: 'text-blue-600' },
              { val: '13', title: isEs ? 'Ofertas insuficientes' : 'Insufficient bids', sub: isEs ? 'Revisar mínimo' : 'Check minimum', border: 'border-t-purple-500', text: 'text-purple-600' },
              { val: '0', title: isEs ? 'Pendientes del cliente' : 'Pending client', sub: isEs ? 'Esperando decisión' : 'Awaiting decision', border: 'border-t-emerald-500', text: 'text-emerald-600' },
              { val: '2', title: isEs ? 'Aprobadas sin OC' : 'Approved w/o PO', sub: isEs ? 'Emitir compra' : 'Issue PO', border: 'border-t-orange-500', text: 'text-orange-600' },
              { val: '4', title: isEs ? 'OC sin recepción' : 'PO w/o receiving', sub: isEs ? 'Seguimiento a proveedor' : 'Follow-up vendor', border: 'border-t-teal-500', text: 'text-teal-600' },
              { val: '1', title: isEs ? 'Recepciones sin entrega' : 'Receiving w/o delivery', sub: isEs ? 'Pendientes del cliente' : 'Pending client', border: 'border-t-slate-700', text: 'text-slate-600' }
            ].map((kpi, idx) => (
              <div key={idx} className={`bg-white p-4 rounded-2xl border border-slate-200/80 border-t-4 ${kpi.border} shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md`}>
                <span className="text-2xl font-black text-slate-900">{kpi.val}</span>
                <p className="text-xs font-bold text-slate-800 mt-1 leading-tight">{kpi.title}</p>
                <p className={`text-[10px] font-bold ${kpi.text} mt-0.5`}>{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4 transition-all duration-300 hover:shadow-md">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {isEs ? 'Cuellos de botella' : 'Bottlenecks'} - {detailRoute === 'p2p' ? 'Procure-to-Pay' : 'Service-to-Cash'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {detailRoute === 'p2p'
                    ? (isEs ? 'RFQ, ofertas, cotizaciones, decisión del cliente, OC, recepción, entrega y factura.' : 'RFQ, bids, quotes, client decision, PO, receiving, delivery, and invoice.')
                    : (isEs ? 'Solicitud, autorización, programación, ejecución, evidencia y facturación.' : 'Request, authorization, scheduling, execution, proof, and billing.')}
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  `19900001427: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `114927-2: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `19900000647: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `19900001306: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `19900001303: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `19900001432: ${isEs ? 'RFQ enviada; faltan ofertas registradas.' : 'RFQ sent; missing registered bids.'}`,
                  `19900001364: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `19900001363: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `19900001362: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `116058: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`,
                  `19900001275: ${isEs ? 'pendiente de validación interna.' : 'pending internal validation.'}`
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{ animationDelay: `${idx * 30}ms` }}
                    className="p-3 bg-amber-50/50 border-l-4 border-l-amber-400 rounded-xl text-xs text-slate-700 font-medium leading-tight transition-transform duration-200 hover:translate-x-1 animate-fadeIn"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4 transition-all duration-300 hover:shadow-md">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {isEs ? 'Mapa documental' : 'Document Map'} - {detailRoute === 'p2p' ? 'Procure-to-Pay' : 'Service-to-Cash'}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isEs 
                    ? `Documentos y evidencias esperadas para las ${currentDetailStages.length} etapas de ${detailRoute === 'p2p' ? 'Compras/Rentas' : 'Servicios Operativos'}.`
                    : `Expected documents and proof for the ${currentDetailStages.length} stages of ${detailRoute === 'p2p' ? 'Purchases/Rentals' : 'Operational Services'}.`}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {currentDetailStages.map((stg, idx) => (
                  <div 
                    key={stg.id} 
                    style={{ animationDelay: `${idx * 25}ms` }}
                    className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-200/60 space-y-2 transition-all duration-300 hover:bg-slate-100/70 hover:-translate-y-0.5 animate-fadeIn"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${stg.numBadgeColor} transition-transform duration-300 hover:scale-110`}>
                        {stg.id}
                      </span>
                      <h5 className="text-xs font-bold text-slate-900 leading-snug">{stg.title}</h5>
                    </div>
                    <ul className="text-[11px] text-slate-500 pl-7 space-y-0.5">
                      {stg.evidencias?.map((ev, i) => (
                        <li key={i} className="list-disc list-outside">{ev}</li>
                      )) || <li className="list-disc list-outside">{isEs ? 'Documento de control estándar' : 'Standard control document'}</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}