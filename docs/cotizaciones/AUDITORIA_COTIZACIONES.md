# Cotizaciones y Comparativo · auditoría de funcionamiento (27 nov 2026)

Revisión de las 11 tarjetas: que funcionen, que guarden y registren lo que deben, y que su lógica siga intacta. Todo se
probó en la base **sintética** del sandbox (nunca sobre datos reales).

## Qué hace cada tarjeta y cómo quedó

| Tarjeta | Función | Escritura | Resultado |
|---|---|---|---|
| 2 · Solicitud a proveedores (RFQ) | Registra la RFQ sin precios (RFQ-AAAA-NNNN, Borrador/Enviada) | ✅ registro | OK |
| 3 · Matriz de RFQ | RFQ por contacto, fechas, respuestas; Borrador → Enviada | ✅ solo «Marcar enviada» | OK |
| 4 · Cotizaciones recibidas | Cotización del proveedor contra una RFQ enviada (COT, Recibida, PDF); edición si no está adjudicada | ✅ registro y edición | OK |
| 11 · Matriz interna de proveedores | Ofertas con costos y puntaje (uso interno) | Consulta | OK |
| 5 · Comparativo | Compara ofertas por partida (moneda mayoritaria) y recomienda | ❌ seleccionar = adjudicar, bloqueado | OK |
| 6 · Cotización al cliente | Precio de venta desde el costo (adjudicación o mejor oferta) + manipulación + margen, IVA, Service Fee | ✅ solo borrador interno | **Corregido**: mejor oferta con monedas distintas |
| 7 · Formato para el cliente | Documento/PDF sin costos | Consulta | OK · ver hallazgo pendiente |
| 8 · Matriz de cotizaciones al cliente | Todas las cotizaciones y revisiones | Consulta (+ R3A) | OK |
| 9 · Decisión del cliente | Aceptación / rechazo / cambios | ❌ bloqueado | OK |
| 10 · Adjudicación definitiva | Ganador por partida (origen de la OC) | ❌ bloqueado | OK |
| 1 · Revisiones / modificaciones | Familias Rev. 0 → Rev. N; «Solicitar modificación» (R3A) | Solo la solicitud R3A | OK |

## Cómo se comprobó

| Prueba | Qué demuestra | Resultado |
|---|---|---|
| `tests/quotes_flow_trace_check.py` (nueva) | Una requisición sintética recorre las 11 tarjetas por la API: lo que guarda cada una aparece igual en las que la leen (RFQ → enviada → cotizaciones A/B → comparativo → borrador al cliente → formato, matriz, revisiones, decisión, adjudicación), la bitácora registra cada guardado y las escrituras bloqueadas no tienen ruta | 26/26 |
| `tests/sql/quotes_integrity_check.sql` (nueva, **solo lectura**) | 33 verificaciones sobre todo lo registrado por SupplyFlow: folios únicos, una cotización por RFQ, importes de partida = cantidad × precio, subtotal = suma de partidas, total = subtotal + IVA (+ Service Fee), borradores sin estatus de emisión/aprobación, eventos y bitácora presentes, idempotencia completa, ninguna adjudicación creada | 33/33 en 0 anomalías (89 RFQ, 66 cotizaciones de proveedor, 19 borradores sintéticos) |
| Regresión completa (todas las pruebas del sistema, 73 grupos) | Que nada más se rompió | Todo PASS. «Crear desde historial» (UI) falló una vez por una recarga del navegador durante la corrida y pasó 10/10 al repetirla |
| Pruebas de Cotizaciones tras la corrección | Las 11 tarjetas en el navegador y los guardados reales | solo lectura 239/239 · tarjeta 6 (escritura) 28/28 · tarjeta 4 23/23 · tarjeta 2 19/19 · HTTP 166/166, 37/37, 40/40, 36/36 · contrato 11/11 · unidades 426 |

### Verificar tu base (opcional, sin riesgo)

`tests/sql/quotes_integrity_check.sql` solo tiene `SELECT`. En phpMyAdmin (`http://localhost:8081`) → base `supplyflow_dev`
→ pestaña **SQL** → pega el contenido → **Continuar**. Todas las filas, salvo las informativas «00 ·», deben marcar 0.

## Hallazgos

1. **Corregido · mejor oferta con monedas distintas (tarjeta 6).** Elegía la oferta comparando el número sin moneda.
   Ahora compara en MXN con el tipo de cambio de la tarjeta y la recalcula al cambiarlo. El servidor no cambió: acepta la
   oferta registrada que la tarjeta envía y recalcula los importes.
2. **Pendiente de tu decisión · borradores sin marca en la tarjeta 7.** Un borrador (y las importadas en «Borrador») se ve
   y descarga en PDF igual que una cotización final. Recomendado: marca «BORRADOR · NO VÁLIDA PARA EL CLIENTE» mientras no
   esté autorizada (solo presentación).
3. **Observación · tipo de cambio inicial = 1 (tarjeta 6).** Es el valor del diseño. Si hay costos en USD/EUR y no se
   captura ni se actualiza, el precio se calcula a 1 MXN por dólar. La tarjeta no lo bloquea; captúralo o pulsa
   «Actualizar tipo de cambio».
4. **Pruebas que dependían de la «página 1».** Los datos sintéticos crecen con cada corrida; las pruebas ahora buscan por
   folio o usan los campos nuevos de la lista. No era un defecto de la aplicación.
