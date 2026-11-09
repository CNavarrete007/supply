import React, { useState } from 'react';
import { Truck } from 'lucide-react';

export function ReceptionDelivery({ onNotify, lang = 'es' }) {
  const isEnglish = lang === 'en';

  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  // Estado para controlar la pestaña activa (1: Registro de recepción, 2: Entrega al cliente, 3: Matriz, 4: Semáforo)
  const [activeTab, setActiveTab] = useState(1);

  // ==========================================
  // ESTADOS Y MOCKS: REGISTRO DE RECEPCIÓN (TAB 1)
  // ==========================================
  const [isCapturingReception, setIsCapturingReception] = useState(true);
  const [receptionData, setReceptionData] = useState({
    ordenCompra: "",
    folioRecepcion: isEnglish ? "Automatic" : "Automático",
    fechaRecepcion: "2026-09-03",
    tipoRecepcion: isEnglish ? "Total" : "Total",
    cantidadPorcentaje: "100",
    inspeccionCalidad: isEnglish ? "Conformant" : "Conforme",
    documentacionRecibida: isEnglish ? "Complete" : "Completa",
    evidenciaRemision: "",
    observaciones: ""
  });
  const [receptionPhotos, setReceptionPhotos] = useState([]);

  const handleReceptionChange = (e) => {
    const { name, value } = e.target;
    setReceptionData(prev => ({ ...prev, [name]: value }));
  };

  const handleReceptionPhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newPhotos = files.map(file => ({
        url: URL.createObjectURL(file),
        name: file.name
      }));
      setReceptionPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleRemoveReceptionPhoto = (indexToRemove) => {
    setReceptionPhotos(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleClearReception = () => {
    setReceptionData({
      ordenCompra: "",
      folioRecepcion: isEnglish ? "Automatic" : "Automático",
      fechaRecepcion: "2026-09-03",
      tipoRecepcion: isEnglish ? "Total" : "Total",
      cantidadPorcentaje: "100",
      inspeccionCalidad: isEnglish ? "Conformant" : "Conforme",
      documentacionRecibida: isEnglish ? "Complete" : "Completa",
      evidenciaRemision: "",
      observaciones: ""
    });
    setReceptionPhotos([]);
  };

  const handleSaveReception = () => {
    if (!receptionData.ordenCompra) {
      alert(isEnglish ? "Please select a Purchase Order." : "Por favor selecciona una Orden de compra.");
      return;
    }

    // NOTIFICACIÓN A LA CAMPANITA PRINCIPAL
    if (onNotify) {
      onNotify(
        isEnglish ? "New Reception Registered" : "Nueva Recepción Registrada",
        isEnglish ? `Reception registered for order ${receptionData.ordenCompra}` : `Se registró la recepción para la orden ${receptionData.ordenCompra}`
      );
    }

    alert(isEnglish ? "Reception saved successfully." : "Recepción guardada correctamente.");
    setIsCapturingReception(false);
  };

  // ==========================================
  // ESTADOS Y MOCKS: ENTREGA AL CLIENTE (TAB 2)
  // ==========================================
  const [isCapturingDelivery, setIsCapturingDelivery] = useState(true);
  const [deliveryData, setDeliveryData] = useState({
    recepcionRegistrada: "",
    fechaEntrega: "",
    aceptacionCliente: isEnglish ? "Pending" : "Pendiente",
    lugarEntrega: "",
    entregoContratista: "",
    recibioCliente: "",
    evidenciaAcuse: "",
    observaciones: ""
  });
  const [deliveryPhotos, setDeliveryPhotos] = useState([]);

  const handleDeliveryChange = (e) => {
    const { name, value } = e.target;
    setDeliveryData(prev => ({ ...prev, [name]: value }));
  };

  const handleDeliveryPhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newPhotos = files.map(file => ({
        url: URL.createObjectURL(file),
        name: file.name
      }));
      setDeliveryPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleRemoveDeliveryPhoto = (indexToRemove) => {
    setDeliveryPhotos(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleClearDelivery = () => {
    setDeliveryData({
      recepcionRegistrada: "",
      fechaEntrega: "",
      aceptacionCliente: isEnglish ? "Pending" : "Pendiente",
      lugarEntrega: "",
      entregoContratista: "",
      recibioCliente: "",
      evidenciaAcuse: "",
      observaciones: ""
    });
    setDeliveryPhotos([]);
  };

  const handleSaveDelivery = () => {
    if (!deliveryData.recepcionRegistrada) {
      alert(isEnglish ? "Please select a registered reception." : "Por favor selecciona una recepción registrada.");
      return;
    }

    if (onNotify) {
      onNotify(
        isEnglish ? "New Delivery to Client" : "Nueva Entrega al Cliente",
        isEnglish ? `Delivery registered for reception ${deliveryData.recepcionRegistrada}` : `Se registró la entrega de la recepción ${deliveryData.recepcionRegistrada}`
      );
    }

    alert(isEnglish ? "Delivery saved successfully." : "Entrega guardada correctamente.");
    setIsCapturingDelivery(false);
  };

  const [matrixRecords, setMatrixRecords] = React.useState([]);

  // Definición de las tarjetas principales
  const tabs = [
    {
      id: 1,
      title: isEnglish ? "Reception Registration" : "Registro de recepción",
      description: isEnglish ? "Document received quantities, quality, documents and photos." : "Documenta cantidades recibidas, calidad, documentos y fotografías.",
      icon: "📦"
    },
    {
      id: 2,
      title: isEnglish ? "Client Delivery" : "Entrega al cliente",
      description: isEnglish ? "Log date, managers, acceptance, evidence and photos." : "Registra fecha, responsables, aceptación, evidencia y fotografías.",
      icon: "🚚"
    },
    {
      id: 3,
      title: isEnglish ? "Reception & Delivery Matrix" : "Matriz de recepción y entrega",
      description: isEnglish ? "View and edit both process stages." : "Consulta y edita ambas etapas del proceso.",
      icon: "📋"
    },
    {
      id: 4,
      title: isEnglish ? "Closing Traffic Light" : "Semáforo de cierre",
      description: isEnglish ? "Identify pending POs, missing deliveries, deviations and closures." : "Identifica OC pendientes, entregas faltantes, desviaciones y cierres.",
      icon: "🚦"
    }
  ];

  return (
    <div className="space-y-6 text-left">
      {/* ENCABEZADO PRINCIPAL */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{isEnglish ? "Reception and Delivery" : "Recepción y Entrega"}</h2>
          <p className="text-xs text-slate-500">{isEnglish ? "Control of inputs, outputs and merchandise delivery confirmation." : "Control de entradas, salidas y confirmación de entregas de mercancía."}</p>
        </div>
      </div>

      {/* GRID DE NAVEGACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
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
        
        {/* VISTA 1: REGISTRO DE RECEPCIÓN */}
        {activeTab === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">{isEnglish ? "Reception Registration" : "Registro de recepción"}</h3>
                <p className="text-xs text-slate-500">
                  {isEnglish ? "Document the physical supply reception, quantity, quality, documents and photographic evidence." : "Documenta la recepción física del suministro, cantidad, calidad, documentos y evidencia fotográfica."}
                </p>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                {isEnglish ? "Step 6 • Reception" : "Paso 6 • Recepción"}
              </span>
            </div>

            <fieldset disabled={!isCapturingReception} className="space-y-4 disabled:opacity-70">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Purchase Order *" : "Orden de compra *"}</label>
                  <select
                    name="ordenCompra"
                    value={receptionData.ordenCompra}
                    onChange={handleReceptionChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">{isEnglish ? "Select..." : "Seleccionar..."}</option>
                    <option value="OC-2026-001">OC-2026-001 - {isEnglish ? "Provider 1" : "Proveedor 1"}</option>
                    <option value="OC-2026-002">OC-2026-002 - {isEnglish ? "Provider 2" : "Proveedor 2"}</option>
                  </select>
                </div>

            <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Reception Folio" : "Folio de recepción"}</label>
                  <input
                    type="text"
                    readOnly
                    value={receptionData.folioRecepcion}
                    className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-medium text-slate-500 cursor-not-allowed"
                  />
                </div>

             <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Reception Date *" : "Fecha de recepción *"}</label>
                  <input
                    type="date"
                    defaultValue="dd-mm-aaaa"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 shadow-2xs"
                  />
                </div>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Reception Type" : "Tipo de recepción"}</label>
                  <select
                    name="tipoRecepcion"
                    value={receptionData.tipoRecepcion}
                    onChange={handleReceptionChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="Total">{isEnglish ? "Total" : "Total"}</option>
                    <option value="Parcial">{isEnglish ? "Partial" : "Parcial"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Quantity / Received*" : "Cantidad / Recibido*"}</label>
                  <input
                    type="number"
                    name="cantidadPorcentaje"
                    min="0"
                    max="100"
                    value={receptionData.cantidadPorcentaje}
                    onChange={handleReceptionChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Quality inspection" : "Inspección de calidad"}</label>
                  <select
                    name="inspeccionCalidad"
                    value={receptionData.inspeccionCalidad}
                    onChange={handleReceptionChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="Conforme">{isEnglish ? "According" : "Conforme"}</option>
                    <option value="Con Observaciones">{isEnglish ? "With observations" : "Con Observaciones"}</option>
                    <option value="No Conforme">{isEnglish ? "Dissatisfied" : "No Conforme"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Documentation received" : "Documentación recibida"}</label>
                  <select
                    name="documentacionRecibida"
                    value={receptionData.documentacionRecibida}
                    onChange={handleReceptionChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="Completa">{isEnglish ? "Complete" : "Completa"}</option>
                    <option value="Incompleta">{isEnglish ? "Incomplete" : "Incompleta"}</option>
                    <option value="No recibida">{isEnglish ? "Not received" : "No recibida"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Evidence / referral / invoice" : "Evidencia / remisión / factura"}</label>
                  <input
                    type="text"
                    name="evidenciaRemision"
                    placeholder="Número de remisión, factura, packing list, certificado..."
                    value={receptionData.evidenciaRemision}
                    onChange={handleReceptionChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Observations / non-conformity" : "Observaciones / no conformidad"}</label>
                  <textarea
                    name="observaciones"
                    rows="1"
                    value={receptionData.observaciones}
                    onChange={handleReceptionChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs resize-none"
                  />
                </div>
              </div>

              {/* FOTOGRAFÍAS RECEPCIÓN */}
              <div className="border border-dashed border-blue-200/80 rounded-2xl p-4 space-y-3 bg-blue-50/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{isEnglish ? "Reception photos" : "Fotografías de recepción"}</h4>
                    <p className="text-[11px] text-slate-400">{isEnglish ? "Add images of unloading, inspection, quantities, damage, or labels." : "Agrega imágenes de descarga, inspección, cantidades, daños o etiquetas."}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {receptionPhotos.length} {receptionPhotos.length === 1 ? 'fotografía' : 'fotografías'}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    disabled={!isCapturingReception}
                    onChange={handleReceptionPhotoUpload}
                    className="text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer w-full"
                  />
                </div>
                <p className="text-[10px] text-slate-400">{isEnglish ? "Recommended maximum: 8 photographs. Images are automatically compressed." : "Máximo recomendado: 8 fotografías. Las imágenes se comprimen automáticamente."}</p>

                <div className="min-h-[90px] flex items-center">
                  {receptionPhotos.length === 0 ? (
                    <div className="w-full text-center text-xs text-slate-400 font-medium py-4">
                     {isEnglish ? "No photographs have been added." : "No se han agregado fotografías."} 
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3 w-full">
                      {receptionPhotos.map((photo, index) => (
                        <div key={index} className="relative group w-28 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                          {isCapturingReception && (
                            <button
                              type="button"
                              onClick={() => handleRemoveReceptionPhoto(index)}
                              className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md z-10 transition-transform hover:scale-110 cursor-pointer"
                              title="Eliminar imagen"
                            >
                              ×
                            </button>
                          )}
                          <div className="h-16 w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                            <img src={photo.url} alt={`Evidencia ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[9px] text-slate-500 truncate mt-1 px-0.5 text-center">{photo.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            <div className="bg-blue-50/70 border-l-4 border-blue-500 rounded-r-xl p-3 text-xs text-slate-600 font-medium">
              {isEnglish ? "Select an order to view its context." : "Selecciona una orden para visualizar su contexto."} 
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
                <button type="button" onClick={handleSaveReception} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-2xl transition-all shadow-2xs flex items-center gap-2">
                  <span className="text-base leading-none">📦</span>
                  <span>{isEnglish ? "Save Reception" : "Guardar recepción"}</span>
                </button>
                <button type="button" onClick={handleClearReception} className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5">
                  <span>✏️</span>
                  <span>{isEnglish ? "Clear" : "Limpiar"}</span>
                </button>
                <button type="button" onClick={() => setActiveTab(2)} className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5">
                  <span>🚚</span>
                  <span>{isEnglish ? "Go to Delivery" : "Ir a entrega"}</span>
                </button>
                <button type="button" onClick={() => setActiveTab(3)} className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5">
                  <span>📋</span>
                  <span>{isEnglish ? "View Matrix" : "Ver matriz"}</span>
                </button>
              </div>
          </div>
        )}

        {/* VISTA 2: ENTREGA AL CLIENTE */}
          {activeTab === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-5">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">{isEnglish ? "Client Delivery" : "Entrega al cliente"}</h3>
                <p className="text-xs text-slate-500">
                  {isEnglish ? "Log who delivers, who receives, location, evidence and final client acceptance." : "Registra quién entrega, quién recibe, el lugar, la evidencia y la aceptación final del cliente."}
                </p>
              </div>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-purple-200 self-start sm:self-auto">
                {isEnglish ? "Step 7 • Delivery and acceptance" : "Paso 7 • Entrega y aceptación"}
              </span>
            </div>

            <fieldset disabled={!isCapturingDelivery} className="space-y-4 disabled:opacity-70">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Receipt acknowledged" : "Recepción registrada"}</label>
                  <select
                    name="recepcionRegistrada"
                    value={deliveryData.recepcionRegistrada}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">{isEnglish ? "Select reception..." : "Seleccionar recepción..."}</option>
                    <option value="REC-2026-001">REC-2026-001 - OC-2026-001</option>
                    <option value="REC-2026-002">REC-2026-002 - OC-2026-002</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Date of delivery to the customer" : "Fecha de entrega al cliente"}</label>
                  <input
                    type="date"
                    name="fechaEntrega"
                    value={deliveryData.fechaEntrega}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Customer acceptance" : "Aceptación del cliente"}</label>
                  <select
                    name="aceptacionCliente"
                    value={deliveryData.aceptacionCliente}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="Pendiente">{isEnglish ? "Earring" : "Pendiente"}</option>
                    <option value="Aceptado">{isEnglish ? "Accepted" : "Aceptado"}</option>
                    <option value="Aceptado con observaciones">{isEnglish ? "Accepted with observations" : "Aceptado con observaciones"}</option>
                    <option value="Rechazado">{isEnglish ? "Refused" : "Rechazado"}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Place of delivery" : "Lugar de entrega"}</label>
                  <input
                    type="text"
                    name="lugarEntrega"
                    placeholder="Sitio, almacén, terminal, oficina o instalación"
                    value={deliveryData.lugarEntrega}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Handed over by the contractor" : "Entregó por el contratista"}</label>
                  <input
                    type="text"
                    name="entregoContratista"
                    placeholder="Nombre y puesto"
                    value={deliveryData.entregoContratista}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Received from the client" : "Recibió por el cliente"}</label>
                  <input
                    type="text"
                    name="recibioCliente"
                    placeholder="Nombre y puesto"
                    value={deliveryData.recibioCliente}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Proof / acknowledgment / signed delivery receipt" : "Evidencia / acuse / remisión firmada"}</label>
                  <input
                    type="text"
                    name="evidenciaAcuse"
                    placeholder="Folio, referencia o descripción del documento"
                    value={deliveryData.evidenciaAcuse}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">{isEnglish ? "Delivery notes" : "Observaciones de entrega"}</label>
                  <textarea
                    name="observaciones"
                    rows="1"
                    value={deliveryData.observaciones}
                    onChange={handleDeliveryChange}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs resize-none"
                  />
                </div>
              </div>

              {/* FOTOGRAFÍAS ENTREGA */}
              <div className="border border-dashed border-blue-200/80 rounded-2xl p-4 space-y-3 bg-blue-50/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{isEnglish ? "Handover photos" : "Fotografías de entrega"}</h4>
                    <p className="text-[11px] text-slate-400">{isEnglish ? "Add images of the physical delivery, acceptance signature, or final condition." : "Agrega imágenes de la entrega física, firma de aceptación o condición final."}</p>
                  </div>
                  <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {deliveryPhotos.length} {deliveryPhotos.length === 1 ? 'fotografía' : 'fotografías'}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    disabled={!isCapturingDelivery}
                    onChange={handleDeliveryPhotoUpload}
                    className="text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer w-full"
                  />
                </div>
                <p className="text-[10px] text-slate-400">{isEnglish ? "Recommended maximum: 8 photographs. Images are automatically compressed." : "Máximo recomendado: 8 fotografías. Las imágenes se comprimen automáticamente."}</p>

                <div className="min-h-[90px] flex items-center">
                  {deliveryPhotos.length === 0 ? (
                    <div className="w-full text-center text-xs text-slate-400 font-medium py-4">
                      {isEnglish ? "No delivery photos have been added." : "No se han agregado fotografías de entrega."}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3 w-full">
                      {deliveryPhotos.map((photo, index) => (
                        <div key={index} className="relative group w-28 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                          {isCapturingDelivery && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDeliveryPhoto(index)}
                              className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md z-10 transition-transform hover:scale-110 cursor-pointer"
                              title="Eliminar imagen"
                            >
                              ×
                            </button>
                          )}
                          <div className="h-16 w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-100">
                            <img src={photo.url} alt={`Entrega ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[9px] text-slate-500 truncate mt-1 px-0.5 text-center">{photo.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            <div className="bg-blue-50/70 border-l-4 border-blue-500 rounded-r-xl p-3 text-xs text-slate-600 font-medium">
             {isEnglish ? "Select a receipt to view the order, the customer, and the percentage received." : "Selecciona una recepción para visualizar la orden, el cliente y el porcentaje recibido."} 
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
                <button type="button" onClick={handleSaveDelivery} className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-black rounded-2xl transition-all shadow-2xs flex items-center gap-2 cursor-pointer border border-purple-600/30">
                  <span className="text-base leading-none">🚚</span>
                  <span>{isEnglish ? "Save Delivery" : "Guardar entrega"}</span>
                </button>

              <button type="button" onClick={handleClearDelivery} className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer">
                <span className="text-base leading-none">✏️</span>
                <span>{isEnglish ? "Clean" : "Limpiar"}</span>
              </button>

              <button type="button" onClick={() => setActiveTab(1)} className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer">
                <span className="text-base leading-none">📦</span>
                <span>{isEnglish ? "Go to reception" : "Ir a recepción"}</span>
              </button>

              <button type="button" onClick={() => setActiveTab(3)} className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer">
                <span className="text-base leading-none">📋</span>
                <span>{isEnglish ? "View matrix" : "Ver matriz"}</span>
              </button>
            </div>
          </div>
        )}

{/* VISTA 3: MATRIZ DE RECEPCIÓN Y ENTREGA */}
{activeTab === 3 && (() => {
  // Evaluamos de forma ultra-segura los estados declarados en tu archivo
  const matrizAbierta = (typeof mostrarMatriz !== 'undefined' && mostrarMatriz) || (typeof isMatrixOpen !== 'undefined' && isMatrixOpen);
  const clienteActual = typeof clienteSeleccionado !== 'undefined' ? clienteSeleccionado : (typeof selectedClient !== 'undefined' ? selectedClient : 'ALL');

  // Función unificada para seleccionar cliente y desplegar matriz
  const handleSeleccionarCliente = (cliente, e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof setClienteSeleccionado === 'function') setClienteSeleccionado(cliente);
    if (typeof setSelectedClient === 'function') setSelectedClient(cliente);
    if (typeof setMostrarMatriz === 'function') setMostrarMatriz(true);
    if (typeof setIsMatrixOpen === 'function') setIsMatrixOpen(true);
  };

  // Función unificada para cerrar matriz
  const handleCerrarMatriz = () => {
    if (typeof setClienteSeleccionado === 'function') setClienteSeleccionado('ALL');
    if (typeof setSelectedClient === 'function') setSelectedClient('ALL');
    if (typeof setMostrarMatriz === 'function') setMostrarMatriz(false);
    if (typeof setIsMatrixOpen === 'function') setIsMatrixOpen(false);
  };

  // Datos reales o de respaldo para la tabla
  const datosObtenidos = typeof registrosMatriz !== 'undefined' && Array.isArray(registrosMatriz) && registrosMatriz.length > 0
    ? registrosMatriz
    : (typeof matrixRecords !== 'undefined' && Array.isArray(matrixRecords) && matrixRecords.length > 0 ? matrixRecords : null);

  const datosLista = datosObtenidos || [
    {
      id: 1,
      tipo: 'ENTREGA',
      folio: 'ENT-2026-0003',
      subFolio: 'Completa · 2026-09-18',
      oc: 'OC-2026-0026\nOC-2026-0024\nOC-2026-0025',
      requisicion: 'SOL-PROV-2026-0001',
      cliente: 'EJEMPLO 1',
      cantidad: '3.00 entregado',
      subCantidad: '3 partida(s) · Completa',
      calidad: 'Firmada y bloqueada',
      documentos: 'Acuse',
      subDocumentos: 'ESEASA',
      fotos: '1 foto(s)',
      aceptacion: 'Aceptado',
      firma: 'Firmada y bloqueada',
      sha: 'SHA-256 1b059e6476fc...'
    },
    {
      id: 2,
      tipo: 'RECEPCIÓN',
      folio: 'REC-2026-0002',
      subFolio: '2026-09-08',
      oc: 'OC-2026-0026',
      requisicion: 'SOL-PROV-2026-0001',
      subRequisicion: 'EJEMPLO',
      cliente: 'EJEMPLO 1',
      cantidad: '100% recibido',
      subCantidad: '1 formato(s) de entrega',
      calidad: 'Conforme',
      documentos: 'Completa',
      subDocumentos: 'comprobante de entrega / 12189 / factura 158745',
      fotos: '0 recepción',
      aceptacion: 'Aceptado',
      firma: 'Firmas vinculadas'
    }
  ];

  // Filtrado de la tabla según la tarjeta seleccionada
  const datosFiltrados = (!clienteActual || clienteActual === 'ALL' || clienteActual === 'TODOS')
    ? datosLista
    : datosLista.filter(item => item.cliente === clienteActual || item.client === clienteActual);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-left space-y-6">
      
      {/* ENCABEZADO Y BOTONES DE ACCIÓN RÁPIDA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{isEnglish ? "Receipt and Handover Matrix" : "Matriz de recepción y entrega"}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
           {isEnglish ? "Check the records of material receipts and customer deliveries, including acknowledgments of receipt and signatures." : "Consulta los registros de recepción de materiales y entregas a clientes con sus acuses y firmas."} 
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button 
            type="button" 
            onClick={() => typeof setActiveTab === 'function' && setActiveTab(1)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>{isEnglish ? "New reception" : "Nueva recepción"}</span>
          </button>
          <button 
            type="button" 
            onClick={() => typeof setActiveTab === 'function' && setActiveTab(2)}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-purple-700/20 cursor-pointer flex items-center gap-1.5"
          >
            <span>+</span>
            <span>{isEnglish ? "New installment" : "Nueva entrega"}</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN: RECEPCIONES Y ENTREGAS POR CLIENTE */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{isEnglish ? "Receipts and deliveries by customer" : "Recepciones y entregas por cliente"}</h3>
            <p className="text-[11px] text-slate-500">{isEnglish ? "Select a client to view only their records." : "Selecciona un cliente para consultar únicamente sus registros."}</p>
          </div>
        </div>

        {/* GRID DE TARJETAS DE CLIENTES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* TARJETA 1: TODOS LOS CLIENTES */}
          <div 
            onClick={(e) => handleSeleccionarCliente('ALL', e)}
            className={`bg-white rounded-2xl p-3 border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              matrizAbierta && (clienteActual === 'ALL' || clienteActual === 'TODOS')
                ? 'border-purple-600 ring-2 ring-purple-500/20 shadow-md'
                : 'border-slate-200 hover:border-slate-300 shadow-xs'
            }`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-600 via-indigo-600 to-emerald-500 rounded-l-2xl" />

            <div className="pl-1.5">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-500 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                  ALL
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 leading-tight">{isEnglish ? "All customers" : "Todos los clientes"}</h4>
                  <p className="text-[10px] text-slate-500">{isEnglish ? "Full portfolio" : "Cartera completa"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 my-2.5">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-1.5 text-center">
                  <span className="text-xs font-bold text-slate-900 block">4</span>
                  <span className="text-[9px] text-slate-500 font-medium">{isEnglish ? "Records" : "Registros"}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-1.5 text-center">
                  <span className="text-xs font-bold text-slate-900 block">3</span>
                  <span className="text-[9px] text-slate-500 font-medium">{isEnglish ? "Reception" : "Recepción"}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-1.5 text-center">
                  <span className="text-xs font-bold text-slate-900 block">1</span>
                  <span className="text-[9px] text-slate-500 font-medium">{isEnglish ? "Deliveries" : "Entregas"}</span>
                </div>
              </div>
            </div>

            <div className="pl-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500 font-medium">
              <span>{isEnglish ? "Overview" : "Vista general"}</span>
              <span className="font-bold text-purple-700">{isEnglish ? "Open →" : "Abrir →"}</span>
            </div>
          </div>

        </div>
      </div>

      {/* BANDEROLA Y TABLA PRINCIPAL (SOLO SE MUESTRAN SI SE HACE CLICK EN UNA TARJETA) */}
      {matrizAbierta && (
        <>
          {/* BANDEROLA DEL CLIENTE SELECCIONADO */}
          <div className="bg-purple-500/5 border border-purple-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                {clienteActual === 'EJEMPLO 1' && 'Cliente: EJEMPLO 1'}
                {(clienteActual === 'ALL' || clienteActual === 'TODOS' || !clienteActual) && 'Todos los clientes'}
              </h3>
            </div>
            <button 
              type="button" 
              onClick={handleCerrarMatriz}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              ✕
            </button>
          </div>

          {/* TABLA PRINCIPAL DE MATRIZ DE RECEPCIÓN Y ENTREGA */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "TYPE" : "TIPO"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "FOLIO" : "FOLIO"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "OC" : "OC"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "REQUISITION / REQUESTS" : "REQUISICIÓN / SOLICITUDES"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "CLIENTS" : "CLIENTE"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "QUANTITY / PROGRESS" : "CANTIDAD / AVANCE"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "QUALITY / CONDITION" : "CALIDAD / ESTADO"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "DOCUMENTS / EVIDENCE" : "DOCUMENTOS / EVIDENCIA"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "PHOTOS" : "FOTOS"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "ACCEPTANCE" : "ACEPTACIÓN"}</th>
                  <th className="p-2.5 whitespace-nowrap">{isEnglish ? "SIGNATURE / INTEGRITY" : "FIRMA / INTEGRIDAD"}</th>
                  <th className="p-2.5 whitespace-nowrap text-center">{isEnglish ? "ACTIONS" : "ACCIONES"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {datosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400">
                      {isEnglish ? "No data recorded for this client." : "Sin datos registrados para este cliente."}
                    </td>
                  </tr>
                ) : (
                  datosFiltrados.map((row, index) => {
                    const esEntrega = row.tipo === 'ENTREGA';
                    return (
                      <tr key={row.id || index} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 whitespace-nowrap">
                          {esEntrega ? (
                            <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                             {isEnglish ? "🚚 DELIVERY" : "🚚 ENTREGA"} 
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              {isEnglish ? "📦 RECEIVING" : "📦 RECEPCIÓN"} 
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{row.folio}</div>
                          <div className="text-[9px] text-slate-400 font-medium">{row.subFolio}</div>
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-slate-600 font-medium leading-tight">
                          {row.oc.split('\n').map((item, i) => (
                            <div key={i}>{item}</div>
                          ))}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{row.requisicion}</div>
                          {row.subRequisicion && <div className="text-[9px] text-slate-400">{row.subRequisicion}</div>}
                        </td>
                        <td className="p-2.5 whitespace-nowrap font-semibold text-slate-700">
                          {row.cliente}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{row.cantidad}</div>
                          <div className="text-[9px] text-slate-400">{row.subCantidad}</div>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            esEntrega ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {row.calidad}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{row.documentos}</div>
                          <div className="text-[9px] text-slate-400 max-w-[150px] truncate">{row.subDocumentos}</div>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            {row.fotos}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            {row.aceptacion}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                              🔒 {row.firma}
                            </span>
                            {row.sha && <span className="text-[8px] font-mono text-slate-400">{row.sha}</span>}
                          </div>
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            {esEntrega ? (
                              <button
                                type="button"
                                className="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white text-[9px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                              >
                               {isEnglish ? "VIEW FORMAT" : "VER FORMATO"} 
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => typeof setActiveTab === 'function' && setActiveTab(1)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[9px] font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {isEnglish ? "RECEPTION" : "RECEPCIÓN"} 
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                                >
                                 {isEnglish ? "ELIMINATE" : "ELIMINAR"}  
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
})()}

        {/* VISTA 4: SEMÁFORO DE CIERRE */}
        {activeTab === 4 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 text-left space-y-6">
            
            {/* Encabezado con Botón "Ver recepción y entrega" */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{isEnglish ? "Closing traffic light" : "Semáforo de cierre"}</h3>
                <p className="text-xs text-slate-400">
                 {isEnglish ? "Conditions necessary to close a requisition and complete the supply cycle." : "Condiciones necesarias para cerrar una requisición y completar el ciclo de suministro."} 
                </p>
              </div>
               <button onClick={() => setActiveTab(3)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl shadow-2xs flex items-center gap-1.5 cursor-pointer">
                <span>📋</span>
                <span>{isEnglish ? "View reception and delivery" : "Ver recepción y entrega"}</span>
              </button>
            </div>

            {/* Grid de las 5 Tarjetas del Semáforo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              
              {/* Tarjeta 1: OC sin recepción */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500 rounded-t-2xl"></div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-slate-900 leading-none">0</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-3">
                 {isEnglish ? "OC no reception" : "OC sin recepción"} 
                </p>
              </div>

              {/* Tarjeta 2: Recepciones con pendientes */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500 rounded-t-2xl"></div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-slate-900 leading-none">0</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-3">
                {isEnglish ? "Receptions with pending items" : "Recepciones con pendientes"}   
                </p>
              </div>

              {/* Tarjeta 3: Entregas no registradas */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-purple-600 rounded-t-2xl"></div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-slate-900 leading-none">0</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-3">
                 {isEnglish ? "Unrecorded deliveries" : "Entregas no registradas"}   
                </p>
              </div>

              {/* Tarjeta 4: Aceptaciones pendientes */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-500 rounded-t-2xl"></div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-slate-900 leading-none">0</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-3">
                {isEnglish ? "Pending acceptances" : "Aceptaciones pendientes"}   
                </p>
              </div>

              {/* Tarjeta 5: Listos para facturar */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500 rounded-t-2xl"></div>
                <div className="pt-1">
                  <span className="text-2xl font-black text-slate-900 leading-none">0</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-3">
                {isEnglish ? "Ready to invoice" : "Listos para facturar"}   
                </p>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}