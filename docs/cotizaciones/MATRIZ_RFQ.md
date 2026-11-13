# Cotizaciones › Matriz de RFQ por contacto de compras (13 nov 2026)

Tarjeta 3 de **Cotizaciones y Comparativo** con el diseño de la imagen de referencia. Componente
`src/views/quotes/RfqMatrixCard.jsx`; ayudas puras en `src/views/quotes/rfq.mjs`. Solo lectura.

## Qué muestra

- **Idioma de RFQ / RFQ language** (Español / English): rige el formato que abre **Ver** y la vista previa de la tarjeta 2.
  Se traducen las etiquetas y textos fijos del formato; las descripciones capturadas se muestran tal como se registraron.
- **RFQ por contacto de compras**: una tarjeta por contacto (`rfqs.internal_contact_user_id`; si la RFQ importada solo
  trae el nombre en `contact_snapshot`, se agrupa por ese nombre; sin ninguno → "Sin contacto asignado") más
  **Todas las RFQ**. Cada tarjeta: iniciales, nombre, correo · teléfono, **RFQ**, **Respondidas** (tienen cotización de
  proveedor), **Vencidas** (fecha límite pasada sin respuesta), proveedores y requisiciones distintos y **% de respuesta**
  (respondidas / RFQ). Buscador de contactos por nombre, correo o teléfono con el contador "N de M contactos".
- **Abrir contacto / Abrir todas**: matriz paginada (25 por página) filtrada **en el servidor**, con búsqueda por RFQ,
  requisición, proveedor, cliente o referencia interna. Columnas: folio RFQ, requisición (cliente), referencia (referencia
  interna o folio · proyecto), comprador (de la validación del contratista; debajo el contacto si es distinto),
  proveedor, emisión, límite (en rojo si venció sin respuesta), moneda, estatus con su respuesta (Respondida · COT,
  Vencida o En espera) y acciones (**Ver**). **✕** y **← Volver a contactos** cierran la matriz.
- **Fecha enviado**: el esquema de MariaDB no guarda la fecha de envío de una RFQ, por eso se muestra "—". Se llenará
  cuando el envío de RFQ (escritura comercial, hoy bloqueada) registre esa fecha.
- **+ Nueva RFQ** lleva a la tarjeta 2.

## Endpoints (Master Admin, cuenta API `SELECT`)

| Ruta | Contenido |
| --- | --- |
| `GET /api/v1/quotes/rfq-contacts` | `contacts[{key,name,email,phone,rfqs,responded,overdue,suppliers,requisitions}]` y `all{rfqs,responded,overdue,suppliers,requisitions,contacts}` |
| `GET /api/v1/quotes/rfqs?contact=` | (ampliado) filtro por contacto (`all`, `unassigned`, UUID de usuario o `legacy-<16 hex>`); cada fila agrega `contact_key`, `internal_reference`, `project`, `buyer_name` |

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/rfq_model.test.mjs` | 9/9 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura) | 100/100 |
| `tests/quotes_http_check.py` | 70/70 |
| `tests/frontend/modules_smoke_e2e.cjs` | 39/39 |

En el sandbox se agregaron (solo en la base desechable) dos RFQ sintéticas `RFQ-QA-0005/0006` con contacto histórico
para probar la agrupación por nombre importado.
