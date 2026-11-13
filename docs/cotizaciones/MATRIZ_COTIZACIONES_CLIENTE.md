# Cotizaciones › Matriz de cotizaciones al cliente (13 nov 2026)

Tarjeta 8 de **Cotizaciones y Comparativo** con el diseño de referencia (sin el selector de idioma, a petición).
Componente `src/views/quotes/CustomerQuoteMatrixCard.jsx`; lógica pura en `src/views/quotes/cqMatrix.mjs`.

## Diseño

1. Encabezado "Matriz de cotizaciones al cliente" + botón **+ Nueva cotización al cliente** (abre la tarjeta 6).
2. Buscador "Buscar por folio, cliente, requisición o estatus..." y selector con los 9 estatus del original:
   Borrador, En revisión interna, Autorizada internamente, Enviada al cliente, Aprobada, Solicitud de modificación,
   Rechazada, Vencida y Sustituida (con conteo del servidor).
3. Aviso ámbar: *Cambio posterior a aprobación: no elimines ni sobrescribas la cotización. Usa MODIFICAR DESDE
   REQUISICIÓN para generar Rev. N con trazabilidad.*
4. **Tarjetas por cliente**: "Todas las cotizaciones · Vista general" (TOD) y una por cliente (iniciales, nombre,
   "Cliente") con Cotizaciones / Aprobadas / Pendientes y "Abrir todas →" / "Abrir cliente →". Insignia
   "N cliente(s) · M cotización(es)".
5. Al abrir una tarjeta se despliega la matriz (título del cliente, leyenda "Mostrando…", botón ✕) con las columnas
   Cotización (folio, insignia de aprobación y Rev.), Rev., Cliente, Requisición, Referencia interna, Emisión,
   Vigencia, Total, Estatus, Comprador (nombre y puesto), Revisó, Autorizó, Decisión del cliente (con fecha), PDF y
   Acciones. Paginación de 25 en el servidor. Si se busca o filtra sin abrir tarjeta, se abre "Todas".

## Datos (solo lectura, `GET /api/v1/quotes/customer-quotes?scope=all` ampliado de forma aditiva)

| Parámetro / campo | Uso |
| --- | --- |
| `status` (`all`, `draft`, `review`, `authorized`, `sent`, `approved`, `rejected`, `change_requested`, `superseded`, `expired`, `other`) | filtro de estatus en el servidor; cualquier otro valor → 422 |
| `client` | tarjeta abierta (UUID público del cliente) |
| `q` | busca en folio, serie, requisición, cliente, estatus importado, referencia interna, referencia del cliente y la **etiqueta** del estatus ("aprobada", "vencida"…) |
| `status_key` | estatus normalizado (`QuoteReadRepository::STATUS_KEY`) |
| `reviewed_by`, `prepared_by_position`, `internal_reference`, `approval_level` | columnas Revisó, puesto del comprador, Referencia interna y "Nivel N · Comprador" (si la evaluación registrada trae nivel; si no, se muestra el estado de la aprobación interna) |
| `is_current`, `current_folio`, `requisition_id`, `change_block`, `can_request_change`, `pending_change` | elegibilidad de MODIFICAR DESDE REQ. |
| `summary.statuses`, `summary.client_cards` | conteos del selector y de las tarjetas (mismo alcance, sin filtros) |

Los campos y el resumen anteriores (`decisions`, `clients`, `money`) no cambian; la tarjeta 9 los sigue usando.

### Estatus normalizado

- Una revisión `superseded`/`cancelled` siempre es **Sustituida**.
- Si existe estatus importado del sistema original (`legacy_status`), manda su etiqueta (Borrador, En revisión interna,
  Autorizada…, Enviada…, Aprobada, Rechazada, Solicitud de modificación/Cambios, Sustituida, Vencida; sin distinguir
  acentos ni mayúsculas). Una etiqueta distinta queda como `other` y se muestra tal cual.
- Sin etiqueta importada deciden los códigos: decisión del cliente (aprobada, rechazada, cambios solicitados); emitida o
  enviada con **vigencia vencida y sin decisión → Vencida** (derivado solo para mostrar; no se guarda nada); emitida →
  Enviada al cliente; aprobación interna aprobada → Autorizada internamente; en revisión → En revisión interna;
  borrador → Borrador.
- Pendientes (tarjetas) = Borrador, En revisión interna, Autorizada internamente, Enviada al cliente y Solicitud de
  modificación.

## Acciones

| Acción | Comportamiento |
| --- | --- |
| VER PDF | visor formal de la tarjeta 1 (`GET /customer-quotes/{id}`, iframe aislado, Imprimir PDF) |
| MODIFICAR DESDE REQ. | revisión vigente elegible → modificación controlada **R3A** real de la requisición (misma API, CSRF, idempotencia y revisión independiente). Revisión sustituida → aviso que remite a la vigente. Histórico importado, no RF1, otro capturista o solicitud pendiente → motivo de bloqueo |
| VALIDAR COMPRADOR | solo en Borrador / En revisión interna. Es la aprobación interna: **escritura comercial bloqueada**; se avisa "No se registró nada" |
| ELIMINAR | cotización emitida, aprobada, sustituida o con historial → no se elimina (regla del aviso ámbar). Borrador sin historial → confirmación escribiendo el folio exacto; al confirmar se informa "No se eliminó: escritura comercial bloqueada". No se pide contraseña porque no se envía nada |
| + Nueva cotización al cliente | abre la tarjeta 6 |

## Pruebas (sandbox sintético)

| Prueba | Resultado |
| --- | --- |
| `node --test tests/frontend/cq_matrix.test.mjs` | 10/10 (todas las unitarias: 129/129) |
| `tests/frontend/quotes_ui_e2e.cjs` (tarjeta 8: tarjetas, filtros, búsqueda, VER PDF, R3A, bloqueos; sin escrituras) | 179/179 |
| `tests/quotes_http_check.py` (filtro de estatus/cliente, facet, tarjetas, elegibilidad, 422) | 112/112 |
| `tests/frontend/quotes_revisions_write_ui_e2e.cjs` (R3A real sintética, `SF_SYNTHETIC_WRITES=1`) | 25/25 |
| `tests/frontend/modules_smoke_e2e.cjs` | 39/39 |
| Mapeo de etiquetas importadas evaluado en MariaDB 11.8.9 (14 casos, sin escribir datos) | correcto |

Para el sandbox se agregaron dos cotizaciones **sintéticas** fuera del repositorio (una en Borrador y otra enviada con
vigencia vencida) sobre requisiciones sintéticas; nunca sobre datos reales.
