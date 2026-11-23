import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { ServiceMatrix } from './services/ServiceMatrix.jsx';
import { ServiceReports } from './services/ServiceReports.jsx';
import { NewServiceRequest } from './services/NewServiceRequest.jsx';
import { ServiceForm } from './services/ServiceForm.jsx';
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

export function OperationalServices({ onNotify, onNavigate, lang = 'es', language, isEnglish }) {
  // Detección automática del idioma recibiendo props desde App
  const isEn = isEnglish || lang === 'en' || language === 'en';
  const currentLang = isEn ? 'en' : 'es';
  const t = TEXTS[currentLang] || TEXTS.es;

  // 1. ESTADOS PRINCIPALES DE NAVEGACIÓN
  const [activeTab, setActiveTab] = useState(1);

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

  // Sección 2 "+ Nueva solicitud": modal del original (NewServiceRequest), sobre la sección activa.
  const [newOpen, setNewOpen] = useState(false);
  // Formulario "Nuevo servicio" (sección interna 5) con la requisición validada en el paso 3.
  const [serviceDraft, setServiceDraft] = useState(null);

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
            const isActive = newOpen ? tab.id === 2 : activeTab === tab.id || (activeTab === 5 && tab.id === 2);
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`services-tab-${tab.id}`}
                onClick={() => (tab.id === 2 ? setNewOpen(true) : setActiveTab(tab.id))}
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

      {/* Aviso propio del módulo: solo la sección Matriz está conectada a MariaDB */}
      <div data-testid="services-notice" className={`rounded-xl border px-4 py-3 flex items-start gap-2 text-[11px] ${[3, 4, 5].includes(activeTab) ? 'border-amber-200 bg-amber-50/70 text-amber-900' : 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'}`}>
        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{activeTab === 5
          ? (isEn ? 'New service file with real MariaDB data (read-only): types, clients, suppliers and their current POs. "Save service" validates the capture but does not store it, and files are not uploaded: creating services is an operational write blocked until authorized.' : 'Nuevo servicio con datos reales de MariaDB (solo lectura): tipos, clientes, proveedores y sus OC vigentes. "Guardar servicio" valida la captura pero no la almacena y los archivos no se suben: el alta de servicios es una escritura operativa bloqueada hasta su autorización.')
          : activeTab === 4
          ? (isEn ? 'Formats and reports with real MariaDB data (read-only): service request format, by line, general, for the client (without internal cost or margin) and management. They are generated in the browser (preview, print, PDF and data export) and nothing is stored.' : 'Formatos y reportes con datos reales de MariaDB (solo lectura): formato de solicitud, por partidas, general, hacia el cliente (sin costo interno ni margen) y gerencial. Se generan en el navegador (vista previa, impresión, PDF y exportación) y no se guarda nada.')
          : activeTab === 3
          ? (isEn ? 'Services matrix connected to MariaDB (read-only): services, clients, buyers, authorizations, supplier POs, billing, amounts and evidence are real data. Editing and deleting services validate the capture but do not store it: they are operational writes blocked until authorized.' : 'Matriz de servicios conectada a MariaDB (solo lectura): servicios, clientes, compradores, autorizaciones, OC de proveedor, facturación, importes y evidencias son datos reales. Editar y eliminar servicios validan la captura pero no la almacenan: son escrituras operativas bloqueadas hasta su autorización.')
          : (isEn ? 'Section pending integration: it may show demo data and its forms do not save operations in MariaDB.' : 'Sección pendiente de integración: puede mostrar datos de demostración y sus formularios no guardan operaciones en MariaDB.')}</span>
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
        {/* TARJETA 3: MATRIZ DE SERVICIOS CON TARJETAS CLICKABLES */}
        {activeTab === 3 && (
          <ServiceMatrix en={isEn} notify={(title, message, kind) => onNotify && onNotify(title, message, kind)} />
        )}

        {/* TARJETA 4: REPORTES */}
        {activeTab === 4 && (
          <ServiceReports en={isEn} notify={(title, message, kind) => onNotify && onNotify(title, message, kind)} />
        )}

        {/* NUEVO SERVICIO: expediente operativo al que redirige "Crear requisición y continuar" */}
        {activeTab === 5 && serviceDraft && (
          <ServiceForm key={serviceDraft.key} draft={serviceDraft} en={isEn} notify={(title, message, kind) => onNotify && onNotify(title, message, kind)} onNavigate={onNavigate} />
        )}
      </div>

      {/* SECCIÓN 2: + NUEVA SOLICITUD (modal de 3 pasos; valida con datos de MariaDB y no crea registros) */}
      <NewServiceRequest
        open={newOpen}
        onClose={() => setNewOpen(false)}
        en={isEn}
        notify={(title, message, kind) => onNotify && onNotify(title, message, kind)}
        onNavigate={onNavigate}
        onComplete={d => { setServiceDraft({ ...d, key: Date.now() }); setActiveTab(5); }}
      />
    </div>
  );
}