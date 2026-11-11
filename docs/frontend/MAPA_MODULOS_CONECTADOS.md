# SupplyFlow · Mapa de los 6 módulos conectados a MariaDB

Fecha: 10 nov 2026 (Proveedores: 11 nov 2026). Derivado del código real y de respuestas HTTP reales (base sintética de 77 tablas).
Objetivo: modificar el **frontend** de estos módulos sin romper su conexión con la base.

## Cadena de cada módulo

| Menú (App.jsx `id`) | Componente React (archivo real) | Cliente HTTP | Endpoints (todos `GET`, solo lectura) | Backend (controlador → repositorio) | Acceso |
|---|---|---|---|---|---|
| Inicio y Dashboard (`dashboard`) | `Dashboard` en `src/views/Dashboard.jsx` (cálculos en `src/views/dashboard/model.mjs`) | `src/analyticsApi.js`, `src/matrixApi.js`, `src/catalogApi.js`, `src/views/recovery/api.js` | `/api/v1/analytics/overview`, `/api/v1/analytics/requisitions?page_size=5`, `/api/v1/matrix/clients`, `/api/v1/recovery/matrix`, `/api/v1/catalogs/{clients,suppliers}?page_size=1`, `/api/v1/recovery/changes`, `/api/v1/recovery/changes/review-queue` | `AnalyticsController`, `MatrixController`, `CatalogDirectoryController`, `RequisitionRecoveryController`, `RequisitionChangeController` | Master Admin |
| Clientes (`clients`) | `ClientsCatalog` en **`src/views/clients/ClientsCatalog.jsx`** (re-exportado por `CatalogReadOnly.jsx`; lógica en `src/views/clients/model.mjs`) | `src/catalogApi.js`, `src/matrixApi.js` | `/api/v1/catalogs/clients`, `/api/v1/catalogs/clients/{id}`, `/api/v1/matrix/clients` | `CatalogDirectoryController` → `CatalogReadRepository`; `MatrixController` | Master Admin |
| Proveedores (`suppliers`) | `SuppliersCatalog` en **`src/views/suppliers/SuppliersCatalog.jsx`** (re-exportado por `CatalogReadOnly.jsx`; lógica en `src/views/suppliers/model.mjs`) | `src/catalogApi.js` (`kind='suppliers'`) | `/api/v1/catalogs/suppliers`, `/api/v1/catalogs/suppliers/{id}` | `CatalogDirectoryController` → `CatalogReadRepository` | Master Admin |
| Matriz General (`general_matrix`) | `GeneralMatrix` en `src/views/GeneralMatrix.jsx` | `src/matrixApi.js` | `/api/v1/matrix/requisitions`, `/api/v1/matrix/requisitions/{id}`, `/api/v1/matrix/clients` | `MatrixController` → `MatrixReadRepository` | Master Admin |
| Reportes (`reports`) | `Reports` en `src/views/Reports.jsx` | `src/analyticsApi.js`, `src/matrixApi.js` | `/api/v1/analytics/requisitions`, `/api/v1/analytics/requisitions.csv`, `/api/v1/matrix/clients` | `AnalyticsController` → `AnalyticsReadRepository` | Master Admin |
| Usuarios y roles (`users_roles`) | `UsersRoles` en `src/views/UsersRoles.jsx` | `fetch` directo en el componente | `/api/v1/users?page=`, `/api/v1/roles` | `UserDirectoryController` → `SupplyAuthRepository` | permiso `users.read` |

**Importante:** `src/views/Clients.jsx` (1,541 líneas) y `src/views/Suppliers.jsx` (1,617 líneas) son los diseños de referencia, ya trasladados a `clients/ClientsCatalog.jsx` y `suppliers/SuppliersCatalog.jsx`; **no están conectados**: `App.jsx` importa `ClientsCatalog`/`SuppliersCatalog` desde `CatalogReadOnly.jsx`. Son prototipos anteriores con datos de demostración; no editarlos pensando que cambian la pantalla real. Si se quieren recuperar partes de su diseño, se trasladan a `CatalogReadOnly.jsx` (o a componentes nuevos) usando los campos reales de abajo.

## Parámetros que acepta el servidor (fuera de estos, responde 422)

| Endpoint | Parámetros | Límites |
|---|---|---|
| `analytics/overview` | `from`, `to` (AAAA-MM-DD), `client` (UUID o `all`) | No admite `has`, `q`, `page`, `page_size` (→ 422) |
| `analytics/requisitions` y `.csv` | `from`, `to`, `client`, `has`, `q`, `page`, `page_size` | `page_size` 1–50; el CSV exporta todo el filtro, no solo la página |
| `catalogs/clients`, `catalogs/suppliers` | `page`, `page_size`, `q`, `status` | `page_size` 1–50 |
| `matrix/requisitions` | `page`, `page_size`, `q`, `client`, `has` | `page_size` 1–50 |
| `users` | `page` | 50 por página fijo |

## Campos reales de cada respuesta

Negrita = disponible pero **no usado** hoy por la vista (se puede mostrar sin tocar el backend).

- **analytics/overview**: `summary.{total, **undated**, with_rfq, with_supplier_quote, with_customer_quote, with_purchase_order, with_receipt, with_delivery, with_invoice}`, `monthly[].{period, requisitions}`, `top_clients[].{id, name, requisitions}`, `financial.{requisition_budgets, purchase_orders, customer_quotes}`, `catalogs.{clients, suppliers}`, `definitions.{**date_basis**, document_grain, **money_basis**, coverage, **trend**}`, `filters`, **`source`**.
- **analytics/requisitions**: `total`, `page`, `page_size`, `summary.{total, with_* …}`, `budgets`, `items[].{id, folio, client_name, project, request_date, need_date, currency_code, budget_amount, description, line_count, rfq_count, **supplier_quote_count**, customer_quote_count, purchase_order_count, receipt_count, delivery_count, **invoice_count**}`, **`notes`**.
- **matrix/clients**: `items[].{id, **code**, name, requisitions}`.
- **catalogs/clients**: `items[].{id, code, name, brand_name, tax_id, project, contract_reference, status, **legacy_status**, data_incomplete, portal_enabled, requisition_count, primary_contact, primary_email}`, `total`, `page`, `summary.{total, statuses[].{code,count}, incomplete}`. Detalle `item`: + `address, terms, notes, **portal_locked**, contacts[], channels[]`.
- **catalogs/suppliers**: `items[].{id, code, supplier_key, name, tax_id, status, **legacy_status**, data_incomplete, category, currency, credit_type, credit_days, lead_time_value, lead_time_unit, rating, offerings_count, primary_contact, primary_email}`, `summary`. Detalle `item`: + `notes, **document_notes**, **rating_scale**, contacts[].{id,name,position,**is_primary**}, channels[].{type,value,**source_field**,**is_primary**}`.
- **matrix/requisitions**: `items[].{id, folio, client_name, **client_code**, **client_id**, client_reference, **internal_reference**, request_date, need_date, priority_code, **route_code**, project, contract_reference, requester_name, currency_code, budget_amount, description, delivery_place, **current_revision_number**, notes, source_type, **created_at**, **updated_at**, line_count, review_count, rfq_count, supplier_quote_count, customer_quote_count, purchase_order_count, receipt_count, delivery_count, invoice_count}`, `summary`, **`milestone_note`**. Detalle: `item` (mismos campos), `lines[].{id, line_number, description, quantity, unit_label, **category_label_snapshot**, line_status, **legacy_id**, **history_based**}`, `documents.{reviews, rfqs, supplier_quotes, customer_quotes, purchase_orders, receipts, deliveries, invoices}`.
- **users**: `items[].{id, name, email, position, phone, status, **access_enabled**, credential_state, roles[], **last_login_at**}`, `total`, `page`.
- **roles**: `items[].{code, name, users}`.

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
- **Registro y actualización**: ficha en modo consulta; los selectores por número y razón social cargan `/catalogs/clients/{id}`. Guardar bloqueado (no hay endpoint de escritura). La clave del portal nunca se consulta ni se muestra. El diseño original llamaba `onNavigate('ClientPortal')`, que deja la vista en blanco para administradores.
- **Indicadores**: activos, total, incompletos, portal habilitado (exacto solo si total ≤ 50), mayor actividad por requisiciones (`/matrix/clients`), distribución por estatus y reglas verificadas en código (activo requerido en servidor; código único por organización y **sensible a mayúsculas** en MariaDB).
- **Importar Excel**: vista previa **local** (el archivo no se envía): columnas del diseño y equivalentes en español, valores múltiples, defaults de proyecto/contrato, existentes (comparación sin mayúsculas), repetidos en archivo, incompletos; plantilla descargable. "Guardar en MariaDB" bloqueado. `xlsx` se carga bajo demanda (dependencia existente 0.18.5; tiene avisos de seguridad conocidos para archivos manipulados, por eso solo procesa archivos del propio usuario en su navegador).
- Pruebas: `tests/frontend/clients_model.test.mjs` (5) y `tests/frontend/clients_ui_e2e.cjs` (23, solo lectura).

## Proveedores (rediseño 11 nov 2026)

Diseño de 4 tarjetas de `Suppliers.jsx` (clase_proveedores) con datos reales; pestaña inicial **Matriz**:
- **Matriz**: lista paginada en servidor (búsqueda, estatus con conteos, 25 por página) con las columnas del diseño: Logo (iniciales), No./Clave (`code`/`supplier_key`), Proveedor (+contacto y correo principal), RFC, Categoría, Estatus, Suministros (`offerings_count`), Entrega habitual (`lead_time_value` + unidad), Crédito habitual (tipo + días), Calificación, OC y Acciones (Ver, Ficha, Eliminar bloqueado). Acciones fija a la derecha; con el menú lateral colapsado caben las 12 columnas a 1440 px.
- **OC**: el endpoint no entrega un conteo de órdenes por proveedor; la columna muestra "—" (pendiente de integración), no un número inventado.
- **Registro y actualización**: ficha en modo consulta; selectores por número y razón social con el catálogo **completo** (se lee en páginas de 50, el máximo del servidor) y detalle `/catalogs/suppliers/{id}`: clave, RFC, contactos con puesto, correos y teléfonos (`channels`), categoría, estatus (+ estatus original importado si difiere), moneda, crédito, entrega, calificación con escala (`rating_scale`), documentos (`document_notes`) y observaciones. Guardar bloqueado. La base no tiene logotipos: se muestran iniciales.
- **Evaluación e indicadores**: autorizados / en evaluación / suspendidos desde `summary.statuses`; calificación promedio, productos y servicios registrados y distribución por categoría sobre el catálogo completo; pendientes de actualización (`summary.incomplete`); distribución por estatus con todos los códigos reales (p. ej. `active`, `inactive`); tarjetas de reglas del proceso original (su validación automática depende de Cotizaciones/OC).
- **Importar Excel**: vista previa **local**. Coincidencia por No. de proveedor, Clave, RFC y razón social (sin mayúsculas, acentos ni puntuación), repetidos en archivo, incompletos (sin número, razón social o categoría, moneda no reconocida, correo inválido; quedarían "En evaluación"), categoría y moneda predeterminadas, estatus para nuevos, omitir/actualizar existentes; plantilla descargable. "Guardar en MariaDB" bloqueado.
- La búsqueda reinicia la página solo si el texto cambió (antes, el primer disparo del *debounce* tras montar regresaba a la página 1; mismo ajuste en Clientes).
- Pruebas: `tests/frontend/suppliers_model.test.mjs` (5) y `tests/frontend/suppliers_ui_e2e.cjs` (38, solo lectura; requiere más de 50 proveedores sintéticos para probar la carga por páginas).

## Red de seguridad

`tests/frontend/modules_smoke_e2e.cjs` (Playwright, **solo lectura**: aborta cualquier petición que no sea GET salvo login/logout). Para cada módulo verifica: endpoints con 200, ningún `role="alert"`, un dato real de MariaDB visible y, en Clientes/Proveedores/Matriz, que el detalle "Ver" responde 200. Resultado actual sobre base sintética: **24/24 PASS**. Se ejecuta después de cada cambio de frontend.
