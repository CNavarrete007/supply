import React, { useState } from 'react';

// DICCIONARIO DE TRADUCCIONES PARA FACTURA
const TEXTS = {
  es: {
    headerTitle: "Factura",
    headerSubtitle: "Administración, emisión y seguimiento de facturación electrónica.",
    tabs: [
      {
        id: 1,
        title: "Registro de factura",
        description: "Captura los datos fiscales y adjunta el archivo de la factura.",
        icon: "🧾"
      },
      {
        id: 2,
        title: "Matriz de facturas",
        description: "Consulta, edita, visualiza archivos y elimina registros.",
        icon: "📋"
      },
      {
        id: 3,
        title: "Control de facturación",
        description: "Identifica entregas aceptadas pendientes de factura y vencimientos.",
        icon: "🚦"
      }
    ],
    tab1: {
      title: "Datos de la factura",
      subtitle: "La factura corresponde a la etapa 8 y debe relacionarse con una entrega aceptada por el cliente.",
      badge: "Paso 8 • Factura",
      reqLabel: "Requisición entregada y aceptada *",
      reqPlaceholder: "Seleccionar requisición...",
      reqOptions: [
        { value: "REQ-2026-001", label: "REQ-2026-001 - Entrega 1" },
        { value: "REQ-2026-002", label: "REQ-2026-002 - Entrega 2" }
      ],
      invoiceNumberLabel: "Número de factura *",
      invoiceNumberPlaceholder: "Ej. A-1058",
      uuidLabel: "UUID / Folio fiscal",
      uuidPlaceholder: "UUID del CFDI",
      issueDateLabel: "Fecha de emisión *",
      dueDateLabel: "Fecha de vencimiento",
      currencyLabel: "Moneda",
      statusLabel: "Estatus",
      statusOptions: [
        { value: "Registrada", label: "Registrada" },
        { value: "Enviada al cliente", label: "Enviada al cliente" },
        { value: "Pendiente de pago", label: "Pendiente de pago" },
        { value: "Pagada", label: "Pagada" },
        { value: "Cancelada", label: "Cancelada" }
      ],
      issuerLabel: "Emisor / razón social",
      receiverLabel: "Receptor / razón social",
      subtotalLabel: "Subtotal",
      taxLabel: "Impuestos",
      totalLabel: "Total *",
      paymentTermsLabel: "Condiciones / método de pago",
      paymentTermsPlaceholder: "Ej. Transferencia · Crédito 30 días",
      notesLabel: "Observaciones",
      notesPlaceholder: "Notas fiscales, referencias, orden de compra, recepción o aclaraciones.",
      contextBanner: "Selecciona una requisición entregada y aceptada para cargar su contexto.",
      fileTitle: "Archivo de la factura *",
      fileSubtitle: "Adjunta el archivo de la factura. Se permiten PDF, XML o imagen.",
      fileReady: "Listo para guardar",
      fileEmpty: "No se ha cargado ningún archivo de factura.",
      btnViewFile: "Ver archivo",
      btnRemoveFile: "Quitar archivo",
      btnSave: "Guardar factura",
      btnClear: "Limpiar",
      btnCalcTotal: "Calcular total",
      btnViewMatrix: "Ver matriz",
      alerts: {
        selectReq: "Por favor selecciona una requisición entregada y aceptada.",
        enterInvNumber: "Por favor ingresa el número de factura.",
        savedSuccess: "Factura guardada correctamente.",
        notifTitle: "Factura registrada",
        notifDesc: "Se registró la factura N°"
      }
    },
    tab2: {
      title: "Matriz de facturas",
      subtitle: "Concentrado de facturas relacionadas con requisiciones, órdenes de compra y entregas aceptadas.",
      btnNewInvoice: "Nueva factura",
      searchPlaceholder: "Buscar factura, UUID, requisición, cliente o proyecto...",
      allStatuses: "Todos los estatus",
      tableHeaders: [
        "Factura", "UUID", "Requisición", "OC", "Cliente / Proyecto", 
        "Emisor", "Receptor", "Emisión", "Vencimiento", "Total", 
        "Estatus", "Archivo", "Acciones"
      ],
      noInvoices: "No hay facturas registradas.",
      btnView: "📄 Ver",
      btnViewFile: "VER ARCHIVO",
      btnEdit: "EDITAR",
      btnDelete: "ELIMINAR"
    },
    tab3: {
      title: "Control de facturación y cierre",
      subtitle: "El proceso llega al 100% cuando la factura está registrada y no se encuentra cancelada.",
      btnViewInvoices: "Ver facturas",
      metrics: {
        readyToInvoice: "Listos para facturar",
        activeInvoices: "Facturas vigentes",
        pendingPayment: "Pendientes de pago",
        overdue: "Vencidas",
        paid: "Pagadas",
        totalInvoiced: "Total facturado"
      }
    }
  },
  en: {
    headerTitle: "Invoice",
    headerSubtitle: "Administration, issuance, and tracking of electronic invoicing.",
    tabs: [
      {
        id: 1,
        title: "Invoice Registration",
        description: "Capture tax details and attach the invoice file.",
        icon: "🧾"
      },
      {
        id: 2,
        title: "Invoice Matrix",
        description: "View, edit, visualize files, and delete records.",
        icon: "📋"
      },
      {
        id: 3,
        title: "Billing Control",
        description: "Identify accepted deliveries pending invoice and due dates.",
        icon: "🚦"
      }
    ],
    tab1: {
      title: "Invoice Data",
      subtitle: "The invoice corresponds to stage 8 and must relate to a delivery accepted by the client.",
      badge: "Step 8 • Invoice",
      reqLabel: "Delivered and accepted requisition *",
      reqPlaceholder: "Select requisition...",
      reqOptions: [
        { value: "REQ-2026-001", label: "REQ-2026-001 - Delivery 1" },
        { value: "REQ-2026-002", label: "REQ-2026-002 - Delivery 2" }
      ],
      invoiceNumberLabel: "Invoice Number *",
      invoiceNumberPlaceholder: "e.g. A-1058",
      uuidLabel: "UUID / Fiscal Folio",
      uuidPlaceholder: "CFDI UUID",
      issueDateLabel: "Issue Date *",
      dueDateLabel: "Due Date",
      currencyLabel: "Currency",
      statusLabel: "Status",
      statusOptions: [
        { value: "Registrada", label: "Registered" },
        { value: "Enviada al cliente", label: "Sent to Client" },
        { value: "Pendiente de pago", label: "Pending Payment" },
        { value: "Pagada", label: "Paid" },
        { value: "Cancelada", label: "Canceled" }
      ],
      issuerLabel: "Issuer / Company Name",
      receiverLabel: "Receiver / Company Name",
      subtotalLabel: "Subtotal",
      taxLabel: "Taxes",
      totalLabel: "Total *",
      paymentTermsLabel: "Payment Terms / Method",
      paymentTermsPlaceholder: "e.g. Transfer · 30-day Credit",
      notesLabel: "Observations",
      notesPlaceholder: "Tax notes, references, purchase order, receipt or clarifications.",
      contextBanner: "Select a delivered and accepted requisition to load its context.",
      fileTitle: "Invoice File *",
      fileSubtitle: "Attach the invoice file. PDF, XML or images are allowed.",
      fileReady: "Ready to save",
      fileEmpty: "No invoice file has been uploaded.",
      btnViewFile: "View File",
      btnRemoveFile: "Remove File",
      btnSave: "Save Invoice",
      btnClear: "Clear",
      btnCalcTotal: "Calculate Total",
      btnViewMatrix: "View Matrix",
      alerts: {
        selectReq: "Please select a delivered and accepted requisition.",
        enterInvNumber: "Please enter the invoice number.",
        savedSuccess: "Invoice saved successfully.",
        notifTitle: "Invoice Registered",
        notifDesc: "Invoice No. registered"
      }
    },
    tab2: {
      title: "Invoice Matrix",
      subtitle: "Summary of invoices related to requisitions, purchase orders, and accepted deliveries.",
      btnNewInvoice: "New Invoice",
      searchPlaceholder: "Search invoice, UUID, requisition, client, or project...",
      allStatuses: "All Statuses",
      tableHeaders: [
        "Invoice", "UUID", "Requisition", "PO", "Client / Project", 
        "Issuer", "Receiver", "Issue Date", "Due Date", "Total", 
        "Status", "File", "Actions"
      ],
      noInvoices: "No registered invoices.",
      btnView: "📄 View",
      btnViewFile: "VIEW FILE",
      btnEdit: "EDIT",
      btnDelete: "DELETE"
    },
    tab3: {
      title: "Billing Control & Closure",
      subtitle: "The process reaches 100% when the invoice is registered and is not canceled.",
      btnViewInvoices: "View Invoices",
      metrics: {
        readyToInvoice: "Ready to Invoice",
        activeInvoices: "Active Invoices",
        pendingPayment: "Pending Payment",
        overdue: "Overdue",
        paid: "Paid",
        totalInvoiced: "Total Invoiced"
      }
    }
  }
};

export function Invoice({ onNotify, lang = 'es', language, isEnglish }) {
  // Detección consistente del idioma
  const isEn = isEnglish || lang === 'en' || language === 'en';
  const currentLang = isEn ? 'en' : 'es';
  const t = TEXTS[currentLang] || TEXTS.es;

  const [activeTab, setActiveTab] = useState(1);

  // Estado local del formulario
  const [isCapturingInvoice, setIsCapturingInvoice] = useState(true);
  const [invoiceData, setInvoiceData] = useState({
    requisicionAceptada: "",
    numeroFactura: "",
    uuidFolioFiscal: "",
    fechaEmision: "2026-09-04",
    fechaVencimiento: "",
    moneda: "MXN",
    estatus: "Registrada",
    emisorRazonSocial: "",
    receptorRazonSocial: "",
    subtotal: "",
    impuestos: "",
    total: "",
    condicionesMetodoPago: "",
    observaciones: ""
  });
  const [invoiceFile, setInvoiceFile] = useState(null);

  const handleInvoiceChange = (e) => {
    const { name, value } = e.target;
    setInvoiceData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === "subtotal" || name === "impuestos") {
        const sub = parseFloat(name === "subtotal" ? value : prev.subtotal) || 0;
        const imp = parseFloat(name === "impuestos" ? value : prev.impuestos) || 0;
        updated.total = (sub + imp).toFixed(2);
      }
      return updated;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInvoiceFile({
        file,
        name: file.name,
        size: (file.size / 1024).toFixed(2) + " KB",
        url: URL.createObjectURL(file)
      });
    }
  };

  const handleRemoveFile = () => {
    setInvoiceFile(null);
  };

  const handleClearInvoice = () => {
    setInvoiceData({
      requisicionAceptada: "",
      numeroFactura: "",
      uuidFolioFiscal: "",
      fechaEmision: "2026-09-04",
      fechaVencimiento: "",
      moneda: "MXN",
      estatus: "Registrada",
      emisorRazonSocial: "",
      receptorRazonSocial: "",
      subtotal: "",
      impuestos: "",
      total: "",
      condicionesMetodoPago: "",
      observaciones: ""
    });
    setInvoiceFile(null);
  };

  const handleCalculateTotal = () => {
    const sub = parseFloat(invoiceData.subtotal) || 0;
    const imp = parseFloat(invoiceData.impuestos) || 0;
    setInvoiceData(prev => ({
      ...prev,
      total: (sub + imp).toFixed(2)
    }));
  };

  // EMISIÓN / GUARDADO Y ENVÍO A LA CAMPANA PRINCIPAL
  const handleSaveInvoice = () => {
    if (!invoiceData.requisicionAceptada) {
      alert(t.tab1.alerts.selectReq);
      return;
    }
    if (!invoiceData.numeroFactura) {
      alert(t.tab1.alerts.enterInvNumber);
      return;
    }

    if (onNotify) {
      onNotify(
        t.tab1.alerts.notifTitle,
        `${t.tab1.alerts.notifDesc} ${invoiceData.numeroFactura} (${invoiceData.requisicionAceptada})`
      );
    }

    alert(t.tab1.alerts.savedSuccess);
    setIsCapturingInvoice(false);
  };

  // Estado para filtrado
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos los estatus");
  const [invoices, setInvoices] = useState([]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.uuid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.requisicion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.clienteProyecto?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      selectedStatus === "Todos los estatus" || inv.estatus === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-left">
      {/* ENCABEZADO */}
      <div>
        <h2 className="text-xl font-black text-slate-900">{t.headerTitle}</h2>
        <p className="text-xs text-slate-500">{t.headerSubtitle}</p>
      </div>

      {/* GRID DE NAVEGACIÓN DE TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {t.tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-transparent shadow-md"
                  : "bg-white border-slate-200/80 hover:border-slate-300 text-slate-800 shadow-2xs"
              }`}
            >
              <div>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-3 ${
                    isActive ? "bg-white/20 text-white" : "bg-blue-50/80 text-blue-600 border border-blue-100"
                  }`}
                >
                  {tab.icon}
                </div>
                <h3 className={`text-xs font-bold ${isActive ? "text-white" : "text-slate-900"}`}>
                  {tab.title}
                </h3>
                <p className={`text-[10px] mt-1 leading-relaxed ${isActive ? "text-purple-100" : "text-slate-400"}`}>
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* CONTENEDOR DINÁMICO */}
      <div className="mt-6">
        {/* PESTAÑA 1: REGISTRO DE FACTURA */}
        {activeTab === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.tab1.title}</h3>
                <p className="text-xs text-slate-500">{t.tab1.subtitle}</p>
              </div>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-purple-200 self-start sm:self-auto">
                {t.tab1.badge}
              </span>
            </div>

            <fieldset disabled={!isCapturingInvoice} className="space-y-4 disabled:opacity-70">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.reqLabel}</label>
                  <select
                    name="requisicionAceptada"
                    value={invoiceData.requisicionAceptada}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">{t.tab1.reqPlaceholder}</option>
                    {t.tab1.reqOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.invoiceNumberLabel}</label>
                  <input
                    type="text"
                    name="numeroFactura"
                    placeholder={t.tab1.invoiceNumberPlaceholder}
                    value={invoiceData.numeroFactura}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.uuidLabel}</label>
                  <input
                    type="text"
                    name="uuidFolioFiscal"
                    placeholder={t.tab1.uuidPlaceholder}
                    value={invoiceData.uuidFolioFiscal}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.issueDateLabel}</label>
                  <input
                    type="date"
                    name="fechaEmision"
                    value={invoiceData.fechaEmision}
                    onChange={handleInvoiceChange}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.dueDateLabel}</label>
                  <input
                    type="date"
                    name="fechaVencimiento"
                    value={invoiceData.fechaVencimiento}
                    onChange={handleInvoiceChange}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.currencyLabel}</label>
                  <select
                    name="moneda"
                    value={invoiceData.moneda}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.statusLabel}</label>
                  <select
                    name="estatus"
                    value={invoiceData.estatus}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    {t.tab1.statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.issuerLabel}</label>
                  <input
                    type="text"
                    name="emisorRazonSocial"
                    value={invoiceData.emisorRazonSocial}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.receiverLabel}</label>
                  <input
                    type="text"
                    name="receptorRazonSocial"
                    value={invoiceData.receptorRazonSocial}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.subtotalLabel}</label>
                  <input
                    type="number"
                    step="0.00"
                    name="subtotal"
                    value={invoiceData.subtotal}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.taxLabel}</label>
                  <input
                    type="number"
                    step="0.01"
                    name="impuestos"
                    value={invoiceData.impuestos}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.totalLabel}</label>
                  <input
                    type="number"
                    step="0.01"
                    name="total"
                    value={invoiceData.total}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.paymentTermsLabel}</label>
                  <input
                    type="text"
                    name="condicionesMetodoPago"
                    placeholder={t.tab1.paymentTermsPlaceholder}
                    value={invoiceData.condicionesMetodoPago}
                    onChange={handleInvoiceChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">{t.tab1.notesLabel}</label>
                <textarea
                  name="observaciones"
                  rows="2"
                  placeholder={t.tab1.notesPlaceholder}
                  value={invoiceData.observaciones}
                  onChange={handleInvoiceChange}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs resize-none placeholder:text-slate-400"
                />
              </div>
            </fieldset>

            <div className="bg-blue-50/70 border-l-4 border-blue-500 rounded-r-xl p-3 text-xs text-slate-600 font-medium">
              {t.tab1.contextBanner}
            </div>

            <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/30 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{t.tab1.fileTitle}</h4>
                <p className="text-[11px] text-slate-400">
                  {t.tab1.fileSubtitle}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center">
                <input
                  type="file"
                  accept=".pdf,.xml,image/*"
                  disabled={!isCapturingInvoice}
                  onChange={handleFileChange}
                  className="text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer w-full"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
                {invoiceFile ? (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">📄 {invoiceFile.name} ({invoiceFile.size})</span>
                    <span className="text-emerald-600 font-bold text-[11px]">{t.tab1.fileReady}</span>
                  </div>
                ) : (
                  <span>{t.tab1.fileEmpty}</span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!invoiceFile}
                  onClick={() => invoiceFile && window.open(invoiceFile.url, '_blank')}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>👁️</span>
                  <span>{t.tab1.btnViewFile}</span>
                </button>

                <button
                  type="button"
                  disabled={!invoiceFile || !isCapturingInvoice}
                  onClick={handleRemoveFile}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>🗑️</span>
                  <span>{t.tab1.btnRemoveFile}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveInvoice}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-black rounded-2xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer border border-purple-600/30"
              >
                <span>💾</span>
                <span>{t.tab1.btnSave}</span>
              </button>

              <button
                type="button"
                onClick={handleClearInvoice}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>✏️</span>
                <span>{t.tab1.btnClear}</span>
              </button>

              <button
                type="button"
                onClick={handleCalculateTotal}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>🧮</span>
                <span>{t.tab1.btnCalcTotal}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>📋</span>
                <span>{t.tab1.btnViewMatrix}</span>
              </button>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: MATRIZ DE FACTURAS */}
        {activeTab === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.tab2.title}</h3>
                <p className="text-xs text-slate-400">
                  {t.tab2.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab(1)}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <span>+</span>
                <span>{t.tab2.btnNewInvoice}</span>
              </button>
            </div>

            <div>
              <input
                type="text"
                placeholder={t.tab2.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
              />
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="Todos los estatus">{t.tab2.allStatuses}</option>
                <option value="Registrada">{isEn ? "Registered" : "Registrada"}</option>
                <option value="Enviada al cliente">{isEn ? "Sent to client" : "Enviada al cliente"}</option>
                <option value="Pendiente de pago">{isEn ? "Pending payment" : "Pendiente de pago"}</option>
                <option value="Pagada">{isEn ? "Paid" : "Pagada"}</option>
                <option value="Cancelada">{isEn ? "Canceled" : "Cancelada"}</option>
              </select>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      {t.tab2.tableHeaders.map((header, idx) => (
                        <th key={idx} className="py-3 px-3">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="13" className="py-12 px-4 text-center">
                          <p className="text-xs text-slate-400 font-normal">
                            {t.tab2.noInvoices}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900">{inv.factura}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{inv.uuid}</td>
                          <td className="py-3 px-3 text-slate-700">{inv.requisicion}</td>
                          <td className="py-3 px-3 text-slate-600">{inv.oc}</td>
                          <td className="py-3 px-3 text-slate-700 font-medium">{inv.clienteProyecto}</td>
                          <td className="py-3 px-3 text-slate-600">{inv.emisor}</td>
                          <td className="py-3 px-3 text-slate-600">{inv.receptor}</td>
                          <td className="py-3 px-3 text-slate-600">{inv.emision}</td>
                          <td className="py-3 px-3 text-slate-600">{inv.vencimiento}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">${inv.total}</td>
                          <td className="py-3 px-3">
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {inv.estatus}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <button type="button" className="text-blue-600 hover:underline font-bold text-[11px]">
                              {t.tab2.btnView}
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button type="button" className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold rounded-md">{t.tab2.btnViewFile}</button>
                              <button type="button" onClick={() => setActiveTab(1)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold rounded-md">{t.tab2.btnEdit}</button>
                              <button type="button" className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold rounded-md">{t.tab2.btnDelete}</button>
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

        {/* PESTAÑA 3: CONTROL DE FACTURACIÓN */}
        {activeTab === 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.tab3.title}</h3>
                <p className="text-xs text-slate-400">
                  {t.tab3.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab(2)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>📋</span>
                <span>{t.tab3.btnViewInvoices}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500 rounded-t-2xl"></div>
                <div className="pt-1"><span className="text-2xl font-black text-slate-900 leading-none">0</span></div>
                <div className="mt-2"><p className="text-[11px] text-slate-400 font-medium leading-tight">{t.tab3.metrics.readyToInvoice}</p></div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-purple-600 rounded-t-2xl"></div>
                <div className="pt-1"><span className="text-2xl font-black text-slate-900 leading-none">0</span></div>
                <div className="mt-2"><p className="text-[11px] text-slate-400 font-medium leading-tight">{t.tab3.metrics.activeInvoices}</p></div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-500 rounded-t-2xl"></div>
                <div className="pt-1"><span className="text-2xl font-black text-slate-900 leading-none">0</span></div>
                <div className="mt-2"><p className="text-[11px] text-slate-400 font-medium leading-tight">{t.tab3.metrics.pendingPayment}</p></div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600 rounded-t-2xl"></div>
                <div className="pt-1"><span className="text-2xl font-black text-slate-900 leading-none">0</span></div>
                <div className="mt-2"><p className="text-[11px] text-slate-400 font-medium leading-tight">{t.tab3.metrics.overdue}</p></div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500 rounded-t-2xl"></div>
                <div className="pt-1"><span className="text-2xl font-black text-slate-900 leading-none">0</span></div>
                <div className="mt-2"><p className="text-[11px] text-slate-400 font-medium leading-tight">{t.tab3.metrics.paid}</p></div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-teal-600 rounded-t-2xl"></div>
                <div className="pt-1"><span className="text-2xl font-black text-slate-900 leading-none">$0.00</span></div>
                <div className="mt-2"><p className="text-[11px] text-slate-400 font-medium leading-tight">{t.tab3.metrics.totalInvoiced}</p></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}