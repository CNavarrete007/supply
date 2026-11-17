# Cotizaciones › Decisión del cliente / Control de aprobación (17 nov 2026)

Tarjeta 9 de **Cotizaciones y Comparativo** con el diseño de referencia. Componente
`src/views/quotes/ClientDecisionCard.jsx`; lógica pura en `src/views/quotes/cqDecision.mjs` (reutiliza el estatus
normalizado de la tarjeta 8, `cqMatrix.mjs`).

## Diseño

1. "Control de aprobación del cliente" + insignia **Trazabilidad comercial**.
2. Cinco indicadores (revisión vigente de cada cotización): **Preparación interna** (Borrador / revisión),
   **Pendientes del cliente** (Enviadas sin respuesta), **Aprobadas** (Habilitan la compra), **Modificación**
   (Requieren nueva revisión) y **Rechazadas** (No autorizadas).
3. **Decisiones y aprobación por cliente**: tarjeta "Todos los clientes" (N clientes, Vista general) y una por cliente
   (iniciales, nombre, contacto principal) con Pendientes / Sin respuesta / Modificar y "N requisición(es)". Insignia
   "N cliente(s) · M pendiente(s)".
4. Al elegir una tarjeta: barra "N cotización(es) por atender" con **← Volver a tarjetas** y la lista de cotizaciones
   (folio · Rev., cliente · referencia · total, estatus). Por omisión muestra las **por atender**; se agregaron filtros
   rápidos Sin respuesta, Modificación, Aprobadas, Rechazadas y Todas para conservar la consulta del historial.

## Datos (solo lectura, `GET /api/v1/quotes/customer-quotes?scope=current` ampliado de forma aditiva)

| Parámetro / campo | Uso |
| --- | --- |
| `group` (`all`, `attention`, `prep`, `client`, `approved`, `change`, `rejected`) | etapa en el servidor; otro valor → 422 |
| `client` | tarjeta elegida |
| `summary.statuses` | indicadores (agrupados en el navegador con los mismos grupos del servidor) |
| `summary.client_cards[].attention / no_response / change / requisitions / contact` | conteos de cada tarjeta y contacto principal (`party_contacts`) |
| `GET /customer-quotes/{id}` | **Historial**: decisiones (canal, responsable, nota) y revisiones de la serie |

Grupos: preparación = Borrador, En revisión interna, Autorizada internamente; pendientes del cliente = Enviada al cliente
y **Vencida sin respuesta** (fue enviada y el cliente no ha decidido); modificación = Solicitud de modificación; por
atender = preparación + pendientes del cliente + modificación. El resumen anterior (`decisions`, `clients`, `money`) no
cambia.

## Acciones

| Acción | Comportamiento |
| --- | --- |
| Editar | en preparación interna abre la tarjeta 6 (preparar/validar la propuesta; guardar sigue bloqueado). Enviada o decidida → no se edita; usar MODIFICAR DESDE REQ. (Rev. N) |
| Ver PDF | visor formal (iframe aislado, Imprimir PDF) |
| ENVIAR AL CLIENTE | solo en Autorizada internamente; envío por correo y cambio de estatus = **escritura comercial bloqueada** ("No se envió nada") |
| REGISTRAR DECISIÓN | en Enviada / Vencida: formulario con decisión (aprobada, solicita modificación, rechazada), fecha (no futura ni anterior a la emisión), hora, canal, quién decide por el cliente (se propone el contacto principal), comentario (obligatorio ≥ 10 caracteres al rechazar o pedir cambios) y evidencia PDF/PNG/JPG ≤ 10 MB (solo se valida, no se sube). Avisa si se aprueba con la vigencia vencida. Al confirmar: "no se registró" (escritura bloqueada) |
| MODIFICAR DESDE REQ. | en Solicitud de modificación: modificación controlada **R3A** real o motivo del bloqueo |
| Historial | decisiones y revisiones de la cotización |

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/cq_decision.test.mjs` | 7/7 (todas las unitarias: 136/136) |
| `tests/frontend/quotes_ui_e2e.cjs` (tarjeta 9 completa; sin escrituras) | 199/199 |
| `tests/quotes_http_check.py` (grupos, tarjetas, 422) | 132/132 |
| `tests/frontend/quotes_revisions_write_ui_e2e.cjs` (`SF_SYNTHETIC_WRITES=1`) | 25/25 |
| `tests/frontend/modules_smoke_e2e.cjs` | 39/39 |

En el sandbox se agregaron cotizaciones **sintéticas** fuera del repositorio (Autorizada internamente, Enviada,
Solicitud de modificación y Rechazada) sobre requisiciones sintéticas; nunca sobre datos reales.
