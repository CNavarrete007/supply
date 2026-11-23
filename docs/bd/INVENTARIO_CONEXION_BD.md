# SupplyFlow — Inventario de conexión a MariaDB por módulo

**Fecha:** 20 nov. 2026 · **Base del análisis:** commit `2f79193` (código, DDL versionado de 77 tablas y contratos de cuentas SQL).
**Alcance:** solo análisis de código. No se ejecutaron migraciones, grants ni escrituras.

## 1. Cómo está conectado hoy el sistema

| Cuenta SQL (overlay) | Qué puede escribir | La usan |
|---|---|---|
| `supplyflow_api_local` (base) | Nada: `SELECT` sobre el esquema | Todas las consultas de lectura |
| `supplyflow_auth_local` (`compose.supply-auth.yml`) | `auth_sessions`, `audit_events` (+2 columnas de revocación) | Inicio y cierre de sesión |
| `supplyflow_catalogwrite_local` (`compose.supply-catalogwrite.yml`) | `clients`, `suppliers`, `supplier_offerings`, `business_entities`, `party_contacts`, `party_contact_channels`, `files`, `entity_files`, `audit_events`, `idempotency_keys` | Clientes, Proveedores, Suministros |
| `supplyflow_reqwrite_local` (`compose.supply-reqwrite.yml`) | Borradores v0.7: `requisitions`, `requisition_items`, snapshots, `workflow_events`, `document_sequences` | `requisitions/drafts` |
| `supplyflow_recovery_local` (`compose.supply-recovery.yml`, contrato 52) | Requisiciones RF1, R2, R3A/R3B/R3C1 y bitácoras R3C2/R3C3 | Requisición y Control de cambios |

Rutas de escritura que existen en `backend/app/Config/Routes.php` (19): login/logout; `catalogs/clients`, `catalogs/suppliers` y `catalogs/supplier-offerings` (POST/PUT); `requisitions/drafts` (POST/PUT); `recovery/requisitions` (POST/PUT) y `regularization` (POST); `recovery/.../changes` (crear, `decision`, `withdraw`, `commercial-reconciliation`, `commercial-executions` y su `review`).

**Todo lo demás es de solo lectura.** Las pantallas validan la captura y terminan con «Datos validados, pero no se guardó…».

Tablas del DDL que ningún código del backend usa todavía: `units`, `contracts`, `customer_quote_adjustments`, `delivery_item_allocations`, `outbox_messages`, `email_delivery_logs`, `ai_runs`, `import_batches`, `import_records`, `import_issues`, `legacy_id_map`. `portal_access_tokens` solo aparece en una lista de campos prohibidos.

## 2. Inventario módulo por módulo

Leyenda:
- **Real**: guarda en MariaDB.
- **Bloqueada**: valida la captura pero no guarda.
- **Demo**: muestra datos fijos en el código.
- **N/A**: el módulo no requiere guardar.

| Módulo | Sección o tarjeta | Lectura de BD | Escritura | Tablas destino | Qué falta |
|---|---|---|---|---|---|
| Inicio y Dashboard | KPIs | Sí | N/A | — | Nada |
| Flujo del Proceso | Guía | No (es estática) | N/A | — | Opcional: mostrar contadores reales con `analytics` |
| Portal del Cliente | Acceso y seguimiento | **No** (`mockQuote`, `mockPO`) | Demo | `portal_access_tokens` y vistas filtradas por cliente | Diseñar la autenticación por cliente, emitir y revocar tokens, filtrar todo por cliente en el servidor. Es nueva superficie de seguridad |
| Clientes | Alta y edición | Sí | **Real** | `clients` y contactos | Eliminar e importar siguen bloqueados |
| Proveedores | Alta y edición | Sí | **Real** | `suppliers` y contactos | Eliminar e importar siguen bloqueados |
| Suministros | Alta y edición | Sí | **Real** | `supplier_offerings` | Eliminar sigue bloqueado |
| Contratista | Matriz y personal | Sí | Bloqueada | `people`, `users`, `user_roles` | Depende de la escritura de Usuarios y roles |
| Requisición | Registro | Sí | **Real** (RF1) | `requisitions`, `requisition_items` | — |
| Requisición | Regularización | Sí | **Real** (R2) | `requisitions` y evidencias | — |
| Requisición | Matriz | Sí | N/A | — | — |
| Requisición | Control de cambios | Sí: tablero `GET /api/v1/requisition-changes` con estados del original derivados de R3 (23 nov 2026) | **Real**: R3A desde la Matriz (SOLICITAR MODIFICACIÓN), R3B revisión independiente y retiro; R3C2/R3C3 solo consulta | `requisition_change_*` | Escrituras comerciales R3C2/R3C3 siguen bloqueadas. La revisión independiente requiere un segundo Master Admin activo |
| Requisición | Crear desde historial | Sí: `GET /api/v1/requisition-history/catalog` con política de recompra y cotizaciones aprobadas (20 nov 2026) | Bloqueada (valida la requisición y la ruta por partida) | `requisitions` (`history_based`, `repeat_policy_snapshot`), `requisition_items` (`history_*`, `repeat_*_mode`, `fixed_client_*`) | El alta RF1 no guarda origen histórico ni ruta por partida: endpoint propio con la cuenta `recovery` (sin permisos nuevos) **y confirmar las reglas del Apps Script**: requiere autorización |
| Requisición | Catálogo de categorías | Sí: `GET /api/v1/catalogs/categories` con estatus y uso (20 nov 2026) | Bloqueada (valida alta, edición, estatus y eliminación) | `categories` | Endpoint de escritura y permisos SQL (`INSERT`/`UPDATE`, y `DELETE` si se habilita eliminar) a `catalogwrite`: requiere autorización |
| Gestión del Contratista | Registro de validación | Sí | Bloqueada | `requisition_reviews`, `workflow_events` | Endpoint de revisión, regla de que el revisor no sea el solicitante, y grants |
| Gestión del Contratista | Estrategia y lotificación | Sí | Bloqueada | `sourcing_plans`, `sourcing_lots`, `sourcing_lot_items`, `sourcing_lot_suppliers` | Endpoint y grants. Es la antesala de la RFQ |
| Gestión del Contratista | Matriz y Reglas | Sí | Bloqueada | `requisition_reviews`, `organization_settings` | Editar reglas depende de Configuración |
| Cotizaciones | 10 tarjetas: RFQ, cotización de proveedor, comparativo, cotización y decisión del cliente, adjudicación | Sí | Bloqueada (**comercial**) | `rfqs`, `rfq_items`, `supplier_quotes*`, `customer_quote*`, `awards`, `approval_policy_versions` | Cadena completa de endpoints, aprobaciones por política, folios (`document_sequences`) y pruebas integrales |
| Órdenes de Compra | Emisión, autorización, enmiendas, firmas | Sí | Bloqueada (**comercial**) | `purchase_orders*`, `purchase_order_modification_requests`, `signature_evidence` | Endpoints, segregación de funciones, firmas y archivos privados |
| Recepción y Entrega | Recepción, entrega y fotos | Sí | Bloqueada (**comercial**) | `goods_receipts*`, `deliveries`, `delivery_*`, `signature_evidence`, `entity_files` | Endpoints, control de cantidades acumuladas, evidencias privadas |
| Factura | Registro, edición y acuse | Sí | Bloqueada (**comercial**) | `invoices`, `invoice_purchase_orders`, `invoice_acknowledgments` | Endpoints. Faltan respuestas de negocio: emisor/razón social y reglas de acumulados |
| Servicios Operativos | Dashboard | **No** (demo) | N/A | `service_orders`, `service_types` | Conectar la lectura reutilizando `services/matrix` |
| Servicios Operativos | Nueva solicitud | **No** (demo, `mockBD`) | Demo | `service_orders`, `entity_files` | Endpoint de alta y edición, y grants |
| Servicios Operativos | Matriz y Reportes | Sí | Bloqueada | `service_orders` | Edición y borrado dependen del endpoint anterior |
| Matriz General y Reportes | Consolidado | Sí | N/A | — | Nada |
| Usuarios y roles | Usuarios, roles, matriz, actividad | Sí | Bloqueada | `people`, `users`, `user_roles`, `roles`, `role_permissions`, `user_permissions` | Cuenta SQL nueva, hash de contraseñas, protección contra escalamiento de privilegios. El servidor hoy solo distingue `master_admin`, **no evalúa permisos por sección** |
| Configuración | Pestañas 1 a 5: identidad, parámetros, aprobaciones, condiciones, correos | **No** (demo y `localStorage`) | Demo | `organizations`, `organization_settings`, `approval_policy_versions`, `currencies`, `units`, `document_sequences`, `notifications`, `outbox_messages`, `email_delivery_logs` | Primero lectura; después escritura con versión de políticas (afecta aprobaciones y folios) |
| Configuración | Pestañas 6 y 7: Respaldo y Reinicio | No | **No deben conectarse a la BD** | — | Los respaldos se hacen con las herramientas INT03, fuera de la interfaz. «Reinicio» solo debe limpiar la caché local del navegador |

### Código sin uso (revisado el 20 nov. 2026)

Hay 8 vistas antiguas con datos de demostración que **ya no se importan** en `App.jsx`, porque las reemplazaron los módulos conectados:
- `src/views/Clients.jsx`
- `src/views/Suppliers.jsx`
- `src/views/SupplierSupply.jsx`
- `src/views/Requisition.jsx`
- `src/views/Quotes.jsx`
- `src/views/PurchaseOrders.jsx`
- `src/views/ReceptionDelivery.jsx`
- `src/views/Invoice.jsx`

En total son unas 16,000 líneas. No son conexiones pendientes. También es residual el estado `quotes` que `App.jsx` guarda en `localStorage` (`grupo_gerez_quotes`): ningún módulo actual lo usa. Retirar ambos es una limpieza independiente y requiere autorización.

Los módulos que todavía muestran el aviso genérico «Módulo pendiente de integración» son **Portal del Cliente**, **Configuración** y **Flujo del Proceso**.

## 3. Requisitos de toda escritura nueva

Mismo patrón que R2 y R3:
- Sesión y rol verificados en el servidor.
- Encabezado `X-SF-CSRF`.
- `Idempotency-Key` (tabla `idempotency_keys`).
- Concurrencia optimista con `If-Match`.
- Motivo obligatorio cuando aplique.
- `audit_events` en la misma transacción.
- Una cuenta SQL con los grants mínimos por módulo, en su propio overlay.
- Pruebas con datos sintéticos en el sandbox: unitarias, HTTP (401, 403, 409, 422, idempotencia) y E2E de interfaz.

Las 77 tablas ya existen. En principio no hace falta DDL nuevo. Para la concurrencia optimista existe `business_entities.row_version`, común a todas las entidades de negocio que comparten su `id` (requisición, RFQ, cotización, OC, recepción, entrega, servicio…), y también `users.row_version`. Ese es el token para `If-Match`. *(Corregido el 20 nov. 2026: la versión anterior de este documento decía que no había columna de versión.)*

**Requieren autorización explícita del usuario antes de ejecutarse:**
- Cualquier `GRANT` nuevo o cuenta SQL.
- Cualquier escritura comercial: Cotizaciones, OC, Recepción, Factura, y escrituras R3C2/R3C3.
- Cualquier migración.

## 4. Orden recomendado

| Fase | Trabajo | Grants nuevos | Riesgo |
|---|---|---|---|
| **0 · Sin grants nuevos** | 1. Servicios Dashboard (lectura). 2. Configuración pestañas 1 a 5 (lectura). 3. Requisición «Crear desde historial» con `POST recovery/requisitions`. 4. Requisición «Control de cambios»: pantalla R3B y R3C1 sobre endpoints ya probados en INT02; R3C2/R3C3 solo en consulta | No | Bajo |
| **1 · Operativo, no comercial** | 5. Categorías. 6. Gestión del Contratista: validación, después estrategia y lotes. 7. Servicios: nueva solicitud y edición. 8. Usuarios y roles, incluida la evaluación de permisos por sección en el servidor | Sí, por módulo | Medio; Usuarios es alto |
| **2 · Comercial** (bloqueado hasta autorizar) | 9. Cotizaciones. 10. OC. 11. Recepción y Entrega. 12. Factura. 13. Escrituras R3C2/R3C3 | Sí | Alto |
| **3 · Seguridad externa** | 14. Portal del Cliente con tokens propios | Sí | Alto |
