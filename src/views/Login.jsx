import React, { useState } from 'react';
import { loginWithPassword } from '../apiAuth';
import { 
  Lock, 
  User, 
  Building2, 
  ShieldCheck, 
  FileText, 
  Globe, 
  LogIn, 
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export function Login({ onLoginSuccess }) {
  // Estado para el idioma: 'es' | 'en'
  const [lang, setLang] = useState('es');

  // Estado para la pestaña activa: 'interno' | 'cliente'
  const [activeTab, setActiveTab] = useState('interno');
  
  // Estados para el formulario de Acceso Interno
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  
  // Estados para el formulario del Portal del Cliente
  const [numeroCliente, setNumeroCliente] = useState('');
  const [claveAcceso, setClaveAcceso] = useState('');

  const t = {
    es: {
      btnLang: 'English',

      subtitle: 'Customs & Logistics Worldwide',
      heroDesc: 'Acceso centralizado al sistema de operaciones aduanales y logística integral. El personal gestiona los expedientes y cada cliente consulta en tiempo real el estatus de sus pedimentos y despachos.',
      feature1: 'Inicio de sesión seguro para personal interno',
      feature2: 'Gestión de roles y permisos por departamento',
      feature3: 'Portal del cliente independiente y de solo lectura',
      feature4: 'Trazabilidad en tiempo real de trámites y pedimentos',
      copyright: `© ${new Date().getFullYear()} Trámites Aduanales Gerez S.C. Todos los derechos reservados.`,
  
      tabInternal: 'Acceso interno',
      tabClient: 'Portal del cliente',
      titleInternal: 'Iniciar sesión',
      descInternal: 'Ingresa con el usuario y contraseña asignados por la administración de Grupo Gerez.',
      lblUser: 'Usuario / correo',
      lblPass: 'Contraseña',
      phUser: 'usuario@grupogerez.com',
      phPass: 'Ingresa tu contraseña',
      btnSubmitInternal: 'Entrar a Grupo Gerez',
      noteInternal: 'El acceso ahora se valida en el servidor. La administración de cuentas estará disponible en una fase posterior.',
      titleClient: 'Portal del cliente',
      descClient: 'Consulta exclusivamente el avance, la etapa actual y la información visible de tus trámites.',
      lblClientNum: 'Número de cliente',
      lblClientKey: 'Clave de acceso',
      phClientNum: 'Ingresa tu número de cliente',
      phClientKey: 'Ingresa tu clave de acceso',
      btnSubmitClient: 'Consultar mi estatus',
      noteClientTitle: 'Vista de solo lectura:',
      noteClientDesc: 'El cliente no puede abrir catálogos, costos internos, proveedores, comparativos, usuarios ni configuraciones.',
      footer: 'Trámites Aduanales Gerez S.C.',
      alertFill: 'Por favor completa todos los campos.'
    },
    en: {
      btnLang: 'Español',

      subtitle: 'Customs & Logistics Worldwide',
      heroDesc: 'Centralized access to the customs operations and comprehensive logistics system. Staff manages files, and clients track the status of their customs clearance in real time.',
      feature1: 'Secure login for internal staff',
      feature2: 'Role and permission management by department',
      feature3: 'Independent read-only client portal',
      feature4: 'Real-time traceability of customs procedures',
      copyright: `© ${new Date().getFullYear()} Trámites Aduanales Gerez S.C. All rights reserved.`,
 
      tabInternal: 'Internal Access',
      tabClient: 'Client Portal',
      titleInternal: 'Sign In',
      descInternal: 'Log in with the username and password assigned by Grupo Gerez administration.',
      lblUser: 'Username / Email',
      lblPass: 'Password',
      phUser: 'user@grupogerez.com',
      phPass: 'Enter your password',
      btnSubmitInternal: 'Log in to Grupo Gerez',
      noteInternal: 'Sign-in is now validated by the server. Account changes are disabled until the next stage.',
      titleClient: 'Client Portal',
      descClient: 'Exclusively check the status, current stage, and visible information of your procedures.',
      lblClientNum: 'Client Number',
      lblClientKey: 'Access Key',
      phClientNum: 'Enter your client number',
      phClientKey: 'Enter your access key',
      btnSubmitClient: 'Check My Status',
      noteClientTitle: 'Read-only view:',
      noteClientDesc: 'Clients cannot open catalogs, internal costs, suppliers, comparisons, users, or settings.',
      footer: 'Trámites Aduanales Gerez S.C.',
      alertFill: 'Please fill in all fields.'
    }
  };

  // Manejador del inicio de sesión interno
  const handleInternalSubmit = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !password) { setLoginError(t[lang].alertFill); return; }
    setLoginBusy(true);
    setLoginError('');
    try {
      const user = await loginWithPassword(usuario.trim(), password);
      setPassword('');
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (error) {
      setPassword('');
      setLoginError(error?.message || 'No fue posible iniciar sesión.');
    } finally { setLoginBusy(false); }
  };

  // Manejador de consulta del cliente (Redirige hacia ClientPortal)
  const handleClientSubmit = (e) => {
    e.preventDefault();
    alert(lang === 'es' ? 'El portal de clientes aún no tiene autenticación en esta versión local.' : 'Customer portal authentication is not available in this local version yet.');
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-3 md:p-6 font-sans">
      {/* CONTENEDOR PRINCIPAL */}
      <div className="w-[95%] max-w-[1800px] h-[90vh] min-h-[750px] bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* PANEL IZQUIERDO: DEGRADADO Y PROPUESTA DE VALOR */}
        <div className="lg:col-span-6 bg-gradient-to-br from-blue-700 via-indigo-600 to-purple-700 p-8 md:p-14 text-white flex flex-col justify-between relative overflow-hidden h-full">
          
          {/* Círculos decorativos de fondo */}
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />

          {/* Header con el Logo de Grupo Gerez */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-3 flex items-center justify-center shadow-inner">
                <img 
                  src="/image_923273.svg" 
                  alt="Grupo Gerez Logo" 
                  className="w-full h-full object-contain filter drop-shadow" 
                />
              </div>
              <div>
                <span className="text-3xl md:text-4xl font-black tracking-tight text-white block">Grupo Gerez</span>
                <span className="text-xs uppercase font-bold tracking-widest text-blue-200">{t[lang].subtitle}</span>
              </div>
            </div>

            <p className="text-sm md:text-base text-blue-100/90 leading-relaxed font-normal max-w-xl">
              {t[lang].heroDesc}
            </p>
          </div>

          {/* Lista de características */}
          <div className="relative z-10 space-y-4 my-auto max-w-xl">
            <div className="p-4 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl flex items-center gap-4 text-sm font-semibold text-white/90 shadow-sm transition-transform hover:translate-x-1">
              <span className="text-xl">🔐</span>
              <span>{t[lang].feature1}</span>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl flex items-center gap-4 text-sm font-semibold text-white/90 shadow-sm transition-transform hover:translate-x-1">
              <span className="text-xl">🛡️</span>
              <span>{t[lang].feature2}</span>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl flex items-center gap-4 text-sm font-semibold text-white/90 shadow-sm transition-transform hover:translate-x-1">
              <span className="text-xl">👁️</span>
              <span>{t[lang].feature3}</span>
            </div>

            <div className="p-4 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl flex items-center gap-4 text-sm font-semibold text-white/90 shadow-sm transition-transform hover:translate-x-1">
              <span className="text-xl">📊</span>
              <span>{t[lang].feature4}</span>
            </div>
          </div>

          {/* Pie de página panel izquierdo */}
          <div className="relative z-10 text-xs text-blue-200/70 font-medium">
            {t[lang].copyright}
          </div>
        </div>

        {/* PANEL DERECHO: FORMULARIOS DE ACCESO */}
        <div className="lg:col-span-6 p-8 md:p-14 flex flex-col justify-between bg-white relative h-full overflow-y-auto">
          
          {/* Selector de idioma */}
          <div className="flex justify-end items-center mb-4">
            <button 
              type="button" 
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{t[lang].btnLang}</span>
            </button>
          </div>

          {/* Formulario */}
          <div className="max-w-lg mx-auto w-full my-auto space-y-6">
            
            {/* SWITCH DE PESTAÑAS */}
            <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab('interno')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-extrabold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'interno'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🏢</span>
                <span>{t[lang].tabInternal}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cliente')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-extrabold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'cliente'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>👤</span>
                <span>{t[lang].tabClient}</span>
              </button>
            </div>

            {/* VISTA 1: ACCESO INTERNO */}
            {activeTab === 'interno' && (
              <form onSubmit={handleInternalSubmit} className="space-y-5 animate-fadeIn">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t[lang].titleInternal}</h2>
                  <p className="text-xs md:text-sm text-slate-500 mt-1">
                    {t[lang].descInternal}
                  </p>
                </div>

                {/* Campo: Usuario / Correo */}
                <div>
                  <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">
                    {t[lang].lblUser}
                  </label>
                  <input
                    type="email"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder={t[lang].phUser}
                    required
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                  />
                </div>

                {/* Campo: Contraseña */}
                <div>
                  <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">
                    {t[lang].lblPass}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t[lang].phPass}
                    required
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                  />
                </div>

                {/* Botón de Enviar */}
                <button
                  type="submit"
                  disabled={loginBusy}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-black tracking-wide transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>🔐</span>
                  <span>{loginBusy ? (lang === 'es' ? 'Verificando...' : 'Checking...') : t[lang].btnSubmitInternal}</span>
                </button>

                {loginError && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{loginError}</p>}
                {/* Nota de pie */}
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 leading-relaxed font-normal">
                  {t[lang].noteInternal}
                </div>
              </form>
            )}

            {/* VISTA 2: PORTAL DEL CLIENTE */}
            {activeTab === 'cliente' && (
              <form onSubmit={handleClientSubmit} className="space-y-5 animate-fadeIn">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t[lang].titleClient}</h2>
                  <p className="text-xs md:text-sm text-slate-500 mt-1">
                    {t[lang].descClient}
                  </p>
                </div>

                {/* Campo: Número de Cliente */}
                <div>
                  <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">
                    {t[lang].lblClientNum}
                  </label>
                  <input
                    type="text"
                    value={numeroCliente}
                    onChange={(e) => setNumeroCliente(e.target.value)}
                    placeholder={t[lang].phClientNum}
                    required
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all font-medium"
                  />
                </div>

                {/* Campo: Clave de Acceso */}
                <div>
                  <label className="block text-xs md:text-sm font-extrabold text-slate-800 mb-1.5">
                    {t[lang].lblClientKey}
                  </label>
                  <input
                    type="password"
                    value={claveAcceso}
                    onChange={(e) => setClaveAcceso(e.target.value)}
                    placeholder={t[lang].phClientKey}
                    required
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all font-medium"
                  />
                </div>

                {/* Botón de Enviar (Portal Cliente) */}
                <button
                  type="submit"
                  className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-sm font-black tracking-wide transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>👁️</span>
                  <span>{t[lang].btnSubmitClient}</span>
                </button>

                {/* Nota de Solo Lectura */}
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 leading-relaxed font-normal">
                  <strong className="text-slate-700 font-bold">{t[lang].noteClientTitle} </strong>
                  {t[lang].noteClientDesc}
                </div>
              </form>
            )}
          </div>

          {/* Pie informativo */}
          <div className="mt-6 text-center text-xs text-slate-400">
            {t[lang].footer}
          </div>
        </div>

      </div>
    </div>
  );
}