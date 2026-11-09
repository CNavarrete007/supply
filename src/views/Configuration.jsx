import React, { useState, useRef } from 'react';

// DICCIONARIO DE TRADUCCIONES
const TEXTS = {
  es: {
    headerTitle: "Configuración",
    headerSubtitle: "Administra tu cuenta, preferencias y configuración general del sistema.",
    tabs: [
      { id: 1, title: 'Identidad y formatos', description: 'Logotipo, nombre, textos e idioma de documentos.', emoji: '🎨' },
      { id: 2, title: 'Matriz de parámetros', description: 'Moneda, prefijos, alertas, cotizaciones mínimas e IVA.', emoji: '📋' },
      { id: 3, title: 'Aprobaciones de cotización', description: 'Límites por artículo y total; solo administradores.', emoji: '✅' },
      { id: 4, title: 'Condiciones de cotización', description: 'Comentarios predeterminados ES / EN del PDF para el cliente.', emoji: '📝' },
      { id: 5, title: 'Correos automáticos', description: 'Avisos internos, comunicaciones al cliente e historial de envíos.', emoji: '✉️' },
      { id: 6, title: 'Respaldo e importación', description: 'Exporta o restaura toda la información del sistema.', emoji: '💾' },
      { id: 7, title: 'Reinicio del sistema', description: 'Elimina los datos locales y restaura la aplicación.', emoji: '🗑️' }
    ],
    tab1: {
      visualTitle: "Identidad visual del sistema",
      visualSub: "Cambia lo que aparece en la cabecera lateral y en los formatos.",
      badgeBrand: "Marca editable",
      systemName: "Nombre mostrado en el sistema",
      subtext: "Texto inferior / descripción",
      contractorName: "Nombre de la empresa contratista",
      mainLogo: "Logotipo principal",
      noLogo: "Sin logotipo",
      logoHelp: "Se utilizará en la barra lateral, órdenes de compra y reportes.",
      deleteLogo: "Eliminar logotipo",
      formatsTitle: "Idioma de formatos generados",
      formatsSub: "Define el idioma por defecto y permite cambiarlo antes de abrir, imprimir o descargar cada formato.",
      badgeLang: "ES / EN",
      defaultLang: "Idioma predeterminado",
      clientDocsLang: "Documentos para clientes",
      supplierDocsLang: "Documentos para proveedores",
      docNoticeTitle: "Selección por documento:",
      docNoticeText: "En las secciones de formatos aparecerá un selector Español / English. El idioma elegido se conserva para la siguiente generación, sin cambiar el idioma de toda la interfaz.",
      btnSave: "Guardar identidad e idiomas",
      saveAlert: "¡Identidad e idiomas guardados correctamente!"
    },
    tab2: {
      title: "Matriz de parámetros operativos",
      subtitle: "La información que antes estaba en Configuración general se concentra aquí para consulta y edición.",
      badgeParams: "Parámetros del sistema",
      baseCurrency: "Moneda base",
      reqPrefix: "Prefijo requisición",
      poPrefix: "Prefijo Orden de Compra",
      alertDays: "Días de alerta previos",
      minQuotes: "Cotizaciones mínimas",
      defaultVat: "IVA por defecto %",
      headers: ["PARÁMETRO", "VALOR ACTUAL", "APLICACIÓN"],
      appCurrency: "Cálculos, reportes y documentos",
      appReqPrefix: "Folios automáticos de requisiciones",
      appPoPrefix: "Folios automáticos de órdenes",
      appAlertDays: "Semáforos y vencimientos",
      appMinQuotes: "Control previo al comparativo",
      appDefaultVat: "Cotizaciones y órdenes",
      btnSave: "Guardar parámetros",
      saveAlert: "¡Matriz de parámetros actualizada con éxito!"
    },
    tab3: {
      title: "Aprobaciones de Cotización al Cliente",
      subtitle: "Define cuándo una cotización comercial requiere solo la firma del Comprador o las tres firmas internas. Esta regla NO modifica las Órdenes de Compra.",
      badgeAdmin: "Solo administradores",
      bannerText: "si ningún precio de venta unitario supera el límite por artículo Y el subtotal comercial después de descuento y antes de IVA no supera el límite total, solo se exige la firma del Comprador. Si cualquiera de los dos límites se rebasa, se exigen Comprador + Revisó + Autorizó.",
      activeRule: "Regla activa:",
      enableAmountRule: "Activar regla por monto",
      optYes: "Sí, aplicar automáticamente",
      optNo: "No, requerir siempre 3 firmas",
      ruleCurrency: "Moneda de la regla",
      itemLimit: "Límite por artículo (precio venta unitario)",
      totalLimit: "Límite total de cotización",
      level1Title: "Nivel 1 · Autorización simplificada",
      level1Desc: "Artículo ≤ ${0} y subtotal ≤ ${1} → solo Comprador y su firma.",
      level2Title: "Nivel 2 · Autorización completa",
      level2Desc: "Artículo > límite O subtotal > límite → Comprador + Revisó + Autorizó y las tres firmas.",
      headers: ["NIVEL", "CONDICIÓN", "COMPRADOR", "REVISÓ", "AUTORIZÓ", "APLICACIÓN"],
      lvl1Name: "Nivel 1",
      lvl1Cond: "Ningún artículo rebasa el límite y el subtotal no rebasa el límite total.",
      lvl2Name: "Nivel 2",
      lvl2Cond: "Al menos un artículo rebasa el límite o el subtotal rebasa el límite total.",
      poName: "OC",
      poCond: "Sin importar el monto.",
      mandatory: "Obligatorio",
      notRequired: "No requerido",
      appClientQuote: "Cotización al cliente",
      appPoIndependent: "Orden de Compra · regla independiente",
      btnSave: "Guardar límites de aprobación",
      saveAlert: "¡Límites de aprobación guardados correctamente!"
    },
    tab4: {
      title: "Condiciones predeterminadas de Cotización al Cliente",
      subtitle: "Controla el bloque COMENTARIOS / COMMENTS del PDF comercial sin modificar el código.",
      badgeEditable: "ES / EN editable",
      bannerHierarchy: "Jerarquía: si una cotización tiene contenido en Notas comerciales / Comentarios del PDF, ese texto tiene prioridad. Si se deja vacío, el PDF utiliza las condiciones predeterminadas configuradas aquí.",
      bannerCurrency: "Puedes utilizar {CURRENCY}. El PDF lo sustituirá automáticamente por la moneda de la cotización. Se muestran como máximo 8 condiciones para conservar el diseño del documento.",
      activeCountText: "condición(es) activa(s)",
      activeCountSub: "Activa, desactiva, edita o agrega condiciones comerciales.",
      btnAdd: "Agregar condición",
      btnReset: "Restablecer predeterminadas",
      tableHeaders: ["ACTIVA", "ESPAÑOL", "ENGLISH", "ACCIÓN"],
      previewEs: "Vista previa · Español",
      previewEn: "Preview · English",
      btnSave: "Guardar condiciones de cotización",
      alertMax: "Se muestran como máximo 8 condiciones para conservar el diseño del documento.",
      confirmReset: "¿Deseas restablecer las condiciones a su estado predeterminado?",
      saveAlert: "¡Condiciones de cotización guardadas con éxito!"
    },
    tab5: {
      internalTitle: "Notificaciones internas automáticas",
      internalSub: "Envía avisos a Comprador, Revisó y Autorizó cuando el expediente cambia de responsable.",
      internalBadge: "Segregación de funciones",
      enableInternal: "Activar correos internos",
      enableInternalSub: "Aplica al flujo de revisión y autorización de Órdenes de Compra y cotizaciones.",
      copyBuyer: "Copiar al comprador",
      copyBuyerSub: "El comprador recibe evidencia de los envíos a revisión y autorización.",
      copyAdmin: "Copiar a administradores",
      copyAdminSub: "Solo usuarios activos cuyo rol permite administrar usuarios y roles.",
      mandatoryNotice: "Control obligatorio: los correos informan y dejan evidencia, pero la revisión y autorización únicamente se ejecutan dentro de Grupo Gerez ERP.",
      customerTitle: "Comunicaciones al cliente",
      customerSub: "Utiliza el correo del cliente registrado. No incluye costos internos ni datos confidenciales.",
      customerBadge: "Portal del cliente",
      enableCustomer: "Activar correos al cliente",
      enableCustomerSub: "Interruptor general para comunicaciones comerciales.",
      confirmReq: "Confirmar requisición registrada",
      confirmReqSub: "Envía folio, proyecto y vínculo al correo del solicitante.",
      notifyProgress: "Avisar avances del proceso",
      notifyProgressSub: "Notifica validación, inicio de compra y recepción.",
      notifyQuote: "Avisar cotización enviada",
      notifyQuoteSub: "Se activa al cambiar el estado a \"Enviada al cliente\".",
      senderTitle: "Remitente y comportamiento",
      senderSub: "Define la identidad visible en los mensajes y el idioma predeterminado para clientes.",
      senderBadge: "Cuota no consultada",
      senderName: "Nombre del remitente",
      replyTo: "Correo para responder",
      customerEmailLang: "Idioma de correos al cliente",
      optEs: "Español",
      optEn: "Inglés",
      optUseDoc: "Usar el idioma de documentos para clientes",
      maxRecipients: "Máximo de destinatarios por evento",
      btnSave: "Guardar correos automáticos",
      btnCheckQuota: "Consultar cuota disponible",
      saveAlert: "¡Configuración de correos automáticos guardada correctamente!",
      quotaAlert: "Consultando cuota disponible de servidor de correo...",
      historyTitle: "Historial de correos",
      historySub: "Registra evento, destinatarios, resultado y fecha. El contenido confidencial no se almacena.",
      recordsCount: "registros",
      searchPlaceholder: "Buscar por evento, folio, destinatario o resultado...",
      filterAll: "Todos los resultados",
      headers: ["FECHA", "EVENTO", "REFERENCIA", "DESTINATARIOS", "RESULTADO", "DETALLE"]
    },
    tab6: {
      title: "Respaldo e importación de datos",
      subtitle: "Protege la información centralizada en Google Sheets.",
      badgeFormat: "Google Sheets + Archivo JSON",
      exportTitle: "Exportar respaldo",
      exportDesc: "Descarga clientes, proveedores, requisiciones, categorías, validaciones, cotizaciones, órdenes, recepciones, facturas, configuración y bitácora.",
      importTitle: "Importar respaldo",
      importDesc: "Restaura un archivo JSON generado previamente. La información importada reemplaza los datos actuales de la base compartida.",
      btnExport: "Exportar respaldo",
      btnImport: "Importar respaldo",
      footerNotice: "Los datos y archivos se guardan mediante Google Apps Script y Google Sheets. Realiza respaldos periódicos antes de reiniciar el sistema o importar otro archivo.",
      invalidJson: "Por favor selecciona un archivo válido en formato .JSON",
      confirmImport: "¿Estás seguro de que deseas importar \"{0}\"?\nEsta acción reemplazará los datos actuales de la base compartida.",
      importSuccess: "¡Respaldo importado correctamente!",
      jsonError: "El archivo seleccionado contiene un formato JSON inválido."
    },
    tab7: {
      title: "Reinicio del sistema",
      subtitle: "Elimina todos los registros locales y deja la aplicación como una instalación nueva.",
      badgeRisk: "Zona de riesgo",
      warnTitle: "Advertencia:",
      warnDesc: "Esta acción elimina clientes, proveedores, requisiciones, categorías personalizadas, validaciones, cotizaciones, órdenes de compra, recepciones, facturas, bitácora y configuración. Exporta un respaldo antes de continuar.",
      btnExportBefore: "Exportar antes de reiniciar",
      btnResetSystem: "Reiniciar sistema",
      confirmFirst: "⚠️ ¡ADVERTENCIA DE ZONA DE RIESGO!\n\n¿Estás completamente seguro de que deseas reiniciar el sistema?\nEsta acción eliminará clientes, proveedores, requisiciones, cotizaciones y configuraciones locales de Grupo Gerez.",
      promptConfirm: "Para confirmar esta acción irreversible, escribe \"REINICIAR\" a continuación:",
      keyword: "REINICIAR",
      resetSuccess: "El sistema se ha restaurado con éxito a su estado de fábrica.",
      resetError: "Texto de confirmación incorrecto. El proceso de reinicio ha sido cancelado."
    }
  },
  en: {
    headerTitle: "Settings",
    headerSubtitle: "Manage your account, preferences, and general system settings.",
    tabs: [
      { id: 1, title: 'Identity & Formats', description: 'Logo, name, text, and document language.', emoji: '🎨' },
      { id: 2, title: 'Parameters Matrix', description: 'Currency, prefixes, alerts, minimum quotes, and VAT.', emoji: '📋' },
      { id: 3, title: 'Quote Approvals', description: 'Per-item and total limits; admins only.', emoji: '✅' },
      { id: 4, title: 'Quote Conditions', description: 'Default ES / EN PDF comments for the customer.', emoji: '📝' },
      { id: 5, title: 'Automatic Emails', description: 'Internal notices, customer communications, and dispatch log.', emoji: '✉️' },
      { id: 6, title: 'Backup & Import', description: 'Export or restore all system information.', emoji: '💾' },
      { id: 7, title: 'System Reset', description: 'Delete local data and restore application.', emoji: '🗑️' }
    ],
    tab1: {
      visualTitle: "System Visual Identity",
      visualSub: "Change what appears in the sidebar header and document formats.",
      badgeBrand: "Editable Brand",
      systemName: "System Display Name",
      subtext: "Subtitle / Description",
      contractorName: "Contractor Company Name",
      mainLogo: "Main Logo",
      noLogo: "No logo",
      logoHelp: "Will be used in the sidebar, purchase orders, and reports.",
      deleteLogo: "Delete logo",
      formatsTitle: "Generated Formats Language",
      formatsSub: "Set default language and allow changing it before opening, printing, or downloading each format.",
      badgeLang: "ES / EN",
      defaultLang: "Default Language",
      clientDocsLang: "Customer Documents",
      supplierDocsLang: "Supplier Documents",
      docNoticeTitle: "Selection per document:",
      docNoticeText: "A Spanish / English selector will appear in format sections. The chosen language is saved for the next generation without changing the whole interface language.",
      btnSave: "Save Identity & Languages",
      saveAlert: "Identity and languages saved successfully!"
    },
    tab2: {
      title: "Operational Parameters Matrix",
      subtitle: "Information previously located in General Settings is gathered here for reference and editing.",
      badgeParams: "System Parameters",
      baseCurrency: "Base Currency",
      reqPrefix: "Requisition Prefix",
      poPrefix: "Purchase Order Prefix",
      alertDays: "Prior Alert Days",
      minQuotes: "Minimum Quotes",
      defaultVat: "Default VAT %",
      headers: ["PARAMETER", "CURRENT VALUE", "APPLICATION"],
      appCurrency: "Calculations, reports, and documents",
      appReqPrefix: "Automatic requisition folios",
      appPoPrefix: "Automatic order folios",
      appAlertDays: "Traffic lights and expirations",
      appMinQuotes: "Pre-comparison control",
      appDefaultVat: "Quotes and orders",
      btnSave: "Save Parameters",
      saveAlert: "Parameters matrix updated successfully!"
    },
    tab3: {
      title: "Customer Quote Approvals",
      subtitle: "Define when a commercial quotation requires only Buyer signature or all three internal signatures. This rule does NOT affect Purchase Orders.",
      badgeAdmin: "Admins Only",
      bannerText: "if no unit selling price exceeds item limit AND commercial subtotal after discount and before VAT does not exceed total limit, only Buyer signature is required. If either limit is exceeded, Buyer + Reviewed + Authorized are required.",
      activeRule: "Active rule:",
      enableAmountRule: "Activate amount rule",
      optYes: "Yes, apply automatically",
      optNo: "No, always require 3 signatures",
      ruleCurrency: "Rule Currency",
      itemLimit: "Per-item limit (unit selling price)",
      totalLimit: "Total quotation limit",
      level1Title: "Level 1 · Simplified authorization",
      level1Desc: "Item ≤ ${0} and subtotal ≤ ${1} → Buyer signature only.",
      level2Title: "Level 2 · Complete authorization",
      level2Desc: "Item > limit OR subtotal > limit → Buyer + Reviewed + Authorized and all three signatures.",
      headers: ["LEVEL", "CONDITION", "BUYER", "REVIEWED BY", "AUTHORIZED BY", "APPLICATION"],
      lvl1Name: "Level 1",
      lvl1Cond: "No item exceeds limit and subtotal does not exceed total limit.",
      lvl2Name: "Level 2",
      lvl2Cond: "At least one item exceeds limit or subtotal exceeds total limit.",
      poName: "PO",
      poCond: "Regardless of amount.",
      mandatory: "Mandatory",
      notRequired: "Not required",
      appClientQuote: "Customer quotation",
      appPoIndependent: "Purchase Order · independent rule",
      btnSave: "Save Approval Limits",
      saveAlert: "Approval limits saved successfully!"
    },
    tab4: {
      title: "Default Customer Quotation Conditions",
      subtitle: "Controls the COMMENTS block of commercial PDF without modifying code.",
      badgeEditable: "ES / EN editable",
      bannerHierarchy: "Hierarchy: if a quotation has content in Commercial notes / PDF Comments, that text takes priority. If left blank, PDF uses the default conditions configured here.",
      bannerCurrency: "You can use {CURRENCY}. The PDF will automatically replace it with the quotation currency. Up to 8 conditions are displayed to preserve layout.",
      activeCountText: "active condition(s)",
      activeCountSub: "Enable, disable, edit, or add commercial conditions.",
      btnAdd: "Add Condition",
      btnReset: "Reset Defaults",
      tableHeaders: ["ACTIVE", "SPANISH", "ENGLISH", "ACTION"],
      previewEs: "Preview · Spanish",
      previewEn: "Preview · English",
      btnSave: "Save Quote Conditions",
      alertMax: "Up to 8 conditions are displayed to preserve document layout.",
      confirmReset: "Do you want to reset conditions to their default state?",
      saveAlert: "Quote conditions saved successfully!"
    },
    tab5: {
      internalTitle: "Automatic Internal Notifications",
      internalSub: "Sends notices to Buyer, Reviewer, and Authorizer when case ownership changes.",
      internalBadge: "Segregation of duties",
      enableInternal: "Activate internal emails",
      enableInternalSub: "Applies to Purchase Order and quotation review and authorization workflows.",
      copyBuyer: "Copy buyer",
      copyBuyerSub: "Buyer receives evidence of dispatches sent for review and authorization.",
      copyAdmin: "Copy administrators",
      copyAdminSub: "Only active users whose role permits managing users and roles.",
      mandatoryNotice: "Mandatory control: emails inform and provide evidence, but review and authorization are solely executed inside Grupo Gerez ERP.",
      customerTitle: "Customer Communications",
      customerSub: "Uses registered customer email. Does not include internal costs or confidential data.",
      customerBadge: "Customer Portal",
      enableCustomer: "Activate customer emails",
      enableCustomerSub: "General toggle for commercial communications.",
      confirmReq: "Confirm registered requisition",
      confirmReqSub: "Sends folio, project, and link to requester's email.",
      notifyProgress: "Notify process progress",
      notifyProgressSub: "Notifies validation, purchase start, and reception.",
      notifyQuote: "Notify sent quote",
      notifyQuoteSub: "Triggers when status changes to \"Sent to customer\".",
      senderTitle: "Sender and Behavior",
      senderSub: "Defines visible identity in messages and default language for customers.",
      senderBadge: "Quota not checked",
      senderName: "Sender Name",
      replyTo: "Reply-to Email",
      customerEmailLang: "Customer Email Language",
      optEs: "Spanish",
      optEn: "English",
      optUseDoc: "Use customer document language",
      maxRecipients: "Max recipients per event",
      btnSave: "Save Automatic Emails",
      btnCheckQuota: "Check Available Quota",
      saveAlert: "Automatic email settings saved successfully!",
      quotaAlert: "Checking available mail server quota...",
      historyTitle: "Email History",
      historySub: "Logs event, recipients, outcome, and date. Confidential content is not stored.",
      recordsCount: "records",
      searchPlaceholder: "Search by event, folio, recipient, or outcome...",
      filterAll: "All outcomes",
      headers: ["DATE", "EVENT", "REFERENCE", "RECIPIENTS", "OUTCOME", "DETAIL"]
    },
    tab6: {
      title: "Data Backup and Import",
      subtitle: "Protects information centralized in Google Sheets.",
      badgeFormat: "Google Sheets + JSON File",
      exportTitle: "Export Backup",
      exportDesc: "Downloads clients, suppliers, requisitions, categories, validations, quotes, orders, receptions, invoices, settings, and audit log.",
      importTitle: "Import Backup",
      importDesc: "Restores a previously generated JSON file. Imported info replaces current data in shared database.",
      btnExport: "Export Backup",
      btnImport: "Import Backup",
      footerNotice: "Data and files are saved via Google Apps Script and Google Sheets. Make periodic backups before resetting the system or importing another file.",
      invalidJson: "Please select a valid file in .JSON format",
      confirmImport: "Are you sure you want to import \"{0}\"?\nThis action will replace current data in the shared database.",
      importSuccess: "Backup imported successfully!",
      jsonError: "The selected file contains an invalid JSON format."
    },
    tab7: {
      title: "System Reset",
      subtitle: "Deletes all local records and restores application as a fresh installation.",
      badgeRisk: "Risk Zone",
      warnTitle: "Warning:",
      warnDesc: "This action deletes clients, suppliers, requisitions, custom categories, validations, quotes, purchase orders, receptions, invoices, audit log, and settings. Export a backup before continuing.",
      btnExportBefore: "Export Before Resetting",
      btnResetSystem: "Reset System",
      confirmFirst: "⚠️ RISK ZONE WARNING!\n\nAre you completely sure you want to reset the system?\nThis action will delete clients, suppliers, requisitions, quotes, and local settings for Grupo Gerez.",
      promptConfirm: "To confirm this irreversible action, type \"RESET\" below:",
      keyword: "RESET",
      resetSuccess: "The system has been successfully restored to factory defaults.",
      resetError: "Incorrect confirmation text. System reset process canceled."
    }
  }
};

export const Configuration = ({ onNotify, lang = 'es', language, isEnglish }) => {
  const isEn = isEnglish || lang === 'en' || language === 'en';
  const currentLang = isEn ? 'en' : 'es';
  const t = TEXTS[currentLang] || TEXTS.es;

  // Estado para controlar qué tarjeta/sección está activa (por defecto la 1)
  const [activeTab, setActiveTab] = useState(1);

  // --- ESTADOS DE TARJETA 1 (IDENTIDAD Y FORMATOS) ---
  const [identityForm, setIdentityForm] = useState({
    nombreSistema: 'Grupo Gerez',
    textoInferior: 'Aduanas y logística a nivel mundial',
    empresaContratista: 'Trámites Aduanales Gerez S.C ',
    idiomaPredeterminado: 'English',
    idiomaClientes: 'English',
    idiomaProveedores: 'English',
    logotipoUrl: null, // Guardará la vista previa de la imagen cargada
  });

  // Handler para cambios en campos de texto y selects
  const handleIdentityChange = (e) => {
    const { name, value } = e.target;
    setIdentityForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handler para la carga de archivo de imagen del logotipo
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdentityForm((prev) => ({
          ...prev,
          logotipoUrl: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler para eliminar logotipo
  const handleRemoveLogo = () => {
    setIdentityForm((prev) => ({
      ...prev,
      logotipoUrl: null,
    }));
  };

  // Handler para guardar cambios
  const handleSaveIdentity = (e) => {
    e.preventDefault();
    if (onNotify) {
      onNotify(t.tab1.visualTitle, t.tab1.saveAlert);
    }
    alert(t.tab1.saveAlert);
  };

  // --- ESTADOS DE TARJETA 2 (MATRIZ DE PARÁMETROS) ---
  const [paramsForm, setParamsForm] = useState({
    monedaBase: 'MXN',
    prefijoRequisicion: '',
    prefijoOrdenCompra: '',
    diasAlerta: 0,
    cotizacionesMinimas: 0,
    ivaDefecto: 0,
  });

  // Handler para actualizar los inputs
  const handleParamsChange = (e) => {
    const { name, value } = e.target;
    setParamsForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handler para guardar la matriz de parámetros
  const handleSaveParams = (e) => {
    e.preventDefault();
    if (onNotify) {
      onNotify(t.tab2.title, t.tab2.saveAlert);
    }
    alert(t.tab2.saveAlert);
  };

  // --- ESTADOS DE TARJETA 3 (APROBACIONES DE COTIZACIÓN) ---
  const [approvalForm, setApprovalForm] = useState({
    activarRegla: 'Sí, aplicar automáticamente',
    monedaRegla: 'MXN · Peso mexicano',
    limiteArticulo: 0,
    limiteTotal: 0.0,
  });

  // Handler para cambios en campos
  const handleApprovalChange = (e) => {
    const { name, value } = e.target;
    setApprovalForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handler para guardar límites
  const handleSaveApprovals = (e) => {
    e.preventDefault();
    if (onNotify) {
      onNotify(t.tab3.title, t.tab3.saveAlert);
    }
    alert(t.tab3.saveAlert);
  };

  // --- CONDICIONES PREDETERMINADAS INICIALES ---
  const defaultConditions = [
    {
      id: 1,
      activa: true,
      es: 'Precios en {CURRENCY}.',
      en: 'Prices in {CURRENCY}.',
    },
    {
      id: 2,
      activa: true,
      es: 'Tiempo de entrega estimado sujeto a disponibilidad una vez confirmada la orden de compra.',
      en: 'Estimated delivery time subject to availability once the purchase order has been confirmed.',
    },
    {
      id: 3,
      activa: true,
      es: 'Precios sujetos a cambio por el proveedor.',
      en: 'Prices subject to change by the provider.',
    },
    {
      id: 4,
      activa: true,
      es: 'Nueva condición comercial.',
      en: 'New commercial condition.',
    },
  ];

  // --- ESTADOS DE TARJETA 4 ---
  const [conditions, setConditions] = useState(defaultConditions);

  // Manejar checkbox de activado
  const handleToggleCondition = (id) => {
    setConditions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, activa: !item.activa } : item))
    );
  };

  // Manejar cambios en el texto (ES / EN)
  const handleConditionTextChange = (id, field, value) => {
    setConditions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Agregar nueva condición (máximo 8)
  const handleAddCondition = () => {
    if (conditions.length >= 8) {
      alert(t.tab4.alertMax);
      return;
    }
    const newId = Date.now();
    setConditions((prev) => [
      ...prev,
      {
        id: newId,
        activa: true,
        es: 'Nueva condición comercial.',
        en: 'New commercial condition.',
      },
    ]);
  };

  // Eliminar condición
  const handleDeleteCondition = (id) => {
    setConditions((prev) => prev.filter((item) => item.id !== id));
  };

  // Restablecer valores predeterminados
  const handleResetConditions = () => {
    if (window.confirm(t.tab4.confirmReset)) {
      setConditions(defaultConditions);
    }
  };

  // Guardar condiciones
  const handleSaveConditions = (e) => {
    e.preventDefault();
    if (onNotify) {
      onNotify(t.tab4.title, t.tab4.saveAlert);
    }
    alert(t.tab4.saveAlert);
  };

  // Conteo de activas
  const activeCount = conditions.filter((c) => c.activa).length;

  // --- ESTADOS DE TARJETA 5 (CORREOS AUTOMÁTICOS) ---
  const [emailConfig, setEmailConfig] = useState({
    // Notificaciones internas
    activarInternos: true,
    copiarComprador: true,
    copiarAdministradores: true,

    // Comunicaciones al cliente
    activarCliente: false,
    confirmarRequisicion: false,
    avisarAvances: false,
    avisarCotizacion: false,
    avisarEntrega: false,
    avisarFactura: false,

    // Remitente y comportamiento
    nombreRemitente: 'Grupo Gerez',
    correoResponder: 'compras@grupogerez.com',
    idiomaCliente: 'Español',
    maxDestinatarios: 0,
  });

  // Estado de búsqueda y filtro para el historial
  const [searchHistory, setSearchHistory] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos los resultados');

  // Handlers de cambio de input y checkbox
  const handleEmailCheckChange = (e) => {
    const { name, checked } = e.target;
    setEmailConfig((prev) => ({ ...prev, [name]: checked }));
  };

  const handleEmailInputChange = (e) => {
    const { name, value } = e.target;
    setEmailConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEmails = (e) => {
    e.preventDefault();
    if (onNotify) {
      onNotify(t.tab5.historyTitle, t.tab5.saveAlert);
    }
    alert(t.tab5.saveAlert);
  };

  // Mock de Historial adaptado para Grupo Gerez
  const mockEmailHistory = [
    {
      id: 1,
      fecha: '2026-09-08T23:49:40.009Z',
      evento: 'Flujo de Orden de Compra',
      referencia: 'OC-2026-0026',
      destinatarios: [
        'Para: usuario.compras@grupogerez.com',
        'CC: admin.sistema@grupogerez.com',
        'CC: gerencia@grupogerez.com',
      ],
      resultado: 'Enviado',
      detalle: 'Enviado a 3 destinatario(s).',
    },
    {
      id: 2,
      fecha: '2026-09-08T23:49:29.778Z',
      evento: 'Flujo de Orden de Compra',
      referencia: 'OC-2026-0025',
      destinatarios: [
        'Para: usuario.compras@grupogerez.com',
        'CC: admin.sistema@grupogerez.com',
      ],
      resultado: 'Enviado',
      detalle: 'Enviado a 2 destinatario(s).',
    },
    {
      id: 3,
      fecha: '2026-09-08T23:47:52.096Z',
      evento: 'Notificación de Requisición',
      referencia: 'REQ-2026-0104',
      destinatarios: ['Para: solicitante@grupogerez.com'],
      resultado: 'Enviado',
      detalle: 'Enviado a 1 destinatario(s).',
    },
  ];

  const filteredHistory = mockEmailHistory.filter((item) => {
    const matchesSearch = 
      item.evento.toLowerCase().includes(searchHistory.toLowerCase()) ||
      item.referencia.toLowerCase().includes(searchHistory.toLowerCase()) ||
      item.resultado.toLowerCase().includes(searchHistory.toLowerCase()) ||
      item.destinatarios.some(d => d.toLowerCase().includes(searchHistory.toLowerCase()));

    const matchesStatus = 
      filterStatus === 'Todos los resultados' || filterStatus === 'All outcomes' || 
      item.resultado.toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // --- ESTADOS Y HANDLERS DE TARJETA 6 (RESPALDO E IMPORTACIÓN) ---
  const fileInputRef = useRef(null);

  const handleExportBackup = () => {
    const backupData = {
      empresa: identityForm.nombreSistema,
      fechaExportacion: new Date().toISOString(),
      identidad: identityForm,
      parametros: paramsForm,
      aprobaciones: approvalForm,
      condiciones: conditions,
      correos: emailConfig,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Respaldo_GrupoGerez_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleTriggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      alert(t.tab6.invalidJson);
      return;
    }

    const confirmImport = window.confirm(
      t.tab6.confirmImport.replace('{0}', file.name)
    );

    if (confirmImport) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          console.log('Datos importados:', json);
          alert(t.tab6.importSuccess);
        } catch (err) {
          alert(t.tab6.jsonError);
        }
      };
      reader.readAsText(file);
    }

    e.target.value = '';
  };

  // --- HANDLER PARA TARJETA 7 (REINICIO DEL SISTEMA) ---
  const handleResetSystem = () => {
    const confirmFirst = window.confirm(t.tab7.confirmFirst);

    if (confirmFirst) {
      const confirmSecond = window.prompt(t.tab7.promptConfirm);

      if (confirmSecond === t.tab7.keyword) {
        localStorage.clear();
        alert(t.tab7.resetSuccess);
        window.location.reload();
      } else if (confirmSecond !== null) {
        alert(t.tab7.resetError);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div>
        <h2 className="text-2xl font-black text-slate-900">{t.headerTitle}</h2>
        <p className="text-xs text-slate-500 font-medium">
          {t.headerSubtitle}
        </p>
      </div>

      {/* GRID DE TARJETAS DE CONFIGURACIÓN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {t.tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left p-4 rounded-2xl transition-all duration-300 ease-out cursor-pointer flex flex-col justify-between min-h-[115px] border group ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-transparent shadow-md shadow-indigo-500/20 scale-[1.02]'
                  : 'bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-blue-300 text-slate-800 shadow-2xs hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {/* Contenedor del Emoji */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm mb-2.5 transition-all duration-300 ${
                  isActive
                    ? 'bg-white/20 text-white backdrop-blur-xs scale-110'
                    : 'bg-blue-50/70 text-slate-700 group-hover:bg-blue-100/80 group-hover:scale-110'
                }`}
              >
                <span>{tab.emoji}</span>
              </div>

              {/* Textos */}
              <div className="space-y-0.5">
                <h3
                  className={`text-xs font-black leading-tight transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {tab.title}
                </h3>
                <p
                  className={`text-[10px] leading-normal font-medium transition-colors duration-200 ${
                    isActive ? 'text-blue-100' : 'text-slate-400 group-hover:text-slate-500'
                  }`}
                >
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ÁREA DE CONTENIDO DINÁMICO SEGÚN LA TARJETA SELECCIONADA CON ANIMACIÓN FADE-IN */}
      <div className="pt-2 animate-fadeIn transition-all duration-300">
        
        {/* 1. IDENTIDAD Y FORMATOS */}
        {activeTab === 1 && (
          <form onSubmit={handleSaveIdentity} className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
            
            {/* COLUMNA IZQUIERDA: Identidad visual del sistema */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Encabezado con badge */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {t.tab1.visualTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t.tab1.visualSub}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 font-extrabold text-[10px] rounded-md uppercase">
                    {t.tab1.badgeBrand}
                  </span>
                </div>

                {/* Campo: Nombre mostrado en el sistema */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                    {t.tab1.systemName}
                  </label>
                  <input
                    type="text"
                    name="nombreSistema"
                    value={identityForm.nombreSistema}
                    onChange={handleIdentityChange}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-500 font-bold uppercase tracking-wide"
                  />
                </div>

                {/* Campo: Texto inferior / descripción */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                    {t.tab1.subtext}
                  </label>
                  <input
                    type="text"
                    name="textoInferior"
                    value={identityForm.textoInferior}
                    onChange={handleIdentityChange}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-500 font-medium uppercase tracking-wide"
                  />
                </div>

                {/* Campo: Nombre de la empresa contratista */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                    {t.tab1.contractorName}
                  </label>
                  <input
                    type="text"
                    name="empresaContratista"
                    value={identityForm.empresaContratista}
                    onChange={handleIdentityChange}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-500 font-bold uppercase tracking-wide"
                  />
                </div>

                {/* Campo: Logotipo principal */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-extrabold text-slate-800">
                    {t.tab1.mainLogo}
                  </label>
                  
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4">
                    {/* Box Previsualización del Logo */}
                    <div className="w-32 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 text-center shrink-0 shadow-2xs overflow-hidden">
                      {identityForm.logotipoUrl ? (
                        <img
                          src={identityForm.logotipoUrl}
                          alt="Logotipo Principal"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">{t.tab1.noLogo}</span>
                      )}
                    </div>

                    {/* Inputs & Botón Eliminar */}
                    <div className="space-y-2 w-full">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-white file:text-slate-800 hover:file:bg-slate-100 file:border-slate-200 file:border border border-slate-200 rounded-xl cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 font-medium">
                        {t.tab1.logoHelp}
                      </p>

                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] rounded-lg transition-colors shadow-2xs cursor-pointer"
                      >
                        {t.tab1.deleteLogo}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: Idioma de formatos generados */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Encabezado con badge ES/EN */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {t.tab1.formatsTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t.tab1.formatsSub}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-black text-[10px] rounded-md border border-blue-100">
                    {t.tab1.badgeLang}
                  </span>
                </div>

                {/* 3 Selectores de Idioma en Tarjetas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Idioma predeterminado */}
                  <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                    <label className="block text-xs font-extrabold text-slate-800 leading-snug">
                      {t.tab1.defaultLang}
                    </label>
                    <select
                      name="idiomaPredeterminado"
                      value={identityForm.idiomaPredeterminado}
                      onChange={handleIdentityChange}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="English">English</option>
                      <option value="Español">Español</option>
                    </select>
                  </div>

                  {/* Documentos para clientes */}
                  <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                    <label className="block text-xs font-extrabold text-slate-800 leading-snug">
                      {t.tab1.clientDocsLang}
                    </label>
                    <select
                      name="idiomaClientes"
                      value={identityForm.idiomaClientes}
                      onChange={handleIdentityChange}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="English">English</option>
                      <option value="Español">Español</option>
                    </select>
                  </div>

                  {/* Documentos para proveedores */}
                  <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                    <label className="block text-xs font-extrabold text-slate-800 leading-snug">
                      {t.tab1.supplierDocsLang}
                    </label>
                    <select
                      name="idiomaProveedores"
                      value={identityForm.idiomaProveedores}
                      onChange={handleIdentityChange}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="English">English</option>
                      <option value="Español">Español</option>
                    </select>
                  </div>
                </div>

                {/* Banner Informativo Verde */}
                <div className="p-4 bg-emerald-50/60 border-l-4 border-emerald-500 rounded-xl text-xs text-emerald-950 space-y-1">
                  <p className="font-extrabold">{t.tab1.docNoticeTitle}</p>
                  <p className="text-[11px] leading-relaxed text-emerald-900 font-medium">
                    {t.tab1.docNoticeText}
                  </p>
                </div>
              </div>

              {/* Botón Guardar identidad e idiomas */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <span>💾</span> {t.tab1.btnSave}
                </button>
              </div>
            </div>

          </form>
        )}

        {/* 2. MATRIZ DE PARÁMETROS */}
        {activeTab === 2 && (
          <form onSubmit={handleSaveParams} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
            
            {/* Encabezado con badge */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t.tab2.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {t.tab2.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-extrabold text-[11px] rounded-full border border-blue-100">
                {t.tab2.badgeParams}
              </span>
            </div>

            {/* GRID DE FORMULARIO DE 6 CAMPOS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Moneda base */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab2.baseCurrency}
                </label>
                <select
                  name="monedaBase"
                  value={paramsForm.monedaBase}
                  onChange={handleParamsChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              {/* Prefijo requisición */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab2.reqPrefix}
                </label>
                <input
                  type="text"
                  name="prefijoRequisicion"
                  value={paramsForm.prefijoRequisicion}
                  onChange={handleParamsChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 uppercase"
                />
              </div>

              {/* Prefijo Orden de Compra */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab2.poPrefix}
                </label>
                <input
                  type="text"
                  name="prefijoOrdenCompra"
                  value={paramsForm.prefijoOrdenCompra}
                  onChange={handleParamsChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 uppercase"
                />
              </div>

              {/* Días de alerta previos */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab2.alertDays}
                </label>
                <input
                  type="number"
                  name="diasAlerta"
                  value={paramsForm.diasAlerta}
                  onChange={handleParamsChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Cotizaciones mínimas */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab2.minQuotes}
                </label>
                <input
                  type="number"
                  name="cotizacionesMinimas"
                  value={paramsForm.cotizacionesMinimas}
                  onChange={handleParamsChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* IVA por defecto % */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab2.defaultVat}
                </label>
                <input
                  type="number"
                  name="ivaDefecto"
                  value={paramsForm.ivaDefecto}
                  onChange={handleParamsChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* TABLA EXPLICATIVA DE APLICACIÓN DE PARÁMETROS */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-1/3">{t.tab2.headers[0]}</th>
                    <th className="py-3 px-4 w-1/4 text-center">{t.tab2.headers[1]}</th>
                    <th className="py-3 px-4">{t.tab2.headers[2]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {/* Moneda base */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-slate-900">{t.tab2.baseCurrency}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 inline-block min-w-[50px]">
                        {paramsForm.monedaBase || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{t.tab2.appCurrency}</td>
                  </tr>

                  {/* Prefijo requisición */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-slate-900">{t.tab2.reqPrefix}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 inline-block min-w-[50px]">
                        {paramsForm.prefijoRequisicion || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{t.tab2.appReqPrefix}</td>
                  </tr>

                  {/* Prefijo Orden de Compra */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-slate-900">{t.tab2.poPrefix}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 inline-block min-w-[50px]">
                        {paramsForm.prefijoOrdenCompra || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{t.tab2.appPoPrefix}</td>
                  </tr>

                  {/* Días de alerta */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-slate-900">{t.tab2.alertDays}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 inline-block min-w-[50px]">
                        {paramsForm.diasAlerta}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{t.tab2.appAlertDays}</td>
                  </tr>

                  {/* Cotizaciones mínimas */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-slate-900">{t.tab2.minQuotes}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 inline-block min-w-[50px]">
                        {paramsForm.cotizacionesMinimas}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{t.tab2.appMinQuotes}</td>
                  </tr>

                  {/* IVA por defecto */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-extrabold text-slate-900">{t.tab2.defaultVat}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black border border-blue-100 inline-block min-w-[50px]">
                        {paramsForm.ivaDefecto}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{t.tab2.appDefaultVat}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* BOTÓN GUARDAR PARÁMETROS */}
            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>💾</span> {t.tab2.btnSave}
              </button>
            </div>

          </form>
        )}

        {/* 3. APROBACIONES DE COTIZACIÓN */}
        {activeTab === 3 && (
          <form onSubmit={handleSaveApprovals} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
            
            {/* Encabezado con badge amarillo */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t.tab3.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {t.tab3.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 font-extrabold text-[11px] rounded-md">
                {t.tab3.badgeAdmin}
              </span>
            </div>

            {/* Banner Informativo Regla Activa */}
            <div className="p-4 bg-emerald-50/70 border-l-4 border-emerald-500 rounded-xl text-xs text-emerald-950 font-medium leading-relaxed">
              <span className="font-extrabold">{t.tab3.activeRule}</span> {t.tab3.bannerText}
            </div>

            {/* CAMPOS DE FORMULARIO DE LÍMITES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Activar regla por monto */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab3.enableAmountRule}
                </label>
                <select
                  name="activarRegla"
                  value={approvalForm.activarRegla}
                  onChange={handleApprovalChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Sí, aplicar automáticamente">{t.tab3.optYes}</option>
                  <option value="No, requerir siempre 3 firmas">{t.tab3.optNo}</option>
                </select>
              </div>

              {/* Moneda de la regla */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab3.ruleCurrency}
                </label>
                <select
                  name="monedaRegla"
                  value={approvalForm.monedaRegla}
                  onChange={handleApprovalChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="MXN · Peso mexicano">MXN · Peso mexicano</option>
                </select>
              </div>

              {/* Límite por artículo */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab3.itemLimit}
                </label>
                <input
                  type="number"
                  name="limiteArticulo"
                  value={approvalForm.limiteArticulo}
                  onChange={handleApprovalChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Límite total de cotización */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab3.totalLimit}
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="limiteTotal"
                  value={approvalForm.limiteTotal}
                  onChange={handleApprovalChange}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* TARJETAS DINÁMICAS Nivel 1 y Nivel 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nivel 1 */}
              <div className="p-4 bg-sky-50/60 border-l-4 border-sky-500 rounded-2xl space-y-1">
                <h4 className="text-xs font-extrabold text-sky-950">{t.tab3.level1Title}</h4>
                <p className="text-[11px] font-medium text-sky-900">
                  {t.tab3.level1Desc
                    .replace('{0}', Number(approvalForm.limiteArticulo || 0).toLocaleString(isEn ? 'en-US' : 'es-MX', { minimumFractionDigits: 2 }))
                    .replace('{1}', Number(approvalForm.limiteTotal || 0).toLocaleString(isEn ? 'en-US' : 'es-MX', { minimumFractionDigits: 2 }))}
                </p>
              </div>

              {/* Nivel 2 */}
              <div className="p-4 bg-amber-50/60 border-l-4 border-amber-500 rounded-2xl space-y-1">
                <h4 className="text-xs font-extrabold text-amber-950">{t.tab3.level2Title}</h4>
                <p className="text-[11px] font-medium text-amber-900">
                  {t.tab3.level2Desc}
                </p>
              </div>
            </div>

            {/* TABLA DE NIVELES Y FIRMAS */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-24">{t.tab3.headers[0]}</th>
                    <th className="py-3 px-4">{t.tab3.headers[1]}</th>
                    <th className="py-3 px-4">{t.tab3.headers[2]}</th>
                    <th className="py-3 px-4">{t.tab3.headers[3]}</th>
                    <th className="py-3 px-4">{t.tab3.headers[4]}</th>
                    <th className="py-3 px-4">{t.tab3.headers[5]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {/* Fila Nivel 1 */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black">
                        {t.tab3.lvl1Name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold">
                      {t.tab3.lvl1Cond}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.tab3.mandatory}</td>
                    <td className="py-3 px-4 text-slate-400">{t.tab3.notRequired}</td>
                    <td className="py-3 px-4 text-slate-400">{t.tab3.notRequired}</td>
                    <td className="py-3 px-4 text-slate-600">{t.tab3.appClientQuote}</td>
                  </tr>

                  {/* Fila Nivel 2 */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-black">
                        {t.tab3.lvl2Name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold">
                      {t.tab3.lvl2Cond}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.tab3.mandatory}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.tab3.mandatory}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.tab3.mandatory}</td>
                    <td className="py-3 px-4 text-slate-600">{t.tab3.appClientQuote}</td>
                  </tr>

                  {/* Fila OC */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[11px] font-black">
                        {t.tab3.poName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold">
                      {t.tab3.poCond}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.tab3.mandatory}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.tab3.mandatory}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{t.tab3.mandatory}</td>
                    <td className="py-3 px-4 text-slate-600">{t.tab3.appPoIndependent}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* BOTÓN GUARDAR LÍMITES */}
            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>💾</span> {t.tab3.btnSave}
              </button>
            </div>

          </form>
        )}

        {/* 4. CONDICIONES DE COTIZACIÓN */}
        {activeTab === 4 && (
          <form onSubmit={handleSaveConditions} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
            
            {/* Encabezado con badge púrpura */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t.tab4.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {t.tab4.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 font-extrabold text-[11px] rounded-md uppercase">
                {t.tab4.badgeEditable}
              </span>
            </div>

            {/* Banners Informativos */}
            <div className="space-y-2">
              <div className="p-3.5 bg-emerald-50/70 border-l-4 border-emerald-500 rounded-xl text-xs text-emerald-950 leading-relaxed">
                {t.tab4.bannerHierarchy}
              </div>

              <div className="p-3.5 bg-sky-50/70 border-l-4 border-sky-500 rounded-xl text-xs text-sky-950 leading-relaxed">
                {t.tab4.bannerCurrency}
              </div>
            </div>

            {/* Barra Superior con Contador y Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  {activeCount} {t.tab4.activeCountText}
                </h4>
                <p className="text-xs text-slate-500">
                  {t.tab4.activeCountSub}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+</span> {t.tab4.btnAdd}
                </button>

                <button
                  type="button"
                  onClick={handleResetConditions}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>↺</span> {t.tab4.btnReset}
                </button>
              </div>
            </div>

            {/* TABLA / LISTA DE CONDICIONES COMERCIALES */}
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/30">
              <div className="grid grid-cols-12 gap-3 p-3 bg-slate-100/70 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider items-center">
                <div className="col-span-1 text-center">{t.tab4.tableHeaders[0]}</div>
                <div className="col-span-5">{t.tab4.tableHeaders[1]}</div>
                <div className="col-span-5">{t.tab4.tableHeaders[2]}</div>
                <div className="col-span-1 text-center">{t.tab4.tableHeaders[3]}</div>
              </div>

              <div className="divide-y divide-slate-200/60 p-2 space-y-2">
                {conditions.map((item) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 gap-3 p-2.5 rounded-xl items-center transition-all ${
                      item.activa ? 'bg-white shadow-2xs' : 'bg-slate-100/50 opacity-60'
                    }`}
                  >
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="checkbox"
                        checked={item.activa}
                        onChange={() => handleToggleCondition(item.id)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>

                    <div className="col-span-5">
                      <textarea
                        rows={2}
                        value={item.es}
                        onChange={(e) => handleConditionTextChange(item.id, 'es', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                      />
                    </div>

                    <div className="col-span-5">
                      <textarea
                        rows={2}
                        value={item.en}
                        onChange={(e) => handleConditionTextChange(item.id, 'en', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                      />
                    </div>

                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteCondition(item.id)}
                        className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer shadow-2xs"
                        title="Eliminar condición"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* VISTAS PREVIAS DINÁMICAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-slate-900">{t.tab4.previewEs}</h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 font-medium">
                  {conditions
                    .filter((c) => c.activa)
                    .map((c) => (
                      <li key={c.id} className="leading-snug">
                        {c.es.replace('{CURRENCY}', 'MXN')}
                      </li>
                    ))}
                </ul>
              </div>

              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2">
                <h4 className="text-xs font-black text-slate-900">{t.tab4.previewEn}</h4>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 font-medium">
                  {conditions
                    .filter((c) => c.activa)
                    .map((c) => (
                      <li key={c.id} className="leading-snug">
                        {c.en.replace('{CURRENCY}', 'MXN')}
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            {/* BOTÓN GUARDAR CONDICIONES DE COTIZACIÓN */}
            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>💾</span> {t.tab4.btnSave}
              </button>
            </div>

          </form>
        )}

        {/* 5. CORREOS AUTOMÁTICOS */}
        {activeTab === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <form onSubmit={handleSaveEmails} className="space-y-6">
              
              {/* SECCIÓN SUPERIOR: 2 COLUMNAS (INTERNAS Y CLIENTE) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* BLOQUE 1: NOTIFICACIONES INTERNAS AUTOMÁTICAS */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {t.tab5.internalTitle}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t.tab5.internalSub}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold text-[10px] rounded-md border border-blue-100 shrink-0">
                      {t.tab5.internalBadge}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="activarInternos"
                        checked={emailConfig.activarInternos}
                        onChange={handleEmailCheckChange}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-800">
                          {t.tab5.enableInternal}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {t.tab5.enableInternalSub}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="copiarComprador"
                        checked={emailConfig.copiarComprador}
                        onChange={handleEmailCheckChange}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-800">
                          {t.tab5.copyBuyer}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {t.tab5.copyBuyerSub}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="copiarAdministradores"
                        checked={emailConfig.copiarAdministradores}
                        onChange={handleEmailCheckChange}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-800">
                          {t.tab5.copyAdmin}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {t.tab5.copyAdminSub}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="p-3 bg-amber-50/70 border-l-4 border-amber-500 rounded-xl text-xs text-amber-950 font-medium leading-relaxed">
                    {t.tab5.mandatoryNotice}
                  </div>
                </div>

                {/* BLOQUE 2: COMUNICACIONES AL CLIENTE */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {t.tab5.customerTitle}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t.tab5.customerSub}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-extrabold text-[10px] rounded-md border border-purple-100 shrink-0">
                      {t.tab5.customerBadge}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="activarCliente"
                        checked={emailConfig.activarCliente}
                        onChange={handleEmailCheckChange}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-800">{t.tab5.enableCustomer}</span>
                        <span className="text-[11px] text-slate-500">{t.tab5.enableCustomerSub}</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="confirmarRequisicion"
                        checked={emailConfig.confirmarRequisicion}
                        onChange={handleEmailCheckChange}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-800">{t.tab5.confirmReq}</span>
                        <span className="text-[11px] text-slate-500">{t.tab5.confirmReqSub}</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="avisarAvances"
                        checked={emailConfig.avisarAvances}
                        onChange={handleEmailCheckChange}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-800">{t.tab5.notifyProgress}</span>
                        <span className="text-[11px] text-slate-500">{t.tab5.notifyProgressSub}</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="avisarCotizacion"
                        checked={emailConfig.avisarCotizacion}
                        onChange={handleEmailCheckChange}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <span className="block text-xs font-extrabold text-slate-800">{t.tab5.notifyQuote}</span>
                        <span className="text-[11px] text-slate-500">{t.tab5.notifyQuoteSub}</span>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              {/* BLOQUE 3: REMITENTE Y COMPORTAMIENTO */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {t.tab5.senderTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t.tab5.senderSub}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-extrabold text-[10px] rounded-md shrink-0">
                    {t.tab5.senderBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                      {t.tab5.senderName}
                    </label>
                    <input
                      type="text"
                      name="nombreRemitente"
                      value={emailConfig.nombreRemitente}
                      onChange={handleEmailInputChange}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                      {t.tab5.replyTo}
                    </label>
                    <input
                      type="email"
                      name="correoResponder"
                      value={emailConfig.correoResponder}
                      onChange={handleEmailInputChange}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                      {t.tab5.customerEmailLang}
                    </label>
                    <select
                      name="idiomaCliente"
                      value={emailConfig.idiomaCliente}
                      onChange={handleEmailInputChange}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Español">{t.tab5.optEs}</option>
                      <option value="Inglés">{t.tab5.optEn}</option>
                      <option value="Usar el idioma de documentos para clientes">{t.tab5.optUseDoc}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-500 mb-1.5">
                      {t.tab5.maxRecipients}
                    </label>
                    <input
                      type="number"
                      name="maxDestinatarios"
                      value={emailConfig.maxDestinatarios}
                      onChange={handleEmailInputChange}
                      className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* Botones de acción del formulario */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <span>💾</span> {t.tab5.btnSave}
                  </button>

                  <button
                    type="button"
                    onClick={() => alert(t.tab5.quotaAlert)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>✉️</span> {t.tab5.btnCheckQuota}
                  </button>
                </div>
              </div>
            </form>

            {/* BLOQUE 4: HISTORIAL DE CORREOS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {t.tab5.historyTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t.tab5.historySub}
                  </p>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 font-extrabold text-[11px] rounded-full">
                  {filteredHistory.length} {t.tab5.recordsCount}
                </span>
              </div>

              {/* Buscador y filtro de historial */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder={t.tab5.searchPlaceholder}
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Todos los resultados">{t.tab5.filterAll}</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Omitido">Omitido</option>
                  <option value="Error">Error</option>
                </select>
              </div>

              {/* Tabla del Historial */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">{t.tab5.headers[0]}</th>
                      <th className="py-3 px-4">{t.tab5.headers[1]}</th>
                      <th className="py-3 px-4">{t.tab5.headers[2]}</th>
                      <th className="py-3 px-4">{t.tab5.headers[3]}</th>
                      <th className="py-3 px-4">{t.tab5.headers[4]}</th>
                      <th className="py-3 px-4">{t.tab5.headers[5]}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                          {item.fecha}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {item.evento}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold whitespace-nowrap">
                          {item.referencia}
                        </td>
                        <td className="py-3 px-4 text-[11px] space-y-0.5">
                          {item.destinatarios.map((dest, i) => (
                            <div key={i} className="text-slate-600 font-mono">
                              {dest}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                            {item.resultado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {item.detalle}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* 6. RESPALDO E IMPORTACIÓN */}
        {activeTab === 6 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
            
            {/* Encabezado con badge púrpura */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t.tab6.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {t.tab6.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 font-extrabold text-[11px] rounded-md">
                {t.tab6.badgeFormat}
              </span>
            </div>

            {/* Input de archivo oculto para la importación */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />

            {/* BLOQUES INFORMATIVOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50/70 border-l-4 border-emerald-500 rounded-2xl space-y-1">
                <h4 className="text-xs font-extrabold text-emerald-950">{t.tab6.exportTitle}</h4>
                <p className="text-[11px] font-medium text-emerald-900 leading-relaxed">
                  {t.tab6.exportDesc}
                </p>
              </div>

              <div className="p-4 bg-sky-50/70 border-l-4 border-sky-500 rounded-2xl space-y-1">
                <h4 className="text-xs font-extrabold text-sky-950">{t.tab6.importTitle}</h4>
                <p className="text-[11px] font-medium text-sky-900 leading-relaxed">
                  {t.tab6.importDesc}
                </p>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>🡻</span> {t.tab6.btnExport}
              </button>

              <button
                type="button"
                onClick={handleTriggerImport}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>🡹</span> {t.tab6.btnImport}
              </button>
            </div>

            {/* BANNER INFORMATIVO INFERIOR */}
            <div className="p-3.5 bg-amber-50/70 border-l-4 border-amber-500 rounded-xl text-xs text-amber-950 font-medium leading-relaxed">
              {t.tab6.footerNotice}
            </div>
          </div>
        )}

        {/* 7. REINICIO DEL SISTEMA */}
        {activeTab === 7 && (
          <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-6 animate-fadeIn">
            
            {/* Encabezado con título en rojo y badge "Zona de riesgo" */}
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div>
                <h3 className="text-base font-extrabold text-rose-800">
                  {t.tab7.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {t.tab7.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-rose-100 text-rose-700 font-extrabold text-[11px] rounded-md uppercase tracking-wide">
                {t.tab7.badgeRisk}
              </span>
            </div>

            {/* Banner Rojo de Advertencia */}
            <div className="p-4 bg-rose-50/70 border-l-4 border-rose-600 rounded-2xl space-y-1">
              <h4 className="text-xs font-extrabold text-rose-950">{t.tab7.warnTitle}</h4>
              <p className="text-xs font-medium text-rose-900 leading-relaxed">
                {t.tab7.warnDesc}
              </p>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <span>🡻</span> {t.tab7.btnExportBefore}
              </button>

              <button
                type="button"
                onClick={handleResetSystem}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>🗑️</span> {t.tab7.btnResetSystem}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuration;