import React, { useState, useMemo } from 'react';
import { 
  HardHat, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  Edit3, 
  Upload, 
  Building2, 
  ShieldCheck, 
  Phone, 
  Mail, 
  MapPin, 
  UserCheck 
} from 'lucide-react';

export function Contractors({ onNavigate = () => {}, onNotify, lang = 'es' }) {
  const isEs = lang === 'es';

  // Estado para la tarjeta activa ('contractorData', 'matrix', 'identity')
  const [activeTab, setActiveTab] = useState('contractorData');

  // Estado del formulario de Registro
  const initialFormState = {
    code: '',
    rfc: '',
    companyName: '',
    commercialName: '',
    specialty: 'Obra Civil',
    status: 'Activo',
    repseCode: '',
    phone: '',
    email: '',
    address: '',
    legalRepresentative: '',
    safetySupervisor: '',
    observations: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [contacts, setContacts] = useState(['']);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Estados de la Matriz
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contractorsData, setContractorsData] = useState([
    {
      id: 'CON-001',
      code: 'CTR-2026-01',
      rfc: 'CME010101ABC',
      companyName: 'Construcciones y Montajes Electromecánicos S.A.',
      commercialName: 'CME Estructuras',
      specialty: 'Estructuras Metálicas',
      repseCode: 'REPSE-89123-2024',
      status: 'Activo',
      contacts: ['Ing. Roberto Morales'],
      email: 'contacto@cmeestructuras.com',
      phone: '+52 833 210 9876',
      logo: null
    },
    {
      id: 'CON-002',
      code: 'CTR-2026-02',
      rfc: 'ISA020202XYZ',
      companyName: 'Ingeniería y Soldadura Aplicada S. de R.L.',
      commercialName: 'ISA Piping',
      specialty: 'Tuberías y Pailería',
      repseCode: 'REPSE-45678-2025',
      status: 'En regla',
      contacts: ['Lic. Patricia Solís'],
      email: 'ventas@isapiping.com',
      phone: '+52 833 312 4567',
      logo: null
    }
  ]);

  // Configuración dinámica de las 3 tarjetas superiores según idioma
  const cards = useMemo(() => [
    {
      id: 'contractorData',
      title: isEs ? 'Datos del contratista' : 'Contractor Details',
      description: isEs ? 'Alta o edición de una empresa contratista.' : 'Registration or editing of a contractor company.',
      emoji: '🏗️',
    },
    {
      id: 'matrix',
      title: isEs ? 'Matriz de contratistas' : 'Contractors Matrix',
      description: isEs ? 'Consulta empresas, logotipos, datos generales y estatus.' : 'View companies, logos, general data, and status.',
      emoji: '📋',
    },
    {
      id: 'identity',
      title: isEs ? 'Identidad y logotipo' : 'Identity and logo',
      description: isEs ? 'Logotipo independiente para cada contratista.' : 'Independent logo for each contractor.',
      emoji: '🖼️',
    },
  ], [isEs]);

  const handleTabChange = (tabId, tabTitle) => {
    setActiveTab(tabId);
    if (onNotify) {
      onNotify(
        isEs ? 'Módulo Contratistas' : 'Contractors Module', 
        `${isEs ? 'Navegando a' : 'Navigating to'}: ${tabTitle}`
      );
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddContact = () => setContacts([...contacts, '']);
  const handleRemoveContact = (index) => setContacts(contacts.filter((_, i) => i !== index));
  const handleContactChange = (index, value) => {
    const updated = [...contacts];
    updated[index] = value;
    setContacts(updated);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setLogoPreview(url);

      if (onNotify) {
        onNotify(
          isEs ? 'Identidad Visual' : 'Visual Identity', 
          isEs ? `Imagen "${file.name}" vinculada correctamente.` : `Image "${file.name}" successfully linked.`
        );
      }
    }
  };

  const handleRemoveLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    if (onNotify) {
      onNotify(
        isEs ? 'Identidad Visual' : 'Visual Identity', 
        isEs ? 'Se eliminó el logotipo de la captura.' : 'Logo removed from entry.'
      );
    }
  };

  const handleResetForm = () => {
    setFormData(initialFormState);
    setContacts(['']);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    if (onNotify) {
      onNotify(
        isEs ? 'Formulario Contratistas' : 'Contractors Form', 
        isEs ? 'Formulario de registro reiniciado.' : 'Registration form reset.'
      );
    }
  };

  const handleSaveContractor = (e) => {
    e.preventDefault();
    if (!formData.companyName) {
      if (onNotify) {
        onNotify(
          isEs ? 'Registro de Contratista' : 'Contractor Registration', 
          isEs ? 'Debe especificar la Razón Social del contratista.' : 'You must specify the Contractor Company Name.', 
          'warning'
        );
      }
      return;
    }

    const newContractor = {
      id: `CON-00${contractorsData.length + 1}`,
      code: formData.code || `CTR-2026-0${contractorsData.length + 1}`,
      rfc: formData.rfc || 'XAXX010101000',
      companyName: formData.companyName,
      commercialName: formData.commercialName || formData.companyName,
      specialty: formData.specialty,
      repseCode: formData.repseCode || (isEs ? 'Sin REPSE' : 'No REPSE'),
      status: formData.status,
      contacts: contacts.filter((c) => c.trim() !== ''),
      email: formData.email || (isEs ? 'Sin correo' : 'No email'),
      phone: formData.phone || (isEs ? 'Sin teléfono' : 'No phone'),
      logo: logoPreview
    };

    setContractorsData([...contractorsData, newContractor]);

    if (onNotify) {
      onNotify(
        isEs ? 'Contratista Registrado' : 'Contractor Registered', 
        isEs ? `Se guardó "${formData.companyName}" correctamente.` : `"${formData.companyName}" saved successfully.`
      );
    }

    handleResetForm();
  };

  // Función para eliminar un contratista
  const handleDeleteContractor = (id, companyName) => {
    const confirmMsg = isEs
      ? `¿Estás seguro de que deseas eliminar a "${companyName}"?`
      : `Are you sure you want to delete "${companyName}"?`;

    if (window.confirm(confirmMsg)) {
      setContractorsData((prev) => prev.filter((item) => item.id !== id));
      if (onNotify) {
        onNotify(
          isEs ? 'Contratista Eliminado' : 'Contractor Deleted',
          isEs ? `Se eliminó "${companyName}" de la matriz.` : `"${companyName}" was removed from matrix.`
        );
      }
    }
  };

  const filteredContractors = contractorsData.filter((contractor) => {
    const matchesSearch =
      contractor.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contractor.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contractor.rfc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contractor.specialty.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || contractor.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header General */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isEs ? 'Contratistas' : 'Contractors'}
          </h2>
          <p className="text-xs text-slate-500">
            {isEs 
              ? 'Administración y control de personal externo y contratistas.' 
              : 'Management and control of external personnel and contractors.'}
          </p>
        </div>
      </div>

      {/* Grid de las 3 Tarjetas Superiores (Navegación) */}
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
        {/* TARJETA 1: Datos del contratista */}
        {activeTab === 'contractorData' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isEs ? 'Datos generales del contratista' : 'General Contractor Data'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isEs 
                    ? 'Registra una empresa. Al guardar, la captura se limpiará y el registro pasará a la matriz.' 
                    : 'Register a company. Upon saving, entry will clear and the record will move to the matrix.'}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-[10px] rounded-full border border-blue-100">
                {isEs ? 'Captura disponible' : 'Data Entry Available'}
              </span>
            </div>

            {/* Banner Informativo Morado */}
            <div className="p-3.5 bg-purple-50/60 border-l-4 border-l-purple-600 border border-purple-100/60 rounded-r-xl text-xs text-slate-700">
              <span className="font-extrabold text-slate-900">
                {isEs ? 'Contratista activo: ' : 'Active Contractor: '}
              </span>
              <span className="font-medium">
                {isEs 
                  ? 'Sus datos y logotipo se utilizan en órdenes de compra, RFQ y reportes.' 
                  : 'Its data and logo are used in purchase orders, RFQs, and reports.'}
              </span>
            </div>

            {/* Formulario principal */}
            <form onSubmit={handleSaveContractor} className="space-y-4 pt-1">
              {/* Fila 1: Razón social, RFC, Teléfono */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isEs ? 'Razón social / nombre de la empresa' : 'Company Name / Legal Name'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isEs ? 'RFC / Tax ID' : 'Tax ID / RFC'}
                  </label>
                  <input
                    type="text"
                    name="rfc"
                    value={formData.rfc}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isEs ? 'Teléfono de la empresa' : 'Company Phone'}
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Fila 2: Correo y Dirección */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isEs ? 'Correo de la empresa' : 'Company Email'}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div className="md:col-span-9">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isEs ? 'Dirección' : 'Address'}
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              {/* Fila 3: Estatus */}
              <div className="w-full md:w-80">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isEs ? 'Estatus' : 'Status'}
                </label>
                <select 
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 outline-none font-medium"
                >
                  <option value="Activo">{isEs ? 'Activo' : 'Active'}</option>
                  <option value="Inactivo">{isEs ? 'Inactivo' : 'Inactive'}</option>
                </select>
              </div>

              {/* Botonera de acciones */}
              <div className="flex flex-wrap items-center gap-2.5 pt-4">
                {/* Botón Guardar contratista */}
                <button
                  type="submit"
                  className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer border border-transparent hover:opacity-90"
                  style={{ backgroundColor: '#a221b7' }}
                >
                  <span className="text-sm">💾</span>
                  <span>{isEs ? 'Guardar contratista' : 'Save Contractor'}</span>
                </button>

                {/* Botón Limpiar */}
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">🪄</span>
                  <span>{isEs ? 'Limpiar' : 'Clear'}</span>
                </button>

                {/* Botón Ver matriz */}
                <button
                  type="button"
                  onClick={() => handleTabChange('matrix', isEs ? 'Matriz de contratistas' : 'Contractors Matrix')}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">📋</span>
                  <span>{isEs ? 'Ver matriz' : 'View Matrix'}</span>
                </button>

                {/* Botón Agregar logotipo */}
                <button
                  type="button"
                  onClick={() => handleTabChange('identity', isEs ? 'Identidad y logotipo' : 'Identity & Logo')}
                  className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <span className="text-sm">🖼️</span>
                  <span>{isEs ? 'Agregar logotipo' : 'Add Logo'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TARJETA 2: Matriz de contratistas */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isEs ? 'Matriz de contratistas' : 'Contractors Matrix'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isEs 
                    ? 'Cada empresa conserva sus datos generales y logotipo. Selecciona una como activa para documentos y operaciones.' 
                    : 'Each company retains its general data and logo. Select one as active for documents and operations.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('contractorData', isEs ? 'Datos del contratista' : 'Contractor Details')}
                className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                style={{ backgroundColor: '#a221b7' }}
              >
                <span className="text-sm font-black">+</span>
                <span>{isEs ? 'Nuevo contratista' : 'New Contractor'}</span>
              </button>
            </div>

            {/* Buscador general */}
            <div>
              <input
                type="text"
                placeholder={isEs ? "Buscar por empresa, RFC, correo o dirección..." : "Search by company, Tax ID, email or address..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
              />
            </div>

            {/* Selector de filtro por estatus */}
            <div>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 outline-none shadow-2xs"
              >
                <option value="all">{isEs ? 'Todos los estatus' : 'All Statuses'}</option>
                <option value="Activo">{isEs ? 'Activo' : 'Active'}</option>
                <option value="Inactivo">{isEs ? 'Inactivo' : 'Inactive'}</option>
              </select>
            </div>

            {/* Estructura de la Tabla de la Matriz */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-2xs mt-2">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200/80">
                    <th className="py-3 px-3">{isEs ? 'Logo' : 'Logo'}</th>
                    <th className="py-3 px-3">{isEs ? 'Empresa' : 'Company'}</th>
                    <th className="py-3 px-3">{isEs ? 'RFC / Tax ID' : 'Tax ID / RFC'}</th>
                    <th className="py-3 px-3">{isEs ? 'Contacto General' : 'General Contact'}</th>
                    <th className="py-3 px-3">{isEs ? 'Dirección' : 'Address'}</th>
                    <th className="py-3 px-3">{isEs ? 'Estatus' : 'Status'}</th>
                    <th className="py-3 px-3">{isEs ? 'Uso' : 'Usage'}</th>
                    <th className="py-3 px-3 text-center">{isEs ? 'Acciones' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredContractors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <p className="font-semibold text-slate-600 text-xs">
                          {isEs ? 'Sin contratistas registrados' : 'No registered contractors'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {isEs 
                            ? 'Usa el botón "Nuevo contratista" para dar de alta una empresa en el sistema.' 
                            : 'Use the "New Contractor" button to register a company in the system.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredContractors.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          {c.logo ? (
                            <img src={c.logo} alt="Logo" className="w-8 h-8 object-contain rounded" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[10px]">
                              N/A
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{c.companyName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{c.rfc}</td>
                        <td className="py-2.5 px-3 text-slate-600">{c.phone} / {c.email}</td>
                        <td className="py-2.5 px-3 text-slate-500">{c.address || 'N/A'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'Activo' || c.status === 'En regla' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {c.status === 'Activo' ? (isEs ? 'Activo' : 'Active') : c.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{isEs ? 'General' : 'General'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              type="button" 
                              className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                              onClick={() => {
                                setFormData({
                                  ...initialFormState,
                                  companyName: c.companyName,
                                  rfc: c.rfc,
                                  phone: c.phone,
                                  email: c.email,
                                  status: c.status
                                });
                                handleTabChange('contractorData', isEs ? 'Datos del contratista' : 'Contractor Details');
                              }}
                            >
                              {isEs ? 'Editar' : 'Edit'}
                            </button>
                            <button 
                              type="button" 
                              className="text-red-600 hover:text-red-800 font-bold cursor-pointer"
                              onClick={() => handleDeleteContractor(c.id, c.companyName)}
                            >
                              {isEs ? 'Eliminar' : 'Delete'}
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

        {/* TARJETA 3: Identidad y logotipo */}
        {activeTab === 'identity' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isEs ? 'Identidad corporativa por contratista' : 'Corporate Identity per Contractor'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isEs 
                    ? 'El logotipo se guarda dentro del registro que estás creando o editando.' 
                    : 'The logo is saved within the record you are creating or editing.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('matrix', isEs ? 'Matriz de contratistas' : 'Contractors Matrix')}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <span className="text-sm">📋</span>
                <span>{isEs ? 'Ver matriz' : 'View Matrix'}</span>
              </button>
            </div>

            {/* Banner Informativo Verde */}
            <div className="p-3.5 bg-emerald-50/50 border-l-4 border-l-emerald-600 border border-emerald-100/60 rounded-r-xl text-xs text-slate-700">
              <span className="font-extrabold text-slate-900">
                {isEs ? 'Logotipo de: ' : 'Logo of: '}
              </span>
              <span className="font-medium">
                {formData.companyName ? formData.companyName : (isEs ? 'Captura actual' : 'Current Entry')}
              </span>
            </div>

            {/* Recuadro punteado con controles de logotipo */}
            <div className="p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Cuadro de vista previa del logotipo */}
                <div className="w-36 h-28 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center p-2 text-center shrink-0 overflow-hidden shadow-2xs">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Vista previa del logotipo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {isEs ? 'Sin logotipo' : 'No Logo'}
                    </span>
                  )}
                </div>

                {/* Sección de entrada de archivo y botones de acción */}
                <div className="w-full space-y-4">
                  <div>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleLogoChange}
                      className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-l-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {isEs 
                        ? 'Formatos permitidos: PNG, JPG o WEBP. Cada contratista puede tener un logotipo diferente.' 
                        : 'Allowed formats: PNG, JPG, or WEBP. Each contractor can have a different logo.'}
                    </p>
                  </div>

                  {/* Botonera de acciones */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={(e) => handleSaveContractor(e)}
                      className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:opacity-90 border border-transparent"
                      style={{ backgroundColor: '#a221b7' }}
                    >
                      <span className="text-sm">💾</span>
                      <span>{isEs ? 'Guardar contratista y logotipo' : 'Save Contractor & Logo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:opacity-90 border border-transparent"
                      style={{ backgroundColor: '#d91438' }}
                    >
                      <span>{isEs ? 'Eliminar logotipo de la captura' : 'Remove Logo from Entry'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}