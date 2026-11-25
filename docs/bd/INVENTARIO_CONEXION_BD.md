# SupplyFlow — Inventario de conexión a MariaDB por módulo

**Fecha:** 23 nov. 2026 (actualizado el 24 nov. con Categorías) · **Base del análisis:** commit `c280023` (código, DDL versionado de 77 tablas y contratos de cuentas SQL) y el respaldo `supplyflow_dev.sql` del 9 nov. 2026 (77 tablas; el archivo compartido el 23 nov. es idéntico byte a byte al del 20 nov.).
**Alcance:** análisis de código y del respaldo. No se ejecutaron migraciones, grants ni escrituras. Los recuentos de datos del respaldo se guardan fuera del repositorio.

## 1. Resumen

| Estado | Módulos |
|---|---|
| **Conectados (lectura con datos reales)** | Inicio y Dashboard, Clientes, Proveedores, Suministros, Contratista, Solicitud / Requisición (6 tarjetas), Gestión del Contratista (4), Cotizaciones y Comparativo (10), Órdenes de Compra (6), Recepción y Entrega (3), Factura (3), Servicios Operativos (Dashboard, Nueva solicitud y Nuevo servicio, Matriz, Reportes), Matriz General, Reportes, Usuarios y roles, Configuración (pestañas 1 a 5, 23 nov 2026), Flujo del Proceso (7 pestañas, 23 nov 2026), campana de Notificaciones (lectura, 23 nov 2026), Portal del Cliente (vista previa interna, 23 nov 2026) |
| **Inicio y Dashboard** | Conectado (23 nov 2026) salvo 3 cifras sin fuente o regla: estatus de pago / «Pagadas» (no hay registro de pagos), ahorro potencial y costo promedio (falta la regla del original) |
| **Pendientes de autorización** | Acceso externo de clientes al portal (tokens y sesiones propias, §4.E). Campana: marcar como leída en MariaDB (permiso de escritura) |
| **Guardan en MariaDB** | Clientes, Proveedores y Suministros (alta y edición); Contratista (datos de la empresa, 24 nov 2026); Gestión del Contratista (validación interna y estrategia, 25 nov 2026); Catálogo de categorías (alta, edición, estatus y eliminación de las nunca usadas, 24 nov 2026); Requisición RF1 (alta y edición), Crear desde historial (25 nov 2026), R2 (regularización), R3A (solicitud de modificación) y R3B (revisión independiente y retiro) |
| **Validan pero no guardan** | Todo lo demás: termina con «Datos validados, pero no se guardó…» |

`App.jsx` ya no muestra el aviso genérico «Módulo pendiente de integración» en ningún módulo del menú: Configuración, Flujo del Proceso y la vista previa del Portal del Cliente tienen su propio aviso «solo lectura».

## 1.1 Auditoría del 23 nov 2026 (código + recorrido en vivo)

- **Recorrido** (`tests/frontend/system_audit_e2e.cjs`, solo lectura):
  - 18 módulos del menú y 87 pantallas (cada tarjeta o pestaña superior).
  - 97 respuestas de la API, todas 200.
  - Sin errores de JavaScript, sin pantallas detenidas en «Cargando» y sin avisos de «pendiente de integración» ni datos de demostración.
  - Las pestañas sin consultas propias reutilizan lo cargado al entrar al módulo.
- **Código activo**:
  - 134 archivos alcanzables desde `main.jsx`.
  - Sin `mock`/`demo`, sin `console.log` y sin guardados simulados.
  - Las listas fijas son opciones de catálogo (estatus, tipos, monedas).
- **Regresión completa**: 24 suites de interfaz, 17 HTTP, 385 pruebas unitarias e INT03-D1, todas en verde.
- **Hallazgos**:
  1. **Guardado de catálogos en la PC del usuario** (atendido el 24 nov; ver `docs/clientes/ALTA_EDICION_CLIENTES.md` § Diagnóstico):
     - El arranque de `CLAUDE.md` y `SupplyFlow-Restore-INT03.ps1` incluye `compose.supply-catalogwrite.yml` cuando existe su secreto.
     - `GET /api/v1/catalogs/write-status` diagnostica la causa.
     - Las cuatro pantallas de catálogo la avisan al abrir la ficha.
     - Antecedente: el arranque documentado en `CLAUDE.md` no incluía `compose.supply-catalogwrite.yml`, y la cuenta `supplyflow_catalogwrite_local` no está en el contrato 77/52. Sin aprovisionarla (requiere autorización), el alta y edición de Clientes, Proveedores, Suministros y (desde el 24 nov) Categorías avisa que no está habilitada y no guarda. Si ya estaba aprovisionada con 29 permisos, basta volver a ejecutar `provision` para agregar los 4 de Categorías (`docs/categorias/ALTA_EDICION_CATEGORIAS.md`).
  2. **Código sin uso, sin efecto en la operación (eliminado el 23 nov, a petición del usuario):**
     - 8 vistas antiguas con datos de demostración (unas 15,800 líneas) y `src/views/clients/clientWriteApi.js`.
     - El estado `quotes` que `App.jsx` guarda en `localStorage` y que ningún módulo usa.
     - El estado de ejemplo que `ContractorManagement.jsx` conserva sin mostrarlo (partidas y 2 validaciones ficticias).
     - Los textos `saveAlert` de Configuración.
  3. **Botón «PORTAL» de la Matriz de clientes.** Abre el Portal del Cliente sin preseleccionar a ese cliente en la vista previa.
  4. **Endpoints de detalle no usados por ninguna pantalla** (lecturas adicionales, sin riesgo): `reception/receipts/{id}`, `quotes/supplier-quotes/{id}`, `quotes/rfq-requisitions/{id}` y `requisition-changes/candidates`.
  5. **Permisos.** El servidor solo distingue `master_admin`; los permisos por sección (`role_permissions`, `user_permissions`) se leen pero no se aplican.
  6. **Historial de Git.** Conserva los datos reales que traía `ClientPortal.jsx` (retirados del código el 23 nov).

## 1.2 Mapa de clases conectadas al Backend (24 nov 2026)

Detalle en `docs/bd/MAPA_CLASES_BACKEND.md`, generado con `tests/class_connection_audit.py`.

- **Rutas:** 117/117 con controlador y método existentes.
- **Clases PHP:** 81, ninguna huérfana.
- **Frontend:** 134 archivos JS/JSX alcanzables desde `src/main.jsx`.
- **Permisos SQL:** las tablas que lee y escribe cada clase están concedidas a su cuenta.
- **Verificación en vivo** (sandbox sintético): 113/117 rutas recibieron peticiones reales y 106 las originó la interfaz, sin respuestas 5xx.
- **Sin pantalla:**
  - Las 3 escrituras R3C2/R3C3, bloqueadas por política.
  - 4 consultas que responden 200 (`health`, `candidates`, el CSV de analítica y la lista de borradores v0.7).
- **Retirado:** la vista genérica `CatalogReadOnly`, que ninguna pantalla mostraba.

## 2. Cuentas SQL

| Cuenta SQL (overlay) | Qué puede escribir | La usan |
|---|---|---|
| `supplyflow_api_local` (base) | Nada: `SELECT` sobre el esquema | Todas las consultas de lectura |
| `supplyflow_auth_local` (`compose.supply-auth.yml`) | `auth_sessions`, `audit_events` (+2 columnas de revocación) | Inicio y cierre de sesión |
| `supplyflow_catalogwrite_local` (`compose.supply-catalogwrite.yml`, 35 permisos) | `clients`, `suppliers`, `supplier_offerings`, `categories` (alta, edición y eliminación de las nunca usadas; lee `requisition_items` para verificar el uso), `organizations` (solo los datos de la empresa de la sesión, 24 nov), `business_entities`, `party_contacts`, `party_contact_channels`, `files`, `entity_files`, `audit_events`, `idempotency_keys` | Categorías, Clientes, Proveedores, Suministros, Contratista (datos de la empresa) |
| `supplyflow_mgmtwrite_local` (`compose.supply-mgmtwrite.yml`, 20 permisos de tabla + 13 de columna) | `requisition_reviews` (alta y columnas editables), `sourcing_plans`, `sourcing_lots`, `sourcing_lot_items`, `sourcing_lot_suppliers` (solo alta), `business_entities`, `workflow_events`, `audit_events`, `idempotency_keys`; sin DELETE | Gestión del Contratista (validación y estrategia) |
| `supplyflow_useradmin_local` (`compose.supply-useradmin.yml`, 18 permisos: 11 de tabla y 7 de columna) | `users` solo por columna (`password_hash`, `credential_state`, `access_enabled`, `updated_at`, `row_version`), `user_roles` (asignar/retirar Master Admin), `auth_sessions` (revocar), `audit_events`, `idempotency_keys` | Usuarios y roles: segundo Master Admin; cambio de contraseña (25 nov 2026) |
| `supplyflow_reqwrite_local` (`compose.supply-reqwrite.yml`) | Borradores v0.7: `requisitions`, `requisition_items`, snapshots, `workflow_events`, `document_sequences` | `requisitions/drafts` |
| `supplyflow_recovery_local` (`compose.supply-recovery.yml`, contrato 52) | Requisiciones RF1, R2, R3A/R3B/R3C1 y bitácoras R3C2/R3C3 | Requisición y Control de cambios |

Rutas de escritura en `backend/app/Config/Routes.php` (26): login/logout; `auth/password/change`; `users/{id}/access`; `catalogs/clients`, `catalogs/suppliers` y `catalogs/supplier-offerings` (POST/PUT); `catalogs/categories` (POST/PUT/DELETE); `contractors/{id}` (PUT, datos de la empresa); `requisitions/drafts` (POST/PUT); `recovery/requisitions` (POST/PUT), `recovery/requisitions/from-history` (POST) y `regularization` (POST); `recovery/.../changes` (crear, `decision`, `withdraw`, `commercial-reconciliation`, `commercial-executions` y su `review`).

El servidor solo distingue el rol `master_admin`; **no evalúa permisos por sección** (`role_permissions`, `user_permissions` se leen pero no se aplican).

Tablas del DDL que ninguna pantalla consulta todavía: `units`, `contracts`, `projects`, `customer_quote_adjustments`, `delivery_item_allocations`, `outbox_messages`, `email_delivery_logs`, `ai_runs`, `portal_access_tokens`, `import_batches`, `import_records`, `import_issues`, `legacy_id_map`. `notifications` la leen la campana (23 nov) y Órdenes de Compra (no leídas de OC).

## 3. Inventario módulo por módulo

Leyenda: **Real** guarda en MariaDB · **Bloqueada** valida y no guarda · **Demo** datos fijos en el código · **N/A** no requiere guardar.

| Módulo | Sección o tarjeta | Lectura de BD | Escritura | Tablas | Qué falta |
|---|---|---|---|---|---|
| Inicio y Dashboard | KPIs de requisiciones, estatus, alertas, importes, clientes, provisionales, Change Requests, segregación de funciones | Sí (`analytics/overview`, `recovery`) | N/A | `requisitions` y documentos del proceso | — |
| Inicio y Dashboard | Servicios, Service-to-Cash (8 etapas), Service Fee, abastecimiento por lotes, proveedores con mayor actividad y evaluados, recompra (rutas y políticas), enmiendas de OC, compradores, segregación de funciones de OC, facturación por moneda | Sí (23 nov 2026): bloques ampliados de `analytics/overview` | N/A | `service_orders`, `customer_quote_versions.service_fee_*`, `sourcing_*`, `rfqs`, `supplier_quotes`, `awards`, `requisition_items.repeat_*`, `clients.repeat_*_policy`, `purchase_orders`, `purchase_order_modification_requests`, `requisition_reviews`, `invoices` | — |
| Inicio y Dashboard | Estatus de pago / «Pagadas»; ahorro potencial y costo promedio | **No** | N/A | — | Pagos: definir su registro (DDL nuevo, requiere autorización). Ahorro y costo promedio: compartir la regla de comparación del sistema original |
| Flujo del Proceso | Mapa, flujo de servicios, detalle por etapa, comercial, rutas especiales, matriz, indicadores | **Sí** (23 nov): procesos por etapa, KPI y cuellos de botella reales | N/A (solo consulta) | Documentos de cada etapa | Ver §4.B; tiempo en etapa pendiente |
| Portal del Cliente | Acceso y seguimiento | **Vista previa interna** (23 nov): lo que vería cada cliente, para Master Admin | Acceso externo **no habilitado** (pendiente de autorización) | `clients`, requisiciones y documentos filtrados por cliente; `portal_access_tokens` sin usar | Ver §4.E |
| Campana (encabezado) | Notificaciones | **Sí** (23 nov): las del usuario en sesión + avisos de la sesión aparte | Bloqueada: marcar como leída requiere `UPDATE` | `notifications` | Ver §4.D |
| Clientes | Alta y edición | Sí | **Real** | `clients` y contactos | Eliminar e importar siguen bloqueados |
| Proveedores | Alta y edición | Sí | **Real** | `suppliers` y contactos | Eliminar e importar siguen bloqueados |
| Suministros | Alta y edición | Sí | **Real** | `supplier_offerings` | Eliminar sigue bloqueado |
| Contratista | Datos de la empresa (EDITAR) | Sí (`contractors/{id}`) | **Habilitada (24 nov 2026)** | `organizations`, `files` | Hecho: `PUT` con la cuenta `catalogwrite` (35 permisos). En la PC: aprovisionada con 35 el 25 nov (PASS) y guardado comprobado. Registrar otras empresas, estatus y baja siguen bloqueados; los formatos impresos usan la identidad fija |
| Contratista | Personal | Sí | Bloqueada | `people`, `users`, `user_roles` | Depende de la escritura de Usuarios y roles |
| Requisición | Registro | Sí | **Real** (RF1) | `requisitions`, `requisition_items` | — |
| Requisición | Sin requisición / Regularización | Sí | **Real** (R2) | `requisitions` y evidencias | — |
| Requisición | Matriz | Sí | N/A (SOLICITAR MODIFICACIÓN es R3A real) | — | — |
| Requisición | Catálogo de categorías | Sí (`catalogs/categories`) | **Habilitada (24 nov 2026)** | `categories` | Hecho: `POST`/`PUT`/`DELETE` con la cuenta `catalogwrite` (hoy 35 permisos). En la PC: 35 permisos desde el 25 nov (PASS) |
| Requisición | Crear desde historial | Sí (`requisition-history/catalog`, `recovery/requisitions/from-history`) | **Real (25 nov 2026)** | `requisitions` (`history_based`, `repeat_policy_snapshot`), `requisition_items` (`history_*`, `repeat_*`, `fixed_client_*`) | Hecho con la cuenta `recovery` (sin permisos nuevos). Reglas de ruta por interpretación documentada (sin fuente del Apps Script): `docs/requisicion/CREAR_DESDE_HISTORIAL.md` |
| Requisición | Control de cambios | Sí (`requisition-changes`) | **Real**: R3A, R3B y retiro; R3C2/R3C3 solo consulta | `requisition_change_*` | Escrituras R3C2/R3C3 bloqueadas; la revisión independiente requiere un segundo Master Admin activo (en la PC solo hay 1 con credencial). R3B no aplica cambios a requisiciones editadas en Registro o regularizadas (`SNAPSHOT_NUMBER_OCCUPIED`, conciliación R2/R3 pendiente) |
| Gestión del Contratista | Registro de validación | Sí (`contractor-management/validations`) | **Real (25 nov 2026)** | `requisition_reviews`, `workflow_events` | Hecho con la cuenta `mgmtwrite` (alta con folio SCI y edición de las registradas en SupplyFlow; cualquier Master Admin valida). En la PC falta aprovisionar la cuenta (requiere autorización): `docs/gestion-contratista/GUARDADO_VALIDACION_ESTRATEGIA.md` |
| Gestión del Contratista | Estrategia y lotificación | Sí (`contractor-management/strategy/{id}`) | **Real (25 nov 2026)** | `sourcing_plans`, `sourcing_lots`, `sourcing_lot_items`, `sourcing_lot_suppliers` | Hecho: plan versionado con la cuenta `mgmtwrite`. «Abrir siguiente RFQ» sigue bloqueado (emisión de RFQ) |
| Gestión del Contratista | Matriz y Reglas | Sí | EDITAR real (tarjeta 1); eliminar y fuente de costo bloqueados | `requisition_reviews`, `organization_settings` | Editar reglas depende de Configuración |
| Cotizaciones | 10 tarjetas (RFQ, cotización de proveedor, comparativo, cotización y decisión del cliente, adjudicación) | Sí | Bloqueada (**comercial**) | `rfqs`, `rfq_items`, `supplier_quotes*`, `customer_quote*`, `awards`, `approval_policy_versions` | Endpoints, aprobaciones por política, folios (`document_sequences`) y pruebas integrales |
| Órdenes de Compra | Emisión, matriz, autorización, enmiendas, revisión, formato | Sí | Bloqueada (**comercial**) | `purchase_orders*`, `purchase_order_modification_requests`, `signature_evidence` | Endpoints, segregación de funciones, firmas y archivos privados |
| Recepción y Entrega | Recepción, entrega, matriz | Sí | Bloqueada (**comercial**) | `goods_receipts*`, `deliveries`, `delivery_*`, `signature_evidence`, `entity_files` | Endpoints, cantidades acumuladas, evidencias privadas |
| Factura | Registro, edición y acuse | Sí | Bloqueada (**comercial**) | `invoices`, `invoice_purchase_orders`, `invoice_acknowledgments` | Endpoints; emisor/razón social y reglas de acumulados |
| Servicios Operativos | Dashboard y encabezado «Servicios configurados» | Sí (`services/matrix`, `services/new-request`) | N/A | `service_orders`, `service_types` | — |
| Servicios Operativos | Nueva solicitud y Nuevo servicio | Sí (`services/new-request*`, `recovery/catalogs`, `recovery/folio`) | Bloqueada | `requisitions` (`route_code 'service'`), `requisition_items`, `service_orders`, `files`, `entity_files` | Endpoint de la requisición maestra (cuenta `recovery` + `SELECT service_types`) y del expediente (`INSERT service_orders`, evidencias privadas); capturas de «Datos específicos» de 5 tipos |
| Servicios Operativos | Matriz y Reportes | Sí | Bloqueada | `service_orders` | Edición y borrado dependen del endpoint anterior |
| Matriz General y Reportes | Consolidado | Sí | N/A | — | — |
| Usuarios y roles | Acceso y rol Master Admin (habilitar, restablecer contraseña temporal, retirar) y cambio de contraseña | Sí (`users/{id}/access`, `auth/password/change`) | **Real (25 nov 2026)** | `users` (columnas de credencial y acceso), `user_roles`, `auth_sessions` | Cuenta `useradmin` dedicada; reautenticación, motivo, nunca la propia cuenta, temporal de 72 h y cambio obligatorio: `docs/usuarios/SEGUNDO_MASTER_ADMIN.md`. En la PC falta aprovisionarla (autorización) |
| Usuarios y roles | Alta/edición de fichas, otros roles, permisos por sección, bloqueo y eliminación | Sí | Bloqueada | `people`, `users`, `user_roles`, `roles`, `role_permissions`, `user_permissions` | Cuenta SQL nueva, hash de contraseñas, protección contra escalamiento y evaluación de permisos por sección en el servidor |
| Configuración | Pestañas 1 a 5 | **Sí** (23 nov) | Valida, no guarda | `organization_settings`, `approval_policy_versions`, `currencies`, `units`, `document_sequences`, `email_delivery_logs`, `files` | Ver §4.C; la escritura requiere autorización |
| Configuración | Pestañas 6 y 7 (Respaldo y Reinicio) | No (por diseño) | **No deben conectarse** | — | 6 exporta en JSON la configuración leída y solo verifica archivos (no restaura); 7 solo limpia el almacenamiento local del navegador. Los respaldos de la base se hacen con las herramientas INT03 fuera de la interfaz |

## 4. Cómo conectar lo pendiente para que muestre datos reales

Todo lo de esta sección es **solo lectura**: se resuelve con endpoints aditivos `GET`, Master Admin, `Cache-Control: no-store`, parámetros en lista blanca (422 si no) y la cuenta `supplyflow_api_local`, que ya tiene `SELECT` sobre el esquema. **No requiere grants, migraciones ni cambios de datos.** Cada uno se entrega con pruebas unitarias, HTTP (401/403/422, sin rutas de escritura, sin ids internos) y E2E de interfaz que calcula las cifras esperadas por separado.

### A. Inicio y Dashboard — conectado el 23 nov 2026 (salvo pagos, ahorro y costo promedio)
Extender `GET /api/v1/analytics/overview` (`AnalyticsReadRepository`) con bloques nuevos que respeten los filtros actuales de periodo y cliente:
- **Servicios / Service-to-Cash y panel «Servicios Operativos»**: totales, abiertos, ejecutados, venta, costo y margen desde `service_orders`, con las mismas reglas que el Dashboard de Servicios (`dashboardModel.mjs`).
- **«Service-to-Cash · 8 etapas»**: etapa por servicio derivada de los criterios del Flujo del Proceso (datos mínimos → autorización confirmada → programado → OC vinculada o «no requiere proveedor» → ejecutado → evidencia → listo para facturar → factura). Las reglas se toman de esos criterios; los casos ambiguos se confirman con el Apps Script.
- **Service Fee**: versiones vigentes de `customer_quote_versions` con `service_fee_enabled`, suma de `service_fee_total_amount` por moneda y cuántas están aprobadas por el cliente (`client_decision_status` / `customer_quote_decisions`). `QuoteReadRepository` ya lee esas columnas.
- **Proveedores con mayor actividad**: por proveedor, RFQs (`rfqs.supplier_id`), ofertas (`supplier_quotes`) y adjudicaciones (`awards`).
- **Recompra**: partidas de requisiciones desde historial por `repeat_client_price_mode` y `repeat_sourcing_mode` (precio respetado, por recotizar, precio comercial pendiente).
- **Enmiendas de OC**: versiones posteriores de `purchase_orders` y `purchase_order_modification_requests` (solo conteo; las escrituras siguen bloqueadas).
- **Estatus de pago**: no tiene fuente. Se queda como pendiente hasta definir cómo registrar pagos (requeriría DDL y autorización).

### B. Flujo del Proceso — conectado en lectura el 23 nov 2026
`GET /api/v1/analytics/process-flow` (Master Admin, sin parámetros, sin caché, sin grants nuevos; `ProcessFlowReadRepository`). Reemplaza los 23 contadores fijos, los KPI fijos de las 7 pestañas y la lista fija de cuellos de botella. Reglas:
- **Compra / renta (15 etapas)**: cada requisición en la etapa más avanzada con evidencia documental (`requisition_reviews`, `sourcing_plans`/`sourcing_lots`, `rfqs`, `supplier_quotes`, `awards`, `customer_quote_versions` y sus decisiones, `purchase_orders`, `goods_receipts`, `deliveries`, `invoices`). Debe ser coherente con la política de 8 etapas que el servidor ya calcula (`RequisitionRecoveryRepository::STAGES`).
- **Servicios (8 etapas)**: misma derivación que §4.A.
- Las pestañas «Matriz del proceso» e «Indicadores y cuellos de botella» toman los mismos conteos (tiempo en etapa con `workflow_events`).
- **Implementado así:** las 15 etapas afinan la política de 8 etapas (`RequisitionRecoveryRepository::stage`, la misma de la Matriz de requisiciones): 1 Solicitud; 2–3 Validación (3 si el último plan tiene lotes); 4–5 Solicitud de cotización (5 con ofertas); 6–11 Comparativo y autorización (6 sin cotización al cliente; 7–11 según el estatus de la cotización vigente, `QuoteReadRepository::STATUS_KEY`); 12 OC; 13 Recepción; 14 Entrega y aceptación; 15 Factura. Así las dos vistas siempre cuadran. Los expedientes desde historial o con control de cambios no tienen etapa inferida y se informan aparte.
- Ruta Compra/renta = requisiciones que no son de la ruta de servicios (`route_code` ≠ `service` y sin `service_orders`). Servicios = `service_orders` con las 8 etapas del Dashboard; las requisiciones de servicio sin expediente se informan aparte.
- KPI y documentos por etapa reutilizan las reglas de Cotizaciones (cotización vigente y grupos de estatus), Recepción y Entrega (OC sin recepción, desviaciones, recepciones sin entrega), Factura (listas sin factura) y el Dashboard (RFQ pendientes, recompra, enmiendas). «Ofertas insuficientes» compara las ofertas registradas con el mínimo del plan de abastecimiento, de la validación o del parámetro general `minQuotes`.
- Cuellos de botella: hasta 12 procesos abiertos por ruta, los más antiguos primero, con el motivo según su etapa.
- **Pendiente:** el tiempo en etapa requiere la regla del original sobre `workflow_events` (no se inventa). Pruebas: `tests/frontend/process_flow_model.test.mjs` (5), `tests/frontend/process_flow_ui_e2e.cjs` (26) y `tests/process_flow_http_check.py` (34; cruza cada cifra con `/recovery/matrix`, `/analytics/overview`, `/quotes/*`, `/purchase-orders`, `/reception/*`, `/invoices/requisitions` y `/requisition-changes`).

### C. Configuración (pestañas 1 a 5) — conectada en lectura el 23 nov 2026
Endpoints de solo lectura (Master Admin, sin caché, 422 ante parámetros desconocidos, sin ids internos; no requieren grants): `GET /api/v1/settings`, `GET /api/v1/settings/email-log` (`q`, `status`, `page`, `page_size` ≤ 50) y `GET /api/v1/settings/logo` (imagen verificada por firma, tamaño y SHA-256; 404 si el archivo no está en el equipo). Lee los grupos de `organization_settings` que ya existen en la base:

| Pestaña | Fuente |
|---|---|
| 1 Identidad y formatos | `legacy_branding` (empresa, nombre y lema), `legacy_localization` (idioma de documentos), `legacy_organization` (contratista activo) y logotipo (`files`) |
| 2 Matriz de parámetros | `legacy_purchasing` (moneda, IVA, prefijos REQ/OC, días de alerta, cotizaciones mínimas), `currencies`, `units`, `legacy_counters`/`document_sequences` |
| 3 Aprobaciones de cotización | `legacy_quote_policy` y `approval_policy_versions` (versión vigente) |
| 4 Condiciones de cotización | `legacy_quote_conditions` (ES/EN) |
| 5 Correos automáticos | `legacy_email` y el historial de envíos `email_delivery_logs` (paginado, sin cuerpos de correo) |

«Guardar» valida y muestra «Datos validados, pero no se guardó…» con los campos cambiados; nada se escribe. Pruebas: `tests/frontend/settings_model.test.mjs`, `tests/frontend/settings_ui_e2e.cjs`, `tests/settings_http_check.py` (con `SF_SQLQ` compara con `organization_settings` y `email_delivery_logs`).

La escritura viene después y requiere autorización: una cuenta `settingswrite` con `UPDATE organization_settings` e `INSERT approval_policy_versions`, versionando la política (cambia aprobaciones y folios) y con auditoría. Pestañas 6 y 7: no se conectan.

### D. Campana de notificaciones — conectada en lectura el 23 nov 2026
`GET /api/v1/notifications` (`status` all/unread, `page`, `page_size` ≤ 50; sin caché; cuenta API con SELECT): solo las notificaciones **del usuario en sesión** (`recipient_user_id`), para cualquier usuario interno activo (no requiere Master Admin, porque cada quien ve solo las suyas). Devuelve remitente, documento ligado (tipo, id público y folio) para abrir su módulo y el resumen total / no leídas. La campana (`src/views/notifications/NotificationBell.jsx`) muestra el contador real (no leídas de MariaDB + avisos de la sesión), filtro «No leídas», «Ver más» y, aparte, los avisos de la sesión del navegador (no se guardan); se actualiza al abrirla y cada minuto.
**Pendiente de autorización:** marcar como leída es una escritura mínima (`UPDATE notifications (is_read, read_at)` del destinatario) que requiere un grant nuevo; hoy «Marcar leídas» solo limpia los avisos de la sesión y el panel lo dice. Pruebas: `tests/frontend/notifications_model.test.mjs` (4), `tests/frontend/notifications_ui_e2e.cjs` (19) y `tests/notifications_http_check.py` (12; aislamiento entre usuarios y, con `SF_SQLQ`, comparación con la tabla).

### E. Portal del Cliente — vista previa interna conectada el 23 nov 2026; acceso externo pendiente de autorización
**Decisiones del 23 nov 2026:** solo vista interna por ahora; en la etapa de OC el cliente ve solo folio, fechas y estatus (sin proveedor ni montos); los datos reales que traía `ClientPortal.jsx` escritos en el código se quitaron (sin reescribir el historial de Git).

**Hecho (solo lectura, sin permisos nuevos):** `GET /api/v1/portal/preview/clients`, `…/clients/{id}`, `…/clients/{id}/requisitions/{id}` y `…/clients/{id}/quotes/{id}` (Master Admin; `ClientPortalReadRepository`, todas las consultas acotadas al cliente). Muestra las requisiciones del cliente con las 8 etapas de la política del servidor (iguales a la Matriz de requisiciones), métricas, la solicitud con sus partidas, las cotizaciones **ya enviadas** al cliente (borradores, revisión interna y autorizadas → 404) con precios de venta y sin costos ni márgenes, OC (folio, fechas, estatus), recepciones, entregas, facturas y número de fotografías. El formulario de acceso ya no imprime la clave en consola y avisa que el acceso no está habilitado. Pruebas: `tests/frontend/portal_model.test.mjs` (4), `tests/frontend/portal_ui_e2e.cjs` (27) y `tests/client_portal_http_check.py` (17; aislamiento entre clientes).

**Pendiente (requiere autorización):** acceso externo, independiente del de usuarios internos. El mismo repositorio sirve: el cliente saldría de la sesión `client_portal` y no de la URL.
- Tokens en `portal_access_tokens` (solo hash, caducidad, revocación) habilitados con `clients.portal_enabled` / `portal_locked`.
- Sesión de cliente separada, límite de intentos y auditoría.
- Todas las consultas filtradas por cliente en el servidor, sin costos internos, márgenes ni datos de otros clientes.

Es nueva superficie expuesta: requiere autorización y revisión de seguridad antes de cualquier código.

## 5. Requisitos de toda escritura nueva

Mismo patrón que R2 y R3:
- Sesión y rol verificados en el servidor.
- Encabezado `X-SF-CSRF`.
- `Idempotency-Key` (tabla `idempotency_keys`).
- Concurrencia optimista con `If-Match` sobre `business_entities.row_version` (o `users.row_version`).
- Motivo obligatorio cuando aplique.
- `audit_events` en la misma transacción.
- Una cuenta SQL con los grants mínimos por módulo, en su propio overlay.
- Pruebas con datos sintéticos en el sandbox: unitarias, HTTP (401, 403, 409, 412, 422, idempotencia) y E2E de interfaz.

**Requieren autorización explícita del usuario antes de ejecutarse:**
- Cualquier `GRANT` nuevo o cuenta SQL.
- Cualquier escritura comercial: Cotizaciones, OC, Recepción, Factura, y escrituras R3C2/R3C3.
- Cualquier migración o DDL (p. ej. registro de pagos).

## 6. Orden recomendado

| Fase | Trabajo | Grants nuevos | Riesgo |
|---|---|---|---|
| **0 · Solo lectura** (sin grants) | 1. ~~Inicio y Dashboard~~ (hecho el 23 nov). 2. ~~Configuración pestañas 1 a 5~~ (hecho el 23 nov, §4.C). 3. ~~Flujo del Proceso~~ (hecho el 23 nov, §4.B). 4. ~~Campana: lectura~~ (hecho el 23 nov, §4.D) | No | Bajo |
| **1 · Operativo, no comercial** | 5. ~~Categorías~~ (hecho el 24 nov). 6. Crear desde historial. 7. Servicios: requisición maestra y expediente. 8. Gestión del Contratista: validación, estrategia y lotes. 9. Configuración: escritura versionada. 10. Usuarios y roles, con permisos por sección en el servidor. 11. Notificaciones: marcar como leídas | Sí, por módulo | Medio; Usuarios es alto |
| **2 · Comercial** (bloqueado hasta autorizar) | 12. Cotizaciones. 13. OC. 14. Recepción y Entrega. 15. Factura (y registro de pagos si se define). 16. Escrituras R3C2/R3C3 | Sí | Alto |
| **3 · Seguridad externa** | 17. Portal del Cliente: acceso externo con tokens propios (la vista previa interna ya está hecha, 23 nov) | Sí | Alto |

Ya completado de la fase 0: Dashboard de Servicios (23 nov.), Control de cambios R3A/R3B (23 nov.), Inicio y Dashboard (23 nov.), Configuración en lectura (23 nov.), Flujo del Proceso (23 nov.) y la campana en lectura (23 nov.). **La fase 0 está completa.**

## 7. Código sin uso

Eliminado el 23 nov 2026:
- Las 8 vistas antiguas con datos de demostración (`Clients.jsx`, `Suppliers.jsx`, `SupplierSupply.jsx`, `Requisition.jsx`, `Quotes.jsx`, `PurchaseOrders.jsx`, `ReceptionDelivery.jsx` e `Invoice.jsx`) y `clients/clientWriteApi.js`.
- El estado `quotes` que `App.jsx` guardaba en `localStorage` (`grupo_gerez_quotes`).
- El estado de ejemplo oculto de `ContractorManagement.jsx`.
- Los textos `saveAlert` de Configuración.

Quedan en el historial de Git.
