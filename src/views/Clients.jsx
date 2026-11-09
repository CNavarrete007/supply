import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Lock, 
  Plus, 
  X, 
  Upload, 
  Trash2, 
  KeyRound, 
  Search, 
  Download, 
  Wand2, 
  Edit3, 
  ExternalLink,
  Table as TableIcon,
  CheckCircle2,
  Building2,
  Filter,
  FileSpreadsheet
} from 'lucide-react';

const translations = {
  es: {
    headerTitle: "Clientes",
    headerSubtitle: "Gestión y registro de clientes del sistema.",
    cards: {
      register: { title: 'Registro y actualización', desc: 'Alta de un cliente nuevo o modificación de sus datos.', emoji: '📝' },
      matrix: { title: 'Matriz de clientes', desc: 'Consulta, búsqueda, edición y eliminación de registros.', emoji: '📋' },
      indicators: { title: 'Indicadores de clientes', desc: 'Resumen de actividad, estatus y requisiciones relacionadas.', emoji: '📊' },
      import: { title: 'Importar Excel', desc: 'Carga masiva, validación previa y guardado en la base compartida.', emoji: '📥' },
    },
    registerTab: {
      title: "Alta y actualización de clientes",
      subtitle: "El número de cliente lo asigna manualmente el usuario y no puede repetirse.",
      step1: "Paso 1 - Datos generales",
      clientNumberLabel: "No. de cliente",
      newClientOption: "+ Nuevo cliente / captura manual",
      clientCodePlaceholder: "Ej. CLI-001, WDS-1001 o código interno",
      clientCodeHelp: "Selecciona un número registrado para cargar todos los datos del cliente. El número continuará editable.",
      companyNameLabel: "Razón social / Legal company name",
      newCompanyOption: "+ Nueva compañía / captura manual",
      companyNamePlaceholder: "Escribe o edita la razón social",
      companyNameHelp: "Selecciona una compañía registrada para cargar automáticamente No. de cliente, RFC, proyecto, contrato, contactos, correos y demás datos. Todos los campos seguirán editables.",
      commercialNameLabel: "Nombre comercial / Brand name",
      commercialNamePlaceholder: "Nombre con el que se identifica comercialmente",
      rfcLabel: "RFC / Tax ID",
      rfcPlaceholder: "RFC o ID fiscal",
      projectLabel: "Proyecto",
      projectPlaceholder: "Nombre del proyecto",
      contractLabel: "Número de contrato",
      contractPlaceholder: "Ej. CTR-2026-001",
      phoneLabel: "Teléfono",
      phonePlaceholder: "833-456-7890",
      contactsLabel: "Contactos",
      contactPlaceholder: "Nombre del contacto",
      addContact: "Agregar otro contacto",
      emailsLabel: "Correos electrónicos",
      emailPlaceholder: "correo@empresa.com",
      addEmail: "Agregar otro correo",
      statusLabel: "Estatus",
      portalAccessLabel: "Portal del cliente",
      portalKeyLabel: "Clave de acceso al portal",
      portalKeyPlaceholder: "Asigna una clave de 4 a 20 caracteres",
      generateEnableBtn: "Generar y habilitar",
      portalHelp: "El cliente utilizará su número de cliente y esta clave para consultar únicamente su proceso. Para permitir el acceso, el portal debe quedar en Habilitado y el cliente en estatus Activo.",
      addressLabel: "Dirección",
      commercialConditionsLabel: "Condiciones comerciales",
      commercialConditionsPlaceholder: "Ej. Crédito 30 días",
      logoLabel: "Logotipo del cliente",
      noLogo: "Sin logotipo",
      chooseFile: "Elegir archivo",
      noFileSelected: "No se ha seleccionado ningún archivo",
      allowedFormats: "Formatos permitidos: PNG, JPG o WEBP. La imagen se comprime antes de guardarse.",
      removeLogo: "Eliminar logotipo",
      observationsLabel: "Observaciones",
      saveBtn: "💾 Guardar cliente",
      cleanBtn: "🧹 Limpiar",
      viewMatrixBtn: "📋 Ver matriz",
      openPortalBtn: "🚀 Abrir Portal",
      statusActive: "Activo",
      statusInactive: "Inactivo",
      statusBlocked: "Bloqueado",
      portalEnabled: "Habilitado",
      portalDisabled: "Deshabilitado"
    },
    matrixTab: {
      title: "Matriz de clientes",
      subtitle: "Los registros se muestran en una sección independiente del formulario de alta.",
      importExcelBtn: "Importar Excel",
      newClientBtn: "Nuevo cliente",
      searchPlaceholder: "Buscar por número, razón social, nombre comercial, proyecto, contrato, RFC, contacto o correo...",
      allStatus: "Todos los estatus",
      thLogo: "Logo",
      thNo: "No.",
      thCompanyBrand: "Razón Social / Marca",
      thProject: "Proyecto",
      thContract: "No. Contrato",
      thRfc: "RFC",
      thContactsEmails: "Contactos y Correos",
      thStatus: "Estatus",
      thPortal: "Portal",
      thRequisitions: "Requisiciones",
      thActions: "Acciones",
      noDataTitle: "No hay clientes registrados en la matriz.",
      noDataDesc: "Agrega uno nuevo desde el formulario de registro o mediante importación.",
      noContact: "Sin contacto",
      editBtn: "Editar",
      portalBtn: "PORTAL"
    },
    indicatorsTab: {
      title: "Indicadores de clientes",
      subtitle: "Resumen independiente calculado con la información registrada.",
      consultMatrixBtn: "📋 Consultar matriz",
      activeClients: "Clientes activos",
      totalRegistered: "Total registrados",
      highestActivity: "Mayor actividad:",
      requisitions: "requisiciones",
      noActivityData: "Sin datos de actividad aún.",
      catalogUsage: "Uso del catálogo",
      catalogUsageDesc: "Relación con requisiciones.",
      catalogUsageInfo: "Cada requisición debe quedar asociada con un número de cliente previamente registrado y activo.",
      recommendedControl: "Control recomendado",
      recommendedControlDesc: "Evita duplicidades.",
      recommendedControlInfo: "El sistema valida el número de cliente sin distinguir mayúsculas y minúsculas.",
      clientStatusTitle: "Estatus del cliente",
      clientStatusDesc: "Disponibilidad operativa.",
      clientStatusInfo: "Solo los clientes activos aparecen para crear nuevas requisiciones."
    },
    importTab: {
      title: "Importación masiva de clientes desde Excel",
      subtitle: "Analiza el archivo, valida duplicados y guarda los registros en la misma base compartida que utiliza el formulario manual.",
      formatsBadge: "Excel / XLSX / XLS / CSV",
      dropTitle: "Selecciona o arrastra el archivo de clientes",
      dropDesc: "Se utiliza la primera hoja del libro. El archivo no reemplaza la base completa; solamente agrega o actualiza clientes.",
      selectFileBtn: "Seleccionar archivo",
      noFileSelected: "Ningún archivo seleccionado.",
      recognizedColsTitle: "Columnas reconocidas:",
      recognizedColsDesc: "Client number, Legal / company name, Brand name, RFC, Email y Contact. También se reconocen Email 2, Email 3, Contact 2, Contact 3, Project y Contract number. Una misma celda puede contener varios valores separados por punto y coma, coma, barra vertical o salto de línea. Conserva Client number y RFC como texto en Excel para no perder ceros iniciales.",
      editableImportTitle: "Importación editable:",
      editableImportDesc: "las filas con datos faltantes ya no se rechazan. Se guardan como registros incompletos e inactivos, aparecen en la Matriz de clientes y pueden abrirse con Editar para completar o corregir la información.",
      rulesTitle: "Reglas para la importación",
      defaultProjectLabel: "Proyecto predeterminado (opcional)",
      defaultProjectPlaceholder: "Se aplica cuando la fila no incluye Project",
      defaultProjectHelp: "Si permanece vacío, el cliente se importará como incompleto para editarlo posteriormente.",
      defaultContractLabel: "Número de contrato predeterminado (opcional)",
      defaultContractPlaceholder: "Se aplica cuando la fila no incluye Contract number",
      defaultContractHelp: "Si permanece vacío, el cliente se importará como incompleto para editarlo posteriormente.",
      duplicateTreatmentLabel: "Tratamiento de números de cliente existentes",
      skipDuplicates: "Omitir duplicados existentes",
      updateDuplicates: "Actualizar registros existentes",
      newStatusLabel: "Estatus para clientes nuevos",
      newPortalLabel: "Portal para clientes nuevos",
      newPortalHelp: "Si se habilita, el cliente se guarda sin clave y deberá configurarse posteriormente desde Editar.",
      downloadTemplateBtn: "Descargar plantilla",
      cleanBtn: "✏️ Limpiar",
      previewTitle: "Vista previa de datos detectados en el archivo",
      previewSubtitle: (count) => `Se detectaron ${count} fila(s) de información listas para procesarse.`,
      fileCorrectBadge: "Archivo estructurado correctamente"
    },
    notifications: {
      moduleTitle: "Módulo Clientes",
      navigatingTo: (tab) => `Navegando a: ${tab}`,
      excelImporter: "Importador Excel",
      fileLoaded: (count) => `Archivo cargado correctamente (${count} registros).`,
      loadErrorTitle: "Error de Carga",
      loadErrorMsg: "Ocurrió un error al leer el archivo Excel.",
      formCleaned: "Formulario y vista previa limpiados.",
      attention: "Atención",
      selectExcelFirst: "Por favor, selecciona primero un archivo Excel.",
      logoTitle: "Gestión de Logo",
      logoAttached: (name) => `Logo "${name}" adjuntado correctamente.`,
      registerTitle: "Registro de Cliente",
      enterCompanyName: "Ingrese la Razón Social del cliente.",
      successRegister: "Registro Exitoso",
      clientRegistered: (name) => `Cliente "${name}" registrado en el sistema.`
    }
  },
  en: {
    headerTitle: "Clients",
    headerSubtitle: "System client management and registration.",
    cards: {
      register: { title: 'Registration & Update', desc: 'Add a new client or update existing details.', emoji: '📝' },
      matrix: { title: 'Client Matrix', desc: 'Query, search, edit, and delete client records.', emoji: '📋' },
      indicators: { title: 'Client Metrics', desc: 'Activity summary, status, and linked requisitions.', emoji: '📊' },
      import: { title: 'Import Excel', desc: 'Bulk import, pre-validation, and shared database saving.', emoji: '📥' },
    },
    registerTab: {
      title: "Client Registration and Update",
      subtitle: "The client number is manually assigned by the user and cannot be duplicated.",
      step1: "Step 1 - General Information",
      clientNumberLabel: "Client No.",
      newClientOption: "+ New client / manual entry",
      clientCodePlaceholder: "e.g., CLI-001, WDS-1001 or internal code",
      clientCodeHelp: "Select a registered number to load all client details. The number will remain editable.",
      companyNameLabel: "Company Name / Legal Name",
      newCompanyOption: "+ New company / manual entry",
      companyNamePlaceholder: "Enter or edit the legal company name",
      companyNameHelp: "Select a registered company to automatically load Client No., RFC/Tax ID, project, contract, contacts, emails, and more. All fields remain editable.",
      commercialNameLabel: "Commercial Name / Brand Name",
      commercialNamePlaceholder: "Name used commercially",
      rfcLabel: "RFC / Tax ID",
      rfcPlaceholder: "Tax ID or RFC",
      projectLabel: "Project",
      projectPlaceholder: "Project name",
      contractLabel: "Contract Number",
      contractPlaceholder: "e.g., CTR-2026-001",
      phoneLabel: "Phone",
      phonePlaceholder: "+1 833-456-7890",
      contactsLabel: "Contacts",
      contactPlaceholder: "Contact name",
      addContact: "Add another contact",
      emailsLabel: "Email Addresses",
      emailPlaceholder: "email@company.com",
      addEmail: "Add another email",
      statusLabel: "Status",
      portalAccessLabel: "Customer Portal",
      portalKeyLabel: "Portal Access Key",
      portalKeyPlaceholder: "Assign a key between 4 and 20 characters",
      generateEnableBtn: "Generate & Enable",
      portalHelp: "The client will use their client number and this key to view their process only. To allow access, portal must be set to Enabled and client status to Active.",
      addressLabel: "Address",
      commercialConditionsLabel: "Commercial Terms",
      commercialConditionsPlaceholder: "e.g., 30-day credit",
      logoLabel: "Client Logo",
      noLogo: "No logo",
      chooseFile: "Choose file",
      noFileSelected: "No file selected",
      allowedFormats: "Allowed formats: PNG, JPG, or WEBP. Image is compressed before saving.",
      removeLogo: "Delete logo",
      observationsLabel: "Notes / Comments",
      saveBtn: "💾 Save client",
      cleanBtn: "🧹 Clear",
      viewMatrixBtn: "📋 View matrix",
      openPortalBtn: "🚀 Open Portal",
      statusActive: "Active",
      statusInactive: "Inactive",
      statusBlocked: "Blocked",
      portalEnabled: "Enabled",
      portalDisabled: "Disabled"
    },
    matrixTab: {
      title: "Client Matrix",
      subtitle: "Records are displayed in a separate section from the registration form.",
      importExcelBtn: "Import Excel",
      newClientBtn: "New Client",
      searchPlaceholder: "Search by number, company name, brand name, project, contract, Tax ID, contact, or email...",
      allStatus: "All statuses",
      thLogo: "Logo",
      thNo: "No.",
      thCompanyBrand: "Company / Brand Name",
      thProject: "Project",
      thContract: "Contract No.",
      thRfc: "Tax ID / RFC",
      thContactsEmails: "Contacts & Emails",
      thStatus: "Status",
      thPortal: "Portal",
      thRequisitions: "Requisitions",
      thActions: "Actions",
      noDataTitle: "No clients registered in the matrix.",
      noDataDesc: "Add a new client from the registration form or via Excel import.",
      noContact: "No contact",
      editBtn: "Edit",
      portalBtn: "PORTAL"
    },
    indicatorsTab: {
      title: "Client Key Indicators",
      subtitle: "Independent summary calculated from registered client data.",
      consultMatrixBtn: "📋 View matrix",
      activeClients: "Active clients",
      totalRegistered: "Total registered",
      highestActivity: "Highest activity:",
      requisitions: "requisitions",
      noActivityData: "No activity data available yet.",
      catalogUsage: "Catalog Usage",
      catalogUsageDesc: "Link with requisitions.",
      catalogUsageInfo: "Every requisition must be associated with a previously registered and active client number.",
      recommendedControl: "Recommended Control",
      recommendedControlDesc: "Prevents duplicates.",
      recommendedControlInfo: "The system validates client numbers case-insensitively.",
      clientStatusTitle: "Client Status",
      clientStatusDesc: "Operational availability.",
      clientStatusInfo: "Only active clients are available when creating new requisitions."
    },
    importTab: {
      title: "Bulk Client Import from Excel",
      subtitle: "Analyzes file, validates duplicates, and saves records to the same shared database as the manual form.",
      formatsBadge: "Excel / XLSX / XLS / CSV",
      dropTitle: "Select or drag client file here",
      dropDesc: "The first sheet of the workbook is used. Importing does not overwrite the full database; it only adds or updates clients.",
      selectFileBtn: "Select File",
      noFileSelected: "No file selected.",
      recognizedColsTitle: "Recognized Columns:",
      recognizedColsDesc: "Client number, Legal / company name, Brand name, RFC, Email, and Contact. Also recognized: Email 2, Email 3, Contact 2, Contact 3, Project, and Contract number. Multiple values per cell can be separated by semicolon, comma, vertical bar, or newline. Keep Client number and Tax ID as text in Excel to preserve leading zeros.",
      editableImportTitle: "Editable Import:",
      editableImportDesc: "Rows with missing data are no longer rejected. They are saved as incomplete and inactive records, appear in the Client Matrix, and can be edited to complete missing information.",
      rulesTitle: "Import Rules",
      defaultProjectLabel: "Default Project (optional)",
      defaultProjectPlaceholder: "Applied when row lacks Project",
      defaultProjectHelp: "If left blank, the client will be imported as incomplete for later editing.",
      defaultContractLabel: "Default Contract Number (optional)",
      defaultContractPlaceholder: "Applied when row lacks Contract number",
      defaultContractHelp: "If left blank, the client will be imported as incomplete for later editing.",
      duplicateTreatmentLabel: "Existing Client Numbers Handling",
      skipDuplicates: "Skip existing duplicates",
      updateDuplicates: "Update existing records",
      newStatusLabel: "Status for new clients",
      newPortalLabel: "Portal for new clients",
      newPortalHelp: "If enabled, client is saved without an access key and must be configured later via Edit.",
      downloadTemplateBtn: "Download template",
      cleanBtn: "✏️ Clear",
      previewTitle: "Preview of data detected in file",
      previewSubtitle: (count) => `Detected ${count} row(s) of information ready to process.`,
      fileCorrectBadge: "File properly structured"
    },
    notifications: {
      moduleTitle: "Clients Module",
      navigatingTo: (tab) => `Navigating to: ${tab}`,
      excelImporter: "Excel Importer",
      fileLoaded: (count) => `File loaded successfully (${count} records).`,
      loadErrorTitle: "Load Error",
      loadErrorMsg: "An error occurred while reading the Excel file.",
      formCleaned: "Form and preview cleared.",
      attention: "Attention",
      selectExcelFirst: "Please select an Excel file first.",
      logoTitle: "Logo Management",
      logoAttached: (name) => `Logo "${name}" attached successfully.`,
      registerTitle: "Client Registration",
      enterCompanyName: "Please enter the client's Company Name.",
      successRegister: "Successful Registration",
      clientRegistered: (name) => `Client "${name}" registered in system.`
    }
  }
};

export function Clients({ onNavigate = () => {}, onNotify, lang = 'es' }) {
  const [activeTab, setActiveTab] = useState('register');

  // Selección de diccionario según idioma activado en Navbar
  const t = translations[lang] || translations.es;

  // Función defensiva para canalizar notificaciones de forma segura a la campanita
  const notify = (title, message, type = 'info') => {
    if (typeof onNotify === 'function') {
      onNotify(title, message, type);
    }
  };

  // Estado para controlar la edición de un cliente existente
  const [editingId, setEditingId] = useState(null);

  // Estados para el formulario de la primera tarjeta (Registro)
  const [clientData, setClientData] = useState({
    code: '',
    rfc: '',
    companyName: '',
    commercialName: '',
    project: '',
    contract: '',
    phone: '',
    address: '',
    status: 'Activo',
    portalAccess: 'Deshabilitado',
  });
  const [contacts, setContacts] = useState(['']);
  const [emails, setEmails] = useState(['']);
  const [logo, setLogo] = useState(null);

  // Estados para la Matriz de Clientes
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientsData, setClientsData] = useState([
    {
      id: 'CLI-001',
      code: 'CLI-2026-01',
      rfc: 'GEX010101AAA',
      companyName: 'Constructora del Norte S.A. de C.V.',
      commercialName: 'Grupo Norte',
      project: 'Mantenimiento General',
      contract: 'CTR-2026-001',
      contacts: ['Ing. Carlos Mendoza'],
      emails: ['cmendoza@norte.com'],
      phone: '+52 833 123 4567',
      address: 'Av. Hidalgo 123, Tampico, Tamps.',
      status: 'Activo',
      portalAccess: 'Habilitado'
    },
    {
      id: 'CLI-002',
      code: 'CLI-2026-02',
      rfc: 'PET020202BBB',
      companyName: 'Servicios Petroleros del Golfo S. de R.L.',
      commercialName: 'PGOLFO',
      project: 'Exploración Altamira',
      contract: 'CTR-2026-002',
      contacts: ['Lic. Ana Gómez'],
      emails: ['agomez@pgolfo.com'],
      phone: '+52 833 987 6543',
      address: 'Puerto Industrial, Altamira, Tamps.',
      status: 'Activo',
      portalAccess: 'Deshabilitado'
    }
  ]);

  // Estados para la Tarjeta 4 (Importación de Excel)
  const [selectedFile, setSelectedFile] = useState(null);
  const [defaultProject, setDefaultProject] = useState('');
  const [defaultContract, setDefaultContract] = useState('');
  const [duplicateTreatment, setDuplicateTreatment] = useState('Omitir duplicados existentes');
  const [newClientStatus, setNewClientStatus] = useState('Activo');
  const [newClientPortal, setNewClientPortal] = useState('Deshabilitado');

  // ESTADOS: Matriz de vista previa en tiempo real
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRowsCount, setTotalRowsCount] = useState(0);

  // Cambio de pestañas con notificación
  const handleTabChange = (tabId, tabTitle) => {
    setActiveTab(tabId);
    notify(t.notifications.moduleTitle, t.notifications.navigatingTo(tabTitle));
  };

  // Redirección explícita a la vista / componente ClientPortal
  const handleOpenPortal = (client) => {
    notify("Portal del Cliente", `Redirigiendo al portal de "${client.companyName || 'Cliente'}"...`);
    onNavigate('ClientPortal', client);
  };

  // Resetear el formulario completo
  const resetForm = () => {
    setEditingId(null);
    setClientData({
      code: '',
      rfc: '',
      companyName: '',
      commercialName: '',
      project: '',
      contract: '',
      phone: '',
      address: '',
      status: 'Activo',
      portalAccess: 'Deshabilitado',
    });
    setContacts(['']);
    setEmails(['']);
    handleRemoveLogo();
  };

  // Cargar datos de cliente en la Tarjeta 1 para edición
  const handleEditClient = (client) => {
    setEditingId(client.id);
    setClientData({
      code: client.code || '',
      rfc: client.rfc || '',
      companyName: client.companyName || '',
      commercialName: client.commercialName || '',
      project: client.project || '',
      contract: client.contract || '',
      phone: client.phone || '',
      address: client.address || '',
      status: client.status || 'Activo',
      portalAccess: client.portalAccess || 'Deshabilitado',
    });
    setContacts(client.contacts && client.contacts.length > 0 ? client.contacts : ['']);
    setEmails(client.emails && client.emails.length > 0 ? client.emails : ['']);
    
    if (client.logo) {
      setLogo({ url: client.logo, name: 'Logotipo guardado' });
    } else {
      setLogo(null);
    }

    setActiveTab('register');
    notify("Edición de Cliente", `Cargando datos de "${client.companyName}" para su actualización.`);
  };

  // Función para eliminar cliente
  const handleDeleteClient = (id, companyName) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al cliente "${companyName}"?`)) {
      setClientsData(prev => prev.filter(client => client.id !== id));
      notify("Cliente Eliminado", `El cliente "${companyName}" fue eliminado del sistema.`, "info");
    }
  };

  // LECTURA Y PROCESAMIENTO AUTOMÁTICO AL SELECCIONAR ARCHIVO
  const processExcelFile = (file) => {
    if (!file) return;
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (sheetData && sheetData.length > 0) {
          const rawHeaders = sheetData[0] || [];
          const headers = rawHeaders.map((h, i) => 
            h !== undefined && h !== null && String(h).trim() !== '' 
              ? String(h) 
              : `COLUMNA_${i + 1}`
          );

          const rawRows = sheetData.slice(1);
          const cleanRows = rawRows.filter(row => 
            Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
          );

          setPreviewHeaders(headers);
          setPreviewRows(cleanRows);
          setTotalRowsCount(cleanRows.length);

          notify(t.notifications.excelImporter, t.notifications.fileLoaded(cleanRows.length));
        } else {
          setPreviewHeaders([]);
          setPreviewRows([]);
          setTotalRowsCount(0);
        }
      } catch (error) {
        console.error('Error al procesar el archivo Excel:', error);
        notify(t.notifications.loadErrorTitle, t.notifications.loadErrorMsg, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processExcelFile(file);
  };

  const handleExcelDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) processExcelFile(file);
  };

  const handleResetImportForm = () => {
    setSelectedFile(null);
    setDefaultProject('');
    setDefaultContract('');
    setDuplicateTreatment('Omitir duplicados existentes');
    setNewClientStatus('Activo');
    setNewClientPortal('Deshabilitado');
    setPreviewHeaders([]);
    setPreviewRows([]);
    setTotalRowsCount(0);
    notify(t.notifications.excelImporter, t.notifications.formCleaned);
  };

  const handleDownloadSelectedFile = () => {
    if (!selectedFile) {
      notify(t.notifications.attention, t.notifications.selectExcelFirst, 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      XLSX.writeFile(workbook, `Plantilla_${selectedFile.name}`);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const cardKeys = ['register', 'matrix', 'indicators', 'import'];

  const handleAddContact = () => {
    setContacts([...contacts, '']);
  };
  
  const handleRemoveContact = (index) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleAddEmail = () => {
    setEmails([...emails, '']);
  };

  const handleRemoveEmail = (index) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogo({
        file,
        url: URL.createObjectURL(file),
        name: file.name,
      });
      notify(t.notifications.logoTitle, t.notifications.logoAttached(file.name));
    }
  };

  const handleRemoveLogo = () => {
    if (logo?.url && logo.file) {
      URL.revokeObjectURL(logo.url);
    }
    setLogo(null);
  };

  const handleSaveClient = (e) => {
    e.preventDefault();
    if (!clientData.companyName) {
      notify(t.notifications.registerTitle, t.notifications.enterCompanyName, 'warning');
      return;
    }

    if (editingId) {
      // Modificación de cliente existente
      setClientsData(prev => prev.map(c => {
        if (c.id === editingId) {
          return {
            ...c,
            code: clientData.code || c.code,
            rfc: clientData.rfc || c.rfc,
            companyName: clientData.companyName,
            commercialName: clientData.commercialName || clientData.companyName,
            project: clientData.project || c.project,
            contract: clientData.contract || c.contract,
            contacts: contacts.filter(con => con.trim() !== ''),
            emails: emails.filter(em => em.trim() !== ''),
            phone: clientData.phone || c.phone,
            address: clientData.address || c.address,
            status: clientData.status,
            portalAccess: clientData.portalAccess,
            logo: logo ? logo.url : c.logo
          };
        }
        return c;
      }));
      notify("Actualización Exitosa", `Cliente "${clientData.companyName}" actualizado correctamente.`);
    } else {
      // Alta de cliente nuevo
      const newClient = {
        id: `CLI-00${clientsData.length + 1}`,
        code: clientData.code || `CLI-2026-0${clientsData.length + 1}`,
        rfc: clientData.rfc || 'XAXX010101000',
        companyName: clientData.companyName,
        commercialName: clientData.commercialName || clientData.companyName,
        project: clientData.project || '—',
        contract: clientData.contract || '—',
        contacts: contacts.filter(c => c.trim() !== ''),
        emails: emails.filter(e => e.trim() !== ''),
        phone: clientData.phone || 'Sin datos',
        address: clientData.address || '',
        status: clientData.status,
        portalAccess: clientData.portalAccess,
        logo: logo ? logo.url : null
      };

      setClientsData([...clientsData, newClient]);
      notify(t.notifications.successRegister, t.notifications.clientRegistered(clientData.companyName));
    }

    resetForm();
  };

  const filteredClients = clientsData.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (client.companyName || '').toLowerCase().includes(searchLower) ||
                          (client.code || '').toLowerCase().includes(searchLower) ||
                          (client.commercialName || '').toLowerCase().includes(searchLower) ||
                          (client.project || '').toLowerCase().includes(searchLower) ||
                          (client.contract || '').toLowerCase().includes(searchLower) ||
                          (client.rfc || '').toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{t.headerTitle}</h2>
          <p className="text-xs text-slate-500">{t.headerSubtitle}</p>
        </div>
      </div>

      {/* Grid de las 4 Tarjetas Superior */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardKeys.map((cardId) => {
          const cardInfo = t.cards[cardId];
          const isActive = activeTab === cardId;

          return (
            <button
              key={cardId}
              onClick={() => handleTabChange(cardId, cardInfo.title)}
              className={`text-left p-5 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-36 border ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-1'
                  : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors ${
                  isActive
                    ? 'bg-white/20 backdrop-blur-md'
                    : 'bg-blue-50/80 border border-blue-100/50'
                }`}
              >
                <span>{cardInfo.emoji}</span>
              </div>

              <div>
                <h3 className={`text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                  {cardInfo.title}
                </h3>
                <p className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                  {cardInfo.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenedor dinámico */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[400px]">
        {/* TARJETA 1: Registro y Actualización */}
        {activeTab === 'register' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  {editingId ? "Actualización de datos de cliente" : t.registerTab.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.registerTab.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-[10px] rounded-full border border-blue-100">
                {editingId ? "Modo Edición" : t.registerTab.step1}
              </span>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.clientNumberLabel} <span className="text-red-500">*</span>
                  </label>
                  <select className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold mb-1.5 focus:outline-none">
                    <option>{t.registerTab.newClientOption}</option>
                  </select>
                  <input
                    type="text"
                    value={clientData.code}
                    onChange={(e) => setClientData({ ...clientData, code: e.target.value })}
                    placeholder={t.registerTab.clientCodePlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t.registerTab.clientCodeHelp}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.companyNameLabel} <span className="text-red-500">*</span>
                  </label>
                  <select className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold mb-1.5 focus:outline-none">
                    <option>{t.registerTab.newCompanyOption}</option>
                  </select>
                  <input
                    type="text"
                    value={clientData.companyName}
                    onChange={(e) => setClientData({ ...clientData, companyName: e.target.value })}
                    placeholder={t.registerTab.companyNamePlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t.registerTab.companyNameHelp}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.commercialNameLabel}
                  </label>
                  <input
                    type="text"
                    value={clientData.commercialName}
                    onChange={(e) => setClientData({ ...clientData, commercialName: e.target.value })}
                    placeholder={t.registerTab.commercialNamePlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.rfcLabel}</label>
                  <input
                    type="text"
                    value={clientData.rfc}
                    onChange={(e) => setClientData({ ...clientData, rfc: e.target.value })}
                    placeholder={t.registerTab.rfcPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.projectLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientData.project}
                    onChange={(e) => setClientData({ ...clientData, project: e.target.value })}
                    placeholder={t.registerTab.projectPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.contractLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientData.contract}
                    onChange={(e) => setClientData({ ...clientData, contract: e.target.value })}
                    placeholder={t.registerTab.contractPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.phoneLabel}</label>
                  <input
                    type="tel"
                    value={clientData.phone}
                    onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
                    placeholder={t.registerTab.phonePlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.contactsLabel}</label>
                  <div className="space-y-2">
                    {contacts.map((contact, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={contact}
                          onChange={(e) => {
                            const newContacts = [...contacts];
                            newContacts[idx] = e.target.value;
                            setContacts(newContacts);
                          }}
                          placeholder={t.registerTab.contactPlaceholder}
                          className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                        />
                        {contacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveContact(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="mt-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t.registerTab.addContact}
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.emailsLabel}</label>
                  <div className="space-y-2">
                    {emails.map((email, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            const newEmails = [...emails];
                            newEmails[idx] = e.target.value;
                            setEmails(newEmails);
                          }}
                          placeholder={t.registerTab.emailPlaceholder}
                          className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                        />
                        {emails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="mt-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t.registerTab.addEmail}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.statusLabel}</label>
                  <select 
                    value={clientData.status}
                    onChange={(e) => setClientData({ ...clientData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="Activo">{t.registerTab.statusActive}</option>
                    <option value="Inactivo">{t.registerTab.statusInactive}</option>
                    <option value="Bloqueado">{t.registerTab.statusBlocked}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.portalAccessLabel}</label>
                  <select 
                    value={clientData.portalAccess}
                    onChange={(e) => setClientData({ ...clientData, portalAccess: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="Habilitado">{t.registerTab.portalEnabled}</option>
                    <option value="Deshabilitado">{t.registerTab.portalDisabled}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.portalKeyLabel}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t.registerTab.portalKeyPlaceholder}
                      className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                    />
                    <button
                      type="button"
                      className="px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-bold rounded-lg whitespace-nowrap hover:opacity-90 transition-opacity shadow-sm flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> {t.registerTab.generateEnableBtn}
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1 leading-tight">
                    {t.registerTab.portalHelp}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.addressLabel}</label>
                  <input
                    type="text"
                    value={clientData.address}
                    onChange={(e) => setClientData({ ...clientData, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.commercialConditionsLabel}</label>
                  <input
                    type="text"
                    placeholder={t.registerTab.commercialConditionsPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.logoLabel}</label>
                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-20 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400 font-medium shrink-0 overflow-hidden">
                    {logo ? (
                      <img src={logo.url} alt="Vista previa del logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      t.registerTab.noLogo
                    )}
                  </div>

                  <div className="space-y-2 w-full">
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg border border-slate-300 cursor-pointer transition-colors flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" /> {t.registerTab.chooseFile}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/png, image/jpeg, image/webp" 
                          onChange={handleLogoChange}
                        />
                      </label>
                      <span className="text-xs text-slate-400 truncate max-w-[200px]">
                        {logo ? logo.name : t.registerTab.noFileSelected}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      {t.registerTab.allowedFormats}
                    </p>

                    {logo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> {t.registerTab.removeLogo}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.observationsLabel}</label>
                <textarea
                  rows={3}
                  className="w-full p-3 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  {editingId ? "💾 Actualizar cliente" : t.registerTab.saveBtn}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5"
                >
                  {t.registerTab.cleanBtn}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('matrix', t.cards.matrix.title)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {t.registerTab.viewMatrixBtn}
                </button>

                {/* Acceso directo para abrir Portal del cliente cuando se edita */}
                {editingId && (
                  <button
                    type="button"
                    onClick={() => handleOpenPortal({ ...clientData, id: editingId })}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ml-auto"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> {t.registerTab.openPortalBtn}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* TARJETA 2: Matriz de Clientes */}
        {activeTab === 'matrix' && (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">{t.matrixTab.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.matrixTab.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTabChange('import', t.cards.import.title)}
                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> {t.matrixTab.importExcelBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    handleTabChange('register', t.cards.register.title);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.matrixTab.newClientBtn}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.matrixTab.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 transition-all"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full md:w-64 px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">{t.matrixTab.allStatus}</option>
                  <option value="Activo">{t.registerTab.statusActive}</option>
                  <option value="Inactivo">{t.registerTab.statusInactive}</option>
                  <option value="Bloqueado">{t.registerTab.statusBlocked}</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-3">{t.matrixTab.thLogo}</th>
                      <th className="py-3 px-3">{t.matrixTab.thNo}</th>
                      <th className="py-3 px-3">{t.matrixTab.thCompanyBrand}</th>
                      <th className="py-3 px-3">{t.matrixTab.thProject}</th>
                      <th className="py-3 px-3">{t.matrixTab.thContract}</th>
                      <th className="py-3 px-3">{t.matrixTab.thRfc}</th>
                      <th className="py-3 px-3">{t.matrixTab.thContactsEmails}</th>
                      <th className="py-3 px-3">{t.matrixTab.thStatus}</th>
                      <th className="py-3 px-3">{t.matrixTab.thPortal}</th>
                      <th className="py-3 px-3 text-center">{t.matrixTab.thRequisitions}</th>
                      <th className="py-3 px-3 text-center">{t.matrixTab.thActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <span className="text-3xl">📋</span>
                            <p className="font-semibold text-slate-600 text-xs">{t.matrixTab.noDataTitle}</p>
                            <p className="text-[11px] text-slate-400">
                              {t.matrixTab.noDataDesc}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client) => (
                        <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              {client.logo ? <img src={client.logo} alt="Logo" className="w-full h-full object-cover rounded-lg" /> : '—'}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">{client.code || client.id}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800">{client.companyName}</div>
                            <div className="text-[10px] text-indigo-600 font-semibold">{client.commercialName}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">{client.project || '—'}</td>
                          <td className="py-3 px-3 text-slate-600">{client.contract || '—'}</td>
                          <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{client.rfc || '—'}</td>
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md border border-slate-200">
                                {client.contacts && client.contacts.length > 0 ? client.contacts.join(', ') : t.matrixTab.noContact}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {client.emails && client.emails.length > 0 ? client.emails.join(', ') : '—'}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-bold text-[10px] rounded-full border border-blue-100">
                              {client.status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-[11px] font-bold text-slate-700">{client.portalAccess}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-700">{client.requisitionsCount || 0}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              {/* Botón Editar */}
                              <button 
                                onClick={() => handleEditClient(client)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" /> {t.matrixTab.editBtn}
                              </button>
                              
                              {/* Botón Portal - Redirige a ClientPortal */}
                              <button 
                                onClick={() => handleOpenPortal(client)}
                                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                                title="Abrir Portal del Cliente"
                              >
                                <ExternalLink className="w-3 h-3" /> {t.matrixTab.portalBtn}
                              </button>
                              
                              {/* Botón Eliminar */}
                              <button 
                                onClick={() => handleDeleteClient(client.id, client.companyName)}
                                className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors cursor-pointer"
                                title="Eliminar cliente"
                              >
                                <Trash2 className="w-3 h-3" />
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
          </div>
        )}

        {/* TARJETA 3: Indicadores de Clientes */}
        {activeTab === 'indicators' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-black text-slate-800">{t.indicatorsTab.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.indicatorsTab.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleTabChange('matrix', t.cards.matrix.title)}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                <span>📋</span> {t.indicatorsTab.consultMatrixBtn}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-emerald-50/50 border-l-4 border-l-emerald-500 rounded-r-xl border border-slate-100/80">
                  <div className="text-xl font-black text-slate-900">
                    {clientsData.filter((c) => c.status === 'Activo').length}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">{t.indicatorsTab.activeClients}</div>
                </div>

                <div className="p-4 bg-blue-50/50 border-l-4 border-l-blue-600 rounded-r-xl border border-slate-100/80">
                  <div className="text-xl font-black text-slate-900">{clientsData.length}</div>
                  <div className="text-xs text-slate-500 font-medium">{t.indicatorsTab.totalRegistered}</div>
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 border-l-4 border-l-blue-600 rounded-r-xl border border-slate-100/80">
                <div className="text-xs font-bold text-slate-900">{t.indicatorsTab.highestActivity}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {clientsData.length > 0
                    ? `${clientsData[0].companyName || 'N/A'} · ${clientsData[0].requisitionsCount || 0} ${t.indicatorsTab.requisitions}`
                    : t.indicatorsTab.noActivityData}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-5 bg-white border border-slate-200/80 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{t.indicatorsTab.catalogUsage}</h4>
                  <p className="text-[10px] text-slate-400">{t.indicatorsTab.catalogUsageDesc}</p>
                </div>
                <div className="p-3 bg-blue-50/50 border-l-4 border-l-blue-600 rounded-r-xl border border-slate-100/80 text-[11px] text-slate-600 leading-relaxed">
                  {t.indicatorsTab.catalogUsageInfo}
                </div>
              </div>

              <div className="p-5 bg-white border border-slate-200/80 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{t.indicatorsTab.recommendedControl}</h4>
                  <p className="text-[10px] text-slate-400">{t.indicatorsTab.recommendedControlDesc}</p>
                </div>
                <div className="p-3 bg-amber-50/50 border-l-4 border-l-amber-500 rounded-r-xl border border-slate-100/80 text-[11px] text-slate-600 leading-relaxed">
                  {t.indicatorsTab.recommendedControlInfo}
                </div>
              </div>

              <div className="p-5 bg-white border border-slate-200/80 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{t.indicatorsTab.clientStatusTitle}</h4>
                  <p className="text-[10px] text-slate-400">{t.indicatorsTab.clientStatusDesc}</p>
                </div>
                <div className="p-3 bg-emerald-50/50 border-l-4 border-l-emerald-500 rounded-r-xl border border-slate-100/80 text-[11px] text-slate-600 leading-relaxed">
                  {t.indicatorsTab.clientStatusInfo}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TARJETA 4: Importar Excel */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-base font-black text-slate-800">{t.importTab.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {t.importTab.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 font-bold text-[10px] rounded-full border border-purple-200">
                {t.importTab.formatsBadge}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              <div className="space-y-4">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleExcelDrop}
                  className="border-2 border-dashed border-blue-200 rounded-2xl p-8 bg-blue-50/20 text-center flex flex-col items-center justify-center transition-colors hover:bg-blue-50/40"
                >
                  <div className="w-12 h-12 bg-white rounded-xl shadow-xs border border-slate-100 flex items-center justify-center mb-3 text-2xl">
                    📊
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">{t.importTab.dropTitle}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    {t.importTab.dropDesc}
                  </p>
                  
                  <label className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all inline-flex items-center gap-2">
                    {t.importTab.selectFileBtn}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".xlsx, .xls, .csv" 
                      onChange={handleExcelFileChange} 
                    />
                  </label>

                  <p className="text-[11px] text-slate-400 font-medium mt-3">
                    {selectedFile ? selectedFile.name : t.importTab.noFileSelected}
                  </p>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-blue-900">{t.importTab.recognizedColsTitle}</span> {t.importTab.recognizedColsDesc}
                </div>

                <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-amber-900">{t.importTab.editableImportTitle}</span> {t.importTab.editableImportDesc}
                </div>
              </div>

              <div className="p-5 bg-slate-50/40 border border-slate-200/70 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold text-slate-800">{t.importTab.rulesTitle}</h4>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.importTab.defaultProjectLabel}
                  </label>
                  <input
                    type="text"
                    value={defaultProject}
                    onChange={(e) => setDefaultProject(e.target.value)}
                    placeholder={t.importTab.defaultProjectPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t.importTab.defaultProjectHelp}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.importTab.defaultContractLabel}
                  </label>
                  <input
                    type="text"
                    value={defaultContract}
                    onChange={(e) => setDefaultContract(e.target.value)}
                    placeholder={t.importTab.defaultContractPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t.importTab.defaultContractHelp}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.importTab.duplicateTreatmentLabel}
                  </label>
                  <select
                    value={duplicateTreatment}
                    onChange={(e) => setDuplicateTreatment(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Omitir duplicados existentes">{t.importTab.skipDuplicates}</option>
                    <option value="Actualizar existentes">{t.importTab.updateDuplicates}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.importTab.newStatusLabel}
                  </label>
                  <select
                    value={newClientStatus}
                    onChange={(e) => setNewClientStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Activo">{t.registerTab.statusActive}</option>
                    <option value="Inactivo">{t.registerTab.statusInactive}</option>
                    <option value="Bloqueado">{t.registerTab.statusBlocked}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.importTab.newPortalLabel}
                  </label>
                  <select
                    value={newClientPortal}
                    onChange={(e) => setNewClientPortal(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Deshabilitado">{t.registerTab.portalDisabled}</option>
                    <option value="Habilitado">{t.registerTab.portalEnabled}</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                    {t.importTab.newPortalHelp}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadSelectedFile}
                    disabled={!selectedFile}
                    className={`px-4 py-2 font-bold text-xs rounded-xl border transition-all flex items-center gap-1.5 shadow-xs ${
                      selectedFile
                        ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 cursor-pointer'
                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" /> {t.importTab.downloadTemplateBtn}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetImportForm}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5"
                  >
                    {t.importTab.cleanBtn}
                  </button>
                </div>

              </div>
            </div>

            {selectedFile && previewHeaders.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                      <TableIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        {t.importTab.previewTitle}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {t.importTab.previewSubtitle(totalRowsCount)}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 inline-flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {t.importTab.fileCorrectBadge}
                  </span>
                </div>
                                
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider z-10">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center text-slate-400 font-bold">#</th>
                          {previewHeaders.map((header, idx) => (
                            <th key={idx} className="py-3 px-4 whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-slate-50/60 transition-colors text-slate-700">
                            <td className="py-3 px-4 font-bold text-blue-600/70 text-center text-[11px]">
                              {rowIndex + 1}
                            </td>
                            {previewHeaders.map((_, colIndex) => (
                              <td key={colIndex} className="py-3 px-4 whitespace-nowrap text-xs text-slate-700 font-medium">
                                {row[colIndex] !== undefined && row[colIndex] !== null && String(row[colIndex]).trim() !== '' 
                                  ? String(row[colIndex]) 
                                  : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}