import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Briefcase, 
  X, 
  ArrowLeft, 
  Check, 
  Package, 
  Truck, 
  Plus, 
  Printer, 
  FileText, 
  Download,
  FileCheck2,
  Calendar,
  Building2,
  User,
  Ship,
  Anchor,
  Wrench,
  FileDown
} from 'lucide-react';

// DICCIONARIO DE TRADUCCIONES
const TEXTS = {
  es: {
    banner: {
      tag: "Grupo Gerez Services",
      title: "Servicios Operativos y Administrativos",
      subtitle: "Controla desde una sola sección la solicitud, ejecución, evidencia, costo, precio de venta y facturación de los servicios prestados al cliente.",
      configuredTitle: "Servicios configurados",
      configuredDetail: "8 tipos activos",
      configuredList: "Agua · Transporte · Transporte de personal · Rise X · Grúas · Montacargas · Gasolina · Last Mile"
    },
    tabs: [
      { id: 1, label: "Dashboard", icon: "📊" },
      { id: 2, label: "Nueva solicitud", icon: "+" },
      { id: 3, label: "Matriz", icon: "📑" },
      { id: 4, label: "Reportes", icon: "📈" }
    ],
    dashboard: {
      title: "Panel ejecutivo de Servicios Operativos",
      subtitle: "Indicadores operativos, comerciales y financieros en una sola vista.",
      filters: {
        allPeriod: "Todo el periodo",
        currentMonth: "Mes actual",
        currentQuarter: "Trimestre actual",
        currentYear: "Año actual",
        allClients: "Todos los clientes",
        allServices: "Todos los servicios"
      },
      kpis: {
        services: "Servicios",
        portfolio: "Portafolio",
        active: "Activos",
        ofTotal: "del total",
        executed: "Ejecutados",
        invoiced: "Facturados",
        income: "Ingresos",
        accSales: "Venta acumulada",
        costs: "Costos",
        accCost: "Costo acumulado",
        margin: "Margen",
        marginPct: "de margen"
      },
      bars: {
        commAuth: "Autorización comercial",
        fileEvidence: "Expediente con evidencia",
        poServices: "Servicios con OC de proveedor",
        invConversion: "Conversión a factura",
        grossMargin: "Margen bruto"
      },
      charts: {
        monthlyTrend: "Tendencia financiera mensual",
        monthlySubtitle: "Ingresos, costos y margen · últimos 12 meses",
        monthsLabel: "12 meses",
        income: "Ingresos",
        costs: "Costos",
        margin: "Margen",
        opStatus: "Estatus operativo",
        portfolioDist: "Distribución del portafolio",
        servicesUnit: "servicios",
        authorized: "Autorizado",
        readyToInvoice: "Listo para facturar"
      },
      byType: {
        servicesByType: "Servicios por tipo",
        volume: "Volumen registrado",
        incomeByType: "Ingresos por tipo",
        accSales: "Venta acumulada",
        marginByType: "Margen por tipo",
        grossProfit: "Rentabilidad bruta"
      },
      topSection: {
        topClients: "Top clientes",
        clientIncome: "Ingresos por cliente",
        commAuthTitle: "Autorización comercial",
        docControl: "Control documental del cliente",
        validAuth: "Autorización válida",
        pendingReg: "Pendiente / regularización",
        rejected: "Rechazada",
        withDoc: "Con documento adjunto",
        invFunnel: "Embudo de facturación",
        fromReqToClose: "De solicitud a cierre comercial",
        requests: "Solicitudes",
        authorized: "Autorizados",
        executed: "Ejecutados",
        readyToInvoice: "Listos factura",
        invoiced: "Facturados"
      },
      externalSec: {
        extContracting: "Contratación externa",
        vendorAndPO: "Proveedor y OC relacionados",
        intExecution: "Ejecución interna",
        extVendor: "Con proveedor externo",
        linkedPO: "Con OC vinculada",
        pendingPO: "OC pendiente",
        poCoverage: "Cobertura de OC",
        opStatusTitle: "Estado operativo",
        statusCount: "Conteo por estatus",
        alertsTitle: "Alertas y pendientes",
        priorityAtt: "Atención prioritaria",
        noAlerts: "Sin alertas para este filtro."
      },
      mgmtKpis: {
        title: "Indicadores de gestión",
        subtitle: "Velocidad, documentación y calidad del proceso",
        timeReq: "Tiempo solicitud→requerido",
        days: "días",
        overdueSrv: "Servicios vencidos",
        negMargin: "Margen negativo",
        pendReg: "Pend. regularización",
        withExtVendor: "Con proveedor externo",
        withEvidence: "Con evidencia"
      }
    },
    newRequest: {
      title: "Nueva solicitud",
      subtitle: "Define el tipo de operación. Para un servicio, crea primero la requisición maestra y después completa su expediente operativo.",
      steps: ["1 · Operación", "2 · Servicio", "3 · Requisición"],
      types: {
        buyRent: "Compra / renta",
        buyRentDesc: "Continúa al flujo actual: requisición, cotización, comparativo, aprobación, OC, recepción, entrega y factura.",
        service: "Servicio",
        serviceDesc: "Agua, transporte, Rise X, grúa, montacargas, gasolina, Last Mile u otro servicio operativo/administrativo.",
        selected: "Seleccionado"
      },
      serviceTypeTitle: "¿Qué servicio realizará?",
      serviceList: [
        { id: 'agua', label: 'Suministro de agua', icon: '💧' },
        { id: 'transporte', label: 'Transporte', icon: '🚚' },
        { id: 'transporte_personal', label: 'Transporte de personal', icon: '🚐' },
        { id: 'rise_x', label: 'Gestión Rise X', icon: '🔐' },
        { id: 'grua', label: 'Servicio de grúa', icon: '🏗️' },
        { id: 'montacargas', label: 'Montacargas', icon: '🚜' },
        { id: 'gasolina', label: 'Recarga de gasolina', icon: '⛽' },
        { id: 'last_mile', label: 'Last Mile Deliveries', icon: '📍' },
        { id: 'otro', label: 'Otro servicio', icon: '🧩' },
      ],
      reqStepTitle: "Crear y vincular la requisición del servicio",
      bannerNote: "Una sola requisición maestra: el Folio / requisición del cliente y la Referencia interna, sean capturados o generados aquí, se guardarán en Solicitud / Requisición → Matriz de requisiciones y quedarán vinculados al expediente de Servicios Operativos → Matriz. No se crea una requisición duplicada.",
      form: {
        client: "Cliente *",
        selectClient: "Seleccionar cliente...",
        clientFolio: "Folio / requisición del cliente *",
        generate: "Generar",
        clientFolioHelp: "Si el cliente ya proporcionó un folio, captúralo manualmente. Si no existe, puedes generarlo y será el mismo número en Solicitud / Requisición.",
        internalRef: "Referencia interna",
        internalRefHelp: "Referencia interna de seguimiento. Se guardará en la requisición maestra y se propagará a los documentos relacionados.",
        project: "Proyecto *",
        projectPlaceholder: "Proyecto / instalación",
        contract: "Contrato / referencia contractual",
        requestDate: "Fecha de solicitud *",
        requiredDate: "Fecha requerida",
        clientRequester: "Solicitante del cliente *",
        requesterEmail: "Correo del solicitante *",
        place: "Lugar de prestación / entrega",
        placePlaceholder: "Patio, terminal, plataforma, instalación...",
        description: "Descripción / alcance del servicio",
        descriptionPlaceholder: "Describe la necesidad del cliente y el alcance inicial del servicio.",
        commNote: "Autorización comercial: PO, Orden de Servicio, contrato, correo, portal o emergencia se podrá registrar después dentro del expediente del servicio cuando exista."
      },
      buttons: {
        back: "Atrás",
        continue: "Continuar ›",
        createAndContinue: "Crear requisición y continuar ›",
        successAlert: "¡Requisición creada con éxito!"
      }
    },
    matrix: {
      clientSectionTitle: "Servicios por cliente → comprador",
      clientSectionSubtitle: "Paso 1: selecciona el cliente. Paso 2: selecciona el comprador vinculado a la requisición/validación. Después se muestra la matriz paginada.",
      badge: "2 cliente(s) • 3 servicio(s)",
      cards: {
        services: "Servicios",
        buyers: "Compradores",
        open: "Abiertos",
        withEvidence: "1 con evidencia"
      },
      matrixTitle: "Matriz de servicios",
      matrixSubtitle: "Consulta, filtra, edita y controla todos los servicios.",
      btnExcel: "Excel/CSV",
      searchPlaceholder: "Buscar folio, cliente, proyecto, referencia...",
      allServices: "Todos los servicios",
      allStatuses: "Todos los estatus",
      headers: [
        "FOLIO", "REQUISICIÓN", "REFERENCIA INTERNA", "SERVICIO", "CLIENTE",
        "PROYECTO", "FECHA", "AUTORIZACIÓN CLIENTE", "OC PROVEEDOR", "FACTURACIÓN",
        "ESTATUS", "CANT.", "COSTO", "VENTA", "MARGEN", "RESPONSABLE", "EVIDENCIAS", "ACCIONES"
      ],
      emptyText: "No hay servicios registrados en la matriz para este cliente."
    },
    reports: {
      bannerTag: "📄 Centro documental",
      bannerTitle: "Formatos y Reportes de Servicios Operativos",
      bannerSubtitle: "Genera documentos operativos, entregables al cliente y análisis gerencial con la información real registrada en Servicios Operativos.",
      filters: {
        from: "Desde",
        to: "Hasta",
        client: "Cliente",
        service: "Servicio",
        status: "Estatus",
        all: "Todos"
      },
      subTabs: [
        { id: 'solicitud', label: 'Formato de Solicitud', subtitle: 'Documento individual del servicio', icon: '📋' },
        { id: 'partidas', label: 'Por Partidas', subtitle: 'Detalle línea por línea', icon: '📄' },
        { id: 'general', label: 'General', subtitle: 'Consolidado operativo y financiero', icon: '📊' },
        { id: 'cliente', label: 'Hacia el Cliente', subtitle: 'Sin costo interno ni margen', icon: '🤝' },
        { id: 'gerencial', label: 'Gerencial', subtitle: 'Rentabilidad, riesgos y tendencias', icon: '💼' }
      ],
      reqFormat: {
        selectLabel: "Solicitud de servicio",
        selectPlaceholder: "Seleccionar solicitud...",
        btnGenerate: "Generar formato",
        btnPrint: "Imprimir",
        emptySelect: "Selecciona una solicitud de servicio para generar su formato.",
        docTitle: "SOLICITUD DE SERVICIO",
        genData: "DATOS GENERALES",
        client: "CLIENTE",
        project: "PROYECTO",
        contract: "CONTRATO / REFERENCIA",
        status: "ESTATUS",
        reqDate: "FECHA SOLICITUD",
        requiredDate: "FECHA REQUERIDA",
        owner: "RESPONSABLE",
        qty: "CANTIDAD",
        commAuth: "AUTORIZACIÓN COMERCIAL DEL CLIENTE",
        type: "TIPO",
        ref: "REFERENCIA",
        date: "FECHA",
        authAmount: "MONTO AUTORIZADO",
        validity: "VIGENCIA",
        extVendor: "PROVEEDOR EXTERNO",
        vendorPO: "OC PROVEEDOR",
        srvData: "DATOS ESPECÍFICOS DEL SERVICIO",
        origin: "ORIGIN",
        dest: "DESTINATION",
        vehType: "VEHICLE TYPE",
        plates: "PLATES",
        operator: "OPERATOR",
        cargo: "CARGO",
        pod: "POD",
        departure: "DEPARTURE",
        arrival: "ARRIVAL",
        scope: "ALCANCE / DESCRIPCIÓN",
        ecoControl: "CONTROL ECONÓMICO",
        intCost: "Costo interno",
        clientPrice: "Precio al cliente",
        margin: "Margen",
        evidences: "Evidencias",
        signatures: {
          requested: "Solicitó / Cliente",
          owner: "Responsable del servicio",
          acceptance: "Aceptación / Cierre"
        },
        footer: "Documento generado desde Grupo Gerez · Servicios Operativos"
      },
      byItems: {
        title: "REPORTE DE SERVICIOS POR PARTIDAS",
        subtitle: "Detalle Operativo y Financiero",
        issueDate: "Fecha de emisión",
        headers: ["Folio", "Servicio", "Cliente", "Proyecto", "Fecha", "Cantidad / Alcance", "Estatus", "Costo", "Venta", "Margen"],
        totals: "Totales Consolidados:"
      },
      inDev: "en desarrollo."
    }
  },
  en: {
    banner: {
      tag: "Grupo Gerez Services",
      title: "Operational and Administrative Services",
      subtitle: "Control request, execution, evidence, cost, sale price, and invoicing of services provided to clients from a single module.",
      configuredTitle: "Configured Services",
      configuredDetail: "8 active types",
      configuredList: "Water · Transport · Staff Transport · Rise X · Cranes · Forklifts · Fuel · Last Mile"
    },
    tabs: [
      { id: 1, label: "Dashboard", icon: "📊" },
      { id: 2, label: "New Request", icon: "+" },
      { id: 3, label: "Matrix", icon: "📑" },
      { id: 4, label: "Reports", icon: "📈" }
    ],
    dashboard: {
      title: "Operational Services Executive Panel",
      subtitle: "Operational, commercial, and financial KPIs in a single view.",
      filters: {
        allPeriod: "All period",
        currentMonth: "Current month",
        currentQuarter: "Current quarter",
        currentYear: "Current year",
        allClients: "All clients",
        allServices: "All services"
      },
      kpis: {
        services: "Services",
        portfolio: "Portfolio",
        active: "Active",
        ofTotal: "of total",
        executed: "Executed",
        invoiced: "Invoiced",
        income: "Income",
        accSales: "Accumulated sales",
        costs: "Costs",
        accCost: "Accumulated cost",
        margin: "Margin",
        marginPct: "margin"
      },
      bars: {
        commAuth: "Commercial authorization",
        fileEvidence: "File with evidence",
        poServices: "Services with Vendor PO",
        invConversion: "Invoice conversion",
        grossMargin: "Gross margin"
      },
      charts: {
        monthlyTrend: "Monthly financial trend",
        monthlySubtitle: "Income, costs, and margin · last 12 months",
        monthsLabel: "12 months",
        income: "Income",
        costs: "Costs",
        margin: "Margin",
        opStatus: "Operational status",
        portfolioDist: "Portfolio distribution",
        servicesUnit: "services",
        authorized: "Authorized",
        readyToInvoice: "Ready to invoice"
      },
      byType: {
        servicesByType: "Services by type",
        volume: "Logged volume",
        incomeByType: "Income by type",
        accSales: "Accumulated sales",
        marginByType: "Margin by type",
        grossProfit: "Gross profitability"
      },
      topSection: {
        topClients: "Top Clients",
        clientIncome: "Income by client",
        commAuthTitle: "Commercial authorization",
        docControl: "Client document control",
        validAuth: "Valid authorization",
        pendingReg: "Pending / Regularization",
        rejected: "Rejected",
        withDoc: "With attached document",
        invFunnel: "Invoicing funnel",
        fromReqToClose: "From request to commercial closure",
        requests: "Requests",
        authorized: "Authorized",
        executed: "Executed",
        readyToInvoice: "Ready to invoice",
        invoiced: "Invoiced"
      },
      externalSec: {
        extContracting: "External contracting",
        vendorAndPO: "Related vendor and PO",
        intExecution: "Internal execution",
        extVendor: "With external vendor",
        linkedPO: "With linked PO",
        pendingPO: "Pending PO",
        poCoverage: "PO coverage",
        opStatusTitle: "Operational status",
        statusCount: "Count by status",
        alertsTitle: "Alerts and pending",
        priorityAtt: "Priority attention",
        noAlerts: "No alerts for this filter."
      },
      mgmtKpis: {
        title: "Management indicators",
        subtitle: "Speed, documentation, and process quality",
        timeReq: "Time request→required",
        days: "days",
        overdueSrv: "Overdue services",
        negMargin: "Negative margin",
        pendReg: "Pending regularization",
        withExtVendor: "With external vendor",
        withEvidence: "With evidence"
      }
    },
    newRequest: {
      title: "New Request",
      subtitle: "Define the operation type. For a service, create the master requisition first and then complete its operational file.",
      steps: ["1 · Operation", "2 · Service", "3 · Requisition"],
      types: {
        buyRent: "Purchase / Rent",
        buyRentDesc: "Continue current flow: requisition, quote, comparison, approval, PO, receipt, delivery, and invoice.",
        service: "Service",
        serviceDesc: "Water, transport, Rise X, crane, forklift, fuel, Last Mile or another operational/administrative service.",
        selected: "Selected"
      },
      serviceTypeTitle: "What service will be performed?",
      serviceList: [
        { id: 'agua', label: 'Water Supply', icon: '💧' },
        { id: 'transporte', label: 'Transportation', icon: '🚚' },
        { id: 'transporte_personal', label: 'Staff Transportation', icon: '🚐' },
        { id: 'rise_x', label: 'Rise X Management', icon: '🔐' },
        { id: 'grua', label: 'Crane Service', icon: '🏗️' },
        { id: 'montacargas', label: 'Forklift', icon: '🚜' },
        { id: 'gasolina', label: 'Fuel Refill', icon: '⛽' },
        { id: 'last_mile', label: 'Last Mile Deliveries', icon: '📍' },
        { id: 'otro', label: 'Other Service', icon: '🧩' },
      ],
      reqStepTitle: "Create and link the service requisition",
      bannerNote: "Single master requisition: the Client Folio / Requisition and Internal Reference captured or generated here will be saved in Request / Requisition → Requisitions Matrix and linked to Operational Services → Matrix. No duplicate requisition is created.",
      form: {
        client: "Client *",
        selectClient: "Select client...",
        clientFolio: "Client Folio / Requisition *",
        generate: "Generate",
        clientFolioHelp: "If the client already provided a folio, enter it manually. If not, generate it and it will share the number in Request / Requisition.",
        internalRef: "Internal Reference",
        internalRefHelp: "Internal tracking reference. It will be saved in the master requisition and propagated to related documents.",
        project: "Project *",
        projectPlaceholder: "Project / installation",
        contract: "Contract / reference",
        requestDate: "Request date *",
        requiredDate: "Required date",
        clientRequester: "Client requester *",
        requesterEmail: "Requester email *",
        place: "Delivery / Service location",
        placePlaceholder: "Yard, terminal, platform, facility...",
        description: "Description / scope of service",
        descriptionPlaceholder: "Describe client needs and initial scope of service.",
        commNote: "Commercial authorization: PO, Service Order, contract, email, portal or emergency can be registered later in the service file."
      },
      buttons: {
        back: "Back",
        continue: "Continue ›",
        createAndContinue: "Create requisition and continue ›",
        successAlert: "Requisition created successfully!"
      }
    },
    matrix: {
      clientSectionTitle: "Services by client → buyer",
      clientSectionSubtitle: "Step 1: select client. Step 2: select buyer linked to requisition/validation. Then the paginated matrix is shown.",
      badge: "2 client(s) • 3 service(s)",
      cards: {
        services: "Services",
        buyers: "Buyers",
        open: "Open",
        withEvidence: "1 with evidence"
      },
      matrixTitle: "Services Matrix",
      matrixSubtitle: "View, filter, edit, and control all services.",
      btnExcel: "Excel/CSV",
      searchPlaceholder: "Search folio, client, project, reference...",
      allServices: "All services",
      allStatuses: "All statuses",
      headers: [
        "FOLIO", "REQUISITION", "INTERNAL REF", "SERVICE", "CLIENT",
        "PROJECT", "DATE", "CLIENT AUTH", "VENDOR PO", "INVOICING",
        "STATUS", "QTY.", "COST", "SALE", "MARGIN", "OWNER", "EVIDENCES", "ACTIONS"
      ],
      emptyText: "No services registered in the matrix for this client."
    },
    reports: {
      bannerTag: "📄 Document Center",
      bannerTitle: "Operational Services Formats and Reports",
      bannerSubtitle: "Generate operational documents, client deliverables, and management analysis with real data registered in Operational Services.",
      filters: {
        from: "From",
        to: "To",
        client: "Client",
        service: "Service",
        status: "Status",
        all: "All"
      },
      subTabs: [
        { id: 'solicitud', label: 'Request Format', subtitle: 'Individual service document', icon: '📋' },
        { id: 'partidas', label: 'By Line Items', subtitle: 'Line by line detail', icon: '📄' },
        { id: 'general', label: 'General', subtitle: 'Operational & financial consolidated', icon: '📊' },
        { id: 'cliente', label: 'Client Facing', subtitle: 'Without internal cost or margin', icon: '🤝' },
        { id: 'gerencial', label: 'Management', subtitle: 'Profitability, risks, and trends', icon: '💼' }
      ],
      reqFormat: {
        selectLabel: "Service request",
        selectPlaceholder: "Select request...",
        btnGenerate: "Generate format",
        btnPrint: "Print",
        emptySelect: "Select a service request to generate its format.",
        docTitle: "SERVICE REQUEST",
        genData: "GENERAL DATA",
        client: "CLIENT",
        project: "PROJECT",
        contract: "CONTRACT / REFERENCE",
        status: "STATUS",
        reqDate: "REQUEST DATE",
        requiredDate: "REQUIRED DATE",
        owner: "RESPONSIBLE",
        qty: "QUANTITY",
        commAuth: "CLIENT COMMERCIAL AUTHORIZATION",
        type: "TYPE",
        ref: "REFERENCE",
        date: "DATE",
        authAmount: "AUTHORIZED AMOUNT",
        validity: "VALIDITY",
        extVendor: "EXTERNAL VENDOR",
        vendorPO: "VENDOR PO",
        srvData: "SPECIFIC SERVICE DATA",
        origin: "ORIGIN",
        dest: "DESTINATION",
        vehType: "VEHICLE TYPE",
        plates: "PLATES",
        operator: "OPERATOR",
        cargo: "CARGO",
        pod: "POD",
        departure: "DEPARTURE",
        arrival: "ARRIVAL",
        scope: "SCOPE / DESCRIPTION",
        ecoControl: "ECONOMIC CONTROL",
        intCost: "Internal cost",
        clientPrice: "Client price",
        margin: "Margin",
        evidences: "Evidences",
        signatures: {
          requested: "Requested / Client",
          owner: "Service Manager",
          acceptance: "Acceptance / Closure"
        },
        footer: "Document generated from Grupo Gerez · Operational Services"
      },
      byItems: {
        title: "LINE ITEM SERVICES REPORT",
        subtitle: "Operational and Financial Detail",
        issueDate: "Issue Date",
        headers: ["Folio", "Service", "Client", "Project", "Date", "Quantity / Scope", "Status", "Cost", "Sale", "Margin"],
        totals: "Consolidated Totals:"
      },
      inDev: "under development."
    }
  }
};

export function OperationalServices({ onNotify, lang = 'es', language, isEnglish }) {
  // Detección automática del idioma recibiendo props desde App
  const isEn = isEnglish || lang === 'en' || language === 'en';
  const currentLang = isEn ? 'en' : 'es';
  const t = TEXTS[currentLang] || TEXTS.es;

  // 1. ESTADOS PRINCIPALES DE NAVEGACIÓN
  const [activeTab, setActiveTab] = useState(1);

  const [formData, setFormData] = useState({
    cliente: '',
    folioCliente: '',
    referenciaInterna: '',
    proyecto: '',
    contrato: '',
    fechaSolicitud: '2026-09-04',
    fechaRequerida: '',
    solicitanteCliente: '',
    correoSolicitante: '',
    lugarPrestacion: '',
    descripcionAlcance: ''
  });

  // Generadores de folio automático
  const handleGenerarFolio = () => {
    const folioAuto = `REQ-${Math.floor(100000000 + Math.random() * 900000000)}`;
    setFormData(prev => ({ ...prev, folioCliente: folioAuto }));
  };

  const handleGenerarReferencia = () => {
    const refAuto = `SRV-TRION-${Math.floor(10000 + Math.random() * 90000)}`;
    setFormData(prev => ({ ...prev, referenciaInterna: refAuto }));
  };

  const exportToCSV = (data = []) => {
    const headers = t.matrix.headers.slice(0, -1); // Excluye acciones de la cabecera CSV

    const rows = data.map(item => [
      `"${item.folio || ''}"`,
      `"${item.requisicion || ''}"`,
      `"${item.referenciaInterna || ''}"`,
      `"${item.servicio || ''}"`,
      `"${item.cliente || ''}"`,
      `"${item.proyecto || ''}"`,
      `"${item.fecha || ''}"`,
      `"${item.autorizacionCliente || ''}"`,
      `"${item.ocProveedor || ''}"`,
      `"${item.facturacion || ''}"`,
      `"${item.estatus || ''}"`,
      `"${item.cantidad || ''}"`,
      `"${item.costo || ''}"`,
      `"${item.venta || ''}"`,
      `"${item.margen || ''}"`,
      `"${item.responsable || ''}"`,
      `"${item.evidencias || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Matriz_de_Servicios_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Estados para el Modal de Nueva Solicitud (Tarjeta 2)
  const [stepModal, setStepModal] = useState(1);
  const [selectedType, setSelectedType] = useState('compra');
  const [selectedService, setSelectedService] = useState('agua');

  // 2. ESTADOS DE FILTROS
  const [periodo, setPeriodo] = useState("Todo el periodo");
  const [cliente, setCliente] = useState("Todos los clientes");
  const [servicio, setServicio] = useState("Todos los servicios");

  // Estados para LA TARJETA 3 (MATRIZ)
  const [selectedClient, setSelectedClient] = useState(null);

  // ESTADOS DE LA TARJETA 4 (REPORTES)
  const [reportSubTab, setReportSubTab] = useState('solicitud'); 
  const [selectedFolio, setSelectedFolio] = useState('');
  const [selectedData, setSelectedData] = useState(null);
  const [repFechaDesde, setRepFechaDesde] = useState('');
  const [repFechaHasta, setRepFechaHasta] = useState('');
  const [repCliente, setRepCliente] = useState('Todos');
  const [repServicio, setRepServicio] = useState('Todos');
  const [repEstatus, setRepEstatus] = useState('All');

  // Base de Datos Mock
  const mockBD = [
    {
      id: "SRV-2026-00001",
      cliente: "Hornbeck Offshore",
      servicio: "Transporte",
      periodo: "Mes actual",
      ingreso: 6500,
      costo: 3500,
      estatus: "Autorizado",
      ejecutado: false,
      facturado: false,
      autComercial: true,
      evidencia: true,
      ocProveedor: false,
      externo: false,
      alerta: null
    },
    {
      id: "SRV-2026-00002",
      cliente: "Hornbeck Offshore",
      servicio: "Gestión Rise X",
      periodo: "Mes actual",
      ingreso: 930,
      costo: 0,
      estatus: "Listo para facturar",
      ejecutado: true,
      facturado: false,
      autComercial: true,
      evidencia: true,
      ocProveedor: false,
      externo: true,
      alerta: "SRV-2026-00002 · requiere proveedor y no tiene OC vinculada"
    },
    {
      id: "SRV-2026-00003",
      cliente: "Hool Energy",
      servicio: "Last Mile Deliveries",
      periodo: "Trimestre actual",
      ingreso: 5000,
      costo: 0,
      estatus: "Autorizado",
      ejecutado: false,
      facturado: false,
      autComercial: true,
      evidencia: false,
      ocProveedor: false,
      externo: false,
      alerta: "SRV-2026-00007 · fecha requerida vencida (2026-09-02)"
    }
  ];

  // Mock Data para Reporte por Partidas
  const [partidasData, setPartidasData] = useState([
    { 
      id: 1, 
      folio: 'SRV-2026-00007', 
      servicio: 'Transporte', 
      cliente: 'HORNBECK OFFSHORE SERVICES DE MEXICO, S. DE R.L. DE C.V.', 
      proyecto: 'TRION', 
      fecha: '2026-09-01', 
      cantidad: '1 servicio de transporte de materiales', 
      estatus: 'Autorizado', 
      costo: 3500, 
      venta: 6500 
    },
    { 
      id: 2, 
      folio: 'SRV-2026-00006', 
      servicio: 'Gestión Rise X', 
      cliente: 'HORNBECK OFFSHORE SERVICES DE MEXICO, S. DE R.L. DE C.V.', 
      proyecto: 'TRION', 
      fecha: '2026-08-28', 
      cantidad: '1 servicio', 
      estatus: 'Autorizado', 
      costo: 0, 
      venta: 930 
    },
    { 
      id: 3, 
      folio: 'SRV-2026-00002', 
      servicio: 'Last Mile Deliveries', 
      cliente: 'HOOL ENERGY DE MEXICO S. DE R.L. DE C.V.', 
      proyecto: 'TRION', 
      fecha: '2026-08-05', 
      cantidad: '1 servicio', 
      estatus: 'Listo para facturar', 
      costo: 0, 
      venta: 5000 
    }
  ]);

  // Totales calculados dinámicamente para el Reporte por Partidas
  const sumCostoPartidas = partidasData.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0);
  const sumVentaPartidas = partidasData.reduce((acc, curr) => acc + (Number(curr.venta) || 0), 0);
  const sumMargenPartidas = sumVentaPartidas - sumCostoPartidas;

  // Mock Data Expandido
  const solicitudesData = {
    'SRV-2026-00001': {
      folio: 'SRV-2026-00001',
      fecha: '2026-09-01',
      cliente: 'Hornbeck Offshore',
      contacto: 'Ing. Carlos Mendoza',
      embarcacion: 'HOS Red Dawn',
      puerto: 'Puerto de Tampico',
      tipoServicio: 'Transporte',
      descripcion: 'Inspección general de sistemas hidráulicos y traslados.',
      prioridad: 'Alta',
      proyecto: 'TRION',
      contrato: '—',
      estatus: 'Autorizado',
      fechaSolicitud: '2026-09-01',
      fechaRequerida: '2026-09-02',
      responsable: 'MIGUEL ABREU',
      cantidad: '1 servicio',
      tipoAuth: 'Correo de autorización',
      estatusAuth: 'Autorizada / recibida',
      refAuth: '—',
      fechaAuth: '2026-09-01',
      montoAuth: '$6,500.00',
      vigenciaAuth: '2026-12-31',
      proveedorExt: 'No',
      ocProveedor: '—',
      origen: 'ISLETA PEREZ',
      destino: 'ESEASA',
      tipoVehiculo: 'PLATAFORMA',
      placas: '97-BN-4L',
      operador: 'SERGIO DE LA CRUZ',
      carga: 'MATERIALES / CONSUMIBLES',
      pod: 'GRU-2026-601',
      salida: '2026-09-02 09:30',
      llegada: '2026-09-02 10:40',
      costoInterno: '$3,500.00',
      precioCliente: '$6,500.00',
      margen: '$3,000.00',
      evidencias: '2'
    },
    'SRV-2026-00002': {
      folio: 'SRV-2026-00002',
      fecha: '2026-09-03',
      cliente: 'Hornbeck Offshore',
      contacto: 'Cap. Roberto Gómez',
      embarcacion: 'HOS Commander',
      puerto: 'Puerto de Altamira',
      tipoServicio: 'Gestión Rise X',
      descripcion: 'Diagnóstico y gestión documental de arribacionales Rise X.',
      prioridad: 'Crítica',
      proyecto: 'TRION',
      contrato: '—',
      estatus: 'Listo para facturar',
      fechaSolicitud: '2026-09-03',
      fechaRequerida: '2026-09-04',
      responsable: 'MIGUEL ABREU',
      cantidad: '1 servicio',
      tipoAuth: 'Correo de autorización',
      estatusAuth: 'Autorizada',
      refAuth: 'REF-88492',
      fechaAuth: '2026-09-03',
      montoAuth: '$930.00',
      vigenciaAuth: '2026-12-31',
      proveedorExt: 'Sí',
      ocProveedor: 'Pendiente',
      origen: 'PUERTO TAMPICO',
      destino: 'HOS COMMANDER',
      tipoVehiculo: 'GESTION',
      placas: 'N/A',
      operador: 'ROBERTO GOMEZ',
      carga: 'GESTION DOCKING',
      pod: 'GRU-2026-602',
      salida: '2026-09-03 08:00',
      llegada: '2026-09-03 12:00',
      costoInterno: '$0.00',
      precioCliente: '$930.00',
      margen: '$930.00',
      evidencias: '1'
    },
    'SRV-2026-00003': {
      folio: 'SRV-2026-00003',
      fecha: '2026-09-05',
      cliente: 'Hool Energy',
      contacto: 'Lic. Ana Laura Peña',
      embarcacion: 'Plataforma Hool-1',
      puerto: 'Sonda de Campeche',
      tipoServicio: 'Last Mile Deliveries',
      descripcion: 'Auditoría, inspección y entrega de salvamento en última milla.',
      prioridad: 'Media',
      proyecto: 'SONDA CAMPECHE',
      contrato: 'HL-2026-09',
      estatus: 'Autorizado',
      fechaSolicitud: '2026-09-05',
      fechaRequerida: '2026-09-06',
      responsable: 'ANA LAURA PEÑA',
      cantidad: '1 servicio',
      tipoAuth: 'Orden de Compra',
      estatusAuth: 'Autorizada',
      refAuth: 'PO-99120',
      fechaAuth: '2026-09-05',
      montoAuth: '$5,000.00',
      vigenciaAuth: '2026-10-31',
      proveedorExt: 'No',
      ocProveedor: '—',
      origen: 'BASE ALTAMIRA',
      destino: 'PLATAFORMA HOOL-1',
      tipoVehiculo: 'EMBARCACION',
      placas: 'N/A',
      operador: 'CARLOS MENDOZA',
      carga: 'EQUIPO DE SALVAMENTO',
      pod: 'GRU-2026-603',
      salida: '2026-09-06 06:00',
      llegada: '2026-09-06 18:00',
      costoInterno: '$0.00',
      precioCliente: '$5,000.00',
      margen: '$5,000.00',
      evidencias: '0'
    }
  };

  // Cálculo de Filtros y Métricas para el Dashboard
  const datosFiltrados = mockBD.filter(item => {
    const matchPeriodo = periodo === "Todo el periodo" || item.periodo === periodo;
    const matchCliente = cliente === "Todos los clientes" || item.cliente === cliente;
    const matchServicio = servicio === "Todos los servicios" || item.servicio === servicio;
    return matchPeriodo && matchCliente && matchServicio;
  });

  const filteredData = partidasData.filter(item => {
    const matchCliente = repCliente === 'Todos' || item.cliente.toLowerCase().includes(repCliente.toLowerCase());
    const matchServicio = repServicio === 'Todos' || item.servicio === repServicio;
    const matchEstatus = repEstatus === 'All' || item.estatus === repEstatus;
    return matchCliente && matchServicio && matchEstatus;
  });

  const totalIngresos = filteredData.reduce((acc, curr) => acc + (Number(curr.venta) || 0), 0);

  const totalServicios = datosFiltrados.length;
  const totalIngresosDashboard = datosFiltrados.reduce((acc, curr) => acc + curr.ingreso, 0);
  const totalCostos = datosFiltrados.reduce((acc, curr) => acc + curr.costo, 0);
  const totalMargen = totalIngresosDashboard - totalCostos;
  const pctMargen = totalIngresosDashboard > 0 ? ((totalMargen / totalIngresosDashboard) * 100).toFixed(1) : 0;

  const estatusAutorizados = datosFiltrados.filter(item => item.estatus === "Autorizado").length;
  const estatusListosFactura = datosFiltrados.filter(item => item.estatus === "Listo para facturar").length;
  const totalEjecutados = datosFiltrados.filter(item => item.ejecutado).length;
  const totalFacturados = datosFiltrados.filter(item => item.facturado).length;
  const pctFacturacion = totalServicios > 0 ? Math.round((totalFacturados / totalServicios) * 100) : 0;

  const autComercialCount = datosFiltrados.filter(item => item.autComercial).length;
  const pctAutComercial = totalServicios > 0 ? Math.round((autComercialCount / totalServicios) * 100) : 0;

  const evidenciaCount = datosFiltrados.filter(item => item.evidencia).length;
  const pctEvidencia = totalServicios > 0 ? Math.round((evidenciaCount / totalServicios) * 100) : 0;

  const ocCount = datosFiltrados.filter(item => item.ocProveedor).length;
  const pctOC = totalServicios > 0 ? Math.round((ocCount / totalServicios) * 100) : 0;

  const ejecucionInterna = datosFiltrados.filter(item => !item.externo).length;
  const conProveedorExterno = datosFiltrados.filter(item => item.externo).length;

  const alertasLista = datosFiltrados.map(item => item.alerta).filter(Boolean);

  const getMetricaPorServicio = (nombreServicio, tipo) => {
    const filtrados = datosFiltrados.filter(i => i.servicio === nombreServicio);
    if (tipo === 'count') return filtrados.length;
    if (tipo === 'ingreso') return filtrados.reduce((acc, c) => acc + c.ingreso, 0);
    if (tipo === 'margen') return filtrados.reduce((acc, c) => acc + (c.ingreso - c.costo), 0);
    return 0;
  };

  const getIngresoPorCliente = (nombreCliente) => {
    return datosFiltrados
      .filter(i => i.cliente === nombreCliente)
      .reduce((acc, c) => acc + c.ingreso, 0);
  };

  // IMPRESIÓN Y PDF
  const handlePrintElement = (elementId, docTitle = 'Reporte Grupo Gerez') => {
    const printElement = document.getElementById(elementId);
    if (!printElement) {
      console.warn(`No se encontró el elemento #${elementId} para imprimir.`);
      return;
    }

    const styleSheets = Array.from(document.styleSheets);
    let stylesHTML = '';
    
    try {
      styleSheets.forEach(sheet => {
        if (sheet.href) {
          stylesHTML += `<link rel="stylesheet" href="${sheet.href}">`;
        } else if (sheet.cssRules) {
          const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('');
          stylesHTML += `<style>${rules}</style>`;
        }
      });
    } catch (e) {
      console.warn("No se pudieron extraer estilos externos:", e);
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${currentLang}">
        <head>
          <meta charset="UTF-8">
          <title>${docTitle}</title>
          ${stylesHTML}
          <style>
            @page {
              size: letter portrait;
              margin: 10mm;
            }
            body {
              background-color: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #${elementId} {
              width: 100% !important;
              max-width: none !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
          </style>
        </head>
        <body>
          <div id="${elementId}">
            ${printElement.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    const logoImg = printWindow.document.querySelector('img');
    const triggerPrint = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 250);
    };

    if (logoImg) {
      if (logoImg.complete) {
        triggerPrint();
      } else {
        logoImg.onload = triggerPrint;
        logoImg.onerror = triggerPrint;
      }
    } else {
      triggerPrint();
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* BANNER PRINCIPAL */}
      <div className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold tracking-wide uppercase border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-300"></span>
            {t.banner.tag}
          </span>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            {t.banner.title}
          </h2>
          <p className="text-xs text-blue-100/90 leading-relaxed">
            {t.banner.subtitle}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 min-w-[280px] w-full md:w-auto text-left shadow-2xs">
          <p className="text-[11px] font-medium text-blue-100">{t.banner.configuredTitle}</p>
          <h3 className="text-lg font-black text-white mt-0.5">{t.banner.configuredDetail}</h3>
          <p className="text-[10px] text-blue-200/80 mt-1 leading-tight font-medium">
            {t.banner.configuredList}
          </p>
        </div>
      </div>

      {/* BARRA DE NAVEGACIÓN */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {t.tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                    : "bg-slate-50/80 hover:bg-slate-100 text-slate-800 border border-slate-100/80"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENEDOR DINÁMICO */}
      <div className="mt-6">
        
        {/* TARJETA 1: DASHBOARD */}
        {activeTab === 1 && (
          <div className="space-y-6 text-left">
            {/* ENCABEZADO Y FILTROS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.dashboard.title}</h3>
                <p className="text-xs text-slate-400">{t.dashboard.subtitle}</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                <select 
                  value={periodo} 
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="Todo el periodo">{t.dashboard.filters.allPeriod}</option>
                  <option value="Mes actual">{t.dashboard.filters.currentMonth}</option>
                  <option value="Trimestre actual">{t.dashboard.filters.currentQuarter}</option>
                  <option value="Año actual">{t.dashboard.filters.currentYear}</option>
                </select>

                <select 
                  value={cliente} 
                  onChange={(e) => setCliente(e.target.value)}
                  className="p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="Todos los clientes">{t.dashboard.filters.allClients}</option>
                  <option value="Hornbeck Offshore">Hornbeck Offshore Services</option>
                  <option value="Hool Energy">Hool Energy de México</option>
                </select>

                <select 
                  value={servicio} 
                  onChange={(e) => setServicio(e.target.value)}
                  className="p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="Todos los servicios">{t.dashboard.filters.allServices}</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Suministro de agua">Suministro de agua</option>
                  <option value="Transporte de personal">Transporte de personal</option>
                  <option value="Gestión Rise X">Gestión Rise X</option>
                  <option value="Servicio de grúa">Servicio de grúa</option>
                  <option value="Montacargas">Montacargas</option>
                  <option value="Recarga de gasolina">Recarga de gasolina</option>
                  <option value="Last Mile Deliveries">Last Mile Deliveries</option>
                </select>
              </div>
            </div>

            {/* KPIS SUPERIORES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-t-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">{totalServicios}</span>
                  <span className="text-sm">📦</span>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">{t.dashboard.kpis.services}</p>
                  <p className="text-[10px] font-extrabold text-blue-600">{t.dashboard.kpis.portfolio}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600 rounded-t-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">{estatusAutorizados}</span>
                  <span className="text-sm">⚙️</span>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">{t.dashboard.kpis.active}</p>
                  <p className="text-[10px] font-extrabold text-purple-600">
                    {totalServicios > 0 ? Math.round((estatusAutorizados / totalServicios) * 100) : 0}% {t.dashboard.kpis.ofTotal}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 rounded-t-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">{totalEjecutados}</span>
                  <span className="text-sm">✅</span>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">{t.dashboard.kpis.executed}</p>
                  <p className="text-[10px] font-extrabold text-emerald-600">
                    {totalServicios > 0 ? Math.round((totalEjecutados / totalServicios) * 100) : 0}% {t.dashboard.kpis.ofTotal}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-teal-500 rounded-t-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">{totalFacturados}</span>
                  <span className="text-sm">🧾</span>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">{t.dashboard.kpis.invoiced}</p>
                  <p className="text-[10px] font-extrabold text-teal-600">
                    {pctFacturacion}% {t.dashboard.kpis.ofTotal}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500 rounded-t-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">${totalIngresos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span className="text-sm">💵</span>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">{t.dashboard.kpis.income}</p>
                  <p className="text-[10px] font-extrabold text-orange-600">{t.dashboard.kpis.accSales}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 rounded-t-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">${totalCostos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span className="text-sm">💳</span>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">{t.dashboard.kpis.costs}</p>
                  <p className="text-[10px] font-extrabold text-amber-600">{t.dashboard.kpis.accCost}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500 rounded-t-2xl"></div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-slate-900">${totalMargen.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span className="text-sm">📈</span>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">{t.dashboard.kpis.margin}</p>
                  <p className="text-[10px] font-extrabold text-rose-600">{pctMargen}% {t.dashboard.kpis.marginPct}</p>
                </div>
              </div>
            </div>

            {/* BARRAS DE CUMPLIMIENTO */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
                <p className="text-[10px] text-slate-400 font-medium">{t.dashboard.bars.commAuth}</p>
                <span className="text-lg font-black text-slate-900">{pctAutComercial}%</span>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pctAutComercial}%` }}></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
                <p className="text-[10px] text-slate-400 font-medium">{t.dashboard.bars.fileEvidence}</p>
                <span className="text-lg font-black text-slate-900">{pctEvidencia}%</span>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${pctEvidencia}%` }}></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
                <p className="text-[10px] text-slate-400 font-medium">{t.dashboard.bars.poServices}</p>
                <span className="text-lg font-black text-slate-900">{pctOC}%</span>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-slate-300 h-1.5 rounded-full" style={{ width: `${pctOC}%` }}></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
                <p className="text-[10px] text-slate-400 font-medium">{t.dashboard.bars.invConversion}</p>
                <span className="text-lg font-black text-slate-900">{pctFacturacion}%</span>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-slate-300 h-1.5 rounded-full" style={{ width: `${pctFacturacion}%` }}></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
                <p className="text-[10px] text-slate-400 font-medium">{t.dashboard.bars.grossMargin}</p>
                <span className="text-lg font-black text-slate-900">{Math.round(pctMargen)}%</span>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${Math.min(pctMargen, 100)}%` }}></div>
                </div>
              </div>
            </div>

            {/* TENDENCIA FINANCIERA Y ESTATUS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>📊</span> {t.dashboard.charts.monthlyTrend}
                    </h4>
                    <p className="text-[11px] text-slate-400">{t.dashboard.charts.monthlySubtitle}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">{t.dashboard.charts.monthsLabel}</span>
                </div>

                <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></span> {t.dashboard.charts.income}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></span> {t.dashboard.charts.costs}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> {t.dashboard.charts.margin}</span>
                </div>

                <div className="h-48 border-b border-slate-200 flex items-end justify-between px-2 pt-6 pb-1">
                  {['Oct 25', 'Nov 25', 'Dic 25', 'Ene 26', 'Feb 26', 'Mar 26', 'Abr 26', 'May 26', 'Jun 26', 'Jul 26'].map((month, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                      <div className="h-32 w-full flex items-end justify-center"></div>
                      <span className="text-[9px] text-slate-400 font-medium">{month}</span>
                    </div>
                  ))}
                  
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className="h-32 w-full flex items-end justify-center gap-1">
                      <div className="w-2 bg-blue-600 rounded-t-sm" style={{ height: `${Math.min((totalIngresos / 15000) * 100, 100)}%` }}></div>
                      <div className="w-2 bg-emerald-500 rounded-t-sm" style={{ height: `${Math.min((totalMargen / 15000) * 100, 100)}%` }}></div>
                    </div>
                    <span className="text-[9px] text-slate-700 font-bold">Ago 26</span>
                  </div>

                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div className="h-32 w-full flex items-end justify-center gap-1">
                      <div className="w-2 bg-blue-600 rounded-t-sm" style={{ height: `${Math.min((totalIngresos / 15000) * 100, 100)}%` }}></div>
                      <div className="w-2 bg-amber-500 rounded-t-sm" style={{ height: `${Math.min((totalCostos / 15000) * 100, 100)}%` }}></div>
                      <div className="w-2 bg-emerald-500 rounded-t-sm" style={{ height: `${Math.min((totalMargen / 15000) * 100, 100)}%` }}></div>
                    </div>
                    <span className="text-[9px] text-slate-700 font-bold">Sep 26</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🎯</span> {t.dashboard.charts.opStatus}
                  </h4>
                  <p className="text-[11px] text-slate-400">{t.dashboard.charts.portfolioDist}</p>
                </div>

                <div className="flex items-center justify-around py-4">
                  <div className="relative w-28 h-28 rounded-full border-8 border-blue-600 border-t-purple-600 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-xl font-black text-slate-900 block leading-none">{totalServicios}</span>
                      <span className="text-[9px] text-slate-400 font-medium">{t.dashboard.charts.servicesUnit}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> {t.dashboard.charts.authorized}</span>
                      <span className="font-bold text-slate-900">{estatusAutorizados}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> {t.dashboard.charts.readyToInvoice}</span>
                      <span className="font-bold text-slate-900">{estatusListosFactura}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SERVICIOS POR TIPO, INGRESOS Y MARGEN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🚚 {t.dashboard.byType.servicesByType}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.byType.volume}</p>
                <div className="h-32 flex items-end justify-around border-b border-slate-100 pb-1">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-slate-700">{getMetricaPorServicio('Transporte', 'count')}</span>
                    <div className="w-6 bg-blue-600 rounded-t-md mx-auto transition-all" style={{ height: `${getMetricaPorServicio('Transporte', 'count') * 30}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Transporte</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-slate-700">{getMetricaPorServicio('Gestión Rise X', 'count')}</span>
                    <div className="w-6 bg-purple-600 rounded-t-md mx-auto transition-all" style={{ height: `${getMetricaPorServicio('Gestión Rise X', 'count') * 30}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Gestión Rise X</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-slate-700">{getMetricaPorServicio('Last Mile Deliveries', 'count')}</span>
                    <div className="w-6 bg-emerald-500 rounded-t-md mx-auto transition-all" style={{ height: `${getMetricaPorServicio('Last Mile Deliveries', 'count') * 30}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Last Mile Deliveries</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">💰 {t.dashboard.byType.incomeByType}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.byType.accSales}</p>
                <div className="h-32 flex items-end justify-around border-b border-slate-100 pb-1">
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getMetricaPorServicio('Transporte', 'ingreso').toLocaleString()}</span>
                    <div className="w-6 bg-blue-600 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getMetricaPorServicio('Transporte', 'ingreso') / 7000) * 80, 80)}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Transporte</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getMetricaPorServicio('Gestión Rise X', 'ingreso').toLocaleString()}</span>
                    <div className="w-6 bg-purple-600 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getMetricaPorServicio('Gestión Rise X', 'ingreso') / 7000) * 80, 80)}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Gestión Rise X</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getMetricaPorServicio('Last Mile Deliveries', 'ingreso').toLocaleString()}</span>
                    <div className="w-6 bg-emerald-500 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getMetricaPorServicio('Last Mile Deliveries', 'ingreso') / 7000) * 80, 80)}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Last Mile Deliveries</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">📈 {t.dashboard.byType.marginByType}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.byType.grossProfit}</p>
                <div className="h-32 flex items-end justify-around border-b border-slate-100 pb-1">
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getMetricaPorServicio('Transporte', 'margen').toLocaleString()}</span>
                    <div className="w-6 bg-blue-600 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getMetricaPorServicio('Transporte', 'margen') / 6000) * 72, 72)}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Transporte</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getMetricaPorServicio('Gestión Rise X', 'margen').toLocaleString()}</span>
                    <div className="w-6 bg-purple-600 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getMetricaPorServicio('Gestión Rise X', 'margen') / 6000) * 72, 72)}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Gestión Rise X</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getMetricaPorServicio('Last Mile Deliveries', 'margen').toLocaleString()}</span>
                    <div className="w-6 bg-emerald-500 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getMetricaPorServicio('Last Mile Deliveries', 'margen') / 6000) * 72, 72)}px` }}></div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Last Mile Deliveries</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TOP CLIENTES, AUTORIZACIÓN Y EMBUDO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🏢 {t.dashboard.topSection.topClients}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.topSection.clientIncome}</p>
                <div className="h-32 flex items-end justify-around border-b border-slate-100 pb-1 pt-4">
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getIngresoPorCliente('Hornbeck Offshore').toLocaleString()}</span>
                    <div className="w-8 bg-blue-600 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getIngresoPorCliente('Hornbeck Offshore') / 8000) * 80, 80)}px` }}></div>
                    <span className="text-[8px] text-slate-500 font-bold mt-1 block max-w-[110px] truncate">HORNBECK OFFSHORE</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-700">${getIngresoPorCliente('Hool Energy').toLocaleString()}</span>
                    <div className="w-8 bg-purple-600 rounded-t-md mx-auto transition-all" style={{ height: `${Math.min((getIngresoPorCliente('Hool Energy') / 8000) * 80, 80)}px` }}></div>
                    <span className="text-[8px] text-slate-500 font-bold mt-1 block max-w-[110px] truncate">HOOL ENERGY</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">✅ {t.dashboard.topSection.commAuthTitle}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.topSection.docControl}</p>
                <div className="flex items-center justify-between py-2">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center font-black text-xs text-slate-900">
                    {pctAutComercial}%
                  </div>
                  <div className="space-y-1 text-[10px] text-slate-600">
                    <div className="flex items-center justify-between gap-3"><span>{t.dashboard.topSection.validAuth}</span><span className="font-bold text-slate-900">{autComercialCount}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>{t.dashboard.topSection.pendingReg}</span><span className="font-bold text-slate-900">0</span></div>
                    <div className="flex items-center justify-between gap-3"><span>{t.dashboard.topSection.rejected}</span><span className="font-bold text-slate-900">0</span></div>
                    <div className="flex items-center justify-between gap-3"><span>{t.dashboard.topSection.withDoc}</span><span className="font-bold text-slate-900">0</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">📄 {t.dashboard.topSection.invFunnel}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.topSection.fromReqToClose}</p>
                <div className="space-y-1.5 pt-1 text-[10px]">
                  <div className="flex items-center justify-between gap-2"><span>{t.dashboard.topSection.requests}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-purple-600 h-full w-full"></div></div><span className="font-bold">{totalServicios}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>{t.dashboard.topSection.authorized}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-blue-600 h-full w-full"></div></div><span className="font-bold">{estatusAutorizados + estatusListosFactura}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>{t.dashboard.topSection.executed}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-purple-500 h-full" style={{ width: `${pctEvidencia}%` }}></div></div><span className="font-bold">{totalEjecutados}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>{t.dashboard.topSection.readyToInvoice}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full" style={{ width: `${totalServicios > 0 ? (estatusListosFactura/totalServicios)*100 : 0}%` }}></div></div><span className="font-bold">{estatusListosFactura}</span></div>
                  <div className="flex items-center justify-between gap-2"><span>{t.dashboard.topSection.invoiced}</span><div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="bg-blue-400 h-full" style={{ width: `${pctFacturacion}%` }}></div></div><span className="font-bold">{totalFacturados}</span></div>
                </div>
              </div>
            </div>

            {/* CONTRATACIÓN EXTERNA, ESTADO OPERATIVO Y ALERTAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🛒 {t.dashboard.externalSec.extContracting}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.externalSec.vendorAndPO}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"><span className="text-lg font-black block text-slate-900">{ejecucionInterna}</span><span className="text-[9px] text-slate-500">{t.dashboard.externalSec.intExecution}</span></div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"><span className="text-lg font-black block text-slate-900">{conProveedorExterno}</span><span className="text-[9px] text-slate-500">{t.dashboard.externalSec.extVendor}</span></div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100"><span className="text-lg font-black block text-slate-900">{ocCount}</span><span className="text-[9px] text-slate-500">{t.dashboard.externalSec.linkedPO}</span></div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/60"><span className="text-lg font-black block text-amber-800">{conProveedorExterno - ocCount}</span><span className="text-[9px] text-amber-700 font-bold">{t.dashboard.externalSec.pendingPO}</span></div>
                </div>
                <div className="pt-1">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>{t.dashboard.externalSec.poCoverage}</span><span className="font-bold">{pctOC}%</span></div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="bg-amber-500 h-full" style={{ width: `${pctOC}%` }}></div></div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">⚙️ {t.dashboard.externalSec.opStatusTitle}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.externalSec.statusCount}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-lg font-black block text-slate-900">{estatusAutorizados}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{t.dashboard.charts.authorized}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-lg font-black block text-slate-900">{estatusListosFactura}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{t.dashboard.charts.readyToInvoice}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">🚨 {t.dashboard.externalSec.alertsTitle}</h4>
                <p className="text-[10px] text-slate-400">{t.dashboard.externalSec.priorityAtt}</p>
                <div className="space-y-1.5 text-[10px]">
                  {alertasLista.length > 0 ? (
                    alertasLista.map((alertaText, idx) => (
                      <div key={idx} className="bg-amber-50 border border-amber-200/80 rounded-xl p-2 text-amber-900 flex items-center gap-1.5 font-medium">
                        <span>⚠️</span> <span>{alertaText}</span>
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-500 text-center font-medium">
                      {t.dashboard.externalSec.noAlerts}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* INDICADORES DE GESTIÓN */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1">📌 {t.dashboard.mgmtKpis.title}</h4>
              <p className="text-[10px] text-slate-400">{t.dashboard.mgmtKpis.subtitle}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">{t.dashboard.mgmtKpis.timeReq}</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">0 {t.dashboard.mgmtKpis.days}</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">{t.dashboard.mgmtKpis.overdueSrv}</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">0</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">{t.dashboard.mgmtKpis.negMargin}</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">0</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">{t.dashboard.mgmtKpis.pendReg}</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">0</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">{t.dashboard.mgmtKpis.withExtVendor}</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">{conProveedorExterno}</span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-medium">{t.dashboard.mgmtKpis.withEvidence}</span>
                  <span className="text-base font-black text-slate-900 mt-1 block">{evidenciaCount}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TARJETA 2: NUEVA SOLICITUD */}
        {activeTab === 2 && (
          <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-6 text-slate-700">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-w-3xl mx-auto">
              
              <div className="flex items-start justify-between p-6 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-slate-800 stroke-[2.5]" />
                    <h2 className="text-xl font-bold text-slate-900">{t.newRequest.title}</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {t.newRequest.subtitle}
                  </p>
                </div>
              </div>

              <div className="px-6 my-4">
                <div className="grid grid-cols-3 gap-3 bg-slate-100/70 p-1.5 rounded-2xl text-xs font-semibold text-center">
                  {t.newRequest.steps.map((st, idx) => (
                    <div 
                      key={idx} 
                      className={`py-2.5 rounded-xl transition-all ${
                        stepModal === idx + 1 
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
                          : 'text-slate-500'
                      }`}
                    >
                      {st}
                    </div>
                  ))}
                </div>
              </div>

              {stepModal === 1 && (
                <div className="p-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setSelectedType('compra')}
                      className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all ${
                        selectedType === 'compra'
                          ? 'border-blue-500 bg-blue-50/20 shadow-sm'
                          : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                      }`}
                    >
                      {selectedType === 'compra' && (
                        <span className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" /> {t.newRequest.types.selected}
                        </span>
                      )}
                      <div className="w-10 h-10 rounded-xl bg-orange-100/80 flex items-center justify-center text-orange-600 mb-3">
                        <Package className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{t.newRequest.types.buyRent}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {t.newRequest.types.buyRentDesc}
                      </p>
                    </div>

                    <div
                      onClick={() => setSelectedType('servicio')}
                      className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all ${
                        selectedType === 'servicio'
                          ? 'border-blue-500 bg-blue-50/20 shadow-sm'
                          : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                      }`}
                    >
                      {selectedType === 'servicio' && (
                        <span className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" /> {t.newRequest.types.selected}
                        </span>
                      )}
                      <div className="w-10 h-10 rounded-xl bg-emerald-100/80 flex items-center justify-center text-emerald-600 mb-3">
                        <Truck className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{t.newRequest.types.service}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {t.newRequest.types.serviceDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setActiveTab(1)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> {t.newRequest.buttons.back}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setStepModal(2)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      {t.newRequest.buttons.continue}
                    </button>
                  </div>
                </div>
              )}

              {stepModal === 2 && (
                <div className="p-6 pt-2">
                  <h4 className="font-bold text-slate-900 text-sm mb-4">{t.newRequest.serviceTypeTitle}</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {t.newRequest.serviceList.map((srv) => {
                      const isSelected = selectedService === srv.id;
                      return (
                        <div
                          key={srv.id}
                          onClick={() => setSelectedService(srv.id)}
                          className={`cursor-pointer rounded-2xl p-4 border transition-all flex items-center gap-3 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/30 shadow-xs'
                              : 'border-slate-200/80 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-lg shadow-2xs border border-slate-100">
                            {srv.icon}
                          </div>
                          <span className="font-bold text-slate-800 text-xs">{srv.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setStepModal(1)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> {t.newRequest.buttons.back}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setStepModal(3)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      {t.newRequest.buttons.continue}
                    </button>
                  </div>
                </div>
              )}

              {stepModal === 3 && (
                <div className="p-6 pt-2 text-left">
                  <h4 className="font-bold text-slate-900 text-sm mb-3">{t.newRequest.reqStepTitle}</h4>

                  <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-r-2xl p-3.5 mb-5 text-[11px] text-slate-600 leading-relaxed">
                    {t.newRequest.bannerNote}
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.client}</label>
                        <select
                          value={formData.cliente}
                          onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                        >
                          <option value="">{t.newRequest.form.selectClient}</option>
                          <option value="Hornbeck Offshore">Hornbeck Offshore Services</option>
                          <option value="Hool Energy">Hool Energy de México</option>
                        </select>
                      </div>

                      <div className="md:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.clientFolio}</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Ej. 1990000141"
                            value={formData.folioCliente}
                            onChange={(e) => setFormData({ ...formData, folioCliente: e.target.value })}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={handleGenerarFolio}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-xs"
                          >
                            <span>⚙️</span> {t.newRequest.form.generate}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                          {t.newRequest.form.clientFolioHelp}
                        </p>
                      </div>

                      <div className="md:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.internalRef}</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Ej. SRV-TRION-"
                            value={formData.referenciaInterna}
                            onChange={(e) => setFormData({ ...formData, referenciaInterna: e.target.value })}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                          />
                          <button
                            type="button"
                            onClick={handleGenerarReferencia}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-xs"
                          >
                            <span>⚙️</span> {t.newRequest.form.generate}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                          {t.newRequest.form.internalRefHelp}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.project}</label>
                        <input
                          type="text"
                          placeholder={t.newRequest.form.projectPlaceholder}
                          value={formData.proyecto}
                          onChange={(e) => setFormData({ ...formData, proyecto: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.contract}</label>
                        <input
                          type="text"
                          placeholder="Contrato"
                          value={formData.contrato}
                          onChange={(e) => setFormData({ ...formData, contrato: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.requestDate}</label>
                        <input
                          type="date"
                          value={formData.fechaSolicitud}
                          onChange={(e) => setFormData({ ...formData, fechaSolicitud: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.requiredDate}</label>
                        <input
                          type="date"
                          value={formData.fechaRequerida}
                          onChange={(e) => setFormData({ ...formData, fechaRequerida: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.clientRequester}</label>
                        <input
                          type="text"
                          placeholder="Nombre de la persona solicitante"
                          value={formData.solicitanteCliente}
                          onChange={(e) => setFormData({ ...formData, solicitanteCliente: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.requesterEmail}</label>
                        <input
                          type="email"
                          placeholder="solicitante@cliente.com"
                          value={formData.correoSolicitante}
                          onChange={(e) => setFormData({ ...formData, correoSolicitante: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                        />
                      </div>

                      <div className="md:col-span-6">
                        <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.place}</label>
                        <input
                          type="text"
                          placeholder={t.newRequest.form.placePlaceholder}
                          value={formData.lugarPrestacion}
                          onChange={(e) => setFormData({ ...formData, lugarPrestacion: e.target.value })}
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">{t.newRequest.form.description}</label>
                      <textarea
                        rows={3}
                        placeholder={t.newRequest.form.descriptionPlaceholder}
                        value={formData.descripcionAlcance}
                        onChange={(e) => setFormData({ ...formData, descripcionAlcance: e.target.value })}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs resize-none"
                      />
                    </div>

                    <div className="bg-blue-50/70 border-l-4 border-blue-600 rounded-r-2xl p-3 text-[11px] text-slate-600">
                      {t.newRequest.form.commNote}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
                    <button 
                      type="button"
                      onClick={() => setStepModal(2)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> {t.newRequest.buttons.back}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        alert(t.newRequest.buttons.successAlert);
                        setActiveTab(1);
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      {t.newRequest.buttons.createAndContinue}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TARJETA 3: MATRIZ DE SERVICIOS CON TARJETAS CLICKABLES */}
        {activeTab === 3 && (
          <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 p-6 text-slate-700">
            
            {/* ENCABEZADO DE SERVICIOS POR CLIENTE */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t.matrix.clientSectionTitle}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t.matrix.clientSectionSubtitle}
                </p>
              </div>
              <div className="bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap border border-blue-100">
                {t.matrix.badge}
              </div>
            </div>

            {/* GRID DE TARJETAS CLICKABLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
              
              {/* Tarjeta 1: HOOL ENERGY */}
              <div 
                onClick={() => setSelectedClient(selectedClient === 'HE' ? null : 'HE')}
                className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-200 group ${
                  selectedClient === 'HE' 
                    ? 'border-blue-500 shadow-md bg-slate-50/30' 
                    : 'border-slate-200 hover:border-blue-300 shadow-sm bg-white'
                }`}
              >
                {/* Borde izquierdo degradado */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 to-purple-600 rounded-l-2xl"></div>
                
                <div className="flex items-center gap-3 mb-4 pl-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                    HE
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900 uppercase leading-tight">
                      HOOL ENERGY DE MEXICO S. DE R.L. DE C.V.
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">TRION</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 pl-2">
                  <div className="border border-slate-100 rounded-xl p-2 text-center bg-slate-50/80">
                    <div className="text-sm font-black text-slate-800">1</div>
                    <div className="text-[9px] text-slate-500 font-medium">{t.matrix.cards.services}</div>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-2 text-center bg-slate-50/80">
                    <div className="text-sm font-black text-slate-800">1</div>
                    <div className="text-[9px] text-slate-500 font-medium">{t.matrix.cards.buyers}</div>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-2 text-center bg-slate-50/80">
                    <div className="text-sm font-black text-slate-800">1</div>
                    <div className="text-[9px] text-slate-500 font-medium">{t.matrix.cards.open}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center pl-2 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-blue-700">{t.matrix.cards.withEvidence}</span>
                  <span className="text-blue-700 font-bold group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* Tarjeta 2: HORNBECK OFFSHORE */}
              <div 
                onClick={() => setSelectedClient(selectedClient === 'HO' ? null : 'HO')}
                className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-200 group ${
                  selectedClient === 'HO' 
                    ? 'border-blue-500 shadow-md bg-slate-50/30' 
                    : 'border-slate-200 hover:border-blue-300 shadow-sm bg-white'
                }`}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 to-purple-600 rounded-l-2xl"></div>
                
                <div className="flex items-center gap-3 mb-4 pl-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                    HO
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900 uppercase leading-tight">
                      HORNBECK OFFSHORE SERVICES DE MEXICO, S. DE R.L. DE C.V.
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">TRION</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 pl-2">
                  <div className="border border-slate-100 rounded-xl p-2 text-center bg-slate-50/80">
                    <div className="text-sm font-black text-slate-800">2</div>
                    <div className="text-[9px] text-slate-500 font-medium">{t.matrix.cards.services}</div>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-2 text-center bg-slate-50/80">
                    <div className="text-sm font-black text-slate-800">2</div>
                    <div className="text-[9px] text-slate-500 font-medium">{t.matrix.cards.buyers}</div>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-2 text-center bg-slate-50/80">
                    <div className="text-sm font-black text-slate-800">2</div>
                    <div className="text-[9px] text-slate-500 font-medium">{t.matrix.cards.open}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center pl-2 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-blue-700">{t.matrix.cards.withEvidence}</span>
                  <span className="text-blue-700 font-bold group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

            </div>

            {/* MATRIZ DE SERVICIOS - SE MUESTRA AL SELECCIONAR UNA TARJETA */}
            {selectedClient && (
              <div className="mt-8 pt-6 border-t border-slate-200/80 animate-in fade-in slide-in-from-top-4 duration-300">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{t.matrix.matrixTitle}</h3>
                    <p className="text-xs text-slate-400">{t.matrix.matrixSubtitle}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => exportToCSV([])}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
                  >
                    <span>↓</span> {t.matrix.btnExcel}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
                  <div className="md:col-span-6">
                    <input 
                      type="text" 
                      placeholder={t.matrix.searchPlaceholder} 
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs">
                      <option>{t.matrix.allServices}</option>
                      <option>Suministro de agua</option>
                      <option>Transporte</option>
                      <option>Transporte de personal</option>
                      <option>Gestión Rise X</option>
                      <option>Servicio de grúa</option>
                      <option>Montacargas</option>
                      <option>Recarga de gasolina</option>
                      <option>Last Mile Deliveries</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <select className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs">
                      <option>{t.matrix.allStatuses}</option>
                      <option>Solicitado</option>
                      <option>Programado</option>
                      <option>En ejecución</option>
                      <option>Pendiente de información</option>
                      <option>Pendiente de aprobación</option>
                      <option>Completado</option>
                      <option>Facturado</option>
                      <option>Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-2xs">
                  <table className="w-full text-[11px] text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-blue-50/50 border-b border-slate-100 text-slate-600 uppercase font-bold tracking-wider text-[10px]">
                        {t.matrix.headers.map((head, idx) => (
                          <th key={idx} className={`p-3 ${idx === t.matrix.headers.length - 1 ? 'text-center' : ''}`}>
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={18} className="p-12 text-center text-slate-400 font-medium">
                          {t.matrix.emptyText}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TARJETA 4: REPORTES */}
        {activeTab === 4 && (
          <div className="space-y-4 text-left">
            
            {/* BANNER REPORTE */}
            <div className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold tracking-wide uppercase border border-white/20">
                  {t.reports.bannerTag}
                </span>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">
                  {t.reports.bannerTitle}
                </h2>
                <p className="text-xs text-blue-100/90 leading-relaxed">
                  {t.reports.bannerSubtitle}
                </p>
              </div>
            </div>

            {/* BARRA DE FILTROS SUPERIOR */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">{t.reports.filters.from}</label>
                  <input
                    type="date"
                    value={repFechaDesde}
                    onChange={(e) => setRepFechaDesde(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">{t.reports.filters.to}</label>
                  <input
                    type="date"
                    value={repFechaHasta}
                    onChange={(e) => setRepFechaHasta(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">{t.reports.filters.client}</label>
                  <select
                    value={repCliente}
                    onChange={(e) => setRepCliente(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">{t.reports.filters.all}</option>
                    <option value="Cliente 1">Cliente 1</option>
                    <option value="Cliente 2">Cliente 2</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">{t.reports.filters.service}</label>
                  <select
                    value={repServicio}
                    onChange={(e) => setRepServicio(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">{t.reports.filters.all}</option>
                    <option value="Suministro de agua">Suministro de agua</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Transporte de personal">Transporte de personal</option>
                    <option value="Gestión Rise X">Gestión Rise X</option>
                    <option value="Servicio de grúa">Servicio de grúa</option>
                    <option value="Montacargas">Montacargas</option>
                    <option value="Recarga de gasolina">Recarga de gasolina</option>
                    <option value="Last Mile Deliveries">Last Mile Deliveries</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">{t.reports.filters.status}</label>
                  <select
                    value={repEstatus}
                    onChange={(e) => setRepEstatus(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Todos">{t.reports.filters.all}</option>
                    <option value="Solicitado">Solicitado</option>
                    <option value="Cotizado">Cotizado</option>
                    <option value="Autorizado">Autorizado</option>
                    <option value="Programado">Programado</option>
                    <option value="En ejecución">En ejecución</option>
                    <option value="Pendiente de información">Pendiente de información</option>
                    <option value="Pendiente de aprobación">Pendiente de aprobación</option>
                    <option value="Completado">Completado</option>
                    <option value="Listo para facturar">Listo para facturar</option>
                    <option value="Facturado">Facturado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SELECCIÓN DE LAS 5 TARJETAS DE TIPO DE REPORTE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {t.reports.subTabs.map((item) => {
                const isSelected = reportSubTab === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setReportSubTab(item.id)}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? "bg-purple-50/60 border-purple-400 ring-2 ring-purple-500/20 shadow-xs"
                        : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="space-y-2">
                      <span className="text-xl block">{item.icon}</span>
                      <h4 className="font-bold text-slate-900 text-xs">{item.label}</h4>
                      <p className="text-[10px] text-slate-400 leading-tight">{item.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CONTENEDOR DINÁMICO DE REPORTES */}
            <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-6 text-slate-700 mt-4">
              
              {/* REPORTE 1: FORMATO DE SOLICITUD */}
              {reportSubTab === 'solicitud' && (
                <div className="space-y-4">
                  
                  {/* REGLA DE IMPRESIÓN CONSERVANDO FORMATO, COLORES Y DISEÑO */}
                  <style>{`
                    @media print {
                      body * {
                        visibility: hidden !important;
                      }
                      #printable-area, #printable-area * {
                        visibility: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      #printable-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        box-shadow: none !important;
                        border: none !important;
                      }
                      @page {
                        margin: 0.8cm;
                        size: portrait;
                      }
                    }
                  `}</style>

                  {/* Selector Superior */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm print:hidden">
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {t.reports.reqFormat.selectLabel}
                    </label>
                    <div className="flex gap-3 items-center">
                      <select
                        value={selectedFolio}
                        onChange={(e) => setSelectedFolio(e.target.value)}
                        className="flex-1 p-2.5 bg-white border border-blue-500 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
                      >
                        <option value="">{t.reports.reqFormat.selectPlaceholder}</option>
                        <option value="SRV-2026-00001">SRV-2026-00001 - Hornbeck Offshore</option>
                        <option value="SRV-2026-00002">SRV-2026-00002 - Hornbeck Offshore</option>
                        <option value="SRV-2026-00003">SRV-2026-00003 - Hool Energy</option>
                      </select>
                      <button
                        onClick={() => {
                          const targetFolio = selectedFolio || Object.keys(solicitudesData)[0];
                          if (targetFolio) {
                            setSelectedFolio(targetFolio);
                            setSelectedData(solicitudesData[targetFolio]);
                          }
                        }}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {t.reports.reqFormat.btnGenerate}
                      </button>
                    </div>
                  </div>

                  {/* Acciones Imprimir / PDF */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex justify-end items-center gap-3 print:hidden">
                    <button
                      onClick={() => window.print()}
                      disabled={!selectedData}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      {t.reports.reqFormat.btnPrint}
                    </button>
                  </div>

                  {/* ÁREA DEL FORMATO IMPRIMIBLE */}
                  <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 print:bg-white print:p-0 print:border-none">
                    {!selectedData ? (
                      <div className="py-12 border border-dashed border-slate-300 rounded-xl text-center bg-white">
                        <p className="text-xs text-slate-500 font-medium">
                          {t.reports.reqFormat.emptySelect}
                        </p>
                      </div>
                    ) : (
                      <div id="printable-area" className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm space-y-5 text-slate-800 print:border-none print:shadow-none print:p-0">
                        
                        {/* Header del Documento con Logo de Grupo Gerez */}
                        <div className="flex justify-between items-start border-b-2 border-slate-200 pb-4">
                          <div className="border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 bg-white shadow-2xs">
                            <img 
                              src="image_923273.svg" 
                              alt="Grupo Gerez Logo" 
                              className="w-10 h-10 object-contain"
                            />
                            <div className="flex flex-col">
                              <span className="font-black text-amber-600 text-sm tracking-tight leading-none uppercase">
                                GRUPO GEREZ
                              </span>
                              <span className="text-[9px] font-bold text-[#1e4a79] tracking-wider leading-tight mt-0.5 uppercase">
                                CUSTOMS & LOGISTICS<br/>WORLDWIDE
                              </span>
                            </div>
                          </div>

                          <div className="text-center">
                            <h2 className="font-bold text-slate-900 text-lg uppercase tracking-wide">
                              {t.reports.reqFormat.docTitle}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">{selectedData.tipoServicio || 'Transporte'}</p>
                          </div>

                          <div className="text-right text-xs space-y-0.5">
                            <p className="font-bold text-slate-900">{selectedData.folio}</p>
                            <p className="text-slate-500">{isEn ? 'Date' : 'Fecha'}: {selectedData.fecha || '2026-09-07'}</p>
                            <p className="font-semibold text-slate-700">GRUPO GEREZ S.A. DE C.V.</p>
                          </div>
                        </div>

                        {/* DATOS GENERALES */}
                        <div>
                          <div className="bg-[#1e4a79] text-white text-[11px] font-bold px-3 py-1.5 uppercase rounded-t mb-2">
                            {t.reports.reqFormat.genData}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.client}</p>
                              <p className="text-xs font-semibold text-slate-800 leading-tight">{selectedData.cliente}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.project}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.proyecto || 'TRION'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.contract}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.contrato || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.status}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.estatus || 'Autorizado'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.reqDate}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.fechaSolicitud || selectedData.fecha}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.requiredDate}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.fechaRequerida || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.owner}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.responsable || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.qty}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.cantidad || '1 servicio'}</p>
                            </div>
                          </div>
                        </div>

                        {/* AUTORIZACIÓN COMERCIAL DEL CLIENTE */}
                        <div>
                          <div className="bg-[#1e4a79] text-white text-[11px] font-bold px-3 py-1.5 uppercase rounded-t mb-2">
                            {t.reports.reqFormat.commAuth}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.type}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.tipoAuth || 'Correo de autorización'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.status}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.estatusAuth || 'Autorizada'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.ref}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.refAuth || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.date}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.fechaAuth || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.authAmount}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.montoAuth || '$0.00'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.validity}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.vigenciaAuth || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.extVendor}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.proveedorExt || 'No'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.vendorPO}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.ocProveedor || '—'}</p>
                            </div>
                          </div>
                        </div>

                        {/* DATOS ESPECÍFICOS DEL SERVICIO */}
                        <div>
                          <div className="bg-[#1e4a79] text-white text-[11px] font-bold px-3 py-1.5 uppercase rounded-t mb-2">
                            {t.reports.reqFormat.srvData}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.origin}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.origen || selectedData.puerto || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.dest}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.destino || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.vehType}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.tipoVehiculo || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.plates}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.placas || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.operator}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.operador || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.cargo}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.carga || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.pod}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.pod || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.departure}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.salida || '—'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-2.5 rounded shadow-2xs col-span-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{t.reports.reqFormat.arrival}</p>
                              <p className="text-xs font-semibold text-slate-800">{selectedData.llegada || '—'}</p>
                            </div>
                          </div>
                        </div>

                        {/* ALCANCE / DESCRIPCIÓN */}
                        <div>
                          <div className="bg-[#1e4a79] text-white text-[11px] font-bold px-3 py-1.5 uppercase rounded-t mb-2">
                            {t.reports.reqFormat.scope}
                          </div>
                          <div className="bg-white border border-slate-200 p-4 rounded shadow-2xs min-h-[60px]">
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                              {selectedData.descripcion || 'Sin descripción disponible'}
                            </p>
                          </div>
                        </div>

                        {/* CONTROL ECONÓMICO */}
                        <div>
                          <div className="bg-[#1e4a79] text-white text-[11px] font-bold px-3 py-1.5 uppercase rounded-t mb-2">
                            {t.reports.reqFormat.ecoControl}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-white border border-slate-200 p-3 rounded shadow-2xs">
                              <p className="text-xs text-slate-500 font-medium">{t.reports.reqFormat.intCost}</p>
                              <p className="text-base font-bold text-slate-900">{selectedData.costoInterno || '$0.00'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-3 rounded shadow-2xs">
                              <p className="text-xs text-slate-500 font-medium">{t.reports.reqFormat.clientPrice}</p>
                              <p className="text-base font-bold text-slate-900">{selectedData.precioCliente || '$0.00'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-3 rounded shadow-2xs">
                              <p className="text-xs text-slate-500 font-medium">{t.reports.reqFormat.margin}</p>
                              <p className="text-base font-bold text-slate-900">{selectedData.margen || '$0.00'}</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-3 rounded shadow-2xs">
                              <p className="text-xs text-slate-500 font-medium">{t.reports.reqFormat.evidences}</p>
                              <p className="text-base font-bold text-slate-900">{selectedData.evidencias || '0'}</p>
                            </div>
                          </div>
                        </div>

                        {/* FIRMAS DE CONFORMIDAD */}
                        <div className="pt-10 grid grid-cols-3 gap-8 text-center text-xs text-slate-600">
                          <div className="border-t border-slate-400 pt-2">
                            <p className="font-medium">{t.reports.reqFormat.signatures.requested}</p>
                          </div>
                          <div className="border-t border-slate-400 pt-2">
                            <p className="font-medium">{t.reports.reqFormat.signatures.owner}</p>
                          </div>
                          <div className="border-t border-slate-400 pt-2">
                            <p className="font-medium">{t.reports.reqFormat.signatures.acceptance}</p>
                          </div>
                        </div>

                        {/* PIE DE PÁGINA */}
                        <div className="pt-4 text-center text-[10px] text-slate-400">
                          {t.reports.reqFormat.footer}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* REPORTE 2: POR PARTIDAS */}
              {reportSubTab === 'partidas' && (
                <div className="space-y-6">
                  {/* BARRA SUPERIOR DE ACCIONES - Se oculta en la impresión */}
                  <div className="flex justify-end gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm print:hidden">
                    <button 
                      onClick={() => window.print()} 
                      className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors print:hidden"
                    >
                      <Printer className="w-4 h-4" /> {t.reports.reqFormat.btnPrint}
                    </button>
                  </div>

                  {/* HOJA IMPRESA/VISUAL DEL REPORTE */}
                  <div id="reporte-partidas-printable" className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6 text-slate-800">
                    
                    {/* ENCABEZADO INSTITUCIONAL CON LOGO GRUPO GEREZ */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                      <div className="border border-slate-300 p-2 w-44 flex items-center justify-center gap-2 rounded-lg bg-white">
                        <img 
                          src="/image_923273.svg" 
                          alt="Logo Grupo Gerez" 
                          className="h-10 w-auto object-contain" 
                        />
                        <div className="text-left leading-tight">
                          <span className="font-black text-amber-600 text-xs block tracking-tight">GRUPO GEREZ</span>
                          <span className="text-[7px] text-slate-500 block uppercase font-medium">Customs & Logistics Worldwide</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <h2 className="text-xl font-black text-slate-900 tracking-wide">{t.reports.byItems.title}</h2>
                        <p className="text-xs text-slate-500">{t.reports.byItems.subtitle}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p className="font-bold text-slate-700">GRUPO GEREZ S.A. DE C.V.</p>
                        <p>{t.reports.byItems.issueDate}: {new Date().toLocaleDateString(currentLang === 'en' ? 'en-US' : 'es-MX')}</p>
                      </div>
                    </div>

                    {/* TABLA DE PARTIDAS */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                            {t.reports.byItems.headers.map((h, i) => (
                              <th key={i} className={`p-2.5 ${i >= 7 ? 'text-right' : ''}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {filteredData.map((item) => {
                            const margenPartida = (Number(item.venta) || 0) - (Number(item.costo) || 0);
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 font-bold text-slate-900">{item.folio}</td>
                                <td className="p-2.5 font-medium">{item.servicio}</td>
                                <td className="p-2.5 max-w-[200px] truncate">{item.cliente}</td>
                                <td className="p-2.5">{item.proyecto}</td>
                                <td className="p-2.5">{item.fecha}</td>
                                <td className="p-2.5 max-w-[220px] truncate">{item.cantidad}</td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {item.estatus}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-medium text-slate-600">${Number(item.costo).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2.5 text-right font-bold text-slate-900">${Number(item.venta).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                <td className="p-2.5 text-right font-bold text-emerald-600">${margenPartida.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-300">
                            <td colSpan={7} className="p-3 text-right uppercase tracking-wider text-[11px]">{t.reports.byItems.totals}</td>
                            <td className="p-3 text-right text-slate-700">${sumCostoPartidas.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-blue-900">${sumVentaPartidas.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right text-emerald-700">${sumMargenPartidas.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* REPORTE 3: GENERAL */}
              {reportSubTab === 'general' && (
                <div className="py-12 text-center text-slate-400 font-medium">
                  {isEn ? "General Consolidated Report under development." : "Reporte General Consolidado en desarrollo."}
                </div>
              )}

              {/* REPORTE 4: HACIA EL CLIENTE */}
              {reportSubTab === 'cliente' && (
                <div className="py-12 text-center text-slate-400 font-medium">
                  {isEn ? "Client-Facing Report under development." : "Reporte Hacia el Cliente en desarrollo."}
                </div>
              )}

              {/* REPORTE 5: GERENCIAL */}
              {reportSubTab === 'gerencial' && (
                <div className="py-12 text-center text-slate-400 font-medium">
                  {isEn ? "Management Report under development." : "Reporte Gerencial en desarrollo."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}