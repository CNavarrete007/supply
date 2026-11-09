import React, { useState } from 'react';
import { Lock, KeyRound, Info } from 'lucide-react';

const translations = {
  es: {
    title: 'Portal de seguimiento del cliente',
    subtitle: 'Consulta de forma segura y únicamente en modo lectura el avance de tus solicitudes, órdenes, recepciones, entregas y facturas.',
    clientLabel: 'Número de cliente',
    clientPlaceholder: 'Ingresa tu número de cliente',
    keyLabel: 'Clave de acceso',
    keyPlaceholder: 'Ingresa tu clave de acceso',
    submitBtn: 'Ingresar a mi proceso',
    restrictedTitle: 'Acceso restringido:',
    restrictedDesc: 'el portal no permite modificar registros ni consultar información de otros clientes.',
    notifyTitle: 'Portal del Cliente',
    notifyWarning: 'Por favor complete todos los campos para ingresar.',
    notifyAttempt: (client) => `Intento de acceso iniciado para el cliente: ${client}`,
  },
  en: {
    title: 'Customer Tracking Portal',
    subtitle: 'Securely view in read-only mode the status of your requests, orders, receipts, deliveries, and invoices.',
    clientLabel: 'Customer ID',
    clientPlaceholder: 'Enter your customer number',
    keyLabel: 'Access Key',
    keyPlaceholder: 'Enter your access key',
    submitBtn: 'Access my process',
    restrictedTitle: 'Restricted access:',
    restrictedDesc: 'the portal does not allow modifying records or viewing other customers\' information.',
    notifyTitle: 'Customer Portal',
    notifyWarning: 'Please fill out all fields to log in.',
    notifyAttempt: (client) => `Access attempt initiated for customer: ${client}`,
  },
};

export function CustomerPortal({ onNavigate = () => {}, onNotify, lang = 'es' }) {
  const [clientNumber, setClientNumber] = useState('');
  const [accessKey, setAccessKey] = useState('');

  // Selecciona las traducciones según la prop 'lang'
  const t = translations[lang] || translations.es;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientNumber || !accessKey) {
      if (onNotify) {
        onNotify(t.notifyTitle, t.notifyWarning, 'warning');
      }
      return;
    }

    console.log('Ingresando:', { clientNumber, accessKey });
    
    if (onNotify) {
      onNotify(t.notifyTitle, t.notifyAttempt(clientNumber));
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center p-6">
      {/* Tarjeta Centrada con animación de entrada */}
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 p-10 md:p-14 text-center transform transition-all duration-300 hover:shadow-blue-900/5">
        
        {/* Logo / Icono Superior */}
        <div className="flex justify-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-400 p-0.5 shadow-md flex items-center justify-center transform transition-transform duration-300 hover:scale-110 hover:rotate-3 cursor-pointer">
            <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-[14px] flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-300 fill-amber-300/20 stroke-[2.5] transition-transform duration-300 hover:scale-110" />
            </div>
          </div>
        </div>

        {/* Encabezado */}
        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-3">
          {t.title}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-8 px-4">
          {t.subtitle}
        </p>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
              {t.clientLabel}
            </label>
            <input
              type="text"
              value={clientNumber}
              onChange={(e) => setClientNumber(e.target.value)}
              placeholder={t.clientPlaceholder}
              className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/80 focus:border-blue-500 focus:scale-[1.01] outline-none transition-all duration-200 placeholder:text-slate-400 text-slate-700"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
              {t.keyLabel}
            </label>
            <input
              type="password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder={t.keyPlaceholder}
              className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/80 focus:border-blue-500 focus:scale-[1.01] outline-none transition-all duration-200 placeholder:text-slate-400 text-slate-700"
              required
            />
          </div>

          {/* Botón Principal */}
          <button
            type="submit"
            className="group relative w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5 transition-all duration-200 ease-out flex items-center justify-center gap-2 mt-6 overflow-hidden cursor-pointer"
          >
            <span className="absolute inset-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            
            <KeyRound className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            <span className="relative z-10">{t.submitBtn}</span>
          </button>
        </form>

        {/* Banner informativo */}
        <div className="mt-8 p-4 bg-blue-50/60 border-l-4 border-blue-600 rounded-r-xl flex items-center gap-3 text-left transition-colors duration-200 hover:bg-blue-50">
          <Info className="w-5 h-5 text-blue-600 shrink-0 transition-transform duration-300 hover:scale-110" />
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-800 font-bold">{t.restrictedTitle}</strong> {t.restrictedDesc}
          </p>
        </div>

      </div>
    </div>
  );
}