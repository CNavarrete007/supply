# Cotizaciones › Comparativo y selección preliminar (13 nov 2026)

Tarjeta 5 de **Cotizaciones y Comparativo** con el diseño de referencia. Componente `src/views/quotes/ComparisonCard.jsx`;
lógica pura `src/views/quotes/comparison.mjs`. Solo lectura sobre MariaDB.

## Datos

`GET /api/v1/quotes/comparison` (lista de requisiciones con cotizaciones) y `GET /api/v1/quotes/comparison?requisition=`,
que ahora agrega (sin quitar nada de lo anterior):

- `requisition`: id, folio, cliente, referencia interna, proyecto, contrato, presupuesto y moneda, fecha requerida,
  mínimo de cotizaciones y folio de la última validación del contratista, partidas vigentes.
- `lines[]`: además de las ofertas, `id`, categoría, estatus de la partida y `award` (adjudicación definitiva vigente).
- `quotes[]`: una por cotización de proveedor (total, días de entrega, pago, técnico, documental, estatus, partidas
  ofertadas y adjudicadas).
- `orders[]`: OC vigentes de la requisición (última versión de cada serie, no canceladas ni sustituidas).

## Subtarjetas

1. **Resumen de la requisición**: contexto, empresas participantes contra el mínimo (2 o el de la validación),
   recomendación actual y **+ Agregar otra empresa** (abre el registro de cotización, tarjeta 4).
2. **Productos solicitados**: partidas vigentes, categoría, cantidad, ofertas recibidas y mejor precio ofertado.
3. **Comparativo de proveedores**: posición (Recomendada, 2.º, …), proveedor, referencia, total, días, técnico,
   documental, pago, **puntaje** (desglose al pasar el cursor) y estatus (Adjudicada total/parcial o el de la cotización).
4. **Adjudicación por partida**: proveedor adjudicado por partida (por defecto la adjudicación vigente), cantidad a comprar,
   precio unitario de la oferta, "N OC vigente(s)", vista previa de las OC que se generarían por proveedor cuando hay
   cambios, **Guardar adjudicación** y **Ver órdenes generadas** (con enlace a Órdenes de Compra).
5. **Interpretación**: explicación y preguntas frecuentes.

**Registrar empresa / proveedor** abre el catálogo de Proveedores.

## Puntaje (criterio provisional)

MariaDB no guarda un puntaje total ni la fórmula del Apps Script; solo `technical_score` y `document_score` por
cotización. Mientras se confirma la fórmula original, SupplyFlow usa un criterio explícito y visible:

| Componente | Peso | Cálculo |
| --- | --- | --- |
| Precio por partida | 40 % | Promedio, sobre las partidas vigentes, de *mejor precio unitario ofertado ÷ precio de esta oferta* (partida no ofertada = 0) |
| Entrega | 15 % | (días más rápidos + 1) ÷ (días de esta oferta + 1) |
| Técnico | 25 % | `technical_score` (0–100) |
| Documental | 20 % | `document_score` (0–100) |

Solo se comparan ofertas en la moneda mayoritaria; las demás aparecen como "Otra moneda" y no se recomiendan. Empates:
menor total y luego menor plazo. **Pendiente:** confirmar pesos y fórmula con el Apps Script original.

## Guardar adjudicación

Valida las cantidades (mayores a cero; avisa si exceden lo ofertado) y compara contra la adjudicación vigente: sin
cambios lo indica; con cambios muestra "Adjudicación preparada … No se guardó", porque adjudicar y generar OC son
escrituras comerciales bloqueadas hasta su autorización. Nunca simula un guardado.

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/comparison.test.mjs` | 9/9 |
| `tests/frontend/quotes_ui_e2e.cjs` (aborta toda escritura) | 139/139 |
| `tests/quotes_http_check.py` | 86/86 |
