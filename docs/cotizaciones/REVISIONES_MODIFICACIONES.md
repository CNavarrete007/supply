# Cotizaciones › Revisiones / modificaciones (12 nov 2026)

Tarjeta 1 de **Cotizaciones y Comparativo** según el diseño original (`src/views/Quotes.jsx`, tarjeta 1) conectada a
MariaDB. Principio del diseño: *una cotización aprobada no se borra; el cambio se origina desde la requisición y genera una
nueva revisión conservando la anterior* (Rev. 0 → Rev. 1 → Rev. N).

## Qué muestra (solo lectura)

`GET /api/v1/quotes/revisions` (Master Admin, cuenta API de solo `SELECT`; `QuoteController::revisions` →
`QuoteReadRepository::revisionFamilies`). Parámetros: `q`, `status` (`all` | `pending` | `approved` | `closed`), `page`,
`page_size` (1–50). Cualquier otro parámetro → 422.

| Elemento | Origen en MariaDB |
| --- | --- |
| Familia | `customer_quotes` (una serie de cotización al cliente) |
| Rev. vigente | versión con mayor `version_number`; etiqueta `Rev. N` = `legacy_revision_number` o `version_number − 1` |
| Rev. 0 | versión con menor `version_number` (su total y moneda) |
| Estatus | `legacy_status` original del Apps Script si existe; si no, derivado de `document_status` / `internal_approval_status` / `client_decision_status` (Sustituida, Aprobada, Rechazada, Cambios solicitados, Autorizada internamente, Borrador, Enviada al cliente) |
| Grupo del filtro | `closed` = sustituida/cancelada/rechazada; `approved` = decisión del cliente aprobada; `pending` = el resto |
| Change Request ligado | `customer_quote_versions.change_request_id` de la familia o, si no, la solicitud cuyo `resulting_customer_quote_version_id` pertenece a la familia |
| KPI | familias, familias con más de una revisión, familias con alguna versión aprobada (vigente o histórica), familias ligadas a un Change Request |

Botones de cada familia:

- **VER PDF**: vista de cliente de la revisión vigente (`GET /api/v1/quotes/customer-quotes/{id}`) en un `iframe` aislado
  (`sandbox=""`) con **Imprimir PDF**. No incluye costos internos.
- **ABRIR REV. VIGENTE**: abre la tarjeta 6 *Cotización al cliente* con esa versión seleccionada.
- **SOLICITAR MODIFICACIÓN**: ver abajo.

## Solicitar modificación = solicitud R3A real

Abre **Modificación controlada de requisición** (`src/views/recovery/ChangeRequestModal.jsx`, lógica pura en
`src/views/recovery/changeForm.mjs`; reutilizable para *Requisiciones › Control de cambios*, INT03-D2):

1. Datos del cambio: folio (lo asigna el servidor, `CR-AAAA-####`), Rev. actual → nueva, fecha, solicitado por, origen,
   tipo principal, referencia/documento, motivo, fecha requerida y lugar de entrega revisados.
2. Partidas antes y después: Mantener / Modificar / Cancelar por partida y *+ Agregar nueva partida* (descripción,
   cantidad, unidad, categoría activa del catálogo).

Contrato usado (sin cambios en el backend R3A ya validado en INT02-HF2):
`GET /api/v1/recovery/requisitions/{id}`, `GET /api/v1/recovery/catalogs` y
`POST /api/v1/recovery/requisitions/{id}/changes` con `X-SF-CSRF`, `If-Match: "<versión de la requisición>"` e
`Idempotency-Key` (UUID). Solo se envían diferencias reales; las listas de origen y tipo son idénticas a
`RequisitionChangeInput`. Ante una respuesta incierta (red/5xx/CSRF/ocupado) el formulario se bloquea y **Reintentar
registro** repite exactamente la misma clave y contenido (el servidor responde la réplica, nunca duplica); 412 recarga la
requisición vigente sin sobrescribir nada.

Efecto: se crea **una** solicitud `pending_review` con su detalle antes/después y auditoría
`requisition.r3.change.request`. **No** cambia la requisición, **no** genera la nueva revisión de la cotización al cliente
y **no** toca RFQ/OC: aplicarla requiere revisión independiente de otro Master Admin (R3B) y la emisión de la Rev. N de la
cotización sigue bloqueada junto con las demás escrituras comerciales.

Cuándo está disponible (la API lo informa en `can_request_change` / `change_block`; el servidor R3A es la única autoridad):

| `change_block` | Motivo mostrado |
| --- | --- |
| `imported` | Expediente histórico importado: permanece en consulta. |
| `not_rf1` | La requisición no se capturó con el flujo RF1 de SupplyFlow. |
| `not_owner` | Solo quien capturó la requisición RF1 puede solicitarla (otro Master Admin la revisa). |
| `pending_change` | Ya existe una solicitud pendiente de revisión independiente. |

En la base real las cotizaciones al cliente provienen de la importación del Apps Script, por lo que sus requisiciones
son históricas y el botón mostrará el motivo `imported`: **no** se habilitó la modificación de expedientes históricos.

## Pruebas (sandbox sintético, 12 nov 2026)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/change_form.test.mjs tests/frontend/quotes_model.test.mjs` | 16/16 |
| `tests/frontend/quotes_ui_e2e.cjs` (solo lectura; aborta toda escritura) | 68/68 |
| `tests/frontend/quotes_revisions_write_ui_e2e.cjs` (`SF_SYNTHETIC_WRITES=1`) | 25/25 |
| `tests/quotes_http_check.py` (con `SF_NONADMIN_USER` y `SF_ADMIN2_USER`) | 41/41 |

La prueba de escritura usa únicamente la familia sintética `CQ-QA-*` sobre una requisición RF1 sintética (`QA*`,
*Cliente Sintético*): valida obligatorios, 412 con versión vieja (sin registro), respuesta perdida + reintento con la
misma `Idempotency-Key` (200 `replayed`, una sola solicitud), que la requisición y la cotización no cambian, bloqueo por
solicitud pendiente, bloqueo de otro Master Admin (UI y 409 `READ_ONLY_RECORD` del servidor) y al final **retira** la
solicitud (`withdrawn`, auditada) para poder repetirse. Si no existe esa familia sintética termina en `BLOCKED` sin
escribir nada.
