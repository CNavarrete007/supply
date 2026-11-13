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
6. **Validación de la captura**: muestra lo pendiente o "Captura completa … lista para guardarse cuando se habilite el
   registro".
7. **PDF de la cotización**: se valida por su firma `%PDF-` (máx. 10 MB) y se previsualiza solo en este navegador; no se
   sube.
8. Botones (diseño de referencia, en este orden): **💾 Guardar cotización**, **🧹 Limpiar** (deja el formulario como
   nuevo: comprador, requisición, RFQ, captura, partidas y PDF), **📊 Ver comparativo** (tarjeta 5 con la requisición) y
   **📋 Ver matriz** (tarjeta 11).

**Guardar cotización** valida toda la captura: si falta algo marca los campos y partidas pendientes; si está completa
responde "Captura validada … No se guardó", porque registrar la oferta (`supplier_quotes`, `supplier_quote_items`, PDF) es una
escritura comercial sin pruebas integrales. Cuando se autorice, el formulario ya produce todos los campos del esquema
(`supplier_reference`, `quote_date`, `valid_until`, `currency_code`, `subtotal_amount`, `tax_rate_pct`, `tax_amount`,
`total_amount`, `lead_days`, `payment_terms`, `technical_score`, `document_score`, `notes` y por partida `offered`,
`quantity`, `unit_price`, `line_subtotal`).

La lista de **cotizaciones recibidas** (tarjetas por proveedor, filtro en el servidor y detalle interno con costos) está
en la tarjeta 11 *Matriz interna de proveedores*.

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/supplier_quote.test.mjs` | 6/6 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura) | 123/123 |
| `tests/quotes_http_check.py` | 76/76 |
