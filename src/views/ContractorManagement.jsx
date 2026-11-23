import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { ValidationRegister } from './contractorMgmt/ValidationRegister.jsx';
import { StrategyLots } from './contractorMgmt/StrategyLots.jsx';
import { ValidationMatrix } from './contractorMgmt/ValidationMatrix.jsx';
import { SmartRules } from './contractorMgmt/SmartRules.jsx';
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
  const [valEdit, setValEdit] = useState(null); // tarjeta 3 → "Editar" abre la tarjeta 1 en modo edición
  const [startReq, setStartReq] = useState(null); // tarjeta 4 → Validar / Estrategia preseleccionan la requisición
  const handleTabChange = (tabId, tabTitle) => {
    setActiveTab(tabId);
    if (onNotify) {
      onNotify(t.notifs.navTitle, t.notifs.navMsg.replace('{title}', tabTitle));
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
              onClick={() => { setStartReq(null); handleTabChange(tab.id, tab.title); }}
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

      {/* Aviso propio del módulo: solo la tarjeta 1 está conectada a MariaDB */}
      <div data-testid="contractor-mgmt-notice" className={`rounded-xl border px-4 py-3 flex items-start gap-2 text-[11px] ${['register', 'strategy', 'matrix', 'compliance'].includes(activeTab) ? 'border-amber-200 bg-amber-50/70 text-amber-900' : 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'}`}>
        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{activeTab === 'register'
          ? (lang === 'en' ? 'Validation register connected to MariaDB (read-only): requisitions, purchasing managers and recorded validations are real data. Saving validates the capture but does not store it: recording internal validations is a write blocked until authorized.' : 'Registro de validación conectado a MariaDB (solo lectura): requisiciones, responsables de compras y validaciones registradas son datos reales. Guardar valida la captura pero no la almacena: registrar validaciones internas es una escritura bloqueada hasta su autorización.')
          : activeTab === 'compliance'
          ? (lang === 'en' ? 'Smart rules connected to MariaDB (read-only): requisitions without validation, current validations with a block and requisitions ready to quote are computed from the real validations.' : 'Reglas inteligentes conectadas a MariaDB (solo lectura): requisiciones sin validación, validaciones vigentes con bloqueo y requisiciones listas para cotizar se calculan con las validaciones reales.')
          : activeTab === 'matrix'
          ? (lang === 'en' ? 'Validation matrix connected to MariaDB (read-only): every internal validation with its requisition, manager, results and the "can quote" verdict. Editing, deleting and recording the cost source validate the capture but do not store it: they are writes blocked until authorized.' : 'Matriz de validaciones conectada a MariaDB (solo lectura): cada validación interna con su requisición, responsable, resultados y "¿puede cotizar?". Editar, eliminar y registrar la fuente de costo validan la captura pero no la almacenan: son escrituras bloqueadas hasta su autorización.')
          : activeTab === 'strategy'
          ? (lang === 'en' ? 'Strategy and lotting connected to MariaDB (read-only): validated requisitions, lines, recorded lot plan, RFQs per lot and the supplier catalog are real data. Saving the strategy or opening an RFQ validates the capture but does not store it: they are writes blocked until authorized.' : 'Estrategia y lotificación conectada a MariaDB (solo lectura): requisiciones validadas, partidas, plan de lotes registrado, RFQ por lote y catálogo de proveedores son datos reales. Guardar la estrategia o abrir una RFQ valida la captura pero no la almacena: son escrituras bloqueadas hasta su autorización.')
          : (lang === 'en' ? 'Card pending integration: it may show demo data and its forms do not save operations in MariaDB.' : 'Tarjeta pendiente de integración: puede mostrar datos de demostración y sus formularios no guardan operaciones en MariaDB.')}</span>
      </div>

      {/* Contenedor Principal de Vistas */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">

        {/* TARJETA 1: Registro de validación (MariaDB, solo lectura; guardar valida y no escribe) */}
        {activeTab === 'register' && (
          <ValidationRegister key={valEdit ? valEdit.id : `new:${startReq?.tab === 'register' ? startReq.id : ''}`} edit={valEdit} startRequisition={startReq?.tab === 'register' ? startReq.id : ''} onExitEdit={() => setValEdit(null)} en={lang === 'en'} notify={(title, message, kind) => onNotify && onNotify(title, message, kind)} onGo={handleTabChange} />
        )}

        {/* TARJETA 2: Estrategia y lotificación (MariaDB, solo lectura; guardar valida y no escribe) */}
        {activeTab === 'strategy' && (
          <StrategyLots key={`s:${startReq?.tab === 'strategy' ? startReq.id : ''}`} startRequisition={startReq?.tab === 'strategy' ? startReq.id : ''} en={lang === 'en'} notify={(title, message, kind) => onNotify && onNotify(title, message, kind)} onGo={handleTabChange} onNavigate={onNavigate} />
        )}

        {/* TARJETA 3: Matriz de validaciones internas (MariaDB, solo lectura; editar/eliminar validan y no escriben) */}
        {activeTab === 'matrix' && (
          <ValidationMatrix en={lang === 'en'} notify={(title, message, kind) => onNotify && onNotify(title, message, kind)}
            onEdit={preset => { setStartReq(null); setValEdit(preset); handleTabChange('register', t.tabs.register.title); }}
            onNew={() => { setStartReq(null); setValEdit(null); handleTabChange('register', t.tabs.register.title); }} />
        )}

        {/* TARJETA 4: Reglas inteligentes (MariaDB, solo lectura) */}
        {activeTab === 'compliance' && (
          <SmartRules en={lang === 'en'} onGo={handleTabChange} onStart={(tab, id) => { setValEdit(null); setStartReq({ tab, id }); handleTabChange(tab, tab === 'register' ? t.tabs.register.title : t.tabs.strategy.title); }} />
        )}
      </div>
    </div>
  );
};