# SupplyFlow Backend R3C3 — Constancias comerciales y verificación independiente

**Fecha:** 2026-11-06. **Base exacta:** `supply(2).zip` (R3A/R3B), delta R3C1 y delta R3C2. **Estado:** código preparatorio probado en aislamiento, **no instalado ni habilitado contra la MariaDB del usuario**.

## Alcance implementado

R3C3 incorpora constancias **por documento individual**, con evidencia privada ya existente y segunda revisión administrativa independiente. No equivale a una firma del tercero, entrega de proveedor, aceptación del cliente, emisión de una nueva cotización, enmienda de OC o aplicación de una revisión de requisición.

### API (sesión `master_admin` de la misma organización)

- `GET /api/v1/recovery/changes/{change_uuid}/commercial-executions`: historial hasta 100 constancias (más indicador `truncated`), con UUID públicos de documentos/evidencias, sin IDs internos. Solo administrador distinto al autor de la solicitud; no modifica datos.
- `POST /api/v1/recovery/changes/{change_uuid}/commercial-executions`: guarda **constancia** pendiente de segunda revisión, con acción permitida, vínculo al documento real, referencia, motivo, SHA-256 del contenido comercial y archivo privado **ya existente**, `scan_status='clean'` y vinculado mediante `entity_files` al cambio, documento fuente o sucesor. Valida versión de cambio/requisición, evaluación R3C2 vigente, hash del inventario y tratamiento R3C2 compatible.
- `POST /api/v1/recovery/changes/{change_uuid}/commercial-executions/{execution_uuid}/review`: un **tercer administrador** `master_admin`, distinto del autor de la solicitud y del registrador, registra `verified` o `rejected` después de revalidar documentos, hash, archivo y evaluación. Cada constancia puede recibir **una** revisión definitiva.

Las dos escrituras requieren sesión válida, CSRF, `If-Match: "{change_version}"`, `Idempotency-Key` UUID, JSON estricto, y auditoría. La API ejecuta transacciones y el `GET_LOCK` cooperativo de RF1; **no garantiza bloqueo de escritores externos que no respeten el mismo contrato**.

### Acciones acotadas

| Documento | Acción de evidencia | Tratamiento previo R3C2 requerido |
|---|---|---|
| RFQ | `supplier_contact_documented` | `obtain_confirmation` |
| Cotización de proveedor | `supplier_confirmation_documented` | `obtain_confirmation` |
| Versión de cotización de cliente | `client_confirmation_documented` | `obtain_confirmation` |
| Versión de cotización de cliente | `replacement_quote_verified` | `prepare_requote` |
| Orden de compra | `formal_amendment_verified` | `prepare_formal_amendment` |

`replacement_quote_verified` **no crea** versiones: exige sucesora existente en la misma serie, versión exacta siguiente, `supersedes_version_id` del origen, `change_request_id` de la solicitud, `issued_at`, `locked_at` y `approved_content_sha256` presentes. `formal_amendment_verified` exige sucesora existente de la misma serie, proveedor, versión siguiente y `supersedes_purchase_order_id`, `change_request_id` correspondiente, más `authorized_at`, `locked_at` y `approved_content_sha256`; ambas deben pertenecer a la requisición.

La presencia de estos metadatos **no sustituye** la verificación de firmantes, importes, impuestos, políticas de aprobación o evidencias de la contraparte. Solicitudes de `prepare_requote` para RFQ/cotización de proveedor y dependencias restantes (facturas, recepciones, entregas, servicios, etc.) **no tienen emisión automatizada** en R3C3; siguen requiriendo flujo comercial específico.

### Ejemplo orientativo (no ejecutar en producción)

Consultar primero el GET de R3C2 para obtener `change_version`, `assessment_version`, `requisition_version` e `inventory_sha256`. **Si se emitió una versión comercial después de la evaluación, registrar una nueva evaluación R3C2 sobre el inventario actual** antes de documentar la constancia.

```
POST /api/v1/recovery/changes/{change_uuid}/commercial-executions
Content-Type: application/json
If-Match: "{change_version_vigente}"
Idempotency-Key: {UUID_nuevo}
X-SF-CSRF: {token}
Cookie: sf_session=...; sf_csrf=...
```
```json
{
  "assessment_version": 1,
  "requisition_version": 2,
  "inventory_sha256": "<HASH_DESDE_R3C2_GET>",
  "document_kind": "supplier_quotes",
  "document_id": "<UUID_COTIZACION_EXISTENTE>",
  "action": "supplier_confirmation_documented",
  "successor_id": null,
  "evidence_file_id": "<UUID_ARCHIVO_CLEAN_Y_VINCULADO>",
  "reference": "CONF-SUP-001",
  "reason": "Se adjuntó evidencia para una revisión independiente.",
  "acknowledge_no_document_mutation": true
}
```

Segundo revisor, con una nueva clave idempotente:

```
POST /api/v1/recovery/changes/{change_uuid}/commercial-executions/{execution_uuid}/review
If-Match: "{change_version_vigente}"
```
```json
{
  "assessment_version": 1,
  "requisition_version": 2,
  "inventory_sha256": "<HASH_DESDE_R3C2_GET>",
  "decision": "verified",
  "reason": "La referencia y la huella corresponden a la evidencia adjunta.",
  "acknowledge_evidence_only": true
}
```

`verified` significa **verificación administrativa interna de evidencia**, no una aceptación certificada del proveedor/cliente ni una aprobación contractual.

## Cambios SQL pendientes — NO APLICAR

`migrations/manual/R3C3_commercial_execution_evidence.sql` propone **dos tablas append-only** (constancias y revisiones), además de una clave única compuesta de soporte en la tabla R3C2 de evaluaciones, que permite la FK compuesta de organización, solicitud y requisición. No modifica archivos ni documentos comerciales históricos.

Con R3C1, R3C2 y R3C3 aplicados, el esquema planificado pasaría de **74** tablas base a **77**. El contrato proyectado de permisos `supplyflow_recovery_local` pasa de **38** grants actuales a **52** (46 en R3A/R3B, 48 con R3C2, cuatro `SELECT/INSERT` adicionales para las dos tablas R3C3). **No modificar permisos SQL de forma aislada:** actualizar juntos aprovisionador y verificador RF1, probar migraciones y DDL en una base TEST sintética, verificar respaldo y luego solicitar autorización expresa. El aprovisionador RF1 histórico sigue exigiendo 38 y 74.

**Requisitos antes de activar:** migraciones R3C1 y R3C2 ejecutadas y verificadas en TEST; migración R3C3 autorizada, grants acordados y ensayados; cuenta de recuperación montada en API, **tres** cuentas `master_admin` diferentes para el ciclo completo (A solicita, B registra evidencia, C revisa), archivos de evidencia privados ya cargados/escaneados y asociados con `entity_files`, prueba HTTP autenticada, y revisión de concurrencia real. El backend R3C3 **no contiene funcionalidad de subida de archivos**.

## Garantías y limitaciones explícitas

- Ninguna ruta cambia tablas de RFQ, cotizaciones, OC, recepciones, facturas, inventario o `requisitions`.
- No altera `RequisitionChangeDecisionRepository`: **la aplicación R3B continúa bloqueada cuando existen documentos comerciales relacionados**. `commercial_reconciliation_complete` permanece `false` incluso con una evidencia `verified`.
- Solo documentos RF1 locales no importados; documentos comerciales importados se excluyen del flujo automático de evidencias.
- Evidencias: la integridad se comprueba contra `files.sha256` persistido y su estado `clean`/asociación; el repositorio no relee los bytes físicos en cada revisión. La emisión/validación externa del documento no está demostrada.
- Las evaluaciones R3C2 son por *categoría*, R3C3 por *documento*. No hay todavía matriz de liberación por documento ni estados comerciales efectivos.
- El esquema es propuesto, no ejecutado. No hay pruebas HTTP integradas, ni de DB/rollback/concurrencia reales.

## Pruebas aisladas

`php tests/r3c3_execution_test.php` verifica validación, tratamientos, sucesoras y fingerprints sin conexión a DB. `python tests/r3c3_contract_check.py` valida contratos estáticos, rutas, DDL e inmovilidad de documentos. Conserva y reejecuta tests R3A, R3B, R3C1 y R3C2.

## Qué falta para conciliar de verdad

Flujo financiero autorizado para emitir sucesoras (con importes, impuestos, líneas, policy snapshots, aprobación y firmas), comunicación y aceptación verificable con tercero, política formal de conciliación documento por documento y bloqueo/desbloqueo solo después de reconciliar **todas** las dependencias. R3C3 no inventa esas reglas ni permite sobreescribir contratos emitidos.

## Instalación del paquete

- **Delta R3C3:** usar solo si R3C1 y R3C2 ya están integrados y los SHA de origen del manifiesto coinciden.
- **Acumulativo R3C1 + R3C2 + R3C3:** usar solo si el código coincide con `supply(2).zip` (incluye R3A/R3B). No combinarlo con el delta.
- Respaldar archivos previos, comparar origen y destino del manifiesto, incorporar únicamente backend y pruebas al entorno de desarrollo. **No ejecutar los SQL de `migrations/manual`, `Provision` ni `Start` sin autorización separada**.
