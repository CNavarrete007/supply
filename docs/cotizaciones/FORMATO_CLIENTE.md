# Cotizaciones › Formato de cotización para el cliente (13 nov 2026)

Tarjeta 7 de **Cotizaciones y Comparativo** con el diseño de referencia: documento comercial externo que puede
compartirse en el Portal del Cliente. Componente `src/views/quotes/ClientFormatCard.jsx`; documento en
`src/views/quotes/quoteDocument.mjs` (modelo normalizado + HTML con estilos propios, todo valor escapado).

## Datos (solo lectura, `GET /api/v1/quotes/customer-quotes/{id}` ampliado)

| Bloque | Origen |
| --- | --- |
| Encabezado | folio, **revisión** (`legacy_revision_number` o versión − 1), fecha, vigencia, moneda |
| COTIZA | registro de la organización (`organizations`: razón social, RFC, domicilio, correo, teléfono) — campo `issuer` |
| CLIENTE | razón social, RFC, contacto principal con correo y teléfono (`party_contacts` / `party_contact_channels`), proyecto, contrato y referencia del cliente de la requisición |
| Partidas | `customer_quote_items`: descripción, marca/modelo, cantidad, unidad, precio unitario e importe (nunca costo, gasto ni margen) |
| Condiciones | lugar y tiempo de entrega, condiciones de pago, garantía, alcance, exclusiones y notas; si faltan se muestran los textos predeterminados del diseño |
| Totales | Third Party (subtotal, descuento, IVA, total), Service Fee (si aplica) y general; usa las columnas `third_party_*` / `service_fee_*` cuando existen |
| Firmas | Comprador / Revisó / Autorizó con nombre y puesto (`people.position_title`); estado electrónico "Firmado electrónicamente" o "Pendiente", sin imágenes de firma |

La lista (`GET /api/v1/quotes/customer-quotes?scope=all`) agrega `revision` y `client_reference` para el selector
"folio · Rev. N · cliente · referencia". Se muestra por defecto la revisión más reciente; con muchas cotizaciones se usa
la búsqueda.

## Descargar PDF

Genera el archivo en el navegador con `html2pdf.js` (ya era dependencia del proyecto), tamaño carta, nombre
`FOLIO_RevN.pdf`. No escribe nada en el servidor. Si el navegador no puede generarlo, abre la impresión para "Guardar
como PDF". `vite.config.js` pre-empaqueta `html2pdf.js`, `html2canvas` y `jspdf` para que el servidor de desarrollo no
los optimice a mitad de sesión (no afecta el build de producción; verificado también con el build).

El mismo formato se usa en **VER PDF** (tarjeta 1) y en la **vista previa** de la tarjeta 6 (con marca "VISTA PREVIA ·
NO REGISTRADA").

## Notas

- Los importes se muestran con dos decimales (el ejemplo original mostraba `USD 134.016`).
- Si la organización no tiene domicilio/correo/teléfono registrados, el recuadro COTIZA muestra solo lo disponible.

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/quote_document.test.mjs` | 6/6 |
| `tests/frontend/quotes_ui_e2e.cjs` (incluye descarga real del PDF) | 155/155 |
| `tests/quotes_http_check.py` | 95/95 |
