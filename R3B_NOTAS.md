# SupplyFlow Backend R3B — Resolución y aplicación controlada de cambios

**Fecha:** 2026-11-06. **Base revisada:** `supply(1).zip` y paquete R3A `SupplyFlow_Backend_R3A_ControlCambios_Delta.zip`.

## Alcance exacto de R3B

R3B incorpora un proceso de revisión separado del solicitante:

- Bandeja de cambios R3A `pending_review` para un **segundo usuario con rol `master_admin` de la misma organización**. No se permite al creador de la solicitud aprobarse/rechazarse a sí mismo. Esta es una política **conservadora de ensayo**, no sustituye la definición futura de roles empresariales de autorización.
- Vista de revisión, con diferencias almacenadas, versiones de solicitud y requisición e indicadores de impacto.
- Decisión explícita `reject`, con motivo obligatorio, auditoría, idempotencia y resolución de las diferencias; **no altera los datos de la requisición**.
- Decisión `approve` únicamente sobre requisiciones originales RF1 (no importadas), sin planes ni documentos dependientes, con el mismo número de revisión base, versiones coincidentes y snapshots antes/después íntegros. Aplica en **una sola transacción** campos `need_date` y `delivery_place`, y cambios/cancelación de partidas existentes. Cada cancelación es lógica (`line_status='cancelled'`); no elimina partidas. Bloquea la cancelación de la última partida activa.
- Crea snapshot histórico con SHA-256, número de revisión y referencia al cambio; incrementa versión y revisión de la requisición, registra el cambio final y auditoría. No modifica ni recalcula cotizaciones, RFQ, proveedores, OC, recepciones, facturas ni entregas.
- Si R3A identifica la necesidad de abastecimiento o confirmación de proveedor, el resultado R3B **mantiene dichos indicadores como pendientes**: aprobar la revisión **no aprueba** al proveedor ni genera RFQ o enmiendas de OC.
- Un cambio `rejected` libera la edición ordinaria de RF1 en ausencia de otras dependencias; un cambio `applied` conserva la protección del expediente. Se permite crear solicitudes posteriores después de `rejected`, `withdrawn` o `applied`, pero nunca dos pendientes simultáneas.

## Contrato HTTP nuevo

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/v1/recovery/changes/review-queue` | Solicitudes pendientes para otro Master Admin |
| `GET` | `/api/v1/recovery/changes/<change_uuid>/review` | Detalle revisable y versiones actuales |
| `POST` | `/api/v1/recovery/changes/<change_uuid>/decision` | Aprobar y aplicar; o rechazar |

En POST se requieren la cookie de sesión, CSRF doble cookie-cabecera, `If-Match: "<version_de_solicitud>"`, `Idempotency-Key: <UUID>` y JSON. El endpoint no usa IDs internos desde el cliente.

Ejemplo **solo de contrato, no ejecutar sobre datos reales**:

```json
{
  "decision": "approve",
  "reason": "Cambio autorizado tras evaluación independiente",
  "requisition_version": 2,
  "acknowledge_scope": true
}
```

`requisition_version` se obtiene desde la vista de revisión; NO debe suponerse el valor 2. `acknowledge_scope` señala que el revisor comprende el alcance limitado y que siguen pendientes los compromisos comerciales con terceros; NO equivale a confirmación del proveedor. Para rechazar:

```json
{"decision":"reject","reason":"No cumple los requisitos documentales"}
```

## Bloqueos deliberados

1. **Cualquier relación comercial posterior** en `sourcing_plans`, `rfqs`, `supplier_quotes`, `customer_quotes`, `customer_quote_versions`, `requisition_reviews`, `awards`, `invoices`, `service_orders`, `purchase_order_requisitions` o `delivery_items`. Las tablas dependientes de estas (lotes, RFQ-items, quote-items, líneas de OC, fuentes de entregas) están cubiertas por sus FK, según el SQL incluido. Esto impide aplicar cambios que exijan conciliación del proceso comercial.
2. **Históricos importados**, expedientes no RF1, fuera de la organización y autoaprobaciones.
3. **Concurrencia** (If-Match de cambio y versión de requisición; candado por organización y `FOR UPDATE`) y diferencias `before` que ya no coincidan.
4. **Conflicto de numeración de snapshots**: R2 usa la misma clave única `(requisition_id, revision_number)` para regularización. R3B **no sobrescribe, reasigna ni renumera** automáticamente esos snapshots. Responde `SNAPSHOT_NUMBER_OCCUPIED` y exige conciliación posterior si el número propuesto está ocupado.
5. **Solicitudes con `add`**, incorporación de partidas nuevas, regularización histórica, enmienda de OC, recotización, aprobaciones comerciales posteriores, evidencias del cambio: NO implementadas en R3B (separadas en R3C / integración).

## Permisos MariaDB: se necesita autorización adicional antes de instalar/activar

El usuario `supplyflow_recovery_local` está provisionado para **38 permisos exactos**. R3A requiere cuatro adicionales (INSERT y UPDATE `requisition_change_requests`, INSERT y SELECT `requisition_change_items`). R3B agrega exactamente otros cuatro:

| Tabla | Permiso R3B | Motivo |
|---|---|---|
| `requisition_change_items` | `UPDATE` | Marcar `applied`/`rejected` |
| `sourcing_plans` | `SELECT` | Bloquear aplicación si ya existe abastecimiento |
| `customer_quotes` | `SELECT` | Bloquear si existe serie comercial incluso sin versión |
| `delivery_items` | `SELECT` | Bloquear entregas directas sin vinculación a OC |

**Total previsto: 46 permisos**, no 38. El aprovisionador `docker/supply-recovery/provision.py` exige exactamente 38 y **NO** forma parte de este kit. Ni ejecutar `GRANT` manualmente ni habilitar `Start` con ese estado: requiere un cambio de contrato, pruebas y autorización independiente. No se han hecho cambios en MariaDB ni en tu Windows desde esta entrega.

## Archivos

El ZIP **acumulativo R3A+R3B** está diseñado para el `supply(1).zip` que aportaste, donde R3A aún no estaba incluido. Copiar solo el contenido de `backend/` y `tests/` tras revisar el diff y respaldar archivos existentes. No copiar credenciales, archivos de compose ni Docker. **No hacer instalación directa en tu entorno vivo** hasta verificar permisos e integración.

El ZIP **delta R3B** requiere que R3A ya se haya incorporado completo. En ambos paquetes, el `MANIFEST_R3B.json` especifica hashes SHA-256 por ruta para cotejar archivos antes de instalarlos.

## Pruebas realizadas aquí

- PHP 8.4.24: sintaxis verificada para 10 archivos PHP del kit acumulativo.
- `tests/r3a_input_test.php`: 27/27 PASS.
- `tests/r3a_contract_check.py`: PASS.
- `tests/r3b_application_test.php`: 28/28 PASS (entradas, planificador puro, casos negativos).
- `tests/r3b_contract_check.py`: PASS (esquema 20 tablas y 21 controles de contrato).
- No hay `mysqli` ni MariaDB remota disponible en este laboratorio. No se han probado `php spark routes`, transacciones reales, privilegios efectivos, HTTP autenticado, doble sesión de Master Admin ni pruebas con Docker/Windows. La compatibilidad completa con Apps Script no está acreditada.

## Siguiente desarrollo

R3C: reconciliación segura con RFQ/cotizaciones/OC, incorporación de partidas, documentos de evidencia, políticas de aprobación organizacionales y resolución del conflicto de snapshots R2/R3. Primero corresponde ejecutar una integración R3A/R3B en base **sintética** con el contrato de permisos revisado.
