# Requisición · Crear desde historial — alta real en MariaDB (25 nov 2026)

## Qué cambió

**💾 Crear requisición nueva** (tarjeta 5) ya no solo valida: crea una **requisición nueva** en MariaDB con su propio folio
(`<CLIENTE>-REQ-<AÑO>-<NNNN>`, el mismo generador de Registro) y guarda, por partida, de dónde viene y qué ruta comercial y
de abastecimiento se eligió. Al confirmarse:

- Aparece el mensaje «Requisición `<folio>` creada en MariaDB para «cliente»: N partida(s) (…)». El formulario se limpia.
- La requisición aparece en la **Matriz de requisiciones** con la marca **🕘 Desde historial** y la etapa «Requisición recibida».
- Sigue el flujo normal: Gestión del Contratista, RFQ, cotización al cliente nueva, OC nueva.

No copia una requisición completa y **no modifica** las requisiciones ni las cotizaciones de origen. Tampoco emite RFQ,
cotizaciones ni OC.

## Reglas (interpretación documentada)

No hay fuente del Apps Script para esta tarjeta. El archivo `requisitionApi.js` que se compartió es el cliente del borrador
v0.7 (`/api/v1/requisitions/drafts`), idéntico a `src/requisitionApi.js`, y no contiene reglas. Las reglas siguen el diseño
de la tarjeta y la política de recompra de cada cliente (`clients.repeat_*`). Si aparece el código original, se ajustan.

| Ruta | Valores | Condición |
|---|---|---|
| Precio al cliente | `fixed` (precio fijo), `requote` (nuevo precio), `validate` (validar) | `fixed` exige precio histórico > 0, vigente según `price_validity_days` y con moneda |
| Proveedor | `reuse` (reutilizar), `validate` (validar), `requote` (recotizar) | `validate` y `reuse` exigen proveedor adjudicado; `reuse` además costo > 0 y vigente |
| Partida nueva | siempre `requote` / `requote` | — |

- El historial son las **cotizaciones al cliente aprobadas**. No incluye versiones sustituidas.
- Los valores por defecto salen de la política del cliente. Las advertencias (moneda distinta, margen menor al mínimo,
  conflicto con la política) no bloquean.

## Servidor

`POST /api/v1/recovery/requisitions/from-history`, en `RequisitionRecoveryController::createFromHistory`:

- Lo valida `RequisitionHistoryInput` y lo escribe `RequisitionRecoveryRepository::createFromHistory`.
- Usa la cuenta **recovery** (contrato 77/52, sin permisos nuevos). El historial se lee con la cuenta API (solo SELECT).
- Solo Master Admin, con CSRF, JSON e `Idempotency-Key`. Responde 201, o 200 si es un reintento con la misma clave.
- Comparte el bloqueo, la transacción y la idempotencia de Registro (RF1).
- Los datos generales se validan con **exactamente** las reglas de Registro (`RequisitionRecoveryInput`).
- De cada partida del historial, el navegador solo envía la referencia (`article_key` y `quote_version_id`), la cantidad y la
  ruta. La descripción, marca/modelo, unidad, categoría, precio, costo y proveedor los toma el servidor del historial aprobado.

**Qué guarda**

En `requisitions`:
- `history_based = 1`
- `repeat_policy_snapshot`: la política evaluada y la fecha
- `history_created_at`
- origen `Historial del cliente (recompra)`, no provisional, regularización «No aplica · desde historial».

En `requisition_items`, por partida:
- `history_based`
- `history_origin`: `approved_customer_quote` o `new_line`
- `source_requisition_id` y `source_customer_quote_version_id`
- `repeat_client_price_mode` y `repeat_sourcing_mode`
- `fixed_client_price`, `fixed_client_unit_price` y `fixed_client_currency` (con el precio aprobado).

Además:
- Snapshot RF1 (revisión 0) con la procedencia de cada partida: cotización, versión, requisición, precio, costo, proveedor y
  vigencia.
- Bitácora `requisition.history.create`.
- `GET /recovery/requisitions/{id}` agrega `history`: la política y la ruta de cada partida.

**Errores**

| Código | Cuándo |
|---|---|
| 422 `INVALID_REQUISITION` | Datos generales o forma de la partida inválidos (mismas reglas que Registro) |
| 409 `HISTORY_CHANGED` | La cotización de referencia ya no es la vigente del historial. La tarjeta recarga el historial y actualiza las partidas |
| 409 `ROUTE_NOT_ALLOWED` | Ruta no permitida (p. ej. reutilizar proveedor sin proveedor histórico) |
| 409 `CATEGORY_UNKNOWN` | La categoría no está activa en el catálogo |
| 409 `CLIENT_UNAVAILABLE` | Cliente inexistente o inactivo |
| 409 `IDEMPOTENCY_CONFLICT` | La misma clave se usó con otro contenido |

Sin respuesta del servidor, la tarjeta no da la requisición por creada. «Crear requisición nueva» reintenta la misma
solicitud con la misma clave, sin duplicar.

## Efectos en otras pantallas

- **Registro de requisición (EDITAR)**:
  - Se pueden corregir los datos generales y las partidas.
  - El **cliente** y el **origen documental** se conservan: el selector queda bloqueado y el servidor responde
    `HISTORY_CLIENT_LOCKED` si se intenta cambiar el cliente.
  - Las partidas del historial mantienen su ruta.
- **Control de cambios**: es elegible para SOLICITAR MODIFICACIÓN (R3A).
- **Etapas**: una requisición creada desde historial en SupplyFlow sigue las 8 etapas normales en la Matriz, Flujo del
  Proceso y Portal del Cliente. Una importada con marca de historial sigue como «pendiente de equivalencia».
- **Gestión del Contratista › Estrategia**:
  - Solo las partidas con proveedor **reutilizado** inician en «Precio histórico (sin RFQ)».
  - Recotizar o validar el proveedor inician con RFQ.

## En tu PC

No hace falta aprovisionar nada. La cuenta recovery ya tiene los permisos y el código se monta desde la carpeta del proyecto:
basta con actualizar la rama y recargar con **Ctrl+F5**.

Es una **operación real**: crea una requisición con folio propio que hoy no se puede eliminar, porque la eliminación de
requisiciones no está migrada. Úsala con una necesidad real del cliente, o asume que la de prueba quedará en la Matriz.

## Pruebas

| Prueba | Tipo | Resultado (sandbox sintético) |
|---|---|---|
| `tests/requisition_history_write_http_check.py` | HTTP, **escribe** (`SF_SYNTHETIC_WRITES=1`); incluye Control de cambios (R3A → sin autoaprobación → R3B de otro Master Admin → Rev. 1) | 32/32 |
| `tests/frontend/history_write_ui_e2e.cjs` | Navegador, **escribe**: fallo de red, reintento con la misma clave, matriz y Registro | 10/10 |
| `tests/frontend/history_ui_e2e.cjs` | Navegador, solo lectura (el POST se aborta y no se da por creado) | 32/32 |
| `tests/history_http_check.py` | HTTP, solo lectura | 11/11 |
| `tests/frontend/history_requisition.test.mjs`, `tests/frontend/strategy_model.test.mjs` | Lógica pura | 9/9 · 9/9 |
