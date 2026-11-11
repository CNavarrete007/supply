# SupplyFlow · Análisis de brechas: frontend sin BD (`grupo-gerez-compras.zip`) vs. sistema actual conectado

Fecha: 11 nov 2026. Comparación archivo por archivo (ignorando saltos de línea CRLF/LF) entre el ZIP (frontend v1.1.0 sin
backend) y el repositorio actual (React + API CodeIgniter + MariaDB).

## 1. Resultado de la comparación de código

| Archivo del ZIP | Estado en el sistema actual |
|---|---|
| 16 vistas (`ClientPortal`, `Clients`, `Configuration`, `ContractorManagement`, `Contractors`, `CustomerPortal`, `Invoice`, `OperationalServices`, `ProcessFlow`, `PurchaseOrders`, `Quotes`, `ReceptionDelivery`, `SupplierSupply`, `Suppliers`) + `index.css`, `main.jsx` | **Idénticos**: el frontend del ZIP ya está completo dentro del proyecto. |
| `Dashboard.jsx`, `GeneralMatrix.jsx`, `Reports.jsx`, `UsersRoles.jsx` (y `Clients.jsx`, `Suppliers.jsx`) | Son **exactamente** los "archivos clase" ya rediseñados y conectados a MariaDB (10–11 nov 2026). |
| `Requisition.jsx` (2,405 líneas) | Sustituido por `recovery/RequisitionRecovery.jsx` (reconstrucción RF1 de las 6 tarjetas originales, conectada). |
| `Login.jsx`, `App.jsx` | El ZIP usa sesión simulada en `localStorage`; el actual valida en el servidor (cookie HttpOnly), no confía en `localStorage` y desactiva el acceso de clientes al portal. |

**Conclusión:** no falta ninguna pantalla, sección ni botón del ZIP en el sistema actual. Lo que falta es que **11 módulos
siguen con datos de demostración** (no leen ni guardan en MariaDB) y que, en los módulos conectados, las **escrituras**
(altas, ediciones, bloqueos, emisión de documentos) siguen bloqueadas hasta que existan endpoints seguros.

## 2. Estado por módulo

### 2.1 Conectados a MariaDB (lectura real; escrituras según se indica)

| Módulo | Ya funciona con BD | Funciones del diseño aún bloqueadas | Motivo |
|---|---|---|---|
| Inicio y Dashboard | 14 secciones con analítica, etapas, alertas, cambios | Lotes/rutas paralelas, ahorro, proveedores top, Service-to-Cash, Service Fee, pagos, recompra, enmiendas OC, compradores | Faltan endpoints de consulta de esas tablas |
| Clientes | Matriz, ficha, indicadores, vista previa de importación, política de recompra (consulta) | Alta, edición, eliminación, guardar importación, clave de portal, editar política | Escritura: requiere endpoint + permisos SQL nuevos |
| Proveedores | Matriz, ficha, indicadores, vista previa de importación | Alta, edición, eliminación, guardar importación; columna OC por proveedor | Escritura; conteo de OC pendiente |
| **Suministros de proveedores** | **Nuevo (11 nov 2026):** matriz con tarjetas por proveedor, ficha y resumen comercial | Alta/edición de suministros | Escritura |
| Solicitud / Requisición | Registro (RF1), Regularización (R2), Matriz | Catálogo de categorías, Crear desde historial, Control de cambios (R3A/R3B/R3C1), consultas R3C2/R3C3 | INT03-D2/D3 (los endpoints R3 ya existen y pasaron INT02) |
| Matriz General | Tarjetas por cliente, matriz consolidada, CSV, impresión, detalle | Emitir OC | Escritura comercial bloqueada por regla del proyecto |
| Reportes | Generador gerencial completo con cifras reales | — | — |
| Usuarios y roles | Matriz, ficha, roles (acceso efectivo), resumen, bitácora | Alta, edición, bloqueo, eliminación, roles, fotografía, contratista | Escritura de cuentas: requiere endpoint + permisos SQL |

### 2.2 Con datos de demostración (código idéntico al ZIP) — trabajo pendiente

| Módulo (archivo) | Secciones del diseño | Tablas que ya existen en MariaDB | Lectura posible sin cambiar permisos | Escrituras |
|---|---|---|---|---|
| Órdenes de Compra (`PurchaseOrders.jsx`, 28 botones) | Emisión de OC, Matriz de órdenes, Control de autorización, Modificaciones/enmiendas, Formato de OC | `purchase_orders`, `purchase_order_items`, `purchase_order_requisitions`, `purchase_order_modification_requests`, `purchase_order_line_sources` | Sí: matriz, autorización (consulta), enmiendas (consulta), formato imprimible | Bloqueadas (comerciales) |
| Cotizaciones y Comparativo (`Quotes.jsx`, 87 botones) | Vista general, Solicitud a proveedores (RFQ), Matriz de RFQ, Cotizaciones recibidas, Comparativo, Cotización al cliente, Revisiones | `rfqs`, `rfq_items`, `supplier_quotes`, `supplier_quote_items`, `awards`, `customer_quotes`, `customer_quote_versions`, `customer_quote_items`, `customer_quote_adjustments`, `customer_quote_decisions`, `approval_policy_versions` | Sí (todo en consulta) | Bloqueadas (comerciales) |
| Recepción y Entrega (`ReceptionDelivery.jsx`) | Registro de recepción, Entrega al cliente, Matriz, Semáforo de cierre | `goods_receipts`, `goods_receipt_items`, `deliveries`, `delivery_items`, `delivery_sources`, `delivery_item_allocations`, `signature_evidence` | Sí: matriz y semáforo | Bloqueadas (comerciales) |
| Factura (`Invoice.jsx`) | Registro de factura, Matriz, Control de facturación y cierre | `invoices`, `invoice_purchase_orders`, `invoice_acknowledgments` | Sí: matriz y control | Bloqueadas (comerciales) |
| Gestión del Contratista (`ContractorManagement.jsx`) | Registro de validación, Estrategia y lotificación, Matriz de validaciones, Reglas inteligentes | `requisition_reviews`, `sourcing_plans`, `sourcing_lots`, `sourcing_lot_items`, `sourcing_lot_suppliers` | Sí: validaciones y lotes en consulta | Bloqueadas (flujo comercial) |
| Servicios Operativos (`OperationalServices.jsx`) | Panel ejecutivo, indicadores, nueva solicitud, matriz de servicios, documento del servicio | `service_orders`, `service_types` | Sí | Requieren endpoint + permisos |
| Configuración (`Configuration.jsx`) | Identidad y formatos, parámetros, aprobaciones, condiciones, correos, respaldo/importación, reinicio | `organization_settings`, `approval_policy_versions`, `document_sequences`, `email_delivery_logs` | Sí (consulta) | Requieren endpoint + permisos; "Reinicio del sistema" **no** debe habilitarse sin un procedimiento aprobado |
| Contratista (`Contractors.jsx`) | Catálogo de contratistas | No hay tabla `contractors`; posibles fuentes: `clients`, `projects`, `contracts` | Requiere confirmar con el sistema original qué es "contratista" | — |
| Portal del Cliente (`ClientPortal.jsx`, `CustomerPortal.jsx`) y acceso de clientes en Login | Cotización comercial, órdenes disponibles, seguimiento | `portal_access_tokens`, `customer_quote_decisions`, … | Requiere **diseño de seguridad** del acceso externo (tokens, alcance por cliente, auditoría) | Decisiones del cliente: comerciales |
| Flujo del Proceso (`ProcessFlow.jsx`) | Mapa del proceso | — | Es documental: no necesita BD | — |

## 3. Plan por fases

| Fase | Contenido | ¿Necesita tu autorización? |
|---|---|---|
| 1 · Lectura | Suministros (**hecho**), Órdenes de Compra (**hecho**), Cotizaciones y Comparativo (**hecho**), Recepción y Entrega (**hecho**), Factura, Gestión del Contratista, Servicios Operativos, Configuración (consulta), Requisición: Catálogo de categorías | No (solo SELECT con la cuenta API existente; misma guarda Master Admin) |
| 2 · Endpoints ya validados | Requisición: Control de cambios R3A/R3B/R3C1 (INT03-D2) y consultas R3C2/R3C3 (INT03-D3) | No (usa endpoints y permisos 52 ya aprobados) |
| 3 · Escrituras de catálogos y cuentas | Clientes, Proveedores, Suministros, política de recompra, Usuarios y roles, Configuración | **Sí**: requiere nuevos permisos SQL (cambia el contrato 77/52), CSRF, idempotencia y auditoría |
| 4 · Escrituras comerciales | RFQ, cotizaciones, OC (emitir/autorizar/enmendar), recepción, entrega, factura | **Sí**, y según la regla del proyecto siguen bloqueadas hasta pruebas integrales |
| 5 · Portal del Cliente | Acceso externo seguro | **Sí** (diseño de seguridad) |

Cada módulo de la fase 1 se entrega con: endpoint GET con validación estricta (422), guarda 401/403, prueba HTTP de
contrato (apta para la base real), modelo con pruebas unitarias, E2E de interfaz de solo lectura y prueba de humo.
