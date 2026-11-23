import React, { useState, useEffect, useRef } from 'react';
import { previewClients, previewClient, previewRequisition, previewQuote, clientLogoUrl } from './portal/api';
import { money, clientOption, requisitionOption, stageStatus, photoTotals, quoteDocument } from './portal/portalModel.mjs';

const TRANSLATIONS = {
  es: {
    portalTitle: "Portal del Cliente",
    portalSubtitle: "Consulta exclusiva del avance de solicitudes, compras, recepción y entrega del cliente.",
    langBtn: "🌐 English",
    alertTitle: "Vista exclusiva de consulta",
    alertText: "Aquí puedes visualizar y descargar documentos; además, cuando exista la factura, puedes firmar de enterado.",
    project: "Proyecto",
    contract: "Contrato",
    refresh: "Actualizar",
    logout: "Cerrar sesión",
    optionSuffix: "Cotización al cliente y aprobación",
    metrics: {
      totalReqs: "Total de solicitudes",
      inProgress: "En proceso",
      closed: "Cerradas",
      avgProgress: "Avance promedio",
      pendingDelivery: "Pendientes de entrega",
      pendingInvoice: "Pendientes de factura"
    },
    processTitle: "Avance del proceso seleccionado",
    statusTags: {
      completed: "COMPLETADA",
      current: "ETAPA ACTUAL",
      pending: "PENDIENTE"
    },
    currentStatusTitle: "Estado actual:",
    nextStepTitle: "Próximo paso:",
    nextStepAction: "Avanzar a la siguiente etapa:",
    processConcluded: "El proceso ha concluido completamente.",
    docsTitle: "Documentos disponibles por etapa",
    viewDownload: "Vista y descarga",
    docsSubtitle: "Abre o descarga los archivos cargados. Cuando falte un documento, el sistema lo indicará expresamente.",
    stagePrefix: "Etapa",
    quoteCard: {
      title: "Cotización comercial",
      revision: "Revisión",
      total: "Total",
      validity: "Vigencia",
      status: "Estado",
      approved: "Aprobada",
      viewQuote: "👁️ Ver cotización"
    },
    poCard: {
      title: "Etapa 5 · Órdenes de compra disponibles",
      sub: "Selecciona una orden de compra para visualizarla o descargarla.",
      supplier: "Proveedor",
      amount: "Monto",
      issued: "Emisión",
      commitment: "Compromiso",
      viewPO: "👁️ Ver orden de compra"
    },
    internalInfoMsg: "información comercial administrada internamente. Los PDF de proveedores no son visibles para el cliente.",
    notUploadedMsg: "Aún no está cargada la documentación.",
    receivingPhotos: "Fotografías de recepción:",
    deliveryPhotos: "Fotografías de entrega:",
    sigTitle: "Firma de enterado de factura",
    sigSub: "Cuando la factura y su archivo estén disponibles, el cliente podrá firmar directamente con mouse, pluma táctil o dedo.",
    sigBadge: "Firma del cliente",
    sigPending: "La factura aún no ha sido cargada para esta solicitud.",
    modalClose: "✕ Cerrar",
    evidenceTitleRec: "Evidencia fotográfica de recepción",
    evidenceTitleDel: "Evidencia fotográfica de entrega",
    noImages: "0 imágenes",
    noImagesMsg: "Aún no hay imágenes cargadas para esta etapa.",
    modalFooter: "Cuando se agreguen fotografías, aparecerán en esta galería.",
    stages: [
      { id: 1, name: "Solicitud / requisición", desc: "La solicitud fue recibida y está pendiente de revisión interna.", action: "Abrir solicitud" },
      { id: 2, name: "Validación interna", desc: "La solicitud está en revisión técnica, contractual y presupuestal." },
      { id: 3, name: "Cotizaciones y comparativo", desc: "Se están solicitando y comparando ofertas de proveedores. Los costos internos son confidenciales." },
      { id: 4, name: "Cotización comercial", desc: "La propuesta económica de Supply Base está en preparación, enviada o pendiente de aprobación.", action: "Abrir cotización comercial" },
      { id: 5, name: "Órdenes de compra disponibles", desc: "La orden de compra fue emitida y se envió al proveedor.", action: "Ver orden de compra" },
      { id: 6, name: "Recepción", desc: "El suministro fue recibido y se prepara la entrega al cliente.", action: "Ver evidencia" },
      { id: 7, name: "Entrega / acuse", desc: "La entrega fue aceptada y el expediente está listo para facturación.", action: "Ver evidencia" },
      { id: 8, name: "Factura", desc: "La factura fue registrada y el proceso se encuentra completado.", action: "Abrir factura" },
    ],
    docQuote: {
      modalHeaderTitle: "Cotización comercial",
      printBtn: "↓ Imprimir / PDF",
      quoteTitle: "COTIZACIÓN",
      subTitle: "COMMERCIAL QUOTATION · PROPUESTA ECONÓMICA",
      revision: "Revisión",
      date: "Fecha",
      validity: "Vigencia",
      currency: "Moneda",
      quotes: "COTIZA",
      client: "CLIENTE",
      contact: "Contacto",
      project: "Proyecto",
      contract: "Contrato",
      reference: "Referencia",
      tblItem: "ITEM",
      tblDesc: "DESCRIPCIÓN",
      tblBrand: "MARCA / MODELO",
      tblQty: "CANT.",
      tblUnit: "UNIDAD",
      tblUnitPrice: "PRECIO UNIT.",
      tblSubtotal: "SUBTOTAL",
      delivPlaceTime: "Lugar y tiempo de entrega",
      paymentTerms: "Condiciones de pago",
      warranty: "Garantía",
      includedScope: "Alcance incluido",
      exclusions: "Exclusiones",
      notes: "Notas",
      subtotalThird: "SUBTOTAL TERCEROS",
      vatThird: "IVA TERCEROS 16.00%",
      totalThird: "TOTAL TERCEROS",
      subtotalGen: "SUBTOTAL GENERAL",
      vatGen: "IVA GENERAL",
      grandTotal: "TOTAL GENERAL",
      buyerSig: "COMPRADOR",
      reviewedSig: "REVISÓ",
      authorizedSig: "AUTORIZÓ",
      unSigned: "Sin firma",
      quoteDisclaimer: "Esta cotización no constituye una factura. Precios y disponibilidad sujetos a la vigencia indicada."
    },
    docPO: {
      modalHeaderTitle: "Orden de Compra",
      buyer: "COMPRADOR",
      contact: "CONTACTO",
      supplier: "PROVEEDOR",
      poDate: "FECHA DE OC",
      poNumber: "NÚMERO DE OC",
      reference: "REFERENCIA",
      internalRef: "REF. INTERNA",
      tblItem: "PARTIDA",
      tblReq: "REQUISICIÓN / SOLICITUD",
      tblRefInt: "REFERENCIA INTERNA",
      tblDesc: "DESCRIPCIÓN",
      tblQty: "CANTIDAD",
      tblUnitPrice: "PRECIO UNITARIO",
      tblSubtotal: "SUBTOTAL",
      addInfoTitle: "INFORMACIÓN ADICIONAL",
      delivPlace: "Lugar de entrega",
      order: "Orden",
      relatedReqs: "Requisiciones relacionadas",
      internalRefs: "Referencias internas",
      currency: "Moneda",
      paymentMethod: "Método y forma de pago",
      cfdiUse: "USO DE CFDI",
      notes: "NOTAS",
      sendInvoiceTo: "Enviar la factura a",
      billTo: "Facturar a",
      subtotal: "SUBTOTAL",
      vat: "IVA 16%",
      total: "TOTAL",
      boughtBy: "COMPRÓ",
      preparedBy: "PREPARÓ",
      authorizedBy: "AUTORIZÓ",
      signatureText: "[ Firma ]"
    }
  },
  en: {
    portalTitle: "Client Portal",
    portalSubtitle: "Exclusive tracking of client requests, purchases, receiving, and delivery progress.",
    langBtn: "🌐 Español",
    alertTitle: "Read-only view mode",
    alertText: "Here you can view and download documents; additionally, when an invoice exists, you can sign off on it.",
    project: "Project",
    contract: "Contract",
    refresh: "Refresh",
    logout: "Log out",
    optionSuffix: "Client quotation and approval",
    metrics: {
      totalReqs: "Total Requests",
      inProgress: "In Process",
      closed: "Closed",
      avgProgress: "Average Progress",
      pendingDelivery: "Pending Delivery",
      pendingInvoice: "Pending Invoice"
    },
    processTitle: "Progress of Selected Process",
    statusTags: {
      completed: "COMPLETED",
      current: "CURRENT STAGE",
      pending: "PENDING"
    },
    currentStatusTitle: "Current status:",
    nextStepTitle: "Next step:",
    nextStepAction: "Advance to the next stage:",
    processConcluded: "The process has been fully completed.",
    docsTitle: "Available Documents by Stage",
    viewDownload: "View & Download",
    docsSubtitle: "Open or download uploaded files. If a document is missing, the system will explicitly state it.",
    stagePrefix: "Stage",
    quoteCard: {
      title: "Commercial Quote",
      revision: "Revision",
      total: "Total",
      validity: "Validity",
      status: "Status",
      approved: "Approved",
      viewQuote: "👁️ View quote"
    },
    poCard: {
      title: "Stage 5 · Available Purchase Orders",
      sub: "Select a purchase order to view or download it.",
      supplier: "Supplier",
      amount: "Amount",
      issued: "Issued",
      commitment: "Commitment",
      viewPO: "👁️ View purchase order"
    },
    internalInfoMsg: "commercially managed internal information. Supplier PDFs are not visible to the client.",
    notUploadedMsg: "Documentation not yet uploaded.",
    receivingPhotos: "Receiving photographs:",
    deliveryPhotos: "Delivery photographs:",
    sigTitle: "Invoice Acknowledgement Signature",
    sigSub: "When the invoice and file become available, the client can sign directly using a mouse, stylus, or finger.",
    sigBadge: "Client Signature",
    sigPending: "The invoice has not been uploaded for this request yet.",
    modalClose: "✕ Close",
    evidenceTitleRec: "Receiving Photographic Evidence",
    evidenceTitleDel: "Delivery Photographic Evidence",
    noImages: "0 images",
    noImagesMsg: "There are no images uploaded for this stage yet.",
    modalFooter: "When photos are added, they will appear in this gallery.",
    stages: [
      { id: 1, name: "Request / Requisition", desc: "The request was received and is pending internal review.", action: "Open request" },
      { id: 2, name: "Internal Validation", desc: "The request is under technical, contractual, and budgetary review." },
      { id: 3, name: "Quotes & Comparison", desc: "Supplier offers are being requested and compared. Internal costs are confidential." },
      { id: 4, name: "Commercial Quote", desc: "The Supply Base financial proposal is being prepared, sent, or pending approval.", action: "Open commercial quote" },
      { id: 5, name: "Available Purchase Orders", desc: "The purchase order was issued and sent to the supplier.", action: "View purchase order" },
      { id: 6, name: "Receiving", desc: "Supply was received and delivery to client is being prepared.", action: "View evidence" },
      { id: 7, name: "Delivery / Receipt", desc: "Delivery was accepted and file is ready for invoicing.", action: "View evidence" },
      { id: 8, name: "Invoice", desc: "Invoice was registered and process is complete.", action: "Open invoice" },
    ],
    docQuote: {
      modalHeaderTitle: "Commercial Quotation",
      printBtn: "↓ Print / PDF",
      quoteTitle: "QUOTATION",
      subTitle: "COMMERCIAL QUOTATION · FINANCIAL PROPOSAL",
      revision: "Revision",
      date: "Date",
      validity: "Validity",
      currency: "Currency",
      quotes: "QUOTED BY",
      client: "CLIENT",
      contact: "Contact",
      project: "Project",
      contract: "Contract",
      reference: "Reference",
      tblItem: "ITEM",
      tblDesc: "DESCRIPTION",
      tblBrand: "BRAND / MODEL",
      tblQty: "QTY",
      tblUnit: "UNIT",
      tblUnitPrice: "UNIT PRICE",
      tblSubtotal: "SUBTOTAL",
      delivPlaceTime: "Delivery Location & Time",
      paymentTerms: "Payment Terms",
      warranty: "Warranty",
      includedScope: "Included Scope",
      exclusions: "Exclusions",
      notes: "Notes",
      subtotalThird: "THIRD PARTY SUBTOTAL",
      vatThird: "THIRD PARTY VAT 16.00%",
      totalThird: "THIRD PARTY TOTAL",
      subtotalGen: "GENERAL SUBTOTAL",
      vatGen: "GENERAL VAT",
      grandTotal: "GRAND TOTAL",
      buyerSig: "BUYER",
      reviewedSig: "REVIEWED BY",
      authorizedSig: "AUTHORIZED BY",
      unSigned: "Unsigned",
      quoteDisclaimer: "This quotation does not constitute an invoice. Prices and availability subject to validity period."
    },
    docPO: {
      modalHeaderTitle: "Purchase Order",
      buyer: "BUYER",
      contact: "CONTACT",
      supplier: "SUPPLIER",
      poDate: "PO DATE",
      poNumber: "PO NUMBER",
      reference: "REFERENCE",
      internalRef: "INT. REF.",
      tblItem: "ITEM",
      tblReq: "REQUISITION / REQUEST",
      tblRefInt: "INTERNAL REFERENCE",
      tblDesc: "DESCRIPTION",
      tblQty: "QUANTITY",
      tblUnitPrice: "UNIT PRICE",
      tblSubtotal: "SUBTOTAL",
      addInfoTitle: "ADDITIONAL INFORMATION",
      delivPlace: "Delivery place",
      order: "Order",
      relatedReqs: "Related requisitions",
      internalRefs: "Internal references",
      currency: "Currency",
      paymentMethod: "Payment method & terms",
      cfdiUse: "CFDI USE",
      notes: "NOTES",
      sendInvoiceTo: "Send invoice to",
      billTo: "Bill to",
      subtotal: "SUBTOTAL",
      vat: "VAT 16%",
      total: "TOTAL",
      boughtBy: "BOUGHT BY",
      preparedBy: "PREPARED BY",
      authorizedBy: "AUTHORIZED BY",
      signatureText: "[ Signature ]"
    }
  }
};

// Los datos del portal vienen de MariaDB (vista previa interna): sin clientes, cotizaciones ni OC escritos en el código.

const getDocIcon = (stageId) => {
  switch (stageId) {
    case 1: return "📄";
    case 2: return "✅";
    case 3: return "📑";
    case 4: return "💼";
    case 5: return "🛒";
    case 6: return "📦";
    case 7: return "🚚";
    case 8: return "🧾";
    default: return "📄";
  }
};

// ==========================================
// ESTILOS DEL PORTAL Y TARJETAS
// ==========================================

const styles = {
  container: {
    backgroundColor: '#d9e3f7',
    padding: '24px 40px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1F2937',
    minHeight: '100vh',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '-24px -40px 16px -40px',
    padding: '20px 40px',
    width: 'auto',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: '#F4F5F7',
    borderBottom: '1px solid #E5E7EB'
  },
  headerTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827'
  },
  headerSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#6B7280'
  },
  langSelector: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#111827',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    userSelect: 'none'
  },
  alertBar: {
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#334155',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center'
  },
  heroBanner: {
    background: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 50%, #C026D3 100%)',
    borderRadius: '16px',
    padding: '24px 32px',
    color: '#FFFFFF',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
  },
  clientInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flex: 1
  },
  logoContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  logoImg: {
    width: '80%',
    height: '80%',
    objectFit: 'contain'
  },
  logoPlaceholder: {
    color: '#4F46E5',
    fontWeight: 'bold',
    fontSize: '24px'
  },
  clientName: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '0.5px'
  },
  clientMeta: {
    margin: '0 0 4px 0',
    fontSize: '13px',
    color: '#E0E7FF'
  },
  metaValue: {
    color: '#FFFFFF',
    fontWeight: '500'
  },
  bannerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    color: '#111827',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  btnDanger: {
    backgroundColor: '#e51111',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  clientSelectorContainer: {
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  selectInput: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    fontSize: '14px',
    color: '#111827',
    fontWeight: '500',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    appearance: 'none'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    borderTop: '4px solid'
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#111827'
  },
  metricLabel: {
    fontSize: '12px',
    color: '#6B7280',
    marginTop: '6px',
    fontWeight: '500'
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827'
  },
  progressPercentage: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#2563EB',
    transition: 'all 0.3s ease'
  },
  progressBarContainer: {
    height: '8px',
    backgroundColor: '#E5E7EB',
    borderRadius: '4px',
    marginBottom: '24px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366F1 0%, #D946EF 100%)',
    borderRadius: '4px',
    transition: 'width 0.5s ease-in-out'
  },
  stepperContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '12px'
  },
  stepCard: {
    borderRadius: '12px',
    padding: '16px 12px',
    cursor: 'default',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    boxSizing: 'border-box'
  },
  stepCompleted: {
    backgroundColor: '#ECFDF5',
    border: '1px solid transparent'
  },
  stepCurrent: {
    backgroundColor: '#F5F3FF',
    border: '1px solid #7C3AED',
    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.1)'
  },
  stepPending: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #F3F4F6'
  },
  stepHeader: {
    marginBottom: '12px'
  },
  stepBadge: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.3s ease'
  },
  stepTitle: {
    margin: '0 0 6px 0',
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: '1.2'
  },
  stepDesc: {
    margin: '0 0 12px 0',
    fontSize: '11px',
    color: '#6B7280',
    lineHeight: '1.4',
    flex: 1
  },
  statusTag: {
    fontSize: '11px',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: '8px'
  },
  actionLink: {
    fontSize: '11px',
    color: '#2563EB',
    fontWeight: '600',
    textDecoration: 'none',
    cursor: 'pointer'
  },
  currentStatusSection: {
    backgroundColor: '#F5F3FF',
    borderRadius: '16px',
    marginBottom: '24px',
    display: 'flex',
    overflow: 'hidden',
    border: '1px solid #EDE9FE'
  },
  currentStatusLeftLine: {
    width: '6px',
    backgroundColor: '#7C3AED'
  },
  nextStepBox: {
    backgroundColor: '#FFFFFF',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '13px'
  },
  btnSmall: {
    backgroundColor: '#1D4ED8',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: '600',
    borderRadius: '20px',
    padding: '6px 16px',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  docsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  docItem: {
    padding: '12px 16px',
    backgroundColor: '#F0F9FF',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#111827',
    borderLeft: '4px solid #3B82F6',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  signatureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #8B5CF6',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    scrollMarginTop: '100px'
  },
  signatureHeaderContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px'
  },
  signatureTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '800',
    color: '#0F172A'
  },
  signatureSubtitle: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: '#64748B'
  },
  signatureBadge: {
    backgroundColor: '#F3E8FF',
    color: '#4C1D95',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700'
  },
  signatureBox: {
    border: '1px dashed #CBD5E1',
    borderRadius: '8px',
    padding: '32px 20px',
    textAlign: 'center',
    color: '#475569',
    fontSize: '14px',
    backgroundColor: '#F8FAFC'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(3px)',
  },
  modalContainer: {
    width: '85%',
    maxWidth: '1000px',
    height: '80vh',
    backgroundColor: '#F4F6FB',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 50%, #D946EF 100%)',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#FFFFFF',
  },
  modalTitleBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
  },
  modalSubtitle: {
    margin: 0,
    fontSize: '12px',
    opacity: 0.9,
  },
  closeBtn: {
    backgroundColor: '#E11D48',
    color: '#FFFFFF',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  modalBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#64748B',
  },
  modalIcon: {
    fontSize: '32px',
    marginBottom: '12px',
    opacity: 0.7
  },
  modalText: {
    margin: 0,
    fontSize: '14px',
  },
  modalFooter: {
    padding: '12px 24px',
    fontSize: '11px',
    color: '#94A3B8',
    borderTop: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
  }
};

const docCardStyles = {
  quoteCard: {
    backgroundColor: '#F0F7FF',
    border: '1px solid #BFDBFE',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
  },
  quoteTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  quoteSub: {
    fontSize: '12px',
    color: '#475569',
    marginTop: '4px'
  },
  btnPrimaryBlue: {
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  poCard: {
    backgroundColor: '#F0FDF4',
    border: '1px solid #DCFCE7',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
  },
  poHeaderTitle: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#15803D'
  },
  poSubText: {
    fontSize: '12px',
    color: '#64748B'
  },
  poInnerBox: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '14px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  btnSmallDark: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontWeight: '700',
    fontSize: '11px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }
};

const quoteStyles = {
  page: {
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto',
    padding: '40px',
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: '#111827',
    backgroundColor: '#FFFFFF',
    boxSizing: 'border-box'
  },
  printHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid #E5E7EB'
  },
  printButton: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '13px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #2563EB',
    paddingBottom: '20px',
    marginBottom: '20px'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoImg: {
    height: '65px',
    width: 'auto',
    objectFit: 'contain'
  },
  logoTextContainer: {
    border: '2px solid #EA580C',
    padding: '6px',
    borderRadius: '6px',
    textAlign: 'center',
    lineHeight: '1'
  },
  logoTitle: {
    color: '#EA580C',
    fontWeight: '900',
    fontSize: '16px',
    display: 'block',
    letterSpacing: '-0.5px'
  },
  logoSub: {
    fontSize: '6px',
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '500',
    display: 'block',
    marginTop: '4px'
  },
  titleSection: {
    textAlign: 'center',
    flex: 1
  },
  mainTitle: {
    margin: '0 0 4px 0',
    fontSize: '20px',
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: '1px'
  },
  subTitle: {
    margin: 0,
    fontSize: '9px',
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: '1px'
  },
  metaData: {
    textAlign: 'right',
    fontSize: '10px',
    lineHeight: '1.5',
    color: '#475569'
  },
  metaHighlight: {
    color: '#1E3A8A',
    fontWeight: '900',
    fontSize: '11px',
    marginBottom: '4px',
    display: 'block'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px'
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '10px',
    lineHeight: '1.5',
    color: '#475569'
  },
  infoTitle: {
    color: '#1D4ED8',
    fontWeight: '900',
    fontSize: '9px',
    marginBottom: '4px',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  strongText: {
    color: '#0F172A',
    fontWeight: '700',
    display: 'block',
    marginBottom: '4px',
    fontSize: '11px'
  },
  sectionBanner: {
    backgroundColor: '#F1F5F9',
    textAlign: 'center',
    padding: '6px',
    fontWeight: '700',
    fontSize: '9px',
    letterSpacing: '4px',
    color: '#475569',
    borderRadius: '4px',
    marginBottom: '20px',
    border: '1px solid #E2E8F0'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '20px',
    fontSize: '10px'
  },
  th: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    textAlign: 'left',
    padding: '8px',
    fontWeight: '700',
    fontSize: '9px',
    textTransform: 'uppercase'
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #E2E8F0',
    color: '#0F172A'
  },
  totalsSection: {
    display: 'grid',
    gridTemplateColumns: '1.8fr 1fr',
    gap: '24px',
    marginBottom: '30px'
  },
  termsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  termBox: {
    backgroundColor: '#F8FAFC',
    borderLeft: '3px solid #2563EB',
    padding: '8px',
    fontSize: '10px',
    color: '#475569',
    borderTop: '1px solid #E2E8F0',
    borderRight: '1px solid #E2E8F0',
    borderBottom: '1px solid #E2E8F0',
    borderRadius: '0 4px 4px 0'
  },
  termTitle: {
    fontWeight: '700',
    color: '#0F172A',
    display: 'block',
    marginBottom: '2px'
  },
  totalsBox: {
    fontSize: '11px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: '700',
    color: '#475569',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '4px'
  },
  grandTotalBox: {
    display: 'flex',
    justifyContent: 'space-between',
    border: '2px solid #0F172A',
    padding: '8px',
    borderRadius: '6px',
    fontWeight: '900',
    fontSize: '12px',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    marginTop: '6px'
  },
  signatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    textAlign: 'center',
    marginTop: '30px',
    marginBottom: '20px'
  },
  sigLine: {
    borderBottom: '1px solid #94A3B8',
    paddingBottom: '4px',
    marginBottom: '4px',
    fontSize: '10px',
    color: '#94A3B8',
    fontStyle: 'italic',
    minHeight: '16px'
  },
  sigTitle: {
    fontWeight: '700',
    fontSize: '9px',
    color: '#1E293B',
    marginBottom: '20px'
  },
  sigName: {
    fontWeight: '700',
    fontSize: '10px',
    color: '#0F172A'
  },
  sigRole: {
    fontSize: '8px',
    color: '#64748B',
    textTransform: 'uppercase'
  },
  footer: {
    textAlign: 'center',
    fontSize: '8px',
    color: '#94A3B8',
    borderTop: '1px solid #E2E8F0',
    paddingTop: '10px'
  }
};

const poStyles = {
  page: {
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto',
    padding: '36px',
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '16px',
    marginBottom: '16px'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoImg: {
    height: '60px',
    width: 'auto',
    objectFit: 'contain'
  },
  logoTextContainer: {
    border: '2px solid #EA580C',
    padding: '6px 10px',
    borderRadius: '6px',
    textAlign: 'center',
    lineHeight: '1'
  },
  logoTitle: {
    color: '#EA580C',
    fontWeight: '900',
    fontSize: '15px',
    display: 'block',
    letterSpacing: '-0.5px'
  },
  logoSub: {
    fontSize: '6px',
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '500',
    display: 'block',
    marginTop: '3px'
  },
  titleSection: {
    textAlign: 'center',
    flex: 1
  },
  mainTitle: {
    margin: '0 0 2px 0',
    fontSize: '22px',
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: '0.5px'
  },
  subTitle: {
    margin: 0,
    fontSize: '12px',
    color: '#475569',
    fontWeight: '800'
  },
  metaData: {
    textAlign: 'right',
    fontSize: '10px',
    lineHeight: '1.5',
    color: '#475569'
  },
  metaLink: {
    color: '#2563EB',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'block',
    marginBottom: '2px'
  },
  buyerGrid: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1fr',
    gap: '12px',
    marginBottom: '16px',
    fontSize: '11px'
  },
  partyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: '6px',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    border: '1px solid #F1F5F9'
  },
  partyRow: {
    display: 'flex',
    gap: '8px'
  },
  partyLabel: {
    fontWeight: '800',
    color: '#0F172A',
    width: '90px',
    flexShrink: 0,
    fontSize: '10px'
  },
  partyValue: {
    color: '#334155',
    fontWeight: '500',
    fontSize: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '20px',
    fontSize: '10px'
  },
  th: {
    backgroundColor: '#0F2A4A',
    color: '#FFFFFF',
    textAlign: 'center',
    padding: '8px',
    fontWeight: '800',
    fontSize: '9px',
    textTransform: 'uppercase',
    borderRight: '1px solid #1E3A8A'
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #E2E8F0',
    borderTop: '1px solid #E2E8F0',
    color: '#0F172A'
  },
  lowerGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: '24px',
    marginBottom: '30px'
  },
  addInfoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  addInfoTitle: {
    fontSize: '10px',
    fontWeight: '800',
    color: '#0F172A',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '4px',
    marginBottom: '4px',
    textAlign: 'center'
  },
  infoRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    fontSize: '10px',
    lineHeight: '1.4'
  },
  orangeArrow: {
    color: '#EA580C',
    fontWeight: '900',
    fontSize: '11px'
  },
  infoKey: {
    fontWeight: '700',
    color: '#0F172A',
    whiteSpace: 'nowrap'
  },
  infoVal: {
    color: '#475569',
    fontWeight: '500'
  },
  totalsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '12px'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: '700',
    color: '#0F172A',
    padding: '2px 0'
  },
  grandTotalOrangeBox: {
    backgroundColor: '#F97316',
    color: '#FFFFFF',
    borderRadius: '10px',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: '900',
    fontSize: '15px',
    marginTop: '6px',
    boxShadow: '0 2px 4px rgba(249, 115, 22, 0.2)'
  },
  signatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    textAlign: 'center',
    marginTop: '40px',
    marginBottom: '24px'
  },
  sigPlaceholder: {
    fontSize: '10px',
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: '8px'
  },
  sigLine: {
    borderTop: '1px solid #94A3B8',
    paddingTop: '6px',
    fontWeight: '800',
    fontSize: '9px',
    color: '#0F172A',
    textTransform: 'uppercase'
  },
  sigName: {
    fontWeight: '800',
    fontSize: '10px',
    color: '#0F172A',
    marginTop: '2px'
  },
  sigRole: {
    fontSize: '8px',
    color: '#94A3B8',
    textTransform: 'uppercase'
  },
  footer: {
    textAlign: 'center',
    fontSize: '8px',
    color: '#94A3B8',
    marginTop: '20px'
  }
};

// Componente interno para renderizar la cotización
function QuotationDocument({ currentQuote, lang = 'es', onClose }) {
  const t = TRANSLATIONS[lang].docQuote;
  // Totales guardados en MariaDB (no se recalculan con un IVA fijo).
  const tot = currentQuote.totales || {};
  const formatMoney = money;
  const issuer = currentQuote.emisor;

  return (
    <div style={quoteStyles.page}>
      
      {/* Botones de acción */}
      <div style={quoteStyles.printHeader} className="no-print">
        <h2 style={{margin: 0, fontSize: '18px', fontWeight: 'bold'}}>{t.modalHeaderTitle}</h2>
        <div style={{display: 'flex', gap: '12px'}}>
          <button style={quoteStyles.printButton} onClick={() => window.print()}>
            {t.printBtn}
          </button>
          <button style={styles.closeBtn} onClick={onClose}>
            {TRANSLATIONS[lang].modalClose}
          </button>
        </div>
      </div>

      {/* Contenedor impreso de la Cotización */}
      <div id="printable-doc">
        <div style={quoteStyles.header}>
          <div style={quoteStyles.logoContainer}>
            <img 
              src="/image_923273.svg" 
              alt="Logo Grupo Gerez" 
              style={quoteStyles.logoImg} 
            />
            <div style={{...quoteStyles.logoTextContainer, padding: '10px'}}>
              <span style={quoteStyles.logoTitle}>GRUPO GEREZ</span>
              <span style={quoteStyles.logoSub}>Customs & Logistics Worldwide</span>
            </div>
          </div>
          
          <div style={quoteStyles.titleSection}>
            <h1 style={quoteStyles.mainTitle}>{t.quoteTitle}</h1>
            <p style={quoteStyles.subTitle}>{t.subTitle}</p>
          </div>
          
          <div style={quoteStyles.metaData}>
            <span style={quoteStyles.metaHighlight}>{currentQuote.folio}</span>
            {t.revision}: {currentQuote.revision}<br/>
            {t.date}: {currentQuote.fecha}<br/>
            {t.validity}: {currentQuote.vigencia}<br/>
            {t.currency}: <strong>{currentQuote.moneda}</strong>
          </div>
        </div>

        <div style={quoteStyles.infoGrid}>
          <div style={quoteStyles.infoCard}>
            <div style={quoteStyles.infoTitle}>{t.quotes}</div>
            <span style={quoteStyles.strongText}>{issuer?.legal_name || 'GRUPO GEREZ - SUPPLY BASE SERVICES DE MEXICO'}</span>
            {issuer?.postal_address || '3ra avenida #1007 Col. Anahuac, Tampico Tamps.'}<br/>
            {issuer?.email || 'supplies@grupogerez.com'}<br/>
            {issuer?.phone || '8332140041'}
          </div>
          <div style={quoteStyles.infoCard}>
            <div style={quoteStyles.infoTitle}>{t.client}</div>
            <span style={quoteStyles.strongText}>{currentQuote.cliente.empresa}</span>
            {t.contact}: {currentQuote.cliente.contacto}<br/>
            {currentQuote.cliente.correo} · {currentQuote.cliente.telefono}<br/>
            {t.project}: <span style={{fontWeight: '600'}}>{currentQuote.cliente.proyecto}</span> · {t.contract}: {currentQuote.cliente.contrato}<br/>
            {t.reference}: {currentQuote.cliente.referencia}
          </div>
        </div>

        {tot.terceros && (
          <div style={quoteStyles.sectionBanner}>
            THIRD PARTY PAYMENT
          </div>
        )}

        <table style={quoteStyles.table}>
          <thead>
            <tr>
              <th style={quoteStyles.th}>{t.tblItem}</th>
              <th style={quoteStyles.th}>{t.tblDesc}</th>
              <th style={quoteStyles.th}>{t.tblBrand}</th>
              <th style={{...quoteStyles.th, textAlign: 'center'}}>{t.tblQty}</th>
              <th style={{...quoteStyles.th, textAlign: 'center'}}>{t.tblUnit}</th>
              <th style={{...quoteStyles.th, textAlign: 'right'}}>{t.tblUnitPrice}</th>
              <th style={{...quoteStyles.th, textAlign: 'right'}}>{t.tblSubtotal}</th>
            </tr>
          </thead>
          <tbody>
            {currentQuote.items.map((item) => (
              <tr key={item.id}>
                <td style={{...quoteStyles.td, fontWeight: '700'}}>{item.id}</td>
                <td style={quoteStyles.td}>{item.desc}</td>
                <td style={quoteStyles.td}>{item.brand}</td>
                <td style={{...quoteStyles.td, textAlign: 'center'}}>{item.qty}</td>
                <td style={{...quoteStyles.td, textAlign: 'center'}}>{item.unit}</td>
                <td style={{...quoteStyles.td, textAlign: 'right', fontWeight: '500'}}>
                  {currentQuote.moneda} {formatMoney(item.price)}
                </td>
                <td style={{...quoteStyles.td, textAlign: 'right', fontWeight: '700', color: '#0F172A'}}>
                  {currentQuote.moneda} {formatMoney(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={quoteStyles.totalsSection}>
          <div style={quoteStyles.termsGrid}>
            <div style={quoteStyles.termBox}>
              <span style={quoteStyles.termTitle}>{t.delivPlaceTime}</span>
              <div>{currentQuote.condiciones.lugarEntrega}</div>
              <div>{currentQuote.condiciones.tiempoEntrega}</div>
            </div>
            <div style={quoteStyles.termBox}>
              <span style={quoteStyles.termTitle}>{t.paymentTerms}</span>
              <div>{currentQuote.condiciones.pago}</div>
            </div>
            <div style={quoteStyles.termBox}>
              <span style={quoteStyles.termTitle}>{t.warranty}</span>
              <div>{currentQuote.condiciones.garantia}</div>
            </div>
            <div style={quoteStyles.termBox}>
              <span style={quoteStyles.termTitle}>{t.includedScope}</span>
              <div>{currentQuote.condiciones.alcance}</div>
            </div>
            <div style={quoteStyles.termBox}>
              <span style={quoteStyles.termTitle}>{t.exclusions}</span>
              <div>{currentQuote.condiciones.exclusiones}</div>
            </div>
            <div style={quoteStyles.termBox}>
              <span style={quoteStyles.termTitle}>{t.notes}</span>
              <div>{currentQuote.condiciones.notas}</div>
            </div>
          </div>

          <div style={quoteStyles.totalsBox}>
            {tot.terceros && (
              <>
                <div style={quoteStyles.totalRow}><span>{t.subtotalThird}</span><span>{currentQuote.moneda} {formatMoney(tot.terceros.base)}</span></div>
                <div style={quoteStyles.totalRow}><span>{t.vatThird}</span><span>{currentQuote.moneda} {formatMoney(tot.terceros.iva)}</span></div>
                <div style={quoteStyles.totalRow}><span>{t.totalThird}</span><span>{currentQuote.moneda} {formatMoney(tot.terceros.total)}</span></div>
              </>
            )}
            {tot.fee && (
              <div style={quoteStyles.totalRow}><span>SERVICE FEE {tot.fee.pct !== null && tot.fee.pct !== undefined ? `${Number(tot.fee.pct)}%` : ''}</span><span>{currentQuote.moneda} {formatMoney(tot.fee.total)}</span></div>
            )}
            <div style={quoteStyles.totalRow}>
              <span>{t.subtotalGen}</span>
              <span>{currentQuote.moneda} {formatMoney(tot.subtotal)}</span>
            </div>
            {tot.descuento !== null && tot.descuento !== undefined && (
              <div style={quoteStyles.totalRow}><span>{lang === 'es' ? 'DESCUENTO' : 'DISCOUNT'}</span><span>- {currentQuote.moneda} {formatMoney(tot.descuento)}</span></div>
            )}
            <div style={{...quoteStyles.totalRow, borderBottom: 'none'}}>
              <span>{lang === 'es' ? 'IVA' : 'VAT'} {tot.ivaPct !== null && tot.ivaPct !== undefined ? `${Number(tot.ivaPct)}%` : ''}</span>
              <span>{currentQuote.moneda} {formatMoney(tot.iva)}</span>
            </div>

            <div style={quoteStyles.grandTotalBox}>
              <span>{t.grandTotal}</span>
              <span>{currentQuote.moneda} {formatMoney(tot.total)}</span>
            </div>
          </div>
        </div>

        <div style={quoteStyles.signatures}>
          <div>
            <div style={quoteStyles.sigTitle}>{t.buyerSig}</div>
            <div style={quoteStyles.sigLine}>{t.unSigned}</div>
            <div style={quoteStyles.sigName}>{currentQuote.firmas.comprador.nombre}</div>
            <div style={quoteStyles.sigRole}>{currentQuote.firmas.comprador.puesto}</div>
          </div>
          <div>
            <div style={quoteStyles.sigTitle}>{t.reviewedSig}</div>
            <div style={quoteStyles.sigLine}>{t.unSigned}</div>
            <div style={quoteStyles.sigName}>{currentQuote.firmas.reviso.nombre}</div>
            <div style={quoteStyles.sigRole}>{currentQuote.firmas.reviso.puesto}</div>
          </div>
          <div>
            <div style={quoteStyles.sigTitle}>{t.authorizedSig}</div>
            <div style={quoteStyles.sigLine}>{t.unSigned}</div>
            <div style={quoteStyles.sigName}>{currentQuote.firmas.autorizo.nombre}</div>
            <div style={quoteStyles.sigRole}>{currentQuote.firmas.autorizo.puesto}</div>
          </div>
        </div>

        <div style={quoteStyles.footer}>
          • {issuer?.email || 'supplies@grupogerez.com'} · {issuer?.phone || '8332140041'} •<br/>
          {t.quoteDisclaimer}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL (PORTAL) · VISTA PREVIA INTERNA
// ==========================================
// Muestra a un Master Admin lo que vería el cliente seleccionado, con datos de MariaDB (solo lectura). El acceso externo de
// clientes (tokens y sesiones propias) NO está habilitado: requiere autorización. Ninguna acción escribe.

const PREVIEW = {
  es: {
    badge: 'Vista previa interna · solo lectura',
    alertTitle: 'Vista previa interna (Master Admin)',
    alertText: 'Así vería el portal el cliente seleccionado, con datos de MariaDB. El acceso externo de clientes todavía no está habilitado (requiere autorización) y aquí no se guarda nada.',
    exit: '← Salir de la vista previa',
    client: 'Cliente',
    requisition: 'Requisición',
    loading: 'Cargando datos de MariaDB...',
    retry: 'Reintentar',
    noClients: 'No hay clientes registrados.',
    noReqs: 'Este cliente no tiene requisiciones registradas.',
    noStage: 'La etapa de este expediente no se infiere (creado desde historial o con control de cambios); el cliente lo verá como "en revisión".',
    lines: 'partida(s)',
    openReq: 'Abrir solicitud',
    quotesNone: 'Aún no hay cotización enviada al cliente.',
    quotePreparing: 'Las revisiones en preparación interna no se muestran al cliente.',
    poSub: 'Folio, fechas y estatus. El documento de la OC al proveedor (proveedor y montos) es interno.',
    poNone: 'Aún no hay órdenes de compra emitidas.',
    receipts: 'Recepciones',
    deliveries: 'Entregas',
    invoices: 'Facturas',
    received: 'recibido',
    accepted: 'Aceptada',
    pendingAcceptance: 'Pendiente de aceptación',
    photos: 'fotografía(s)',
    none: 'Sin registros.',
    sigBlocked: 'La firma de enterado se habilitará cuando se autorice el acceso externo de clientes (es una escritura y hoy está bloqueada).',
    evidenceNote: 'Las imágenes se mostrarán al cliente cuando se habilite el acceso externo; aquí solo se muestra cuántas hay registradas.',
    reqTitle: 'Solicitud / requisición',
    reqCols: ['#', 'Descripción', 'Cantidad', 'Unidad'],
    requestDate: 'Fecha de solicitud',
    needDate: 'Fecha requerida',
    clientRef: 'Referencia del cliente',
    deliveryPlace: 'Lugar de entrega',
    requester: 'Solicitante',
    issued: 'Emisión',
    commitment: 'Compromiso',
    due: 'Vencimiento',
    status: 'Estatus',
    withoutStage: 'sin etapa inferida',
  },
  en: {
    badge: 'Internal preview · read-only',
    alertTitle: 'Internal preview (Master Admin)',
    alertText: 'This is how the selected client would see the portal, with MariaDB data. External client access is not enabled yet (requires authorization) and nothing is saved here.',
    exit: '← Exit preview',
    client: 'Client',
    requisition: 'Requisition',
    loading: 'Loading MariaDB data...',
    retry: 'Retry',
    noClients: 'There are no registered clients.',
    noReqs: 'This client has no registered requisitions.',
    noStage: 'This file has no inferred stage (history-based or under change control); the client will see it as "under review".',
    lines: 'line item(s)',
    openReq: 'Open request',
    quotesNone: 'No quotation has been sent to the client yet.',
    quotePreparing: 'Revisions in internal preparation are not shown to the client.',
    poSub: 'Folio, dates and status. The supplier PO document (supplier and amounts) is internal.',
    poNone: 'No purchase orders issued yet.',
    receipts: 'Receipts',
    deliveries: 'Deliveries',
    invoices: 'Invoices',
    received: 'received',
    accepted: 'Accepted',
    pendingAcceptance: 'Pending acceptance',
    photos: 'photo(s)',
    none: 'No records.',
    sigBlocked: 'Invoice acknowledgment signing will be enabled once external client access is authorized (it is a write and is blocked today).',
    evidenceNote: 'Images will be shown to the client once external access is enabled; only the registered count is shown here.',
    reqTitle: 'Request / requisition',
    reqCols: ['#', 'Description', 'Quantity', 'Unit'],
    requestDate: 'Request date',
    needDate: 'Required date',
    clientRef: 'Client reference',
    deliveryPlace: 'Delivery place',
    requester: 'Requester',
    issued: 'Issued',
    commitment: 'Commitment',
    due: 'Due',
    status: 'Status',
    withoutStage: 'no inferred stage',
  },
};

const isAccepted = v => /^(accepted|aceptad)/i.test(String(v || '').trim());

export default function ClientPortal({ lang: initialLang = 'es', onExit }) {
  const [lang, setLang] = useState(initialLang === 'en' ? 'en' : 'es');
  const t = TRANSLATIONS[lang];
  const p = PREVIEW[lang];
  const es = lang === 'es';

  const [clients, setClients] = useState({ status: 'loading', items: [], error: null });
  const [clientId, setClientId] = useState('');
  const [view, setView] = useState({ status: 'idle', data: null, error: null });
  const [reqId, setReqId] = useState('');
  const [reload, setReload] = useState(0);
  const [logoOk, setLogoOk] = useState(true);
  const [modal, setModal] = useState(null); // { kind: 'quote'|'req'|'evidence', status, data, error, stage }

  const signatureRef = useRef(null);
  const docsRef = useRef(null);

  useEffect(() => {
    const c = new AbortController();
    previewClients(c.signal).then(d => {
      if (c.signal.aborted) return;
      setClients({ status: 'ready', items: d.items, error: null });
      const preferred = d.items.find(x => x.portal_enabled && !x.portal_locked && x.requisitions > 0) || d.items.find(x => x.requisitions > 0) || d.items[0];
      setClientId(id => id || preferred?.id || '');
    }).catch(e => { if (!c.signal.aborted) setClients({ status: 'error', items: [], error: e }); });
    return () => c.abort();
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    const c = new AbortController();
    setView(v => ({ ...v, status: 'loading', error: null }));
    setLogoOk(true);
    previewClient(clientId, c.signal).then(d => {
      if (c.signal.aborted) return;
      setView({ status: 'ready', data: d, error: null });
      setReqId(id => (d.requisitions.some(r => r.id === id) ? id : d.requisitions[0]?.id || ''));
    }).catch(e => { if (!c.signal.aborted) setView({ status: 'error', data: null, error: e }); });
    return () => c.abort();
  }, [clientId, reload]);

  const data = view.data;
  const client = data?.client;
  const req = data?.requisitions.find(r => r.id === reqId) || null;
  const currentStage = req?.stage || null;
  const stages = t.stages;
  const progress = req?.progress ?? 0;
  const m = data?.metrics;
  const photos = photoTotals(req);

  const openQuote = (quote) => {
    setModal({ kind: 'quote', status: 'loading', data: null, error: null });
    previewQuote(clientId, quote.id).then(d => setModal({ kind: 'quote', status: 'ready', data: quoteDocument(d), error: null }))
      .catch(e => setModal({ kind: 'quote', status: 'error', data: null, error: e }));
  };
  const openRequisition = () => {
    if (!req) return;
    setModal({ kind: 'req', status: 'loading', data: null, error: null });
    previewRequisition(clientId, req.id).then(d => setModal({ kind: 'req', status: 'ready', data: d, error: null }))
      .catch(e => setModal({ kind: 'req', status: 'error', data: null, error: e }));
  };

  const handleActionClick = (e, stage) => {
    e.stopPropagation();
    if (stage.id === 1) openRequisition();
    else if (stage.id === 4) { if (req?.quotes?.length) openQuote(req.quotes[0]); else docsRef.current?.scrollIntoView({ behavior: 'smooth' }); }
    else if (stage.id === 5) docsRef.current?.scrollIntoView({ behavior: 'smooth' });
    else if (stage.id === 6 || stage.id === 7) setModal({ kind: 'evidence', stage: stage.id });
    else if (stage.id === 8) signatureRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const header = (
    <>
      {modal?.kind === 'quote' && modal.status === 'ready' && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            #printable-doc, #printable-doc * { visibility: visible !important; }
            #printable-doc { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
            @page { size: letter portrait; margin: 0.8cm; }
          }
        `}} />
      )}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>{t.portalTitle}</h1>
          <p style={styles.headerSubtitle}>{t.portalSubtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span data-testid="cp-badge" style={{ padding: '6px 12px', borderRadius: '999px', background: '#ECFDF5', color: '#047857', fontSize: '11px', fontWeight: 800, border: '1px solid #A7F3D0' }}>{p.badge}</span>
          <div style={styles.langSelector} onClick={() => setLang(l => (l === 'es' ? 'en' : 'es'))}><strong>{t.langBtn}</strong></div>
        </div>
      </header>
      <div data-testid="cp-alert" style={styles.alertBar}>
        <span style={{ color: '#E11D48', marginRight: '8px' }}>👁️</span>
        <strong>{p.alertTitle}</strong> - {p.alertText}
      </div>
    </>
  );

  if (clients.status !== 'ready' || (clientId && view.status !== 'ready' && !data)) {
    const err = clients.error || view.error;
    return (
      <div style={styles.container}>
        {header}
        <div data-testid="cp-status" role={err ? 'alert' : 'status'} style={{ ...styles.sectionCard, color: err ? '#B91C1C' : '#4B5563', fontSize: '13px' }}>
          {err ? err.message : p.loading}
          {err && ![401, 403].includes(err.status) && (
            <button style={{ ...styles.btnSecondary, marginLeft: '12px' }} onClick={() => (clients.error ? window.location.reload() : setReload(n => n + 1))}>{p.retry}</button>
          )}
          {onExit && <button style={{ ...styles.btnSecondary, marginLeft: '12px' }} onClick={onExit}>{p.exit}</button>}
        </div>
      </div>
    );
  }
  if (!clients.items.length) {
    return <div style={styles.container}>{header}<div data-testid="cp-status" style={styles.sectionCard}>{p.noClients}</div></div>;
  }

  const brand = client?.brand_name || client?.name || '';
  return (
    <div style={styles.container} data-testid="client-portal">
      {header}

      {/* Hero */}
      <div style={styles.heroBanner}>
        <div style={styles.clientInfo}>
          <div style={styles.logoContainer}>
            {client?.has_logo && logoOk ? (
              <img src={clientLogoUrl(client.id)} alt="Logo" style={styles.logoImg} onError={() => setLogoOk(false)} />
            ) : (
              <div style={styles.logoPlaceholder}>{brand.substring(0, 2)}</div>
            )}
          </div>
          <div>
            <h2 data-testid="cp-client-name" style={styles.clientName}>{brand}</h2>
            <p style={styles.clientMeta}>{t.project}: <span style={styles.metaValue}>{req?.project || client?.project || 'N/A'}</span></p>
            <p style={styles.clientMeta}>{t.contract}: <span style={styles.metaValue}>{req?.contract || client?.contract || 'N/A'}</span></p>
          </div>
        </div>
        <div style={styles.bannerActions}>
          <button style={styles.btnSecondary} onClick={() => setReload(n => n + 1)}><span style={{ fontSize: '14px' }}>↻</span> {t.refresh}</button>
          {onExit && <button data-testid="cp-exit" style={styles.btnDanger} onClick={onExit}>{p.exit}</button>}
        </div>
      </div>

      {/* Selectores: cliente (con estado de su portal) y requisición */}
      <div style={{ ...styles.clientSelectorContainer, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
        <label style={{ fontSize: '11px', fontWeight: 800, color: '#374151', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>{p.client}
          <select data-testid="cp-client" style={{ ...styles.selectInput, width: '100%' }} value={clientId} onChange={e => { setClientId(e.target.value); setReqId(''); }}>
            {clients.items.map(c => <option key={c.id} value={c.id}>{clientOption(c, es)}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '11px', fontWeight: 800, color: '#374151', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>{p.requisition}
          <select data-testid="cp-requisition" style={{ ...styles.selectInput, width: '100%' }} value={reqId} onChange={e => setReqId(e.target.value)} disabled={!data?.requisitions.length}>
            {!data?.requisitions.length && <option value="">{p.noReqs}</option>}
            {(data?.requisitions || []).map(r => <option key={r.id} value={r.id}>{requisitionOption(r, es)}</option>)}
          </select>
        </label>
      </div>

      {/* Métricas del cliente */}
      <div style={styles.metricsGrid}>
        {[[m?.total, t.metrics.totalReqs, '#3300aa'], [m?.in_progress, t.metrics.inProgress, '#a855f7'], [m?.closed, t.metrics.closed, '#10b981'],
          [m?.avg_progress === null || m?.avg_progress === undefined ? '—' : `${m.avg_progress}%`, t.metrics.avgProgress, '#f97316'],
          [m?.pending_delivery, t.metrics.pendingDelivery, '#f59e0b'], [m?.pending_invoice, t.metrics.pendingInvoice, '#3b82f6']].map(([v, label, color]) => (
          <div key={label} data-testid="cp-metric" style={{ ...styles.metricCard, borderTopColor: color }}>
            <span style={styles.metricValue}>{v ?? '—'}</span>
            <span style={styles.metricLabel}>{label}</span>
          </div>
        ))}
      </div>

      {!req ? (
        <div data-testid="cp-empty" style={styles.sectionCard}>{p.noReqs}</div>
      ) : (
        <>
          {/* Avance del proceso */}
          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div>
                <h3 style={styles.sectionTitle}>{t.processTitle}</h3>
                <p data-testid="cp-req-label" style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>{requisitionOption(req, es)}</p>
              </div>
              <span data-testid="cp-progress" style={styles.progressPercentage}>{currentStage ? `${progress}%` : '—'}</span>
            </div>
            <div style={styles.progressBarContainer}><div style={{ ...styles.progressBarFill, width: `${currentStage ? progress : 0}%` }}></div></div>
            {!currentStage && <p data-testid="cp-no-stage" style={{ fontSize: '12px', color: '#92400E', background: '#FFFBEB', padding: '8px 12px', borderRadius: '8px' }}>{p.noStage}</p>}
            <div style={styles.stepperContainer}>
              {stages.map((stg) => {
                const st = stageStatus(stg.id, currentStage);
                const statusText = st === 'completed' ? t.statusTags.completed : st === 'current' ? t.statusTags.current : t.statusTags.pending;
                return (
                  <div key={stg.id} data-testid="cp-step" data-status={st} style={{ ...styles.stepCard, ...(st === 'completed' ? styles.stepCompleted : {}), ...(st === 'current' ? styles.stepCurrent : {}), ...(st === 'pending' ? styles.stepPending : {}) }}>
                    <div style={styles.stepHeader}>
                      <div style={{ ...styles.stepBadge, backgroundColor: st === 'completed' ? '#10B981' : st === 'current' ? '#6366F1' : '#E5E7EB', color: st === 'pending' ? '#6B7280' : '#FFFFFF' }}>
                        {st === 'completed' ? '✓' : stg.id}
                      </div>
                    </div>
                    <h4 style={{ ...styles.stepTitle, color: st === 'current' ? '#4F46E5' : '#111827' }}>{stg.name}</h4>
                    <p style={styles.stepDesc}>{stg.desc}</p>
                    <div style={{ ...styles.statusTag, color: st === 'completed' ? '#059669' : st === 'current' ? '#4338CA' : '#9CA3AF' }}>{statusText}</div>
                    {stg.action && (
                      <span data-testid={`cp-action-${stg.id}`} style={styles.actionLink} onClick={(e) => handleActionClick(e, stg)}>
                        {st !== 'pending' ? '🔹' : '🔒'} {stg.action}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estado actual */}
          <div style={styles.currentStatusSection}>
            <div style={styles.currentStatusLeftLine}></div>
            <div style={{ padding: '20px' }}>
              <h4 data-testid="cp-current" style={{ margin: '0 0 8px 0', color: '#111827', fontSize: '16px' }}>
                {t.currentStatusTitle} {currentStage ? stages[currentStage - 1].name : p.withoutStage}
              </h4>
              <p style={{ margin: '0 0 16px 0', color: '#4B5563', fontSize: '13px' }}>{currentStage ? stages[currentStage - 1].desc : p.noStage}</p>
              {currentStage && (
                <div style={styles.nextStepBox}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#111827' }}>{t.nextStepTitle}</strong>
                  <span style={{ color: '#4B5563' }}>{currentStage < stages.length ? `${t.nextStepAction} ${stages[currentStage].name}.` : t.processConcluded}</span>
                </div>
              )}
            </div>
          </div>

          {/* Documentos por etapa */}
          <div style={styles.sectionCard} ref={docsRef}>
            <div style={styles.sectionHeader}><h4 style={styles.sectionTitle}>{t.docsTitle}</h4></div>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: '-10px 0 16px 0' }}>{t.docsSubtitle}</p>
            <div style={styles.docsList}>
              <div data-testid="cp-doc-1" style={styles.docItem}>
                {getDocIcon(1)} {t.stagePrefix} 1 · {stages[0].name}: <strong>{req.folio}</strong> · {req.line_count} {p.lines}{' '}
                <button style={{ ...docCardStyles.btnSmallDark, marginLeft: '8px' }} onClick={openRequisition}>{p.openReq}</button>
              </div>
              {[2, 3].map(id => (
                <div key={id} style={styles.docItem}>{getDocIcon(id)} {t.stagePrefix} {id} · {stages[id - 1].name}: <span style={{ color: '#6B7280' }}>{t.internalInfoMsg}</span></div>
              ))}

              {req.quotes.length ? req.quotes.map(q => (
                <div key={q.id} data-testid="cp-quote" style={docCardStyles.quoteCard}>
                  <div>
                    <div style={docCardStyles.quoteTitle}>💼 {t.quoteCard.title} {q.folio} · {t.quoteCard.revision} {q.revision}</div>
                    <div style={docCardStyles.quoteSub}>
                      {t.quoteCard.total}: <strong>{q.currency} {money(q.total)}</strong> · {t.quoteCard.validity}: {q.valid_until || '—'} · {t.quoteCard.status}: <span style={{ color: q.status === 'approved' ? '#059669' : q.status === 'rejected' ? '#B91C1C' : '#4338CA', fontWeight: '800' }}>{q.status_label}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button data-testid="cp-quote-open" style={docCardStyles.btnPrimaryBlue} onClick={() => openQuote(q)}>{t.quoteCard.viewQuote}</button>
                  </div>
                </div>
              )) : (
                <div data-testid="cp-doc-4" style={styles.docItem}>{getDocIcon(4)} {t.stagePrefix} 4 · {stages[3].name}: <span style={{ color: '#6B7280' }}>{p.quotesNone} {p.quotePreparing}</span></div>
              )}

              <div data-testid="cp-doc-5" style={docCardStyles.poCard}>
                <div>
                  <div style={docCardStyles.poHeaderTitle}>🛒 {t.poCard.title}</div>
                  <div style={docCardStyles.poSubText}>{p.poSub}</div>
                </div>
                {req.purchase_orders.length ? req.purchase_orders.map(po => (
                  <div key={po.folio} data-testid="cp-po" style={docCardStyles.poInnerBox}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>{po.folio}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{t.poCard.issued}: {po.order_date || '—'} · {t.poCard.commitment}: {po.commitment_date || '—'} · {p.status}: <strong>{po.status}</strong></div>
                    </div>
                  </div>
                )) : <div style={{ fontSize: '12px', color: '#6B7280' }}>{p.poNone}</div>}
              </div>

              <div data-testid="cp-doc-6" style={styles.docItem}>
                {getDocIcon(6)} {t.stagePrefix} 6 · {p.receipts}: {req.receipts.length ? req.receipts.map(r => `${r.folio} (${r.date || '—'}${r.received_percent !== null ? ` · ${r.received_percent}% ${p.received}` : ''})`).join(', ') : <span style={{ color: '#6B7280' }}>{t.notUploadedMsg}</span>}
              </div>
              <div data-testid="cp-doc-7" style={styles.docItem}>
                {getDocIcon(7)} {t.stagePrefix} 7 · {p.deliveries}: {req.deliveries.length ? req.deliveries.map(d => `${d.folio} (${d.date || '—'} · ${isAccepted(d.acceptance) ? p.accepted : p.pendingAcceptance})`).join(', ') : <span style={{ color: '#6B7280' }}>{t.notUploadedMsg}</span>}
              </div>
              <div data-testid="cp-doc-8" style={styles.docItem}>
                {getDocIcon(8)} {t.stagePrefix} 8 · {p.invoices}: {req.invoices.length ? req.invoices.map(i => `${i.folio}${i.invoice_number ? ` / ${i.invoice_number}` : ''} (${i.issue_date || '—'} · ${i.status})`).join(', ') : <span style={{ color: '#6B7280' }}>{t.notUploadedMsg}</span>}
              </div>
              <div data-testid="cp-photos-receipt" style={styles.docItem}>📷 {t.receivingPhotos} <strong>{photos.receipt}</strong></div>
              <div data-testid="cp-photos-delivery" style={styles.docItem}>📷 {t.deliveryPhotos} <strong>{photos.delivery}</strong></div>
            </div>
          </div>

          {/* Firma de enterado de factura */}
          <div style={styles.signatureCard} ref={signatureRef}>
            <div style={styles.signatureHeaderContainer}>
              <div>
                <h4 style={styles.signatureTitle}>{t.sigTitle}</h4>
                <p style={styles.signatureSubtitle}>{t.sigSub}</p>
              </div>
              <div style={styles.signatureBadge}>{t.sigBadge}</div>
            </div>
            <div data-testid="cp-signature" style={styles.signatureBox}>{req.invoices.length ? p.sigBlocked : t.sigPending}</div>
          </div>
        </>
      )}

      {/* Modal: evidencia (recepción / entrega) */}
      {modal?.kind === 'evidence' && req && (
        <div style={styles.modalOverlay} onClick={() => setModal(null)}>
          <div data-testid="cp-modal" style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleBox}>
                <h3 style={styles.modalTitle}>{modal.stage === 6 ? t.evidenceTitleRec : t.evidenceTitleDel}</h3>
                <p style={styles.modalSubtitle}>{modal.stage === 6 ? photos.receipt : photos.delivery} {p.photos}</p>
              </div>
              <button style={styles.closeBtn} onClick={() => setModal(null)}>{t.modalClose}</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.modalIcon}>📷</div>
              {(modal.stage === 6 ? req.receipts : req.deliveries).length ? (
                <ul style={{ textAlign: 'left', fontSize: '13px', color: '#374151' }}>
                  {(modal.stage === 6 ? req.receipts : req.deliveries).map(x => <li key={x.folio}>{x.folio} · {x.date || '—'} · {x.photos} {p.photos}</li>)}
                </ul>
              ) : <p style={styles.modalText}>{t.noImagesMsg}</p>}
            </div>
            <div style={styles.modalFooter}>{p.evidenceNote}</div>
          </div>
        </div>
      )}

      {/* Modal: solicitud / cotización */}
      {(modal?.kind === 'req' || modal?.kind === 'quote') && (
        <div style={styles.modalOverlay} onClick={() => setModal(null)}>
          <div data-testid="cp-modal" style={{ ...styles.modalContainer, backgroundColor: '#FFFFFF', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            {modal.status !== 'ready' ? (
              <div style={{ padding: '24px' }}>
                <p role={modal.error ? 'alert' : 'status'} style={{ color: modal.error ? '#B91C1C' : '#4B5563', fontSize: '13px' }}>{modal.error ? modal.error.message : p.loading}</p>
                <button style={styles.closeBtn} onClick={() => setModal(null)}>{t.modalClose}</button>
              </div>
            ) : modal.kind === 'quote' ? (
              <QuotationDocument currentQuote={modal.data} lang={lang} onClose={() => setModal(null)} />
            ) : (
              <div style={{ padding: '24px' }} data-testid="cp-req-doc">
                <div style={{ ...styles.modalHeader, padding: 0, marginBottom: '16px' }}>
                  <div style={styles.modalTitleBox}>
                    <h3 style={styles.modalTitle}>{p.reqTitle} · {modal.data.requisition.folio}</h3>
                    <p style={styles.modalSubtitle}>{modal.data.requisition.description || ''}</p>
                  </div>
                  <button style={styles.closeBtn} onClick={() => setModal(null)}>{t.modalClose}</button>
                </div>
                <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.7 }}>
                  {p.requestDate}: <strong>{modal.data.requisition.request_date || '—'}</strong> · {p.needDate}: <strong>{modal.data.requisition.need_date || '—'}</strong><br />
                  {t.project}: <strong>{modal.data.requisition.project || '—'}</strong> · {t.contract}: <strong>{modal.data.requisition.contract || '—'}</strong> · {p.clientRef}: <strong>{modal.data.requisition.client_reference || '—'}</strong><br />
                  {p.requester}: <strong>{modal.data.requisition.requester_name || '—'}</strong> · {p.deliveryPlace}: <strong>{modal.data.requisition.delivery_place || '—'}</strong>
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead><tr>{p.reqCols.map(h => <th key={h} style={{ textAlign: 'left', padding: '8px', background: '#F1F5F9', color: '#334155' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {modal.data.items.map(i => (
                      <tr key={i.line_number} data-testid="cp-req-item">
                        <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>{i.line_number}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>{i.description}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>{i.quantity ?? '—'}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>{i.unit_label || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
