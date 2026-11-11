import React, { useState, useEffect, useMemo } from 'react';
import { Award, Menu, X, Globe } from 'lucide-react';

// Subcomponentes / Vistas
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { QuotesModule as Quotes } from './views/quotes/QuotesModule';
import { SuppliersCatalog as Suppliers } from './views/CatalogReadOnly';
import { Configuration } from './views/Configuration';
import { ClientsCatalog as Clients } from './views/CatalogReadOnly';
import { ProcessFlow } from './views/ProcessFlow';
import { CustomerPortal } from './views/CustomerPortal';
import { SupplierSupplyCatalog as SupplierSupply } from './views/supplies/SupplierSupplyCatalog';
import { Contractors } from './views/Contractors';
import { RequisitionTransactional } from './views/RequisitionTransactional';
import { ContractorManagement } from './views/ContractorManagement';
import { PurchaseOrdersModule as PurchaseOrders } from './views/purchaseOrders/PurchaseOrdersModule';
import { ReceptionModule as ReceptionDelivery } from './views/reception/ReceptionModule';
import { Invoice } from './views/Invoice';
import { OperationalServices } from './views/OperationalServices';
import { GeneralMatrix } from './views/GeneralMatrix';
import { Reports } from './views/Reports';
import { UsersRoles } from './views/UsersRoles';
import { getSession, endSession } from './apiAuth';
import ClientPortal from './views/ClientPortal';

const defaultQuotes = [];

export default function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const viewFromUrl = queryParams.get('view');

  const storedClient = null;
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking server session
  const [userSession, setUserSession] = useState(null);
  const [activeTab, setActiveTab] = useState(() => viewFromUrl && viewFromUrl !== 'ClientPortal' ? viewFromUrl : 'dashboard');
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    let active = true;
    localStorage.removeItem('grupo_gerez_session'); // legacy mock authentication is never trusted
    getSession().then(user => {
      if (!active) return;
      setIsAuthenticated(!!user);
      if (user) setUserSession({ tipo: 'interno', usuario: user.email, nombre: user.name, rol: user.roles?.[0]?.name || 'Usuario', roles: user.roles });
    }).catch(() => { if (active) setIsAuthenticated(false); });
    return () => { active = false; };
  }, []);

  const [notifications, setNotifications] = useState([]);
  const [language, setLanguage] = useState('es');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const [quotes, setQuotes] = useState(() => {
    const saved = localStorage.getItem('grupo_gerez_quotes');
    return saved ? JSON.parse(saved) : defaultQuotes;
  });

  // Guardado automático de cotizaciones en localStorage
  useEffect(() => {
    localStorage.setItem('grupo_gerez_quotes', JSON.stringify(quotes));
  }, [quotes]);

  // Manejador central de navegación
  const handleNavigate = (viewName, clientData = null, openInNewTab = false) => {
    if (openInNewTab) {
      if (clientData) {
        localStorage.setItem('selected_portal_client', JSON.stringify(clientData));
      }
      // Session remains server-side in an HttpOnly cookie.
      const newTabUrl = `${window.location.origin}${window.location.pathname}?view=${viewName}`;
      window.open(newTabUrl, '_blank');
    } else {
      if (clientData) setSelectedClient(clientData);
      setActiveTab(viewName);
    }
  };

  const navigationMenu = useMemo(() => {
    const isEs = language === 'es';
    return [
      {
        category: 'CONTROL',
        items: [
          { id: 'dashboard', label: isEs ? 'Inicio y Dashboard' : 'Home & Dashboard', icon: '🏠' },
          { id: 'process', label: isEs ? 'Flujo del Proceso' : 'Process Flow', icon: '🧭' },
          { id: 'portal', label: isEs ? 'Portal del Cliente' : 'Client Portal', icon: '👤' },
        ]
      },
      {
        category: isEs ? 'CATÁLOGOS' : 'CATALOGS',
        items: [
          { id: 'clients', label: isEs ? 'Clientes' : 'Clients', icon: '🏢' },
          { id: 'suppliers', label: isEs ? 'Proveedores' : 'Suppliers', icon: '🚚' },
          { id: 'supply', label: isEs ? 'Suministros de proveedores' : 'Supplier Supplies', icon: '📦' },
          { id: 'contractors', label: isEs ? 'Contratista' : 'Contractor', icon: '🏗️' },
        ]
      },
      {
        category: isEs ? 'OPERACIÓN' : 'OPERATIONS',
        items: [
          { id: 'requisition', label: isEs ? 'Solicitud / Requisición' : 'Request / Requisition', icon: '📝' },
          { id: 'contractor_mgmt', label: isEs ? 'Gestión del Contratista' : 'Contractor Management', icon: '🔍' },
          { id: 'quotes', label: isEs ? 'Cotizaciones y Comparativo' : 'Quotes & Comparison', icon: '📊' },
          { id: 'purchase_orders', label: isEs ? 'Órdenes de Compra' : 'Purchase Orders', icon: '🛒' },
          { id: 'reception', label: isEs ? 'Recepción y Entrega' : 'Receiving & Delivery', icon: '📦' },
          { id: 'invoice', label: isEs ? 'Factura' : 'Invoice', icon: '🧾' },
          { id: 'operational_services', label: isEs ? 'Servicios Operativos' : 'Operational Services', icon: '🚚' },
        ]
      },
      {
        category: isEs ? 'SEGUIMIENTO' : 'TRACKING',
        items: [
          { id: 'general_matrix', label: isEs ? 'Matriz General' : 'General Matrix', icon: '📄' },
          { id: 'reports', label: isEs ? 'Reportes' : 'Reports', icon: '📈' },
          { id: 'users_roles', label: isEs ? 'Usuarios y roles' : 'Users & Roles', icon: '👥' },
          { id: 'config', label: isEs ? 'Configuración' : 'Settings', icon: '⚙️' },
        ]
      }
    ];
  }, [language]);

  const currentTabLabel = useMemo(() => {
    for (const group of navigationMenu) {
      const found = group.items.find(item => item.id === activeTab);
      if (found) return found.label;
    }
    return activeTab.replace('_', ' ');
  }, [navigationMenu, activeTab]);

  const handleLoginSuccess = (user) => {
    setUserSession({ tipo: 'interno', usuario: user.email, nombre: user.name, rol: user.roles?.[0]?.name || 'Usuario', roles: user.roles });
    setIsAuthenticated(true);
    setActiveTab('dashboard');
  };

  const pushNotification = (title, desc) => {
    const newNotif = {
      id: Date.now(),
      title,
      desc,
      read: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
  };

  const handleLogout = async () => {
    const confirmMsg = language === 'es' ? '¿Estás seguro de que deseas cerrar sesión?' : 'Are you sure you want to log out?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await endSession();
      setIsAuthenticated(false);
      setUserSession(null);
      localStorage.removeItem('grupo_gerez_session');
      localStorage.removeItem('selected_portal_client');
      setActiveTab('dashboard');
    } catch (err) {
      alert(err?.message || 'No fue posible cerrar sesión.');
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'es' ? 'en' : 'es'));
  };

  // 1. SI NO ESTÁ AUTENTICADO -> LOGIN
  if (isAuthenticated === null) { return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Comprobando sesión segura...</div>; }
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} lang={language} />;
  }

  // 2. RENDERIZADO DEL PORTAL DEL CLIENTE EN PANTALLA COMPLETA
  if (userSession?.tipo === 'cliente') {
    return (
      <div className="min-h-screen bg-slate-900">
        <ClientPortal 
          client={selectedClient} 
          session={userSession} 
          onLogout={handleLogout} 
          onNotify={pushNotification} 
          lang={language} 
        />
      </div>
    );
  }

  // 3. VISTA PRINCIPAL CON MENÚ Y NAVEGACIÓN
  return (
    <div className="flex h-screen bg-[#f4f6f8] text-slate-800 font-sans overflow-hidden">
      {/* Sidebar Lateral */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-72' : 'w-20'
        } bg-[#0b1b3d] text-white flex flex-col justify-between shrink-0 shadow-2xl transition-all duration-300 ease-in-out z-20`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-700/40 flex items-center justify-between shrink-0">
            <div className={`flex items-center gap-3 overflow-hidden ${!isSidebarOpen ? 'justify-center w-full' : ''}`}>
              <img 
                src="/image_923273.svg" 
                alt="Logo Grupo Gerez" 
                className="w-9 h-9 object-contain rounded-lg shrink-0" 
              />
              {isSidebarOpen && (
                <div className="transition-opacity duration-300 opacity-100">
                  <h1 className="text-sm font-black tracking-wider text-white leading-tight whitespace-nowrap">GRUPO GEREZ</h1>
                  <p className="text-[9px] font-semibold text-slate-300 leading-tight whitespace-nowrap">
                    Customs & Logistics Worldwide
                  </p>
                </div>
              )}
            </div>

            {isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title={language === 'es' ? 'Colapsar menú' : 'Collapse menu'}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            {navigationMenu.map((group) => (
              <div key={group.category} className="mb-3">
                {isSidebarOpen ? (
                  <div className="px-4 pt-3 pb-1 text-[10px] font-black text-slate-400/80 tracking-widest uppercase select-none">
                    {group.category}
                  </div>
                ) : (
                  <div className="h-px bg-slate-700/40 my-3 mx-4" />
                )}
                <nav className="px-2.5 space-y-1">
                  {group.items.map((item) => {
                    const isActive = activeTab === item.id || (item.id === 'quotes' && activeTab === 'new');
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        title={!isSidebarOpen ? item.label : undefined}
                        className={`w-full flex items-center ${
                          isSidebarOpen ? 'justify-start gap-3 px-3' : 'justify-center px-0'
                        } py-2.5 rounded-xl text-xs font-bold transition-all duration-200 text-left cursor-pointer group ${
                          isActive
                            ? 'bg-[#1a3868] text-white shadow-md border border-blue-400/30'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="text-base shrink-0 transition-transform duration-200 group-hover:scale-110">
                          {item.icon}
                        </span>
                        {isSidebarOpen && (
                          <span className="leading-tight whitespace-normal break-words flex-1">
                            {item.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-slate-700/40 shrink-0">
            {isSidebarOpen ? (
              <div className="bg-[#051126] p-3 rounded-xl flex items-start gap-2.5 border border-slate-800/80 shadow-inner">
                <Award className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white leading-tight">
                    {language === 'es' ? 'Control de compras' : 'Purchasing Control'}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {language === 'es' ? 'Gestión operativa e inteligente.' : 'Smart operational management.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center p-1" title={language === 'es' ? 'Control de compras' : 'Purchasing Control'}>
                <Award className="w-5 h-5 text-emerald-400" />
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-[#f0f4f8] border-b border-slate-200/80 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-xl text-slate-600 bg-white hover:bg-slate-50 transition border border-slate-200 cursor-pointer shadow-2xs"
                title={language === 'es' ? 'Expandir menú' : 'Expand menu'}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="text-slate-500">{language === 'es' ? 'Compras' : 'Purchasing'}</span>
              <span>/</span>
              <span className="text-slate-900 capitalize bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {currentTabLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="w-11 h-11 bg-white rounded-2xl border border-blue-100 flex items-center justify-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                title={language === 'es' ? 'Notificaciones' : 'Notifications'}
              >
                <span className="text-xl select-none">🔔</span>
              </button>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#5b6e82] text-white text-[11px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-xs border-2 border-[#f0f4f8]">
                  {unreadCount}
                </span>
              )}

              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <h3 className="text-xs font-black text-slate-800">
                      {language === 'es' ? 'Notificaciones' : 'Notifications'}
                    </h3>
                    {unreadCount > 0 ? (
                      <button 
                        onClick={markAllAsRead} 
                        className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        {language === 'es' ? 'Marcar leídas' : 'Mark as read'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">
                        {notifications.length} {language === 'es' ? 'recientes' : 'recent'}
                      </span>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-2 rounded-xl border text-left ${
                            n.read ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-blue-50/50 border-blue-100'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <p className="text-xs font-bold text-slate-800">{n.title}</p>
                            <span className="text-[9px] text-slate-400">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">{n.desc}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-center text-slate-400 py-4">
                        {language === 'es' ? 'No hay notificaciones' : 'No notifications'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="h-11 px-5 bg-white rounded-2xl border border-blue-100 flex items-center gap-2.5 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              <span className="text-lg select-none">🚪</span>
              <span className="text-sm font-extrabold text-[#112d4e]">
                {language === 'es' ? 'Cerrar sesión' : 'Log out'}
              </span>
            </button>

            <button
              onClick={toggleLanguage}
              className="h-11 px-5 bg-white rounded-2xl border border-blue-100 flex items-center gap-2.5 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
            >
              <Globe className="w-5 h-5 text-sky-400 shrink-0" />
              <span className="text-sm font-extrabold text-[#112d4e]">
                {language === 'es' ? 'English' : 'Español'}
              </span>
            </button>
          </div>
        </header>

        {/* Vistas Internas del Dashboard */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          {/* Aviso únicamente en los módulos que todavía no leen datos operativos desde SQL. */}
          {!['users_roles', 'clients', 'suppliers', 'supply', 'purchase_orders', 'quotes', 'reception', 'general_matrix', 'dashboard', 'reports', 'requisition'].includes(activeTab) && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
              Módulo pendiente de integración: puede utilizar datos de demostración y los formularios aún no guardan operaciones en MariaDB.
            </div>
          )}
          {activeTab === 'dashboard' && (
            <Dashboard 
             quotes={quotes} 
             onNavigate={handleNavigate} 
             lang={language}
             language={language}
            />
           )}

          {activeTab === 'requisition' && (
            <RequisitionTransactional 
              onNavigate={handleNavigate}
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

          {/* CONEXIÓN CON VISTA QUOTES (SE ENVÍAN TANTO 'lang' COMO 'language' PARA PREVENIR ERRORES) */}
          {activeTab === 'quotes'  && (
            <Quotes 
              quotes={quotes} 
              setQuotes={setQuotes} 
              onNavigate={handleNavigate} 
              onNotify={pushNotification} 
              lang={language}
              language={language}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
            />
          )}

          {activeTab === 'purchase_orders' && (
            <PurchaseOrders 
              onNotify={pushNotification} 
              lang={language} 
              language={language}
              isEnglish={language === 'en'}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'suppliers' && (
            <Suppliers 
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

          {activeTab === 'supply' && (
            <SupplierSupply 
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

        {activeTab === 'reception' && (
            <ReceptionDelivery 
              onNotify={pushNotification} 
              lang={language}
              isEnglish={language === 'en'} 
            />
          )}

         {activeTab === 'invoice' && (
            <Invoice 
              onNotify={pushNotification} 
              lang={language}
              language={language}
              isEnglish={language === 'en'}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
              onNavigate={handleNavigate}
            />
          )}

       {activeTab === 'operational_services' && (
            <OperationalServices 
              onNotify={pushNotification} 
              lang={language} 
              language={language}
              isEnglish={language === 'en'}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
              onNavigate={handleNavigate}
            />
          )}

          {/* MÓDULO DE MATRIZ GENERAL */}
          {activeTab === 'general_matrix' && (
            <GeneralMatrix 
              onNotify={pushNotification} 
              lang={language}
              language={language}
              isEnglish={language === 'en'}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
              onNavigate={handleNavigate}
            />
          )}

        {/* MÓDULO DE REPORTES GERENCIALES */}
          {activeTab === 'reports' && (
            <Reports 
              onNotify={pushNotification} 
              lang={language}
              language={language}
              isEnglish={language === 'en'}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'clients' && (
            <Clients 
              onNavigate={handleNavigate} 
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

          {activeTab === 'process' && (
            <ProcessFlow 
              onNavigate={handleNavigate} 
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

          {activeTab === 'contractors' && (
            <Contractors 
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

          {activeTab === 'contractor_mgmt' && (
            <ContractorManagement 
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

        {/* MÓDULO DE USUARIOS Y ROLES */}
          {activeTab === 'users_roles' && (
            <UsersRoles 
              onNotify={pushNotification} 
              lang={language}
              language={language}
              isEnglish={language === 'en'}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'portal' && (
            <CustomerPortal 
              onNotify={pushNotification} 
              lang={language} 
            />
          )}

          {activeTab === 'config' && (
            <Configuration 
              onNotify={pushNotification} 
              lang={language}
              language={language}
              isEnglish={language === 'en'}
              setLanguage={setLanguage}
              onToggleLanguage={toggleLanguage}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>
    </div>
  );
}