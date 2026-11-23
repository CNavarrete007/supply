import React, { useState, useRef, useEffect } from 'react';
import { getSettings, getEmailLog, SETTINGS_LOGO_URL } from './settings/api';
import { identityFrom, paramsFrom, approvalFrom, conditionsFrom, emailFrom, changedFields, changedConditions, fieldLabel, validateIdentity, validateParams, validateApprovals,
  validateConditions, validateEmail, approvalWarnings, saveResult, statusTone, utcText, recipientLines, exportConfig, importCheck, MAX_CONDITIONS, EMAIL_LANGS, TOTAL_BASES } from './settings/settingsModel.mjs';

// DICCIONARIO DE TRADUCCIONES
const TEXTS = {
  es: {
    headerTitle: "Configuración",
    headerSubtitle: "Administra tu cuenta, preferencias y configuración general del sistema.",
    statusLoading: "Cargando la configuración registrada en MariaDB...",
    statusError: "No se pudo leer la configuración de MariaDB.",
    statusReady: "Datos de MariaDB (solo lectura)",
    statusReadyNote: "Los valores provienen de organization_settings. \"Guardar\" valida los datos, pero no los guarda: la escritura de configuración aún no está autorizada.",
    retry: "Reintentar",
    loadFirst: "Espera a que se cargue la configuración de MariaDB antes de continuar.",
    updatedText: "Última actualización: {0} · {1}",
    unknownUser: "usuario no registrado",
    noRecord: "Sin registro de actualización",
    tabs: [
      { id: 1, title: 'Identidad y formatos', description: 'Logotipo, nombre, textos e idioma de documentos.', emoji: '🎨' },
      { id: 2, title: 'Matriz de parámetros', description: 'Moneda, prefijos, alertas, cotizaciones mínimas e IVA.', emoji: '📋' },
      { id: 3, title: 'Aprobaciones de cotización', description: 'Límites por artículo y total; solo administradores.', emoji: '✅' },
      { id: 4, title: 'Condiciones de cotización', description: 'Comentarios predeterminados ES / EN del PDF para el cliente.', emoji: '📝' },
      { id: 5, title: 'Correos automáticos', description: 'Avisos internos, comunicaciones al cliente e historial de envíos.', emoji: '✉️' },
      { id: 6, title: 'Respaldo e importación', description: 'Exporta la configuración leída; el respaldo completo es de la base de datos.', emoji: '💾' },
      { id: 7, title: 'Reinicio del sistema', description: 'Limpia los datos guardados en este navegador; no toca MariaDB.', emoji: '🗑️' }
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
      btnSave: "Guardar identidad e idiomas"
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
      btnSave: "Guardar parámetros"
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
      btnSave: "Guardar límites de aprobación"
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
      confirmReset: "¿Deseas restablecer las condiciones registradas en MariaDB? Se descartarán los cambios no guardados de esta pestaña.",
      newEs: "Nueva condición comercial.",
      newEn: "New commercial condition.",
      emptyList: "No hay condiciones registradas en MariaDB."
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
      senderBadge: "Sin servicio de correo conectado",
      senderName: "Nombre del remitente",
      replyTo: "Correo para responder",
      customerEmailLang: "Idioma de correos al cliente",
      optEs: "Español",
      optEn: "Inglés",
      optUseDoc: "Usar el idioma de documentos para clientes",
      maxRecipients: "Máximo de destinatarios por evento",
      btnSave: "Guardar correos automáticos",
      btnCheckQuota: "Consultar cuota disponible",
      quotaAlert: "No hay un servicio de envío de correos conectado a SupplyFlow; la cuota del original (MailApp de Google) no aplica. El historial muestra los envíos registrados en MariaDB.",
      historyLoading: "Cargando historial de correos...",
      historyError: "No se pudo leer el historial de correos.",
      historyEmpty: "No hay correos registrados con estos filtros.",
      pageText: "Página {0} de {1}",
      prev: "Anterior",
      next: "Siguiente",
      historyTitle: "Historial de correos",
      historySub: "Registra evento, destinatarios, resultado y fecha. El contenido confidencial no se almacena.",
      recordsCount: "registros",
      searchPlaceholder: "Buscar por evento, folio, destinatario o resultado...",
      filterAll: "Todos los resultados",
      headers: ["FECHA", "EVENTO", "REFERENCIA", "DESTINATARIOS", "RESULTADO", "DETALLE"]
    },
    tab6: {
      title: "Respaldo e importación de datos",
      subtitle: "La información del sistema está en MariaDB; aquí solo se exporta la configuración leída.",
      badgeFormat: "MariaDB + Archivo JSON",
      exportTitle: "Exportar respaldo",
      exportDesc: "Descarga en JSON la configuración leída de MariaDB (identidad, parámetros, aprobaciones, condiciones y correos). No incluye datos comerciales, contraseñas ni archivos.",
      importTitle: "Importar respaldo",
      importDesc: "Verifica un archivo JSON exportado desde esta pantalla y muestra su contenido. No se aplica: restaurar o modificar la configuración requiere autorización.",
      btnExport: "Exportar respaldo",
      btnImport: "Verificar archivo",
      footerNotice: "El respaldo completo de la base (datos, cuentas y permisos) se hace con el procedimiento de respaldo de MariaDB del entorno (INT03), fuera de esta pantalla y guardado en el directorio privado, nunca en el proyecto.",
      exportDone: "Configuración exportada. El archivo contiene solo lo que se leyó de MariaDB.",
      invalidJson: "Por favor selecciona un archivo válido en formato .JSON",
      confirmImport: "¿Estás seguro de que deseas importar \"{0}\"?\nEsta acción reemplazará los datos actuales de la base compartida.",
      importSuccess: "¡Respaldo importado correctamente!",
      jsonError: "El archivo seleccionado contiene un formato JSON inválido."
    },
    tab7: {
      title: "Reinicio del sistema",
      subtitle: "Limpia los datos que este navegador guarda localmente (preferencias y borradores). No elimina registros de MariaDB.",
      badgeRisk: "Zona de riesgo",
      warnTitle: "Advertencia:",
      warnDesc: "Esta acción solo borra el almacenamiento local de este navegador (idioma, preferencias y borradores sin enviar). Clientes, proveedores, requisiciones, cotizaciones, órdenes, recepciones, facturas, bitácora y configuración viven en MariaDB y no se modifican.",
      btnExportBefore: "Exportar configuración",
      btnResetSystem: "Limpiar datos de este navegador",
      confirmFirst: "⚠️ ZONA DE RIESGO\n\n¿Deseas borrar los datos locales de este navegador (preferencias y borradores sin enviar)?\nLos registros de MariaDB no se modifican.",
      promptConfirm: "Para confirmar esta acción irreversible, escribe \"REINICIAR\" a continuación:",
      keyword: "REINICIAR",
      resetSuccess: "Se limpiaron los datos locales de este navegador. Los registros de MariaDB no se modificaron.",
      resetError: "Texto de confirmación incorrecto. El proceso de reinicio ha sido cancelado."
    }
  },
  en: {
    headerTitle: "Settings",
    headerSubtitle: "Manage your account, preferences, and general system settings.",
    statusLoading: "Loading the settings stored in MariaDB...",
    statusError: "The settings could not be read from MariaDB.",
    statusReady: "MariaDB data (read-only)",
    statusReadyNote: "Values come from organization_settings. \"Save\" validates the data but does not store it: settings writes are not authorized yet.",
    retry: "Retry",
    loadFirst: "Wait for the MariaDB settings to load before continuing.",
    updatedText: "Last update: {0} · {1}",
    unknownUser: "unregistered user",
    noRecord: "No update record",
    tabs: [
      { id: 1, title: 'Identity & Formats', description: 'Logo, name, text, and document language.', emoji: '🎨' },
      { id: 2, title: 'Parameters Matrix', description: 'Currency, prefixes, alerts, minimum quotes, and VAT.', emoji: '📋' },
      { id: 3, title: 'Quote Approvals', description: 'Per-item and total limits; admins only.', emoji: '✅' },
      { id: 4, title: 'Quote Conditions', description: 'Default ES / EN PDF comments for the customer.', emoji: '📝' },
      { id: 5, title: 'Automatic Emails', description: 'Internal notices, customer communications, and dispatch log.', emoji: '✉️' },
      { id: 6, title: 'Backup & Import', description: 'Export the loaded settings; full backups belong to the database.', emoji: '💾' },
      { id: 7, title: 'System Reset', description: 'Clears data stored in this browser; MariaDB is untouched.', emoji: '🗑️' }
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
      btnSave: "Save Identity & Languages"
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
      btnSave: "Save Parameters"
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
      btnSave: "Save Approval Limits"
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
      confirmReset: "Restore the conditions stored in MariaDB? Unsaved changes in this tab will be discarded.",
      newEs: "Nueva condición comercial.",
      newEn: "New commercial condition.",
      emptyList: "There are no conditions stored in MariaDB."
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
      senderBadge: "No mail service connected",
      senderName: "Sender Name",
      replyTo: "Reply-to Email",
      customerEmailLang: "Customer Email Language",
      optEs: "Spanish",
      optEn: "English",
      optUseDoc: "Use customer document language",
      maxRecipients: "Max recipients per event",
      btnSave: "Save Automatic Emails",
      btnCheckQuota: "Check Available Quota",
      quotaAlert: "No mail delivery service is connected to SupplyFlow; the original quota (Google MailApp) does not apply. The log shows the deliveries stored in MariaDB.",
      historyLoading: "Loading email log...",
      historyError: "The email log could not be read.",
      historyEmpty: "No emails match these filters.",
      pageText: "Page {0} of {1}",
      prev: "Previous",
      next: "Next",
      historyTitle: "Email History",
      historySub: "Logs event, recipients, outcome, and date. Confidential content is not stored.",
      recordsCount: "records",
      searchPlaceholder: "Search by event, folio, recipient, or outcome...",
      filterAll: "All outcomes",
      headers: ["DATE", "EVENT", "REFERENCE", "RECIPIENTS", "OUTCOME", "DETAIL"]
    },
    tab6: {
      title: "Data Backup and Import",
      subtitle: "System data lives in MariaDB; this only exports the loaded settings.",
      badgeFormat: "MariaDB + JSON File",
      exportTitle: "Export Backup",
      exportDesc: "Downloads the settings read from MariaDB (identity, parameters, approvals, conditions and emails) as JSON. No commercial data, passwords or files.",
      importTitle: "Import Backup",
      importDesc: "Checks a JSON file exported from this screen and shows its content. It is not applied: restoring or changing settings requires authorization.",
      btnExport: "Export Backup",
      btnImport: "Check file",
      footerNotice: "Full database backups (data, accounts and grants) use the environment's MariaDB backup procedure (INT03), outside this screen and stored in the private directory, never in the project.",
      exportDone: "Settings exported. The file only contains what was read from MariaDB.",
      invalidJson: "Please select a valid file in .JSON format",
      confirmImport: "Are you sure you want to import \"{0}\"?\nThis action will replace current data in the shared database.",
      importSuccess: "Backup imported successfully!",
      jsonError: "The selected file contains an invalid JSON format."
    },
    tab7: {
      title: "System Reset",
      subtitle: "Clears the data this browser stores locally (preferences and drafts). MariaDB records are not deleted.",
      badgeRisk: "Risk Zone",
      warnTitle: "Warning:",
      warnDesc: "This only clears this browser's local storage (language, preferences and unsent drafts). Clients, suppliers, requisitions, quotes, orders, receptions, invoices, audit log and settings live in MariaDB and are not changed.",
      btnExportBefore: "Export settings",
      btnResetSystem: "Clear this browser's data",
      confirmFirst: "⚠️ RISK ZONE\n\nClear this browser's local data (preferences and unsent drafts)?\nMariaDB records are not changed.",
      promptConfirm: "To confirm this irreversible action, type \"RESET\" below:",
      keyword: "RESET",
      resetSuccess: "This browser's local data was cleared. MariaDB records were not changed.",
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

  // --- DATOS DE MARIADB (solo lectura): GET /api/v1/settings ---
  // Los formularios se llenan con lo registrado en organization_settings; "Guardar" valida y no guarda.
  const [load, setLoad] = useState({ status: 'loading', data: null, error: null });
  const [reload, setReload] = useState(0);
  const [orig, setOrig] = useState(null);
  const [msg, setMsg] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoMissing, setLogoMissing] = useState(false);
  const settings = load.data;
  const currencies = settings?.currencies || [];
  const ready = load.status === 'ready';
  const setTabMsg = (section, m) => setMsg(prev => ({ ...prev, [section]: m }));

  // --- ESTADOS DE TARJETA 1 (IDENTIDAD Y FORMATOS) ---
  const [identityForm, setIdentityForm] = useState(identityFrom(null));

  const handleIdentityChange = (e) => {
    const { name, value } = e.target;
    setIdentityForm((prev) => ({ ...prev, [name]: value }));
    setTabMsg('identity', null);
  };

  // Logotipo: vista previa local; no se sube (la escritura no está autorizada).
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file); setLogoRemoved(false); setTabMsg('identity', null);
    const reader = new FileReader();
    reader.onloadend = () => setIdentityForm((prev) => ({ ...prev, logotipoUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setIdentityForm((prev) => ({ ...prev, logotipoUrl: null }));
    setLogoFile(null); setLogoRemoved(true); setTabMsg('identity', null);
  };

  const finishSave = (section, title, err, changes) => {
    if (!ready) { setTabMsg(section, { kind: 'error', text: t.loadFirst }); return; }
    if (err) { setTabMsg(section, { kind: 'error', text: err.message, field: err.field }); return; }
    const r = saveResult(section, changes);
    setTabMsg(section, r);
    if (onNotify && r.kind === 'locked') onNotify(title, r.text, 'warning');
  };

  const handleSaveIdentity = (e) => {
    e.preventDefault();
    const { logotipoUrl, ...fields } = identityForm;
    const { logotipoUrl: _o, ...origFields } = orig?.identity || {};
    const changes = [...changedFields(origFields, fields), ...(logoFile || logoRemoved ? [fieldLabel('logotipoUrl')] : [])];
    finishSave('identity', t.tab1.visualTitle, validateIdentity(identityForm, { logoFile }), changes);
  };

  // --- ESTADOS DE TARJETA 2 (MATRIZ DE PARÁMETROS) ---
  const [paramsForm, setParamsForm] = useState(paramsFrom(null));

  const handleParamsChange = (e) => {
    const { name, value } = e.target;
    setParamsForm((prev) => ({ ...prev, [name]: value }));
    setTabMsg('params', null);
  };

  const handleSaveParams = (e) => {
    e.preventDefault();
    finishSave('params', t.tab2.title, validateParams(paramsForm, currencies), changedFields(orig?.params, paramsForm));
  };

  // --- ESTADOS DE TARJETA 3 (APROBACIONES DE COTIZACIÓN) ---
  const [approvalForm, setApprovalForm] = useState(approvalFrom(null));

  const handleApprovalChange = (e) => {
    const { name, value } = e.target;
    setApprovalForm((prev) => ({ ...prev, [name]: value }));
    setTabMsg('approvals', null);
  };

  const handleSaveApprovals = (e) => {
    e.preventDefault();
    finishSave('approvals', t.tab3.title, validateApprovals(approvalForm, currencies), changedFields(orig?.approvals, approvalForm));
  };
  const policy = settings?.approvals?.policy || null;
  const approvalNotes = ready ? approvalWarnings(approvalForm, policy) : [];

  // --- ESTADOS DE TARJETA 4 (condiciones registradas en MariaDB) ---
  const [conditions, setConditions] = useState([]);
  const touchConditions = () => setTabMsg('conditions', null);

  const handleToggleCondition = (id) => {
    setConditions((prev) => prev.map((item) => (item.id === id ? { ...item, activa: !item.activa } : item)));
    touchConditions();
  };

  const handleConditionTextChange = (id, field, value) => {
    setConditions((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    touchConditions();
  };

  // Agregar nueva condición (máximo 8)
  const handleAddCondition = () => {
    if (conditions.length >= MAX_CONDITIONS) {
      setTabMsg('conditions', { kind: 'error', text: t.tab4.alertMax });
      return;
    }
    setConditions((prev) => [...prev, { id: Date.now(), activa: true, es: t.tab4.newEs, en: t.tab4.newEn }]);
    touchConditions();
  };

  const handleDeleteCondition = (id) => {
    setConditions((prev) => prev.filter((item) => item.id !== id));
    touchConditions();
  };

  // Restablecer: vuelve a las condiciones registradas en MariaDB.
  const handleResetConditions = () => {
    if (window.confirm(t.tab4.confirmReset)) {
      setConditions(orig?.conditions || []);
      touchConditions();
    }
  };

  const handleSaveConditions = (e) => {
    e.preventDefault();
    finishSave('conditions', t.tab4.title, validateConditions(conditions), changedConditions(orig?.conditions, conditions));
  };

  const activeCount = conditions.filter((c) => c.activa).length;

  // --- ESTADOS DE TARJETA 5 (CORREOS AUTOMÁTICOS) ---
  const [emailConfig, setEmailConfig] = useState(emailFrom(null));

  // Historial real (email_delivery_logs): búsqueda y filtro en el servidor, 10 por página.
  const [searchHistory, setSearchHistory] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState({ status: 'loading', data: null, error: null });

  const handleEmailCheckChange = (e) => {
    const { name, checked } = e.target;
    setEmailConfig((prev) => ({ ...prev, [name]: checked }));
    setTabMsg('email', null);
  };

  const handleEmailInputChange = (e) => {
    const { name, value } = e.target;
    setEmailConfig((prev) => ({ ...prev, [name]: value }));
    setTabMsg('email', null);
  };

  const handleSaveEmails = (e) => {
    e.preventDefault();
    finishSave('email', t.tab5.historyTitle, validateEmail(emailConfig), changedFields(orig?.email, emailConfig));
  };

  // --- TARJETA 6: exportar la configuración leída de MariaDB; importar solo verifica el archivo ---
  const fileInputRef = useRef(null);

  const handleExportBackup = (section = 'backup') => {
    if (!ready) { setTabMsg(section, { kind: 'error', text: t.loadFirst }); return; }
    const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportConfig(settings), null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Configuracion_SupplyFlow_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTabMsg(section, { kind: 'info', text: t.tab6.exportDone });
  };

  const handleTriggerImport = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setTabMsg('backup', { kind: 'error', text: t.tab6.invalidJson });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const r = importCheck(String(event.target.result || ''));
      setTabMsg('backup', { kind: r.ok ? 'locked' : 'error', text: r.message });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- TARJETA 7: solo limpia el almacenamiento local de este navegador (no toca MariaDB) ---
  const handleResetSystem = () => {
    const confirmFirst = window.confirm(t.tab7.confirmFirst);
    if (confirmFirst) {
      const confirmSecond = window.prompt(t.tab7.promptConfirm);
      if (confirmSecond === t.tab7.keyword) {
        try { localStorage.clear(); } catch { /* almacenamiento no disponible */ }
        setTabMsg('reset', { kind: 'info', text: t.tab7.resetSuccess });
      } else if (confirmSecond !== null) {
        setTabMsg('reset', { kind: 'error', text: t.tab7.resetError });
      }
    }
  };

  useEffect(() => {
    const c = new AbortController();
    setLoad((l) => ({ ...l, status: 'loading', error: null }));
    getSettings(c.signal).then((d) => {
      if (c.signal.aborted) return;
      const o = { identity: identityFrom(d), params: paramsFrom(d), approvals: approvalFrom(d), conditions: conditionsFrom(d), email: emailFrom(d) };
      setOrig(o); setIdentityForm(o.identity); setParamsForm(o.params); setApprovalForm(o.approvals); setConditions(o.conditions); setEmailConfig(o.email);
      setLogoFile(null); setLogoRemoved(false); setLogoMissing(false); setMsg({});
      setLoad({ status: 'ready', data: d, error: null });
    }).catch((e) => { if (!c.signal.aborted) setLoad({ status: 'error', data: null, error: e }); });
    return () => c.abort();
  }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setTimeout(() => { if (searchHistory.trim() !== historyQuery) { setHistoryQuery(searchHistory.trim()); setHistoryPage(1); } }, 300);
    return () => clearTimeout(id);
  }, [searchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 5) return undefined;
    const c = new AbortController();
    setHistory((h) => ({ ...h, status: 'loading', error: null }));
    getEmailLog({ q: historyQuery, status: filterStatus, page: historyPage, page_size: 10 }, c.signal)
      .then((d) => { if (!c.signal.aborted) setHistory({ status: 'ready', data: d, error: null }); })
      .catch((e) => { if (!c.signal.aborted) setHistory((h) => ({ ...h, status: 'error', error: e })); });
    return () => c.abort();
  }, [activeTab, historyQuery, filterStatus, historyPage, reload]);
  const historyRows = history.data?.items || [];
  const historyPages = Math.max(1, Math.ceil((history.data?.total || 0) / 10));

  const saveMsg = (section) => {
    const m = msg[section];
    if (!m) return null;
    const tone = m.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : m.kind === 'locked' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-800';
    return <div role={m.kind === 'error' ? 'alert' : 'status'} data-testid={`cfg-msg-${section}`} className={`rounded-xl border px-4 py-2.5 text-[12px] font-semibold ${tone}`}>{m.kind === 'locked' ? '🔒 ' : ''}{m.text}</div>;
  };
  const metaOf = group => settings?.meta?.[group] || null;
  const metaText = group => { const m = metaOf(group); return m && (m.updated_at || m.updated_by) ? t.updatedText.replace('{0}', utcText(m.updated_at, isEn)).replace('{1}', m.updated_by || t.unknownUser) : t.noRecord; };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div>
        <h2 className="text-2xl font-black text-slate-900">{t.headerTitle}</h2>
        <p className="text-xs text-slate-500 font-medium">
          {t.headerSubtitle}
        </p>
      </div>

      {/* Estado de la lectura de MariaDB */}
      {load.status === 'loading' && (
        <div role="status" data-testid="cfg-status" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600">⏳ {t.statusLoading}</div>
      )}
      {load.status === 'error' && (
        <div role="alert" data-testid="cfg-status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <span><b>{t.statusError}</b> {load.error?.message || ''}</span>
          {![401, 403].includes(load.error?.status) && (
            <button type="button" onClick={() => setReload((n) => n + 1)} className="shrink-0 rounded-xl bg-rose-600 px-4 py-2 font-extrabold text-white hover:bg-rose-700 cursor-pointer">{t.retry}</button>
          )}
        </div>
      )}
      {ready && (
        <div role="status" data-testid="cfg-status" className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
          <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">{t.statusReady}</span>
          <span className="font-medium leading-relaxed">{t.statusReadyNote}</span>
        </div>
      )}

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
      {/* text-xs en el contenedor: la regla global "font: inherit" de index.css hace que campos y botones hereden este tamaño. */}
      <div className="pt-2 animate-fadeIn transition-all duration-300 text-xs">
        
        {/* 1. IDENTIDAD Y FORMATOS */}
        {activeTab === 1 && (
          <form noValidate onSubmit={handleSaveIdentity} className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
            
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
                      ) : ready && settings.identity?.logo?.configured && !logoRemoved && !logoMissing ? (
                        <img
                          src={SETTINGS_LOGO_URL}
                          alt="Logotipo Principal"
                          data-testid="cfg-logo"
                          onError={() => setLogoMissing(true)}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">
                          {ready && settings.identity?.logo?.configured && !logoRemoved ? (isEn ? 'Registered logo; file not available on this computer' : 'Logotipo registrado; archivo no disponible en este equipo') : t.tab1.noLogo}
                        </span>
                      )}
                    </div>

                    {/* Inputs & Botón Eliminar */}
                    <div className="space-y-2 w-full">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
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
                      <option value="" disabled>{isEn ? 'Not defined' : 'Sin definir'}</option>
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
                      <option value="" disabled>{isEn ? 'Not defined' : 'Sin definir'}</option>
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
                      <option value="" disabled>{isEn ? 'Not defined' : 'Sin definir'}</option>
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
              <p className="text-[10px] font-medium text-slate-400">{metaText('legacy_branding')}</p>
              {saveMsg('identity')}
            </div>

          </form>
        )}

        {/* 2. MATRIZ DE PARÁMETROS */}
        {activeTab === 2 && (
          <form noValidate onSubmit={handleSaveParams} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
            
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
                  {!currencies.some((c) => c.code === paramsForm.monedaBase) && <option value={paramsForm.monedaBase} disabled>{paramsForm.monedaBase || (isEn ? 'Not defined' : 'Sin definir')}</option>}
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
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
            <p className="text-[10px] font-medium text-slate-400">{metaText('legacy_purchasing')}</p>
            {saveMsg('params')}

          </form>
        )}

        {/* 3. APROBACIONES DE COTIZACIÓN */}
        {activeTab === 3 && (
          <form noValidate onSubmit={handleSaveApprovals} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
            
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

            {ready && (
              <div data-testid="cfg-policy" className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed space-y-1">
                {policy ? (
                  <p><span className="font-extrabold text-slate-900">{isEn ? 'Versioned policy in force' : 'Política versionada vigente'} v{policy.version_number}</span>{' · '}
                    {isEn ? 'item' : 'artículo'} {policy.unit_price_limit ?? '—'} · {isEn ? 'total' : 'total'} {policy.document_limit ?? '—'} {policy.currency || ''}{' · '}
                    {isEn ? 'effective' : 'vigente desde'} {utcText(policy.effective_from, isEn)}</p>
                ) : (
                  <p>{isEn ? 'No versioned customer-quote policy is registered (approval_policy_versions).' : 'No hay una política versionada de cotización al cliente registrada (approval_policy_versions).'}</p>
                )}
                <p className="text-slate-500">{isEn ? 'Total base' : 'Base del total'}: {TOTAL_BASES[settings.approvals?.total_base] || settings.approvals?.total_base || '—'}{' · '}{metaText('legacy_quote_policy')}</p>
                {approvalNotes.map((w) => <p key={w} className="font-semibold text-amber-800">⚠ {w}</p>)}
              </div>
            )}

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
                  <option value="" disabled>{isEn ? 'Not defined' : 'Sin definir'}</option>
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
                  {!currencies.some((c) => c.code === approvalForm.monedaRegla) && <option value={approvalForm.monedaRegla} disabled>{approvalForm.monedaRegla || (isEn ? 'Not defined' : 'Sin definir')}</option>}
                  {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                </select>
              </div>

              {/* Límite por artículo */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                  {t.tab3.itemLimit}
                </label>
                <input
                  type="number"
                  step="0.01"
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
            {saveMsg('approvals')}

          </form>
        )}

        {/* 4. CONDICIONES DE COTIZACIÓN */}
        {activeTab === 4 && (
          <form noValidate onSubmit={handleSaveConditions} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-fadeIn">
            
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
                {ready && conditions.length === 0 && (
                  <p className="p-3 text-center text-xs font-medium text-slate-500">{t.tab4.emptyList}</p>
                )}
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
                        {c.es.replaceAll('{CURRENCY}', paramsForm.monedaBase || 'MXN')}
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
                        {c.en.replaceAll('{CURRENCY}', paramsForm.monedaBase || 'MXN')}
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
            <p className="text-[10px] font-medium text-slate-400">{metaText('legacy_quote_conditions')}</p>
            {saveMsg('conditions')}

          </form>
        )}

        {/* 5. CORREOS AUTOMÁTICOS */}
        {activeTab === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <form noValidate onSubmit={handleSaveEmails} className="space-y-6">
              
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
                      <option value="" disabled>{isEn ? 'Not defined' : 'Sin definir'}</option>
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
                    onClick={() => setTabMsg('email', { kind: 'info', text: t.tab5.quotaAlert })}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>✉️</span> {t.tab5.btnCheckQuota}
                  </button>
                </div>
                <p className="text-[10px] font-medium text-slate-400">{metaText('legacy_email')}</p>
                {saveMsg('email')}
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
                  {history.data?.total ?? 0} {t.tab5.recordsCount}
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
                  onChange={(e) => { setFilterStatus(e.target.value); setHistoryPage(1); }}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">{t.tab5.filterAll}</option>
                  {(history.data?.statuses || []).map((st) => <option key={st.status} value={st.status}>{st.status} ({st.count})</option>)}
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
                    {history.status === 'loading' && !historyRows.length && (
                      <tr><td colSpan={6} className="py-6 px-4 text-center text-slate-500">{t.tab5.historyLoading}</td></tr>
                    )}
                    {history.status === 'error' && (
                      <tr><td colSpan={6} role="alert" className="py-6 px-4 text-center text-rose-700 font-semibold">{t.tab5.historyError} {history.error?.message || ''}</td></tr>
                    )}
                    {history.status === 'ready' && !historyRows.length && (
                      <tr><td colSpan={6} className="py-6 px-4 text-center text-slate-500">{t.tab5.historyEmpty}</td></tr>
                    )}
                    {history.status !== 'error' && historyRows.map((item, idx) => {
                      const tone = { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-rose-100 text-rose-800', gray: 'bg-slate-100 text-slate-700' }[statusTone(item.status)];
                      return (
                        <tr key={`${item.occurred_at}-${item.reference}-${idx}`} data-testid="cfg-mail-row" className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                            {utcText(item.occurred_at, isEn)}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {item.event || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-semibold whitespace-nowrap">
                            {item.reference || '—'}
                          </td>
                          <td className="py-3 px-4 text-[11px] space-y-0.5">
                            {recipientLines(item.recipients).map((dest, i) => (
                              <div key={i} className="text-slate-600 font-mono break-all">
                                {dest}
                              </div>
                            ))}
                            {!item.recipients?.length && <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${tone}`}>
                              {item.status || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {item.detail || '—'}{item.attempt > 1 ? ` · ${isEn ? 'attempt' : 'intento'} ${item.attempt}` : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación del historial */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 font-medium">{t.tab5.pageText.replace('{0}', historyPage).replace('{1}', historyPages)}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={historyPage <= 1 || history.status === 'loading'} onClick={() => setHistoryPage((n) => Math.max(1, n - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{t.tab5.prev}</button>
                  <button type="button" disabled={historyPage >= historyPages || history.status === 'loading'} onClick={() => setHistoryPage((n) => Math.min(historyPages, n + 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{t.tab5.next}</button>
                </div>
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
                onClick={() => handleExportBackup('backup')}
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

            {saveMsg('backup')}

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
                onClick={() => handleExportBackup('reset')}
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
            {saveMsg('reset')}
          </div>
        )}
      </div>
    </div>
  );
};

export default Configuration;