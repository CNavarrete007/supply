# Cotizaciones › Cotización formal al cliente (13 nov 2026)

Tarjeta 6 de **Cotizaciones y Comparativo** con el diseño de referencia ("Documento comercial externo"). Componente
`src/views/quotes/CustomerQuoteCard.jsx`; lógica pura `src/views/quotes/customerQuoteBuilder.mjs`; el formato del cliente
reutiliza `customerQuoteHtml` (ahora con comentarios y modo vista previa).

## Datos reales (solo lectura)

| Origen | Uso |
| --- | --- |
| `GET /api/v1/quotes/rfq-setup` | compradores (validación del contratista) y usuarios Comprador / Master Admin para "Comprador" |
| `GET /api/v1/quotes/rfq-requisitions?buyer=&rfq=quoted` | requisiciones validadas del comprador **con cotizaciones de proveedor** |
| `GET /api/v1/quotes/comparison?requisition=` | cliente, RFC, proyecto, lugar de entrega, moneda, partidas vigentes con **adjudicación vigente** u ofertas, y la cotización al cliente vigente (`customer_quote`) para proponer la siguiente revisión |
| `GET /api/v1/quotes/customer-quote-setup` (nuevo) | último tipo de cambio registrado en una cotización (`usd_mxn_rate`, `eur_mxn_rate`, fecha, fuente) y políticas de aprobación vigentes (`approval_policy_versions`) |

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
  elabora, tipos de cambio necesarios, costo y % margen de cada partida, porcentajes). Con datos completos responde
  "Cotización validada … No se guardó": registrar/emitir la cotización al cliente es una escritura comercial bloqueada.
- **🧹 Limpiar**: deja la cotización como nueva.
- **👁️ Vista previa**: formato del cliente marcado *VISTA PREVIA · NO REGISTRADA*, en `iframe` aislado, con impresión;
  muestra descripción, marca/modelo, cantidad, precio unitario de venta, importes, impuestos, Service Fee, total,
  vigencia, condiciones y comentarios (o los predeterminados). **Nunca** costos, entrega/manipulación ni margen.
- **📋 Ver matriz**: tarjeta 8.

Las cotizaciones al cliente **registradas** se consultan en la tarjeta 7 *Formato para el cliente* (la tarjeta 1
"ABRIR REV. VIGENTE" abre ahí la versión vigente).

## Datos de prueba del sandbox

Solo en la base desechable se agregaron una política sintética (`customer_quote`, MXN, 15,000 / 35,000.02, `>`) y un
tipo de cambio sintético en `CQ-QA-0001-R1` para ejercitar el nivel de aprobación y la conversión.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/customer_quote_builder.test.mjs` | 8/8 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura) | 154/154 |
| `tests/quotes_http_check.py` | 91/91 |
