import React, { useState, useEffect, useRef } from 'react';

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

const CLIENTS_DATA = [
  {
    "id": "ms7ph4a0iu9bl",
    "code": "2453",
    "name": "MEXICO FLNG, S. DE R.L. DE C.V.",
    "brandName": "MEXICO FLNG, S. DE R.L. DE C.V.",
    "tax": "MFL210531RR7",
    "project": "NFE",
    "contract": "0",
    "contacts": [],
    "emails": ["EFUENTES@NEWFORTRESSENERGY.COM", "GLAUDINO@NEWFORTRESSENERGY.COM"],
    "status": "Activo",
    "portalEnabled": "Deshabilitado",
    "logo": "",
    "currentStage": 2
  },
  {
    "id": "ms7ph4a0o5kgu",
    "code": "3506",
    "name": "TANKS-A-LOT, LLC",
    "brandName": "TANKS-A-LOT, LLC",
    "tax": "XEXX010101000",
    "project": "Sin Asignar",
    "contract": "N/A",
    "contacts": [],
    "emails": ["MEXICO.OFFICE@TANKSALOTINC.NET", "ATORRES@TANKSALOTINC.NET"],
    "status": "Inactivo",
    "portalEnabled": "Deshabilitado",
    "logo": "",
    "currentStage": 1
  },
  {
    "id": "ms7ph4a9eskd2",
    "code": "1406",
    "name": "GLOBALSANTAFE DRILLING MEXICO, S. DE R.L. DE C.V.",
    "brandName": "GLOBALSANTAFE DRILLING MEXICO, S. DE R.L. DE C.V.",
    "tax": "GDM031127R98",
    "project": "TRION",
    "contract": "11166",
    "contacts": ["Isabella Pursell"],
    "emails": ["isabella.pursell@deepwater.com"],
    "status": "Activo",
    "portalEnabled": "Habilitado",
    "logo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMMAAADDCAYAAAA/f6WqAAAQAElEQVR4AeydB4BsWVW1zzczDFGUJFGigIgowQTyI0GiKAKiGBCQJAiSJKNDFpAkMHIEJGcBkSQgQTIKgmRE8v+Tcw79/vOd07tq16l763W/ee9N6p5etdZee+1zb92qW1Vd/brmiH31a2tra9/W1jxqpPVlsbW1JTVva2trhW1sbW1JK9ja6t7W1pLHXtTBW1vL7NZW12Mv6uCtrZ7b2lry2Is6eGtrmd3a6nrsRR28tdVzW1tLHntRB29tLbMbW12PvaiDt7bWc3O9OX9ra8vWyu2gsbU17x9R6hdQYB410vqyAKTmAStsA5BWAN2DJUPXBmGprQV0D2jbCA9Wa30Bqz6g3WaBxhqA1ACs+MCKD8u6NeoFsHGmRlofeg6WPPaiDoZlForee1EHQ8/Bksde1MGwzELXYy/qYOg5WPLYizoYllnoeuxFHQzrubnenA/YWrkdNGDe95mh1DNmI1xkf5m9/r6Nx3Dv+Jzwj097ZvDOvgnekJv6e729I3BSOAJHACtPJTBde2VhtRdeMPT+WEP3AVttewqgacByoYEVbRNWPdhcn5BnYPO+w14fDv8xaM8Mc4/82Qe8fzVkXwNoLxHUc4gZ6OtAZ/PRU2eED+vZ3svpVQ3H38zqnuxVB3IENt2+Y2+sp7Y3ZsbamfYzA/Q7Tg6oYdp3UEA/CSIrhy8Hws+1XkAf+rbUwp4csBbQt5n90LIZWagFHP4ZtxuIfZFF+HLUwXoialnoBaIOnvI39SIvR04WeoGog6f8Tb3Iy5GThV4g6mD9Uc/V+sKZDD0RnlpYy0Kd0V4m2RCwvEPCvIbVHvQaOrtWBtBe9oQHvYYlRy8Yem+qhmUPiEhjWNbAYruwqlt4+wLYVqXloddAq0v9Aurl8huWNbCWg+4BbQg6WwAtD1g2rQCaBiybbqJeAK0GalVaLvULaBqoVWm6bH8BrQaaA0sGWs8GIDUAzQcWtQKY9Df14LjNQJ93GwJ6DVi2/VEATcOS9QWseoD2Wh4o7Zkhnx1TutSv0vN29pLJPWIud6c7/ymnv0pOCOmenOeeTHXn/LNi6neJm9vZp+HYPZ+sunYHc5ee2YAJs8U6L7XBLqGVT6Q3oHMwOp2YVm7noClB5u1eQGbc7Dsmxew9GD/em8GD8HG+xhwvPfbD9BtT/cuDv8R2NviCeoI7Pdk8Glqf3u8k8y4xoHMuMamubnenL9pvYM947b2sPMjsJvjvykbWxwzY21ucTLkZtaGRHiyyN6cNpcx5qKOzFjrhycHwp+r9feXGfsHeybWD3b9EdGb4zFvPZcN38yI6M3xmLeey4ZvZkT05njMW89lAdsbEbOGsraeQ85lbb6dDGHKwkawOgP6Tk71pzygvRbMa4Q2D+t9WPfMijxrLcKTc60W+kIdsA7oZT1VZ89srtVCPyM8eQpAjjdtTiFPAU4+M/k4hJbn4PGyJ4vQ8hxyrr2bFEFYPdARjL61iFqeq7MfOti5gJ6wDs46e/ojoO/z/nJ5Dg7vTN521lP7DH3fci7rk8uM11PEdQ8dHP7IuR86eMxGHf32zDCaUQdHOOrMsPsbb9N6rr2/vplAZGG5H+FFZuTow6GZifWDx+3nOjIj58yox2zUYy7XkRk5Z0Y9ZqOO3BRHZuSpbHhjNuroT3FkgqcyoxfZ4LG/o7dWgfZSB9bZBWHdh8PrHch+HK4ZOLzHAk5e2ztYt2N7meSZsocT/j8x3ruNpm8jT4bdHpupmfbMYAPWH0325+f+nIa+bu5D96CzPQG9hs5THuy/Bz0Dq7xpPVjNQq8PZAb6LOwxHNgx2HTcx95Yw/o2x8xYA/2fYwDFL88uWahh2rcvoP8DuMjK4cuB8HOtF9CHvi21sCcHrIV18KjH2pyY8vUCkbFWi9CyCE8tcq0W2bcOZD/0VC88OXKy0AtEHTzlb+FRo6cLPQCUQdP+Zt6kZcjJwu9QNTB+qOeq/WFMxl6Ijy1sJaFOmPxzGATlndImNew2oNeQ2fXygDazxzhQa9hydELht6bqmHZAyLSGJY1sNgurwqlt4+wLYVqXloddAq0v9Aurl8huWNbCWg+4BbQg6WwAtD1g2rQCaBiybbqJeAK0GalVaLvULaBqoVWm6bH8BrQaaA0sGWs8GIDUAzQcWtQKY9Df14LjNQJ93GwJ6DVi2/VEATcOS9QWseoD2Wh4o7Zkhnx1TutSvK///L0x59sIP1gtMefbCD9YLTHn2wg+e8mB5o0/1pzw46c94zITXfwmwe3/83q61N/3kAAAAAElFTkSuQmCC",
    "currentStage": 6
  },
  {
    "id": "ms7ph4aa8rcsl",
    "code": "2293",
    "name": "HOOL ENERGY DE MEXICO S. DE R.L. DE C.V.",
    "brandName": "HOOL ENERGY DE MEXICO S. DE R.L. DE C.V.",
    "tax": "HEM200831RH3",
    "project": "XXXXX",
    "contract": "0000",
    "contacts": ["RHERNANDEZM@HOOLENERGY.COM"],
    "emails": ["JJRAMOS@HOOLENERGY.COM"],
    "status": "Inactivo",
    "portalEnabled": "Deshabilitado",
    "logo": "",
    "currentStage": 4
  }
];

const mockQuote = {
  folio: "COT-2026-0014",
  revision: 0,
  fecha: "2026-08-01",
  vigencia: "2026-08-26",
  moneda: "USD",
  cliente: {
    empresa: "GLOBALSANTAFE DRILLING MEXICO, S. DE R.L. DE C.V.",
    contacto: "Isabella Pursell",
    correo: "isabella.pursell@deepwater.com",
    telefono: "N/A",
    proyecto: "TRION",
    contrato: "11166",
    referencia: "WO - GG - 004"
  },
  items: [
    { id: 1, desc: "Digital Thermometer", brand: "—", qty: 1, unit: "pza", price: 478.80 },
    { id: 2, desc: "Outdoor Thermometer", brand: "—", qty: 1, unit: "pza", price: 358.80 }
  ],
  condiciones: {
    lugarEntrega: "PISSA",
    tiempoEntrega: "Por confirmar",
    pago: "Por confirmar",
    garantia: "No indicada",
    alcance: "Conforme a las partidas descritas.",
    exclusiones: "No indicadas.",
    notas: "Precios expresados en la moneda indicada. Vigencia sujeta a disponibilidad."
  },
  firmas: {
    comprador: { status: "Sin firma", nombre: "NOMBRE", puesto: "PUESTO" },
    reviso: { status: "Sin firma", nombre: "NOMBRE", puesto: "PUESTO" },
    autorizo: { status: "Sin firma", nombre: "NOMBRE", puesto: "PUESTO" }
  }
};

const mockPO = {
  poNumber: "OC-2026-0008",
  code: "P-COP-01-01",
  codeDate: "01/11/18",
  revision: "02",
  date: "11 ago 2026",
  commitmentDate: "14 ago 2026",
  location: "Tampico, Tamaulipas",
  reference: "19900001080",
  internalRef: "TRS-0105",
  buyer: "KARLA BARBOSA CASTELLANOS",
  buyerEmail: "karla.barbosa@grupogerez.com",
  supplier: "SAFETY SPOT",
  supplierContact: "—",
  items: [
    {
      partida: 1,
      req: "19900001080",
      refInt: "TRS-0105",
      desc: "1. WRENCHES, ALUMINUM STRAIGHT PIPE 10\" WITH ATTACHMENT RING",
      qty: "6 Each",
      unitPrice: 1745.00,
      subtotal: 10470.00
    }
  ],
  additionalInfo: {
    deliveryPlace: "ESEASA",
    order: "19900001080",
    relatedReqs: "19900001080",
    internalRefs: "TRS-0105",
    currency: "MXN",
    paymentMethod: "PUE - Pago en una sola exhibición / 03 - Transferencia",
    cfdiUse: "G03 - Gastos en general",
    notes: "—",
    sendInvoiceTo: "supplies@grupogerez.com",
    billTo: "GRUPO GEREZ S.A. DE C.V."
  },
  totals: {
    subtotal: 4799.88,
    vat: 767.98,
    total: 5567.86
  },
  signatures: {
    boughtBy: { name: "KARLA BARBOSA CASTELLANOS", role: "ADMINISTRATIVE ASSISTANT" },
    preparedBy: { name: "KATIA CESPEDEZ MENDEZ", role: "AUXILIAR ADMINISTRATIVO" },
    authorizedBy: { name: "MONICA Y. MACIAS PEREZ", role: "ADMINISTRATIVE MANAGER" }
  }
};

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
  const subtotal = currentQuote.items.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const vat = subtotal * 0.16;
  const total = subtotal + vat;

  const formatMoney = (amount) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
            <span style={quoteStyles.strongText}>GRUPO GEREZ - SUPPLY BASE SERVICES DE MEXICO</span>
            3ra avenida #1007 Col. Anahuac, Tampico Tamps.<br/>
            supplies@grupogerez.com<br/>
            8332140041
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

        <div style={quoteStyles.sectionBanner}>
          THIRD PARTY PAYMENT
        </div>

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
                  {currentQuote.moneda} {formatMoney(item.qty * item.price)}
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
            <div style={quoteStyles.totalRow}>
              <span>{t.subtotalThird}</span>
              <span>{currentQuote.moneda} {formatMoney(subtotal)}</span>
            </div>
            <div style={quoteStyles.totalRow}>
              <span>{t.vatThird}</span>
              <span>{currentQuote.moneda} {formatMoney(vat)}</span>
            </div>
            <div style={quoteStyles.totalRow}>
              <span>{t.totalThird}</span>
              <span>{currentQuote.moneda} {formatMoney(total)}</span>
            </div>
            
            <div style={quoteStyles.totalRow}>
              <span>{t.subtotalGen}</span>
              <span>{currentQuote.moneda} {formatMoney(subtotal)}</span>
            </div>
            <div style={{...quoteStyles.totalRow, borderBottom: 'none'}}>
              <span>{t.vatGen}</span>
              <span>{currentQuote.moneda} {formatMoney(vat)}</span>
            </div>
            
            <div style={quoteStyles.grandTotalBox}>
              <span>{t.grandTotal}</span>
              <span>{currentQuote.moneda} {formatMoney(total)}</span>
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
          • supplies@grupogerez.com · 8332140041 •<br/>
          {t.quoteDisclaimer}
        </div>
      </div>
    </div>
  );
}

// Componente interno para renderizar la ORDEN DE COMPRA
function PurchaseOrderDocument({ poData = mockPO, lang = 'es', onClose }) {
  const t = TRANSLATIONS[lang].docPO;
  const formatMoney = (amount) => amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={poStyles.page}>
      
      {/* Header acciones */}
      <div style={quoteStyles.printHeader} className="no-print">
        <h2 style={{margin: 0, fontSize: '18px', fontWeight: 'bold'}}>{t.modalHeaderTitle}</h2>
        <div style={{display: 'flex', gap: '12px'}}>
          <button style={quoteStyles.printButton} onClick={() => window.print()}>
            {TRANSLATIONS[lang].docQuote.printBtn}
          </button>
          <button style={styles.closeBtn} onClick={onClose}>
            {TRANSLATIONS[lang].modalClose}
          </button>
        </div>
      </div>

      {/* Contenedor impreso de la Orden de Compra */}
      <div id="printable-doc">
        <div style={poStyles.header}>
          <div style={poStyles.logoContainer}>
            <img 
              src="/image_923273.svg" 
              alt="Logo Grupo Gerez" 
              style={poStyles.logoImg} 
            />
            <div style={{...poStyles.logoTextContainer, padding: '8px'}}>
              <span style={poStyles.logoTitle}>GRUPO GEREZ</span>
              <span style={poStyles.logoSub}>Customs & Logistics Worldwide</span>
            </div>
          </div>
          
          <div style={poStyles.titleSection}>
            <h1 style={poStyles.mainTitle}>{t.modalHeaderTitle.toUpperCase()}</h1>
            <p style={poStyles.subTitle}>GRUPO GEREZ</p>
          </div>
          
          <div style={poStyles.metaData}>
            <span style={poStyles.metaLink}>www.grupogerez.com</span>
            {poData.code}<br/>
            {TRANSLATIONS[lang].docQuote.date}: {poData.codeDate}<br/>
            {TRANSLATIONS[lang].docQuote.revision}: {poData.revision}
          </div>
        </div>

        <div style={poStyles.buyerGrid}>
          <div style={poStyles.partyCard}>
            <div style={poStyles.partyRow}>
              <span style={poStyles.partyLabel}>{t.buyer}:</span>
              <span style={poStyles.partyValue}>{poData.buyer}</span>
            </div>
            <div style={poStyles.partyRow}>
              <span style={poStyles.partyLabel}>{t.contact}:</span>
              <span style={poStyles.partyValue}>{poData.buyerEmail}</span>
            </div>
            <div style={poStyles.partyRow}>
              <span style={poStyles.partyLabel}>{t.supplier}:</span>
              <span style={poStyles.partyValue}>{poData.supplier}</span>
            </div>
            <div style={poStyles.partyRow}>
              <span style={poStyles.partyLabel}>{t.contact}:</span>
              <span style={poStyles.partyValue}>{poData.supplierContact}</span>
            </div>
          </div>

          <div style={{...poStyles.partyCard, alignItems: 'flex-end', textAlign: 'right'}}>
            <div style={{fontSize: '9px', color: '#94A3B8', marginBottom: '2px'}}>{poData.location}</div>
            <div style={poStyles.partyRow}>
              <span style={{...poStyles.partyLabel, width: 'auto'}}>{t.poDate}:</span>
              <span style={poStyles.partyValue}>{poData.date}</span>
            </div>
            <div style={poStyles.partyRow}>
              <span style={{...poStyles.partyLabel, width: 'auto'}}>{t.poNumber}:</span>
              <span style={{...poStyles.partyValue, fontWeight: '700'}}>{poData.poNumber}</span>
            </div>
            <div style={poStyles.partyRow}>
              <span style={{...poStyles.partyLabel, width: 'auto'}}>{t.reference}:</span>
              <span style={poStyles.partyValue}>{poData.reference}</span>
            </div>
            <div style={poStyles.partyRow}>
              <span style={{...poStyles.partyLabel, width: 'auto'}}>{t.internalRef}:</span>
              <span style={poStyles.partyValue}>{poData.internalRef}</span>
            </div>
          </div>
        </div>

        <table style={poStyles.table}>
          <thead>
            <tr>
              <th style={poStyles.th}>{t.tblItem}</th>
              <th style={poStyles.th}>{t.tblReq}</th>
              <th style={poStyles.th}>{t.tblRefInt}</th>
              <th style={{...poStyles.th, textAlign: 'left', width: '40%'}}>{t.tblDesc}</th>
              <th style={poStyles.th}>{t.tblQty}</th>
              <th style={{...poStyles.th, textAlign: 'right'}}>{t.tblUnitPrice}</th>
              <th style={{...poStyles.th, textAlign: 'right', borderRight: 'none'}}>{t.tblSubtotal}</th>
            </tr>
          </thead>
          <tbody>
            {poData.items.map((item, idx) => (
              <tr key={idx}>
                <td style={{...poStyles.td, textAlign: 'center', fontWeight: '700'}}>{item.partida}</td>
                <td style={{...poStyles.td, textAlign: 'center', fontWeight: '700'}}>{item.req}</td>
                <td style={{...poStyles.td, textAlign: 'center'}}>{item.refInt}</td>
                <td style={{...poStyles.td, fontWeight: '500'}}>{item.desc}</td>
                <td style={{...poStyles.td, textAlign: 'center'}}>{item.qty}</td>
                <td style={{...poStyles.td, textAlign: 'right'}}>${formatMoney(item.unitPrice)}</td>
                <td style={{...poStyles.td, textAlign: 'right', fontWeight: '800'}}>${formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={poStyles.lowerGrid}>
          <div style={poStyles.addInfoSection}>
            <div style={poStyles.addInfoTitle}>{t.addInfoTitle}</div>
            
            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.delivPlace}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.deliveryPlace}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.order}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.order}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.relatedReqs}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.relatedReqs}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.internalRefs}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.internalRefs}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.currency}:</span>
              <span style={{...poStyles.infoVal, fontWeight: '800', color: '#0F172A'}}>{poData.additionalInfo.currency}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.paymentMethod}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.paymentMethod}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.cfdiUse}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.cfdiUse}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.notes}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.notes}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.sendInvoiceTo}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.sendInvoiceTo}</span>
            </div>

            <div style={poStyles.infoRow}>
              <span style={poStyles.orangeArrow}>➔</span>
              <span style={poStyles.infoKey}>{t.billTo}:</span>
              <span style={poStyles.infoVal}>{poData.additionalInfo.billTo}</span>
            </div>
          </div>

          <div style={poStyles.totalsBox}>
            <div style={poStyles.totalRow}>
              <span>{t.subtotal} $</span>
              <span>{formatMoney(poData.totals.subtotal)}</span>
            </div>
            <div style={poStyles.totalRow}>
              <span>{t.vat} $</span>
              <span>{formatMoney(poData.totals.vat)}</span>
            </div>

            <div style={poStyles.grandTotalOrangeBox}>
              <span>{t.total} $</span>
              <span>{formatMoney(poData.totals.total)} {poData.additionalInfo.currency}</span>
            </div>
          </div>
        </div>

        <div style={poStyles.signatures}>
          <div>
            <div style={poStyles.sigPlaceholder}>{t.signatureText}</div>
            <div style={poStyles.sigLine}>{t.boughtBy}:</div>
            <div style={poStyles.sigName}>{poData.signatures.boughtBy.name}</div>
            <div style={poStyles.sigRole}>{poData.signatures.boughtBy.role}</div>
          </div>

          <div>
            <div style={poStyles.sigPlaceholder}>{t.signatureText}</div>
            <div style={poStyles.sigLine}>{t.preparedBy}:</div>
            <div style={poStyles.sigName}>{poData.signatures.preparedBy.name}</div>
            <div style={poStyles.sigRole}>{poData.signatures.preparedBy.role}</div>
          </div>

          <div>
            <div style={poStyles.sigPlaceholder}>{t.signatureText}</div>
            <div style={poStyles.sigLine}>{t.authorizedBy}:</div>
            <div style={poStyles.sigName}>{poData.signatures.authorizedBy.name}</div>
            <div style={poStyles.sigRole}>{poData.signatures.authorizedBy.role}</div>
          </div>
        </div>

        <div style={poStyles.footer}>
          3ra avenida #1007 Col. Anahuac, Tampico Tamps. Teléfono: 8332140041
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL (PORTAL)
// ==========================================

export default function ClientPortal({ onLogout, session, onNotify }) {
  const [selectedClientIndex, setSelectedClientIndex] = useState(2);
  const [currentStage, setCurrentStage] = useState(CLIENTS_DATA[2].currentStage || 6);
  
  // Estado para Idioma
  const [lang, setLang] = useState('es');
  const t = TRANSLATIONS[lang];

  // Modales
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [evidenceModalStage, setEvidenceModalStage] = useState(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);

  const signatureRef = useRef(null);

  const client = CLIENTS_DATA[selectedClientIndex];

  useEffect(() => {
    if (client && client.currentStage) {
      setCurrentStage(client.currentStage);
    }
  }, [selectedClientIndex]);

  const stages = t.stages;
  const progressPercentage = Math.round((currentStage / stages.length) * 100);

  const toggleLanguage = () => {
    setLang(prev => (prev === 'es' ? 'en' : 'es'));
  };

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      if (window.confirm(lang === 'es' ? '¿Deseas cerrar sesión?' : 'Do you want to log out?')) {
        window.location.reload();
      }
    }
  };

  const handleActionClick = (e, stage) => {
    e.stopPropagation(); 
    if (stage.id === 6 || stage.id === 7) {
      setEvidenceModalStage(stage.id);
      setIsEvidenceModalOpen(true);
    } 
    else if (stage.id === 4) {
      setIsQuoteModalOpen(true);
    }
    else if (stage.id === 5) {
      setIsPOModalOpen(true);
    }
    else if (stage.id === 8) {
      if (signatureRef.current) {
        signatureRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div style={styles.container}>
      
      {/* CSS Impresión */}
      {(isQuoteModalOpen || isPOModalOpen) && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            #printable-doc, #printable-doc * { visibility: visible !important; }
            #printable-doc { 
              position: absolute !important; 
              left: 0 !important; 
              top: 0 !important; 
              width: 100% !important; 
              max-width: 100% !important; 
              margin: 0 !important; 
              padding: 0 !important; 
              box-shadow: none !important; 
              border: none !important; 
            }
            .no-print { display: none !important; }
            @page { size: letter portrait; margin: 0.8cm; }
          }
        `}} />
      )}

      {/* Header Superior */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>{t.portalTitle}</h1>
          <p style={styles.headerSubtitle}>{t.portalSubtitle}</p>
        </div>
        <div style={styles.langSelector} onClick={toggleLanguage}>
          <strong>{t.langBtn}</strong>
        </div>
      </header>

      {/* Alerta Superior */}
      <div style={styles.alertBar}>
        <span style={{ color: '#E11D48', marginRight: '8px' }}>👁️</span>
        <strong>{t.alertTitle}</strong> - {t.alertText}
      </div>

      {/* Hero Banner */}
      <div style={styles.heroBanner}>
        <div style={styles.clientInfo}>
          <div style={styles.logoContainer}>
            {client.logo ? (
              <img src={client.logo} alt="Logo" style={styles.logoImg} />
            ) : (
              <div style={styles.logoPlaceholder}>
                {client.name.substring(0, 2)}
              </div>
            )}
          </div>
          <div>
            <h2 style={styles.clientName}>{client.brandName}</h2>
            <p style={styles.clientMeta}>{t.project}: <span style={styles.metaValue}>{client.project || "N/A"}</span></p>
            <p style={styles.clientMeta}>{t.contract}: <span style={styles.metaValue}>{client.contract || "N/A"}</span></p>
          </div>
        </div>

        <div style={styles.bannerActions}>
          <button style={styles.btnSecondary} onClick={() => window.location.reload()}>
            <span style={{ fontSize: '14px' }}>↻</span> {t.refresh}
          </button>
          <button style={styles.btnDanger} onClick={handleLogoutClick}>
            {t.logout}
          </button>
        </div>
      </div>

      {/* Selector de Cliente */}
      <div style={styles.clientSelectorContainer}>
        <select 
          style={styles.selectInput}
          value={selectedClientIndex} 
          onChange={(e) => setSelectedClientIndex(Number(e.target.value))}
        >
          {CLIENTS_DATA.map((cli, idx) => (
            <option key={cli.id} value={idx}>
              {cli.code} - {cli.project} - {t.optionSuffix}
            </option>
          ))}
        </select>
      </div>

      {/* Métricas */}
      <div style={styles.metricsGrid}>
        <div style={{...styles.metricCard, borderTopColor: '#3300aa'}}>
          <span style={styles.metricValue}>2</span>
          <span style={styles.metricLabel}>{t.metrics.totalReqs}</span>
        </div>
        <div style={{...styles.metricCard, borderTopColor: '#a855f7'}}>
          <span style={styles.metricValue}>2</span>
          <span style={styles.metricLabel}>{t.metrics.inProgress}</span>
        </div>
        <div style={{...styles.metricCard, borderTopColor: '#10b981'}}>
          <span style={styles.metricValue}>0</span>
          <span style={styles.metricLabel}>{t.metrics.closed}</span>
        </div>
        <div style={{...styles.metricCard, borderTopColor: '#f97316'}}>
          <span style={styles.metricValue}>{progressPercentage}%</span>
          <span style={styles.metricLabel}>{t.metrics.avgProgress}</span>
        </div>
        <div style={{...styles.metricCard, borderTopColor: '#f59e0b'}}>
          <span style={styles.metricValue}>0</span>
          <span style={styles.metricLabel}>{t.metrics.pendingDelivery}</span>
        </div>
        <div style={{...styles.metricCard, borderTopColor: '#3b82f6'}}>
          <span style={styles.metricValue}>0</span>
          <span style={styles.metricLabel}>{t.metrics.pendingInvoice}</span>
        </div>
      </div>

      {/* Avance del Proceso */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <h3 style={styles.sectionTitle}>{t.processTitle}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
              {client.code} - {client.project} - {t.optionSuffix}
            </p>
          </div>
          <span style={styles.progressPercentage}>{progressPercentage}%</span>
        </div>

        <div style={styles.progressBarContainer}>
          <div style={{...styles.progressBarFill, width: `${progressPercentage}%`}}></div>
        </div>

        <div style={styles.stepperContainer}>
          {stages.map((stg) => {
            const isCompleted = stg.id < currentStage;
            const isCurrent = stg.id === currentStage;
            const isPending = stg.id > currentStage;

            const statusText = isCompleted ? t.statusTags.completed : isCurrent ? t.statusTags.current : t.statusTags.pending;

            return (
              <div 
                key={stg.id} 
                style={{
                  ...styles.stepCard,
                  ...(isCompleted ? styles.stepCompleted : {}),
                  ...(isCurrent ? styles.stepCurrent : {}),
                  ...(isPending ? styles.stepPending : {})
                }}
              >
                <div style={styles.stepHeader}>
                  <div style={{
                    ...styles.stepBadge,
                    backgroundColor: isCompleted ? '#10B981' : isCurrent ? '#6366F1' : '#E5E7EB',
                    color: isPending ? '#6B7280' : '#FFFFFF'
                  }}>
                    {isCompleted ? '✓' : stg.id}
                  </div>
                </div>
                <h4 style={{
                  ...styles.stepTitle,
                  color: isCurrent ? '#4F46E5' : '#111827'
                }}>{stg.name}</h4>
                <p style={styles.stepDesc}>{stg.desc}</p>
                <div style={{
                  ...styles.statusTag,
                  color: isCompleted ? '#059669' : isCurrent ? '#4338CA' : '#9CA3AF'
                }}>
                  {statusText}
                </div>
                {stg.action && (
                  <span 
                    style={styles.actionLink}
                    onClick={(e) => handleActionClick(e, stg)} 
                  >
                    {isCompleted || isCurrent ? '🔹' : '🔒'} {stg.action}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalle Estado Actual */}
      <div style={styles.currentStatusSection}>
        <div style={styles.currentStatusLeftLine}></div>
        <div style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: '16px' }}>
            {t.currentStatusTitle} {stages[currentStage - 1].name}
          </h4>
          <p style={{ margin: '0 0 16px 0', color: '#4B5563', fontSize: '13px' }}>
            {stages[currentStage - 1].desc}
          </p>
          <div style={styles.nextStepBox}>
            <strong style={{ display: 'block', marginBottom: '4px', color: '#111827' }}>{t.nextStepTitle}</strong>
            <span style={{ color: '#4B5563' }}>
              {currentStage < stages.length 
                ? `${t.nextStepAction} ${stages[currentStage].name}.` 
                : t.processConcluded}
            </span>
          </div>
        </div>
      </div>

      {/* Documentos Disponibles */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <h4 style={styles.sectionTitle}>{t.docsTitle}</h4>
          <button style={styles.btnSmall}>{t.viewDownload}</button>
        </div>
        <p style={{ fontSize: '12px', color: '#6B7280', margin: '-10px 0 16px 0' }}>
          {t.docsSubtitle}
        </p>

        <div style={styles.docsList}>
          {stages.map(stg => {
            const isCompleted = stg.id < currentStage;

            // Etapa 4: Cotización
            if (stg.id === 4 && isCompleted) {
              return (
                <div key={stg.id} style={docCardStyles.quoteCard}>
                  <div>
                    <div style={docCardStyles.quoteTitle}>
                      💼 {t.quoteCard.title} {mockQuote.folio} · {t.quoteCard.revision} {mockQuote.revision}
                    </div>
                    <div style={docCardStyles.quoteSub}>
                      {t.quoteCard.total}: <strong>$11,806.53</strong> · {t.quoteCard.validity}: {mockQuote.vigencia} · {t.quoteCard.status}: <span style={{color: '#059669', fontWeight: '800'}}>{t.quoteCard.approved}</span>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button style={docCardStyles.btnPrimaryBlue} onClick={() => setIsQuoteModalOpen(true)}>
                      {t.quoteCard.viewQuote}
                    </button>
                  </div>
                </div>
              );
            }

            // Etapa 5: Orden de compra
            if (stg.id === 5 && isCompleted) {
              return (
                <div key={stg.id} style={docCardStyles.poCard}>
                  <div>
                    <div style={docCardStyles.poHeaderTitle}>
                      🛒 {t.poCard.title}
                    </div>
                    <div style={docCardStyles.poSubText}>
                      {t.poCard.sub}
                    </div>
                  </div>

                  <div style={docCardStyles.poInnerBox}>
                    <div>
                      <div style={{fontWeight: '800', fontSize: '14px', color: '#0F172A'}}>
                        {mockPO.poNumber}
                      </div>
                      <div style={{fontSize: '12px', color: '#475569', marginTop: '4px'}}>
                        {t.poCard.supplier}: <strong>{mockPO.supplier}</strong> · {t.poCard.amount}: <strong>${mockPO.totals.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                      </div>
                      <div style={{fontSize: '11px', color: '#64748B', marginTop: '2px'}}>
                        {t.poCard.issued}: {mockPO.date} · {t.poCard.commitment}: {mockPO.commitmentDate}
                      </div>
                    </div>
                    
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button style={docCardStyles.btnSmallDark} onClick={() => setIsPOModalOpen(true)}>
                        {t.poCard.viewPO}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Etapas Estándar
            return (
              <div key={stg.id} style={styles.docItem}>
                {getDocIcon(stg.id)} {t.stagePrefix} {stg.id} · {stg.name}: <span style={{ color: '#6B7280' }}>
                  {stg.id <= 3 
                    ? t.internalInfoMsg 
                    : t.notUploadedMsg}
                </span>
              </div>
            );
          })}

          <div style={styles.docItem}>📷 {t.receivingPhotos} <strong>0</strong></div>
          <div style={styles.docItem}>📷 {t.deliveryPhotos} <strong>0</strong></div>
        </div>
      </div>

      {/* Firma de Enterado */}
      <div style={styles.signatureCard} ref={signatureRef}>
        <div style={styles.signatureHeaderContainer}>
          <div>
            <h4 style={styles.signatureTitle}>{t.sigTitle}</h4>
            <p style={styles.signatureSubtitle}>{t.sigSub}</p>
          </div>
          <div style={styles.signatureBadge}>
            {t.sigBadge}
          </div>
        </div>
        <div style={styles.signatureBox}>
          {t.sigPending}
        </div>
      </div>

      {/* MODAL 1: Evidencia */}
      {isEvidenceModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsEvidenceModalOpen(false)}>
          <div style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleBox}>
                <h3 style={styles.modalTitle}>
                  {evidenceModalStage === 6 ? t.evidenceTitleRec : t.evidenceTitleDel}
                </h3>
                <p style={styles.modalSubtitle}>{t.noImages}</p>
              </div>
              <button style={styles.closeBtn} onClick={() => setIsEvidenceModalOpen(false)}>
                {t.modalClose}
              </button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.modalIcon}>📷</div>
              <p style={styles.modalText}>{t.noImagesMsg}</p>
            </div>

            <div style={styles.modalFooter}>
              {t.modalFooter}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Cotización Comercial */}
      {isQuoteModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsQuoteModalOpen(false)}>
          <div style={{...styles.modalContainer, backgroundColor: '#FFFFFF', overflowY: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <QuotationDocument 
              currentQuote={mockQuote} 
              lang={lang}
              onClose={() => setIsQuoteModalOpen(false)} 
            />
          </div>
        </div>
      )}

      {/* MODAL 3: Orden de Compra */}
      {isPOModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsPOModalOpen(false)}>
          <div style={{...styles.modalContainer, backgroundColor: '#FFFFFF', overflowY: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <PurchaseOrderDocument 
              poData={mockPO} 
              lang={lang}
              onClose={() => setIsPOModalOpen(false)} 
            />
          </div>
        </div>
      )}

    </div>
  );
}