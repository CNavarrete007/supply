import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Layers, 
  Table as TableIcon, 
  Brain, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Building2, 
  Users, 
  ArrowRight,
  Filter
} from 'lucide-react';

// Diccionario de Traducciones (Español / Inglés)
const translations = {
  es: {
    mainTitle: "Gestión del Contratista",
    mainSubtitle: "Evaluación, expedientes y control operativo de contratistas.",
    tabs: {
      register: { title: "Registro de validación", desc: "Captura la revisión técnica, contractual y presupuestal.", emoji: "📝" },
      strategy: { title: "Estrategia y lotificación", desc: "Agrupa partidas y asigna proveedores por lote.", emoji: "🧩" },
      matrix: { title: "Matriz de validaciones", desc: "Consulta, edita y da seguimiento a las validaciones internas.", emoji: "📋" },
      compliance: { title: "Reglas inteligentes", desc: "Visualiza bloqueos y requisiciones listas para cotizar.", emoji: "🧠" },
    },
    registerTab: {
      title: "Gestión interna del contratista",
      subtitle: "Este es el paso intermedio antes de cotizar y emitir la orden de compra.",
      stepBadge: "Paso 2 · Validación interna",
      requisition: "Requisición",
      select: "Seleccionar",
      internalFolio: "Folio interno",
      automatic: "Automático",
      internalRef: "Referencia interna",
      autoFromReq: "Automática desde la requisición",
      buyer: "Responsable de compras",
      selectBuyer: "Selecciona responsable...",
      buyerHelp: "Personal del contratista activo registrado en Contratista → Personal / contactos.",
      technicalVal: "Validación técnica",
      contractualVal: "Validación contractual",
      budgetAvailability: "Disponibilidad presupuestal",
      purchaseStrategy: "Estrategia de compra",
      minQuotations: "Número mínimo de cotizaciones",
      deadline: "Fecha límite de cotización",
      evalCriteria: "Criterios de evaluación",
      evalCriteriaDefault: "Precio, plazo, calidad, cumplimiento documental",
      observations: "Observaciones internas / justificación",
      btnSave: "Guardar validación",
      btnClear: "Limpiar",
      btnViewMatrix: "Ver matriz",
      statuses: {
        pending: "Pendiente",
        approved: "Aprobado",
        compliant: "Conforme",
        withObs: "Con observaciones",
        nonCompliant: "No conforme",
        inOrder: "En Regla",
        available: "Disponible",
        partial: "Parcial",
        notAvailable: "No disponible",
        withinBudget: "Dentro de Presupuesto",
        exceeded: "Excedido (+5%)",
        underReview: "En Revisión",
        validated: "Validado",
        blocked: "Bloqueado",
        reviewRequired: "Revisión Requerida"
      },
      strategies: {
        openComp: "Competencia abierta",
        preferredSupp: "Proveedor preferente",
        urgent: "Compra urgente",
        soleSource: "Fuente única justificada"
      }
    },
    strategyTab: {
      title: "Estrategia y lotificación de abastecimiento",
      subtitle: "Una sola requisición puede generar varios lotes, varias RFQ y varias órdenes de compra sin duplicar la solicitud del cliente.",
      stepBadge: "Paso 3 · Abastecimiento por partida",
      stepper: ["Solicitud", "Validación", "Lotificación", "RFQ por lote", "Comparativo"],
      validatedReq: "Requisición validada",
      selectReq: "Seleccionar requisición...",
      assignedResp: "RESPONSABLE ASIGNADO",
      genMinQuotations: "Mínimo general de cotizaciones",
      noReqWarning: "Selecciona una requisición validada para definir la estrategia por partida.",
      metrics: {
        items: "Partidas",
        lots: "Lotes",
        suppliers: "Proveedores",
        noRfq: "Sin RFQ",
        pendingRfq: "RFQ Pendientes"
      },
      btnAutoGroup: "Agrupar automáticamente por categoría",
      btnNewLot: "Nuevo lote",
      sec1Title: "1. Estrategia por partida",
      sec1Sub: "Cada artículo puede seguir una ruta distinta aunque pertenezca a la misma requisición.",
      tableCols: ["#", "Descripción", "Categoría", "Estrategia", "Lote", "Ruta"],
      sec2Notice: "Catálogo de proveedores: Cada lote recibe únicamente las partidas que le corresponden y puede enviarse a proveedores distintos.",
      rfqCount: "0/0 RFQ creadas",
      noItemsAssigned: "Sin partidas asignadas",
      partidas: "partidas",
      requireRfq: "requieren RFQ",
      suggestedByCat: "✨ Sugerido por catálogo · Autorizado",
      addOtherSupplier: "Agregar otro proveedor...",
      btnAdd: "Agregar",
      btnOpenNextRfq: "Abrir siguiente RFQ",
      noMatchCat: "No hubo coincidencia automática por categoría/suministro. Usa el selector inferior para asignar un proveedor.",
      btnSaveStrategy: "Guardar estrategia",
      btnSaveNextRfq: "Guardar y abrir siguiente RFQ →",
      btnViewValidations: "Ver validaciones"
    },
    matrixTab: {
      title: "Matriz de validaciones internas",
      subtitle: "Consulta si cada requisición puede o no pasar a cotización.",
      btnNewValidation: "+ Nueva validación",
      searchPlaceholder: "Buscar por folio, requisición, referencia o responsable...",
      tableCols: ["Folio interno", "Requisición", "Referencia interna", "Responsable", "Técnica", "Contractual", "Presupuesto", "Estrategia", "¿Puede cotizar?", "Acciones"],
      emptyTitle: "Sin validaciones registradas",
      emptySub: 'Haz clic en "+ Nueva validación" para dar de alta un registro en el sistema.',
      yes: "Sí",
      noBlocked: "No (Bloqueado)",
      viewDetail: "Ver detalle"
    },
    complianceTab: {
      title: "Reglas inteligentes",
      subtitle: "Validaciones previas antes de avanzar a la etapa de cotización.",
      btnViewValidations: "Ver validaciones",
      noValReqs: "requisiciones sin validación.",
      blockedVals: "validaciones con bloqueo.",
      readyToQuote: "requisiciones listas para cotizar.",
      footerNote: "Para avanzar, las validaciones técnica y contractual deben ser conformes o con observaciones aceptables, y el presupuesto debe estar disponible o parcialmente disponible."
    },
    notifs: {
      lotStratTitle: "Estrategia de Lotes",
      groupedMsg: "Partidas agrupadas por categoría correctamente.",
      lotCreatedTitle: "Lote Creado",
      lotCreatedMsg: "Se creó el {title} correctamente.",
      navTitle: "Gestión del Contratista",
      navMsg: "Navegando a: {title}",
      valSavedTitle: "Validación Guardada",
      valSavedMsg: "Evaluación registrada con éxito para el folio {folio}",
      stratSavedTitle: "Estrategia Guardada",
      stratSavedMsg: "Estrategia de lotificación actualizada para {req}"
    }
  },
  en: {
    mainTitle: "Contractor Management",
    mainSubtitle: "Evaluation, documentation, and operational control of contractors.",
    tabs: {
      register: { title: "Validation Register", desc: "Capture technical, contractual, and budgetary reviews.", emoji: "📝" },
      strategy: { title: "Strategy & Lotting", desc: "Group items and assign suppliers per lot.", emoji: "🧩" },
      matrix: { title: "Validation Matrix", desc: "View, edit, and track internal validations.", emoji: "📋" },
      compliance: { title: "Smart Rules", desc: "View bottlenecks and requisitions ready for quoting.", emoji: "🧠" },
    },
    registerTab: {
      title: "Internal Contractor Management",
      subtitle: "This is the intermediate step before quoting and issuing the purchase order.",
      stepBadge: "Step 2 · Internal validation",
      requisition: "Requisition",
      select: "Select",
      internalFolio: "Internal Folio",
      automatic: "Automatic",
      internalRef: "Internal Reference",
      autoFromReq: "Automatic from requisition",
      buyer: "Purchasing Manager",
      selectBuyer: "Select manager...",
      buyerHelp: "Active contractor staff registered in Contractor → Staff / Contacts.",
      technicalVal: "Technical validation",
      contractualVal: "Contractual validation",
      budgetAvailability: "Budget availability",
      purchaseStrategy: "Purchasing strategy",
      minQuotations: "Minimum number of quotes",
      deadline: "Quotation deadline",
      evalCriteria: "Evaluation criteria",
      evalCriteriaDefault: "Price, timeline, quality, document compliance",
      observations: "Internal observations / Justification",
      btnSave: "Save validation",
      btnClear: "Clear",
      btnViewMatrix: "View matrix",
      statuses: {
        pending: "Pending",
        approved: "Approved",
        compliant: "Compliant",
        withObs: "With observations",
        nonCompliant: "Non-compliant",
        inOrder: "In Order",
        available: "Available",
        partial: "Partial",
        notAvailable: "Not available",
        withinBudget: "Within Budget",
        exceeded: "Exceeded (+5%)",
        underReview: "Under Review",
        validated: "Validated",
        blocked: "Blocked",
        reviewRequired: "Review Required"
      },
      strategies: {
        openComp: "Open competition",
        preferredSupp: "Preferred supplier",
        urgent: "Urgent purchase",
        soleSource: "Justified sole source"
      }
    },
    strategyTab: {
      title: "Sourcing Strategy & Lotting",
      subtitle: "A single requisition can generate multiple lots, RFQs, and purchase orders without duplicating client requests.",
      stepBadge: "Step 3 · Sourcing per item",
      stepper: ["Request", "Validation", "Lotting", "RFQ per Lot", "Comparison"],
      validatedReq: "Validated requisition",
      selectReq: "Select requisition...",
      assignedResp: "ASSIGNED MANAGER",
      genMinQuotations: "General minimum quotes",
      noReqWarning: "Select a validated requisition to define the strategy per item.",
      metrics: {
        items: "Items",
        lots: "Lots",
        suppliers: "Suppliers",
        noRfq: "No RFQ",
        pendingRfq: "Pending RFQs"
      },
      btnAutoGroup: "Automatically group by category",
      btnNewLot: "New lot",
      sec1Title: "1. Strategy per item",
      sec1Sub: "Each item can follow a different route even if it belongs to the same requisition.",
      tableCols: ["#", "Description", "Category", "Strategy", "Lot", "Route"],
      sec2Notice: "Supplier catalog: Each lot receives only its corresponding items and can be sent to different suppliers.",
      rfqCount: "0/0 RFQs created",
      noItemsAssigned: "No items assigned",
      partidas: "items",
      requireRfq: "require RFQ",
      suggestedByCat: "✨ Catalog suggested · Authorized",
      addOtherSupplier: "Add another supplier...",
      btnAdd: "Add",
      btnOpenNextRfq: "Open next RFQ",
      noMatchCat: "No automatic match by category/supply. Use the selector below to assign a supplier.",
      btnSaveStrategy: "Save strategy",
      btnSaveNextRfq: "Save & open next RFQ →",
      btnViewValidations: "View validations"
    },
    matrixTab: {
      title: "Internal Validation Matrix",
      subtitle: "Check whether each requisition can proceed to quoting.",
      btnNewValidation: "+ New validation",
      searchPlaceholder: "Search by folio, requisition, reference, or manager...",
      tableCols: ["Internal Folio", "Requisition", "Internal Ref", "Manager", "Technical", "Contractual", "Budget", "Strategy", "Can Quote?", "Actions"],
      emptyTitle: "No registered validations",
      emptySub: 'Click on "+ New validation" to register an entry in the system.',
      yes: "Yes",
      noBlocked: "No (Blocked)",
      viewDetail: "View detail"
    },
    complianceTab: {
      title: "Smart Rules",
      subtitle: "Pre-validation before moving to the quoting stage.",
      btnViewValidations: "View validations",
      noValReqs: "requisitions without validation.",
      blockedVals: "validations with blockage.",
      readyToQuote: "requisitions ready for quote.",
      footerNote: "To proceed, technical and contractual validations must be compliant or have acceptable observations, and budget must be available or partially available."
    },
    notifs: {
      lotStratTitle: "Lot Strategy",
      groupedMsg: "Items successfully grouped by category.",
      lotCreatedTitle: "Lot Created",
      lotCreatedMsg: "{title} created successfully.",
      navTitle: "Contractor Management",
      navMsg: "Navigating to: {title}",
      valSavedTitle: "Validation Saved",
      valSavedMsg: "Evaluation successfully registered for folio {folio}",
      stratSavedTitle: "Strategy Saved",
      stratSavedMsg: "Lotting strategy updated for {req}"
    }
  }
};

export const ContractorManagement = ({ quotes = [], onNavigate = () => {}, onNotify, lang = 'es' }) => {
  // Obtención del diccionario actual
  const t = translations[lang] || translations.es;

  const [activeTab, setActiveTab] = useState('register');
  const [selectedReq, setSelectedReq] = useState('REQ-001');
  const [showMatrixTable, setShowMatrixTable] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const handleDeleteValidation = (id) => {
  setValidationsData((prev) => prev.filter((val) => val.id !== id));
};
  // 1. Ejemplo de lista de partidas de la requisición
  const [items, setItems] = useState([
    {
      id: 1,
      description: "Equipo de cómputo / insumo operativo genérico",
      category: "Tecnología y comunicaciones",
      strategy: "Competencia abierta",
      assignedLot: "Tecnología y comunicaciones",
      route: "RFQ por lote",
    },
    {
      id: 2,
      description: "Cascos de seguridad y chalecos",
      category: "EPP y seguridad",
      strategy: "Competencia abierta",
      assignedLot: "EPP y seguridad",
      route: "RFQ por lote",
    },
  ]);

  // 2. Estado para los lotes adicionales creados manualmente
  const [extraLots, setExtraLots] = useState([]);

  // Estados del Formulario de Registro de Validación (Pestaña 1)
  const [validationForm, setValidationForm] = useState({
    contractor: '',
    technicalStatus: 'Aprobado',
    contractualStatus: 'En Regla',
    budgetStatus: 'Dentro de Presupuesto',
    safetyStatus: 'Cumple',
    observations: ''
  });

  // Base de datos local para la matriz de validaciones
  const [validationsData, setValidationsData] = useState([
    {
      id: 'VAL-2026-001',
      reqFolio: 'REQ-001',
      contractor: 'Construcciones y Montajes Electromecánicos S.A.',
      technical: 'Aprobado',
      contractual: 'En Regla',
      budget: 'Dentro de Presupuesto',
      safety: 'Cumple',
      overallStatus: 'Validado'
    },
    {
      id: 'VAL-2026-002',
      reqFolio: 'REQ-002',
      contractor: 'Ingeniería y Soldadura Aplicada S. de R.L.',
      technical: 'Pendiente',
      contractual: 'Auditoría Pendiente',
      budget: 'Excedido (+5%)',
      safety: 'En Revisión',
      overallStatus: 'Bloqueado'
    }
  ]);

  // 3. Lógica para agrupar automáticamente por categoría
  const handleGroupByCategories = () => {
    const uniqueCategories = Array.from(new Set(items.map((item) => item.category)));
    const updatedItems = items.map((item) => ({
      ...item,
      assignedLot: item.category,
    }));
    setItems(updatedItems);

    const existingExtraLotTitles = extraLots.map((l) => l.title);
    const newLotsToCreate = uniqueCategories.filter(
      (cat) => !existingExtraLotTitles.includes(cat)
    );

    const generatedLots = newLotsToCreate.map((catName) => ({
      id: Date.now() + Math.random(),
      title: catName,
      minQuotations: 1,
      isAutoGenerated: true,
    }));

    setExtraLots((prev) => [...prev, ...generatedLots]);

    if (onNotify) {
      onNotify(t.notifs.lotStratTitle, t.notifs.groupedMsg);
    }
  };

  // 4. Cambiar lote de una partida individualmente desde la tabla
  const handleItemLotChange = (itemId, newLotTitle) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, assignedLot: newLotTitle } : item))
    );
  };

  // Función para agregar un nuevo lote
  const handleAddLot = () => {
    const newLotNumber = extraLots.length + 2;
    const lotTitle = lang === 'en' ? `Lot ${newLotNumber}` : `Lote ${newLotNumber}`;
    const newLot = {
      id: Date.now(),
      title: lotTitle,
      minQuotations: 2,
    };
    setExtraLots([...extraLots, newLot]);
    if (onNotify) {
      onNotify(t.notifs.lotCreatedTitle, t.notifs.lotCreatedMsg.replace('{title}', newLot.title));
    }
  };

  const handleTabChange = (tabId, tabTitle) => {
    setActiveTab(tabId);
    if (onNotify) {
      onNotify(t.notifs.navTitle, t.notifs.navMsg.replace('{title}', tabTitle));
    }
  };

  const handleValidationInputChange = (e) => {
    const { name, value } = e.target;
    setValidationForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveValidation = (e) => {
    e.preventDefault();

    const newVal = {
      id: `VAL-2026-00${validationsData.length + 1}`,
      reqFolio: selectedReq || 'REQ-001',
      contractor: validationForm.contractor || 'Responsable Registrado',
      technical: validationForm.technicalStatus,
      contractual: validationForm.contractualStatus,
      budget: validationForm.budgetStatus,
      safety: validationForm.safetyStatus,
      overallStatus: validationForm.technicalStatus === 'Conforme' || validationForm.technicalStatus === 'Aprobado' ? 'Validado' : 'Revisión Requerida'
    };

    setValidationsData((prev) => [...prev, newVal]);

    if (onNotify) {
      onNotify(t.notifs.valSavedTitle, t.notifs.valSavedMsg.replace('{folio}', newVal.reqFolio));
    }

    setValidationForm({
      contractor: '',
      technicalStatus: 'Aprobado',
      contractualStatus: 'En Regla',
      budgetStatus: 'Dentro de Presupuesto',
      safetyStatus: 'Cumple',
      observations: ''
    });
  };

  const handleSaveStrategy = () => {
    if (onNotify) {
      onNotify(t.notifs.stratSavedTitle, t.notifs.stratSavedMsg.replace('{req}', selectedReq || 'requisición'));
    }
  };

  const tabs = [
    { id: 'register', ...t.tabs.register },
    { id: 'strategy', ...t.tabs.strategy },
    { id: 'matrix', ...t.tabs.matrix },
    { id: 'compliance', ...t.tabs.compliance },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{t.mainTitle}</h2>
          <p className="text-xs text-slate-500">
            {t.mainSubtitle}
          </p>
        </div>
      </div>

      {/* Grid de Tarjetas Superiores Interactivas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id, tab.title)}
              className={`text-left p-4 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-32 border ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-0.5'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-colors ${
                  isActive
                    ? 'bg-white/20 backdrop-blur-md'
                    : 'bg-blue-50/80 border border-blue-100/50'
                }`}
              >
                <span>{tab.emoji}</span>
              </div>

              <div>
                <h4
                  className={`text-xs font-black tracking-tight mb-0.5 ${
                    isActive ? 'text-white' : 'text-slate-800'
                  }`}
                >
                  {tab.title}
                </h4>
                <p
                  className={`text-[11px] leading-relaxed line-clamp-2 ${
                    isActive ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {tab.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenedor Principal de Vistas */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">

        {/* TARJETA 1: Registro de validación */}
        {activeTab === 'register' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900">{t.registerTab.title}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.registerTab.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-[10px] rounded-full border border-blue-100">
                {t.registerTab.stepBadge}
              </span>
            </div>

            <form onSubmit={handleSaveValidation} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.requisition} <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={selectedReq}
                    onChange={(e) => setSelectedReq(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-blue-400/80 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                  >
                    <option value="Seleccionar">{t.registerTab.select}</option>
                    <option value="REQ-001">REQ-001 · PROYECTO EJEMPLO GENERAL</option>
                    <option value="REQ-002">REQ-002 · MANTENIMIENTO PLANTA</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.internalFolio}</label>
                  <input
                    type="text"
                    disabled
                    placeholder={t.registerTab.automatic}
                    className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-500 outline-none shadow-2xs cursor-not-allowed placeholder:text-slate-400 font-medium"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.internalRef}</label>
                  <input
                    type="text"
                    disabled
                    defaultValue={t.registerTab.autoFromReq}
                    className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-500 font-bold outline-none shadow-2xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.buyer} <span className="text-red-500">*</span>
                  </label>
                  <select 
                    name="contractor"
                    value={validationForm.contractor}
                    onChange={handleValidationInputChange}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                  >
                    <option value="">{t.registerTab.selectBuyer}</option>
                    <option value="Juan Pérez">Juan Pérez</option>
                    <option value="María Gómez">María Gómez</option>
                  </select>
                  <span className="text-[9.5px] text-slate-400 mt-1 block">
                    {t.registerTab.buyerHelp}
                  </span>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.technicalVal}</label>
                  <select 
                    name="technicalStatus"
                    value={validationForm.technicalStatus}
                    onChange={handleValidationInputChange}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-2xs font-medium"
                  >
                    <option value="Pendiente">{t.registerTab.statuses.pending}</option>
                    <option value="Conforme">{t.registerTab.statuses.compliant}</option>
                    <option value="Con observaciones">{t.registerTab.statuses.withObs}</option>
                    <option value="No conforme">{t.registerTab.statuses.nonCompliant}</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.contractualVal}</label>
                  <select 
                    name="contractualStatus"
                    value={validationForm.contractualStatus}
                    onChange={handleValidationInputChange}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-2xs font-medium"
                  >
                    <option value="Pendiente">{t.registerTab.statuses.pending}</option>
                    <option value="Conforme">{t.registerTab.statuses.compliant}</option>
                    <option value="Con observaciones">{t.registerTab.statuses.withObs}</option>
                    <option value="No conforme">{t.registerTab.statuses.nonCompliant}</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.budgetAvailability}</label>
                  <select 
                    name="budgetStatus"
                    value={validationForm.budgetStatus}
                    onChange={handleValidationInputChange}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-2xs font-medium"
                  >
                    <option value="Pendiente">{t.registerTab.statuses.pending}</option>
                    <option value="Disponible">{t.registerTab.statuses.available}</option>
                    <option value="Parcial">{t.registerTab.statuses.partial}</option>
                    <option value="No disponible">{t.registerTab.statuses.notAvailable}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.purchaseStrategy}</label>
                  <select className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-2xs font-medium">
                    <option value="Competencia abierta">{t.registerTab.strategies.openComp}</option>
                    <option value="Proveedor preferente">{t.registerTab.strategies.preferredSupp}</option>
                    <option value="Compra urgente">{t.registerTab.strategies.urgent}</option>
                    <option value="Fuente única justificada">{t.registerTab.strategies.soleSource}</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.minQuotations}</label>
                  <input
                    type="number"
                    defaultValue={1}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.deadline}</label>
                  <div className="relative">
                    <input
                      type="date"
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.evalCriteria}</label>
                <input
                  type="text"
                  defaultValue={t.registerTab.evalCriteriaDefault}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-500 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.observations}</label>
                <textarea
                  name="observations"
                  value={validationForm.observations}
                  onChange={handleValidationInputChange}
                  rows={3}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs resize-y"
                ></textarea>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:opacity-90 border border-transparent"
                  style={{ backgroundColor: '#a221b7' }}
                >
                  <span className="text-sm">💾</span>
                  <span>{t.registerTab.btnSave}</span>
                </button>

                <button
                  type="reset"
                  onClick={() => setValidationForm({
                    contractor: '',
                    technicalStatus: 'Aprobado',
                    contractualStatus: 'En Regla',
                    budgetStatus: 'Dentro de Presupuesto',
                    safetyStatus: 'Cumple',
                    observations: ''
                  })}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">🪄</span>
                  <span>{t.registerTab.btnClear}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('matrix', t.tabs.matrix.title)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">📋</span>
                  <span>{t.registerTab.btnViewMatrix}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TARJETA 2: Estrategia y lotificación */}
        {activeTab === 'strategy' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>🧩</span> {t.strategyTab.title}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.strategyTab.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 font-bold text-[10px] rounded-full border border-purple-200">
                {t.strategyTab.stepBadge}
              </span>
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-center pt-1">
              {t.strategyTab.stepper.map((stepName, idx) => {
                const isCurrent = idx === 2;
                const isDone = idx < 2;
                return (
                  <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                    isDone 
                      ? 'bg-emerald-50/60 border-emerald-200/80' 
                      : isCurrent 
                      ? 'bg-purple-100/60 border-purple-300' 
                      : 'bg-slate-50/80 border-slate-200/80 opacity-70'
                  }`}>
                    <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                      isDone 
                        ? 'bg-emerald-600 text-white' 
                        : isCurrent 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{stepName}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t.strategyTab.validatedReq} <span className="text-red-500">*</span>
                </label>
                <select 
                  onChange={(e) => setSelectedReq(e.target.value)}
                  value={selectedReq}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-blue-400/80 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 font-medium shadow-2xs"
                >
                  <option value="">{t.strategyTab.selectReq}</option>
                  <option value="REQ-001">REQ-001 · PROYECTO EJEMPLO GENERAL · CONTRATO 12345</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t.registerTab.buyer}
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={Boolean(selectedReq) ? t.strategyTab.assignedResp : ""}
                  className="w-full px-3.5 py-2 text-xs bg-slate-100/80 border border-slate-200 rounded-xl text-slate-600 font-semibold outline-none cursor-not-allowed shadow-2xs"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t.strategyTab.genMinQuotations}
                </label>
                <input
                  type="number"
                  defaultValue={1}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 font-medium shadow-2xs"
                />
              </div>
            </div>

            {!selectedReq && (
              <div className="p-3.5 bg-blue-50/50 border-l-4 border-l-blue-600 border border-blue-100 rounded-xl text-xs text-blue-900 font-medium shadow-2xs mt-2">
                {t.strategyTab.noReqWarning}
              </div>
            )}

            {Boolean(selectedReq) && (
              <div className="space-y-5 pt-1">
                <div className="p-3.5 bg-blue-50/40 border-l-4 border-l-blue-600 border border-blue-100 rounded-xl text-xs text-slate-700 shadow-2xs">
                  <span className="font-extrabold text-slate-900 block text-xs">
                    REQ-001 · PROYECTO EJEMPLO GENERAL
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {items.length} {t.strategyTab.metrics.items.toLowerCase()} · {t.strategyTab.project}: OPERATIVO GENERAL · {t.strategyTab.contract}: 0000000000
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                    <span className="text-lg font-black text-slate-900 block leading-none">{items.length}</span>
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mt-1 block">{t.strategyTab.metrics.items}</span>
                  </div>
                  <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                    <span className="text-lg font-black text-slate-900 block leading-none">{1 + extraLots.length}</span>
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mt-1 block">{t.strategyTab.metrics.lots}</span>
                  </div>
                  <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                    <span className="text-lg font-black text-slate-900 block leading-none">0</span>
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mt-1 block">{t.strategyTab.metrics.suppliers}</span>
                  </div>
                  <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                    <span className="text-lg font-black text-slate-900 block leading-none">0</span>
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mt-1 block">{t.strategyTab.metrics.noRfq}</span>
                  </div>
                  <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
                    <span className="text-lg font-black text-slate-900 block leading-none">0</span>
                    <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase mt-1 block">{t.strategyTab.metrics.pendingRfq}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button 
                    type="button" 
                    onClick={handleGroupByCategories}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>✨</span> {t.strategyTab.btnAutoGroup}
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={handleAddLot}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>+</span> {t.strategyTab.btnNewLot}
                  </button>
                </div>

                <div className="pt-2 space-y-3">
                  <div className="p-3 bg-slate-50/60 border border-slate-200/80 rounded-xl">
                    <h4 className="text-xs font-black text-slate-900">{t.strategyTab.sec1Title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t.strategyTab.sec1Sub}
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200/80">
                          {t.strategyTab.tableCols.map((col, idx) => (
                            <th key={idx} className={`py-2.5 px-3 ${idx === 5 ? 'text-center' : ''}`}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {items.map((item, index) => (
                          <tr key={item.id}>
                            <td className="py-3 px-3 font-bold text-slate-800">{index + 1}</td>
                            <td className="py-3 px-3 font-bold text-slate-800">{item.description}</td>
                            <td className="py-3 px-3 text-slate-500 font-medium">{item.category}</td>
                            <td className="py-3 px-3">
                              <select className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none shadow-2xs">
                                <option>{t.registerTab.strategies.openComp}</option>
                                <option>{t.registerTab.strategies.preferredSupp}</option>
                                <option>{t.registerTab.strategies.soleSource}</option>
                                <option>Precio histórico auto</option>
                                <option>{t.registerTab.strategies.urgent}</option>
                              </select>
                            </td>
                            <td className="py-3 px-3">
                              <select 
                                value={item.assignedLot}
                                onChange={(e) => handleItemLotChange(item.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none shadow-2xs font-semibold"
                              >
                                <option value="EPP y seguridad">EPP y seguridad</option>
                                <option value="Herramientas">Herramientas</option>
                                <option value="Tecnología y comunicaciones">Tecnología y comunicaciones</option>
                                {extraLots.map(lot => (
                                  <option key={lot.id} value={lot.title}>{lot.title}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 font-bold text-[10px] rounded-md border border-blue-100">
                                {item.route}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <div className="p-3 bg-blue-50/40 border-l-4 border-l-blue-600 border border-blue-100 rounded-xl text-xs text-slate-700 shadow-2xs">
                    {t.strategyTab.sec2Notice}
                  </div>

                  <div className="flex flex-wrap gap-4 items-start">
                    {/* Tarjeta de Lote Principal */}
                    {(() => {
                      const assignedItems = items.filter(i => i.assignedLot === "Tecnología y comunicaciones");
                      return (
                        <div className="w-full max-w-sm bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-slate-900">Tecnología y comunicaciones</h5>
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold text-[10px] rounded-full border border-amber-200">
                              {t.strategyTab.rfqCount}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 font-medium">
                            {assignedItems.length > 0 
                              ? assignedItems.map(i => `#${i.id} ${i.description}`).join(', ')
                              : t.strategyTab.noItemsAssigned}
                          </p>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-center">
                              <span className="text-xs font-black text-slate-900 block">{assignedItems.length}</span>
                              <span className="text-[9px] text-slate-400 block font-medium">{t.strategyTab.partidas}</span>
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-center">
                              <span className="text-xs font-black text-slate-900 block">{assignedItems.length}</span>
                              <span className="text-[9px] text-slate-400 block font-medium">{t.strategyTab.requireRfq}</span>
                            </div>
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-center">
                              <span className="text-xs font-black text-slate-900 block">0</span>
                              <span className="text-[9px] text-slate-400 block font-medium">{t.strategyTab.metrics.suppliers.toLowerCase()}</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-1">{t.registerTab.minQuotations}</label>
                            <input
                              type="number"
                              defaultValue={1}
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none font-medium"
                            />
                          </div>

                          <div className="space-y-2 pt-1">
                            <div className="p-2.5 border border-slate-200/80 rounded-xl flex items-start gap-2.5 bg-white shadow-2xs">
                              <input type="checkbox" className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" />
                              <div>
                                <p className="text-xs font-bold text-slate-800 leading-tight">PROVEEDOR SUGERIDO A</p>
                                <span className="text-[9.5px] text-amber-600 font-semibold block mt-0.5">
                                  {t.strategyTab.suggestedByCat}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <select className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-500 shadow-2xs font-medium">
                              <option>{t.strategyTab.addOtherSupplier}</option>
                            </select>
                            <button type="button" className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs">
                              {t.strategyTab.btnAdd}
                            </button>
                          </div>

                          <button type="button" className="w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer">
                            {t.strategyTab.btnOpenNextRfq}
                          </button>
                        </div>
                      );
                    })()}

                    {/* LOTES DINÁMICOS ADICIONALES */}
                    {extraLots.map((lot) => {
                      const lotItems = items.filter(i => i.assignedLot === lot.title);
                      return (
                        <div 
                          key={lot.id} 
                          className="w-full max-w-sm bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                              <span className="text-xs font-black text-slate-900 block leading-tight">
                                {lot.title}
                              </span>
                            </div>
                            <span className="px-2.5 py-1 bg-blue-100/70 text-blue-700 font-bold text-[10px] rounded-full shrink-0">
                              {t.strategyTab.metrics.noRfq}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 font-medium">
                            {lotItems.length > 0 
                              ? lotItems.map(i => `#${i.id} ${i.description}`).join(', ') 
                              : t.strategyTab.noItemsAssigned}
                          </p>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2.5 bg-slate-50/80 border border-slate-100 rounded-xl text-left">
                              <span className="text-xs font-black text-slate-900 block">{lotItems.length}</span>
                              <span className="text-[9px] text-slate-500 block font-medium">{t.strategyTab.partidas}</span>
                            </div>
                            <div className="p-2.5 bg-slate-50/80 border border-slate-100 rounded-xl text-left">
                              <span className="text-xs font-black text-slate-900 block">{lotItems.length}</span>
                              <span className="text-[9px] text-slate-500 block font-medium">{t.strategyTab.requireRfq}</span>
                            </div>
                            <div className="p-2.5 bg-slate-50/80 border border-slate-100 rounded-xl text-left">
                              <span className="text-xs font-black text-slate-900 block">0</span>
                              <span className="text-[9px] text-slate-500 block font-medium">{t.strategyTab.metrics.suppliers.toLowerCase()}</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-800 mb-1">
                              {t.registerTab.minQuotations}
                            </label>
                            <input
                              type="number"
                              defaultValue={lot.minQuotations || 1}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center bg-slate-50/30">
                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                              {t.strategyTab.noMatchCat}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <select className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-700 shadow-2xs font-medium focus:ring-2 focus:ring-blue-500">
                              <option value="">{t.strategyTab.addOtherSupplier}</option>
                            </select>
                            <button 
                              type="button" 
                              className="px-3.5 py-2 bg-slate-100/80 hover:bg-slate-200 text-slate-900 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs"
                            >
                              {t.strategyTab.btnAdd}
                            </button>
                          </div>

                          <div className="pt-0.5">
                            <button 
                              type="button" 
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                            >
                              {t.strategyTab.btnOpenNextRfq}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveStrategy}
                      className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:opacity-90 border border-transparent"
                      style={{ backgroundColor: '#a221b7' }}
                    >
                      <span className="text-sm">💾</span>
                      <span>{t.strategyTab.btnSaveStrategy}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSaveStrategy();
                        onNavigate('quotes');
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-transparent"
                    >
                      <span className="text-sm">💾</span>
                      <span>{t.strategyTab.btnSaveNextRfq}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTabChange('matrix', t.tabs.matrix.title)}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <span className="text-sm">📋</span>
                      <span>{t.strategyTab.btnViewValidations}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

       {/* TARJETA 3: Matriz de validaciones internas */}
{activeTab === 'matrix' && (
  <div className="bg-slate-50 min-h-screen font-sans -m-4 p-4 sm:p-6">
    
    {/* 1. CABECERA PRINCIPAL */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900">{t.matrixTab.title}</h3>
        <p className="text-sm text-slate-500 mt-1">
          {t.matrixTab.subtitle}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => handleTabChange('register', t.tabs.register.title)}
          className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="text-lg leading-none"></span>
          <span>{t.matrixTab.btnNewValidation}</span>
        </button>
      </div>
    </div>

    {/* 2. SECCIÓN DE TARJETAS (FILTROS) */}
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
      <h2 className="text-sm font-bold text-slate-800 mb-1">Validaciones por módulo</h2>
      <p className="text-xs text-slate-500 mb-5">Selecciona "Abrir" en cualquiera de las tarjetas para desplegar su matriz abajo.</p>
      
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder={t.matrixTab.searchPlaceholder}
          className="flex-1 px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-sm placeholder:text-slate-400"
        />
        <div className="bg-blue-50 text-blue-700 border border-blue-100 rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center whitespace-nowrap">
          0 de 0 módulos
        </div>
      </div>

      <div className="flex space-x-4 overflow-x-auto pb-2 items-stretch custom-scrollbar">
        
        {/* TARJETA 1: TODAS LAS VALIDACIONES (AZUL) */}
        <div 
          onClick={() => setActiveCard('all')}
          className={`rounded-xl p-4 w-72 flex-shrink-0 transition-all bg-white flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            activeCard === 'all' 
              ? 'border-2 border-blue-500 shadow-md ring-2 ring-blue-100' 
              : 'border border-slate-200 hover:shadow-md'
          }`}
        >
          {activeCard === 'all' && (
            <div className="absolute inset-0 bg-blue-50 opacity-30 pointer-events-none"></div>
          )}

          <div className="relative z-10">
            <div className="flex items-center mb-4">
              <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xs mr-3">ALL</div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Todas las validaciones</h3>
                <p className="text-xs text-slate-400">0 módulos</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div><p className="font-bold text-lg text-slate-800">0</p><p className="text-[10px] font-semibold text-slate-500 uppercase">Total</p></div>
              <div><p className="font-bold text-lg text-slate-800">0</p><p className="text-[10px] font-semibold text-slate-500 uppercase">Pendientes</p></div>
              <div><p className="font-bold text-lg text-slate-800">0%</p><p className="text-[10px] font-semibold text-slate-500 uppercase">Éxito</p></div>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs mt-2 pt-3 border-t border-slate-100 relative z-10">
            <span className="text-slate-400">Vista completa</span>
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                setActiveCard('all');
              }}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Abrir todas →
            </button>
          </div>
        </div>

        {/* TARJETA 2: MÓDULO ACTUAL (MORADO) */}
        <div 
          onClick={() => setActiveCard('module')}
          className={`rounded-xl p-4 w-72 flex-shrink-0 transition-all bg-white flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            activeCard === 'module' 
              ? 'border-2 border-purple-500 shadow-md ring-2 ring-purple-100' 
              : 'border border-slate-200 hover:shadow-md'
          }`}
        >
          {activeCard === 'module' && (
            <div className="absolute inset-0 bg-purple-50 opacity-30 pointer-events-none"></div>
          )}

          <div className="relative z-10">
            <div className="flex items-center mb-4">
              <div className="bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xs mr-3">MOD</div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Módulo de Contratos</h3>
                <p className="text-xs text-slate-400">ID: 001 · Activo</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div><p className="font-bold text-lg text-slate-800">{validationsData.length}</p><p className="text-[10px] font-semibold text-slate-500 uppercase">Reglas</p></div>
              <div><p className="font-bold text-lg text-slate-800">0</p><p className="text-[10px] font-semibold text-slate-500 uppercase">Fallos</p></div>
              <div><p className="font-bold text-lg text-slate-800">0%</p><p className="text-[10px] font-semibold text-slate-500 uppercase">Avance</p></div>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs mt-2 pt-3 border-t border-slate-100 relative z-10">
            <span className="text-slate-400">{validationsData.length} registros</span>
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                setActiveCard('module');
              }}
              className="text-purple-600 font-bold hover:underline cursor-pointer"
            >
              Módulo actual →
            </button>
          </div>
        </div>

      </div>
    </div>

    {/* 3. MATRIZ DE DATOS */}
    {activeCard !== null && (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6 animate-fade-in">
        
        {/* Cabecera de la tabla */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-base font-black text-slate-800">
              {activeCard === 'all' ? 'Matriz Global de Validaciones' : 'Matriz del Módulo de Contratos'}
            </h2>
            <p className="text-xs text-slate-500">{validationsData.length} registros cargados</p>
          </div>

          <button 
            type="button"
            onClick={() => setActiveCard(null)}
            className="bg-rose-500 hover:bg-rose-600 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200/80">
                {t.matrixTab.tableCols.map((col, idx) => (
                  <th key={idx} className={`py-4 px-4 ${idx >= 4 && idx <= 6 || idx === 8 || idx === 9 ? 'text-center' : ''}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs bg-white">
              {validationsData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <p className="font-semibold text-slate-600 text-sm">{t.matrixTab.emptyTitle}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t.matrixTab.emptySub}
                    </p>
                  </td>
                </tr>
              ) : (
                validationsData.map((val) => (
                  <tr key={val.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-800">{val.id}</td>
                    <td className="py-4 px-4 text-slate-700 font-medium">{val.reqFolio}</td>
                    <td className="py-4 px-4 text-slate-500">REF-{val.reqFolio}</td>
                    <td className="py-4 px-4 text-slate-800 font-medium">{val.contractor}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${val.technical === 'Conforme' || val.technical === 'Aprobado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {val.technical}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${val.contractual === 'En Regla' || val.contractual === 'Conforme' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {val.contractual}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-600 font-medium">{val.budget}</td>
                    <td className="py-4 px-4 text-slate-600 font-medium">{t.registerTab.strategies.openComp}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${val.overallStatus === 'Validado' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {val.overallStatus === 'Validado' ? t.matrixTab.yes : t.matrixTab.noBlocked}
                      </span>
                    </td>
                    
                    {/* COLUMNA DE ACCIONES CON BOTONES EDITAR Y ELIMINAR */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* BOTÓN EDITAR (Píldora gris claro con texto azul/negro) */}
                        <button
                          type="button"
                          onClick={() => handleTabChange('register', t.tabs.register.title)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-[11px] rounded-full transition-colors cursor-pointer tracking-wider"
                        >
                          EDITAR
                        </button>

                        {/* BOTÓN ELIMINAR (Píldora roja con texto blanco) */}
                        <button
                          type="button"
                          onClick={() => handleDeleteValidation(val.id)}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] rounded-full transition-colors cursor-pointer tracking-wider shadow-xs"
                        >
                          ELIMINAR
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
)}
        {/* TARJETA 4: Reglas inteligentes */}
        {activeTab === 'compliance' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900">{t.complianceTab.title}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.complianceTab.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('matrix', t.tabs.matrix.title)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span className="text-sm">📋</span>
                <span>{t.complianceTab.btnViewValidations}</span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div className="p-3.5 bg-amber-50/50 border-l-4 border-l-amber-500 border border-slate-200/60 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 shadow-2xs">
                <span className="font-extrabold text-slate-900">0</span>
                <span>{t.complianceTab.noValReqs}</span>
              </div>

              <div className="p-3.5 bg-rose-50/50 border-l-4 border-l-rose-500 border border-slate-200/60 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 shadow-2xs">
                <span className="font-extrabold text-slate-900">
                  {validationsData.filter(v => v.overallStatus !== 'Validado').length}
                </span>
                <span>{t.complianceTab.blockedVals}</span>
              </div>

              <div className="p-3.5 bg-emerald-50/50 border-l-4 border-l-emerald-500 border border-slate-200/60 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 shadow-2xs">
                <span className="font-extrabold text-slate-900">
                  {validationsData.filter(v => v.overallStatus === 'Validado').length}
                </span>
                <span>{t.complianceTab.readyToQuote}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
              {t.complianceTab.footerNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};