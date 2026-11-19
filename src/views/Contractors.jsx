import React, { useState, useMemo, useEffect } from 'react';
import { listContractors, contractorPersonnel } from './contractors/api';
import { STATUS_FILTERS, contractorRow, matrixBadge, deleteBlock, activeText, personRow, editPrefill, displayName, serverQuery } from './contractors/model.mjs';
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
  UserCheck,
  Lock,
  Loader2,
  AlertCircle,
  X
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
  // Matriz conectada a MariaDB (GET /api/v1/contractors): sin datos de demostración.
  const [q, setQ] = useState('');
  const [rev, setRev] = useState(0);
  const [list, setList] = useState({ status: 'idle', data: null, error: null });
  const [actMsg, setActMsg] = useState(null);
  const [delDlg, setDelDlg] = useState(null);
  const [staff, setStaff] = useState(null); // { contractor, status, data, error }
  useEffect(() => { const t = setTimeout(() => setQ(searchTerm.trim()), 300); return () => clearTimeout(t); }, [searchTerm]);
  useEffect(() => {
    if (activeTab !== 'matrix') return undefined;
    const c = new AbortController();
    setList(x => ({ ...x, status: 'loading', error: null }));
    listContractors({ q: serverQuery(q), status: statusFilter }, c.signal).then(d => !c.signal.aborted && setList({ status: 'ready', data: d, error: null }))
      .catch(e => !c.signal.aborted && setList(x => ({ ...x, status: 'error', error: e })));
    return () => c.abort();
  }, [activeTab, q, statusFilter, rev]);
  const openStaff = c => {
    setStaff({ contractor: c, status: 'loading', data: null, error: null });
    contractorPersonnel(c.id).then(d => setStaff(x => x && x.contractor.id === c.id ? { ...x, status: 'ready', data: d } : x))
      .catch(e => setStaff(x => x && x.contractor.id === c.id ? { ...x, status: 'error', error: e } : x));
  };

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

    // Registrar o editar contratistas es una escritura sin endpoint autorizado: se valida y no se guarda.
    if (onNotify) {
      onNotify(
        isEs ? 'Contratista no guardado' : 'Contractor not saved',
        isEs ? `Datos validados, pero no se guardó "${formData.companyName}": registrar o editar contratistas y su logotipo es una escritura bloqueada hasta su autorización.` : `Data validated, but "${formData.companyName}" was not saved: registering or editing contractors and their logo is a write blocked until authorized.`,
        'warning'
      );
    }
  };

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

      {/* Estado de integración: la matriz lee MariaDB; las capturas validan y no guardan. */}
      <div data-testid="contractors-lock" className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{isEs ? 'Matriz de contratistas conectada a MariaDB (solo lectura). Datos del contratista e Identidad y logotipo validan la captura pero no la guardan: registrar o editar contratistas, su logotipo y su personal son escrituras bloqueadas hasta su autorización.' : 'Contractors matrix connected to MariaDB (read-only). Contractor details and Identity and logo validate the entry but do not save it: registering or editing contractors, their logo and personnel are writes blocked until authorized.'}</span></div>

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

        {/* TARJETA 2: Matriz de contratistas (MariaDB, solo lectura) */}
        {activeTab === 'matrix' && (() => {
          const tx = (es, e) => (isEs ? es : e);
          const TONES = { green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-800 border-amber-200', blue: 'bg-blue-50 text-blue-700 border-blue-200', gray: 'bg-slate-100 text-slate-600 border-slate-200', red: 'bg-rose-50 text-rose-700 border-rose-200' };
          const chip = c => <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border whitespace-nowrap ${TONES[c.tone] || TONES.gray}`}>{c.text}</span>;
          const items = list.data?.items || [];
          return (
          <div className="space-y-4" data-testid="contractors-matrix">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de contratistas', 'Contractors Matrix')}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{tx('Cada empresa conserva sus datos generales y logotipo. Selecciona una como activa para documentos y operaciones.', 'Each company keeps its general data and logo. Select one as active for documents and operations.')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 text-sm font-black">
                {list.data && <span data-testid="contractors-badge" className="text-[10.5px] font-black text-blue-800 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">{matrixBadge(list.data, !isEs)}</span>}
                <button type="button" onClick={() => { handleResetForm(); handleTabChange('contractorData', tx('Datos del contratista', 'Contractor Details')); }} className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl shadow-md text-sm font-black">+ {tx('Nuevo contratista', 'New contractor')}</button>
              </div>
            </div>

            <input type="search" aria-label={tx('Buscar contratista', 'Search contractor')} placeholder={tx('Buscar por empresa, RFC, correo o dirección...', 'Search by company, tax ID, email or address...')} value={searchTerm} maxLength={120} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none text-slate-700" />
            <select aria-label={tx('Estatus', 'Status')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20">
              {STATUS_FILTERS.map(([v, es, en]) => <option key={v} value={v}>{isEs ? es : en}</option>)}
            </select>

            {list.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
            {list.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{list.error.message}</p>}
            {actMsg && <p role="status" data-testid="contractors-msg" className="flex items-start gap-2 p-3 rounded-xl border text-xs bg-blue-50 border-blue-200 text-blue-900">{actMsg}</p>}

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse min-w-[1280px] text-[11px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">
                    {[tx('Logo', 'Logo'), tx('Empresa', 'Company'), 'RFC / Tax ID', tx('Contacto general', 'General contact'), tx('Dirección', 'Address'), tx('Responsable', 'Manager'), tx('Personal', 'Personnel'), tx('Estatus', 'Status'), tx('Uso', 'Use'), tx('Acciones', 'Actions')].map(h => <th key={h} className="py-3 px-3 whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.status === 'ready' && !items.length && <tr><td colSpan={10} className="py-12 text-center"><p className="font-semibold text-slate-600 text-xs">{tx('Sin contratistas con este filtro.', 'No contractors match this filter.')}</p><p className="text-[11px] text-slate-400 mt-1">{tx('Ajusta la búsqueda o el estatus.', 'Adjust the search or the status.')}</p></td></tr>}
                  {items.map(c => { const v = contractorRow(c, !isEs); return (
                    <tr key={c.id} data-testid="contractor-row" className="align-top hover:bg-slate-50/60">
                      <td className="p-3"><div className="w-20 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-1.5" title={v.logo.note}><img src={v.logo.src} alt={`${tx('Logotipo', 'Logo')} ${v.name}`} className="max-w-full max-h-full object-contain" /></div></td>
                      <td className="p-3 min-w-[170px]"><div className="font-black text-slate-900 text-xs leading-snug">{v.name}</div>{v.registered && <div data-testid="contractor-registered" className="text-[9.5px] text-amber-700 mt-1">{tx('Razón social registrada en MariaDB', 'Legal name recorded in MariaDB')}: {v.registered}</div>}<div className="text-[9.5px] text-slate-500 mt-1">{v.logo.note}</div></td>
                      <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{v.taxId}</td>
                      <td className="p-3 text-slate-700 min-w-[150px]"><div>{v.phone || '—'}</div><div className="text-[10px] text-slate-500 break-all">{v.email || '—'}</div></td>
                      <td className="p-3 text-slate-700 min-w-[200px] max-w-[260px]">{v.address}</td>
                      <td className="p-3">{chip(v.responsible)}{v.responsible.sub && <div className="text-[9.5px] text-slate-500 mt-1">{v.responsible.sub}</div>}</td>
                      <td className="p-3">{chip(v.personnel)}{v.personnel.sub && <div className="text-[9.5px] text-slate-500 mt-1 whitespace-nowrap">{v.personnel.sub}</div>}</td>
                      <td className="p-3">{chip(v.status)}</td>
                      <td className="p-3 min-w-[150px]">{chip(v.usage)}{v.usage.sub && <div className="text-[9.5px] text-slate-500 mt-1">{v.usage.sub}</div>}</td>
                      <td className="p-3"><div className="flex flex-wrap gap-1.5 min-w-[220px] text-[11px] font-black uppercase">
                        <button type="button" onClick={() => setActMsg(activeText(c, !isEs))} title={v.isActive ? tx('Contratista activo de esta sesión', 'Active contractor of this session') : ''} className={`uppercase px-3 py-2 rounded-lg ${v.isActive ? 'bg-slate-100 text-slate-500' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>{v.isActive ? `✓ ${tx('Activo', 'Active')}` : tx('Activo', 'Active')}</button>
                        <button type="button" onClick={() => { setFormData({ ...initialFormState, ...editPrefill(c) }); setContacts(['']); setActMsg(null); handleTabChange('contractorData', tx('Datos del contratista', 'Contractor Details')); }} className="uppercase px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg">{tx('Editar', 'Edit')}</button>
                        <button type="button" onClick={() => openStaff(c)} className="uppercase px-3 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-lg shadow-sm">{tx('Personal', 'Personnel')}</button>
                        <button type="button" onClick={() => setDelDlg(c)} className="uppercase px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm">{tx('Eliminar', 'Delete')}</button>
                      </div></td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 flex items-start gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0" />{tx('Fuente: MariaDB (organización de la sesión). Registrar, editar, activar o eliminar contratistas y su personal son escrituras bloqueadas hasta su autorización.', 'Source: MariaDB (session organization). Registering, editing, activating or deleting contractors and their personnel are writes blocked until authorized.')}</p>

            {delDlg && <div role="dialog" aria-modal="true" aria-label={tx('Eliminar contratista', 'Delete contractor')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setDelDlg(null)}>
              <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between"><h3 className="text-sm font-black text-rose-700">{tx('Eliminar', 'Delete')} {displayName(delDlg)}</h3><button type="button" aria-label={tx('Cerrar diálogo', 'Close dialog')} onClick={() => setDelDlg(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
                <p role="alert" data-testid="contractor-delete-block" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">{deleteBlock(delDlg, !isEs)}</p>
                <div className="flex justify-end text-xs font-black"><button type="button" onClick={() => setDelDlg(null)} className="px-4 py-2 border border-slate-200 rounded-xl">{tx('Cerrar', 'Close')}</button></div>
              </div>
            </div>}

            {staff && <div role="dialog" aria-modal="true" aria-label={tx('Personal del contratista', 'Contractor personnel')} className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-6" onClick={() => setStaff(null)}>
              <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100"><div className="min-w-0"><h3 className="text-sm font-black text-slate-900">{tx('Personal / contactos', 'Personnel / contacts')} · {displayName(staff.contractor)}</h3><p className="text-[11px] text-slate-500">{tx('Personas registradas en la organización (MariaDB). El acceso proviene de su usuario del sistema.', 'People registered in the organization (MariaDB). Access comes from their system user.')}</p></div><button type="button" aria-label={tx('Cerrar personal', 'Close personnel')} onClick={() => setStaff(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
                <div className="p-4 overflow-auto space-y-3">
                  {staff.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando MariaDB…', 'Loading from MariaDB…')}</p>}
                  {staff.error && <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{staff.error.message}</p>}
                  {staff.data && <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-[11px] min-w-[720px]" data-testid="contractor-personnel"><thead><tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-600">{[tx('Nombre', 'Name'), tx('Puesto', 'Position'), tx('Correo', 'Email'), tx('Teléfono', 'Phone'), tx('Roles', 'Roles'), tx('Estado', 'State'), tx('Acceso', 'Access')].map(h => <th key={h} className="p-2.5 whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">{staff.data.items.map(p => { const r = personRow(p, !isEs); return <tr key={p.id}><td className="p-2.5 font-bold text-slate-900">{r.name}{r.responsible && <span className="ml-1.5">{chip({ text: tx('Responsable', 'Manager'), tone: 'green' })}</span>}</td><td className="p-2.5">{r.position}</td><td className="p-2.5 break-all">{r.email}</td><td className="p-2.5">{r.phone}</td><td className="p-2.5">{r.roles}</td><td className="p-2.5">{chip(r.active)}</td><td className="p-2.5">{chip(r.access)}</td></tr>; })}
                      {!staff.data.items.length && <tr><td colSpan={7} className="p-6 text-center text-slate-400">{tx('Sin personal registrado.', 'No personnel recorded.')}</td></tr>}</tbody></table></div>}
                  <p className="text-[10px] text-slate-400">{tx('Alta y edición de personal: módulo Usuarios y roles (escrituras sujetas a su autorización).', 'Adding and editing personnel: Users and roles module (writes subject to its authorization).')}</p>
                </div>
              </div>
            </div>}
          </div>
          );
        })()}

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