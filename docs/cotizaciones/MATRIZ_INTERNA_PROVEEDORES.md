# Cotizaciones › Matriz interna de proveedores (17 nov 2026)

Tarjeta 11 de **Cotizaciones y Comparativo** ("Matriz de cotizaciones") con el diseño de referencia, **sin** el botón
"Comparar con IA" (a petición). Componente `src/views/quotes/SupplierMatrixCard.jsx`; lógica pura en
`src/views/quotes/supplierMatrix.mjs`. Uso interno: muestra costos de proveedor y nunca se comparte con el cliente.

## Diseño

1. "Matriz de cotizaciones" + **+ Nueva cotización** (abre Registro de cotización, tarjeta 4).
2. Leyenda **Acciones** (EDITAR, ADJUDICAR, ELIMINAR) con el aviso de escrituras bloqueadas.
3. **Tarjetas por proveedor** (contenedor con desplazamiento): "Todas las cotizaciones · Vista general" con
   Cotizaciones / Adjudicadas / Sin adjudicar y una por proveedor (iniciales, nombre, "Proveedor") con
   Cotizaciones / Adjudicadas / Activas; insignia "N proveedor(es) · M cotización(es)".
4. Al abrir una tarjeta: barra "N registro(s)" con búsqueda y **← Volver a tarjetas**, y la matriz con las columnas
   Folio, Requisición, Referencia interna, Proveedor (N partida(s)), Total, Entrega, Técnico, Documental, Puntaje,
   Estatus, PDF cotización y Acciones. 25 filas por página en el servidor.

## Datos (solo lectura)

| Fuente | Uso |
| --- | --- |
| `GET /quotes/supplier-quotes` (`supplier`, `q`, `page`) | filas y tarjetas (`summary.suppliers`). Campos aditivos: `requisition_id`, `client_reference`, `internal_reference`, `offered_count`, `awarded_lines` (partidas activas con adjudicación vigente), `req_items` (partidas activas), `file_count` y `file_name` (archivos asociados a la cotización, sin los reemplazados/retirados). La búsqueda también cubre referencia interna y del cliente |
| `GET /quotes/comparison?requisition=…` | **Puntaje**: se consulta el comparativo de cada requisición visible (máximo 3 consultas simultáneas) y se calcula con el mismo criterio provisional de la tarjeta 5 (precio 40, entrega 15, técnico 25, documental 20); ★ = recomendada |
| `GET /quotes/supplier-quotes/{id}` | detalle interno (partidas con precio unitario del proveedor) |

Estatus: **Adjudicada total** (todas las partidas activas adjudicadas a esa cotización), **Adjudicada parcial**, o el
estatus registrado (p. ej. Recibida, Seleccionada, No seleccionada).

## Acciones

| Acción | Comportamiento |
| --- | --- |
| EDITAR | abre el detalle registrado (documento interno en iframe aislado, con Imprimir). Modificar la cotización registrada es **escritura comercial bloqueada**; ofrece abrir el comparativo o ir a Registro de cotización |
| ADJUDICAR | abre el comparativo (tarjeta 5) de la requisición, donde se elige la oferta por partida |
| ELIMINAR | con adjudicación vigente: se conserva (trazabilidad). Sin adjudicación: confirmación con el folio exacto y "No se eliminó: escritura comercial bloqueada" |
| PDF cotización | "Sin PDF" si no hay archivo registrado; si existe, **VER PDF** muestra el nombre del archivo y la vista generada con los datos de MariaDB. La **descarga del archivo original** aún no tiene endpoint (pendiente; requiere autorización y revisión de seguridad) |

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/supplier_matrix.test.mjs` | 6/6 (todas las unitarias: 147/147) |
| `tests/frontend/quotes_ui_e2e.cjs` (tarjeta 11 completa, puntaje exacto vs. comparativo; sin escrituras) | 233/233 |
| `tests/quotes_http_check.py` (campos aditivos coherentes con el comparativo, búsqueda) | 147/147 |
| `tests/frontend/quotes_revisions_write_ui_e2e.cjs` (`SF_SYNTHETIC_WRITES=1`) | 25/25 |
| Smoke de módulos, Matriz General, OC, Proveedores | todas PASS |
