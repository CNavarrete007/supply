# SupplyFlow — Mapa de conexión de clases con el Backend

**Fecha:** 24 nov. 2026
**Entorno verificado:** sandbox local con base sintética (77 tablas, contrato 77/52 y `catalogwrite` con 33 permisos). No es tu PC ni la base comercial.
**Pregunta:** ¿qué clases del sistema están conectadas al Backend y hacen su función?

> **Actualización del 24 nov, tarde.** Se agregaron:
> - `GET /api/v1/catalogs/write-status`: diagnóstico de solo lectura del guardado de catálogos.
> - `CatalogWriteStatusController` y `CatalogWriteProbe`.
>
> Ahora hay 118 rutas y 83 clases PHP, verificadas con `tests/catalog_write_status_http_check.py` y `tests/frontend/catalog_write_status_ui_e2e.cjs`. El resto de este informe corresponde a la corrida descrita abajo.
>
> **Actualización del 24 nov, noche.** Se agregaron `GET /api/v1/catalogs/currencies` (`CurrencyCatalogController`) y la edición
> de los datos de la empresa en Contratista: `PUT /api/v1/contractors/{id}` y `GET /api/v1/contractors/{id}/logo`
> (`ContractorWriteController`, `ContractorInput`, `ContractorWriteRepository`; cuenta `catalogwrite`, ahora 35 permisos).
> `python3 tests/class_connection_audit.py`: **121 rutas, 87 clases PHP, 138 archivos de interfaz, 0 problemas.**
>
> **Actualización del 25 nov.** `POST /api/v1/recovery/requisitions/from-history` (`RequisitionRecoveryController::createFromHistory`,
> `RequisitionHistoryInput`; cuenta `recovery`, sin permisos nuevos). Mapa: **122 rutas, 88 clases PHP, 0 problemas.**

## Conclusión

**Todas las clases en uso están conectadas.** No hay rutas rotas, llamadas a rutas inexistentes, clases huérfanas ni permisos SQL faltantes.

### Frontend (React)
- **Archivos:** los 134 archivos JS/JSX son alcanzables desde `src/main.jsx`.
- **Componentes `.jsx` (53):**

  | Tipo | Cantidad | Detalle |
  |---|---|---|
  | Conexión directa | 46 | Importan un cliente HTTP |
  | Contenedores | 3 | `ContractorManagement`, `CustomerPortal` y `CatalogReadOnly`; sus tarjetas hijas se conectan |
  | Por props | 2 | `SignaturePad` y `RequisitionPickerModal`; reciben datos ya consultados |
  | Alias | 1 | `RequisitionTransactional` → `RequisitionRecovery` |
  | Punto de entrada | 1 | `main.jsx` |

- **Clientes HTTP:** 19 módulos hacen `fetch`.
- **En vivo:** 48 archivos originaron peticiones reales, según la pila de llamadas del navegador.

### Backend (CodeIgniter)
- **Rutas:** 117 explícitas, sin enrutamiento automático: 95 GET y 22 de escritura. Las 117 apuntan a un controlador y método existentes.
- **Clases:** 81 clases PHP (30 controladores, 49 librerías, filtro y contrato de sesión). Todas se usan desde alguna ruta.

### Cuentas SQL

| Cuenta | Uso | Rutas |
|---|---|---|
| `api` | Solo `SELECT` | 75 (73 con sesión `auth`, más `health` y `ready`) |
| `recovery` | RF1, R2, R3 | 23 |
| `catalogwrite` | Clientes, Proveedores, Suministros y Categorías | 11 |
| `reqwrite` | Borradores v0.7 | 4 |
| `auth` | Sesión; la validan todas las rutas protegidas | 4 propias (login, logout, me, csrf) |

- Cada tabla que cada clase lee o escribe está concedida a su cuenta en los contratos versionados.
- Este cruce habría detectado el permiso faltante de Categorías del 23 nov.

### Verificación en vivo
- Ejecuté toda la suite, las escrituras sintéticas y el recorrido de los 18 módulos.
- **113 de 117 rutas** recibieron peticiones reales; **106** las originó la interfaz.
- **0 respuestas 5xx.**
- Ninguna petición de la interfaz fue a una ruta inexistente.
- Las 208 sondas de las pruebas a rutas que no deben existir (escrituras en módulos de solo lectura) fueron rechazadas, todas con 404.

## Qué no ejercita ninguna pantalla (y por qué)

| Ruta | Estado |
|---|---|
| `POST …/changes/{id}/commercial-reconciliation`, `POST …/commercial-executions`, `POST …/commercial-executions/{id}/review` (R3C2/R3C3) | Existen en el Backend desde INT02, pero **la interfaz no las llama por política**: las escrituras comerciales siguen bloqueadas hasta validarlas de extremo a extremo. No se ejercitaron. |
| `GET /api/v1/health`, `GET /api/v1/ready` | Las usan los scripts de arranque (`SupplyFlow-Dev.ps1`, `SupplyFlow-Restore-INT03.ps1`). |
| `GET /requisition-changes/candidates`, `GET /analytics/requisitions.csv`, `GET /requisitions/drafts` | Responden 200 con el formato correcto (comprobado por HTTP). Sus funciones cliente existen (`changeCandidates`, `analyticsCsv`, `getDrafts`/`getDraft`), pero ninguna pantalla las llama: Reportes arma su CSV en el navegador. |
| `POST /requisitions/drafts` | Alta de borradores v0.7. RF1 la reemplazó y no tiene pantalla de alta. Los borradores existentes (tu respaldo tiene al menos uno) **se editan** desde Registro con `PUT /requisitions/drafts/{id}`, ya verificado. |
| `GET …/regularization/document` | La pantalla muestra el enlace «Descargar evidencia». La prueba de Regularización lee su dirección y descarga el archivo con la sesión (bytes idénticos), sin pasar por la pila del navegador. |

## Lo que se corrigió o agregó durante la verificación

1. **Prueba nueva `tests/frontend/requisition_edit_ui_e2e.cjs`** (22 comprobaciones, solo base sintética). Cubre desde la interfaz caminos que ninguna prueba recorría:

   | Caso | Ruta |
   |---|---|
   | Alta en Registro de requisición | `POST /recovery/requisitions` |
   | EDITAR → Guardar | `PUT /recovery/requisitions/{id}`, con versión e idempotencia |
   | 👁️ Ver archivo | `GET …/document`, PDF con los mismos bytes |
   | Edición de un borrador v0.7 | `PUT /requisitions/drafts/{id}`, cuenta `reqwrite` |
   | Cerrar sesión | Confirmación; Cancelar conserva la sesión; `/auth/me` → 401 |

2. **Prueba de Regularización.** Fallaba de forma intermitente: al volver a la tarjeta, el buscador se reinicia y, con más de 100 solicitudes provisionales sintéticas, la fila podía quedar en otra página. Ahora filtra por el folio de la corrida. No era un fallo del sistema.
3. **Código sin uso.** Retiré la vista genérica `CatalogReadOnly` (unas 66 líneas): ninguna pantalla la mostraba. El archivo conserva los dos envoltorios que importa `App.jsx`.
4. **Herramientas para repetir la verificación:**
   - `tests/class_connection_audit.py`: análisis estático; no se conecta a la base.
   - `tests/tools/cdp_initiator_preload.cjs`: registra qué archivo de la interfaz originó cada petición.
   - `tests/tools/api_access_router.php`: registro de acceso para `php -S`, solo en desarrollo.

## Pendientes que requieren tu decisión

- **R3C2/R3C3.** Las tres rutas de escritura comercial siguen activas en el servidor sin pantalla. Opciones:
  - Dejarlas como están (solo Master Admin, CSRF, idempotencia y auditoría).
  - Bloquearlas en el servidor hasta validarlas de extremo a extremo.
- **Funciones cliente sin pantalla** (`changeCandidates`, `analyticsCsv`, `getDrafts`, `getDraft`). Se pueden retirar o conectar, por ejemplo el CSV del servidor en Reportes.
- **Permisos por sección.** Siguen sin aplicarse en el servidor: solo distingue `master_admin`. Es un hallazgo conocido de la auditoría del 23 nov.

## Cómo regenerar este mapa

```bash
python3 tests/class_connection_audit.py
```

Esto produce solo el análisis estático; sirve en cualquier copia y sale con 1 si encuentra problemas. Para la parte en vivo, en el sandbox sintético:
1. Arrancar la API con `tests/tools/api_access_router.php` y `SF_ACCESS_LOG`.
2. Correr las pruebas con `NODE_OPTIONS="--require …/cdp_initiator_preload.cjs"` y `SF_INITIATOR_LOG`.
3. Generar el mapa:

```bash
python3 tests/class_connection_audit.py --access-log <archivo> --initiator-log <archivo> --markdown <salida.md>
```

---

# Informe generado (24 nov. 2026)

## Resumen (generado)

| Concepto | Resultado |
|---|---|
| Rutas de la API (`Routes.php`, enrutamiento automático desactivado) | 117 (95 GET, 22 de escritura) |
| Rutas cuyo controlador y método existen | 117/117 |
| Clases PHP (controladores, librerías, filtro, sesión) | 81; sin uso desde ninguna ruta: 0 |
| Archivos JS/JSX alcanzables desde `src/main.jsx` | 134 de 134; componentes `.jsx`: 53; clientes HTTP (`fetch`): 19 |
| Rutas que recibieron peticiones reales en la corrida | 113/117 (desde la interfaz: 106) |
| Respuestas 5xx observadas | 0 |
| Archivos del frontend que originaron peticiones (pila CDP) | 48 |
| Problemas (rutas rotas, llamadas a rutas inexistentes, permisos SQL faltantes) | 0 |

## Rutas: controlador → librerías → cuenta SQL → origen en la interfaz

Componentes: archivos `/src` en la pila de llamadas de las peticiones que hizo el navegador. Respuestas: códigos que devolvió la API en la corrida (interfaz y pruebas HTTP juntas).

| Método | Ruta | Controlador::método | Librerías | Cuenta SQL | Componentes que la llaman | Respuestas en vivo |
|---|---|---|---|---|---|---|
| GET | `/api/v1/health` | StatusController::health | — | api | scripts de arranque (`*.ps1`) | 200×1 |
| GET | `/api/v1/ready` | StatusController::ready | — | api | scripts de arranque (`*.ps1`) | — |
| GET | `/api/v1/auth/csrf` | AuthController::csrf | SupplyAuthRepo | auth | App.jsx, Login.jsx, catalog/useCatalogAutosave.js, recovery/CategoryCatalog.jsx, recovery/ChangeControl.jsx, recovery/ChangeRequestModal.jsx, recovery/Regularization.jsx, recovery/RequisitionRecovery.jsx | 200×309 |
| POST | `/api/v1/auth/login` | AuthController::login | SupplyAuthRepo | auth | Login.jsx | 200×89 |
| GET | `/api/v1/auth/me` | AuthController::me | SupplyAuthRepo | auth | App.jsx, UsersRoles.jsx, purchaseOrders/PurchaseOrdersModule.jsx | 200×14, 401×118 |
| POST | `/api/v1/auth/logout` | AuthController::logout | SupplyAuthRepo | auth | App.jsx | 200×34 |
| GET | `/api/v1/users` | UserDirectoryController::users | SupplyAuthRepo, UserActivityReadRepo | api, auth | UsersRoles.jsx, purchaseOrders/PurchaseOrdersModule.jsx | 200×14, 401×1, 403×1 |
| GET | `/api/v1/roles` | UserDirectoryController::roles | SupplyAuthRepo, UserActivityReadRepo | api, auth | UsersRoles.jsx | 200×10, 401×1, 403×1 |
| GET | `/api/v1/users/functions` | UserDirectoryController::functions | SupplyAuthRepo, UserActivityReadRepo | api, auth | UsersRoles.jsx | 200×9, 401×1, 403×1, 422×1 |
| GET | `/api/v1/audit-events` | UserDirectoryController::auditEvents | SupplyAuthRepo, UserActivityReadRepo | api, auth | UsersRoles.jsx | 200×27, 401×1, 403×1, 422×8 |
| GET | `/api/v1/requisition-history/catalog` | RequisitionHistoryController::catalog | RequisitionHistoryReadRepo, SupplyAuthRepo | api, auth | recovery/HistoryRequisition.jsx | 200×46, 401×1, 404×1, 422×5 |
| GET | `/api/v1/catalogs/categories` | CategoryCatalogController::index | CategoryReadRepo, SupplyAuthRepo | api, auth | recovery/CategoryCatalog.jsx | 200×33, 401×1, 422×4 |
| POST | `/api/v1/catalogs/categories` | CategoryWriteController::create | CatalogReadRepo, CatalogWriteBase, CategoryWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | recovery/CategoryCatalog.jsx | 200×2, 201×2, 401×1, 403×2, 409×2, 415×1, 422×10 |
| PUT | `/api/v1/catalogs/categories/(:segment)` | CategoryWriteController::update | CatalogReadRepo, CatalogWriteBase, CategoryWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | recovery/CategoryCatalog.jsx | 200×4, 403×1, 404×2, 412×2, 428×1 |
| DELETE | `/api/v1/catalogs/categories/(:segment)` | CategoryWriteController::delete | CatalogReadRepo, CatalogWriteBase, CategoryWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | recovery/CategoryCatalog.jsx | 200×3, 403×1, 404×1, 409×1, 412×1, 428×1 |
| GET | `/api/v1/catalogs/clients` | CatalogDirectoryController::clients | CatalogReadRepo, SupplierOfferingReadRepo, SupplyAuthRepo | api, auth | Dashboard.jsx, clients/ClientsCatalog.jsx | 200×106 |
| GET | `/api/v1/catalogs/clients/(:segment)` | CatalogDirectoryController::client | CatalogReadRepo, SupplierOfferingReadRepo, SupplyAuthRepo | api, auth | catalog/shared.jsx, clients/ClientsCatalog.jsx | 200×60 |
| POST | `/api/v1/catalogs/clients` | ClientWriteController::create | CatalogReadRepo, CatalogWriteBase, ClientWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×1, 201×4, 401×1, 403×2, 409×3, 415×1, 422×15 |
| PUT | `/api/v1/catalogs/clients/(:segment)` | ClientWriteController::update | CatalogReadRepo, CatalogWriteBase, ClientWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×8, 404×1, 409×1, 412×2, 428×1 |
| GET | `/api/v1/catalogs/clients/(:segment)/logo` | ClientWriteController::logo | CatalogReadRepo, CatalogWriteBase, ClientWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×5, 401×1, 404×2 |
| GET | `/api/v1/catalogs/supplier-offerings` | CatalogDirectoryController::supplierOfferings | CatalogReadRepo, SupplierOfferingReadRepo, SupplyAuthRepo | api, auth | supplies/SupplierSupplyCatalog.jsx | 200×44, 401×1, 403×1, 422×6 |
| GET | `/api/v1/catalogs/supplier-offerings/(:segment)` | CatalogDirectoryController::supplierOffering | CatalogReadRepo, SupplierOfferingReadRepo, SupplyAuthRepo | api, auth | supplies/SupplierSupplyCatalog.jsx | 200×12, 404×2 |
| POST | `/api/v1/catalogs/supplier-offerings` | OfferingWriteController::create | CatalogReadRepo, CatalogWriteBase, OfferingWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×1, 201×3, 401×1, 403×2, 409×2, 422×11 |
| PUT | `/api/v1/catalogs/supplier-offerings/(:segment)` | OfferingWriteController::update | CatalogReadRepo, CatalogWriteBase, OfferingWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×8, 412×2, 428×1 |
| GET | `/api/v1/catalogs/suppliers` | CatalogDirectoryController::suppliers | CatalogReadRepo, SupplierOfferingReadRepo, SupplyAuthRepo | api, auth | Dashboard.jsx, suppliers/SuppliersCatalog.jsx, supplies/SupplierSupplyCatalog.jsx | 200×146 |
| POST | `/api/v1/catalogs/suppliers` | SupplierWriteController::create | CatalogReadRepo, CatalogWriteBase, SupplierWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×1, 201×6, 401×1, 403×2, 409×2, 422×14 |
| PUT | `/api/v1/catalogs/suppliers/(:segment)` | SupplierWriteController::update | CatalogReadRepo, CatalogWriteBase, SupplierWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×8, 412×2, 422×2, 428×1 |
| GET | `/api/v1/catalogs/suppliers/(:segment)/logo` | SupplierWriteController::logo | CatalogReadRepo, CatalogWriteBase, SupplierWriteRepo, SupplyAuthRepo | api, auth, catalogwrite | catalog/useCatalogAutosave.js | 200×4, 404×1 |
| GET | `/api/v1/catalogs/suppliers/(:segment)` | CatalogDirectoryController::supplier | CatalogReadRepo, SupplierOfferingReadRepo, SupplyAuthRepo | api, auth | catalog/shared.jsx, quotes/RfqRequestCard.jsx, suppliers/SuppliersCatalog.jsx, supplies/SupplierSupplyCatalog.jsx | 200×27 |
| GET | `/api/v1/invoices` | InvoiceController::index | InvoiceReadRepo, ReceptionReadRepo, SupplyAuthRepo | api, auth | invoices/InvoiceModule.jsx | 200×43, 401×1, 422×5 |
| GET | `/api/v1/invoices/control` | InvoiceController::control | InvoiceReadRepo, ReceptionReadRepo, SupplyAuthRepo | api, auth | invoices/InvoiceModule.jsx | 200×6, 401×1, 422×1 |
| GET | `/api/v1/invoices/requisitions` | InvoiceController::requisitions | InvoiceReadRepo, ReceptionReadRepo, SupplyAuthRepo | api, auth | invoices/InvoiceModule.jsx | 200×9, 401×1, 422×1 |
| GET | `/api/v1/invoices/requisitions/(:segment)` | InvoiceController::requisition | InvoiceReadRepo, ReceptionReadRepo, SupplyAuthRepo | api, auth | invoices/InvoiceModule.jsx | 200×7, 404×1 |
| GET | `/api/v1/invoices/(:segment)` | InvoiceController::show | InvoiceReadRepo, ReceptionReadRepo, SupplyAuthRepo | api, auth | invoices/InvoiceModule.jsx | 200×2, 401×1, 404×1, 422×1 |
| GET | `/api/v1/reception/matrix` | ReceptionController::matrix | ReceptionReadRepo, SupplyAuthRepo | api, auth | reception/ReceptionModule.jsx | 200×24, 401×1, 422×4 |
| GET | `/api/v1/reception/orders` | ReceptionController::orders | ReceptionReadRepo, SupplyAuthRepo | api, auth | reception/ReceptionModule.jsx | 200×6, 401×1, 422×2 |
| GET | `/api/v1/reception/orders/(:segment)` | ReceptionController::order | ReceptionReadRepo, SupplyAuthRepo | api, auth | reception/ReceptionModule.jsx | 200×3, 404×1 |
| GET | `/api/v1/reception/receipts/(:segment)` | ReceptionController::receipt | ReceptionReadRepo, SupplyAuthRepo | api, auth | reception/ReceptionModule.jsx | 200×3, 401×1, 404×1, 422×1 |
| GET | `/api/v1/reception/deliveries/(:segment)` | ReceptionController::delivery | ReceptionReadRepo, SupplyAuthRepo | api, auth | reception/ReceptionModule.jsx | 200×7, 404×1 |
| GET | `/api/v1/reception/closure` | ReceptionController::closure | ReceptionReadRepo, SupplyAuthRepo | api, auth | reception/ReceptionModule.jsx | 200×6, 401×1, 422×1 |
| GET | `/api/v1/reception/deliverable` | ReceptionController::deliverable | ReceptionReadRepo, SupplyAuthRepo | api, auth | reception/DeliveryFormat.jsx | 200×22, 401×1, 422×2 |
| GET | `/api/v1/contractors` | ContractorController::index | ContractorReadRepo, SupplyAuthRepo | api, auth | Contractors.jsx | 200×17, 401×1, 422×4 |
| GET | `/api/v1/contractors/(:segment)/personnel` | ContractorController::personnel | ContractorReadRepo, SupplyAuthRepo | api, auth | Contractors.jsx | 200×4, 401×1, 404×2, 422×1 |
| GET | `/api/v1/contractor-management/validation-setup` | ContractorManagementController::validationSetup | ContractorManagementReadRepo, SupplyAuthRepo | api, auth | contractorMgmt/ValidationRegister.jsx | 200×31, 401×1, 422×1 |
| GET | `/api/v1/contractor-management/requisitions/(:segment)` | ContractorManagementController::requisition | ContractorManagementReadRepo, SupplyAuthRepo | api, auth | contractorMgmt/ValidationMatrix.jsx, contractorMgmt/ValidationRegister.jsx | 200×9, 401×1, 404×2, 422×1 |
| GET | `/api/v1/contractor-management/strategy-setup` | ContractorManagementController::strategySetup | ContractorManagementReadRepo, SupplyAuthRepo | api, auth | contractorMgmt/StrategyLots.jsx | 200×10, 401×1, 422×1 |
| GET | `/api/v1/contractor-management/strategy/(:segment)` | ContractorManagementController::strategyRequisition | ContractorManagementReadRepo, SupplyAuthRepo | api, auth | contractorMgmt/StrategyLots.jsx | 200×12, 401×1, 404×2 |
| GET | `/api/v1/contractor-management/validations` | ContractorManagementController::validations | ContractorManagementReadRepo, SupplyAuthRepo | api, auth | contractorMgmt/ValidationMatrix.jsx | 200×21, 401×1, 422×5 |
| GET | `/api/v1/contractor-management/rules` | ContractorManagementController::rules | ContractorManagementReadRepo, SupplyAuthRepo | api, auth | contractorMgmt/SmartRules.jsx | 200×9, 401×1, 422×1 |
| GET | `/api/v1/requisition-changes` | RequisitionChangeReadController::overview | RequisitionChangeReadRepo, SupplyAuthRepo | api, auth | recovery/ChangeControl.jsx | 200×31, 401×1, 422×6 |
| GET | `/api/v1/requisition-changes/candidates` | RequisitionChangeReadController::candidates | RequisitionChangeReadRepo, SupplyAuthRepo | api, auth | — | 200×1 |
| GET | `/api/v1/portal/preview/clients` | ClientPortalPreviewController::clients | ClientPortalReadRepo, QuoteReadRepo, SupplyAuthRepo | api, auth | ClientPortal.jsx | 200×4, 401×1, 422×1 |
| GET | `/api/v1/portal/preview/clients/(:segment)` | ClientPortalPreviewController::client | ClientPortalReadRepo, QuoteReadRepo, SupplyAuthRepo | api, auth | ClientPortal.jsx | 200×10, 404×2 |
| GET | `/api/v1/portal/preview/clients/(:segment)/requisitions/(:segment)` | ClientPortalPreviewController::requisition | ClientPortalReadRepo, QuoteReadRepo, SupplyAuthRepo | api, auth | ClientPortal.jsx | 200×3, 404×1 |
| GET | `/api/v1/portal/preview/clients/(:segment)/quotes/(:segment)` | ClientPortalPreviewController::quote | ClientPortalReadRepo, QuoteReadRepo, SupplyAuthRepo | api, auth | ClientPortal.jsx | 200×3, 404×4 |
| GET | `/api/v1/notifications` | NotificationController::index | NotificationReadRepo, SupplyAuthRepo | api, auth | notifications/NotificationBell.jsx | 200×95, 401×1, 422×4 |
| GET | `/api/v1/settings` | SettingsController::index | SettingsReadRepo, SupplyAuthRepo | api, auth | Configuration.jsx | 200×7, 401×1, 422×1 |
| GET | `/api/v1/settings/email-log` | SettingsController::emailLog | SettingsReadRepo, SupplyAuthRepo | api, auth | Configuration.jsx | 200×11, 401×1, 422×4 |
| GET | `/api/v1/settings/logo` | SettingsController::logo | SettingsReadRepo, SupplyAuthRepo | api, auth | Configuration.jsx | 200×3, 401×1, 404×1 |
| GET | `/api/v1/services/matrix` | ServiceController::matrix | ServiceReadRepo, SupplyAuthRepo | api, auth | services/ServiceDashboard.jsx, services/ServiceMatrix.jsx, services/ServiceReports.jsx | 200×69, 401×1, 422×8 |
| GET | `/api/v1/services/new-request` | ServiceController::newRequest | ServiceReadRepo, SupplyAuthRepo | api, auth | OperationalServices.jsx, services/NewServiceRequest.jsx, services/ServiceForm.jsx | 200×33, 401×1, 422×1 |
| GET | `/api/v1/services/new-request/reference` | ServiceController::newRequestReference | ServiceReadRepo, SupplyAuthRepo | api, auth | services/NewServiceRequest.jsx | 200×9, 401×1, 422×7 |
| GET | `/api/v1/services/new-request/availability` | ServiceController::newRequestAvailability | ServiceReadRepo, SupplyAuthRepo | api, auth | services/NewServiceRequest.jsx | 200×11, 401×1, 422×6 |
| GET | `/api/v1/services/new-request/contracting` | ServiceController::newRequestContracting | ServiceReadRepo, SupplyAuthRepo | api, auth | services/ServiceForm.jsx | 200×7, 401×1, 422×1 |
| GET | `/api/v1/services/(:segment)` | ServiceController::show | ServiceReadRepo, SupplyAuthRepo | api, auth | services/ServiceMatrix.jsx, services/ServiceReports.jsx | 200×3, 401×1, 404×2, 422×1 |
| GET | `/api/v1/quotes/rfq-contacts` | QuoteController::rfqContacts | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/RfqMatrixCard.jsx | 200×27, 401×1, 422×2 |
| GET | `/api/v1/quotes/customer-quote-setup` | QuoteController::customerQuoteSetup | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/CustomerQuoteCard.jsx | 200×11, 401×1, 422×2 |
| GET | `/api/v1/quotes/rfq-setup` | QuoteController::rfqSetup | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/CustomerQuoteCard.jsx, quotes/RfqRequestCard.jsx, quotes/SupplierQuoteCard.jsx | 200×27, 401×1, 422×2 |
| GET | `/api/v1/quotes/rfq-requisitions` | QuoteController::rfqRequisitions | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/CustomerQuoteCard.jsx, quotes/RfqRequestCard.jsx, quotes/SupplierQuoteCard.jsx | 200×15, 401×1, 422×5 |
| GET | `/api/v1/quotes/rfq-requisitions/(:segment)` | QuoteController::rfqRequisition | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/RfqRequestCard.jsx, quotes/SupplierQuoteCard.jsx | 200×11, 404×1, 422×1 |
| GET | `/api/v1/quotes/rfqs` | QuoteController::rfqs | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/RfqMatrixCard.jsx | 200×12, 401×1, 422×5 |
| GET | `/api/v1/quotes/rfqs/(:segment)` | QuoteController::rfq | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/RfqMatrixCard.jsx, quotes/SupplierQuoteCard.jsx | 200×7, 401×1, 404×2, 422×1 |
| GET | `/api/v1/quotes/supplier-quotes` | QuoteController::supplierQuotes | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/SupplierMatrixCard.jsx | 200×21, 401×1, 422×1 |
| GET | `/api/v1/quotes/supplier-quotes/(:segment)` | QuoteController::supplierQuote | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/SupplierMatrixCard.jsx | 200×2, 404×1 |
| GET | `/api/v1/quotes/comparison` | QuoteController::comparison | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/ComparisonCard.jsx, quotes/CustomerQuoteCard.jsx, quotes/DefinitiveAwardCard.jsx, quotes/SupplierMatrixCard.jsx | 200×42, 401×1, 422×2 |
| GET | `/api/v1/quotes/customer-quotes` | QuoteController::customerQuotes | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/ClientDecisionCard.jsx, quotes/ClientFormatCard.jsx, quotes/CustomerQuoteMatrixCard.jsx, quotes/DefinitiveAwardCard.jsx | 200×78, 401×1, 422×6 |
| GET | `/api/v1/quotes/customer-quotes/(:segment)` | QuoteController::customerQuote | QuoteReadRepo, SupplyAuthRepo | api, auth | purchaseOrders/PurchaseOrdersModule.jsx, quotes/ClientDecisionCard.jsx, quotes/ClientFormatCard.jsx, quotes/QuotesModule.jsx | 200×25, 404×1 |
| GET | `/api/v1/quotes/awards` | QuoteController::awards | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/DefinitiveAwardCard.jsx | 200×5, 401×1, 422×1 |
| GET | `/api/v1/quotes/revisions` | QuoteController::revisions | QuoteReadRepo, SupplyAuthRepo | api, auth | quotes/QuotesModule.jsx | 200×25, 401×1, 422×4 |
| GET | `/api/v1/purchase-orders` | PurchaseOrderController::index | PurchaseOrderReadRepo, SupplyAuthRepo | api, auth | purchaseOrders/PurchaseOrdersModule.jsx | 200×46, 401×1, 422×7 |
| GET | `/api/v1/purchase-orders/issuance` | PurchaseOrderController::issuance | PurchaseOrderReadRepo, SupplyAuthRepo | api, auth | purchaseOrders/PurchaseOrdersModule.jsx | 200×9, 401×1, 422×1 |
| GET | `/api/v1/purchase-orders/tasks` | PurchaseOrderController::tasks | PurchaseOrderReadRepo, SupplyAuthRepo | api, auth | purchaseOrders/PurchaseOrdersModule.jsx | 200×6, 401×1, 422×1 |
| GET | `/api/v1/purchase-orders/(:segment)` | PurchaseOrderController::show | PurchaseOrderReadRepo, SupplyAuthRepo | api, auth | purchaseOrders/PurchaseOrdersModule.jsx | 200×14, 404×1 |
| GET | `/api/v1/matrix/requisitions` | MatrixController::requisitions | MatrixReadRepo, SupplyAuthRepo | api, auth | generalMatrix/useMatrixData.js | 200×58 |
| GET | `/api/v1/matrix/requisitions/(:segment)` | MatrixController::detail | MatrixReadRepo, SupplyAuthRepo | api, auth | GeneralMatrix.jsx | 200×7 |
| GET | `/api/v1/matrix/clients` | MatrixController::clients | MatrixReadRepo, SupplyAuthRepo | api, auth | Dashboard.jsx, clients/ClientsCatalog.jsx, generalMatrix/useMatrixData.js | 200×111 |
| GET | `/api/v1/analytics/overview` | AnalyticsController::overview | AnalyticsReadRepo, SupplyAuthRepo | api, auth | Dashboard.jsx | 200×81, 401×1, 422×4 |
| GET | `/api/v1/analytics/process-flow` | ProcessFlowController::index | AnalyticsReadRepo, ProcessFlowReadRepo, ReceptionReadRepo, SupplyAuthRepo | api, auth | ProcessFlow.jsx | 200×10, 401×1, 422×3 |
| GET | `/api/v1/analytics/requisitions` | AnalyticsController::requisitions | AnalyticsReadRepo, SupplyAuthRepo | api, auth | Dashboard.jsx | 200×75 |
| GET | `/api/v1/analytics/requisitions.csv` | AnalyticsController::csv | AnalyticsReadRepo, SupplyAuthRepo | api, auth | — | 200×1 |
| GET | `/api/v1/requisitions/drafts` | RequisitionWriteController::drafts | RequisitionWriteRepo, SupplyAuthRepo | auth, reqwrite | — | 200×2 |
| GET | `/api/v1/requisitions/drafts/(:segment)` | RequisitionWriteController::detail | RequisitionWriteRepo, SupplyAuthRepo | auth, reqwrite | — | 200×8, 404×1 |
| POST | `/api/v1/requisitions/drafts` | RequisitionWriteController::create | RequisitionWriteRepo, SupplyAuthRepo | auth, reqwrite | — | 201×4 |
| PUT | `/api/v1/requisitions/drafts/(:segment)` | RequisitionWriteController::update | RequisitionWriteRepo, SupplyAuthRepo | auth, reqwrite | recovery/RequisitionRecovery.jsx | 200×4 |
| GET | `/api/v1/recovery/catalogs` | RequisitionRecoveryController::catalogs | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeRequestModal.jsx, recovery/RequisitionRecovery.jsx, services/NewServiceRequest.jsx | 200×116, 401×1 |
| GET | `/api/v1/recovery/matrix` | RequisitionRecoveryController::matrix | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | Dashboard.jsx, generalMatrix/useMatrixData.js, recovery/RequisitionRecovery.jsx | 200×295, 401×1, 403×1 |
| GET | `/api/v1/recovery/folio` | RequisitionRecoveryController::folio | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | recovery/RequisitionRecovery.jsx, services/NewServiceRequest.jsx | 200×16 |
| GET | `/api/v1/recovery/requisitions/(:segment)/regularization/document` | RequisitionRecoveryController::regularizationDocument | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | — | 200×11, 401×1, 404×2 |
| GET | `/api/v1/recovery/requisitions/(:segment)/regularization` | RequisitionRecoveryController::regularization | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | recovery/Regularization.jsx | 200×62, 401×7, 404×1 |
| POST | `/api/v1/recovery/requisitions/(:segment)/regularization` | RequisitionRecoveryController::regularize | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | recovery/Regularization.jsx | 200×43, 403×1, 409×3, 412×11, 415×1, 422×4, 428×1 |
| GET | `/api/v1/recovery/requisitions/(:segment)/document` | RequisitionRecoveryController::document | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | (ventana nueva) | 200×15 |
| GET | `/api/v1/recovery/requisitions/(:segment)` | RequisitionRecoveryController::detail | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeRequestModal.jsx, recovery/RequisitionRecovery.jsx | 200×54, 404×1 |
| POST | `/api/v1/recovery/requisitions` | RequisitionRecoveryController::create | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | recovery/RequisitionRecovery.jsx | 201×54, 409×1 |
| PUT | `/api/v1/recovery/requisitions/(:segment)` | RequisitionRecoveryController::update | RequisitionRecoveryRepo, SupplyAuthRepo | auth, recovery | recovery/RequisitionRecovery.jsx | 200×7 |
| GET | `/api/v1/recovery/changes/review-queue` | RequisitionChangeController::reviewQueue | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | Dashboard.jsx | 200×61 |
| GET | `/api/v1/recovery/changes/(:segment)/review` | RequisitionChangeController::reviewDetail | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeControl.jsx | 200×2 |
| GET | `/api/v1/recovery/changes/(:segment)/impact` | RequisitionChangeController::impact | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeControl.jsx | 200×2 |
| GET | `/api/v1/recovery/changes/(:segment)/commercial-reconciliation` | RequisitionChangeController::commercialReconciliation | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeControl.jsx | 200×2 |
| POST | `/api/v1/recovery/changes/(:segment)/commercial-reconciliation` | RequisitionChangeController::recordCommercialReconciliation | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | — | — |
| GET | `/api/v1/recovery/changes/(:segment)/commercial-executions` | RequisitionChangeController::commercialExecutions | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeControl.jsx | 200×2 |
| POST | `/api/v1/recovery/changes/(:segment)/commercial-executions` | RequisitionChangeController::recordCommercialExecution | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | — | — |
| POST | `/api/v1/recovery/changes/(:segment)/commercial-executions/(:segment)/review` | RequisitionChangeController::reviewCommercialExecution | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | — | — |
| POST | `/api/v1/recovery/changes/(:segment)/decision` | RequisitionChangeController::decide | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeControl.jsx | 200×2 |
| POST | `/api/v1/recovery/changes/(:segment)/withdraw` | RequisitionChangeController::withdraw | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeControl.jsx | 200×2 |
| GET | `/api/v1/recovery/changes` | RequisitionChangeController::index | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | Dashboard.jsx | 200×65 |
| GET | `/api/v1/recovery/changes/(:segment)` | RequisitionChangeController::detail | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeControl.jsx | 200×4 |
| POST | `/api/v1/recovery/requisitions/(:segment)/changes` | RequisitionChangeController::create | RequisitionChangeDecisionRepo, RequisitionChangeRepo, RequisitionCommercialAssessmentRepo, RequisitionCommercialExecutionRepo, SupplyAuthRepo | auth, recovery | recovery/ChangeRequestModal.jsx | 200×1, 201×3, 409×1, 412×1 |

## Clases PHP

Cuenta SQL: la que abre la propia clase (o su clase base). «Permisos»: lo que lee y escribe frente al contrato de su cuenta.

| Clase | Tipo | Cuenta SQL | Escribe en | Permisos | Usada por rutas |
|---|---|---|---|---|---|
| AnalyticsController | controlador | — | — | — | 3 |
| AuthController | controlador | — | — | — | 4 |
| BaseController | controlador (base) | — | — | — | 117 |
| CatalogDirectoryController | controlador | — | — | — | 6 |
| CatalogWriteController | controlador (base) | — | — | — | 11 |
| CategoryCatalogController | controlador | — | — | — | 1 |
| CategoryWriteController | controlador | — | — | — | 3 |
| ClientPortalPreviewController | controlador | — | — | — | 4 |
| ClientWriteController | controlador | — | — | — | 3 |
| ContractorController | controlador | — | — | — | 2 |
| ContractorManagementController | controlador | — | — | — | 6 |
| InvoiceController | controlador | — | — | — | 5 |
| MatrixController | controlador | — | — | — | 3 |
| NotificationController | controlador | — | — | — | 1 |
| OfferingWriteController | controlador | — | — | — | 2 |
| ProcessFlowController | controlador | — | — | — | 1 |
| PurchaseOrderController | controlador | — | — | — | 4 |
| QuoteController | controlador | — | — | — | 14 |
| ReadOnlyModuleController | controlador (base) | — | — | — | 57 |
| ReceptionController | controlador | — | — | — | 7 |
| RequisitionChangeController | controlador | — | — | — | 13 |
| RequisitionChangeReadController | controlador | — | — | — | 2 |
| RequisitionHistoryController | controlador | — | — | — | 1 |
| RequisitionRecoveryController | controlador | — | — | — | 10 |
| RequisitionWriteController | controlador | — | — | — | 4 |
| ServiceController | controlador | — | — | — | 6 |
| SettingsController | controlador | — | — | — | 3 |
| StatusController | controlador | api | — | — | 2 |
| SupplierWriteController | controlador | — | — | — | 3 |
| UserDirectoryController | controlador | — | — | — | 4 |
| AnalyticsReadRepository | librería | api | — | — | 4 |
| CatalogConflict | librería | — | — | — | 14 |
| CatalogReadRepository | librería | api | — | — | 17 |
| CatalogStale | librería | — | — | — | 11 |
| CatalogWriteBase | librería (base) | catalogwrite | audit_events (INSERT), entity_files (INSERT), entity_files (UPDATE), files (INSERT), idempotency_keys (INSERT), idempotency_keys (UPDATE), party_contact_channels (DELETE), party_contact_channels (INSERT), party_contact_channels (UPDATE), party_contacts (INSERT), party_contacts (UPDATE) | OK | 14 |
| CatalogWriteUnavailable | librería | — | — | — | 14 |
| CategoryInput | librería | — | — | — | 3 |
| CategoryReadRepository | librería | api | — | — | 4 |
| CategoryWriteRepository | librería | catalogwrite | audit_events (INSERT), categories (DELETE), categories (INSERT), categories (UPDATE) | OK | 3 |
| ClientInput | librería | — | — | — | 14 |
| ClientPortalReadRepository | librería | api | — | — | 4 |
| ClientWriteRepository | librería | catalogwrite | business_entities (INSERT), business_entities (UPDATE), clients (INSERT), clients (UPDATE) | OK | 3 |
| ContractorManagementReadRepository | librería | api | — | — | 10 |
| ContractorReadRepository | librería | api | — | — | 2 |
| InvoiceReadRepository | librería | api | — | — | 5 |
| MatrixReadRepository | librería | api | — | — | 3 |
| NotificationReadRepository | librería | api | — | — | 1 |
| OfferingInput | librería | — | — | — | 2 |
| OfferingWriteRepository | librería | catalogwrite | supplier_offerings (INSERT), supplier_offerings (UPDATE) | OK | 2 |
| ProcessFlowReadRepository | librería | api | — | — | 1 |
| PurchaseOrderReadRepository | librería | api | — | — | 4 |
| QuoteReadRepository | librería | api | — | — | 23 |
| ReceptionReadRepository | librería | api | — | — | 13 |
| RequisitionChangeApplication | librería | — | — | — | 13 |
| RequisitionChangeConflict | librería | — | — | — | 13 |
| RequisitionChangeDecisionInput | librería | — | — | — | 13 |
| RequisitionChangeDecisionRepository | librería | recovery | audit_events (INSERT), business_entities (UPDATE), idempotency_keys (INSERT), idempotency_keys (UPDATE), requisition_change_items (UPDATE), requisition_change_requests (UPDATE), requisition_items (INSERT), requisition_items (UPDATE), requisition_revision_snapshots (INSERT), requisitions (UPDATE) | OK | 13 |
| RequisitionChangeInput | librería | — | — | — | 13 |
| RequisitionChangeReadRepository | librería | api | — | — | 2 |
| RequisitionChangeRepository | librería | recovery | audit_events (INSERT), business_entities (INSERT), business_entities (UPDATE), idempotency_keys (INSERT), idempotency_keys (UPDATE), requisition_change_items (INSERT), requisition_change_requests (INSERT), requisition_change_requests (UPDATE) | OK | 13 |
| RequisitionChangeStale | librería | — | — | — | 13 |
| RequisitionCommercialAssessmentInput | librería | — | — | — | 13 |
| RequisitionCommercialAssessmentRepository | librería | recovery | audit_events (INSERT), idempotency_keys (INSERT), idempotency_keys (UPDATE), requisition_change_commercial_assessments (INSERT) | OK | 13 |
| RequisitionCommercialExecutionInput | librería | — | — | — | 13 |
| RequisitionCommercialExecutionRepository | librería | recovery | audit_events (INSERT), idempotency_keys (INSERT), idempotency_keys (UPDATE), requisition_change_commercial_execution_reviews (INSERT), requisition_change_commercial_executions (INSERT) | OK | 13 |
| RequisitionCommercialInventory | librería | — | — | — | 13 |
| RequisitionHistoryReadRepository | librería | api | — | — | 1 |
| RequisitionInput | librería | — | — | — | 4 |
| RequisitionRecoveryInput | librería | — | — | — | 37 |
| RequisitionRecoveryRepository | librería | recovery | audit_events (INSERT), business_entities (INSERT), business_entities (UPDATE), entity_files (INSERT), entity_files (UPDATE), files (INSERT), idempotency_keys (INSERT), idempotency_keys (UPDATE), requisition_items (DELETE), requisition_items (INSERT), requisition_items (UPDATE), requisition_revision_snapshots (INSERT), requisitions (INSERT), requisitions (UPDATE) | OK | 18 |
| RequisitionRegularizationInput | librería | — | — | — | 18 |
| RequisitionWriteRepository | librería | reqwrite | audit_events (INSERT), business_entities (INSERT), business_entities (UPDATE), document_sequences (INSERT), document_sequences (UPDATE), idempotency_keys (INSERT), idempotency_keys (UPDATE), requisition_items (DELETE), requisition_items (INSERT), requisition_items (UPDATE), requisition_revision_snapshots (INSERT), requisitions (INSERT), requisitions (UPDATE), workflow_events (INSERT) | OK | 4 |
| ServiceReadRepository | librería | api | — | — | 6 |
| SettingsReadRepository | librería | api | — | — | 3 |
| SupplierInput | librería | — | — | — | 3 |
| SupplierOfferingReadRepository | librería | api | — | — | 6 |
| SupplierWriteRepository | librería | catalogwrite | business_entities (INSERT), business_entities (UPDATE), suppliers (INSERT), suppliers (UPDATE) | OK | 3 |
| SupplyAuthRepository | librería | auth | audit_events (INSERT), auth_sessions (INSERT), auth_sessions (UPDATE) | OK | 115 |
| UserActivityReadRepository | librería | api | — | — | 4 |

## Componentes de la interfaz y su conexión

Conexión (estática): **directa** = importa un cliente HTTP (`fetch`); **contenedor** = sus tarjetas o vistas hijas se conectan; **por props** = recibe los datos ya consultados por el componente que lo usa; **alias** = solo reexporta otro componente. Rutas en vivo: rutas distintas que el componente originó en la corrida (pila de llamadas del navegador).

| Componente (`src/…`) | Conexión | Rutas en vivo |
|---|---|---|
| `App.jsx` | directa | 3: GET auth/csrf, GET auth/me, POST auth/logout |
| `main.jsx` | punto de entrada | 0 |
| `views/CatalogReadOnly.jsx` | contenedor (ClientsCatalog.jsx, SuppliersCatalog.jsx) | 0 |
| `views/ClientPortal.jsx` | directa | 4: GET portal/preview/clients, GET portal/preview/clients/(:segment), GET portal/preview/clients/(:segment)/quotes/(:segment), GET portal/preview/clients/(:segment)/requisitions/(:segment) |
| `views/Configuration.jsx` | directa | 3: GET settings, GET settings/email-log, GET settings/logo |
| `views/ContractorManagement.jsx` | contenedor (SmartRules.jsx, StrategyLots.jsx, ValidationMatrix.jsx, ValidationRegister.jsx) | 0 |
| `views/Contractors.jsx` | directa | 2: GET contractors, GET contractors/(:segment)/personnel |
| `views/CustomerPortal.jsx` | contenedor (ClientPortal.jsx) | 0 |
| `views/Dashboard.jsx` | directa | 8: GET analytics/overview, GET analytics/requisitions, GET catalogs/clients, GET catalogs/suppliers, GET matrix/clients … |
| `views/GeneralMatrix.jsx` | directa | 4: GET matrix/clients, GET matrix/requisitions, GET matrix/requisitions/(:segment), GET recovery/matrix |
| `views/Login.jsx` | directa | 2: GET auth/csrf, POST auth/login |
| `views/OperationalServices.jsx` | directa | 1: GET services/new-request |
| `views/ProcessFlow.jsx` | directa | 1: GET analytics/process-flow |
| `views/Reports.jsx` | directa | 3: GET matrix/clients, GET matrix/requisitions, GET recovery/matrix |
| `views/RequisitionTransactional.jsx` | alias de `views/recovery/RequisitionRecovery.jsx` | 0 |
| `views/UsersRoles.jsx` | directa | 5: GET audit-events, GET auth/me, GET roles, GET users, GET users/functions |
| `views/catalog/shared.jsx` | directa | 2: GET catalogs/clients/(:segment), GET catalogs/suppliers/(:segment) |
| `views/clients/ClientsCatalog.jsx` | directa | 12: GET auth/csrf, GET catalogs/clients, GET catalogs/clients/(:segment), GET catalogs/clients/(:segment)/logo, GET catalogs/suppliers/(:segment)/logo … |
| `views/contractorMgmt/SmartRules.jsx` | directa | 1: GET contractor-management/rules |
| `views/contractorMgmt/StrategyLots.jsx` | directa | 2: GET contractor-management/strategy-setup, GET contractor-management/strategy/(:segment) |
| `views/contractorMgmt/ValidationMatrix.jsx` | directa | 2: GET contractor-management/requisitions/(:segment), GET contractor-management/validations |
| `views/contractorMgmt/ValidationRegister.jsx` | directa | 2: GET contractor-management/requisitions/(:segment), GET contractor-management/validation-setup |
| `views/invoices/InvoiceModule.jsx` | directa | 5: GET invoices, GET invoices/(:segment), GET invoices/control, GET invoices/requisitions, GET invoices/requisitions/(:segment) |
| `views/notifications/NotificationBell.jsx` | directa | 1: GET notifications |
| `views/purchaseOrders/PurchaseOrdersModule.jsx` | directa | 7: GET auth/me, GET purchase-orders, GET purchase-orders/(:segment), GET purchase-orders/issuance, GET purchase-orders/tasks … |
| `views/purchaseOrders/SignaturePad.jsx` | por props (desde DeliveryFormat.jsx, PurchaseOrdersModule.jsx) | 0 |
| `views/quotes/ClientDecisionCard.jsx` | directa | 2: GET quotes/customer-quotes, GET quotes/customer-quotes/(:segment) |
| `views/quotes/ClientFormatCard.jsx` | directa | 2: GET quotes/customer-quotes, GET quotes/customer-quotes/(:segment) |
| `views/quotes/ComparisonCard.jsx` | directa | 1: GET quotes/comparison |
| `views/quotes/CustomerQuoteCard.jsx` | directa | 4: GET quotes/comparison, GET quotes/customer-quote-setup, GET quotes/rfq-requisitions, GET quotes/rfq-setup |
| `views/quotes/CustomerQuoteMatrixCard.jsx` | directa | 1: GET quotes/customer-quotes |
| `views/quotes/DefinitiveAwardCard.jsx` | directa | 3: GET quotes/awards, GET quotes/comparison, GET quotes/customer-quotes |
| `views/quotes/QuotesModule.jsx` | directa | 2: GET quotes/customer-quotes/(:segment), GET quotes/revisions |
| `views/quotes/RequisitionPickerModal.jsx` | por props (desde RfqRequestCard.jsx, SupplierQuoteCard.jsx) | 0 |
| `views/quotes/RfqMatrixCard.jsx` | directa | 3: GET quotes/rfq-contacts, GET quotes/rfqs, GET quotes/rfqs/(:segment) |
| `views/quotes/RfqRequestCard.jsx` | directa | 4: GET catalogs/suppliers/(:segment), GET quotes/rfq-requisitions, GET quotes/rfq-requisitions/(:segment), GET quotes/rfq-setup |
| `views/quotes/SupplierMatrixCard.jsx` | directa | 3: GET quotes/comparison, GET quotes/supplier-quotes, GET quotes/supplier-quotes/(:segment) |
| `views/quotes/SupplierQuoteCard.jsx` | directa | 4: GET quotes/rfq-requisitions, GET quotes/rfq-requisitions/(:segment), GET quotes/rfq-setup, GET quotes/rfqs/(:segment) |
| `views/reception/DeliveryFormat.jsx` | directa | 1: GET reception/deliverable |
| `views/reception/ReceptionModule.jsx` | directa | 6: GET reception/closure, GET reception/deliveries/(:segment), GET reception/matrix, GET reception/orders, GET reception/orders/(:segment) … |
| `views/recovery/CategoryCatalog.jsx` | directa | 5: DELETE catalogs/categories/(:segment), GET auth/csrf, GET catalogs/categories, POST catalogs/categories, PUT catalogs/categories/(:segment) |
| `views/recovery/ChangeControl.jsx` | directa | 9: GET auth/csrf, GET recovery/changes/(:segment), GET recovery/changes/(:segment)/commercial-executions, GET recovery/changes/(:segment)/commercial-reconciliation, GET recovery/changes/(:segment)/impact … |
| `views/recovery/ChangeRequestModal.jsx` | directa | 4: GET auth/csrf, GET recovery/catalogs, GET recovery/requisitions/(:segment), POST recovery/requisitions/(:segment)/changes |
| `views/recovery/HistoryRequisition.jsx` | directa | 1: GET requisition-history/catalog |
| `views/recovery/Regularization.jsx` | directa | 3: GET auth/csrf, GET recovery/requisitions/(:segment)/regularization, POST recovery/requisitions/(:segment)/regularization |
| `views/recovery/RequisitionRecovery.jsx` | directa | 8: GET auth/csrf, GET recovery/catalogs, GET recovery/folio, GET recovery/matrix, GET recovery/requisitions/(:segment) … |
| `views/services/NewServiceRequest.jsx` | directa | 5: GET recovery/catalogs, GET recovery/folio, GET services/new-request, GET services/new-request/availability, GET services/new-request/reference |
| `views/services/ServiceDashboard.jsx` | directa | 1: GET services/matrix |
| `views/services/ServiceForm.jsx` | directa | 2: GET services/new-request, GET services/new-request/contracting |
| `views/services/ServiceMatrix.jsx` | directa | 2: GET services/(:segment), GET services/matrix |
| `views/services/ServiceReports.jsx` | directa | 2: GET services/(:segment), GET services/matrix |
| `views/suppliers/SuppliersCatalog.jsx` | directa | 11: GET auth/csrf, GET catalogs/clients/(:segment)/logo, GET catalogs/suppliers, GET catalogs/suppliers/(:segment), GET catalogs/suppliers/(:segment)/logo … |
| `views/supplies/SupplierSupplyCatalog.jsx` | directa | 13: GET auth/csrf, GET catalogs/clients/(:segment)/logo, GET catalogs/supplier-offerings, GET catalogs/supplier-offerings/(:segment), GET catalogs/suppliers … |

## Hallazgos

- Sin rutas rotas, sin llamadas de la interfaz a rutas inexistentes y sin permisos SQL faltantes.
- Rutas sin ninguna petición en la corrida (3): `POST /api/v1/recovery/changes/(:segment)/commercial-reconciliation`, `POST /api/v1/recovery/changes/(:segment)/commercial-executions`, `POST /api/v1/recovery/changes/(:segment)/commercial-executions/(:segment)/review`.
- Rutas probadas solo por HTTP, sin pantalla que las llame (7): `GET /api/v1/health`, `GET /api/v1/requisition-changes/candidates`, `GET /api/v1/analytics/requisitions.csv`, `GET /api/v1/requisitions/drafts`, `GET /api/v1/requisitions/drafts/(:segment)`, `POST /api/v1/requisitions/drafts`, `GET /api/v1/recovery/requisitions/(:segment)/regularization/document`.
- Sondas de las pruebas HTTP a rutas que **no deben existir** (p. ej. POST/PUT/PATCH/DELETE en módulos de solo lectura): 208 peticiones, todas rechazadas (404×208).
