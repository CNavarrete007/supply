import React, { useState, useRef, useEffect } from 'react';

// ==========================================
// MOCK DATA
// ==========================================
const mockRevisionQuotes = [
  {
    id: '1',
    folio: 'COT-2026-0032',
    cliente: 'SBM OFFSHORE DE MEXICO, S.A. DE C.V.',
    referencia: 'WO - GG - 004',
    changeRequest: 'Sin Change Request',
    statusBadge: 'Rev. 0 - Aprobada',
    statusType: 'aprobado',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    revisionesCount: 1,
    totalRev0: '7,092.24',
    totalVigente: '7,092.24',
    moneda: 'MXN',
    historial: [
      { rev: 'Rev. 0', fecha: '2026-09-10', total: '7,092.24', motivo: 'Emisión inicial', autor: 'Carlos Navarrete' }
    ]
  },
  {
    id: '2',
    folio: 'COT-2026-0031',
    cliente: 'GLOBALSANTAFE DRILLING MEXICO',
    referencia: '19900001411',
    changeRequest: 'Sin Change Request',
    statusBadge: 'Rev. 0 - Borrador',
    statusType: 'pendiente',
    statusColor: 'bg-blue-100 text-blue-800 border-blue-200',
    revisionesCount: 1,
    totalRev0: '7,588.70',
    totalVigente: '7,588.70',
    moneda: 'MXN',
    historial: [
      { rev: 'Rev. 0', fecha: '2026-09-15', total: '7,588.70', motivo: 'Borrador inicial', autor: 'Aime Vega' }
    ]
  },
  {
    id: '3',
    folio: 'COT-2026-0028',
    cliente: 'GLOBALSANTAFE DRILLING MEXICO',
    referencia: '18000012684',
    changeRequest: 'CR-2026-003',
    statusBadge: 'Rev. 0 - Revisada al cliente',
    statusType: 'pendiente',
    statusColor: 'bg-purple-100 text-purple-800 border-purple-200',
    revisionesCount: 1,
    totalRev0: '944.24',
    totalVigente: '944.24',
    moneda: 'MXN',
    historial: [
      { rev: 'Rev. 0', fecha: '2026-09-08', total: '944.24', motivo: 'Enviada a cliente', autor: 'Aime Vega' }
    ]
  },
  {
    id: '4',
    folio: 'COT-2026-0027',
    cliente: 'PEMEX EXPLORACIÓN Y PRODUCCIÓN',
    referencia: 'CT-2026-88',
    changeRequest: 'CR-2026-001',
    statusBadge: 'Rev. 1 - Aprobada',
    statusType: 'aprobado',
    statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    revisionesCount: 2,
    totalRev0: '3,905.50',
    totalVigente: '3,906.65',
    moneda: 'MXN',
    historial: [
      { rev: 'Rev. 0', fecha: '2026-08-20', total: '3,905.50', motivo: 'Cotización base', autor: 'Carlos Navarrete' },
      { rev: 'Rev. 1', fecha: '2026-09-01', total: '3,906.65', motivo: 'Ajuste de flete a solicitud del cliente (CR-2026-001)', autor: 'Carlos Navarrete' }
    ]
  },
  {
    id: '5',
    folio: 'COT-2026-0025',
    cliente: 'WOODSIDE PETROLEO OPERACIONES',
    referencia: 'WPO-4503',
    changeRequest: 'Sin Change Request',
    statusBadge: 'Rev. 0 - Sustituida',
    statusType: 'rechazado',
    statusColor: 'bg-slate-100 text-slate-700 border-slate-200',
    revisionesCount: 1,
    totalRev0: '41,059.46',
    totalVigente: '41,059.46',
    moneda: 'MXN',
    historial: [
      { rev: 'Rev. 0', fecha: '2026-08-15', total: '41,059.46', motivo: 'Sustituida por cancelación de la WO', autor: 'Aime Vega' }
    ]
  }
];

const mockReceivedQuotes = [
  {
    id: 'REC-2026-001',
    requisicion: '116831',
    proveedor: 'EQUIPOS Y SERVICIOS INDUSTRIALES, S.A. DE C.V.',
    folioCotizacion: 'COT-ESI-9982',
    fechaRecepcion: '2026-09-28',
    moneda: 'MXN',
    montoTotal: '12,450.00',
    status: 'Completa',
    pdfName: 'Cotizacion_Proveedor_ESI.pdf'
  },
  {
    id: 'REC-2026-002',
    requisicion: '116831',
    proveedor: 'SUMINISTROS MARITIMOS DEL GOLFO, S.A.',
    folioCotizacion: 'SMG-2026-441',
    fechaRecepcion: '2026-09-29',
    moneda: 'MXN',
    montoTotal: '11,800.00',
    status: 'En revisión',
    pdfName: 'Oferta_SMG_2026.pdf'
  }
];

const mockApprovalQuotes = [
  {
    id: 'COT-2026-0032',
    revision: '0',
    cliente: 'SBM OFFSHORE DE MEXICO',
    referencia: 'WO - GG - 004',
    moneda: 'MXN',
    monto: '7,092.24',
    statusText: 'Autorizada internamente',
    statusBadgeColor: 'bg-emerald-100 text-emerald-800',
    puedeEnviarCliente: true,
    requiereAutorizacionInterna: false
  },
  {
    id: 'COT-2026-0031',
    revision: '0',
    cliente: 'GLOBALSANTAFE DRILLING',
    referencia: '19900001411',
    moneda: 'MXN',
    monto: '7,588.70',
    statusText: 'Borrador',
    statusBadgeColor: 'bg-blue-100 text-blue-800',
    puedeEnviarCliente: false,
    requiereAutorizacionInterna: true
  },
  {
    id: 'COT-2026-0028',
    revision: '0',
    cliente: 'GLOBALSANTAFE DRILLING',
    referencia: '18000012684',
    moneda: 'MXN',
    monto: '944.24',
    statusText: 'Autorizada internamente',
    statusBadgeColor: 'bg-emerald-100 text-emerald-800',
    puedeEnviarCliente: true,
    requiereAutorizacionInterna: false
  }
];

const mockClientQuotesMatrix = [
  {
    id: 'COT-2026-0032',
    cliente: 'SBM OFFSHORE DE MEXICO, S.A. DE C.V.',
    referencia: 'WO - GG - 004',
    revision: 'Rev. 0',
    fecha: '2026-09-10',
    vigencia: '2026-10-10',
    moneda: 'MXN',
    monto: '7,092.24',
    status: 'Aprobada'
  },
  {
    id: 'COT-2026-0031',
    cliente: 'GLOBALSANTAFE DRILLING MEXICO',
    referencia: '19900001411',
    revision: 'Rev. 0',
    fecha: '2026-09-15',
    vigencia: '2026-10-15',
    moneda: 'MXN',
    monto: '7,588.70',
    status: 'Enviada'
  },
  {
    id: 'COT-2026-0028',
    cliente: 'GLOBALSANTAFE DRILLING MEXICO',
    referencia: '18000012684',
    revision: 'Rev. 0',
    fecha: '2026-09-08',
    vigencia: '2026-10-08',
    moneda: 'MXN',
    monto: '944.24',
    status: 'En revisión'
  }
];

const mockQuotesDB = {
  '1': {
    folio: 'COT-2026-0024',
    revision: '0',
    fecha: '2026-09-01',
    vigencia: '2026-09-16',
    moneda: 'USD',
    cliente: {
      empresa: 'GRUPO GEREZ, S.A. DE C.V.',
      contacto: 'Ing. Roberto Hernández',
      correo: 'nombre@sbmoffshore.com',
      telefono: '37792050677',
      proyecto: 'TRION',
      contrato: 'N/A',
      referencia: 'WO - GG - 004'
    },
    items: [
      { id: 1, desc: 'Digital Thermometer', brand: '—', qty: 1, unit: 'pza', price: 478.80 },
      { id: 2, desc: 'Outdoor Thermometer', brand: '—', qty: 1, unit: 'pza', price: 358.80 }
    ],
    condiciones: {
      lugarEntrega: 'PISSA',
      tiempoEntrega: 'Por confirmar',
      pago: 'Por confirmar',
      garantia: 'No indicada',
      alcance: 'Conforme a las partidas descritas.',
      exclusiones: 'No indicadas.',
      notas: 'Precios expresados en la moneda indicada. Vigencia sujeta a disponibilidad.'
    },
    firmas: {
      comprador: { nombre: 'Carlos Navarrete', puesto: 'Comprador Senior', status: 'Firmado' },
      reviso: { nombre: 'Aime Vega', puesto: 'Coordinador de Compras', status: 'Pendiente' },
      autorizo: { nombre: 'Gerente General', puesto: 'Gerente Operativo', status: 'Pendiente' }
    }
  }
};

export function Quotes({ 
  quotes, 
  setQuotes, 
  onNavigate, 
  onNotify, 
  lang: language, 
  setLanguage, 
  onToggleLanguage 
}) {
  const activeLang = language || 'es';
  const isEn = activeLang === 'en' || activeLang === 'English' || activeLang === 'EN';

  const [isMatrixOpen, setIsMatrixOpen] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("TODAS");
  
  // Estado para la tarjeta activa dentro del módulo de Cotizaciones
  const [activeTab, setActiveTab] = useState(1);
  const [activeSection, setActiveSection] = useState('quotes');

  // References
  const formRef = useRef(null);
  const pdfInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  // Helper de Notificación Interna
  const notify = (msg) => {
    if (onNotify) onNotify(msg);
  };

  // ==========================================
  // ESTADOS TARJETA 1 (Revisiones / Modificaciones)
  // ==========================================
  const [revisionQuotesList, setRevisionQuotesList] = useState(mockRevisionQuotes);
  const [revisionSearchTerm, setRevisionSearchTerm] = useState('');
  const [revisionStatusFilter, setRevisionStatusFilter] = useState('todos');
  
  // Modales Tarjeta 1
  const [selectedQuoteForHistory, setSelectedQuoteForHistory] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [selectedQuoteForModification, setSelectedQuoteForModification] = useState(null);
  const [evidenceFileName, setEvidenceFileName] = useState(null);
  
  const [selectedQuoteForNewRev, setSelectedQuoteForNewRev] = useState(null);
  const [showNewRevModal, setShowNewRevModal] = useState(false);
  const [newRevForm, setNewRevForm] = useState({ changeRequest: '', nuevoTotal: '', motivo: '' });
  const [quoteToDelete, setQuoteToDelete] = useState(null);

  const confirmDeleteQuote = () => {
    if (quoteToDelete) {
      setRevisionQuotesList(prev => prev.filter(q => q.id !== quoteToDelete.id));
      setQuoteToDelete(null);
      notify(isEn ? 'Quote deleted successfully' : 'Cotización eliminada exitosamente');
    }
  };

  // ==========================================
  // ESTADOS Y NAVEGACIÓN - TARJETA 2 (RFQ)
  // ==========================================
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [selectedReq, setSelectedReq] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [isRfqGenerated, setIsRfqGenerated] = useState(false);

  const [rfqData, setRfqData] = useState({
    buyer: '',
    reqNumber: '',
    supplier: '',
    folio: 'RFQ-2026-0089',
    refInternal: 'OCE0001-26 · TRION',
    issueDate: '2026-09-30',
    dueDate: '2026-10-05',
    currency: 'MXN',
    deliveryPlace: 'ESEASA',
    requiredDate: '2026-07-28',
    contact: 'JUAN VICENTE RUIZ HERNANDEZ',
    status: 'BORRADOR',
    docsRequested: isEn 
      ? 'Technical datasheet, warranty, timeframe, taxes, and commercial conditions.'
      : 'Ficha técnica, garantía, plazo, impuestos y condiciones comerciales.',
    conditions: isEn
      ? 'Indicate validity, delivery time, payment terms, taxes, scope, and exclusions.'
      : 'Indicar vigencia, tiempo de entrega, condiciones de pago, impuestos, alcance y exclusiones.'
  });

  const [requisitionItems, setRequisitionItems] = useState([
    { 
      id: 1, 
      description: isEn ? 'Basket request for crate transport to Eseasa.' : 'Solicitud de canastilla para transporte de cajas a Eseasa.', 
      category: isEn ? 'Other service' : 'Otro servicio', 
      quantity: 1, 
      unit: isEn ? 'service' : 'servicio' 
    }
  ]);
  const [selectedItemIds, setSelectedItemIds] = useState([1]);

  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    setSelectedItemIds(requisitionItems.map(item => item.id));
  };

  // ==========================================
  // OTROS ESTADOS DEL MÓDULO (Tarjetas 3 a 11)
  // ==========================================
  const [cotizacionItems, setCotizacionItems] = useState([]);
  const [partidasGeneradas, setPartidasGeneradas] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [t3Buyer, setT3Buyer] = useState('');
  const [t3Req, setT3Req] = useState('');
  const [t3Rfq, setT3Rfq] = useState('');
  const [showRfqMatrix, setShowRfqMatrix] = useState(false);

  // Estado para Tarjeta 4 (Cotizaciones Recibidas de Proveedores)
  const [receivedQuotesList, setReceivedQuotesList] = useState(mockReceivedQuotes);
  const [activeTab4Sub, setActiveTab4Sub] = useState(1);
  const [selectedReqTab4, setSelectedReqTab4] = useState('116831');

  // Estado para Tarjeta 6 (Cotización al Cliente)
  const [marginPercent, setMarginPercent] = useState(15);
  const [clientQuoteItems, setClientQuoteItems] = useState([
    { id: 1, desc: 'Digital Thermometer', costUnit: 400.00, qty: 1, margin: 15, salesPrice: 460.00 },
    { id: 2, desc: 'Outdoor Thermometer', costUnit: 300.00, qty: 1, margin: 15, salesPrice: 345.00 }
  ]);

  // PDF & Signature States
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [signatureImage, setSignatureImage] = useState(null);

  const [selectedQuoteId, setSelectedQuoteId] = useState('1');
  const [quoteLanguage, setQuoteLanguage] = useState(isEn ? 'English' : 'Español');
  const [selectedClient, setSelectedClient] = useState(null);

  const [t7SearchTerm, setT7SearchTerm] = useState('');
  const [t7StatusFilter, setT7StatusFilter] = useState('todos');
  const [t7Language, setT7Language] = useState(isEn ? 'English' : 'Español');

  useEffect(() => {
    setQuoteLanguage(isEn ? 'English' : 'Español');
    setT7Language(isEn ? 'English' : 'Español');
  }, [isEn]);

  // Estado para Tarjeta 8 (Matriz de cotizaciones al cliente)
  const [clientQuotesList, setClientQuotesList] = useState(mockClientQuotesMatrix);

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedQuoteForPdf, setSelectedQuoteForPdf] = useState(null);

  // TARJETA 9: ESTADOS CON DATOS MOCK
  const [clientApprovalStats, setClientApprovalStats] = useState({
    preparacionInterna: 2,
    pendientesCliente: 5,
    aprobadas: 6,
    modificacion: 2,
    rechazadas: 1
  });

  const [approvalQuotesList, setApprovalQuotesList] = useState(mockApprovalQuotes);
  const [awardEligibleQuotes, setAwardEligibleQuotes] = useState([]); 
  const [matrixQuotesList, setMatrixQuotesList] = useState(mockClientQuotesMatrix);
  const [applyServiceFee, setApplyServiceFee] = useState(false);

  // Dynamic Providers List
  const providersList = [
    { id: 'all', name: isEn ? 'All quotes' : 'Todas las cotizaciones', subtitle: isEn ? 'Overview' : 'Vista general', tag: 'TOD', total: 3, adjudicadas: 3, activas: 0, isAll: true },
    { id: '001', name: isEn ? 'Sample Supplier 1' : 'Proveedor Ejemplo 1', subtitle: isEn ? 'Supplier' : 'Proveedor', tag: '01', total: 1, adjudicadas: 1, activas: 0 },
    { id: '002', name: isEn ? 'Sample Supplier 2' : 'Proveedor Ejemplo 2', subtitle: isEn ? 'Supplier' : 'Proveedor', tag: '02', total: 3, adjudicadas: 1, activas: 2 },
    { id: '003', name: isEn ? 'Sample Supplier 3' : 'Proveedor Ejemplo 3', subtitle: isEn ? 'Supplier' : 'Proveedor', tag: '03', total: 2, adjudicadas: 2, activas: 0 }
  ];

  // Computados
  const currentQuote = mockQuotesDB[selectedQuoteId] || mockQuotesDB['1'];
  const subtotal = currentQuote?.items?.reduce((acc, item) => acc + (item.qty * item.price), 0) || 0;
  const vat = subtotal * 0.16;
  const total = subtotal + vat;

  // Tabs Metadatos traducidos dinámicamente
  const tabs = [
    { id: 1, title: isEn ? 'Revisions & Modifications' : 'Revisiones/modificaciones', description: isEn ? 'Change history, version adjustments, and modification records.' : 'Historial de cambios, ajustes de versión y registro de modificaciones.', emoji: '🔄' },
    { id: 2, title: isEn ? 'Supplier Request (RFQ)' : 'Solicitud a proveedores (RFQ)', description: isEn ? 'Generates the document without prices sent to each supplier.' : 'Genera el documento sin precios que se envía a cada proveedor.', emoji: '📑' },
    { id: 3, title: isEn ? 'RFQ Matrix' : 'Matriz de RFQ', description: isEn ? 'Controls sent requests, deadlines, and responses.' : 'Controla solicitudes enviadas, fechas límite y respuestas.', emoji: '📋' },
    { id: 4, title: isEn ? 'Received Quotes' : 'Cotizaciones recibidas', description: isEn ? 'Captures offers and PDFs returned by suppliers.' : 'Captura las ofertas y PDF devueltos por los proveedores.', emoji: '📥' },
    { id: 5, title: isEn ? 'Comparison & Preliminary Selection' : 'Comparativo y selección preliminar', description: isEn ? 'Compares offers and defines recommended supplier per item.' : 'Compara ofertas y define el proveedor recomendado por partida.', emoji: '📊' },
    { id: 6, title: isEn ? 'Client Quotation' : 'Cotización al cliente', description: isEn ? 'Builds consolidated sales price without showing internal costs.' : 'Construye el precio de venta consolidado sin mostrar costos internos.', emoji: '💼' },
    { id: 7, title: isEn ? 'Client Format' : 'Formato para el cliente', description: isEn ? 'Formal view, signatures, and commercial proposal PDF.' : 'Vista formal, firmas y PDF de la propuesta comercial.', emoji: '📑' },
    { id: 8, title: isEn ? 'Client Quotes Matrix' : 'Matriz de cotizaciones al cliente', description: isEn ? 'Revisions, amounts, validity, PDF, and traceability.' : 'Revisiones, montos, vigencia, PDF y trazabilidad.', emoji: '📂' },
    { id: 9, title: isEn ? 'Client Decision' : 'Decisión del cliente', description: isEn ? 'Controls delivery, acceptance, rejection, or modification request.' : 'Controla envío, aceptación, rechazo o solicitud de modificación.', emoji: '☑️' },
    { id: 10, title: isEn ? 'Definitive Awarding' : 'Adjudicación definitiva', description: isEn ? 'Confirms winning supplier after acceptance.' : 'Confirma al proveedor ganador después de la aceptación.', emoji: '🏆' },
    { id: 11, title: isEn ? 'Internal Suppliers Matrix' : 'Matriz interna de proveedores', description: isEn ? 'Consult original offers, costs, and internal traceability.' : 'Consulta ofertas originales, costos y trazabilidad interna.', emoji: '🔒' },
  ];

  // ==========================================
  // HANDLERS TARJETA 4 & GENERALES
  // ==========================================
  const handleClearSelection = () => {
    setT3Buyer('');
    setT3Req('');
    setPartidasGeneradas(false);
    setCotizacionItems([]);
    handleRemovePdf();
    if (formRef.current) formRef.current.reset();
  };

  const handleGenerarPartidas = () => {
    if (!t3Buyer || !t3Req) {
      alert(isEn ? 'Please select Buyer and Requisition first.' : 'Por favor selecciona el Comprador y la Requisición primero.');
      return;
    }
    setPartidasGeneradas(true);
    setCotizacionItems([
      { 
        id: 1, 
        desc: isEn ? 'Basket request for crate transport to Eseasa.' : 'Solicitud de canastilla para transporte de cajas a Eseasa.', 
        qty: 1, 
        unit: isEn ? 'service' : 'servicio', 
        priceUnit: 12450.00, 
        import: 12450.00, 
        deliveryTime: isEn ? '5 days' : '5 días', 
        selected: true 
      }
    ]);
    notify(isEn ? 'Items loaded successfully.' : 'Partidas cargadas correctamente.');
  };

  const handleViewPdf = () => {
    if (pdfFile) {
      setShowPreview(prev => !prev);
    }
  };

  const handleItemChange = (id, field, value) => {
    setCotizacionItems(prevItems => 
      (prevItems || []).map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const handleGenerateRfq = (e) => {
    e.preventDefault();
    if (!rfqData.buyer || !rfqData.reqNumber || !rfqData.supplier) {
      alert(isEn ? 'Please complete required fields: Responsible Buyer, Validated Requisition, and Invited Supplier.' : 'Por favor completa los campos obligatorios: Comprador responsable, Requisición validada y Proveedor invitado.');
      return;
    }
    setIsRfqGenerated(true);
    notify(isEn ? `Items enabled for ${rfqData.supplier}.` : `Se habilitaron las partidas para ${rfqData.supplier}.`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert(isEn ? 'Only PDF files are allowed' : 'Solo se permiten archivos PDF');
      e.target.value = '';
      return;
    }
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfFile(file);
    setPdfPreviewUrl(URL.createObjectURL(file));
    setShowPreview(false);
  };

  const handleRemovePdf = () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfFile(null);
    setPdfPreviewUrl('');
    setShowPreview(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  }; 

  const handleSignatureUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(isEn ? 'Please select a valid image file.' : 'Por favor selecciona un archivo de imagen válido.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setSignatureImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleOpenPdf = (quote) => {
    setSelectedQuoteForPdf(quote);
    setShowPdfModal(true);
  };
  
  return (
<div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isEn ? 'Quotes and Comparison' : 'Cotizaciones y Comparativo'}
          </h2>
          <p className="text-xs text-slate-500">
            {isEn 
              ? 'Registration, product comparison, and quote matrix in independent sub-sections.' 
              : 'Registro, comparativo de productos y matriz de cotizaciones en subsecciones independientes.'}
          </p>
        </div>
      </div>

      {/* Grid de Tarjetas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative text-left p-4 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-32 border ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-0.5'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              <span
                className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  isActive
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                }`}
              >
                {tab.id}
              </span>

              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-colors ${
                  isActive
                    ? 'bg-white/20 backdrop-blur-md'
                    : 'bg-blue-50/80 border border-blue-100/50'
                }`}
              >
                <span>{tab.emoji}</span>
              </div>

              <div className="pr-4">
                <h4
                  className={`text-xs font-black tracking-tight mb-0.5 ${
                    isActive ? 'text-white' : 'text-slate-800'
                  }`}
                >
                  {tab.title}
                </h4>
                <p
                  className={`text-[10px] leading-relaxed line-clamp-2 ${
                    isActive ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {/* Contenedor Principal Receptor del Contenido */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        
{/* TARJETA 1: REVISIONES / MODIFICACIONES DE COTIZACIONES AL CLIENTE */}
    {activeTab === 1 && (() => {
          const filteredQuotes = mockRevisionQuotes.filter((item) => {
            const matchesSearch =
              item.folio.toLowerCase().includes(revisionSearchTerm.toLowerCase()) ||
              item.cliente.toLowerCase().includes(revisionSearchTerm.toLowerCase()) ||
              item.referencia.toLowerCase().includes(revisionSearchTerm.toLowerCase()) ||
              item.statusBadge.toLowerCase().includes(revisionSearchTerm.toLowerCase());

            const matchesStatus =
              revisionStatusFilter === 'todos' || item.statusType === revisionStatusFilter;

            return matchesSearch && matchesStatus;
          });

        return (
          <div className="space-y-5 relative">
          {/* Encabezado Superior */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1 border-b border-slate-100">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    {isEn ? '🔁 Revisions and modifications of client quotes' : '🔁 Revisiones y modificaciones de cotizaciones al cliente'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEn 
                      ? 'An approved quote is not deleted. Changes originate from the requisition and generate a new revision while preserving the previous one.'
                      : 'Una cotización aprobada no se borra. El cambio se origina desde la requisición y genera una nueva revisión conservando la anterior.'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-full border border-indigo-200/60 shrink-0 font-mono">
                  Rev. 0 → Rev. 1 → Rev. N
                </span>
              </div>

            {/* Banner de Regla de Negocio */}
              <div className="p-3.5 bg-blue-50/60 border-l-4 border-blue-600 rounded-r-xl rounded-l-xs text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900">{isEn ? 'Rule:' : 'Regla:'}</span>{' '}
                {isEn 
                  ? 'To change quantities, remove items, or add scope after approval, use Request modification. Grupo Gerez generates a new revision of the requisition and client quote without repeating RFQ/comparison when there is no supply impact.'
                  : 'Para cambiar cantidades, eliminar partidas o agregar alcance después de una aprobación, usa Solicitar modificación. Grupo Gerez genera una nueva revisión de la requisición y de la cotización al cliente sin repetir RFQ/comparativo cuando no existe impacto de abastecimiento.'}
              </div>

{/* Tarjetas de Métricas KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 border-t-4 border-t-violet-600 shadow-2xs">
                  <div className="text-2xl font-black text-slate-900">
                    {mockRevisionQuotes.length}
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-1">
                    {isEn ? 'Quote families' : 'Familias de cotización'}
                  </div>
                </div>
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 border-t-4 border-t-violet-600 shadow-2xs">
                  <div className="text-2xl font-black text-slate-900">
                    {mockRevisionQuotes.filter((q) => q.revisionesCount > 1).length}
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-1">
                    {isEn ? 'With Rev. N' : 'Con Rev. N'}
                  </div>
                </div>
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 border-t-4 border-t-emerald-500 shadow-2xs">
                  <div className="text-2xl font-black text-slate-900">
                    {mockRevisionQuotes.filter((q) => q.statusBadge.includes('Aprobada')).length}
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-1">
                    {isEn ? 'Approved current/historical' : 'Aprobadas vigentes/históricas'}
                  </div>
                </div>
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 shadow-2xs">
                  <div className="text-2xl font-black text-slate-900">
                    {mockRevisionQuotes.filter((q) => q.changeRequest !== 'Sin Change Request').length}
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-1">
                    {isEn ? 'Linked to Change Request' : 'Ligadas a Change Request'}
                  </div>
                </div>
              </div>

          {/* Buscador y Filtros */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/70">
                <div className="relative w-full sm:w-96">
                  <input
                    type="text"
                    placeholder={isEn ? 'Search quote, requisition, client, CR or status...' : 'Buscar cotización, requisición, cliente, CR o estatus...'}
                    value={revisionSearchTerm}
                    onChange={(e) => setRevisionSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium placeholder:text-slate-400"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <select
                    value={revisionStatusFilter}
                    onChange={(e) => setRevisionStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl outline-none text-slate-700 shadow-2xs cursor-pointer"
                  >
                    <option value="todos">{isEn ? 'All statuses' : 'Todos los estatus'}</option>
                    <option value="pendiente">{isEn ? 'Pending review' : 'Pendientes de revisión'}</option>
                    <option value="aprobado">{isEn ? 'Approved' : 'Aprobadas'}</option>
                    <option value="rechazado">{isEn ? 'Replaced' : 'Sustituidas'}</option>
                  </select>
                </div>
              </div>

{/* Grid de Tarjetas de Cotizaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                {filteredQuotes.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-[11px] font-black text-slate-900 leading-tight truncate" title={`${item.folio} · ${item.cliente}`}>
                          {item.folio} · <span className="text-slate-700">{item.cliente}</span>
                        </h4>
                      </div>
                      <p className="text-[9.5px] font-semibold text-slate-400 truncate">
                        {item.referencia} · {item.changeRequest}
                      </p>
                      <div className="pt-1">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold rounded-md border ${item.statusColor}`}>
                          {item.statusBadge}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 py-1.5 px-2 bg-slate-50/80 rounded-xl border border-slate-100 text-center">
                      <div>
                        <span className="block text-xs font-black text-slate-800">{item.revisionesCount}</span>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{isEn ? 'Revisions' : 'Revisiones'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-black text-slate-800">{item.totalRev0}</span>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{item.moneda} (Rev. 0)</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-black text-slate-800">{item.totalVigente}</span>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{item.moneda} ({isEn ? 'Current' : 'Vigente'})</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(item)}
                          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[9.5px] rounded-lg transition-colors text-center cursor-pointer shadow-2xs"
                        >
                          {isEn ? 'VIEW PDF' : 'VER PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab(6)}
                          className="px-2 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-[9.5px] rounded-lg transition-colors text-center cursor-pointer shadow-2xs truncate"
                        >
                          {isEn ? 'OPEN CURRENT REV.' : 'ABRIR REV. VIGENTE'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuoteForModification(item);
                          setShowModificationModal(true);
                        }}
                        className="w-full py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-[9.5px] rounded-lg transition-all text-center cursor-pointer shadow-2xs tracking-wide"
                      >
                        {isEn ? 'REQUEST MODIFICATION' : 'SOLICITAR MODIFICACIÓN'}
                      </button>
                    </div>
                  </div>
                ))}

              {filteredQuotes.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                {isEn ? 'No quotes matching the search were found.' : 'No se encontraron cotizaciones que coincidan con la búsqueda.'}  
                </div>
              )}
            </div>

            {/* MODAL VISTA PREVIA PDF */}
            {showPdfModal && selectedQuoteForPdf && (
              <div id="pdf-modal-overlay" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                
                <style>{`
                  @media print {
                    body {
                      visibility: hidden !important;
                      background: white !important;
                    }
                    #printable-area {
                      visibility: visible !important;
                      position: absolute !important;
                      top: 0 !important;
                      left: 0 !important;
                      width: 100% !important;
                      max-width: none !important;
                      height: auto !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      box-shadow: none !important;
                      background: white !important;
                    }
                    #printable-area * {
                      visibility: visible !important;
                    }
                    .no-print {
                      display: none !important;
                    }
                    @page {
                      size: letter portrait !important;
                      margin: 1.5cm !important;
                    }
                  }
                `}</style>

                <div id="pdf-modal-content" className="w-full max-w-4xl h-[95vh] bg-slate-100 flex flex-col rounded-xl overflow-hidden shadow-2xl relative">
                  
                  <div className="no-print bg-[#1e4a7a] px-5 py-3 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-white font-bold text-sm">
                    {isEn ? 'Preview' : 'Vista previa'} - {selectedQuoteForPdf.folio || selectedQuoteForPdf.id}
                  </h2>
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => window.print()}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    🖨️ {isEn ? 'Print PDF' : 'Imprimir PDF'}
                  </button>
                  <button 
                    onClick={() => setShowPdfModal(false)}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
                  >
                    ✖ {isEn ? 'Close' : 'Cerrar'}
                  </button>
                </div>
              </div>

                  <div id="pdf-modal-scroll" className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/50">
                <div id="printable-area" className="bg-white w-full max-w-4xl p-8 sm:p-10 shadow-lg text-slate-800 font-sans relative">
                  <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-6">
                    <div className="flex-1">
                      <img src="/image_923273.svg" alt="Grupo Gerez" className="h-14 object-contain" />
                    </div>
                    <div className="flex-1 text-center">
                      <h1 className="text-2xl font-black text-slate-900 tracking-wide">
                        {isEn ? 'QUOTATION' : 'COTIZACIÓN'}
                      </h1>
                      <p className="text-[9px] font-bold text-blue-900 tracking-wider mt-1 uppercase">
                        Commercial Quotation · {isEn ? 'Commercial Proposal' : 'Propuesta Económica'}
                      </p>
                    </div>
                    <div className="flex-1 text-right text-[10px] space-y-0.5 text-slate-700">
                      <p className="text-blue-900 font-bold text-xs mb-1">{selectedQuoteForPdf.folio || selectedQuoteForPdf.id}</p>
                      <p>{isEn ? 'Revision:' : 'Revisión:'} {selectedQuoteForPdf.revision || (selectedQuoteForPdf.revisionesCount ? selectedQuoteForPdf.revisionesCount - 1 : 0)}</p>
                      <p>{isEn ? 'Date:' : 'Fecha:'} {selectedQuoteForPdf.fecha || new Date().toISOString().split('T')[0]}</p>
                      <p>{isEn ? 'Validity:' : 'Vigencia:'} 2026-09-16</p>
                      <p>{isEn ? 'Currency:' : 'Moneda:'} <span className="font-bold">{selectedQuoteForPdf.moneda || 'MXN'}</span></p>
                    </div>
                  </div>

                    <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <h3 className="text-blue-600 font-bold text-[10px] mb-2 uppercase">{isEn ? 'Quoted By' : 'Cotiza'}</h3>
                      <p className="font-extrabold text-[11px] text-slate-900 mb-1">GRUPO GEREZ</p>
                      <p className="text-[10px] text-slate-600">3ra avenida #1007 Col. Anahuac, Tampico Tamps.</p>
                      <p className="text-[10px] text-slate-600">user@grupogerez.com</p>
                      <p className="text-[10px] text-slate-600">8332140041</p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <h3 className="text-blue-600 font-bold text-[10px] mb-2 uppercase">{isEn ? 'Client' : 'Cliente'}</h3>
                      <p className="font-extrabold text-[11px] text-slate-900 mb-1 truncate">{selectedQuoteForPdf.cliente}</p>
                      <p className="text-[10px] text-slate-600">{isEn ? 'Contact:' : 'Contacto:'} {isEn ? 'Purchasing Dept' : 'Departamento de Compras'}</p>
                      <p className="text-[10px] text-slate-600">Email: compras@cliente.com</p>
                      <p className="text-[10px] text-slate-600 truncate">{isEn ? 'Project:' : 'Proyecto:'} {selectedQuoteForPdf.proyecto || 'N/A'}</p>
                      <p className="text-[10px] text-slate-600">{isEn ? 'Reference:' : 'Referencia:'} {selectedQuoteForPdf.referencia}</p>
                    </div>
                  </div>

                      {/* Separador */}
                      <div className="bg-slate-100 text-center py-2 mb-4 text-[10px] font-bold tracking-[0.4em] text-slate-700 rounded-sm">
                        T H I R D  P A R T Y  P A Y M E N T
                      </div>

                      {/* Tabla */}
                      <div className="w-full mb-8 border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#1a2b3c] text-white text-[10px] uppercase">
                          <th className="py-2.5 px-3 font-bold w-12 text-center">Item</th>
                          <th className="py-2.5 px-3 font-bold">Description</th>
                          <th className="py-2.5 px-3 font-bold text-center">Brand / Model</th>
                          <th className="py-2.5 px-3 font-bold text-center">Qty</th>
                          <th className="py-2.5 px-3 font-bold text-center">Unit</th>
                          <th className="py-2.5 px-3 font-bold text-right">Unit Price</th>
                          <th className="py-2.5 px-3 font-bold text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="text-[10px] text-slate-800">
                        <tr className="border-b border-slate-200">
                          <td className="py-3 px-3 font-black text-center">1</td>
                          <td className="py-3 px-3">{isEn ? 'General Scope' : 'Alcance general'} - {selectedQuoteForPdf.proyecto || (isEn ? 'Service' : 'Servicio')}</td>
                          <td className="py-3 px-3 text-center">—</td>
                          <td className="py-3 px-3 text-center">1</td>
                          <td className="py-3 px-3 text-center">SRV</td>
                          <td className="py-3 px-3 text-right">{selectedQuoteForPdf.moneda || 'MXN'} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</td>
                          <td className="py-3 px-3 text-right font-black">{selectedQuoteForPdf.moneda || 'MXN'} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                      {/* Condiciones y Totales */}
                      <div className="grid grid-cols-12 gap-8 mb-12">
                    <div className="col-span-7 grid grid-cols-2 gap-4">
                      <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                        <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Place and time of delivery' : 'Lugar y tiempo de entrega'}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'To be confirmed' : 'Por confirmar'}</p>
                      </div>
                      <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                        <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Payment terms' : 'Condiciones de pago'}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'To be confirmed' : 'Por confirmar'}</p>
                      </div>
                      <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                        <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Warranty' : 'Garantía'}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'Not specified' : 'No indicada'}</p>
                      </div>
                      <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                        <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Scope included' : 'Alcance incluido'}</p>
                        <p className="text-[10px] text-slate-600 mt-1 leading-tight">{isEn ? 'According to described items.' : 'Conforme a las partidas descritas.'}</p>
                      </div>
                      <div className="col-span-2 bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                        <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Additional Notes' : 'Notas Adicionales'}</p>
                        <p className="text-[10px] text-slate-600 mt-1 leading-tight">{isEn ? 'Prices expressed in the indicated currency. Validity subject to availability.' : 'Precios expresados en la moneda indicada. Vigencia sujeta a disponibilidad.'}</p>
                      </div>
                    </div>

                    <div className="col-span-5 space-y-3 text-[11px]">
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="font-bold text-slate-700">{isEn ? 'GENERAL SUBTOTAL' : 'SUBTOTAL GENERAL'}</span>
                        <span className="font-bold text-slate-900">{selectedQuoteForPdf.moneda || 'MXN'} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="font-bold text-slate-700">{isEn ? 'VAT (16%)' : 'IVA GENERAL (16%)'}</span>
                        <span className="font-bold text-slate-900">{selectedQuoteForPdf.moneda || 'MXN'} TBD</span>
                      </div>
                      <div className="flex justify-between items-center py-4 px-4 bg-slate-50 border border-slate-300 rounded-lg mt-4">
                        <span className="font-black text-[13px] text-slate-900">{isEn ? 'GRAND TOTAL' : 'TOTAL GENERAL'}</span>
                        <span className="font-black text-[14px] text-blue-700">{selectedQuoteForPdf.moneda || 'MXN'} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</span>
                      </div>
                    </div>
                  </div>

                      {/* Firmas */}
                      <div className="grid grid-cols-3 gap-8 text-center mt-16 mb-6">
                    <div>
                      <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'BUYER' : 'COMPRADOR'}</p>
                      <div className="border-t border-slate-400 pt-2 mx-4">
                        <p className="font-black text-[10px] text-slate-900 mt-1">{selectedQuoteForPdf.comprador || (isEn ? 'NAME' : 'NOMBRE')}</p>
                        <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'HSE Supervisor' : 'Supervisor HSE'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'REVIEWED BY' : 'REVISÓ'}</p>
                      <div className="border-t border-slate-400 pt-2 mx-4">
                        <p className="font-black text-[10px] text-slate-900 mt-1">{isEn ? 'NAME' : 'NOMBRE'}</p>
                        <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'Position' : 'Puesto'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'AUTHORIZED BY' : 'AUTORIZÓ'}</p>
                      <div className="border-t border-slate-400 pt-2 mx-4">
                        <p className="font-black text-[10px] text-slate-900 mt-1">{isEn ? 'NAME' : 'NOMBRE'}</p>
                        <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'Position' : 'Puesto'}</p>
                      </div>
                    </div>
                  </div>

                      {/* Footer */}
                <div className="text-center text-[9px] text-slate-400 mt-10 pt-4 border-t border-slate-100">
                    <p>• supplies@grupogerez.com · 8332140041 •</p>
                    <p className="mt-0.5">{isEn ? 'This quotation does not constitute an invoice. Prices and availability subject to indicated validity.' : 'Esta cotización no constituye una factura. Precios y disponibilidad sujetos a la vigencia indicada.'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
            )}

            {/* MODAL SOLICITAR MODIFICACIÓN */}
            {showModificationModal && selectedQuoteForModification && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans">
                <div className="w-full max-w-[1200px] h-[95vh] bg-slate-50 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                  
                  {/* Header Modal (Gradient Blue/Purple) */}
                  <div className="bg-gradient-to-r from-[#2B4B9A] to-[#8C3AAA] px-6 py-4 flex justify-between items-start shrink-0">
                    <div>
                      <h2 className="text-white font-black text-lg flex items-center gap-2">
                        <span className="text-xl">🔁</span> {isEn ? 'Controlled requisition modification' : 'Modificación controlada de requisición'} 
                      </h2>
                    </div>
                    <button 
                      onClick={() => setShowModificationModal(false)}
                      className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer border border-white/30 backdrop-blur-md"
                    >
                      {isEn ? 'X Close' : 'X Cerrar'}
                    </button>
                  </div>

                  {/* Body Scrollable */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Sección 1. Datos del cambio */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                      <div className="mb-4">
                        <h3 className="text-sm font-black text-slate-800">{isEn ? '1. Change details' : '1. Datos del cambio'}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">{isEn ? 'Record who is requesting the change and the evidence supporting the modification.' : 'Registra quién solicita el cambio y la evidencia que respalda la modificación.'}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Exchange slip' : 'Folio de cambio'}</label>
                          <input type="text" disabled value="COT-2026-0032" className="bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded p-2 outline-none cursor-not-allowed" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Current revision → new' : 'Revisión actual → nueva'}</label>
                          <input type="text" disabled value={`Rev. ${selectedQuoteForModification.revisionesCount - 1} → Rev. ${selectedQuoteForModification.revisionesCount}`} className="bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded p-2 outline-none cursor-not-allowed" />
                        </div>
                        <div className="flex flex-col relative">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Date of change *' : 'Fecha del cambio *'}</label>
                          <input type="date" defaultValue="dd/yy/aaaa" className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />

                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Requested by *' : 'Solicitado por *'}</label>
                          <input type="text" placeholder="Sin Change Request" className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Requested by *' : 'Origen *'}</label>
                          <select className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-bold">
                            <option>{isEn ? 'Client email' : 'Correo del cliente'}</option>
                            <option>{isEn ? 'Clients Modified PO/OC' : 'PO/OC Modificada del cliente'}</option>
                            <option>{isEn ? 'Revised service order' : 'Orden del servicio revisada'}</option>
                            <option>{isEn ? 'Client Portal' : 'Portal del cliente'}</option>
                            <option>{isEn ? 'Bill' : 'Minuta'}</option>
                            <option>{isEn ? 'Call confirmed in writing' : 'Llamada confirmada por escrito'}</option>
                            <option>{isEn ? 'Other' : 'Otro'}</option>
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">Tipo principal *</label>
                          <select className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-bold">
                            <option>{isEn ? 'Change in quantity' : 'Cambio de cantidad'}</option>
                            <option>{isEn ? 'Deletion of item' : 'Eliminación de partida'}</option>
                            <option>{isEn ? 'Add item' : 'Agregar partida'}</option>
                            <option>{isEn ? 'Specification change' : 'Cambio de especificación'}</option>
                            <option>{isEn ? 'Change of required date' : 'Cambio de fecha requerida'}</option>
                            <option>{isEn ? 'Change of delivery location' : 'Cambio de lugar de entrega'}</option>
                            <option>{isEn ? 'Change of scope' : 'Cambio de alcance'}</option>
                            <option>{isEn ? 'Other' : 'Otro'}</option>
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Reference / document' : 'Referencia / documento'}</label>
                          <input type="text" placeholder="Correo, PO cliente, SO, minuta, folio..." className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400" />
                        </div>
                      </div>

                      <div className="flex flex-col mb-4">
                        <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Client reason / instruction *' : 'Motivo / instrucción del cliente *'}</label>
                        <textarea rows="3" placeholder="Describe exactamente lo autorizado originalmente y lo que el cliente solicita modificar." className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"></textarea>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                      <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Evidence' : 'Evidencia'}</label>
                          <div className="flex border border-slate-300 rounded overflow-hidden relative">
                            {/* Input oculto */}
                            <input 
                              type="file" 
                              id="evidence-upload" 
                              className="hidden" 
                              onChange={(e) => setEvidenceFileName(e.target.files[0]?.name || null)}
                            />
                            {/* Label que funciona como botón */}
                            <label 
                              htmlFor="evidence-upload" 
                              className="bg-slate-100 px-3 py-2 text-xs text-slate-700 border-r border-slate-300 hover:bg-slate-200 transition-colors cursor-pointer m-0 whitespace-nowrap"
                            >
                             {isEn ? 'Choose file' : 'Elegir archivo'} 
                            </label>
                            {/* Texto dinámico del archivo */}
                            <span className="px-3 py-2 text-xs text-slate-500 bg-white flex-1 truncate">
                              {evidenceFileName ? evidenceFileName : "No se ha seleccionado ningún archivo"}
                            </span>
                          </div>
                          {/* Mensaje de apoyo dinámico */}
                          <span className="text-[9px] text-slate-400 mt-1">
                            {evidenceFileName ? "Evidencia adjunta." : "Sin evidencia adjunta."}
                          </span>
                        </div>

                        <div className="flex flex-col relative">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Revised required date' : 'Fecha requerida revisada'} </label>
                          <input type="date" defaultValue="dd/yy/aaaa" className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Delivery location verified' : 'Lugar de entrega revisado'}</label>
                          <input type="text" placeholder="ESEASA" className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
                        </div>
                      </div>
                    </div>

                    {/* Sección 2. Partidas antes y después */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                      <div className="mb-4">
                        <h3 className="text-sm font-black text-slate-800">{isEn ? '2. Before-and-after items' : '2. Partidas antes y después'}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">{isEn ? 'Cancelled line items are not deleted; they remain in the history of the previous revision and in the change log.' : 'Las partidas canceladas no se borran; quedan en el historial de la revisión anterior y en el registro del cambio.'}</p>
                      </div>

                      {/* Tabla Header */}
                      <div className="bg-[#f0f4f8] rounded-t-lg border border-slate-200 border-b-0 px-4 py-2 flex text-[9px] font-bold text-[#1e4a7a] uppercase tracking-wider">
                        <div className="w-[20%]">{isEn ? 'DEPARTURE' : 'PARTIDA'}</div>
                        <div className="w-[25%]">{isEn ? 'NEW DESCRIPTION / SPECIFICATION' : 'DESCRIPCIÓN / ESPECIFICACIÓN NUEVA'}</div>
                        <div className="w-[10%] text-center">{isEn ? 'ORIGINAL QTY.' : 'CANT. ORIGINAL'}</div>
                        <div className="w-[10%] text-center">{isEn ? 'NEW QTY.' : 'CANT. NUEVA'}</div>
                        <div className="w-[10%] text-center">{isEn ? 'UNIT' : 'UNIDAD'}</div>
                        <div className="w-[10%] text-center">{isEn ? 'CATEGORY' : 'CATEGORÍA'}</div>
                        <div className="w-[10%] text-center">{isEn ? 'ACTION' : 'ACCIÓN'}</div>
                        <div className="w-[5%] text-center">{isEn ? 'RESULT' : 'RESULTADO'}</div>
                      </div>

                      {/* Fila de ejemplo (Mockup) */}
                      <div className="border border-slate-200 p-3 flex items-center gap-3 bg-white">
                        <div className="w-[20%]">
                          <p className="text-[10px] font-black text-slate-900 leading-tight">UNIVERSAL SHOULDER HOLSTER , LEFT SIDE</p>
                        </div>
                        <div className="w-[25%]">
                          <input type="text" defaultValue="UNIVERSAL SHOULDER HOLSTER , LEFT SIDE" className="w-full bg-white border border-slate-300 text-slate-600 text-[10px] rounded p-1.5 outline-none focus:border-blue-500" />
                        </div>
                        <div className="w-[10%]">
                          <input type="text" disabled defaultValue="1" className="w-full bg-slate-100 border border-slate-300 text-slate-500 text-[10px] text-center rounded p-1.5 outline-none" />
                        </div>
                        <div className="w-[10%]">
                          <input type="text" defaultValue="1" className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] text-center rounded p-1.5 outline-none focus:border-blue-500" />
                        </div>
                        <div className="w-[10%]">
                          <input type="text" defaultValue="Each" className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] text-center rounded p-1.5 outline-none focus:border-blue-500" />
                        </div>
                        <div className="w-[10%]">
                          <input type="text" defaultValue="EPP y seguridad" className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] text-center rounded p-1.5 outline-none focus:border-blue-500" />
                        </div>
                        <div className="w-[10%]">
                          <select className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] rounded p-1.5 outline-none focus:border-blue-500 cursor-pointer text-center">
                            <option>{isEn ? 'Keep' : 'Mantener'}</option>
                            <option>{isEn ? 'Modify' : 'Modificar'}</option>
                            <option>{isEn ? 'Cancel' : 'Cancelar'}</option>
                          </select>
                        </div>
                        <div className="w-[5%] flex justify-center">
                          <span className="text-[9px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded">{isEn ? 'No change' : 'Sin cambio'}</span>
                        </div>
                      </div>

                      {/* Fila: Agregar nueva partida */}
                      <div className="border border-slate-200 border-t-0 rounded-b-lg p-4 bg-[#fafbfc] space-y-3">
                        <p className="text-[10px] font-bold text-slate-700">{isEn ? '+ Add new entry' : '+ Agregar nueva partida'}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <input type="text" placeholder="Descripción / especificación" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                          </div>
                          <div className="w-40">
                            <input type="text" placeholder="Cantidad" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                          </div>
                          <div className="w-40">
                            <input type="text" placeholder="Unidad" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <input type="text" placeholder="Categoría" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                          </div>
                          <div className="w-[332px]">
                            <button className="w-full bg-[#18bda8] hover:bg-[#139c8a] text-white font-bold text-xs py-2 px-4 rounded transition-colors shadow-sm">
                              {isEn ? '+ Add item' : '+ Agregar partida'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

        {/* TARJETA 2: Solicitud a proveedores (RFQ) */}
{activeTab === 2 && (
 <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
          {/* ENCABEZADO Y BADGE */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">{isEn ? 'Request for Quotation from Suppliers · RFQ' : 'Solicitud de cotización a proveedores · RFQ'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
               {isEn ? 'Generate a separate document for each supplier. The RFQ contains requirements, quantities, and dates, but never prices.' : 'Genera un documento independiente para cada proveedor. La RFQ contiene requisitos, cantidades y fechas, pero nunca precios.'} 
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-50 text-purple-700 font-bold text-[10px] rounded-full border border-purple-100 shrink-0">
            {isEn ? 'Supply stage' : 'Etapa de abastecimiento'}  
            </span>
          </div>

          {/* ALERTA INFORMATIVA */}
          <div className="p-3 bg-emerald-50/40 border-l-4 border-l-emerald-500 border border-emerald-100 rounded-xl text-xs text-slate-700 font-medium">
            <span className="font-bold text-slate-800">{isEn ? 'Step 1:' : 'Paso 1:'} </span>{isEn ? 'Complete the application details and click on' : 'Completa los datos de la solicitud y haz clic en'}  <strong className="text-purple-700">{isEn ? '"Trigger"' : '"Generar"'}</strong>{isEn ? 'to enable the selection of line items and view the document preview.' : 'para habilitar la selección de partidas y visualizar la vista previa del documento.'} 
          </div>

          <form onSubmit={handleGenerateRfq} className="space-y-4 pt-1">
            {/* CAMPOS DEL FORMULARIO RFQ */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isEn ? 'Responsible buyer' : 'Comprador responsable'} <span className="text-red-500">*</span>
                </label>
                <select 
                  value={rfqData.buyer}
                  onChange={(e) => {
                    setRfqData({ ...rfqData, buyer: e.target.value });
                    setSelectedBuyer(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-blue-400/80 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                >
                  <option value="">{isEn ? 'Select buyer...' : 'Seleccionar comprador...'}</option>
                  <option value="JUAN VICENTE RUIZ HERNANDEZ">JUAN VICENTE RUIZ HERNANDEZ</option>
                  <option value="MARÍA FERNANDA LÓPEZ">MARÍA FERNANDA LÓPEZ</option>
                </select>
                <span className="text-[9.5px] text-slate-400 mt-1 block">
                {isEn ? 'Selecting a buyer will open a window displaying their validated requisitions available for RFQ.' : 'Al seleccionar un comprador se abrirá una ventana con sus requisiciones validadas disponibles para RFQ.'}  
                </span>
              </div>

              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isEn ? 'Validated requisition' : 'Requisición validada'} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select 
                    value={rfqData.reqNumber}
                    onChange={(e) => {
                      setRfqData({ ...rfqData, reqNumber: e.target.value });
                      setSelectedReq(e.target.value);
                    }}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-600 shadow-2xs font-medium"
                  >
                    <option value="">{isEn ? 'Select a buyer first...' : 'Selecciona primero un comprador...'}</option>
                    <option value="REQ-2026-0102">REQ-2026-0102 - Canastilla para transporte</option>
                  </select>
                  <button
                    type="button"
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>🔍</span>
                    <span>{isEn ? 'View requisitions' : 'Ver requisiciones'}</span>
                  </button>
                </div>
                <span className="text-[9.5px] text-slate-400 mt-1 block">
                {isEn ? 'Select a buyer to view their requisitions.' : 'Selecciona un comprador para consultar sus requisiciones.'}  
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isEn ? 'Guest provider' : 'Proveedor invitado'} <span className="text-red-500">*</span>
                </label>
                <select 
                  value={rfqData.supplier}
                  onChange={(e) => {
                    setRfqData({ ...rfqData, supplier: e.target.value });
                    setSelectedSupplier(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                >
                  <option value="">{isEn ? 'Select supplier...' : 'Seleccionar proveedor...'}</option>
                  <option value="001">001 - SERVICIOS INDUSTRIALES S.A.</option>
                  <option value="002">002 - LOGÍSTICA DEL GOLFO</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'RFQ Reference Number' : 'Folio RFQ'}</label>
                <input
                  type="text"
                  disabled
                  value={rfqData.folio}
                  className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-500 outline-none shadow-2xs cursor-not-allowed font-medium"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Internal reference' : 'Referencia interna'}</label>
                <input
                  type="text"
                  disabled
                  value={rfqData.refInternal}
                  className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-600 font-bold outline-none shadow-2xs cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isEn ? 'Date of issue' : 'Fecha de emisión'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={rfqData.issueDate}
                  onChange={(e) => setRfqData({ ...rfqData, issueDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium pr-2"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isEn ? 'Response deadline' : 'Fecha límite de respuesta'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={rfqData.dueDate}
                  onChange={(e) => setRfqData({ ...rfqData, dueDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium pr-2"
                />
              </div>

              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isEn ? 'Requested currency' : 'Moneda solicitada'} <span className="text-red-500">*</span>
                </label>
                <select 
                  value={rfqData.currency}
                  onChange={(e) => setRfqData({ ...rfqData, currency: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-bold"
                >
                  <option value="MXN">{isEn ? 'MXN - Mexican Peso' : 'MXN - Peso mexicano'}</option>
                  <option value="USD">{isEn ? 'USD - United States Dollar' : 'USD - Dólar estadounidense'}</option>
                  <option value="EUR">{isEn ? 'EUR - Euro' : 'EUR - Euro'}</option>
                </select>
                <span className="text-[9.5px] text-slate-400 mt-1 block">
                {isEn ? 'It is automatically taken from the suppliers default currency and can be modified for this RFQ.' : 'Se toma automáticamente de la moneda habitual del proveedor y puede modificarse para esta RFQ.'}  
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Place of delivery' : 'Lugar de entrega'}</label>
                <input
                  type="text"
                  value={rfqData.deliveryPlace}
                  onChange={(e) => setRfqData({ ...rfqData, deliveryPlace: e.target.value })}
                  placeholder="Ej. ESEASA"
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Date required' : 'Fecha requerida'}</label>
                <input
                  type="date"
                  value={rfqData.requiredDate}
                  onChange={(e) => setRfqData({ ...rfqData, requiredDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium pr-2"
                />        
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                {isEn ? 'Purchasing contact' : 'Contacto de compras'} <span className="text-red-500">*</span>
                </label>
                <select 
                  value={rfqData.contact}
                  onChange={(e) => setRfqData({ ...rfqData, contact: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                >
                  <option value="Seleccionar el contacto...">{isEn ? 'Select the contact...' : 'Seleccionar el contacto...'}</option>
                  <option value="JUAN VICENTE RUIZ HERNANDEZ">JUAN VICENTE RUIZ HERNANDEZ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Estatus</label>
                <select 
                  value={rfqData.status}
                  onChange={(e) => setRfqData({ ...rfqData, status: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-medium"
                >
                  <option value="BORRADOR">{isEn ? 'Draft' : 'Borrador'}</option>
                  <option value="ENVIADA">{isEn ? 'Sent' : 'Enviada'}</option>
                  <option value="RESPONDIDA">{isEn ? 'Answered' : 'Respondida'}</option>
                  <option value="CANCELADA">{isEn ? 'Cancelled' : 'Cancelada'}</option>
                  <option value="VENCIDA">{isEn ? 'Defeated' : 'Vencida'}</option>
                </select>
              </div>

              <div className="md:col-span-9">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Requested documentation' : 'Documentación solicitada'}</label>
                <textarea
                  rows={2}
                  value={rfqData.docsRequested}
                  onChange={(e) => setRfqData({ ...rfqData, docsRequested: e.target.value })}
                  placeholder="Ficha técnica, certificados, permisos, garantía, tiempos de entrega..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs resize-y font-medium"
                ></textarea>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Conditions and instructions' : 'Condiciones e instrucciones'}</label>
              <textarea
                rows={3}
                value={rfqData.conditions}
                onChange={(e) => setRfqData({ ...rfqData, conditions: e.target.value })}
                placeholder="Indicar vigencia, impuestos, condiciones de pago, plazo, alcance y exclusiones."
                className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs resize-y font-medium"
              ></textarea>
            </div>

            {/* BOTÓN "GENERAR" EN EL FORMULARIO PRINCIPAL */}
            <div className="flex justify-end pt-2 border-t border-slate-200/60">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>⚡</span>
                <span>{isRfqGenerated ? 'Generar Solicitud y Partidas' : 'Generar Solicitud y Partidas'}</span>
              </button>
            </div>
          </form>

          {/* RENDERIZADO CONDICIONAL DE LAS SECCIONES INFERIORES */}
          {isRfqGenerated ? (
            <div className="space-y-6 pt-2 animate-fadeIn">
              {/* SECCIÓN 1 INFERIOR: PARTIDAS QUE SE ENVIARÁN A ESTE PROVEEDOR */}
              <div className="p-4 border border-slate-200/80 rounded-2xl bg-slate-50/40 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{isEn ? 'Items that will be sent to this supplier' : 'Partidas que se enviarán a este proveedor'}</h4>
                    <p className="text-[10.5px] text-slate-500">
                    {isEn ? 'The requisition retains all its line items; here, you select only those for which the invited supplier will provide a quote.' : 'La requisición conserva todas sus partidas; aquí seleccionas únicamente las que cotizará el proveedor invitado.'}  
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-100/70 text-blue-800 text-[10px] font-bold rounded-full">
                    {selectedItemIds.length} seleccionada(s) de {requisitionItems.length}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/60 border-l-4 border-l-emerald-500 border border-emerald-100 rounded-xl text-xs text-slate-700">
                  <span className="font-bold text-slate-800">{isEn ? 'Recommended flow:' : 'Flujo recomendado:'}</span>{isEn ? 'It uses a single requisition and generates multiple independent RFQs—one per supplier—containing the corresponding line items.' : 'utiliza una sola requisición y genera varias RFQ independientes, una por proveedor y con las partidas que correspondan.'} 
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all cursor-pointer"
                    >
                    {isEn ? 'Select all' : 'Seleccionar todas'}  
                    </button>
                  </div>
                  <span className="text-[10.5px] text-slate-400">
                  {isEn ? 'Manual mode: a single line item can be sent to multiple suppliers to compare offers.' : 'Modo manual: una misma partida puede enviarse a varios proveedores para comparar ofertas.'}  
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">{isEn ? 'INCLUDE' : 'INCLUIR'}</th>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">{isEn ? 'DESCRIPTION / SPECIFICATION' : 'DESCRIPCIÓN / ESPECIFICACIÓN'}</th>
                        <th className="py-2.5 px-3">{isEn ? 'CATEGORY' : 'CATEGORÍA'}</th>
                        <th className="py-2.5 px-3">{isEn ? 'AMOUNT' : 'CANTIDAD'}</th>
                        <th className="py-2.5 px-3">{isEn ? 'UNIT' : 'UNIDAD'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {requisitionItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                          {isEn ? 'Select a requisition.' : 'Selecciona una requisición.'}  
                          </td>
                        </tr>
                      ) : (
                        requisitionItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedItemIds.includes(item.id)}
                                  onChange={() => toggleSelectItem(item.id)}
                                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-[11px] font-bold text-slate-600">
                                  {selectedItemIds.includes(item.id) ? 'Disponible' : 'Excluido'}
                                </span>
                              </label>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{item.description}</td>
                            <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-slate-600">{item.unit}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* BOTONES DE ACCIÓN RÁPIDA */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRfqGenerated(false);
                      alert('RFQ Guardada. Preparando campos para la siguiente...');
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>💾</span>
                    <span>{isEn ? 'Save and next RFQ →' : 'Guardar y siguiente RFQ →'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🖋️</span>
                    <span>{isEn ? 'Clear selection' : 'Limpiar selección'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab(3)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>{isEn ? 'View matrix' : 'Ver matriz'}</span>
                  </button>
                </div>
              </div>

              {/* SECCIÓN 2 INFERIOR: FORMATO DE SOLICITUD DE COTIZACIÓN (GRUPO GEREZ BRANDING) */}
              <div className="p-4 sm:p-6 bg-slate-100/70 border border-slate-200/80 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                    {isEn ? 'Request for Quotation Form' : 'Formato de Solicitud de Cotización'}  
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEn ? 'Preview of the document to be sent to the selected supplier.' : 'Vista previa del documento que se enviará al proveedor seleccionado.'}  
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold text-[10px] rounded-full shrink-0 shadow-2xs">
                  {isEn ? 'No prices' : 'Sin precios'}   
                  </span>
                </div>

                {/* DOCUMENTO HOJA TIPO PDF CON BRANDING DE GRUPO GEREZ */}
                <div className="bg-white border border-slate-200/90 rounded-xl p-6 sm:p-8 shadow-sm space-y-6 max-w-5xl mx-auto text-slate-800">
                  {/* ENCABEZADO HOJA */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    {/* LOGO GRUPO GEREZ */}
                    <div className="flex items-center gap-3">
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
                    </div>

                    {/* TÍTULO PRINCIPAL */}
                    <div className="text-left sm:text-center">
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {isEn ? 'REQUEST FOR QUOTATION' : 'SOLICITUD DE COTIZACIÓN'}   
                      </h1>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {isEn ? 'REQUEST FOR QUOTATION FROM SUPPLIER' : 'SOLICITUD DE COTIZACIÓN A PROVEEDOR'}   
                      </p>
                    </div>

                    {/* ESTATUS Y FECHAS */}
                    <div className="text-left sm:text-right text-xs space-y-0.5">
                      <span className="inline-block font-black text-blue-600 text-sm border-b-2 border-blue-600 uppercase mb-1">
                        {rfqData.status || 'BORRADOR'}
                      </span>
                      <p className="text-[11px] text-slate-600">
                        <strong className="text-slate-800">Fecha:</strong> {rfqData.issueDate || '2026-09-30'}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        <strong className="text-slate-800">Responder antes de:</strong> {rfqData.dueDate || '2026-10-05'}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        <strong className="text-slate-800">Moneda:</strong> {rfqData.currency || 'MXN'}
                      </p>
                    </div>
                  </div>

                  <div className="h-1 bg-blue-600 rounded-full"></div>

                  {/* CUADROS DE INFORMACIÓN (PROVEEDOR & SOLICITA) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
                      <h5 className="text-[11px] font-black text-blue-600 uppercase tracking-wider">
                      {isEn ? 'GUEST SUPPLIER' : 'PROVEEDOR INVITADO'}   
                      </h5>
                      <p className="text-xs font-bold text-slate-900">
                        {rfqData.supplier || '001'}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
                      <h5 className="text-[11px] font-black text-blue-600 uppercase tracking-wider">
                       {isEn ? 'REQUESTS' : 'SOLICITA'}   
                      </h5>
                      <p className="text-xs font-black text-slate-900">
                        GRUPO GEREZ S.A. DE C.V.
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        {rfqData.contact || 'JUAN VICENTE RUIZ HERNANDEZ'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        vicente.ruiz@grupogerez.com
                      </p>
                      <p className="text-[11px] text-slate-500">
                        8331658967
                      </p>
                    </div>
                  </div>

                  {/* TABLA DE ITEMS EN LA VISTA PREVIA DEL FORMATO */}
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#1d3557] text-white text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-4 w-16">{isEn ? 'ITEM' : 'ARTÍCULO'} </th>
                          <th className="py-2.5 px-4">{isEn ? 'DESCRIPTION / SPECIFICATION' : 'DESCRIPCIÓN / ESPECIFICACIÓN'}</th>
                          <th className="py-2.5 px-4 text-center w-24">{isEn ? 'AMOUNT' : 'CANTIDAD'}</th>
                          <th className="py-2.5 px-4 text-center w-24">{isEn ? 'UNIT' : 'UNIDAD'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                        {selectedItemIds.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                            {isEn ? 'There are no line items selected for inclusion in this RFQ.' : 'No hay partidas seleccionadas para incluir en esta RFQ.'}  
                            </td>
                          </tr>
                        ) : (
                          requisitionItems
                            .filter(item => selectedItemIds.includes(item.id))
                            .map((item, index) => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 font-bold text-slate-500">{index + 1}</td>
                                <td className="py-3 px-4 font-bold text-slate-900">{item.description}</td>
                                <td className="py-3 px-4 text-center font-bold text-slate-800">{item.quantity}</td>
                                <td className="py-3 px-4 text-center text-slate-600">{item.unit}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* BLOQUES INFERIORES DE DATOS TÉCNICOS Y CONDICIONES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50/80 rounded-r-xl border-l-4 border-l-blue-600 border-y border-r border-slate-200/60 space-y-0.5">
                      <h6 className="text-[11px] font-black text-slate-900">
                      {isEn ? 'Requisition / Project' : 'Requisición / proyecto'}  
                      </h6>
                      <p className="text-xs text-slate-600 font-medium">
                        {rfqData.refInternal || 'OCE0001-26 · TRION · Contrato N/A'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 rounded-r-xl border-l-4 border-l-blue-600 border-y border-r border-slate-200/60 space-y-0.5">
                      <h6 className="text-[11px] font-black text-slate-900">
                      {isEn ? 'Required delivery' : 'Entrega requerida'}   
                      </h6>
                      <p className="text-xs text-slate-600 font-medium">
                        {rfqData.deliveryPlace || 'ESEASA'} · Fecha {rfqData.requiredDate || '2026-07-28'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 rounded-r-xl border-l-4 border-l-blue-600 border-y border-r border-slate-200/60 space-y-0.5">
                      <h6 className="text-[11px] font-black text-slate-900">
                      {isEn ? 'Requested documentation' : 'Documentación solicitada'}  
                      </h6>
                      <p className="text-xs text-slate-600 font-medium">
                        {rfqData.docsRequested || 'Ficha técnica, garantía, plazo, impuestos y condiciones comerciales.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50/80 rounded-r-xl border-l-4 border-l-blue-600 border-y border-r border-slate-200/60 space-y-0.5">
                      <h6 className="text-[11px] font-black text-slate-900">
                       {isEn ? 'Conditions' : 'Condiciones'} 
                      </h6>
                      <p className="text-xs text-slate-600 font-medium">
                        {rfqData.conditions || 'Indicar vigencia, tiempo de entrega, condiciones de pago, impuestos, alcance y exclusiones.'}
                      </p>
                    </div>
                  </div>

                  {/* PIE DE PÁGINA DOCUMENTO */}
                  <div className="text-center pt-4 border-t border-slate-200 text-[10.5px] text-slate-400 font-medium">
                  {isEn ? 'Please provide a reference.' : 'Favor de referenciar'} <strong className="text-slate-600 uppercase">{rfqData.status || 'BORRADOR'}</strong>{isEn ? 'in their proposal ·' : 'en su propuesta ·'}  <span className="text-blue-600">supplies@grupogerez.com</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* MENSAJE DE ESTADO INICIAL (CUANDO AÚN NO SE HA GENERADO) */
            <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-2 mt-4">
              <div className="text-2xl">📋</div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              {isEn ? 'Matches and Format Preview Hidden' : 'Partidas y Vista Previa del Formato Ocultas'}  
              </h4>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
               {isEn ? 'Fill in the top fields of the request (Buyer, Requisition, Supplier) and press the button.' : 'Rellena los campos superiores de la solicitud (Comprador, Requisición, Proveedor) y presiona el botón'}<strong className="text-blue-600">{isEn ? '"Generate Request and Line Items"' : '"Generar Solicitud y Partidas"'}</strong>{isEn ? 'to expand the line item allocation and the preview of the final document.' : 'para desplegar la asignación de partidas y la vista previa del documento final.'} 
              </p>
            </div>
          )}
        </div>
      )}

{/* TARJETA 3: Matriz de RFQ */}
{activeTab === 3 && (
  <div className="space-y-6">
    {/* Encabezado Principal */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
      <div>
        <h3 className="text-base sm:text-lg font-black text-slate-900">
        {isEn ? 'Request for Quotation (RFQ) Matrix' : 'Matriz de solicitudes de cotización - RFQ'}  
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
        {isEn ? 'Organize the RFQs by purchasing contact first, then open the paginated matrix for each person in charge.' : 'Organiza las RFQ primero por contacto de compras y abre después la matriz paginada de cada responsable.'}   
        </p>
      </div>

      <button
        type="button"
        onClick={() => setActiveTab(2)}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
      >
        <span className="text-sm font-black">+</span>
        <span>{isEn ? 'New RFQ' : 'Nueva RFQ'}</span>
      </button>
    </div>

    {/* Sección: RFQ por contacto de compras */}
    <div className="space-y-4 pt-2 border-t border-slate-200/60">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h4 className="text-xs sm:text-sm text-slate-800">
          {isEn ? 'Select a purchasing contact to open only their RFQs in a paginated matrix.' : 'Selecciona un contacto de compras para abrir únicamente sus RFQ en una matriz paginada.'}  
          </h4>
        </div>
      </div>

      {/* Buscador de Contactos y Contador */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Buscar contacto de compras, correo o télefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 shadow-2xs font-medium placeholder:text-slate-400"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
        </div>

        <div className="text-[11px] text-purple-700 font-bold bg-purple-50 px-3 py-1 rounded-lg border border-purple-100 self-end sm:self-center">
        {isEn ? '0 of 0 contacts' : '0 de 0 contactos'}  
        </div>
      </div>

      {/* Grid de Tarjetas por Comprador / Responsable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Tarjeta General: Todas las RFQ */}
        <div className="relative bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-600 to-purple-600"></div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                ALL
              </div>
              <div>
                <h5 className="text-xs font-black text-slate-900 group-hover:text-purple-600 transition-colors">
                {isEn ? 'All RFQs' : 'Todas las RFQ'}   
                </h5>
                <p className="text-[10px] text-slate-400 font-medium">
                {isEn ? 'All contacts' : 'Todos los contactos'}  
                </p>
              </div>
            </div>

            {/* Contadores de Métricas */}
            <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 my-2 text-center">
              <div>
                <div className="text-sm font-black text-slate-900">0</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">RFQ</div>
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">0</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Answered' : 'Respondidass'} </div>
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">0</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Expired' : 'Vencidas'}</div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
              <span>{isEn ? '0 suppliers' : '0 proveedores'}</span>
              <span>{isEn ? '0% response' : 'Respuesta 0%'}</span>
            </div>
          </div>

          {/* Letras moradas convertidas en botón */}
          <div className="mt-3 text-right">
            <button
              type="button"
              onClick={() => setShowRfqMatrix(true)}
              className="text-[10px] font-bold text-purple-600 hover:text-purple-800 hover:underline transition-all cursor-pointer bg-transparent border-none p-0"
            >
            {isEn ? 'Open all →' : 'Abrir todos →'}  
            </button>
          </div>
        </div>
      </div>
    </div>

  {/* Sección Tabla Matriz Paginada de RFQ (Renderizado Condicional) */}
{showRfqMatrix && (
  <div className="space-y-3 pt-6 border-t border-slate-200/80 animate-fadeIn">
    <div className="flex justify-between items-center gap-3 bg-slate-50/60 p-3 rounded-xl border border-slate-200/70">
      <div className="text-xs text-slate-500 font-bold">
      {isEn ? 'Total applications:' : 'Total de solicitudes:'} <span className="text-slate-900">0</span>
      </div>
      
      {/* Botón con tacha corregido para cerrar la matriz */}
      <button
        type="button"
        onClick={() => {
          setShowRfqMatrix(false);
          setSelectedClient(null);
        }}
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
      >
        <span>✕</span>
      </button>
    </div>

    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase border-b border-slate-200/80">
            <th className="py-3 px-3.5">{isEn ? 'RFQ Reference Number:' : 'FOLIO RFQ'}</th>
            <th className="py-3 px-3.5">{isEn ? 'REQUISITION' : 'REQUISICIÓN'}</th>
            <th className="py-3 px-3.5">{isEn ? 'REFERENCE' : 'REFERENCIA'}</th>
            <th className="py-3 px-3.5">{isEn ? 'BUYER' : 'COMPRADOR'}</th>
            <th className="py-3 px-3.5">{isEn ? 'SUPPLIER' : 'PROVEEDOR'}</th>
            <th className="py-3 px-3.5">{isEn ? 'EMISSION' : 'EMISIÓN'}</th>
            <th className="py-3 px-3.5">{isEn ? 'LIMIT' : 'LÍMITE'}</th>
            <th className="py-3 px-3.5">{isEn ? 'CURRENCY' : 'MONEDA'}</th>
            <th className="py-3 px-3.5">{isEn ? 'STATUS' : 'ESTATUS'}</th>
            <th className="py-3 px-3.5">{isEn ? 'DATE SENT' : 'FECHA ENVIADO'}</th>
            <th className="py-3 px-3.5 text-center">{isEn ? 'ACTIONS' : 'ACCIONES'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
          <tr>
            <td colSpan={11} className="py-12 text-center text-slate-400 text-xs">
            {isEn ? 'There are no requests registered yet.' : 'No hay solicitudes registradas aún.'}  
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
)}
  </div>
)}
  
{/* TARJETA 4: Cotizaciones recibidas */}
{activeTab === 4 && (
  <div className="space-y-6">
    {/* Encabezado Principal */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
      <div>
        <h3 className="text-base font-black text-slate-900">{isEn ? 'Contribution record' : 'Registro de cotización'}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
        {isEn ? 'Capture the offers received to generate the comparison.' : 'Captura las ofertas recibidas para generar el comparativo.'}  
        </p>
      </div>
      <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-[10px] rounded-full border border-blue-100 shrink-0">
      {isEn ? 'Step 3 · Quote' : 'Paso 3 · Cotización'}  
      </span>
    </div>

    {/* Formulario principal con ref vinculada */}
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-5">
      
      {/* Fila 1: Comprador responsable y Requisición validada */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Responsible buyer' : 'Comprador responsable'} <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={t3Buyer}
              onChange={(e) => setT3Buyer(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 shadow-2xs font-medium"
            >
              <option value="">{isEn ? 'Select buyer...' : 'Seleccionar comprador...'}</option>
              <option value="comprador1">{isEn ? 'Buyer 1' : 'Comprador 1'}</option>
              <option value="comprador2">{isEn ? 'Buyer 2' : 'Comprador 2'}</option>
            </select>
            <button type="button" title="Recargar" className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors shrink-0 cursor-pointer">
              ↻
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
          {isEn ? 'When a buyer is selected, a window will open displaying their validated requisitions that already have an RFQ.' : 'Al escoger un comprador se abrirá una ventana con sus requisiciones validadas que ya tienen RFQ.'}  
          </p>
        </div>

        <div className="md:col-span-4">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Validated requisition' : 'Requisición validada'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            readOnly
            value={t3Req || ''}
            placeholder="Selecciona primero un comprador..."
            className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-600 outline-none shadow-2xs font-semibold cursor-not-allowed placeholder:text-slate-500"
          />
          <p className="text-[10px] text-slate-400 mt-1">
          {isEn ? 'Select a buyer to view their requisitions.' : 'Selecciona un comprador para consultar sus requisiciones.'}  
          </p>
        </div>

        <div className="md:col-span-3 flex items-start pt-5">
          <button type="button" className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
            <span>🔍</span>
            <span>{isEn ? 'View requisitions' : 'Ver requisiciones'} </span>
          </button>
        </div>
      </div>

      {/* Fila 2: RFQ emitida y Proveedor de la RFQ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'RFQ issueds' : 'RFQ emitida'} <span className="text-red-500">*</span>
          </label>
          <select disabled className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-500 outline-none font-medium cursor-not-allowed">
            <option value="">{isEn ? 'First, select a requisition...' : 'Selecciona primero una requisición...'}</option>
            <option value="req1">{isEn ? 'Requisition 1' : 'Requisición 1'}</option>
            <option value="req2">{isEn ? 'Requisition 2' : 'Requisición 2'}</option>
          </select>
        </div>

        <div className="md:col-span-6">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'RFQ Supplier' : 'Proveedor de la RFQ'}</label>
          <input type="text" readOnly value="Automático desde la RFQ" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-500 font-bold outline-none cursor-not-allowed" />
        </div>
      </div>

      {/* Fila 3: Folio, Referencia interna, Referencia proveedor, Fecha de cotización */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Quote reference number' : 'Folio de cotización'}</label>
          <input type="text" readOnly placeholder="Automático" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-500 font-medium outline-none cursor-not-allowed placeholder:text-slate-500" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Internal reference' : 'Referencia interna'}</label>
          <input type="text" readOnly value="Automática desde la requisición" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-500 font-semibold outline-none cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Supplier reference' : 'Referencia del proveedor'}</label>
          <input type="text" name="refProveedor" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Quotation date' : 'Fecha de cotización'} <span className="text-red-500">*</span></label>
          <input type="date" name="fechaCotizacion" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
      </div>

      {/* Fila 4: Vigencia hasta, Subtotal, IVA %, Moneda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Valid until' : 'Vigencia hasta'}</label>
          <input type="date" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium placeholder:text-slate-400 focus:bg-white focus:border-purple-500" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Calculated subtotal' : 'Subtotal calculado'} <span className="text-red-500">*</span></label>
          <input type="number" defaultValue="0.00" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">IVA %</label>
          <input type="number" name="ivaGeneral" defaultValue="16" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Currency' : 'Moneda'}</label>
          <select name="monedaGeneral" defaultValue="MXN" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500">
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      {/* Fila 5: Totales y Condiciones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Total of the quote received' : 'Total de la cotización recibida'}</label>
          <input type="number" defaultValue="0" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Delivery days' : 'Días de entrega'} <span className="text-red-500">*</span></label>
          <input type="number" defaultValue="0" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Payment terms (SAT / SHCP)' : 'Condiciones de pago (SAT / SHCP)'}</label>
          <select name="condicionesPago" defaultValue="" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500">
            <option value="">{isEn ? 'Select method...' : 'Seleccionar método...'}</option>
            <option value="PUE">{isEn ? 'PUE – Payment in a single installment' : 'PUE-Pago en una sola exhibición'}</option>
            <option value="PPD">{isEn ? 'PPD – Payment in installments or deferred payment' : 'PPD-Pago en parcialidades o diferido'}</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Technical compliance %' : 'Cumplimiento técnico %'}</label>
          <input type="number" defaultValue="100" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
      </div>

      {/* Fila 6: Documentación y Comentarios */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Documentation %' : 'Documentación %'}</label>
          <input type="text" defaultValue="100" className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium focus:bg-white focus:border-purple-500" />
        </div>
        <div className="md:col-span-9">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Comments' : 'Comentarios'}</label>
          <textarea rows={2} className="w-full px-3.5 py-2 text-xs bg-slate-100/70 border border-slate-200 rounded-xl text-slate-700 outline-none font-medium resize-y focus:bg-white focus:border-purple-500" />
        </div>
      </div>

      {/* BOTÓN PARA GENERAR PARTIDAS */}
      {!partidasGeneradas && (
        <div className="flex justify-end pt-2 border-t border-slate-200 border-dashed mt-4">
          <button
            type="button"
            onClick={handleGenerarPartidas}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>⚡</span>
            <span>{isEn ? 'Generate quotation line items' : 'Generar partidas de cotización'}</span>
          </button>
        </div>
      )}

      {/* SECCIÓN ACTUALIZADA: Partidas cotizadas */}
      {partidasGeneradas && (
        <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 p-4 space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900">
              {isEn ? 'Line items quoted by this company' : 'Partidas cotizadas por esta empresa'}  
              </h4>
              <p className="text-[10.5px] text-slate-500">
              {isEn ? 'Select only the items included in the offer and enter the unit price received. The system displays the amount excluding VAT, the VAT, and the total amount per item.' : 'Marca únicamente los artículos incluidos en la oferta y captura el precio unitario recibido. El sistema muestra importe sin IVA, IVA e importe total por artículo.'}  
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => setPartidasGeneradas(false)}
                className="px-2 py-1 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
              >
              {isEn ? 'Disguise' : 'Ocultar'}  
              </button>
            </div>
          </div>

          {/* Tabla de partidas dinámica */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/80 text-[9.5px] font-black text-slate-700 uppercase border-b border-slate-200">
                  <th className="py-3 px-4 text-center">{isEn ? 'OFFERS' : 'OFRECE'}</th>
                  <th className="py-3 px-3">{isEn ? 'DEPARTURE' : 'PARTIDA'}</th>
                  <th className="py-3 px-3 w-1/3">{isEn ? 'DESCRIPTION' : 'DESCRIPCIÓN'}</th>
                  <th className="py-3 px-3 text-center">{isEn ? 'QUANTITY REQUESTED' : 'CANTIDAD SOLICITADA'}</th>
                  <th className="py-3 px-3">{isEn ? 'QUOTED AMOUNT' : 'CANTIDAD COTIZADA'}</th>
                  <th className="py-3 px-3">{isEn ? 'UNIT' : 'UNIDAD'}</th>
                  <th className="py-3 px-3">{isEn ? 'UNIT PRICE RECEIVED' : 'PRECIO UNITARIO RECIBIDO'}</th>
                  <th className="py-3 px-3">{isEn ? 'AMOUNT EXCLUDING VAT' : 'IMPORTE SIN IVA'}</th>
                  <th className="py-3 px-3">{isEn ? 'IVA' : 'IVA'}</th>
                  <th className="py-3 px-3">{isEn ? 'TOTAL INCLUDING IVA' : 'TOTAL CON IVA'}</th>
                </tr>
              </thead>
              <tbody>
                {/* SOLUCIÓN AL ERROR AQUÍ: Validación (cotizacionItems || []) y fallbacks (|| 0) */}
                {(cotizacionItems || []).map((item) => {
                  const cantCot = item?.cantidadCotizada || 0;
                  const precioUni = item?.precioUnitario || 0;
                  const porcIva = item?.ivaPorcentaje || 0;

                  const importeSinIva = cantCot * precioUni;
                  const iva = importeSinIva * (porcIva / 100);
                  const total = importeSinIva + iva;

                  return (
                    <tr key={item?.id || Math.random()} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={item?.ofrece || false}
                          onChange={(e) => handleItemChange(item?.id, 'ofrece', e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-bold text-slate-800">{item?.partida}</span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-[11px] font-bold text-slate-800 leading-tight">{item?.descripcion}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item?.categoria}</p>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs text-slate-600">{item?.cantidadSolicitada}</span>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          value={item?.cantidadCotizada ?? ''}
                          onChange={(e) => handleItemChange(item?.id, 'cantidadCotizada', Number(e.target.value))}
                          className="w-16 px-2 py-1.5 text-xs text-center border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-slate-600">{item?.unidad}</span>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          value={item?.precioUnitario ?? ''}
                          onChange={(e) => handleItemChange(item?.id, 'precioUnitario', Number(e.target.value))}
                          className="w-full min-w-[80px] px-2 py-1.5 text-xs font-bold text-slate-800 bg-blue-50 border border-blue-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-bold text-slate-800">
                          ${(importeSinIva || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-xs text-slate-600">${(iva || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-slate-400">{porcIva}.00%</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs font-bold text-emerald-600">
                          ${(total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

{/* Subsección: PDF de la cotización INTERACTIVA */}
<div className="p-4 border border-dashed border-slate-200 rounded-2xl bg-white space-y-3">
  <div>
    <h4 className="text-xs font-black text-slate-900">{isEn ? 'Quote PDF' : 'PDF de la cotización'}</h4>
    <p className="text-[10.5px] text-slate-500">
    {isEn ? 'Attach the suppliers offer PDF for direct reference from the head office.' : 'Adjunta el PDF de la oferta del proveedor para consulta directa desde la matriz.'}  
    </p>
  </div>

  <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center gap-3">
    <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors shrink-0">
    {isEn ? 'Choose file' : 'Elegir archivo'}    
      <input 
        ref={typeof pdfInputRef !== 'undefined' ? pdfInputRef : null} 
        type="file" 
        className="hidden" 
        accept="application/pdf,.pdf" 
        onChange={(e) => typeof handleFileChange === 'function' && handleFileChange(e)} 
      />
    </label>
    <span className={`text-xs ${typeof pdfFile !== 'undefined' && pdfFile ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
      {typeof pdfFile !== 'undefined' && pdfFile ? pdfFile.name : 'No se ha seleccionado ningún archivo'}
    </span>
  </div>

  {typeof showPreview !== 'undefined' && showPreview && typeof pdfPreviewUrl !== 'undefined' && pdfPreviewUrl ? (
    <div className="w-full h-80 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
      <iframe src={pdfPreviewUrl} title="Vista previa PDF" className="w-full h-full" />
    </div>
  ) : (
    <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-400">
      {typeof pdfFile !== 'undefined' && pdfFile ? 'PDF cargado correctamente. Haz clic en "Ver PDF" para previsualizarlo.' : 'No se ha cargado el PDF de la cotización.'}
    </div>
  )}

  <div className="flex gap-2 pt-1">
    <button 
      type="button" 
      onClick={() => typeof handleViewPdf === 'function' && handleViewPdf()} 
      disabled={typeof pdfFile === 'undefined' || !pdfFile} 
      className={`px-3 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${typeof pdfFile !== 'undefined' && pdfFile ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`}
    >
      <span>👁️</span> {isEn ? 'View PDF' : 'Ver PDF'} 
    </button>
    <button 
      type="button" 
      onClick={() => typeof handleRemovePdf === 'function' && handleRemovePdf()} 
      disabled={typeof pdfFile === 'undefined' || !pdfFile} 
      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${typeof pdfFile !== 'undefined' && pdfFile ? 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer shadow-2xs' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
    >
      <span>🗑️</span> {isEn ? 'Remove PDF' : 'Quitar PDF'} 
    </button>
  </div>
</div>
    </form>

    {/* BOTONES DE ACCIÓN RÁPIDA */}
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60">
      <button type="button" onClick={() => { setIsRfqGenerated(false); alert('RFQ Guardada. Preparando campos para la siguiente...'); }} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
        <span>💾</span> {isEn ? 'Save quote' : 'Guardar cotización'}
      </button>
      <button type="button" onClick={handleClearSelection} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5">
        <span>🧹</span> {isEn ? 'Clean' : 'Limpiar'}
      </button>
      <button type="button" onClick={() => setActiveTab(5)} className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5">
        <span>📊</span> {isEn ? 'View comparison' : 'Ver comparativo'} 
      </button>
      <button type="button" onClick={() => setActiveTab(11)} className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5">
        <span>📋</span> {isEn ? 'View matrix' : 'Ver matriz'}
      </button>
    </div>
  </div>
)}

        {/* TARJETA 5: Comparativo y selección preliminar (Antes Tarjeta 4) */}
        {activeTab === 5 && (() => {
  // Objeto de datos de prueba mapeados por ID de Requisición
  const mockDataRequisiciones = {
    '116831': {
      cliente: 'GLOBALSANTAFE DRILLING MEXICO, S. DE R.L. DE C.V.',
      proyecto: 'TRION',
      contrato: '11166',
      presupuesto: '$0.00',
      partidas: [
        { id: 1, descripcion: '1. OIL, MARVEL MYSTERY 1 GAL CONTAINER', categoria: 'Otros', cantidad: 1, unidad: 'Each', precio: '$0.00', subtotal: '$0.00' }
      ]
    },
    '116832': {
      cliente: 'PEMEX EXPLORACIÓN Y PRODUCCIÓN',
      proyecto: 'CANTARELL',
      contrato: '42100',
      presupuesto: '$5,960.00',
      partidas: [
        { id: 1, descripcion: '1. VÁLVULA DE BOLA 2 PULGADAS 1500 PSI', categoria: 'Válvulas', cantidad: 4, unidad: 'Pieza', precio: '$1,250.00', subtotal: '$5,000.00' },
        { id: 2, descripcion: '2. EMPAQUETADURA ESPIRALADA 2 PULGADAS', categoria: 'Sellos', cantidad: 8, unidad: 'Pieza', precio: '$120.00', subtotal: '$960.00' }
      ]
    },
    '116833': {
      cliente: 'PETROFAC MEXICO S.A. DE C.V.',
      proyecto: 'MAGALLANES',
      contrato: '88320',
      presupuesto: '$9,600.00',
      partidas: [
        { id: 1, descripcion: '1. ACEITE SINTÉTICO ISO VG 46 (TAMBOR 208L)', categoria: 'Lubricantes', cantidad: 2, unidad: 'Tambor', precio: '$4,800.00', subtotal: '$9,600.00' }
      ]
    }
  };

  const currentReqData = mockDataRequisiciones[selectedReqTab4] || mockDataRequisiciones['116831'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
        <div>
          <h3 className="text-base font-black text-slate-900">
          {isEn ? 'Comparative analysis and preliminary selection of suppliers' : 'Comparativo y selección preliminar de proveedores'}  
          </h3>
          <p className="text-[12px] text-slate-600 mt-0.5">
          {isEn ? 'Compare the offers received and identify the recommended supplier for each line item. This stage does not yet constitute a final award or a Purchase Order.' : 'Compara las ofertas recibidas y define el proveedor recomendado por partida. Esta etapa no genera todavía una adjudicación definitiva ni una Orden de Compra.'}  
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <select
            value={selectedReqTab4 || ''}
            onChange={(e) => {
              setSelectedReqTab4(e.target.value);
              if (!activeTab4Sub) setActiveTab4Sub(1);
            }}
            className="w-full px-4 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          >
            <option value="">{isEn ? 'Select requisition with quotes...' : 'Seleccionar requisición con cotizaciones...'}</option>
            <option value="116831">116831 - GLOBALSANTAFE DRILLING MEXICO, S. DE R.L. DE C.V.</option>
            <option value="116832">116832 - PEMEX EXPLORACIÓN Y PRODUCCIÓN</option>
            <option value="116833">116833 - PETROFAC MEXICO S.A. DE C.V.</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10.5px] text-slate-400 font-medium">
          {isEn ? 'Select a requisition to view its products and the related quotes.' : 'Selecciona una requisición para visualizar sus productos y las cotizaciones relacionadas.'}  
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('suppliers', 1);
                }
              }}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <span className="text-sm">🏢</span>
              <span>{isEn ? 'Registrar empresa / proveedor' : 'Registrar empresa / proveedor'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB TARJETAS DE NAVEGACIÓN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            id: 1,
            icon: '📌',
            title: 'Resumen de la requisición',
            desc: 'Cliente, proyecto, contrato, partidas y presupuesto estimado.',
          },
          {
            id: 2,
            icon: '📦',
            title: 'Productos solicitados',
            desc: 'Lista de partidas, cantidades, categorías y precios estimados.',
          },
          {
            id: 3,
            icon: '📊',
            title: 'Comparativo de proveedores',
            desc: 'Resumen de cotizaciones, puntajes y recomendación.',
          },
          {
            id: 4,
            icon: '🧩',
            title: 'Adjudicación por partida',
            desc: 'Define el proveedor recomendado por partida sin generar todavía un compromiso de compra.',
          },
          {
            id: 5,
            icon: '💡',
            title: 'Interpretación',
            desc: 'Cómo leer el comparativo y usar la recomendación.',
          },
        ].map((subTab) => {
          const currentSubTab = activeTab4Sub || 1;
          const isSelected = currentSubTab === subTab.id;
          return (
            <button
              key={subTab.id}
              type="button"
              onClick={() => setActiveTab4Sub(subTab.id)}
              className={`p-3.5 text-left rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-start min-h-[96px] ${
                isSelected
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-transparent shadow-md shadow-purple-500/10 -translate-y-0.5'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">{subTab.icon}</span>
                <h5 className={`text-[11.5px] font-black leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                  {subTab.title}
                </h5>
              </div>
              <p className={`text-[9.5px] leading-snug line-clamp-3 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                {subTab.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* ÁREA DE CONTENIDO */}
      {/* SUB TARJETA 5: Independiente de la selección de requisición */}
      {activeTab4Sub === 5 ? (
        <div className="space-y-4 text-left">
          {/* Banner Informativo Superior (Azul con borde izquierdo sólido) */}
          <div className="p-4 bg-[#f0f7ff] border border-blue-100 rounded-2xl border-l-4 border-l-blue-600 text-xs text-slate-800 leading-relaxed shadow-2xs">
            <span className="font-bold text-slate-900 block mb-1">
            {isEn ? 'Interpretation of the comparative:' : 'Interpretación del comparativo:'}  
            </span>
            {isEn ? 'First, the context of the requisition is presented. Next, the requested items are listed, followed by a comparison of supplier quotes for that same requisition. The recommendation takes into account the total cost, delivery lead time, technical compliance, and documentation compliance. The best option is not always the cheapest one; there may be an offer that provides better compliance or a more favorable delivery timeline.' : 'Primero se muestra el contexto de la requisición. Después se presentan las partidas solicitadas y finalmente el comparativo de las cotizaciones de los proveedores sobre esa misma requisición. La recomendación considera el monto total, los días de entrega, el cumplimiento técnico y el cumplimiento documental. La mejor opción no siempre es la más barata: puede existir una oferta con mayor cumplimiento o mejor plazo.'}
          </div>

          {/* Lista de preguntas desplegables */}
          <div className="space-y-3">
            {/* PREGUNTA 1 */}
            <details className="group border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-2xs">
              <summary className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer select-none list-none">
                <h5 className="text-xs font-black text-slate-800">
                {isEn ? 'How do I split a requisition among several suppliers?' : '¿Cómo divido una requisición entre varios proveedores?'}  
                </h5>
                <span className="text-slate-400 text-[10px] transition-transform duration-200 shrink-0 group-open:rotate-180 group-open:text-blue-600">
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-4 pt-1 border-t border-slate-100/80 text-xs text-slate-600 leading-relaxed bg-slate-50/30">
              {isEn ? 'For each quote, record only the line items offered by that company. Then, open "Award by line item," select the winning supplier for each item, and click "Save award." The system groups the line items by supplier and automatically creates a purchase order—along with its corresponding PDF—for each one.' : 'Registra en cada cotización únicamente las partidas que ofrece esa empresa. Después abre "Adjudicación por partida", selecciona el proveedor ganador para cada mercancía y presiona "Guardar adjudicación". El sistema agrupa las partidas por proveedor y crea automáticamente una Orden de Compra y su PDF para cada uno.'}   
              </div>
            </details>

            {/* PREGUNTA 2 */}
            <details className="group border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-2xs">
              <summary className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer select-none list-none">
                <h5 className="text-xs font-black text-slate-800">
                {isEn ? 'What does the recommendation mean?' : '¿Qué significa la recomendación?'}    
                </h5>
                <span className="text-slate-400 text-[10px] transition-transform duration-200 shrink-0 group-open:rotate-180 group-open:text-blue-600">
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-4 pt-1 border-t border-slate-100/80 text-xs text-slate-600 leading-relaxed bg-slate-50/30">
               {isEn ? 'What does the recommendation mean?' : '¿Qué significa la recomendación?'}  
              </div>
            </details>

            {/* PREGUNTA 3 */}
            <details className="group border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-2xs">
              <summary className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer select-none list-none">
                <h5 className="text-xs font-black text-slate-800">
                  {isEn ? 'What should I check before choosing?' : '¿Qué debo revisar antes de elegir?'}
                </h5>
                <span className="text-slate-400 text-[10px] transition-transform duration-200 shrink-0 group-open:rotate-180 group-open:text-blue-600">
                  ▼
                </span>
              </summary>
              <div className="px-5 pb-4 pt-1 border-t border-slate-100/80 text-xs text-slate-600 leading-relaxed bg-slate-50/30">
               {isEn ? 'Verify that the requested products meet the clients needs, that the supplier offers the required scope, that the documentation is complete, and that the delivery time aligns with the required date.' : 'Verifica que los productos solicitados correspondan a la necesidad del cliente, que el proveedor ofrezca el alcance requerido, que la documentación esté completa y que el tiempo de entrega sea compatible con la fecha requerida.'} 
              </div>
            </details>
          </div>
        </div>
      ) : !selectedReqTab4 ? (
        /* Para las pestañas 1 a 4, sí se solicita seleccionar requisición primero */
        <div className="p-8 border border-slate-200/80 rounded-2xl bg-white text-center">
          <p className="text-xs font-medium text-slate-400">
           {isEn ? 'Select a requisition to view its products and the related quotes.' : 'Selecciona una requisición para visualizar sus productos y las cotizaciones relacionadas.'}  
          </p>
        </div>
      ) : (
        <div className="w-full space-y-6">
          {/* SUB TARJETA 1: RESUMEN DE LA REQUISICIÓN */}
          {(activeTab4Sub === 1 || !activeTab4Sub) && (
            <div className="bg-[#f0f7ff] border border-blue-100 rounded-2xl p-5 border-l-4 border-l-blue-600 shadow-2xs space-y-2 text-left">
              <div className="text-xs text-slate-800 leading-snug">
                <span className="font-bold text-slate-900">{isEn ? 'Requisition:' : 'Requisición:'}</span> {selectedReqTab4} · {currentReqData.cliente}
              </div>
              
              <div className="text-xs text-slate-700 leading-snug">
                <span className="font-medium text-slate-900">{isEn ? 'Project:' : 'Proyecto:'}</span> {currentReqData.proyecto} · <span className="font-medium text-slate-900">{isEn ? 'Contract:' : 'Contrato:'}</span> {currentReqData.contrato} · <span className="font-medium text-slate-900">{isEn ? 'Entries:' : 'Partidas:'}</span> {currentReqData.partidas.length} · <span className="font-medium text-slate-900">{isEn ? 'Estimated budget:' : 'Presupuesto estimado:'}</span> {currentReqData.presupuesto}
              </div>
              
              <div className="text-xs text-slate-800 leading-snug">
                <span className="font-bold text-slate-900">{isEn ? 'Participating companies:' : 'Empresas participantes:'}</span>{isEn ? '1. Add at least one other company to create a comparison.' : '1. Agrega por lo menos otra empresa para formar un comparativo.'} 
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof setActiveTab === 'function') {
                      setActiveTab(3);
                    } else if (onNavigate) {
                      onNavigate('requisitions', 3);
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-bold text-xs rounded-xl transition-all duration-200 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span className="text-sm font-black">+</span>
                  <span>{isEn ? 'Add another company' : 'Agregar otra empresa'}</span>
                </button>
              </div>
            </div>
          )}

          {/* SUB TARJETA 2: PRODUCTOS / PARTIDAS SOLICITADAS */}
          {activeTab4Sub === 2 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 text-left">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                {isEn ? 'Products / items requested' : 'Productos / partidas solicitadas'}  
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                {isEn ? 'Detail of what the customer requested in the selected requisition' : 'Detalle de lo que el cliente pidió en la requisición seleccionada'} ({selectedReqTab4}).
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f0f5ff] text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <th className="py-3 px-4 border-b border-slate-100 w-12 text-center">#</th>
                      <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'DESCRIPTION / SPECIFICATION' : 'DESCRIPCIÓN / ESPECIFICACIÓN'}</th>
                      <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'CATEGORY' : 'CATEGORÍA'}</th>
                      <th className="py-3 px-4 border-b border-slate-100 text-center">{isEn ? 'AMOUNT' : 'CANTIDAD'}</th>
                      <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'UNIT' : 'UNIDAD'}</th>
                      <th className="py-3 px-4 border-b border-slate-100 text-right">{isEn ? 'ESTIMATED PRICE' : 'PRECIO ESTIMADO'}</th>
                      <th className="py-3 px-4 border-b border-slate-100 text-right">{isEn ? 'ESTIMATED SUBTOTAL' : 'SUBTOTAL ESTIMADO'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {currentReqData.partidas.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-center">{item.id}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">{item.descripcion}</td>
                        <td className="py-3.5 px-4 text-slate-600">{item.categoria}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{item.cantidad}</td>
                        <td className="py-3.5 px-4 text-slate-600">{item.unidad}</td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700">{item.precio}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">{item.subtotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB TARJETA 3: COMPARATIVO DE PROVEEDORES */}
          {activeTab4Sub === 3 && (() => {
            const mockComparativo = {
              '116831': [
                {
                  id: 1,
                  posicion: 'Recomendada',
                  proveedor: 'GRUPO GEREZ S.A. DE C.V.',
                  referencia: 'HOR-1181',
                  totalCotizado: '$1,078.80',
                  diasEntrega: '1 día(s)',
                  tecnico: '100%',
                  documental: '100%',
                  pago: 'PUE - Pago en una sola exhibición',
                  puntaje: '45.0/100',
                  estatus: 'Adjudicada total',
                },
              ],
              '116832': [
                {
                  id: 1,
                  posicion: 'Recomendada',
                  proveedor: 'VALVULAS Y CONEXIONES DEL GOLFO S.A.',
                  referencia: 'COT-2026-09',
                  totalCotizado: '$5,960.00',
                  diasEntrega: '3 día(s)',
                  tecnico: '100%',
                  documental: '95%',
                  pago: 'PUE - Pago en una sola exhibición',
                  puntaje: '92.5/100',
                  estatus: 'Adjudicada total',
                },
                {
                  id: 2,
                  posicion: 'Opción 2',
                  proveedor: 'SERVICIOS PETROLEROS INTEGRALES',
                  referencia: 'SPI-8842',
                  totalCotizado: '$6,400.00',
                  diasEntrega: '5 día(s)',
                  tecnico: '90%',
                  documental: '100%',
                  pago: 'PPD - Pago en parcialidades',
                  puntaje: '78.0/100',
                  estatus: 'En evaluación',
                },
              ],
              '116833': [
                {
                  id: 1,
                  posicion: 'Recomendada',
                  proveedor: 'INDUSTRIALES DE MÉXICO',
                  referencia: 'LIM-9910',
                  totalCotizado: '$9,600.00',
                  diasEntrega: '2 día(s)',
                  tecnico: '100%',
                  documental: '100%',
                  pago: 'PUE - Pago en una sola exhibición',
                  puntaje: '98.0/100',
                  estatus: 'Adjudicada total',
                },
              ],
            };

            const listaComparativo = (selectedReqTab4 && mockComparativo[selectedReqTab4]) || mockComparativo['116831'];
            const recomendada = listaComparativo.find((item) => item.posicion === 'Recomendada') || listaComparativo[0];

            return (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 text-left">
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                  {isEn ? 'Comparison of quotes by requisition' : 'Comparativo de cotizaciones por requisición'}  
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                  {isEn ? 'Summary of offers received for the products requested in the requisition' : 'Resumen de las ofertas recibidas para los productos solicitados en la requisición'} {selectedReqTab4 || '116831'}.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f0f5ff] text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'POSITION' : 'POSICIÓN'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'SUPPLIER' : 'PROVEEDOR'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'REFERENCE' : 'REFERENCIA'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'TOTAL QUOTED' : 'TOTAL COTIZADO'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'DELIVERY DAYS' : 'DÍAS DE ENTREGA'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'TECHNICAL' : 'TÉCNICO'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'DOCUMENTARY' : 'DOCUMENTAL'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'PAY' : 'PAGO'}</th>
                        <th className="py-3 px-4 border-b border-slate-100 text-center">{isEn ? 'SCORE' : 'PUNTAJE'}</th>
                        <th className="py-3 px-4 border-b border-slate-100 text-center">{isEn ? 'STATUS' : 'ESTATUS'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {listaComparativo.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold">
                            {row.posicion === 'Recomendada' ? (
                              <span className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full">
                              {isEn ? 'Recommended' : 'Recomendada'}  
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">{row.posicion}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-black text-slate-900">{row.proveedor}</td>
                          <td className="py-3.5 px-4 text-slate-600">{row.referencia}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">{row.totalCotizado}</td>
                          <td className="py-3.5 px-4 text-slate-600">{row.diasEntrega}</td>
                          <td className="py-3.5 px-4 text-slate-700 font-medium">{row.tecnico}</td>
                          <td className="py-3.5 px-4 text-slate-700 font-medium">{row.documental}</td>
                          <td className="py-3.5 px-4 text-slate-600">{row.pago}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2.5 py-1 text-[11px] font-black text-rose-600 bg-rose-50 rounded-full border border-rose-100">
                              {row.puntaje}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-3 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full border border-blue-200/60">
                              {row.estatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {recomendada && (
                  <div className="p-3.5 bg-[#ecfdf5] border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center gap-1.5 border-l-4 border-l-emerald-500">
                    <span className="font-bold">{isEn ? 'Current recommendation:' : 'Recomendación actual:'}</span>
                    <span>
                      {recomendada.proveedor} · {recomendada.totalCotizado} · {recomendada.diasEntrega} · Puntaje {recomendada.puntaje}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* SUB TARJETA 4: ADJUDICACIÓN POR PARTIDA */}
          {activeTab4Sub === 4 && (() => {
            const mockAdjudicacion = {
              '116831': {
                ocVigentes: '1 OC vigente(s)',
                partidas: [
                  {
                    id: 1,
                    mercancia: 'UNA PERSONA (CUENTA CON ID, SEGURO) A MUELLE Y UNA UNIDAD CUENTA CON PLACAS, POLIZA Y MEDIDAS DE SEGURIDAD DEL VEHICULO',
                    subtexto: 'Gestión Rise X',
                    cantidadSolicitada: '1 servicio',
                    cantidadComprar: 1,
                    precioUnitario: '',
                    empresasOfertan: 1,
                    proveedores: ['Sin adjudicar', 'GRUPO GEREZ S.A. DE C.V.'],
                  },
                ],
                ocGeneradas: [
                  {
                    codigo: 'OC-2026-0015',
                    proveedor: 'GRUPO GEREZ S.A. DE C.V.',
                    partidasCount: '1 partida(s)',
                    montoTotal: '$1,078.80',
                  },
                ],
              },
              '116832': {
                ocVigentes: '2 OC vigente(s)',
                partidas: [
                  {
                    id: 1,
                    mercancia: 'VÁLVULA DE BOLA 2 PULGADAS 1500 PSI',
                    subtexto: 'Mantenimiento de Línea',
                    cantidadSolicitada: '4 piezas',
                    cantidadComprar: 4,
                    precioUnitario: '1250.00',
                    empresasOfertan: 2,
                    proveedores: ['Sin adjudicar', 'VALVULAS Y CONEXIONES DEL GOLFO S.A.', 'SERVICIOS PETROLEROS INTEGRALES'],
                  },
                  {
                    id: 2,
                    mercancia: 'EMPAQUETADURA ESPIRALADA 2 PULGADAS',
                    subtexto: 'Sellado Industrial',
                    cantidadSolicitada: '8 piezas',
                    cantidadComprar: 8,
                    precioUnitario: '120.00',
                    empresasOfertan: 2,
                    proveedores: ['Sin adjudicar', 'VALVULAS Y CONEXIONES DEL GOLFO S.A.', 'SERVICIOS PETROLEROS INTEGRALES'],
                  },
                ],
                ocGeneradas: [
                  {
                    codigo: 'OC-2026-0016',
                    proveedor: 'VALVULAS Y CONEXIONES DEL GOLFO S.A.',
                    partidasCount: '2 partida(s)',
                    montoTotal: '$5,960.00',
                  },
                ],
              },
              '116833': {
                ocVigentes: '1 OC vigente(s)',
                partidas: [
                  {
                    id: 1,
                    mercancia: 'ACEITE SINTÉTICO ISO VG 46 (TAMBOR 208L)',
                    subtexto: 'Suministro de Fluidos',
                    cantidadSolicitada: '2 tambores',
                    cantidadComprar: 2,
                    precioUnitario: '4800.00',
                    empresasOfertan: 1,
                    proveedores: ['Sin adjudicar', 'INDUSTRIALES DE MÉXICO'],
                  },
                ],
                ocGeneradas: [
                  {
                    codigo: 'OC-2026-0017',
                    proveedor: 'INDUSTRIALES DE MÉXICO',
                    partidasCount: '1 partida(s)',
                    montoTotal: '$9,600.00',
                  },
                ],
              },
            };

            const currentAdjData = (selectedReqTab4 && mockAdjudicacion[selectedReqTab4]) || mockAdjudicacion['116831'];

            return (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                    {isEn ? 'Award by line item' : 'Adjudicación por partida'}  
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                    {isEn ? 'Select the winning supplier for each item. The system will group the line items and create a separate purchase order (OC) for each supplier.' : 'Selecciona el proveedor ganador para cada mercancía. El sistema agrupará las partidas y creará una OC independiente por proveedor.'}  
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 font-bold text-[10px] rounded-full shrink-0">
                    {currentAdjData.ocVigentes}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f0f5ff] text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <th className="py-3 px-4 border-b border-slate-100 w-12 text-center">#</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'GOODS / SERVICE' : 'MERCANCÍA / SERVICIO'}</th>
                        <th className="py-3 px-4 border-b border-slate-100">{isEn ? 'QUANTITY REQUESTED' : 'CANTIDAD SOLICITADA'}</th>
                        <th className="py-3 px-4 border-b border-slate-100 w-72">{isEn ? 'AWARDED SUPPLIER' : 'PROVEEDOR ADJUDICADO'}</th>
                        <th className="py-3 px-4 border-b border-slate-100 text-center w-32">{isEn ? 'QUANTITY TO PURCHASE' : 'CANTIDAD A COMPRAR'}</th>
                        <th className="py-3 px-4 border-b border-slate-100 text-right w-36">{isEn ? 'AWARDED UNIT PRICE' : 'PRECIO UNITARIO ADJUDICADO'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {currentAdjData.partidas.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 text-center">{item.id}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-[11px] leading-tight">
                              {item.mercancia}
                            </div>
                            {item.subtexto && (
                              <div className="text-[10px] text-slate-400 mt-0.5">{item.subtexto}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-medium">{item.cantidadSolicitada}</td>
                          <td className="py-3.5 px-4">
                            <select className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-blue-400/60 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs">
                              {item.proveedores.map((prov, idx) => (
                                <option key={idx} value={prov}>{prov}</option>
                              ))}
                            </select>
                            <span className="text-[9.5px] text-slate-400 block mt-1">
                              {item.empresasOfertan} empresa(s) ofrecen esta partida
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="number"
                              defaultValue={item.cantidadComprar}
                              className="w-full px-3 py-1.5 text-xs text-center border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700"
                            />
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <input
                              type="number"
                              placeholder=""
                              defaultValue={item.precioUnitario}
                              className="w-full px-3 py-1.5 text-xs text-right border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    className="px-4 py-2 bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs rounded-xl transition-all shadow-2xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-sm">🛒</span>
                    <span>{isEn ? 'Save award' : 'Guardar adjudicación'}</span>
                  </button>

                  <button
                    type="button"
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all shadow-2xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-sm">📋</span>
                    <span>{isEn ? 'View generated orders' : 'Ver órdenes generadas'}</span>
                  </button>
                </div>

                <div className="space-y-3 pt-3">
                  {currentAdjData.ocGeneradas.map((oc, index) => (
                    <div key={index} className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-2xs space-y-1">
                      <div className="font-bold text-xs text-slate-900">{oc.codigo}</div>
                      <div className="text-xs text-slate-700 font-semibold">{oc.proveedor}</div>
                      <div className="text-[11px] text-slate-500">
                        {oc.partidasCount} · {oc.montoTotal}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
})()}

        {/* TARJETA 6: Cotización formal al cliente */}
{activeTab === 6 && (
  <form className="space-y-6 text-left" onSubmit={(e) => e.preventDefault()}>
    {/* Input de archivo oculto para la firma */}
    <input
      type="file"
      ref={signatureInputRef}
      onChange={handleSignatureUpload}
      accept="image/*"
      className="hidden"
    />

    {/* Encabezado Principal */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
      <div>
        <h3 className="text-base font-black text-slate-900">
        {isEn ? 'Formal quote for the client' : 'Cotización formal al cliente'}  
        </h3>
        <p className="text-[12px] text-slate-600 mt-0.5">
        {isEn ? 'Consolidates the awarded line items, internal costs, expenses, and margin to produce the selling price that the customer will see.' : 'Consolida las partidas adjudicadas, costos internos, gastos y margen para producir el precio de venta que verá el cliente.'}   
        </p>
      </div>
      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10.5px] rounded-full border border-emerald-200/80 shrink-0">
       {isEn ? 'External commercial document' : 'Documento comercial externo'} 
      </span>
    </div>

    {/* Banners Informativos Superiores */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl border-l-4 border-l-amber-500 text-xs text-slate-800 leading-relaxed shadow-2xs">
        <span className="font-bold text-slate-900">{isEn ? 'Internal information:' : 'Información interna:'}  </span>
        {isEn ? 'Supplier cost, expenses, and margin are only shown during the preparation phase and never appear in the client-facing PDF.' : 'costo del proveedor, gastos y margen solo se muestran durante la elaboración y nunca aparecen en el PDF del cliente.'} 
      </div>
      <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl border-l-4 border-l-emerald-500 text-xs text-slate-800 leading-relaxed shadow-2xs">
        <span className="font-bold text-slate-900">{isEn ? 'Visible information:' : 'Información visible:'}  </span>
       {isEn ? 'The client receives a description, quantity, unit selling price, taxes, total, validity period, and commercial terms.' : 'el cliente recibe descripción, cantidad, precio unitario de venta, impuestos, total, vigencia y condiciones comerciales.'}  
      </div>
    </div>

    {/* Formulario Principal */}
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Comprador responsable */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Responsible buyer *' : 'Comprador responsable *'}  
          </label>
          <select className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs">
            <option value="">{isEn ? 'Select buyer...' : 'Seleccionar comprador...'} </option>
            <option value="1">{isEn ? 'Buyer 1' : 'Comprador 1'} </option>
            <option value="2">{isEn ? 'Buyer 2' : 'Comprador 2'} </option>
          </select>
          <span className="text-[10px] text-slate-400 mt-1 block">
          {isEn ? 'Responsible buyer *' : 'Selecciona al comprador responsable de la requisición.'}   
          </span>
        </div>

        {/* Requisición del cliente */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Client requisition *' : 'Requisición del cliente *'}   
          </label>
          <select className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs">
            <option value="">{isEn ? 'Select a buyer first...' : 'Seleccionar primero un comprador...'} </option>
            <option value="116831">116831 - TRION</option>
            <option value="116832">116832 - CANTARELL</option>
          </select>
          <span className="text-[10px] text-slate-400 mt-1 block">
          {isEn ? 'Only requisitions for the selected buyer are displayed.' : 'Solo se muestran requisiciones del comprador seleccionado.'}   
          </span>
        </div>

        {/* Folio de cotización */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
           {isEn ? 'Quote reference number' : 'Folio de cotización'} 
          </label>
          <input
            type="text"
            readOnly
            placeholder="Automático"
            className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100/80 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed shadow-2xs"
          />
        </div>

        {/* Referencia interna */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Internal reference' : 'Referencia interna'}  
          </label>
          <input
            type="text"
            readOnly
            placeholder="Automática desde la requisición"
            className="w-full px-3.5 py-2.5 text-xs font-medium bg-slate-100/80 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed shadow-2xs"
          />
        </div>

        {/* Revisión */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Revision *' : 'Revisión *'}   
          </label>
          <input
            type="number"
            defaultValue={0}
            className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>

        {/* Fecha de emisión */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Date of issue *' : 'Fecha de emisión *'}   
          </label>
          <input
            type="date"
            defaultValue="2026-09-24"
            className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>

        {/* Vigencia hasta */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Valid until *' : 'Vigencia hasta *'}   
          </label>
          <input
            type="date"
            defaultValue="2026-10-24"
            className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>

        {/* Moneda de cotización / cliente */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Quotation currency / client *' : 'Moneda de cotización / cliente *'}   
          </label>
          <select className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 shadow-2xs">
            <option value="MXN">{isEn ? 'MXN - Mexican Peso' : 'MXN - Peso mexicano'}</option>
            <option value="USD">{isEn ? 'USD - United States Dollar' : 'USD - Dólar estadounidense'}</option>
            <option value="EUR">{isEn ? 'EUR - Euro' : 'EUR - Euro'}</option>
          </select>
          <span className="text-[9.5px] text-slate-400 mt-1 block">
          {isEn ? 'All prices visible to the customer, as well as the PDF, will be expressed in this currency.' : 'Todos los precios visibles al cliente y el PDF se expresarán en esta moneda.'}  
          </span>
        </div>

        {/* Estatus */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Estatus
          </label>
          <select className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs">
            <option value="Borrador">{isEn ? 'Draft' : 'Borrador'}</option>
            <option value="En revisión interna">{isEn ? 'Under internal review' : 'En revisión interna'}</option>
            <option value="Pendiente de autorización">{isEn ? 'Pending authorization' : 'Pendiente de autorización'}</option>
            <option value="Enviada al cliente">{isEn ? 'Sent to the client' : 'Enviada al cliente'}</option>
            <option value="Aprobada">{isEn ? 'Approved' : 'Aprobada'}</option>
            <option value="Solicitud de modificación">{isEn ? 'Request for modification' : 'Solicitud de modificación'}</option>
            <option value="Rechazada">{isEn ? 'Rejected' : 'Rechazada'}</option>
            <option value="Vencida">{isEn ? 'Defeated' : 'Vencida'}</option>
            <option value="Sustituida">{isEn ? 'Replaced' : 'Sustituida'}</option>
          </select>
        </div>

        {/* Comprador sec */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Buyer *' : ' Comprador *'} 
          </label>
          <select className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs">
            <option value="">{isEn ? 'Select buyer...' : 'Seleccionar comprador...'} </option>
            <option value="1">{isEn ? 'Buyer 1' : 'Comprador 1'} </option>
            <option value="2">{isEn ? 'Buyer 2' : 'Comprador 2'} </option>
          </select>
        </div>

        {/* Tiempo de entrega ofrecido */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Offered delivery time' : ' Tiempo de entrega ofrecido'}  
          </label>
          <input
            type="text"
            placeholder="Ej. 10 días hábiles después de la OC"
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>

        {/* Lugar de entrega */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Place of delivery' : 'Lugar de entrega'}  
          </label>
          <input
            type="text"
            placeholder=""
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>

        {/* Condiciones de pago */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Terms of payment' : 'Condiciones de pago'}  
          </label>
          <input
            type="text"
            placeholder="Ej. Crédito 30 días / anticipo / contra entrega"
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>

        {/* Garantía */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Warranty' : 'Garantía'}   
          </label>
          <input
            type="text"
            placeholder="Ej. 12 meses contra defectos de fabricación"
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>

        {/* Alcance incluido */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Scope included' : 'Alcance incluido'}  
          </label>
          <textarea
            rows={3}
            placeholder=""
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs resize-y"
          />
        </div>

        {/* Exclusiones */}
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {isEn ? 'Exclusions' : 'Exclusiones'}  
          </label>
          <textarea
            rows={3}
            placeholder=""
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs resize-y"
          />
        </div>
      </div>

      {/* Notas comerciales / Comentarios del PDF */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
        {isEn ? 'Commercial notes / PDF comments' : 'Notas comerciales / Comentarios del PDF'}  
        </label>
        <textarea
          rows={3}
          defaultValue=""
          className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs resize-y"
        />
        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
          <span className="font-bold text-slate-700">{isEn ? 'This field feeds directly into the COMMENTS section of the PDF.' : 'Este campo alimenta directamente COMENTARIOS / COMMENTS del PDF.'}  </span>
          <span>{isEn ? 'What is entered here appears in the COMMENTS section of the PDF. If left blank, the format uses the default commercial text.' : 'Lo capturado aquí se muestra en el recuadro COMENTARIOS / COMMENTS del PDF. Si se deja vacío, el formato utiliza los textos comerciales predeterminados.'} </span>
        </div>
      </div>
    </div>

    {/* SECCIÓN 1: CONVERSIÓN DE MONEDA DE COSTOS INTERNOS */}
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">💱</span>
            <h4 className="text-xs font-black text-slate-900">{isEn ? 'Currency conversion for internal costs' : 'Conversión de moneda de costos internos'} </h4>
          </div>
          <p className="text-[10.5px] text-slate-500 mt-0.5">
          {isEn ? 'Costs retain their original currency. The system converts them into the quote currency before applying expenses and margins.' : 'Los costos conservan su moneda de origen. El sistema los convierte a la moneda de la cotización antes de aplicar gasto y margen.'}  
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-[11px] rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <span>↻</span>
          <span>{isEn ? 'Update exchange rate' : 'Actualizar tipo de cambio'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Exchange rate date' : 'Fecha del tipo de cambio'}</label>
          <input
            type="date"
            defaultValue="2026-09-24"
            className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">1 USD = MXN</label>
          <input
            type="number"
            step="0.0001"
            defaultValue={1}
            className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">1 EUR = MXN</label>
          <input
            type="number"
            step="0.0001"
            defaultValue={1}
            className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Source / reference' : 'Fuente / referencia'}</label>
          <input
            type="text"
            defaultValue="Manual"
            className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
          />
        </div>
      </div>

      <div className="p-3 bg-blue-50/50 border border-blue-200/80 border-l-4 border-l-blue-500 rounded-xl text-xs text-slate-700">
        <span className="font-bold text-slate-900 block">{isEn ? 'Client currency: MXN · Origin costs: MXN' : 'Moneda del cliente: MXN · Costos de origen: MXN'}</span>
        <span className="text-[10.5px] text-slate-500">{isEn ? '1 USD = 1.000000 MXN · 1 EUR = 1.000000 MXN. The conversion is locked when this revision is saved.' : '1 USD = 1.000000 MXN · 1 EUR = 1.000000 MXN. La conversión se congela al guardar esta revisión.'}</span>
      </div>
    </div>

    {/* SECCIÓN 2: CONSTRUCCIÓN DEL PRECIO DE VENTA */}
<div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
  {/* Encabezado y Contador */}
  <div className="flex justify-between items-start gap-4">
    <div>
      <h4 className="text-xs font-black text-slate-900">{isEn ? 'Determination of the selling price' : 'Construcción del precio de venta'}</h4>
      <p className="text-[10.5px] text-slate-500 mt-0.5 leading-relaxed">
      {isEn ? 'The product cost is determined based on the contract award or the best available offer. Delivery/handling costs are recorded on a per-item basis. The profit margin percentage is defined individually for each item and is applied before IVA.' : 'El costo del producto se propone desde la adjudicación o la mejor oferta disponible. La entrega / manipulación se captura por partida. El % margen de ganancia se define individualmente por artículo y se aplica antes del IVA.'}  
      </p>
    </div>
    <span className="px-3 py-1 bg-purple-50 text-purple-700 font-bold text-[10.5px] rounded-full border border-purple-200/80 shrink-0">
    {isEn ? '0 game(s)' : '0 partida(s)'}  
    </span>
  </div>

  {/* TABLA DE PARTIDAS (ESTADO VACÍO) */}
  <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/20">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider">
            <th className="py-3 px-3 text-center">#</th>
            <th className="py-3 px-3">{isEn ? 'Description' : 'Descripción'} </th>
            <th className="py-3 px-3">{isEn ? 'Make / Model' : 'Marca / Modelo'} </th>
            <th className="py-3 px-3 text-center">{isEn ? 'Amount' : 'Cantidad'} </th>
            <th className="py-3 px-3 text-center">{isEn ? 'Unit' : 'Unidad'} </th>
            <th className="py-3 px-3">{isEn ? 'Product cost' : 'Costo del producto'} </th>
            <th className="py-3 px-3">{isEn ? 'Delivery / handling' : 'Entrega / manipulación'} </th>
            <th className="py-3 px-3">{isEn ? '% Profit margin' : '% Margen de ganancia'} </th>
            <th className="py-3 px-3 text-right">{isEn ? 'Unit selling price' : 'Precio venta unitario'} </th>
            <th className="py-3 px-3 text-right">{isEn ? 'Customer subtotal' : 'Subtotal cliente'} </th>
          </tr>
        </thead>
      </table>
    </div>

    {/* Caja con mensaje de selección */}
    <div className="m-3 p-8 bg-slate-50/50 border border-slate-200/80 rounded-xl text-center">
      <span className="text-xs text-slate-500 font-medium">
      {isEn ? 'Select a requisition.' : 'Selecciona una requisición.'}  
      </span>
    </div>
  </div>

  {/* Explicación inferior del margen (Banda azul con barra lateral) */}
  <div className="p-3 bg-blue-50/40 border-l-4 border-blue-600 rounded-r-xl text-xs text-slate-700">
    <p className="text-[11px] text-slate-600 leading-relaxed">
      <span className="font-bold text-slate-900">{isEn ? 'Profit margin %:' : '% margen de ganancia:'} </span>{isEn ? 'Profit margin applied to each line item, based on the product cost plus delivery/handling. This is independent of IVA; IVA is calculated subsequently on the sales subtotal.' : 'porcentaje de ganancia aplicado a cada partida sobre el costo del producto más la entrega / manipulación. Es independiente del IVA; el IVA se calcula después sobre el subtotal de venta.'}  
    </p>
  </div>

  {/* Resumen Totales */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
    <div>
      <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Subtotal Third Party Payment' : 'Subtotal de pago de terceros'} </label>
      <input
        type="text"
        readOnly
        defaultValue="0.00"
        className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-100/70 border border-slate-200/80 rounded-xl text-slate-600 outline-none cursor-not-allowed"
      />
    </div>
    <div>
      <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Descuento %' : 'Descuento %'}</label>
      <input
        type="number"
        defaultValue={0}
        className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 shadow-2xs"
      />
    </div>
    <div>
      <label className="block text-[11px] font-bold text-slate-700 mb-1">IVA %</label>
      <input
        type="number"
        defaultValue={16}
        className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 shadow-2xs"
      />
    </div>
    <div>
      <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'General total' : 'Total general'}</label>
      <input
        type="text"
        readOnly
        defaultValue="0.00"
        className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-100/70 border border-slate-200/80 rounded-xl text-slate-800 outline-none shadow-2xs cursor-not-allowed"
      />
    </div>
  </div>
</div>

{/* SECCIÓN 3: SERVICE FEE */}
<div
  className={`bg-white border transition-all duration-200 rounded-2xl p-6 shadow-2xs space-y-4 ${
    applyServiceFee
      ? "border-purple-400 ring-1 ring-purple-300/60"
      : "border-slate-200/80"
  }`}
>
  <div className="flex justify-between items-start gap-4">
    <div>
      <div className="flex items-center gap-2">
        <span className="text-base">💼</span>
        <h4 className="text-xs font-black text-slate-900">Service Fee</h4>
      </div>
      <p className="text-[10.5px] text-slate-500 mt-0.5">
      {isEn ? 'Optional. Calculated as a percentage of the third-party payment subtotal, excluding IVA.' : 'Opcional. Se calcula como un porcentaje del subtotal de Third Party Payment antes de IVA.'}  
      </p>
    </div>

    {/* Checkbox "Aplicar Service Fee" */}
    <label
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 shadow-2xs border ${
        applyServiceFee
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
      }`}
    >
      <input
        type="checkbox"
        checked={applyServiceFee}
        onChange={(e) => setApplyServiceFee(e.target.checked)}
        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
      />
      <span>{isEn ? 'Apply Service Fee' : 'Aplicar Service Fee'}</span>
    </label>
  </div>

  {/* Grilla de Campos de Service Fee */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {/* Service Fee % (Campo editable cuando está activo) */}
    <div>
      <label
        className={`block text-[11px] font-bold mb-1 transition-colors ${
          applyServiceFee ? "text-slate-700" : "text-slate-400"
        }`}
      >
        Service Fee %
      </label>
      <input
        type="number"
        defaultValue="0.00"
        disabled={!applyServiceFee}
        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all outline-none ${
          applyServiceFee
            ? "bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-purple-500"
            : "bg-slate-100/70 border-slate-200/60 text-slate-400 cursor-not-allowed"
        }`}
      />
    </div>

    {/* Base para Service Fee */}
    <div>
      <label
        className={`block text-[11px] font-bold mb-1 transition-colors ${
          applyServiceFee ? "text-slate-700" : "text-slate-400"
        }`}
      >
      {isEn ? 'Basis for Service Fee' : 'Base para Service Fee'}  
      </label>
      <input
        type="number"
        defaultValue="0.00"
        disabled={!applyServiceFee}
        readOnly
        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all outline-none ${
          applyServiceFee
            ? "bg-slate-100/80 border-slate-200/80 text-slate-700"
            : "bg-slate-100/70 border-slate-200/60 text-slate-400 cursor-not-allowed"
        }`}
      />
    </div>

    {/* Precio unitario Service Fee */}
    <div>
      <label
        className={`block text-[11px] font-bold mb-1 transition-colors ${
          applyServiceFee ? "text-slate-700" : "text-slate-400"
        }`}
      >
      {isEn ? 'Unit price Service Fee' : 'Precio unitario Service Fee'}  
      </label>
      <input
        type="number"
        defaultValue="0.00"
        disabled={!applyServiceFee}
        readOnly
        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all outline-none ${
          applyServiceFee
            ? "bg-slate-100/80 border-slate-200/80 text-slate-700"
            : "bg-slate-100/70 border-slate-200/60 text-slate-400 cursor-not-allowed"
        }`}
      />
    </div>

    {/* Subtotal Service Fee */}
    <div>
      <label
        className={`block text-[11px] font-bold mb-1 transition-colors ${
          applyServiceFee ? "text-slate-700" : "text-slate-400"
        }`}
      >
        Subtotal Service Fee
      </label>
      <input
        type="number"
        defaultValue="0.00"
        disabled={!applyServiceFee}
        readOnly
        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all outline-none ${
          applyServiceFee
            ? "bg-slate-100/80 border-slate-200/80 text-slate-700"
            : "bg-slate-100/70 border-slate-200/60 text-slate-400 cursor-not-allowed"
        }`}
      />
    </div>

    {/* IVA Service Fee */}
    <div>
      <label
        className={`block text-[11px] font-bold mb-1 transition-colors ${
          applyServiceFee ? "text-slate-700" : "text-slate-400"
        }`}
      >
        IVA Service Fee
      </label>
      <input
        type="number"
        defaultValue="0.00"
        disabled={!applyServiceFee}
        readOnly
        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all outline-none ${
          applyServiceFee
            ? "bg-slate-100/80 border-slate-200/80 text-slate-700"
            : "bg-slate-100/70 border-slate-200/60 text-slate-400 cursor-not-allowed"
        }`}
      />
    </div>

    {/* Total Service Fee */}
    <div>
      <label
        className={`block text-[11px] font-bold mb-1 transition-colors ${
          applyServiceFee ? "text-slate-700" : "text-slate-400"
        }`}
      >
        Total Service Fee
      </label>
      <input
        type="number"
        defaultValue="0.00"
        disabled={!applyServiceFee}
        readOnly
        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all outline-none ${
          applyServiceFee
            ? "bg-slate-100/80 border-slate-200/80 text-slate-700"
            : "bg-slate-100/70 border-slate-200/60 text-slate-400 cursor-not-allowed"
        }`}
      />
    </div>
  </div>

  {/* Comentarios del Service Fee */}
  <div>
    <label
      className={`block text-[11px] font-bold mb-1 transition-colors ${
        applyServiceFee ? "text-slate-700" : "text-slate-400"
      }`}
    >
    {isEn ? 'Service Fee Comments' : 'Comentarios del Service Fee'}  
    </label>
    <textarea
      rows={2}
      disabled={!applyServiceFee}
      placeholder="Ej. Service fee por coordinación, administración, gestión documental, logística y seguimiento de terceros."
      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition-all outline-none resize-y ${
        applyServiceFee
          ? "bg-white border-slate-200 text-slate-700 focus:ring-2 focus:ring-purple-500"
          : "bg-slate-100/70 border-slate-200/60 text-slate-400 cursor-not-allowed"
      }`}
    />
  </div>
</div>

    {/* SECCIÓN 4: NIVEL DE APROBACIÓN Y APROBACIÓN ELECTRÓNICA */}
    {/* Banner de Nivel de Aprobación */}
    <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl border-l-4 border-l-emerald-500 text-xs text-slate-800 leading-snug flex items-center gap-3 shadow-2xs">
      <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0">
        ✓
      </div>
      <div>
        <span className="font-black text-slate-900 block">{isEn ? 'Level 1 · Buyer Only' : 'Nivel 1 · Solo Comprador'}</span>
        <span className="text-slate-600">
        {isEn ? 'Within the limits: only electronic validation by the Buyer is required.' : 'Dentro de los límites: solo se requiere la validación electrónica del Comprador.'}  
        </span>
        <div className="text-[10.5px] font-medium text-slate-500 mt-0.5">
        {isEn ? 'Max. item: $610.80 · Assessed subtotal: $0.00 · Limits: $15,000.00 / $35,000.02 MXN' : 'Máx. artículo: $610.80 · Subtotal evaluado: $0.00 · Límites: $15,000.00 / $35,000.02 MXN'}  
        </div>
      </div>
    </div>

    {/* Cuadro de Aprobación Electrónica y Control Documental */}
    <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-6 shadow-2xs space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-base">🔒</span>
          <h4 className="text-xs font-black text-slate-900">
          {isEn ? 'Electronic approval and document control' : 'Aprobación electrónica y control documental'}  
          </h4>
        </div>
        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200/60">
        {isEn ? 'Without a graphic signature' : 'Sin firma gráfica'}  
        </span>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
      {isEn ? 'The client quotation does not use graphical signatures. Buyer, revision, and authorization are managed via authenticated user, status, date/time, revision, and a GrupoGerez audit log.' : 'La cotización al cliente no utiliza firmas gráficas. Comprador, revisión y autorización se controlan mediante usuario autenticado, estado, fecha/hora, revisión y bitácora de GrupoGerez.'}  
      </p>

      <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 border-l-4 border-l-emerald-500 rounded-xl text-[11px] text-slate-700 leading-relaxed">
        <span className="font-bold text-slate-900">{isEn ? 'Document control:' : 'Control del documento:'} </span>
      {isEn ? 'The external PDF is generated without signature images. Internal approvals remain recorded electronically, and the quote can only be sent to the client using the button.' : 'el PDF externo se emite sin imágenes de firmas. Las aprobaciones internas permanecen registradas electrónicamente y la cotización solo puede enviarse al cliente mediante el botón'}   <span className="font-bold text-slate-900">{isEn ? '✉ SEND TO CLIENT' : '✉ ENVIAR AL CLIENTE'} </span>{isEn ? 'after receiving internal authorization.' : 'después de quedar autorizada internamente.'}  
      </div>
    </div>

    {/* SECCIÓN 5: BANNER INFERIOR Y BOTONES DE ACCIÓN */}
    <div className="p-3 bg-blue-50/60 border-l-4 border-l-blue-600 rounded-xl text-xs text-slate-700 font-medium shadow-2xs">
    {isEn ? 'Select a requisition to load the client, line items, awarded costs, and currency.' : 'Selecciona una requisición para cargar cliente, partidas, costos adjudicados y moneda.'}  
    </div>

    {/* BOTONES DE ACCIÓN INFERIORES */}
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <button
        type="button"
        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:opacity-90 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-500/10 flex items-center gap-2 cursor-pointer"
      >
        <span className="text-sm">💾</span>
        <span>{isEn ? 'Save quote for the client' : 'Guardar cotización al cliente'}</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.closest('form')?.reset();
          if (typeof handleClearSignature === 'function') handleClearSignature();
        }}
        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
      >
        <span className="text-sm">🧹</span>
        <span>{isEn ? 'Clean' : 'Limpiar'}</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab(7)}
        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
      >
        <span className="text-sm">👁️</span>
        <span>{isEn ? 'Preview' : 'Vista previa'}</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab(8)}
        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
      >
        <span className="text-sm">📋</span>
        <span>{isEn ? 'View matrix' : 'Ver matriz'}</span>
      </button>
    </div>
  </form>
)}

        {/* TARJETA 7: Formato para el cliente (Antes Tarjeta 6) */}
        {activeTab === 7 && (
  <div className="space-y-6 text-left">
    {/* Reglas de impresión CSS para ocultar la interfaz y mostrar solo la hoja */}
    <style dangerouslySetInnerHTML={{ __html: `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #printable-quote, #printable-quote * {
          visibility: visible !important;
        }
        #printable-quote {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 20px !important;
          box-shadow: none !important;
          border: none !important;
        }
        @page {
          size: letter portrait;
          margin: 0.8cm;
        }
      }
    `}} />

    {/* ENCABEZADO SUPERIOR Y BOTONES DE ACCIÓN (Ocultos en impresión) */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs print:hidden">
      <div>
        <h3 className="text-base font-black text-slate-900">
        {isEn ? 'Quote format for the client' : 'Formato de cotización para el cliente'}  
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
        {isEn ? 'A commercial document that can be shared on the Client Portal. It does not contain supplier costs or margins.' : 'Documento comercial que sí puede compartirse en el Portal del Cliente. No contiene costos de proveedor ni margen.'}  
        </p>
      </div>
      
      <div className="flex items-center gap-2 self-end md:self-auto">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
        >
          <span>↓</span>
          <span>{isEn ? 'Download PDF' : 'Descargar PDF'}</span>
        </button>
      </div>
    </div>

    {/* SELECCIÓN DE IDIOMA Y CLIENTE / COTIZACIÓN (Ocultos en impresión) */}
    <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 space-y-3 print:hidden">
      <div className="w-full">
        <select
          value={selectedQuoteId}
          onChange={(e) => setSelectedQuoteId(e.target.value)}
          className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 shadow-2xs cursor-pointer"
        >
          <option value="1">
            COT-2026-0024 · Rev. 0 · SBM OFFSHORE DE MEXICO, S.A. DE C.V. · WO - GG - 004
          </option>
          <option value="2">
            COT-2026-0025 · Rev. 1 · PEMEX EXPLORACIÓN Y PRODUCCIÓN · WO - GG - 005
          </option>
        </select>
      </div>
    </div>

    {/* VISTA PREVIA DE LA HOJA DE COTIZACIÓN (ÚNICA PARTE IMPRESA) */}
    <div id="printable-quote" className="bg-white border border-slate-300 rounded-xl p-8 shadow-md max-w-5xl mx-auto text-slate-800 font-sans text-xs space-y-6">
      {/* ENCABEZADO DE LA HOJA */}
      <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4">
{/* LOGO GRUPO GEREZ */}
<div className="flex items-center gap-3">
  <img 
    src="/image_923273.svg" 
    alt="Logo Grupo Gerez" 
    className="h-20 w-auto object-contain"
  />
  <div className="border-2 border-orange-500 p-2 rounded-lg text-center leading-none">
    <span className="text-orange-600 font-black text-xl tracking-tighter block">GRUPO GEREZ</span>
    <span className="text-[7px] text-slate-500 block uppercase font-medium">Customs & Logistics Worldwide</span>
  </div>
</div>

        {/* TÍTULO CENTRAL */}
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-900 tracking-wide uppercase">
            {quoteLanguage === 'Español' ? 'COTIZACIÓN' : 'QUOTATION'}
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            COMMERCIAL QUOTATION · PROPUESTA ECONÓMICA
          </p>
        </div>

        {/* DATOS DEL FOLIO */}
        <div className="text-right text-[11px] space-y-0.5">
          <div className="font-black text-blue-900 text-xs">{currentQuote.folio}</div>
          <div><span className="font-semibold text-slate-500">{isEn ? 'Revision:' : 'Revisión:'}</span> {currentQuote.revision}</div>
          <div><span className="font-semibold text-slate-500">{isEn ? 'Date:' : 'Fecha:'}</span> {currentQuote.fecha}</div>
          <div><span className="font-semibold text-slate-500">{isEn ? 'Validity:' : 'Vigencia:'}</span> {currentQuote.vigencia}</div>
          <div><span className="font-semibold text-slate-500">{isEn ? 'Currency:' : 'Moneda:'}</span> <span className="font-bold">{currentQuote.moneda}</span></div>
        </div>
      </div>

      {/* BLOQUES COTIZA / CLIENTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* EMPRESA EMISORA */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-black text-blue-700 tracking-wider block uppercase">{isEn ? 'GET A QUOTE' : 'COTIZA'}</span>
          <div className="font-bold text-slate-900">GRUPO GEREZ - TRAMITE ADUANALES</div>
          <div className="text-[11px] text-slate-600">3ra avenida #1007 Col. Anahuac, Tampico Tamps.</div>
          <div className="text-[11px] text-slate-600">supplies@grupogerez.com</div>
          <div className="text-[11px] text-slate-600">8332140041</div>
        </div>

        {/* DATOS DEL CLIENTE SELECCIONADO */}
        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-black text-blue-700 tracking-wider block uppercase">{isEn ? 'CUSTOMER' : 'CLIENTE'}</span>
          <div className="font-bold text-slate-900">{currentQuote.cliente.empresa}</div>
          <div className="text-[11px] text-slate-600">{isEn ? 'Contact:' : 'Contacto:'} {currentQuote.cliente.contacto}</div>
          <div className="text-[11px] text-slate-600">{currentQuote.cliente.correo} · {currentQuote.cliente.telefono}</div>
          <div className="text-[11px] text-slate-600">
          {isEn ? 'Project:' : 'Proyecto:'}<span className="font-semibold">{currentQuote.cliente.proyecto}</span>{isEn ? '· Contract:' : '· Contrato:'} {currentQuote.cliente.contrato}
          </div>
          <div className="text-[11px] text-slate-600">{isEn ? 'Reference:' : 'Referencia:'} {currentQuote.cliente.referencia}</div>
        </div>
      </div>

      {/* BARRA SEPARADORA */}
      <div className="bg-slate-100 text-center py-1 rounded font-bold text-[10px] tracking-widest text-slate-600 uppercase border border-slate-200">
        T H I R D &nbsp; P A R T Y &nbsp; P A Y M E N T
      </div>

      {/* TABLA DE PARTIDAS */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-800 text-white font-bold text-[10px] uppercase">
              <th className="p-2.5">ITEM</th>
              <th className="p-2.5">DESCRIPTION</th>
              <th className="p-2.5">BRAND / MODEL</th>
              <th className="p-2.5 text-center">QTY</th>
              <th className="p-2.5 text-center">UNIT</th>
              <th className="p-2.5 text-right">UNIT PRICE</th>
              <th className="p-2.5 text-right">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {currentQuote.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="p-2.5 font-bold">{item.id}</td>
                <td className="p-2.5">{item.desc}</td>
                <td className="p-2.5">{item.brand}</td>
                <td className="p-2.5 text-center">{item.qty}</td>
                <td className="p-2.5 text-center">{item.unit}</td>
                <td className="p-2.5 text-right font-medium">
                  {currentQuote.moneda} {item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-2.5 text-right font-bold text-slate-900">
                  {currentQuote.moneda} {(item.qty * item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CONDICIONES SECCIÓN Y TOTALES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* CONDICIONES COMERCIALES */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          <div className="p-2.5 bg-slate-50 border-l-4 border-l-blue-600 rounded border border-slate-200">
            <span className="font-bold block text-slate-900 mb-0.5">{isEn ? 'Place and time of delivery' : 'Lugar y tiempo de entrega'}</span>
            <p className="text-slate-600">{currentQuote.condiciones.lugarEntrega}</p>
            <p className="text-slate-600">{currentQuote.condiciones.tiempoEntrega}</p>
          </div>

          <div className="p-2.5 bg-slate-50 border-l-4 border-l-blue-600 rounded border border-slate-200">
            <span className="font-bold block text-slate-900 mb-0.5">{isEn ? 'Terms of payment' : 'Condiciones de pago'}</span>
            <p className="text-slate-600">{currentQuote.condiciones.pago}</p>
          </div>

          <div className="p-2.5 bg-slate-50 border-l-4 border-l-blue-600 rounded border border-slate-200">
            <span className="font-bold block text-slate-900 mb-0.5">{isEn ? 'Warranty' : 'Garantía'}</span>
            <p className="text-slate-600">{currentQuote.condiciones.garantia}</p>
          </div>

          <div className="p-2.5 bg-slate-50 border-l-4 border-l-blue-600 rounded border border-slate-200">
            <span className="font-bold block text-slate-900 mb-0.5">{isEn ? 'Alcance incluido' : 'Alcance incluido'}</span>
            <p className="text-slate-600">{currentQuote.condiciones.alcance}</p>
          </div>

          <div className="p-2.5 bg-slate-50 border-l-4 border-l-blue-600 rounded border border-slate-200">
            <span className="font-bold block text-slate-900 mb-0.5">{isEn ? 'Exclusions' : 'Exclusiones'}</span>
            <p className="text-slate-600">{currentQuote.condiciones.exclusiones}</p>
          </div>

          <div className="p-2.5 bg-slate-50 border-l-4 border-l-blue-600 rounded border border-slate-200">
            <span className="font-bold block text-slate-900 mb-0.5">{isEn ? 'Grades' : 'Notas'}</span>
            <p className="text-slate-600">{currentQuote.condiciones.notas}</p>
          </div>
        </div>

        {/* CUADRO DE TOTALES */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="font-bold text-slate-600 uppercase">SUBTOTAL THIRD PARTY</span>
            <span className="font-bold">{currentQuote.moneda} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="font-bold text-slate-600 uppercase">IVA THIRD PARTY 16.00%</span>
            <span className="font-bold">{currentQuote.moneda} {vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="font-bold text-slate-600 uppercase">TOTAL THIRD PARTY</span>
            <span className="font-bold">{currentQuote.moneda} {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="font-bold text-slate-600 uppercase">SUBTOTAL GENERAL</span>
            <span className="font-bold">{currentQuote.moneda} {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between py-1 border-b border-slate-200">
            <span className="font-bold text-slate-600 uppercase">IVA GENERAL</span>
            <span className="font-bold">{currentQuote.moneda} {vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="border-2 border-slate-900 p-2.5 flex justify-between items-center rounded-lg bg-slate-50 mt-3">
            <span className="font-black text-slate-900 uppercase">TOTAL GENERAL</span>
            <span className="font-black text-base text-slate-900">
              {currentQuote.moneda} {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* BLOQUE DE FIRMAS */}
      <div className="grid grid-cols-3 gap-6 pt-10 text-center">
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-800 uppercase mb-6">{isEn ? 'BUYER' : 'COMPRADOR'}</div>
          <div className="text-[11px] text-slate-400 italic min-h-[16px]">
            {signatureImage ? (
              <img src={signatureImage} alt="Firma" className="max-h-8 mx-auto object-contain" />
            ) : (
              currentQuote.firmas.comprador.status
            )}
          </div>
          <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 text-[11px]">
            {currentQuote.firmas.comprador.nombre}
          </div>
          <div className="text-[9px] text-slate-500 uppercase">{currentQuote.firmas.comprador.puesto}</div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-800 uppercase mb-6">{isEn ? 'REVIEWED BY' : 'REVISÓ'}</div>
          <div className="text-[11px] text-slate-400 italic min-h-[16px]">
            {currentQuote.firmas.reviso.status}
          </div>
          <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 text-[11px]">
            {currentQuote.firmas.reviso.nombre}
          </div>
          <div className="text-[9px] text-slate-500 uppercase">{currentQuote.firmas.reviso.puesto}</div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-800 uppercase mb-6">{isEn ? 'AUTHORIZED' : 'AUTORIZÓ'}</div>
          <div className="text-[11px] text-slate-400 italic min-h-[16px]">
            {currentQuote.firmas.autorizo.status}
          </div>
          <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 text-[11px]">
            {currentQuote.firmas.autorizo.nombre}
          </div>
          <div className="text-[9px] text-slate-500 uppercase">{currentQuote.firmas.autorizo.puesto}</div>
        </div>
      </div>

      {/* PIE DE PÁGINA */}
      <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-3 space-y-0.5">
        <div>• usser@grupogerez.com · 8332140041 •</div>
        <div>{isEn ? 'This quote does not constitute an invoice. Prices and availability are subject to the specified validity period.' : 'Esta cotización no constituye una factura. Precios y disponibilidad sujetos a la vigencia indicada.'}</div>
      </div>
    </div>
  </div>
        )}

{/* TARJETA 8: Matriz de cotizaciones al cliente */}
{activeTab === 8 && (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    
    {/* Header Principal de la Tarjeta */}
    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">{isEn ? 'Client Quotation Matrix' : 'Matriz de cotizaciones al cliente'}</h2>
        <p className="text-sm text-slate-500 mt-0.5">
        {isEn ? 'Check revisions, validity, total, approval status, and the formal PDF.' : 'Consulta revisiones, vigencia, total, estado de aprobación y PDF formal.'}  
        </p>
      </div>
      <button 
        onClick={() => setActiveTab(6)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
      >
        <span>+</span>{isEn ? 'New quote for the client' : 'Nueva cotización al cliente'} 
      </button>
    </div>

    {/* ========================================================================= */}
    {/* SECCIÓN SUPERIOR: BARRA DE FILTROS + GRID DE TARJETAS (SIEMPRE VISIBLE)   */}
    {/* ========================================================================= */}
    
    {/* Barra de Filtros y Buscador */}
    <div className="p-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <input
            type="text"
            value={t7SearchTerm}
            onChange={(e) => setT7SearchTerm(e.target.value)}
            placeholder="Buscar por folio, cliente, requisición o estatus..."
            className="w-full pl-3 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <select 
            value={t7StatusFilter}
            onChange={(e) => setT7StatusFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-700 text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="todos">{isEn ? 'All statuses' : 'Todos los estatus'}</option>
            <option value="borrador">{isEn ? 'Draft' : 'Borrador'}</option>
            <option value="revision">{isEn ? 'Under internal review' : 'En revision interna'}</option>
            <option value="autorizada">{isEn ? 'Internally authorized' : 'Autorizada internamente'}</option>
            <option value="enviada">{isEn ? 'Sent to the client' : 'Enviada al cliente'}</option>
            <option value="aprobada">{isEn ? 'Approved' : 'Aprobada'}</option>
            <option value="modificacion">{isEn ? 'Request for modification' : 'Solicitud de modificación'}</option>
            <option value="rechazada">{isEn ? 'Rejected' : 'Rechazada'}</option>
            <option value="vencida">{isEn ? 'Defeated' : 'Vencida'}</option>
            <option value="sustituida">{isEn ? 'Replaced' : 'Sustituida'}</option>
          </select>
        </div>
      </div>
    </div>

    {/* Grid de Tarjetas por Cliente */}
    <div className="p-6 bg-slate-50/30 border-b border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div>
          <h3 className="text-sm font-black text-slate-900">{isEn ? 'Cards per customer' : 'Tarjetas por cliente'}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
          {isEn ? 'Select a client to open only that clients quotes.' : 'Selecciona un cliente para abrir únicamente sus cotizaciones al cliente.'}  
          </p>
        </div>
        <span className="px-3 py-1 bg-purple-50 text-purple-800 font-bold text-xs rounded-full border border-purple-100 self-start sm:self-auto">
        {isEn ? '6 client(s) · 3 quote(s)' : '6 cliente(s) · 3 cotización(es)'}  
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        {/* Tarjeta 1: Todas las cotizaciones */}
        <div className={`relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${selectedClient === 'TODAS' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/90'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl"></div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                TOD
              </div>
              <div>
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-tight">{isEn ? 'All quotes' : 'Todas las cotizaciones'}</h4>
                <p className="text-[11px] text-slate-400 font-medium">{isEn ? 'Overview' : 'Vista general'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center my-2">
              <div>
                <span className="text-sm font-black text-slate-800 block">3</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Quotes' : 'Cotizaciones'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-emerald-600 block">2</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Approved' : 'Aprobadas'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-amber-600 block">1</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Earrings' : 'Pendientes'}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setSelectedClient("TODAS")}
            className="flex items-center justify-between w-full pt-2 text-[11px] font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-2 group-hover:underline"
          >
            <span>{isEn ? 'Open all' : 'Abrir todas'}</span>
            <span className="text-xs">➔</span>
          </button>
        </div>

        {/* Tarjeta 2: EJEMPLO 1 */}
        <div className={`relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${selectedClient === 'EJEMPLO 1' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/90'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl"></div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                E1
              </div>
              <div>
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-tight">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'}</h4>
                <p className="text-[11px] text-slate-400 font-medium">{isEn ? 'Customer' : 'Cliente'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center my-2">
              <div>
                <span className="text-sm font-black text-slate-800 block">3</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Quotes' : 'Cotizaciones'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-emerald-600 block">2</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Approved' : 'Aprobadas'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-amber-600 block">1</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Earrings' : 'Pendientes'}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setSelectedClient("EJEMPLO 1")}
            className="flex items-center justify-between w-full pt-2 text-[11px] font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-2 group-hover:underline"
          >
            <span>{isEn ? 'Open client' : 'Abrir cliente'}</span>
            <span className="text-xs">➔</span>
          </button>
        </div>

        {/* Tarjeta 3: GLOBALSANTAFE DRILLING */}
        <div className={`relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${selectedClient === 'GLOBALSANTAFE DRILLING MEXICO' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/90'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl"></div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                GD
              </div>
              <div>
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-tight line-clamp-2 leading-snug">
                {isEn ? 'EXAMPLE 2' : 'EJEMPLO 2'}  
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">{isEn ? 'Customer' : 'Cliente'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center my-2">
              <div>
                <span className="text-sm font-black text-slate-800 block">3</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Quotes' : 'Cotizaciones'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-emerald-600 block">2</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Approved' : 'Aprobadas'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-amber-600 block">1</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Earrings' : 'Pendientes'}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setSelectedClient("EJEMPLO 2")}
            className="flex items-center justify-between w-full pt-2 text-[11px] font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-2 group-hover:underline"
          >
            <span>{isEn ? 'Open client' : 'Abrir cliente'}</span>
            <span className="text-xs">➔</span>
          </button>
        </div>

        {/* Tarjeta 4: HORNBECK OFFSHORE */}
        <div className={`relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${selectedClient === 'HORNBECK OFFSHORE SERVICES' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/90'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl"></div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                HO
              </div>
              <div>
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-tight line-clamp-2 leading-snug">
                {isEn ? 'EXAMPLE 3' : 'EJEMPLO 3'}  
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">{isEn ? 'Customer' : 'Cliente'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center my-2">
              <div>
                <span className="text-sm font-black text-slate-800 block">3</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Quotes' : 'Cotizaciones'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-emerald-600 block">2</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Approved' : 'Aprobadas'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-amber-600 block">1</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Earrings' : 'Pendientes'}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setSelectedClient("EJEMPLO 3")}
            className="flex items-center justify-between w-full pt-2 text-[11px] font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-2 group-hover:underline"
          >
            <span>{isEn ? 'Open client' : 'Abrir cliente'}</span>
            <span className="text-xs">➔</span>
          </button>
        </div>

        {/* Tarjeta 5: SBM OFFSHORE */}
        <div className={`relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${selectedClient === 'SBM OFFSHORE DE MEXICO' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/90'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl"></div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                SO
              </div>
              <div>
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-tight line-clamp-2 leading-snug">
                {isEn ? 'EXAMPLE 5' : 'EJEMPLO 5'}  
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">{isEn ? 'Customer' : 'Cliente'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center my-2">
              <div>
                <span className="text-sm font-black text-slate-800 block">3</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Quotes' : 'Cotizaciones'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-slate-400 block">2</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Approved' : 'Aprobadas'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-amber-600 block">1</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Earrings' : 'Pendientes'}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setSelectedClient("EJEMPLO 5")}
            className="flex items-center justify-between w-full pt-2 text-[11px] font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-2 group-hover:underline"
          >
            <span>{isEn ? 'Open client' : 'Abrir cliente'}</span>
            <span className="text-xs">➔</span>
          </button>
        </div>

        {/* Tarjeta 6: Subsea7 Mexico */}
        <div className={`relative bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group ${selectedClient === 'Subsea7 Mexico' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-slate-200/90'}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-fuchsia-600 to-purple-600 rounded-l-2xl"></div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                SM
              </div>
              <div>
                <h4 className="font-black text-xs text-slate-900 uppercase tracking-tight line-clamp-2 leading-snug">
                {isEn ? 'EXAMPLE 6' : 'EJEMPLO 6'}  
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">{isEn ? 'Customer' : 'Cliente'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center my-2">
              <div>
                <span className="text-sm font-black text-slate-800 block">3</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Quotes' : 'Cotizaciones'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-emerald-600 block">2</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Approved' : 'Aprobadas'}</span>
              </div>
              <div>
                <span className="text-sm font-black text-slate-400 block">1</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isEn ? 'Earrings' : 'Pendientes'}</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => setSelectedClient("EJEMPLO 6")}
            className="flex items-center justify-between w-full pt-2 text-[11px] font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer border-t border-slate-100 mt-2 group-hover:underline"
          >
            <span>{isEn ? 'Open client' : 'Abrir cliente'}</span>
            <span className="text-xs">➔</span>
          </button>
        </div>

      </div>
    </div>

{/* ========================================================================= */}
{/* SECCIÓN INFERIOR: TABLA MATRIZ (SE DESPLIEGA ABAJO AL DAR CLIC)          */}
{/* ========================================================================= */}
{selectedClient && (
  <div className="p-6 bg-slate-100/50 transition-all duration-300 animate-fadeIn">
    
    {/* Banner Superior con título del cliente y botón para cerrar la matriz */}
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
          <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight">
            {selectedClient?.nombre || selectedClient?.empresa || ''}
          </h3>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 font-medium pl-4">
          {selectedClient === "TODAS" ? "Mostrando las 28 cotizaciones registradas" : `Mostrando detalle de cotizaciones para ${selectedClient}`}
        </p>
      </div>
      <button
        onClick={() => setSelectedClient(null)}
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
      >
        <span>✕</span> 
      </button>
    </div>

    {/* Contenedor con Scroll Horizontal de la Tabla Matriz */}
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1500px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
            <th className="p-3.5 pl-4">{isEn ? 'Quotation' : 'Cotización'}</th>
            <th className="p-3.5">{isEn ? 'Rev.' : 'Rev.'}</th>
            <th className="p-3.5">{isEn ? 'Requisition' : 'Requisición'}</th>
            <th className="p-3.5">{isEn ? 'Internal Reference' : 'Referencia Interna'}</th>
            <th className="p-3.5">{isEn ? 'Customer' : 'Cliente'}</th>
            <th className="p-3.5">{isEn ? 'Buyer' : 'Comprador'}</th>
            <th className="p-3.5">{isEn ? 'Reviewed' : 'Revisó'}</th>
            <th className="p-3.5">{isEn ? 'Authorized' : 'Autorizó'}</th>
            <th className="p-3.5">{isEn ? 'Emission' : 'Emisión'}</th>
            <th className="p-3.5">{isEn ? 'Validity' : 'Vigencia'}</th>
            <th className="p-3.5">{isEn ? 'Total' : 'Total'}</th>
            <th className="p-3.5">{isEn ? 'Status' : 'Estatus'}</th>
            <th className="p-3.5">{isEn ? 'Client Decision' : 'Decisión del Cliente'}</th>
            <th className="p-3.5">{isEn ? 'PDF' : 'PDF'}</th>
            <th className="p-3.5 pr-4 text-center">{isEn ? 'Actions' : 'Acciones'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          
          {/* FILA 1 */}
          <tr className="hover:bg-slate-50/80 transition-colors">
            <td className="p-3.5 pl-4 align-middle">
              <div className="font-bold text-slate-900 text-xs">COT-2026-0032-2</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                {isEn ? 'Level 1 · Buyer' : 'Nivel 1 · Comprador'}  
                </span>
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
                  Rev. 0
                </span>
              </div>
            </td>
            <td className="p-3.5 align-middle text-slate-600 font-medium">0</td>
            <td className="p-3.5 align-middle text-slate-700 font-medium">202609-REQ-2026-0001</td>
            <td className="p-3.5 align-middle">
              <span className="inline-block px-2.5 py-1 bg-blue-50/80 text-blue-700 font-bold text-[11px] rounded-full border border-blue-100 shadow-2xs">
                202609-REQ-2026-0001
              </span>
            </td>
            <td className="p-3.5 align-middle">
              <div className="font-bold text-slate-900">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'} </div>
              <div className="text-[10px] text-slate-400 font-medium">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'}</div>
            </td>
            <td className="p-3.5 align-middle">
              <div className="font-bold text-slate-800 uppercase">Juan Vicente Ruiz Hernandez</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase">Supervisor HSE</div>
            </td>
            <td className="p-3.5 align-middle text-slate-400 font-bold">—</td>
            <td className="p-3.5 align-middle text-slate-400 font-bold">—</td>
            <td className="p-3.5 align-middle text-slate-600 font-medium whitespace-nowrap">2026-09-24</td>
            <td className="p-3.5 align-middle text-slate-600 font-medium whitespace-nowrap">2026-10-09</td>
            <td className="p-3.5 align-middle font-black text-slate-900">$7,092.24</td>
            <td className="p-3.5 align-middle">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold text-[11px] rounded-full inline-block">
              {isEn ? 'Approved' : 'Aprobada'}  
              </span>
            </td>
            <td className="p-3.5 align-middle">
              <div className="font-semibold text-slate-800">{isEn ? 'Approved' : 'Aprobada'} </div>
              <div className="text-[10px] text-slate-400">2026-09-24T17:03:12.029Z</div>
            </td>
            <td className="p-3.5 align-middle">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleOpenPdf({
                    folio: 'COT-2026-0032-2',
                    cliente: 'EJEMPLO 1',
                    referencia: '202609-REQ-2026-0001',
                    comprador: 'Juan Vicente Ruiz Hernandez',
                    fecha: '2026-09-24',
                    moneda: 'MXN',
                    totalVigente: '$7,092.24',
                    revisionesCount: 1,
                    proyecto: 'Mantenimiento Correctivo',
                    estatus: 'Aprobada'
                  })}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                >
                {isEn ? 'VIEW PDF' : 'VER PDF'}   
                </button>
              </div>
            </td>
            <td className="p-3.5 pr-4 align-middle">
              <div className="flex items-center justify-end gap-1.5 flex-wrap min-w-[320px]">
                <button 
                  onClick={() => {
                    setSelectedQuoteForModification({
                      folio: 'COT-2026-0032-2',
                      revisionesCount: 1,
                      descripcion: 'UNIVERSAL SHOULDER HOLSTER , LEFT SIDE',
                      cantidad: '1',
                      unidad: 'Each',
                      categoria: 'EPP y seguridad'
                    });
                    setShowModificationModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] rounded-full uppercase tracking-tight shadow-2xs transition-colors cursor-pointer"
                >
                  <span>🔄</span>{isEn ? 'MODIFY FROM REQ.' : 'MODIFICAR DESDE REQ.'} 
                </button>
                <button 
                 onClick={() => setActiveTab(6)}
                 className="px-2.5 py-1 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-full border border-indigo-200 transition-colors cursor-pointer">
                {isEn ? 'EDIT' : 'EDITAR'} 
                </button>
                <button 
                onClick={() => setActiveTab(6)}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] rounded-full uppercase tracking-tight transition-colors cursor-pointer">
               {isEn ? 'NEW REV.' : 'NUEVA REV.'} 
                </button>
                <button 
                  onClick={() => setQuoteToDelete('COT-2026-0032-2')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-full uppercase tracking-tight transition-colors cursor-pointer"
                >
                {isEn ? 'ELIMINATE' : 'ELIMINAR'}  
                </button>
              </div>
            </td>
          </tr>

          {/* FILA 2 */}
          <tr className="hover:bg-slate-50/80 transition-colors">
            <td className="p-3.5 pl-4 align-middle">
              <div className="font-bold text-slate-900 text-xs">COT-2026-0032</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                {isEn ? 'Level 1 · Buyer' : 'Nivel 1 · Comprador'}   
                </span>
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
                  Rev. 0
                </span>
              </div>
            </td>
            <td className="p-3.5 align-middle text-slate-600 font-medium">0</td>
            <td className="p-3.5 align-middle text-slate-700 font-medium">202609-REQ-2026-0001</td>
            <td className="p-3.5 align-middle">
              <span className="inline-block px-2.5 py-1 bg-blue-50/80 text-blue-700 font-bold text-[11px] rounded-full border border-blue-100 shadow-2xs">
                202609-REQ-2026-0001
              </span>
            </td>
            <td className="p-3.5 align-middle">
              <div className="font-bold text-slate-900">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'}</div>
              <div className="text-[10px] text-slate-400 font-medium">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'}</div>
            </td>
            <td className="p-3.5 align-middle">
              <div className="font-bold text-slate-800 uppercase">Juan Vicente Ruiz Hernandez</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase">Supervisor HSE</div>
            </td>
            <td className="p-3.5 align-middle text-slate-400 font-bold">—</td>
            <td className="p-3.5 align-middle text-slate-400 font-bold">—</td>
            <td className="p-3.5 align-middle text-slate-600 font-medium whitespace-nowrap">2026-09-23</td>
            <td className="p-3.5 align-middle text-slate-600 font-medium whitespace-nowrap">2026-10-08</td>
            <td className="p-3.5 align-middle font-black text-slate-900">$7,588.70</td>
            <td className="p-3.5 align-middle">
              <span className="px-3 py-1 bg-sky-100 text-sky-800 font-bold text-[11px] rounded-full inline-block">
              {isEn ? 'Draft' : 'Borrador'}  
              </span>
            </td>
            <td className="p-3.5 align-middle text-slate-500 font-medium">
            {isEn ? 'Earring' : 'Pendiente'}  
            </td>
            <td className="p-3.5 align-middle">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleOpenPdf({
                    folio: 'COT-2026-0032',
                    cliente: 'EJEMPLO 1',
                    referencia: '202609-REQ-2026-0001',
                    comprador: 'Juan Vicente Ruiz Hernandez',
                    fecha: '2026-09-23',
                    moneda: 'MXN',
                    totalVigente: '$7,588.70',
                    revisionesCount: 1,
                    proyecto: 'Suministro de Equipo',
                    estatus: 'Borrador'
                  })}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                >
                  {isEn ? 'VIEW PDF' : 'VER PDF'}
                </button>
              </div>
            </td>
            <td className="p-3.5 pr-4 align-middle">
              <div className="flex items-center justify-end gap-1.5 flex-wrap min-w-[380px]">
                <button 
                  onClick={() => {
                    setSelectedQuoteForModification({
                      folio: 'COT-2026-0032',
                      revisionesCount: 1,
                      descripcion: 'UNIVERSAL SHOULDER HOLSTER , LEFT SIDE',
                      cantidad: '1',
                      unidad: 'Each',
                      categoria: 'EPP y seguridad'
                    });
                    setShowModificationModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] rounded-full uppercase tracking-tight shadow-2xs transition-colors cursor-pointer"
                >
                  <span>🔄</span> {isEn ? 'MODIFY FROM REQ.' : 'MODIFICAR DESDE REQ.'} 
                </button>
                <button 
                onClick={() => setActiveTab(6)}
                className="px-2.5 py-1 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-full border border-indigo-200 transition-colors cursor-pointer">
                {isEn ? 'EDIT' : 'EDITAR'}  
                </button>
                <button 
                onClick={() => setActiveTab(6)}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] rounded-full uppercase tracking-tight transition-colors cursor-pointer">
                {isEn ? 'NEW REV.' : 'NUEVA REV.'}  
                </button>
                <button className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-full uppercase tracking-tight transition-colors cursor-pointer">
                {isEn ? 'VALIDATE BUYER' : 'VALIDAR COMPRADOR'}  
                </button>
                <button 
                  onClick={() => setQuoteToDelete('COT-2026-0032')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-full uppercase tracking-tight transition-colors cursor-pointer"
                >
                {isEn ? 'ELIMINATE' : 'ELIMINAR'}  
                </button>
              </div>
            </td>
          </tr>

          {/* FILA 3 */}
          <tr className="hover:bg-slate-50/80 transition-colors">
            <td className="p-3.5 pl-4 align-middle">
              <div className="font-bold text-slate-900 text-xs">COT-2026-0030</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                {isEn ? 'Level 1 · Buyer' : 'Nivel 1 · Comprador'}  
                </span>
                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
                  Rev. 0
                </span>
              </div>
            </td>
            <td className="p-3.5 align-middle text-slate-600 font-medium">0</td>
            <td className="p-3.5 align-middle text-slate-700 font-medium">SOL-PROV-2026-0001</td>
            <td className="p-3.5 align-middle">
              <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-500 font-bold text-xs rounded-full">
                —
              </span>
            </td>
            <td className="p-3.5 align-middle">
              <div className="font-bold text-slate-900">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'}</div>
              <div className="text-[10px] text-slate-400 font-medium">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'}</div>
            </td>
            <td className="p-3.5 align-middle">
              <div className="font-bold text-slate-800">Juan Vicente Ruiz Hernández</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase">Supervisor HSE</div>
            </td>
            <td className="p-3.5 align-middle text-slate-400 font-bold">—</td>
            <td className="p-3.5 align-middle text-slate-400 font-bold">—</td>
            <td className="p-3.5 align-middle text-slate-600 font-medium whitespace-nowrap">2026-09-07</td>
            <td className="p-3.5 align-middle text-slate-600 font-medium whitespace-nowrap">2026-12-31</td>
            <td className="p-3.5 align-middle font-black text-slate-900">$862.39</td>
            <td className="p-3.5 align-middle">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold text-[11px] rounded-full inline-block">
              {isEn ? 'Approved' : 'Aprobada'}  
              </span>
            </td>
            <td className="p-3.5 align-middle text-slate-500 font-medium">
            {isEn ? 'Earring' : 'Pendiente'}  
            </td>
            <td className="p-3.5 align-middle">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => handleOpenPdf({
                    folio: 'COT-2026-0030',
                    cliente: 'EJEMPLO 1',
                    referencia: 'SOL-PROV-2026-0001',
                    comprador: 'Juan Vicente Ruiz Hernández',
                    fecha: '2026-09-07',
                    moneda: 'MXN',
                    totalVigente: '$862.39',
                    revisionesCount: 1,
                    proyecto: 'Servicios Generales',
                    estatus: 'Aprobada'
                  })}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                >
                {isEn ? 'VIEW PDF' : 'VER PDF'}   
                </button>
              </div>
            </td>
            <td className="p-3.5 pr-4 align-middle">
              <div className="flex items-center justify-end gap-1.5 flex-wrap min-w-[320px]">
                <button 
                  onClick={() => {
                    setSelectedQuoteForModification({
                      folio: 'COT-2026-0030',
                      revisionesCount: 1,
                      descripcion: 'SERVICIO GENERAL DE MANTENIMIENTO',
                      cantidad: '1',
                      unidad: 'Servicio',
                      categoria: 'Servicios'
                    });
                    setShowModificationModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] rounded-full uppercase tracking-tight shadow-2xs transition-colors cursor-pointer"
                >
                  <span>🔄</span> {isEn ? 'MODIFY FROM REQ.' : 'MODIFICAR DESDE REQ.'} 
                </button>
                <button 
                  className="px-2.5 py-1 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-full border border-indigo-200 transition-colors cursor-pointer"
                  onClick={() => setActiveTab(6)}
                >
                  {isEn ? 'EDIT' : 'EDITAR'} 
                </button>
                <button 
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] rounded-full uppercase tracking-tight transition-colors cursor-pointer"
                  onClick={() => setActiveTab(6)}
                >
                  {isEn ? 'NEW REV.' : 'NUEVA REV.'}
                </button>
                <button 
                  onClick={() => setQuoteToDelete('COT-2026-0030')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-full uppercase tracking-tight transition-colors cursor-pointer"
                >
                  {isEn ? 'ELIMINATE' : 'ELIMINAR'} 
                </button>
              </div>
            </td>
          </tr>

        </tbody>
      </table>
    </div>

    {/* MODAL VISTA PREVIA PDF */}
    {showPdfModal && selectedQuoteForPdf && (
      <div id="pdf-modal-overlay" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        
        <style>{`
          @media print {
            body {
              visibility: hidden !important;
              background: white !important;
            }
            #printable-area {
              visibility: visible !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              max-width: none !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              background: white !important;
            }
            #printable-area * {
              visibility: visible !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              size: letter portrait !important;
              margin: 1.5cm !important;
            }
          }
        `}</style>

        <div id="pdf-modal-content" className="w-full max-w-4xl h-[95vh] bg-slate-100 flex flex-col rounded-xl overflow-hidden shadow-2xl relative">
          
          <div className="no-print bg-[#1e4a7a] px-5 py-3 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-white font-bold text-sm">
              {isEn ? 'Preview -' : 'Vista previa -'}   {selectedQuoteForPdf.folio}
              </h2>
            </div>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => window.print()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
              >
              {isEn ? '🖨️ Print PDF' : ' 🖨️ Imprimir PDF'}  
              </button>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
              >
              {isEn ? '✖ Close' : '✖ Cerrar'}   
              </button>
            </div>
          </div>

          <div id="pdf-modal-scroll" className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/50">
            
            <div id="printable-area" className="bg-white w-full max-w-4xl p-8 sm:p-10 shadow-lg text-slate-800 font-sans relative">
              
              {/* Encabezado */}
              <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-6">
                <div className="flex-1">
                  <img src="/image_923273.svg" alt="Grupo Gerez" className="h-14 object-contain" />
                </div>
                <div className="flex-1 text-center">
                  <h1 className="text-2xl font-black text-slate-900 tracking-wide">{isEn ? 'QUOTES' : 'COTIZACIÓN'}</h1>
                  <p className="text-[9px] font-bold text-blue-900 tracking-wider mt-1 uppercase">
                    Commercial Quotation · Propuesta Económica
                  </p>
                </div>
                <div className="flex-1 text-right text-[10px] space-y-0.5 text-slate-700">
                  <p className="text-blue-900 font-bold text-xs mb-1">{selectedQuoteForPdf.folio}</p>
                  <p>{isEn ? 'Revision:' : 'Revisión:'} {selectedQuoteForPdf.revisionesCount ? selectedQuoteForPdf.revisionesCount - 1 : 0}</p>
                  <p>{isEn ? 'Date:' : 'Fecha:'} {selectedQuoteForPdf.fecha || new Date().toISOString().split('T')[0]}</p>
                  <p>{isEn ? 'Valid until: 2026-09-16' : 'Vigencia: 2026-09-16'}</p>
                  <p>{isEn ? 'Currency:' : 'Moneda:'} <span className="font-bold">{selectedQuoteForPdf.moneda || 'MXN'}</span></p>
                </div>
              </div>

              {/* Cotiza / Cliente */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h3 className="text-blue-600 font-bold text-[10px] mb-2 uppercase">{isEn ? 'Quote' : 'Cotiza'}</h3>
                  <p className="font-extrabold text-[11px] text-slate-900 mb-1">GRUPO GEREZ - TRAMITES ADUANALES</p>
                  <p className="text-[10px] text-slate-600">3ra avenida #1007 Col. Anahuac, Tampico Tamps.</p>
                  <p className="text-[10px] text-slate-600">user@grupogerez.com</p>
                  <p className="text-[10px] text-slate-600">8332140041</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h3 className="text-blue-600 font-bold text-[10px] mb-2 uppercase">{isEn ? 'Customer' : 'Cliente'}</h3>
                  <p className="font-extrabold text-[11px] text-slate-900 mb-1 truncate">{selectedQuoteForPdf.cliente}</p>
                  <p className="text-[10px] text-slate-600">{isEn ? 'Contact: Purchasing Department' : 'Contacto: Departamento de Compras'}</p>
                  <p className="text-[10px] text-slate-600">{isEn ? 'Email: compras@cliente.com' : 'Email: compras@cliente.com'}</p>
                  <p className="text-[10px] text-slate-600 truncate">{isEn ? 'Project:' : 'Proyecto:'} {selectedQuoteForPdf.proyecto || 'N/A'}</p>
                  <p className="text-[10px] text-slate-600">{isEn ? 'Reference:' : 'Referencia:'} {selectedQuoteForPdf.referencia}</p>
                </div>
              </div>

              {/* Separador */}
              <div className="bg-slate-100 text-center py-2 mb-4 text-[10px] font-bold tracking-[0.4em] text-slate-700 rounded-sm">
                T H I R D  P A R T Y  P A Y M E N T
              </div>

              {/* Tabla */}
              <div className="w-full mb-8 border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1a2b3c] text-white text-[10px] uppercase">
                      <th className="py-2.5 px-3 font-bold w-12 text-center">Item</th>
                      <th className="py-2.5 px-3 font-bold">Description</th>
                      <th className="py-2.5 px-3 font-bold text-center">Brand / Model</th>
                      <th className="py-2.5 px-3 font-bold text-center">Qty</th>
                      <th className="py-2.5 px-3 font-bold text-center">Unit</th>
                      <th className="py-2.5 px-3 font-bold text-right">Unit Price</th>
                      <th className="py-2.5 px-3 font-bold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] text-slate-800">
                    <tr className="border-b border-slate-200">
                      <td className="py-3 px-3 font-black text-center">1</td>
                      <td className="py-3 px-3">{isEn ? 'General scope -' : 'Alcance general -'} {selectedQuoteForPdf.proyecto || 'Servicio'}</td>
                      <td className="py-3 px-3 text-center">—</td>
                      <td className="py-3 px-3 text-center">1</td>
                      <td className="py-3 px-3 text-center">SRV</td>
                      <td className="py-3 px-3 text-right">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente}</td>
                      <td className="py-3 px-3 text-right font-black">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Condiciones y Totales */}
              <div className="grid grid-cols-12 gap-8 mb-12">
                
                <div className="col-span-7 grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Place and time of delivery' : 'Lugar y tiempo de entrega'}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'To be confirmed' : 'Por confirmar'}</p>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Terms of payment' : 'Condiciones de pago'}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'To be confirmed' : 'Por confirmar'}</p>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Warranty' : 'Garantía'}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'Not indicated' : 'No indicada'}</p>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Scope included' : 'Alcance incluido'}</p>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">{isEn ? 'In accordance with the items described.' : 'Conforme a las partidas descritas.'}</p>
                  </div>
                  <div className="col-span-2 bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Additional Notes' : 'Notas Adicionales'}</p>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">{isEn ? 'Prices are in the indicated currency. Validity is subject to availability.' : 'Precios expresados en la moneda indicada. Vigencia sujeta a disponibilidad.'}</p>
                  </div>
                </div>

                <div className="col-span-5 space-y-3 text-[11px]">
                  <div className="flex justify-between py-1.5 border-b border-slate-200">
                    <span className="font-bold text-slate-700">SUBTOTAL GENERAL</span>
                    <span className="font-bold text-slate-900">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200">
                    <span className="font-bold text-slate-700">IVA GENERAL (16%)</span>
                    <span className="font-bold text-slate-900">{selectedQuoteForPdf.moneda} TBD</span>
                  </div>
                  <div className="flex justify-between items-center py-4 px-4 bg-slate-50 border border-slate-300 rounded-lg mt-4">
                    <span className="font-black text-[13px] text-slate-900">TOTAL GENERAL</span>
                    <span className="font-black text-[14px] text-blue-700">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente}</span>
                  </div>
                </div>
              </div>

              {/* Firmas */}
              <div className="grid grid-cols-3 gap-8 text-center mt-16 mb-6">
                <div>
                  <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'BUYER' : 'COMPRADOR'}</p>
                  <div className="border-t border-slate-400 pt-2 mx-4">
                    <p className="font-black text-[10px] text-slate-900 mt-1">{selectedQuoteForPdf.comprador || 'NOMBRE'}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'HSE Supervisor' : 'Supervisor HSE'}</p>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'REVIEWED BY' : 'REVISÓ'}</p>
                  <div className="border-t border-slate-400 pt-2 mx-4">
                    <p className="font-black text-[10px] text-slate-900 mt-1">{isEn ? 'NAME' : 'NOMBRE'}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'Position' : 'Puesto'}</p>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'AUTHORIZED' : 'AUTORIZÓ'}</p>
                  <div className="border-t border-slate-400 pt-2 mx-4">
                    <p className="font-black text-[10px] text-slate-900 mt-1">{isEn ? 'NAME' : 'NOMBRE'}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'Position' : 'Puesto'}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[9px] text-slate-400 mt-10 pt-4 border-t border-slate-100">
                <p>• user@grupogerez.com · 8332140041 •</p>
                <p className="mt-0.5">{isEn ? 'This quote does not constitute an invoice. Prices and availability are subject to the specified validity period.' : 'Esta cotización no constituye una factura. Precios y disponibilidad sujetos a la vigencia indicada.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* MODAL SOLICITAR MODIFICACIÓN CONTROLADA DE REQUISICIÓN */}
    {showModificationModal && selectedQuoteForModification && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 font-sans">
        <div className="w-full max-w-[1200px] h-[95vh] bg-slate-50 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* Header Modal */}
          <div className="bg-gradient-to-r from-[#2B4B9A] to-[#8C3AAA] px-6 py-4 flex justify-between items-start shrink-0">
            <div>
              <h2 className="text-white font-black text-lg flex items-center gap-2">
                <span className="text-xl">🔁</span> {isEn ? 'Controlled requisition modification' : 'Modificación controlada de requisición'} 
              </h2>
            </div>
            <button 
              onClick={() => setShowModificationModal(false)}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer border border-white/30 backdrop-blur-md"
            >
            {isEn ? '✕ Close' : '✕ Cerrar'}  
            </button>
          </div>

          {/* Body Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Sección 1. Datos del cambio */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-800">{isEn ? '1. Change details' : '1. Datos del cambio'}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{isEn ? 'Record who is requesting the change and the evidence supporting the modification.' : 'Registra quién solicita el cambio y la evidencia que respalda la modificación.'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Exchange slip' : 'Folio de cambio'}</label>
                  <input 
                    type="text" 
                    disabled 
                    value={selectedQuoteForModification.folio || "COT-2026-0032"} 
                    className="bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded p-2 outline-none cursor-not-allowed" 
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Current revision → new' : 'Revisión actual → nueva'}</label>
                  <input 
                    type="text" 
                    disabled 
                    value={`Rev. ${(selectedQuoteForModification.revisionesCount || 1) - 1} → Rev. ${selectedQuoteForModification.revisionesCount || 1}`} 
                    className="bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded p-2 outline-none cursor-not-allowed" 
                  />
                </div>
                <div className="flex flex-col relative">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Date of change *' : 'Fecha del cambio *'}</label>
                  <input 
                    type="date" 
                    defaultValue={new Date().toISOString().split('T')[0]} 
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Requested by *' : 'Solicitado por *'}</label>
                  <input 
                    type="text" 
                    placeholder="Sin Change Request" 
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Origin *' : 'Origen *'}</label>
                  <select className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-bold">
                    <option>{isEn ? 'Client email' : 'Correo del cliente'}</option>
                    <option>{isEn ? 'Clients Modified PO/OC' : 'PO/OC Modificada del cliente'}</option>
                    <option>{isEn ? 'Revised service order' : 'Revised service order'}</option>
                    <option>{isEn ? 'Client Portal' : 'Portal del cliente'}</option>
                    <option>{isEn ? 'Minutes' : 'Minuta'}</option>
                    <option>{isEn ? 'Call confirmed in writing' : 'Llamada confirmada por escrito'}</option>
                    <option>{isEn ? 'Other' : 'Otro'}</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Main type *' : 'Tipo principal *'}</label>
                  <select className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs font-bold">
                    <option>{isEn ? 'Change in quantity' : 'Cambio de cantidad'}</option>
                    <option>{isEn ? 'Deletion of item' : 'Eliminación de partida'}</option>
                    <option>{isEn ? 'Add item' : 'Agregar partida'}</option>
                    <option>{isEn ? 'Specification change' : 'Cambio de especificación'}</option>
                    <option>{isEn ? 'Change of required date' : 'Cambio de fecha requerida'}</option>
                    <option>{isEn ? 'Change of delivery location' : 'Cambio de lugar de entrega'}</option>
                    <option>{isEn ? 'Change in scope' : 'Cambio de alcance'}</option>
                    <option>{isEn ? 'Other' : 'Otro'}</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Reference / document' : 'Referencia / documento'}</label>
                  <input 
                    type="text" 
                    placeholder="Correo, PO cliente, SO, minuta, folio..." 
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400" 
                  />
                </div>
              </div>

              <div className="flex flex-col mb-4">
                <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Client reason / instruction *' : 'Motivo / instrucción del cliente *'}</label>
                <textarea 
                  rows="3" 
                  placeholder="Describe exactamente lo autorizado originalmente y lo que el cliente solicita modificar." 
                  className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Evidence' : 'Evidencia'}</label>
                  <div className="flex border border-slate-300 rounded overflow-hidden relative">
                    <input 
                      type="file" 
                      id="evidence-upload" 
                      className="hidden" 
                      onChange={(e) => setEvidenceFileName(e.target.files[0]?.name || null)}
                    />
                    <label 
                      htmlFor="evidence-upload" 
                      className="bg-slate-100 px-3 py-2 text-xs text-slate-700 border-r border-slate-300 hover:bg-slate-200 transition-colors cursor-pointer m-0 whitespace-nowrap"
                    >
                    {isEn ? 'Choose file' : 'Elegir archivo'}  
                    </label>
                    <span className="px-3 py-2 text-xs text-slate-500 bg-white flex-1 truncate">
                      {evidenceFileName ? evidenceFileName : "No se ha seleccionado ningún archivo"}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1">
                    {evidenceFileName ? "Evidencia adjunta." : "Sin evidencia adjunta."}
                  </span>
                </div>

                <div className="flex flex-col relative">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Revised required date' : 'Fecha requerida revisada'}</label>
                  <input 
                    type="date" 
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Delivery location verified' : 'Lugar de entrega revisado'}</label>
                  <input 
                    type="text" 
                    placeholder="ESEASA" 
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
              </div>
            </div>

            {/* Sección 2. Partidas antes y después */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
              <div className="mb-4">
                <h3 className="text-sm font-black text-slate-800">{isEn ? '2. Before-and-after items' : '2. Partidas antes y después'}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">{isEn ? 'Cancelled line items are not deleted; they remain in the history of the previous revision and in the change log.' : 'Las partidas canceladas no se borran; quedan en el historial de la revisión anterior y en el registro del cambio.'}</p>
              </div>

              {/* Tabla Header */}
              <div className="bg-[#f0f4f8] rounded-t-lg border border-slate-200 border-b-0 px-4 py-2 flex text-[9px] font-bold text-[#1e4a7a] uppercase tracking-wider">
                <div className="w-[20%]">{isEn ? 'DEPARTURE' : 'PARTIDA'}</div>
                <div className="w-[25%]">{isEn ? 'NEW DESCRIPTION / SPECIFICATION' : 'DESCRIPCIÓN / ESPECIFICACIÓN NUEVA'}</div>
                <div className="w-[10%] text-center">{isEn ? 'ORIGINAL QTY.' : 'CANT. ORIGINAL'}</div>
                <div className="w-[10%] text-center">{isEn ? 'NEW QTY.' : 'CANT. NUEVA'}</div>
                <div className="w-[10%] text-center">{isEn ? 'UNIT' : 'UNIDAD'}</div>
                <div className="w-[10%] text-center">{isEn ? 'CATEGORY' : 'CATEGORÍA'}</div>
                <div className="w-[10%] text-center">{isEn ? 'ACTION' : 'ACCIÓN'}</div>
                <div className="w-[5%] text-center">{isEn ? 'RESULT' : 'RESULTADO'}</div>
              </div>

              {/* Fila dinámicas */}
              <div className="border border-slate-200 p-3 flex items-center gap-3 bg-white">
                <div className="w-[20%]">
                  <p className="text-[10px] font-black text-slate-900 leading-tight">
                    {selectedQuoteForModification.descripcion || "UNIVERSAL SHOULDER HOLSTER , LEFT SIDE"}
                  </p>
                </div>
                <div className="w-[25%]">
                  <input 
                    type="text" 
                    defaultValue={selectedQuoteForModification.descripcion || "UNIVERSAL SHOULDER HOLSTER , LEFT SIDE"} 
                    className="w-full bg-white border border-slate-300 text-slate-600 text-[10px] rounded p-1.5 outline-none focus:border-blue-500" 
                  />
                </div>
                <div className="w-[10%]">
                  <input 
                    type="text" 
                    disabled 
                    defaultValue={selectedQuoteForModification.cantidad || "1"} 
                    className="w-full bg-slate-100 border border-slate-300 text-slate-500 text-[10px] text-center rounded p-1.5 outline-none" 
                  />
                </div>
                <div className="w-[10%]">
                  <input 
                    type="text" 
                    defaultValue={selectedQuoteForModification.cantidad || "1"} 
                    className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] text-center rounded p-1.5 outline-none focus:border-blue-500" 
                  />
                </div>
                <div className="w-[10%]">
                  <input 
                    type="text" 
                    defaultValue={selectedQuoteForModification.unidad || "Each"} 
                    className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] text-center rounded p-1.5 outline-none focus:border-blue-500" 
                  />
                </div>
                <div className="w-[10%]">
                  <input 
                    type="text" 
                    defaultValue={selectedQuoteForModification.categoria || "EPP y seguridad"} 
                    className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] text-center rounded p-1.5 outline-none focus:border-blue-500" 
                  />
                </div>
                <div className="w-[10%]">
                  <select className="w-full bg-white border border-slate-300 text-slate-800 text-[10px] rounded p-1.5 outline-none focus:border-blue-500 cursor-pointer text-center">
                    <option>{isEn ? 'Keep' : 'Mantener'}</option>
                    <option>{isEn ? 'Modify' : 'Modificar'}</option>
                    <option>{isEn ? 'Cancel' : 'Cancelar'}</option>
                  </select>
                </div>
                <div className="w-[5%] flex justify-center">
                  <span className="text-[9px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded">{isEn ? 'No change' : 'Sin cambio'}</span>
                </div>
              </div>

              {/* Formulario: Agregar nueva partida */}
              <div className="border border-slate-200 border-t-0 rounded-b-lg p-4 bg-[#fafbfc] space-y-3">
                <p className="text-[10px] font-bold text-slate-700">{isEn ? '+ Add new entry' : '+ Agregar nueva partida'}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input type="text" placeholder="Descripción / especificación" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                  </div>
                  <div className="w-40">
                    <input type="text" placeholder="Cantidad" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                  </div>
                  <div className="w-40">
                    <input type="text" placeholder="Unidad" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input type="text" placeholder="Categoría" className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 placeholder:text-slate-400" />
                  </div>
                  <div className="w-[332px]">
                    <button className="w-full bg-[#18bda8] hover:bg-[#139c8a] text-white font-bold text-xs py-2 px-4 rounded transition-colors shadow-sm cursor-pointer">
                    {isEn ? '+ Add item' : '+ Agregar partida'}  
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Acciones de pie de página del modal */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowModificationModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
              {isEn ? 'Cancel' : 'Cancelar'}  
              </button>
              <button
                onClick={() => {
                  setShowModificationModal(false);
                }}
                className="px-4 py-2 bg-[#2B4B9A] hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-md transition-colors cursor-pointer"
              >
              {isEn ? 'Save Changes' : 'Guardar Modificación'}  
              </button>
            </div>

          </div>
        </div>
      </div>
    )}

    {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN */}
    {quoteToDelete && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
          <div className="flex items-center gap-3 text-rose-600">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-lg font-black shrink-0">
              ⚠️
            </div>
            <div>
              <h3 className="font-black text-rose-900 text-base items-center">{isEn ? 'Delete record · administrator-only permission' : 'Eliminar registro · permiso exclusivo de administrador'}</h3>
            </div>
          </div>
          
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Enter the exact reference number to confirm.' : 'Escribe exactamente el folio para confirmar'}</label>
                  <input 
                    type="text" 
                    placeholder="Folio exacto" 
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Administrator password' : 'Contraseña de administrador'}</label>
                  <input 
                    type="password" 
                    placeholder="Confirma tu contraseña" 
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                  />
                </div>


          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setQuoteToDelete(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
            {isEn ? 'Cancel' : 'Cancelar'}  
            </button>
            <button
              onClick={confirmDeleteQuote}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
            >
            {isEn ? 'Yes, Delete' : 'Sí, Eliminar'}    
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
  </div>
)}

{/* TARJETA 9: Decisión del cliente */}
{activeTab === 9 && (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-left space-y-6">
    
    {/* 1. Encabezado Principal */}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{isEn ? 'Client approval control' : 'Control de aprobación del cliente'}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
        {isEn ? 'Track the internal authorization, submission, client response, and revisions.' : 'Da seguimiento a la autorización interna, envío, respuesta del cliente y revisiones.'}  
        </p>
      </div>
      <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-full border border-blue-100/80 shrink-0 self-start md:self-auto">
      {isEn ? 'Commercial traceability' : 'Trazabilidad comercial'}  
      </span>
    </div>

    {/* 2. Tarjetas KPI de Estado */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 border-t-4 border-t-indigo-600 shadow-2xs">
        <div className="text-2xl font-black text-slate-900">{clientApprovalStats?.preparacionInterna || 0}</div>
        <div className="text-xs font-medium text-slate-500 mt-1">{isEn ? 'Internal preparation' : 'Preparación interna'}</div>
        <div className="text-[11px] font-bold text-indigo-600 mt-0.5">{isEn ? 'Draft / revision' : 'Borrador / revisión'}</div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-4 border-t-4 border-t-blue-600 shadow-2xs">
        <div className="text-2xl font-black text-slate-900">{clientApprovalStats?.pendientesCliente || 0}</div>
        <div className="text-xs font-medium text-slate-500 mt-1">{isEn ? 'Attentive to the client' : 'Pendientes del cliente'}</div>
        <div className="text-[11px] font-bold text-blue-600 mt-0.5">{isEn ? 'Sent, with no response' : 'Enviadas sin respuesta'}</div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-4 border-t-4 border-t-emerald-500 shadow-2xs">
        <div className="text-2xl font-black text-slate-900">{clientApprovalStats?.aprobadas || 0}</div>
        <div className="text-xs font-medium text-slate-500 mt-1">{isEn ? 'Approved' : 'Aprobadas'}</div>
        <div className="text-[11px] font-bold text-emerald-600 mt-0.5">{isEn ? 'Purchasing is now enabled' : 'Habilitan la compra'}</div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-4 border-t-4 border-t-amber-500 shadow-2xs">
        <div className="text-2xl font-black text-slate-900">{clientApprovalStats?.modificacion || 0}</div>
        <div className="text-xs font-medium text-slate-500 mt-1">{isEn ? 'Modification' : 'Modificación'}</div>
        <div className="text-[11px] font-bold text-amber-600 mt-0.5">{isEn ? 'They require a new review' : 'Requieren nueva revisión'}</div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl p-4 border-t-4 border-t-rose-500 shadow-2xs">
        <div className="text-2xl font-black text-slate-900">{clientApprovalStats?.rechazadas || 0}</div>
        <div className="text-xs font-medium text-slate-500 mt-1">{isEn ? 'Rejected' : 'Rechazadas'}</div>
        <div className="text-[11px] font-bold text-rose-600 mt-0.5">{isEn ? 'Unauthorized' : 'No autorizadas'}</div>
      </div>
    </div>

    {/* 3. GRID DE TARJETAS DE CLIENTES */}
    <div className="space-y-3 pt-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{isEn ? 'Decisions and client approval' : 'Decisiones y aprobación por cliente'}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
          {isEn ? 'Select a client to review their pending quotes, messages, revisions, and decisions.' : 'Selecciona un cliente para revisar sus cotizaciones pendientes, mensajes, revisiones y decisiones.'}  
          </p>
        </div>
        <span className="px-3 py-1 bg-purple-50 text-purple-700 font-bold text-xs rounded-full border border-purple-100 shrink-0 self-start sm:self-auto">
        {isEn ? '3 registered customer(s)' : '3 cliente(s) registrados'}  
        </span>
      </div>

      {/* Grid de Tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Tarjeta 1: Todos los clientes */}
        <div 
          onClick={() => setSelectedClient({ id: 'ALL', nombre: 'Todos los clientes', cotizacionesPendientes: approvalQuotesList.length })}
          className={`bg-white border rounded-xl p-3.5 shadow-2xs border-l-4 border-l-purple-600 cursor-pointer transition-all ${
            selectedClient?.id === 'ALL' ? 'ring-2 ring-purple-500 border-purple-300' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white text-xs font-black shrink-0">
              TOD
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900 text-xs truncate">{isEn ? 'All customers' : 'Todos los clientes'}</h4>
              <p className="text-[10px] text-slate-400 truncate">{isEn ? 'Consolidated view' : 'Vista consolidada'}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-50/80 rounded-lg p-2 text-center my-3 border border-slate-100">
            <div>
              <div className="text-xs font-black text-slate-900">{approvalQuotesList.length}</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">Total</div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">
                {approvalQuotesList.filter(q => q.statusText?.includes('Enviada')).length}
              </div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Sent' : 'Enviadas'}</div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">
                {approvalQuotesList.filter(q => q.statusText?.includes('modificación')).length}
              </div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Modify' : 'Modificar'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedClient({ id: 'ALL', nombre: 'Todos los clientes', cotizacionesPendientes: approvalQuotesList.length });
              }}
              className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer"
            >
            {isEn ? 'See all →' : 'Ver todas →'}  
            </button>
          </div>
        </div>

        {/* Tarjeta 2: EJEMPLO 1 */}
        <div 
          onClick={() => setSelectedClient({ id: 'E1', nombre: 'EJEMPLO 1', cotizacionesPendientes: 2 })}
          className={`bg-white border rounded-xl p-3.5 shadow-2xs border-l-4 border-l-blue-600 cursor-pointer transition-all ${
            selectedClient?.id === 'E1' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
              E1
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900 text-xs truncate">{isEn ? 'EXAMPLE 1' : 'EJEMPLO 1'}</h4>
              <p className="text-[10px] text-slate-400 truncate">SBM Offshore</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-50/80 rounded-lg p-2 text-center my-3 border border-slate-100">
            <div>
              <div className="text-xs font-black text-slate-900">2</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Earrings' : 'Pendientes'}</div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">0</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Unanswered' : 'Sin respuesta'}</div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">0</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Modify' : 'Modificar'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedClient({ id: 'E1', nombre: 'EJEMPLO 1', cotizacionesPendientes: 2 });
              }}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
            >
            {isEn ? '2 quote(s) →' : '2 cotización(es) →'}  
            </button>
          </div>
        </div>

        {/* Tarjeta 3: EJEMPLO 2 */}
        <div 
          onClick={() => setSelectedClient({ id: 'E2', nombre: 'EJEMPLO 2, S.A. DE C.V.', cotizacionesPendientes: 2 })}
          className={`bg-white border rounded-xl p-3.5 shadow-2xs border-l-4 border-l-blue-600 cursor-pointer transition-all ${
            selectedClient?.id === 'E2' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white text-xs font-black shrink-0">
              E2
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900 text-xs truncate">{isEn ? 'EXAMPLE 2, S.A. DE C.V.' : 'EJEMPLO 2, S.A. DE C.V.'}</h4>
              <p className="text-[10px] text-slate-400 truncate">GlobalSantaFe</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-50/80 rounded-lg p-2 text-center my-3 border border-slate-100">
            <div>
              <div className="text-xs font-black text-slate-900">2</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Earrings' : 'Pendientes'} </div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">1</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Unanswered' : 'Sin respuesta'}</div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">0</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Modify' : 'Modificar'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedClient({ id: 'E2', nombre: 'EJEMPLO 2, S.A. DE C.V.', cotizacionesPendientes: 2 });
              }}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
            >
            {isEn ? '2 quote(s) →' : '2 cotización(es) →'}  
            </button>
          </div>
        </div>

        {/* Tarjeta 4: EJEMPLO 3 */}
        <div 
          onClick={() => setSelectedClient({ id: 'E3', nombre: 'EJEMPLO 3, S.A. DE C.V.', cotizacionesPendientes: 1 })}
          className={`bg-white border rounded-xl p-3.5 shadow-2xs border-l-4 border-l-blue-600 cursor-pointer transition-all ${
            selectedClient?.id === 'E3' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
              E3
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900 text-xs truncate">{isEn ? 'EXAMPLE 2, S.A. DE C.V.' : 'EJEMPLO 2, S.A. DE C.V.'}</h4>
              <p className="text-[10px] text-slate-400 truncate">Woodside Petroleo</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-50/80 rounded-lg p-2 text-center my-3 border border-slate-100">
            <div>
              <div className="text-xs font-black text-slate-900">1</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Earrings' : 'Pendientes'}</div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">0</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Unanswered' : 'Sin respuesta'}</div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">0</div>
              <div className="text-[9px] text-slate-500 font-medium mt-0.5">{isEn ? 'Modify' : 'Modificar'}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedClient({ id: 'E3', nombre: 'EJEMPLO 3, S.A. DE C.V.', cotizacionesPendientes: 1 });
              }}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              {isEn ? '1 quote(s) →' : '1 cotización(es) →'}
            </button>
          </div>
        </div>

      </div>
    </div>

    {/* 4. LISTA DE COTIZACIONES (SÓLO SE DESPLIEGA CUANDO HAY UN CLIENTE SELECCIONADO) */}
    {selectedClient && (
      <div className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 space-y-4 transition-all duration-300">
        
        {/* Banner del cliente seleccionado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div>
            <h4 className="font-bold text-slate-900 text-sm tracking-tight">
              {selectedClient.nombre}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
            {isEn ? 'Reviewing quotes for the selected client' : 'Revisando cotizaciones del cliente seleccionado'}  
            </p>
          </div>
          
          <button 
            type="button"
            onClick={() => setSelectedClient(null)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
          >
            ✕ 
          </button>
        </div>

        {/* Tarjetas de cotizaciones filtradas */}
        <div className="space-y-3">
          {approvalQuotesList
            .filter(item => selectedClient.id === 'ALL' || item.cliente === selectedClient.nombre)
            .map((item) => (
              <div 
                key={item.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 hover:border-slate-300 transition-all text-left"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm tracking-tight">
                      {item.id} · Rev. {item.revision}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold text-slate-700">{item.cliente}</span> · Referencia: {item.referencia} · <span className="font-bold text-slate-800">{item.moneda} ${item.monto}</span>
                    </p>
                  </div>
                  
                  <div className="self-start sm:self-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${item.statusBadgeColor}`}>
                      {item.statusText}
                    </span>
                  </div>
                </div>

                {/* Acciones y Decisiones */}
                <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                  
                  {/* Navegación básica */}
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={() => setActiveTab(6)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    >
                    {isEn ? 'Edit' : 'Editar'}   
                    </button>
                    
                    {/* BOTÓN VER PDF CON MODAL */}
                    <button 
                      type="button" 
                      onClick={() => handleOpenPdf(item)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-xl border border-blue-200 transition-colors cursor-pointer"
                    >
                    {isEn ? 'View PDF' : 'Ver PDF'}   
                    </button>
                  </div>

                </div>
              </div>
            ))}
        </div>
      </div>
    )}

    {/* MODAL VISTA PREVIA PDF */}
    {showPdfModal && selectedQuoteForPdf && (
      <div id="pdf-modal-overlay" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        
        <style>{`
          @media print {
            body {
              visibility: hidden !important;
              background: white !important;
            }
            #printable-area {
              visibility: visible !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              max-width: none !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              background: white !important;
            }
            #printable-area * {
              visibility: visible !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              size: letter portrait !important;
              margin: 1.5cm !important;
            }
          }
        `}</style>

        <div id="pdf-modal-content" className="w-full max-w-4xl h-[95vh] bg-slate-100 flex flex-col rounded-xl overflow-hidden shadow-2xl relative">
          
          <div className="no-print bg-[#1e4a7a] px-5 py-3 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-white font-bold text-sm">
              {isEn ? 'Preview -' : 'Vista previa -'}   {selectedQuoteForPdf.folio || selectedQuoteForPdf.id}
              </h2>
            </div>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => window.print()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
              >
              {isEn ? '🖨️ Print PDF' : '🖨️ Imprimir PDF'}  
              </button>
              <button 
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
              >
              {isEn ? '✖ Close' : '✖ Cerrar'}  
              </button>
            </div>
          </div>

          <div id="pdf-modal-scroll" className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/50">
            
            <div id="printable-area" className="bg-white w-full max-w-4xl p-8 sm:p-10 shadow-lg text-slate-800 font-sans relative">
              
              {/* Encabezado */}
              <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-6">
                <div className="flex-1">
                  <img src="/image_923273.svg" alt="Grupo Gerez" className="h-14 object-contain" />
                </div>
                <div className="flex-1 text-center">
                  <h1 className="text-2xl font-black text-slate-900 tracking-wide">{isEn ? 'QUOTE' : 'COTIZACIÓN'}</h1>
                  <p className="text-[9px] font-bold text-blue-900 tracking-wider mt-1 uppercase">
                    Commercial Quotation · Propuesta Económica
                  </p>
                </div>
                <div className="flex-1 text-right text-[10px] space-y-0.5 text-slate-700">
                  <p className="text-blue-900 font-bold text-xs mb-1">{selectedQuoteForPdf.folio || selectedQuoteForPdf.id}</p>
                  <p>{isEn ? 'Revision:' : 'Revisión:'} {selectedQuoteForPdf.revision || (selectedQuoteForPdf.revisionesCount ? selectedQuoteForPdf.revisionesCount - 1 : 0)}</p>
                  <p>{isEn ? 'Date:' : 'Fecha:'} {selectedQuoteForPdf.fecha || new Date().toISOString().split('T')[0]}</p>
                  <p>{isEn ? 'Valid until: 2026-09-16' : 'Vigencia: 2026-09-16'}</p>
                  <p>{isEn ? 'Currency:' : 'Moneda:'} <span className="font-bold">{selectedQuoteForPdf.moneda || 'MXN'}</span></p>
                </div>
              </div>

              {/* Cotiza / Cliente */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h3 className="text-blue-600 font-bold text-[10px] mb-2 uppercase">{isEn ? 'Quote' : 'Cotiza'}</h3>
                  <p className="font-extrabold text-[11px] text-slate-900 mb-1">GRUPO GEREZ TRAMITES ADUANALES</p>
                  <p className="text-[10px] text-slate-600">3ra avenida #1007 Col. Anahuac, Tampico Tamps.</p>
                  <p className="text-[10px] text-slate-600">user@grupogerez.com</p>
                  <p className="text-[10px] text-slate-600">8332140041</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h3 className="text-blue-600 font-bold text-[10px] mb-2 uppercase">{isEn ? 'Customer' : 'Cliente'}</h3>
                  <p className="font-extrabold text-[11px] text-slate-900 mb-1 truncate">{selectedQuoteForPdf.cliente}</p>
                  <p className="text-[10px] text-slate-600">{isEn ? 'Contact: Purchasing Department' : 'Contacto: Departamento de Compras'}</p>
                  <p className="text-[10px] text-slate-600">{isEn ? 'Email: compras@cliente.com' : 'Email: compras@cliente.com'}</p>
                  <p className="text-[10px] text-slate-600 truncate">{isEn ? 'Project:' : 'Proyecto:'} {selectedQuoteForPdf.proyecto || 'N/A'}</p>
                  <p className="text-[10px] text-slate-600">{isEn ? 'Reference:' : 'Referencia:'} {selectedQuoteForPdf.referencia}</p>
                </div>
              </div>

              {/* Separador */}
              <div className="bg-slate-100 text-center py-2 mb-4 text-[10px] font-bold tracking-[0.4em] text-slate-700 rounded-sm">
                T H I R D  P A R T Y  P A Y M E N T
              </div>

              {/* Tabla */}
              <div className="w-full mb-8 border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1a2b3c] text-white text-[10px] uppercase">
                      <th className="py-2.5 px-3 font-bold w-12 text-center">Item</th>
                      <th className="py-2.5 px-3 font-bold">Description</th>
                      <th className="py-2.5 px-3 font-bold text-center">Brand / Model</th>
                      <th className="py-2.5 px-3 font-bold text-center">Qty</th>
                      <th className="py-2.5 px-3 font-bold text-center">Unit</th>
                      <th className="py-2.5 px-3 font-bold text-right">Unit Price</th>
                      <th className="py-2.5 px-3 font-bold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] text-slate-800">
                    <tr className="border-b border-slate-200">
                      <td className="py-3 px-3 font-black text-center">1</td>
                      <td className="py-3 px-3">{isEn ? 'General scope -' : 'Alcance general -'} {selectedQuoteForPdf.proyecto || 'Servicio'}</td>
                      <td className="py-3 px-3 text-center">—</td>
                      <td className="py-3 px-3 text-center">1</td>
                      <td className="py-3 px-3 text-center">SRV</td>
                      <td className="py-3 px-3 text-right">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</td>
                      <td className="py-3 px-3 text-right font-black">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Condiciones y Totales */}
              <div className="grid grid-cols-12 gap-8 mb-12">
                
                <div className="col-span-7 grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Place and time of delivery' : 'Lugar y tiempo de entrega'}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'To be confirmed' : 'Por confirmar'}</p>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Terms of payment' : 'Condiciones de pago'}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'To be confirmed' : 'Por confirmar'}</p>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Warranty' : 'Garantía'}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{isEn ? 'Not indicated' : 'No indicada'}</p>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Scope included' : 'Alcance incluido'}</p>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">{isEn ? 'In accordance with the items described.' : 'Conforme a las partidas descritas.'}</p>
                  </div>
                  <div className="col-span-2 bg-slate-50/50 border border-slate-100 border-l-4 border-l-blue-600 p-3 rounded-r-md">
                    <p className="font-bold text-[10px] text-slate-900">{isEn ? 'Additional Notes' : 'Notas Adicionales'}</p>
                    <p className="text-[10px] text-slate-600 mt-1 leading-tight">{isEn ? 'Prices are in the indicated currency. Validity is subject to availability.' : 'Precios expresados en la moneda indicada. Vigencia sujeta a disponibilidad.'}</p>
                  </div>
                </div>

                <div className="col-span-5 space-y-3 text-[11px]">
                  <div className="flex justify-between py-1.5 border-b border-slate-200">
                    <span className="font-bold text-slate-700">SUBTOTAL GENERAL</span>
                    <span className="font-bold text-slate-900">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200">
                    <span className="font-bold text-slate-700">IVA GENERAL (16%)</span>
                    <span className="font-bold text-slate-900">{selectedQuoteForPdf.moneda} TBD</span>
                  </div>
                  <div className="flex justify-between items-center py-4 px-4 bg-slate-50 border border-slate-300 rounded-lg mt-4">
                    <span className="font-black text-[13px] text-slate-900">TOTAL GENERAL</span>
                    <span className="font-black text-[14px] text-blue-700">{selectedQuoteForPdf.moneda} {selectedQuoteForPdf.totalVigente || selectedQuoteForPdf.monto}</span>
                  </div>
                </div>
              </div>

              {/* Firmas */}
              <div className="grid grid-cols-3 gap-8 text-center mt-16 mb-6">
                <div>
                  <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'BUYER' : 'COMPRADOR'}</p>
                  <div className="border-t border-slate-400 pt-2 mx-4">
                    <p className="font-black text-[10px] text-slate-900 mt-1">{selectedQuoteForPdf.comprador || 'NOMBRE'}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'HSE Supervisor' : 'Supervisor HSE'}</p>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'REVIEWED BY' : 'REVISÓ'}</p>
                  <div className="border-t border-slate-400 pt-2 mx-4">
                    <p className="font-black text-[10px] text-slate-900 mt-1">{isEn ? 'NAME' : 'NOMBRE'}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'Position' : 'COMPRADOR'}</p>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-[10px] text-slate-900 mb-10">{isEn ? 'AUTHORIZED' : 'AUTORIZÓ'}</p>
                  <div className="border-t border-slate-400 pt-2 mx-4">
                    <p className="font-black text-[10px] text-slate-900 mt-1">{isEn ? 'NAME' : 'NOMBRE'}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{isEn ? 'Position' : 'Puesto'}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[9px] text-slate-400 mt-10 pt-4 border-t border-slate-100">
                <p>user@grupogerez.com · 8332140041 •</p>
                <p className="mt-0.5">{isEn ? 'This quote does not constitute an invoice. Prices and availability are subject to the specified validity period.' : 'Esta cotización no constituye una factura. Precios y disponibilidad sujetos a la vigencia indicada.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

  </div>
)}

        {/* TARJETA 10: Adjudicación definitiva (Antes Tarjeta 9) */}
        {activeTab === 10 && (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-left space-y-6">
    
    {/* Header Superior */}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <span>🏆</span> {isEn ? 'Final award' : 'Adjudicación definitiva'} 
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
        {isEn ? 'Confirm the winning supplier only after the client has accepted the commercial quote.' : 'Confirma al proveedor ganador únicamente después de que el cliente haya aceptado la cotización comercial.'}  
        </p>
      </div>
      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-200 self-start md:self-auto">
      {isEn ? 'Following acceptance' : 'Posterior a aceptación'}  
      </span>
    </div>

    {/* Diagrama de Proceso (Pasos 1 al 6) */}
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs items-center">
      
      {/* Paso 1 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-black text-xs flex items-center justify-center mb-2">1</div>
        <div className="font-bold text-slate-900">{isEn ? 'Comparative' : 'Comparativo'}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{isEn ? 'Evaluated offers' : 'Ofertas evaluadas'}</div>
      </div>

      {/* Paso 2 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-black text-xs flex items-center justify-center mb-2">2</div>
        <div className="font-bold text-slate-900">{isEn ? 'Preliminary selection' : 'Selección preliminar'}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{isEn ? 'Recommended provider' : 'Proveedor recomendado'}</div>
      </div>

      {/* Paso 3 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-black text-xs flex items-center justify-center mb-2">3</div>
        <div className="font-bold text-slate-900">{isEn ? 'Quote for the client' : 'Cotización al cliente'}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{isEn ? 'Sale price' : 'Precio de venta'}</div>
      </div>

      {/* Paso 4 */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 relative">
        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center mb-2">4</div>
        <div className="font-bold text-slate-900">{isEn ? 'Customer acceptance' : 'Aceptación del cliente'}</div>
        <div className="text-[10px] text-amber-700 font-medium mt-0.5">{isEn ? 'Mandatory gate' : 'Gate obligatorio'}</div>
      </div>

      {/* Paso 5 (Paso Actual Activo) */}
      <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 relative">
        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center mb-2">5</div>
        <div className="font-bold text-slate-900">{isEn ? 'v' : 'Adjudicación definitiva'}</div>
        <div className="text-[10px] text-indigo-700 font-medium mt-0.5">{isEn ? 'Confirmed supplier' : 'Proveedor confirmado'}</div>
      </div>

      {/* Paso 6 */}
      <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 relative">
        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center mb-2">6</div>
        <div className="font-bold text-slate-900">{isEn ? 'Purchase Order' : 'Orden de Compra'}</div>
        <div className="text-[10px] text-emerald-700 font-medium mt-0.5">{isEn ? 'Supplier commitment' : 'Compromiso al proveedor'}</div>
      </div>
    </div>

    {/* Regla Informativa */}
    <div className="bg-blue-50/50 border-l-4 border-l-blue-600 border border-blue-100 rounded-xl p-3.5 text-xs text-slate-700">
      <span className="font-bold text-blue-900">{isEn ? 'Ruler:' : 'Regla:'}</span>{isEn ? 'Before customer acceptance, there is only one' : 'antes de la aceptación del cliente existe únicamente una'} <span className="font-bold text-slate-900">{isEn ? 'preliminary selection' : 'selección preliminar'}</span>.{isEn ? 'The final award confirms the supplier, following the receipt of commercial backing from the client.' : 'La adjudicación definitiva confirma al proveedor después de contar con respaldo comercial del cliente.'} 
    </div>

    {/* Panel Dividido de Contenido */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
      
      {/* Columna Izquierda: Cotizaciones Aceptadas Elegibles (2 cols) */}
      <div className="lg:col-span-2 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">{isEn ? 'Eligible accepted quotes' : 'Cotizaciones aceptadas elegibles'}</h3>
        
        <div className="space-y-2.5">
          {awardEligibleQuotes.map((item) => (
            <div 
              key={item.id} 
              className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-4"
            >
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900 text-xs">{item.requisicion}</div>
                <div className="text-[11px] text-slate-500 uppercase">{item.cliente}</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold text-slate-800 text-xs">{item.cotizacion}</div>
                  <div className="text-[10px] text-slate-500">{item.revision} · {item.estado}</div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  {item.badgeText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Columna Derecha: Tarjeta Informativa y Botón de Acción (1 col) */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-4 self-start">
        <h3 className="font-bold text-slate-900 text-sm">{isEn ? 'What is validated at this stage' : 'Qué se valida en esta etapa'}</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
        {isEn ? 'Selected supplier, offer used, currency, cost, timeframe, and justification in cases where the selected supplier differs from the one initially recommended.' : 'Proveedor definitivo, oferta utilizada, moneda, costo, plazo y justificación cuando el proveedor definitivo sea distinto al recomendado inicialmente.'}  
        </p>
        <button 
          type="button"
          onClick={() => setActiveTab(5)}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>📊</span>
          <span>{isEn ? 'Open comparison' : 'Abrir comparativo'}</span>
        </button>
      </div>
    </div>
  </div>
        )}

      {/* TARJETA 11: Matriz interna de proveedores (Antes Tarjeta 10) */}
{activeTab === 11 && (
  <div className="space-y-6 text-left">
            {/* Header Superior Original */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{isEn ? 'Quotation matrix' : 'Matriz de cotizaciones'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
            {isEn ? 'Review all the registered offers and determine which one will be selected.' : 'Consulta todas las ofertas registradas y define cuál será la seleccionada.'}  
            </p>
          </div>
          
          {/* Botones Principales de Acción */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button 
              type="button"
              onClick={() => setActiveTab(4)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-purple-500/20"
            >
              <span>+</span>
              <span>{isEn ? 'New quote' : 'Nueva cotización'}</span>
            </button>
          </div>
        </div>
        
    {/* SECCIÓN SUPERIOR: Grid de Tarjetas por Proveedor */}
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      
      {/* Encabezado del Grid */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{isEn ? 'Cards by provider' : 'Tarjetas por proveedor'}</h2>
          <p className="text-xs text-slate-500">
          {isEn ? 'Select a provider to open only their internal matrix of quotes.' : 'Selecciona un proveedor para abrir únicamente su matriz interna de cotizaciones.'}  
          </p>
        </div>
        <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
        {isEn ? '12 supplier(s) • 3 quote(s)' : '12 proveedor(es) • 3 cotización(es)'}  
        </div>
      </div>

      {/* Grid Responsivo de Tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {providersList.map((prov) => {
          const isSelected = selectedProvider === prov.name || (prov.isAll && selectedProvider === 'TODAS');
          return (
            <div
              key={prov.id}
              className={`rounded-2xl border p-3 flex flex-col justify-between transition-all bg-white shadow-2xs hover:shadow-md ${
                isSelected
                  ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/10'
                  : 'border-slate-200 hover:border-purple-300'
              }`}
            >
              {/* Encabezado Tarjeta */}
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                  {prov.tag}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[11px] text-slate-900 truncate leading-tight title={prov.name}">
                    {prov.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {prov.subtitle}
                  </p>
                </div>
              </div>

              {/* Métricas / Contadores */}
              <div className="grid grid-cols-3 gap-1 bg-slate-50/80 rounded-xl p-2 my-2.5 text-center border border-slate-100">
                <div>
                  <div className="text-xs font-black text-slate-800">{prov.total}</div>
                  <div className="text-[9px] text-slate-400 font-medium">{isEn ? 'Quotes' : 'Cotizaciones'}</div>
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800">{prov.adjudicadas}</div>
                  <div className="text-[9px] text-slate-400 font-medium">{isEn ? 'Awarded' : 'Adjudicadas'}</div>
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800">{prov.activas}</div>
                  <div className="text-[9px] text-slate-400 font-medium">
                    {prov.isAll ? 'No adjudicad.' : 'Activas'}
                  </div>
                </div>
              </div>

              {/* Botón / Enlace para Abrir Matriz */}
              <button
                type="button"
                onClick={() => {
                  setSelectedProvider(prov.isAll ? 'TODAS' : prov.name);
                  setIsMatrixOpen(true);
                }}
                className="w-full text-left text-[11px] font-bold text-slate-500 hover:text-purple-700 flex items-center justify-between transition-colors pt-1 border-t border-slate-100 cursor-pointer"
              >
                <span>{prov.isAll ? 'Abrir todas' : 'Abrir proveedor'}</span>
                <span>→</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>

    {/* SECCIÓN INFERIOR: Matriz de Cotizaciones (Se muestra si isMatrixOpen es verdadero) */}
    {isMatrixOpen && (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-left space-y-6">
        
        {/* Barra superior de estado de la matriz y botón "Volver a tarjetas" */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <span className="text-xs font-bold text-slate-800">
              {selectedProvider === 'TODAS' ? 'Todas las cotizaciones' : `Filtrado por: ${selectedProvider}`}
            </span>
            <span className="text-[11px] text-slate-500 ml-2">
              ({matrixQuotesList.filter(i => selectedProvider === 'TODAS' || i.proveedor === selectedProvider).length} registradas)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsMatrixOpen(false)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>✕</span>
          </button>
        </div>

        {/* Leyenda de Acciones Informativas */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold text-slate-800 uppercase text-[10px]">{isEn ? 'Actions:' : 'Acciones:'}</span>
          <div><span className="font-bold text-slate-800">{isEn ? 'EDIT' : 'EDITAR'}</span>{isEn ? 'Open the quote to modify it.' : 'abre la cotización para modificarla.'} </div>
          <div><span className="font-bold text-slate-800">{isEn ? 'SELECT' : 'SELECCIONAR'}</span>{isEn ? 'Select the chosen offer to issue the purchase order.' : 'marca la oferta elegida para emitir la orden de compra.'} </div>
          <div><span className="font-bold text-slate-800">{isEn ? 'ELIMINATE' : 'ELIMINAR'}</span>{isEn ? 'Delete the quote after confirming.' : 'borra la cotización después de confirmar.'} </div>
        </div>

        {/* Tabla Matriz Principal */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3">{isEn ? 'FOLIO' : 'FOLIO'}</th>
                <th className="p-3">{isEn ? 'REQUISITION' : 'REQUISICIÓN'}</th>
                <th className="p-3">{isEn ? 'INTERNAL REFERENCE' : 'REFERENCIA INTERNA'}</th>
                <th className="p-3">{isEn ? 'SUPPLIER' : 'PROVEEDOR'}</th>
                <th className="p-3">{isEn ? 'TOTAL' : 'TOTAL'}</th>
                <th className="p-3">{isEn ? 'DELIVERY' : 'ENTREGA'}</th>
                <th className="p-3 text-center">{isEn ? 'TECHNICAL' : 'TÉCNICO'}</th>
                <th className="p-3 text-center">{isEn ? 'DOCUMENTARY' : 'DOCUMENTAL'}</th>
                <th className="p-3 text-center">{isEn ? 'SCORE' : 'PUNTAJE'}</th>
                <th className="p-3">{isEn ? 'STATUS' : 'ESTATUS'}</th>
                <th className="p-3 text-center">{isEn ? 'QUOTE PDF' : 'PDF COTIZACIÓN'}</th>
                <th className="p-3 text-center">{isEn ? 'ACTIONS' : 'ACCIONES'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {matrixQuotesList.filter(item => selectedProvider === 'TODAS' || item.proveedor === selectedProvider).length === 0 ? (
                <tr>
                  <td colSpan="12" className="p-12 text-center text-slate-400 font-medium">
                  {isEn ? 'There are no quotes recorded in the master record for this filter.' : 'No hay cotizaciones registradas en la matriz para este filtro.'}  
                  </td>
                </tr>
              ) : (
                matrixQuotesList
                  .filter(item => selectedProvider === 'TODAS' || item.proveedor === selectedProvider)
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{item.id}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{item.requisicion}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px] border border-blue-100">
                          {item.referenciaInterna}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.proveedor}</div>
                        <div className="text-[10px] text-slate-400">{item.partidas}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{item.total}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{item.entrega}</td>
                      <td className="p-3 text-center text-slate-600 font-medium">{item.tecnico}</td>
                      <td className="p-3 text-center text-slate-600 font-medium">{item.documental}</td>
                      <td className="p-3 text-center">
                        <span className="text-rose-600 font-black bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                          {item.puntaje}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${item.estatusColor}`}>
                          {item.estatus}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {item.pdfDisponible ? (
                          <button 
                            type="button"
                            onClick={() => setActiveTab(6)}
                            className="text-slate-700 hover:text-blue-600 font-bold text-[10px] uppercase underline cursor-pointer"
                          >
                          {isEn ? 'VIEW PDF' : 'VER PDF'}  
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px] uppercase font-semibold">{isEn ? 'No PDF' : 'Sin PDF'}</span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => setActiveTab(4)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full transition-colors cursor-pointer"
                          >
                          {isEn ? 'EDIT' : 'EDITAR'}  
                          </button>
                          <button 
                            type="button"
                            onClick={() => setActiveTab(5)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-full transition-colors cursor-pointer"
                          >
                          {isEn ? 'AWARD' : 'ADJUDICAR'}   
                          </button>
                          <button 
                            type="button"
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-full transition-colors cursor-pointer"
                          >
                          {isEn ? 'REMOVE' : 'ELIMINAR'}   
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

      </div>
    </div>
  );
}