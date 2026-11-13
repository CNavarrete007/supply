# SupplyFlow · Mapa de los módulos conectados a MariaDB

Fecha: 10 nov 2026 (Proveedores, Matriz General, Reportes y Usuarios y roles: 11 nov 2026). Derivado del código real y de respuestas HTTP reales (base sintética de 77 tablas).
Objetivo: modificar el **frontend** de estos módulos sin romper su conexión con la base.

## Cadena de cada módulo

| Menú (App.jsx `id`) | Componente React (archivo real) | Cliente HTTP | Endpoints (todos `GET`, solo lectura) | Backend (controlador → repositorio) | Acceso |
|---|---|---|---|---|---|
| Inicio y Dashboard (`dashboard`) | `Dashboard` en `src/views/Dashboard.jsx` (cálculos en `src/views/dashboard/model.mjs`) | `src/analyticsApi.js`, `src/matrixApi.js`, `src/catalogApi.js`, `src/views/recovery/api.js` | `/api/v1/analytics/overview`, `/api/v1/analytics/requisitions?page_size=5`, `/api/v1/matrix/clients`, `/api/v1/recovery/matrix`, `/api/v1/catalogs/{clients,suppliers}?page_size=1`, `/api/v1/recovery/changes`, `/api/v1/recovery/changes/review-queue` | `AnalyticsController`, `MatrixController`, `CatalogDirectoryController`, `RequisitionRecoveryController`, `RequisitionChangeController` | Master Admin |
| Clientes (`clients`) | `ClientsCatalog` en **`src/views/clients/ClientsCatalog.jsx`** (re-exportado por `CatalogReadOnly.jsx`; lógica en `src/views/clients/model.mjs`) | `src/catalogApi.js`, `src/matrixApi.js` | `/api/v1/catalogs/clients`, `/api/v1/catalogs/clients/{id}`, `/api/v1/matrix/clients` | `CatalogDirectoryController` → `CatalogReadRepository`; `MatrixController` | Master Admin |
| Proveedores (`suppliers`) | `SuppliersCatalog` en **`src/views/suppliers/SuppliersCatalog.jsx`** (re-exportado por `CatalogReadOnly.jsx`; lógica en `src/views/suppliers/model.mjs`) | `src/catalogApi.js` (`kind='suppliers'`) | `/api/v1/catalogs/suppliers`, `/api/v1/catalogs/suppliers/{id}` | `CatalogDirectoryController` → `CatalogReadRepository` | Master Admin |
| Suministros de proveedores (`supply`) | `SupplierSupplyCatalog` en `src/views/supplies/SupplierSupplyCatalog.jsx` (lógica en `src/views/supplies/model.mjs`) | `src/catalogApi.js` (`listSupplierOfferings`, `getCatalogRecord`) | `/api/v1/catalogs/supplier-offerings` (`page`, `page_size` ≤ 50, `q`, `status`, `supplier`), `/api/v1/catalogs/suppliers/{id}` | `CatalogDirectoryController::supplierOfferings` → `SupplierOfferingReadRepository` (cuenta API, SELECT) | Master Admin |
| Órdenes de Compra (`purchase_orders`) | `PurchaseOrdersModule` en `src/views/purchaseOrders/PurchaseOrdersModule.jsx` (lógica `model.mjs`, cliente `api.js`) | `src/views/purchaseOrders/api.js` | `/api/v1/purchase-orders` (`page`, `page_size` ≤ 50, `q`, `status`, `buyer`, `sort`, `scope`), `/purchase-orders/issuance`, `/purchase-orders/tasks`, `/purchase-orders/{id}` | `PurchaseOrderController` (base `ReadOnlyModuleController`) → `PurchaseOrderReadRepository` (cuenta API, SELECT) | Master Admin |
| Cotizaciones y Comparativo (`quotes`) | `QuotesModule` en `src/views/quotes/QuotesModule.jsx` (lógica `model.mjs`, cliente `api.js`) | `src/views/quotes/api.js` | `/api/v1/quotes/rfqs`, `/quotes/rfqs/{id}`, `/quotes/supplier-quotes`, `/quotes/supplier-quotes/{id}`, `/quotes/comparison`, `/quotes/customer-quotes`, `/quotes/customer-quotes/{id}`, `/quotes/awards`, `/quotes/revisions`, `/quotes/rfq-setup`, `/quotes/rfq-requisitions`, `/quotes/rfq-requisitions/{id}`, `/quotes/rfq-contacts`; **Solicitar modificación** usa R3A `/recovery/requisitions/{id}` (GET), `/recovery/catalogs` (GET) y `POST /recovery/requisitions/{id}/changes` | `QuoteController` (base `ReadOnlyModuleController`) → `QuoteReadRepository` (cuenta API, SELECT) | Master Admin |
| Recepción y Entrega (`reception`) | `ReceptionModule` en `src/views/reception/ReceptionModule.jsx` (lógica `model.mjs`, cliente `api.js`) | `src/views/reception/api.js` | `/api/v1/reception/matrix`, `/reception/orders`, `/reception/orders/{id}`, `/reception/receipts/{id}`, `/reception/deliveries/{id}`, `/reception/closure` | `ReceptionController` (base `ReadOnlyModuleController`) → `ReceptionReadRepository` (cuenta API, SELECT) | Master Admin |
| Factura (`invoice`) | `InvoiceModule` en `src/views/invoices/InvoiceModule.jsx` (lógica `model.mjs`, cliente `api.js`) | `src/views/invoices/api.js` | `/api/v1/invoices`, `/invoices/{id}`, `/invoices/requisitions`, `/invoices/requisitions/{id}`, `/invoices/control` | `InvoiceController` (base `ReadOnlyModuleController`) → `InvoiceReadRepository` (cuenta API, SELECT; reutiliza la regla de etapa 6 de `ReceptionReadRepository::readiness`) | Master Admin |
| Matriz General (`general_matrix`) | `GeneralMatrix` en `src/views/GeneralMatrix.jsx` (lógica en `src/views/generalMatrix/model.mjs`) | `src/matrixApi.js`, `src/views/recovery/api.js` | `/api/v1/matrix/requisitions` (todas las páginas de 50), `/api/v1/matrix/requisitions/{id}`, `/api/v1/matrix/clients`, `/api/v1/recovery/matrix` (etapas) | `MatrixController` → `MatrixReadRepository`; `RequisitionRecoveryController` | Master Admin |
| Reportes (`reports`) | `Reports` en `src/views/Reports.jsx` (lógica en `src/views/reports/model.mjs`; datos con `src/views/generalMatrix/useMatrixData.js`) | `src/matrixApi.js`, `src/views/recovery/api.js` | `/api/v1/matrix/requisitions` (todas las páginas de 50), `/api/v1/matrix/clients`, `/api/v1/recovery/matrix` (mismas fuentes que la Matriz General) | `MatrixController` → `MatrixReadRepository`; `RequisitionRecoveryController` | Master Admin |
| Usuarios y roles (`users_roles`) | `UsersRoles` en `src/views/UsersRoles.jsx` (lógica en `src/views/usersRoles/model.mjs`, cliente `src/views/usersRoles/api.js`) | `src/views/usersRoles/api.js` | `/api/v1/users?page=` (todas las páginas), `/api/v1/roles`, `/api/v1/users/functions`, `/api/v1/audit-events` | `UserDirectoryController` → `SupplyAuthRepository` (cuenta auth) y `UserActivityReadRepository` (cuenta API, SELECT) | Master Admin (`users.read`) |

**Importante:** `src/views/Clients.jsx` (1,541 líneas) y `src/views/Suppliers.jsx` (1,617 líneas) son los diseños de referencia, ya trasladados a `clients/ClientsCatalog.jsx` y `suppliers/SuppliersCatalog.jsx`; **no están conectados**: `App.jsx` importa `ClientsCatalog`/`SuppliersCatalog` desde `CatalogReadOnly.jsx`. Son prototipos anteriores con datos de demostración; no editarlos pensando que cambian la pantalla real. Si se quieren recuperar partes de su diseño, se trasladan a `CatalogReadOnly.jsx` (o a componentes nuevos) usando los campos reales de abajo.

## Parámetros que acepta el servidor (fuera de estos, responde 422)

| Endpoint | Parámetros | Límites |
|---|---|---|
| `analytics/overview` | `from`, `to` (AAAA-MM-DD), `client` (UUID o `all`) | No admite `has`, `q`, `page`, `page_size` (→ 422) |
| `analytics/requisitions` y `.csv` | `from`, `to`, `client`, `has`, `q`, `page`, `page_size` | `page_size` 1–50; el CSV exporta todo el filtro, no solo la página |
| `catalogs/clients`, `catalogs/suppliers` | `page`, `page_size`, `q`, `status` | `page_size` 1–50 |
| `matrix/requisitions` | `page`, `page_size`, `q`, `client`, `has` | `page_size` 1–50 |
| `users` | `page` | 50 por página fijo |
| `audit-events` | `page`, `page_size`, `from`, `to`, `actor`, `role`, `module`, `action`, `q` | `page_size` 1–50; fechas UTC |
| `quotes/rfqs` | `page`, `page_size`, `q`, `status`, `supplier` (UUID o `all`), `contact` (`all`, `unassigned`, UUID de usuario o `legacy-<16 hex>`) | `page_size` 1–50 |
| `quotes/supplier-quotes` | `page`, `page_size`, `q`, `status`, `supplier` (UUID o `all`) | `page_size` 1–50 |
| `quotes/rfq-contacts` | ninguno | Sin paginación (`page` → 422) |
| `quotes/comparison` | `requisition` (UUID o `all`) | Sin paginación (`page` → 422) |
| `quotes/customer-quotes` | `page`, `page_size`, `q`, `decision`, `client`, `scope` (`current`/`all`) | `page_size` 1–50 |
| `quotes/awards` | `page`, `page_size`, `q`, `status` (`current`, `all` o código) | `page_size` 1–50 |
| `quotes/revisions` | `page`, `page_size`, `q`, `status` (`all`, `pending`, `approved`, `closed`) | `page_size` 1–50 (la tarjeta usa 24) |
| `quotes/rfq-setup` | ninguno | Sin paginación (`page` → 422) |
| `quotes/rfq-requisitions` | `page`, `page_size`, `q`, `buyer` (`all`, `unassigned`, UUID de usuario o `legacy-<16 hex>`) | `page_size` 1–50 |
| `reception/matrix` | `page`, `page_size`, `q`, `client` (UUID o `all`), `kind` (`all`/`receipt`/`delivery`) | `page_size` 1–50 |
| `reception/orders` | `page`, `page_size`, `q`, `status` (`all`/`pending`/`partial`/`complete`) | `page_size` 1–50 |
| `reception/closure` | ninguno | Cualquier parámetro → 422 |
| `invoices` | `page`, `page_size`, `q`, `client` (UUID o `all`), `state` (`all`/`active`/`pending`/`overdue`/`paid`/`cancelled`) | `page_size` 1–50 |
| `invoices/control`, `invoices/requisitions` | ninguno | Cualquier parámetro → 422 |

## Campos reales de cada respuesta

Negrita = disponible pero **no usado** hoy por la vista (se puede mostrar sin tocar el backend).

- **analytics/overview**: `summary.{total, **undated**, with_rfq, with_supplier_quote, with_customer_quote, with_purchase_order, with_receipt, with_delivery, with_invoice}`, `monthly[].{period, requisitions}`, `top_clients[].{id, name, requisitions}`, `financial.{requisition_budgets, purchase_orders, customer_quotes}`, `catalogs.{clients, suppliers}`, `definitions.{**date_basis**, document_grain, **money_basis**, coverage, **trend**}`, `filters`, **`source`**.
- **analytics/requisitions**: `total`, `page`, `page_size`, `summary.{total, with_* …}`, `budgets`, `items[].{id, folio, client_name, project, request_date, need_date, currency_code, budget_amount, description, line_count, rfq_count, **supplier_quote_count**, customer_quote_count, purchase_order_count, receipt_count, delivery_count, **invoice_count**}`, **`notes`**.
- **matrix/clients**: `items[].{id, **code**, name, requisitions}`.
- **catalogs/clients**: `items[].{id, code, name, brand_name, tax_id, project, contract_reference, status, **legacy_status**, data_incomplete, portal_enabled, requisition_count, primary_contact, primary_email}`, `total`, `page`, `summary.{total, statuses[].{code,count}, incomplete}`. Detalle `item`: + `address, terms, notes, **portal_locked**, contacts[], channels[]`, `repeat_policy.{sales_policy, sourcing_policy, price_validity_days, contract_reference, contract_valid_until, min_margin_pct, updated_at}` (desde 11 nov 2026; columnas `clients.repeat_*`).
- **catalogs/suppliers**: `items[].{id, code, supplier_key, name, tax_id, status, **legacy_status**, data_incomplete, category, currency, credit_type, credit_days, lead_time_value, lead_time_unit, rating, offerings_count, primary_contact, primary_email}`, `summary`. Detalle `item`: + `notes, **document_notes**, **rating_scale**, contacts[].{id,name,position,**is_primary**}, channels[].{type,value,**source_field**,**is_primary**}`.
- **matrix/requisitions**: `items[].{id, folio, client_name, **client_code**, **client_id**, client_reference, internal_reference, references.{purchase_orders[], purchase_order_totals[{id, folio, currency, amount}], winning_suppliers[], winning_supplier_source, receipts[], invoices[]} (desde 11 nov 2026), request_date, need_date, priority_code, **route_code**, project, contract_reference, requester_name, currency_code, budget_amount, description, delivery_place, **current_revision_number**, notes, source_type, **created_at**, **updated_at**, line_count, review_count, rfq_count, supplier_quote_count, customer_quote_count, purchase_order_count, receipt_count, delivery_count, invoice_count}`, `summary`, **`milestone_note`**. Detalle: `item` (mismos campos), `lines[].{id, line_number, description, quantity, unit_label, **category_label_snapshot**, line_status, **legacy_id**, **history_based**}`, `documents.{reviews, rfqs, supplier_quotes, customer_quotes, purchase_orders, receipts, deliveries, invoices}`.
- **users**: `items[].{id, name, email, position, phone, status, access_enabled, credential_state, roles[], role_codes[], permission_overrides[{code, effect}], last_login_at (UTC)}`, `total`, `page`.
- **roles**: `items[].{code, name, users, description, is_system, permissions[{code, description}]}`.
- **users/functions**: `items[].{id, po_buyer, po_preparer, po_authorizer, review_buyer, rfq_contact, audit_actions, last_activity_at}` (funciones **observadas** en documentos; sin parámetros).
- **audit-events**: `items[].{id, occurred_at, recorded_at, module, action, result, detail, source_kind, actor_id, actor_name, actor_email, actor_snapshot_name, subject_label, subject_kind, subject_user_name, changes[{field, before, after, value}]}`, `total`, `summary.{total, last_24h, actors, critical}`, `facets.{modules, actions}`. Parámetros: `page`, `page_size` (1–50), `from`/`to` (`AAAA-MM-DD HH:MM:SS` UTC), `actor` (UUID), `role`, `module`, `action`, `q` (≤120); cualquier otro → 422.

## Qué se puede cambiar libremente y qué no

**Libre (solo frontend):** diseño, colores, tipografía, tarjetas, gráficas, orden y visibilidad de columnas, textos (ES/EN), filtros visuales, agrupaciones y cálculos de presentación con los campos de arriba, nuevos componentes, responsive, impresión.

**Contrato que debe mantenerse:**
1. Llamar a los mismos endpoints con los mismos parámetros, vía `analyticsApi.js` / `catalogApi.js` / `matrixApi.js` (o el `fetch` de `UsersRoles`), con `credentials: 'same-origin'` y `cache: 'no-store'`.
2. **Nunca** datos de demostración como respaldo: si la API falla, mostrar el error (`role="alert"`), incluidos 401 (sesión) y 403 (permiso).
3. Respetar límites del servidor (`page_size` ≤ 50, parámetros admitidos por endpoint).
4. Mantener los nombres exportados y las props que usa `App.jsx` (`Dashboard`, `ClientsCatalog`, `SuppliersCatalog`, `GeneralMatrix`, `Reports`, `UsersRoles`; `onNavigate`, `onNotify`, `lang`).
5. Estos módulos son **solo lectura**: botones de Crear/Editar/Eliminar/Importar requieren endpoints nuevos con autorización, CSRF, idempotencia y auditoría; no basta con el frontend.
6. Un campo nuevo que **no** esté en la lista de arriba requiere cambiar el repositorio PHP (y revisar permisos SQL); no inventarlo en el frontend.

## Inicio y Dashboard (rediseño 10 nov 2026)

Diseño, colores, estructura y orden de las 14 secciones del archivo de referencia `clase_dashboard`, con datos reales:
- **Etapas P2P**: 8 etapas calculadas por el servidor (`stage_index` de `/recovery/matrix`, política `apps-script-eight-stage-matrix`). El diseño original mostraba 15/14 etapas con datos fijos; no existen esas etapas en la base.
- **Reglas**: abierto = etapa < Factura; vencido = `need_date` < hoy y etapa < Entrega y aceptación; cerrado = Factura; las requisiciones desde historial o con cambio controlado tienen etapa "pendiente de equivalencia" y se informan aparte.
- **Filtros** (cliente, desde/hasta) aplican a la analítica en el servidor y a las filas de etapas en el cliente con la misma regla.
- **Pendiente de integración** (sin cifras): lotes/rutas paralelas, ahorro, proveedores con mayor actividad, servicios / Service-to-Cash, Service Fee, estatus de pago, recompra/precios, enmiendas de OC, compradores y segregación de OC.
- `Change Requests` muestra solo las solicitudes del usuario que consulta (alcance del endpoint) y la cola de revisión independiente.

## Clientes (rediseño 10 nov 2026)

Diseño de 4 tarjetas de `Clients.jsx` (clase_clientes) con datos reales; pestaña inicial **Matriz**:
- **Matriz**: lista paginada en servidor (búsqueda, estatus con conteos, 25 por página), columnas del diseño, acciones Ver (detalle), Ficha y Portal (navega al módulo "Portal del Cliente"; deshabilitado si el cliente no tiene portal). Columna Acciones fija a la derecha.
- **Registro y actualización** (12–13 nov 2026): **alta y edición reales con guardado automático** (la matriz se refresca tras cada guardado) (`POST /catalogs/clients`, `PUT /catalogs/clients/{id}` con `If-Match`, `Idempotency-Key`, CSRF y bitácora; logotipo PNG/JPG/WEBP validado por bytes en `GET /catalogs/clients/{id}/logo`). Requiere la cuenta `supplyflow_catalogwrite_local` (overlay `compose.supply-catalogwrite.yml`); sin ella el guardado responde 503 `CATALOG_WRITE_NOT_PROVISIONED`. Portal y clave siguen bloqueados. Detalle y activación: `docs/clientes/ALTA_EDICION_CLIENTES.md`.
- **Indicadores**: activos, total, incompletos, portal habilitado (exacto solo si total ≤ 50), mayor actividad por requisiciones (`/matrix/clients`), distribución por estatus y reglas verificadas en código (activo requerido en servidor; código único por organización y **sensible a mayúsculas** en MariaDB).
- **Importar Excel**: vista previa **local** (el archivo no se envía): columnas del diseño y equivalentes en español, valores múltiples, defaults de proyecto/contrato, existentes (comparación sin mayúsculas), repetidos en archivo, incompletos; plantilla descargable. "Guardar en MariaDB" bloqueado. `xlsx` se carga bajo demanda (dependencia existente 0.18.5; tiene avisos de seguridad conocidos para archivos manipulados, por eso solo procesa archivos del propio usuario en su navegador).
- **Política de precios y recompra** (ficha, 11 nov 2026): sección del diseño con política de precio al cliente, política de abastecimiento, vigencia del precio histórico (días; 0 = sin vencimiento automático), referencia de contrato / Price List, vigencia contractual y margen mínimo de referencia, más la regla "precio garantizado ≠ reutilizar costo del proveedor". Lee `clients.repeat_*` (antes no se exponían). Los valores se muestran **tal como están guardados**; solo se traducen las etiquetas que aparecen en el diseño ("Precio sujeto a nueva cotización", "Recotizar proveedores siempre") y un código distinto se marca como "Código registrado en MariaDB". Edición bloqueada (no hay endpoint de escritura); "Nuevo cliente" también bloqueado.
- Pruebas: `tests/frontend/clients_model.test.mjs` (6), `tests/frontend/clients_form.test.mjs` (6), `tests/frontend/clients_ui_e2e.cjs` (29, sin escrituras), `tests/clients_write_http_check.py` (44) y `tests/frontend/clients_write_ui_e2e.cjs` (40) — estas dos últimas **escriben** y solo se ejecutan contra la base sintética (`SF_SYNTHETIC_WRITES=1`).

## Proveedores (rediseño 11 nov 2026)

Diseño de 4 tarjetas de `Suppliers.jsx` (clase_proveedores) con datos reales; pestaña inicial **Matriz**:
- **Matriz**: lista paginada en servidor (búsqueda, estatus con conteos, 25 por página) con las columnas del diseño: Logo (iniciales), No./Clave (`code`/`supplier_key`), Proveedor (+contacto y correo principal), RFC, Categoría, Estatus, Suministros (`offerings_count`), Entrega habitual (`lead_time_value` + unidad), Crédito habitual (tipo + días), Calificación, OC y Acciones (Ver, Ficha, Eliminar bloqueado). Acciones fija a la derecha; con el menú lateral colapsado caben las 12 columnas a 1440 px.
- **OC**: el endpoint no entrega un conteo de órdenes por proveedor; la columna muestra "—" (pendiente de integración), no un número inventado.
- **Registro y actualización**: ficha en modo consulta; selectores por número y razón social con el catálogo **completo** (se lee en páginas de 50, el máximo del servidor) y detalle `/catalogs/suppliers/{id}`: clave, RFC, contactos con puesto, correos y teléfonos (`channels`), categoría, estatus (+ estatus original importado si difiere), moneda, crédito, entrega, calificación con escala (`rating_scale`), documentos (`document_notes`) y observaciones. Guardar bloqueado. La base no tiene logotipos: se muestran iniciales.
- **Evaluación e indicadores**: autorizados / en evaluación / suspendidos desde `summary.statuses`; calificación promedio, productos y servicios registrados y distribución por categoría sobre el catálogo completo; pendientes de actualización (`summary.incomplete`); distribución por estatus con todos los códigos reales (p. ej. `active`, `inactive`); tarjetas de reglas del proceso original (su validación automática depende de Cotizaciones/OC).
- **Importar Excel**: vista previa **local**. Coincidencia por No. de proveedor, Clave, RFC y razón social (sin mayúsculas, acentos ni puntuación), repetidos en archivo, incompletos (sin número, razón social o categoría, moneda no reconocida, correo inválido; quedarían "En evaluación"), categoría y moneda predeterminadas, estatus para nuevos, omitir/actualizar existentes; plantilla descargable. "Guardar en MariaDB" bloqueado.
- La búsqueda reinicia la página solo si el texto cambió (antes, el primer disparo del *debounce* tras montar regresaba a la página 1; mismo ajuste en Clientes).
- Pruebas: `tests/frontend/suppliers_model.test.mjs` (5) y `tests/frontend/suppliers_ui_e2e.cjs` (38, solo lectura; requiere más de 50 proveedores sintéticos para probar la carga por páginas).
- **Registro y actualización** (12 nov 2026): **alta y edición reales con guardado automático** (`POST/PUT /catalogs/suppliers`, logotipo en `GET /catalogs/suppliers/{id}/logo`), matriz sincronizada y tres botones. Misma cuenta `supplyflow_catalogwrite_local` (26 permisos). Detalle: `docs/proveedores/ALTA_EDICION_PROVEEDORES.md`. Pruebas de escritura: `tests/suppliers_write_http_check.py` (40) y `tests/frontend/suppliers_write_ui_e2e.cjs` (36), solo base sintética.

## Matriz General (rediseño 11 nov 2026)

Diseño de `clase_matriz_general` (tarjetas por cliente + matriz consolidada) con datos reales:
- **Tarjetas**: "Todos los clientes" + una por cliente de `/matrix/clients` (incluye clientes sin requisiciones), ordenadas por número de requisiciones. Requisiciones, con OC, con factura, vencidas, proyectos y contratos distintos; en "Todos" el promedio es la **antigüedad promedio de requisiciones abiertas** (sin factura) desde la fecha de solicitud. Búsqueda por nombre, número, proyecto, contrato o RFC (el RFC viene de `/recovery/matrix`). Clic en el fondo cierra la matriz.
- **Matriz**: columnas del diseño; Requisición (`folio`, ref. cliente), Cliente/Proyecto, Folio interno (`internal_reference`), Cotizaciones (`supplier_quote_count`, RFQ debajo), Proveedor ganador, OC, Recepción, Factura (`references`), Monto (= **presupuesto** de la requisición, no gasto real), Fecha requerida, Etapa (8 etapas del servidor; "Pendiente de equivalencia" para históricos/cambios), Riesgo/Acción (Ver detalle existente; **Emitir OC bloqueado**). Filtros: búsqueda (incluye folios de OC/recepción/factura y proveedor), etapa con conteos y el filtro de documentos que ya existía. Paginación local de 25.
- **Riesgo** (misma regla que el Dashboard): Vencido = fecha requerida anterior a hoy y etapa antes de "Entrega y aceptación"; A tiempo; Sin fecha requerida; Entregado; Facturado; Por conciliar (sin etapa equivalente).
- **Imprimir / Exportar CSV**: se generan en el navegador con **todas** las filas filtradas (no solo la página); valores escapados en la impresión y fórmulas neutralizadas en el CSV.
- **Cambio de backend (solo lectura, aditivo)**: `MatrixReadRepository::listing` agrega `references` con folios de OC, proveedor ganador (de la OC vigente; si no hay OC, de la adjudicación activa), folios de recepción y de factura. Excluye OC canceladas/sustituidas y facturas canceladas con la **misma regla** que el cálculo de etapas. El detalle agrega `supplier` a cada OC. Sin endpoints, permisos ni migraciones nuevas; `backend/app` se monta en el contenedor `api`, así que basta `git pull`.
- Las etiquetas de etapa son las del servidor (`Solicitud de cotización`, `Comparativo y autorización`), iguales al Dashboard; el diseño usaba `Solicitud y recepción de cotizaciones` y `Cotización al cliente y aprobación`.
- Pruebas: `tests/frontend/general_matrix_model.test.mjs` (6), `tests/frontend/general_matrix_ui_e2e.cjs` (25, solo lectura) y `tests/matrix_references_http_check.py` (8, solo GET; apto para la base real).

## Reportes (rediseño 11 nov 2026)

Diseño de `clase_reportes` ("Generador de reporte gerencial") con datos reales y las **mismas fuentes y reglas que la Matriz General** (hook compartido `useMatrixData`):
- **Filtros**: Desde/Hasta (fecha de solicitud; sin fecha queda fuera de periodos delimitados, igual que el Dashboard), Cliente (todos los de `/matrix/clients`) y Etapa (8 etapas del servidor + "Pendiente de equivalencia"). El reporte aparece al pulsar **Generar reporte** (como en el diseño); "Actualizar datos" vuelve a consultar MariaDB.
- **KPIs**: Requisiciones; Cerradas (etapa Factura); Vencidas (regla del Dashboard); Presupuesto por moneda (sin presupuesto no cuenta como cero); **Comprado** = OC vigentes (última versión de cada serie, sin canceladas/sustituidas) contadas **una vez** aunque se compartan entre requisiciones; **Ahorro / desviación** = presupuesto − OC **solo** en requisiciones con presupuesto y OC en la misma moneda (positivo = ahorro, negativo en rojo = sobrecosto; "Sin base comparable" si no hay). Nunca se mezclan monedas.
- **Resumen ejecutivo y Conclusiones** se generan con reglas a partir de esas cifras (vencidas y la más atrasada, dentro/fuera de presupuesto por moneda, sin base comparable, sin presupuesto, por conciliar). El diseño original tenía cifras y una conclusión fijas ("se mantiene dentro del presupuesto"); ya no.
- **Tabla**: columnas del diseño (Requisición, Cliente, Proyecto, Monto est. = presupuesto, OC = "n OC · importe" + folios, Recepción, Etapa, Fecha requerida en rojo si está vencida); 25 por página en pantalla. **Imprimir / PDF** (portada con degradado, KPIs, resumen, tabla y conclusiones) y **Exportar CSV** usan todas las filas del alcance; valores escapados y fórmulas neutralizadas.
- La pantalla anterior usaba `/analytics/requisitions(.csv)` con filtros de evidencia y búsqueda; esos filtros siguen en la Matriz General (búsqueda y filtro de documentos) y los endpoints de analítica siguen disponibles (los usa el Dashboard).
- Backend: `references.purchase_order_totals` (aditivo, solo lectura) en `/matrix/requisitions`.
- Pruebas: `tests/frontend/reports_model.test.mjs` (5) y `tests/frontend/reports_ui_e2e.cjs` (19, solo lectura; las cifras esperadas se calculan desde la API).

## Usuarios y roles (rediseño 11 nov 2026)

Diseño de `clase_usuarios_y_roles` (5 tarjetas) en **modo consulta**; pestaña inicial **Matriz de usuarios**:
- **Usuarios (ficha)**: selector de usuario; nombre, correo, puesto, teléfono, rol, estatus, "Permitir acceso" (`access_enabled`), credencial (activada / pendiente; la contraseña nunca se consulta), último acceso en hora local. Fotografía y empresa/contratista: la base no los guarda (se indica). **Funciones operativas observadas** en documentos (comprador de OC/revisiones/contacto de RFQ, preparó y autorizó OC) con número de documentos; no son una configuración. **Permisos por documento**: casillas ligadas a códigos de permiso (`customer_quote.*`, `purchase_order.*`) que hoy no existen en MariaDB; se muestran los permisos efectivos registrados (rol ∪ permitir − negar).
- **Matriz**: todos los usuarios (páginas de 50), búsqueda por nombre, correo, puesto, rol, estatus y función; Ficha habilitada; Bloquear/Eliminar bloqueados.
- **Roles y permisos**: catálogo real (descripción, sistema, usuarios, permisos registrados). Las "secciones permitidas" muestran el **acceso efectivo que aplica el servidor hoy**: los 7 módulos conectados exigen `master_admin`; las demás pantallas aún no consultan MariaDB ("sin BD"). `role_permissions`/`user_permissions` se muestran, pero el servidor todavía no los evalúa.
- **Resumen de acceso**: personas, con acceso, compradores/preparó/autorizadores observados, inactivos o sin acceso; recomendaciones calculadas (Master Admin activos, credenciales pendientes). El texto de Google Sheets del diseño se reemplazó por MariaDB.
- **Bitácora**: `audit_events` paginada en el servidor (25), filtros de fecha (hora local → UTC), usuario, rol, módulo, acción y búsqueda; KPIs total, últimas 24 h, usuarios con actividad y acciones críticas. Los valores de campos sensibles se devuelven como `[protegido]`.
- **Backend (solo lectura, sin cambios de permisos SQL)**: `/users` y `/roles` agregan campos (cuenta `auth`, que ya tenía SELECT sobre esas tablas); rutas nuevas `GET /users/functions` y `GET /audit-events` con la misma guarda Master Admin y la cuenta API de solo SELECT.
- Pruebas: `tests/frontend/users_roles_model.test.mjs` (5), `tests/frontend/users_roles_ui_e2e.cjs` (28) y `tests/users_audit_http_check.py` (24, solo GET; apto para la base real; 403 opcional con `SF_NONADMIN_USER`).

## Suministros de proveedores (conexión 11 nov 2026)

Diseño de `SupplierSupply.jsx` (3 tarjetas) en modo consulta; pestaña inicial **Matriz**. Catálogo **sin precios** (como el original: el precio solo existe en la cotización formal).
- **Matriz**: tarjetas por proveedor (registros, activos, otros; "Vista general") que filtran en el servidor, búsqueda, estatus con conteos, 25 por página; Ver abre la ficha. "Nuevo suministro" bloqueado.
- **Registro (ficha)**: proveedor → suministro; tipo, categoría, marca, modelo, entrega, crédito, moneda, pedido mínimo, vigencia, cobertura, estatus, descripción y observaciones. Guardar bloqueado.
- **Resumen comercial**: suministros registrados/activos, categorías, entrega promedio (solo tiempos en días; se informa cuántos), días de crédito y calificación del proveedor, condiciones habituales y registradas.
- Códigos guardados se muestran tal cual; solo se traducen los conocidos (tipo y estatus).
- Pruebas: `tests/frontend/supplies_model.test.mjs` (4), `tests/frontend/supplies_ui_e2e.cjs` (20) y `tests/supply_offerings_http_check.py` (15, solo GET).

Análisis completo del frontend sin BD y plan por fases: `docs/frontend/ANALISIS_BRECHAS_ZIP_FRONTEND.md`.
- **Registro de suministro** (12 nov 2026): **alta y edición reales sin precios, con guardado automático** (`POST/PUT /catalogs/supplier-offerings`, detalle `GET /catalogs/supplier-offerings/{id}`), matriz y resumen sincronizados y tres botones. Detalle: `docs/suministros/ALTA_EDICION_SUMINISTROS.md`. Pruebas de escritura: `tests/offerings_write_http_check.py` (30) y `tests/frontend/supplies_write_ui_e2e.cjs` (34), solo base sintética.

## Órdenes de Compra (conexión 11 nov 2026)

Diseño de `PurchaseOrders.jsx` (6 tarjetas) en modo consulta; pestaña inicial **Matriz**:
- **Emisión**: requisiciones con adjudicación vigente agrupadas por proveedor ganador; métricas (partidas adjudicadas, proveedores ganadores, OC por generar, cotizaciones perdedoras) y OC ya generadas. "Crear OC" bloqueado.
- **Matriz**: versión vigente de cada OC (Rev. N), tarjetas por comprador (OC, pendientes, recibidas; "sin comprador"), búsqueda (OC, requisición, referencia, proveedor, responsables), estatus, orden; avance de recepción y facturas **de toda la serie**; montos por moneda sin canceladas/sustituidas. Ver PDF abre el formato; solicitar modificación y eliminar bloqueados.
- **Control de autorización**: cotizaciones preseleccionadas/adjudicadas, adjudicaciones sin OC, OC automáticas, vencidas sin recepción, sin comprador, conciliación pendiente y cambios pendientes.
- **Enmiendas**: familias por serie con historial de versiones. **Revisión y autorización**: OC donde el usuario es responsable y solicitudes de modificación asignadas (aprobar/rechazar bloqueados).
- **Formato**: vista formal (proveedor, referencias, partidas, totales, condiciones, firmas registradas) en iframe aislado e impresión/PDF del navegador.
- Pruebas: `tests/frontend/purchase_orders_model.test.mjs` (4), `tests/frontend/purchase_orders_ui_e2e.cjs` (27) y `tests/purchase_orders_http_check.py` (20, solo GET + comprobación de que no hay rutas de escritura).

## Cotizaciones y Comparativo (conexión 11 nov 2026)

Diseño de `Quotes.jsx` (11 tarjetas) en modo consulta; pestaña inicial **Matriz de RFQ**. El prototipo `src/views/Quotes.jsx` queda en el repositorio pero ya no se monta.
- **1 Revisiones/modificaciones** (rediseño 12 nov 2026, ver `docs/cotizaciones/REVISIONES_MODIFICACIONES.md`): KPI (familias, con Rev. N, aprobadas vigentes/históricas, ligadas a Change Request), búsqueda y filtro de estatus en el servidor, una tarjeta por familia (Rev. vigente + estatus, revisiones, total Rev. 0 y vigente) con **VER PDF** (vista de la revisión vigente, impresión), **ABRIR REV. VIGENTE** (tarjeta 6) y **SOLICITAR MODIFICACIÓN** (solicitud R3A real, pendiente de revisión independiente; bloqueada con motivo en expedientes importados, ajenos o con solicitud pendiente).
- **2 Solicitud a proveedores (RFQ)** (rediseño 13 nov 2026, ver `docs/cotizaciones/SOLICITUD_RFQ.md`): formulario del diseño alimentado por MariaDB (comprador de la validación del contratista → ventana con sus requisiciones validadas, proveedor con su moneda habitual, contacto de compras, folio previsto), **Generar Solicitud y Partidas** → partidas a incluir (con a qué proveedores ya se envió cada una) y vista previa imprimible del formato **sin precios**. "Guardar y siguiente RFQ" bloqueado (escritura comercial). Las RFQ registradas se consultan con **Ver** en la tarjeta 3.
- **3 Matriz de RFQ** (rediseño 13 nov 2026, ver `docs/cotizaciones/MATRIZ_RFQ.md`): tarjetas por **contacto de compras** (y "Todas las RFQ") con RFQ, respondidas, vencidas, proveedores, requisiciones y % de respuesta, búsqueda de contactos; al abrir una tarjeta, matriz paginada filtrada en el servidor (folio, requisición, referencia, comprador, proveedor, emisión, límite, moneda, estatus/respuesta, acciones) con búsqueda; **Ver** abre el formato registrado en el **idioma de RFQ** elegido (Español/English, también rige la vista previa de la tarjeta 2); **Nueva RFQ** lleva a la tarjeta 2.
- **4 Cotizaciones recibidas**: tarjetas por proveedor (total, adjudicadas, activas) que filtran en el servidor; total, vigencia, entrega, pago, evaluación técnica.
- **5 Comparativo**: por requisición, ofertas por partida; resalta el menor precio unitario ofertado en la moneda predominante (nunca compara monedas distintas) y muestra la adjudicación registrada. "Guardar selección" bloqueado.
- **6 Cotización al cliente / 7 Formato**: precio de venta y condiciones **sin costos internos** (la API del cliente no devuelve campos de costo); formato en iframe aislado e impresión/PDF.
- **8 Matriz de cotizaciones al cliente**: versión vigente por serie (vN / total), filtro por decisión, montos por moneda, vigencia vencida en rojo.
- **9 Decisión del cliente**: tarjetas por cliente (cotizaciones y por decidir) e historial de decisiones (canal, responsable, nota). "Registrar decisión" bloqueado.
- **10 Adjudicación definitiva**: adjudicaciones vigentes por partida y OC generadas ("Pendiente de OC" si no hay). **11 Matriz interna**: cotizaciones de proveedor con partidas y precios del proveedor (uso interno).
- Pruebas: `tests/frontend/quotes_model.test.mjs` (5), `tests/frontend/change_form.test.mjs` (11), `tests/frontend/rfq_model.test.mjs` (9), `tests/frontend/quotes_ui_e2e.cjs` (100), `tests/frontend/quotes_revisions_write_ui_e2e.cjs` (25, escritura R3A sintética con limpieza) y `tests/quotes_http_check.py` (70, solo GET + comprobación de que no hay rutas de escritura).

## Recepción y Entrega (conexión 11 nov 2026)

Diseño de `ReceptionDelivery.jsx` (4 tarjetas) en modo consulta; pestaña inicial **Matriz**. El prototipo queda en el repositorio pero ya no se monta.
- **1 Registro de recepción**: contadores de OC vigentes sin recepción / parciales / completas, selector de OC (versión vigente), ordenado vs recibido por partida de **toda la serie**, recepciones de la OC y su detalle (fecha, tipo, % recibido, calidad, documentación, aceptación, observaciones, motivos pendientes, partidas con rechazos, archivos y firmas). "Guardar recepción" bloqueado.
- **2 Entrega al cliente**: por recepción registrada, sus entregas (fecha, aceptación, lugar, entregó/recibió, evidencia, partidas con saldo, origen OC/recepción, fotos y firmas con hash). Si solo hay aceptación histórica en la recepción, se indica. "Guardar entrega" bloqueado.
- **3 Matriz**: tarjetas por cliente (registros, recepciones, entregas) que abren la matriz; filas RECEPCIÓN/ENTREGA con las columnas del diseño; "Ver formato" abre el acuse en iframe aislado con impresión/PDF; "Recepción" lleva al registro de la OC vigente.
- **4 Semáforo de cierre**: OC sin recepción, recepciones con pendientes, entregas no registradas, aceptaciones pendientes y listos para facturar, con su lista.
- Reglas: avance = % histórico registrado o recibido/ordenado en recepciones por partida (serie: el mayor); aceptación = la entrega vinculada más reciente o, sin entrega, la aceptación histórica del Apps Script (`clientAccept`); "No aceptado" **no** cuenta como aceptado. Pendientes de recepción: parcial, rechazos, calidad distinta de Conforme o documentación distinta de Completa. **Listos para facturar** replica la etapa 6 de la matriz original: todas las OC vigentes de la requisición al 100 % y aceptadas, sin factura activa.
- Evidencia: solo metadatos (rol, nombre, tipo, tamaño, análisis); nunca la ruta de almacenamiento ni descarga.
- Pruebas: `tests/frontend/reception_model.test.mjs` (4), `tests/frontend/reception_ui_e2e.cjs` (40) y `tests/reception_http_check.py` (29, solo GET + comprobación de que no hay rutas de escritura).

## Factura (conexión 11 nov 2026)

Diseño de `Invoice.jsx` (3 tarjetas) en modo consulta; pestaña inicial **Matriz**. El prototipo queda en el repositorio pero ya no se monta.
- **1 Registro de factura**: selector de requisiciones con OC vigentes (lista para facturar / facturada / pendiente), contexto (recepción al 100 %, aceptación, entregas) y los datos fiscales de la factura elegida (número, UUID, estatus, fechas, moneda, emisor, receptor, subtotal, impuestos, total, condiciones, observaciones, archivo y revisión). Si hay varias facturas se elige con chips. "Guardar factura" y "Calcular total" bloqueados.
- **2 Matriz**: columnas del diseño (Factura, UUID, Requisición, OC, Cliente/Proyecto, Emisor, Receptor, Emisión, Vencimiento, Total, Estatus, Archivo), búsqueda y filtro por estado en el servidor, facturado vigente por moneda, detalle "Ver" con OC y acuses del cliente. Ver archivo, editar y eliminar bloqueados.
- **3 Control**: Listos para facturar, Facturas vigentes, Pendientes de pago, Vencidas, Pagadas y Total facturado por moneda; listas de listos para facturar y vencidas; saldo por cobrar y vencido por moneda.
- Reglas: estado = Cancelada / Pagada según el estatus original o el código; Vencida = vigente, no pagada y vencimiento anterior a hoy; si no, Pendiente de pago. Se muestra el estatus original del Apps Script cuando existe. **Listos para facturar** usa exactamente la misma regla que el Semáforo de Recepción (etapa 6). Montos nunca mezclan monedas y excluyen canceladas.
- Archivos: solo tipo, tamaño y análisis; sin ruta de almacenamiento ni descarga (documentos privados).
- Pruebas: `tests/frontend/invoices_model.test.mjs` (3), `tests/frontend/invoices_ui_e2e.cjs` (32) y `tests/invoices_http_check.py` (26, solo GET + comprobación de que no hay rutas de escritura).

## Red de seguridad

`tests/frontend/modules_smoke_e2e.cjs` (Playwright, **solo lectura**: aborta cualquier petición que no sea GET salvo login/logout). Para cada módulo verifica: endpoints con 200, ningún `role="alert"`, un dato real de MariaDB visible y, en Clientes/Proveedores/Matriz, que el detalle "Ver" responde 200 (en Matriz General abre antes la tarjeta "Todos los clientes"; en Reportes pulsa "Generar reporte"). Resultado actual sobre base sintética: **39/39 PASS**. Se ejecuta después de cada cambio de frontend.
