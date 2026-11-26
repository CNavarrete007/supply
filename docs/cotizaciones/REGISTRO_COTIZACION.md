# Cotizaciones › Registro de cotización (13 nov 2026)

Tarjeta 4 de **Cotizaciones y Comparativo** con el diseño de referencia ("Registro de cotización · Paso 3"). Componente
`src/views/quotes/SupplierQuoteCard.jsx`; lógica pura `src/views/quotes/supplierQuote.mjs`; ventana de requisiciones
compartida con la tarjeta 2 en `src/views/quotes/RequisitionPickerModal.jsx`.

## Flujo (datos reales de MariaDB, sin escrituras)

1. **Comprador responsable** (validación del contratista; ↻ recarga) → ventana con sus **requisiciones validadas que ya
   tienen RFQ** (`GET /api/v1/quotes/rfq-requisitions?rfq=with`).
2. **RFQ emitida**: RFQ de la requisición (`GET /api/v1/quotes/rfq-requisitions/{id}` → `rfqs`, con proveedor, moneda y
   cotizaciones ya registradas). **Proveedor de la RFQ** y **moneda** se llenan solos; si la RFQ ya tiene cotización se
   avisa que una nueva captura sería otra oferta del mismo proveedor.
3. **Partidas cotizadas por esta empresa**: las partidas de la RFQ (`GET /api/v1/quotes/rfqs/{id}`) con *Ofrece*,
   cantidad solicitada, cantidad cotizada (aviso *Parcial* / *Excede lo solicitado*), unidad, precio unitario recibido,
   importe sin IVA, IVA y total con IVA, más totales.
4. **Subtotal calculado** y **Total de la cotización recibida** = suma de las partidas ofertadas (IVA % editable, 16 por
   defecto), redondeo a centavos por partida.
5. Campos del diseño: folio (automático al guardar), referencia interna (de la requisición), referencia del proveedor,
   fecha de cotización*, vigencia (no anterior a la fecha), moneda, días de entrega* (entero 0–3650), condiciones de pago
   SAT (PUE / PPD), cumplimiento técnico % y documentación % (0–100), comentarios.
6. **Validación de la captura**: muestra lo pendiente o "Captura completa … Presiona Guardar cotización para registrarla
   en MariaDB".
7. **PDF de la cotización**: se valida por su firma `%PDF-` (máx. 8 MB, límite de transporte del gateway) y se
   previsualiza en el navegador; al guardar se almacena de forma privada con la cotización.
8. Botones (diseño de referencia, en este orden): **💾 Guardar cotización**, **🧹 Limpiar** (deja el formulario como
   nuevo: comprador, requisición, RFQ, captura, partidas y PDF), **📊 Ver comparativo** (tarjeta 5 con la requisición) y
   **📋 Ver matriz** (tarjeta 11).

**Guardar cotización** valida toda la captura: si falta algo marca los campos y partidas pendientes; si está completa
**la registra en MariaDB** (26 nov 2026): `supplier_quotes` + `supplier_quote_items` con folio **COT-AAAA-NNNN**, estatus
«Recibida», importes recalculados por el servidor y el PDF privado. Las RFQ que ya tienen cotización aparecen
deshabilitadas («ya cotizada»): se editan con **EDITAR** desde la matriz interna. Detalle, reglas, endpoints y activación
en la PC: [REGISTRO_COTIZACION_PROVEEDOR.md](REGISTRO_COTIZACION_PROVEEDOR.md).

**Qué RFQ se pueden elegir (26 nov 2026):** la ventana del comprador lista solo requisiciones con al menos una RFQ **por
cotizar** (enviada, no cancelada y sin cotización; `GET /api/v1/quotes/rfq-requisitions?rfq=quotable`). En la lista «RFQ
emitida» las demás aparecen deshabilitadas con su motivo: «ya cotizada: COT-…» (se corrige con EDITAR en la matriz interna),
«borrador: márcala como enviada en la Matriz de RFQ» o «borrador importado: registra una RFQ nueva en la tarjeta 2». Si la
requisición elegida ya no tiene RFQ por cotizar, la tarjeta lo explica con accesos a la matriz interna y a la tarjeta 2.

**Formato de cantidades y precios (26 nov 2026):** se aceptan como los escribe el comprador: con signo de pesos, comas de miles
y espacios (`$ 1,250.50`, `1 500`, `.5`, `1500.`). Se calculan al momento y se guardan limpios (`1250.50`). Si el texto no es un
número claro (`abc`, `1,5`, `1.234,50`), la partida lo marca en rojo de inmediato («Formato no válido») y no se puede guardar; un
precio en `0` muestra una advertencia para confirmar que el proveedor no lo cobra.

La lista de **cotizaciones recibidas** (tarjetas por proveedor, filtro en el servidor y detalle interno con costos) está
en la tarjeta 11 *Matriz interna de proveedores*.

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/supplier_quote.test.mjs` | 6/6 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura) | 123/123 |
| `tests/quotes_http_check.py` | 76/76 |
