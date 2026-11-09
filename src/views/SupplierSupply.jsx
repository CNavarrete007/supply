import React, { useState } from 'react';
import { 
  Plus, 
  Save, 
  Trash2, 
  Table as TableIcon,
  PackageCheck,
  Search,
  Filter,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2
} from 'lucide-react';

// Diccionario de traducciones (Español / Inglés)
const translations = {
  es: {
    headerTitle: "Suministro de Proveedores",
    headerSubtitle: "Gestión de insumos, stock y pedidos a proveedores.",
    cards: {
      register: {
        title: "Registro de suministro",
        description: "Agrega lo que el proveedor puede suministrar y sus condiciones."
      },
      matrix: {
        title: "Matriz de suministros",
        description: "Consulta productos, servicios, entrega y crédito."
      },
      commercial: {
        title: "Resumen comercial",
        description: "Visualiza las condiciones generales de cada proveedor."
      }
    },
    registerTab: {
      title: "Producto, servicio o suministro del proveedor",
      subtitle: "Registra exactamente qué puede proveer y bajo qué condiciones comerciales.",
      tag: "Catálogo de suministro",
      bannerTitle: "Precios únicamente mediante cotización:",
      bannerText: "En este catálogo no se capturan precios. El precio unitario, subtotal, impuestos y total se registran cuando se recibe la cotización formal del proveedor en Cotizaciones y Comparativo.",
      labels: {
        supplier: "Proveedor",
        supplierSelect: "Seleccionar proveedor...",
        item: "Producto, servicio o suministro",
        itemPlaceholder: "Ej. Contenedor offshore de 10 pies, transporte local, EPP...",
        type: "Tipo",
        category: "Categoría",
        categorySelect: "Seleccionar categoría...",
        brand: "Marca",
        model: "Modelo / referencia",
        description: "Descripción / alcance / especificación",
        deliveryTime: "Tiempo de entrega",
        timeUnit: "Unidad del tiempo",
        creditType: "Tipo de crédito",
        creditDays: "Días de crédito",
        currency: "Moneda",
        minOrder: "Pedido mínimo",
        minOrderPlaceholder: "Ej. 10 piezas, 1 lote, $5,000",
        validityDate: "Vigencia de condiciones",
        coverage: "Cobertura / lugar de entrega",
        coveragePlaceholder: "Local, nacional, Tamaulipas, offshore...",
        status: "Estatus",
        observations: "Observaciones comerciales"
      },
      typeOptions: {
        product: "Producto",
        service: "Servicio",
        rent: "Renta",
        consumable: "Consumible",
        sparePart: "Refacción",
        equipment: "Equipo",
        storage: "Almacenamiento",
        tool: "Herramienta",
        other: "Otro/agregar nuevo tipo"
      },
      categoryOptions: {
        storage: "Almacenamiento",
        consumables: "Consumibles",
        safety: "EPP y seguridad",
        equipment: "Equipos",
        tools: "Herramientas",
        materials: "Materiales",
        spareParts: "Refacciones",
        rental: "Renta de equipo",
        services: "Servicios",
        tech: "Tecnología y comunicación",
        logistics: "Transporte y logística",
        others: "Otros"
      },
      timeUnits: {
        businessDays: "Días hábiles",
        calendarDays: "Días naturales",
        weeks: "Semanas",
        months: "Meses"
      },
      creditTypes: {
        cash: "Contado",
        advance: "Anticipo",
        credit: "Crédito",
        cod: "Contra entrega",
        installments: "Parcialidades",
        consignment: "Consignación",
        others: "Otros"
      },
      statusOptions: {
        active: "Activo",
        inactive: "Inactivo",
        unavailable: "No disponible"
      },
      buttons: {
        save: "Guardar suministro",
        clear: "Limpiar",
        matrix: "Ver matriz"
      }
    },
    matrixTab: {
      title: "Matriz de productos, servicios y condiciones",
      subtitle: "Consulta qué suministra cada proveedor y las condiciones ofrecidas.",
      newSupplyBtn: "Nuevo suministro",
      allSuppliers: "Todos los proveedores",
      searchPlaceholder: "Buscar producto, servicio, categoría, marca o modelo...",
      allStatuses: "Todos los estatus",
      cardsTitle: "Tarjetas por proveedor",
      cardsSub: "Selecciona un proveedor para abrir únicamente sus productos, servicios y condiciones.",
      recordsLoaded: "registro(s) cargado(s)",
      generalView: "Vista general",
      statRecords: "Registros",
      statActive: "Activos",
      statOthers: "Otros",
      openAll: "Abrir todos",
      recordsShown: "registros mostrados",
      table: {
        supplier: "PROVEEDOR",
        item: "PRODUCTO / SERVICIO",
        type: "TIPO",
        category: "CATEGORÍA",
        brand: "MARCA",
        delivery: "TIEMPO DE ENTREGA",
        credit: "TIPO DE CRÉDITO",
        status: "ESTATUS",
        noData: "Sin registros de suministros disponibles."
      }
    },
    commercialTab: {
      title: "Resumen comercial del proveedor",
      subtitle: "Concentra sus productos, tiempos de entrega y condiciones de crédito.",
      selectSupplier: "Seleccionar proveedor...",
      noSelection: "Selecciona un proveedor para consultar su resumen comercial.",
      kpi: {
        registered: "Suministros registrados",
        active: "activos",
        categories: "Categorías",
        materials: "Materiales",
        avgDelivery: "Entrega promedio",
        businessDays: "Días hábiles",
        creditDays: "Días de crédito habitual",
        credit: "Crédito",
        rating: "Calificación",
        outOf100: "de 100 puntos"
      },
      details: {
        generalCategory: "Categoría general:",
        generalCategoryVal: "Materiales e insumos",
        habitualCurrency: "Moneda habitual:",
        habitualDelivery: "Entrega habitual:",
        habitualCredit: "Crédito habitual:",
        registeredConds: "Condiciones registradas por suministro",
        creditTypes: "Tipos de crédito:",
        creditTypesVal: "Contado / Crédito",
        coverage: "Cobertura:",
        coverageVal: "Nacional",
        activeItems: "Productos y servicios activos:"
      }
    },
    notifications: {
      navigating: "Navegando a:",
      cleared: "Campos de captura restablecidos.",
      requiredError: "Por favor completa los campos obligatorios: Proveedor y Producto / Servicio.",
      saved: "Suministro Guardado",
      savedDesc: "Se registró"
    }
  },
  en: {
    headerTitle: "Supplier Supplies",
    headerSubtitle: "Management of supplies, stock, and supplier orders.",
    cards: {
      register: {
        title: "Supply Registration",
        description: "Add what the supplier can provide and their commercial terms."
      },
      matrix: {
        title: "Supplies Matrix",
        description: "View products, services, delivery times, and credit terms."
      },
      commercial: {
        title: "Commercial Summary",
        description: "Overview of each supplier's general terms and conditions."
      }
    },
    registerTab: {
      title: "Supplier Product, Service, or Supply",
      subtitle: "Record exactly what they can supply and under what commercial terms.",
      tag: "Supply Catalog",
      bannerTitle: "Pricing strictly by quotation:",
      bannerText: "Prices are not captured in this catalog. Unit price, subtotal, taxes, and total are recorded when receiving formal quotes in Quotations & Comparison.",
      labels: {
        supplier: "Supplier",
        supplierSelect: "Select supplier...",
        item: "Product, service, or supply",
        itemPlaceholder: "e.g. 10ft offshore container, local transport, PPE...",
        type: "Type",
        category: "Category",
        categorySelect: "Select category...",
        brand: "Brand",
        model: "Model / reference",
        description: "Description / scope / specification",
        deliveryTime: "Delivery time",
        timeUnit: "Time unit",
        creditType: "Credit type",
        creditDays: "Credit days",
        currency: "Currency",
        minOrder: "Minimum order",
        minOrderPlaceholder: "e.g. 10 pcs, 1 lot, $5,000",
        validityDate: "Validity of terms",
        coverage: "Coverage / delivery location",
        coveragePlaceholder: "Local, national, offshore...",
        status: "Status",
        observations: "Commercial remarks"
      },
      typeOptions: {
        product: "Product",
        service: "Service",
        rent: "Rental",
        consumable: "Consumable",
        sparePart: "Spare Part",
        equipment: "Equipment",
        storage: "Storage",
        tool: "Tool",
        other: "Other/add new type"
      },
      categoryOptions: {
        storage: "Storage",
        consumables: "Consumables",
        safety: "PPE & Safety",
        equipment: "Equipment",
        tools: "Tools",
        materials: "Materials",
        spareParts: "Spare Parts",
        rental: "Equipment Rental",
        services: "Services",
        tech: "Tech & Telecom",
        logistics: "Transport & Logistics",
        others: "Others"
      },
      timeUnits: {
        businessDays: "Business days",
        calendarDays: "Calendar days",
        weeks: "Weeks",
        months: "Months"
      },
      creditTypes: {
        cash: "Cash",
        advance: "Advance payment",
        credit: "Credit",
        cod: "Cash on delivery",
        installments: "Installments",
        consignment: "Consignment",
        others: "Others"
      },
      statusOptions: {
        active: "Active",
        inactive: "Inactive",
        unavailable: "Unavailable"
      },
      buttons: {
        save: "Save supply",
        clear: "Clear",
        matrix: "View matrix"
      }
    },
    matrixTab: {
      title: "Products, Services, and Terms Matrix",
      subtitle: "Check what each supplier offers and their agreed terms.",
      newSupplyBtn: "New supply",
      allSuppliers: "All suppliers",
      searchPlaceholder: "Search product, service, category, brand, or model...",
      allStatuses: "All statuses",
      cardsTitle: "Supplier Cards",
      cardsSub: "Select a supplier to view only their products, services, and conditions.",
      recordsLoaded: "record(s) loaded",
      generalView: "General View",
      statRecords: "Records",
      statActive: "Active",
      statOthers: "Others",
      openAll: "Open all",
      recordsShown: "records shown",
      table: {
        supplier: "SUPPLIER",
        item: "PRODUCT / SERVICE",
        type: "TYPE",
        category: "CATEGORY",
        brand: "BRAND",
        delivery: "DELIVERY TIME",
        credit: "CREDIT TYPE",
        status: "STATUS",
        noData: "No supply records available."
      }
    },
    commercialTab: {
      title: "Supplier Commercial Summary",
      subtitle: "Summarizes products, lead times, and credit terms.",
      selectSupplier: "Select supplier...",
      noSelection: "Select a supplier to view their commercial summary.",
      kpi: {
        registered: "Registered supplies",
        active: "active",
        categories: "Categories",
        materials: "Materials",
        avgDelivery: "Avg. Delivery",
        businessDays: "Business days",
        creditDays: "Habitual credit days",
        credit: "Credit",
        rating: "Rating",
        outOf100: "out of 100 points"
      },
      details: {
        generalCategory: "General category:",
        generalCategoryVal: "Materials & supplies",
        habitualCurrency: "Habitual currency:",
        habitualDelivery: "Habitual delivery:",
        habitualCredit: "Habitual credit:",
        registeredConds: "Terms registered per supply",
        creditTypes: "Credit types:",
        creditTypesVal: "Cash / Credit",
        coverage: "Coverage:",
        coverageVal: "National",
        activeItems: "Active products & services:"
      }
    },
    notifications: {
      navigating: "Navigating to:",
      cleared: "Form fields reset.",
      requiredError: "Please complete required fields: Supplier and Product / Service.",
      saved: "Supply Saved",
      savedDesc: "Registered"
    }
  }
};

export function SupplierSupply({ onNavigate = () => {}, onNotify, language = 'es', lang }) {
  // Acepta tanto 'language' como 'lang' para máxima compatibilidad con el App
  const currentLang = lang || language || 'es';
  const t = translations[currentLang] || translations.es;

  // Estado para controlar la tarjeta activa
  const [activeTab, setActiveTab] = useState('register');

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [showTableMatrix, setShowTableMatrix] = useState(false);

  // Estados del formulario "Registro de suministro"
  const [formData, setFormData] = useState({
    supplier: '',
    item: '',
    type: 'Producto',
    category: 'Materiales',
    brand: '',
    model: '',
    description: '',
    deliveryTime: '',
    timeUnit: 'Días hábiles',
    creditType: 'Contado',
    creditDays: '',
    currency: 'MXN',
    minOrder: '',
    validityDate: '',
    coverage: 'Nacional',
    status: 'Activo',
    observations: '',
  });

  // Base de datos local para la matriz de suministros
  const [suppliesData, setSuppliesData] = useState([
    {
      id: 'SUM-001',
      supplier: 'Aceros y Perfiles del Norte S.A.',
      item: 'Viga IPR 8" x 15 lb/ft',
      type: 'Producto',
      category: 'Materiales',
      brand: 'Ternium',
      deliveryTime: '3 Días hábiles',
      creditType: 'Crédito (30 días)',
      currency: 'MXN',
      status: 'Activo'
    },
    {
      id: 'SUM-002',
      supplier: 'Suministros Industriales Tampico',
      item: 'Servicio de Mantenimiento Preventivo a Compresores',
      type: 'Servicio',
      category: 'Servicios',
      brand: 'N/A',
      deliveryTime: '1 Días hábiles',
      creditType: 'Contado',
      currency: 'MXN',
      status: 'Activo'
    }
  ]);

  // Configuración de las 3 tarjetas superiores dinámicas
  const cards = [
    {
      id: 'register',
      title: t.cards.register.title,
      description: t.cards.register.description,
      emoji: '📝',
    },
    {
      id: 'matrix',
      title: t.cards.matrix.title,
      description: t.cards.matrix.description,
      emoji: '📋',
    },
    {
      id: 'commercial',
      title: t.cards.commercial.title,
      description: t.cards.commercial.description,
      emoji: '📊',
    },
  ];

  const handleTabChange = (tabId, tabTitle) => {
    setActiveTab(tabId);
    if (onNotify) {
      onNotify(t.headerTitle, `${t.notifications.navigating} ${tabTitle}`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFormData({
      supplier: '',
      item: '',
      type: 'Producto',
      category: 'Materiales',
      brand: '',
      model: '',
      description: '',
      deliveryTime: '',
      timeUnit: 'Días hábiles',
      creditType: 'Contado',
      creditDays: '',
      currency: 'MXN',
      minOrder: '',
      validityDate: '',
      coverage: 'Nacional',
      status: 'Activo',
      observations: '',
    });
    if (onNotify) {
      onNotify(t.headerTitle, t.notifications.cleared);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.supplier || !formData.item) {
      if (onNotify) {
        onNotify(t.headerTitle, t.notifications.requiredError, 'warning');
      }
      return;
    }

    const newSupply = {
      id: `SUM-00${suppliesData.length + 1}`,
      supplier: formData.supplier,
      item: formData.item,
      type: formData.type,
      category: formData.category || 'General',
      brand: formData.brand || 'Generico',
      deliveryTime: `${formData.deliveryTime || '0'} ${formData.timeUnit}`,
      creditType: formData.creditType === 'Crédito' ? `Crédito (${formData.creditDays || 0} días)` : 'Contado',
      currency: formData.currency,
      status: formData.status
    };

    setSuppliesData([...suppliesData, newSupply]);

    if (onNotify) {
      onNotify(t.notifications.saved, `${t.notifications.savedDesc} "${formData.item}"`);
    }

    handleReset();
  };

  const filteredSupplies = suppliesData.filter((supply) => {
    const matchesSupplier = selectedSupplier === '' || supply.supplier === selectedSupplier;
    return matchesSupplier;
  });

  return (
    <div className="space-y-6">
      {/* Header General */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{t.headerTitle}</h2>
          <p className="text-xs text-slate-500">{t.headerSubtitle}</p>
        </div>
      </div>

      {/* Grid de las 3 Tarjetas Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        {/* TARJETA 1: Registro de suministro */}
        {activeTab === 'register' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2">
              <div>
                <h3 className="text-base font-black text-slate-900">{t.registerTab.title}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.registerTab.subtitle}
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 font-bold text-[10px] rounded-full border border-purple-200">
                {t.registerTab.tag}
              </span>
            </div>

            {/* Banner Verde 1 */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/60 rounded-xl text-xs text-emerald-950">
              <span className="font-extrabold block mb-0.5">{t.registerTab.bannerTitle}</span>
              <span>{t.registerTab.bannerText}</span>
            </div>

            {/* Formulario principal */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              {/* Fila 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.labels.supplier} <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">{t.registerTab.labels.supplierSelect}</option>
                    <option value="Aceros y Perfiles del Norte S.A.">Aceros y Perfiles del Norte S.A.</option>
                    <option value="Suministros Industriales Tampico">Suministros Industriales Tampico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.labels.item} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="item"
                    value={formData.item}
                    onChange={handleInputChange}
                    placeholder={t.registerTab.labels.itemPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Fila 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.type}</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="Producto">{t.registerTab.typeOptions.product}</option>
                    <option value="Servicio">{t.registerTab.typeOptions.service}</option>
                    <option value="Renta">{t.registerTab.typeOptions.rent}</option>
                    <option value="Consumible">{t.registerTab.typeOptions.consumable}</option>
                    <option value="Refacción">{t.registerTab.typeOptions.sparePart}</option>
                    <option value="Equipo">{t.registerTab.typeOptions.equipment}</option>
                    <option value="Almacenamiento">{t.registerTab.typeOptions.storage}</option>
                    <option value="Herramienta">{t.registerTab.typeOptions.tool}</option>
                    <option value="Otro/agregar nuevo tipo">{t.registerTab.typeOptions.other}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.category}</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="">{t.registerTab.labels.categorySelect}</option>
                    <option value="Almacenamiento">{t.registerTab.categoryOptions.storage}</option>
                    <option value="Consumibles">{t.registerTab.categoryOptions.consumables}</option>
                    <option value="EPP y seguridad">{t.registerTab.categoryOptions.safety}</option>
                    <option value="Equipos">{t.registerTab.categoryOptions.equipment}</option>
                    <option value="Herramientas">{t.registerTab.categoryOptions.tools}</option>
                    <option value="Materiales">{t.registerTab.categoryOptions.materials}</option>
                    <option value="Refacciones">{t.registerTab.categoryOptions.spareParts}</option>
                    <option value="Renta de equipo">{t.registerTab.categoryOptions.rental}</option>
                    <option value="Servicios">{t.registerTab.categoryOptions.services}</option>
                    <option value="Tecnología y comunicación">{t.registerTab.categoryOptions.tech}</option>
                    <option value="Transporte y logística">{t.registerTab.categoryOptions.logistics}</option>
                    <option value="Otros">{t.registerTab.categoryOptions.others}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.brand}</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.model}</label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Fila 3 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t.registerTab.labels.description}
                </label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 resize-y"
                />
              </div>

              {/* Fila 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.deliveryTime}</label>
                  <input
                    type="text"
                    name="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.timeUnit}</label>
                  <select
                    name="timeUnit"
                    value={formData.timeUnit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="Días hábiles">{t.registerTab.timeUnits.businessDays}</option>
                    <option value="Días naturales">{t.registerTab.timeUnits.calendarDays}</option>
                    <option value="Semanas">{t.registerTab.timeUnits.weeks}</option>
                    <option value="Meses">{t.registerTab.timeUnits.months}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.creditType}</label>
                  <select
                    name="creditType"
                    value={formData.creditType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="Contado">{t.registerTab.creditTypes.cash}</option>
                    <option value="Anticipo">{t.registerTab.creditTypes.advance}</option>
                    <option value="Crédito">{t.registerTab.creditTypes.credit}</option>
                    <option value="Contra entrega">{t.registerTab.creditTypes.cod}</option>
                    <option value="Parcialidades">{t.registerTab.creditTypes.installments}</option>
                    <option value="Consignación">{t.registerTab.creditTypes.consignment}</option>
                    <option value="Otros">{t.registerTab.creditTypes.others}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.creditDays}</label>
                  <input
                    type="number"
                    name="creditDays"
                    value={formData.creditDays}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Fila 5 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.currency}</label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.minOrder}</label>
                  <input
                    type="text"
                    name="minOrder"
                    value={formData.minOrder}
                    onChange={handleInputChange}
                    placeholder={t.registerTab.labels.minOrderPlaceholder}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.validityDate}</label>
                  <input
                    type="date"
                    name="validityDate"
                    value={formData.validityDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Fila 6 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t.registerTab.labels.coverage}
                  </label>
                  <input
                    type="text"
                    name="coverage"
                    value={formData.coverage}
                    onChange={handleInputChange}
                    placeholder={t.registerTab.labels.coveragePlaceholder}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">{t.registerTab.labels.status}</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none"
                  >
                    <option value="Activo">{t.registerTab.statusOptions.active}</option>
                    <option value="Inactivo">{t.registerTab.statusOptions.inactive}</option>
                    <option value="No disponible">{t.registerTab.statusOptions.unavailable}</option>
                  </select>
                </div>
              </div>

              {/* Fila 7 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {t.registerTab.labels.observations}
                </label>
                <textarea
                  name="observations"
                  rows={3}
                  value={formData.observations}
                  onChange={handleInputChange}
                  className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 resize-y"
                />
              </div>

              {/* Botonera */}
              <div className="flex flex-wrap items-center gap-3 pt-4">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-transparent"
                  style={{ backgroundColor: '#a221b7' }}
                >
                  <span className="text-sm">💾</span>
                  <span>{t.registerTab.buttons.save}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">🪄</span>
                  <span>{t.registerTab.buttons.clear}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('matrix', t.cards.matrix.title)}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">📋</span>
                  <span>{t.registerTab.buttons.matrix}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TARJETA 2: Matriz de suministros */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
              <div>
                <h3 className="text-lg font-black text-slate-900">{t.matrixTab.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.matrixTab.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('register', t.cards.register.title)}
                className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-95"
                style={{ backgroundColor: '#a221b7' }}
              >
                <span className="text-sm font-black">+</span>
                <span>{t.matrixTab.newSupplyBtn}</span>
              </button>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
              <div className="md:col-span-3">
                <select 
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-purple-500 outline-none shadow-xs"
                >
                  <option value="">{t.matrixTab.allSuppliers}</option>
                  <option value="Aceros y Perfiles del Norte S.A.">Aceros y Perfiles del Norte S.A.</option>
                  <option value="Suministros Industriales Tampico">Suministros Industriales Tampico</option>
                </select>
              </div>

              <div className="md:col-span-6">
                <input
                  type="text"
                  placeholder={t.matrixTab.searchPlaceholder}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-700 shadow-xs"
                />
              </div>

              <div className="md:col-span-3">
                <select className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-xs font-semibold">
                  <option value="">{t.matrixTab.allStatuses}</option>
                  <option value="Activo">{t.registerTab.statusOptions.active}</option>
                  <option value="Inactivo">{t.registerTab.statusOptions.inactive}</option>
                  <option value="No disponible">{t.registerTab.statusOptions.unavailable}</option>
                </select>
              </div>
            </div>

            {/* Tarjetas por proveedor */}
            <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-800">{t.matrixTab.cardsTitle}</h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {t.matrixTab.cardsSub}
                  </p>
                </div>
                <span className="text-[10px] font-extrabold text-slate-500">
                  {suppliesData.length} {t.matrixTab.recordsLoaded}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-xs relative overflow-hidden border-l-4 border-l-purple-600 flex flex-col justify-between h-28">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 uppercase">
                      TOD
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="text-[11px] font-black text-slate-800 truncate leading-tight">
                        {t.matrixTab.allSuppliers}
                      </h5>
                      <span className="text-[9px] text-slate-400 font-semibold block">{t.matrixTab.generalView}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center border-t border-slate-100 pt-1.5 my-1">
                    <div>
                      <p className="text-[11px] font-black text-slate-800">{suppliesData.length}</p>
                      <p className="text-[8px] text-slate-400 font-semibold uppercase">{t.matrixTab.statRecords}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800">
                        {suppliesData.filter(s => s.status === 'Activo').length}
                      </p>
                      <p className="text-[8px] text-slate-400 font-semibold uppercase">{t.matrixTab.statActive}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800">
                        {suppliesData.filter(s => s.status !== 'Activo').length}
                      </p>
                      <p className="text-[8px] text-slate-400 font-semibold uppercase">{t.matrixTab.statOthers}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTableMatrix(true)}
                    className="text-[10px] font-bold text-slate-500 hover:text-purple-700 flex items-center justify-between w-full pt-1 border-t border-slate-50 cursor-pointer"
                  >
                    <span>{t.matrixTab.openAll}</span>
                    <span>›</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Matriz Desplegable */}
            {showTableMatrix && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4 pt-4">
                <div className="flex justify-between items-center p-3 bg-slate-50/70 border border-slate-100 rounded-xl">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{t.matrixTab.allSuppliers}</h4>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {filteredSupplies.length} {t.matrixTab.recordsShown}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTableMatrix(false)}
                    className="w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200/80">
                          <th className="py-3 px-3">{t.matrixTab.table.supplier}</th>
                          <th className="py-3 px-3">{t.matrixTab.table.item}</th>
                          <th className="py-3 px-3">{t.matrixTab.table.type}</th>
                          <th className="py-3 px-3">{t.matrixTab.table.category}</th>
                          <th className="py-3 px-3">{t.matrixTab.table.brand}</th>
                          <th className="py-3 px-3">{t.matrixTab.table.delivery}</th>
                          <th className="py-3 px-3">{t.matrixTab.table.credit}</th>
                          <th className="py-3 px-3">{t.matrixTab.table.status}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredSupplies.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400">
                              {t.matrixTab.table.noData}
                            </td>
                          </tr>
                        ) : (
                          filteredSupplies.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-bold text-slate-800">{item.supplier}</td>
                              <td className="py-2.5 px-3 text-slate-700">{item.item}</td>
                              <td className="py-2.5 px-3 text-slate-600">{item.type}</td>
                              <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                              <td className="py-2.5 px-3 text-slate-500">{item.brand}</td>
                              <td className="py-2.5 px-3 text-slate-600">{item.deliveryTime}</td>
                              <td className="py-2.5 px-3 text-slate-600">{item.creditType}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {item.status === 'Activo' ? t.registerTab.statusOptions.active : item.status}
                                </span>
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
          </div>
        )}

        {/* TARJETA 3: Resumen comercial */}
        {activeTab === 'commercial' && (
          <div className="space-y-5">
            <div className="pb-2 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">{t.commercialTab.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.commercialTab.subtitle}
              </p>
            </div>

            <div>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full md:w-80 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
              >
                <option value="">{t.commercialTab.selectSupplier}</option>
                <option value="Aceros y Perfiles del Norte S.A.">Aceros y Perfiles del Norte S.A.</option>
                <option value="Suministros Industriales Tampico">Suministros Industriales Tampico</option>
              </select>
            </div>

            {!selectedSupplier ? (
              <div className="p-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/40 text-center text-slate-500 text-xs font-medium">
                {t.commercialTab.noSelection}
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-purple-600 shadow-2xs space-y-1">
                    <span className="text-2xl font-black text-slate-900 block leading-none">
                      {suppliesData.filter(s => s.supplier === selectedSupplier).length}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium block">{t.commercialTab.kpi.registered}</span>
                    <span className="text-[11px] text-purple-600 font-bold block">
                      {suppliesData.filter(s => s.supplier === selectedSupplier && s.status === 'Activo').length} {t.commercialTab.kpi.active}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-blue-600 shadow-2xs space-y-1">
                    <span className="text-2xl font-black text-slate-900 block leading-none">1</span>
                    <span className="text-[11px] text-slate-400 font-medium block">{t.commercialTab.kpi.categories}</span>
                    <span className="text-[11px] text-blue-600 font-bold block">{t.commercialTab.kpi.materials}</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-orange-500 shadow-2xs space-y-1">
                    <span className="text-2xl font-black text-slate-900 block leading-none">3</span>
                    <span className="text-[11px] text-slate-400 font-medium block">{t.commercialTab.kpi.avgDelivery}</span>
                    <span className="text-[11px] text-orange-600 font-bold block">{t.commercialTab.kpi.businessDays}</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-emerald-600 shadow-2xs space-y-1">
                    <span className="text-2xl font-black text-slate-900 block leading-none">30</span>
                    <span className="text-[11px] text-slate-400 font-medium block">{t.commercialTab.kpi.creditDays}</span>
                    <span className="text-[11px] text-emerald-600 font-bold block">{t.commercialTab.kpi.credit}</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 border-t-4 border-t-teal-500 shadow-2xs space-y-1">
                    <span className="text-2xl font-black text-slate-900 block leading-none">100</span>
                    <span className="text-[11px] text-slate-400 font-medium block">{t.commercialTab.kpi.rating}</span>
                    <span className="text-[11px] text-teal-600 font-bold block">{t.commercialTab.kpi.outOf100}</span>
                  </div>
                </div>

                {/* Detalles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="bg-blue-50/50 p-5 rounded-xl border-l-4 border-l-blue-600 border border-blue-100/60 space-y-1.5 text-xs">
                    <h4 className="font-extrabold text-slate-900 mb-2">{selectedSupplier}</h4>
                    <p className="text-slate-600 font-medium">
                      {t.commercialTab.details.generalCategory} <span className="text-slate-700">{t.commercialTab.details.generalCategoryVal}</span>
                    </p>
                    <p className="text-slate-600 font-medium">
                      {t.commercialTab.details.habitualCurrency} <span className="text-slate-700">MXN</span>
                    </p>
                    <p className="text-slate-600 font-medium">
                      {t.commercialTab.details.habitualDelivery} <span className="text-slate-700">3 {t.commercialTab.kpi.businessDays}</span>
                    </p>
                    <p className="text-slate-600 font-medium">
                      {t.commercialTab.details.habitualCredit} <span className="text-slate-700">{t.commercialTab.kpi.credit} · 30 días</span>
                    </p>
                  </div>

                  <div className="bg-emerald-50/40 p-5 rounded-xl border-l-4 border-l-emerald-600 border border-emerald-100/60 space-y-1.5 text-xs">
                    <h4 className="font-extrabold text-slate-900 mb-2">{t.commercialTab.details.registeredConds}</h4>
                    <p className="text-slate-600 font-medium">
                      {t.commercialTab.details.creditTypes} <span className="text-slate-700">{t.commercialTab.details.creditTypesVal}</span>
                    </p>
                    <p className="text-slate-600 font-medium">
                      {t.commercialTab.details.coverage} <span className="text-slate-700">{t.commercialTab.details.coverageVal}</span>
                    </p>
                    <p className="text-slate-600 font-medium">
                      {t.commercialTab.details.activeItems} <span className="text-slate-700">{suppliesData.filter(s => s.supplier === selectedSupplier).length}</span>
                    </p>
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