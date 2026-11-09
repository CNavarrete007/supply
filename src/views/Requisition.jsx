import React, { useState } from 'react';
import { 
  ClipboardList, 
  FileSpreadsheet, 
  Tags, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  Upload, 
  AlertTriangle, 
  Clock, 
  History, 
  RefreshCw, 
  FileText, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  XCircle,
  Building2
} from 'lucide-react';

export function Requisition({ onNavigate = () => {}, onNotify, lang = 'es' }) {
  const isEn = lang === 'en';

  // Estado local que controla si la matriz está abierta y qué cliente filtra (null = matriz oculta)
  const [activeClientFilter, setActiveClientFilter] = React.useState(null);
  // Estado para controlar la tarjeta activa
  const [activeTab, setActiveTab] = useState('register');

  const [pdfFile, setPdfFile] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState('newCategory');
  const [openFaq, setOpenFaq] = useState({ rule: true, notExist: false, inactive: false });

  // -------------------------------------------------------------
  // ESTADOS PRINCIPALES DEL FORMULARIO
  // -------------------------------------------------------------
  const [requisitionFolio, setRequisitionFolio] = React.useState('');
  const [selectedClient, setSelectedClient] = React.useState('');
  const [requestDate, setRequestDate] = React.useState('2026-09-15');
  const [requiredDate, setRequiredDate] = React.useState('');
  const [project, setProject] = React.useState('');
  const [contract, setContract] = React.useState('');
  const [clientRef, setClientRef] = React.useState('');
  const [deliveryPlace, setDeliveryPlace] = React.useState('');
  const [applicant, setApplicant] = React.useState('');
  const [applicantEmail, setApplicantEmail] = React.useState('');
  const [priority, setPriority] = React.useState('Normal');
  const [currency, setCurrency] = React.useState('MXN');
  const [estimatedBudget, setEstimatedBudget] = React.useState('');
  const [generalDescription, setGeneralDescription] = React.useState(
    isEn ? 'Repurchase / new request built from history' : 'Recompra / nueva solicitud construida desde historial'
  );
  const [technicalNotes, setTechnicalNotes] = React.useState('');

  // -------------------------------------------------------------
  // ESTADOS PARA AGREGAR NUEVA PARTIDA
  // -------------------------------------------------------------
  const [items, setItems] = React.useState([
    { id: 1, description: 'Tubería Acero Carbón 4" Ced 40', qty: 12, unit: 'Tramos', category: 'Tuberia' },
    { id: 2, description: 'Válvula Compuerta 4" 150# RF', qty: 2, unit: 'Piezas', category: 'Valvulas' }
  ]);
  const [newDesc, setNewDesc] = React.useState('');
  const [newQty, setNewQty] = React.useState('');
  const [newUnit, setNewUnit] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('');

  // -------------------------------------------------------------
  // ESTADOS DEL HISTORIAL Y FILTROS (TARJETA 5)
  // -------------------------------------------------------------
  const [historySearch, setHistorySearch] = React.useState('');
  const [historyCategory, setHistoryCategory] = React.useState('');
  const [historyPeriod, setHistoryPeriod] = React.useState('');

  // Estado del catálogo y seleccionados
  const [selectedItemsCount, setSelectedItemsCount] = React.useState(0);
  const [selectedItems, setSelectedItems] = React.useState([]);

  // Estados del Formulario de Categorías
  const [categoriesList, setCategoriesList] = useState([
    { id: 1, code: 'CAT-01', name: isEn ? 'Construction Materials' : 'Materiales de Construcción', active: true },
    { id: 2, code: 'CAT-02', name: isEn ? 'Welding Consumables' : 'Consumibles de Soldadura', active: true },
    { id: 3, code: 'CAT-03', name: isEn ? 'Personal Protective Equipment (PPE)' : 'Equipos de Protección Personal (EPP)', active: true }
  ]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('');

  // -------------------------------------------------------------
  // FUNCIÓN LIMPIAR
  // -------------------------------------------------------------
  const handleClearForm = () => {
    setRequisitionFolio('');
    setSelectedClient('');
    setRequestDate('2026-09-15');
    setRequiredDate('');
    setProject('');
    setContract('');
    setClientRef('');
    setDeliveryPlace('');
    setApplicant('');
    setApplicantEmail('');
    setPriority('Normal');
    setCurrency('MXN');
    setEstimatedBudget('');
    setGeneralDescription('');
    setTechnicalNotes('');

    setNewDesc('');
    setNewQty('');
    setNewUnit('');
    setNewCategory('');

    setHistorySearch('');
    setHistoryCategory('');
    setHistoryPeriod('');

    setPdfFile(null);
    setSelectedItemsCount(0);
    setSelectedItems([]);

    if (onNotify) {
      onNotify(
        isEn ? 'Requisition Form' : 'Formulario Requisición',
        isEn ? 'Requisition fields cleared successfully.' : 'Campos de la solicitud limpiados correctamente.'
      );
    }
  };

  const cards = [
    {
      id: 'register',
      title: isEn ? 'Requisition Registration' : 'Registro de requisición',
      description: isEn ? 'Capture client request and add line items.' : 'Captura la solicitud del cliente y agrega sus partidas.',
      emoji: '📝',
    },
    {
      id: 'no_requisition',
      title: isEn ? 'No Requisition / Regularization' : 'Sin requisición / Regularización',
      description: isEn ? 'Manage provisional requests, expirations, and regularization evidence.' : 'Controla solicitudes provisionales, vencimientos y evidencia de regularización.',
      emoji: '📃',
    },
    {
      id: 'matrix',
      title: isEn ? 'Requisition Matrix' : 'Matriz de requisiciones',
      description: isEn ? 'View, search, edit, and track requests.' : 'Consulta, busca, edita y da seguimiento a las solicitudes.',
      emoji: '📋',
    },
    {
      id: 'categories',
      title: isEn ? 'Category Catalog' : 'Catálogo de categorías',
      description: isEn ? 'Manage available categories for line items.' : 'Administra las categorías disponibles para las partidas.',
      emoji: '🏷️',
    },
    {
      id: 'from_history',
      title: isEn ? 'Create from History' : 'Crear desde historial',
      description: isEn ? 'Build a new requisition with historical/new items, applying client policy.' : 'Arma una requisición nueva con partidas históricas y/o nuevas, aplicando la política de cada cliente.',
      emoji: '🕒',
    },
    {
      id: 'change_control',
      title: isEn ? 'Change Control' : 'Control de cambios',
      description: isEn ? 'Modify authorized requisitions through Rev. N without losing traceability.' : 'Modifica requisiciones autorizadas mediante Rev. N sin perder trazabilidad.',
      emoji: '🔄',
    },
  ];

  const handleTabChange = (tabId, tabTitle) => {
    setActiveTab(tabId);
    if (onNotify) {
      onNotify(isEn ? 'Requisitions & Requests' : 'Requisiciones y Solicitudes', `${isEn ? 'Navigating to' : 'Navegando a'}: ${tabTitle}`);
    }
  };

  const handleAddItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newDesc || !newQty) {
      if (onNotify) onNotify(isEn ? 'Attention' : 'Atención', isEn ? 'Specify at least a description and quantity.' : 'Especifique al menos una descripción y cantidad.', 'warning');
      return;
    }
    const newItem = {
      id: Date.now(),
      description: newDesc,
      qty: newQty,
      unit: newUnit || (isEn ? 'Piece' : 'Pieza'),
      category: newCategory || (isEn ? 'General' : 'General')
    };
    setItems([...items, newItem]);
    setNewDesc('');
    setNewQty('');
    setNewUnit('');
    setNewCategory('');
    if (onNotify) onNotify(isEn ? 'Item Added' : 'Partida Agregada', isEn ? `Item "${newItem.description}" added to list.` : `Partida "${newItem.description}" agregada a la lista.`);
  };

  const handleRemoveItem = (id) => {
    const itemToRemove = items.find(item => item.id === id);
    setItems(items.filter(item => item.id !== id));
    if (onNotify && itemToRemove) {
      onNotify(isEn ? 'Item Removed' : 'Partida Eliminada', isEn ? `Item "${itemToRemove.description}" was removed.` : `Se eliminó la partida "${itemToRemove.description}".`);
    }
  };

  const handleSaveRequisition = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (onNotify) {
      onNotify(isEn ? 'Requisition Saved' : 'Requisición Guardada', isEn ? `Folio ${requisitionFolio || 'REQ-2026-001'} registered successfully.` : `Folio ${requisitionFolio || 'REQ-2026-001'} registrado con éxito.`);
    }
    handleClearForm();
  };

  const handleAddCategory = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newCategoryName) {
      if (onNotify) onNotify(isEn ? 'Attention' : 'Atención', isEn ? 'Enter a category name.' : 'Ingrese un nombre para la categoría.', 'warning');
      return;
    }
    const cat = {
      id: Date.now(),
      code: newCategoryCode || `CAT-0${categoriesList.length + 1}`,
      name: newCategoryName,
      active: true
    };
    setCategoriesList([...categoriesList, cat]);
    setNewCategoryName('');
    setNewCategoryCode('');
    if (onNotify) onNotify(isEn ? 'Category Saved' : 'Categoría Guardada', isEn ? `Category "${cat.name}" has been created.` : `La categoría "${cat.name}" ha sido creada.`);
  };

  return (
    <div className="space-y-6">
      {/* Header General */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{isEn ? 'Request / Requisition' : 'Solicitud / Requisición'}</h2>
          <p className="text-xs text-slate-500">{isEn ? 'Creation and tracking of internal purchase requisitions.' : 'Creación y seguimiento de requisiciones de compra internos.'}</p>
        </div>
      </div>

      {/* Grid de las 6 Tarjetas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const isActive = activeTab === card.id;

          return (
            <button
              key={card.id}
              onClick={() => handleTabChange(card.id, card.title)}
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

      {/* Contenedor dinámico principal */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm min-h-[400px]">

        {/* TARJETA 1: Registro de requisición */}
        {activeTab === 'register' && (
          <div className="space-y-5">
            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900">{isEn ? 'Client Request / Requisition' : 'Solicitud / Requisición del cliente'}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isEn ? 'Record original client request, contractual data, applicant, tracking email, and requested items.' : 'Registra la necesidad original del cliente, los datos contractuales, el solicitante, su correo de seguimiento y las partidas solicitadas.'}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-[10px] rounded-full border border-blue-100">
                {isEn ? 'Step 1 · Entry' : 'Paso 1 · Captura'}
              </span>
            </div>

            <form onSubmit={handleSaveRequisition} className="space-y-4 pt-1">
              {/* Fila 1: Folio, Cliente, Fecha Solicitud */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Requisition Folio *' : 'Folio de requisición *'}</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={requisitionFolio}
                      onChange={(e) => setRequisitionFolio(e.target.value)}
                      placeholder={isEn ? 'Manual entry or generate by client' : 'Captura manual o genera por cliente'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const generated = `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
                        setRequisitionFolio(generated);
                        if (onNotify) onNotify(isEn ? 'Folio Generated' : 'Folio Generado', `${isEn ? 'New folio' : 'Nuevo folio'}: ${generated}`);
                      }}
                      className="px-3 py-2 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap hover:opacity-90"
                      style={{ backgroundColor: '#a221b7' }}
                    >
                      ⚙ {isEn ? 'Generate' : 'Generar'}
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 block">
                    {isEn ? 'Example: CLIENTNUM-REQ-YEAR-0001. Can also be entered manually.' : 'Ejemplo: NUMCLIENTE-REQ-AÑO-0001. También puedes capturarlo manualmente.'}
                  </span>
                </div>

                <div className="md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Client *' : 'Cliente *'}</label>
                  <select 
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="">{isEn ? '🔎 Search client by number, company name, brand, project, contract or RFC...' : '🔎 Buscar cliente por número, razón social, marca, proyecto, contrato o RFC...'}</option>
                    <option value="Grupo Gerez">Grupo Gerez</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Request date *' : 'Fecha de solicitud *'}</label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Fila 2: Proyecto, Contrato, Referencia, Prioridad */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Project *' : 'Proyecto *'}</label>
                  <input 
                    type="text" 
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" 
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Contract number *' : 'Número de contrato *'}</label>
                  <input 
                    type="text" 
                    value={contract}
                    onChange={(e) => setContract(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" 
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Internal reference' : 'Referencia interna'}</label>
                  <input
                    type="text"
                    value={clientRef}
                    onChange={(e) => setClientRef(e.target.value)}
                    placeholder={isEn ? 'e.g. INT TRION 2026 001 / internal ref...' : 'Ej. INT TRION 2026 001 / referencia interna del exped...'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 placeholder:text-slate-300"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Priority' : 'Prioridad'}</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="Normal">{isEn ? 'Normal' : 'Normal'}</option>
                    <option value="Alta">{isEn ? 'High' : 'Alta'}</option>
                    <option value="Crítica">{isEn ? 'Critical' : 'Crítica'}</option>
                  </select>
                </div>
              </div>

              {/* Fila 3: Fecha requerida, Lugar de entrega, Solicitante */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Required date *' : 'Fecha requerida *'}</label>
                  <input
                    type="date" 
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" 
                  />
                </div>

                <div className="md:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Delivery location *' : 'Lugar de entrega *'}</label>
                  <input 
                    type="text" 
                    value={deliveryPlace}
                    onChange={(e) => setDeliveryPlace(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" 
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Client applicant *' : 'Solicitante del cliente *'}</label>
                  <input 
                    type="text" 
                    value={applicant}
                    onChange={(e) => setApplicant(e.target.value)}
                    placeholder={isEn ? 'Applicant name' : 'Nombre de la persona solicitante'} 
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" 
                  />
                </div>
              </div>

              {/* Fila 4: Correo, Presupuesto, Moneda */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Applicant email *' : 'Correo del solicitante *'}</label>
                  <input 
                    type="email" 
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="solicitante@cliente.com" 
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" 
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">
                    {isEn 
                      ? 'This will be the main recipient for process communications: registration, validation, quotation, purchase, receiving, delivery, and invoice.' 
                      : 'Este será el destinatario principal de las comunicaciones del proceso: registro, validación, cotización, compra, recepción, entrega y factura.'}
                  </span>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Estimated budget' : 'Presupuesto estimado'}</label>
                  <input 
                    type="text" 
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" 
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Currency' : 'Moneda'}</label>
                  <select 
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Fila 5: Descripción general */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'General description' : 'Descripción general'}</label>
                <textarea 
                  rows={2} 
                  value={generalDescription}
                  onChange={(e) => setGeneralDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 resize-y"
                ></textarea>
              </div>

              {/* Sección Partidas de la requisición */}
              <div className="p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/40 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{isEn ? 'Requisition line items' : 'Partidas de la requisición'}</h4>
                    <p className="text-[10px] text-slate-400">
                      {isEn 
                        ? 'Each line represents a product, equipment, material, or service requested. Prices are added upon vendor quote receipt.' 
                        : 'Cada partida representa un producto, equipo, material o servicio solicitado. En esta etapa no se capturan precios: se registran al recibir la cotización de cada proveedor.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange('categories', isEn ? 'Category Catalog' : 'Catálogo de categorías')}
                    className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-all cursor-pointer"
                  >
                    🏷️ {isEn ? 'Manage categories' : 'Administrar categorías'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Description / specification' : 'Descripción / especificación'}</label>
                    <input 
                      type="text" 
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder={isEn ? 'e.g. 10ft Offshore container' : 'Ej. Contenedor offshore de 10 pies'} 
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none text-slate-700" 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Quantity' : 'Cantidad'}</label>
                    <input 
                      type="text" 
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none text-slate-700" 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Unit' : 'Unidad'}</label>
                    <input 
                      type="text" 
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      placeholder={isEn ? 'pcs, lot, service' : 'pza, lote, servicio'} 
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none text-slate-700" 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">{isEn ? 'Category' : 'Categoría'}</label>
                    <select 
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                    >
                      <option value="">{isEn ? 'Select category...' : 'Seleccionar categoría...'}</option>
                      <option value="Consumibles">{isEn ? 'Consumables' : 'Consumibles'}</option>
                      <option value="EPP y seguridad">{isEn ? 'PPE & Safety' : 'EPP y seguridad'}</option>
                      <option value="Equipos">{isEn ? 'Equipment' : 'Equipos'}</option>
                      <option value="Herramientas">{isEn ? 'Tools' : 'Herramientas'}</option>
                      <option value="Refacciones">{isEn ? 'Spare Parts' : 'Refacciones'}</option>
                      <option value="Renta de equipo">{isEn ? 'Equipment Rental' : 'Renta de equipo'}</option>
                      <option value="Servicios">{isEn ? 'Services' : 'Servicios'}</option>
                      <option value="Tecnología y comunicación">{isEn ? 'Tech & Telecom' : 'Tecnología y comunicación'}</option>
                      <option value="Transporte y logística">{isEn ? 'Transport & Logistics' : 'Transporte y logística'}</option>
                      <option value="Otro">{isEn ? 'Other' : 'Otro'}</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Lista de Partidas Registradas */}
                {items.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                      <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600">
                        <tr>
                          <th className="p-2">{isEn ? 'Description' : 'Descripción'}</th>
                          <th className="p-2">{isEn ? 'Qty' : 'Cant.'}</th>
                          <th className="p-2">{isEn ? 'Unit' : 'Unidad'}</th>
                          <th className="p-2">{isEn ? 'Category' : 'Categoría'}</th>
                          <th className="p-2 text-center">{isEn ? 'Action' : 'Acción'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="p-2 font-medium">{item.description}</td>
                            <td className="p-2">{item.qty}</td>
                            <td className="p-2">{item.unit}</td>
                            <td className="p-2">{item.category}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Notas / requisitos técnicos / documentos */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Notes / Technical specs / Documents' : 'Notas / requisitos técnicos / documentos'}</label>
                <textarea 
                  rows={2} 
                  value={technicalNotes}
                  onChange={(e) => setTechnicalNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700 resize-y"
                ></textarea>
              </div>

              {/* Archivo de la solicitud / requisición */}
              <div className="p-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{isEn ? 'Request / Requisition File' : 'Archivo de la solicitud / requisición'}</h4>
                  <p className="text-[10px] text-slate-400">{isEn ? 'Attach client request document (PDF format only).' : 'Adjunta el documento original de la solicitud o requisición del cliente (únicamente formato PDF).'}</p>
                </div>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.type === 'application/pdf') {
                        setPdfFile(file);
                        if (onNotify) onNotify(isEn ? 'File attached' : 'Archivo adjuntado', `${isEn ? 'PDF uploaded' : 'PDF cargado'}: ${file.name}`);
                      } else {
                        if (onNotify) onNotify(isEn ? 'Attention' : 'Atención', isEn ? 'Only PDF files are allowed.' : 'Solo se permiten archivos en formato PDF.', 'warning');
                        e.target.value = '';
                      }
                    }
                  }}
                  className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-l-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />

                {/* Contenedor dinámico de estado del archivo */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-600 font-medium flex items-center justify-between">
                  {pdfFile ? (
                    <span className="text-slate-800 flex items-center gap-2">
                      <span>📄</span> {pdfFile.name} <span className="text-[10px] text-slate-400">({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">{isEn ? 'No request / requisition file uploaded.' : 'No se ha cargado ningún archivo de solicitud / requisición.'}</span>
                  )}
                </div>

                {/* Botonera dinámica */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!pdfFile}
                    onClick={() => {
                      if (pdfFile) {
                        const fileUrl = URL.createObjectURL(pdfFile);
                        window.open(fileUrl, '_blank');
                      }
                    }}
                    className={`px-3 py-1.5 font-bold text-[11px] rounded-lg border transition-all flex items-center gap-1 ${
                      pdfFile
                        ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 cursor-pointer shadow-2xs'
                        : 'bg-slate-100 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-60'
                    }`}
                  >
                    👁 {isEn ? 'View file' : 'Ver archivo'}
                  </button>

                  <button
                    type="button"
                    disabled={!pdfFile}
                    onClick={() => {
                      setPdfFile(null);
                      if (onNotify) onNotify(isEn ? 'File Removed' : 'Archivo Removido', isEn ? 'Attached PDF was removed.' : 'Se quitó el PDF adjunto.');
                    }}
                    className={`px-3 py-1.5 font-bold text-[11px] rounded-lg transition-all ${
                      pdfFile
                        ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-2xs'
                        : 'bg-rose-700 text-white cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isEn ? 'Remove file' : 'Quitar archivo'}
                  </button>
                </div>
              </div>

              {/* Botonera de acciones final */}
              <div className="flex flex-wrap items-center gap-2.5 pt-4">
                <button
                  type="submit"
                  className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-transparent hover:opacity-90"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  <span className="text-sm">💾</span>
                  <span>{isEn ? 'Save requisition' : 'Guardar requisición'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearForm}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">🪄</span>
                  <span>{isEn ? 'Clear' : 'Limpiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('matrix', isEn ? 'Requisition Matrix' : 'Matriz de requisiciones')}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">📋</span>
                  <span>{isEn ? 'View matrix' : 'Ver matriz'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TARJETA 2: Sin requisición / Regularización */}
        {activeTab === 'no_requisition' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">{isEn ? 'Requests without formal requisition' : 'Solicitudes sin requisición formal'}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isEn ? 'Each record keeps a provisional internal folio and continues commercial workflow. Regularization is tracked without duplicating files.' : 'Cada registro conserva un folio interno provisional y puede continuar el flujo comercial/operativo. La regularización documental se controla sin duplicar el expediente.'}
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 font-bold text-[10px] rounded-full border border-amber-200/60 whitespace-nowrap">
                {isEn ? 'Document Control' : 'Control documental'}
              </span>
            </div>

            {/* Grid de KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-blue-600 shadow-2xs">
                <span className="text-2xl font-black text-slate-900 block leading-none">0</span>
                <span className="text-[11px] font-bold text-slate-600 mt-2 block">{isEn ? 'Provisional requests' : 'Solicitudes provisionales'}</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 shadow-2xs">
                <span className="text-2xl font-black text-slate-900 block leading-none">0</span>
                <span className="text-[11px] font-bold text-slate-600 mt-2 block">{isEn ? 'Pending regularization' : 'Pendientes de regularización'}</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-rose-600 shadow-2xs">
                <span className="text-2xl font-black text-slate-900 block leading-none">0</span>
                <span className="text-[11px] font-bold text-slate-600 mt-2 block">{isEn ? 'Overdue regularization' : 'Regularización vencida'}</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 border-t-emerald-600 shadow-2xs">
                <span className="text-2xl font-black text-slate-900 block leading-none">0</span>
                <span className="text-[11px] font-bold text-slate-600 mt-2 block">{isEn ? 'Regularized' : 'Regularizadas'}</span>
              </div>
            </div>

            {/* Buscador y Filtros */}
            <div className="space-y-3 pt-1">
              <input
                type="text"
                placeholder={isEn ? 'Search folio, client, reference, applicant...' : 'Buscar folio, cliente, referencia, solicitante...'}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs placeholder:text-slate-400"
              />

              <select className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-2xs">
                <option value="">{isEn ? 'All statuses' : 'Todos los estados'}</option>
                <option value="pendiente">{isEn ? 'Pending' : 'Pendientes'}</option>
                <option value="vencida">{isEn ? 'Overdue' : 'Vencidas'}</option>
                <option value="regularizada">{isEn ? 'Regularized' : 'Regularizadas'}</option>
              </select>

              <div>
                <button
                  type="button"
                  onClick={() => handleTabChange('register', isEn ? 'Requisition Registration' : 'Registro de requisición')}
                  className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90 border border-transparent"
                  style={{ backgroundColor: '#1d64ec' }}
                >
                  <span className="text-sm font-black">+</span>
                  <span>{isEn ? 'New provisional request' : 'Nueva solicitud provisional'}</span>
                </button>
              </div>
            </div>

            {/* Tabla de Registros */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs mt-3">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200/80">
                    <th className="py-3 px-4">{isEn ? 'File Ref' : 'Expediente'}</th>
                    <th className="py-3 px-4">{isEn ? 'Client / Applicant' : 'Cliente / Solicitante'}</th>
                    <th className="py-3 px-4">{isEn ? 'Origin' : 'Origen'}</th>
                    <th className="py-3 px-4">{isEn ? 'Regularization' : 'Regularización'}</th>
                    <th className="py-3 px-4">{isEn ? 'Stage' : 'Etapa'}</th>
                    <th className="py-3 px-4 text-center">{isEn ? 'Actions' : 'Acciones'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-400">
                      <p className="font-semibold text-slate-600 text-xs">{isEn ? 'No provisional requests registered' : 'Sin solicitudes provisionales registradas'}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {isEn ? 'Click "+ New provisional request" to start tracking pending items.' : 'Haz clic en "+ Nueva solicitud provisional" para comenzar a controlar pendientes de regularización.'}
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TARJETA 3: Matriz de requisiciones */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900">{isEn ? 'Requisition Matrix' : 'Matriz de requisiciones'}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isEn ? 'Check progress, priority, estimated amount, and current stage for each request.' : 'Consulta el avance, prioridad, monto estimado y etapa actual de cada solicitud.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTabChange('register', isEn ? 'Requisition Registration' : 'Registro de requisición')}
                  className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90 border border-transparent"
                  style={{ backgroundColor: '#1d64ec' }}
                >
                  <span className="text-sm font-black">+</span>
                  <span>{isEn ? 'New requisition' : 'Nueva requisición'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('from_history', isEn ? 'Create from History' : 'Crear desde historial')}
                  className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90 border border-transparent"
                  style={{ backgroundColor: '#a221b7' }}
                >
                  <span className="text-xs">🕒</span>
                  <span>{isEn ? 'Create from history' : 'Crear desde historial'}</span>
                </button>
              </div>
            </div>

            {/* GRID DE TARJETAS DE CLIENTES */}
            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-800">{isEn ? 'Requisitions by client' : 'Requisiciones por cliente'}</h4>
                  <p className="text-[10px] text-slate-400">
                    {isEn ? 'Click "Open" on any card to display its matrix below.' : 'Selecciona "Abrir" en cualquiera de las tarjetas para desplegar su matriz abajo.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={isEn ? 'Search client, number, RFC, project or contract...' : 'Buscar cliente, número, RFC, proyecto o contrato...'}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs placeholder:text-slate-400"
                  />
                </div>
                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-[10px] rounded-lg border border-blue-100/80 whitespace-nowrap">
                  0 {isEn ? 'of' : 'de'} 0 {isEn ? 'clients' : 'clientes'}
                </span>
              </div>

              {/* Grid de Tarjetas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                {/* Todas las requisiciones */}
                <div className={`p-3 bg-white rounded-2xl border shadow-2xs flex flex-col justify-between h-36 border-l-4 border-l-blue-600 transition-all ${activeClientFilter === 'ALL' ? 'ring-2 ring-blue-500/50 border-blue-300' : 'border-slate-200/80'}`}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-2xs"
                      style={{ backgroundColor: '#1d64ec' }}
                    >
                      ALL
                    </div>
                    <div>
                      <h5 className="text-[11px] font-black text-slate-800 leading-tight">{isEn ? 'All requisitions' : 'Todas las requisiciones'}</h5>
                      <span className="text-[9px] text-slate-400">0 {isEn ? 'clients' : 'clientes'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center bg-slate-50/70 p-1.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">0</span>
                      <span className="text-[8px] text-slate-400 block">Total</span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800 block">0</span>
                      <span className="text-[8px] text-slate-400 block">{isEn ? 'Pending' : 'Pendientes'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800 block">0</span>
                      <span className="text-[8px] text-slate-400 block">0%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                    <span>{isEn ? 'Full portfolio' : 'Cartera completa'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveClientFilter('ALL');
                        if (onNotify) onNotify(isEn ? 'Matrix' : 'Matriz', isEn ? 'Showing all requisitions.' : 'Mostrando todas las requisiciones.');
                      }}
                      className="font-bold text-blue-600 cursor-pointer hover:underline border-none bg-transparent p-0"
                    >
                      {isEn ? 'Open all →' : 'Abrir todas →'}
                    </button>
                  </div>
                </div>

                {/* Grupo Gerez */}
                <div className={`p-3 bg-white rounded-2xl border shadow-2xs flex flex-col justify-between h-36 border-l-4 border-l-purple-600 transition-all ${activeClientFilter === 'Grupo Gerez' ? 'ring-2 ring-purple-500/50 border-purple-300' : 'border-slate-200/80'}`}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-2xs"
                      style={{ backgroundColor: '#a221b7' }}
                    >
                      GG
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="text-[11px] font-black text-slate-800 truncate leading-tight">Grupo Gerez</h5>
                      <span className="text-[9px] text-slate-400">No. 0001 · {isEn ? 'Active' : 'Activo'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center bg-slate-50/70 p-1.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">0</span>
                      <span className="text-[8px] text-slate-400 block">{isEn ? 'Requisitions' : 'Requisiciones'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800 block">0</span>
                      <span className="text-[8px] text-slate-400 block">{isEn ? 'Pending' : 'Pendientes'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800 block">0</span>
                      <span className="text-[8px] text-slate-400 block">0%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                    <span>0 {isEn ? 'projects' : 'proyectos'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveClientFilter('Grupo Gerez');
                        if (onNotify) onNotify(isEn ? 'Client Filter' : 'Filtro Cliente', `${isEn ? 'Filtering by' : 'Filtrando por'}: Grupo Gerez`);
                      }}
                      className="font-bold text-purple-600 cursor-pointer hover:underline border-none bg-transparent p-0"
                    >
                      {isEn ? 'Open client →' : 'Abrir cliente →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MATRIZ DESPLEGABLE */}
            {activeClientFilter && (
              <div className="space-y-4 pt-4 border-t border-slate-200/60 animate-fadeIn">
                <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex justify-between items-center shadow-2xs">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      {activeClientFilter === 'ALL' ? (isEn ? 'All requisitions' : 'Todas las requisiciones') : activeClientFilter}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">0 {isEn ? 'records from 0 clients' : 'registros de 0 clientes'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveClientFilter(null)}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl border border-red-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>X</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse min-w-[1250px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200/80">
                        <th className="py-3 px-3">Folio</th>
                        <th className="py-3 px-3 text-center">{isEn ? 'Request / Req.' : 'Solicitud / Req.'}</th>
                        <th className="py-3 px-3">{isEn ? 'Client' : 'Cliente'}</th>
                        <th className="py-3 px-3">{isEn ? 'Applicant / Email' : 'Solicitante / Correo'}</th>
                        <th className="py-3 px-3">{isEn ? 'Project' : 'Proyecto'}</th>
                        <th className="py-3 px-3">{isEn ? 'Required Date' : 'Fecha Requerida'}</th>
                        <th className="py-3 px-3">{isEn ? 'Priority' : 'Prioridad'}</th>
                        <th className="py-3 px-3 text-center">{isEn ? 'Items' : 'Partidas'}</th>
                        <th className="py-3 px-3">{isEn ? 'Estimated' : 'Estimado'}</th>
                        <th className="py-3 px-3">{isEn ? 'Stage' : 'Etapa'}</th>
                        <th className="py-3 px-3">{isEn ? 'Progress' : 'Avance'}</th>
                        <th className="py-3 px-3 text-center">{isEn ? 'Actions' : 'Acciones'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      <tr>
                        <td colSpan={12} className="py-16 text-center text-slate-400">
                          <p className="font-semibold text-slate-600 text-xs">
                            {isEn ? 'No requisitions registered' : 'Sin requisiciones registradas'} {activeClientFilter !== 'ALL' ? `${isEn ? 'for' : 'para'} ${activeClientFilter}` : ''}
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TARJETA 4: Catálogo de categorías */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">{isEn ? 'Category Catalog' : 'Catálogo de categorías'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEn ? 'Manage available categories for line items.' : 'Administra las categorías disponibles para las partidas.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'newCategory',
                  title: isEn ? 'New / Edit Category' : 'Nueva / editar categoría',
                  description: isEn ? 'Create a new category or edit an existing one.' : 'Captura una categoría nueva o modifica una existente.',
                  icon: '➕',
                },
                {
                  id: 'categoryMatrix',
                  title: isEn ? 'Category Matrix' : 'Matriz de categorías',
                  description: isEn ? 'View, search, edit, enable or disable categories.' : 'Consulta, busca, edita, activa o desactiva categorías.',
                  icon: '📋',
                },
                {
                  id: 'whatIsCategory',
                  title: isEn ? 'What is a category?' : '¿Qué significa categoría?',
                  description: isEn ? 'View examples and guidelines to classify items.' : 'Consulta ejemplos y reglas para clasificar partidas.',
                  icon: '💡',
                },
              ].map((subCard) => {
                const isSubActive = activeCategoryTab === subCard.id;

                return (
                  <button
                    key={subCard.id}
                    type="button"
                    onClick={() => setActiveCategoryTab(subCard.id)}
                    className={`text-left p-4 rounded-2xl transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex flex-col justify-between h-28 border ${
                      isSubActive
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 border-transparent -translate-y-0.5'
                        : 'bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{subCard.icon}</span>
                      <h4 className={`text-xs font-bold tracking-tight ${isSubActive ? 'text-white' : 'text-slate-800'}`}>
                        {subCard.title}
                      </h4>
                    </div>

                    <p className={`text-[11px] leading-relaxed line-clamp-2 ${isSubActive ? 'text-blue-100' : 'text-slate-500'}`}>
                      {subCard.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Sub-vistas de categorías */}
            <div className="pt-2">
              {activeCategoryTab === 'newCategory' && (
                <form onSubmit={handleAddCategory} className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-8">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isEn ? 'Category Name' : 'Nombre de la categoría'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder={isEn ? 'e.g. Rigging Equipment' : 'Ej. Equipos de izaje'}
                        className="w-full px-3.5 py-2 text-xs bg-white border border-blue-400/80 rounded-xl outline-none text-slate-700"
                      />
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">{isEn ? 'Status' : 'Estatus'}</label>
                      <select className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none">
                        <option value="Activa">{isEn ? 'Active' : 'Activa'}</option>
                        <option value="Inactiva">{isEn ? 'Inactive' : 'Inactiva'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-3">
                    <button
                      type="submit"
                      className="px-4 py-2.5 text-white font-bold text-xs rounded-xl cursor-pointer hover:opacity-90"
                      style={{ backgroundColor: '#a221b7' }}
                    >
                      💾 {isEn ? 'Save category' : 'Guardar categoría'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TARJETA 5: Crear desde historial */}
        {activeTab === 'from_history' && (
          <div className="space-y-6">
            <div 
              className="p-4 rounded-2xl text-white shadow-md flex items-start gap-3 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1d64ec 0%, #a221b7 100%)' }}
            >
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ✏️
              </div>
              <div>
                <h3 className="text-sm font-black tracking-wide">{isEn ? 'New requisition from client history' : 'Nueva requisición desde historial del cliente'}</h3>
                <p className="text-[11px] text-white/90 mt-0.5 leading-relaxed">
                  {isEn 
                    ? 'Combine items/services from different operations, adjust quantities, add new line items, and set pricing rules.' 
                    : 'No copia una requisición completa. Puedes combinar artículos/servicios de operaciones distintas, cambiar cantidades, agregar partidas nuevas y decidir por partida si se respeta el precio al cliente y si el proveedor debe recotizar.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TARJETA 6: Control de cambios */}
        {activeTab === 'change_control' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-bold text-base">🔄</span>
                  <h3 className="text-base font-black text-slate-900">
                    {isEn ? 'Change Control Requests' : 'Control de modificaciones / Change Requests'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEn ? 'Keep original requisition, create Rev. N, and reopen only affected workflow stages.' : 'Conserva la requisición original, genera Rev. N y reabre únicamente las etapas realmente afectadas.'}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}