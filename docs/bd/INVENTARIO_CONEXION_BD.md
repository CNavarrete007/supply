# SupplyFlow — Inventario de conexión a MariaDB por módulo

**Fecha:** 23 nov. 2026 · **Base del análisis:** commit `c280023` (código, DDL versionado de 77 tablas y contratos de cuentas SQL) y el respaldo `supplyflow_dev.sql` del 9 nov. 2026 (77 tablas; el archivo compartido el 23 nov. es idéntico byte a byte al del 20 nov.).
**Alcance:** análisis de código y del respaldo. No se ejecutaron migraciones, grants ni escrituras. Los recuentos de datos del respaldo se guardan fuera del repositorio.

## 1. Resumen

| Estado | Módulos |
|---|---|
| **Conectados (lectura con datos reales)** | Clientes, Proveedores, Suministros, Contratista, Solicitud / Requisición (6 tarjetas), Gestión del Contratista (4), Cotizaciones y Comparativo (10), Órdenes de Compra (6), Recepción y Entrega (3), Factura (3), Servicios Operativos (Dashboard, Nueva solicitud y Nuevo servicio, Matriz, Reportes), Matriz General, Reportes, Usuarios y roles |
| **Parcialmente conectado** | Inicio y Dashboard: 11 indicadores (tarjetas, paneles o mini-indicadores) muestran «Pendiente de integración» o «—»: servicios (3), Service Fee (2), proveedores con mayor actividad, recompra (3), enmiendas de OC y estatus de pago |
| **Pendientes (datos fijos o de demostración)** | Configuración (7 pestañas, demo y `localStorage`), Portal del Cliente (`mockQuote`, `mockPO`; el acceso no autentica), Flujo del Proceso (23 contadores fijos por etapa), campana de Notificaciones (solo notificaciones locales del navegador) |
| **Guardan en MariaDB** | Clientes, Proveedores y Suministros (alta y edición); Requisición RF1 (alta y edición), R2 (regularización), R3A (solicitud de modificación) y R3B (revisión independiente y retiro) |
| **Validan pero no guardan** | Todo lo demás: termina con «Datos validados, pero no se guardó…» |

`App.jsx` muestra el aviso genérico «Módulo pendiente de integración» solo en **Flujo del Proceso**, **Portal del Cliente** y **Configuración**.

## 2. Cuentas SQL

| Cuenta SQL (overlay) | Qué puede escribir | La usan |
|---|---|---|
| `supplyflow_api_local` (base) | Nada: `SELECT` sobre el esquema | Todas las consultas de lectura |
| `supplyflow_auth_local` (`compose.supply-auth.yml`) | `auth_sessions`, `audit_events` (+2 columnas de revocación) | Inicio y cierre de sesión |
| `supplyflow_catalogwrite_local` (`compose.supply-catalogwrite.yml`) | `clients`, `suppliers`, `supplier_offerings`, `business_entities`, `party_contacts`, `party_contact_channels`, `files`, `entity_files`, `audit_events`, `idempotency_keys` | Clientes, Proveedores, Suministros |
| `supplyflow_reqwrite_local` (`compose.supply-reqwrite.yml`) | Borradores v0.7: `requisitions`, `requisition_items`, snapshots, `workflow_events`, `document_sequences` | `requisitions/drafts` |
| `supplyflow_recovery_local` (`compose.supply-recovery.yml`, contrato 52) | Requisiciones RF1, R2, R3A/R3B/R3C1 y bitácoras R3C2/R3C3 | Requisición y Control de cambios |

Rutas de escritura en `backend/app/Config/Routes.php` (19): login/logout; `catalogs/clients`, `catalogs/suppliers` y `catalogs/supplier-offerings` (POST/PUT); `requisitions/drafts` (POST/PUT); `recovery/requisitions` (POST/PUT) y `regularization` (POST); `recovery/.../changes` (crear, `decision`, `withdraw`, `commercial-reconciliation`, `commercial-executions` y su `review`).

El servidor solo distingue el rol `master_admin`; **no evalúa permisos por sección** (`role_permissions`, `user_permissions` se leen pero no se aplican).

Tablas del DDL que ninguna pantalla consulta todavía: `units`, `contracts`, `projects`, `customer_quote_adjustments`, `delivery_item_allocations`, `outbox_messages`, `email_delivery_logs`, `ai_runs`, `portal_access_tokens`, `import_batches`, `import_records`, `import_issues`, `legacy_id_map`. `notifications` solo se cuenta en Órdenes de Compra (no leídas); la campana no la usa.

## 3. Inventario módulo por módulo

Leyenda: **Real** guarda en MariaDB · **Bloqueada** valida y no guarda · **Demo** datos fijos en el código · **N/A** no requiere guardar.

| Módulo | Sección o tarjeta | Lectura de BD | Escritura | Tablas | Qué falta |
|---|---|---|---|---|---|
| Inicio y Dashboard | KPIs de requisiciones, estatus, alertas, importes, clientes, provisionales, Change Requests, segregación de funciones | Sí (`analytics/overview`, `recovery`) | N/A | `requisitions` y documentos del proceso | — |
| Inicio y Dashboard | Servicios (Service-to-Cash), panel «Servicios Operativos», «Service-to-Cash · 8 etapas» | **No** (pendiente) | N/A | `service_orders`, `service_types`, `invoices`, `entity_files` | Ver §4.A |
| Inicio y Dashboard | Service Fee (tarjeta y «Cotización + Service Fee»: con Service Fee, aprobadas por cliente, acumulado) | **No** (pendiente) | N/A | `customer_quote_versions.service_fee_*`, `customer_quote_decisions` | Ver §4.A |
| Inicio y Dashboard | Proveedores con mayor actividad | **No** (pendiente) | N/A | `rfqs.supplier_id`, `supplier_quotes`, `awards` | Ver §4.A |
| Inicio y Dashboard | Recompra: precios respetados, partidas por recotizar, precio comercial pendiente; Enmiendas de OC | **No** (pendiente) | N/A | `requisition_items.repeat_*`, `fixed_client_*`; `purchase_orders` (versiones), `purchase_order_modification_requests` | Ver §4.A |
| Inicio y Dashboard | Estatus de pago de facturas | **No**: el esquema no registra pagos (solo `due_date`, `payment_terms`, estatus) | N/A | — | Definir el registro de pagos (DDL nuevo): requiere autorización |
| Flujo del Proceso | Mapa, flujo de servicios, detalle por etapa, matriz, indicadores | **No**: 23 contadores fijos («N proceso(s)») | N/A | Documentos de cada etapa | Ver §4.B |
| Portal del Cliente | Acceso y seguimiento | **No** (`mockQuote`, `mockPO`; el acceso no valida credenciales) | Demo | `portal_access_tokens`, `clients.portal_enabled`/`portal_locked` y vistas filtradas por cliente | Ver §4.E |
| Campana (encabezado) | Notificaciones | **No**: solo notificaciones locales de la sesión | — | `notifications` | Ver §4.D |
| Clientes | Alta y edición | Sí | **Real** | `clients` y contactos | Eliminar e importar siguen bloqueados |
| Proveedores | Alta y edición | Sí | **Real** | `suppliers` y contactos | Eliminar e importar siguen bloqueados |
| Suministros | Alta y edición | Sí | **Real** | `supplier_offerings` | Eliminar sigue bloqueado |
| Contratista | Matriz y personal | Sí | Bloqueada | `people`, `users`, `user_roles` | Depende de la escritura de Usuarios y roles |
| Requisición | Registro | Sí | **Real** (RF1) | `requisitions`, `requisition_items` | — |
| Requisición | Sin requisición / Regularización | Sí | **Real** (R2) | `requisitions` y evidencias | — |
| Requisición | Matriz | Sí | N/A (SOLICITAR MODIFICACIÓN es R3A real) | — | — |
| Requisición | Catálogo de categorías | Sí (`catalogs/categories`) | Bloqueada | `categories` | Endpoint y grants `INSERT`/`UPDATE` (y `DELETE`) para `catalogwrite` |
| Requisición | Crear desde historial | Sí (`requisition-history/catalog`) | Bloqueada | `requisitions` (`history_based`, `repeat_policy_snapshot`), `requisition_items` (`history_*`, `repeat_*`, `fixed_client_*`) | Endpoint propio con la cuenta `recovery` (sin grants nuevos) y confirmar las reglas del Apps Script |
| Requisición | Control de cambios | Sí (`requisition-changes`) | **Real**: R3A, R3B y retiro; R3C2/R3C3 solo consulta | `requisition_change_*` | Escrituras R3C2/R3C3 bloqueadas; la revisión independiente requiere un segundo Master Admin activo |
| Gestión del Contratista | Registro de validación | Sí | Bloqueada | `requisition_reviews`, `workflow_events` | Endpoint, regla revisor ≠ solicitante y grants |
| Gestión del Contratista | Estrategia y lotificación | Sí | Bloqueada | `sourcing_plans`, `sourcing_lots`, `sourcing_lot_items`, `sourcing_lot_suppliers` | Endpoint y grants |
| Gestión del Contratista | Matriz y Reglas | Sí | Bloqueada | `requisition_reviews`, `organization_settings` | Editar reglas depende de Configuración |
| Cotizaciones | 10 tarjetas (RFQ, cotización de proveedor, comparativo, cotización y decisión del cliente, adjudicación) | Sí | Bloqueada (**comercial**) | `rfqs`, `rfq_items`, `supplier_quotes*`, `customer_quote*`, `awards`, `approval_policy_versions` | Endpoints, aprobaciones por política, folios (`document_sequences`) y pruebas integrales |
| Órdenes de Compra | Emisión, matriz, autorización, enmiendas, revisión, formato | Sí | Bloqueada (**comercial**) | `purchase_orders*`, `purchase_order_modification_requests`, `signature_evidence` | Endpoints, segregación de funciones, firmas y archivos privados |
| Recepción y Entrega | Recepción, entrega, matriz | Sí | Bloqueada (**comercial**) | `goods_receipts*`, `deliveries`, `delivery_*`, `signature_evidence`, `entity_files` | Endpoints, cantidades acumuladas, evidencias privadas |
| Factura | Registro, edición y acuse | Sí | Bloqueada (**comercial**) | `invoices`, `invoice_purchase_orders`, `invoice_acknowledgments` | Endpoints; emisor/razón social y reglas de acumulados |
| Servicios Operativos | Dashboard y encabezado «Servicios configurados» | Sí (`services/matrix`, `services/new-request`) | N/A | `service_orders`, `service_types` | — |
| Servicios Operativos | Nueva solicitud y Nuevo servicio | Sí (`services/new-request*`, `recovery/catalogs`, `recovery/folio`) | Bloqueada | `requisitions` (`route_code 'service'`), `requisition_items`, `service_orders`, `files`, `entity_files` | Endpoint de la requisición maestra (cuenta `recovery` + `SELECT service_types`) y del expediente (`INSERT service_orders`, evidencias privadas); capturas de «Datos específicos» de 5 tipos |
| Servicios Operativos | Matriz y Reportes | Sí | Bloqueada | `service_orders` | Edición y borrado dependen del endpoint anterior |
| Matriz General y Reportes | Consolidado | Sí | N/A | — | — |
| Usuarios y roles | Usuarios, roles, matriz de permisos, actividad | Sí | Bloqueada | `people`, `users`, `user_roles`, `roles`, `role_permissions`, `user_permissions` | Cuenta SQL nueva, hash de contraseñas, protección contra escalamiento y evaluación de permisos por sección en el servidor |
| Configuración | Pestañas 1 a 5 | **No** (demo y `localStorage`) | Demo | `organizations`, `organization_settings`, `approval_policy_versions`, `currencies`, `units`, `document_sequences`, `email_delivery_logs`, `files` | Ver §4.C |
| Configuración | Pestañas 6 y 7 (Respaldo y Reinicio) | No | **No deben conectarse** | — | Los respaldos se hacen con las herramientas INT03 fuera de la interfaz; «Reinicio» solo debe limpiar la caché local |

## 4. Cómo conectar lo pendiente para que muestre datos reales

Todo lo de esta sección es **solo lectura**: se resuelve con endpoints aditivos `GET`, Master Admin, `Cache-Control: no-store`, parámetros en lista blanca (422 si no) y la cuenta `supplyflow_api_local`, que ya tiene `SELECT` sobre el esquema. **No requiere grants, migraciones ni cambios de datos.** Cada uno se entrega con pruebas unitarias, HTTP (401/403/422, sin rutas de escritura, sin ids internos) y E2E de interfaz que calcula las cifras esperadas por separado.

### A. Inicio y Dashboard (11 indicadores)
Extender `GET /api/v1/analytics/overview` (`AnalyticsReadRepository`) con bloques nuevos que respeten los filtros actuales de periodo y cliente:
- **Servicios / Service-to-Cash y panel «Servicios Operativos»**: totales, abiertos, ejecutados, venta, costo y margen desde `service_orders`, con las mismas reglas que el Dashboard de Servicios (`dashboardModel.mjs`).
- **«Service-to-Cash · 8 etapas»**: etapa por servicio derivada de los criterios del Flujo del Proceso (datos mínimos → autorización confirmada → programado → OC vinculada o «no requiere proveedor» → ejecutado → evidencia → listo para facturar → factura). Las reglas se toman de esos criterios; los casos ambiguos se confirman con el Apps Script.
- **Service Fee**: versiones vigentes de `customer_quote_versions` con `service_fee_enabled`, suma de `service_fee_total_amount` por moneda y cuántas están aprobadas por el cliente (`client_decision_status` / `customer_quote_decisions`). `QuoteReadRepository` ya lee esas columnas.
- **Proveedores con mayor actividad**: por proveedor, RFQs (`rfqs.supplier_id`), ofertas (`supplier_quotes`) y adjudicaciones (`awards`).
- **Recompra**: partidas de requisiciones desde historial por `repeat_client_price_mode` y `repeat_sourcing_mode` (precio respetado, por recotizar, precio comercial pendiente).
- **Enmiendas de OC**: versiones posteriores de `purchase_orders` y `purchase_order_modification_requests` (solo conteo; las escrituras siguen bloqueadas).
- **Estatus de pago**: no tiene fuente. Se queda como pendiente hasta definir cómo registrar pagos (requeriría DDL y autorización).

### B. Flujo del Proceso (23 contadores fijos)
Endpoint `GET /api/v1/analytics/process-flow` que cuente procesos por etapa:
- **Compra / renta (15 etapas)**: cada requisición en la etapa más avanzada con evidencia documental (`requisition_reviews`, `sourcing_plans`/`sourcing_lots`, `rfqs`, `supplier_quotes`, `awards`, `customer_quote_versions` y sus decisiones, `purchase_orders`, `goods_receipts`, `deliveries`, `invoices`). Debe ser coherente con la política de 8 etapas que el servidor ya calcula (`RequisitionRecoveryRepository::STAGES`).
- **Servicios (8 etapas)**: misma derivación que §4.A.
- Las pestañas «Matriz del proceso» e «Indicadores y cuellos de botella» toman los mismos conteos (tiempo en etapa con `workflow_events`).

### C. Configuración (pestañas 1 a 5)
Endpoint `GET /api/v1/settings` que devuelva los grupos de `organization_settings` que ya existen en la base:

| Pestaña | Fuente |
|---|---|
| 1 Identidad y formatos | `legacy_branding` (empresa, nombre y lema), `legacy_localization` (idioma de documentos), `legacy_organization` (contratista activo) y logotipo (`files`) |
| 2 Matriz de parámetros | `legacy_purchasing` (moneda, IVA, prefijos REQ/OC, días de alerta, cotizaciones mínimas), `currencies`, `units`, `legacy_counters`/`document_sequences` |
| 3 Aprobaciones de cotización | `legacy_quote_policy` y `approval_policy_versions` (versión vigente) |
| 4 Condiciones de cotización | `legacy_quote_conditions` (ES/EN) |
| 5 Correos automáticos | `legacy_email` y el historial de envíos `email_delivery_logs` (paginado, sin cuerpos de correo) |

La escritura viene después y requiere autorización: una cuenta `settingswrite` con `UPDATE organization_settings` e `INSERT approval_policy_versions`, versionando la política (cambia aprobaciones y folios) y con auditoría. Pestañas 6 y 7: no se conectan.

### D. Campana de notificaciones
`GET /api/v1/notifications` con solo las notificaciones **del usuario en sesión** (`recipient_user_id`), paginado. Marcar como leída es una escritura mínima (`UPDATE notifications (is_read, read_at)`) y requiere autorización para el grant.

### E. Portal del Cliente (seguridad externa)
No se puede conectar solo con lectura: hoy el acceso no autentica. Requiere diseñar un acceso independiente del de usuarios internos:
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
| **0 · Solo lectura** (sin grants) | 1. Inicio y Dashboard: 10 de los 11 indicadores (todos menos el estatus de pago, §4.A). 2. Configuración pestañas 1 a 5 (§4.C). 3. Flujo del Proceso (§4.B). 4. Campana: lectura (§4.D) | No | Bajo |
| **1 · Operativo, no comercial** | 5. Categorías. 6. Crear desde historial. 7. Servicios: requisición maestra y expediente. 8. Gestión del Contratista: validación, estrategia y lotes. 9. Configuración: escritura versionada. 10. Usuarios y roles, con permisos por sección en el servidor. 11. Notificaciones: marcar como leídas | Sí, por módulo | Medio; Usuarios es alto |
| **2 · Comercial** (bloqueado hasta autorizar) | 12. Cotizaciones. 13. OC. 14. Recepción y Entrega. 15. Factura (y registro de pagos si se define). 16. Escrituras R3C2/R3C3 | Sí | Alto |
| **3 · Seguridad externa** | 17. Portal del Cliente con tokens propios | Sí | Alto |

Ya completado de la fase 0 anterior: Dashboard de Servicios (23 nov.) y Control de cambios R3A/R3B (23 nov.).

## 7. Código sin uso

Hay 8 vistas antiguas con datos de demostración que **ya no se importan** en `App.jsx` (las reemplazaron los módulos conectados): `src/views/Clients.jsx`, `Suppliers.jsx`, `SupplierSupply.jsx`, `Requisition.jsx`, `Quotes.jsx`, `PurchaseOrders.jsx`, `ReceptionDelivery.jsx` e `Invoice.jsx` (unas 15,800 líneas). No son conexiones pendientes. También es residual el estado `quotes` que `App.jsx` guarda en `localStorage` (`grupo_gerez_quotes`). Retirar ambos es una limpieza independiente y requiere autorización.
