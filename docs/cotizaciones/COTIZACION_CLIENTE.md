# Cotizaciones › Cotización formal al cliente (13 nov 2026 · borrador interno 26 nov 2026)

Tarjeta 6 de **Cotizaciones y Comparativo** con el diseño de referencia ("Documento comercial externo"). Componente
`src/views/quotes/CustomerQuoteCard.jsx`; lógica pura `src/views/quotes/customerQuoteBuilder.mjs`; el formato del cliente
reutiliza `customerQuoteHtml` (ahora con comentarios y modo vista previa).

## Datos reales

| Origen | Uso |
| --- | --- |
| `GET /api/v1/quotes/rfq-setup` | compradores (validación del contratista) y usuarios Comprador / Master Admin para "Comprador" |
| `GET /api/v1/quotes/rfq-requisitions?buyer=&rfq=quoted` | requisiciones validadas del comprador **con cotizaciones de proveedor** |
| `GET /api/v1/quotes/comparison?requisition=` | cliente, RFC, proyecto, lugar de entrega, moneda, partidas vigentes con **adjudicación vigente** u ofertas, y la cotización al cliente vigente (`customer_quote`) para proponer la siguiente revisión |
| `GET /api/v1/quotes/customer-quote-setup` (nuevo) | último tipo de cambio registrado en una cotización (`usd_mxn_rate`, `eur_mxn_rate`, fecha, fuente) y políticas de aprobación vigentes (`approval_policy_versions`) |
| `GET /api/v1/quotes/customer-quotes/{id}/draft` (26 nov) | datos internos del **borrador de SupplyFlow** para seguir editándolo (versión, condiciones, tipos de cambio, % de descuento/IVA/Service Fee y, por partida, marca, cantidad, manipulación y margen). Solo borradores registrados en SupplyFlow; cualquier otra cotización → 404 |
| `POST /api/v1/quotes/customer-quotes` · `PUT /api/v1/quotes/customer-quotes/{id}` (26 nov) | **escritura**: alta y edición del borrador interno (ver abajo) |

## Cálculo

- **Costo del producto** por partida: precio unitario de la adjudicación vigente; si no hay, la mejor oferta registrada;
  si no hay oferta, "sin costo" (bloquea la validación). Se muestra el costo original y su moneda.
- **Conversión**: los costos se convierten a la moneda del cliente vía MXN con *1 USD = MXN* y *1 EUR = MXN*.
  "Actualizar tipo de cambio" carga el último registrado en MariaDB (con su folio de origen); si no hay, se captura a mano.
- **Precio venta unitario** = (costo convertido × cantidad + entrega/manipulación de la partida) × (1 + % margen) ÷
  cantidad, redondeado a centavos; **subtotal cliente** = unitario × cantidad.
- **Subtotal de pago de terceros** = suma de subtotales; **descuento %** sobre ese subtotal; **IVA %** sobre el subtotal
  con descuento.
- **Service Fee** (opcional): % sobre el subtotal de terceros con descuento (antes de IVA); se le aplica el mismo IVA.
- **Total general** = terceros con IVA + Service Fee con IVA.
- **Nivel de aprobación**: precio unitario máximo y subtotal evaluado (antes de IVA, o total si la política usa
  `total_basis = total`) convertidos a la moneda de la política y comparados con `unit_price_limit` y `document_limit`
  (`>` o `>=`). Dentro de ambos → **Nivel 1 · Solo Comprador**; si se excede alguno → **Requiere autorización interna
  adicional** (indica cuál). Sin política vigente lo dice. *Los nombres de niveles superiores deben confirmarse con el
  Apps Script.*

## Botones

- **💾 Guardar cotización al cliente**: valida todo (comprador, requisición, revisión, fechas, moneda, comprador que
  elabora, tipos de cambio necesarios, costo y % margen de cada partida, porcentajes) y la **registra en MariaDB como
  borrador interno** (ver la sección siguiente). Si la requisición ya tiene su borrador de SupplyFlow, lo **actualiza**.
- **🧹 Limpiar**: en una captura nueva deja la cotización como nueva; con un borrador abierto vuelve a lo guardado en MariaDB.
- **👁️ Vista previa**: formato del cliente marcado *VISTA PREVIA · NO REGISTRADA*, en `iframe` aislado, con impresión;
  muestra descripción, marca/modelo, cantidad, precio unitario de venta, importes, impuestos, Service Fee, total,
  vigencia, condiciones y comentarios (o los predeterminados). **Nunca** costos, entrega/manipulación ni margen.
- **📋 Ver matriz**: tarjeta 8.

Las cotizaciones al cliente **registradas** se consultan en la tarjeta 7 *Formato para el cliente* (la tarjeta 1
"ABRIR REV. VIGENTE" abre ahí la versión vigente).

## Guardado como borrador interno (26 nov 2026)

Autorizado por el usuario: «Habilita el guardado de la tarjeta 6 como borrador interno». Se guarda **solo** el borrador;
enviar a revisión, autorizar, emitir/enviar al cliente y registrar su decisión **siguen bloqueados**.

**Qué se registra** (cuenta `supplyflow_quotewrite_local`; CSRF, `Idempotency-Key`, `GET_LOCK`, transacción, bitácora):

- `customer_quotes` + `customer_quote_versions` (Rev. 0, `version_number` 1) + `customer_quote_items` (una por partida
  vigente). Folio **COT-AAAA-NNNN** con serie propia sobre `customer_quote_versions` (ignora sufijos `-N`); coincide en
  formato con los folios de cotizaciones de proveedor, como en los datos originales. Serie `sf:<folio>`.
- Estatus fijos: `document_status=draft`, `internal_approval_status=not_requested`, `client_decision_status=not_recorded`,
  `legacy_status=Borrador`, `financial_breakdown_provenance=calculated`, `calculation_version=sf-cq-v1`. El selector de
  estatus de la tarjeta queda fijo en *Borrador*.
- **El navegador no envía precios ni totales**: solo cantidad, manipulación, % margen, marca/modelo y el origen del costo
  (`source` award|offer + `quote_id`) de cada partida. El servidor toma el costo de la **adjudicación vigente** o de la
  **oferta registrada** elegida, convierte con los tipos de cambio y recalcula precio unitario, subtotales, descuento,
  IVA, Service Fee y total con la misma fórmula y redondeo de la tarjeta (`CustomerQuoteInput::r2`).
- La evaluación de aprobación (política vigente) se guarda como **instantánea informativa**; no solicita ni concede
  aprobación.
- `workflow_events` (`cq.draft_saved` / `cq.draft_updated`) y `audit_events` (`customer_quote.draft_create` /
  `customer_quote.draft_update`, módulo `quotes`).

**Reglas**

- **Un borrador por requisición.** Si la requisición ya tiene una cotización al cliente que **no** es un borrador de
  SupplyFlow (importada, enviada, aprobada…), la tarjeta muestra el bloqueo y deshabilita Guardar; el servidor responde
  `409 CUSTOMER_QUOTE_EXISTS`. Una nueva revisión se origina con **«Solicitar modificación»** (R3A, tarjetas 1 u 8).
- **Cotizaciones importadas, también las que siguen en «Borrador»** (decisión del usuario, 27 nov 2026): **no** se
  continúan en la tarjeta 6; pasan por «Solicitar modificación». Como R3A solo aplica a requisiciones capturadas en
  SupplyFlow (las importadas responden «Expediente histórico importado: permanece en consulta»), en la práctica se
  conservan como expediente de consulta. Para continuar ese proceso se captura la requisición en **«Registro de
  requisición»** y se sigue el flujo (validación, RFQ, cotizaciones) hasta esta tarjeta. «Crear desde historial» no
  sirve aquí: solo toma cotizaciones **aprobadas**. La tarjeta y el servidor muestran este mensaje específico cuando
  la cotización existente es importada.
- Si ya tiene su borrador de SupplyFlow, la tarjeta lo **abre en modo edición** (banner *Editando el borrador … versión N*)
  y `PUT` lo actualiza con `If-Match` = versión; un alta duplicada responde `409 DRAFT_EXISTS`.
- Edición: solo borradores de SupplyFlow sin enviar (`IMPORTED_READ_ONLY`, `NOT_A_DRAFT` en otro caso). Sin `If-Match`
  → `428`; versión vieja → `412` (la tarjeta avisa y **recarga la versión vigente**; no se pierde el expediente).
- Validación del servidor por campo (`422 INVALID_CUSTOMER_QUOTE` con `field`, incluido `line:<id>` que la tarjeta marca
  en la partida); `PREPARER_UNAVAILABLE`, `EXCHANGE_RATE_REQUIRED` (campo del tipo de cambio), `LINES_CHANGED` y
  `COST_SOURCE_CHANGED` (la adjudicación/oferta cambió: volver a seleccionar la requisición).
- Fallo de red o 5xx: la tarjeta dice «No se confirmó el guardado» y el reintento reutiliza la **misma**
  `Idempotency-Key` (no duplica).
- La cuenta solo tiene `UPDATE` por columna sobre datos e importes del borrador: **nunca** sobre estatus, emisión,
  bloqueo, aprobación, folio ni versión (ver `tests/quotewrite_contract_check.py`).

**Tarjeta 8**: el borrador aparece en la matriz con estatus *Borrador*, su nivel de aprobación informativo y la decisión
del cliente *Sin registrar*. Las acciones de enviar, validar, autorizar o eliminar siguen bloqueadas.

**Activación en la PC**: la misma cuenta `quotewrite`, ahora con **35 permisos de tabla + 76 de columna = 111**. Quien ya
la había aprovisionado debe ejecutar `provision` de nuevo (agrega solo lo que falta) — pasos en
`docs/cotizaciones/REGISTRO_COTIZACION_PROVEEDOR.md` → «Activación en la PC».

## Datos de prueba del sandbox

Solo en la base desechable se agregaron una política sintética (`customer_quote`, MXN, 15,000 / 35,000.02, `>`) y un
tipo de cambio sintético en `CQ-QA-0001-R1` para ejercitar el nivel de aprobación y la conversión.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/customer_quote_builder.test.mjs` | 12/12 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura; el POST del borrador se corta y no se da por guardado) | 237/237 |
| `tests/customer_quote_write_http_check.py` (escribe en la base sintética) | 35/35 |
| `tests/frontend/customer_quote_write_ui_e2e.cjs` (escribe en la base sintética) | 26/26 |
| `tests/quotewrite_contract_check.py` | 11/11 |
| `tests/quotes_http_check.py` | 91/91 |
