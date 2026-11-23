import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { ServiceMatrix } from './services/ServiceMatrix.jsx';
import { ServiceReports } from './services/ServiceReports.jsx';
import { NewServiceRequest } from './services/NewServiceRequest.jsx';
import { ServiceForm } from './services/ServiceForm.jsx';
import { ServiceDashboard } from './services/ServiceDashboard.jsx';
import { serviceRequestCatalog } from './services/api';
import { useLoad } from './reception/useLoad.js';
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
      configuredTitle: "Servicios configurados"
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
      configuredTitle: "Configured Services"
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
  // Encabezado "Servicios configurados": tipos activos reales de service_types (solo lectura).
  const typesLoad = useLoad(signal => serviceRequestCatalog(signal), []);
  const activeTypes = (typesLoad.data?.service_types || []).filter(x => x.active).map(x => x.name);
  const configuredDetail = typesLoad.status === 'ready' ? (isEn ? `${activeTypes.length} active type(s)` : `${activeTypes.length} tipo(s) activo(s)`) : typesLoad.status === 'error' ? (isEn ? 'Not available' : 'No disponible') : '…';
  const configuredList = typesLoad.status === 'ready' ? (activeTypes.join(' · ') || (isEn ? 'No active types in MariaDB' : 'Sin tipos activos en MariaDB')) : '';

  // Sección 2 "+ Nueva solicitud": modal del original (NewServiceRequest), sobre la sección activa.
  const [newOpen, setNewOpen] = useState(false);
  // Formulario "Nuevo servicio" (sección interna 5) con la requisición validada en el paso 3.
  const [serviceDraft, setServiceDraft] = useState(null);

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
          <h3 data-testid="services-types-count" className="text-lg font-black text-white mt-0.5">{configuredDetail}</h3>
          <p data-testid="services-types-list" className="text-[10px] text-blue-200/80 mt-1 leading-tight font-medium">
            {configuredList}
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
      <div data-testid="services-notice" className={`rounded-xl border px-4 py-3 flex items-start gap-2 text-[11px] ${[1, 3, 4, 5].includes(activeTab) ? 'border-amber-200 bg-amber-50/70 text-amber-900' : 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'}`}>
        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{activeTab === 5
          ? (isEn ? 'New service file with real MariaDB data (read-only): types, clients, suppliers and their current POs. "Save service" validates the capture but does not store it, and files are not uploaded: creating services is an operational write blocked until authorized.' : 'Nuevo servicio con datos reales de MariaDB (solo lectura): tipos, clientes, proveedores y sus OC vigentes. "Guardar servicio" valida la captura pero no la almacena y los archivos no se suben: el alta de servicios es una escritura operativa bloqueada hasta su autorización.')
          : activeTab === 4
          ? (isEn ? 'Formats and reports with real MariaDB data (read-only): service request format, by line, general, for the client (without internal cost or margin) and management. They are generated in the browser (preview, print, PDF and data export) and nothing is stored.' : 'Formatos y reportes con datos reales de MariaDB (solo lectura): formato de solicitud, por partidas, general, hacia el cliente (sin costo interno ni margen) y gerencial. Se generan en el navegador (vista previa, impresión, PDF y exportación) y no se guarda nada.')
          : activeTab === 3
          ? (isEn ? 'Services matrix connected to MariaDB (read-only): services, clients, buyers, authorizations, supplier POs, billing, amounts and evidence are real data. Editing and deleting services validate the capture but do not store it: they are operational writes blocked until authorized.' : 'Matriz de servicios conectada a MariaDB (solo lectura): servicios, clientes, compradores, autorizaciones, OC de proveedor, facturación, importes y evidencias son datos reales. Editar y eliminar servicios validan la captura pero no la almacenan: son escrituras operativas bloqueadas hasta su autorización.')
          : activeTab === 1
          ? (isEn ? 'Executive dashboard connected to MariaDB (read-only): every indicator is computed from the real services of the matrix (service_orders with authorization, supplier PO, invoices and evidence); the period filter uses the request date. Nothing is stored.' : 'Panel ejecutivo conectado a MariaDB (solo lectura): todos los indicadores se calculan con los servicios reales de la Matriz (service_orders con autorización, OC de proveedor, facturas y evidencias); el periodo usa la fecha de solicitud. No se guarda nada.')
          : (isEn ? 'Section pending integration: it may show demo data and its forms do not save operations in MariaDB.' : 'Sección pendiente de integración: puede mostrar datos de demostración y sus formularios no guardan operaciones en MariaDB.')}</span>
      </div>

      {/* CONTENEDOR DINÁMICO */}
      <div className="mt-6">
        
        {/* TARJETA 1: DASHBOARD (panel ejecutivo conectado a MariaDB en modo lectura) */}
        {activeTab === 1 && <ServiceDashboard en={isEn} t={t.dashboard} />}

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