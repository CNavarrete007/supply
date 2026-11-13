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

**Guardar y siguiente RFQ** permanece **bloqueado**: crear o enviar una RFQ es una escritura comercial que todavía no ha
superado pruebas integrales. Nada de esta tarjeta escribe en MariaDB.

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
- Formato del folio de RFQ del sistema original y si existe una secuencia propia (`document_sequences`).
- Si una RFQ puede dirigirse a un proveedor suspendido (hoy no se permite).

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/rfq_model.test.mjs` | 8/8 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura) | 85/85 |
| `tests/quotes_http_check.py` (con `SF_NONADMIN_USER` y `SF_ADMIN2_USER`) | 59/59 |
