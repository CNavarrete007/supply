# Cotizaciones › Solicitud a proveedores (RFQ) (13 nov 2026)

Tarjeta 2 de **Cotizaciones y Comparativo** con el diseño original (`src/views/Quotes.jsx`, tarjeta 2) alimentada por
MariaDB. Componente `src/views/quotes/RfqRequestCard.jsx`, lógica pura `src/views/quotes/rfq.mjs`.

## Flujo

1. **Comprador responsable**: compradores de la validación del contratista (`requisition_reviews`, la más reciente por
   requisición): usuario asignado (`buyer_user_id`) o el nombre histórico (`buyer_snapshot`); también "Sin comprador
   asignado". Al elegirlo se abre la ventana **Requisiciones validadas disponibles para RFQ** (búsqueda en servidor) con
   folio, cliente, validación (folio y estrategia), partidas, RFQ y cotizaciones contra el mínimo, y aviso "Con OC".
2. **Requisición validada**: carga sus partidas vigentes (`line_status='active'`) y llena *Lugar de entrega*, *Fecha
   requerida* y *Referencia interna* (referencia interna o folio · proyecto o cliente).
3. **Proveedor invitado**: catálogo de proveedores; la **moneda** se toma de su moneda habitual y se puede cambiar.
   Proveedores **suspendidos o inactivos** aparecen deshabilitados; "en evaluación" muestra un aviso.
4. **Contacto de compras**: usuarios activos con rol Comprador o Master Admin (se propone el comprador si es usuario).
5. **Folio RFQ**: *previsto* (`RFQ-AAAA-NNNN` siguiente al mayor registrado del año de emisión); se confirma al guardar.
6. **Generar Solicitud y Partidas** valida los obligatorios (*), que la fecha límite no sea anterior a la emisión y que el
   proveedor sea invitable; luego muestra:
   - **Partidas que se enviarán a este proveedor**: incluir/excluir, *Seleccionar todas*, *Limpiar selección*, a qué RFQ y
     proveedor ya se envió cada partida y aviso si se repite el mismo proveedor; RFQ ya registradas de la requisición.
   - **Formato de Solicitud de Cotización**: vista previa en `iframe` aislado, sin precios, con la marca
     *VISTA PREVIA · NO REGISTRADA*; **Imprimir vista previa**.
   - **Ver matriz** vuelve a la tarjeta 3.

**Guardar y siguiente RFQ** (26 nov 2026) **registra la RFQ en MariaDB**:
- folio definitivo **RFQ-AAAA-NNNN** (año de la emisión, consecutivo), proveedor, contacto de compras, fechas, moneda, lugar de
  entrega, documentación, condiciones y las **partidas elegidas** (numeradas 1..n en el orden de la requisición, como en tus
  datos; sin precios);
- estatus **Borrador** o **Enviada** (Respondida la marca la cotización registrada en la tarjeta 4);
- exige que la **validación vigente** del contratista permita cotizar, un proveedor invitable y un contacto con usuario
  Comprador o Master Admin;
- al terminar conserva comprador, requisición, fechas, contacto y la selección de partidas, y limpia el proveedor para la
  siguiente RFQ.

**SupplyFlow no envía correos.** El formato registrado se imprime desde la Matriz de RFQ (**Ver**) y se manda desde el correo
del comprador. Una RFQ guardada como Borrador se pasa a Enviada con **Marcar enviada** en la Matriz de RFQ; solo las RFQ
enviadas pueden recibir cotización. Las partidas de una RFQ registrada no se modifican (si cambian, se registra otra RFQ).
Endpoints, permisos y activación en la PC: [REGISTRO_COTIZACION_PROVEEDOR.md](REGISTRO_COTIZACION_PROVEEDOR.md).

En la tarjeta 3, **Ver** abre el formato de una RFQ ya registrada (mismo formato, sin marca de vista previa, imprimible) y
**Nueva RFQ** lleva a la tarjeta 2.

## Endpoints (solo lectura, Master Admin, cuenta API `SELECT`)

| Ruta | Contenido |
| --- | --- |
| `GET /api/v1/quotes/rfq-setup` | `buyers[{key,name,email,requisitions}]`, `suppliers[{id,code,name,currency,status}]`, `contacts[{id,name,email,phone,position,roles}]`, `folios{AAAA:n}`, `currencies` |
| `GET /api/v1/quotes/rfq-requisitions?buyer=&q=&page=&page_size=` | requisiciones con validación; `buyer` = `all`, `unassigned`, UUID de usuario o `legacy-<16 hex>` |
| `GET /api/v1/quotes/rfq-requisitions/{id}` | requisición validada, partidas vigentes con `sent_to[{rfq,supplier_name}]` y sus RFQ; 404 si no tiene validación |
| `GET /api/v1/quotes/rfqs/{id}` | (ampliado) agrega contacto, correo, teléfono, referencia interna, proyecto y contrato para el formato |

El detalle del proveedor del formato (contacto principal, correo y teléfono) usa el endpoint existente
`GET /api/v1/catalogs/suppliers/{id}`.

## Reglas por confirmar con el Apps Script

- "Disponible para RFQ": hoy se listan **todas** las requisiciones con validación del comprador, primero las que no tienen
  orden de compra (las que sí la tienen llevan el aviso "Con OC").
- Folio: se usa RFQ-AAAA-NNNN (43 de tus 50 RFQ). 7 de tus RFQ importadas usan RFQ-AAAA-NNNN-N; si el sistema original
  agregaba ese sufijo (p. ej. por proveedor), envíame esa parte del Apps Script.
- Si una RFQ puede dirigirse a un proveedor suspendido (hoy no se permite).

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/rfq_model.test.mjs` | 8/8 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura) | 85/85 |
| `tests/quotes_http_check.py` (con `SF_NONADMIN_USER` y `SF_ADMIN2_USER`) | 59/59 |
