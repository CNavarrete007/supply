# Cotizaciones › Adjudicación definitiva (17 nov 2026)

Tarjeta 10 de **Cotizaciones y Comparativo** con el diseño de referencia. Componente
`src/views/quotes/DefinitiveAwardCard.jsx`; lógica pura en `src/views/quotes/definitiveAward.mjs` (usa el puntaje del
comparativo, `comparison.mjs`, y el estatus normalizado, `cqMatrix.mjs`).

## Diseño

1. "🏆 Adjudicación definitiva" + insignia **Posterior a aceptación**.
2. Flujo 1–6: Comparativo → Selección preliminar → Cotización al cliente → **Aceptación del cliente (gate
   obligatorio)** → **Adjudicación definitiva** (etapa actual) → Orden de Compra.
3. Regla: antes de la aceptación del cliente solo existe una *selección preliminar*; la adjudicación definitiva confirma
   al proveedor con respaldo comercial del cliente.
4. **Cotizaciones aceptadas elegibles**: referencia del cliente (o folio de la requisición), cliente, cotización ·
   Rev. · Aprobada y estado: **Elegible** (sin adjudicar), **Adjudicación parcial**, **Adjudicada** o **Con OC**.
5. **Qué se valida en esta etapa** + **📊 Abrir comparativo** (tarjeta 5 con la requisición elegida).
6. Al elegir una cotización: detalle por partida y, plegado al final, **Adjudicaciones vigentes registradas** (la tabla
   anterior de adjudicaciones vigentes con su OC).

## Datos (solo lectura)

| Fuente | Uso |
| --- | --- |
| `GET /quotes/customer-quotes?scope=current&group=approved` | elegibles; campos aditivos `item_count` (partidas activas), `awarded_items` (partidas con adjudicación vigente) y `purchase_orders` (OC vigentes, no canceladas ni sustituidas) |
| `GET /quotes/comparison?requisition=…` | ofertas por partida, adjudicación vigente, cotizaciones de proveedor (puntaje), OC y cotización al cliente vigente |
| `GET /quotes/awards?status=current` | adjudicaciones vigentes registradas |

## Detalle por partida

| Columna | Origen |
| --- | --- |
| Recomendado | oferta de la cotización recomendada por el puntaje provisional del comparativo; si esa cotización no ofertó la partida, la oferta más barata en su moneda |
| Proveedor definitivo | parte de la **adjudicación vigente**; sin ella, del recomendado. Se elige entre las ofertas registradas |
| Oferta utilizada, costo unitario, importe, plazo | de la oferta elegida (la moneda se muestra en los importes) |
| Estado | Adjudicada vigente / Por confirmar / Cambio / Sin adjudicar |
| Justificación | obligatoria (≥ 15 caracteres) cuando el definitivo es distinto al recomendado |

**Confirmar adjudicación definitiva** valida: gate (la revisión vigente de la cotización al cliente debe estar aprobada),
proveedor y oferta en cada partida activa, cantidad ≤ ofertada, justificación y que, con OC vigente, no se cambie el
proveedor de una partida ya adjudicada (requeriría enmienda de OC). Muestra el compromiso por proveedor (base de la OC).
Si coincide con la adjudicación vigente: "no hay cambios que confirmar". Si es válida: **no se registró**, porque
confirmar la adjudicación y generar la OC son escrituras comerciales bloqueadas hasta su autorización.

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/definitive_award.test.mjs` | 5/5 (todas las unitarias: 141/141) |
| `tests/frontend/quotes_ui_e2e.cjs` (tarjeta 10 completa; sin escrituras) | 213/213 |
| `tests/quotes_http_check.py` (elegibles y conteos = comparativo) | 140/140 |
| `tests/frontend/quotes_revisions_write_ui_e2e.cjs` (`SF_SYNTHETIC_WRITES=1`) | 25/25 |
| E2E de Matriz General, OC, Reportes, Factura, Recepción, Proveedores, Clientes, Suministros y smoke | todas PASS |

En el sandbox se agregó, fuera del repositorio, una requisición sintética aprobada por el cliente con dos ofertas de
proveedor y sin adjudicar (CQ-QA-0008). La prueba "filtro de documentos" de Matriz General ahora calcula el número
esperado desde la API en lugar de fijarlo en 2.
