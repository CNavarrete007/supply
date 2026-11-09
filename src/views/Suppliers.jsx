import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  X, 
  Trash2, 
  Search, 
  Download, 
  Edit3,
  ClipboardList,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Table as TableIcon,
  Truck,
  Star,
  Building2,
  AlertCircle,
  Bell
} from 'lucide-react';

const dictionary = {
  es: {
    headerTitle: "Proveedores",
    headerSubtitle: "Registro, matriz, evaluación e importación de proveedores.",
    notificationsTitle: "Historial de guardado",
    noNotifications: "No hay datos guardados aún.",
    newSupplierSaved: "Nuevo proveedor registrado",
    cards: {
      register: { title: "Registro y actualización", desc: "Alta de proveedores y modificación de su información comercial." },
      matrix: { title: "Matriz de proveedores", desc: "Consulta, búsqueda, filtros, edición y eliminación." },
      indicators: { title: "Evaluación e indicadores", desc: "Semáforo, calificaciones y situación de los proveedores." },
      import: { title: "Importar Excel", desc: "Carga masiva de proveedores, incluso cuando falten datos por completar." }
    },
    registerTab: {
      step: "Paso 1 · Datos del proveedor",
      title: "Alta y actualización de proveedores",
      subtitle: "El número de proveedor debe ser asignado manualmente por el usuario y no puede repetirse.",
      newOption: "+ Nuevo proveedor / captura manual",
      providerNumber: "No. de proveedor",
      providerNumberHelp: "Selecciona un número registrado para cargar automáticamente todos los datos disponibles.",
      socialReason: "Razón social",
      socialReasonHelp: "Selecciona la razón social para completar No. de proveedor, Clave, RFC, contacto, correo, teléfono, categoría, condiciones y demás datos. Todos los campos seguirán editables.",
      rfc: "RFC / Tax ID",
      clave: "Clave",
      contacts: "Contactos",
      addContact: "+ Agregar otro contacto",
      emails: "Correos electrónicos",
      addEmail: "+ Agregar otro correo",
      phones: "Teléfonos",
      addPhone: "+ Agregar otro teléfono",
      category: "Categoría",
      status: "Estatus",
      currency: "Moneda habitual",
      creditType: "Tipo de crédito habitual",
      creditDays: "Días de crédito",
      deliveryTime: "Tiempo de entrega habitual",
      deliveryUnit: "Unidad del tiempo de entrega",
      initialRating: "Calificación inicial",
      documents: "Documentos / certificaciones",
      logo: "Logotipo del proveedor",
      noLogo: "Sin logotipo",
      chooseFile: "Elegir archivo",
      noFileSelected: "No se ha seleccionado ningún archivo",
      allowedFormats: "Formatos permitidos: PNG, JPG o WEBP.",
      removeLogo: "Eliminar logotipo",
      observations: "Observaciones",
      btnSave: "Guardar proveedor",
      btnClear: "Limpiar",
      btnMatrix: "Ver matriz"
    },
    matrixTab: {
      title: "Matriz de proveedores",
      subtitle: "Los registros se muestran en una sección independiente del formulario de alta.",
      btnImport: "Importar Excel",
      btnNew: "Nuevo proveedor",
      searchPlaceholder: "Buscar por número, razón social, nombre comercial, categoría, RFC, contacto o correo...",
      allStatus: "Todos los estatus",
      colLogo: "LOGO",
      colNumber: "NO./CLAVE",
      colSupplier: "PROVEEDOR",
      colRfc: "RFC",
      colCategory: "CATEGORÍA",
      colStatus: "ESTATUS",
      colSupplies: "SUMINISTROS",
      colDelivery: "ENTREGA HABITUAL",
      colCredit: "CRÉDITO HABITUAL",
      colRating: "CALIFICACIÓN",
      colOc: "OC",
      colActions: "ACCIONES",
      emptyState: "No hay proveedores registrados en la matriz.",
      emptyStateHelp: "Agrega uno nuevo desde el formulario de registro o mediante importación."
    },
    indicatorsTab: {
      title: "Evaluación e indicadores de proveedores",
      subtitle: "Resumen independiente del estatus, desempeño y utilización del catálogo.",
      btnMatrix: "Consultar matriz",
      authorized: "Autorizados",
      inEvaluation: "En evaluación",
      suspended: "Suspendidos",
      avgRating: "Calificación promedio:",
      registeredItems: "Productos y servicios registrados:",
      pendingUpdate: "Proveedor(es) con datos pendientes de actualización.",
      statusAuthTitle: "Proveedor autorizado",
      statusAuthSub: "Disponibilidad operativa.",
      statusAuthDesc: "Puede participar en cotizaciones y ser seleccionado para una orden de compra.",
      statusEvalTitle: "Proveedor en evaluación",
      statusEvalSub: "Seguimiento documental.",
      statusEvalDesc: "Debe completar validaciones comerciales, fiscales, técnicas, de calidad o HSE.",
      statusSuspTitle: "Proveedor suspendido",
      statusSuspSub: "Bloqueo preventivo.",
      statusSuspDesc: "No debe utilizarse para nuevas cotizaciones u órdenes hasta levantar la suspensión."
    },
    importTab: {
      title: "Importación masiva de proveedores desde Excel",
      subtitle: "Analiza el archivo, valida duplicados y guarda los registros en la misma base compartida que utiliza el formulario manual.",
      selectTitle: "Selecciona o arrastra el archivo de proveedores",
      selectDesc: "Se utiliza la primera hoja del libro. El archivo no reemplaza la base completa; solamente agrega o actualiza proveedores.",
      btnSelectFile: "Seleccionar archivo",
      noFile: "Ningún archivo seleccionado.",
      colsInfoTitle: "Columnas reconocidas:",
      colsInfoText: "Provider number, Legal / company name, Brand name, RFC, Email y Contact. También se reconocen Email 2, Email 3, Contact 2, Contact 3, Category y Currency. Una misma celda puede contener varios valores separados por punto y coma, coma, barra vertical o salto de línea. Conserva Provider number y RFC como texto en Excel para no perder ceros iniciales.",
      editInfoTitle: "Importación editable:",
      editInfoText: "las filas con datos faltantes ya no se rechazan. Se guardan como registros incompletos e inactivos, aparecen en la Matriz de proveedores y pueden abrirse con Editar para completar o corregir la información.",
      rulesTitle: "Reglas para la importación",
      dupRuleLabel: "Tratamiento de proveedores existentes",
      dupRuleHelp: "La coincidencia se verifica por No. de proveedor, Clave, RFC y razón social.",
      categoryLabel: "Categoría predeterminada (opcional)",
      categoryHelp: "Si permanece vacía, se guardará “Pendiente de actualizar”.",
      statusLabel: "Estatus para proveedores nuevos",
      statusHelp: "Los registros incompletos siempre se guardan En evaluación.",
      currencyLabel: "Moneda habitual predeterminada",
      btnTemplate: "Descargar plantilla",
      btnClear: "Limpiar",
      previewTitle: "Vista previa de datos detectados en el archivo",
      previewSubtitle: "Se detectaron {count} fila(s) de información listas para procesarse.",
      fileOk: "Archivo estructurado correctamente",
      showingRows: "Mostrando 10 de {count} filas registradas en el archivo."
    },
    options: {
      status: {
        eval: "En evaluación",
        auth: "Autorizado",
        susp: "Suspendido",
        inact: "Inactivo"
      },
      currency: {
        mxn: "MXN",
        usd: "USD",
        eur: "EUR"
      },
      credit: {
        cash: "Contado",
        advance: "Anticipo",
        credit: "Crédito",
        delivery: "Contra entrega",
        installments: "Parcialidades",
        consignment: "Consignación",
        other: "Otro"
      },
      deliveryUnits: {
        businessDays: "Días hábiles",
        calendarDays: "Días naturales",
        weeks: "Semanas",
        months: "Meses"
      },
      dupHandling: {
        skip: "Omitir duplicados existentes",
        update: "Actualizar datos existentes"
      }
    }
  },
  en: {
    headerTitle: "Suppliers",
    headerSubtitle: "Registration, matrix, evaluation, and supplier import.",
    notificationsTitle: "Saved history",
    noNotifications: "No data saved yet.",
    newSupplierSaved: "New supplier registered",
    cards: {
      register: { title: "Registration and update", desc: "Onboarding suppliers and editing commercial information." },
      matrix: { title: "Suppliers Matrix", desc: "Lookup, search, filtering, editing, and deletion." },
      indicators: { title: "Evaluation and indicators", desc: "Status indicators, ratings, and supplier overview." },
      import: { title: "Import Excel", desc: "Bulk upload suppliers, even with incomplete fields." }
    },
    registerTab: {
      step: "Step 1 · Supplier Information",
      title: "Supplier Registration and Updates",
      subtitle: "The supplier number must be manually assigned by the user and cannot be duplicated.",
      newOption: "+ New supplier / manual entry",
      providerNumber: "Supplier No.",
      providerNumberHelp: "Select a registered number to automatically load all available data.",
      socialReason: "Company Name / Legal Name",
      socialReasonHelp: "Select company name to prefill Supplier No., Code, Tax ID, contacts, email, phone, category, and credit terms. All fields remain editable.",
      rfc: "Tax ID / RFC",
      clave: "Code",
      contacts: "Contacts",
      addContact: "+ Add another contact",
      emails: "Email addresses",
      addEmail: "+ Add another email",
      phones: "Phone numbers",
      addPhone: "+ Add another phone",
      category: "Category",
      status: "Status",
      currency: "Default Currency",
      creditType: "Default Credit Type",
      creditDays: "Credit Days",
      deliveryTime: "Default Delivery Time",
      deliveryUnit: "Delivery Time Unit",
      initialRating: "Initial Rating",
      documents: "Documents / Certifications",
      logo: "Supplier Logo",
      noLogo: "No logo",
      chooseFile: "Choose file",
      noFileSelected: "No file selected",
      allowedFormats: "Allowed formats: PNG, JPG, or WEBP.",
      removeLogo: "Remove logo",
      observations: "Notes / Observations",
      btnSave: "Save Supplier",
      btnClear: "Clear",
      btnMatrix: "View Matrix"
    },
    matrixTab: {
      title: "Suppliers Matrix",
      subtitle: "Records are displayed in a separate section from the registration form.",
      btnImport: "Import Excel",
      btnNew: "New Supplier",
      searchPlaceholder: "Search by number, company name, trade name, category, Tax ID, contact, or email...",
      allStatus: "All Statuses",
      colLogo: "LOGO",
      colNumber: "NO./CODE",
      colSupplier: "SUPPLIER",
      colRfc: "TAX ID",
      colCategory: "CATEGORY",
      colStatus: "STATUS",
      colSupplies: "SUPPLIES",
      colDelivery: "DEFAULT DELIVERY",
      colCredit: "DEFAULT CREDIT",
      colRating: "RATING",
      colOc: "PO",
      colActions: "ACTIONS",
      emptyState: "No suppliers registered in the matrix.",
      emptyStateHelp: "Add a new one using the registration form or by importing."
    },
    indicatorsTab: {
      title: "Supplier Evaluation and KPIs",
      subtitle: "Independent summary of catalog usage, performance, and status.",
      btnMatrix: "View Matrix",
      authorized: "Authorized",
      inEvaluation: "Under Evaluation",
      suspended: "Suspended",
      avgRating: "Average Rating:",
      registeredItems: "Registered Products & Services:",
      pendingUpdate: "Supplier(s) with pending updates.",
      statusAuthTitle: "Authorized Supplier",
      statusAuthSub: "Operational availability.",
      statusAuthDesc: "Can participate in quotes and be selected for Purchase Orders.",
      statusEvalTitle: "Supplier Under Evaluation",
      statusEvalSub: "Documentary tracking.",
      statusEvalDesc: "Must complete commercial, tax, technical, quality, or HSE validations.",
      statusSuspTitle: "Suspended Supplier",
      statusSuspSub: "Preventive block.",
      statusSuspDesc: "Must not be used for new quotes or purchase orders until suspension is lifted."
    },
    importTab: {
      title: "Bulk Import Suppliers from Excel",
      subtitle: "Analyzes file, checks duplicates, and saves records into the shared database used by manual forms.",
      selectTitle: "Select or drag supplier file here",
      selectDesc: "The first worksheet is used. This does not replace the entire database; it only adds or updates suppliers.",
      btnSelectFile: "Select file",
      noFile: "No file selected.",
      colsInfoTitle: "Recognized Columns:",
      colsInfoText: "Provider number, Legal / company name, Brand name, Tax ID, Email, and Contact. Also supports Email 2, Email 3, Contact 2, Contact 3, Category, and Currency. Multiple values can be separated by semicolons, commas, pipes, or line breaks. Keep Provider Number and Tax ID as text in Excel to avoid losing leading zeroes.",
      editInfoTitle: "Editable Import:",
      editInfoText: "rows with missing data are no longer rejected. They are saved as incomplete and inactive records, visible in the Suppliers Matrix, and can be completed via Edit.",
      rulesTitle: "Import Rules",
      dupRuleLabel: "Existing Suppliers Treatment",
      dupRuleHelp: "Matches are verified by Supplier No., Code, Tax ID, and Company Name.",
      categoryLabel: "Default Category (optional)",
      categoryHelp: "If left blank, 'Pending Update' will be stored.",
      statusLabel: "Status for New Suppliers",
      statusHelp: "Incomplete records are always saved as Under Evaluation.",
      currencyLabel: "Default Currency",
      btnTemplate: "Download Template",
      btnClear: "Clear",
      previewTitle: "Preview of Data Detected in File",
      previewSubtitle: "Detected {count} row(s) ready to be processed.",
      fileOk: "File structured correctly",
      showingRows: "Showing 10 of {count} rows in file."
    },
    options: {
      status: {
        eval: "Under Evaluation",
        auth: "Authorized",
        susp: "Suspended",
        inact: "Inactive"
      },
      currency: {
        mxn: "MXN",
        usd: "USD",
        eur: "EUR"
      },
      credit: {
        cash: "Cash",
        advance: "Advance Payment",
        credit: "Credit",
        delivery: "On Delivery",
        installments: "Installments",
        consignment: "Consignment",
        other: "Other"
      },
      deliveryUnits: {
        businessDays: "Business days",
        calendarDays: "Calendar days",
        weeks: "Weeks",
        months: "Months"
      },
      dupHandling: {
        skip: "Skip existing duplicates",
        update: "Update existing data"
      }
    }
  }
};

export function Suppliers({ onNavigate = () => {}, onNotify, lang = 'es' }) {
  const t = dictionary[lang] || dictionary.es;

  const [activeTab, setActiveTab] = useState('register');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);

  const initialFormState = {
    providerNumberSelect: t.registerTab.newOption,
    providerNumber: '',
    socialReasonSelect: t.registerTab.newOption,
    socialReason: '',
    rfc: '',
    clave: '',
    phones: [''],
    category: 'Materiales',
    status: t.options.status.eval,
    currency: 'MXN',
    creditType: t.options.credit.cash,
    creditDays: 0,
    deliveryTime: 0,
    deliveryUnit: t.options.deliveryUnits.businessDays,
    initialRating: 80,
    documents: '',
    observations: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [contacts, setContacts] = useState(['']);
  const [emails, setEmails] = useState(['']);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [suppliersData, setSuppliersData] = useState([
    {
      id: 'SUP-001',
      number: 'PROV-2026-01',
      socialReason: 'Aceros y Perfiles del Norte S.A.',
      rfc: 'APN900101XYZ',
      category: 'Materiales',
      rating: 92,
      status: t.options.status.auth,
      contacts: ['Ing. Roberto Garza'],
      emails: ['rgarza@acerosnorte.com'],
      phones: ['+52 833 555 1234']
    },
    {
      id: 'SUP-002',
      number: 'PROV-2026-02',
      socialReason: 'Suministros Industriales Tampico',
      rfc: 'SIT850512ABC',
      category: 'Ferretería',
      rating: 78,
      status: t.options.status.eval,
      contacts: ['Lic. Marta Ríos'],
      emails: ['ventas@sitampico.com'],
      phones: ['+52 833 444 9876']
    }
  ]);

  const [excelFile, setExcelFile] = useState(null);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRowsCount, setTotalRowsCount] = useState(0);

  // Estados para el Modal de Eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  const [importRules, setImportRules] = useState({
    defaultCategory: 'General',
    defaultCurrency: 'MXN',
    duplicateHandling: t.options.dupHandling.skip,
    newSupplierStatus: t.options.status.eval,
    portalAccess: 'Deshabilitado'
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearForm = () => {
    setFormData(initialFormState);
    setContacts(['']);
    setEmails(['']);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(null);
    setLogoPreview(null);
    if (onNotify) {
      onNotify('Formulario', 'Formulario limpiado.');
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleImportRuleChange = (e) => {
    const { name, value } = e.target;
    setImportRules((prev) => ({ ...prev, [name]: value }));
  };

  const processExcelFile = (file) => {
    setExcelFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData && jsonData.length > 0) {
          const headers = jsonData[0] || [];
          const rows = jsonData.slice(1).filter((row) => row.length > 0);

          setPreviewHeaders(headers);
          setPreviewRows(rows);
          setTotalRowsCount(rows.length);
        } else {
          setPreviewHeaders([]);
          setPreviewRows([]);
          setTotalRowsCount(0);
        }
      } catch (error) {
        console.error('Error Excel:', error);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleExcelDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleClearImport = () => {
    setExcelFile(null);
    setPreviewHeaders([]);
    setPreviewRows([]);
    setTotalRowsCount(0);
  };

  const handleDownloadOriginalFile = () => {
    if (!excelFile) return;

    const fileUrl = URL.createObjectURL(excelFile);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = excelFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(fileUrl);
  };

  const cards = [
    { id: 'register', title: t.cards.register.title, description: t.cards.register.desc, emoji: '📝' },
    { id: 'matrix', title: t.cards.matrix.title, description: t.cards.matrix.desc, emoji: '📋' },
    { id: 'indicators', title: t.cards.indicators.title, description: t.cards.indicators.desc, emoji: '📊' },
    { id: 'import', title: t.cards.import.title, description: t.cards.import.desc, emoji: '📥' },
  ];

  const handleAddContact = () => setContacts([...contacts, '']);
  const handleRemoveContact = (index) => setContacts(contacts.filter((_, i) => i !== index));
  const handleContactChange = (index, value) => {
    const updated = [...contacts];
    updated[index] = value;
    setContacts(updated);
  };

  const handleAddEmail = () => setEmails([...emails, '']);
  const handleRemoveEmail = (index) => setEmails(emails.filter((_, i) => i !== index));
  const handleEmailChange = (index, value) => {
    const updated = [...emails];
    updated[index] = value;
    setEmails(updated);
  };

  const handlePhoneChange = (index, value) => {
    const updated = [...formData.phones];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, phones: updated }));
  };

  const handleAddPhone = () => {
    setFormData((prev) => ({ ...prev, phones: [...prev.phones, ''] }));
  };

  const handleRemovePhone = (index) => {
    setFormData((prev) => ({
      ...prev,
      phones: prev.phones.filter((_, i) => i !== index),
    }));
  };

  const handleSaveSupplier = (e) => {
    e.preventDefault();
    if (!formData.socialReason) return;

    const newSupplier = {
      id: `SUP-00${suppliersData.length + 1}`,
      number: formData.providerNumber || `PROV-2026-0${suppliersData.length + 1}`,
      socialReason: formData.socialReason,
      rfc: formData.rfc || 'XAXX010101000',
      category: formData.category,
      rating: Number(formData.initialRating) || 80,
      status: formData.status,
      contacts: contacts.filter((c) => c.trim() !== ''),
      emails: emails.filter((e) => e.trim() !== ''),
      phones: formData.phones.filter((p) => p.trim() !== '')
    };

    setSuppliersData([...suppliersData, newSupplier]);

    const newNotification = {
      id: Date.now(),
      title: t.newSupplierSaved,
      details: newSupplier,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setNotificationsList((prev) => [newNotification, ...prev]);

    handleClearForm();
  };

// --- FUNCIÓN PARA EDITAR PROVEEDOR ---
  const handleEditSupplier = (supplier) => {
    setFormData({
      ...initialFormState,
      providerNumberSelect: supplier.number,
      providerNumber: supplier.number,
      socialReasonSelect: supplier.socialReason,
      socialReason: supplier.socialReason,
      rfc: supplier.rfc,
      category: supplier.category,
      status: supplier.status,
      initialRating: supplier.rating,
    });
    setContacts(supplier.contacts && supplier.contacts.length > 0 ? supplier.contacts : ['']);
    setEmails(supplier.emails && supplier.emails.length > 0 ? supplier.emails : ['']);
    // Cambia a la Tarjeta 1 (Registro y actualización)
    setActiveTab('register'); 
  };

  // --- FUNCIONES PARA EL MODAL DE ELIMINAR ---
  const handleOpenDeleteModal = (supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSupplierToDelete(null);
  };

  const handleMarkInactive = () => {
    if (supplierToDelete) {
      const updatedSuppliers = suppliersData.map(s =>
        s.id === supplierToDelete.id ? { ...s, status: t.options.status.inact } : s
      );
      setSuppliersData(updatedSuppliers);
      handleCloseDeleteModal();
    }
  };

  const handleConfirmDelete = () => {
    if (supplierToDelete) {
      const updatedSuppliers = suppliersData.filter(s => s.id !== supplierToDelete.id);
      setSuppliersData(updatedSuppliers);
      handleCloseDeleteModal();
    }
  };

  const filteredSuppliers = suppliersData.filter((supplier) => {
    const matchesSearch = 
      (supplier.number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.socialReason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.rfc || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (supplier.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;

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

      {/* Grid de las 4 Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const isActive = activeTab === card.id;

          return (
            <button
              key={card.id}
              onClick={() => setActiveTab(card.id)}
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
                <span>{card.emoji}</span>
              </div>

              <div>
                <h3 className={`text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                  {card.title}
                </h3>
                <p className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenedor dinámico */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[400px]">
        
        {/* TAB 1: Registro */}
        {activeTab === 'register' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">{t.registerTab.title}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{t.registerTab.subtitle}</p>
              </div>
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                {t.registerTab.step}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.registerTab.providerNumber} <span className="text-purple-600">*</span>
                </label>
                <select 
                  name="providerNumberSelect"
                  value={formData.providerNumberSelect}
                  onChange={handleInputChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option>{t.registerTab.newOption}</option>
                </select>
                <input 
                  type="text" 
                  name="providerNumber"
                  value={formData.providerNumber}
                  onChange={handleInputChange}
                  placeholder="PROV-001..." 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t.registerTab.providerNumberHelp}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.registerTab.socialReason} <span className="text-purple-600">*</span>
                </label>
                <select 
                  name="socialReasonSelect"
                  value={formData.socialReasonSelect}
                  onChange={handleInputChange}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option>{t.registerTab.newOption}</option>
                </select>
                <input 
                  type="text" 
                  name="socialReason"
                  value={formData.socialReason}
                  onChange={handleInputChange}
                  placeholder="..." 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t.registerTab.socialReasonHelp}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.rfc}</label>
                <input
                  type="text"
                  name="rfc"
                  value={formData.rfc}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.clave}</label>
                <input 
                  type="text" 
                  name="clave"
                  value={formData.clave}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.contacts}</label>
                <div className="space-y-2">
                  {contacts.map((contact, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={contact}
                        onChange={(e) => handleContactChange(index, e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                      />
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(index)}
                          className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                  >
                    {t.registerTab.addContact}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.emails}</label>
                <div className="space-y-2">
                  {emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(index, e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(index)}
                          className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                  >
                    {t.registerTab.addEmail}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.phones}</label>
                <div className="space-y-2">
                  {formData.phones.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => handlePhoneChange(index, e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                      />
                      {formData.phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhone(index)}
                          className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddPhone}
                    className="text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                  >
                    {t.registerTab.addPhone}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.registerTab.category} <span className="text-purple-600">*</span>
                </label>
                <input 
                  type="text" 
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.status}</label>
                <select 
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option>{t.options.status.eval}</option>
                  <option>{t.options.status.auth}</option>
                  <option>{t.options.status.susp}</option>
                  <option>{t.options.status.inact}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.currency}</label>
                <select 
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option>{t.options.currency.mxn}</option>
                  <option>{t.options.currency.usd}</option>
                  <option>{t.options.currency.eur}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.creditType}</label>
                <select 
                  name="creditType"
                  value={formData.creditType}
                  onChange={handleInputChange}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option>{t.options.credit.cash}</option>
                  <option>{t.options.credit.advance}</option>
                  <option>{t.options.credit.credit}</option>
                  <option>{t.options.credit.delivery}</option>
                  <option>{t.options.credit.installments}</option>
                  <option>{t.options.credit.consignment}</option>
                  <option>{t.options.credit.other}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.creditDays}</label>
                <input 
                  type="number" 
                  name="creditDays"
                  value={formData.creditDays}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.deliveryTime}</label>
                <input 
                  type="number" 
                  name="deliveryTime"
                  value={formData.deliveryTime}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.deliveryUnit}</label>
                <select 
                  name="deliveryUnit"
                  value={formData.deliveryUnit}
                  onChange={handleInputChange}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option>{t.options.deliveryUnits.businessDays}</option>
                  <option>{t.options.deliveryUnits.calendarDays}</option>
                  <option>{t.options.deliveryUnits.weeks}</option>
                  <option>{t.options.deliveryUnits.months}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.initialRating}</label>
                <input 
                  type="number" 
                  name="initialRating"
                  value={formData.initialRating}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.documents}</label>
                <input 
                  type="text" 
                  name="documents"
                  value={formData.documents}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.logo}</label>
                <div className="border border-blue-100 bg-blue-50/20 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
                  <div className="w-36 h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs overflow-hidden relative shadow-inner">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <span className="text-slate-400 font-medium text-xs">{t.registerTab.noLogo}</span>
                    )}
                  </div>

                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-xl p-1.5">
                      <label className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors border border-slate-200">
                        {t.registerTab.chooseFile}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/png, image/jpeg, image/webp" 
                          onChange={handleLogoChange}
                        />
                      </label>
                      <span className="text-xs text-slate-500 truncate max-w-xs">
                        {logoFile ? logoFile.name : t.registerTab.noFileSelected}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400">{t.registerTab.allowedFormats}</p>

                    {logoFile && (
                      <button 
                        type="button" 
                        onClick={handleRemoveLogo}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t.registerTab.removeLogo}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.registerTab.observations}</label>
                <textarea 
                  rows={3}
                  name="observations"
                  value={formData.observations}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button 
                type="button"
                onClick={handleSaveSupplier}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
              >
                <span>💾</span>
                {t.registerTab.btnSave}
              </button>

              <button 
                type="button" 
                onClick={handleClearForm}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>🧹</span>
                {t.registerTab.btnClear}
              </button>

              <button 
                type="button" 
                onClick={() => setActiveTab('matrix')}
                className="border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>📋</span>
                {t.registerTab.btnMatrix}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Matriz */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">{t.matrixTab.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t.matrixTab.subtitle}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => setActiveTab('import')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {t.matrixTab.btnImport}
                </button>
                <button 
                  onClick={() => setActiveTab('register')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {t.matrixTab.btnNew}
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.matrixTab.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50/50 border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-700"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">{t.matrixTab.allStatus}</option>
                <option value={t.options.status.eval}>{t.options.status.eval}</option>
                <option value={t.options.status.auth}>{t.options.status.auth}</option>
                <option value={t.options.status.susp}>{t.options.status.susp}</option>
                <option value={t.options.status.inact}>{t.options.status.inact}</option>
              </select>
            </div>

            <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">{t.matrixTab.colLogo}</th>
                      <th className="py-3 px-4">{t.matrixTab.colNumber}</th>
                      <th className="py-3 px-4">{t.matrixTab.colSupplier}</th>
                      <th className="py-3 px-4">{t.matrixTab.colRfc}</th>
                      <th className="py-3 px-4">{t.matrixTab.colCategory}</th>
                      <th className="py-3 px-4">{t.matrixTab.colStatus}</th>
                      <th className="py-3 px-4">{t.matrixTab.colSupplies}</th>
                      <th className="py-3 px-4 text-center">{t.matrixTab.colDelivery}</th>
                      <th className="py-3 px-4">{t.matrixTab.colCredit}</th>
                      <th className="py-3 px-4">{t.matrixTab.colRating}</th>
                      <th className="py-3 px-4">{t.matrixTab.colOc}</th>
                      <th className="py-3 px-4">{t.matrixTab.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.length > 0 ? (
                      filteredSuppliers.map((supplier, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-xs text-slate-700">
                          <td className="py-3 px-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                              {supplier.logo ? (
                                <img src={supplier.logo} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">{supplier.number}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{supplier.socialReason}</td>
                          <td className="py-3 px-4 font-mono text-[11px]">{supplier.rfc}</td>
                          <td className="py-3 px-4">{supplier.category}</td>
                          <td className="py-3 px-4">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                              {supplier.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">-</td>
                          <td className="py-3 px-4 text-center text-slate-500">-</td>
                          <td className="py-3 px-4 text-slate-500">-</td>
                          <td className="py-3 px-4 font-bold text-purple-700">{supplier.rating || '80'} pts</td>
                          <td className="py-3 px-4 text-slate-500">-</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
<td className="py-3 px-4">
    <div className="flex items-center justify-center gap-2">
      <button 
        onClick={() => handleEditSupplier(supplier)}
        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
        title="Editar"
      >
        <Edit3 className="w-4 h-4" />
      </button>
      <button 
        onClick={() => handleOpenDeleteModal(supplier)}
        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors cursor-pointer"
        title="Eliminar"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </td>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="py-16 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <span className="text-3xl">📋</span>
                            <h4 className="text-xs font-bold text-slate-700">{t.matrixTab.emptyState}</h4>
                            <p className="text-[11px] text-slate-400">{t.matrixTab.emptyStateHelp}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* --- MODAL DE ELIMINACIÓN --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-7 shadow-2xl transform transition-all">
            
            {/* Encabezado */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex gap-4 items-center">
                <div className="bg-rose-50 p-3 rounded-2xl text-rose-600 border border-rose-100">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Eliminar proveedor</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Confirma antes de eliminar este registro.</p>
                </div>
              </div>
              <button onClick={handleCloseDeleteModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Datos del proveedor */}
            <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-6">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">No. de proveedor</span>
                <span className="block text-sm font-black text-slate-900">{supplierToDelete?.number || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clave</span>
                <span className="block text-sm font-bold text-slate-900">—</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proveedor</span>
                <span className="block text-sm font-bold text-slate-900">{supplierToDelete?.socialReason || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">RFC / Tax ID</span>
                <span className="block text-sm font-bold text-slate-900">{supplierToDelete?.rfc || '—'}</span>
              </div>
            </div>

            {/* Cuadrícula de contadores */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="border border-slate-100 rounded-2xl p-4 text-center">
                <span className="block text-xl font-black text-slate-900">2</span>
                <span className="block text-[10px] font-semibold text-slate-400 mt-1">RFQ</span>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 text-center">
                <span className="block text-xl font-black text-slate-900">0</span>
                <span className="block text-[10px] font-semibold text-slate-400 mt-1">Cotizaciones</span>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 text-center">
                <span className="block text-xl font-black text-slate-900">0</span>
                <span className="block text-[10px] font-semibold text-slate-400 mt-1">Órdenes de Compra</span>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 text-center">
                <span className="block text-xl font-black text-slate-900">0</span>
                <span className="block text-[10px] font-semibold text-slate-400 mt-1">Servicios</span>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 text-center">
                <span className="block text-xl font-black text-slate-900">2</span>
                <span className="block text-[10px] font-semibold text-slate-400 mt-1">Adjudicaciones</span>
              </div>
            </div>

            {/* Banner de Advertencia */}
            <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl p-4 mb-8">
              <h4 className="text-xs font-bold text-[#b45309] mb-1">No conviene eliminar este proveedor.</h4>
              <p className="text-[11px] text-[#b45309]/80 leading-relaxed">
                Está relacionado con documentos del proceso. Borrarlo rompería la trazabilidad. Puedes marcarlo como Inactivo.
              </p>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button 
                onClick={handleCloseDeleteModal}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleMarkInactive}
                className="px-5 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-colors"
              >
                Marcar Inactivo
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-colors"
              >
                Eliminar definitivamente
              </button>
            </div>

          </div>
        </div>
      )}
          </div>
        )}

        {/* TAB 3: Indicadores */}
        {activeTab === 'indicators' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">{t.indicatorsTab.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t.indicatorsTab.subtitle}</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>📋</span> {t.indicatorsTab.btnMatrix}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-50/40 border-l-4 border-l-emerald-500 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-sm font-black text-slate-900 block">0</span>
                  <span className="text-xs text-slate-600 font-medium">{t.indicatorsTab.authorized}</span>
                </div>
              </div>

              <div className="bg-amber-50/40 border-l-4 border-l-amber-500 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-sm font-black text-slate-900 block">0</span>
                  <span className="text-xs text-slate-600 font-medium">{t.indicatorsTab.inEvaluation}</span>
                </div>
              </div>

              <div className="bg-rose-50/40 border-l-4 border-l-rose-500 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-sm font-black text-slate-900 block">0</span>
                  <span className="text-xs text-slate-600 font-medium">{t.indicatorsTab.suspended}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-sky-50/30 border-l-4 border-l-sky-500 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{t.indicatorsTab.avgRating}</span>
                  <span className="text-xs text-slate-600 font-semibold mt-1 block">0/100</span>
                </div>
              </div>

              <div className="bg-sky-50/30 border-l-4 border-l-blue-600 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{t.indicatorsTab.registeredItems}</span>
                  <span className="text-xs text-slate-600 font-semibold mt-1 block">0</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50/40 border-l-4 border-l-amber-500 border border-slate-100 rounded-2xl p-4">
              <span className="text-xs font-black text-slate-900 block">0</span>
              <span className="text-xs text-slate-600 font-medium">{t.indicatorsTab.pendingUpdate}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{t.indicatorsTab.statusAuthTitle}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.indicatorsTab.statusAuthSub}</p>
                </div>
                <div className="bg-emerald-50/50 border-l-4 border-l-emerald-500 border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{t.indicatorsTab.statusAuthDesc}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{t.indicatorsTab.statusEvalTitle}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.indicatorsTab.statusEvalSub}</p>
                </div>
                <div className="bg-amber-50/50 border-l-4 border-l-amber-500 border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{t.indicatorsTab.statusEvalDesc}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{t.indicatorsTab.statusSuspTitle}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.indicatorsTab.statusSuspSub}</p>
                </div>
                <div className="bg-rose-50/50 border-l-4 border-l-rose-500 border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{t.indicatorsTab.statusSuspDesc}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Importar */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">{t.importTab.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t.importTab.subtitle}</p>
              </div>
              <div>
                <span className="bg-purple-50 text-purple-700 text-[10px] font-extrabold px-3 py-1.5 rounded-full border border-purple-100">
                  Excel / XLSX / XLS / CSV
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleExcelDrop}
                  className="border-2 border-dashed border-blue-200 bg-blue-50/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-blue-50/30"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-3">
                    <FileSpreadsheet className="w-6 h-6 text-purple-600" />
                  </div>

                  <h4 className="text-sm font-bold text-slate-800">{t.importTab.selectTitle}</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">{t.importTab.selectDesc}</p>

                  <label className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-500/20 inline-flex items-center gap-2">
                    <span>{t.importTab.btnSelectFile}</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          processExcelFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  <span className="text-[11px] text-slate-400 mt-3 font-medium">
                    {excelFile ? excelFile.name : t.importTab.noFile}
                  </span>
                </div>

                <div className="bg-sky-50/40 border border-sky-100 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed">
                  <p className="text-[11px]">
                    <strong className="text-slate-900">{t.importTab.colsInfoTitle}</strong> {t.importTab.colsInfoText}
                  </p>
                </div>

                <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed">
                  <p className="text-[11px]">
                    <strong className="text-slate-900">{t.importTab.editInfoTitle}</strong> {t.importTab.editInfoText}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <h4 className="text-xs font-extrabold text-slate-900">{t.importTab.rulesTitle}</h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.importTab.dupRuleLabel}</label>
                    <select
                      name="duplicateHandling"
                      value={importRules.duplicateHandling}
                      onChange={handleImportRuleChange}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer font-medium"
                    >
                      <option>{t.options.dupHandling.skip}</option>
                      <option>{t.options.dupHandling.update}</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">{t.importTab.dupRuleHelp}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.importTab.categoryLabel}</label>
                    <input
                      type="text"
                      name="defaultCategory"
                      value={importRules.defaultCategory}
                      onChange={handleImportRuleChange}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 placeholder:text-slate-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{t.importTab.categoryHelp}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.importTab.statusLabel}</label>
                    <select
                      name="newSupplierStatus"
                      value={importRules.newSupplierStatus}
                      onChange={handleImportRuleChange}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer font-medium"
                    >
                      <option>{t.options.status.eval}</option>
                      <option>{t.options.status.auth}</option>
                      <option>{t.options.status.inact}</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">{t.importTab.statusHelp}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.importTab.currencyLabel}</label>
                    <select
                      name="defaultCurrency"
                      value={importRules.defaultCurrency}
                      onChange={handleImportRuleChange}
                      className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer font-medium"
                    >
                      <option>{t.options.currency.mxn}</option>
                      <option>{t.options.currency.usd}</option>
                      <option>{t.options.currency.eur}</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadOriginalFile}
                    disabled={!excelFile}
                    className={`flex-1 text-xs font-bold py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                      excelFile
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.importTab.btnTemplate}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearImport}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>✏️</span>
                    {t.importTab.btnClear}
                  </button>
                </div>
              </div>
            </div>

            {/* Vista previa de Excel */}
            {excelFile && (
              <div className="pt-6 border-t border-slate-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                      <TableIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">{t.importTab.previewTitle}</h4>
                      <p className="text-[11px] text-slate-400">
                        {t.importTab.previewSubtitle.replace('{count}', totalRowsCount)}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1.5 self-start sm:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {t.importTab.fileOk}
                  </span>
                </div>

                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto max-h-[380px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-md border-b border-slate-200/80 text-[10px] font-bold text-slate-600 uppercase tracking-wider z-10">
                        <tr>
                          <th className="py-2.5 px-4 w-12 text-center text-slate-400">#</th>
                          {previewHeaders.map((header, idx) => (
                            <th key={idx} className="py-2.5 px-4 whitespace-nowrap">
                              {header || `Columna ${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.slice(0, 10).map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-blue-50/30 transition-colors text-slate-700">
                            <td className="py-2.5 px-4 font-bold text-slate-400 text-center text-[10px]">
                              {rowIndex + 1}
                            </td>
                            {previewHeaders.map((_, colIndex) => (
                              <td key={colIndex} className="py-2.5 px-4 whitespace-nowrap text-[11px]">
                                {row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalRowsCount > 10 && (
                    <div className="bg-slate-50/80 border-t border-slate-200/80 px-4 py-2 text-center text-[10px] font-semibold text-slate-500">
                      {t.importTab.showingRows.replace('{count}', totalRowsCount)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}